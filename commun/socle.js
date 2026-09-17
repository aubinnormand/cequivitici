/* ============================================================
   Socle
   Transport, mémoire, sélection, présentation. Aucun onglet ici.
   ============================================================ */

/* Couleurs officielles de la liste rouge de l'UICN, du plus menacé au moins. */
const IUCN = {
  70:{ c:'EX', n:t('i_EX'), bg:'#2B2B2B', fg:'#FFFFFF' },
  60:{ c:'EW', n:t('i_EW'), bg:'#542344', fg:'#FFFFFF' },
  50:{ c:'CR', n:t('i_CR'), bg:'#D81E05', fg:'#FFFFFF' },
  40:{ c:'EN', n:t('i_EN'), bg:'#FC7F3F', fg:'#4A1B0C' },
  30:{ c:'VU', n:t('i_VU'), bg:'#F9E814', fg:'#463C02' },
  20:{ c:'NT', n:t('i_NT'), bg:'#CCE226', fg:'#333A08' },
  10:{ c:'LC', n:t('i_LC'), bg:'#DCE9D4', fg:'#2F4A26' },
   5:{ c:'DD', n:t('i_DD'), bg:'#E4E4DC', fg:'#4A4A44' }
};
const CODE_IUCN = { ex:70, ew:60, cr:50, en:40, vu:30, nt:20, lc:10, dd:5 };

/* Paliers de lecture, une décade chacun : c'est le découpage naturel d'une part
   d'observations, où l'écart entre 0,1 % et 1 % compte autant que celui entre 10 % et 100 %. */
/* Six niveaux au lieu de quatre. Au-delà de 10 %, une même couleur couvrait une décade
   entière : une espèce dont la zone détient 12 % des signalements n'a pourtant rien à voir
   avec une espèce qu'on n'y trouve pratiquement que là. */
const PALIERS = [
  { min:60,  etiquette:'≥ 60 %',  nom:t('pExclusive'), couleur:'#3B1F2B' },
  { min:30,  etiquette:'≥ 30 %',  nom:t('pMajeure'), couleur:'#7B3B52' },
  { min:10,  etiquette:'≥ 10 %',  nom:t('pTresForte'), couleur:'#B4553A' },
  { min:1,   etiquette:'≥ 1 %',   nom:t('pForte'), couleur:'#C97E2B' },
  { min:0.1, etiquette:'≥ 0,1 %', nom:t('pNotable'), couleur:'#C6A73C' },
  { min:0,   etiquette:'< 0,1 %', nom:t('pFaible'), couleur:'#9BB39E' }
];
const palier = pct => PALIERS.find(p => pct >= p.min) || PALIERS[PALIERS.length - 1];

/* Longueur de barre logarithmique sur trois décades, de 0,1 % à 100 %. Les graduations
   tombent alors exactement sur les bornes de couleur : 0,1 % au tiers de départ, 1 % au
   tiers, 10 % aux deux tiers. Tout plancher est un choix arbitraire — celui-ci est le plus
   bas qui garde une lecture honnête, sans étirer les parts infimes. */
const PLANCHER = 0.1;
function largeurLog(pct) {
  if (pct <= 0) return 0;
  const l = ((Math.log10(pct) - Math.log10(PLANCHER)) / 3) * 100;
  return Math.max(1.5, Math.min(100, l));   // un filet reste visible sous le plancher
}

function pourcent(pct) {
  if (pct > 0 && pct < 0.001) return '< 0,001 %';
  const d = pct >= 10 ? 0 : pct >= 1 ? 1 : pct >= 0.1 ? 2 : 3;
  return pct.toLocaleString(langue, { maximumFractionDigits:d }) + ' %';
}

function pastilleIUCN(code) {
  if (!code || !IUCN[code]) return '<span class="iucn vide">—</span>';
  const s = IUCN[code];
  const alerte = code >= 30
    ? `<svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true"><path d="M5 0.6 9.4 9H0.6z"
         fill="none" stroke="${s.fg}" stroke-width="1.3" stroke-linejoin="round"/></svg>`
    : `<svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="3.4"
         fill="none" stroke="${s.fg}" stroke-width="1.3"/></svg>`;
  return `<span class="iucn" style="background:${s.bg};color:${s.fg}" title="${s.n}">${alerte}${s.c}</span>`;
}

/* ============================================================
   1 bis. Mémoire locale et adresse partageable
   ============================================================ */

/* IndexedDB garde les inventaires déjà consultés pendant une semaine. Revenir sur un lieu
   ne coûte alors plus une seule requête. La clé décrit exactement ce qui a été chargé :
   changer de lieu, de taxon ou de territoire de référence produit une autre entrée. */
/* ============================================================
   Accès à l'API iNaturalist
   ============================================================ */

const API = 'https://api.inaturalist.org/v1';
const API2 = 'https://api.inaturalist.org/v2';

const attente = ms => new Promise(r => setTimeout(r, ms));

/* Deux aides de date, utilisées dès les premières requêtes : la v2 est testée sur des
   bornes temporelles avant qu'aucun onglet n'existe. */
function ilYa(mois) { const d = new Date(); d.setMonth(d.getMonth() - mois); return d; }
const jour = d => d.toISOString().slice(0, 10);
const cache = new Map();

/* iNaturalist demande de rester sous 60 requêtes par minute, soit une par seconde. Le
   comptage porte sur le moment où les requêtes sont lancées, pas sur celui où elles
   aboutissent : espacer de 1000 ms exactement produit encore des 429, d'où la marge à 1050. */
const INTERVALLE = 1050;
let dernierDepart = 0;

async function attendreSonTour() {
  const restant = INTERVALLE - (Date.now() - dernierDepart);
  if (restant > 0) await attente(restant);
  dernierDepart = Date.now();
}

/* Deux files pour une seule cadence. Ce que l'utilisateur demande à l'instant — les photos
   d'une comparaison, un clic sur la carte — passe devant le chargement de fond, qui peut
   compter trente requêtes en attente. Le débit global ne change pas, seulement l'ordre. */
const attentes = { prio: [], fond: [] };
let tourne = false;

/* Arrêt immédiat : on rejette ce qui attendait son tour. Sans ce rejet, les fonctions en
   attente resteraient suspendues pour toujours. */
function viderFiles() {
  for (const f of ['prio', 'fond']) attentes[f].splice(0).forEach(i => i.ko(new Annule()));
}

function enFile(tache, prio = false) {
  return new Promise((ok, ko) => {
    attentes[prio ? 'prio' : 'fond'].push({ tache, ok, ko });
    boucler();
  });
}

async function boucler() {
  if (tourne) return;
  tourne = true;
  while (attentes.prio.length || attentes.fond.length) {
    const item = attentes.prio.shift() || attentes.fond.shift();
    await attendreSonTour();
    try { item.ok(await item.tache()); } catch (e) { item.ko(e); }
  }
  tourne = false;
}

/* La file de requêtes espace les appels, mais elle ne les ordonne pas par tâche : deux
   chargements lancés en parallèle voient leurs requêtes s'entrelacer. Cette seconde file
   sérialise les tâches — une phase va au bout avant que la suivante commence. */
let chaineTaches = Promise.resolve();

function enTache(fn) {
  const suivant = chaineTaches.then(() => fn());
  chaineTaches = suivant.catch(() => {});
  return suivant;
}

function urlDe(chemin, params, v2) {
  const u = new URL((v2 ? API2 : API) + chemin);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, v);
  }
  return u.toString();
}

/* Trois tentatives : une coupure passagère ou un 429 ne doit pas condamner un chargement. */
async function recuperer(url, essais = 3) {
  for (let i = 1; i <= essais; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
      if (r.status === 429 && i < essais) { await attente(3000 * i); continue; }
      throw new Error('HTTP ' + r.status);
    } catch (e) {
      if (i === essais) throw e;
      await attente(1200 * i);
    }
  }
}

function appel(chemin, params = {}, v2 = false, prio = false) {
  const cle = urlDe(chemin, params, v2);
  if (cache.has(cle)) return Promise.resolve(cache.get(cle));
  return enFile(async () => {
    if (cache.has(cle)) return cache.get(cle);
    const d = await recuperer(cle);
    cache.set(cle, d);
    return d;
  }, prio);
}

/* Certaines requêtes d'interface ne doivent pas attendre derrière l'inventaire : elles
   court-circuitent la file, mais pas la cadence. */
async function appelDirect(chemin, params = {}) {
  const cle = urlDe(chemin, params, false);
  if (cache.has(cle)) return cache.get(cle);
  await attendreSonTour();
  const d = await recuperer(cle, 2);
  cache.set(cle, d);
  return d;
}

const CHAMPS_COMPTE = '(count:!t,taxon:(id:!t))';

/* Champs demandés pour la liste des espèces : le strict nécessaire, ce qui divise le poids
   de la réponse par une dizaine par rapport à la v1 complète. */
/* Le statut d'établissement est demandé avec le lieu auquel il se rattache. C'est essentiel :
   iNaturalist renseigne ce statut territoire par territoire, et une fiche saisie pour un
   continent ou pour un pays lointain peut remonter par héritage — d'où le chêne kermès ou le
   ciste cotonneux donnés comme introduits en Provence. Connaître le territoire de référence
   permet de juger, et de n'accorder crédit qu'aux fiches assez proches. */
const CHAMPS_ESPECE = '(count:!t,taxon:(id:!t,name:!t,rank:!t,preferred_common_name:!t,'
  + 'ancestor_ids:!t,conservation_status:(status_name:!t,status:!t),'
  + 'establishment_means:(establishment_means:!t,place:(id:!t,name:!t,admin_level:!t)),'
  + 'default_photo:(square_url:!t,medium_url:!t,url:!t,attribution:!t)))';

/* Statut d'établissement et territoire qui le porte, conservés à titre de diagnostic : savoir
   qu'une espèce est donnée comme introduite « selon la fiche de Californie » vaut mieux que
   de la voir marquée sans explication. */
function etablissement(t) {
  const e = t.establishment_means;
  if (!e || !e.establishment_means) return null;
  const lieu = e.place || {};
  return { statut:e.establishment_means, lieu:lieu.name || '' };
}

/* Noms des rangs taxonomiques, dans la langue choisie. Les clés préfixées r_ existent dans
   les traductions ; on retombe sur le terme latin pour tout rang non prévu. */
const NOM_RANG = new Proxy({}, {
  get: (_, k) => {
    if (typeof k !== 'string') return '';
    const v = t('r_' + k);
    return v === 'r_' + k ? k : v;
  }
});

/* La v2 allège fortement les réponses, mais toutes les instances ne la servent pas de la
   même façon : on la teste une fois, puis on s'y tient. */
let apiV2 = null, especesV2 = null, moisV2 = null;

async function testerV2() {
  if (apiV2 !== null) return apiV2;
  try {
    const d = await appel('/observations/species_counts',
      { per_page:1, fields:CHAMPS_COMPTE }, true);
    apiV2 = !!(d && d.results);
  } catch (e) { apiV2 = false; }
  console.info('API v2 :', apiV2 ? 'active' : 'indisponible, repli sur la v1');
  return apiV2;
}

async function comptages(f, forcerV1 = false, champs = CHAMPS_COMPTE) {
  if (!forcerV1 && await testerV2()) {
    try {
      return await appel('/observations/species_counts', { ...f, fields:champs }, true);
    } catch (e) { /* on retombe sur la v1 */ }
  }
  return appel('/observations/species_counts', f);
}

/* Un paramètre inconnu n'est pas rejeté : il est ignoré, la requête réussit et renvoie des
   données non filtrées. On vérifie donc que les filtres temporels agissent réellement. */
async function testerMoisV2(f) {
  if (moisV2 !== null) return moisV2;
  if (!await testerV2()) { moisV2 = false; return false; }
  try {
    const opts = { per_page:1, fields:CHAMPS_COMPTE };
    const q = p => appel('/observations/species_counts', { ...f, ...p, ...opts }, true);
    const an = await q({});
    const jan = await q({ month:1 });
    const jui = await q({ month:7 });
    const recent = await q({ d1: jour(ilYa(3)) });
    const ancien = await q({ d2: jour(ilYa(120)) });
    const total = an.total_results;
    moisV2 = !!(total && jan.total_results !== total && jui.total_results !== total
      && recent.total_results !== total && ancien.total_results !== total);
  } catch (e) { moisV2 = false; }
  console.info('Filtres temporels en v2 :', moisV2 ? 'actifs' : 'ignorés, repli sur la v1');
  return moisV2;
}

const BASE = 'inventaire-inat';
/* À incrémenter dès qu'un calcul enregistré change de sens : sans cela, un inventaire mis en
   mémoire ressortirait avec les résultats de l'ancienne version, sans que rien ne le signale. */
const VERSION_DONNEES = 5;
const PEREMPTION = 7 * 24 * 3600 * 1000;

/* IndexedDB peut rester muette : en navigation privée sur iOS, ou quand un autre onglet
   retient la base, l'ouverture ne déclenche ni succès ni erreur. Sans délai de garde, le
   chargement attend indéfiniment et le bouton reste grisé sans aucun message. */
function avecDelai(promesse, ms = 2500) {
  return Promise.race([
    promesse,
    new Promise(r => setTimeout(() => r(null), ms))
  ]);
}

function ouvrirBase() {
  return new Promise((ok, ko) => {
    if (typeof indexedDB === 'undefined' || !indexedDB) return ko(new Error('indisponible'));
    const r = indexedDB.open(BASE, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('inventaires', { keyPath:'cle' });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
    r.onblocked = () => ko(new Error('bloquée par un autre onglet'));
  });
}

async function surBase(mode, action) {
  try {
    const db = await avecDelai(ouvrirBase());
    if (!db) { console.warn('Mémoire locale indisponible : on continue sans cache.'); return null; }
    return await avecDelai(new Promise((ok, ko) => {
      const t = db.transaction('inventaires', mode);
      const req = action(t.objectStore('inventaires'));
      req.onsuccess = () => ok(req.result);
      req.onerror = () => ko(req.error);
    }));
  } catch (e) { return null; }   // navigation privée, quota plein : on continue sans cache
}

function cleInventaire() {
  return [
    etat.lieux.map(l => l.id).sort((a, b) => a - b).join('.'),
    etat.taxons.map(t => t.id).sort((a, b) => a - b).join('.'),
    etat.zone ? Object.values(etat.zone).join(',') : '',
    etat.reference ? etat.reference.id : 'monde',
    etat.qualite,          // les deux niveaux de validation sont deux inventaires distincts
    langue, VERSION_DONNEES
  ].join('|');
}

function enregistrer() {
  if (!etat.especes.length) return;
  surBase('readwrite', st => st.put({
    cle: cleInventaire(), date: Date.now(),
    // De quoi rejouer la sélection telle quelle depuis le panneau de mémoire.
    lieux: etat.lieux, taxons: etat.taxons, zone: etat.zone, reference: etat.reference,
    especes: etat.especes, ancetres: [...etat.ancetres],
    refFaite: etat.refFaite,
    seriesCache: etat.seriesCache, tronque: etat.tronque,
    phenoCache: {
      research: etat.phenoCache.research ? [...etat.phenoCache.research] : null,
      toutes:   etat.phenoCache.toutes   ? [...etat.phenoCache.toutes]   : null
    },
    // Chaque onglet ajoute ce qu'il veut retrouver ; le socle ne sait pas ce que c'est.
    ...gardeModules()
  }));
}

async function restaurer(gen) {
  const d = await surBase('readonly', st => st.get(cleInventaire()));
  if (!d || Date.now() - d.date > PEREMPTION) return false;
  verifier(gen);

  etat.especes = d.especes;
  etat.ancetres = new Map(d.ancetres);
  etat.seriesCache = d.seriesCache || { research:{}, toutes:{} };
  etat.annees = (etat.seriesCache[etat.qualite] || {}).annees || null;
  etat.mensuel = (etat.seriesCache[etat.qualite] || {}).mensuel || null;
  etat.tronque = d.tronque;
  etat.refFaite = d.refFaite || { toutes:false, research:false };
  const pc = d.phenoCache || {};
  etat.phenoCache = {
    research: pc.research ? new Map(pc.research) : null,
    toutes:   pc.toutes   ? new Map(pc.toutes)   : null
  };
  etat.phenologie = etat.phenoCache[etat.qualite];

  appliquerQualite();
  reprendreModules(d);
  construireArbre();
  dessiner();

  const jours = Math.floor((Date.now() - d.date) / 86400000);
  progression(t('mMemoire', nb(etat.especes.length), jours ? t('mJours', jours) : t('mAujourdhui')), null);
  return true;
}

/* Remise à zéro complète : les inventaires enregistrés, le cache des requêtes de la session,
   la sélection en cours et l'adresse. Autrement, vider la base laissait en place des données
   déjà chargées en mémoire et le site paraissait ne pas avoir bougé. */
/* Panneau de la mémoire : ce qui est enregistré, et de quoi le rouvrir d'un clic. Les
   inventaires d'avant cette version n'ont pas gardé leur sélection ; ils sont listés mais
   seulement effaçables, faute de savoir ce qu'ils décrivent. */
/* Les enregistrements d'avant le stockage de la sélection ne gardent que la clé, qui contient
   les identifiants. On les traduit en noms : une requête pour tous les lieux, une pour tous
   les groupes, quel que soit le nombre d'inventaires listés. */
/* Niveau de validation d'un enregistrement, repéré par sa valeur plutôt que par sa position :
   la clé a gagné des champs au fil du temps et un indice figé se décalerait. Les
   enregistrements antérieurs à la séparation des niveaux sont supposés validés. */
function niveauDeCle(d) {
  return String(d.cle || '').split('|').includes('toutes') ? 'toutes' : 'research';
}

async function nommerDepuisCle(liste) {
  const aNommer = liste.filter(d => !d.lieux && typeof d.cle === 'string');
  if (!aNommer.length) return;

  const lieux = new Set(), taxons = new Set();
  for (const d of aNommer) {
    const p = d.cle.split('|');
    (p[0] || '').split('.').filter(Boolean).forEach(x => lieux.add(x));
    (p[1] || '').split('.').filter(Boolean).forEach(x => taxons.add(x));
  }

  const noms = new Map();
  const recuperer = async (chemin, ids) => {
    if (!ids.size) return;
    try {
      const d = await appelDirect(chemin + [...ids].join(','), { locale:langue });
      (d.results || []).forEach(x => noms.set(String(x.id),
        x.display_name || x.preferred_common_name || x.name));
    } catch (e) { /* sans nom, la ligne reste ouvrable par ses identifiants */ }
  };
  await recuperer('/places/', lieux);
  await recuperer('/taxa/', taxons);

  for (const d of aNommer) {
    // lieux | groupes | zone | référence | langue | version
    const p = d.cle.split('|');
    const monter = (bruts) => bruts.split('.').filter(Boolean)
      .map(id => ({ id:+id, nom: noms.get(id) || '#' + id }));
    d.lieux = monter(p[0] || '');
    d.taxons = monter(p[1] || '');
    if (p[2]) {
      const c = p[2].split(',').map(Number);
      if (c.length === 4 && c.every(isFinite))
        d.zone = { swlat:c[0], swlng:c[1], nelat:c[2], nelng:c[3] };
      else if (c.length === 3 && c.every(isFinite))
        d.zone = { lat:c[0], lng:c[1], radius:c[2] };
    }
    d.reference = (p[3] && p[3] !== 'monde')
      ? { id:+p[3], nom: noms.get(p[3]) || '#' + p[3] } : null;
  }
}

/* Coordonnées lisibles d'un rectangle : deux intervalles, avec les points cardinaux. */
/* Deux formes de zone : le rectangle tracé à la main, et le cercle posé autour d'un point
   (outil Identification). iNaturalist accepte les deux telles quelles — swlat… ou lat, lng,
   radius en kilomètres —, seules les cartes et l'adresse ont besoin de savoir laquelle. */
const zoneRonde = z => !!(z && z.radius != null);

function boiteZone(z) {
  if (!zoneRonde(z)) return z;
  const dLat = z.radius / 111.32;
  const dLng = z.radius / (111.32 * Math.max(Math.cos(z.lat * Math.PI / 180), 0.05));
  return { swlat:z.lat - dLat, swlng:z.lng - dLng, nelat:z.lat + dLat, nelng:z.lng + dLng };
}

/* Contour [lng, lat] fermé, pour les géométries GeoJSON. */
function anneauZone(z) {
  if (!zoneRonde(z)) {
    return [[z.swlng, z.swlat], [z.nelng, z.swlat], [z.nelng, z.nelat], [z.swlng, z.nelat], [z.swlng, z.swlat]];
  }
  const b = boiteZone(z), rLat = (b.nelat - b.swlat) / 2, rLng = (b.nelng - b.swlng) / 2;
  const a = [];
  for (let i = 0; i <= 48; i++) {
    const t = i / 48 * 2 * Math.PI;
    a.push([z.lng + rLng * Math.cos(t), z.lat + rLat * Math.sin(t)]);
  }
  return a;
}

function coinsZone(z) {
  if (zoneRonde(z)) return `± ${z.radius} km · ${(+z.lat).toFixed(3)}, ${(+z.lng).toFixed(3)}`;
  const deg = (v, pos, neg) => Math.abs(v).toFixed(2).replace('.', ',') + ' ' + (v >= 0 ? pos : neg);
  return `${deg(z.swlat, 'N', 'S')}–${deg(z.nelat, 'N', 'S')} · ${deg(z.swlng, 'E', 'O')}–${deg(z.nelng, 'E', 'O')}`;
}

async function listerMemoire() {
  const boite = $('#memoire'), cible = $('#memoire-liste');
  if (!boite || !cible) return;
  boite.hidden = !boite.hidden;
  $('#voir-memoire').classList.toggle('ouvert', !boite.hidden);
  if (boite.hidden) return;

  cible.innerHTML = `<div class="etat">…</div>`;
  const tout = await surBase('readonly', st => st.getAll());
  /* Un module peut mettre en réserve autre chose qu'un inventaire — les biorégions y gardent
     leurs observations brutes. Ces entrées n'ont rien à faire dans cette liste, où elles
     apparaissaient comme des inventaires à zéro espèce. On les reconnaît à l'absence
     d'espèces, sans rien savoir de qui les a écrites. */
  const liste = (tout || [])
    .filter(d => d.especes && d.especes.length)
    .sort((a, b) => b.date - a.date);
  if (!liste.length) { cible.innerHTML = `<div class="etat">${t('memVide')}</div>`; return; }
  await nommerDepuisCle(liste);

  cible.innerHTML = liste.map((d, i) => {
    const noms = [...(d.lieux || []).map(l => l.nom), ...(d.taxons || []).map(x => x.nom)];
    if (d.zone) noms.push(t('zoneTracee') + ' ' + coinsZone(d.zone));
    return `<div class="ligne">
      <div class="quoi">
        <b>${noms.length ? echap(noms.join(' · ')) : t('memAncien')}</b>
        <div class="quand">${nb((d.especes || []).length)} ${t('especes')} · ${
          t(niveauDeCle(d) === 'research' ? 'valid' : 'toutesObs').toLowerCase()} · ${
          ageTexte(d.date)}</div>
      </div>
      <div style="flex:none">
        ${(noms.length || d.zone) ? `<a class="discret" data-ouvrir="${i}" href="${echap(adresseDe({
          lieux:d.lieux, taxons:d.taxons, zone:d.zone, reference:d.reference, qualite:niveauDeCle(d)
        }))}">${t('memOuvrir')}</a>` : ''}
        <button class="discret" data-oublier="${i}">${t('memOublier')}</button>
      </div>
    </div>`;
  }).join('');

  cible.querySelectorAll('[data-ouvrir]').forEach(b => b.addEventListener('click', ev => {
    /* Clic avec modificateur (Ctrl, Cmd, Maj, clic du milieu) : on laisse le navigateur ouvrir
       le lien ailleurs. Seul le clic simple rouvre l'inventaire sur place, sans recharger. */
    if (ev.button !== 0 || ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey) return;
    ev.preventDefault();
    const d = liste[+b.dataset.ouvrir];
    etat.lieux = d.lieux || []; etat.taxons = d.taxons || [];
    etat.zone = d.zone || null; etat.reference = d.reference || null;
    // Le niveau fait partie de l'identité de l'inventaire : l'ouvrir, c'est l'adopter.
    etat.qualite = niveauDeCle(d);
    $('#f-qualite').value = etat.qualite;
    surReference(etat.reference);
    dessinerJetons();
    boite.hidden = true;
    $('#voir-memoire').classList.remove('ouvert');
    majURL();
    charger();
  }));

  cible.querySelectorAll('[data-oublier]').forEach(b => b.addEventListener('click', async () => {
    const d = liste[+b.dataset.oublier];
    await surBase('readwrite', st => st.delete(d.cle));
    boite.hidden = true;
    listerMemoire();
  }));
}

async function viderMemoire() {
  generation++;                       // toute tâche en cours devient caduque
  const compte = etat.pseudo;         // vider les données ne doit pas déconnecter la personne
  await surBase('readwrite', st => st.clear());
  if (compte) retenirPseudo(compte);

  cache.clear();
  etat.lieux = []; etat.taxons = []; etat.zone = null; etat.reference = null;
  etat.refFaite = { toutes:false, research:false };
  oublier();
  etat.charge = false;
  document.body.classList.add('attente');
  apiV2 = null; especesV2 = null;
  etat.ancetres.clear();
  reinitialiser();

  surReference(null);
  $('#q-lieu').value = ''; $('#q-taxon').value = '';
  dessinerJetons();
  tracerChoix();
  viderModules(cartonVide());
  history.replaceState({}, '', location.pathname);

  progression(t('mVide'), null);
}

/* L'adresse reflète l'inventaire affiché, ce qui la rend partageable et permet de revenir
   en arrière. Les lieux et taxons n'y figurent que par leur identifiant ; leurs noms sont
   récupérés au chargement de la page. */
/* Adresse d'une sélection, qu'il s'agisse de celle affichée ou d'un inventaire en mémoire :
   le panneau de mémoire s'en sert pour faire de « Ouvrir » un vrai lien. */
function adresseDe(sel) {
  const p = new URLSearchParams();
  if (sel.lieux && sel.lieux.length) p.set('lieux', sel.lieux.map(l => l.id).join(','));
  if (sel.taxons && sel.taxons.length) p.set('taxons', sel.taxons.map(t => t.id).join(','));
  if (sel.zone && zoneRonde(sel.zone)) p.set('cercle', [sel.zone.lat, sel.zone.lng, sel.zone.radius].join(','));
  else if (sel.zone) p.set('zone', [sel.zone.swlat, sel.zone.swlng, sel.zone.nelat, sel.zone.nelng].join(','));
  if (sel.reference) p.set('ref', sel.reference.id);
  if (sel.pseudo) p.set('qui', sel.pseudo.login || sel.pseudo.nom);
  if (sel.qualite && sel.qualite !== 'research') p.set('validation', sel.qualite);
  if (vue.nommage !== 'sci') p.set('noms', vue.nommage);
  const onglet = document.querySelector('nav.onglets button.actif');
  if (onglet && onglet.dataset.vue !== 'liste') p.set('onglet', onglet.dataset.vue);
  return location.pathname + (p.toString() ? '?' + p : '');
}

function majURL(nouvelleEntree = false) {
  const url = adresseDe(etat);
  if (nouvelleEntree) history.pushState({}, '', url); else history.replaceState({}, '', url);
}

async function lireURL() {
  const p = new URLSearchParams(location.search);
  if (p.get('validation')) { etat.qualite = p.get('validation'); $('#f-qualite').value = etat.qualite; }
  if (p.get('noms')) { vue.nommage = p.get('noms'); $('#f-nommage').value = vue.nommage; }

  const onglet = p.get('onglet');
  if (onglet) {
    const b = document.querySelector(`nav.onglets button[data-vue="${onglet}"]`);
    if (b) b.click();
  }

  const z = (p.get('zone') || '').split(',').map(Number).filter(n => isFinite(n));
  if (z.length === 4) etat.zone = { swlat:z[0], swlng:z[1], nelat:z[2], nelng:z[3] };
  const rond = (p.get('cercle') || '').split(',').map(Number).filter(n => isFinite(n));
  if (rond.length === 3 && rond[2] > 0) etat.zone = { lat:rond[0], lng:rond[1], radius:rond[2] };
  const lieux = (p.get('lieux') || '').split(',').filter(Boolean);
  const taxons = (p.get('taxons') || '').split(',').filter(Boolean);
  const ref = p.get('ref');
  const qui = p.get('qui');
  /* Le compte est relu avant tout le reste : c'est un simple pseudo dans l'adresse, mais les
     requêtes demandent un identifiant numérique. Sans réseau, on garde le pseudo seul —
     l'outil dira qu'il n'a pas pu retrouver la liste, ce qui est plus clair qu'un champ vide. */
  /* Sans compte dans l'adresse, on reprend le dernier utilisé. L'adresse reste prioritaire :
     un lien partagé doit montrer la liste qu'il désigne, pas celle du visiteur. */
  if (!qui && $('#q-pseudo')) {
    const garde = await pseudoRetenu();
    if (garde) { etat.pseudo = garde; dessinerJetons(); }
  }

  if (qui) {
    etat.pseudo = { id:null, nom:qui, login:qui };
    try {
      const d = await appelDirect('/users/autocomplete', { q:qui, per_page:5 });
      const u = (d.results || []).find(x => x.login === qui);
      if (u) { etat.pseudo = { id:u.id, nom:u.login, login:u.login }; retenirPseudo(etat.pseudo); }
    } catch (e) { /* hors ligne : on garde le pseudo tel quel */ }
    dessinerJetons();
  }
  if (!lieux.length && !taxons.length && !etat.zone) {
    /* Rien dans l'adresse : on reprend la dernière sélection, quel que soit l'outil où elle
       a été faite. C'est ce qui rend la bascule entre outils continue. */
    const garde = await selectionRetenue();
    if (garde) {
      etat.lieux = garde.lieux || []; etat.taxons = garde.taxons || [];
      etat.zone = garde.zone || null; etat.reference = garde.reference || null;
      if (garde.qualite) { etat.qualite = garde.qualite; const q = $('#f-qualite'); if (q) q.value = garde.qualite; }
      surReference(etat.reference);
      dessinerJetons();
      tracerChoix();
      majURL();
    }
    if (peutCharger()) charger();
    return;
  }

  try {
    for (const id of lieux) {
      const d = await appelDirect('/places/' + id, {});
      const x = d.results && d.results[0];
      if (x) etat.lieux.push({ id:x.id, nom:x.display_name || x.name,
        bbox:x.bounding_box_geojson || null, loc:x.location || null, aire:x.bbox_area || null });
    }
    if (taxons.length) {
      const d = await appelDirect('/taxa/' + taxons.join(','), { locale:langue });
      (d.results || []).forEach(t => etat.taxons.push({ id:t.id, nom:t.preferred_common_name || t.name }));
    }
    if (ref) {
      const d = await appelDirect('/places/' + ref, {});
      const x = d.results && d.results[0];
      if (x) { etat.reference = { id:x.id, nom:x.display_name || x.name };
        surReference(etat.reference); }
    }
  } catch (e) {
    /* Les noms n'ont pas pu être redemandés — typiquement hors ligne, en ouvrant dans un
       nouvel onglet un inventaire du panneau de mémoire. La clé d'enregistrement ne dépend
       que des identifiants : on reprend la sélection telle qu'enregistrée, ou à défaut les
       identifiants seuls, et l'inventaire se retrouve quand même en mémoire. */
    const d = await selectionEnMemoire(lieux, taxons);
    etat.lieux = (d && d.lieux) || lieux.map(id => ({ id:+id, nom:'#' + id }));
    etat.taxons = (d && d.taxons) || taxons.map(id => ({ id:+id, nom:'#' + id }));
    if (ref && !etat.reference) {
      etat.reference = (d && d.reference && String(d.reference.id) === ref)
        ? d.reference : { id:+ref, nom:'#' + ref };
      surReference(etat.reference);
    }
  }

  dessinerJetons();
  if (peutCharger()) charger();
}

/* Enregistrement le plus récent portant sur ces lieux et ces taxons : le début de la clé
   reprend exactement la forme donnée par cleInventaire(). */
async function selectionEnMemoire(lieux, taxons) {
  const trie = ids => ids.map(Number).sort((a, b) => a - b).join('.');
  const debut = trie(lieux) + '|' + trie(taxons) + '|';
  const tout = await surBase('readonly', st => st.getAll());
  return (tout || [])
    .filter(x => String(x.cle || '').startsWith(debut) && x.especes && x.lieux)
    .sort((a, b) => b.date - a.date)[0] || null;
}

window.addEventListener('popstate', () => location.reload());

/* ============================================================
   2. État
   ============================================================ */

const etat = {
  lieux: [], taxons: [],
  pseudo: null,             // compte iNaturalist, pour les outils qui lisent une liste
  qualite: 'research',      // 'research' = validées | 'toutes'
  panier: [],               // espèces retenues pour la comparaison
  zone: null,               // rectangle libre : {swlat, swlng, nelat, nelng}
  reference: null,          // territoire de comparaison ; null = le monde entier
  especes: [],
  ancetres: new Map(),
  arbre: null,
  tronque: false,
  annees: null,
  mensuel: null,
  seriesCache: { research:{}, toutes:{} },
  moisCache: new Map(),
  moisTronque: null,        // mois dont la liste d'espèces est restée incomplète
  refFaite: { toutes:false, research:false },   // les effectifs de référence ont-ils été demandés
  compEstimee: false,       // la complétude mensuelle a-t-elle été demandée
  phenologie: null,   // Map(idEspèce -> 12 effectifs mensuels), niveau courant
  phenoCache: { research:null, toutes:null },
  charge: false
};

const vue = { noeud:null, texte:'', tri:'obs', mois:0, deplies:new Set(), nommage:'sci', intro:'tout' };

/* Un même taxon a deux noms possibles. On choisit lequel porte l'information principale,
   l'autre passe en second, et la mise en forme suit : le latin reste toujours en italique. */
/* Les noms vernaculaires arrivent d'iNaturalist tantôt capitalisés, tantôt non — « Chêne
   kermès » mais « dicotylédones ». On impose la majuscule initiale. Le nom scientifique, lui,
   a sa casse fixée par la nomenclature et n'est pas touché. */
function capitaliser(x) {
  return x ? x.charAt(0).toUpperCase() + x.slice(1) : x;
}

function libelles(sci, fr) {
  const v = capitaliser(fr);
  return vue.nommage === 'sci'
    ? { principal:sci, secondaire:v || '', latinDevant:true }
    : { principal:v || sci, secondaire:v ? sci : '', latinDevant:!v };
}

function blocNoms(sci, fr) {
  const l = libelles(sci, fr);
  return `<div class="fr${l.latinDevant ? ' lat' : ''}">${echap(l.principal)}</div>` +
    (l.secondaire ? `<div class="sci${l.latinDevant ? ' romain' : ''}">${echap(l.secondaire)}</div>` : '');
}

function nomCourt(sci, fr) { return libelles(sci, fr).principal; }

/* Le lien renvoie vers les observations de l'espèce dans la zone, pas vers la fiche mondiale
   du taxon : on reporte donc les lieux, le niveau de validation et, s'il est actif, le mois. */
/* Fiche du taxon sur iNaturalist. Avec un lieu, la page s'ouvre sur ce territoire :
   statut, saisonnalité et carte s'y rapportent alors, au lieu du monde entier. */
function lienTaxon(id, avecLieu) {
  const base = 'https://www.inaturalist.org/taxa/' + id;
  return (avecLieu && etat.lieux.length) ? base + '?place_id=' + etat.lieux[0].id : base;
}

/* Les observations d'une espèce, soit dans la zone d'étude, soit dans le territoire de
   référence — exactement le périmètre des deux colonnes chiffrées. Les filtres transmis sont
   ceux du site, ce qui permet de vérifier d'un clic d'où sort un effectif surprenant. */
/* Observations d'une espèce dans le disque interrogé : le lien reprend le point et le rayon
   du clic, et non le lieu entier — sans quoi il ramènerait des observations situées à des
   dizaines de kilomètres du point examiné. */
function lienDisque(id, lat, lng, rayonKm) {
  const p = new URLSearchParams({ taxon_id:id, captive:'false', verifiable:'true',
    lat:(+lat).toFixed(5), lng:(+lng).toFixed(5), radius:(+rayonKm).toFixed(3) });
  if (etat.qualite === 'research') p.set('quality_grade', 'research');
  return 'https://www.inaturalist.org/observations?' + p.toString() + '&view=map';
}

function lienPortee(id, portee) {
  const p = new URLSearchParams({ taxon_id:id, captive:'false', verifiable:'true' });
  if (etat.qualite === 'research') p.set('quality_grade', 'research');
  if (portee === 'zone') {
    if (etat.lieux.length) p.set('place_id', etat.lieux.map(l => l.id).join(','));
    if (etat.zone) for (const [k, v] of Object.entries(etat.zone)) p.set(k, v);
  } else if (etat.reference) {
    p.set('place_id', etat.reference.id);
  }
  return 'https://www.inaturalist.org/observations?' + p.toString();
}

function lienINat(id, mois, vue) {
  const p = new URLSearchParams({ taxon_id:id, captive:'false', verifiable:'true' });
  if (vue) p.set('view', vue);
  if (etat.lieux.length) p.set('place_id', etat.lieux.map(l => l.id).join(','));
  if (etat.zone) for (const [k, v] of Object.entries(etat.zone)) p.set(k, v);
  if (etat.qualite === 'research') p.set('quality_grade', 'research');
  if (mois) p.set('month', mois);
  return 'https://www.inaturalist.org/observations?' + p.toString();
}

/* Un chargement plus récent invalide les précédents : chaque étape vérifie qu'elle
   appartient encore à la génération courante avant d'écrire dans l'état. */
let generation = 0;
class Annule extends Error {}
function verifier(gen) { if (gen !== generation) throw new Annule(); }

const $ = s => document.querySelector(s);
const nb = n => n.toLocaleString(langue);
const echap = s => String(s || '').replace(/[<>"]/g, '');

/* Le filtre de validation s'applique partout : liste, carte, responsabilité, statistiques. */
function filtres(avecLieu = true, qualite = etat.qualite) {
  /* Dans les deux modes, on écarte les individus cultivés ou captifs et les observations
     non vérifiables — sans photo ni son, elles ne peuvent être confirmées par personne. */
  /* « brut » ne pose aucune exigence : ni grade, ni photo, ni individu sauvage. Il sert aux
     listes personnelles, où ce qui compte est d'avoir vu la bête, pas qu'un tiers l'ait
     confirmée. Les inventaires, eux, gardent leurs deux niveaux habituels. */
  const f = qualite === 'brut' ? { locale:langue }
                               : { captive:'false', verifiable:'true', locale:langue };
  if (qualite === 'research') f.quality_grade = 'research';
  if (avecLieu && etat.lieux.length) f.place_id = etat.lieux.map(l => l.id).join(',');
  // Une zone dessinée remplace le lieu : tous les endroits utilisés acceptent une boîte.
  if (avecLieu && etat.zone) Object.assign(f, etat.zone);
  // Sans lieu d'étude, on interroge le territoire de référence — le monde s'il n'y en a pas.
  if (!avecLieu && etat.reference) f.place_id = etat.reference.id;
  if (etat.taxons.length) f.taxon_id = etat.taxons.map(t => t.id).join(',');
  return f;
}


function arreterTout() {
  generation++;
  viderFiles();
  for (const m of MODULES) if (m.arreter) essayer(m, 'arreter', m.arreter);
  $('#lancer').disabled = false;
  progression(t('mArret'), null);
}

function progression(texte, pct) {
  majOnglets();
  $('#etat').textContent = texte;
  // Le bouton d'arrêt n'apparaît que pendant un chargement, signalé par une jauge active.
  const st = $('#stop');
  if (st) st.hidden = (pct === null || pct === undefined);
  const j = $('#jauge');
  if (pct === null) { j.classList.remove('on'); return; }
  j.classList.add('on');
  j.querySelector('i').style.width = Math.max(0, Math.min(100, pct)) + '%';
}

/* ============================================================
   3. Champs de recherche
   ============================================================ */

/* garderTexte : pour la référence, le champ affiche le territoire retenu au lieu d'être
   vidé — le choix n'y devient pas un jeton, c'est le texte lui-même qui porte l'information. */
/* Un territoire de référence vient d'être choisi, ou retiré. Seul l'outil Exploration a un
   champ pour l'afficher ; ailleurs, il n'y a rien à faire. */
let surReference = () => {};

/* Ce qu'il faut avoir choisi pour que le bouton s'active. l'outil Coche exige en plus
   un compte : sans lui, il n'a rien à soustraire. */
let peutCharger = () => !!(etat.lieux.length || etat.taxons.length || etat.zone);

/* Ce que la barre d'état dit tant qu'il manque quelque chose à la sélection. Chaque outil
   n'attend pas la même chose : un lieu ici, un lieu et un compte ailleurs. */
let messageAttente = () => 'choisirLieu';

function autocompletion(idChamp, idListe, chemin, versObjet, onChoix, garderTexte) {
  const champ = $(idChamp), liste = $(idListe);
  if (!champ || !liste) return;      // l'outil n'affiche pas ce champ
  let minuteur = null, resultats = [], vise = -1;
  const fermer = () => { liste.classList.remove('on'); vise = -1; };

  champ.addEventListener('input', () => {
    clearTimeout(minuteur);
    const q = champ.value.trim();
    if (q.length < 2) return fermer();
    minuteur = setTimeout(async () => {
      try {
        const d = await appel(chemin, { q, per_page:8, locale:langue });
        resultats = d.results.map(versObjet);
        if (!resultats.length) return fermer();
        liste.innerHTML = resultats.map((r, i) =>
          `<div class="prop" data-i="${i}">${echap(r.nom)}<small>${echap(r.detail)}</small></div>`).join('');
        liste.classList.add('on');
      } catch (e) { fermer(); }
    }, 300);
  });

  champ.addEventListener('keydown', e => {
    const props = [...liste.querySelectorAll('.prop')];
    if (!props.length || !liste.classList.contains('on')) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      vise = (vise + (e.key === 'ArrowDown' ? 1 : -1) + props.length) % props.length;
      props.forEach((p, i) => p.classList.toggle('vise', i === vise));
    } else if (e.key === 'Enter' && vise >= 0) { e.preventDefault(); choisir(vise); }
    else if (e.key === 'Escape') fermer();
  });

  liste.addEventListener('click', e => {
    const p = e.target.closest('.prop'); if (p) choisir(+p.dataset.i);
  });
  document.addEventListener('click', e => {
    if (!champ.contains(e.target) && !liste.contains(e.target)) fermer();
  });
  function choisir(i) {
    onChoix(resultats[i]);
    if (!garderTexte) champ.value = '';
    fermer();
  }
}

/* Les comptes : un seul à la fois, et le champ garde le texte choisi — contrairement aux
   lieux et aux taxons, dont on empile plusieurs jetons. */
autocompletion('#q-pseudo', '#p-pseudo', '/users/autocomplete',
  u => ({ id:u.id, nom:u.login, detail:u.name || '', login:u.login }),
  u => {
    etat.pseudo = { id:u.id, nom:u.login, login:u.login };
    retenirPseudo(etat.pseudo);
    dessinerJetons();
  });

/* Le dernier compte saisi, gardé dans la même base que les inventaires. On ne retient que
   lui : le lieu et les groupes changent d'une session à l'autre, le compte presque jamais.
   Le retenir évite de retaper son pseudo à chaque visite, ce qui est la première friction
   d'un outil dont c'est la moitié de la question. */
const CLE_PSEUDO = 'dernier-compte';
const CLE_SELECTION = 'derniere-selection';

/* La sélection en cours, retenue pour les autres outils. Les trois partagent la même base :
   charger une commune dans l'un la rend disponible dans les deux autres, sans requête et
   sans ressaisie. L'adresse reste prioritaire — un lien partagé montre ce qu'il désigne. */
function retenirSelection() {
  if (!peutCharger()) return;
  surBase('readwrite', st => st.put({ cle:CLE_SELECTION, date:Date.now(),
    lieux:etat.lieux, taxons:etat.taxons, zone:etat.zone,
    reference:etat.reference, qualite:etat.qualite }));
}

async function selectionRetenue() {
  try {
    const d = await surBase('readonly', st => st.get(CLE_SELECTION));
    return d && (d.lieux || []).length + (d.taxons || []).length + (d.zone ? 1 : 0) ? d : null;
  } catch (e) { return null; }
}

function retenirPseudo(p) {
  if (!p || !p.id) return;
  surBase('readwrite', st => st.put({ cle:CLE_PSEUDO, date:Date.now(), pseudo:p }));
}

async function pseudoRetenu() {
  try {
    const d = await surBase('readonly', st => st.get(CLE_PSEUDO));
    return d && d.pseudo && d.pseudo.id ? d.pseudo : null;
  } catch (e) { return null; }
}

autocompletion('#q-lieu', '#p-lieu', '/places/autocomplete',
  p => ({ id:p.id, nom:p.display_name, detail:p.place_type_name || 'lieu',
          bbox:p.bounding_box_geojson || null, loc:p.location || null, aire:p.bbox_area || null }),
  p => { if (!etat.lieux.some(x => x.id === p.id)) { etat.lieux.push(p); dessinerJetons(); } });

autocompletion('#q-taxon', '#p-taxon', '/taxa/autocomplete',
  // Le nom scientifique est conservé à part : le jeton affiche le nom vernaculaire, mais
  // l'appariement avec d'autres référentiels ne peut se faire que sur le nom savant.
  t => ({ id:t.id, nom:t.preferred_common_name || t.name, sci:t.name,
          detail:t.rank + ' · ' + t.name }),
  t => { if (!etat.taxons.some(x => x.id === t.id)) { etat.taxons.push(t); dessinerJetons(); } });

function dessinerJetons() {
  const rendre = (liste, cible, type) => {
    $(cible).innerHTML = liste.map((x, i) =>
      `<span class="jeton">${echap(x.nom)}<button data-type="${type}" data-i="${i}" aria-label="${echap(t('oter'))}">×</button></span>`).join('');
  };
  rendre(etat.lieux, '#j-lieu', 'lieu');
  if (etat.zone) {
    $('#j-lieu').insertAdjacentHTML('beforeend',
      `<span class="jeton">${zoneRonde(etat.zone) ? echap(coinsZone(etat.zone)) : t('zoneTracee')}<button data-type="zone" aria-label="${echap(t('oter'))}">×</button></span>`);
  }
  rendre(etat.taxons, '#j-taxon', 'taxon');
  if ($('#j-pseudo')) rendre(etat.pseudo ? [etat.pseudo] : [], '#j-pseudo', 'pseudo');
  const pret = peutCharger();
  $('#lancer').disabled = !pret;
  document.body.classList.toggle('attente', !etat.charge);
  if (!etat.charge) $('#etat').textContent = t(pret ? 'pret' : messageAttente());
}

document.addEventListener('click', e => {
  const b = e.target.closest('.jeton button'); if (!b) return;
  if (b.dataset.type === 'zone') etat.zone = null;
  else if (b.dataset.type === 'pseudo') etat.pseudo = null;
  else (b.dataset.type === 'lieu' ? etat.lieux : etat.taxons).splice(+b.dataset.i, 1);
  dessinerJetons();
  if (b.dataset.type !== 'taxon') tracerChoix();
});


/* Tous les outils n'affichent pas les mêmes réglages : on ne branche que ce qui est là.
   Sans cette précaution, une page dépourvue d'un menu interromprait le socle entier. */
const brancher = (sel, ev, fn) => { const e = $(sel); if (e) e.addEventListener(ev, fn); };

brancher('#f-nommage', 'change', e => {
  vue.nommage = e.target.value;
  majURL();
  if (etat.especes.length) renommer();
});

brancher('#f-qualite', 'change', e => {
  /* Le niveau fait partie de l'identité de l'inventaire : le changer ne recharge rien, il
     prépare le prochain chargement. Relancer d'office plusieurs minutes de requêtes sur un
     simple changement de menu serait une mauvaise surprise, et le bouton est juste à côté. */
  etat.qualite = e.target.value;
  majURL();
  dessinerUn('carte');
  if (etat.especes.length) $('#etat').textContent = t('pret');
});



/* ============================================================
   Choisir un lieu sur une carte
   ============================================================ */

/* Plutôt que de laisser dessiner une zone libre — ce qui obligerait à remplacer place_id par
   une boîte géographique dans toutes les requêtes du site —, on interroge les lieux
   qu'iNaturalist connaît déjà sur l'emprise affichée. L'utilisateur reconnaît son massif ou
   sa commune, et le reste de l'application ne change pas d'un iota. */
/* Les bornes de la sélection courante : la carte de choix comme celle des résultats s'y
   cadrent, et le calcul ne dépend que de l'état. */
function bornesLocales() {
  const bz = etat.zone && boiteZone(etat.zone);
  let b = bz ? L.latLngBounds([bz.swlat, bz.swlng], [bz.nelat, bz.nelng]) : null;
  for (const l of etat.lieux) {
    let x = null;
    if (l.bbox) { const g = L.geoJSON(l.bbox).getBounds(); if (g.isValid()) x = g; }
    if (!x && l.loc) {
      const [la, ln] = String(l.loc).split(',').map(Number);
      if (isFinite(la) && isFinite(ln)) {
        const c = Math.sqrt(l.aire || 0.04) / 2 || 0.1;
        x = L.latLngBounds([la - c, ln - c], [la + c, ln + c]);
      }
    }
    if (x) b = b ? b.extend(x) : x;
  }
  return b;
}

let carteLieu = null, minuteurLieux = null, coucheChoix = null;

function ouvrirSelecteur() {
  const panneau = $('#selecteur');
  panneau.hidden = false;
  if (!carteLieu) {
    const b = bornesLocales();
    carteLieu = L.map('carte-lieu', { scrollWheelZoom:true });
    if (b) carteLieu.fitBounds(b, { padding:[16, 16], maxZoom:11 });
    else carteLieu.setView([46.6, 2.5], 5);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:'© OpenStreetMap', maxZoom:19, className:'fond-clair'
    }).addTo(carteLieu);
    carteLieu.on('moveend', () => {
      clearTimeout(minuteurLieux);
      minuteurLieux = setTimeout(chercherLieux, 400);   // on attend l'arrêt du geste
    });
  }
  setTimeout(() => { carteLieu.invalidateSize(); chercherLieux(); tracerChoix(); }, 30);
}

/* Contours des lieux déjà retenus, dessinés sur la carte de sélection. Les géométries
   passent par le cache des requêtes : les redessiner après un ajout ne coûte rien. */
async function tracerChoix() {
  if (!carteLieu) return;
  if (coucheChoix) { carteLieu.removeLayer(coucheChoix); coucheChoix = null; }
  const formes = [];
  if (etat.zone) formes.push({ type:'Polygon', coordinates:[anneauZone(etat.zone)] });
  for (const l of etat.lieux) {
    try {
      const d = await appelDirect('/places/' + l.id, {});
      const p = d.results && d.results[0];
      if (p && p.geometry_geojson) formes.push(p.geometry_geojson);
      else if (l.bbox) formes.push(l.bbox);
    } catch (e) { if (l.bbox) formes.push(l.bbox); }
  }
  if (!formes.length || !carteLieu) return;
  coucheChoix = L.geoJSON({ type:'GeometryCollection', geometries:formes },
    { style:{ color:'#2F6B4F', weight:2, fillColor:'#2F6B4F', fillOpacity:0.12 },
      interactive:false }).addTo(carteLieu);
}

async function chercherLieux() {
  const cible = $('#lieux-trouves');
  if (!carteLieu || !cible) return;
  cible.innerHTML = `<span class="etat">${t('chercheLieux')}</span>`;
  const b = carteLieu.getBounds();
  try {
    const d = await appelDirect('/places/nearby', {
      nelat:b.getNorth().toFixed(4), nelng:b.getEast().toFixed(4),
      swlat:b.getSouth().toFixed(4), swlng:b.getWest().toFixed(4),
      per_page:30
    });
    const r = d.results || {};
    const vus = new Set();
    const lieux = [...(r.standard || []), ...(r.community || [])]
      .filter(p => !vus.has(p.id) && vus.add(p.id))
      .sort((a, b2) => (b2.bbox_area || 0) - (a.bbox_area || 0))
      .slice(0, 14);

    if (!lieux.length) { cible.innerHTML = `<span class="etat">${t('aucunLieuIci')}</span>`; return; }
    cible.innerHTML = lieux.map((p, i) =>
      `<span class="jeton" data-i="${i}">${echap(p.display_name || p.name)}<small>${
        echap(p.place_type_name || '')}</small></span>`).join('');
    cible.querySelectorAll('.jeton').forEach(el => el.addEventListener('click', () => {
      const p = lieux[+el.dataset.i];
      if (!etat.lieux.some(x => x.id === p.id)) {
        etat.lieux.push({ id:p.id, nom:p.display_name || p.name,
          bbox:p.bounding_box_geojson || null, loc:p.location || null, aire:p.bbox_area || null });
        dessinerJetons();
        tracerChoix();
      }
    }));
  } catch (e) {
    cible.innerHTML = `<span class="etat">${t('aucunLieuIci')}</span>`;
  }
}


/* ============================================================
   Registre des modules
   ============================================================ */

/* Le socle ne connaît pas les onglets : chaque onglet se déclare, et le socle ne fait plus
   que parcourir la liste. Sans cela, ajouter une vue demandait de retoucher reinitialiser(),
   chargerMaintenant(), restaurer(), completer(), enregistrer() et le gestionnaire d'onglets —
   six endroits dispersés, et autant d'occasions d'en oublier un.

   Un module déclare ce qu'il veut parmi :
     id        nom court, celui du data-vue de l'onglet
     tot       vrai si sa vue doit paraître avant même que la taxonomie soit chargée
     dessiner  rendu, sans requête
     ouvrir    à l'activation de l'onglet, quand la vue demande plus qu'un rendu
     vider     remise à zéro entre deux inventaires
     oublier   caches à jeter au changement de langue
     fond      chargement différé ; l'ordre de déclaration est l'ordre d'exécution
     manque    vrai si « fond » reste à faire sur un inventaire tiré de la mémoire
     garder    ce qui part en base, sous forme d'objet
     reprendre ce qui en revient */

/* Sur petit écran, la vignette carrée d'iNaturalist est trop pauvre une fois agrandie : on
   demande la taille au-dessus, qui reste légère. */
const petitEcran = window.matchMedia('(max-width:640px)').matches;

function vignette(e) {
  if (!petitEcran) return e.photo;
  const p = String(e.photoPetite || '');
  return p.replace('/square.', '/small.') || e.photo;
}

/* Huit teintes distinguables, y compris pour la plupart des daltonismes. Au-delà de huit
   espèces sur une même carte la lecture devient illisible. */
const PALETTE_ESP = ['#D81E05', '#2F6B4F', '#3A63B8', '#C97E2B',
                     '#7B3B52', '#38A0A8', '#8CC63F', '#A87C14'];
const MAX_COULEURS = 8;


/* Les limites de la zone d'étude, posées sur n'importe quelle carte de résultats. Sans elles
   on ne sait pas si un vide est un vide réel ou le bord de la sélection — et c'est la
   première question qu'on se pose devant une carte de répartition. */
/* La géométrie réelle d'un lieu, et non sa boîte englobante : celle-ci décrit un rectangle
   qui n'est la limite de rien, et la donner pour la commune était trompeur. Une requête par
   lieu, gardée. */
const geometries = new Map();

async function geometrieLieu(id) {
  if (geometries.has(id)) return geometries.get(id);
  let g = null;
  try {
    const d = await appel('/places/' + id, {}, false, true);
    const p = (d.results || [])[0];
    g = (p && p.geometry_geojson) || null;
  } catch (e) { /* lieu sans géométrie publiée */ }
  geometries.set(id, g);
  return g;
}

/* Les limites de la zone d'étude. Une zone dessinée à la main est bien un rectangle : on la
   trace telle quelle. Un lieu nommé a une forme, qu'on va chercher. */
async function tracerLimites(carte) {
  if (!carte) return null;
  const style = { color:'#14231C', weight:1.8, opacity:0.6, fill:false, interactive:false };
  const couche = L.layerGroup().addTo(carte);
  if (etat.zone && zoneRonde(etat.zone))
    L.circle([etat.zone.lat, etat.zone.lng], { ...style, radius:etat.zone.radius * 1000, dashArray:'5 4' }).addTo(couche);
  else if (etat.zone)
    L.rectangle([[etat.zone.swlat, etat.zone.swlng], [etat.zone.nelat, etat.zone.nelng]],
      { ...style, dashArray:'5 4' }).addTo(couche);
  for (const l of etat.lieux) {
    const g = await geometrieLieu(l.id);
    if (!g) continue;
    try { L.geoJSON(g, { style, interactive:false }).addTo(couche); } catch (e) {}
  }
  return couche;
}


/* ---- Fonds de carte ---- */

const FONDS = {
  plan: { url:'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          attribution:'© OpenStreetMap', classe:'fond-clair' },
  relief: { url:'https://tile.opentopomap.org/{z}/{x}/{y}.png',
            attribution:'© OpenTopoMap, © OpenStreetMap', classe:'', maxZoom:17 },
  satellite: { url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
               attribution:'Imagerie © Esri', classe:'' }
};

const ORDRE_FONDS = ['plan', 'relief', 'satellite'];

/* Calque de repères, posé sur le satellite qui ne porte aucun nom : villes et limites
   administratives, en surimpression légère. Les tuiles « toner-labels » de Stamen, utilisées
   jusqu'ici, ne sont plus servies à leur ancienne adresse depuis 2023. */
const REPERES = { url:'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
                  attribution:'Repères © Esri', maxZoom:19 };

/* Une carte porte son fond courant et les couches qu'il a posées : sans cela il faudrait
   une paire de variables par carte, et le code s'écrivait déjà deux fois. */
function poserFond(carte, nom) {
  if (!carte) return;
  (carte._fondCouches || []).forEach(c => carte.removeLayer(c));
  const f = FONDS[nom] || FONDS.plan;
  const couches = [L.tileLayer(f.url,
    { attribution:f.attribution, maxZoom:f.maxZoom || 19, className:f.classe })];
  // Le satellite ne porte aucun nom : on ajoute villes, routes et limites par-dessus.
  if (nom === 'satellite') couches.push(L.tileLayer(REPERES.url,
    { attribution:REPERES.attribution, maxZoom:REPERES.maxZoom, opacity:0.9 }));
  couches.forEach(c => c.addTo(carte));
  couches[0].bringToBack();
  carte._fondCouches = couches;
  carte._fond = nom;
}


/* L'ancienneté d'une donnée en réserve, en clair. */
function ageTexte(date) {
  const jours = Math.floor((Date.now() - date) / 86400000);
  return jours ? t('mJours', jours) : t('mAujourdhui');
}

function cartonVide(titre = 'rienCharge', texte = 'videListe') {
  return `<div class="vide"><strong>${t(titre)}</strong>${t(texte)}</div>`;
}

const MODULES = [];
const parModule = new Map();

function module(m) {
  MODULES.push(m);
  parModule.set(m.id, m);
  return m;
}

/* Un module défaillant ne doit pas emporter les autres : une vue reste vide, le reste vit. */
function essayer(m, quoi, fn) {
  try { return fn(); }
  catch (e) { console.error(`module ${m.id} — ${quoi} :`, e); }
}

/* tot : premier rendu, avant que la taxonomie complète soit là. Sans filtre, tout est
   redessiné — changement de langue, de nomenclature, inventaire restauré. */
function dessiner(opt = {}) {
  for (const m of MODULES) {
    if (!m.dessiner) continue;
    if (opt.tot && !m.tot) continue;
    essayer(m, 'dessiner', m.dessiner);
  }
  /* Les pastilles suivent l'état des données : une phase de chargement qui se termine sans
     message de progression laissait sinon un onglet marqué comme vide alors qu'il était prêt. */
  majOnglets();
}

function dessinerUn(...ids) {
  for (const id of ids) {
    const m = parModule.get(id);
    if (m && m.dessiner) essayer(m, 'dessiner', m.dessiner);
  }
}

/* Redessine tout ce qui porte du texte, sans requête. */
function redessinerTout() {
  dessinerJetons();
  construireArbre();
  renommer();
}

function oublier() {
  for (const m of MODULES) if (m.oublier) essayer(m, 'oublier', m.oublier);
}

/* Le carton passé en argument dit dans quelle situation on se trouve : « chargement en
   cours » entre deux inventaires, « rien chargé » après un vidage complet. */
function viderModules(carton) {
  for (const m of MODULES) if (m.vider) essayer(m, 'vider', () => m.vider(carton));
}

/* Les libellés ont changé — langue ou nomenclature — mais pas les données. Un module qui
   sait se contenter d'un rafraîchissement de texte le déclare ; les autres se redessinent. */
function renommer() {
  for (const m of MODULES) {
    const fn = m.noms || m.dessiner;
    if (fn) essayer(m, 'renommer', fn);
  }
}

function gardeModules() {
  const d = {};
  for (const m of MODULES) if (m.garder) Object.assign(d, essayer(m, 'garder', m.garder) || {});
  return d;
}

function reprendreModules(d) {
  for (const m of MODULES) if (m.reprendre) essayer(m, 'reprendre', () => m.reprendre(d));
}

/* Le passage d'un onglet à l'autre. Le module décide s'il a quelque chose à faire. */
/* Chaque onglet porte une pastille d'état. Les onglets toujours disponibles n'en ont pas :
   leur contenu ne dépend d'aucun calcul différé, et un module qui ne déclare pas « pret »
   est justement de ceux-là. */
function majOnglets() {
  document.querySelectorAll('nav.onglets button').forEach(b => {
    const m = parModule.get(b.dataset.vue);
    if (!m || !m.pret) { const p = b.querySelector('.pt'); if (p) p.remove(); return; }
    if (!b.querySelector('.pt')) b.insertAdjacentHTML('beforeend', '<span class="pt"></span>');
    b.classList.toggle('pret', !!m.pret());
  });
}

function brancherOnglets() {
  document.querySelectorAll('nav.onglets button').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('nav.onglets button')
        .forEach(x => x.classList.toggle('actif', x === b));
      document.querySelectorAll('section.vue')
        .forEach(s => s.classList.toggle('actif', s.id === 'v-' + b.dataset.vue));
      majURL();
      const m = parModule.get(b.dataset.vue);
      if (m && m.ouvrir) essayer(m, 'ouvrir', m.ouvrir);
    });
  });
}


/* ============================================================
   Connexion, service worker, démarrage commun
   ============================================================ */

/* Le service worker est un fichier séparé, à la racine du site : sa portée est celle de son
   répertoire, donc un seul fichier couvre les trois outils. Il était jusqu'ici enregistré
   depuis le corps de changerLangue(), où il s'était glissé par accident : le mode hors ligne
   ne s'installait qu'après un changement de langue. */
/* Le chemin est calculé depuis celui du socle, non depuis celui de la page : le socle est
   toujours dans /commun/, alors que les pages sont tantôt à la racine, tantôt un cran en
   dessous. Un chemin relatif à la page donnerait deux résultats différents. */
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  const ici = document.currentScript && document.currentScript.src;
  navigator.serviceWorker.register(new URL('../sw.js', ici || location.href).pathname)
    .catch(() => { /* hébergement sans service worker : le site fonctionne sans */ });
}

/* Une coupure réseau se signale d'elle-même : les inventaires en mémoire restent lisibles,
   mais aucun nouveau chargement n'aboutira. */
function majConnexion() {
  const e = $('#etat');
  if (!e) return;
  if (!navigator.onLine) { e.textContent = t('horsLigne'); e.style.color = 'var(--brique)'; }
  else e.style.color = '';
}
window.addEventListener('online', majConnexion);
window.addEventListener('offline', majConnexion);

/* Les branchements que les trois outils partagent. Chaque étape est isolée : un incident
   local n'empêche pas les suivantes. Le site ajoute les siennes, puis lit l'adresse. */
function demarrer(etapesDuSite = []) {
  traduire();

  /* Sur téléphone il n'y a pas de console : tout incident doit s'afficher dans la barre
     d'état, sans quoi la page paraît simplement inerte. */
  window.addEventListener('error', ev => {
    const m = (ev && ev.message) || 'inconnue';
    const e = $('#etat');
    if (e) e.textContent = t('erreurJs', m);
  });

  /* Ouvrir le fichier par double-clic donne une origine « file:// », depuis laquelle la
     plupart des navigateurs refusent les appels réseau. C'est la panne la plus courante, et
     la plus déroutante puisque la page s'affiche normalement. */
  if (location.protocol === 'file:') {
    const e = $('#etat');
    if (e) { e.textContent = t('avertFichier'); e.style.color = 'var(--prune)'; }
  }

  const communes = [
    () => {
      if (!$('#f-langue')) return;
      $('#f-langue').innerHTML = Object.entries(LANGUES)
        .map(([c, n]) => `<option value="${c}"${c === langue ? ' selected' : ''}>${n}</option>`)
        .join('');
      $('#f-langue').addEventListener('change', e => changerLangue(e.target.value));
    },
    () => dessinerJetons(),
    () => {
      brancher('#ouvrir-carte', 'click', ouvrirSelecteur);
      brancher('#fermer-carte', 'click', () => { $('#selecteur').hidden = true; });
      brancher('#zone-vue', 'click', () => {
        if (!carteLieu) return;
        const b = carteLieu.getBounds();
        /* Trois décimales, soit une centaine de mètres. Au-delà, deux cadrages presque
           identiques produiraient deux zones distinctes, donc deux inventaires en mémoire. */
        const r = n => +n.toFixed(3);
        etat.zone = { swlat:r(b.getSouth()), swlng:r(b.getWest()),
                      nelat:r(b.getNorth()), nelng:r(b.getEast()) };
        dessinerJetons();
        tracerChoix();
      });
      brancher('#ma-position', 'click', () => {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
          pos => carteLieu && carteLieu.setView([pos.coords.latitude, pos.coords.longitude], 10),
          () => {});
      });
    },
    () => {
      brancher('#vider', 'click', viderMemoire);
      brancher('#stop', 'click', arreterTout);
      brancher('#voir-memoire', 'click', listerMemoire);
      brancher('#lancer', 'click', () => charger(true));
    },
    () => brancherOnglets(),
    /* La bascule d'un outil à l'autre emporte l'adresse : le lieu et les groupes déjà
       choisis n'ont pas à être ressaisis. */
    () => document.querySelectorAll('[data-garder-etat]').forEach(a => {
      a.addEventListener('click', () => { a.search = location.search; });
    }),
    () => majConnexion()
  ];

  for (const etape of [...communes, ...etapesDuSite, () => lireURL()]) {
    try { etape(); } catch (e) { console.error('Démarrage :', e); }
  }
}
