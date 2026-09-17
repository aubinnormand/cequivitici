/* ============================================================
   Liste personnelle
   ============================================================ */

/* Ce que quelqu'un a déjà observé, lu sur son compte iNaturalist. Aucune écriture : l'outil
   regarde, il ne coche pas. Une coche est donc ici une observation déposée sur iNaturalist,
   définition plus étroite que celle des carnets de terrain, mais vérifiable.

   Deux listes, et la distinction porte tout l'outil :
   — « monde » : tout ce que le compte a jamais observé, où que ce soit. Son complément donne
     les espèces jamais vues, les vraies coches ;
   — « ici » : ce que le compte a observé dans la zone étudiée. Son complément donne ce qui
     manque à la liste du territoire, même pour une espèce déjà vue ailleurs.

   Une requête suffit pour chacune, ou presque : species_counts accepte user_id en même temps
   que place_id, les bornes de la zone et les filtres de qualité, et renvoie les effectifs par
   espèce. On ne rapatrie jamais les observations elles-mêmes. */

const LISTE_PEREMPTION = 12 * 3600 * 1000;   // une demi-journée : une liste bouge tous les jours
const LISTE_PAR_PAGE = 500;

/* La zone d'étude seule, sans le niveau de validation ni la langue : ce qui identifie le
   territoire, et rien de plus. */
function cleZone() {
  return [
    etat.lieux.map(x => x.id).sort((a, b) => a - b).join('.'),
    etat.taxons.map(x => x.id).sort((a, b) => a - b).join('.'),
    etat.zone ? Object.values(etat.zone).join(',') : ''
  ].join('|');
}

/* Les deux ensembles d'identifiants, et de quoi savoir d'où ils viennent. */
let perso = null;   // { login, monde:Set, ici:Set, nMonde, nIci, date }

/* La clé ne porte pas le niveau de validation : une liste personnelle ne dépend pas de lui.
   Basculer entre « validées » et « toutes » ne la refait donc pas. */
function clePerso(portee) {
  return ['perso', etat.pseudo ? etat.pseudo.login : '', portee].join('|');
}

/* species_counts, page après page. Le plafond de l'API est de 500 par page ; une liste de
   plusieurs milliers d'espèces tient donc en une poignée de requêtes, et ce qui revient est
   un identifiant et un compteur, pas une observation. */
async function comptesEspeces(params, gen, libelle) {
  const ids = new Map();
  let page = 1, total = null;
  while (true) {
    const d = await appel('/observations/species_counts',
      { ...params, per_page:LISTE_PAR_PAGE, page, locale:langue });
    verifier(gen);
    const r = d.results || [];
    if (total === null) total = d.total_results || r.length;
    for (const x of r) if (x.taxon) ids.set(x.taxon.id, x.count || 0);
    progression(t('mListe', libelle, nb(ids.size), nb(total)),
      total ? (ids.size / total) * 100 : null);
    if (!r.length || ids.size >= total || page * LISTE_PAR_PAGE >= 10000) break;
    page++;
  }
  return ids;
}

/* La liste est mise en réserve comme les inventaires, dans la même base : un aller-retour
   entre les outils, ou un simple retour sur la page, ne la redemande pas. */
async function listeEnReserve(cle) {
  const d = await surBase('readonly', st => st.get(cle));
  if (!d || Date.now() - d.date > LISTE_PEREMPTION) return null;
  return d;
}

async function chargerPerso(gen) {
  if (!etat.pseudo || !etat.pseudo.id) throw new Error(t('mSansCompte'));

  const lire = async (portee, params, libelle) => {
    const cle = clePerso(portee);
    const garde = await listeEnReserve(cle);
    /* Les réserves écrites avant que l'on garde les effectifs ne contiennent que des
       identifiants : on les refait plutôt que d'afficher des compteurs à zéro. */
    if (garde && garde.paires) return { comptes:new Map(garde.paires), n:garde.paires.length };
    const m = await comptesEspeces(params, gen, libelle);
    const paires = [...m.entries()];
    surBase('readwrite', st => st.put({ cle, date:Date.now(), paires, n:paires.length }));
    return { comptes:m, n:paires.length };
  };

  /* Aucune exigence de validation, ni de photo, ni d'individu sauvage : une observation qui
     n'a pas été confirmée par un tiers reste une espèce que tu as vue. C'est le contraire du
     choix fait pour l'inventaire, où l'on veut des données fiables — ici on veut ta mémoire.
     La conséquence assumée : une détermination fausse de ta part masquera une espèce, qui
     n'apparaîtra pas comme manquante. */
  const commun = { user_id: etat.pseudo.id };

  const monde = await lire('monde', commun, t('lMonde'));
  verifier(gen);
  /* La liste locale reprend le lieu, la zone et les groupes de l'inventaire — mais pas ses
     exigences de qualité, pour la même raison. */
  const ici = await lire('ici|' + cleZone(), { ...commun, ...filtres(true, 'brut') }, t('lIci'));

  /* Deux tables identifiant → nombre d'observations. « has » se comporte comme sur un
     ensemble, si bien que la logique de statut n'a pas bougé. */
  perso = { login: etat.pseudo.login, monde: monde.comptes, ici: ici.comptes,
            nMonde: monde.n, nIci: ici.n, date: Date.now() };
  return perso;
}

/* Le statut d'une espèce de l'inventaire vis-à-vis de la liste. Trois cas seulement, et
   c'est la distinction qui structure toutes les vues. */
function statut(id) {
  if (!perso) return 'inconnu';
  if (perso.ici.has(id)) return 'cochee';        // déjà vue ici
  if (perso.monde.has(id)) return 'ailleurs';    // vue ailleurs, pas ici
  return 'jamais';                               // jamais vue : une vraie coche
}

/* Combien de fois cette personne a observé l'espèce : dans la zone, et partout. */
function mesObs(id) {
  if (!perso) return { ici:0, monde:0 };
  return { ici: perso.ici.get(id) || 0, monde: perso.monde.get(id) || 0 };
}

/* Ses propres observations d'une espèce sur iNaturalist. Aucun filtre de validation : le lien
   doit montrer exactement ce que le compteur annonce, y compris les observations en attente
   d'identification. */
function lienMesObs(id, dansLaZone) {
  /* Le pseudo vient de la liste chargée, non du champ de saisie : celui-ci peut avoir été
     modifié depuis, et le lien renverrait alors aux observations de quelqu'un d'autre. */
  const qui = (perso && perso.login) || (etat.pseudo && etat.pseudo.login) || '';
  const p = new URLSearchParams({ taxon_id:id, user_id:qui });
  if (dansLaZone) {
    if (etat.lieux.length) p.set('place_id', etat.lieux.map(x => x.id).join(','));
    if (etat.zone) for (const [k, v] of Object.entries(etat.zone)) p.set(k, v);
  }
  return 'https://www.inaturalist.org/observations?' + p.toString();
}

function manquants(filtre) {
  return etat.especes.filter(e => {
    const s = statut(e.id);
    if (s === 'cochee' || s === 'inconnu') return false;
    return !filtre || filtre(e, s);
  });
}
