/* ============================================================
   Cequivitici · Exploration
   Les onglets du site.
   ============================================================ */

/* ============================================================
   5. Onglet Liste
   ============================================================ */

function especesVisibles() {
  let liste = etat.especes.filter(e => e.nZone > 0);
  if (vue.noeud) liste = liste.filter(e => e.anc.includes(vue.noeud));
  if (vue.mois) {
    const m = (etat.moisCache.get(etat.qualite + ':' + vue.mois) || {}).parId;
    if (m) liste = liste.filter(e => m.has(e.id)).map(e => ({ ...e, nAffiche:m.get(e.id) }));
  }
  if (vue.intro !== 'tout') {
    liste = liste.filter(e => estIntroduite(e.id) === (vue.intro === 'seul'));
  }
  if (vue.texte) liste = liste.filter(correspondRecherche);
  if (vue.tri === 'nom') return [...liste].sort((a, b) => a.nom.localeCompare(b.nom, langue));
  if (vue.tri === 'resp') {
    // Les espèces sous le seuil d'effectif passent en fin de liste plutôt que d'en sortir.
    const p = e => (e.nMonde >= Math.max(seuilMin, 1)) ? e.nZone / e.nMonde : -1;
    return [...liste].sort((a, b) => p(b) - p(a));
  }
  return [...liste].sort((a, b) => (b.nAffiche ?? b.nZone) - (a.nAffiche ?? a.nZone));
}

function dessinerListe() {
  const v = $('#v-liste');
  const defil = v.querySelector('.arbre') ? v.querySelector('.arbre').scrollTop : 0;
  if (!etat.especes.length) {
    v.innerHTML = `<div class="vide"><strong>${t('aucuneEsp')}</strong>${t('essaieAutre')}</div>`;
    return;
  }
  const liste = especesVisibles();
  const racines = ordonnerBranches([...etat.arbre.enfants.values()]);

  const avert = etat.tronque
    ? `<div class="alerte">${t('tronque', nb(etat.especes.length))}</div>` : '';

  v.innerHTML = avert + bandeauChiffres() + `
    <div class="outils">
      <input type="text" id="f-texte" placeholder="${echap(t('phRech'))}" value="${echap(vue.texte)}">
      <select id="f-tri">
        <option value="obs"${vue.tri==='obs'?' selected':''}>${t('triObs')}</option>
        <option value="resp"${vue.tri==='resp'?' selected':''}>${t('triResp')}</option>
        <option value="nom"${vue.tri==='nom'?' selected':''}>${t('triNom')}</option>
      </select>
      <select id="f-intro">
        <option value="tout"${vue.intro==='tout'?' selected':''}>${t('filtreIntroTout')}</option>
        <option value="sans"${vue.intro==='sans'?' selected':''}>${t('filtreIntroSans')}</option>
        <option value="seul"${vue.intro==='seul'?' selected':''}>${t('filtreIntroSeul')}</option>
      </select>
      ${selectPeriode('f-mois', vue.mois, !!etat.phenologie)}
      <span class="compte">${nb(liste.length)} ${t('especes')}${
        vue.mois ? ' · ' + nomPeriode(vue.mois) : ''}</span>
    </div>
    <div class="expl">
      <aside class="arbre">
        <div class="entete">${t('taxonomie')}</div>
        <div class="n-ligne${vue.noeud === null ? ' sel' : ''}">
          <button class="n-plier creux"></button>
          <button class="n-nom${infoNoeud(etat.arbre).latin ? ' lat' : ''}" data-noeud="">${etat.arbre.id
            ? echap(infoNoeud(etat.arbre).nom) + '<span class="n-rang">' + t('tout') + '</span>'
            : t('toutesEsp')}</button>
          <span class="n-nb">${nb(etat.arbre.n)}</span>
        </div>
        ${racines.map(r => brancheHTML(r, 0)).join('')}
      </aside>
      <div>
        ${liste.length ? `<div class="planche">${liste.slice(0, 400).map((e, i) => ficheHTML(e, i)).join('')}</div>`
          : `<div class="vide"><strong>${t('rienIci')}</strong>${t('changeBranche')}</div>`}
        ${liste.length > 400 ? `<p class="note">${t('limiteFiches', nb(liste.length))}</p>` : ''}
      </div>
    </div>`;

  brancherListe();
  const panneau = v.querySelector('.arbre');
  if (panneau) panneau.scrollTop = defil;
}

/* Sur petit écran, la vignette carrée d'iNaturalist suffit largement : environ dix fois
   moins d'octets que la version moyenne, pour une case de cent pixels de côté. */

/* Sur téléphone la grille fait trois colonnes, soit des vignettes d'environ 120 pixels — mais
   deux à trois fois plus en pixels réels sur un écran dense. La miniature carrée d'iNaturalist,
   qui en fait 75, y paraît floue : on demande la variante « small », quatre fois plus définie
   et toujours bien plus légère que la moyenne. */
/* Une espèce n'est tenue pour introduite que si la fiche vient d'un territoire identifié.
   Le repli sur l'ancienne liste ne joue que si aucun statut n'a été transmis avec l'espèce. */


function ficheHTML(e, i) {
  const n = e.nAffiche ?? e.nZone;
  const img = vignette(e);
  const credit = e.credit;
  /* Trois destinations distinctes : la photo mène à la fiche du taxon, l'effectif aux
     observations locales sur la carte d'iNaturalist, et le bouton déplie la lignée sans
     quitter le site. La fiche n'est donc plus un lien unique mais un conteneur. */
  return `
    <div class="fiche">
      <a class="img" href="https://www.inaturalist.org/taxa/${e.id}" target="_blank" rel="noopener">
        ${img ? `<img src="${img}" loading="lazy" decoding="async" alt="">` : ''}
        <span class="num">${String(i + 1).padStart(3, '0')}</span>
        ${e.iucn ? `<span class="statut">${pastilleIUCN(e.iucn)}</span>` : ''}
      </a>
      ${pastilleIntro(e.id, true)}
      <div class="corps">
        ${blocNoms(e.nom, e.nomFr)}
        <div class="bas">
          <a class="n" href="${lienINat(e.id, vue.mois, 'map')}" target="_blank" rel="noopener"
            >${vue.tri === 'resp' && e.nMonde >= Math.max(seuilMin, 1)
            ? pourcent((e.nZone / e.nMonde) * 100)
            : nb(n) + ' ' + t('obs') + (e.nAffiche !== undefined ? ' · ' + t('ceMois') : '')}</a>
          <button class="plus" data-lignage="${e.id}" aria-label="${echap(t('taxonomie'))}">☰</button>
        </div>
      </div>
      <div class="credit">${echap(credit)}</div>
      <div class="taxo">${lignageHTML(e)}</div>
    </div>`;
}

function brancherListe() {
  $('#f-texte').addEventListener('input', e => {
    const pos = e.target.selectionStart;
    vue.texte = e.target.value;
    reconstruireArbre();      // la taxonomie suit la recherche
    dessinerListe();
    const n = $('#f-texte'); n.focus(); n.setSelectionRange(pos, pos);
  });
  $('#f-tri').addEventListener('change', e => { vue.tri = e.target.value; dessinerListe(); });

  $('#f-mois').addEventListener('change', async e => {
    const p = +e.target.value;
    if (!periodeEnMemoire(p)) {
      progression(t(p === FENETRE ? 'mFenetre' : 'mFiltreMois', nomPeriode(p)), 40);
      await chargerPeriode(p);
      progression(t('mFiltreApp', nomPeriode(p)), null);
    }
    vue.mois = p;
    const d = etat.moisCache.get(etat.qualite + ':' + p);
    if (d && d.indispo) { vue.mois = 0; progression(t('pFenetreIndispo'), null); }
    reconstruireArbre();      // l'arbre ne montre que les branches encore peuplées
    dessinerListe();
  });

  brancherLignage('#v-liste');
  const fi = $('#f-intro');
  if (fi) fi.addEventListener('change', e => {
    vue.intro = e.target.value;
    reconstruireArbre();
    dessinerListe();
  });

  $('#v-liste').querySelectorAll('.taxo').forEach(el => {
    el.addEventListener('click', () => el.closest('.fiche').classList.remove('ouvert'));
  });

  brancherArbre('#v-liste', dessinerListe);
}



/* Mise en forme d'une distance, pour les cartes des communautés. */
function formatDistance(km) {
  return km >= 1 ? km.toLocaleString(langue, { maximumFractionDigits:1 }) + ' km'
                 : Math.round(km * 1000) + ' m';
}


/* ============================================================
   Onglet Responsabilité
   ============================================================ */

/* La responsabilité compare des parts d'observations entre taxons : une détermination
   arrêtée au genre, qui agrège en réalité plusieurs espèces, fausserait la comparaison.
   Ce tableau ne retient donc que le rang espèce et en dessous. La liste, elle, garde tout :
   « Carabus sp. » reste une information de terrain légitime. */
const RANGS_ESPECE = new Set(['species', 'subspecies', 'variety', 'form', 'hybrid']);

let seuilMin = 1, filtreRouge = false;
let triResp = { col:'part', sens:-1 };
const RESP_PAR_PAGE = 12;
const PIC_PAR_PAGE = 12;
let picPage = 0;
let respPage = 0;   // -1 = décroissant

const COLONNES = {
  nom:  { titre:t('colEspece'), val:l => nomCourt(l.nom, l.nomFr).toLowerCase(), texte:true },
  iucn: { titre:t('colRouge'),  val:l => l.iucn || 0 },
  zone: { titre:t('colIci'),    val:l => l.nZone },
  ref:  { titre:null,           val:l => l.nMonde },
  part: { titre:t('colPart'),   val:l => l.part }
};

/* Choix du territoire de comparaison. Le changer suppose de refaire les comptages
   de référence, d'où le rechargement explicite. */
autocompletion('#r-ref', '#r-ref-liste', '/places/autocomplete',
  p => ({ id:p.id, nom:p.display_name, detail:p.place_type_name || 'lieu' }),
  async p => {
    etat.reference = p;
    $('#r-ref').value = p.nom;
    majBoutonRef();
    await enTache(recalculerReference);
  }, true);

$('#r-ref').addEventListener('input', async e => {
  if (e.target.value.trim() === '' && etat.reference) {
    etat.reference = null;
    await enTache(recalculerReference);
  }
});

$('#r-vider').addEventListener('click', async () => {
  if (!etat.reference) return;
  etat.reference = null;
  $('#r-ref').value = '';
  majBoutonRef();
  majURL();
  await enTache(recalculerReference);
});

/* Le bouton n'apparaît que lorsqu'un territoire est effectivement choisi. */
function majBoutonRef() {
  const b = $('#r-vider');
  if (b) b.hidden = !etat.reference;
}

async function recalculerReference() {
  majBoutonRef();
  if (!etat.especes.length) return;
  const gen = ++generation;
  $('#r-tableau').innerHTML = `<div class="vide"><strong>${t('recomptage')}</strong>${
    t('recomptageSur', etat.reference ? echap(etat.reference.nom) : t('mondeEntier'))}</div>`;
  try {
    etat.especes.forEach(e => { e.nMonde = null; });
    await chargerEffectifsMondiaux();
    verifier(gen);
    progression(t('mReference', etat.reference ? etat.reference.nom : t('mondeEntier')), null);
    majURL(); enregistrer();
  } catch (e) {
    if (e instanceof Annule) return;
    progression(t('mRecompteEchec'), null);
  }
  dessinerResponsabilite();
}

function dessinerResponsabilite() {
  const v = $('#r-tableau');
  if (!etat.especes.length) return;
  if (etat.especes[0].nMonde === null) {
    v.innerHTML = `<div class="vide"><strong>${t('calculCours')}</strong>${t('effectifsCharg')}</div>`;
    return;
  }

  const nomRef = etat.reference ? etat.reference.nom : t('monde');
  const c = COLONNES[triResp.col] || COLONNES.part;
  let lignes = etat.especes
    .filter(e => RANGS_ESPECE.has(e.rang))
    .filter(e => e.nZone > 0 && e.nMonde >= Math.max(seuilMin, 1))
    .map(e => ({ ...e, part:e.nZone / e.nMonde }))
    .sort((a, b) => {
      // Les effectifs de référence incohérents ferment la marche, quel que soit le tri.
      if (!!a.douteux !== !!b.douteux) return a.douteux ? 1 : -1;
      const x = c.val(a), y = c.val(b);
      const d = c.texte ? String(x).localeCompare(String(y), langue) : x - y;
      // À valeur égale sur la colonne choisie, la part départage : c'est le sujet du tableau.
      if (d !== 0) return d * triResp.sens;
      return b.part - a.part;
    });

  const menacees = lignes.filter(l => l.iucn >= 30).length;
  if (filtreRouge) lignes = lignes.filter(l => l.iucn >= 30);

  const exclusives = lignes.filter(l => l.nZone === l.nMonde).length;
  const deborde = lignes.some(l => l.part > 1.02);

  const ecartees = etat.especes.filter(e => RANGS_ESPECE.has(e.rang)
    && e.nZone > 0 && e.nMonde > 0 && e.nMonde < seuilMin).length;
  $('#r-compte').textContent = nb(lignes.length) + ' ' + t('especes')
    + (ecartees ? ' · ' + nb(ecartees) + ' ' + t('sousSeuil') : '')
    + ' · ' + nb(menacees) + ' ' + t('menacees') + ' · ' + nb(exclusives) + ' ' + t('exclusives');

  v.innerHTML = `
    ${deborde ? `<div class="alerte">${t('debordeRef', echap(nomRef))}</div>` : ''}
    <table>
      <thead><tr>${Object.entries(COLONNES).map(([k, col]) => {
        const fleche = triResp.col === k ? `<span class="fleche">${triResp.sens < 0 ? '↓' : '↑'}</span>` : '';
        return `<th data-col="${k}"${k === 'part' ? ' style="width:30%"' : ''}>${
          echap(col.titre || nomRef)} ${fleche}</th>`;
      }).join('')}</tr></thead>
      <tbody>${lignes.slice(respPage * RESP_PAR_PAGE, (respPage + 1) * RESP_PAR_PAGE).map(l => {
        const pct = l.part * 100;
        const p = palier(pct);
        return `
        <tr>
          <td class="esp"${l.douteux ? ' title="' + echap(t('respDouteux')) + '"' : ''}
            ><a href="${lienTaxon(l.id, false)}" target="_blank" rel="noopener">
            ${blocNoms(l.nom, l.nomFr)}</a></td>
          <td>${pastilleIUCN(l.iucn)}</td>
          <td class="num"><a href="${lienPortee(l.id, 'zone')}"
            target="_blank" rel="noopener">${nb(l.nZone)}</a></td>
          <td class="num"><a href="${lienPortee(l.id, 'reference')}"
            target="_blank" rel="noopener">${l.douteux ? '?' : nb(l.nMonde)}</a></td>
          <td><div class="mesure" title="${p.nom}">
              <div class="rail"><i style="width:${largeurLog(pct).toFixed(1)}%;
                background:${p.couleur}"></i></div>
              <span class="val">${pourcent(pct)}</span>
              ${l.nZone === l.nMonde ? '<span class="tag excl">' + t('exclusive') + '</span>' : ''}</div></td>
        </tr>`; }).join('')}</tbody>
    </table>
    <div class="niveaux">${Object.keys(IUCN).sort((a, b) => b - a)
      .map(code => `<span>${pastilleIUCN(+code)} ${echap(IUCN[code].n)}</span>`).join('')}</div>
    <p class="note">${t('noteFloutage')}</p>`;


  const pages = Math.ceil(lignes.length / RESP_PAR_PAGE);
  if (pages > 1) {
    v.insertAdjacentHTML('beforeend', `<div class="outils" style="margin-top:16px">
      <button class="discret" id="r-prec"${respPage === 0 ? ' disabled' : ''}>‹</button>
      <span class="compte" style="margin-left:0">${respPage + 1} / ${nb(pages)}</span>
      <button class="discret" id="r-suiv"${respPage + 1 >= pages ? ' disabled' : ''}>›</button>
    </div>`);
    $('#r-prec').addEventListener('click', () => { respPage--; dessinerResponsabilite(); });
    $('#r-suiv').addEventListener('click', () => { respPage++; dessinerResponsabilite(); });
  }

  v.querySelectorAll('th[data-col]').forEach(th => {
    th.addEventListener('click', () => {
      const k = th.dataset.col;
      // Même colonne : on inverse. Nouvelle colonne : décroissant, sauf pour les noms.
      if (triResp.col === k) triResp.sens = -triResp.sens;
      else triResp = { col:k, sens: k === 'nom' ? 1 : -1 };
      respPage = 0;
      dessinerResponsabilite();
    });
  });
}

$('#f-seuil').addEventListener('change', e => { seuilMin = +e.target.value; dessinerResponsabilite(); });
$('#f-rouge').addEventListener('change', e => { filtreRouge = e.target.value === '1'; dessinerResponsabilite(); });

/* ============================================================
   8. Onglet Statistiques
   ============================================================ */

/* Chao1 : n'utilise que les espèces vues une et deux fois (version corrigée du biais). */
/* Les deux estimateurs travaillent sur une simple liste d'effectifs : celle de l'inventaire
   entier, ou celle d'un seul mois tirée de la phénologie. */
function chao1(c = etat.especes.map(e => e.nZone).filter(n => n > 0)) {
  const f1 = c.filter(x => x === 1).length, f2 = c.filter(x => x === 2).length;
  return { s:c.length, f1, f2, est:Math.round(c.length + (f1*(f1-1))/(2*(f2+1))), fiable:f2 >= 5 };
}

/* ACE : exploite toutes les espèces vues dix fois ou moins, donc plus stable. */
function ace(c = etat.especes.map(e => e.nZone).filter(n => n > 0)) {
  const rares = c.filter(x => x <= 10), abondantes = c.length - rares.length;
  const nRares = rares.reduce((a, b) => a + b, 0);
  const F = {}; rares.forEach(x => F[x] = (F[x] || 0) + 1);
  const f1 = F[1] || 0, sRares = rares.length;
  const C = nRares > 0 ? 1 - f1 / nRares : 0;
  if (C <= 0 || nRares < 2) return null;
  let somme = 0; for (let i = 1; i <= 10; i++) somme += i * (i - 1) * (F[i] || 0);
  const g2 = Math.max((sRares / C) * somme / (nRares * (nRares - 1)) - 1, 0);
  return Math.round(abondantes + sRares / C + (f1 / C) * g2);
}

/* Quatre chiffres seulement, en tête de la liste : ce qui est connu, ce qui a été fait pour
   le connaître, et ce qui reste probablement à trouver. */
function bandeauChiffres() {
  if (!etat.especes.length) return '';
  const c1 = chao1(), a = ace();
  // Quand les deux estimateurs s'écartent nettement, c'est l'écart qui compte, pas les chiffres.
  const ecart = (c1.fiable && a) ? Math.abs(a - c1.est) / c1.est : 0;
  const divergent = ecart > 0.15;
  const marque = divergent
    ? ` · <span class="divergent" title="${echap(t('aideDivergent'))}">${t('divergent')}</span>` : '';
  const totalObs = (etat.annees || []).reduce((x, l) => x + l.obs, 0);
  const obsPers = (etat.seriesCache[etat.qualite] || {}).observateurs || 0;
  const debut = (etat.annees || []).length ? etat.annees[0].annee : null;
  return `
    <div class="chiffres">
      <div class="chiffre"><div class="k">${t('espConnues')}</div><div class="v">${nb(c1.s)}</div>
        <div class="d">${t('auMoinsUne')}</div></div>
      <div class="chiffre"><div class="k">${t('observations')}</div>
        <div class="v">${totalObs ? nb(totalObs) : '…'}</div>
        <div class="d">${debut ? t('depuis', debut) : ''}</div></div>
      <div class="chiffre">
        <div class="k">${t('observateurs')}</div>
        <div class="v">${obsPers ? nb(obsPers) : '…'}</div>
        <div class="d">${obsPers && totalObs
          ? t('obsParPers', nb(Math.round(totalObs / obsPers))) : ''}</div></div>
      <div class="chiffre aide" title="${echap(t('aideEstim'))}">
        <div class="k">${t('espEstimees')}</div>
        <div class="v">${c1.fiable || a
          ? '≈ ' + nb(Math.min(...[c1.fiable ? c1.est : null, a].filter(Boolean)))
            + (c1.fiable && a && Math.abs(a - c1.est) > 1
               ? '–' + nb(Math.max(c1.est, a)) : '')
          : '…'}</div>
        <div class="d">${c1.fiable || a
          ? t('completude', Math.round((c1.s / Math.max(...[c1.fiable ? c1.est : null, a]
              .filter(Boolean))) * 100)) + marque
          : t('nonCalculable')}</div></div>
    </div>`;
}





/* ============================================================
   Disparitions : les espèces bien connues qui ne sont plus revues
   ============================================================ */

/* Le miroir des découvertes, et il partage sa première requête : la liste des espèces vues
   pendant les cinq dernières années. Les découvertes en retranchent le passé, les disparitions
   la retranchent du présent. L'appel étant identique, il est servi par le cache — cet onglet
   ne coûte donc que la datation de ce qu'il affiche.
   Le seuil de cinq signalements est essentiel : sans lui la liste se remplirait d'espèces vues
   une seule fois il y a dix ans, dont l'absence ne veut rien dire. */
let disparitions = null, disEnCours = false;
let disRouge = false;       // n'afficher que les espèces menacées
let disMin = 1;              // signalements minimum ; à 1, rien n'est écarté
let disMois = 24;            // durée d'absence effectivement retenue
const DIS_PAR_PAGE = 12;     // fiches par page
const DIS_PLAFOND = 96;      // datation maximale : chaque espèce coûte une requête
let disPage = 0;
const DIS_FENETRES = [24, 36, 60, 120];   // mois d'absence exigés, du plus court au plus long

/* Temps écoulé depuis la dernière observation, en années et mois. */
/* Durée en toutes lettres, à partir d'un nombre de mois. */
function dureeTexte(mois) {
  const ans = Math.floor(mois / 12), reste = mois % 12, bouts = [];
  if (ans) bouts.push(ans + ' ' + t(ans > 1 ? 'uniteAns' : 'uniteAn'));
  if (reste || !ans) bouts.push(reste + ' ' + t(reste > 1 ? 'uniteMoisP' : 'uniteMois'));
  return bouts.join(' ');
}

function depuisQuand(date) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const n = new Date();
  let mois = (n.getFullYear() - d.getFullYear()) * 12 + (n.getMonth() - d.getMonth());
  if (n.getDate() < d.getDate()) mois--;
  if (mois < 0) mois = 0;
  const ans = Math.floor(mois / 12), reste = mois % 12;
  const bouts = [];
  if (ans) bouts.push(ans + ' ' + t(ans > 1 ? 'uniteAns' : 'uniteAn'));
  if (reste || !ans) bouts.push(reste + ' ' + t(reste > 1 ? 'uniteMoisP' : 'uniteMois'));
  return bouts.join(' ');
}

async function chargerDisparitions() {
  if (disEnCours || !etat.especes.length) return;
  disEnCours = true;
  const gen = generation;
  const f = filtres();

  /* Les espèces vues pendant une période donnée. Celle de cinq ans est déjà en cache,
     puisque les découvertes l'ont demandée. */
  async function vuesDepuis(mois) {
    const vues = new Set();
    // Jusqu'à épuisement : une liste tronquée ferait passer pour absentes des espèces vues hier.
    for (let page = 1; page <= 20; page++) {
      const d = await comptages({ ...f, d1:jour(ilYa(mois)), per_page:500, page },
        !(await testerMoisV2(f)));
      verifier(gen);
      d.results.forEach(r => vues.add(r.taxon.id));
      if (d.results.length < 500) break;
    }
    return vues;
  }

  try {
    dessinerDisparitions();
    progression(t('disCharge'), 15);

    /* On allonge l'absence exigée par paliers, jusqu'à obtenir une liste assez courte pour
       être datée en entier. Exiger plus longtemps réduit le nombre de candidates et renforce
       le signal : une espèce muette depuis cinq ans dit plus qu'une espèce muette depuis deux.
       La liste correspond ainsi exactement à une durée, celle qui est annoncée. */
    /* Chaque palier isole une tranche d'absence : plus de dix ans, puis de cinq à dix, et
       ainsi de suite. On les empile de la plus longue à la plus courte, ce qui classe les
       espèces par durée d'absence sans avoir daté quoi que ce soit. */
    const tranches = [];
    let limite = null;
    for (const mois of DIS_FENETRES) {
      progression(t('disCharge'), 10 + (DIS_FENETRES.indexOf(mois) / DIS_FENETRES.length) * 50);
      const vues = await vuesDepuis(mois);
      verifier(gen);
      tranches.push({ mois, absentes: etat.especes.filter(e => e.nZone >= disMin && !vues.has(e.id)) });
      if (limite === null) { limite = jour(ilYa(mois)); disMois = mois; }
    }

    const vus = new Set();
    let candidates = [];
    for (const tr of [...tranches].reverse()) {          // la plus longue absence d'abord
      const nouveaux = tr.absentes.filter(e => !vus.has(e.id));
      nouveaux.forEach(e => vus.add(e.id));
      candidates = candidates.concat(nouveaux.sort((a, b) => b.nZone - a.nZone));
      if (candidates.length >= DIS_PLAFOND) break;
    }
    candidates = candidates.slice(0, DIS_PLAFOND);

    if (!candidates.length) {
      disparitions = [];
      progression(t('mComplet'), null);
      return;                       // le rendu final a lieu dans le bloc « finally »
    }

    const liste = [];
    for (let i = 0; i < candidates.length; i++) {
      progression(t('disCharge'), 30 + (i / candidates.length) * 65);
      /* La requête est bornée par d2 : elle ne peut renvoyer qu'une observation antérieure à
         la limite, quel que soit le tri appliqué par le serveur. Se fier au seul order_by
         laissait passer des espèces revues récemment quand le tri n'était pas honoré. */
      const o = await premiereObs({ ...f, taxon_id:candidates[i].id, d2:limite }, 'desc');
      verifier(gen);
      if (o && o.date && o.date <= limite) liste.push({ e:candidates[i], obs:o.obs, date:o.date });
      else if (o) console.warn('Disparitions : date inattendue écartée', candidates[i].nom, o.date);
    }
    liste.sort((a, b) => String(a.date).localeCompare(String(b.date)));

    disparitions = liste; disPage = 0;
    progression(t('mComplet'), null);
  } catch (e) {
    if (!(e instanceof Annule)) progression(t('mEchec', String(e.message || e)), null);
  } finally {
    // L'état doit être à jour avant le dernier rendu, sinon l'écran reste sur « recherche… ».
    disEnCours = false;
    dessinerDisparitions();
  }
}

function dessinerDisparitions() {
  const v = $('#v-disparition');
  if (!etat.especes.length) return;
  if (!disparitions && !disEnCours) {
    v.innerHTML = `<div class="outils">
        <button class="primaire" id="dis-lancer">${t('lancerRecherche')}</button>
        <span class="compte">${t('coutRequetes', 25)}</span>
      </div>
      <div class="vide">${t('videDisparition')}</div>
      <p class="note">${t('disNote')}</p>`;
    $('#dis-lancer').addEventListener('click', () => enTache(chargerDisparitions));
    return;
  }
  const toutes = disparitions || [];
  // Vulnérable, en danger, en danger critique, éteinte à l'état sauvage ou éteinte.
  const liste = disRouge ? toutes.filter(x => x.e.iucn >= 30) : toutes;

  v.innerHTML = `
    <div class="outils">
      ${toutes.some(x => x.e.iucn >= 30) ? `<select id="d-rouge">
        <option value=""${disRouge ? '' : ' selected'}>${t('disFiltreTout')}</option>
        <option value="1"${disRouge ? ' selected' : ''}>${t('disFiltreRouge')}</option>
      </select>` : ''}
      <select id="d-seuil">${[1, 2, 5, 10, 20].map(v =>
        `<option value="${v}"${v === disMin ? ' selected' : ''}>${t('seuilObs', v)}</option>`).join('')}</select>
      <span class="compte">${liste.length ? t('disNb', nb(liste.length))
        : (disEnCours ? t('disCharge') : '')}</span>
    </div>
    ${liste.length ? `<div class="planche">${liste.slice(disPage * DIS_PAR_PAGE,
      (disPage + 1) * DIS_PAR_PAGE).map(x => `
      <div class="fiche" title="${t('disDerniere')} ${echap(x.date)}"
         ${IUCN[x.e.iucn] ? `style="border-color:${IUCN[x.e.iucn].bg};
           box-shadow:inset 0 0 0 1px ${IUCN[x.e.iucn].bg}"` : ''}>
        ${pastilleIntro(x.e.id)}
        <a class="img" href="https://www.inaturalist.org/observations/${x.obs}"
           target="_blank" rel="noopener">${x.e.photo
          ? `<img src="${vignette(x.e)}" loading="lazy" decoding="async" alt="">`
          : ''}<span class="num">${depuisQuand(x.date)}</span>
          ${x.e.iucn ? `<span class="statut">${pastilleIUCN(x.e.iucn)}</span>` : ''}</a>
        <div class="corps">${blocNoms(x.e.nom, x.e.nomFr)}
          <div class="date">${nb(x.e.nZone)} ${t('obs')}</div></div>
      </div>`).join('')}</div>`
      : `<div class="vide">${disEnCours ? t('disCharge') : t('disVide')}</div>`}
    ${liste.length > DIS_PAR_PAGE ? `<div class="outils" style="margin-top:16px">
      <button class="discret" id="d-prec"${disPage === 0 ? ' disabled' : ''}>‹</button>
      <span class="compte" style="margin-left:0">${disPage + 1} / ${
        Math.ceil(liste.length / DIS_PAR_PAGE)}</span>
      <button class="discret" id="d-suiv"${(disPage + 1) * DIS_PAR_PAGE >= liste.length
        ? ' disabled' : ''}>›</button>
    </div>` : ''}
    <p class="note">${t('disNote')}</p>`;

  const dr = $('#d-rouge');
  if (dr) dr.addEventListener('change', e => {
    disRouge = !!e.target.value; disPage = 0; dessinerDisparitions();
  });
  const prec = $('#d-prec'), suiv = $('#d-suiv');
  if (prec) prec.addEventListener('click', () => { disPage--; dessinerDisparitions(); });
  if (suiv) suiv.addEventListener('click', () => { disPage++; dessinerDisparitions(); });

  const sel = $('#d-seuil');
  if (sel) sel.addEventListener('change', e => {
    disMin = +e.target.value;
    disparitions = null; disPage = 0;
    enTache(chargerDisparitions);
  });
}


/* ============================================================
   Biorégions : regroupement des cellules par composition
   ============================================================ */

/* Analyse exploratoire, lancée à la demande car elle coûte une cinquantaine de requêtes.
   Le principe est celui de la biorégionalisation : découper l'espace, décrire chaque cellule
   par la composition de sa faune ou de sa flore, puis regrouper les cellules semblables.

   Le point délicat est la collecte. Interroger mille cellules ferait mille requêtes ; on
   récupère donc les observations brutes avec leurs coordonnées, deux cents par appel, et la
   grille est construite dans le navigateur. Tout le calcul qui suit est local. */

let bio = null, bioEnCours = false, bioTente = false;
let bioMax = 5000;           // plafond d'observations collectées : rapide, moyen ou fin
const BIO_PAR_APPEL = 200;   // maximum autorisé par l'API
const BIO_MIN_OBS = 20;      // en deçà, la composition d'une cellule n'est que du bruit
const BIO_MIN_CELL = 3;      // une espèce vue dans moins de cellules n'informe pas
const BIO_MAX_PART = 0.8;    // au-delà, l'espèce est partout et ne sépare plus rien
const BIO_AXES = 10;
let bioGroupes = null;       // fixé par la méthode du coude, puis par la glissière

/* Périmètre taxonomique de la collecte. Restreindre aux espèces les plus fréquentes densifie
   les cellules — on cesse de dépenser des requêtes sur la longue traîne, qui n'entre pas dans
   l'analyse. Mais les espèces les plus observées sont souvent des généralistes présentes
   partout, qui ne discriminent rien : d'où la troisième option, qui écarte les deux
   extrémités et ne garde que la bande de fréquence moyenne, la plus séparatrice. */
/* Un seul périmètre de collecte : les espèces comptant au moins vingt observations dans la
   zone. C'est le socle commun aux deux analyses. Les biorégions y appliquent ensuite leurs
   propres exclusions — les ubiquistes n'y séparent rien —, tandis que les communautés
   travaillent sur l'ensemble, une espèce omniprésente ayant sa place dans un groupe. Un
   chargement unique sert donc aux deux, avec des filtres appliqués après coup. */
/* Seuil d'observations exigé d'une espèce pour entrer dans l'analyse. Il s'adapte à la zone :
   vingt observations garantissent une répartition fiable, mais dans un territoire peu
   prospecté presque aucune espèce ne les atteint — la collecte revient alors quasi vide et
   les cellules doivent fusionner à l'excès. On descend donc par paliers jusqu'à réunir assez
   d'espèces pour que l'analyse ait du sens. */
function seuilBio() {
  const eligibles = etat.especes;
  for (const seuil of [20, 12, 8]) {
    if (eligibles.filter(e => e.nZone >= seuil).length >= 250) return seuil;
  }
  return 8;
}

function taxonsBio() {
  /* Les espèces introduites ne sont plus écartées d'office. Le statut vient des listes
     d'établissement d'iNaturalist, renseignées par la communauté lieu par lieu, et il est
     souvent faux : des méditerranéennes strictement indigènes comme le chêne kermès ou le
     ciste cotonneux y figurent comme introduites, sans doute parce qu'un statut saisi pour
     un autre territoire remonte par héritage. Les exclure automatiquement retirait donc de
     l'analyse des espèces parfaitement caractéristiques du milieu — un tort bien plus grave
     que celui de garder quelques exotiques. */
  const seuil = seuilBio();
  const tries = etat.especes
    .filter(e => e.nZone >= seuil)
    .sort((a, b) => b.nZone - a.nZone);
  console.info('Biorégions : seuil de ' + seuil + ' obs. par espèce, '
    + tries.length + ' espèces retenues.');
  if (!tries.length) return null;
  let choix = tries;

  /* Les identifiants voyagent dans l'adresse de la requête, dont la longueur est bornée :
     au-delà de huit cents taxons on garde les mieux observés, ce qui ne change presque rien
     puisque la liste est déjà triée par effectif décroissant. */
  if (choix.length > 800) {
    console.info('Biorégions : ' + choix.length + ' espèces retenues, limitées aux 800 plus observées.');
    choix = choix.slice(0, 800);
  }
  return choix.length ? choix.map(e => e.id).join(',') : null;
}
/* Dix teintes distinctes, la glissière montant jusqu'à dix groupes. Au-delà de six, les
   couleurs deviennent difficiles à départager : c'est une limite de lecture, pas de calcul. */
/* Huit teintes pour les biorégions, quatre de plus pour les communautés, dont le nombre
   peut monter à douze. Au-delà, les couleurs cesseraient d'être distinguables. */
const BIO_TEINTES = ['#2F6B4F', '#C97E2B', '#3A63B8', '#7B3B52',
                     '#8CC63F', '#38A0A8', '#D81E05', '#6B4CA8',
                     '#A87C14', '#4E7A9B', '#B4553A', '#5E5E5E'];

/* Les observations collectées sont enregistrées à part, sous leur propre clé : elles pèsent
   plusieurs centaines de kilooctets et n'ont pas à alourdir l'inventaire, qui est relu à
   chaque chargement. Relancer l'analyse repart de cette réserve, sans un seul appel. */
/* Le mode sans filtre ne figure pas dans la clé : les observations déjà collectées servent
   dans les deux cas, seules les exclusions d'analyse changent. Il ne force donc pas de
   nouvelle collecte — seul le bouton « Recollecter » en déclenche une, si l'on veut aussi la
   longue traîne des espèces que le filtre écartait avant téléchargement. */
function cleBio() { return cleInventaire() + '|bio|' + bioMax; }

async function chargerBioregions(forcer = false) {
  if (bioEnCours || !etat.especes.length) return;
  bioEnCours = true; bioTente = true;
  const gen = generation;
  dessinerBioregions();

  try {
    if (!forcer) {
      const garde = await surBase('readonly', st => st.get(cleBio()));
      verifier(gen);
      if (garde && garde.pts && Date.now() - garde.date < PEREMPTION) {
        progression(t('bioCalcul'), 80);
        bio = analyserBio(garde.pts);
        if (bio) { bio.plafond = garde.plafond; bio.memoire = true; }
        progression(t('mComplet'), null);
        return;                       // le rendu final a lieu dans le bloc « finally »
      }
    }

    /* Coordonnées exactes seulement : les positions floutées des espèces sensibles sont
       déplacées de plusieurs dizaines de kilomètres et brouilleraient la grille. */
    /* Pas de paramètre « photos » : il ne sert pas à alléger la réponse mais à filtrer,
       et photos=false ne renvoie que les observations dépourvues de photo.

       La pagination par numéro de page bute sur dix mille résultats. On avance donc par
       curseur d'identifiant, ce qui n'a pas de plafond. Deux régimes en découlent : si la
       zone tient dans notre budget d'appels, on la parcourt entièrement ; sinon on prélève
       des tranches réparties sur toute la plage d'identifiants, ce qui donne un échantillon
       étalé dans le temps au lieu des seules observations récentes. */
    const f = { ...filtres(), geoprivacy:'open', taxon_geoprivacy:'open',
                order_by:'id', order:'asc', per_page:200 };
    const restreint = taxonsBio();
    if (restreint) f.taxon_id = restreint;

    const bornes = await appel('/observations', { ...f, per_page:1 }, false, true);
    verifier(gen);
    const total = bornes.total_results || 0;
    const premier = (bornes.results && bornes.results[0] && bornes.results[0].id) || 0;
    const finBrut = await appel('/observations',
      { ...f, order:'desc', per_page:1 }, false, true);
    verifier(gen);
    const dernier = (finBrut.results && finBrut.results[0] && finBrut.results[0].id) || premier;

    /* Contrairement aux comptages par espèce, cet endpoint renvoie le taxon le plus fin
       déterminé : une observation identifiée jusqu'à Beta vulgaris ssp. maritima arrive sous
       la sous-espèce. On la remonte à son espèce en cherchant, dans sa lignée, le premier
       ancêtre figurant à l'inventaire — lequel est déjà au rang espèce. Une observation
       arrêtée au genre n'y trouve rien et sort de l'analyse, ce qui est souhaitable :
       « Quercus sp. » ne caractérise aucun milieu. */
    const idsEspece = new Set(etat.especes
      .filter(e => e.rang === 'species' || e.rang === 'hybrid').map(e => e.id));
    const versEspece = tx => {
      if (idsEspece.has(tx.id)) return tx.id;
      const anc = tx.ancestor_ids || [];
      for (let i = anc.length - 1; i >= 0; i--) if (idsEspece.has(anc[i])) return anc[i];
      return null;
    };

    const vus = new Set();
    const pts = [];
    let horsRang = 0;
    const avaler = d => {
      for (const o of (d.results || [])) {
        if (vus.has(o.id)) continue;
        vus.add(o.id);
        const g = o.geojson && o.geojson.coordinates;
        if (!g || !o.taxon) continue;
        const esp = versEspece(o.taxon);
        if (esp === null) { horsRang++; continue; }
        pts.push({ x:g[0], y:g[1], t:esp });
      }
      return (d.results || []).length;
    };

    const pages = Math.ceil(bioMax / BIO_PAR_APPEL);
    const echantillon = total > bioMax;
    if (!echantillon) {
      // Recensement complet : le curseur suit le dernier identifiant reçu.
      let curseur = premier - 1;
      for (let k = 0; k < pages; k++) {
        progression(t('bioCharge', nb(pts.length)), (k / pages) * 70);
        const d = await appel('/observations', { ...f, id_above:curseur }, false, true);
        verifier(gen);
        const n = avaler(d);
        if (!n) break;
        curseur = d.results[d.results.length - 1].id;
      }
    } else {
      // Tranches régulières : une fenêtre de deux cents observations à chaque palier.
      const pas = Math.max(1, Math.floor((dernier - premier) / pages));
      for (let k = 0; k < pages; k++) {
        progression(t('bioCharge', nb(pts.length)), (k / pages) * 70);
        const d = await appel('/observations',
          { ...f, id_above: premier + k * pas - 1 }, false, true);
        verifier(gen);
        avaler(d);
      }
    }
    const plafond = echantillon;

    await surBase('readwrite', st => st.put({ cle:cleBio(), date:Date.now(), pts, plafond }));
    bioEnMemoire.add(bioMax);
    progression(t('bioCalcul'), 80);
    console.info('Biorégions : ' + pts.length + ' observations localisées collectées'
      + (horsRang ? ', ' + horsRang + ' écartées faute d\'être déterminées à l\'espèce' : '') + '.');
    bio = analyserBio(pts);
    if (!bio) console.info('Biorégions : découpage impossible — trop peu de cellules '
      + 'atteignent ' + BIO_MIN_OBS + ' observations, ou trop peu d\'espèces partagées.');
    if (bio) bio.plafond = plafond;
    progression(t('mComplet'), null);
  } catch (e) {
    if (!(e instanceof Annule)) progression(t('mEchec', String((e && e.message) || e)), null);
  } finally {
    bioEnCours = false;
    dessinerBioregions();
  }
}

/* Grille, matrice, composantes principales et regroupement : aucune requête. */
function analyserBio(pts) {
  if (pts.length < 200) return null;

  // Emprise réelle des observations.
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  const kmParDegLat = 111;
  const kmParDegLon = 111 * Math.cos((y0 + y1) / 2 * Math.PI / 180) || 1;

  /* Agrégation de proche en proche, en trois temps.

     On part d'une grille fine couvrant toute l'emprise. Les cases sans observation n'ont
     aucune composition : plutôt que de les laisser vides, on les rattache par propagation à
     la case observée la plus proche en nombre de pas — le rattachement reste donc contigu,
     jamais un saut par-dessus le vide. Chaque case observée devient ainsi une unité munie
     d'un territoire, et la carte est entièrement couverte.

     Ensuite seulement vient la fusion : tant qu'une unité n'atteint pas le seuil, elle rejoint
     sa voisine la plus pauvre. Les unités restent d'un seul tenant et carrées d'aspect, ce
     qu'aucun découpage récursif ne garantissait. */
  /* Cellules carrées valant un centième du plus grand côté de la zone. La résolution suit
     ainsi l'échelle de ce qu'on regarde — une commune se découpe en cellules de quelques
     centaines de mètres, un massif en cellules de quelques kilomètres — et la grille compte
     toujours le même ordre de grandeur de cases, quelle que soit l'étendue. */
  const grandCoteKm = Math.max((x1 - x0) * kmParDegLon, (y1 - y0) * kmParDegLat);
  /* Un deux-centième du plus grand côté : la grille de départ est quatre fois plus fine.
     Elle ne coûte presque rien — seules les cases occupées sont créées — mais laisse à
     l'agrégation une matière bien plus fine à assembler. */
  const cote = Math.max(grandCoteKm / 200, 0.02);
  const pasX = cote / kmParDegLon, pasY = cote / kmParDegLat;
  const ni = Math.ceil((x1 - x0) / pasX) + 1, nj = Math.ceil((y1 - y0) / pasY) + 1;
  const N = ni * nj;
  const idx = (i, j) => i * nj + j;

  const compteCase = new Int32Array(N);
  const espCase = new Map();
  for (const p of pts) {
    const i = Math.min(ni - 1, Math.floor((p.x - x0) / pasX));
    const j = Math.min(nj - 1, Math.floor((p.y - y0) / pasY));
    const k = idx(i, j);
    compteCase[k]++;
    let m = espCase.get(k);
    if (!m) { m = new Map(); espCase.set(k, m); }
    m.set(p.t, (m.get(p.t) || 0) + 1);
  }

  // Propagation en largeur depuis toutes les cases observées à la fois.
  const proprio = new Int32Array(N).fill(-1);
  let file = [];
  for (const k of espCase.keys()) { proprio[k] = k; file.push(k); }
  if (!file.length) return null;
  for (let tete = 0; tete < file.length; tete++) {
    const k = file[tete], i = Math.floor(k / nj), j = k % nj;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di, b = j + dj;
      if (a < 0 || b < 0 || a >= ni || b >= nj) continue;
      const v = idx(a, b);
      if (proprio[v] === -1) { proprio[v] = proprio[k]; file.push(v); }
    }
  }

  // Une unité par case observée, dotée du territoire qui lui a été rattaché.
  const rangUnite = new Map();
  const unites = [];
  for (const k of espCase.keys()) {
    rangUnite.set(k, unites.length);
    unites.push({ idx:unites.length, vive:true, n:compteCase[k],
                  esp:new Map(espCase.get(k)), cases:[] });
  }
  const uniteDe = new Int32Array(N);
  for (let k = 0; k < N; k++) {
    const u = rangUnite.get(proprio[k]);
    uniteDe[k] = u;
    unites[u].cases.push(k);
  }

  // Voisinages, tenus à jour au fil des fusions.
  const voisins = unites.map(() => new Set());
  for (let i = 0; i < ni; i++) for (let j = 0; j < nj; j++) {
    const u = uniteDe[idx(i, j)];
    for (const [di, dj] of [[1, 0], [0, 1]]) {
      const a = i + di, b = j + dj;
      if (a >= ni || b >= nj) continue;
      const v = uniteDe[idx(a, b)];
      if (v !== u) { voisins[u].add(v); voisins[v].add(u); }
    }
  }

  // Barycentre en coordonnées de grille, tenu à jour pour guider les fusions.
  for (const u of unites) {
    let si = 0, sj = 0;
    for (const k of u.cases) { si += Math.floor(k / nj); sj += k % nj; }
    u.ci = si / u.cases.length; u.cj = sj / u.cases.length;
  }

  const fusionner = (a, b) => {
    for (const [id, n] of b.esp) a.esp.set(id, (a.esp.get(id) || 0) + n);
    a.n += b.n;
    const na = a.cases.length, nbc = b.cases.length;
    a.ci = (a.ci * na + b.ci * nbc) / (na + nbc);
    a.cj = (a.cj * na + b.cj * nbc) / (na + nbc);
    for (const k of b.cases) { uniteDe[k] = a.idx; a.cases.push(k); }
    for (const v of voisins[b.idx]) {
      if (v === a.idx) continue;
      voisins[v].delete(b.idx); voisins[v].add(a.idx); voisins[a.idx].add(v);
    }
    voisins[a.idx].delete(b.idx);
    voisins[b.idx].clear();
    b.vive = false;
  };

  for (;;) {
    let cible = null;
    for (const u of unites) if (u.vive && u.n < BIO_MIN_OBS && (!cible || u.n < cible.n)) cible = u;
    if (!cible) break;
    /* On rejoint la voisine dont le barycentre est le plus proche, et non la plus pauvre :
       une unité s'agrège alors autour d'elle plutôt que de s'étirer le long d'une chaîne de
       voisins pauvres, ce qui donne des formes nettement plus compactes. */
    let choisie = null, dmin = Infinity;
    for (const v of voisins[cible.idx]) {
      const u = unites[v];
      if (!u.vive) continue;
      const d2 = (u.ci - cible.ci) ** 2 + (u.cj - cible.cj) ** 2;
      if (d2 < dmin) { dmin = d2; choisie = u; }
    }
    if (!choisie) break;               // unité isolée : la grille entière est trop pauvre
    fusionner(choisie, cible);
  }

  const vivantes = unites.filter(u => u.vive && u.n >= BIO_MIN_OBS);
  const retenues = vivantes.map(u => ({ n:u.n, esp:u.esp, cases:u.cases }));
  /* Depuis que la fusion se poursuit jusqu'à ce que toutes les unités atteignent le seuil,
     aucune cellule ne reste sous la barre : le tableau des cellules trop maigres est vide par
     construction. Il subsiste pour la compatibilité des enregistrements en mémoire. */
  const maigres = [];
  if (retenues.length < bioGroupes * 2) return null;

  // Espèces présentes dans assez de cellules pour porter un signal.
  /* Deux coupes, aux deux extrémités. En bas, une espèce vue dans moins de trois cellules
     n'apporte que du hasard d'échantillonnage. En haut, une espèce présente dans plus de
     quatre-vingts pour cent des cellules est partout et ne sépare rien — c'est le critère
     pertinent pour écarter les généralistes, bien plus que leur nombre d'observations.
     Ce filtre agit après le découpage, donc sans rien coûter à la collecte. */
  const compte = new Map();
  for (const c of retenues) for (const id of c.esp.keys()) compte.set(id, (compte.get(id) || 0) + 1);
  /* Deux exclusions propres aux biorégions. Les espèces trop rares pour porter un signal,
     et les ubiquistes — celles présentes dans plus de quatre-vingts pour cent des cellules,
     ainsi que les deux pour cent les plus observées, qui décrivent la fréquentation humaine
     davantage que les milieux. Les communautés, elles, gardent tout. */
  const plafond = retenues.length * BIO_MAX_PART;
  const abondance = new Map();
  for (const c of retenues) for (const [id, n] of c.esp)
    abondance.set(id, (abondance.get(id) || 0) + n);
  const parAbondance = [...abondance].sort((a, b) => b[1] - a[1]);
  const tetes = new Set(parAbondance.slice(0, Math.floor(parAbondance.length * 0.02)).map(([id]) => id));

  /* Le filtre des introduites porte ici, sur les espèces retenues, et non sur le comptage des
     observations : le découpage en cellules reste ainsi rigoureusement identique dans les deux
     cas, seule leur composition change. On compare alors deux analyses des mêmes unités, et
     non deux découpages différents. */
  const especes = [...compte]
    .filter(([id, n]) => n >= BIO_MIN_CELL && n <= plafond && !tetes.has(id))
    .map(([id]) => id);
  const ubiquistes = [...compte].filter(([, n]) => n > plafond).length;
  if (ubiquistes) console.info('Biorégions : ' + ubiquistes
    + ' espèces présentes dans plus de 80 % des cellules, écartées comme non séparatrices.');
  if (especes.length < 10) return null;
  const rang = new Map(especes.map((id, k) => [id, k]));

  /* Lignes creuses : normalisation par cellule puis logarithme. La normalisation met sur un
     pied d'égalité une cellule visitée mille fois et une autre visitée cinquante ; le
     logarithme empêche quelques espèces très photographiées de dominer les composantes. */
  /* Chaîne de traitement, en cinq temps.

     1. Fréquences relatives : l'effectif de chaque espèce divisé par le total de sa cellule,
        de sorte que toutes les cellules pèsent le même poids quel que soit l'effort.
     2. Logarithme décimal, après division par la plus petite valeur non nulle — l'échelle
        démarre ainsi à zéro plutôt qu'en négatif.
     3. Corrélations de Pearson entre espèces, établies sur ces valeurs logarithmiques.
     4. Correction appliquée aux fréquences brutes et non aux logarithmes : multiplier des
        logarithmes par des corrélations mêlait deux échelles sans signification commune.
        Chaque cellule reçoit alors une valeur pour toutes les espèces, y compris absentes.
     5. Retour au logarithme sur les valeurs corrigées, pour l'analyse. */
  const brut = retenues.map(c => {
    const idx = [], val = [];
    let total = 0;
    for (const [id, n] of c.esp) if (rang.has(id)) total += n;
    for (const [id, n] of c.esp) {
      if (!rang.has(id)) continue;
      idx.push(rang.get(id));
      val.push(n / (total || 1));
    }
    return { idx, val };
  });

  const logNorm = (l2) => {
    let mini = Infinity;
    for (const l of l2) for (const x of l.val) if (x > 0 && x < mini) mini = x;
    if (!isFinite(mini) || mini <= 0) mini = 1;
    return l2.map(l => {
      const idx = [], val = [];
      for (let z = 0; z < l.idx.length; z++) {
        const y = l.val[z] > 0 ? Math.log10(l.val[z] / mini) : 0;
        if (y > 0) { idx.push(l.idx[z]); val.push(y); }
      }
      return { idx, val };
    });
  };

  const lignes = logNorm(brut);
  const lissees = lignes;
  const donneesBrutes = { lignes, nEsp:especes.length };

  const scores = acpCreuse(lissees, especes.length, BIO_AXES);
  /* Nombre de régions suggéré par la méthode du coude, comme pour les communautés : les
     coûts de fusion croissent doucement tant qu'on réunit des cellules semblables, puis
     brusquement quand il faut rapprocher des ensembles distincts. On ne l'applique qu'au
     premier calcul, la glissière reprenant la main ensuite. */
  if (bioGroupes === null) bioGroupes = coudeDeBioregions(scores);
  const groupes = ordonnerGroupes(ward(scores, bioGroupes));

  retenues.forEach((c, k) => { c.groupe = groupes[k]; });
  return {
    // Les points bruts restent accessibles : les cartes de communautés s'appuient sur les
    // localisations réelles, bien plus fines que les unités d'analyse.
    pts,
    cellules:retenues, maigres, x0, y0, cote, scores, rang, donneesBrutes,
    grille:{ ni, nj, pasX, pasY, x0, y0 },
    nObs:pts.length, nEsp:especes.length,
    indicatrices:indicatrices(retenues, groupes, rang)
  };
}

function acpCreuse(lignes, p, k) {
  const n = lignes.length;
  const moy = new Float64Array(p);
  for (const l of lignes) for (let z = 0; z < l.idx.length; z++) moy[l.idx[z]] += l.val[z];
  for (let j = 0; j < p; j++) moy[j] /= n;

  const parLigne = (v) => {            // X_c · v, v de dimension p
    const out = new Float64Array(n);
    let mv = 0;
    for (let j = 0; j < p; j++) mv += moy[j] * v[j];
    for (let i = 0; i < n; i++) {
      const l = lignes[i];
      let s = 0;
      for (let z = 0; z < l.idx.length; z++) s += l.val[z] * v[l.idx[z]];
      out[i] = s - mv;
    }
    return out;
  };
  const parColonne = (u) => {          // X_cᵀ · u, u de dimension n
    const out = new Float64Array(p);
    let su = 0;
    for (let i = 0; i < n; i++) {
      su += u[i];
      const l = lignes[i];
      for (let z = 0; z < l.idx.length; z++) out[l.idx[z]] += l.val[z] * u[i];
    }
    for (let j = 0; j < p; j++) out[j] -= moy[j] * su;
    return out;
  };

  const axes = [], scores = Array.from({ length:n }, () => new Float64Array(k));
  for (let c = 0; c < k; c++) {
    let v = new Float64Array(p);
    for (let j = 0; j < p; j++) v[j] = Math.sin(j * 12.9898 + c * 7.233);  // départ reproductible
    for (let it = 0; it < 60; it++) {
      let w = parColonne(parLigne(v));
      for (const a of axes) {          // déflation : on retire les axes déjà trouvés
        let d = 0;
        for (let j = 0; j < p; j++) d += a[j] * w[j];
        for (let j = 0; j < p; j++) w[j] -= d * a[j];
      }
      let norme = Math.hypot(...w);
      if (!norme || !isFinite(norme)) break;
      for (let j = 0; j < p; j++) w[j] /= norme;
      v = w;
    }
    axes.push(v);
    const proj = parLigne(v);
    for (let i = 0; i < n; i++) scores[i][c] = proj[i];
  }
  return scores;
}

/* Coude appliqué aux cellules : on fusionne progressivement jusqu'à deux groupes en relevant
   le coût de chaque étape, et l'on retient le nombre de groupes juste avant le saut le plus
   marqué. Contrairement aux communautés, l'arbre n'est pas conservé ici — le calcul est donc
   refait, mais il ne porte que sur quelques centaines de cellules. */
function coudeDeBioregions(scores) {
  /* On part de k = 1 : sans ce point de départ, la chute qui mène d'un ensemble unique à
     deux régions reste invisible, et un territoire nettement coupé en deux se voit attribuer
     quatre régions faute d'avoir pu comparer. */
  const couts = [];
  for (let k = 1; k <= Math.min(8, Math.floor(scores.length / 3)); k++) {
    couts.push({ k, cout:inertieWard(scores, k) });
  }
  if (couts.length < 3) return 2;
  let meilleur = 2, ecart = 0;
  for (let i = 0; i < couts.length - 1; i++) {
    const r = couts[i].cout / (couts[i + 1].cout || 1e-9);
    if (r > ecart) { ecart = r; meilleur = couts[i + 1].k; }
  }
  return Math.max(2, Math.min(8, meilleur));
}

/* Inertie intra-groupe pour un découpage donné : somme des carrés des écarts aux centres. */
function inertieWard(scores, k) {
  const g = ward(scores, k);
  const dim = scores[0].length;
  const sommes = new Map(), effectifs = new Map();
  scores.forEach((p, i) => {
    const c = g[i];
    if (!sommes.has(c)) { sommes.set(c, new Float64Array(dim)); effectifs.set(c, 0); }
    const s = sommes.get(c);
    for (let z = 0; z < dim; z++) s[z] += p[z];
    effectifs.set(c, effectifs.get(c) + 1);
  });
  let total = 0;
  scores.forEach((p, i) => {
    const c = g[i], n = effectifs.get(c), s = sommes.get(c);
    for (let z = 0; z < dim; z++) { const e = p[z] - s[z] / n; total += e * e; }
  });
  return total;
}

/* Regroupement de Ward par chaîne de plus proches voisins : O(n²), sans matrice complète. */
function ward(pts, k) {
  const n = pts.length, dim = pts[0].length;
  const centres = pts.map(p => Float64Array.from(p));
  const taille = new Array(n).fill(1);
  const vivant = new Array(n).fill(true);
  const membres = pts.map((_, i) => [i]);
  let restants = n;

  const cout = (a, b) => {             // inertie ajoutée par la fusion, critère de Ward
    let d = 0;
    for (let z = 0; z < dim; z++) { const e = centres[a][z] - centres[b][z]; d += e * e; }
    return d * taille[a] * taille[b] / (taille[a] + taille[b]);
  };

  while (restants > k) {
    let meilleur = Infinity, ia = -1, ib = -1;
    for (let a = 0; a < n; a++) {
      if (!vivant[a]) continue;
      for (let b = a + 1; b < n; b++) {
        if (!vivant[b]) continue;
        const c = cout(a, b);
        if (c < meilleur) { meilleur = c; ia = a; ib = b; }
      }
    }
    if (ia < 0) break;
    const ta = taille[ia], tb = taille[ib];
    for (let z = 0; z < dim; z++)
      centres[ia][z] = (centres[ia][z] * ta + centres[ib][z] * tb) / (ta + tb);
    taille[ia] = ta + tb;
    membres[ia] = membres[ia].concat(membres[ib]);
    vivant[ib] = false;
    restants--;
  }

  const sortie = new Array(n).fill(0);
  let g = 0;
  for (let a = 0; a < n; a++) if (vivant[a]) { for (const m of membres[a]) sortie[m] = g; g++; }
  return sortie;
}

/* Espèces caractéristiques, selon la valeur indicatrice de Dufrêne et Legendre. Deux termes
   se multiplient : la spécificité, soit la part des observations de l'espèce qui tombe dans
   ce groupe, et la fidélité, soit la proportion des cellules du groupe où elle est présente.
   Le produit récompense une espèce à la fois concentrée sur le groupe et répandue à
   l'intérieur. Le rapport de fréquences seul, que j'utilisais, faisait remonter des espèces
   rares vues dans une seule cellule — spécifiques mais nullement typiques. */
function indicatrices(cellules, groupes, rang) {
  const parGroupe = new Map(), global = new Map();
  cellules.forEach((c, k) => {
    const g = groupes[k];
    if (!parGroupe.has(g)) parGroupe.set(g, { esp:new Map(), presence:new Map(), n:0 });
    const G = parGroupe.get(g);
    G.n++;
    for (const [id, n] of c.esp) {
      // Mêmes espèces que pour le calcul : ni les trop rares ni les ubiquistes ne décrivent
      // un groupe, et une liste descriptive qui ne correspond pas au calcul induirait en erreur.
      if (rang && !rang.has(id)) continue;
      G.esp.set(id, (G.esp.get(id) || 0) + n);
      G.presence.set(id, (G.presence.get(id) || 0) + 1);
      global.set(id, (global.get(id) || 0) + n);
    }
  });

  const parId = new Map(etat.especes.map(e => [e.id, e]));
  const sortie = new Map();
  for (const [g, G] of parGroupe) {
    const liste = [...G.esp]
      .filter(([, n]) => n >= 5)
      .map(([id, n]) => {
        const specificite = n / (global.get(id) || 1);
        const fidelite = (G.presence.get(id) || 0) / (G.n || 1);
        return { id, score:specificite * fidelite, n };
      })
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map(x => {
        const e = parId.get(x.id);
        return { id:x.id, nom: e ? nomCourt(e.nom, e.nomFr) : '#' + x.id,
                 photo: e ? e.photoPetite || e.photo : null,
                 photoGrande: e ? e.photo || e.photoPetite : null };
      });
    sortie.set(g, { especes:liste, cellules:G.n });
  }
  return sortie;
}


/* Changer le nombre de groupes ne demande que de refaire le regroupement : les composantes
   principales, elles, ne dépendent pas de k. */
/* Les numéros que rend Ward n'ont pas d'ordre : on les renomme du groupe le plus étendu au
   plus petit, de sorte que le groupe 1 soit toujours le principal et que les couleurs se
   suivent dans un ordre lisible. */
function ordonnerGroupes(groupes) {
  const taille = new Map();
  for (const g of groupes) taille.set(g, (taille.get(g) || 0) + 1);
  const rangs = new Map([...taille.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([g], i) => [g, i]));
  return groupes.map(g => rangs.get(g));
}

function regrouperBio() {
  if (!bio || !bio.scores) return;
  const groupes = ordonnerGroupes(ward(bio.scores, bioGroupes));
  bio.cellules.forEach((c, k) => { c.groupe = groupes[k]; });
  bio.indicatrices = indicatrices(bio.cellules, groupes, bio.rang);
}

let carteBio = null, coucheBio = null;
let vueBio = null;      // cadrage conservé d'un redessin à l'autre
let bioSatellite = 0;   // indice dans ORDRE_FONDS


function majFondBio() {
  poserFond(carteBio, ORDRE_FONDS[bioSatellite % ORDRE_FONDS.length]);
}


/* Niveaux déjà collectés, relevés une fois à l'ouverture de l'onglet : les rouvrir est
   instantané, autant que cela se voie avant de cliquer. */
let bioEnMemoire = new Set();

async function releverMemoireBio() {
  try {
    const tout = await surBase('readonly', st => st.getAll());
    const prefixe = cleInventaire() + '|bio|';
    bioEnMemoire = new Set((tout || [])
      .filter(d => String(d.cle || '').startsWith(prefixe)
        && Date.now() - d.date < PEREMPTION)
      .map(d => +String(d.cle).slice(prefixe.length)));
  } catch (e) { bioEnMemoire = new Set(); }
}

/* Les réglages de collecte doivent être accessibles avant le premier calcul : les découvrir
   après coup obligerait à relancer une analyse de plusieurs minutes pour rien. */
function reglagesBio() {
  return `
    <select id="bio-volume">${(() => {
      /* Volume réellement disponible : la somme des effectifs des espèces qui franchissent le
         seuil de collecte. Au-delà, un palier plus élevé ramènerait exactement la même chose
         en annonçant une durée plus longue — autant le griser. Le premier palier qui couvre
         tout reste proposé, c'est lui qui collecte l'intégralité. */
      const seuil = seuilBio();
      const dispo = etat.especes.reduce((a, e) => a + (e.nZone >= seuil ? e.nZone : 0), 0);
      const paliers = [[1000, 'bioRapide'], [5000, 'bioMoyen'], [20000, 'bioFin'],
                       [200000, 'bioTout']];
      const premierCouvrant = (paliers.find(([v]) => v >= dispo) || paliers[paliers.length - 1])[0];
      return paliers.filter(([v]) => v <= premierCouvrant);
    })()
      .map(([v, k]) => {
        /* Estimation ajustée sur deux mesures réelles : mille observations en vingt secondes,
           cinq mille en soixante. La droite qui passe par ces deux points donne dix secondes
           de préparation et deux secondes par page — la cadence d'une requête par seconde ne
           représente donc que la moitié du temps, le reste étant le délai de réponse. */
        const s = Math.round(10 + (v / BIO_PAR_APPEL) * 2.0);
        const duree = s < 90 ? t('bioSec', s) : t('bioMin', Math.round(s / 60));
        const garde = bioEnMemoire.has(v);
        return `<option value="${v}"${v === bioMax ? ' selected' : ''}
          title="${echap(t('bioDetail', nb(v), duree))}"
          >${garde ? '● ' : ''}${t(k)} · ${garde ? t('bioCache') : duree}</option>`;
      }).join('')}</select>`;
}

/* Changer de niveau ne lance jamais la collecte : on revient à l'écran de départ et c'est le
   bouton qui décide. Enclencher plusieurs minutes de requêtes sur un simple changement de
   menu était une mauvaise surprise. */
function brancherReglagesBio() {
  /* Le relevé de la mémoire commande le libellé du bouton : il faut le rafraîchir avant de
     redessiner, sans quoi il annoncerait un chargement pour un niveau déjà en réserve. */
  const refaire = () => {
    bio = null; comm = null; commArbre = null;
    releverMemoireBio().then(dessinerBioregions);
  };

  /* Le palier mémorisé peut ne plus figurer dans la liste — après un changement de zone ou de
     seuil. Le menu affiche alors le premier de la liste, mais la variable garde l'ancienne
     valeur : on la réaligne sur ce qui est réellement montré. */
  const bv = $('#bio-volume');
  if (bv && bv.value && +bv.value !== bioMax) bioMax = +bv.value;
  if (bv) bv.addEventListener('change', e => { bioMax = +e.target.value; refaire(); });

}


function dessinerBioregions() {
  const v = $('#v-bio');
  if (!v) return;
  if (!etat.especes.length) {
    v.innerHTML = `<div class="vide"><strong>${t('oBio')}</strong>${t('videBio')}</div>`;
    return;
  }

  if (!bio) {
    v.innerHTML = `
      <div class="outils">
        <button class="primaire" id="bio-lancer"${bioEnCours ? ' disabled' : ''}
          >${t(bioEnMemoire.has(bioMax) ? 'bioLancer' : 'bioCharger')}</button>
        ${reglagesBio()}
        <span class="compte">${bioEnCours ? t('bioCalcul') : ''}</span>
      </div>
      <div class="vide">${bio === null && !bioEnCours && bioTente
        ? t('bioMaigre') : t('videBio') + ' ' + t('bioDuree')}</div>
      <p class="note">${t('bioNote')}</p>`;
    brancherReglagesBio();
    const b = $('#bio-lancer');
    if (b) b.addEventListener('click', () => {
      // Appel direct plutôt que mise en file : l'analyse répond à un geste explicite, et
      // ses requêtes passent de toute façon par la file des appels réseau.
      chargerBioregions().catch(e =>
        progression(t('mEchec', String((e && e.message) || e)), null));
    });
    carteBio = null;              // le conteneur vient d'être remplacé
    return;
  }

  const groupes = [...bio.indicatrices.keys()].sort((a, b) => a - b);
  v.innerHTML = `
    <div class="outils">
      <button class="discret" id="bio-recadrer">${t('bioRecadrer')}</button>
      <button class="discret rouge" id="bio-relancer">${t('bioRecollecter')}</button>
      ${reglagesBio()}
      <label class="glissiere"><span>${t('bioK')}</span>
        <input type="range" id="bio-k" min="2" max="8" step="1" value="${bioGroupes || 2}">
        <b>${bioGroupes}</b></label>
      <span class="compte">${t('bioResume', nb(bio.cellules.length), nb(bio.nObs), nb(bio.nEsp))
        }${bio.memoire ? ' · ' + t('bioCache') : ''}</span>
    </div>
    <div class="carte-boite">
      <div id="carte-bio"></div>
      <button id="bio-fond" class="sur-carte" data-tt="cFond">
        <svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true">
          <path d="M10 2.4 2.6 6.2 10 10l7.4-3.8z" fill="none" stroke="currentColor"
            stroke-width="1.5" stroke-linejoin="round"/>
          <path d="M3.4 9.6 10 13l6.6-3.4M3.4 13.2 10 16.6l6.6-3.4" fill="none"
            stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
    <div class="planche" style="margin-top:18px">${groupes.map(g => {
      const G = bio.indicatrices.get(g);
      const teinte = BIO_TEINTES[g % BIO_TEINTES.length];
      return `<div class="colonne groupe-bio" data-groupe="${g}"
          style="border-left:10px solid ${teinte}">
        <div class="entete"><div>
          <div class="fr">${t('bioGroupe', g + 1)}</div>
          <div class="freq">${t('bioCellules', nb(G.cellules))}</div>
        </div></div>
        <button class="apercu4" data-deplier="${g}" aria-label="${echap(t('bioIndic'))}"
          >${G.especes.slice(0, 4).map(e => `<span>${e.photo
            ? `<img src="${echap(e.photo)}" loading="lazy" alt="">` : ''}</span>`).join('')}</button>
      </div>`;
    }).join('')}</div>
    ${bio.plafond ? `<p class="note">${t('bioPlafond')}</p>` : ''}
    <p class="note">${t('bioNote')}</p>`;

  v.querySelectorAll('[data-deplier]').forEach(b =>
    b.addEventListener('click', () => ouvrirGroupeBio(+b.dataset.deplier)));






  $('#bio-recadrer').addEventListener('click', cadrerBio);
  $('#bio-fond').addEventListener('click', () => {
    bioSatellite = (bioSatellite + 1) % ORDRE_FONDS.length;
    $('#bio-fond').classList.toggle('actif', bioSatellite > 0);
    majFondBio();
  });

  brancherReglagesBio();


  const bk = $('#bio-k');
  if (bk) {
    // Le regroupement se refait sur les scores déjà calculés : aucune requête.
    bk.addEventListener('input', e => { bioGroupes = +e.target.value; bk.nextElementSibling.textContent = bioGroupes; });
    bk.addEventListener('change', () => {
      regrouperBio();
      comm = null;              // les rubans de communautés décrivent ces biorégions
      dessinerBioregions();
    });
  }

  $('#bio-relancer').addEventListener('click', () => {
    bio = null; comm = null; commArbre = null; dessinerBioregions();
    chargerBioregions(true).catch(e =>
      progression(t('mEchec', String((e && e.message) || e)), null));
  });

  setTimeout(tracerCarteBio, 30);   // le conteneur doit être visible pour être mesuré
}

/* Contours du lieu, mis en réserve une fois pour toutes : ils servent à écarter les cellules
   qui tombent en dehors. Les rectangles du découpage débordent forcément d'une limite
   administrative ou naturelle, et rien ne sert d'afficher une cellule posée hors de la zone. */
let anneauxLieu = null;

async function chargerContoursLieu() {
  if (anneauxLieu) return anneauxLieu;
  const a = [];
  if (etat.zone) a.push(anneauZone(etat.zone).slice(0, -1));
  for (const l of etat.lieux) {
    try {
      const d = await appelDirect('/places/' + l.id, {});
      const g = d.results && d.results[0] && d.results[0].geometry_geojson;
      if (!g) continue;
      if (g.type === 'Polygon') a.push(g.coordinates[0]);
      else if (g.type === 'MultiPolygon') for (const q of g.coordinates) a.push(q[0]);
    } catch (e) { /* sans contour, aucune cellule n'est écartée */ }
  }
  anneauxLieu = a;
  return a;
}

/* Découpage exact d'un contour par une cellule. Une cellule étant un rectangle, donc une
   fenêtre convexe, l'algorithme de Sutherland-Hodgman s'applique directement : on rabat le
   contour successivement sur les quatre côtés. Le résultat épouse la limite du lieu, sans
   masque posé par-dessus la carte et sans toucher au fond. */
function couperAuRectangle(anneau, ax, ay, bx, by) {
  const bords = [
    p => p[0] >= ax, p => p[0] <= bx, p => p[1] >= ay, p => p[1] <= by
  ];
  const coupe = [
    (a, b) => [ax, a[1] + (b[1] - a[1]) * (ax - a[0]) / (b[0] - a[0])],
    (a, b) => [bx, a[1] + (b[1] - a[1]) * (bx - a[0]) / (b[0] - a[0])],
    (a, b) => [a[0] + (b[0] - a[0]) * (ay - a[1]) / (b[1] - a[1]), ay],
    (a, b) => [a[0] + (b[0] - a[0]) * (by - a[1]) / (b[1] - a[1]), by]
  ];
  let sortie = anneau;
  for (let k = 0; k < 4 && sortie.length; k++) {
    const entree = sortie;
    sortie = [];
    for (let i = 0, j = entree.length - 1; i < entree.length; j = i++) {
      const a = entree[j], b = entree[i];
      const da = bords[k](a), db = bords[k](b);
      if (db) {
        if (!da) sortie.push(coupe[k](a, b));
        sortie.push(b);
      } else if (da) sortie.push(coupe[k](a, b));
    }
  }
  return sortie;
}

/* Lancer de rayon : sert à ne garder que les segments de contour situés dans le lieu. */
function dansAnneaux(x, y, anneaux) {
  if (!anneaux || !anneaux.length) return true;
  for (const an of anneaux) {
    let dedans = false;
    for (let i = 0, j = an.length - 1; i < an.length; j = i++) {
      const xi = an[i][0], yi = an[i][1], xj = an[j][0], yj = an[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) dedans = !dedans;
    }
    if (dedans) return true;
  }
  return false;
}

/* Morceaux d'une cellule situés dans le lieu. Sans contour connu, la cellule reste entière. */
function cellulesCoupees(c, anneaux) {
  if (!anneaux || !anneaux.length)
    return [[[c.ay, c.ax], [c.ay, c.bx], [c.by, c.bx], [c.by, c.ax]]];
  const morceaux = [];
  for (const an of anneaux) {
    const q = couperAuRectangle(an, c.ax, c.ay, c.bx, c.by);
    if (q.length >= 3) morceaux.push(q.map(p => [p[1], p[0]]));
  }
  return morceaux;
}

/* Une carte propre à l'onglet : les cellules y sont dessinées en rectangles colorés selon
   leur groupe, sur le même fond clair que les autres cartes du site. */
async function tracerCarteBio() {
  const cible = document.getElementById('carte-bio');
  if (!cible || !bio) return;
  const anneaux = await chargerContoursLieu();

  /* Pendant le chargement des contours, l'onglet a pu être redessiné : ce conteneur n'est
     plus dans la page, et un autre tracé s'occupe du nouveau. */
  if (!cible.isConnected || !bio) return;
  /* Onglet masqué — l'analyse, qui dure plusieurs minutes, se termine souvent pendant qu'on
     regarde un autre onglet. Une carte créée dans un conteneur de taille nulle cadrait dans
     le vide, et ce mauvais cadrage était ensuite mémorisé puis restitué à chaque retour.
     On attend donc l'affichage de l'onglet, qui redessine tout et appellera ce tracé. */
  if (!cible.offsetWidth || !cible.offsetHeight) return;

  /* Le contenu de l'onglet est réécrit à chaque changement de réglage, donc la carte est
     recréée à chaque fois. On mémorise le cadrage courant pour le restituer, sans quoi tout
     déplacement serait perdu au moindre ajustement. */
  let neuve = false;
  if (!carteBio || carteBio.getContainer() !== cible) {
    neuve = true;
    carteBio = L.map(cible, { scrollWheelZoom:true });
    majFondBio();     // la carte est neuve : elle ne porte encore aucune couche de fond
    coucheBio = null;
    if (vueBio) { carteBio.setView(vueBio.centre, vueBio.zoom); neuve = false; }
    carteBio.on('moveend zoomend', () => {
      vueBio = { centre:carteBio.getCenter(), zoom:carteBio.getZoom() };
    });
  }
  carteBio.invalidateSize();

  if (coucheBio) { carteBio.removeLayer(coucheBio); coucheBio = null; }
  /* Chaque case est tracée séparément, avec son liseré : le quadrillage reste visible et
     l'on voit la granularité réelle de l'analyse. Les milliers de formes que cela représente
     passent par le rendu en canevas, seul capable de les afficher sans ralentir la carte. */
  const G = bio.grille;
  const groupeDe = new Int32Array(G.ni * G.nj).fill(-1);
  bio.cellules.forEach(u => { for (const k of u.cases) groupeDe[k] = u.groupe; });

  const toile = L.canvas({ padding:0.3 });
  const formes = [];
  for (let i = 0; i < G.ni; i++) {
    for (let j = 0; j < G.nj; j++) {
      const g = groupeDe[i * G.nj + j];
      if (g < 0) continue;
      const boite = {
        ax:G.x0 + i * G.pasX, ay:G.y0 + j * G.pasY,
        bx:G.x0 + (i + 1) * G.pasX, by:G.y0 + (j + 1) * G.pasY
      };
      const parts = cellulesCoupees(boite, anneaux);
      if (!parts.length) continue;
      const couleur = BIO_TEINTES[g % BIO_TEINTES.length];
      formes.push(L.polygon(parts, { renderer:toile, weight:0,
        fillColor:couleur, fillOpacity:0.62 })
        .bindTooltip(t('bioGroupe', g + 1))
        .on('click', () => ouvrirGroupeBio(g)));
    }
  }

  /* Contour des unités finales, et non de la grille de départ : on ne trace un segment que
     là où deux cases voisines appartiennent à des unités différentes. C'est cette limite-là
     qui a un sens — chaque unité est l'ensemble d'observations sur lequel la composition a
     réellement été calculée. */
  const uniteDe = new Int32Array(G.ni * G.nj).fill(-1);
  bio.cellules.forEach((u, k) => { for (const c of u.cases) uniteDe[c] = k; });

  const bords = [];
  const segment = (x1b, y1b, x2b, y2b) => {
    if (!dansAnneaux((x1b + x2b) / 2, (y1b + y2b) / 2, anneaux)) return;
    bords.push([[y1b, x1b], [y2b, x2b]]);
  };
  for (let i = 0; i < G.ni; i++) {
    for (let j = 0; j < G.nj; j++) {
      const u = uniteDe[i * G.nj + j];
      if (u < 0) continue;
      const ax = G.x0 + i * G.pasX, ay = G.y0 + j * G.pasY;
      const bx = ax + G.pasX, by = ay + G.pasY;
      if (i + 1 >= G.ni || uniteDe[(i + 1) * G.nj + j] !== u) segment(bx, ay, bx, by);
      if (i === 0 || uniteDe[(i - 1) * G.nj + j] !== u) segment(ax, ay, ax, by);
      if (j + 1 >= G.nj || uniteDe[i * G.nj + (j + 1)] !== u) segment(ax, by, bx, by);
      if (j === 0 || uniteDe[i * G.nj + (j - 1)] !== u) segment(ax, ay, bx, ay);
    }
  }
  if (bords.length) formes.push(L.polyline(bords, { renderer:toile, color:'#3A463E',
    weight:0.7, opacity:0.55, interactive:false }));

  coucheBio = L.layerGroup(formes).addTo(carteBio);
  // Le cadrage n'a lieu qu'au premier tracé : faire varier le nombre de groupes ne doit pas
  // ramener sans cesse la vue au point de départ.
  if (neuve) cadrerBio();
}

/* Le détail d'un groupe s'ouvre en fenêtre : dix espèces avec leur vignette tiennent mal
   dans une colonne, et l'on veut comparer un groupe à la fois, pas tous à la fois. */
function ouvrirGroupeBio(g) {
  const G = bio && bio.indicatrices.get(g);
  if (!G) return;
  fenetreEspeces(t('bioGroupe', g + 1) + ' · ' + t('bioCellules', nb(G.cellules)),
    G.especes, BIO_TEINTES[g % BIO_TEINTES.length]);
}

/* Fenêtre de présentation d'une liste d'espèces : sert aux groupes de biorégions comme aux
   communautés, avec le même rendu en mosaïque. */
/* Fermeture d'une fenêtre : le bouton, le fond, et la touche d'échappement. Le bouton était
   affiché sans gestionnaire, ce qui le rendait inerte dans les deux fenêtres. */
function brancherFermeture(f) {
  const x = f.querySelector('#bio-fen-x');
  if (x) x.addEventListener('click', () => { f.hidden = true; });
  f.onclick = ev => { if (ev.target === f) f.hidden = true; };
}

function fenetreEspeces(titre, especes, teinte) {
  const f = $('#bio-fen');
  f.innerHTML = `<div class="boite" style="border-top:8px solid ${teinte}">
    <button class="discret fermer" id="bio-fen-x">${t('fermer')}</button>
    <div class="tit" style="margin:0">${echap(titre)}</div>
    <div class="k" style="margin:14px 0 8px">${t('bioIndic')}</div>
    <div class="mosaique">${especes.map(e => `
      <div class="tuile">
        ${pastilleIntro(e.id)}
        <a href="https://www.inaturalist.org/taxa/${e.id}" target="_blank" rel="noopener"
           ${e.aussi !== undefined ? `title="${echap(t('commAussi', e.aussiNom || ''))}"` : ''}>
          ${e.photo ? `<img src="${echap(e.photoGrande || e.photo)}" loading="lazy" alt="">` : ''}
          ${e.aussi !== undefined ? `<b class="transg">↔</b>` : ''}
          <span>${echap(e.nom)}</span>
        </a>
      </div>`).join('')}</div>
  </div>`;
  f.hidden = false;
  brancherFermeture(f);
}

function cadrerBio() {
  if (!carteBio || !bio || !bio.cellules.length) return;

  /* On cadre sur l'emprise des cellules et non sur celle de la grille : cette dernière est le
     rectangle englobant de toutes les observations, arrondi au cran supérieur, et déborde
     donc de ce qui est réellement dessiné. */
  const G = bio.grille;
  let imin = Infinity, imax = -Infinity, jmin = Infinity, jmax = -Infinity;
  for (const u of bio.cellules) for (const k of u.cases) {
    const i = Math.floor(k / G.nj), j = k % G.nj;
    if (i < imin) imin = i; if (i > imax) imax = i;
    if (j < jmin) jmin = j; if (j > jmax) jmax = j;
  }
  if (!isFinite(imin)) return;

  const b = L.latLngBounds(
    [G.y0 + jmin * G.pasY, G.x0 + imin * G.pasX],
    [G.y0 + (jmax + 1) * G.pasY, G.x0 + (imax + 1) * G.pasX]);

  // Le conteneur vient d'apparaître : sans cette remesure, le cadrage se fait sur une taille
  // périmée et la vue tombe à côté.
  carteBio.invalidateSize();
  carteBio.fitBounds(b, { padding:[16, 16] });
}


/* ============================================================
   Communautés : regrouper les espèces qui occupent les mêmes cellules
   ============================================================ */

/* L'analyse inverse de celle des biorégions. Là-bas on rassemblait les cellules de
   composition semblable ; ici on rassemble les espèces de répartition semblable. Les données
   sont les mêmes — la matrice cellules par espèces déjà constituée —, simplement lue dans
   l'autre sens, ce qui rend cet onglet gratuit en requêtes.

   Le regroupement est non hiérarchique, par la méthode des k-moyennes : on cherche des
   partitions d'espèces sans construire d'arbre, ce qui convient mieux ici, une espèce
   n'ayant pas vocation à se rattacher progressivement à des ensembles emboîtés. */

let comm = null, commArbre = null;
/* Trois niveaux plutôt qu'une glissière continue. Les repères sont choisis d'après les
   ordres de grandeur de la phytosociologie : une association compte typiquement quinze à
   cinquante espèces, une alliance quelques dizaines, une classe plusieurs centaines. On vise
   donc une taille moyenne de communauté, dont on déduit le nombre de coupes. */
const NIVEAUX_COMM = { large:120, moyen:45, fin:18 };   // espèces visées par communauté


let commNiveau = 'moyen';
let commPage = 0;
let commTri = 'obs';         // « obs », « esp », ou « bio:N » pour une biorégion donnée
/* Vingt observations dans l'inventaire : c'est aussi le seuil de collecte, si bien que toute
   espèce ramenée est classable. En deçà, la répartition d'une espèce ne mesure que le hasard
   du prélèvement. */
/* Le classement en communautés reprend le seuil de la collecte : toute espèce ramenée doit
   pouvoir être classée, et aucune espèce absente des données ne doit apparaître classable. */
function seuilComm() { return seuilBio(); }
const COMM_MAX_ESP = 1500;   // au-delà, la matrice de distances deviendrait démesurée

/* Toutes les espèces collectées, et non les seules retenues pour délimiter les biorégions.
   Le filtre de là-bas écarte les espèces rares et les ubiquistes, ce qui a un sens pour
   découper l'espace mais n'en a aucun pour classer les espèces elles-mêmes : une espèce
   présente partout appartient bien à une communauté, et une espèce localisée aussi. Le seul
   critère retenu ici est d'avoir assez d'observations pour que sa répartition signifie
   quelque chose. */
function profilsEspeces() {
  const totalParEsp = new Map();
  for (const c of bio.cellules)
    for (const [id, n] of c.esp) totalParEsp.set(id, (totalParEsp.get(id) || 0) + n);

  /* Le seuil porte sur l'effectif de l'inventaire, non sur celui de l'échantillon collecté.
     Ce dernier n'est qu'un prélèvement : une espèce comptant trente observations dans la zone
     peut n'en avoir que huit ici, et serait écartée à tort. C'est bien la quantité de données
     disponibles sur l'espèce qui décide si sa répartition veut dire quelque chose. */
  const inventaire = new Map(etat.especes.map(e => [e.id, e.nZone]));
  /* Le filtre des introduites s'applique aussi ici. Depuis qu'il porte sur les espèces
     retenues plutôt que sur le comptage — pour que le découpage en cellules reste identique
     dans les deux cas —, la composition brute des cellules les contient toujours, et les
     communautés les auraient reprises sans cette exclusion. */
  let ids = [...totalParEsp]
    .filter(([id]) => (inventaire.get(id) || 0) >= seuilComm())
    .sort((a, b) => (inventaire.get(b[0]) || 0) - (inventaire.get(a[0]) || 0))
    .map(([id]) => id);
  if (ids.length > COMM_MAX_ESP) {
    console.info('Communautés : ' + ids.length + ' espèces classables, limitées aux '
      + COMM_MAX_ESP + ' plus observées.');
    ids = ids.slice(0, COMM_MAX_ESP);
  }
  const rang = new Map(ids.map((id, r) => [id, r]));
  const nC = bio.cellules.length;
  const profils = ids.map(() => new Float64Array(nC));
  const totaux = new Float64Array(ids.length);

  bio.cellules.forEach((c, j) => {
    for (const [id, n] of c.esp) {
      const r = rang.get(id);
      if (r === undefined) continue;
      profils[r][j] += n;
      totaux[r] += n;
    }
  });

  /* Chaque espèce est décrite par la façon dont ses observations se répartissent entre les
     cellules, non par leur nombre : sans cette normalisation, les espèces abondantes se
     retrouveraient toutes ensemble quelle que soit leur répartition. La racine carrée est la
     transformation de Hellinger, qui rend la distance euclidienne pertinente sur des
     profils de fréquences. */
  for (let r = 0; r < ids.length; r++) {
    const tot = totaux[r] || 1;
    for (let j = 0; j < nC; j++) profils[r][j] = Math.sqrt(profils[r][j] / tot);
  }
  return { ids, profils, totaux };
}

/* Arbre de Ward sur les espèces, calculé une seule fois.

   Les k-moyennes donnaient une partition nouvelle à chaque valeur de k : passer de cinq à six
   communautés bouleversait tout. Un arbre, lui, se coupe à n'importe quelle hauteur, et les
   partitions restent emboîtées — augmenter le nombre de communautés divise un groupe existant
   au lieu de tout redistribuer. On peut donc explorer du général au détail, jusqu'à deux cents
   groupes, sans le moindre recalcul.

   L'algorithme est celui de la chaîne des plus proches voisins, en temps quadratique là où
   la recherche naïve du minimum est cubique — indispensable au-delà de quelques centaines
   d'espèces. La mise à jour des distances suit la formule de Lance et Williams. */
function wardArbre(profils) {
  const n = profils.length, dim = profils[0].length;
  const D = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      let s2 = 0;
      const a = profils[i], b = profils[j];
      for (let z = 0; z < dim; z++) { const e = a[z] - b[z]; s2 += e * e; }
      D[i * n + j] = D[j * n + i] = s2;
    }
  }

  const vif = new Uint8Array(n).fill(1);
  const taille = new Int32Array(n).fill(1);
  const fusions = [];
  const chaine = [];

  // La chaîne s'allonge souvent sans conclure : c'est le nombre de fusions qui compte,
  // pas le nombre de tours.
  while (fusions.length < n - 1) {
    if (!chaine.length) {
      let d = 0; while (!vif[d]) d++;
      chaine.push(d);
    }
    let a = chaine[chaine.length - 1], b = -1, dmin = Infinity;
    for (let k = 0; k < n; k++) {
      if (!vif[k] || k === a) continue;
      const d = D[a * n + k];
      if (d < dmin || (d === dmin && k < b)) { dmin = d; b = k; }
    }
    if (chaine.length >= 2 && b === chaine[chaine.length - 2]) {
      chaine.pop(); chaine.pop();
      // On fusionne dans le plus petit indice, par convention, puis on met à jour les distances.
      const [x, y] = a < b ? [a, b] : [b, a];
      fusions.push([x, y, dmin]);
      const nx = taille[x], ny = taille[y];
      for (let k = 0; k < n; k++) {
        if (!vif[k] || k === x || k === y) continue;
        const nk = taille[k];
        const d = ((nx + nk) * D[x * n + k] + (ny + nk) * D[y * n + k] - nk * D[x * n + y])
          / (nx + ny + nk);
        D[x * n + k] = D[k * n + x] = d;
      }
      taille[x] = nx + ny;
      vif[y] = 0;
    } else {
      chaine.push(b);
    }
  }
  return fusions;
}

/* Coupe de l'arbre à une hauteur donnée : on rejoue toutes les fusions moins coûteuses que
   le seuil. Le nombre de communautés s'en déduit au lieu d'être imposé, ce qui donne des
   groupes de cohésion comparable — deux espèces réunies le sont toujours à la même distance,
   qu'elles appartiennent à un grand ensemble ou à une petite communauté isolée.
   Le curseur ne parcourt pas l'échelle des distances mais leur distribution : il désigne un
   quantile parmi les fusions. Les dernières fusions de Ward coûtent des ordres de grandeur
   de plus que les premières, si bien qu'une échelle géométrique laissait les trois quarts du
   curseur sans effet visible. Le seuil reste une hauteur — deux espèces réunies le sont
   toujours à la même distance —, mais son réglage devient progressif. */
/* Hauteur produisant approximativement k groupes : il faut appliquer les n − k fusions les
   moins coûteuses. L'algorithme de la chaîne ne les rend pas dans cet ordre, d'où le tri. */
function hauteurPourGroupes(fusions, n, k) {
  if (!fusions.length) return 0;
  const tri = fusions.map(f => f[2]).sort((a, b) => a - b);
  const i = Math.min(tri.length - 1, Math.max(0, n - k - 1));
  return tri[i];
}


function couperArbreHauteur(fusions, n, hauteur) {
  const parent = new Int32Array(n).map((_, i) => i);
  const racine = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  /* On applique toutes les fusions moins coûteuses que le seuil, sans s'arrêter à la
     première qui le dépasse : elles n'arrivent pas dans l'ordre des coûts. Le critère de
     Ward étant monotone, l'ensemble ainsi retenu forme bien une partition de l'arbre. */
  for (const [x, y, d] of fusions) {
    if (d <= hauteur) parent[racine(y)] = racine(x);
  }
  const numero = new Map();
  const sortie = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const r = racine(i);
    if (!numero.has(r)) numero.set(r, numero.size);
    sortie[i] = numero.get(r);
  }
  return sortie;
}

/* Nombre de communautés suggéré, par la méthode du coude. Les coûts de fusion de Ward
   croissent lentement tant qu'on réunit des espèces semblables, puis brutalement quand il
   faut rapprocher des ensembles distincts. Le coude est ce point de rupture : on cherche la
   fusion dont le coût s'écarte le plus de la tendance qui précède. */
function coudeDeWard(fusions) {
  const couts = fusions.map(f => f[2]).sort((a, b) => a - b);
  const n = couts.length;
  if (n < 8) return 2;
  let meilleur = 2, ecartMax = 0;
  // On ignore les extrémités, où le rapport est instable par construction.
  for (let i = Math.floor(n * 0.5); i < n - 2; i++) {
    const rapport = couts[i + 1] / (couts[i] || 1e-9);
    if (rapport > ecartMax) { ecartMax = rapport; meilleur = n - i; }
  }
  return Math.max(2, Math.min(40, meilleur));
}

function analyserCommunautes() {
  if (!bio || !bio.rang || !bio.cellules.length) return null;
  const { ids, profils, totaux } = profilsEspeces();
  if (ids.length < 4) return null;

  if (!commArbre || commArbre.n !== ids.length || commArbre.seuil !== seuilComm()) {
    const fusions = wardArbre(profils);
    commArbre = { n:ids.length, seuil:seuilComm(), fusions, coude:coudeDeWard(fusions) };
    // Première ouverture : on se place d'emblée sur le découpage que les données suggèrent.

  }
  // Nombre de communautés déduit de la taille moyenne visée, borné par le nombre d'espèces.
  const cible = NIVEAUX_COMM[commNiveau] || NIVEAUX_COMM.moyen;
  const vise = Math.max(2, Math.min(ids.length, Math.round(ids.length / cible)));
  const appartient = couperArbreHauteur(commArbre.fusions, ids.length,
    hauteurPourGroupes(commArbre.fusions, ids.length, vise));
  const parId = new Map(etat.especes.map(e => [e.id, e]));

  const groupes = new Map();
  ids.forEach((id, r) => {
    const c = appartient[r];
    if (!groupes.has(c)) groupes.set(c, { especes:[], rangs:[], parBio:new Map(), total:0 });
    const G = groupes.get(c);
    const e = parId.get(id);
    G.rangs.push(r);
    G.especes.push({ id, n:totaux[r], r,
      nom: e ? nomCourt(e.nom, e.nomFr) : '#' + id,
      photo: e ? e.photoPetite || e.photo : null,
      photoGrande: e ? e.photo || e.photoPetite : null });
  });

  /* Nom de la communauté : l'espèce dont la répartition colle le mieux à celle du groupe.
     On calcule le profil moyen, on retient le quart des espèces qui s'en écartent le moins,
     puis parmi elles la mieux observée — une espèce représentative mais confidentielle
     nommerait mal un groupe, et la plus abondante n'en est pas forcément typique. */
  const dim = profils[0].length;
  for (const G of groupes.values()) {
    const centre = new Float64Array(dim);
    for (const r of G.rangs) { const p = profils[r]; for (let z = 0; z < dim; z++) centre[z] += p[z]; }
    for (let z = 0; z < dim; z++) centre[z] /= G.rangs.length;

    const ecarts = G.especes.map(e => {
      let s2 = 0; const p = profils[e.r];
      for (let z = 0; z < dim; z++) { const d = p[z] - centre[z]; s2 += d * d; }
      return { e, s2 };
    }).sort((a, b) => a.s2 - b.s2);

    const proches = ecarts.slice(0, Math.max(3, Math.ceil(ecarts.length / 4)));
    proches.sort((a, b) => b.e.n - a.e.n);
    G.nom = proches[0].e.nom;
    G.centre = centre;
  }

  /* Espèces transgressives, au sens de la phytosociologie : celles qui appartiennent presque
     autant à une autre communauté qu'à la leur. On compare la distance au centre de son
     groupe à celle du deuxième plus proche ; quand l'écart est faible, l'affectation tient du
     tirage au sort et l'espèce fait en réalité le lien entre deux ensembles. Aucun calcul
     supplémentaire de fond : les centres sont déjà là. */
  const tousCentres = [...groupes.entries()];
  for (const [c, G] of groupes) {
    G.transgressives = 0;
    for (const e of G.especes) {
      const p = profils[e.r];
      let d1 = Infinity, d2 = Infinity, second = -1;
      for (const [c2, H] of tousCentres) {
        let s2 = 0;
        for (let z = 0; z < dim; z++) { const d = p[z] - H.centre[z]; s2 += d * d; }
        if (c2 === c) { d1 = s2; continue; }
        if (s2 < d2) { d2 = s2; second = c2; }
      }
      // Moins de 30 % d'écart entre les deux distances : l'appartenance est ambiguë.
      if (second >= 0 && d1 > 0 && Math.sqrt(d2 / d1) < 1.15) {
        e.aussi = second;
        G.transgressives++;
      }
    }
  }

  /* Une espèce transgressive figure dans les deux communautés dont elle est proche, comme
     dans la tradition phytosociologique. La signaler dans une seule n'avait pas de sens :
     c'est précisément parce qu'elle relie deux ensembles qu'elle mérite d'être nommée, et
     l'exemplaire emprunté est marqué pour qu'on ne le confonde pas avec un membre à part
     entière. */
  for (const [c, G] of groupes) {
    for (const e of G.especes.slice()) {
      if (e.aussi === undefined) continue;
      const H = groupes.get(e.aussi);
      if (!H) continue;
      H.especes.push({ ...e, emprunt:true, venuDe:c });
      H.transgressives = (H.transgressives || 0) + 1;
    }
  }

  // Où chaque communauté se tient : part de ses observations dans chaque biorégion.
  const rangDe = new Map(ids.map((id, r) => [id, r]));
  bio.cellules.forEach(c => {
    for (const [id, n] of c.esp) {
      const r = rangDe.get(id);
      if (r === undefined) continue;
      const G = groupes.get(appartient[r]);
      G.parBio.set(c.groupe, (G.parBio.get(c.groupe) || 0) + n);
      G.total += n;
    }
  });

  // De la plus fournie à la plus modeste, comme pour les biorégions.
  // Classement par masse d'observations : une communauté nombreuse mais confidentielle
  // ne prime pas sur une communauté plus étroite mais massivement documentée.
  /* Effectifs de l'inventaire, non de l'échantillon : la collecte ne ramène qu'une part des
     observations, si bien que compter celles chargées sous-estimait fortement le poids réel
     d'une communauté et rendait la comparaison entre elles dépendante du hasard du tirage. */
  const effectifReel = new Map(etat.especes.map(e => [e.id, e.nZone || 0]));

  for (const G of groupes.values()) {
    G.obs = G.especes.reduce((a, e) => a + (e.emprunt ? 0 : (effectifReel.get(e.id) || 0)), 0);
    /* Effectif propre : les transgressives empruntées à une autre communauté sont affichées
       ici mais appartiennent ailleurs. Les compter gonflerait les totaux et ferait dépasser
       la somme des communautés le nombre d'espèces classées. */
    G.nMembres = G.especes.reduce((a, e) => a + (e.emprunt ? 0 : 1), 0);
    G.nEmpruntees = G.especes.length - G.nMembres;
  }
  const liste = [...groupes.values()];
  // Une fois l'ordre fixé, on peut nommer la communauté voisine de chaque transgressive.
  const nomDe = new Map([...groupes.entries()].map(([c, G]) => [c, G.nom]));
  for (const G of liste) for (const e of G.especes)
    if (e.aussi !== undefined)
      e.aussiNom = nomDe.get(e.emprunt ? e.venuDe : e.aussi) || '';
  // Les membres d'abord, les empruntées ensuite : la liste décrit le noyau avant ses marges.
  for (const G of liste) {
    // Une espèce peut avoir été ajoutée comme emprunt alors qu'elle est déjà membre :
    // on ne garde alors que l'exemplaire de plein droit.
    const vus = new Set();
    G.especes = G.especes
      .sort((a, b) => (a.emprunt ? 1 : 0) - (b.emprunt ? 1 : 0) || b.n - a.n)
      .filter(e => !vus.has(e.id) && vus.add(e.id));
  }
  return liste;
}

/* Clic sur la carte d'une communauté : les observations proches du point, restreintes aux
   espèces du groupe. La restriction se fait après la requête, un filtre par
   identifiants portant sur plusieurs centaines de taxons dépassant la longueur d'une adresse. */
let cercleComm = null;
let commFond = 0, coucheFondComm = null, reperesComm = null;

/* Même rotation de fonds que les autres cartes : plan, relief, satellite, avec le calque de
   noms ajouté sur le satellite qui n'en porte aucun. */
function majFondComm() {
  if (!carteComm) return;
  if (coucheFondComm) { carteComm.removeLayer(coucheFondComm); coucheFondComm = null; }
  if (reperesComm) { carteComm.removeLayer(reperesComm); reperesComm = null; }
  const nom = ORDRE_FONDS[commFond % ORDRE_FONDS.length];
  const f = FONDS[nom];
  coucheFondComm = L.tileLayer(f.url, { attribution:f.attribution,
    maxZoom:f.maxZoom || 19, className:f.classe }).addTo(carteComm);
  coucheFondComm.bringToBack();
  if (nom === 'satellite') {
    reperesComm = L.tileLayer(REPERES.url, { attribution:REPERES.attribution,
      maxZoom:REPERES.maxZoom, opacity:0.9 }).addTo(carteComm);
  }
}

async function interrogerPointComm(ev, membres, teinte) {
  if (!carteComm) return;
  const r = Math.max(0.2, Math.min(40, 2000 / Math.pow(2, carteComm.getZoom())));
  const dist = formatDistance(r);
  if (cercleComm) carteComm.removeLayer(cercleComm);
  cercleComm = L.circle(ev.latlng, { radius:r * 1000, color:teinte, weight:1.5,
    dashArray:'5 4', fillColor:teinte, fillOpacity:0.06 }).addTo(carteComm);

  const bulle = L.popup({ maxWidth:290 }).setLatLng(ev.latlng)
    .setContent(`<div class="pop-tit">${t('cAutour')}</div>
      <div class="pop-sous">${t('cRecherche', dist)}</div>`).openOn(carteComm);
  bulle.on('remove', () => {
    if (cercleComm) { carteComm.removeLayer(cercleComm); cercleComm = null; }
  });

  const p = { ...filtres(false), lat:ev.latlng.lat.toFixed(5), lng:ev.latlng.lng.toFixed(5),
              radius:r.toFixed(3), per_page:200, locale:langue };
  try {
    const d = await appel('/observations/species_counts', p, false, true);
    const gardees = (d.results || []).filter(x => membres.has(x.taxon.id)).slice(0, 8);
    if (!gardees.length) {
      bulle.setContent(`<div class="pop-tit">${t('cAutour')}</div>
        <div class="pop-sous">${t('cAucune', dist)}</div>`);
      return;
    }
    bulle.setContent(`
      <div class="pop-tit">${t('cEspecesDans', nb(gardees.length), dist)}</div>
      <div class="pop-sous">${t('cPlusObs')} · ${t('cRayon', dist)}</div>
      <ul class="pop-liste">${gardees.map(x => {
        const tx = x.taxon;
        return `<li><a href="${lienDisque(tx.id, ev.latlng.lat, ev.latlng.lng, r)}"
          target="_blank" rel="noopener" style="text-decoration:none"
          ><span>${echap(nomCourt(tx.name, tx.preferred_common_name))}</span></a
          ><b>${nb(x.count)}</b></li>`;
      }).join('')}</ul>`);
  } catch (e) {
    bulle.setContent(`<div class="pop-tit">${t('cAutour')}</div>
      <div class="pop-sous">${t('cEchec')}</div>`);
  }
}

/* Répartition d'une communauté. Chaque cellule est teintée selon la part de ses observations
   appartenant à cette communauté — non selon leur nombre brut, qui ne dirait que la densité
   de prospection. Une cellule où la communauté représente les trois quarts des signalements
   est bien son domaine, qu'elle compte trente observations ou trois cents. */
/* Les communautés n'empruntent plus les teintes des biorégions. Les deux notions se lisent
   côte à côte et une même couleur y désignait des choses différentes — une région
   géographique d'un côté, un groupe d'espèces de l'autre —, ce qui laissait croire à une
   correspondance inexistante. Les fiches de communautés portent donc un gris neutre, et seuls
   les rubans de répartition conservent les teintes des biorégions, où elles ont un sens. */
const TEINTE_COMM = '#5D6E63';

let carteComm = null, coucheComm = null;

function carteCommunaute(i) {
  const G = comm && comm[i];
  if (!G || !bio) return;
  const teinte = TEINTE_COMM;
  const membres = new Set(G.especes.filter(e => !e.emprunt).map(e => e.id));

  const f = $('#bio-fen');
  f.innerHTML = `<div class="boite" style="border-top:8px solid ${teinte}; width:min(880px,100%)">
    <button class="discret fermer" id="bio-fen-x">${t('fermer')}</button>
    <div class="tit" style="margin:0">${echap(G.nom || t('commTitre', i + 1))}</div>
    <div class="k" style="margin:12px 0 8px">${t('commPart')}</div>
    <div class="carte-boite">
      <div id="carte-comm" style="height:min(60vh,460px); border:1px solid var(--trait);
        border-radius:var(--r); background:#DDE4D9"></div>
      <button id="comm-fond" class="sur-carte" data-tt="cFond">
        <svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true">
          <path d="M10 2.4 2.6 6.2 10 10l7.4-3.8z" fill="none" stroke="currentColor"
            stroke-width="1.5" stroke-linejoin="round"/>
          <path d="M3.4 9.6 10 13l6.6-3.4M3.4 13.2 10 16.6l6.6-3.4" fill="none"
            stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
  </div>`;
  f.hidden = false;
  brancherFermeture(f);

  setTimeout(async () => {
    const cible = document.getElementById('carte-comm');
    if (!cible) return;
    try {
      if (carteComm) { carteComm.remove(); carteComm = null; }
      carteComm = L.map(cible, { scrollWheelZoom:true });
      majFondComm();
      const bf = $('#comm-fond');
      if (bf) bf.addEventListener('click', () => {
        commFond = (commFond + 1) % ORDRE_FONDS.length;
        bf.classList.toggle('actif', commFond > 0);
        majFondComm();
      });
      // Le conteneur vient d'apparaître : Leaflet doit remesurer avant de placer les tuiles.
      carteComm.invalidateSize();
      carteComm.setView([46.6, 2.5], 5);
    } catch (e) {
      console.error('Carte de communauté :', e);
      return;
    }

    /* Tuiles servies par iNaturalist, filtrées sur les espèces de la communauté. On cartographie ainsi
       toutes leurs observations, et non le seul échantillon collecté pour l'analyse, qui
       n'en représente qu'une fraction variable selon le niveau de collecte choisi.

       La liste d'identifiants voyage dans l'adresse de chaque tuile : au-delà de quatre cents
       espèces on s'en tient aux mieux observées, faute de quoi l'adresse deviendrait trop
       longue pour certains serveurs intermédiaires. */
    const ids = G.especes.filter(e => !e.emprunt).map(e => e.id).slice(0, 400);
    if (!ids.length) return;

    const base = new URLSearchParams();
    for (const [k, v] of Object.entries(filtres(true))) {
      if (k === 'locale' || k === 'per_page') continue;
      base.set(k, v);
    }
    base.set('taxon_id', ids.join(','));

    let rendu = null;
    const redessiner = () => {
      const voulu = carteComm.getZoom() >= 13 ? 'points' : 'grid';
      if (voulu === rendu) return;
      rendu = voulu;
      if (coucheComm) { carteComm.removeLayer(coucheComm); coucheComm = null; }
      /* Couleurs d'iNaturalist : la grille garde le dégradé de densité d'iNaturalist,
         orange, et les points prennent le vert du site. Teinter la grille de la couleur de la
         communauté la rendait illisible — ce dégradé porte l'information d'effectif, et le
         remplacer par une teinte unie revenait à la perdre. */
      const p = new URLSearchParams(base);
      if (rendu === 'points') p.set('color', '#2F6B4F');
      coucheComm = L.tileLayer(API + '/' + rendu + '/{z}/{x}/{y}.png?' + p.toString(),
        { maxZoom:19, opacity:0.9, keepBuffer:1, updateWhenIdle:true,
          updateWhenZooming:false }).addTo(carteComm);
    };

    redessiner();
    carteComm.on('zoomend', redessiner);
    carteComm.on('click', ev => interrogerPointComm(ev, membres, teinte));

    // Cadrage sur l'emprise du lieu, la répartition venant maintenant du serveur.
    const b = bornesLocales();
    carteComm.invalidateSize();
    if (b) carteComm.fitBounds(b, { padding:[24, 24] });
  }, 40);
}

/* Classement des communautés. Trier par prédominance dans une biorégion donnée répond à une
   question précise : quelles communautés font la spécificité de cette région ? C'est la part
   des observations de la communauté qui tombe dans cette biorégion, non leur nombre. */
function ordonnerCommunautes(liste) {
  const c = [...liste];
  if (commTri === 'esp') c.sort((a, b) => b.nMembres - a.nMembres);
  else if (commTri.startsWith('bio:')) {
    const g = +commTri.slice(4);
    const part = G => (G.parBio.get(g) || 0) / (G.total || 1);
    c.sort((a, b) => part(b) - part(a));
  } else c.sort((a, b) => b.obs - a.obs);
  return c;
}

function dessinerCommunautes() {
  const v = $('#v-comm');
  if (!v) return;
  if (!bio) {
    v.innerHTML = `<div class="vide"><strong>${t('oComm')}</strong>${t('videComm')}</div>`;
    return;
  }
  if (!comm) comm = analyserCommunautes();
  if (comm) comm = ordonnerCommunautes(comm);
  if (!comm) {
    v.innerHTML = `<div class="vide">${t('bioMaigre')}</div>`;
    return;
  }

  v.innerHTML = `
    <div class="outils">
      <select id="comm-k">${[['large', 'commLarge'], ['moyen', 'commMoyen'], ['fin', 'commFin']]
        .map(([v, k]) => `<option value="${v}"${commNiveau === v ? ' selected' : ''}
          >${t(k)}</option>`).join('')}</select>
      <select id="comm-tri">
        <option value="obs"${commTri === 'obs' ? ' selected' : ''}>${t('commTriObs')}</option>
        <option value="esp"${commTri === 'esp' ? ' selected' : ''}>${t('commTriEsp')}</option>
        ${[...new Set(bio.cellules.map(c => c.groupe))].sort((a, b) => a - b).map(g =>
          `<option value="bio:${g}"${commTri === 'bio:' + g ? ' selected' : ''}
            >${t('commTriBio', g + 1)}</option>`).join('')}
      </select>
      <input type="text" id="comm-rech" class="rech" data-tp="commRech"
        placeholder="${echap(t('commRech'))}" autocomplete="off">
      <span class="compte">${t('commEsp', nb(comm.reduce((a, G) => a + G.nMembres, 0)))}</span>
    </div>
    <div id="comm-resultats" class="jetons" style="margin-bottom:6px"></div>
    <div class="planche">${comm.slice(commPage * 12, commPage * 12 + 12).map((G, iRel) => {
      const i = commPage * 12 + iRel;
      const parts = [...G.parBio.entries()].sort((a, b) => b[1] - a[1]);
      return `<div class="colonne" style="border-left:10px solid ${TEINTE_COMM}">
        <div class="entete"><div>
          <div class="k" style="margin:0 0 3px">${t('commTitre', i + 1)}</div>
          <div class="fr">${echap(G.nom || '')}</div>
          <div class="freq">${t('commEsp', nb(G.especes.length))}<br>${nb(G.obs)} ${t('obs')}</div>
        </div></div>
        <button class="apercu4" data-comm="${i}" aria-label="${echap(t('bioIndic'))}"
          >${G.especes.slice(0, 4).map(e => `<span>${e.photo
            ? `<img src="${echap(e.photo)}" loading="lazy" alt="">` : ''}</span>`).join('')}</button>
        <div style="padding:10px 12px">
          <button class="discret" data-carte-comm="${i}"
            style="width:100%; margin-bottom:10px">${t('commCarte')}</button>
          <div class="rubans">${parts.map(([g, n]) => `
            <span style="width:${Math.max(2, (n / (G.total || 1)) * 100).toFixed(1)}%;
              background:${BIO_TEINTES[g % BIO_TEINTES.length]}"
              title="${t('bioGroupe', g + 1)} · ${pourcent((n / (G.total || 1)) * 100)}"></span>`).join('')}</div>
        </div>
      </div>`;
    }).join('')}</div>
    ${comm.length > 12 ? `<div class="outils" style="margin-top:16px">
      <button class="discret" id="comm-prec"${commPage === 0 ? ' disabled' : ''}>‹</button>
      <span class="compte" style="margin-left:0">${commPage + 1} / ${
        Math.ceil(comm.length / 12)}</span>
      <button class="discret" id="comm-suiv"${(commPage + 1) * 12 >= comm.length
        ? ' disabled' : ''}>›</button>
    </div>` : ''}
    <p class="note">${t('commNote')}</p>`;

  const cp = $('#comm-prec'), cn = $('#comm-suiv');
  if (cp) cp.addEventListener('click', () => { commPage--; dessinerCommunautes(); });
  if (cn) cn.addEventListener('click', () => { commPage++; dessinerCommunautes(); });

  v.querySelectorAll('[data-carte-comm]').forEach(b => b.addEventListener('click', () => {
    carteCommunaute(+b.dataset.carteComm);
  }));

  v.querySelectorAll('[data-comm]').forEach(b => b.addEventListener('click', () => {
    const i = +b.dataset.comm;
    fenetreEspeces((comm[i].nom || t('commTitre', i + 1))
      + ' · ' + t('commEsp', nb(comm[i].nMembres)),
      comm[i].especes.slice(0, 24), TEINTE_COMM);
  }));

  /* Recherche d'espèce : elle porte sur les seules espèces retenues par l'analyse, donc
     aucune requête. Un clic ouvre la communauté à laquelle l'espèce appartient. */
  const cr = $('#comm-rech');
  if (cr) cr.addEventListener('input', () => {
    const q = cr.value.trim().toLowerCase();
    const cible = $('#comm-resultats');
    if (q.length < 2) { cible.innerHTML = ''; return; }
    const trouves = [];
    comm.forEach((G, i) => G.especes.forEach(e => {
      if (trouves.length < 10 && e.nom.toLowerCase().includes(q)) trouves.push({ e, i });
    }));

    /* Une espèce absente des communautés n'est pas introuvable : elle est le plus souvent
       sous le seuil de classement. Le dire vaut mieux que de ne rien afficher, ce qui
       laisserait croire à une faute de frappe. */
    const classees = new Set(trouves.map(x => x.e.id));
    const dehors = etat.especes
      .filter(e => !classees.has(e.id) && nomCourt(e.nom, e.nomFr).toLowerCase().includes(q))
      .slice(0, 6);

    cible.innerHTML = trouves.map(x =>
      `<span class="jeton" data-ouvrir-comm="${x.i}" style="cursor:pointer"
        >${echap(x.e.nom)}<small>${t('commTrouve', x.i + 1)}</small></span>`).join('')
      + dehors.map(e => `<span class="jeton pale">${echap(nomCourt(e.nom, e.nomFr))}<small>${
        e.nZone < seuilComm() ? t('commPeu', seuilComm()) : t('commAbsente')
      }</small></span>`).join('');
    cible.querySelectorAll('[data-ouvrir-comm]').forEach(b => b.addEventListener('click', () => {
      const i = +b.dataset.ouvrirComm;
      fenetreEspeces((comm[i].nom || t('commTitre', i + 1))
        + ' · ' + t('commEsp', nb(comm[i].nMembres)),
        comm[i].especes.slice(0, 24), TEINTE_COMM);
    }));
  });


  const ct = $('#comm-tri');
  if (ct) ct.addEventListener('change', e => {
    commTri = e.target.value; commPage = 0; dessinerCommunautes();
  });


  const ck = $('#comm-k');
  if (ck) {
    // L'arbre est conservé : changer de niveau ne coûte qu'une coupe, jamais un recalcul.
    ck.addEventListener('change', e => {
      commNiveau = e.target.value;
      comm = null; commPage = 0; dessinerCommunautes();
    });
  }
}



/* ============================================================
   Découvertes : les espèces vues pour la première fois dans la zone
   ============================================================ */

/* L'API ne sait pas dire « quelles espèces sont nouvelles ». On procède par différence :
   les espèces vues pendant la fenêtre, moins celles déjà connues avant. Les deux comptages
   sont groupés, species_counts acceptant des listes de taxons. Pour les dater, une seule
   requête triée par date croissante et restreinte à ces espèces suffit : on retient la
   première venue de chacune. Six requêtes en tout. */
let decouvertes = null, decEnCours = false, decMois = 60, bioTenteDec = false;
let decIntro = 'tout';       // « tout », « sans » ou « seul »
let decMondiales = false;   // n'afficher que les premières mondiales
/* Les paliers sont pris en entier : couper au milieu d'une tranche reviendrait à écarter des
   espèces de même ancienneté que celles conservées, au hasard de l'ordre de la liste. On
   accumule donc jusqu'à dépasser un seuil, puis on s'arrête net. */
const DEC_SEUIL = 12;        // on cesse d'élargir la fenêtre dès que ce nombre est atteint
const DEC_PAR_PAGE = 12;     // fiches par page
const DEC_PLAFOND = 96;      // datation maximale : chaque espèce coûte une requête
let decPage = 0;
const DEC_FENETRES = [1, 3, 6, 12, 24, 60];   // mois, du plus court au plus long


/* Une requête par espèce, triée par date croissante et limitée à un résultat : c'est la
   première observation, sans ambiguïté. J'avais tenté de grouper les quinze espèces en une
   seule requête, mais le tri par date les mélange — une espèce commune dans le monde remplit
   les premières pages à elle seule et les autres n'apparaissent jamais. */
async function premiereObs(params, sens = 'asc') {
  const base = { ...params, order_by:'observed_on', order:sens, per_page:1 };
  let d = null;
  if (await testerV2()) {
    try {
      d = await appel('/observations', { ...base, fields:'(id:!t,observed_on:!t)' }, true);
    } catch (e) { d = null; }
  }
  if (!d) d = await appel('/observations', base);
  const o = d.results && d.results[0];
  return o ? { obs:o.id, date:o.observed_on || '' } : null;
}

/* Espèces apparues dans la zone au cours des N derniers mois : celles vues pendant la
   fenêtre, moins celles déjà connues avant. */
async function nouveautes(mois, gen) {
  const f = filtres();
  const sansDates = !(await testerMoisV2(f));
  const debut = jour(ilYa(mois));
  const veille = jour(new Date(ilYa(mois).getTime() - 86400000));

  /* Une espèce de l'inventaire sans aucune observation avant cette date y est forcément
     apparue depuis. Une seule requête paginée suffit donc : celle des espèces déjà connues
     avant la fenêtre. Auparavant je demandais les espèces récentes, puis j'interrogeais leur
     passé par lots de deux cents — une vingtaine de requêtes pour le même résultat. */
  const avant = new Set();
  for (let page = 1; page <= 20; page++) {
    const d = await comptages({ ...f, d2:veille, per_page:500, page }, sansDates);
    verifier(gen);
    d.results.forEach(r => avant.add(r.taxon.id));
    if (d.results.length < 500) break;
  }
  /* Seules les espèces réellement présentes au niveau de validation courant : l'inventaire
     conserve les deux niveaux, et une espèce absente de celui-ci n'a évidemment aucune
     observation avant la fenêtre — elle passait pour une nouveauté avant d'échouer à la
     datation, gonflant le décompte de candidates et vidant la liste affichée. */
  return { ids: etat.especes.filter(e => e.nZone > 0 && !avant.has(e.id)).map(e => e.id), debut };
}

async function chargerDecouvertes() {
  if (decEnCours || !etat.especes.length) return;
  decEnCours = true; bioTenteDec = true;
  const gen = generation;
  const f = filtres();

  try {
    dessinerDecouvertes();

    /* Chaque palier apporte une tranche d'ancienneté : ce qui est nouveau depuis trois mois,
       puis ce qui l'est depuis six sans l'être depuis trois, et ainsi de suite. En empilant
       ces tranches dans l'ordre, on obtient un classement par récence sans avoir daté quoi que
       ce soit. On s'arrête dès qu'il y en a assez pour remplir l'écran. */
    let nouvelles = [], debut = null, fenetre = DEC_FENETRES[0];
    const vus = new Set();
    for (const mois of DEC_FENETRES) {
      progression(t('decCharge'), 10 + (DEC_FENETRES.indexOf(mois) / DEC_FENETRES.length) * 50);
      const r = await nouveautes(mois, gen);
      verifier(gen);
      const tranche = r.ids.filter(id => !vus.has(id));
      tranche.forEach(id => vus.add(id));
      nouvelles = nouvelles.concat(tranche);
      debut = r.debut; fenetre = mois;
      if (nouvelles.length >= DEC_SEUIL) break;
    }
    decMois = fenetre;

    if (!nouvelles.length) {
      decouvertes = [];
      progression(t('mComplet'), null);
      return;                       // le rendu final a lieu dans le bloc « finally »
    }
    nouvelles = nouvelles.slice(0, DEC_PLAFOND);
    // Veille du début de la fenêtre retenue : sert à écarter les espèces déjà connues ailleurs.
    const veille = jour(new Date(ilYa(fenetre).getTime() - 86400000));

    // Date de première observation dans la zone, espèce par espèce.
    const premieres = new Map();
    for (let i = 0; i < nouvelles.length; i++) {
      progression(t('decCharge'), 60 + (i / nouvelles.length) * 30);
      const o = await premiereObs({ ...f, taxon_id:nouvelles[i], d1:debut });
      verifier(gen);
      if (o) premieres.set(nouvelles[i], o);
    }

    /* Première mondiale, en deux temps pour ne pas gaspiller de requêtes. Un comptage groupé
       écarte d'abord toutes les espèces déjà signalées quelque part avant la fenêtre : leur
       première mondiale est forcément antérieure. Il ne reste qu'une poignée de candidates,
       qu'on confirme une par une en comparant la date de leur plus ancienne observation
       mondiale à la nôtre. */
    const parId = new Map(etat.especes.map(e => [e.id, e]));
    const monde = { captive:'false', locale:langue };
    if (etat.qualite === 'research') monde.quality_grade = 'research';

    const ailleursAvant = new Set();
    for (let i = 0; i < nouvelles.length; i += 300) {
      const d = await comptages({ ...monde, d2:veille, per_page:500,
        taxon_id: nouvelles.slice(i, i + 300).join(',') }, !(await testerMoisV2(f)));
      verifier(gen);
      d.results.forEach(r => ailleursAvant.add(r.taxon.id));
    }

    const mondiales = new Map();
    for (const id of nouvelles) {
      if (ailleursAvant.has(id) || !premieres.has(id)) continue;
      progression(t('decCharge'), 92);
      const g = await premiereObs({ ...monde, taxon_id:id });
      verifier(gen);
      if (g) mondiales.set(id, g);
    }

    const liste = [];
    for (const id of nouvelles) {
      const p = premieres.get(id);
      if (!p) continue;
      const g = mondiales.get(id);
      liste.push({
        e: parId.get(id) || { id, nom:'#' + id, nomFr:'' },
        obs:p.obs, date:p.date,
        mondiale: !!(g && g.date && p.date && g.date === p.date)
      });
    }
    liste.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    decouvertes = liste; decPage = 0;
    progression(t('mComplet'), null);
  } catch (e) {
    if (!(e instanceof Annule)) progression(t('mEchec', String(e.message || e)), null);
  } finally {
    decEnCours = false;
    dessinerDecouvertes();
  }
}

function dessinerDecouvertes() {
  const v = $('#v-decouverte');
  if (!etat.especes.length) return;
  if (!decouvertes && !decEnCours) {
    v.innerHTML = `<div class="outils">
        <button class="primaire" id="dec-lancer">${t('lancerRecherche')}</button>
        <span class="compte">${t('coutRequetes', 25)}</span>
      </div>
      <div class="vide">${bioTenteDec ? t('decVide') : t('videDecouverte')}</div>
      <p class="note">${t('decNote')}</p>`;
    $('#dec-lancer').addEventListener('click', () => enTache(chargerDecouvertes));
    return;
  }
  let toutes = decouvertes || [];
  if (decIntro !== 'tout')
    toutes = toutes.filter(x => estIntroduite(x.e.id) === (decIntro === 'seul'));
  const liste = decMondiales ? toutes.filter(x => x.mondiale) : toutes;

  v.innerHTML = `
    <div class="outils">
      <select id="d-intro">
        <option value="tout"${decIntro === 'tout' ? ' selected' : ''}>${t('filtreIntroTout')}</option>
        <option value="sans"${decIntro === 'sans' ? ' selected' : ''}>${t('filtreIntroSans')}</option>
        <option value="seul"${decIntro === 'seul' ? ' selected' : ''}>${t('filtreIntroSeul')}</option>
      </select>
      ${toutes.some(x => x.mondiale) ? `<select id="d-mondiale">
        <option value=""${decMondiales ? '' : ' selected'}>${t('decFiltreTout')}</option>
        <option value="1"${decMondiales ? ' selected' : ''}>${t('decFiltreMond')}</option>
      </select>` : ''}
      <span class="compte">${liste.length ? t('decNb', nb(liste.length))
        : (decEnCours ? t('decCharge') : '')}${liste.length
          ? ' · ' + t('decFenetre', dureeTexte(decMois)) : ''}</span>
    </div>
    ${liste.length ? `<div class="planche">${liste.slice(decPage * DEC_PAR_PAGE,
      (decPage + 1) * DEC_PAR_PAGE).map(x => `
      <div class="fiche${x.mondiale ? ' mondiale' : ''}">
        ${pastilleIntro(x.e.id)}
        <a class="img" href="https://www.inaturalist.org/observations/${x.obs}"
           target="_blank" rel="noopener">${x.e.photo
          ? `<img src="${vignette(x.e)}" loading="lazy" decoding="async" alt="">`
          : ''}${x.mondiale ? `<span class="drapeau">${t('decMondiale')}</span>` : ''}</a>
        <div class="corps">${blocNoms(x.e.nom, x.e.nomFr)}
          <div class="date">${echap(x.date)}</div></div>
      </div>`).join('')}</div>`
      : `<div class="vide">${decEnCours ? t('decCharge') : t('decVide')}</div>`}
    ${liste.length > DEC_PAR_PAGE ? `<div class="outils" style="margin-top:16px">
      <button class="discret" id="dec-prec"${decPage === 0 ? ' disabled' : ''}>‹</button>
      <span class="compte" style="margin-left:0">${decPage + 1} / ${
        Math.ceil(liste.length / DEC_PAR_PAGE)}</span>
      <button class="discret" id="dec-suiv"${(decPage + 1) * DEC_PAR_PAGE >= liste.length
        ? ' disabled' : ''}>›</button>
    </div>` : ''}
    <p class="note">${t('decNote')}</p>`;

  const di = $('#d-intro');
  if (di) di.addEventListener('change', e => {
    decIntro = e.target.value; decPage = 0; dessinerDecouvertes();
  });

  const dm = $('#d-mondiale');
  if (dm) dm.addEventListener('change', e => {
    decMondiales = !!e.target.value; decPage = 0; dessinerDecouvertes();
  });
  const dp = $('#dec-prec'), ds = $('#dec-suiv');
  if (dp) dp.addEventListener('click', () => { decPage--; dessinerDecouvertes(); });
  if (ds) ds.addEventListener('click', () => { decPage++; dessinerDecouvertes(); });

}

/* ============================================================
   Saisonnalité détaillée : pic par espèce, successions, renouvellement
   ============================================================ */



/* 1. Ce qu'il faut chercher ce mois-ci : les espèces dont c'est le mois le plus fourni. */
/* Mois où chaque espèce culmine. Sert à la fois à remplir la liste et à savoir quels mois
   n'ont rien à proposer — ceux-là sont grisés dans le menu plutôt que de renvoyer une page
   vide après un clic inutile. */
function picsParMois() {
  const compte = new Array(12).fill(0);
  const pic = new Map();
  if (!etat.phenologie) return { compte, pic };
  etat.phenologie.forEach((mens, id) => {
    const total = mens.reduce((a, b) => a + b, 0);
    if (total < 5) return;                       // sous cinq observations, le pic est du hasard
    let m = 0;
    for (let i = 1; i < 12; i++) if (mens[i] > mens[m]) m = i;
    pic.set(id, m);
    compte[m]++;
  });
  return { compte, pic };
}

function panneauChercher() {
  const mois = vue.moisChercher || (new Date().getMonth() + 1);
  const tri = vue.triChercher || 'obs';
  const parId = new Map(etat.especes.map(e => [e.id, e]));
  const { compte, pic } = picsParMois();
  const liste = [];
  etat.phenologie.forEach((mens, id) => {
    if (pic.get(id) !== mois - 1) return;
    const total = mens.reduce((a, b) => a + b, 0);
    const e = parId.get(id);
    if (!e) return;
    const pique = mens[mois - 1];
    // La responsabilité est la part des observations de référence réalisées dans la zone.
    const resp = e.nMonde >= Math.max(seuilMin, 1) ? e.nZone / e.nMonde : null;
    if (tri === 'resp' && resp === null) return;
    liste.push({ e, n:pique, part:pique / total, resp });
  });
  liste.sort((a, b) => tri === 'resp' ? b.resp - a.resp : b.n - a.n);

  return `
    <div class="outils" style="margin-top:30px">
      <span class="tit" style="margin:0">${t('aChercher')}</span>
      <select id="s-mois">${MOIS.map((m, i) =>
        `<option value="${i+1}"${i + 1 === mois ? ' selected' : ''}${
          compte[i] ? '' : ' disabled'}>${m}${compte[i] ? '' : ' —'}</option>`).join('')}</select>
      <select id="s-tri">
        <option value="obs"${tri === 'obs' ? ' selected' : ''}>${t('triPic')}</option>
        <option value="resp"${tri === 'resp' ? ' selected' : ''}>${t('triResp')}</option>
      </select>
      <span class="compte">${nb(liste.length)} ${t('especes')} · ${t('aChercherD')}</span>
    </div>
    ${liste.length ? `<div class="planche">${liste.slice(picPage * PIC_PAR_PAGE,
      (picPage + 1) * PIC_PAR_PAGE).map(x => `
      <div class="fiche">
        ${pastilleIntro(x.e.id, true)}
        <a class="img" href="${lienTaxon(x.e.id, true)}" target="_blank" rel="noopener">${x.e.photo
          ? `<img src="${vignette(x.e)}" loading="lazy" decoding="async" alt="">`
          : ''}<span class="num">${Math.round(x.part * 100)} %</span></a>
        <div class="corps">
          <a href="${lienTaxon(x.e.id, true)}" target="_blank" rel="noopener"
             style="text-decoration:none">${blocNoms(x.e.nom, x.e.nomFr)}</a>
          <div class="bas"><a class="n" href="${lienINat(x.e.id, mois, 'map')}"
            target="_blank" rel="noopener">${tri === 'resp' && x.resp !== null
            ? pourcent(x.resp * 100) : nb(x.n) + ' ' + t('obs')}</a></div>
        </div>
      </div>`).join('')}</div>`
      : `<div class="vide">${t('aucunPic')}</div>`}
    ${liste.length > PIC_PAR_PAGE ? `<div class="outils" style="margin-top:16px">
      <button class="discret" id="p-prec"${picPage === 0 ? ' disabled' : ''}>‹</button>
      <span class="compte" style="margin-left:0">${picPage + 1} / ${
        Math.ceil(liste.length / PIC_PAR_PAGE)}</span>
      <button class="discret" id="p-suiv"${(picPage + 1) * PIC_PAR_PAGE >= liste.length
        ? ' disabled' : ''}>›</button>
    </div>` : ''}
    <p class="note">${t('noteChercher')}</p>`;

}





function brancherSaison() {
  const pp = $('#p-prec'), ps = $('#p-suiv');
  if (pp) pp.addEventListener('click', () => { picPage--; dessinerSaison(); });
  if (ps) ps.addEventListener('click', () => { picPage++; dessinerSaison(); });


  const sm = $('#s-mois');
  if (sm) sm.addEventListener('change', e => {
    vue.moisChercher = +e.target.value; picPage = 0; dessinerSaison();
  });
  const st = $('#s-tri');
  if (st) st.addEventListener('change', e => {
    vue.triChercher = e.target.value; picPage = 0; dessinerSaison();
  });


}

function dessinerSaison() {
  const v = $('#v-saison');
  if (!etat.mensuel) return;
  const d = etat.mensuel;
  const valides = d.filter(l => l.especes !== null && l.especes !== undefined);
  if (!valides.length) return;
  v.innerHTML = `
    <div class="outils">
      <span class="tit" style="margin:0">${t('grapheMois')}</span>
    </div>
    <div class="graphe">${graphiqueMensuel()}</div>
    <div class="legende">
      <span><i style="background:#6E8B63"></i> ${t('legEspMois')}</span>
      <span><i style="background:#7B3B52"></i> ${t('legPicMois')}</span>
    </div>

    ${etat.phenologie ? panneauChercher() : ''}`;

  brancherSaison();
}

function graphiqueMensuel() {
  const d = etat.mensuel, L = 60, R = 30, H = 240, T = 18, B = 34, W = 900;
  const largeur = W - L - R, hauteur = H - T - B;
  const pas = largeur / 12;

  /* Barres simples : les espèces effectivement relevées dans le mois. Le complément estimé
     par Chao1 et ACE a été retiré — sur des listes mensuelles souvent tronquées, il donnait
     une hauteur confiante et mal fondée. */
  const maxTot = Math.max(...d.map(l => l.especes || 0), 1);

  const barres = d.map((l, i) => {
    const vues = l.especes || 0;
    const hVues = (vues / maxTot) * hauteur;
    const x = (L + i*pas + pas*0.16).toFixed(1);
    const w = (pas*0.68).toFixed(1);
    return `<rect x="${x}" y="${(T + hauteur - hVues).toFixed(1)}" width="${w}"
        height="${hVues.toFixed(1)}" fill="#6E8B63" rx="1"
        ><title>${MOIS[i]} — ${t('legEspMois')} : ${nb(vues)}</title></rect>`;
  }).join('');


  /* Les espèces dont c'est le mois de pic, en courbe : cette série n'a pas la même unité que
     les barres et son échelle lui est propre, indiquée à droite. */
  const pics = etat.phenologie ? picsParMois().compte : new Array(12).fill(0);
  const maxPic = Math.max(...pics, 1);
  const ptsPic = pics.map((n, i) =>
    `${(L + i*pas + pas/2).toFixed(1)},${(T + hauteur - (n / maxPic) * hauteur).toFixed(1)}`);
  const courbePic = pics.some(x => x)
    ? `<polyline points="${ptsPic.join(' ')}" fill="none" stroke="#7B3B52" stroke-width="2"
        stroke-linejoin="round" stroke-linecap="round"/>`
      + ptsPic.map((q, i) => `<circle cx="${q.split(',')[0]}" cy="${q.split(',')[1]}" r="2.6"
        fill="#7B3B52"><title>${MOIS[i]} — ${t('legPicMois')} : ${
        nb(pics[i])}</title></circle>`).join('')
    : '';

  const etiquettes = d.map((l, i) =>
    `<text x="${(L + i*pas + pas/2).toFixed(1)}" y="${H-16}" text-anchor="middle" font-size="11"
      fill="#8B9990" font-family="IBM Plex Mono, monospace">${MOIS_C[i]}</text>`).join('');

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img"
      aria-label="${echap(t('grapheMensuel'))}">
    <line x1="${L}" y1="${T+hauteur}" x2="${W-R}" y2="${T+hauteur}" stroke="#C6CEC1"/>
    ${barres}${courbePic}
    <text x="${L}" y="${T-4}" font-size="11" fill="#7A8B3C"
      font-family="IBM Plex Mono, monospace">${nb(Math.round(maxTot))} ${t('especes')}</text>
    ${pics.some(x => x) ? `<text x="${W-R}" y="${T-4}" text-anchor="end" font-size="11"
      fill="#7B3B52" font-family="IBM Plex Mono, monospace">${nb(maxPic)} ${t('legPicMois')}</text>` : ''}
    ${etiquettes}
  </svg>`;
}




/* ============================================================
   Déclaration des onglets
   ============================================================ */

/* La carte du site, et le seul endroit où l'ordre compte : celui des déclarations est celui
   du chargement différé. La liste d'abord, puisqu'elle est sous les yeux ; la responsabilité
   ensuite, dont la requête est peu coûteuse et la vue très consultée ; la saisonnalité en
   dernier, qui demande douze requêtes. Découvertes et disparitions n'ont pas de « fond » :
   elles coûtent une quarantaine de requêtes pour des onglets qu'on n'ouvrira pas toujours,
   et attendent donc une demande explicite. */

module({
  id: 'liste',
  tot: true,                    // utilisable avant même que la taxonomie soit chargée
  dessiner: dessinerListe,
  vider(carton) { indexEspeces = null; $('#v-liste').innerHTML = carton; },
  manque: () => !etat.annees,
  async fond() { await chargerAnnees(); dessinerListe(); }   // alimente le bandeau de chiffres
});

/* Le champ de référence n'existe que dans cet outil : le socle se contente de prévenir. */
surReference = r => {
  const c = $('#r-ref');
  if (c) c.value = r ? r.nom : '';
  majBoutonRef();
};

module({
  id: 'responsabilite',
  tot: true,
  pret: () => etat.especes.some(e => e.nm && e.nm[etat.qualite] !== null
    && e.nm[etat.qualite] !== undefined),
  dessiner: dessinerResponsabilite,
  vider(carton) { seuilMin = 1; $('#r-tableau').innerHTML = carton; $('#r-compte').textContent = ''; },
  manque: () => !etat.refFaite[etat.qualite],
  async fond() {
    await chargerEffectifsMondiaux();
    dessinerResponsabilite();
    if (vue.tri === 'resp') dessinerListe();   // la liste peut être triée par responsabilité
  }
});

module({
  id: 'saison',
  pret: () => !!etat.mensuel,
  dessiner: dessinerSaison,
  vider(carton) { $('#v-saison').innerHTML = carton; },
  manque: () => !etat.phenologie,
  async fond() {
    await chargerMensuel();
    dessinerSaison();
    dessinerListe();            // le menu des mois cesse d'être grisé
  }
});

module({
  id: 'decouverte',
  pret: () => !!decouvertes,
  arreter() { decEnCours = false; },
  dessiner: dessinerDecouvertes,
  ouvrir: dessinerDecouvertes,
  vider(carton) { decouvertes = null; $('#v-decouverte').innerHTML = carton; },
  // La fenêtre retenue fait partie du résultat : la relire sans elle n'aurait pas de sens.
  garder: () => ({ decouvertes, decMois }),
  reprendre(d) { decouvertes = d.decouvertes || null; if (d.decMois) decMois = d.decMois; }
});

module({
  id: 'disparition',
  pret: () => !!disparitions,
  arreter() { disEnCours = false; },
  dessiner: dessinerDisparitions,
  ouvrir: dessinerDisparitions,
  vider(carton) { disparitions = null; $('#v-disparition').innerHTML = carton; },
  garder: () => ({ disparitions, disMois }),
  reprendre(d) { disparitions = d.disparitions || null; if (d.disMois) disMois = d.disMois; }
});

module({
  id: 'bio',
  pret: () => !!bio,
  /* Pas de « dessiner » : l'analyse coûte plusieurs minutes et ne se relance pas d'elle-même.
     L'onglet se peint à son ouverture, à partir de ce qu'il retrouve en réserve. */
  ouvrir() { releverMemoireBio().then(dessinerBioregions); },
  vider(carton) {
    bio = null; bioTente = false; carteBio = null; vueBio = null; anneauxLieu = null;
    $('#v-bio').innerHTML = carton;
  }
});

module({
  id: 'comm',
  pret: () => !!bio,          // les communautés se déduisent des mêmes données
  ouvrir: dessinerCommunautes,
  vider() { comm = null; commArbre = null; }
});


/* ============================================================
   Démarrage
   ============================================================ */

demarrer([
  () => {
    $('#f-seuil').innerHTML = [1, 10, 100]
      .map(v => `<option value="${v}"${v === seuilMin ? ' selected' : ''}>${t('seuilObs', v)}</option>`)
      .join('');
  }
]);
