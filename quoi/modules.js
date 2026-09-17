/* ============================================================
   Cequivitici · Identification
   ============================================================

   L'outil ne détermine pas à ta place, et ne décrit aucun caractère : iNaturalist n'a pas de
   base de traits morphologiques, et prétendre en avoir une serait mentir. Il fait deux choses
   qu'aucune clé ne fait.

   Il dit ce qui est plausible ici et en ce moment. Trois candidats à 42, 11 et 2 % des
   observations locales de leur genre ne se traitent pas comme trois candidats à égalité, et
   c'est une information qu'aucune flore ne donne, parce qu'elle dépend du lieu et de la date.

   Et il met les candidats côte à côte sous le même filtre — même stade, même sexe, même
   saison. Comparer une femelle à un mâle est la première source d'erreur, et c'est
   exactement ce que produit une recherche d'images ordinaire.

   Un biais à garder en tête, et l'outil le dit sous la liste : la fréquence d'observation
   n'est pas la fréquence des individus. Les espèces spectaculaires, diurnes et faciles sont
   massivement sur-représentées. */

/* La fenêtre : quatre semaines autour d'aujourd'hui, ou un mois, ou toute l'année. C'est le
   réglage central de l'outil — la plausibilité d'un candidat n'a de sens qu'à une date. */
let quandVoir = FENETRE;         // FENETRE, 0 pour toute l'année, ou 1 à 12
peutCharger = () => !!(etat.lieux.length || etat.taxons.length || etat.zone);

/* L'effectif d'une espèce dans la période retenue. */
function effectif(e) {
  if (quandVoir === 0) return e.nZone;
  const m = (etat.moisCache.get(etat.qualite + ':' + quandVoir) || {}).parId;
  return m ? (m.get(e.id) || 0) : 0;
}

const periodePrete = () => periodeEnMemoire(quandVoir);
const fenetreIndispo = () =>
  !!(etat.moisCache.get(etat.qualite + ':' + FENETRE) || {}).indispo;


/* ---- Modèle géographique ------------------------------------------------- */

/* Le modèle géographique d'iNaturalist dit, maille par maille, où une espèce est attendue.
   Il n'a pas d'interface de requête : il n'existe qu'en tuiles de carte. On lit donc les
   pixels des tuiles, aux points de la zone d'étude. L'API autorise cette lecture
   (Access-Control-Allow-Origin: *) ; une tuile sans données revient transparente, une espèce
   que le modèle ne connaît pas revient en erreur 500.

   Les tuiles sont gardées réduites à 128 × 128 (le maximum de chaque bloc) : une maille du
   modèle mesure une quarantaine de kilomètres, et à ce niveau de zoom un pixel réduit en fait
   moins de trois. On lit au plus quatre tuiles à la fois. */

const tuilesGeo = new Map();          // url → Promise<{ statut, alpha }>
const GEO_COTE = 128;
let geoEnCours = 0;
const geoFile = [];

function geoLimiter(fn) {
  return new Promise((ok, ko) => { geoFile.push({ fn, ok, ko }); geoPomper(); });
}
function geoPomper() {
  while (geoEnCours < 4 && geoFile.length) {
    const { fn, ok, ko } = geoFile.shift();
    geoEnCours++;
    fn().then(ok, ko).finally(() => { geoEnCours--; geoPomper(); });
  }
}

function lireTuileGeo(url) {
  if (tuilesGeo.has(url)) return tuilesGeo.get(url);
  const p = geoLimiter(async () => {
    try {
      const r = await fetch(url);
      if (!r.ok) return { statut:r.status, alpha:null };
      const bmp = await createImageBitmap(await r.blob());
      // Réduction par maximum : un lissage ordinaire effacerait une maille isolée.
      const src = document.createElement('canvas');
      src.width = bmp.width; src.height = bmp.height;
      const gs = src.getContext('2d');
      gs.drawImage(bmp, 0, 0);
      const d = gs.getImageData(0, 0, bmp.width, bmp.height).data;
      const k = bmp.width / GEO_COTE, alpha = new Uint8Array(GEO_COTE * GEO_COTE);
      for (let y = 0; y < bmp.height; y++) for (let x = 0; x < bmp.width; x++) {
        const a = d[(y * bmp.width + x) * 4 + 3];
        const i = Math.floor(y / k) * GEO_COTE + Math.floor(x / k);
        if (a > alpha[i]) alpha[i] = a;
      }
      return { statut:200, alpha };
    } catch (e) {
      return { statut:0, alpha:null };     // réseau coupé, ou lecture refusée
    }
  });
  tuilesGeo.set(url, p);
  if (tuilesGeo.size > 600) tuilesGeo.delete(tuilesGeo.keys().next().value);
  return p;
}

/* Où l'on interroge le modèle.

   Au départ d'une observation ou d'un point, c'est ce point-là qui compte, et lui seul : la
   question est « cette espèce est-elle attendue là où la photo a été prise ? ». On lit la
   tuile de niveau 8, où une maille du modèle couvre une trentaine de pixels réduits, au
   pixel du point. Une position floutée par son auteur n'est connue qu'à une vingtaine de
   kilomètres près : on sonde alors une grille de 5 × 5 sur ce carré.

   Sans point, on sonde une grille de 5 × 5 sur l'emprise de la zone, au niveau de zoom où
   elle tient dans une ou deux tuiles. */
function pointTuile(lat, lng, z) {
  const m = 2 ** z, r = Math.max(-85, Math.min(85, lat)) * Math.PI / 180;
  const fx = (lng + 180) / 360 * m;
  const fy = (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * m;
  return { z, x:Math.floor(fx), y:Math.floor(fy),
    px:Math.floor((fx % 1) * GEO_COTE), py:Math.floor((fy % 1) * GEO_COTE) };
}

const auPoint = () => !!(depart && depart.point && depart.applique);

function grille(s, n, o, e, z) {
  const pts = [];
  for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++)
    pts.push(pointTuile(s + (n - s) * (i + 0.5) / 5, o + (e - o) * (j + 0.5) / 5, z));
  return pts;
}

function echantillonsGeo() {
  if (auPoint()) {
    const [lat, lng] = depart.point;
    if (!depart.fiche || !depart.fiche.floute) return [pointTuile(lat, lng, 8)];
    const dLat = 0.1, dLng = 0.1 / Math.max(Math.cos(lat * Math.PI / 180), 0.1);
    return grille(lat - dLat, lat + dLat, lng - dLng, lng + dLng, 8);
  }
  const b = bornesLocales();
  if (!b || !b.isValid()) return null;
  const s = b.getSouth(), n = b.getNorth(), o = b.getWest(), e = b.getEast();
  const etendue = Math.max(e - o, 0.05);
  const z = Math.max(3, Math.min(8, Math.round(Math.log2(360 / etendue)) - 1));
  return grille(s, n, o, e, z);
}

const cleZoneGeo = () => {
  if (auPoint()) return 'pt:' + depart.point.join(',') + (depart.fiche && depart.fiche.floute ? ':f' : '');
  const b = bornesLocales();
  return b && b.isValid() ? b.toBBoxString() : '';
};

/* 'oui' : attendue quelque part dans la zone · 'non' : nulle part dans la zone ·
   'inconnu' : le modèle ne connaît pas l'espèce, ou la lecture a échoué. */
const presencesGeo = new Map();       // zone|id → Promise<'oui' | 'non' | 'inconnu'>

function presenceAttendue(id) {
  const cle = cleZoneGeo() + '|' + id;
  if (presencesGeo.has(cle)) return presencesGeo.get(cle);
  const pts = echantillonsGeo();
  const p = !pts ? Promise.resolve('inconnu') : (async () => {
    const tuiles = new Map();
    for (const q of pts) tuiles.set(`${q.z}/${q.x}/${q.y}`, q);
    let lu = false;
    for (const cle of tuiles.keys()) {
      const r = await lireTuileGeo(`${TUILES_INAT}/geomodel/${id}/${cle}.png?thresholded=true`);
      if (r.statut !== 200) return 'inconnu';
      lu = true;
      for (const q of pts) {
        if (`${q.z}/${q.x}/${q.y}` !== cle) continue;
        // Un voisinage de 3 × 3 : le bord d'une maille ne doit pas faire basculer le verdict.
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const x = Math.min(GEO_COTE - 1, Math.max(0, q.px + dx));
          const y = Math.min(GEO_COTE - 1, Math.max(0, q.py + dy));
          if (r.alpha[y * GEO_COTE + x] > 8) return 'oui';
        }
      }
    }
    return lu ? 'non' : 'inconnu';
  })();
  presencesGeo.set(cle, p);
  return p;
}

/* Verdicts déjà résolus, pour l'affichage immédiat. La clé porte le lieu interrogé : passer
   de la zone au point, ou d'un point à un autre, ne doit pas réutiliser un ancien verdict. */
const geoConnu = {
  m: new Map(),
  cle: id => cleZoneGeo() + '|' + id,
  get(id) { return this.m.get(this.cle(id)); },
  has(id) { return this.m.has(this.cle(id)); },
  set(id, v, cle) { this.m.set(cle || this.cle(id), v); },
  clear() { this.m.clear(); }
};

function badgeGeo(id) {
  const v = geoConnu.get(id);
  if (auPoint()) {
    if (v === 'non') return `<span class="marque hors-geo" title="${echap(t('geoPtNonTitre'))}">${t('geoPtNon')}</span>`;
    if (v === 'oui') return `<span class="marque geo-oui" title="${echap(t('geoPtOuiTitre'))}">${t('geoPtOui')}</span>`;
    if (v === 'inconnu') return `<span class="marque geo-muet" title="${echap(t('geoMuetTitre'))}">${t('geoMuet')}</span>`;
    return '';
  }
  return v === 'non'
    ? `<span class="marque hors-geo" title="${echap(t('geoHorsTitre'))}">${t('geoHors')}</span>` : '';
}

/* Sonde en arrière-plan les espèces affichées et pose le badge là où il manque. */
function sonderGeo(ids) {
  for (const id of ids) {
    if (geoConnu.has(id)) continue;
    const cle = geoConnu.cle(id);
    presenceAttendue(id).then(v => {
      geoConnu.set(id, v, cle);
      if (cle !== geoConnu.cle(id)) return;          // le lieu a changé entre-temps
      document.querySelectorAll(`[data-geo="${id}"]`).forEach(x => { x.innerHTML = badgeGeo(id); });
      if (v === 'non') dessinerBilanSiOuvert();
      if (vueGeo === 'attendues' && v === 'non') planifierCandidats();
    });
  }
}

/* Les espèces hors inventaire que l'utilisateur a retenues : attendues ici, jamais vues. */
const especesHors = new Map();
const especeConnue = id => especeParId(id) || especesHors.get(id) || null;
especeExterne = id => especesHors.get(id) || null;

/* L'observation à déterminer se place en tête de la comparaison, à côté des candidats. */
photosReference = () => {
  const o = depart && depart.fiche;
  if (!o || !(o.photos || []).length) return null;
  return { obs:o.id, urls:o.photos, titre:t('doObs', o.id),
           sous: o.taxon ? nomCourt(o.taxon.name, o.taxon.preferred_common_name) : '' };
};


/* ---- Point de départ : une observation, ou un point et une date ------------ */

/* Optionnel : le panneau de sélection reste le fonctionnement ordinaire. Ce bloc remplit la
   sélection à partir d'une observation à déterminer — le lieu devient un cercle autour du
   point, la fenêtre se centre sur la date, le groupe devient la famille proposée. */
let depart = null;                    // { obs, point:[lat, lng], date, rayon, fiche }
let carteDepart = null, marqueDepart = null;

function idObservation(texte) {
  const s = String(texte || '').trim();
  const m = s.match(/observations\/(\d+)/) || s.match(/^(\d{3,})$/);
  return m ? +m[1] : null;
}

function dessinerDepart() {
  const f = $('#do-fiche');
  if (!f) return;
  const d = depart;
  if (d && $('#depart-obs')) $('#depart-obs').open = true;   // une date choisie reste visible
  if ($('#do-coord')) $('#do-coord').textContent = d && d.point
    ? d.point.map(v => v.toFixed(4)).join(', ') : t('doSansPoint');
  dessinerFlottant();
  if (!d || !d.fiche) { f.innerHTML = ''; return; }
  const o = d.fiche;
  const photos = o.photos || [];
  f.innerHTML = `<div class="do-obs">
    ${photos.length ? `<div class="do-photos"><button data-do-photo="0" aria-label="${echap(t('doPhoto', 1))}"><img src="${
      echap(photos[0].replace('/medium.', '/small.'))}" alt="">${photos.length > 1
      ? `<span class="do-nb">${t('doNbPhotos', photos.length)}</span>` : ''}</button></div>` : ''}
    <div>
      <div class="tit" style="margin:0">${t('doObs', o.id)}</div>
      <div>${o.taxon ? blocNoms(o.taxon.name, o.taxon.preferred_common_name) : t('doSansTaxon')}</div>
      <div class="note" style="margin:4px 0 0">${echap([o.date, o.lieu].filter(Boolean).join(' · '))}</div>
      ${o.floute ? `<div class="note" style="margin:4px 0 0; color:var(--brique)">${t('doFloute')}</div>` : ''}
      ${d.applique && d.rayon ? `<div class="note" style="margin:4px 0 0">${
        t(d.auto ? 'doRayonAuto' : 'doRayonFixe', d.rayon)}</div>` : ''}
      <a class="discret" href="https://www.inaturalist.org/observations/${o.id}" target="_blank"
        rel="noopener">${t('doVoirObs')}</a>
    </div>
  </div>`;
  f.querySelectorAll('[data-do-photo]').forEach(b => b.addEventListener('click', () =>
    ouvrirLoupe(photos, +b.dataset.doPhoto, o.id)));
}

/* Les photos de l'observation restent à portée de main quel que soit l'onglet : une vignette
   flottante rouvre la série en grand, sans repasser par iNaturalist. Elle s'efface tant que
   le bloc de départ, qui montre déjà ces photos, est à l'écran : sinon la même image
   apparaissait deux fois au même endroit. */
let departEnVue = false;

function dessinerFlottant() {
  const b = $('#do-flottant');
  if (!b) return;
  const o = depart && depart.fiche, photos = (o && o.photos) || [];
  b.hidden = !photos.length || departEnVue;
  if (!photos.length) { b.innerHTML = ''; return; }
  b.innerHTML = `<img src="${echap(photos[0].replace('/medium.', '/small.'))}" alt="">
    <span>${t('doFlottant', photos.length)}</span>`;
}

async function lireObservation() {
  const id = idObservation($('#do-lien').value);
  const msg = $('#do-message');
  if (!id) { msg.textContent = t('doLienInvalide'); return; }
  msg.textContent = t('doLecture');
  try {
    const d = await appelDirect('/observations/' + id, { locale:langue });
    const o = (d.results || [])[0];
    if (!o) { msg.textContent = t('doIntrouvable'); return; }
    let point = null;
    if (o.geojson && o.geojson.coordinates) point = [o.geojson.coordinates[1], o.geojson.coordinates[0]];
    else if (o.location) point = String(o.location).split(',').map(Number);
    if (!point || !point.every(isFinite)) { msg.textContent = t('doSansLieu'); return; }
    const floute = !!(o.obscured || o.geoprivacy === 'obscured' || o.taxon_geoprivacy === 'obscured');
    const date = o.observed_on || (o.time_observed_at || '').slice(0, 10) || null;
    const photos = (o.photos || [])
      .map(ph => ph.medium_url || String(ph.url || '').replace('/square.', '/medium.'))
      .filter(Boolean);

    /* Le groupe : la famille du taxon proposé, ou le taxon lui-même s'il est plus large. Une
       famille garde les voisins qu'on confond, sans charger tout un ordre d'insectes. */
    const tx = o.taxon;
    let lignee = [];
    if (tx && (tx.ancestor_ids || []).length) {
      try {
        const a = await appelDirect('/taxa/' + tx.ancestor_ids.join(','), { locale:langue });
        lignee = (a.results || []).map(x => ({ id:x.id, rang:x.rank, niveau:x.rank_level || 0,
          nom:x.preferred_common_name || x.name, sci:x.name }));
      } catch (e) { /* sans lignée, le groupe sera le taxon lui-même */ }
    }

    depart = {
      obs:o.id, point, date, rayon:null, lignee,
      fiche:{ id:o.id, taxon:tx || null, date, lieu:o.place_guess || '', floute, photos }
    };
    if (date) $('#do-date').value = date;
    depart.groupe = groupeDepart();
    msg.textContent = '';
    appliquerDepart();
  } catch (e) {
    msg.textContent = t('doEchec');
  }
}

/* Le groupe chargé : par défaut l'ordre du taxon proposé, assez large pour qu'on puisse
   redescendre la taxonomie et voir quelles familles, puis quels genres, sont les plus
   probables ici. Une détermination proposée est souvent juste à la famille près et fausse au
   genre : partir de la famille enfermait l'enquête dans la proposition. */
const NIVEAUX_DEPART = { kingdom:70, phylum:60, class:50, order:40, family:30, genus:20 };

function groupeDepart() {
  const d = depart, tx = d && d.fiche && d.fiche.taxon;
  if (!tx) return null;
  const voulu = NIVEAUX_DEPART[$('#do-niveau') ? $('#do-niveau').value : 'order'] || 40;
  if ((tx.rank_level || 0) >= voulu)
    return { id:tx.id, nom:tx.preferred_common_name || tx.name, sci:tx.name };
  // Le plus proche ancêtre au moins aussi large que le niveau voulu.
  const a = (d.lignee || []).filter(x => x.niveau >= voulu).sort((p, q) => p.niveau - q.niveau)[0];
  return a ? { id:a.id, nom:a.nom, sci:a.sci }
           : { id:tx.id, nom:tx.preferred_common_name || tx.name, sci:tx.name };
}

function ouvrirCarteDepart() {
  const boite = $('#do-carte');
  boite.hidden = !boite.hidden;
  if (boite.hidden) return;
  if (!carteDepart) {
    carteDepart = L.map(boite, { scrollWheelZoom:true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      { attribution:'© OpenStreetMap', maxZoom:19, className:'fond-clair' }).addTo(carteDepart);
    const b = bornesLocales();
    if (depart && depart.point) carteDepart.setView(depart.point, 11);
    else if (b && b.isValid()) carteDepart.fitBounds(b, { maxZoom:11 });
    else carteDepart.setView([46.6, 2.5], 5);
    carteDepart.on('click', ev => {
      depart = { ...(depart || {}), obs:null, fiche:null, applique:false,
                 point:[+ev.latlng.lat.toFixed(5), +ev.latlng.lng.toFixed(5)] };
      poserMarqueDepart();
      dessinerDepart();
    });
  }
  setTimeout(() => carteDepart.invalidateSize(), 30);
  poserMarqueDepart();
}

function poserMarqueDepart() {
  if (!carteDepart) return;
  if (marqueDepart) { marqueDepart.remove(); marqueDepart = null; }
  if (depart && depart.point) marqueDepart = L.circleMarker(depart.point,
    { radius:7, color:'#fff', weight:2, fillColor:'#B4553A', fillOpacity:1 }).addTo(carteDepart);
}

/* Le rayon du cercle. En automatique, on cherche le plus petit cercle qui contienne assez
   d'observations du groupe pour que la liste veuille dire quelque chose : 20 km en ville ou
   dans une région bien prospectée, jusqu'à 500 km là où personne ne passe. Une requête par
   palier essayé, sans télécharger une seule observation (per_page=0). Une position floutée
   par iNaturalist ne descend pas sous 50 km : le point réel peut être à une vingtaine de
   kilomètres de celui affiché. */
const RAYONS = [20, 50, 100, 200, 500];
const DENSITE_OBS = 1000;
const densites = new Map();

async function rayonAuto(point, taxons, floute) {
  const min = floute ? 50 : 20;
  const ids = taxons.map(x => x.id).join(',');
  const cle = [point.join(','), ids, etat.qualite, min].join('|');
  if (densites.has(cle)) return densites.get(cle);
  let choisi = RAYONS[RAYONS.length - 1];
  for (const r of RAYONS) {
    if (r < min) continue;
    try {
      const p = { lat:point[0], lng:point[1], radius:r, captive:'false', verifiable:'true', per_page:0 };
      if (etat.qualite === 'research') p.quality_grade = 'research';
      if (ids) p.taxon_id = ids;
      const d = await appelDirect('/observations', p);
      if ((d.total_results || 0) >= DENSITE_OBS) { choisi = r; break; }
    } catch (e) { choisi = Math.max(min, 50); break; }
  }
  densites.set(cle, choisi);
  return choisi;
}

async function appliquerDepart(onglet) {
  const msg = $('#do-message');
  if (!depart || !depart.point) { msg.textContent = t('doSansPoint'); return; }
  const [lat, lng] = depart.point;
  if (depart.groupe) etat.taxons = [depart.groupe];
  const floute = !!(depart.fiche && depart.fiche.floute);
  const choix = $('#do-rayon').value;
  depart.auto = choix === 'auto';
  if (depart.auto) {
    msg.textContent = t('doDensite');
    const d = depart;
    const r = await rayonAuto(d.point, etat.taxons, floute);
    if (depart !== d) return;
    depart.rayon = r;
  } else {
    depart.rayon = Math.max(+choix || 50, floute ? 50 : 0);
  }
  depart.applique = true;
  etat.zone = { lat:+lat.toFixed(4), lng:+lng.toFixed(4), radius:depart.rayon };
  etat.lieux = [];
  vue.noeud = null; vue.deplies.clear(); taxoNoeud = null;
  const date = $('#do-date').value || null;
  depart.date = date;
  dateReference = date && date !== jour(new Date()) ? date : null;
  quandVoir = filtreTempsActif ? (dernierQuand || FENETRE) : 0;
  msg.textContent = '';
  poserMarqueDepart();
  dessinerJetons();
  dessinerDepart();
  if (!peutCharger()) return;
  /* Au départ d'une observation identifiée, on ouvre la taxonomie : la première question est
     « dans quelle branche ? », pas « quelle espèce ? ». */
  Promise.resolve(charger()).then(() => {
    if (!depart || (!onglet && (!depart.fiche || !depart.fiche.taxon))) return;
    const o = document.querySelector(`nav.onglets button[data-vue="${typeof onglet === 'string' ? onglet : 'taxonomie'}"]`);
    if (o) o.click();
  });
}

/* Pas de bouton pour quitter ce mode : il suffit de retirer le cercle de la sélection, par
   la croix de son jeton, comme n'importe quel lieu. Le point, la date et les photos sont
   alors oubliés ; l'inventaire en place ne change qu'au prochain chargement. */
function oublierDepart() {
  depart = null;
  dateReference = null;
  if ($('#do-lien')) $('#do-lien').value = '';
  if ($('#do-date')) $('#do-date').value = '';
  poserMarqueDepart();
  dessinerDepart();
}

function brancherDepart() {
  brancher('#do-lire', 'click', lireObservation);
  brancher('#do-lien', 'keydown', e => { if (e.key === 'Enter') lireObservation(); });
  brancher('#do-point', 'click', ouvrirCarteDepart);
  brancher('#do-appliquer', 'click', appliquerDepart);
  document.addEventListener('click', e => {
    if (depart && e.target.closest('.jeton button[data-type="zone"]')) oublierDepart();
  });
  const fiche = $('#do-fiche');
  if (fiche && 'IntersectionObserver' in window) {
    new IntersectionObserver(entrees => {
      departEnVue = entrees.some(x => x.isIntersecting);
      dessinerFlottant();
    }).observe(fiche);
  }
  brancher('#do-flottant', 'click', () => {
    const o = depart && depart.fiche;
    if (o && o.photos && o.photos.length) ouvrirLoupe(o.photos, 0, o.id);
  });
  brancher('#do-niveau', 'change', () => {
    if (!depart || !depart.fiche || !depart.fiche.taxon) return;
    depart.groupe = groupeDepart();
    appliquerDepart();
  });
  dessinerDepart();
}



/* ---- Taxonomie ------------------------------------------------------------ */

/* Un onglet à part pour descendre la taxonomie, niveau par niveau, jusqu'aux espèces.

   Tous les rangs qu'iNaturalist renseigne y figurent — sous-famille, tribu, sous-genre… —
   contrairement à l'arbre de la liste, qui s'en tient à une échelle fixe pour rester
   homogène. Ici on lit une seule branche à la fois, l'homogénéité entre branches n'a pas
   d'objet, et une tribu est souvent exactement le niveau où l'on hésite.

   Chaque groupe montre les photos de ses espèces principales, en grand, parce qu'on
   reconnaît un groupe à l'œil bien avant de savoir le nommer. Les groupes sont rangés par
   nombre d'observations dans la période, mais sans barre ni pourcentage : une part
   d'observations n'est pas une probabilité d'identification — les espèces voyantes sont
   sur-représentées — et un « 80 % » affiché se lisait comme telle. Un
   maillon qui n'a qu'un seul descendant est traversé d'un coup : on l'affiche dans le
   chemin, sans imposer un clic qui n'offre aucun choix. */

let taxoNoeud = null;                 // null : racine de l'arbre complet
const TAXO_PHOTOS = 4;

function arbreComplet() {
  const racine = { id:null, enfants:new Map(), especes:[], parent:null };
  const noeuds = new Map();
  for (const e of etat.especes) {
    if (!(e.nZone > 0)) continue;
    if (vue.intro !== 'tout' && estIntroduite(e.id) !== (vue.intro === 'seul')) continue;
    /* Toute l'année, quelle que soit la période choisie : une espèce hors saison reste une
       réponse possible (individu précoce, date mal saisie, adulte hivernant). La saison se lit
       sur chaque fiche, en dessous du nom. */
    const n = e.nZone;
    let cour = racine;
    for (const id of chaineBrute(e)) {
      const a = etat.ancetres.get(id);
      if (!a || !a.rang || a.rang === 'stateofmatter') continue;
      if (!cour.enfants.has(id)) {
        const nv = { id, enfants:new Map(), especes:[], parent:cour };
        cour.enfants.set(id, nv); noeuds.set(id, nv);
      }
      cour = cour.enfants.get(id);
    }
    cour.especes.push({ e, n });
  }
  // Le tronc commun à toutes les espèces ne propose aucun choix : on part du dernier maillon.
  let r = racine;
  while (r.enfants.size === 1 && !r.especes.length) r = [...r.enfants.values()][0];
  const cumul = n => {
    let obs = n.especes.reduce((a, x) => a + x.n, 0);
    let toutes = [...n.especes];
    for (const c of n.enfants.values()) { cumul(c); obs += c.obs; toutes = toutes.concat(c.toutes); }
    n.obs = obs; n.toutes = toutes.sort((a, b) => b.n - a.n);
  };
  cumul(r);
  return { racine:r, noeuds };
}

/* Traverse les maillons à descendant unique. */
function descendreUnique(n) {
  const chemin = [n];
  while (n.enfants.size === 1 && !n.especes.length) { n = [...n.enfants.values()][0]; chemin.push(n); }
  return chemin;
}

function nomTaxon(id) {
  const a = etat.ancetres.get(id);
  return a ? { nom:nomCourt(a.nom, a.nomFr), rang:NOM_RANG[a.rang] || a.rang,
               latin: vue.nommage === 'sci' || !a.nomFr } : { nom:'…', rang:'', latin:false };
}

/* La période et le rayon ne se règlent pas ici : ce sont des paramètres du chargement (bloc de
   départ, menu de période des candidats), et les dupliquer dans cet onglet brouillait ce qui
   définit l'inventaire et ce qui ne fait que le parcourir. L'arbre compte toute l'année ; la
   période choisie ne sert qu'au badge de saison de chaque espèce. filtreTempsActif retient si la dernière période choisie était « toute
   l'année », pour la conserver à la prochaine application d'un départ. */
let filtreTempsActif = true;
let taxoToutes = false;               // planche de toutes les espèces de la branche
let dernierQuand = FENETRE;

function barreTaxonomie(courant) {
  return `<div class="outils">
    ${courant ? `<select id="t-annot" aria-label="${echap(t('taPhotos'))}">
      <option value=""${cpAnnot ? '' : ' selected'}>${t('cpToutes')}</option>${
      optionsAnnotations(vocabulaires.get(taxonVocabulaire(courant) || 0))}
    </select>` : ''}
    ${taxoNoeud ? `<button class="discret" id="t-candidats">${t('taVoirCandidats')}</button>` : ''}
    <span class="compte">${echap(capitaliser(nomPeriode(0)))}${auPoint() ? ` · ${t('taRayonKm', depart.rayon)}` : ''}${
      courant ? ` · ${t('guDetail', nb(courant.obs), nb(courant.toutes.length))}` : ''}</span>
  </div>`;
}

/* ---- Photos filtrées de la taxonomie ---- */

/* Le même menu d'annotations que la comparaison — sexe, stade, phénologie — et le même état :
   un choix fait dans un onglet vaut dans l'autre. La case « de la zone seulement » n'y figure
   pas : l'arbre est déjà celui de la zone, et la case laissait croire qu'elle filtrait les
   espèces alors qu'elle ne portait que sur les photos. Sans filtre, chaque espèce montre sa
   photo par défaut, sans requête. Avec un filtre, on cherche pour chaque espèce affichée une
   observation qui y réponde, par lots de cinq espèces ; celles qui n'en ont pas gardent leur
   photo par défaut, estompée. */
const taxoPhotos = new Map();         // 'id|annotation||validation' → url | null
const TAXO_LOT = 5;
const taxoFiltre = () => !!cpAnnot;

function taxonVocabulaire(courant) {
  return (courant && courant.id) || (etat.taxons[0] && etat.taxons[0].id) || null;
}

function imgTaxo(e) {
  const defaut = vignette(e);
  if (!taxoFiltre()) return { src:defaut, attr:'' };
  const u = taxoPhotos.get(clePhotos(e.id, cpAnnot, false));
  if (u === undefined) return { src:defaut, attr:` data-tphoto="${e.id}" class="t-attente"` };
  return u ? { src:u, attr:'' } : { src:defaut, attr:' class="t-defaut"' };
}

async function remplirPhotosTaxo(ids) {
  if (!taxoFiltre()) return;
  const annot = cpAnnot, qualite = etat.qualite;
  const cle = id => clePhotos(id, annot, false, qualite);
  const manque = [...new Set(ids)].filter(id => !taxoPhotos.has(cle(id)));
  for (let i = 0; i < manque.length; i += TAXO_LOT) {
    if (annot !== cpAnnot) return;
    const lot = manque.slice(i, i + TAXO_LOT);
    const p = { taxon_id:lot.join(','), photos:'true', captive:'false', verifiable:'true',
                per_page:50, order_by:'votes', locale:langue };
    if (qualite === 'research') p.quality_grade = 'research';
    if (annot) { const [terme, valeur] = annot.split(':'); p.term_id = terme; p.term_value_id = valeur; }
    const trouves = new Map();
    try {
      const d = await appel('/observations', p, false, true);
      for (const o of (d.results || [])) {
        const tx = o.taxon || {}, ph = (o.photos || [])[0];
        if (!ph) continue;
        const id = lot.find(x => x === tx.id || (tx.ancestor_ids || []).includes(x));
        if (id && !trouves.has(id))
          trouves.set(id, ph.medium_url || String(ph.url || '').replace('/square.', '/medium.'));
      }
    } catch (e) { /* on garde les photos par défaut */ }
    for (const id of lot) {
      const u = trouves.get(id) || null;
      taxoPhotos.set(cle(id), u);
      if (annot !== cpAnnot) continue;
      document.querySelectorAll(`#v-taxonomie img[data-tphoto="${id}"]`).forEach(img => {
        img.classList.remove('t-attente');
        img.removeAttribute('data-tphoto');
        if (u) img.src = u; else img.classList.add('t-defaut');
      });
    }
  }
}

function dessinerTaxonomie() {
  const v = $('#v-taxonomie');
  if (!v) return;
  if (!etat.especes.length) return;

  const { racine, noeuds } = arbreComplet();
  let courant = taxoNoeud && noeuds.get(taxoNoeud);
  if (!courant || !estSous(courant, racine)) { courant = racine; taxoNoeud = null; }

  const tx = depart && depart.fiche && depart.fiche.taxon;
  const propose = new Set(tx ? [...(tx.ancestor_ids || []), tx.id] : []);

  // Fil d'Ariane : de la racine au nœud courant.
  const fil = [];
  for (let n = courant; n && n !== racine.parent; n = n.parent) { fil.unshift(n); if (n === racine) break; }
  const etiquette = n => n.id ? nomTaxon(n.id) : { nom:t('toutesEsp'), rang:'', latin:false };
  const filHTML = fil.map((n, i) => {
    const x = etiquette(n);
    return `<button class="discret${i === fil.length - 1 ? ' actif' : ''}" data-taxo="${n === racine ? '' : n.id}"
      ><span class="${x.latin ? 'lat' : ''}">${echap(x.nom)}</span>${x.rang ? ` <span class="n-rang">${echap(x.rang)}</span>` : ''}</button>`;
  }).join('<span class="sep">›</span>');

  const affichees = [];
  const groupes = [...courant.enfants.values()].sort((a, b) => b.obs - a.obs).map(c => {
    const chemin = descendreUnique(c), fin = chemin[chemin.length - 1];
    const x = nomTaxon(fin.id);
    const sur = propose.has(fin.id) || chemin.some(n => propose.has(n.id));
    const inter = chemin.slice(0, -1).map(n => { const y = nomTaxon(n.id); return `${y.rang} ${y.nom}`; });
    const photos = fin.toutes.slice(0, TAXO_PHOTOS).map(({ e }) => {
      const img = imgTaxo(e);
      affichees.push(e.id);
      return `<span class="t-photo" title="${echap(nomCourt(e.nom, e.nomFr))}">${
        img.src ? `<img src="${echap(img.src)}"${img.attr} loading="lazy" decoding="async" alt="">` : ''}</span>`;
    }).join('');
    const nbEsp = fin.toutes.length;
    return `<button class="taxo-groupe${sur ? ' propose' : ''}" data-taxo="${fin.id}">
      <span class="t-photos n${Math.min(fin.toutes.length, TAXO_PHOTOS)}">${photos}</span>
      <span class="t-nom">
        ${inter.length ? `<span class="t-inter">${echap(inter.join(' › '))} ›</span>` : ''}
        <span><span class="${x.latin ? 'lat' : ''}">${echap(x.nom)}</span> <span class="n-rang">${echap(x.rang)}</span></span>
        ${sur ? `<span class="marque propose">${t('guPropose')}</span>` : ''}
        <span class="t-principales">${echap(fin.toutes.slice(0, 3).map(({ e }) => nomCourt(e.nom, e.nomFr)).join(', '))}${nbEsp > 3 ? '…' : ''}</span>
        <span class="t-detail">${t('guDetail', nb(c.obs), nb(nbEsp))}</span>
      </span>
    </button>`;
  }).join('');

  /* « Toutes les espèces » : à n'importe quel niveau, la planche de toutes les espèces de la
     branche, pour les retenir sans descendre jusqu'à chaque genre. */
  const toutesVue = taxoToutes && courant.enfants.size > 0;
  const source = toutesVue ? courant.toutes : courant.especes.sort((a, b) => b.n - a.n);
  const especes = source.map(({ e, n }) => {
    const img = imgTaxo(e);
    affichees.push(e.id);
    const sur = propose.has(e.id);
    return `<div class="taxo-espece${sur ? ' propose' : ''}">
      <a class="img" href="${lienTaxon(e.id, true)}" target="_blank" rel="noopener">${
        img.src ? `<img src="${echap(img.src)}"${img.attr} loading="lazy" decoding="async" alt="">` : ''}</a>
      <span class="t-nom">${blocNoms(e.nom, e.nomFr)}
        <span class="t-badges">${sur ? `<span class="marque propose">${t('guPropose')}</span>` : ''}
          <span data-geo="${e.id}">${badgeGeo(e.id)}</span></span>
        <span class="t-detail">${nb(n)} ${t('obs')} ${badgePic(e.id)}</span>
        ${badgeAccord(e.id)}</span>
      ${boutonPanier(e.id)}
    </div>`;
  }).join('');
  if (auPoint()) sonderGeo(source.map(x => x.e.id));

  const x = etiquette(courant);
  const bascule = courant.enfants.size ? `<button class="${toutesVue ? 'primaire' : 'discret'}" id="t-toutes">${
    toutesVue ? t('taGroupes') : t('taToutes', nb(courant.toutes.length))}</button>` : '';
  const panier = etat.panier.length ? `<div class="choix-carte">
      <span class="tit">${t('cpPanier')}</span>
      ${etat.panier.map(id => {
        const e = especeConnue(id);
        return `<span class="jeton-esp">${echap(e ? nomCourt(e.nom, e.nomFr) : '#' + id)}
          <button data-oter-taxo="${id}" aria-label="${echap(t('oter'))}">×</button></span>`;
      }).join('')}
      <button class="discret" id="t-comparer">${t('qComparer')}</button>
    </div>` : '';
  v.innerHTML = `${barreTaxonomie(courant)}
    <div class="taxo-fil" style="margin-bottom:12px">${filHTML}${bascule ? `<span class="t-bascule">${bascule}</span>` : ''}</div>
    ${panier}
    ${toutesVue
      ? `<h3 class="titre-conf">${t('taToutesTitre', echap(x.nom), nb(courant.toutes.length))}</h3>
         <div class="taxo-especes">${especes}</div>`
      : `${groupes ? `<div class="taxo-groupes">${groupes}</div>` : ''}
         ${especes ? `${groupes ? `<h3 class="titre-conf" style="margin-top:22px">${t('taEspecesDirectes', echap(x.nom))}</h3>` : ''}
           <div class="taxo-especes">${especes}</div>` : ''}`}`;
  brancherTaxonomie();

  /* Le vocabulaire dépend du groupe affiché : chargé après coup, il remplit le menu sur place. */
  const idVoc = taxonVocabulaire(courant);
  if (!vocabulaires.has(idVoc || 0)) {
    const lignee = courant.toutes[0] ? courant.toutes[0].e.anc || [] : [];
    chargerVocabulaire(idVoc ? { id:idVoc, anc:lignee } : null).then(voc => {
      const sel = $('#t-annot');
      if (sel && taxonVocabulaire(courant) === idVoc)
        sel.innerHTML = `<option value=""${cpAnnot ? '' : ' selected'}>${t('cpToutes')}</option>${optionsAnnotations(voc)}`;
    });
  }
  remplirPhotosTaxo(affichees);
}

function estSous(n, racine) {
  for (let x = n; x; x = x.parent) if (x === racine) return true;
  return false;
}

function brancherTaxonomie() {
  const v = $('#v-taxonomie');
  if (!v) return;
  v.querySelectorAll('[data-taxo]').forEach(x => x.addEventListener('click', ev => {
    if (ev.target.closest('[data-panier]')) return;
    taxoNoeud = x.dataset.taxo ? +x.dataset.taxo : null;
    dessinerTaxonomie();
    v.scrollIntoView({ block:'start', behavior:'smooth' });
  }));
  const annot = $('#t-annot');
  if (annot) annot.addEventListener('change', () => { cpAnnot = annot.value; dessinerTaxonomie(); });
  const tt = $('#t-toutes');
  if (tt) tt.addEventListener('click', () => { taxoToutes = !taxoToutes; dessinerTaxonomie(); });
  const cmp = $('#t-comparer');
  if (cmp) cmp.addEventListener('click', () => {
    const o = document.querySelector('nav.onglets button[data-vue="comparaison"]');
    if (o) o.click();
  });
  v.querySelectorAll('[data-oter-taxo]').forEach(x => x.addEventListener('click', () => {
    etat.panier = etat.panier.filter(id => id !== +x.dataset.oterTaxo);
    majPanier();
  }));
  const c = $('#t-candidats');
  if (c) c.addEventListener('click', () => {
    /* La liste filtre sur la lignée : n'importe quel rang convient, même absent de son arbre. */
    vue.noeud = taxoNoeud;
    vue.deplies = new Set(cheminNoeud(taxoNoeud));
    const o = document.querySelector('nav.onglets button[data-vue="candidats"]');
    if (o) o.click();
    dessinerCandidats();
  });
  brancherPanier(v, majPanier);
}

/* ---- Candidats ------------------------------------------------------------ */

/* Les espèces de la branche courante, classées par fréquence dans la période, avec la part
   que chacune représente. La part est ce qui compte : c'est elle qui transforme une liste de
   noms en une liste de probabilités. */
/* Au départ d'un point : ne garder que les espèces que le modèle attend à ce point. Les
   espèces que le modèle ne connaît pas restent — l'absence de verdict n'est pas un non. */
let vueGeo = 'toutes';
let minuteurCandidats = null;
const planifierCandidats = () => {
  clearTimeout(minuteurCandidats);
  minuteurCandidats = setTimeout(() => { if (!document.querySelector('#v-candidats input:focus')) dessinerCandidats(); }, 400);
};

function candidats() {
  let l = etat.especes.filter(e => e.nZone > 0);
  if (auPoint() && vueGeo === 'attendues') l = l.filter(e => geoConnu.get(e.id) !== 'non');
  if (vue.intro !== 'tout')
    l = l.filter(e => estIntroduite(e.id) === (vue.intro === 'seul'));
  if (vue.noeud) l = l.filter(e => e.anc.includes(vue.noeud));
  if (vue.texte) l = l.filter(correspondRecherche);
  return l.map(e => ({ ...e, nAffiche:effectif(e) }))
    .filter(e => quandVoir === 0 || e.nAffiche > 0)
    .sort((a, b) => b.nAffiche - a.nAffiche);
}

/* L'arbre ne montre que ce qui est présent à cette période : descendre dans une famille qui
   n'a personne en janvier n'aurait aucun intérêt. */
filtreArbre = e => quandVoir === 0 || !periodePrete() || effectif(e) > 0;

const selectQuand = (id = 'q-quand') => selectPeriode(id, quandVoir);

function ficheCandidat(e, total) {
  const img = vignette(e);
  const part = total ? e.nAffiche / total * 100 : 0;
  return `<div class="fiche">
    <a class="img" href="${lienTaxon(e.id, true)}" target="_blank" rel="noopener">
      ${img ? `<img src="${echap(img)}" loading="lazy" decoding="async" alt="">` : ''}
      ${e.iucn ? `<span class="statut">${pastilleIUCN(e.iucn)}</span>` : ''}
    </a>
    ${boutonPanier(e.id)}
    <div class="corps">
      ${blocNoms(e.nom, e.nomFr)}
      <div class="part" title="${echap(t('qPartTitre', nb(e.nAffiche), nomPeriode(quandVoir)))}">
        <span class="piste"><i style="width:${Math.min(part, 100).toFixed(1)}%"></i></span>
        <b>${part >= 1 ? Math.round(part) + ' %' : '< 1 %'}</b>
      </div>
      <div class="geo" data-geo="${e.id}">${badgeGeo(e.id)}</div>
      <div class="bas">
        <a class="n" href="${lienINat(e.id, quandVoir > 0 ? quandVoir : 0, 'map')}"
          target="_blank" rel="noopener">${nb(e.nAffiche)} ${t('obs')}</a>
        <button class="plus" data-lignage="${e.id}"
          aria-label="${echap(t('taxonomie'))}">☰</button>
      </div>
    </div>
    <div class="taxo">${lignageHTML(e)}</div>
  </div>`;
}

function dessinerCandidats() {
  const v = $('#v-candidats');
  if (!v) return;
  if (!etat.especes.length) return;

  if (!periodePrete()) {
    v.innerHTML = barreCandidats(0) + `<div class="vide"><strong>${
      t(fenetreIndispo() ? 'qFenetreIndispo' : 'oCandidats')}</strong>${
      t(fenetreIndispo() ? 'qFenetreIndispoD' : 'qAttente')}</div>`;
    brancherCandidats();
    return;
  }

  const liste = candidats();
  const total = liste.reduce((a, e) => a + e.nAffiche, 0);
  const defil = v.querySelector('.arbre') ? v.querySelector('.arbre').scrollTop : 0;

  const corps = liste.length
    ? `<div class="planche">${liste.slice(0, 240).map(e => ficheCandidat(e, total)).join('')}</div>`
    : `<div class="vide"><strong>${t('qRien')}</strong>${t('qRienD')}</div>`;

  v.innerHTML = barreCandidats(liste.length) +
    `<p class="note">${t('qNote', nomPeriode(quandVoir), nb(total))}</p>
     ${etat.panier.length ? barrePanier() : ''}
     <div class="expl">${panneauArbre()}<div>${corps}
       <div id="q-attendues" class="attendues">${htmlAttendues()}</div></div></div>
     <p class="note">${t('qBiais')}</p>`;

  brancherCandidats();
  brancherArbre('#v-candidats', dessinerCandidats);
  brancherLignage('#v-candidats');
  const p = v.querySelector('.arbre');
  if (p) p.scrollTop = defil;
  for (const e of attendues.liste) especesHors.set(e.id, e);
  /* Au point, toutes les espèces affichées sont sondées : c'est ce qui permet de filtrer. */
  const aSonder = auPoint() ? etat.especes.filter(e => e.nZone > 0).map(e => e.id).slice(0, 400)
                            : liste.slice(0, 60).map(e => e.id);
  sonderGeo([...aSonder, ...etat.panier]);
  chercherAttendues();
}

function barreCandidats(n) {
  return `<div class="outils">
    ${selectQuand()}
    <select id="q-intro">
      <option value="tout"${vue.intro === 'tout' ? ' selected' : ''}>${t('filtreIntroTout')}</option>
      <option value="sans"${vue.intro === 'sans' ? ' selected' : ''}>${t('filtreIntroSans')}</option>
      <option value="seul"${vue.intro === 'seul' ? ' selected' : ''}>${t('filtreIntroSeul')}</option>
    </select>
    <div class="saisie" style="width:200px">
      <input type="text" id="q-rech" value="${echap(vue.texte)}" placeholder="${echap(t('phRech'))}">
    </div>
    ${auPoint() ? `<select id="q-geo">
      <option value="toutes"${vueGeo === 'toutes' ? ' selected' : ''}>${t('geoFiltreToutes')}</option>
      <option value="attendues"${vueGeo === 'attendues' ? ' selected' : ''}>${t('geoFiltreAttendues')}</option>
    </select>` : ''}
    <span class="compte">${nb(n)} ${t('qCandidats')}</span>
  </div>`;
}

/* Le panier, rappelé au-dessus de la liste : c'est lui qui alimente la comparaison, et l'on
   doit voir ce qu'on a retenu sans changer d'onglet. */
function barrePanier() {
  return `<div class="choix-carte">
    <span class="tit">${t('cpPanier')}</span>
    ${etat.panier.map(id => {
      const e = especeConnue(id);
      return `<span class="jeton-esp">${echap(e ? nomCourt(e.nom, e.nomFr) : '#' + id)}
        <button data-oter="${id}" aria-label="${echap(t('oter'))}">×</button></span>`;
    }).join('')}
    <button class="discret" id="q-comparer">${t('qComparer')}</button>
  </div>`;
}

async function changerQuand(v) {
  quandVoir = v;
  filtreTempsActif = v !== 0;
  if (v !== 0) dernierQuand = v;
  if (!periodeEnMemoire(v)) {
    progression(t(v === FENETRE ? 'mFenetre' : 'mFiltreMois', nomPeriode(v)), 40);
    dessinerCandidats();
    await enTache(() => chargerPeriode(v));
    progression(t('mFiltreApp', nomPeriode(v)), null);
  }
  construireArbre();
  if (vue.noeud && !noeudExiste(etat.arbre, vue.noeud)) { vue.noeud = null; vue.deplies.clear(); }
  dessinerCandidats();
}

function brancherCandidats() {
  const b = (sel, ev, fn) => { const e = $(sel); if (e) e.addEventListener(ev, fn); };
  b('#q-quand', 'change', e => changerQuand(+e.target.value));
  b('#q-geo', 'change', e => { vueGeo = e.target.value; dessinerCandidats(); });
  b('#q-intro', 'change', e => {
    vue.intro = e.target.value;
    construireArbre();
    if (vue.noeud && !noeudExiste(etat.arbre, vue.noeud)) { vue.noeud = null; vue.deplies.clear(); }
    dessinerCandidats();
  });
  b('#q-rech', 'input', e => {
    const pos = e.target.selectionStart;
    vue.texte = e.target.value;
    dessinerCandidats();
    const n = $('#q-rech'); if (n) { n.focus(); n.setSelectionRange(pos, pos); }
  });
  b('#q-comparer', 'click', () => {
    const bouton = document.querySelector('nav.onglets button[data-vue="comparaison"]');
    if (bouton) bouton.click();
  });
  document.querySelectorAll('#v-candidats [data-oter]').forEach(x =>
    x.addEventListener('click', () => {
      etat.panier = etat.panier.filter(id => id !== +x.dataset.oter);
      majPanier();
    }));
  brancherPanier('#v-candidats', majPanier);
}

/* ---- Attendues, jamais observées dans la zone ----------------------------- */

/* La liste des candidats ne contient que ce qui a été observé dans la zone. Or une espèce
   discrète peut y vivre sans que personne ne l'ait jamais notée. On cherche donc les espèces
   du même groupe observées aux alentours, pendant la même période, et l'on garde celles que
   le modèle géographique attend dans la zone. Elles viennent en fin de liste, à part : ce
   sont des hypothèses, pas des constats. */

const ATT_MAX = 60;                   // espèces des alentours soumises au modèle
let attendues = { cle:'', etat:'rien', liste:[], faits:0, total:0, rayon:0 };

function cleAttendues() {
  return [cleZoneGeo(), etat.taxons.map(x => x.id).join(','), quandVoir, etat.qualite,
          dateReference || ''].join('|');
}

function rayonAlentours() {
  const b = bornesLocales();
  if (!b || !b.isValid()) return null;
  const c = b.getCenter();
  const demi = c.distanceTo(b.getNorthEast()) / 1000;
  return { lat:+c.lat.toFixed(4), lng:+c.lng.toFixed(4),
           rayon:Math.round(Math.max(25, Math.min(150, demi * 3))) };
}

async function chercherAttendues() {
  const cle = cleAttendues();
  if (attendues.cle === cle && attendues.etat !== 'rien') return;
  const zone = rayonAlentours();
  if (!zone) return;
  attendues = { cle, etat:'cours', liste:[], faits:0, total:0, rayon:zone.rayon };
  majAttendues();

  try {
    const p = { lat:zone.lat, lng:zone.lng, radius:zone.rayon, captive:'false', verifiable:'true',
                per_page:200, locale:langue };
    if (etat.qualite === 'research') p.quality_grade = 'research';
    if (etat.taxons.length) p.taxon_id = etat.taxons.map(x => x.id).join(',');
    if (quandVoir === FENETRE && !fenetreIndispo()) p.week = semainesFenetre().join(',');
    else if (quandVoir > 0) p.month = quandVoir;
    const d = await appel('/observations/species_counts', p, false, true);
    if (attendues.cle !== cle) return;

    const locales = new Set(etat.especes.filter(e => e.nZone > 0).map(e => e.id));
    const pool = (d.results || [])
      .filter(r => r.taxon && (r.taxon.rank_level || 99) <= 10 && !locales.has(r.taxon.id))
      .slice(0, ATT_MAX);
    attendues.total = pool.length;
    majAttendues();

    await Promise.all(pool.map(async r => {
      const v = await presenceAttendue(r.taxon.id);
      if (attendues.cle !== cle) return;
      attendues.faits++;
      if (v === 'oui') {
        const tx = r.taxon, ph = tx.default_photo;
        attendues.liste.push({
          id:tx.id, nom:tx.name, nomFr:tx.preferred_common_name || '', rang:tx.rank,
          anc:tx.ancestor_ids || [], nZone:0, nz:{ toutes:0, research:0 },
          nAlentours:r.count,
          photo: ph ? (ph.medium_url || String(ph.url || '').replace('/square.', '/medium.')) : null,
          photoPetite: ph ? (ph.square_url || ph.url) : null,
          iucn:null, attendue:true
        });
      }
      if (attendues.faits % 6 === 0) majAttendues();
    }));
    if (attendues.cle !== cle) return;
    attendues.liste.sort((a, b) => b.nAlentours - a.nAlentours);
    attendues.etat = 'fait';
  } catch (e) {
    if (attendues.cle === cle) attendues.etat = 'erreur';
  }
  majAttendues();
}

function ficheAttendue(e) {
  const img = vignette(e);
  return `<div class="fiche attendue">
    <a class="img" href="${lienTaxon(e.id, false)}" target="_blank" rel="noopener">
      ${img ? `<img src="${echap(img)}" loading="lazy" decoding="async" alt="">` : ''}
    </a>
    ${boutonPanier(e.id)}
    <div class="corps">
      ${blocNoms(e.nom, e.nomFr)}
      <div><span class="marque attendue">${t('attEtiquette')}</span></div>
      <div class="bas"><span class="n">${t('attAlentours', nb(e.nAlentours), attendues.rayon)}</span></div>
    </div>
  </div>`;
}

function htmlAttendues() {
  const a = attendues;
  let liste = a.liste;
  if (vue.noeud) liste = liste.filter(e => e.anc.includes(vue.noeud));
  if (vue.texte) liste = liste.filter(correspondRecherche);
  const entete = `<h3 class="titre-conf">${t(auPoint() ? 'attTitrePoint' : 'attTitre')}
    <span class="compte">${a.etat === 'cours'
      ? t('attEnCours', a.faits, a.total || '…') : nb(liste.length)}</span></h3>
    <p class="note" style="margin-top:0">${t(auPoint() ? 'attNotePoint' : 'attNote', a.rayon)}</p>`;
  if (a.etat === 'erreur') return entete + `<p class="note">${t('attErreur')}</p>`;
  if (a.etat === 'fait' && !liste.length) return entete + `<p class="note">${t('attAucune')}</p>`;
  return entete + (liste.length
    ? `<div class="planche">${liste.map(ficheAttendue).join('')}</div>` : '');
}

function majAttendues() {
  const boite = $('#q-attendues');
  if (!boite) return;
  boite.innerHTML = htmlAttendues();
  for (const e of attendues.liste) especesHors.set(e.id, e);
  brancherPanier(boite, majPanier);
}



/* Les espèces retenues, en colonne à gauche. Empilées les unes sous les autres, les fiches
   obligeaient à faire défiler pour comparer deux listes ; ici l'on bascule de l'une à
   l'autre sans bouger, ce qui est exactement le geste qu'on fait en déterminant. */
function menuRetenues(courant, attribut) {
  return `<aside class="arbre retenues">
    <div class="entete">${t('cpPanier')}</div>
    ${etat.panier.map(id => {
      const e = especeConnue(id);
      const img = e ? vignette(e) : '';
      return `<button class="retenue${id === courant ? ' sel' : ''}${ecarts.has(id) ? ' ecartee' : ''}" ${attribut}="${id}">
        ${img ? `<img src="${echap(img)}" loading="lazy" alt="">` : '<span class="sans"></span>'}
        <span>${echap(e ? nomCourt(e.nom, e.nomFr) : '#' + id)}</span>
      </button>`;
    }).join('')}
  </aside>`;
}

/* Le mois de pic d'une espèce dans la zone, et sa compatibilité avec la période affichée.
   Deux espèces qu'on confond peuvent avoir des saisons décalées : c'est souvent le critère
   le plus sûr, et le moins regardé. */
function picLocal(id) {
  const p = etat.phenologie && etat.phenologie.get(id);
  if (!p) return null;
  let meilleur = 0, total = 0;
  for (let i = 0; i < 12; i++) { total += p[i]; if (p[i] > p[meilleur]) meilleur = i; }
  return total && p[meilleur] > 0 ? { mois:meilleur, part:p[meilleur] / total } : null;
}

/* Une période de quatre semaines, ou d'un mois, couvre à peu près le douzième de l'année :
   une espèce observée uniformément y aurait 8 % de ses observations. « Peu vue » ne se dit
   donc qu'en deçà de 5 %, franchement sous cette part — à 15 %, on marquait comme hors saison
   des espèces présentes toute l'année. */
const SEUIL_SAISON = 0.05;

function accord(id) {
  if (quandVoir === 0) return null;
  const releve = (etat.moisCache.get(etat.qualite + ':' + quandVoir) || {}).parId;
  if (!releve) return null;
  const local = especeParId(id);
  if (!local) return null;
  const n = releve.get(id) || 0;
  const part = n / Math.max(local.nZone, 1);
  const base = { n, total:local.nZone, part };
  if (!n) return { ...base, cle:'acNon', classe:'non' };
  return part >= SEUIL_SAISON ? { ...base, cle:'acOui', classe:'oui' } : { ...base, cle:'acPeu', classe:'peu' };
}

/* Le badge dit si l'espèce est de saison dans la zone pendant la période choisie dans
   l'onglet Candidats. Le nombre seul (« 1 145 ») ne se lisait pas : l'infobulle donne le
   calcul complet — observations de la période, sur le total de la zone, et la part. */
function badgeAccord(id) {
  const a = accord(id);
  if (!a) return '';
  const titre = t('acTitre', nomPeriode(quandVoir), nb(a.n), nb(a.total),
    a.part >= 0.01 ? Math.round(a.part * 100) : '< 1');
  return `<span class="accord ${a.classe}" title="${echap(titre)}">${t(a.cle, nb(a.n))}</span>`;
}

function badgePic(id) {
  const p = picLocal(id);
  if (!p) return '';
  return `<span class="pic">${t('cfPic', capitaliser(MOIS[p.mois]), Math.round(p.part * 100))}</span>`;
}

/* ---- Confusions ----------------------------------------------------------- */

/* Les confusions réelles, pas celles qu'un auteur suppose. iNaturalist garde la trace des
   déterminations corrigées : quand quelqu'un propose A et qu'un autre rectifie en B, le
   couple est enregistré. Le recensement de ces rectifications est donc une carte des pièges
   bâtie sur le comportement effectif des déterminateurs, ce qu'aucune clé ne contient.

   Ce point d'entrée n'est pas documenté publiquement. On le sonde donc à l'exécution plutôt
   que de le supposer, et l'on retombe proprement sur ce qu'on peut calculer soi-même : les
   espèces du même genre présentes ici, puis celles de la même famille, classées par
   fréquence locale. C'est plus faible — la parenté n'est pas la ressemblance — mais c'est
   vrai, et l'outil dit laquelle des deux sources il affiche. */

const confusionsCache = new Map();   // id d'espèce → { source, liste }
/* Le sondage du point d'entrée coûte plusieurs secondes quand il échoue — trois tentatives
   espacées. On ne le refait donc pas pour chaque espèce : le verdict vaut pour la séance. */
let apiConfusions = null;            // null : inconnu · true : disponible · false : absent

async function sonderConfusions(id) {
  if (apiConfusions === false) return null;
  try {
    const d = await appel('/identifications/similar_species', { taxon_id:id, per_page:30 });
    const r = (d && d.results) || [];
    const liste = r.map(x => ({
      id: (x.taxon && x.taxon.id) || x.id,
      nom: (x.taxon && x.taxon.name) || '',
      nomFr: (x.taxon && (x.taxon.preferred_common_name || x.taxon.common_name)) || '',
      photo: x.taxon && x.taxon.default_photo ? x.taxon.default_photo.square_url : '',
      n: x.count || 0
    })).filter(x => x.id && x.id !== id);
    apiConfusions = true;
    if (liste.length) return { source:'api', liste };
  } catch (e) {
    /* Le point d'entrée n'existe pas, ou refuse : on calcule nous-mêmes, et l'on ne
       réessaiera pas avant le prochain chargement de page. */
    apiConfusions = false;
  }
  return null;
}

/* Le repli : les espèces localement présentes qui partagent le genre, sinon la famille. */
function confusionsLocales(e) {
  const rang = r => {
    const id = (e.anc || []).find(a => {
      const x = etat.ancetres.get(a);
      return x && x.rang === r;
    });
    return id || null;
  };
  for (const r of ['genus', 'family']) {
    const parent = rang(r);
    if (!parent) continue;
    const liste = etat.especes
      .filter(x => x.id !== e.id && x.nZone > 0 && (x.anc || []).includes(parent))
      .sort((a, b) => b.nZone - a.nZone)
      .map(x => ({ id:x.id, nom:x.nom, nomFr:x.nomFr, photo:vignette(x), n:x.nZone }));
    if (liste.length) return { source:r, liste };
  }
  return { source:'rien', liste:[] };
}

async function chargerConfusions(id) {
  if (confusionsCache.has(id)) return confusionsCache.get(id);
  const e = especeConnue(id);
  if (!e) return { source:'rien', liste:[] };
  const r = await sonderConfusions(id) || confusionsLocales(e);
  confusionsCache.set(id, r);
  return r;
}

/* Le bouton porte son intention en toutes lettres. Une case à cocher demandait de deviner ce
   qu'elle déclenche ; ici tout l'intérêt est d'aller voir la suspecte à côté de la première. */
function boutonComparer(id) {
  const pris = etat.panier.includes(id);
  return `<button class="discret comparer${pris ? ' pris' : ''}" data-comparer="${id}"
    >${t(pris ? 'cfRetirer' : 'cfComparer')}</button>`;
}

function ligneConfusion(x) {
  const local = especeParId(x.id);
  const photo = local ? vignette(local) || x.photo : x.photo;
  const geo = auPoint() ? geoConnu.get(x.id) : null;
  const grise = auPoint() ? geo === 'non' : !local;
  return `<div class="conf-ligne${grise ? ' absente' : ''}">
    <a class="img" href="${lienTaxon(x.id, true)}" target="_blank" rel="noopener">
      ${photo ? `<img src="${echap(photo)}" loading="lazy" alt="">` : '<span></span>'}
    </a>
    <div class="quoi">
      <a class="noms" href="${lienTaxon(x.id, true)}" target="_blank" rel="noopener"
        >${blocNoms(x.nom, x.nomFr)}</a>
      ${auPoint() ? `<div class="num">${badgeGeo(x.id)}</div>` : ''}
      <div class="num">${local
        ? `${auPoint() ? '' : `<span class="marque presente">${t('cfPresente')}</span> `}${t('cfIciTotal', nb(local.nZone))}`
        : auPoint() ? t('cfJamaisZone') : `<span class="marque ailleurs">${t('cfAbsente')}</span>`}
        ${x.n ? `<span class="force">${t('cfForce', nb(x.n))}</span>` : ''}
        ${badgePic(x.id)}</div>
      <div class="num">${badgeAccord(x.id)}</div>
    </div>
    ${boutonComparer(x.id)}
  </div>`;
}

/* Les espèces présentes ici d'abord, et parmi elles les plus fréquentes : une confusion avec
   une plante qu'on ne verra jamais dans le secteur n'est pas une confusion, c'est une note de
   bas de page. Les absentes restent, en fin de liste et grisées — savoir qu'une suspecte
   n'existe pas ici est précisément ce qui permet de l'écarter. */
/* Deux choses font qu'une confusion mérite d'être regardée, et il faut les deux.

   La force : combien de fois, dans les données d'iNaturalist, une détermination a été
   rectifiée entre ces deux taxons. C'est la mesure du piège lui-même, et elle ne dépend pas
   du lieu. Une espèce rectifiée trois cents fois est un piège avéré ; une rectifiée deux fois
   est une anecdote.

   La plausibilité locale : combien de fois l'espèce a été observée dans la zone. Le piège le
   mieux attesté du monde ne te concerne pas s'il porte sur une plante absente d'ici.

   On combine donc les deux en logarithmes — chacun a des ordres de grandeur très étalés, et
   passer de deux à vingt rectifications compte plus que de passer de deux cents à deux cent
   vingt. Les espèces absentes de la zone gardent un score, fortement réduit : leur seule
   utilité est de pouvoir être écartées en connaissance de cause. */
function forceConfusion(x) {
  const local = especeParId(x.id);
  const force = Math.log1p(x.n || 0);
  const ici = local ? Math.log1p(local.nZone) : 0;
  /* Sans recensement des rectifications — le repli par genre —, il n'y a pas de force à
     mesurer : seule la fréquence locale classe. */
  if (!x.n) return ici;
  return (force + 0.5) * (local ? ici + 0.5 : 0.2);
}

function classerConfusions(liste) {
  return [...liste]
    .map(x => ({ ...x, poids:forceConfusion(x) }))
    .sort((a, b) => {
      const la = especeParId(a.id), lb = especeParId(b.id);
      // Présentes d'abord : une espèce absente de la zone n'est pas un risque réel.
      if (!!la !== !!lb) return la ? -1 : 1;
      return b.poids - a.poids;
    });
}

let confChoix = null;      // espèce du panier dont on regarde les confusions

async function dessinerConfusions() {
  const v = $('#v-confusions');
  if (!v) return;
  if (!etat.especes.length) return;
  if (!etat.panier.length) {
    v.innerHTML = `<div class="vide"><strong>${t('cfSansPanier')}</strong>${t('cfSansPanierD')}</div>`;
    confChoix = null;
    return;
  }
  if (!etat.panier.includes(confChoix)) confChoix = etat.panier[0];

  const e = especeConnue(confChoix);
  const cadre = corps => `<div class="expl">${menuRetenues(confChoix, 'data-conf')}<div>${corps}</div></div>`;

  v.innerHTML = cadre(`<div class="vide"><strong>${t('oConfusions')}</strong>${t('cfAttente')}</div>`);
  brancherMenuConf();
  if (!e) return;

  const r = await chargerConfusions(confChoix);
  if (confChoix !== (etat.panier.includes(confChoix) ? confChoix : null)) return;
  const liste = classerConfusions(r.liste).slice(0, 25);

  /* Deux groupes titrés plutôt qu'un simple grisé : que la suspecte vive ou non dans la zone
     est la première chose à savoir, et l'opacité seule ne le disait pas. */
  /* Toute confusion peut être retenue pour la comparaison, même absente de la zone : la voir
     à côté reste le moyen le plus sûr de l'écarter. Les absentes de l'inventaire sont
     enregistrées à part, pour que les autres onglets sachent les nommer. */
  for (const x of liste) if (!especeParId(x.id) && !especesHors.has(x.id))
    especesHors.set(x.id, { id:x.id, nom:x.nom, nomFr:x.nomFr, photo:x.photo, photoPetite:x.photo,
      anc:[], nZone:0, nz:{ toutes:0, research:0 }, nm:{}, iucn:null, attendue:false });
  let presentes, absentes, cles = ['cfGroupePresentes', 'cfGroupePresentesD', 'cfAucunePresente',
    'cfGroupeAbsentes', 'cfGroupeAbsentesD'];
  if (auPoint()) {
    /* Au point, la compatibilité se juge sur le modèle géographique : un carré de dix
       kilomètres compte trop peu d'observations pour qu'une absence y signifie quelque chose.
       Le nombre d'observations dans la zone reste affiché, comme indice secondaire. */
    await Promise.all(liste.map(x => presenceAttendue(x.id).then(v => geoConnu.set(x.id, v))));
    if (confChoix !== (etat.panier.includes(confChoix) ? confChoix : null)) return;
    presentes = liste.filter(x => geoConnu.get(x.id) !== 'non');
    absentes = liste.filter(x => geoConnu.get(x.id) === 'non');
    cles = ['cfGroupePoint', 'cfGroupePointD', 'cfAucunePoint', 'cfGroupeHorsPoint', 'cfGroupeHorsPointD'];
  } else {
    presentes = liste.filter(x => especeParId(x.id));
    absentes = liste.filter(x => !especeParId(x.id));
  }
  const groupe = (l, titre, expl, classe) => l.length ? `
    <div class="groupe-conf ${classe}">
      <h4>${t(titre)} <span class="compte">${nb(l.length)}</span></h4>
      <p class="note">${t(expl)}</p>
      <div class="lignes">${l.map(ligneConfusion).join('')}</div>
    </div>` : '';

  v.innerHTML = cadre(`
    <h3 class="titre-conf">${t('cfAvec', echap(nomCourt(e.nom, e.nomFr)))}</h3>
    ${r.source === 'api' ? '' : `<div class="source-conf repli">
      <strong>${t('cfSourceT_' + r.source)}</strong> ${t('cfSourceD_' + r.source)}
    </div>`}
    ${liste.length
      ? groupe(presentes, cles[0], cles[1], 'presentes') +
        (presentes.length ? '' : `<p class="note">${t(cles[2])}</p>`) +
        groupe(absentes, cles[3], cles[4], 'absentes')
      : `<p class="note">${t('cfAucune')}</p>`}`);

  brancherMenuConf();
  v.querySelectorAll('[data-comparer]').forEach(b =>
    b.addEventListener('click', () => {
      const id = +b.dataset.comparer;
      const i = etat.panier.indexOf(id);
      if (i < 0) etat.panier.push(id); else etat.panier.splice(i, 1);
      majPanier();
    }));
}

function brancherMenuConf() {
  document.querySelectorAll('#v-confusions [data-conf]').forEach(b =>
    b.addEventListener('click', () => { confChoix = +b.dataset.conf; dessinerConfusions(); }));
}

/* ---- Critères ------------------------------------------------------------- */

/* Ce que les déterminateurs écrivent. iNaturalist n'a pas de base de caractères, mais ses
   utilisateurs en produisent sans arrêt : quand quelqu'un identifie une espèce, il peut
   joindre un texte à son identification, et ce texte dit très souvent pourquoi — « tarses
   jaunes », « nervation alaire diagnostique », « à cette date ce ne peut être que ».

   C'est la seule source de caractères réellement disponible, et elle a trois qualités que
   n'aurait pas une base rédigée : elle porte sur les confusions qui se produisent vraiment,
   elle est régionale si l'on filtre par lieu, et elle est écrite par ceux qui déterminent
   ces bêtes-là. Ses défauts sont l'envers des mêmes : elle est inégale, dans toutes les
   langues, et parfois simplement fausse.

   Trois sources, dans cet ordre : les aides à l'identification que la communauté a nominées
   sur la page du taxon (« ID tips »), les textes joints aux identifications, puis les
   commentaires portés sur les observations. Les premiers sont bien plus denses — un
   commentaire est souvent un remerciement, une identification commentée est presque toujours
   une explication.

   Ces textes appartiennent à ceux qui les ont écrits. On en montre un extrait, avec l'auteur,
   la date et le lien vers l'observation : de quoi juger et aller voir, pas de quoi remplacer
   la source. */

const criteresCache = new Map();     // id d'espèce → liste de notes
const CRIT_MIN = 45;                 // en deçà, ce n'est pas un critère mais une politesse
const CRIT_MIN_AIDE = 12;            // une aide nominée a déjà été jugée utile par quelqu'un
const CRIT_MAX = 15;                 // notes montrées d'emblée, le reste sur demande
let critTout = false;

/* Les formules de courtoisie et d'accueil, qui dominent en nombre et n'apprennent rien. */
const CRIT_VIDES = /^(merci|thanks|thank you|gracias|obrigad|grazie|danke|welcome to inat|bienvenue|nice|belle|beautiful|\+1|agree|d'accord|ok)\b/i;

function noteUtile(x, min = CRIT_MIN) {
  const b = (x.body || '').trim();
  if (b.length < min) return null;
  if (CRIT_VIDES.test(b)) return null;
  return {
    texte: b,
    qui: (x.user && (x.user.login || x.user.name)) || '?',
    quand: (x.created_at || '').slice(0, 10),
    obs: x.observation_id || (x.observation && x.observation.id) || 0,
    source: x.source
  };
}

/* Les identifications commentées de toute la planète, en v2 : /exemplar_identifications
   est l'index qui alimente l'onglet « ID tips » des pages de taxon. Il ne garde que les
   identifications accompagnées d'un texte, ce qui évite de parcourir des centaines
   d'identifications muettes, et permet deux lectures : les nominées d'abord, puis les plus
   longues (order_by=word_count), un critère se développant là où une approbation tient en une
   ligne. */
const CHAMPS_AIDES = 'id,cached_votes_total,nominated_at,identification.body,identification.created_at,'
  + 'identification.user.login,identification.user.name,identification.observation.id,identification.taxon.id';

async function lireAides(id) {
  const notes = [];
  const lire = async p => {
    try {
      const d = await appel('/exemplar_identifications', { taxon_id:id, fields:CHAMPS_AIDES, ...p }, true);
      for (const r of (d.results || [])) {
        const x = r.identification || {};
        if (x.taxon && x.taxon.id && x.taxon.id !== id) continue;
        const aide = !!r.nominated_at;
        const n = noteUtile({ ...x, source: aide ? 'aide' : 'id' }, aide ? CRIT_MIN_AIDE : CRIT_MIN);
        if (n) { n.aide = aide; n.votes = r.cached_votes_total || 0; notes.push(n); }
      }
    } catch (e) { /* index indisponible : les autres sources suffisent */ }
  };
  await lire({ nominated:'true', per_page:50, order_by:'votes' });
  await lire({ per_page:100, order_by:'word_count' });
  return notes;
}

async function lireNotes(id, lieu, marque) {
  const notes = [];
  if (lieu.place_id) try {
    const d = await appel('/identifications',
      { place_id:lieu.place_id, current:'true', per_page:100, order_by:'created_at', taxon_id:id });
    for (const x of (d.results || [])) {
      if (x.taxon && x.taxon.id && x.taxon.id !== id) continue;
      const n = noteUtile({ ...x, source:'id' });
      if (n) { n.ou = marque; notes.push(n); }
    }
  } catch (e) { /* l'endpoint a refusé */ }
  try {
    /* Les commentaires, eux, ne sont liés à aucune identification : on les lit sur les
       observations les plus discutées, sans restriction de période. */
    const p = { captive:'false', verifiable:'true', locale:langue, ...lieu,
                per_page:100, order_by:'votes', taxon_id:id };
    const d = await appel('/observations', p);
    for (const o of (d.results || [])) {
      if (o.taxon && o.taxon.id && o.taxon.id !== id) continue;
      for (const c of (o.comments || [])) {
        const n = noteUtile({ ...c, observation_id:o.id, source:'com' });
        if (n) { n.ou = marque; notes.push(n); }
      }
    }
  } catch (e) { /* rien de plus */ }
  return notes;
}

async function chargerCriteres(id) {
  if (criteresCache.has(id)) return criteresCache.get(id);
  /* Les filtres généraux portent le groupe taxonomique choisi dans le panneau : les étaler
     après l'identifiant de l'espèce écrasait celui-ci par celui du groupe, et l'on recevait
     les textes de tout le groupe. L'espèce passe donc en dernier. */
  const f = filtres(true), lieu = {};
  for (const k of ['place_id', 'swlat', 'swlng', 'nelat', 'nelng', 'lat', 'lng', 'radius'])
    if (f[k] !== undefined) lieu[k] = f[k];

  const notes = [], vus = new Map();
  const ajouter = liste => {
    for (const n of liste) {
      const deja = vus.get(n.texte);
      if (deja) { if (n.ou === 'ici') deja.ou = 'ici'; continue; }
      vus.set(n.texte, n); notes.push(n);
    }
  };
  ajouter(await lireAides(id));
  if (Object.keys(lieu).length) ajouter(await lireNotes(id, lieu, 'ici'));

  /* Puis le monde entier. Une espèce peu déterminée localement l'est souvent ailleurs, et un
     critère morphologique ne s'arrête pas à la frontière du département — seule la liste des
     confusions possibles, elle, est régionale. La provenance est indiquée sur chaque note. */
  ajouter(await lireNotes(id, {}, 'ailleurs'));

  /* Toutes les notes sont gardées : le tri dépend des autres espèces retenues, qui changent
     sans que les notes aient à être redemandées. */
  for (const n of notes) n.langue = langueNote(n.texte);
  const res = notes;
  criteresCache.set(id, res);
  return res;
}

/* ---- Tri des notes ---- */

/* La langue d'une note, devinée à ses mots-outils. Une note trop courte ou mêlée reste sans
   langue : elle se range alors après celles dans la langue de l'utilisateur. */
const MOTS_OUTILS = {
  fr:['le','la','les','des','est','pas','une','du','et','sur','avec','pour','que','qui','sont','ce','plus','mais','dans','au'],
  en:['the','is','and','of','not','with','this','that','are','for','which','on','but','has','have','it','be','from','than','can'],
  es:['el','los','las','es','con','por','una','del','que','no','se','para','pero','más','como','son','esta','lo','al','hay'],
  it:['il','gli','della','che','non','sono','con','per','una','del','di','più','come','questa','anche','ha','nel','alla','ma','si'],
  de:['der','die','das','und','ist','nicht','mit','ein','eine','den','auf','sich','auch','von','zu','im','es','sind','bei','nur'],
  pt:['os','as','não','com','uma','do','da','que','para','mais','como','são','por','se','ao','na','no','tem','mas','em']
};

function langueNote(texte) {
  const mots = String(texte).toLowerCase().match(/[\p{L}']+/gu) || [];
  if (mots.length < 6) return null;
  let meilleure = null, score = 0;
  for (const [l, liste] of Object.entries(MOTS_OUTILS)) {
    const s = new Set(liste);
    const n = mots.reduce((a, m) => a + (s.has(m) ? 1 : 0), 0);
    if (n > score) { score = n; meilleure = l; }
  }
  return score >= 2 ? meilleure : null;
}

const echapRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* Les façons dont une note peut désigner une autre espèce : son nom complet, l'abréviation
   du genre (« P. major »), l'épithète seule si elle est assez longue pour ne pas être un mot
   courant, et le nom vernaculaire affiché. */
function motifEspece(e) {
  const formes = new Set();
  const sci = String(e.nom || '').trim();
  if (sci) {
    formes.add(sci);
    const [g, ep] = sci.split(/\s+/);
    if (g && ep) { formes.add(g[0] + '. ' + ep); formes.add(g[0] + '.' + ep); if (ep.length >= 6) formes.add(ep); }
  }
  if (e.nomFr && e.nomFr.length >= 4) formes.add(e.nomFr);
  const alt = [...formes].sort((a, b) => b.length - a.length).map(echapRegex).join('|');
  return alt ? new RegExp(`(?<![\\p{L}])(?:${alt})(?![\\p{L}])`, 'giu') : null;
}

/* Les textes longs d'abord à l'intérieur de chaque groupe, un critère se développant là où
   une approbation tient en une ligne ; mais la langue de l'utilisateur passe avant. */
function trierNotes(notes) {
  return [...notes].sort((a, b) =>
    ((!!b.aide) - (!!a.aide)) || ((b.votes || 0) - (a.votes || 0)) ||
    ((b.langue === langue) - (a.langue === langue)) || (b.texte.length - a.texte.length));
}

/* Répartit les notes de l'espèce : celles qui citent une autre espèce retenue, puis les
   autres, limitées. Séparé de l'affichage pour pouvoir être éprouvé sans réseau. */
function classerNotes(notes, autres, tout = false) {
  const motifs = autres.map(e => ({ e, re:motifEspece(e) })).filter(x => x.re);
  const citent = [], aides = [], reste = [];
  for (const n of notes) {
    const cites = motifs.filter(m => { m.re.lastIndex = 0; return m.re.test(n.texte); }).map(m => m.e);
    (cites.length ? citent : n.aide ? aides : reste).push({ ...n, cites });
  }
  const tries = trierNotes(reste);
  return { citent:trierNotes(citent), aides:trierNotes(aides),
           autres: tout ? tries : tries.slice(0, CRIT_MAX), masquees: tout ? 0 : Math.max(0, tries.length - CRIT_MAX),
           motifs };
}

function noteHTML(n, motifs = []) {
  const extrait = n.texte.length > 900 ? n.texte.slice(0, 900) + '…' : n.texte;
  let html = echap(extrait);
  for (const m of motifs) { m.re.lastIndex = 0; html = html.replace(m.re, x => `<mark>${x}</mark>`); }
  return `<div class="note-id${n.cites && n.cites.length ? ' distingue' : ''}${n.aide ? ' aide' : ''}">
    ${n.aide ? `<div class="cite aide">${t('crAideNominee')}${n.votes ? ' · ' + t('crVotes', nb(n.votes)) : ''}</div>` : ''}
    ${n.cites && n.cites.length ? `<div class="cite">${t('crCite',
      n.cites.map(e => echap(nomCourt(e.nom, e.nomFr))).join(', '))}</div>` : ''}
    <p>${html}</p>
    <div class="qui">${echap(n.qui)} · ${echap(n.quand)} · ${t('crSource_' + n.source)}
      ${n.ou ? `· ${t('crOu_' + n.ou)}` : ''}
      ${n.langue ? `· <span class="langue">${echap(LANGUES[n.langue] || n.langue)}</span>` : ''}
      ${n.obs ? `<a href="https://www.inaturalist.org/observations/${n.obs}"
        target="_blank" rel="noopener">${t('crVoir')}</a>` : ''}</div>
  </div>`;
}

let critChoix = null;      // espèce du panier dont on lit les notes

async function dessinerCriteres() {
  const v = $('#v-criteres');
  if (!v) return;
  if (!etat.especes.length) return;
  if (!etat.panier.length) {
    v.innerHTML = `<div class="vide"><strong>${t('crSansPanier')}</strong>${t('crSansPanierD')}</div>`;
    critChoix = null;
    return;
  }
  if (!etat.panier.includes(critChoix)) { critChoix = etat.panier[0]; critTout = false; }

  const e = especeConnue(critChoix);
  const cadre = corps => `<div class="expl">${menuRetenues(critChoix, 'data-crit')}<div>${corps}</div></div>`;

  v.innerHTML = cadre(`<div class="vide"><strong>${t('oCriteres')}</strong>${t('crAttente')}</div>`);
  brancherMenuCrit();
  if (!e) return;

  const choix = critChoix;
  const notes = await chargerCriteres(choix);
  if (critChoix !== choix) return;
  const autres = etat.panier.filter(id => id !== choix).map(especeConnue).filter(Boolean);
  const { citent, aides, autres:reste, masquees, motifs } = classerNotes(notes, autres, critTout);
  const noms = autres.map(x => echap(nomCourt(x.nom, x.nomFr))).join(', ');

  const blocDistinguent = !autres.length
    ? `<p class="note">${t('crUneSeule')}</p>`
    : `<div class="groupe-conf presentes">
        <h4>${t('crDistingue', noms)} <span class="compte">${nb(citent.length)}</span></h4>
        <p class="note">${t(citent.length ? 'crDistingueD' : 'crDistingueRien')}</p>
        ${citent.map(n => noteHTML(n, motifs)).join('')}
      </div>`;

  v.innerHTML = cadre(`
    <h3 class="titre-conf">${echap(nomCourt(e.nom, e.nomFr))}
      <span class="compte">${notes.length ? t('crNotes', nb(notes.length)) : t('crAucune')}</span></h3>
    ${notes.length ? blocDistinguent + (aides.length ? `
      <div class="groupe-conf aides">
        <h4>${t('crAides')} <span class="compte">${nb(aides.length)}</span></h4>
        ${aides.map(n => noteHTML(n, motifs)).join('')}
      </div>` : '') + `
      <div class="groupe-conf absentes">
        <h4>${t('crAutres')} <span class="compte">${nb(reste.length + masquees)}</span></h4>
        <p class="note">${t('crAutresD')}</p>
        ${reste.map(n => noteHTML(n, motifs)).join('')}
        ${masquees ? `<button class="discret" id="cr-tout">${t('crPlus', nb(masquees))}</button>` : ''}
      </div>` : `<p class="note">${t('crAucuneD')}</p>`}`);
  brancherMenuCrit();
  const plus = $('#cr-tout');
  if (plus) plus.addEventListener('click', () => { critTout = true; dessinerCriteres(); });
}

function brancherMenuCrit() {
  document.querySelectorAll('#v-criteres [data-crit]').forEach(b =>
    b.addEventListener('click', () => { critChoix = +b.dataset.crit; critTout = false; dessinerCriteres(); }));
}

/* ---- Répartition ---------------------------------------------------------- */

/* Les aires telles qu'iNaturalist les publie, et non plus reconstruites à partir de quelques
   centaines de points : un semis dit surtout où les gens sont passés. Deux couches en tuiles,
   espèce par espèce :

   — la présence attendue : le modèle géographique d'iNaturalist, celui qui pèse sur les
     suggestions de l'identification automatique. Il estime, maille par maille (des hexagones
     d'une quarantaine de kilomètres), où l'espèce est attendue. Il couvre la plupart des
     espèces qui ont assez d'observations ;
   — les observations : la grille des observations, partout dans le monde, au niveau de
     validation choisi dans le panneau.

   L'aire de référence (cartes de l'UICN importées par les curateurs, /taxon_ranges) a été
   retirée : elle n'existe que pour une minorité d'espèces, surtout des vertébrés, et
   n'apportait rien à la détermination là où la présence attendue existe presque toujours.

   Chaque espèce garde sa couleur de la comparaison. */

const TUILES_INAT = 'https://api.inaturalist.org/v1';

let carteRep = null, coucheLimRep = null, vueRep = null, fondRep = 'plan';
let repCalques = [];                  // calques d'espèces posés, retirés à chaque redessin
let repSignature = '';                // panier servi : un changement impose un recadrage
const repCouches = { attendue:true, observations:false };
const repMasquees = new Set();        // espèces masquées d'un clic dans la légende
const repDispo = new Map();           // 'couche:id' → Promise<true | false | null>

const REP_COUCHES = ['attendue', 'observations'];

function urlCouche(couche, id) {
  const base = `${TUILES_INAT}/${couche === 'attendue' ? 'geomodel' : 'grid'}`;
  if (couche === 'attendue') return `${base}/${id}/{z}/{x}/{y}.png?thresholded=true`;
  const f = { taxon_id:id, verifiable:'true', captive:'false' };
  if (etat.qualite === 'research') f.quality_grade = 'research';
  return `${base}/{z}/{x}/{y}.png?${new URLSearchParams(f)}`;
}

/* {z}/{x}/{y} dans une adresse de tuile, sans dépendre de Leaflet. */
const gabaritTuile = (url, c) => url.replace('{z}', c.z).replace('{x}', c.x).replace('{y}', c.y);

const rvb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));

/* Charge une tuile dans un canevas. La lecture des pixels exige l'accord de l'API ; s'il
   manquait, on redemande l'image sans lui et on la pose telle quelle — une tuile dans sa
   couleur d'origine vaut mieux qu'une tuile absente. */
function chargerTuile(url, rappel) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => rappel(img, true);
  img.onerror = () => {
    const brute = new Image();
    brute.onload = () => rappel(brute, false);
    brute.onerror = () => rappel(null, false);
    brute.src = url;
  };
  img.src = url;
}

/* Le modèle géographique ne connaît qu'un bleu : trois espèces y seraient indiscernables.
   Chaque tuile est repeinte à la couleur de l'espèce. « plein » uniformise l'opacité (une
   aire se lit en aplat) ; sinon la transparence d'origine est gardée (la grille des
   observations code l'abondance par l'intensité).

   La classe est construite à la première carte : sans Leaflet (réseau coupé, CDN
   indisponible), la définir au chargement interrompait tout le script, et l'outil avec lui. */
let CoucheTeinteClasse = null;
function CoucheTeinte(opts) {
  if (!CoucheTeinteClasse) CoucheTeinteClasse = L.GridLayer.extend({
    createTile(coords, fini) {
      const c = document.createElement('canvas');
      const s = this.getTileSize();
      c.width = s.x; c.height = s.y;
      const url = gabaritTuile(this.options.url, coords);
      chargerTuile(url, (img, lisible) => {
        if (img) {
          const g = c.getContext('2d');
          g.drawImage(img, 0, 0, c.width, c.height);
          if (lisible) {
            try {
              const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
              const [r, v, b] = this.options.rvb;
              for (let i = 0; i < p.length; i += 4) {
                if (p[i + 3] < 8) { p[i + 3] = 0; continue; }
                p[i] = r; p[i + 1] = v; p[i + 2] = b;
                if (this.options.plein) p[i + 3] = 255;
                else p[i + 3] = Math.min(255, 70 + p[i + 3]);
              }
              g.putImageData(d, 0, 0);
            } catch (e) { /* pixels illisibles : la tuile reste dans sa teinte d'origine */ }
          }
        }
        fini(null, c);
      });
      return c;
    }
  });
  return new CoucheTeinteClasse(opts);
}

/* Une couche existe-t-elle pour cette espèce ? L'API ne le dit pas : une tuile sans données
   est une image transparente. On lit donc deux tuiles — le quart du monde qui contient la
   zone, et la tuile de niveau 4 qui la centre — et l'on regarde s'il y a un pixel peint.
   true : quelque chose ; false : rien près de la zone ; null : impossible à dire. */
function tuileXY(lat, lng, z) {
  const n = 2 ** z, r = Math.max(-85, Math.min(85, lat)) * Math.PI / 180;
  const x = Math.floor((lng + 180) / 360 * n);
  const y = Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n);
  return { x:Math.min(Math.max(x, 0), n - 1), y:Math.min(Math.max(y, 0), n - 1), z };
}

/* 'oui' : la couche montre quelque chose près de la zone · 'vide' : rien près de la zone ·
   'absente' : l'API n'a pas cette couche pour l'espèce (erreur) · 'inconnu' : lecture impossible. */
function disponibilite(couche, id) {
  const cle = couche + ':' + id;
  if (repDispo.has(cle)) return repDispo.get(cle);
  const bornes = bornesLocales();
  const c = bornes ? bornes.getCenter() : { lat:46.6, lng:2.5 };
  const p = Promise.all([1, 4].map(z => {
    const q = tuileXY(c.lat, c.lng, z);
    return lireTuileGeo(gabaritTuile(urlCouche(couche, id), q));
  })).then(tuiles => {
    if (tuiles.every(x => x.statut === 0)) return 'inconnu';
    if (tuiles.some(x => x.statut !== 200 && x.statut !== 0)) return 'absente';
    return tuiles.some(x => x.alpha && x.alpha.some(a => a > 8)) ? 'oui' : 'vide';
  });
  repDispo.set(cle, p);
  return p;
}

function dessinerRepartition() {
  const v = $('#v-repartition');
  if (!v) return;
  if (!etat.especes.length) return;
  if (!etat.panier.length) {
    v.innerHTML = `<div class="vide"><strong>${t('rpSansPanier')}</strong>${t('rpSansPanierD')}</div>`;
    carteRep = null;
    return;
  }

  /* Onglet caché : la carte ne se construit pas. Leaflet cadrait alors dans un conteneur de
     taille nulle, retenait ce cadrage absurde, et la carte s'ouvrait ensuite n'importe où. Le
     module la dessine à l'ouverture de l'onglet. */
  if (!v.classList.contains('actif')) {
    if (carteRep) { carteRep.remove(); carteRep = null; }
    v.innerHTML = '';
    return;
  }

  const bascule = c => `<label class="bascule"><input type="checkbox" data-couche="${c}"${
    repCouches[c] ? ' checked' : ''}> <span>${t('rpC_' + c)}</span></label>`;

  const especes = etat.panier.slice(0, MAX_COULEURS);
  v.innerHTML = `<div class="outils">
      ${REP_COUCHES.map(bascule).join('')}
      <button class="discret" id="r-recadrer">${t('rpRecadrer')}</button>
    </div>
    <div class="carte-boite"><div id="carte-rep"></div>
      <button id="r-fond" class="sur-carte${fondRep !== 'plan' ? ' actif' : ''}"
        title="${echap(t('cFond'))}">
        <svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true">
          <path d="M10 2.4 2.6 6.2 10 10l7.4-3.8z" fill="none" stroke="currentColor"
            stroke-width="1.5" stroke-linejoin="round"/>
          <path d="M3.4 9.6 10 13l6.6-3.4M3.4 13.2 10 16.6l6.6-3.4" fill="none"
            stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
    <table class="rep-legende">
      <thead><tr><th>${t('rpEspece')}</th>${auPoint() ? `<th>${t('rpAuPoint')}</th>` : ''}${REP_COUCHES.map(c =>
        `<th>${t('rpC_' + c)}</th>`).join('')}<th></th></tr></thead>
      <tbody>${especes.map((id, i) => {
        const e = especeConnue(id);
        const cache = repMasquees.has(id);
        return `<tr class="${cache ? 'masquee' : ''}">
          <td><label class="bascule rep-esp">
            <input type="checkbox" data-montrer="${id}"${cache ? '' : ' checked'}>
            <i style="background:${PALETTE_ESP[i % MAX_COULEURS]}"></i>
            <span>${echap(e ? nomCourt(e.nom, e.nomFr) : '#' + id)}</span></label></td>
          ${auPoint() ? `<td data-geo="${id}">${badgeGeo(id) || '…'}</td>` : ''}
          ${REP_COUCHES.map(c => `<td class="dispo" data-dispo="${c}:${id}">…</td>`).join('')}
          <td><button class="discret" data-oter="${id}" aria-label="${echap(t('oter'))}">×</button></td>
        </tr>`;
      }).join('')}</tbody>
    </table>
    ${etat.panier.length > MAX_COULEURS ? `<p class="note">${t('rpTrop', MAX_COULEURS)}</p>` : ''}
    <p class="note">${t('rpNoteAttendue')}</p>
    <p class="note">${t('rpNoteObservations')}</p>`;

  brancherRepartition();
  remplirDisponibilites(especes);
  if (auPoint()) sonderGeo(especes);
  setTimeout(tracerRepartition, 30);
}

async function remplirDisponibilites(especes) {
  for (const id of especes) for (const c of REP_COUCHES) {
    disponibilite(c, id).then(v => {
      const td = document.querySelector(`#v-repartition [data-dispo="${c}:${id}"]`);
      if (!td) return;
      td.textContent = t({ oui:'rpDispoOui', vide:'rpDispoNon', absente:'rpDispoAbsente' }[v] || 'rpDispoInconnu');
      td.className = 'dispo ' + (v === 'oui' ? 'oui' : '');
    });
  }
}

function brancherRepartition() {
  const v = $('#v-repartition');
  v.querySelectorAll('[data-couche]').forEach(x => x.addEventListener('change', () => {
    repCouches[x.dataset.couche] = x.checked;
    tracerRepartition();
  }));
  v.querySelectorAll('[data-montrer]').forEach(x => x.addEventListener('change', () => {
    const id = +x.dataset.montrer;
    if (x.checked) repMasquees.delete(id); else repMasquees.add(id);
    x.closest('tr').classList.toggle('masquee', !x.checked);
    tracerRepartition();
  }));
  v.querySelectorAll('[data-oter]').forEach(x => x.addEventListener('click', () => {
    etat.panier = etat.panier.filter(id => id !== +x.dataset.oter);
    majPanier();
  }));
  $('#r-recadrer').addEventListener('click', () => { vueRep = null; cadrerRepartition(); });
  $('#r-fond').addEventListener('click', () => {
    fondRep = ORDRE_FONDS[(ORDRE_FONDS.indexOf(fondRep) + 1) % ORDRE_FONDS.length];
    $('#r-fond').classList.toggle('actif', fondRep !== 'plan');
    poserFond(carteRep, fondRep);
  });
}

/* Une aire se lit à l'échelle d'une région, pas d'une commune : on cadre sur la zone d'étude
   puis on recule d'un niveau, pour voir la zone au milieu de ses alentours. */
function cadrerRepartition() {
  if (!carteRep) return;
  const b = bornesLocales();
  if (!b || !b.isValid()) { carteRep.setView([30, 10], 2); return; }
  const z = carteRep.getBoundsZoom(b.pad(0.1), false);
  carteRep.setView(b.getCenter(), Math.max(Math.min(z, 10) - 1, 2), { animate:false });
}

async function tracerRepartition() {
  const cible = $('#carte-rep');
  if (!cible) return;

  if (!carteRep || carteRep.getContainer() !== cible) {
    if (carteRep) carteRep.remove();
    carteRep = L.map(cible, { scrollWheelZoom:true, worldCopyJump:true });
    coucheLimRep = null; repCalques = [];
    poserFond(carteRep, fondRep);
    if (vueRep) carteRep.setView(vueRep.centre, vueRep.zoom);
    carteRep.on('moveend zoomend', () => {
      if (carteRep.getSize().x > 0) vueRep = { centre: carteRep.getCenter(), zoom: carteRep.getZoom() };
    });
    ['rep-attendue', 'rep-observations'].forEach((nom, k) => {
      carteRep.createPane(nom).style.zIndex = 300 + k * 10;
    });
  }
  carteRep.invalidateSize();

  repCalques.forEach(c => carteRep.removeLayer(c));
  repCalques = [];

  etat.panier.slice(0, MAX_COULEURS).forEach((id, i) => {
    if (repMasquees.has(id)) return;
    const couleur = rvb(PALETTE_ESP[i % MAX_COULEURS]);
    for (const c of REP_COUCHES) {
      if (!repCouches[c]) continue;
      const calque = CoucheTeinte({
        url: urlCouche(c, id), rvb: couleur, pane: 'rep-' + c,
        plein: c !== 'observations',
        opacity: c === 'attendue' ? 0.6 : 0.9,
        attribution: 'iNaturalist', maxNativeZoom: c === 'attendue' ? 8 : 12
      }).addTo(carteRep);
      repCalques.push(calque);
    }
  });

  /* Le point de l'observation à déterminer, s'il y en a une : c'est lui qu'on confronte aux aires. */
  if (depart && depart.point) {
    const m = L.circleMarker(depart.point, { radius:7, color:'#fff', weight:2.5,
      fillColor:'#14231C', fillOpacity:1, pane:'rep-observations' }).addTo(carteRep);
    repCalques.push(m);
  }

  if (!coucheLimRep) {
    coucheLimRep = true;              // tracé en cours : ne pas le lancer deux fois
    tracerLimites(carteRep).then(x => { coucheLimRep = x; });
  }

  // Un autre panier, ou une autre zone, et l'on recadre.
  const signature = etat.panier.join(',') + '|' + cleZoneGeo();
  if (signature !== repSignature) { repSignature = signature; vueRep = null; }
  if (!vueRep) cadrerRepartition();
}



/* ---- Bilan ---------------------------------------------------------------- */

/* Déterminer, c'est surtout écarter. Chaque espèce retenue reçoit un verdict — gardée, ou
   écartée pour une raison — et l'outil propose les raisons qu'il peut établir lui-même : pas
   d'observation dans la zone, aucune à cette période, hors de la présence attendue. Le bilan
   se recopie tel quel dans un commentaire iNaturalist : le raisonnement reste lisible par
   ceux qui valideront. */

const RAISONS = ['saison', 'geo', 'zone', 'critere', 'autre'];
const ecarts = new Map();             // id → { raison, note }

/* Ce que les données disent d'une espèce, sans rien décider à la place de l'utilisateur. */
function indices(id) {
  const l = [];
  const local = especeParId(id);
  const geo = geoConnu.get(id);
  if (auPoint() && geo === 'non') l.push({ raison:'geo', texte:t('biGeoPoint') });
  /* Au point, l'absence d'observation dans le carré n'est qu'un indice faible si le modèle
     attend l'espèce : dix kilomètres de côté, c'est peu d'observateurs. */
  if (!local || !local.nZone) l.push({ raison:'zone', texte:t('biZone'), faible: auPoint() && geo === 'oui' });
  else {
    const a = accord(id);
    if (a && a.cle === 'acNon') l.push({ raison:'saison', texte:t('biSaison', nomPeriode(quandVoir)) });
    else if (a && a.cle === 'acPeu') l.push({ raison:'saison', texte:t('biPeu', nb(a.n), nomPeriode(quandVoir)), faible:true });
  }
  if (!auPoint() && geo === 'non') l.push({ raison:'geo', texte:t('biGeo') });
  return l;
}

function contexteBilan() {
  const lieu = depart && depart.point
    ? t('biAutour', depart.point.map(v => v.toFixed(3)).join(', '), depart.rayon)
    : etat.lieux.map(x => x.nom).join(', ') || (etat.zone ? t('zoneTracee') : '');
  const obs = depart && depart.obs ? t('biObs', depart.obs) + ' — ' : '';
  return obs + [lieu, nomPeriode(quandVoir)].filter(Boolean).join(' · ');
}

function texteBilan() {
  const nom = id => { const e = especeConnue(id); return e ? e.nom : '#' + id; };
  const gardees = etat.panier.filter(id => !ecarts.has(id));
  const ecartees = etat.panier.filter(id => ecarts.has(id));
  const lignes = [t('biEntete', contexteBilan())];
  lignes.push(t('biGardees') + ' ' + (gardees.length ? gardees.map(nom).join(' ; ') : '—'));
  if (ecartees.length) {
    lignes.push(t('biEcartees'));
    for (const id of ecartees) {
      const x = ecarts.get(id);
      lignes.push(`– ${nom(id)} : ${t('biR_' + x.raison)}${x.note ? ' — ' + x.note : ''}`);
    }
  }
  lignes.push(t('biPied'));
  return lignes.join('\n');
}

function dessinerBilan() {
  const v = $('#v-bilan');
  if (!v) return;
  if (!etat.especes.length) return;
  if (!etat.panier.length) {
    v.innerHTML = `<div class="vide"><strong>${t('biSansPanier')}</strong>${t('biSansPanierD')}</div>`;
    return;
  }
  sonderGeo(etat.panier);

  v.innerHTML = `<p class="note" style="margin-top:0">${t('biIntro')}</p>
    <div class="bilan-lignes">${etat.panier.map(id => {
      const e = especeConnue(id), x = ecarts.get(id);
      const ind = indices(id);
      return `<div class="bilan-ligne${x ? ' ecartee' : ''}" data-bilan="${id}">
        <div class="quoi">
          <div class="noms">${e ? blocNoms(e.nom, e.nomFr) : '#' + id}</div>
          <div class="indices">${ind.length ? ind.map(i =>
            `<button class="indice${i.faible ? ' faible' : ''}" data-indice="${i.raison}"
              data-texte="${echap(i.texte)}" title="${echap(t('biAppliquer'))}">${echap(i.texte)}</button>`
          ).join('') : `<span class="note" style="margin:0">${t('biRienContre')}</span>`}</div>
        </div>
        <div class="verdict">
          <select data-raison>
            <option value=""${x ? '' : ' selected'}>${t('biGardee')}</option>
            ${RAISONS.map(r => `<option value="${r}"${x && x.raison === r ? ' selected' : ''}>${
              t('biEcarter')} ${t('biR_' + r)}</option>`).join('')}
          </select>
          <input type="text" data-note value="${echap(x ? x.note : '')}"
            placeholder="${echap(t('biPhNote'))}"${x ? '' : ' hidden'}>
        </div>
      </div>`;
    }).join('')}</div>
    <h3 class="titre-conf" style="margin-top:22px">${t('biResume')}</h3>
    <textarea id="bi-texte" readonly rows="${4 + etat.panier.length}">${echap(texteBilan())}</textarea>
    <div class="outils" style="margin-top:8px">
      <button class="discret" id="bi-copier">${t('biCopier')}</button>
      <span class="compte" id="bi-copie"></span>
    </div>`;

  const majTexte = () => { const z = $('#bi-texte'); if (z) z.value = texteBilan(); };
  v.querySelectorAll('[data-bilan]').forEach(ligne => {
    const id = +ligne.dataset.bilan;
    const sel = ligne.querySelector('[data-raison]'), note = ligne.querySelector('[data-note]');
    sel.addEventListener('change', () => {
      if (sel.value) ecarts.set(id, { raison:sel.value, note:note.value });
      else ecarts.delete(id);
      note.hidden = !sel.value;
      ligne.classList.toggle('ecartee', !!sel.value);
      majTexte(); majMenusRetenues();
    });
    note.addEventListener('input', () => {
      if (ecarts.has(id)) { ecarts.get(id).note = note.value; majTexte(); }
    });
    ligne.querySelectorAll('[data-indice]').forEach(b => b.addEventListener('click', () => {
      ecarts.set(id, { raison:b.dataset.indice, note:b.dataset.texte });
      dessinerBilan(); majMenusRetenues();
    }));
  });
  $('#bi-copier').addEventListener('click', async () => {
    const z = $('#bi-texte');
    try { await navigator.clipboard.writeText(z.value); }
    catch (e) { z.select(); document.execCommand('copy'); }
    $('#bi-copie').textContent = t('biCopie');
  });
}

function dessinerBilanSiOuvert() {
  const v = $('#v-bilan');
  if (v && v.classList.contains('actif') && !v.contains(document.activeElement)) dessinerBilan();
}

/* Les espèces écartées restent barrées dans les menus des autres onglets. */
function majMenusRetenues() {
  document.querySelectorAll('.retenue').forEach(b => {
    const id = +(b.dataset.conf || b.dataset.crit || 0);
    b.classList.toggle('ecartee', ecarts.has(id));
  });
}


/* ============================================================
   Déclaration des onglets
   ============================================================ */

/* Le panier est partagé par toutes les vues : toute modification les rafraîchit toutes,
   sans quoi la carte garderait une espèce retirée ailleurs. */
function majPanier() {
  dessinerCandidats();
  dessinerComparaison();
  dessinerConfusions();
  dessinerCriteres();
  dessinerRepartition();
  dessinerBilan();
  dessinerTaxonomie();
}

surPanier = majPanier;

module({
  id: 'candidats',
  tot: true,
  pret: () => periodePrete(),
  dessiner: dessinerCandidats,
  vider(carton) {
    attendues = { cle:'', etat:'rien', liste:[], faits:0, total:0, rayon:0 };
    geoConnu.clear();
    if (!auPoint()) vueGeo = 'toutes';
    $('#v-candidats').innerHTML = carton;
  },
  manque: () => !periodePrete(),
  /* La fenêtre se charge d'elle-même après l'inventaire : c'est le réglage par défaut, et
     sans elle la vue principale reste vide. Une requête. */
  async fond() {
    await chargerPeriode(quandVoir);
    construireArbre();
    dessiner();
  }
});

module({
  id: 'taxonomie',
  dessiner: dessinerTaxonomie,
  ouvrir: dessinerTaxonomie,
  vider(carton) { taxoNoeud = null; $('#v-taxonomie').innerHTML = carton; }
});

module({
  id: 'confusions',
  /* Pas de « dessiner » : chaque espèce du panier coûte une requête, et l'on n'ouvre pas cet
     onglet à chaque fois. La vue se peint à son ouverture. */
  ouvrir: dessinerConfusions,
  vider(carton) { confusionsCache.clear(); $('#v-confusions').innerHTML = carton; }
});

module({
  id: 'criteres',
  /* Deux requêtes par espèce du panier : la vue se peint à son ouverture, pas avant. */
  ouvrir: dessinerCriteres,
  vider(carton) { criteresCache.clear(); $('#v-criteres').innerHTML = carton; }
});

module({
  id: 'repartition',
  ouvrir: dessinerRepartition,
  vider(carton) {
    if (carteRep) carteRep.remove();
    carteRep = null; coucheLimRep = null; repCalques = []; vueRep = null;
    repDispo.clear(); repMasquees.clear();
    $('#v-repartition').innerHTML = carton;
  }
});

module({
  id: 'bilan',
  ouvrir: dessinerBilan,
  vider(carton) { ecarts.clear(); $('#v-bilan').innerHTML = carton; },
  garder: () => ({ ecarts: [...ecarts] }),
  reprendre(d) { ecarts.clear(); for (const [id, x] of (d.ecarts || [])) ecarts.set(id, x); }
});

module({
  id: 'comparaison',
  dessiner: dessinerComparaison,
  ouvrir: dessinerComparaison,
  vider(carton) { etat.panier = []; $('#v-comparaison').innerHTML = carton; },
  oublier() { vocabulaire = null; vocabulairePour = null; cachePhotos.clear(); cpPages.clear(); vocabulaires.clear(); },
  garder: () => ({ panier: etat.panier }),
  reprendre(d) { etat.panier = d.panier || []; }
});


/* ============================================================
   Démarrage
   ============================================================ */

demarrer([
  () => brancherDepart(),
  () => {
    const l = $('#loupe');
    l.addEventListener('click', ev => {
      if (!ev.target.closest('.fleche') && ev.target.id !== 'loupe-lien') l.hidden = true;
    });
    $('#loupe-prec').addEventListener('click', () => loupeDefiler(-1));
    $('#loupe-suiv').addEventListener('click', () => loupeDefiler(1));
    document.addEventListener('keydown', ev => {
      if (l.hidden) return;
      if (ev.key === 'Escape') l.hidden = true;
      if (ev.key === 'ArrowLeft') loupeDefiler(-1);
      if (ev.key === 'ArrowRight') loupeDefiler(1);
    });
  }
]);
