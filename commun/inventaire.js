/* ============================================================
   Inventaire
   Chargement des espèces d'une zone, ancêtres, arbre, séries.
   ============================================================ */

/* ============================================================
   4. Chargement
   ============================================================ */

/* Efface tout ce qui vient de l'inventaire précédent, y compris les séries temporelles.
   Ce qui appartient à un onglet est effacé par l'onglet lui-même : le socle ignore jusqu'à
   l'existence des biorégions ou du panier de comparaison. */
function reinitialiser() {
  etat.especes = []; etat.arbre = null;
  etat.annees = null; etat.mensuel = null; etat.tronque = false;
  etat.seriesCache = { research:{}, toutes:{} };
  etat.moisCache.clear(); moisV2 = null;
  etat.phenologie = null;
  etat.phenoCache = { research:null, toutes:null };
  etat.refFaite = { toutes:false, research:false };
  Object.assign(vue, { noeud:null, texte:'', mois:0 });
  vue.deplies.clear();

  viderModules(cartonVide('chargeEnCours', 'chargeEnCoursD'));

  // On revient à la première vue : garder sous les yeux un onglet vide n'apprend rien.
  const premier = document.querySelector('nav.onglets button');
  if (premier && !premier.classList.contains('actif')) premier.click();
}


/* « neuf » : ignorer ce qui est en mémoire et tout redemander. C'est ce que fait le bouton
   de chargement, parce qu'on ne l'actionne pas pour revoir ce qu'on a déjà — on l'actionne
   pour avoir les dernières données. La reprise silencieuse, elle, reste le comportement de
   l'ouverture d'une adresse ou d'un retour depuis un autre outil. */
function charger(neuf = false) {
  /* On invalide sur-le-champ : la tâche en cours s'arrêtera à sa prochaine vérification,
     sans quoi le nouveau chargement attendrait la fin de l'ancien dans la file des tâches. */
  generation++;
  return enTache(() => chargerMaintenant(neuf));
}

async function chargerMaintenant(neuf = false) {
  const gen = ++generation;          // toute exécution antérieure devient caduque
  retenirSelection();                // les autres outils reprendront la même zone
  $('#lancer').disabled = true;
  etat.charge = true;
  document.body.classList.remove('attente');
  reinitialiser();
  majURL(true);

  try {
    /* Un rechargement volontaire efface l'entrée en mémoire avant tout : sans cela le relevé
       périmé serait réécrit par-dessus le nouveau si celui-ci échouait à mi-chemin. */
    if (neuf) { try { await surBase('readwrite', st => st.delete(cleInventaire())); } catch (e) {} }
    if (!neuf && await restaurer(gen)) {
      /* Inventaire retrouvé en mémoire. Il peut lui manquer des pièces — effectifs de
         référence, phénologie, statut d'introduction — si la session précédente n'était pas
         allée jusqu'au bout ou si l'enregistrement date d'avant leur ajout. On complète en
         arrière-plan plutôt que de tout redemander. */
      $('#lancer').disabled = false;
      enTache(() => completerManquant(gen));
      return;
    }
    await chargerEspeces();               verifier(gen);
    appliquerQualite();
    construireArbre();          // arbre provisoire : genres seuls, disponibles sans requête
    dessiner({ tot:true });     // les vues prêtes sans taxonomie paraissent tout de suite

    // Un échec sur les noms ne doit pas emporter l'inventaire entier.
    try {
      await chargerAncetres();            verifier(gen);
      consoliderGenres();         // écarte les sections prises à tort pour des genres
      construireArbre();          // second passage, cette fois limité aux rangs retenus
    } catch (e) {
      if (e instanceof Annule) throw e;
      progression(t('mTaxoPartielle'), null);
    }
    dessinerUn('liste');
    progression(t('mPret', nb(etat.especes.length)), null);
    $('#lancer').disabled = false;
    enTache(() => completer(gen));   // file d'attente : la suite ne s'intercale pas
  } catch (e) {
    $('#lancer').disabled = false;
    if (e instanceof Annule) return;      // un chargement plus récent a pris la main
    const m = String((e && e.message) || e);
    progression(/Failed to fetch|NetworkError|Load failed/.test(m)
      ? t('mReseau') : t('mEchec', m), null);
  }
}

/* Tout ce dont la liste n'a pas besoin se charge après elle, dans l'ordre des onglets :
   saisonnalité, puis responsabilité, puis statistiques, puis l'autre niveau de validation.
   Chaque étape rafraîchit sa vue au passage, et l'utilisateur explore pendant ce temps. */
/* Un inventaire tiré de la mémoire peut être incomplet : il a pu être enregistré avant que
   la séquence de fond n'ait tout calculé, ou une étape a pu échouer. On reprend donc ce qui
   manque, et seulement cela — le reste s'affiche immédiatement. */
/* Le chargement différé : tout ce dont la liste n'a pas besoin se fait après elle, dans
   l'ordre de déclaration des modules. Chaque étape rafraîchit sa vue au passage, et
   l'utilisateur explore pendant ce temps.

   Un inventaire tiré de la mémoire peut être incomplet : il a pu être enregistré avant que
   la séquence n'ait tout calculé, ou une étape a pu échouer. « manquant » ne reprend alors
   que ce qui manque, et seulement cela — le reste s'affiche immédiatement. */
async function completer(gen, manquantSeulement = false) {
  let fait = false;
  try {
    for (const m of MODULES) {
      if (!m.fond) continue;
      if (manquantSeulement && m.manque && !m.manque()) continue;
      await m.fond(gen);   verifier(gen);
      fait = true;
    }
    if (fait) { progression(t('mComplet'), null); enregistrer(); }
  } catch (e) {
    if (e instanceof Annule) return;
    const m = String((e && e.message) || e);
    progression(/Failed to fetch|NetworkError|Load failed/.test(m)
      ? t('mReseau') : t('mEchec', m), null);
  }
}

const completerManquant = gen => completer(gen, true);

/* Un seul niveau de validation par inventaire. Charger les deux d'un coup rendait la bascule
   instantanée, mais doublait chaque requête pour un niveau qu'on ne consultera peut-être
   jamais. Ce sont deux inventaires distincts, avec leur propre entrée en mémoire. */
function niveaux() { return [etat.qualite]; }

/* Une page de species_counts, allégée si la v2 le permet. Le premier lot sert de contrôle :
   sans nom ni rang ni chaîne d'ancêtres exploitables, on renonce à la v2 pour cette requête. */
async function pageEspeces(f, page) {
  if (especesV2 !== false && await testerV2()) {
    try {
      const d = await appel('/observations/species_counts',
        { ...f, per_page:500, page, fields:CHAMPS_ESPECE }, true);
      const t0 = d.results[0] && d.results[0].taxon;
      if (especesV2 === null) {
        especesV2 = !!(t0 && t0.name && t0.rank && Array.isArray(t0.ancestor_ids));
        console.info(especesV2 ? 'Liste allégée par la v2' : 'Liste : champs incomplets en v2, retour à la v1');
      }
      if (especesV2) return d;
    } catch (e) { especesV2 = false; }
  }
  return appel('/observations/species_counts', { ...f, per_page:500, page });
}

async function chargerEspeces() {
  const gen = generation;
  const parId = new Map();
  etat.tronque = false;

  for (const q of niveaux()) {
    const f = filtres(true, q);
    let page = 1, total = null;
    while (page <= 20) {
      progression(t('mLecture', t(q === 'research' ? 'cValidees' : 'cToutesObs'), page), total ? (parId.size / Math.min(total, 10000)) * 100 : 5);
      const d = await pageEspeces(f, page);
      verifier(gen);
      if (total === null) {
        total = d.total_results;
        if (q === 'toutes') etat.tronque = total > 10000;
      }
      let lus = 0;
      for (const r of d.results) {
        const t = r.taxon, ph = t.default_photo;
        let e = parId.get(t.id);
        if (!e) {
          const cs = t.conservation_status || (t.conservation_statuses || [])[0] || null;
          e = {
            id:t.id, nom:t.name, nomFr:t.preferred_common_name || '', rang:t.rank,
            photo: ph ? (ph.medium_url || String(ph.url || '').replace('/square.', '/medium.')) : null,
            photoPetite: ph ? (ph.square_url || ph.url || ph.medium_url) : null,
            credit: ph ? (ph.attribution || '') : '',
            anc: t.ancestor_ids || [],
            iucn: cs ? (cs.iucn ?? CODE_IUCN[String(cs.status || '').toLowerCase()] ?? null) : null,
            nz:{ toutes:0, research:0 }, nm:{ toutes:0, research:0 },
            nZone:0, nMonde:null,
            etab: etablissement(t)
          };
          parId.set(t.id, e);
        }
        e.nz[q] = r.count;
        lus++;
      }
      if (lus < 500 || page * 500 >= Math.min(total, 10000)) break;
      page++;
    }
  }
  etat.especes = [...parId.values()];
  const rangs = {};
  etat.especes.forEach(e => { rangs[e.rang || '?'] = (rangs[e.rang || '?'] || 0) + 1; });
  console.info('Rangs renvoyés par l\'API :', rangs);
}


/* Bascule d'un niveau à l'autre : simple recopie, aucune requête. */
function appliquerQualite() {
  etat.especes.forEach(e => { e.nZone = e.nz[etat.qualite]; e.nMonde = e.nm[etat.qualite]; });
}

/* Le genre se lit dans le nom binomial : « Quercus robur » appartient à « Quercus ».
   Comme chaque espèce apporte un genre presque toujours unique, les deviner localement
   supprime à lui seul la grande majorité des identifiants à aller chercher. */
function genreLocal(e) {
  if (e.rang !== 'species' || !e.anc.length) return null;
  const dernier = e.anc[e.anc.length - 1];
  const id = dernier === e.id ? e.anc[e.anc.length - 2] : dernier;
  const nom = e.nom.split(' ')[0];
  return id && nom ? { id, nom } : null;
}

/* Le dernier ancêtre d'une espèce n'est pas toujours son genre : chez les plantes c'est
   souvent une section ou un sous-genre, qui porte d'ailleurs le même nom que le genre.
   Ces entrées déduites sont donc marquées provisoires, et cette passe les confronte à la
   chaîne complète : dans une même lignée, seul le plus haut des candidats est le vrai
   genre, les autres sont des sous-rangs et sortent de l'arbre. */
function consoliderGenres() {
  const faux = new Set();
  for (const e of etat.especes) {
    let trouve = false;
    for (const id of chaineBrute(e)) {
      const a = etat.ancetres.get(id);
      if (!a || a.rang !== 'genus') continue;
      if (!trouve) { trouve = true; continue; }
      if (a.provisoire) faux.add(id);
    }
  }
  faux.forEach(id => etat.ancetres.delete(id));
  return faux.size;
}

async function chargerAncetres() {
  const gen = generation;
  for (const e of etat.especes) {
    const g = genreLocal(e);
    if (g && !etat.ancetres.has(g.id))
      etat.ancetres.set(g.id, { nom:g.nom, nomFr:'', rang:'genus', provisoire:true });
  }

  const ids = idsANommer().filter(id => !etat.ancetres.has(id));

  // Le multi-get /taxa/{ids} n'accepte pas plus de 30 identifiants : au-delà il répond 422.
  let i = 0, taille = 30;
  while (i < ids.length) {
    progression(t('mTaxo', Math.round((i / ids.length) * 100)), (i / ids.length) * 100);
    const lot = ids.slice(i, i + taille);
    try {
      const d = await appel('/taxa/' + lot.join(','), { locale:langue });
      verifier(gen);
      d.results.forEach(t => etat.ancetres.set(t.id,
        { nom:t.name, nomFr:t.preferred_common_name || '', rang:t.rank }));
      // Réponse tronquée : on repasse sur le même segment en plus petits lots.
      if (d.results.length < lot.length && taille > 10) { taille = 10; continue; }
    } catch (e) {
      if (taille > 10) { taille = 10; continue; }
      // Ce lot reste sans nom : la branche s'affichera en attente plutôt que de tout interrompre.
    }
    i += lot.length;
  }
}

/* Rangs retenus pour la navigation. Les autres — sous-classe, super-famille, tribu,
   sous-genre… — sont ignorés : ils allongent l'arbre sans aider à s'y repérer. */
/* Papilionoidea, Apoidea, Bombycoidea : la super-famille est le rang usuel de découpage
   chez les papillons et les hyménoptères, elle a sa place dans l'échelle. */
/* Échelle fixe et universelle, sans les rangs facultatifs. Sous-ordres et super-familles
   n'existent que dans certaines lignées : là où ils sont présents ils ajoutent un niveau,
   là où ils manquent le suivant remonte, et l'arbre finit par mêler des ordres et des
   super-familles sur une même rangée. En s'en tenant aux rangs que tout taxon possède, chaque
   niveau de l'arbre désigne le même rang partout. Le détail d'une espèce, lui, les affiche :
   c'est une lecture verticale, où l'homogénéité entre branches n'a pas d'objet. */
const RANGS_ARBRE = new Set(['phylum','class','order','suborder','superfamily',
                             'family','genus','species','subspecies']);

/* Rangs facultatifs : présents chez certains groupes, absents chez d'autres. On les garde,
   mais un niveau ne les affiche que si toutes les branches sœurs en possèdent un — sans quoi
   l'arbre mêlerait des ordres et des super-familles sur une même rangée. */
const RANGS_OPTIONNELS = new Set(['suborder', 'superfamily']);

/* Le détail d'une espèce remonte un cran plus haut que l'arbre de navigation : le règne y a
   sa place, alors qu'il n'y créerait aucune division utile dans l'arbre. */
const RANGS_LIGNAGE = new Set(['kingdom', 'phylum', 'class', 'order', 'suborder',
  'superfamily', 'family', 'genus', 'species', 'subspecies']);


function chaineBrute(e) {
  // La chaîne se termine parfois par l'espèce elle-même : on ne coupe qu'à cet endroit.
  return e.anc[e.anc.length - 1] === e.id ? e.anc.slice(0, -1) : e.anc;
}

/* Le filtre vaut à tout moment, y compris avant le chargement des rangs. Au premier passage
   seuls les genres sont connus — déduits du nom binomial — donc l'arbre provisoire est une
   liste de genres. Il s'étoffe ensuite. Un rang jamais identifié reste écarté plutôt que
   d'apparaître sans qu'on sache ce qu'il est. */
let indexEspeces = null;      // reconstruit à chaque inventaire, pour un accès direct par id

function especeParId(id) {
  if (!indexEspeces || indexEspeces.taille !== etat.especes.length) {
    indexEspeces = new Map(etat.especes.map(e => [e.id, e]));
    indexEspeces.taille = etat.especes.length;
  }
  return indexEspeces.get(id) || null;
}

/* Statut lu sur la fiche d'établissement renvoyée avec l'espèce, et non sur le filtre
   « introduced » de la recherche d'observations. Ce filtre ne se rapporte pas au lieu
   interrogé : il retient tout taxon introduit où que ce soit dans le monde. Le chêne kermès
   en fait la démonstration — indigène en Europe, en Grèce, au Portugal et en Afrique du Nord,
   introduit dans les seules Abruzzes, il ressortait comme introduit en Provence.

   La fiche, elle, est celle du lieu interrogé ou de son ancêtre le plus proche, ce qui est
   exactement ce qu'on veut. Son absence signifie qu'aucun statut n'a été saisi : on ne conclut
   alors rien, plutôt que de présumer une introduction. */
/* Pastille d'espèce introduite, identique partout : même icône, même position en haut à
   gauche, décalée pour ne pas recouvrir un numéro ou une case à cocher. */
function pastilleIntro(id, decale, enLigne) {
  /* Le décalage n'est demandé que là où un numéro d'ordre occupe déjà le coin — la grille de
     l'onglet Liste. Le lier au contexte par le style était trompeur : les fiches des
     découvertes et des disparitions n'ont pas de numéro, et la pastille y flottait. */
  return estIntroduite(id)
    ? `<span class="intro${decale ? ' decale' : ''}${enLigne ? ' enligne' : ''}" title="${echap(t('introTitre')
        + (origineDe(id) ? ' — ' + origineDe(id) : ''))}">!</span>`
    : '';
}

function estIntroduite(id) {
  const e = especeParId(id);
  return !!(e && e.etab && e.etab.statut === 'introduced');
}

function origineDe(id) {
  const e = especeParId(id);
  return e && e.etab && e.etab.lieu ? e.etab.lieu : '';
}


function chaineAncetres(e) {
  return chaineBrute(e).filter(id => {
    const a = etat.ancetres.get(id);
    return a && RANGS_ARBRE.has(a.rang);
  });
}

/* Il faut connaître le rang de TOUS les ancêtres, pas seulement de ceux qu'un arbre
   provisoire aurait affichés : une famille à genre unique y est déjà absorbée, et si son
   rang restait inconnu elle serait écartée au filtrage, laissant son genre remonter à côté
   des familles voisines. En revanche le tronc au-dessus du dernier clade commun ne sert à
   rien, sauf le clade lui-même qui nomme la racine. */
/* Tous les ancêtres, tronc compris. L'arbre de navigation ne montre pas ce tronc — il part du
   dernier clade commun — mais le détail d'une espèce doit remonter jusqu'à l'embranchement.
   Le surcoût est négligeable : le tronc compte une poignée d'identifiants, partagés par
   toutes les espèces, soit une requête de plus. */
function idsANommer() {
  const tous = new Set();
  for (const e of etat.especes) for (const id of chaineBrute(e)) tous.add(id);
  return [...tous];
}

/* La racine descend jusqu'au dernier clade commun à toutes les espèces : Animalia et Insecta
   contiennent exactement le même contenu qu'Odonata, autant partir d'Odonata. Ensuite, tout
   nœud qui n'a qu'un seul descendant absorbe ce descendant en gardant son propre nom, de sorte
   que deux entrées voisines représentent toujours le même niveau de découpage. */
/* Espèces sur lesquelles l'arbre est bâti. Il doit refléter ce que la liste montre : filtrer
   les introduites ou un mois sans que la taxonomie suive laisserait des branches vides et un
   décompte trompeur. Le filtre textuel, lui, reste hors de l'arbre — il sert à chercher dans
   une branche, pas à la redéfinir. */
/* Reconstruit l'arbre et ramène la vue à la racine si la branche sélectionnée a disparu :
   rester sur une famille que le filtre vient d'écarter afficherait une liste vide. */
function reconstruireArbre() {
  construireArbre();
  if (vue.noeud && !noeudExiste(etat.arbre, vue.noeud)) { vue.noeud = null; vue.deplies.clear(); }
}

function noeudExiste(n, id) {
  if (n.id === id) return true;
  for (const c of n.enfants.values()) if (noeudExiste(c, id)) return true;
  return false;
}

/* La recherche porte sur le nom et sur la lignée : taper « Asteraceae » retient toutes les
   espèces du clade. Le même prédicat sert à la grille et à la taxonomie, qui doivent montrer
   le même ensemble — sinon l'arbre annonce des effectifs que la grille ne montre plus. */
function correspondRecherche(e) {
  const q = (vue.texte || '').toLowerCase();
  if (!q) return true;
  if (e.nom.toLowerCase().includes(q) || (e.nomFr || '').toLowerCase().includes(q)) return true;
  return e.anc.some(id => {
    const a = etat.ancetres.get(id);
    return a && ((a.nom || '').toLowerCase().includes(q)
              || (a.nomFr || '').toLowerCase().includes(q));
  });
}

/* L'arbre garde une seule branche ouverte : vue.deplies contient exactement le chemin
   de la racine au nœud courant. Ouvrir ailleurs referme donc tout le reste. */
function cheminNoeud(id) {
  const rec = (n, acc) => {
    if (n.id === id) return acc;
    for (const c of n.enfants.values()) {
      const r = rec(c, [...acc, c.id]);
      if (r) return r;
    }
    return null;
  };
  return (etat.arbre && rec(etat.arbre, [])) || [];
}

function brancheHTML(n, profondeur) {
  const enfants = ordonnerBranches([...n.enfants.values()]);
  const ouvert = vue.deplies.has(n.id);
  const info = infoNoeud(n);
  return `
    <div class="n-noeud">
      <div class="n-ligne${vue.noeud === n.id ? ' sel' : ''}">
        <button class="n-plier${enfants.length ? '' : ' creux'}" data-plier="${n.id}"
          aria-expanded="${ouvert}" aria-label="${echap(t('deplier'))}">${ouvert ? '▾' : '▸'}</button>
        <button class="n-nom${info.latin ? ' lat' : ''}" data-noeud="${n.id}"
          title="${echap(info.sci)}">${echap(info.nom)}<span
          class="n-rang">${echap(info.rang)}</span></button>
        <span class="n-nb">${nb(n.n)}</span>
      </div>
      ${enfants.length && ouvert ? `<div class="n-enfants">${
        enfants.map(c => brancheHTML(c, profondeur + 1)).join('')}</div>` : ''}
    </div>`;
}


/* Le panneau de taxonomie, entier : la racine puis ses branches. Les deux outils l'affichent
   au même endroit et avec les mêmes commandes ; seul diffère ce qu'ils mettent en face. */
function panneauArbre() {
  if (!etat.arbre) return '';
  const racines = ordonnerBranches([...etat.arbre.enfants.values()]);
  const info = infoNoeud(etat.arbre);
  return `<aside class="arbre">
    <div class="entete">${t('taxonomie')}</div>
    <div class="n-ligne${vue.noeud === null ? ' sel' : ''}">
      <button class="n-plier creux"></button>
      <button class="n-nom${info.latin ? ' lat' : ''}" data-noeud="">${etat.arbre.id
        ? echap(info.nom) + '<span class="n-rang">' + t('tout') + '</span>'
        : t('toutesEsp')}</button>
      <span class="n-nb">${nb(etat.arbre.n)}</span>
    </div>
    ${racines.map(r => brancheHTML(r, 0)).join('')}
  </aside>`;
}

/* Cliquer un nom sélectionne la branche et referme les autres ; cliquer la flèche ne fait
   qu'ouvrir ou replier. C'est la seule règle de navigation de l'arbre, et elle tient à ce
   que vue.deplies contient exactement le chemin de la racine au nœud courant. */
function brancherArbre(racine, redessiner) {
  const hote = $(racine);
  if (!hote) return;
  hote.querySelectorAll('.n-nom').forEach(b => {
    b.addEventListener('click', () => {
      const id = b.dataset.noeud ? +b.dataset.noeud : null;
      vue.noeud = id;
      vue.deplies = new Set(id === null ? [] : cheminNoeud(id));
      redessiner();
    });
  });
  hote.querySelectorAll('.n-plier').forEach(b => {
    b.addEventListener('click', () => {
      const id = b.dataset.plier ? +b.dataset.plier : null;
      if (id === null) return;
      const chemin = cheminNoeud(id);
      vue.deplies = new Set(vue.deplies.has(id) ? chemin.slice(0, -1) : chemin);
      redessiner();
    });
  });
}

/* l'outil Coche ne bâtit son arbre que sur les espèces retenues par son filtre :
   sans cela, les branches afficheraient des décomptes incluant ce qui est déjà coché, et
   descendre dans une famille entièrement vue mènerait à une planche vide. */
let filtreArbre = null;

/* Lignée du taxon, telle qu'elle est déjà connue : aucune requête supplémentaire. */
function lignageHTML(e) {
  const chaine = e.anc
    .map(id => ({ id, ...(etat.ancetres.get(id) || {}) }))
    .filter(a => a.nom && RANGS_LIGNAGE.has(a.rang));
  /* Chaque niveau reçoit un retrait et une teinte de plus en plus soutenue : la profondeur
     se lit alors d'un coup d'œil, sans avoir à déchiffrer les noms de rangs. */
  const total = chaine.length + 1;
  const ligne = (rang, nom, i, actif) => {
    const part = total > 1 ? i / (total - 1) : 1;
    const teinte = `hsl(${152 - part * 14}, ${18 + part * 30}%, ${72 - part * 32}%)`;
    return `<div class="lig${actif ? ' actif' : ''}"
      style="padding-left:${6 + i * 7}px; border-left-color:${teinte}">
      <span class="rg">${echap(NOM_RANG[rang] || rang || '')}</span>${echap(nom)}</div>`;
  };
  return chaine.map((a, i) => ligne(a.rang, nomCourt(a.nom, a.nomFr), i, false)).join('')
    + ligne(e.rang, nomCourt(e.nom, e.nomFr), total - 1, true);
}

/* Le bouton qui déplie la lignée sous une fiche. Le lignage est déjà dans le document :
   l'ouvrir ne coûte rien, et refermer n'efface rien. */
function brancherLignage(racine) {
  const hote = $(racine);
  if (!hote) return;
  hote.querySelectorAll('.plus[data-lignage]').forEach(b => {
    b.addEventListener('click', ev => {
      ev.preventDefault();
      b.closest('.fiche').classList.toggle('ouvert');
    });
  });
  /* Le panneau de lignée recouvre la fiche entière, bouton compris : sans ce second
     branchement, on ouvrait sans jamais pouvoir refermer. */
  hote.querySelectorAll('.fiche .taxo').forEach(p => {
    p.addEventListener('click', ev => {
      ev.preventDefault();
      p.closest('.fiche').classList.remove('ouvert');
    });
  });
}

function especesPourArbre() {
  let l = etat.especes.filter(e => e.nZone > 0);
  if (filtreArbre) l = l.filter(filtreArbre);
  if (vue.texte) l = l.filter(correspondRecherche);
  if (vue.intro !== 'tout')
    l = l.filter(e => estIntroduite(e.id) === (vue.intro === 'seul'));
  /* Le relevé de la période plutôt que la phénologie : celle-ci ne compte que les douze mois
     et ignore la fenêtre glissante, qui n'est pas un mois. */
  if (vue.mois) {
    const d = etat.moisCache.get(etat.qualite + ':' + vue.mois);
    if (d && d.parId) l = l.filter(e => d.parId.has(e.id));
    else if (etat.phenologie && vue.mois > 0)
      l = l.filter(e => { const m = etat.phenologie.get(e.id); return m && m[vue.mois - 1] > 0; });
  }
  return l;
}

function construireArbre() {
  const trie = { id:null, enfants:new Map(), n:0 };
  // L'arbre est bâti sur les espèces que la liste retient : filtrer l'une sans l'autre
  // laisserait des branches vides et des décomptes faux.
  for (const e of especesPourArbre()) {
    if (!e.nZone) continue;   // absente au niveau de validation courant
    let n = trie; n.n++;
    for (const id of chaineAncetres(e)) {
      if (!n.enfants.has(id)) n.enfants.set(id, { id, enfants:new Map(), n:0 });
      n = n.enfants.get(id); n.n++;
    }
  }

  const compresser = n => {
    let enfants = n.enfants;
    while (enfants.size === 1) enfants = [...enfants.values()][0].enfants;
    const sortie = new Map();
    enfants.forEach(c => { const k = compresser(c); sortie.set(k.id, k); });
    return { id:n.id, n:n.n, enfants:sortie };
  };

  let racine = trie;
  while (racine.enfants.size === 1) racine = [...racine.enfants.values()][0];
  etat.arbre = compresser(racine);
  homogeneiser(etat.arbre);
}

/* Rend chaque niveau homogène en rang. Si les enfants d'un nœud ne partagent pas tous le même
   rang, on remonte ceux dont le rang est facultatif : leurs propres enfants prennent leur
   place. Un sous-ordre subsiste donc chez les insectes, où tous les ordres en ont, et
   s'efface là où il ne concerne qu'une lignée sur trois. L'opération se répète, la promotion
   pouvant faire apparaître un nouveau mélange. */
function homogeneiser(n) {
  const rangDe = id => { const a = etat.ancetres.get(id); return a ? a.rang : ''; };

  for (let tour = 0; tour < 4; tour++) {
    const enfants = [...n.enfants.values()];
    if (enfants.length < 2) break;
    const rangs = new Set(enfants.map(c => rangDe(c.id)));
    if (rangs.size <= 1) break;

    const promus = new Map();
    let change = false;
    for (const c of enfants) {
      if (RANGS_OPTIONNELS.has(rangDe(c.id)) && c.enfants.size) {
        c.enfants.forEach(g => promus.set(g.id, g));
        change = true;
      } else promus.set(c.id, c);
    }
    if (!change) break;
    n.enfants = promus;
  }
  n.enfants.forEach(homogeneiser);
}

/* L'arbre suit le tri choisi pour la liste : en mode alphabétique, les branches se rangent
   par nom, sinon par effectif décroissant. Voir la taxonomie ordonnée autrement que la grille
   qu'elle commande serait déroutant. */
function ordonnerBranches(l) {
  if (vue.tri === 'nom')
    return l.sort((a, b) => infoNoeud(a).nom.localeCompare(infoNoeud(b).nom, langue));
  return l.sort((a, b) => b.n - a.n);
}

function infoNoeud(n) {
  const a = etat.ancetres.get(n.id);
  return {
    nom: a ? nomCourt(a.nom, a.nomFr) : '…',
    sci: a ? (a.nomFr ? a.nom + ' · ' + a.nomFr : a.nom) : '',
    rang: a ? (NOM_RANG[a.rang] || a.rang || '') : '',
    latin: a ? (vue.nommage === 'sci' || !a.nomFr) : false
  };
}

/* Les résultats reviennent triés par effectif décroissant : si la réponse est tronquée, ce
   sont les espèces les moins observées au monde qui manquent. Deux règles évitent le faux
   chiffre. On pagine jusqu'à ce que tous les taxons demandés soient revenus. Et un taxon
   absent reste inconnu plutôt que de recevoir son effectif local — ce repli fabriquait une
   part de 100 % parfaitement crédible et parfaitement fausse. */
async function chargerEffectifsMondiaux() {
  const gen = generation;
  const paquets = [];
  for (let i = 0; i < etat.especes.length; i += 200) paquets.push(etat.especes.slice(i, i + 200));

  for (const q of niveaux()) {
    const f = filtres(false, q);
    const parId = new Map();
    for (let i = 0; i < paquets.length; i++) {
      progression(t('mEffectifs', t(q === 'research' ? 'cValidees' : 'cToutesObs'), i + 1, paquets.length),
        (i / paquets.length) * 100);
      const ids = paquets[i].map(e => e.id);
      for (let page = 1; page <= 4; page++) {
        const d = await comptages({ ...f, taxon_id: ids.join(','), per_page:500, page });
        verifier(gen);
        d.results.forEach(r => parId.set(r.taxon.id, r.count));
        // Une page incomplète signifie qu'il n'y a rien de plus : les taxons sans observation
        // ne reviennent jamais, attendre qu'ils reviennent coûtait trois requêtes pour rien.
        if (d.results.length < 500 || ids.every(id => parId.has(id))) break;
      }
      const manquants = ids.filter(id => !parId.has(id));
      if (manquants.length) console.warn('Effectifs de référence : ' + manquants.length
        + ' taxons sans réponse, ils resteront sans part.', manquants.slice(0, 5));
    }
    etat.especes.forEach(e => { e.nm[q] = parId.has(e.id) ? parId.get(e.id) : null; });

    /* Un effectif de référence inférieur à l'effectif local est impossible : la zone est
       incluse dans le territoire de comparaison. Quand cela se produit, la valeur groupée
       est fausse — l'API renvoie parfois un comptage tronqué sur certains taxons. On les
       réinterroge un par un, ce qui ne concerne jamais qu'une poignée d'espèces. */
    const suspects = etat.especes.filter(e => e.nm[q] !== null && e.nm[q] < e.nz[q]);
    if (suspects.length) {
      console.warn('Effectifs de référence : ' + suspects.length
        + ' valeurs inférieures à l\'effectif local, réinterrogées individuellement.',
        suspects.map(e => e.nom + ' (id ' + e.id + ', ici ' + e.nz[q]
          + ', référence ' + e.nm[q] + ')'));
    }
    for (const e of suspects.slice(0, 40)) {
      try {
        const d = await comptages({ ...f, taxon_id:e.id, per_page:1 });
        verifier(gen);
        const r = d.results && d.results[0];
        if (r && r.count) e.nm[q] = r.count;
      } catch (err) { if (err instanceof Annule) throw err; }
      /* Si la reprise échoue, la donnée est déclarée douteuse. Plutôt que d'inventer une
         valeur, on la plafonne pour l'affichage et on marque l'espèce, qui sera reléguée en
         fin de tableau au lieu d'en occuper la tête avec un pourcentage absurde. */
      if (e.nm[q] < e.nz[q]) { e.nm[q] = e.nz[q]; e.douteux = true; }
    }
    // Le niveau est traité : les valeurs nulles qu'il laisse sont des absences réelles.
    etat.refFaite[q] = true;
  }
  appliquerQualite();
}

/* Un seul histogramme suffit désormais : il donne le total d'observations et la première
   année documentée. La courbe cumulée exigeait une requête par année ; elle a disparu avec
   le graphique qu'elle alimentait. */
/* Statut d'établissement. iNaturalist le renseigne lieu par lieu, et la recherche accepte
   un filtre : une requête paginée donne toutes les espèces considérées comme introduites
   dans la zone d'étude. Sans lieu sélectionné, la notion n'a pas de sens et on s'abstient. */
async function chargerAnnees(q = etat.qualite) {
  const gen = generation;
  const memo = etat.seriesCache[q];
  if (memo && memo.annees) { if (q === etat.qualite) etat.annees = memo.annees; return; }
  const f = filtres(true, q);
  const h = await appel('/observations/histogram', { ...f, date_field:'observed', interval:'year' });
  verifier(gen);
  const parAn = (h.results && h.results.year) || {};
  const lignes = Object.keys(parAn)
    .map(k => ({ annee:+k.slice(0, 4), obs:parAn[k] }))
    .filter(l => l.obs > 0)
    .sort((a, b) => a.annee - b.annee);
  /* Le nombre d'observateurs distincts tient dans le total_results de cet endpoint :
     une requête d'un seul résultat suffit, on ne lit que le compteur. */
  try {
    const o = await appel('/observations/observers', { ...f, per_page:1 });
    verifier(gen);
    etat.seriesCache[q].observateurs = o.total_results || 0;
  } catch (e) {
    if (e instanceof Annule) throw e;
  }

  etat.seriesCache[q].annees = lignes;
  if (q === etat.qualite) etat.annees = lignes;
}

/* Saisonnalité : un histogramme pour les observations, une requête par mois pour les espèces. */
/* En mode complet, on charge les listes mensuelles entières : elles alimentent la courbe
   de saisonnalité ET le panneau « à chercher », qui n'ont plus besoin de deux passages.
   Pour le niveau de validation qu'on ne regarde pas, la version légère suffit. */
async function chargerMensuel(q = etat.qualite, complet = (q === etat.qualite)) {
  const gen = generation;
  const memo = etat.seriesCache[q];
  const dejaFait = memo && memo.mensuel && (!complet || etat.phenoCache[q]);
  if (dejaFait) {
    if (q === etat.qualite) { etat.mensuel = memo.mensuel; etat.phenologie = etat.phenoCache[q]; }
    return;
  }

  const f = filtres(true, q);
  const h = await appel('/observations/histogram',
    { ...f, date_field:'observed', interval:'month_of_year' });
  const parMois = (h.results && h.results.month_of_year) || {};
  const lignes = [];
  const pheno = complet ? new Map() : null;

  for (let m = 1; m <= 12; m++) {
    progression(t('mSaison', MOIS[m - 1]), (m / 12) * 100);
    let especes = null;
    try {
      if (complet) {
        const r = await chargerMois(m, q);
        especes = r.total;
        if (!etat.moisTronque) etat.moisTronque = new Array(12).fill(false);
        etat.moisTronque[m - 1] = !!r.tronque;
        r.parId.forEach((n, id) => {
          if (!pheno.has(id)) pheno.set(id, new Array(12).fill(0));
          pheno.get(id)[m - 1] = n;
        });
      } else {
        const esp = await appel('/observations/species_counts', { ...f, month:m, per_page:1 });
        especes = esp.total_results;
      }
    } catch (e) {
      // Sur les grands territoires, un mois peut expirer côté serveur. On note le trou
      // et on poursuit : onze mois valides valent mieux qu'une série entièrement perdue.
      if (e instanceof Annule) throw e;
      console.warn('Saisonnalité : ' + MOIS[m - 1] + ' indisponible', e);
    }
    verifier(gen);
    lignes.push({ mois:m, obs: parMois[m] || parMois[String(m)] || 0, especes });
  }

  console.info('Saisonnalité (' + q + ') :',
    lignes.map(l => MOIS_C[l.mois - 1] + '=' + (l.especes === null ? '?' : l.especes)).join(' '));

  // Douze mois strictement identiques trahiraient un filtre inopérant.
  if (new Set(lignes.map(l => l.especes)).size === 1 && lignes[0].especes > 0) {
    console.warn('Saisonnalité : les douze mois sont identiques, le filtre mensuel semble inopérant.');
  }
  etat.seriesCache[q].mensuel = lignes;
  if (complet) etat.phenoCache[q] = pheno;
  if (q === etat.qualite) {
    etat.mensuel = lignes;
    if (complet) etat.phenologie = pheno;
  }
}


/* ---- La fenêtre glissante ---- */

/* Quatre semaines autour d'aujourd'hui. Un mois calendaire est un mauvais découpage pour la
   question « qu'est-ce qui se montre en ce moment » : le 30 septembre, ce qui intéresse est
   l'état d'octobre, pas le bilan de septembre.

   iNaturalist sait filtrer par semaine de l'année, toutes années confondues : cinq semaines
   centrées sur la semaine courante donnent la fenêtre, sans dépendre du millésime. Le relevé
   se range dans la même table que les mois, sous la clé « -1 », si bien que tout le code qui
   lisait déjà un mois fonctionne sans changement. */
const FENETRE = -1;
const FENETRE_SEMAINES = 2;

/* La date autour de laquelle se place la fenêtre. Par défaut aujourd'hui ; l'outil Identification
   peut la fixer à la date d'une observation à déterminer, prise un autre jour. */
let dateReference = null;             // 'AAAA-MM-JJ', ou null pour aujourd'hui
const dateFenetre = () => dateReference ? new Date(dateReference + 'T12:00:00') : new Date();

function semaineDe(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));   // jeudi de la semaine
  const an = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - an) / 86400000 + 1) / 7);
}

function semainesFenetre() {
  const s = semaineDe(dateFenetre());
  const l = [];
  // L'année boucle : la fenêtre de fin décembre déborde sur début janvier.
  for (let k = -FENETRE_SEMAINES; k <= FENETRE_SEMAINES; k++)
    l.push(((s - 1 + k) % 52 + 52) % 52 + 1);
  return l;
}

/* Le mois en abrégé : ces bornes s'affichent dans des menus déroulants, où « 2 septembre →
   30 septembre » poussait la liste à une largeur démesurée. */
function bornesFenetre() {
  const j = 86400000, n = dateFenetre();
  const d = x => new Date(n.getTime() + x * 7 * j)
    .toLocaleDateString(langue, { day:'numeric', month:'short' });
  return [d(-FENETRE_SEMAINES), d(FENETRE_SEMAINES)];
}

/* Un paramètre inconnu n'est pas rejeté par l'API : la requête réussit et renvoie des données
   non filtrées. On compare donc le total avec et sans le filtre de semaine avant de s'en
   servir — mieux vaut annoncer la fenêtre indisponible que présenter une année pour une
   période de quatre semaines. Le résultat du sondage vaut pour la séance. */
let fenetreUtilisable = null;

async function chargerFenetre(q = etat.qualite) {
  const cle = q + ':' + FENETRE;
  if (etat.moisCache.has(cle)) return etat.moisCache.get(cle);
  const f = filtres(true, q);
  const sem = semainesFenetre().join(',');

  if (fenetreUtilisable === null) {
    const [sans, avec] = await Promise.all([
      comptages({ ...f, per_page:1 }, true),
      comptages({ ...f, week:sem, per_page:1 }, true)
    ]);
    fenetreUtilisable = !(sans.total_results > 0 && avec.total_results >= sans.total_results);
  }
  if (!fenetreUtilisable) {
    const vide = { parId:new Map(), total:0, indispo:true };
    etat.moisCache.set(cle, vide);
    return vide;
  }

  const parId = new Map();
  let total = 0;
  for (let page = 1; page <= 3; page++) {
    progression(t('mFenetre'), (page / 3) * 100);
    const d = await comptages({ ...f, week:sem, per_page:500, page }, true);
    total = d.total_results || 0;
    (d.results || []).forEach(r => { if (r.taxon) parId.set(r.taxon.id, r.count); });
    if ((d.results || []).length < 500 || parId.size >= total) break;
  }
  const res = { parId, total };
  etat.moisCache.set(cle, res);
  return res;
}

/* Charge ce qu'il faut pour la période demandée : rien pour l'année, un mois, ou la fenêtre. */
function chargerPeriode(p, q = etat.qualite) {
  if (p === FENETRE) return chargerFenetre(q);
  if (p > 0) return chargerMois(p, q);
  return Promise.resolve(null);
}

function periodeEnMemoire(p, q = etat.qualite) {
  return p === 0 || etat.moisCache.has(q + ':' + p);
}

function nomPeriode(p) {
  if (p === FENETRE) { const [a, b] = bornesFenetre(); return t('pFenetreNom', a, b); }
  return p > 0 ? MOIS[p - 1] : t('touteAnnee').toLowerCase();
}

/* Le menu de période, identique dans les trois outils. */
function selectPeriode(id, p = vue.mois, actif = true) {
  const [a, b] = bornesFenetre();
  const o = (v, texte) =>
    `<option value="${v}"${p === v ? ' selected' : ''}>${texte}</option>`;
  return `<select id="${id}"${actif ? '' : ' disabled'}>
    ${o(FENETRE, t(dateReference ? 'pFenetreOptDate' : 'pFenetreOpt', a, b))}${o(0, t('touteAnnee'))}
    ${MOIS.map((m, i) => o(i + 1, capitaliser(m))).join('')}
  </select>`;
}

/* La liste d'un mois donne à la fois le détail par espèce et, dans total_results,
   le nombre exact d'espèces de ce mois. Les deux usages partagent donc une seule requête. */
async function chargerMois(m, q = etat.qualite, profond = false) {
  const cle = q + ':' + m + (profond ? ':p' : '');
  if (etat.moisCache.has(cle)) return etat.moisCache.get(cle);
  const f = filtres(true, q);
  const parId = new Map();
  let total = 0;
  /* Deux pages suffisent aux pics mensuels. La complétude, elle, exige la liste entière :
     les résultats arrivent par abondance décroissante, si bien qu'une troncature emporte
     exactement les espèces vues une ou deux fois, celles sur lesquelles Chao1 et ACE
     reposent. On ne descend donc à huit pages que sur demande, et seulement là où les deux
     premières n'ont pas suffi — sur une flore modeste, la complétude est gratuite. */
  const v1 = !(await testerMoisV2(f));
  const pages = profond ? 8 : 2;
  let tronque = false;
  for (let page = 1; page <= pages; page++) {
    const d = await comptages({ ...f, month:m, per_page:500, page }, v1);
    total = d.total_results;
    d.results.forEach(r => parId.set(r.taxon.id, r.count));
    if (d.results.length < 500 || parId.size >= total) break;
    if (page === pages) tronque = true;
  }
  const res = { parId, total, tronque };
  etat.moisCache.set(cle, res);
  return res;
}

