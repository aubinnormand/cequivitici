/* ============================================================
   Cequivitici · Coche
   ============================================================ */

/* Le même noyau que l'outil Exploration, la même mémoire, le même inventaire — seule change
   la question posée. L'outil ne fait qu'une soustraction, mais il la pose de quatre manières :
   ce qui manque, où aller le chercher, ce qui se montre en ce moment, et l'étendue du reste. */

/* Les espèces retenues pour être portées sur la carte. On garde l'ordre de sélection : il
   décide de la couleur, et une couleur qui changerait au gré d'un tri serait inutilisable. */
let choisies = [];

let cochePage = 0;
let cocheFiltre = 'manque';    // manque · vues · toutes
/* Ce que « déjà vue » veut dire. Par défaut, n'importe où dans le monde : une espèce que tu
   as vue à l'autre bout du pays n'est plus une découverte, même si elle manque à ta liste
   locale. Choisir « ici » resserre sur la zone, et fait réapparaître comme manquantes des
   espèces déjà connues de toi — c'est le regard d'une liste de territoire.

   Ce réglage remplace les deux entrées de filtre qui tentaient de dire la même chose :
   « manquantes » avec référence mondiale équivaut exactement à l'ancien « jamais vues ». */
let cocheVu = 'monde';         // monde · ici
let cocheTri = 'obs';
/* Un plancher fixe plutôt qu'un menu. Sans plancher, une espèce documentée trois fois dans
   le monde et vue trois fois ici afficherait cent pour cent de responsabilité et monterait en
   tête — ce qui mesure la pauvreté des données, non celle de l'espèce. Avec un menu, c'était
   un réglage de plus à comprendre pour un choix qu'on ne refait jamais. */
const SEUIL_MONDE = 10;
const COCHE_PAR_PAGE = 200;

/* Il faut un compte ET une zone : sans compte il n'y a rien à soustraire, sans zone rien
   dont soustraire. Le bouton reste éteint tant que les deux ne sont pas là. */
peutCharger = () => !!(etat.pseudo && (etat.lieux.length || etat.taxons.length || etat.zone));
messageAttente = () => etat.pseudo ? 'choisirLieu' : 'choisirCompte';

/* Le groupe de haut niveau d'une espèce : sa classe quand elle en a une, sinon le rang
   disponible le plus proche. Les oiseaux, les plantes et les champignons ne se comptent pas
   ensemble — un total unique n'apprendrait rien. */
/* Les introduites sont écartées par défaut dans cet outil. Une liste de coches porte sur ce
   qui vit là : un robinier planté ou une perruche échappée gonflent le total sans rien dire
   du lieu. Le menu reste offert dans chaque vue pour les rappeler, ou les isoler. */
vue.intro = 'sans';

function retenuIntro(id) {
  return vue.intro === 'tout' || estIntroduite(id) === (vue.intro === 'seul');
}

/* Changer ce réglage change les quatre onglets d'un coup : il porte sur ce qu'on compte,
   pas sur la manière de le montrer. */
function changerIntro(v) {
  vue.intro = v;
  cochePage = 0;
  couvDeplies = new Set(); couvSel = null;   // les branches ont changé de contenu
  construireArbre();
  if (vue.noeud && !noeudExiste(etat.arbre, vue.noeud)) { vue.noeud = null; vue.deplies.clear(); }
  dessiner();
  if (grille) dessinerCarteOu();
}

/* Le filtre courant appliqué à l'inventaire. « toutes » et « vues » sortent de la logique du
   manque : on les garde parce qu'une liste se regarde aussi à l'endroit — vérifier ce qu'on
   a déjà vu ici est le premier réflexe avant une sortie. */
/* L'arbre suit le filtre : il ne montre que les branches où il reste quelque chose. Le tri
   des introduites, lui, est déjà appliqué par le noyau à la construction de l'arbre. */
filtreArbre = e => !perso || garde(e.id);

/* Vue, au sens de la référence courante. */
function dejaVue(id) {
  if (!perso) return false;
  return cocheVu === 'ici' ? perso.ici.has(id) : perso.monde.has(id);
}

function garde(id) {
  if (cocheFiltre === 'toutes') return true;
  return cocheFiltre === 'vues' ? dejaVue(id) : !dejaVue(id);
}

function selection() {
  let l = etat.especes.filter(e => e.nZone > 0 && garde(e.id));
  l = l.filter(e => retenuIntro(e.id));
  /* Le mois ne s'applique qu'aux observations de la zone : l'effectif affiché devient celui
     du mois, et une espèce que personne n'y a vue à cette saison disparaît. La liste
     personnelle, elle, reste entière. */
  if (vue.mois) {
    const m = (etat.moisCache.get(etat.qualite + ':' + vue.mois) || {}).parId;
    if (m) l = l.filter(e => m.has(e.id)).map(e => ({ ...e, nAffiche:m.get(e.id) }));
  }
  // La branche choisie dans l'arbre restreint la planche, comme dans l'autre outil.
  if (vue.noeud) l = l.filter(e => e.anc.includes(vue.noeud));
  return l;
}

function filtrerEtTrier(liste) {
  let l = liste;
  if (vue.texte) l = l.filter(correspondRecherche);
  if (cocheTri === 'nom')
    return [...l].sort((a, b) =>
      nomCourt(a.nom, a.nomFr).localeCompare(nomCourt(b.nom, b.nomFr), langue));
  if (cocheTri === 'resp') {
    /* La part que la zone représente dans les observations mondiales de l'espèce. Une espèce
       qui te manque et dont cette zone concentre le quart des données du monde n'est pas du
       même ordre qu'une espèce banale partout : c'est là qu'il faut la voir. Sous le seuil
       d'effectif, on passe en fin de liste plutôt que d'en sortir. */
    /* Quand un mois est choisi, la part se calcule sur les observations de ce mois : la
       responsabilité d'une zone pour une espèce migratrice n'est pas la même en janvier
       qu'en mai, et c'est précisément ce qu'on veut voir. */
    const p = e => e.nMonde >= SEUIL_MONDE ? (e.nAffiche ?? e.nZone) / e.nMonde : -1;
    return [...l].sort((a, b) => p(b) - p(a));
  }
  /* L'effectif du mois quand un mois est choisi, celui de l'année sinon : trier sur le
     total annuel alors que la vue montre un mois donnait un classement sans rapport avec
     les chiffres affichés. */
  return [...l].sort((a, b) => (b.nAffiche ?? b.nZone) - (a.nAffiche ?? a.nZone));
}

/* La pastille d'état, seul ajout aux fiches du premier outil. Trois teintes : le prune pour
   la vraie coche — jamais vue nulle part —, l'ocre pour ce qui manque seulement ici, et le
   vert pour ce qui est déjà acquis. */
function marqueStatut(id) {
  const s = statut(id);
  if (s === 'inconnu') return '';
  return `<span class="marque ${s}">${t(
    s === 'jamais' ? 'sJamais' : s === 'ailleurs' ? 'sAilleurs' : 'sVue')}</span>`;
}

/* Une fiche, reprise de l'autre outil : même grille, mêmes proportions, même comportement au
   survol. Ce qui change tient à la pastille, et à l'absence de panier de comparaison. */
/* Le bouton de sélection, repris du panier de comparaison de l'autre outil : même case,
   même pastille verte une fois prise. Ici elle commande l'affichage sur la carte. */
function boutonCarte(id) {
  const pris = choisies.includes(id);
  return `<button class="choisir${pris ? ' pris' : ''}" data-carte="${id}"
    title="${echap(t('gAjouter'))}">${pris ? '✓' : '□'}</button>`;
}

/* Sous le total de la zone, ce que cette personne a elle-même observé. La ligne ne paraît
   que lorsqu'il y a quelque chose à dire : pour une espèce jamais vue, un « 0 » n'apprendrait
   rien et prendrait la place. Le lien renvoie à ses propres observations sur iNaturalist,
   restreintes à la zone quand le compteur l'est aussi. */
function ligneMesObs(id) {
  const m = mesObs(id);
  if (!m.monde) return '';
  const dansLaZone = m.ici > 0;
  const n = dansLaZone ? m.ici : m.monde;
  return `<a class="mes-obs" href="${lienMesObs(id, dansLaZone)}" target="_blank" rel="noopener"
    >${t(dansLaZone ? 'mesObsIci' : 'mesObsAilleurs', nb(n))}</a>`;
}

function ficheCoche(e) {
  const img = vignette(e);
  const s = statut(e.id);
  /* La pastille est posée dans l'image, au-dessus d'elle : hors du lien elle se retrouvait
     sous la photo, donc illisible. Et la bordure reprend la même couleur — dans une planche
     de deux cents vignettes, c'est elle qu'on lit, pas le texte. */
  /* Deux classes distinctes, parce que deux informations distinctes : l'état exact de
     l'espèce, qui donne la couleur de la bordure, et le fait qu'elle compte comme vue au
     sens de la référence courante, qui décide de l'estompage. Sous la référence mondiale,
     une espèce « pas ici » est déjà vue : elle doit s'effacer comme les autres. */
  return `<div class="fiche f-${s}${dejaVue(e.id) ? ' f-vue' : ''}">
    <a class="img" href="${lienTaxon(e.id, true)}" target="_blank" rel="noopener">
      ${img ? `<img src="${echap(img)}" loading="lazy" decoding="async" alt="">` : ''}
      <span class="coin">${marqueStatut(e.id)}${pastilleIntro(e.id, false, true)}</span>
      ${e.iucn ? `<span class="statut">${pastilleIUCN(e.iucn)}</span>` : ''}
    </a>
    ${boutonCarte(e.id)}
    <div class="corps">
      ${blocNoms(e.nom, e.nomFr)}
      <div class="bas">
        <a class="n" href="${lienINat(e.id, vue.mois, 'map')}" target="_blank" rel="noopener"
          >${cocheTri === 'resp' && e.nMonde
            ? pourcent(e.nZone / e.nMonde * 100) + ' ' + t('duMonde')
            : nb(e.nAffiche ?? e.nZone) + ' ' + t('obs')
                + (e.nExtra ? ' · ' + echap(e.nExtra)
                  : e.nLabel ? ' · ' + t(e.nLabel)
                  : e.nAffiche !== undefined ? ' · ' + t('ceMois') : '')}</a>
        <button class="plus" data-lignage="${e.id}"
          aria-label="${echap(t('taxonomie'))}">☰</button>
      </div>
      ${ligneMesObs(e.id)}
    </div>
    <div class="taxo">${lignageHTML(e)}</div>
  </div>`;
}

/* Les cinq lectures qui ont un sens, plutôt que le produit de deux menus. « Ce que je
   cherche » et « par rapport à quelle liste » n'étaient pas deux questions : une espèce vue
   à l'autre bout du pays est soit une découverte, soit pas, et c'est le même choix. */
const QUOI = [
  ['manque', 'monde',  'qJamais'],
  ['manque', 'ici',    'qPasIci'],
  ['vues',   'monde',  'qVues'],
  ['vues',   'ici',    'qVuesIci'],
  ['toutes', 'monde',  'qTout']
];

/* Le menu des cinq lectures, écrit une fois pour les trois vues qui en ont besoin. */
function selectQuoi(id = 'k-quoi') {
  return `<select id="${id}">${QUOI.map(([f, v, cle]) =>
    `<option value="${f}:${v}"${cocheFiltre === f && (f === 'toutes' || cocheVu === v)
      ? ' selected' : ''}>${t(cle)}</option>`).join('')}
  </select>`;
}

function brancherQuoi(sel) {
  const e = $(sel);
  if (!e) return;
  e.addEventListener('change', ev => {
    const [f, v] = ev.target.value.split(':');
    cocheFiltre = f;
    changerReference(v);          // rebâtit l'arbre et redessine toutes les vues
  });
}

function barreOutils(n) {
  return `<div class="outils">
    ${selectQuoi()}
    ${selectMois()}
    ${selectIntro('k-intro')}
    <select id="k-tri">
      <option value="obs"${cocheTri === 'obs' ? ' selected' : ''}>${t('triObs')}</option>
      <option value="resp"${cocheTri === 'resp' ? ' selected' : ''}${
        etat.refFaite[etat.qualite] ? '' : ' disabled'}>${t('triResp')}</option>
      <option value="nom"${cocheTri === 'nom' ? ' selected' : ''}>${t('triNom')}</option>
    </select>
    <div class="saisie" style="width:200px">
      <input type="text" id="k-rech" value="${echap(vue.texte)}" placeholder="${echap(t('phRech'))}">
    </div>
    <span class="compte">${nb(n)} ${t('especes')}</span>
  </div>`;
}

function selectIntro(id) {
  const o = (v, cle) =>
    `<option value="${v}"${vue.intro === v ? ' selected' : ''}>${t(cle)}</option>`;
  return `<select id="${id}">${o('sans', 'filtreIntroSans')}${o('tout', 'filtreIntroTout')}${
    o('seul', 'filtreIntroSeul')}</select>`;
}

function brancherIntro(sel) {
  const e = $(sel);
  if (e) e.addEventListener('change', ev => changerIntro(ev.target.value));
}

/* Le filtre de période. Il porte sur les observations de la zone — ce qui s'y montre à cette
   saison — et jamais sur la liste personnelle : avoir vu une espèce en juillet ne la rend pas
   manquante en mars. Le manque est un état, pas un événement daté. */
function selectMois(id = 'k-mois') {
  return selectPeriode(id, vue.mois, !!etat.phenologie);
}

/* Le même menu partout où la question se pose : planche, carte, couverture. Écrit une fois,
   pour que les trois vues ne puissent pas diverger. */
function selectReference(id = 'k-vu') {
  return `<select id="${id}">
    <option value="monde"${cocheVu === 'monde' ? ' selected' : ''}>${t('vuMonde')}</option>
    <option value="ici"${cocheVu === 'ici' ? ' selected' : ''}>${t('vuIci')}</option>
  </select>`;
}

function changerReference(v) {
  cocheVu = v;
  cochePage = 0;
  construireArbre();
  if (vue.noeud && !noeudExiste(etat.arbre, vue.noeud)) { vue.noeud = null; vue.deplies.clear(); }
  dessinerManquants();
  dessinerCouverture();
  dessinerQuand();
  /* Le relevé de la carte dépend du réglage : on repasse par la réserve, qui en a peut-être
     un pour celui-ci. */
  grilleReleveePour = null;
  if ($('#v-carte')) assurerGrille();
}

function brancherOutils(redessiner) {
  const b = (sel, ev, fn) => { const e = $(sel); if (e) e.addEventListener(ev, fn); };
  brancherQuoi('#k-quoi');
  b('#k-filtre', 'change', e => { cocheFiltre = e.target.value; cochePage = 0; redessiner(); });
  b('#k-tri', 'change', e => { cocheTri = e.target.value; cochePage = 0; redessiner(); });
  brancherIntro('#k-intro');
  brancherMois('#k-mois', redessiner);
  b('#k-rech', 'input', e => {
    const pos = e.target.selectionStart;
    vue.texte = e.target.value; cochePage = 0;
    redessiner();
    const n = $('#k-rech'); if (n) { n.focus(); n.setSelectionRange(pos, pos); }
  });
  document.querySelectorAll('[data-page]').forEach(x =>
    x.addEventListener('click', () => { cochePage = +x.dataset.page; redessiner(); }));
  brancherChoix('#v-manquants');
}

/* Le mois est partagé par toutes les vues : le changer ici le change partout, et les
   effectifs du mois sont chargés à la demande, une fois pour toutes. */
function brancherMois(sel, redessiner) {
  const e = $(sel);
  if (!e) return;
  e.addEventListener('change', async ev => {
    const p = +ev.target.value;
    if (!periodeEnMemoire(p)) {
      progression(t(p === FENETRE ? 'mFenetre' : 'mFiltreMois', nomPeriode(p)), 40);
      await chargerPeriode(p);
      progression(t('mFiltreApp', nomPeriode(p)), null);
    }
    vue.mois = p;
    const d = etat.moisCache.get(etat.qualite + ':' + p);
    if (d && d.indispo) { vue.mois = 0; progression(t('pFenetreIndispo'), null); }
    cochePage = 0;
    redessiner();
  });
}

/* La sélection d'espèces est un état global : elle apparaît dans la planche, dans
   « Maintenant » et sur la carte, et se modifie depuis chacune des trois. Redessiner
   seulement la vue d'où vient le clic laissait les deux autres en arrière — leurs jetons
   restaient affichés, leurs cases restaient cochées. Toute modification les rafraîchit donc
   toutes les trois. */
function majChoix() {
  dessinerManquants();
  dessinerQuand();
  dessinerCarteOu();
  dessinerTerrain();
}

/* Les sélecteurs sont cantonnés à la vue qu'on vient de redessiner. Sans cela, redessiner
   une seule vue aurait ajouté un second écouteur aux boutons des deux autres, restés dans le
   document : le clic aurait alors basculé deux fois, donc rien du tout. */
function brancherChoix(racine) {
  const hote = $(racine);
  if (!hote) return;
  hote.querySelectorAll('[data-carte]').forEach(b =>
    b.addEventListener('click', ev => {
      ev.preventDefault();
      const id = +b.dataset.carte;
      const i = choisies.indexOf(id);
      if (i >= 0) choisies.splice(i, 1);
      else if (choisies.length < MAX_COULEURS) choisies.push(id);
      else { progression(t('gTropChoisies', MAX_COULEURS), null); return; }
      majChoix();
    }));
  hote.querySelectorAll('[data-oter]').forEach(b =>
    b.addEventListener('click', () => {
      choisies = choisies.filter(x => x !== +b.dataset.oter);
      majChoix();
    }));
  hote.querySelectorAll('.vider-choix').forEach(v =>
    v.addEventListener('click', () => { choisies = []; majChoix(); }));
}

/* La barre des espèces retenues, affichée dès qu'il y en a une. Elle sert de légende à la
   carte : la couleur y est celle des points. */
function barreChoisies(versCarte) {
  if (!choisies.length) return '';
  return `<div class="choix-carte">
    <span class="tit">${t('gChoisies')}</span>
    ${choisies.map((id, i) => {
      const e = especeParId(id);
      return `<span class="jeton-esp"><i style="background:${PALETTE_ESP[i]}"></i>${
        echap(e ? nomCourt(e.nom, e.nomFr) : '#' + id)
      }<button data-oter="${id}" aria-label="${echap(t('oter'))}">×</button></span>`;
    }).join('')}
    <button class="discret vider-choix">${t('gViderChoix')}</button>
    <span class="compte">${versCarte ? t('gVoirCarte') : t('gSurCarte')}</span>
  </div>`;
}

function pagination(total, par = COCHE_PAR_PAGE) {
  const pages = Math.ceil(total / par);
  if (pages <= 1) return '';
  const b = [];
  for (let i = 0; i < pages && i < 25; i++)
    b.push(`<button class="discret${i === cochePage ? ' actif' : ''}" data-page="${i}">${i + 1}</button>`);
  return `<div class="outils pages">${b.join('')}</div>`;
}

/* Les trois états, expliqués une fois pour toutes sous la barre d'outils. La différence
   entre « jamais vue » et « vue ailleurs » est la seule chose à comprendre dans cet outil,
   et elle ne se devine pas d'un libellé de menu : elle tient à deux listes distinctes, la
   mondiale et la locale. */
function legendeStatuts() {
  const l = [
    ['jamais', 'sJamais', 'dJamais'],
    ['ailleurs', 'sAilleurs', 'dAilleurs'],
    ['cochee', 'sVue', 'dVue']
  ];
  return `<div class="legende-statuts">${l.map(([c, court, desc]) =>
    `<span><span class="marque ${c}">${t(court)}</span> ${t(desc)}</span>`).join('')}</div>`;
}

/* Le bandeau de chiffres, en tête de la planche. Il décrit l'inventaire sous les filtres
   durables — introduites, mois —, jamais sous le filtre de la liste elle-même : sinon passer
   de « ce qui me manque » à « déjà vues » aurait changé les totaux, et l'on n'aurait plus su
   de quoi ils parlent. */
function bandeauChiffres() {
  let base = etat.especes.filter(e => e.nZone > 0 && retenuIntro(e.id));
  if (vue.mois) {
    const m = (etat.moisCache.get(etat.qualite + ':' + vue.mois) || {}).parId;
    if (m) base = base.filter(e => m.has(e.id));
  }
  const total = base.length;
  const vues = base.filter(e => dejaVue(e.id)).length;
  const part = total ? vues / total * 100 : 0;

  const bloc = (cle, valeur, extra = '') =>
    `<div class="chiffre"><div class="k">${cle}</div><div class="v">${valeur}</div>${
      extra ? `<div class="d">${extra}</div>` : ''}</div>`;

  return `<div class="chiffres">
    ${bloc(t('bCoche'), pourcent(part), t(cocheVu === 'ici' ? 'bCocheIci' : 'bCocheMonde'))}
    ${bloc(t(cocheVu === 'ici' ? 'vuIci' : 'vuMonde'), nb(vues) + ' / ' + nb(total),
      vue.mois ? capitaliser(nomPeriode(vue.mois)) : '')}
    ${bloc(t('bReste'), nb(total - vues))}
  </div>`;
}

/* Le carton affiché tant que la liste personnelle n'est pas là : l'inventaire seul ne permet
   aucune soustraction, et montrer toutes les espèces serait trompeur. */
function attenteListe() {
  return `<div class="vide"><strong>${t('sansListe')}</strong>${t('sansListeD')}</div>`;
}


/* ---- Manquants : la planche ----------------------------------------------- */

function dessinerManquants() {
  const v = $('#v-manquants');
  if (!v) return;
  if (!etat.especes.length) return;
  if (!perso) { v.innerHTML = attenteListe(); return; }

  const defil = v.querySelector('.arbre') ? v.querySelector('.arbre').scrollTop : 0;
  const liste = filtrerEtTrier(selection());
  const debut = cochePage * COCHE_PAR_PAGE;
  const page = liste.slice(debut, debut + COCHE_PAR_PAGE);

  const planche = liste.length
    ? page.length
      ? `<div class="planche">${page.map(ficheCoche).join('')}</div>` + pagination(liste.length)
      : `<div class="vide"><strong>${t('rienIci')}</strong>${t('changeBranche')}</div>`
    : `<div class="vide"><strong>${t(cocheFiltre === 'vues' ? 'aucuneVue' : 'toutCoche')}</strong>${
        t(cocheFiltre === 'vues' ? 'aucuneVueD' : 'toutCocheD')}</div>`;

  v.innerHTML = bandeauChiffres() + barreOutils(liste.length) + `
    ${legendeStatuts()}
    ${barreChoisies(true)}
    <div class="expl">${panneauArbre()}<div>${planche}</div></div>`;

  brancherOutils(redessinerManquants);
  brancherArbre('#v-manquants', dessinerManquants);
  brancherLignage('#v-manquants');
  const panneau = v.querySelector('.arbre');
  if (panneau) panneau.scrollTop = defil;
}

/* Changer de filtre ou de recherche déplace les branches elles-mêmes : l'arbre se rebâtit
   avant le redessin, sinon il montrerait des branches désormais vides. */
function redessinerManquants() {
  construireArbre();
  if (vue.noeud && !noeudExiste(etat.arbre, vue.noeud)) { vue.noeud = null; vue.deplies.clear(); }
  dessinerManquants();
}


/* ---- Carte : où aller ----------------------------------------------------- */

/* La question que l'outil doit trancher : à quel endroit de la zone verrais-je le plus
   d'espèces que je n'ai pas ? L'API ne sait pas y répondre — elle compte des observations,
   pas des manques. On collecte donc les observations localisées du mois choisi, on écarte
   celles dont l'espèce figure déjà à ta liste, et on compte par carreau les espèces
   distinctes qui restent. Un carreau intense est un endroit où, ce mois-ci, beaucoup de
   choses nouvelles pour toi ont été vues par quelqu'un d'autre.

   Le biais est celui de toutes ces données : un carreau intense peut signaler un milieu
   riche, ou seulement un sentier fréquenté. La note sous la carte le dit. */

let carteOu = null, coucheOu = null;
let vueOu = null;              // cadrage courant, conservé d'un redessin à l'autre
let fondOu = 'plan';           // plan, relief ou satellite — comme dans l'autre outil
let coucheLimites = null;
let pointsEspece = new Map();  // identifiant d'espèce → points, chargés à la demande

let grille = null, grillePts = null, grilleEnCours = false;
let grilleReleveePour = null;
/* La clé d'une collecte interrompue ou échouée. Sans ce repère, l'ouverture automatique
   relancerait indéfiniment une collecte qu'on vient d'arrêter, ou qui échoue faute de
   réseau — le seul cas où il faut redemander à la personne. */
let grilleEchec = null;
let grilleMois = 0;              // 0 = toute l'année, 1 à 12 = un mois
let grilleMesure = 'compte';     // « compte » : espèces distinctes ; « resp » : score pondéré
let carteVue = 'jamais';         // « jamais » : jamais vues · « toutes » : tout l'inventaire
let grilleEcartees = 0, grilleEchantillon = false;   // mémorisés hors du découpage mensuel
let grilleDediee = false;        // vrai si la réserve servie vise précisément ce mois
let grilleDate = 0;              // date de la réserve servie ; 0 si la collecte vient d'être faite
let grillePtsMois = 0;           // portée des points en mémoire : 0 = tous les mois
let grilleTotal = 0;             // observations disponibles selon l'API, pour la portée collectée
let paliersReleves = '';         // inventaire pour lequel on a déjà inspecté la base
let grilleCellule = null;        // carreau sélectionné, pour le détail du dessous

/* Le plafond d'observations rapatriées. Quatre paliers, comme les biorégions du premier
   outil : la question « jusqu'où creuser » n'a pas de bonne réponse unique, elle dépend de
   ce qu'on cherche et du temps qu'on accepte d'y passer. */
let grilleMax = 4000;
const GRILLE_PALIERS = [[1000, 'bioRapide'], [4000, 'bioMoyen'],
                        [15000, 'bioFin'], [50000, 'bioTout']];
const GRILLE_PAR_APPEL = 200;
const grilleEnMemoire = new Map();   // clé → { max, mois, date } des relevés en réserve
const GRILLE_MIN = 0.012;        // côté minimal, un peu plus d'un kilomètre
const EXCLUES_MAX = 300;         // identifiants écartés ; au-delà l'adresse devient énorme

/* La carte rapatrie des observations localisées et les agrège ici : c'est ce qui donne une
   résolution fine sans payer une requête par carreau. Le budget est plafonné, donc tout
   dépend de ce qu'on met dedans.

   D'où l'idée qui change tout : ce qu'on cherche est une présence, pas une abondance. Une
   espèce déjà cochée n'a rien à faire dans le téléchargement — elle ne peut rien ajouter à
   une carte des manques. On demande donc à l'API de les écarter d'emblée, par
   « without_taxon_id ». Comme ce sont aussi les plus communes, donc les plus volumineuses,
   le plafond est dépensé presque entièrement sur ce qui compte : à budget égal, la carte
   descend bien plus profond dans les espèces rares.

   La liste d'exclusion est bornée à trois cents identifiants, triés par abondance locale :
   au-delà, l'adresse de la requête deviendrait démesurée, et les espèces suivantes ne pèsent
   plus grand-chose dans le volume. */
/* Seules les introduites sont écartées de la requête : elles ne s'affichent dans aucune des
   deux lectures. Écarter aussi les espèces déjà cochées faisait descendre le relevé plus
   loin dans les raretés, mais liait la collecte à la liste personnelle — et changer de
   lecture obligeait alors à tout recollecter. */
function especesAEcarter() {
  return etat.especes
    .filter(e => estIntroduite(e.id))
    .sort((a, b) => b.nZone - a.nZone)
    .slice(0, EXCLUES_MAX)
    .map(e => e.id);
}

/* Deux réserves possibles pour un même mois : la collecte générale, tous mois confondus, où
   chaque observation garde le sien et que l'on redécoupe à volonté ; et une collecte dédiée
   à ce mois, qui dépense tout le plafond dessus et descend donc bien plus loin.

   La première sert par défaut, sans rien coûter. La seconde se demande explicitement, par le
   bouton, quand le mois compte assez pour qu'on y consacre une minute. */
/* « -1 » désigne la fenêtre glissante de quatre semaines autour d'aujourd'hui, à côté de
   « 0 » pour toute l'année et de 1 à 12 pour un mois — la constante vient du noyau. La
   version de la clé passe à « ou3 » : les réserves antérieures n'ont pas la semaine de
   chaque observation. */

function cleGrille(mois = grilleMois) {
  return cleInventaire() + '|ou4|' + grilleMax
    + (mois === FENETRE ? '|f' + semainesFenetre().join('.') : mois ? '|m' + mois : '');
}

/* Le volume réellement disponible : la somme des observations des espèces qui te manquent,
   puisque les autres sont écartées de la requête. Elle borne les paliers proposés — inutile
   d'offrir « fin » quand « moyen » ramène déjà tout. */
function volumeDisponible() {
  return etat.especes.reduce((a, e) => a + (estIntroduite(e.id) ? 0 : e.nZone), 0);
}

function selectPalier() {
  const dispo = volumeDisponible();
  const couvrant = (GRILLE_PALIERS.find(([v]) => v >= dispo)
    || GRILLE_PALIERS[GRILLE_PALIERS.length - 1])[0];
  const offerts = GRILLE_PALIERS.filter(([v]) => v <= couvrant);
  if (!offerts.some(([v]) => v === grilleMax)) grilleMax = offerts[offerts.length - 1][0];

  return `<select id="g-palier">${offerts.map(([v, k]) => {
    /* Estimation reprise des biorégions, ajustée sur deux mesures réelles : dix secondes de
       préparation et deux secondes par page. Le délai de réponse compte pour autant que la
       cadence volontairement bridée. */
    const s = Math.round(10 + (v / GRILLE_PAR_APPEL) * 2.0);
    const duree = s < 90 ? t('bioSec', s) : t('bioMin', Math.round(s / 60));
    const garde = grilleEnMemoire.has(cleInventaire() + '|ou2|' + v);
    return `<option value="${v}"${v === grilleMax ? ' selected' : ''}
      title="${echap(t('bioDetail', nb(Math.min(v, dispo)), duree))}"
      >${garde ? '● ' : ''}${t(k)} · ${garde ? t('bioCache') : duree}</option>`;
  }).join('')}</select>`;
}

/* Une collecte déjà faite doit reparaître d'elle-même : l'onglet regarde la réserve avant
   toute chose. */
/* Ce qui est en réserve sur le disque, et pas seulement ce qu'on a collecté depuis
   l'ouverture de la page. Sans cette lecture, un relevé fait la veille était annoncé comme
   absent, et l'on repartait pour une minute de requêtes sans raison. */
async function releverPaliers() {
  /* Le préfixe doit suivre la version des clés : resté en « ou2 » après le passage à « ou3 »,
     il ne reconnaissait plus aucun relevé et la rangée paraissait toujours vide. */
  const prefixe = cleInventaire() + '|ou4|';
  if (paliersReleves === prefixe) return;
  try {
    const tout = await surBase('readonly', st => st.getAll());
    for (const d of (tout || [])) {
      if (typeof d.cle !== 'string' || !d.cle.startsWith(prefixe)) continue;
      if (!d.pts || Date.now() - d.date >= PEREMPTION) continue;
      grilleEnMemoire.set(d.cle, { max:d.max || 0, mois:d.mois || 0,
        date:d.date, obs:(d.pts || []).length });
    }
    // Marqué comme fait seulement si la lecture a abouti : sinon on réessaiera.
    paliersReleves = prefixe;
  } catch (e) { /* base indisponible : on s'en tiendra à cette séance */ }
}

async function releverGrille() {
  const cle = cleGrille();
  if (grilleReleveePour === cle) return;
  grilleReleveePour = cle;
  grille = null; grillePts = null; grilleCellule = null; vueOu = null;
  grilleDediee = false; grilleDate = 0;
  await releverPaliers();
  try {
    /* La collecte dédiée au mois d'abord, la générale ensuite : la première est plus
       profonde, la seconde toujours disponible. */
    let d = grilleMois ? await surBase('readonly', st => st.get(cle)) : null;
    if (d && d.pts && Date.now() - d.date < PEREMPTION) grilleDediee = true;
    else d = await surBase('readonly', st => st.get(cleGrille(0)));
    if (d && d.pts && Date.now() - d.date < PEREMPTION) {
      grillePts = d.pts;
      grillePtsMois = grilleDediee ? grilleMois : 0;   // 0, un mois, ou la fenêtre
      grilleEcartees = d.ecartees || 0;
      grilleEchantillon = !!d.echantillon;
      grilleTotal = d.total || 0;
      grille = construireGrille(d.pts);
      if (grille) { grille.ecartees = grilleEcartees; grille.echantillon = grilleEchantillon; }
      grilleDate = d.date;
      grilleEnMemoire.set(d.cle || cle,
        { max:d.max || grilleMax, mois:d.mois ?? (grilleDediee ? grilleMois : 0),
          date:d.date, obs:(d.pts || []).length });
    }
  } catch (e) { /* base indisponible : on retombe sur la collecte */ }
}

/* Collecte par curseur d'identifiant. La pagination par numéro de page bute à dix mille
   résultats ; le curseur n'a pas de plafond. Si la zone déborde le budget d'appels, on
   prélève des tranches réparties sur toute la plage plutôt que les seules plus récentes. */
async function collecterOu(gen, mois) {
  const ecartees = especesAEcarter();
  const f = { ...filtres(), geoprivacy:'open', taxon_geoprivacy:'open',
              order_by:'id', order:'asc', per_page:GRILLE_PAR_APPEL };
  // Collecte dédiée : tout le plafond sur un mois, ou sur les quatre semaines autour d'aujourd'hui.
  if (mois === FENETRE) f.week = semainesFenetre().join(',');
  else if (mois) f.month = mois;
  if (ecartees.length) f.without_taxon_id = ecartees.join(',');

  const bornes = await appel('/observations', { ...f, per_page:1 }, false, true);
  verifier(gen);
  const total = bornes.total_results || 0;
  const premier = (bornes.results && bornes.results[0] && bornes.results[0].id) || 0;
  const finBrut = await appel('/observations', { ...f, order:'desc', per_page:1 }, false, true);
  verifier(gen);
  const dernier = (finBrut.results && finBrut.results[0] && finBrut.results[0].id) || premier;

  /* Cet endpoint renvoie le taxon le plus fin déterminé : une sous-espèce arrive sous la
     sous-espèce. On la remonte à l'espèce de l'inventaire par sa lignée ; une observation
     restée au genre n'y trouve rien et sort — « Quercus sp. » ne se coche pas. */
  const especes = new Set(etat.especes.map(e => e.id));
  const versEspece = tx => {
    if (especes.has(tx.id)) return tx.id;
    const a = tx.ancestor_ids || [];
    for (let i = a.length - 1; i >= 0; i--) if (especes.has(a[i])) return a[i];
    return null;
  };

  const vus = new Set(), pts = [];
  const avaler = d => {
    for (const o of (d.results || [])) {
      if (vus.has(o.id)) continue;
      vus.add(o.id);
      const g = o.geojson && o.geojson.coordinates;
      if (!g || !o.taxon) continue;
      const e = versEspece(o.taxon);
      if (e === null) continue;
      const d = o.observed_on_details;
      pts.push({ x:g[0], y:g[1], t:e,
                 m: d && d.month ? d.month : 0,
                 s: d && d.week ? d.week : 0 });
    }
    return (d.results || []).length;
  };

  const pages = Math.ceil(grilleMax / GRILLE_PAR_APPEL);
  if (total <= grilleMax) {
    let curseur = premier - 1;
    for (let k = 0; k < pages; k++) {
      progression(t('bioCharge', nb(pts.length)), (k / pages) * 90);
      const d = await appel('/observations', { ...f, id_above:curseur }, false, true);
      verifier(gen);
      if (!avaler(d)) break;
      curseur = d.results[d.results.length - 1].id;
    }
  } else {
    const pas = Math.max(1, Math.floor((dernier - premier) / pages));
    for (let k = 0; k < pages; k++) {
      progression(t('bioCharge', nb(pts.length)), (k / pages) * 90);
      const d = await appel('/observations', { ...f, id_above: premier + k * pas - 1 }, false, true);
      verifier(gen);
      avaler(d);
    }
  }
  return { pts, ecartees: ecartees.length, echantillon: total > grilleMax, total };
}

/* Le découpage en carreaux ne coûte aucune requête : il se refait à chaque changement de
   filtre, ce qui rend instantané le passage d'une mesure à l'autre.

   Un carreau retient une présence par espèce et le nombre d'observations qui l'appuient —
   le premier sert au décompte, le second à la pondération par la responsabilité. */
function construireGrille(tous) {
  /* Le mois filtre ici, pas dans la requête. Les observations sans date connue sont écartées
     quand un mois est demandé : les retenir reviendrait à les compter douze fois.

     Et l'on refuse de servir des points d'un seul mois sous l'étiquette « toute l'année » :
     ce serait présenter un douzième des données comme l'ensemble. */
  if (!grilleMois && grillePtsMois) return null;
  let pts = tous;
  if (grilleMois === FENETRE) {
    const sem = new Set(semainesFenetre());
    pts = tous.filter(p => sem.has(p.s));
  } else if (grilleMois > 0) {
    pts = tous.filter(p => p.m === grilleMois);
  }
  if (!pts.length) return null;
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  const aire = Math.max((x1 - x0) * (y1 - y0), 1e-6);
  /* Le nombre de carreaux visé suit le volume collecté : sur un relevé de quatre cents
     points, sept cents carreaux n'en contiendraient qu'un chacun et la carte ne dirait rien ;
     sur quarante mille, un quadrillage grossier noierait les différences. On vise en gros
     douze points par carreau, borné des deux côtés : à six, les carreaux étaient trop petits
     pour se lire et trop pauvres pour qu'une absence veuille dire quelque chose.

     La taille reste la même partout : des carreaux plus fins là où l'on prospecte davantage
     donneraient des valeurs incomparables entre eux, ce qui est précisément ce que cette
     carte sert à faire. */
  const cible = Math.min(700, Math.max(60, Math.round(pts.length / 12)));
  const cote = Math.max(GRILLE_MIN, Math.sqrt(aire / cible));

  /* Un degré de longitude est plus court qu'un degré de latitude — d'un facteur cosinus de la
     latitude — et la projection le rend tel quel. Des carreaux de même valeur en degrés
     s'affichaient donc en rectangles couchés. On écrase la hauteur d'autant. */
  const hCell = Math.max(cote * Math.cos((y0 + y1) / 2 * Math.PI / 180), 1e-6);

  const cells = new Map();
  for (const p of pts) {
    const i = Math.floor((p.x - x0) / cote), j = Math.floor((p.y - y0) / hCell);
    const k = i + ':' + j;
    if (!cells.has(k)) cells.set(k,
      { x: x0 + i * cote, y: y0 + j * hCell, w:cote, h:hCell, taxons:new Map(), obs:0 });
    const c = cells.get(k);
    c.taxons.set(p.t, (c.taxons.get(p.t) || 0) + 1);
    c.obs++;
  }
  const cellules = [...cells.values()];
  const especes = new Set();
  cellules.forEach(c => c.taxons.forEach((v, id) => especes.add(id)));
  return { cellules, bornes:[x0, y0, x1, y1], especes:especes.size,
           obs:pts.length, total:tous.length };
}

/* Les introduites restent exclues sans discussion sur cette carte : elle sert à décider où
   aller, et un robinier ou une perruche ne sont une raison de se déplacer pour personne.
   Le reste suit le menu commun aux autres vues. */
/* Deux lectures seulement, et elles se calculent sur le même relevé : la collecte ne dépend
   plus de ce qu'on affiche, donc basculer de l'une à l'autre ne coûte rien. */
function retenuCarte(id) {
  if (estIntroduite(id)) return false;
  return carteVue === 'toutes' || !dejaVue(id);
}

function manquantsDuCarreau(c) {
  const sortie = [];
  for (const [id, n] of c.taxons) if (retenuCarte(id)) sortie.push([id, n]);
  return sortie;
}

function compteManquants(c) { return manquantsDuCarreau(c).length; }

/* Le score pondéré : la somme des responsabilités des espèces manquantes présentes dans le
   carreau. La responsabilité d'une espèce est la part que la zone d'étude représente dans ses
   observations mondiales. Le nombre d'observations du carreau n'entre pas en compte : une
   espèce y est présente ou non, et un endroit très photographié ne doit pas peser plus lourd
   pour autant.

   Compter les espèces distinctes envoie vers les carreaux divers, où l'on verra beaucoup de
   choses mais surtout des choses banales. La pondération envoie vers les carreaux où se
   trouvent les espèces qu'on ne verrait pas ailleurs.

   Les espèces dont l'effectif mondial est inconnu, ou sous le plancher SEUIL_MONDE (le même
   que pour le tri de la planche), sont ignorées plutôt que comptées comme maximales : une
   donnée pauvre ne doit pas se lire comme une responsabilité totale. */
function responsabilite(id) {
  const e = especeParId(id);
  if (!e || !(e.nMonde >= SEUIL_MONDE)) return 0;
  return Math.min(1, e.nZone / e.nMonde);
}

function scoreCarreau(c) {
  let s = 0;
  for (const [id] of manquantsDuCarreau(c)) s += responsabilite(id);
  return s;
}

/* Correction du biais de prospection, à l'essai.

   Un carreau peu parcouru affiche peu d'espèces manquantes, non parce qu'il en contient peu
   mais parce que personne n'y est allé. On calcule donc la corrélation géographique entre
   espèces — le même coefficient de Pearson que les biorégions du premier outil — puis, dans
   chaque carreau, on réinjecte les espèces associées à celles qu'on y trouve. Une espèce très
   liée à ce qu'on observe ici est portée comme probable ; une espèce d'un autre milieu ne
   l'est pas, faute de corrélation.

   Trois réserves, qui font que ce réglage reste optionnel et annoncé comme tel :

   — la matrice est tirée des mêmes données biaisées. Si tout le monde longe les sentiers,
     cette structure sera renforcée, pas corrigée ;
   — la collecte écarte les espèces déjà cochées, donc les plus communes. Ce sont elles qui
     décrivent le mieux un milieu ; la corrélation se calcule ici sur les seules espèces
     manquantes, ce qui la rend plus bruitée que dans les biorégions ;
   — une probabilité n'est pas une observation. Un carreau corrigé dit « il devrait y avoir
     ça », pas « quelqu'un l'a vu ». */
function valeurCarreau(c) {
  return grilleMesure === 'resp' ? scoreCarreau(c) : compteManquants(c);
}

const formatMesure = v => grilleMesure === 'resp' ? v.toFixed(2) : nb(Math.round(v));

/* L'échelle. Un dégradé d'une seule teinte demande de comparer des opacités, ce que l'œil
   fait mal : sur un fond irrégulier — relief, satellite — deux carreaux voisins paraissent
   différents pour la seule raison que le fond l'est. Une échelle à plusieurs teintes se lit
   par la couleur, indépendamment du fond.

   Les cinq arrêts vont du violet profond au jaune clair. La clarté croît de façon monotone,
   si bien que l'ordre se lit même en niveaux de gris ou pour un œil daltonien ; aucune de
   ces teintes n'existe dans la végétation ni dans la roche vues du ciel ; et les extrêmes
   sont franchement distincts, ce qu'un dégradé d'opacité ne donne jamais. */
const ECHELLE = [
  [0.00, [ 58,  24,  86]],
  [0.25, [138,  38, 112]],
  [0.50, [204,  58,  86]],
  [0.75, [240, 126,  46]],
  [1.00, [250, 206,  62]]
];

function couleurEchelle(p) {
  const x = Math.min(Math.max(p, 0), 1);
  for (let i = 1; i < ECHELLE.length; i++) {
    const [p1, c1] = ECHELLE[i - 1], [p2, c2] = ECHELLE[i];
    if (x <= p2) {
      const k = (x - p1) / (p2 - p1);
      return c1.map((v, j) => Math.round(v + (c2[j] - v) * k));
    }
  }
  return ECHELLE[ECHELLE.length - 1][1];
}

/* La racine étale le bas de l'échelle : sans elle, les quelques carreaux très riches
   écrasent tous les autres dans la première teinte, et la carte ne montre plus rien. */
const positionEchelle = (v, max) => max > 0 ? Math.sqrt(Math.min(v / max, 1)) : 0;

function teinteOu(v, max) {
  if (!v) return null;
  const [r, g, b] = couleurEchelle(positionEchelle(v, max));
  /* On laisse le fond transparaître : sur le plan comme sur le satellite, savoir ce qu'il y a
     sous un carreau riche — une friche, une ripisylve, un parc — fait partie de la lecture. */
  return `rgba(${r},${g},${b},${fondOu === 'plan' ? 0.62 : 0.76})`;
}

function traitOu() {
  return fondOu === 'plan' ? { color:'#14231C', opacity:0.22 }
                           : { color:'#FFFFFF', opacity:0.38 };
}

function barreEchelle() {
  const n = 24, arrets = [];
  for (let i = 0; i <= n; i++) {
    const [r, g, b] = couleurEchelle(positionEchelle(i / n, 1));
    arrets.push(`rgb(${r},${g},${b}) ${(i / n * 100).toFixed(1)}%`);
  }
  return `linear-gradient(to right, ${arrets.join(', ')})`;
}


/* On sert ce qui est en réserve, et l'on s'arrête là. Une collecte coûte une minute et des
   dizaines de requêtes : elle ne part jamais d'elle-même, seulement au clic. */
async function assurerGrille() {
  await releverGrille();
  dessinerCarteOu();
}

async function chargerGrille() {
  if (grilleEnCours || !etat.especes.length || !perso) return;
  grilleEnCours = true;
  const gen = generation;
  const mois = grilleMois;          // la collecte vise le mois affiché au moment du clic
  vueOu = null;
  dessinerCarteOu();
  try {
    const r = await collecterOu(gen, mois);
    verifier(gen);
    progression(t('bioCalcul'), 95);
    grillePts = r.pts;
    grillePtsMois = mois;
    grilleEcartees = r.ecartees;
    grilleEchantillon = r.echantillon;
    grilleTotal = r.total || 0;
    grille = construireGrille(r.pts);
    if (grille) { grille.ecartees = r.ecartees; grille.echantillon = r.echantillon; }
    grilleDediee = !!mois;
    grilleDate = 0;                 // fraîchement collecté
    grilleReleveePour = cleGrille();
    grilleEnMemoire.set(cleGrille(),
      { max:grilleMax, mois, date:Date.now(), obs:r.pts.length });
    await surBase('readwrite', st => st.put({ cle:cleGrille(), date:Date.now(),
      pts:r.pts, ecartees:r.ecartees, echantillon:r.echantillon, total:r.total,
      max:grilleMax, mois }));
    progression(t('mComplet'), null);
  } catch (e) {
    grilleEchec = cleGrille();
    if (!(e instanceof Annule)) progression(t('mEchec', String((e && e.message) || e)), null);
  } finally {
    grilleEnCours = false;
    dessinerCarteOu();
  }
}

function cadrerOu(oublier) {
  if (!carteOu) return;
  if (oublier) vueOu = null;
  if (grille) {
    const [x0, y0, x1, y1] = grille.bornes;
    carteOu.fitBounds([[y0, x0], [y1, x1]], { padding:[18, 18] });
    return;
  }
  // Sans relevé, on cadre sur la zone d'étude elle-même.
  const b = bornesLocales();
  if (b) carteOu.fitBounds(b, { padding:[18, 18] });
}

/* Le nom de la portée courante, tel qu'il s'écrit dans une phrase. */
function portee() {
  if (grilleMois === FENETRE) { const [a, b] = bornesFenetre(); return t('gFenetreNom', a, b); }
  return grilleMois ? MOIS[grilleMois - 1] : t('touteAnnee').toLowerCase();
}

/* Une collecte dédiée n'a d'intérêt que si la collecte générale a buté sur son plafond.
   Quand elle a tout ramené, le découpage local contient déjà toutes les observations de la
   portée demandée, et recollecter ne peut rendre que les mêmes. C'est le cas le plus
   fréquent sur une commune, et c'est ce qui donne l'impression que le bouton ne fait rien. */
function dedieeInutile() {
  return !!grilleMois && !!grille && !grilleDediee && !grilleEchantillon;
}

/* Ce qui dort en réserve pour cette zone, offert en un clic. Un relevé coûte une minute :
   le retrouver ne doit pas demander de deviner quelle combinaison de réglages l'avait
   produit, ni de relancer pour s'en assurer. */
/* Tous les relevés de cette zone, quelle que soit la lecture sous laquelle ils ont été
   faits. N'afficher que ceux de la lecture courante obligeait à retrouver les réglages
   avant de voir qu'un relevé existait — c'est-à-dire à deviner ce que la rangée était
   censée apprendre. Chaque jeton porte donc ses réglages complets et les rétablit tous. */
function relevesDisponibles() {
  const prefixe = cleInventaire() + '|ou4|';
  const l = [];
  for (const [cle, d] of grilleEnMemoire) {
    if (!cle.startsWith(prefixe)) continue;
    l.push({ cle, ...d, courant: cle === cleGrille() });
  }
  return l.sort((a, b) => (a.mois - b.mois) || (a.max - b.max));
}

/* Toujours affiché, même vide. Un relevé coûte une minute : savoir dès l'ouverture qu'on
   n'en a aucun, ou lesquels on possède, fait partie de ce que l'onglet doit dire — et une
   rangée qui n'apparaît qu'une fois pleine ne s'apprend jamais. */
function barreReserves() {
  const l = relevesDisponibles();
  const nomPalier = v => t((GRILLE_PALIERS.find(([x]) => x === v) || [0, 'bioMoyen'])[1]);
  return `<div class="reserves${l.length ? '' : ' vide'}">
    <span class="tit">${t('gEnReserve')}</span>
    ${l.length
      ? l.map(x => `<button class="jeton-res${x.courant ? ' actif' : ''}"
          data-res="${x.max}:${x.mois}">
          <b>${echap(x.mois ? (x.mois === FENETRE ? t('gFenetreCourt') : MOIS[x.mois - 1])
            : t('touteAnnee'))}</b>
          <span>${echap(nomPalier(x.max))}</span>
          <i>${nb(x.obs)} ${t('obs')} · ${ageTexte(x.date)}</i>
        </button>`).join('')
      : `<span class="rien">${t('gAucuneReserve')}</span>`}
  </div>`;
}

function dessinerCarteOu() {
  const v = $('#v-carte');
  if (!v) return;
  if (!etat.especes.length) return;
  if (!perso) { v.innerHTML = attenteListe(); return; }

  const [fa, fb] = bornesFenetre();

  /* Une réglette de treize crans plutôt qu'une glissière. Les mois forment bien une suite, et
     c'est pourquoi on les aligne — mais faire glisser un curseur qui s'accroche à chaque cran
     est désagréable, et viser le bon au doigt l'est encore plus. Un cran se choisit d'un
     appui, ce qui est le geste qu'on veut faire. Le point vert marque les périodes déjà en
     réserve. */
  const enReserve = m => grilleEnMemoire.has(cleGrille(m));
  const crans = [[0, t('touteAnnee')]].concat(MOIS.map((m, i) => [i + 1, MOIS_C[i]]));
  const glissiere = `<div class="periode" role="group" aria-label="${echap(t('gPeriode'))}">
    <div class="crans">${crans.map(([m, nom]) =>
      `<button data-cran="${m}" class="${m === grilleMois ? 'actif' : ''}${
        enReserve(m) ? ' pret' : ''}">${echap(capitaliser(nom))}</button>`).join('')}
    </div>
  </div>`;

  /* Deux rangées, dans l'ordre où l'on s'en sert. En haut ce qui touche à la collecte —
     combien on ramène, et le bouton qui le fait. En dessous la période, qui décide de ce que
     la collecte ira chercher. Les réglages de simple lecture ferment la marche.

     Les décomptes ont disparu : le nombre de carreaux ou de requêtes ne dit rien qu'on
     puisse décider, et il encombrait la ligne d'un chiffre que personne ne lit. */
  const enTete = `<div class="outils">
      ${selectPalier()}
      <button class="${grille ? 'discret' : 'primaire'}" id="g-lancer"${
        grilleEnCours || dedieeInutile() ? ' disabled' : ''}${
        dedieeInutile() ? ` title="${echap(t('gDejaComplet'))}"` : ''}>${
          grilleMois
            ? t(grilleDediee ? 'gRelancerMois' : 'gLancerMois', portee())
            : t(grille ? 'gRelancer' : 'gLancer')}</button>
      ${grille && grilleDate
        ? `<span class="en-memoire">${t('gEnMemoire', ageTexte(grilleDate))}</span>` : ''}
    </div>

    <div class="outils periode-barre">
      ${glissiere}
      <button class="maintenant${grilleMois === FENETRE ? ' actif' : ''}" id="g-maintenant"
        >${enReserve(FENETRE) ? '<i class="pastille-ok"></i>' : ''}${
          t('gFenetreOpt', fa, fb)}</button>
    </div>

    <div class="outils">
      <select id="g-quoi">
        <option value="jamais"${carteVue === 'jamais' ? ' selected' : ''}>${t('gVueJamais')}</option>
        <option value="toutes"${carteVue === 'toutes' ? ' selected' : ''}>${t('gVueToutes')}</option>
      </select>
      <select id="g-mesure">
        <option value="compte"${grilleMesure === 'compte' ? ' selected' : ''}>${t('mCompte')}</option>
        <option value="resp"${grilleMesure === 'resp' ? ' selected' : ''}${
          etat.refFaite[etat.qualite] ? '' : ' disabled'}>${t('mResp')}</option>
      </select>
      ${grille ? `<button class="discret" id="g-recadrer">${t('recadrer')}</button>` : ''}
    </div>`;

  /* La carte est toujours affichée, même sans relevé : elle porte alors les limites de la
     zone et les espèces retenues. Auparavant l'absence de collecte remplaçait la carte par un
     carton, si bien que sélectionner des espèces ne montrait rien — le défaut le plus
     déroutant, puisque rien ne disait qu'il manquait une carte et non les points. */
  const max = grille ? Math.max(...grille.cellules.map(valeurCarreau), 0) : 0;
  const arret = grilleEchec === cleGrille() && !grilleEnCours;
  const bandeau = !grille
    ? `<div class="vide court"><strong>${t(arret ? 'gArret' : 'oCarte')}</strong>${
        arret ? t('gArretD') : t(grilleEnCours ? 'gEnCours' : 'gAvant')}</div>`
    : max <= 0
      ? `<div class="vide court"><strong>${t('gRienAMontrer')}</strong>${
          t(grilleMesure === 'resp' ? 'gRienResp' : 'gRienCompte')}</div>`
      : '';

  v.innerHTML = enTete + barreReserves() + bandeau + `
    <div class="carte-boite"><div id="carte-ou"></div>
      <button id="g-fond" class="sur-carte${fondOu !== 'plan' ? ' actif' : ''}"
        title="${echap(t('cFond'))}">
        <svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true">
          <path d="M10 2.4 2.6 6.2 10 10l7.4-3.8z" fill="none" stroke="currentColor"
            stroke-width="1.5" stroke-linejoin="round"/>
          <path d="M3.4 9.6 10 13l6.6-3.4M3.4 13.2 10 16.6l6.6-3.4" fill="none"
            stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
        </svg>
      </button>
      ${max > 0 ? `<div id="g-legende">
        <span class="quoi">${t(grilleMesure === 'resp' ? 'gLegendeResp' : 'gLegende')}</span>
        <span class="barre" style="background:${barreEchelle()}"></span>
        <span class="bornes"><b>${formatMesure(max / 4)}</b><b>${formatMesure(max / 2)}</b><b>${
          formatMesure(max * 3 / 4)}</b><b>${formatMesure(max)}</b></span>
        <span class="podium"><i class="or"></i><i class="argent"></i><i class="bronze"></i>
          ${t('gPodium')}</span>
      </div>` : ''}
    </div>
    <div id="g-detail"></div>
    ${noteSansPoint()}
`;

  brancherCarteOu();
  brancherChoix('#v-carte');
  /* Les pastilles des onglets suivent l'état des données : sans cet appel, celle de « Où ? »
     restait éteinte après une collecte reprise de la réserve, qui ne passe par aucun message
     de progression. */
  majOnglets();
  setTimeout(() => tracerGrille(max), 30);
}

/* Toutes les espèces de la lecture ne peuvent pas figurer sur la carte. Trois raisons, qui
   tiennent à la collecte et non à la carte : iNaturalist floute la position des espèces
   sensibles, et ces observations sont écartées plutôt que posées à un faux endroit ; les
   introduites ne sont pas collectées ; et le plafond d'observations ne ramène qu'une part des
   données quand la zone est très fournie. Le dire vaut mieux que de laisser croire à une
   absence de terrain. */
function noteSansPoint() {
  if (!grille || !grillePts) return '';
  const presentes = new Set(grillePts.map(p => p.t));
  const attendues = etat.especes.filter(e => e.nZone > 0 && retenuCarte(e.id));
  const sans = attendues.filter(e => !presentes.has(e.id)).length;
  if (!sans) return '';
  return `<p class="note">${t('gSansPoint', nb(sans), nb(attendues.length))}</p>`;
}

function brancherCarteOu() {
  const b = (sel, ev, fn) => { const e = $(sel); if (e) e.addEventListener(ev, fn); };
  document.querySelectorAll('#v-carte .crans button').forEach(g =>
    g.addEventListener('click', () => {
      grilleMois = +g.dataset.cran;
      grilleReleveePour = null;
      assurerGrille();
    }));

  b('#g-palier', 'change', e => { grilleMax = +e.target.value; assurerGrille(); });
  b('#g-lancer', 'click', () => { grilleEchec = null; enTache(chargerGrille); });
  b('#g-quoi', 'change', e => { carteVue = e.target.value; dessinerCarteOu(); });
  b('#g-maintenant', 'click', () => {
    grilleMois = grilleMois === FENETRE ? 0 : FENETRE;
    grilleReleveePour = null;
    assurerGrille();
  });
  b('#g-mesure', 'change', e => { grilleMesure = e.target.value; dessinerCarteOu(); });
  b('#g-fond', 'click', () => {
    fondOu = ORDRE_FONDS[(ORDRE_FONDS.indexOf(fondOu) + 1) % ORDRE_FONDS.length];
    $('#g-fond').classList.toggle('actif', fondOu !== 'plan');
    poserFond(carteOu, fondOu);
    tracerGrille(grille ? Math.max(...grille.cellules.map(valeurCarreau), 1) : 1);
  });
  b('#g-recadrer', 'click', () => cadrerOu(true));
  document.querySelectorAll('#v-carte [data-res]').forEach(b2 =>
    b2.addEventListener('click', () => {
      const [mx, ms] = b2.dataset.res.split(':').map(Number);
      grilleMax = mx; grilleMois = ms;
      grilleReleveePour = null;
      assurerGrille();
    }));
}

function tracerGrille(max) {
  const cible = $('#carte-ou');
  if (!cible) return;

  /* Toute modification d'un réglage réécrit le contenu de la vue, donc remplace le conteneur
     de la carte. L'objet Leaflet, lui, survit et continue de pointer vers l'ancien élément,
     détaché du document : la carte paraissait alors figée. On compare donc le conteneur au
     lieu de se fier à l'existence de l'objet, et l'on restitue le cadrage. */
  if (!carteOu || carteOu.getContainer() !== cible) {
    if (carteOu) carteOu.remove();
    carteOu = L.map(cible, { scrollWheelZoom:true });
    coucheOu = null; coucheLimites = null;
    poserFond(carteOu, fondOu);
    if (vueOu) carteOu.setView(vueOu.centre, vueOu.zoom);
    else cadrerOu();
    carteOu.on('moveend zoomend', () => {
      vueOu = { centre: carteOu.getCenter(), zoom: carteOu.getZoom() };
    });
  }
  carteOu.invalidateSize();
  if (coucheOu) coucheOu.remove();
  coucheOu = L.layerGroup().addTo(carteOu);
  if (coucheLimites) coucheLimites.remove();
  tracerLimites(carteOu).then(x => { coucheLimites = x; });

  if (!grille) return;

  const compte = new Map(grille.cellules.map(c => [c, valeurCarreau(c)]));
  const trait = traitOu();

  /* Les trois meilleurs carreaux sont cerclés d'or, d'argent et de bronze. Un seul carreau
     désigné laissait croire à un vainqueur net là où les trois premiers se tiennent souvent
     à une espèce près — et le deuxième est parfois bien plus accessible que le premier. */
  const podium = new Map(
    [...grille.cellules]
      .filter(c => compte.get(c) > 0)
      .sort((a, b) => compte.get(b) - compte.get(a))
      .slice(0, 3)
      .map((c, i) => [c, i]));
  const MEDAILLES = ['#FFC107', '#DFE4E8', '#E2761B'];

  for (const c of grille.cellules) {
    const f = teinteOu(compte.get(c), max);
    if (!f) continue;
    const rang = podium.has(c) ? podium.get(c) : -1;
    /* Un liseré sombre sous la médaille : sur un fond satellite ou sur un carreau clair, une
       couleur vive seule se perd. Le halo lui donne un contour dans tous les cas. */
    if (rang >= 0)
      L.rectangle([[c.y, c.x], [c.y + c.h, c.x + c.w]], {
        stroke:true, weight: 8 - rang, color:'#14231C', opacity:0.45, fill:false
      }).addTo(coucheOu);
    const r = L.rectangle([[c.y, c.x], [c.y + c.h, c.x + c.w]], {
      stroke:true, weight: rang >= 0 ? 5 - rang * 0.8 : 0.7,
      color: rang >= 0 ? MEDAILLES[rang] : trait.color,
      opacity: rang >= 0 ? 1 : trait.opacity,
      fillColor:f, fillOpacity:1
    });
    r.on('click', () => { grilleCellule = c; detailCellule(c); });
    r.addTo(coucheOu);
    // Les cerclés passent devant : un voisin plus dense masquait leur liseré.
    if (rang >= 0 && r.bringToFront) r.bringToFront();
  }
  if (grilleCellule) detailCellule(grilleCellule);
}

/* Le détail d'un carreau : les espèces qui t'y manquent, les plus observées en tête — ou,
   avec la pondération, celles dont la zone porte la plus grande responsabilité. C'est la
   liste qu'on emporte sur le terrain. */
function detailCellule(c) {
  const cible = $('#g-detail');
  if (!cible) return;
  const paires = manquantsDuCarreau(c);
  const poids = new Map(paires.map(([id, n]) =>
    [id, grilleMesure === 'resp' ? responsabilite(id) + n * 1e-9 : n]));
  /* On copie l'espèce en lui donnant l'effectif du carreau : sans cela la fiche affichait le
     total de toute la zone, qui n'a rien à voir avec ce qu'on regarde, et le classement —
     fait sur le carreau — paraissait arbitraire. */
  const especes = paires.map(([id, n]) => {
    const e = especeParId(id);
    return e ? { ...e, nAffiche:n, nLabel:'gDansCarreau' } : null;
  }).filter(Boolean).sort((a, b) => poids.get(b.id) - poids.get(a.id));

  cible.innerHTML = (especes.length
    ? `<div class="tit" style="margin:18px 0 8px">${t('gCellule', nb(especes.length), nb(c.obs))}</div>
       <div class="planche">${especes.slice(0, 60).map(ficheCoche).join('')}</div>`
    : `<p class="note">${t('gCelluleVide')}</p>`);
  brancherChoix('#g-detail');
  brancherLignage('#g-detail');
}

/* Les observations d'une espèce retenue. L'agrégation par carreau ne donne pas de
   coordonnées : on va les chercher pour cette seule espèce, une requête ou deux, quand on
   la coche. C'est plus honnête que de les servir depuis un échantillon, et cela ne coûte
   que pour les espèces qu'on regarde vraiment. */
async function chargerPointsEspece(id) {
  if (pointsEspece.has(id)) return pointsEspece.get(id);
  /* La collecte a rapatrié les points des espèces manquantes : pour elles, rien à demander.
     Seules les espèces écartées — celles que tu as déjà vues — coûtent une requête. */
  if (grillePts) {
    const locaux = grillePts
      .filter(p => p.t === id && (!grilleMois || p.m === grilleMois))
      .map(p => ({ x:p.x, y:p.y }));
    if (locaux.length) { pointsEspece.set(id, locaux); return locaux; }
  }
  const f = { ...filtres(), taxon_id:id, geoprivacy:'open', taxon_geoprivacy:'open',
              per_page:200, order_by:'id', order:'desc' };
  if (grilleMois) f.month = grilleMois;
  const pts = [];
  try {
    for (let page = 1; page <= 2; page++) {
      const d = await appel('/observations', { ...f, page }, false, true);
      for (const o of (d.results || [])) {
        const g = o.geojson && o.geojson.coordinates;
        if (g) pts.push({ x:g[0], y:g[1] });
      }
      if ((d.results || []).length < 200) break;
    }
  } catch (e) { /* hors ligne : l'espèce restera sans points */ }
  pointsEspece.set(id, pts);
  return pts;
}






/* ---- Quand ? --------------------------------------------------------------- */

/* Le meilleur moment de l'année, et ce qu'il y a à voir ce mois-ci : une seule question, donc
   un seul onglet. Les deux vues d'avant faisaient la même chose à deux échelles, et l'une
   payait vingt-six requêtes pour des quinzaines que les effectifs mensuels donnaient déjà.

   Ici tout vient de la phénologie, chargée en fond avec l'inventaire : pour chaque mois, les
   espèces qui te manquent et qui y ont été observées dans la zone, avec le nombre
   d'observations de ce mois-là — non le total de l'année, qui ne dit rien de la saison. */

let quandMois = new Date().getMonth();   // 0 à 11
let quandTri = 'obs';                    // obs · saison · resp

/* Trois façons de classer ce qu'on peut voir ce mois-là, et elles ne désignent pas les mêmes
   espèces. Le nombre d'observations met en tête ce qu'on rencontrera sûrement. La
   saisonnalité met en tête ce dont c'est vraiment le moment — une espèce qui fait 70 % de son
   année sur ce mois ne se rattrapera pas en septembre, même si elle est dix fois moins
   fréquente. La responsabilité met en tête ce qu'on ne verrait pas ailleurs. */
function trierQuand(l) {
  if (quandTri === 'saison') return l.sort((a, b) => b.partMois - a.partMois);
  if (quandTri === 'resp')
    return l.sort((a, b) => (b.nMonde ? b.nAffiche / b.nMonde : -1)
                          - (a.nMonde ? a.nAffiche / a.nMonde : -1));
  return l.sort((a, b) => b.nAffiche - a.nAffiche);
}

/* Le décompte d'un mois, partagé entre ce qui est déjà vu et ce qui manque. Le graphe montre
   les deux empilés : la hauteur totale dit la richesse du mois, la part colorée ce qu'il te
   reste à y trouver. Un mois très riche presque entièrement coché n'est pas le même
   renseignement qu'un mois moyen entièrement à faire.

   Ce décompte ignore le menu, qui ne commande que la grille du dessous — sinon le graphe
   perdrait justement la comparaison qui fait son intérêt. Il suit en revanche la référence,
   puisqu'elle définit ce que « vue » veut dire. */
function comptesDuMois(m) {
  let vues = 0, manque = 0;
  if (!etat.phenologie) return { vues, manque, total:0 };
  for (const e of etat.especes) {
    if (!retenuIntro(e.id)) continue;
    const p = etat.phenologie.get(e.id);
    if (!p || !p[m]) continue;
    if (dejaVue(e.id)) vues++; else manque++;
  }
  return { vues, manque, total:vues + manque };
}

/* Le relevé des quatre semaines autour d'aujourd'hui, quand il est là. Il ne figure pas dans
   le graphe — qui compare des mois — mais il sert de choix de grille, parce que la question
   « qu'est-ce que je peux voir cette semaine » ne se règle pas au mois près. */
const fenetreRelevee = () => etat.moisCache.get(etat.qualite + ':' + FENETRE) || null;

function manquantsDuMois(m) {
  const fen = m === FENETRE ? fenetreRelevee() : null;
  if (m === FENETRE && !fen) return [];
  if (m !== FENETRE && !etat.phenologie) return [];
  const l = [];
  for (const e of etat.especes) {
    if (!garde(e.id) || !retenuIntro(e.id)) continue;
    const p = etat.phenologie.get(e.id);
    const n = fen ? (fen.parId.get(e.id) || 0) : (p ? p[m] : 0);
    if (!n) continue;
    /* La part de l'année qui tombe sur ce mois. Un douzième serait le hasard : au-delà,
       l'espèce est saisonnière, et c'est ce qui dit s'il faut venir maintenant ou si elle
       sera là toute l'année. */
    /* Sur la fenêtre, la part se rapporte au total annuel de l'espèce dans la zone : les
       douze compartiments mensuels ne savent pas découper quatre semaines à cheval. */
    const total = fen ? Math.max(e.nZone, 1) : (p ? p.reduce((a, b) => a + b, 0) : 0);
    const part = total ? n / total : 0;
    l.push({ ...e, nAffiche:n, partMois:part,
      nExtra: quandTri === 'resp' && e.nMonde
        ? pourcent(n / e.nMonde * 100) + ' ' + t('duMonde')
        : t('qdPart', Math.round(part * 100)) });
  }
  return trierQuand(l);
}

function dessinerQuand() {
  const v = $('#v-quand');
  if (!v) return;
  if (!etat.especes.length) return;
  if (!perso) { v.innerHTML = attenteListe(); return; }

  const enTete = `<div class="outils">
    ${selectIntro('q-intro')}
    <span class="compte" id="q-compte"></span>
  </div>`;

  /* Le choix de ce qu'on affiche et de l'ordre se pose au moment de regarder la grille, non
     avant le graphe : celui-ci n'en dépend pas, et les mettre en tête laissait croire le
     contraire. */
  const [fa, fb] = bornesFenetre();
  const fenPrete = !!fenetreRelevee();
  const outilsGrille = `<div class="outils">
    ${selectQuoi('q-quoi')}
    <select id="q-tri">
      <option value="obs"${quandTri === 'obs' ? ' selected' : ''}>${t('qdTriObs')}</option>
      <option value="saison"${quandTri === 'saison' ? ' selected' : ''}>${t('qdTriSaison')}</option>
      <option value="resp"${quandTri === 'resp' ? ' selected' : ''}${
        etat.refFaite[etat.qualite] ? '' : ' disabled'}>${t('qdTriResp')}</option>
    </select>
    <button class="maintenant${quandMois === FENETRE ? ' actif' : ''}" id="q-maintenant"${
      fenPrete ? '' : ' disabled'}>${fenPrete ? '<i class="pastille-ok"></i>' : ''}${
      t('qdMaintenant', fa, fb)}</button>
  </div>`;

  if (!etat.phenologie) {
    v.innerHTML = enTete + `<div class="vide"><strong>${t('oQuand')}</strong>${t('attPheno')}</div>`;
    brancherQuoi('#q-quoi');
    brancherIntro('#q-intro');
    return;
  }

  const parMois = MOIS.map((m, i) => comptesDuMois(i));
  const max = Math.max(...parMois.map(x => x.total), 1);
  const ici = new Date().getMonth();

  /* Le graphe. Douze colonnes empilées, le total au-dessus de chacune, trois repères
     horizontaux pour l'échelle. Le mois qu'on regarde est mis en avant, celui d'aujourd'hui
     porte un liseré. Les proportions sont fixes et le SVG se met à l'échelle : sans cela le
     texte s'étirait avec les barres. */
  const P = { g:48, d:8, h:14, b:30 };      // la marge gauche loge le nom de l'axe
  const L1 = 640, H = 210;
  const larg = (L1 - P.g - P.d) / 12;
  const hMax = H - P.h - P.b;
  const y = n => P.h + hMax - (n / max) * hMax;

  const reperes = [0, 0.5, 1].map(f => {
    const v = Math.round(max * f);
    return `<g class="qd-repere">
      <line x1="${P.g}" x2="${L1 - P.d}" y1="${y(v)}" y2="${y(v)}"></line>
      <text x="${P.g - 7}" y="${y(v) + 3.5}">${nb(v)}</text>
    </g>`;
  }).join('');

  const barres = parMois.map((x, i) => {
    const gx = P.g + i * larg + larg * 0.18;
    const w = larg * 0.64;
    const hm = (x.manque / max) * hMax;
    const hv = (x.vues / max) * hMax;
    const base = P.h + hMax;
    const classes = (i === quandMois ? ' sel' : '') + (i === ici ? ' auj' : '');
    return `<g class="qd-barre${classes}" data-mois="${i}">
      <title>${echap(capitaliser(MOIS[i]))} · ${nb(x.manque)} ${t('qdAVoir')} · ${
        nb(x.vues)} ${t('qdDejaVues')}</title>
      <rect class="zone" x="${P.g + i * larg}" y="${P.h - 14}" width="${larg}"
        height="${hMax + 14}"></rect>
      ${x.vues ? `<rect class="v" x="${gx.toFixed(1)}" y="${(base - hm - hv).toFixed(1)}"
        width="${w.toFixed(1)}" height="${Math.max(hv, 1.5).toFixed(1)}" rx="2.5"></rect>` : ''}
      ${x.manque ? `<rect class="m" x="${gx.toFixed(1)}" y="${(base - hm).toFixed(1)}"
        width="${w.toFixed(1)}" height="${Math.max(hm, 1.5).toFixed(1)}" rx="2.5"></rect>` : ''}
      <text class="e" x="${(P.g + i * larg + larg / 2).toFixed(1)}"
        y="${H - 12}">${echap(MOIS_C[i])}</text>
    </g>`;
  }).join('');

  const liste = manquantsDuMois(quandMois);

  v.innerHTML = enTete + `
    <div class="qd-graphe">
      <svg viewBox="0 0 ${L1} ${H}" role="img" aria-label="${echap(t('oQuand'))}">
        <g class="qd-reperes">${reperes}</g>
        <text class="qd-titre-axe" transform="translate(12 ${P.h + hMax / 2}) rotate(-90)"
          >${echap(t('qdAxe'))}</text>
        <line class="qd-axe" x1="${P.g}" x2="${L1 - P.d}" y1="${P.h + hMax}" y2="${P.h + hMax}"></line>
        ${barres}
      </svg>
      <div class="qd-legende">
        <span><i class="m"></i>${t('qdAVoir')}</span>
        <span><i class="v"></i>${t('qdDejaVues')}</span>
      </div>
    </div>
    <div class="tit" style="margin:18px 0 8px">${
      t('qdDetail', quandMois === FENETRE ? t('qdFenetreNom', fa, fb)
        : capitaliser(MOIS[quandMois]), nb(liste.length))}</div>
    ${outilsGrille}
    ${barreChoisies(true)}
    ${liste.length
      ? `<div class="planche">${liste.slice(0, 200).map(ficheCoche).join('')}</div>`
      : `<p class="note">${t('qdVide')}</p>`}`;

  const cpt = $('#q-compte');
  if (cpt) cpt.textContent = nb(liste.length) + ' ' + t('especes');
  brancherQuoi('#q-quoi');
  brancherIntro('#q-intro');
  const tri = $('#q-tri');
  if (tri) tri.addEventListener('change', e => { quandTri = e.target.value; dessinerQuand(); });
  const mnt = $('#q-maintenant');
  if (mnt) mnt.addEventListener('click', () => {
    quandMois = quandMois === FENETRE ? new Date().getMonth() : FENETRE;
    dessinerQuand();
  });
  v.querySelectorAll('[data-mois]').forEach(g =>
    g.addEventListener('click', () => { quandMois = +g.dataset.mois; dessinerQuand(); }));
  brancherChoix('#v-quand');
  brancherLignage('#v-quand');
}


/* ---- Couverture ----------------------------------------------------------- */

/* Un total unique n'a pas de sens quand on compte tous les taxons : mille deux cents espèces
   dont huit cents plantes ne se compare à rien. Ce qui se compare, c'est la part — et
   l'écart entre groupes est justement ce qu'il y a à voir. */
/* La navigation reprend exactement celle de l'arbre du premier onglet : une seule branche
   ouverte à la fois, « couvDeplies » contenant le chemin de la racine au nœud courant.
   Cliquer un nom ouvre sa branche et referme les autres ; cliquer le chevron ne fait
   qu'ouvrir ou replier. On part donc replié, sur le seul contraste entre grands groupes. */
let couvDeplies = new Set();
let couvSel = null;
let couvRacine = null;        // conservé pour retrouver le chemin d'un nœud

function cheminCouv(id) {
  const rec = (n, acc) => {
    if (n.id === id) return acc;
    for (const x of n.enfants.values()) {
      const r = rec(x, [...acc, x.id]);
      if (r) return r;
    }
    return null;
  };
  return (couvRacine && rec(couvRacine, [])) || [];
}

/* L'arbre de couverture est bâti sur l'inventaire entier, pas sur le complément : c'est un
   rapport entre ce qu'on a vu et ce qu'il y a, donc les deux termes doivent y figurer. Il
   ignore le filtre de la planche, mais respecte celui des introduites — une flore exotique
   compterait sinon dans la couverture d'une flore locale. */
function arbreCouverture() {
  const racine = { id:null, enfants:new Map(), total:0, vues:0, ailleurs:0 };
  const base = etat.especes.filter(e => e.nZone > 0 && retenuIntro(e.id));

  for (const e of base) {
    const s = statut(e.id);
    const vue_ = dejaVue(e.id);
    let n = racine;
    const compter = x => {
      x.total++;
      if (vue_) x.vues++;
      else if (s === 'ailleurs') x.ailleurs++;   // manquante ici, mais connue de toi
    };
    compter(n);
    /* L'espèce elle-même termine la chaîne : on doit pouvoir descendre jusqu'à elle et voir
       laquelle manque, non s'arrêter au genre en devinant. */
    for (const id of [...chaineAncetres(e), e.id]) {
      if (!n.enfants.has(id))
        n.enfants.set(id, { id, enfants:new Map(), total:0, vues:0, ailleurs:0,
          esp: id === e.id ? e : null });
      n = n.enfants.get(id);
      compter(n);
    }
  }
  /* Les niveaux qui ne se divisent pas sont sautés, comme dans l'arbre de la planche : une
     classe qui ne contient qu'un ordre, lequel ne contient qu'une famille, ferait trois
     clics pour la même barre. On garde le nom du niveau atteint et l'on passe directement
     à ses petits-enfants. */
  const compresser = n => {
    let enfants = n.enfants;
    while (enfants.size === 1) {
      const seul = [...enfants.values()][0];
      if (seul.total !== n.total || !seul.enfants.size) break;
      enfants = seul.enfants;
    }
    const sortie = new Map();
    enfants.forEach(x => { const k = compresser(x); sortie.set(k.id, k); });
    return { ...n, enfants:sortie };
  };
  return compresser(racine);
}

/* Une ligne, et ses enfants si elle est dépliée. Un nœud sans descendance distincte n'est
   pas repliable : ouvrir pour retrouver la même barre dessous n'apprend rien. */
/* Du rouge brique au vert, en passant par l'ocre : le taux se lit à la couleur avant même
   qu'on ait lu le chiffre, ce qui est tout l'intérêt quand une branche en contient trente. */
const ECHELLE_COMPL = [
  [0.00, [180,  70,  46]],
  [0.35, [168, 124,  20]],
  [0.70, [106, 143,  60]],
  [1.00, [ 47, 107,  79]]
];

function couleurCompletude(pc) {
  const x = Math.min(Math.max(pc / 100, 0), 1);
  for (let i = 1; i < ECHELLE_COMPL.length; i++) {
    const [p1, c1] = ECHELLE_COMPL[i - 1], [p2, c2] = ECHELLE_COMPL[i];
    if (x <= p2) {
      const k = (x - p1) / (p2 - p1);
      return `rgb(${c1.map((v, j) => Math.round(v + (c2[j] - v) * k)).join(',')})`;
    }
  }
  return 'rgb(47,107,79)';
}

function ligneCouverture(n, profondeur) {
  /* Une espèce n'est pas dans la table des ancêtres : elle porte ses noms avec elle. */
  const info = n.esp
    ? { nom: nomCourt(n.esp.nom, n.esp.nomFr), sci:n.esp.nom, rang:t('rEspece'),
        latin: !n.esp.nomFr }
    : infoNoeud(n);
  const enfants = [...n.enfants.values()].sort((a, b) => b.total - a.total);
  const ouvrable = enfants.length > 0;
  const ouvert = couvDeplies.has(n.id);
  const pc = n.total ? n.vues / n.total * 100 : 0;
  const pa = n.total ? n.ailleurs / n.total * 100 : 0;

  return `<div class="couv-ligne${couvSel === n.id ? ' sel' : ''}" style="--prof:${profondeur}">
      <button class="n-plier${ouvrable ? '' : ' creux'}" data-couv="${n.id}"
        aria-expanded="${ouvert}" aria-label="${echap(t('deplier'))}">${ouvert ? '▾' : '▸'}</button>
      ${n.esp
        /* Une espèce est un bout de chemin : il n'y a rien à déplier dessous, et ce qu'on
           veut à ce moment-là est la fiche iNaturalist. Le nom devient donc un lien, non un
           bouton de navigation dans l'arbre. */
        ? `<a class="nom lien${info.latin ? ' lat' : ''}" href="${lienTaxon(n.id, true)}"
             target="_blank" rel="noopener" title="${echap(info.sci)}"
             >${echap(info.nom)}<span class="n-rang">${echap(info.rang)}</span></a>`
        : `<button class="nom${info.latin ? ' lat' : ''}" data-couv-nom="${n.id}"
             title="${echap(info.sci)}"
             >${echap(info.nom)}<span class="n-rang">${echap(info.rang)}</span></button>`}
      <span class="piste">
        <i style="width:${pc.toFixed(1)}%; background:${couleurCompletude(pc)}"></i>
        <i class="ailleurs" style="width:${pa.toFixed(1)}%"></i>
      </span>
      <span class="num" style="color:${couleurCompletude(pc)}">${pourcent(pc)}${
        n.esp ? '' : ' · ' + nb(n.total - n.vues) + ' ' + t('aVoir')}</span>
    </div>` +
    (ouvert && ouvrable
      ? enfants.map(c => ligneCouverture(c, profondeur + 1)).join('')
      : '');
}

function dessinerCouverture() {
  const v = $('#v-couverture');
  if (!v) return;
  if (!etat.especes.length) return;
  if (!perso) { v.innerHTML = attenteListe(); return; }

  couvRacine = arbreCouverture();
  const racines = [...couvRacine.enfants.values()].sort((a, b) => b.total - a.total);
  const total = couvRacine.total, vues = couvRacine.vues;

  v.innerHTML = `
    <div class="outils">
      ${selectReference('c-vu')}
      ${selectIntro('c-intro')}
      <span class="compte">${nb(total)} ${t('especes')}</span>
    </div>
    <div class="chiffres">
      <div class="chiffre"><div class="k">${t('couvGlobale')}</div>
        <div class="v">${pourcent(total ? vues / total * 100 : 0)}</div></div>
      <div class="chiffre"><div class="k">${t('couvEspeces')}</div>
        <div class="v">${nb(vues)} / ${nb(total)}</div></div>
      <div class="chiffre"><div class="k">${t('couvListe')}</div>
        <div class="v">${nb(perso.nMonde)}</div></div>
    </div>
    <div class="barres">${racines.map(r => ligneCouverture(r, 0)).join('')}</div>`;

  const s = $('#c-vu');
  if (s) s.addEventListener('change', e => changerReference(e.target.value));
  brancherIntro('#c-intro');

  v.querySelectorAll('[data-couv-nom]').forEach(b =>
    b.addEventListener('click', () => {
      const id = +b.dataset.couvNom;
      couvSel = couvSel === id ? null : id;
      couvDeplies = new Set(couvSel === null ? [] : cheminCouv(id));
      dessinerCouverture();
    }));

  v.querySelectorAll('[data-couv]').forEach(b =>
    b.addEventListener('click', () => {
      const id = +b.dataset.couv;
      const chemin = cheminCouv(id);
      // Ouvrir : on affiche le chemin jusqu'ici. Replier : on s'arrête au parent.
      couvDeplies = new Set(couvDeplies.has(id) ? chemin.slice(0, -1) : chemin);
      dessinerCouverture();
    }));
}



/* ---- Classement ------------------------------------------------------------ */

/* Qui a vu le plus d'espèces dans cette zone. Une seule requête : « observers » renvoie les
   contributeurs classés, avec pour chacun son nombre d'observations et son nombre d'espèces
   distinctes. C'est ce second chiffre qui fait la coche, et l'on classe dessus.

   Ta place y figure, même hors des dix premiers : c'est la seule chose qu'un classement doit
   vraiment dire à celui qui le lit. Quand tu n'apparais pas du tout dans le relevé, ton total
   local reste connu par ta propre liste, et on l'affiche à part. */

let classement = null;           // { liste, total }
let classementEnCours = false;
const CLASSEMENT_N = 10;

async function chargerClassement(gen) {
  const d = await appel('/observations/observers',
    { ...filtres(true), per_page:100 });
  verifier(gen);
  const liste = (d.results || []).map(x => ({
    id: x.user && x.user.id,
    nom: (x.user && (x.user.login || x.user.name)) || '?',
    icone: (x.user && x.user.icon_url) || '',
    especes: x.species_count || 0,
    obs: x.observation_count || 0
  })).sort((a, b) => b.especes - a.especes);
  return { liste, total: d.total_results || liste.length };
}

function ligneClassement(x, rang, moi) {
  const medaille = rang < 3 ? ['or', 'argent', 'bronze'][rang] : '';
  return `<div class="cl-ligne${moi ? ' moi' : ''}${medaille ? ' ' + medaille : ''}">
    <span class="rang">${rang + 1}</span>
    <a class="qui" href="https://www.inaturalist.org/people/${echap(x.nom)}"
      target="_blank" rel="noopener">
      ${x.icone ? `<img src="${echap(x.icone)}" alt="" loading="lazy">` : '<i class="sans"></i>'}
      <b>${echap(x.nom)}</b>${moi ? `<span class="marque cochee">${t('clToi')}</span>` : ''}
    </a>
    <span class="esp">${nb(x.especes)} <small>${t('especes')}</small></span>
    <span class="num">${nb(x.obs)} ${t('obs')}</span>
  </div>`;
}

function dessinerClassement() {
  const v = $('#v-classement');
  if (!v) return;
  if (!etat.especes.length) return;

  const enTete = `<div class="outils">
    <span class="compte">${classement ? t('clTotal', nb(classement.total)) : ''}</span>
  </div>`;

  if (!classement) {
    v.innerHTML = enTete + `<div class="vide"><strong>${t('oClassement')}</strong>${
      t('clEnCours')}</div>`;
    return;
  }

  const moi = perso ? perso.login : null;
  const rangMoi = classement.liste.findIndex(x => x.nom === moi);
  const top = classement.liste.slice(0, CLASSEMENT_N);
  const horsTop = rangMoi >= CLASSEMENT_N ? classement.liste[rangMoi] : null;

  v.innerHTML = enTete + `
    <div class="classement">${top.map((x, i) =>
      ligneClassement(x, i, x.nom === moi)).join('')}</div>
    ${horsTop ? `<div class="classement suite">${ligneClassement(horsTop, rangMoi, true)}</div>` : ''}
    ${!moi ? `<p class="note">${t('clSansCompte')}</p>`
      : rangMoi < 0 ? `<p class="note">${t('clAbsent', nb(perso.nIci))}</p>` : ''}`;
}

/* Une seule requête : elle part d'elle-même à l'ouverture, un bouton n'aurait servi qu'à
   faire attendre. */
async function lancerClassement() {
  if (classementEnCours || classement) return;
  classementEnCours = true;
  const gen = generation;
  dessinerClassement();
  try {
    classement = await chargerClassement(gen);
  } catch (e) {
    if (!(e instanceof Annule)) progression(t('mEchec', String((e && e.message) || e)), null);
  } finally {
    classementEnCours = false;
    dessinerClassement();
  }
}



/* ---- Carte de terrain ------------------------------------------------------ */

/* Celle qu'on tient à la main dehors. « Où ? » répond à « dans quel secteur aller », à
   l'échelle de la commune ; celle-ci répond à « où suis-je et qu'est-ce qui m'entoure », à
   l'échelle du pas. D'où trois choses que l'autre n'a pas : les observations des espèces
   retenues, la position en direct, et leurs photos sous la carte — parce que sur le terrain
   la question n'est plus où chercher mais à quoi ça ressemble. */

let carteT = null, coucheT = null, coucheMoi = null, coucheLimT = null;
let vueT = null, fondT = 'plan';
let veille = null;                 // identifiant de la surveillance de position
let maPosition = null;
let suivre = false;                // recentrer la carte à chaque relevé
const photosCache = new Map();     // identifiant d'espèce → photos, chargées à la demande

const PHOTOS_PAR_ESPECE = 4;

async function photosTerrain(id) {
  if (photosCache.has(id)) return photosCache.get(id);
  const urls = [];
  try {
    const d = await appel('/observations',
      { photos:'true', captive:'false', verifiable:'true', quality_grade:'research',
        order_by:'votes', per_page:PHOTOS_PAR_ESPECE, locale:langue, taxon_id:id }, false, true);
    for (const o of (d.results || []))
      for (const ph of (o.photos || [])) {
        if (urls.length >= PHOTOS_PAR_ESPECE) break;
        if (ph.url) urls.push(ph.url.replace('/square.', '/medium.'));
      }
  } catch (e) { /* hors ligne : on se contentera de la vignette de l'inventaire */ }
  photosCache.set(id, urls);
  return urls;
}

function dessinerTerrain() {
  const v = $('#v-terrain');
  if (!v) return;
  if (!etat.especes.length) return;

  v.innerHTML = `<div class="outils">
      <button class="${suivre ? 'primaire' : 'discret'}" id="t-suivre">${
        t(suivre ? 'tSuivi' : 'tMeSituer')}</button>
      <button class="discret" id="t-recadrer">${t('recadrer')}</button>
      <span class="compte">${choisies.length
        ? t('tRetenues', nb(choisies.length)) : t('tAucune')}</span>
    </div>
    ${barreChoisies(false)}
    <div class="carte-boite"><div id="carte-terrain"></div>
      <button id="t-fond" class="sur-carte${fondT !== 'plan' ? ' actif' : ''}"
        title="${echap(t('cFond'))}">
        <svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true">
          <path d="M10 2.4 2.6 6.2 10 10l7.4-3.8z" fill="none" stroke="currentColor"
            stroke-width="1.5" stroke-linejoin="round"/>
          <path d="M3.4 9.6 10 13l6.6-3.4M3.4 13.2 10 16.6l6.6-3.4" fill="none"
            stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
    <div id="t-photos"></div>
`;

  brancherTerrain();
  brancherChoix('#v-terrain');
  setTimeout(tracerTerrain, 30);
  dessinerPhotos();
}

function brancherTerrain() {
  const b = (sel, ev, fn) => { const e = $(sel); if (e) e.addEventListener(ev, fn); };
  b('#t-suivre', 'click', () => { suivre ? arreterVeille() : demarrerVeille(); });
  b('#t-recadrer', 'click', () => { vueT = null; cadrerTerrain(); });
  b('#t-fond', 'click', () => {
    fondT = ORDRE_FONDS[(ORDRE_FONDS.indexOf(fondT) + 1) % ORDRE_FONDS.length];
    $('#t-fond').classList.toggle('actif', fondT !== 'plan');
    poserFond(carteT, fondT);
  });
}

/* La position, relevée en continu. « enableHighAccuracy » demande le GPS plutôt que le
   réseau : dehors c'est la seule précision utile, et la dépense de batterie est assumée
   puisque l'onglet est ouvert exprès. La veille s'arrête dès qu'on le quitte. */
function demarrerVeille() {
  if (!navigator.geolocation) { progression(t('tSansGeoloc'), null); return; }
  suivre = true;
  dessinerTerrain();
  veille = navigator.geolocation.watchPosition(
    pos => {
      maPosition = { lat:pos.coords.latitude, lng:pos.coords.longitude,
                     precision:pos.coords.accuracy || 0 };
      tracerPosition(true);
    },
    () => { progression(t('tGeolocRefus'), null); arreterVeille(); },
    { enableHighAccuracy:true, maximumAge:5000, timeout:20000 });
}

function arreterVeille() {
  if (veille !== null && navigator.geolocation) navigator.geolocation.clearWatch(veille);
  veille = null;
  suivre = false;
  dessinerTerrain();
}

function tracerPosition(recentrer) {
  if (!carteT || !maPosition) return;
  if (coucheMoi) coucheMoi.remove();
  coucheMoi = L.layerGroup().addTo(carteT);
  /* Le cercle dit la précision annoncée par l'appareil : sous les arbres elle tombe à
     vingt mètres, et le point seul laisserait croire à une position exacte. */
  if (maPosition.precision > 0)
    L.circle([maPosition.lat, maPosition.lng], {
      radius:maPosition.precision, stroke:false,
      fillColor:'#3A63B8', fillOpacity:0.13
    }).addTo(coucheMoi);
  L.circleMarker([maPosition.lat, maPosition.lng], {
    radius:7, weight:3, color:'#fff', opacity:1,
    fillColor:'#3A63B8', fillOpacity:1
  }).addTo(coucheMoi);
  if (recentrer && suivre) carteT.setView([maPosition.lat, maPosition.lng],
    Math.max(carteT.getZoom(), 15));
}

function cadrerTerrain() {
  if (!carteT) return;
  if (maPosition) { carteT.setView([maPosition.lat, maPosition.lng], 15); return; }
  const tous = choisies.flatMap(id => pointsEspece.get(id) || []);
  if (tous.length) {
    const xs = tous.map(p => p.x), ys = tous.map(p => p.y);
    carteT.fitBounds([[Math.min(...ys), Math.min(...xs)], [Math.max(...ys), Math.max(...xs)]],
      { padding:[20, 20] });
    return;
  }
  const b = bornesLocales();
  if (b) carteT.fitBounds(b, { padding:[18, 18] });
}

async function tracerTerrain() {
  const cible = $('#carte-terrain');
  if (!cible) return;
  if (!carteT || carteT.getContainer() !== cible) {
    if (carteT) carteT.remove();
    carteT = L.map(cible, { scrollWheelZoom:true });
    coucheT = null; coucheMoi = null; coucheLimT = null;
    poserFond(carteT, fondT);
    if (vueT) carteT.setView(vueT.centre, vueT.zoom);
    carteT.on('moveend zoomend', () => {
      vueT = { centre: carteT.getCenter(), zoom: carteT.getZoom() };
    });
  }
  carteT.invalidateSize();
  if (coucheLimT) coucheLimT.remove();
  tracerLimites(carteT).then(x => { coucheLimT = x; });
  if (coucheT) coucheT.remove();
  coucheT = L.layerGroup().addTo(carteT);

  const lots = await Promise.all(choisies.map(chargerPointsEspece));
  if (!carteT || !$('#carte-terrain')) return;
  lots.forEach((pts, i) => {
    for (const p of pts) {
      const m = L.circleMarker([p.y, p.x], {
        radius:6, weight:1.8, color:'#fff', opacity:0.95,
        fillColor:PALETTE_ESP[i % MAX_COULEURS], fillOpacity:0.95
      }).addTo(coucheT);
      if (m.bringToFront) m.bringToFront();
    }
  });
  tracerPosition(false);
  if (!vueT) cadrerTerrain();
}

/* Les photos, sous la carte. Dehors, la question n'est plus où chercher mais à quoi ça
   ressemble : quatre images par espèce, les mieux notées, dans la couleur de son point. */
async function dessinerPhotos() {
  const cible = $('#t-photos');
  if (!cible) return;
  if (!choisies.length) { cible.innerHTML = ''; return; }

  cible.innerHTML = choisies.map((id, i) => {
    const e = especeParId(id);
    return `<section class="t-espece" data-esp="${id}"
      style="--teinte:${PALETTE_ESP[i % MAX_COULEURS]}">
      <h3><i></i>${echap(e ? nomCourt(e.nom, e.nomFr) : '#' + id)}</h3>
      <div class="bande">${e && e.photo
        ? `<img src="${echap(e.photo)}" loading="lazy" alt="">` : ''}</div>
    </section>`;
  }).join('');

  for (const id of choisies) {
    const urls = await photosTerrain(id);
    const hote = cible.querySelector(`[data-esp="${id}"] .bande`);
    if (!hote || !urls.length) continue;
    hote.innerHTML = urls.map(u =>
      `<img src="${echap(u)}" loading="lazy" alt="">`).join('');
  }
}


/* ============================================================
   Déclaration des onglets
   ============================================================ */

module({
  id: 'manquants',
  tot: true,
  pret: () => !!perso,
  dessiner: dessinerManquants,
  vider(carton) { perso = null; cochePage = 0; $('#v-manquants').innerHTML = carton; },
  manque: () => !perso,
  /* La liste personnelle se charge en premier : sans elle, aucune des quatre vues n'a de
     contenu. Deux requêtes le plus souvent, quelques-unes pour une longue liste. */
  async fond(gen) {
    await chargerPerso(gen);
    /* L'arbre a été bâti avant que la liste n'arrive, donc sur l'inventaire entier. Une fois
       la soustraction possible, il doit être refait : sinon ses décomptes annonceraient des
       espèces déjà cochées. */
    construireArbre();
    dessiner();

    /* Les effectifs mondiaux ensuite : ils débloquent le tri par responsabilité, qui répond
       à « laquelle de ces espèces manquantes ne verrai-je nulle part ailleurs ». Une requête
       par paquet de deux cents espèces, donc quelques-unes, et la vue est déjà utilisable. */
    await chargerEffectifsMondiaux();
    /* chargerEffectifsMondiaux remplit e.nm par niveau de validation ; c'est appliquerQualite
       qui en tire e.nMonde. Sans cet appel, toutes les responsabilités valaient zéro : le tri
       ne changeait rien et la carte pondérée s'affichait vide, sans rien signaler. */
    appliquerQualite();
    dessiner();
  }
});

module({
  id: 'carte',
  pret: () => !!grille,
  /* Pas de « dessiner » dans la séquence de chargement : la collecte coûte une vingtaine de
     requêtes et attend une demande explicite. La vue se peint à l'ouverture de l'onglet. */
  ouvrir() { assurerGrille(); },
  vider(carton) {
    grille = null; grillePts = null; grillePtsMois = 0; grilleCellule = null;
    choisies = []; pointsEspece = new Map();
    grilleReleveePour = null; grilleEchec = null; vueOu = null;
    if (carteOu) carteOu.remove();
    carteOu = null; coucheOu = null;
    $('#v-carte').innerHTML = carton;
  },
  /* Le bouton d'arrêt général coupe la collecte : on retient la clé pour que rouvrir
     l'onglet ne la relance pas aussitôt. */
  arreter() { if (grilleEnCours) grilleEchec = cleGrille(); grilleEnCours = false; }
});

module({
  id: 'quand',
  pret: () => !!(perso && etat.phenologie),
  dessiner: dessinerQuand,
  vider(carton) { $('#v-quand').innerHTML = carton; },
  /* La fenêtre compte autant que les mois : sans elle le bouton « Maintenant » reste éteint,
     ce qui arrivait sur tout inventaire repris de la mémoire. */
  manque: () => !etat.phenologie || !fenetreRelevee(),
  /* Les effectifs mensuels : douze requêtes, qui servent à la fois à cette vue et au filtre
     de période de la planche. */
  async fond() {
    await chargerMensuel();
    dessiner();
    /* La fenêtre glissante ensuite, une requête : elle n'est pas nécessaire au graphe, mais
       elle est le choix le plus souvent voulu. */
    await chargerFenetre();
    dessinerQuand();
  }
});

module({
  id: 'terrain',
  ouvrir: dessinerTerrain,
  /* La veille de position s'arrête en quittant l'onglet : elle consomme le GPS. */
  arreter: arreterVeille,
  vider(carton) {
    carteT = null; coucheT = null; coucheMoi = null; coucheLimT = null;
    vueT = null; maPosition = null; photosCache.clear();
    arreterVeille();
    $('#v-terrain').innerHTML = carton;
  }
});

module({
  id: 'classement',
  pret: () => !!classement,
  /* Une requête, mais l'onglet n'est pas toujours ouvert : elle attend le bouton. */
  ouvrir() { dessinerClassement(); enTache(lancerClassement); },
  vider(carton) { classement = null; $('#v-classement').innerHTML = carton; },
  arreter() { classementEnCours = false; }
});

module({
  id: 'couverture',
  pret: () => !!perso,
  dessiner: dessinerCouverture,
  vider(carton) {
    couvDeplies = new Set(); couvSel = null; couvRacine = null;
    $('#v-couverture').innerHTML = carton;
  }
});


/* ============================================================
   Démarrage
   ============================================================ */

demarrer();
