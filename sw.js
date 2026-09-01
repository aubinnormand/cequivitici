/* Cequivitici — fonctionnement hors ligne.
   Ce fichier doit être déposé à côté de index.html. Il ne peut pas y être intégré : un
   navigateur n'accepte d'enregistrer un service worker que depuis un fichier servi à part.

   Trois caches distincts, aux règles différentes :
   — la coquille (page, feuilles de style, polices, Leaflet) est servie depuis le cache et
     rafraîchie en arrière-plan, pour démarrer instantanément et rester à jour ;
   — les réponses de l'API sont conservées telles quelles, ce qui rend un inventaire déjà
     consulté disponible sans réseau ;
   — les tuiles de carte sont gardées au fil de la navigation, dans la limite d'un plafond,
     de sorte que les zones déjà regardées restent visibles hors ligne. */

const VERSION = 'v1';
const COQUILLE = 'coquille-' + VERSION;
const DONNEES = 'donnees-' + VERSION;
const TUILES = 'tuiles-' + VERSION;
const TUILES_MAX = 400;

const ESSENTIELS = [
  './',
  './index.html',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

self.addEventListener('install', ev => {
  ev.waitUntil(
    caches.open(COQUILLE)
      // Une dépendance externe indisponible ne doit pas faire échouer l'installation.
      .then(c => Promise.allSettled(ESSENTIELS.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', ev => {
  ev.waitUntil(
    caches.keys()
      .then(noms => Promise.all(noms
        .filter(n => !n.endsWith(VERSION))
        .map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

/* Limite la taille d'un cache en supprimant les entrées les plus anciennes. */
async function elaguer(nom, max) {
  const c = await caches.open(nom);
  const cles = await c.keys();
  if (cles.length <= max) return;
  await Promise.all(cles.slice(0, cles.length - max).map(k => c.delete(k)));
}

async function depuisCachePuisReseau(req, nom) {
  const c = await caches.open(nom);
  const enCache = await c.match(req);
  const reseau = fetch(req).then(r => {
    if (r.ok) c.put(req, r.clone());
    return r;
  }).catch(() => null);
  return enCache || reseau || Response.error();
}

async function reseauPuisCache(req, nom, max) {
  const c = await caches.open(nom);
  try {
    const r = await fetch(req);
    if (r.ok) { c.put(req, r.clone()); if (max) elaguer(nom, max); }
    return r;
  } catch (e) {
    const enCache = await c.match(req);
    if (enCache) return enCache;
    throw e;
  }
}

self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Tuiles de carte : réseau d'abord, cache en secours, avec plafond.
  if (/tile\.openstreetmap|arcgisonline|\/heatmap\/|\/grid\/|\/points\//.test(url.href)) {
    ev.respondWith(reseauPuisCache(req, TUILES, TUILES_MAX));
    return;
  }

  // API iNaturalist : le cache permet de retrouver un inventaire hors ligne.
  if (url.hostname === 'api.inaturalist.org') {
    ev.respondWith(reseauPuisCache(req, DONNEES));
    return;
  }

  // Page, polices, Leaflet : affichage immédiat, mise à jour en arrière-plan.
  ev.respondWith(depuisCachePuisReseau(req, COQUILLE));
});
