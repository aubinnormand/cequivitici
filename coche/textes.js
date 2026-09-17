/* ============================================================
   Textes propres à l'outil Coche
   ============================================================ */

/* Le tronc commun est dans commun/textes.js ; seules les clés que cet outil est seul à
   utiliser sont ici, greffées sur la même table. Français et anglais pour l'instant : la
   fonction de traduction retombe sur l'anglais pour toute langue où une clé manque, ce qui
   donne une page cohérente plutôt qu'un mélange de clés brutes. */

Object.entries({
  sousCoche:{
    fr:"Les espèces d'un lieu que tu n'as encore jamais observées, et où et quand aller les chercher.",
    en:"The species of a place you have never recorded yet, and where and when to go and look for them."},

  qui:{fr:"Compte iNaturalist", en:"iNaturalist account"},
  choisirCompte:{fr:"Indique ton compte iNaturalist, puis un lieu.",
    en:"Enter your iNaturalist account, then a place."},
  phPseudo:{fr:"Ton pseudo iNaturalist…", en:"Your iNaturalist username…"},

  attPheno:{fr:"Le calendrier des espèces de la zone est en cours de calcul. Il apparaîtra ici dans quelques instants.",
    en:"The calendar of the area's species is being computed. It will appear here in a moment."},
  oManquants:{fr:"Manquants", en:"Missing"},
  oOu:{fr:"Où ?", en:"Where?"},
  oQuand:{fr:"Quand ?", en:"When?"},
  videQuand:{
    fr:"Les meilleurs mois pour voir ce qui te manque, et ce qu'il y a à chercher ce mois-ci.",
    en:"The best months to find what you are missing, and what to look for this month."},
  qdDetail:{fr:"{0} · {1} espèces", en:"{0} · {1} species"},
  qdPart:{fr:"{0} % de l'année", en:"{0} % of the year"},
  qdTriObs:{fr:"Nombre d'observations", en:"Number of records"},
  qdTriSaison:{fr:"Saisonnalité", en:"Seasonality"},
  qdTriResp:{fr:"Responsabilité", en:"Responsibility"},
  qdMaintenant:{fr:"Maintenant ({0} → {1})", en:"Right now ({0} → {1})"},
  qdFenetreNom:{fr:"Du {0} au {1}", en:"{0} to {1}"},
  qdAxe:{fr:"Nombre d'espèces", en:"Number of species"},
  qdAVoir:{fr:"à voir", en:"to find"},
  qdDejaVues:{fr:"déjà vues", en:"already seen"},
  qdVide:{fr:"Rien ne te manque ce mois-ci.", en:"Nothing missing this month."},
  oTerrain:{fr:"Carte", en:"Map"},
  videTerrain:{
    fr:"La carte de terrain : ta position en direct, les espèces retenues autour de toi, et leurs photos.",
    en:"The field map: your live position, the selected species around you, and their photos."},
  tMeSituer:{fr:"Me situer", en:"Locate me"},
  tSuivi:{fr:"● Suivi en cours", en:"● Tracking"},
  tRetenues:{fr:"{0} espèces retenues", en:"{0} species selected"},
  tAucune:{fr:"aucune espèce retenue", en:"no species selected"},
  tSansGeoloc:{fr:"Cet appareil ne donne pas la position.",
    en:"This device does not provide a position."},
  tGeolocRefus:{fr:"Position refusée : autorise la géolocalisation pour ce site.",
    en:"Position refused: allow geolocation for this site."},
  oClassement:{fr:"Classement", en:"Ranking"},
  videClassement:{
    fr:"Qui a vu le plus d'espèces dans cette zone, et à quelle place tu te situes.",
    en:"Who has seen the most species in this area, and where you stand."},
  clEnCours:{fr:"Lecture en cours…", en:"Reading…"},
  clTotal:{fr:"{0} contributeurs", en:"{0} contributors"},
  clToi:{fr:"toi", en:"you"},
  clSansCompte:{
    fr:"Indique ton compte iNaturalist pour voir ta place.",
    en:"Enter your iNaturalist account to see where you stand."},
  clAbsent:{
    fr:"Tu n'apparais pas dans les cent premiers. Ta liste locale en compte {0}.",
    en:"You are not in the first hundred. Your local list holds {0}."},
  oCouverture:{fr:"Complétude", en:"Completeness"},

  sVue:{fr:"vue ici", en:"seen here"},
  aucuneVue:{fr:"Rien de coché ici", en:"Nothing ticked here"},
  aucuneVueD:{fr:"Tout est à faire.", en:"Everything is still to do."},

  videCarteOu:{
    fr:"Où aller pour voir le plus d'espèces nouvelles, mois par mois.",
    en:"Where to go to see the most new species, month by month."},
  gEnMemoire:{fr:"● en mémoire · {0}", en:"● from memory · {0}"},
  gPeriode:{fr:"Période", en:"Period"},
  gVueJamais:{fr:"Jamais vues", en:"Never seen"},
  gVueToutes:{fr:"Toutes les espèces", en:"All species"},
  gEnReserve:{fr:"Déjà collecté", en:"Already collected"},
  gAucuneReserve:{
    fr:"rien encore — un relevé reste en mémoire une semaine et se reprend d'un clic",
    en:"nothing yet — a survey stays in memory for a week and is one click away"},
  gFenetreCourt:{fr:"Maintenant", en:"Right now"},
  gDejaComplet:{
    fr:"La collecte générale contient déjà toutes les observations disponibles : une collecte dédiée ramènerait les mêmes, d'où le bouton éteint.",
    en:"The general collection already holds every available record: a dedicated survey would bring back the same ones, hence the disabled button."},
  gFenetreOpt:{fr:"Maintenant ({0} → {1})", en:"Right now ({0} → {1})"},
  gFenetreNom:{fr:"les quatre semaines du {0} au {1}", en:"the four weeks from {0} to {1}"},
  gLancer:{fr:"Collecter", en:"Collect"},
  gRelancer:{fr:"Recollecter", en:"Collect again"},
  gLancerMois:{fr:"Collecter {0} seul", en:"Collect {0} only"},
  gRelancerMois:{fr:"Recollecter {0}", en:"Collect {0} again"},
  gArret:{fr:"Collecte interrompue", en:"Collection interrupted"},
  gArretD:{fr:"Elle reprendra du début si tu la redemandes.",
    en:"It will start again from the beginning if you ask for it."},
  gEnCours:{fr:"Collecte en cours…", en:"Collecting…"},
  gAvant:{
    fr:"Compte une minute. Le relevé est gardé en mémoire.",
    en:"Allow a minute. The survey is kept in memory."},
  duMonde:{fr:"du monde ici", en:"of world total here"},
  mesObsIci:{fr:"{0} de toi ici", en:"{0} by you here"},
  mesObsAilleurs:{fr:"{0} de toi ailleurs", en:"{0} by you elsewhere"},
  gAjouter:{fr:"Porter sur la carte", en:"Show on the map"},
  gChoisies:{fr:"Sur la carte", en:"On the map"},
  gSurCarte:{fr:"visibles sur la carte", en:"shown on the map"},
  gViderChoix:{fr:"Tout retirer", en:"Clear"},
  gVoirCarte:{fr:"visibles dans l'onglet Carte, une fois la collecte faite",
    en:"visible in the Map tab, once the collection is done"},
  gTropChoisies:{fr:"Huit espèces au plus sur la carte : au-delà les couleurs ne se distinguent plus.",
    en:"Eight species at most on the map: beyond that the colours stop being distinguishable."},
  gPodium:{fr:"les trois meilleurs", en:"top three"},
  gLegende:{fr:"Espèces manquantes par carreau", en:"Missing species per cell"},
  gLegendeResp:{fr:"Score de responsabilité par carreau", en:"Responsibility score per cell"},
  mCompte:{fr:"Nombre d'espèces", en:"Species count"},
  mResp:{fr:"Pondéré par la responsabilité", en:"Weighted by responsibility"},
  gDansCarreau:{fr:"dans ce carreau", en:"in this cell"},
  gCellule:{fr:"{0} espèces qui te manquent ici, sur {1} observations",
    en:"{0} species missing here, from {1} records"},
  gCelluleVide:{fr:"Rien ne te manque dans ce carreau.", en:"Nothing missing in this cell."},

  videManquants:{
    fr:"Indique un compte et un lieu, puis charge : l'inventaire du lieu moins ce que tu as déjà observé.",
    en:"Enter an account and a place, then load: the inventory of the place minus what you have already recorded."},
  videCouverture:{
    fr:"La part de la faune et de la flore locales que tu as déjà observée, branche par branche.",
    en:"The share of the local wildlife you have already recorded, branch by branch."},

  mListe:{fr:"Liste {0} : {1} espèces sur {2}", en:"List {0}: {1} of {2} species"},
  mSansCompte:{fr:"Aucun compte iNaturalist indiqué.", en:"No iNaturalist account given."},
  lMonde:{fr:"mondiale", en:"worldwide"},
  lIci:{fr:"locale", en:"local"},

  sJamais:{fr:"pas vue", en:"not seen"},
  sAilleurs:{fr:"pas ici", en:"not here"},
  dJamais:{fr:"absente de ta liste mondiale — une vraie coche",
    en:"absent from your worldwide list — a genuine tick"},
  dAilleurs:{fr:"déjà vue ailleurs, mais pas dans cette zone",
    en:"already seen elsewhere, but not in this area"},
  dVue:{fr:"déjà observée ici", en:"already recorded here"},
  vuMonde:{fr:"Déjà vues n'importe où", en:"Already seen anywhere"},
  vuIci:{fr:"Déjà vues ici", en:"Already seen here"},

  bCoche:{fr:"de l'inventaire coché", en:"of the inventory ticked"},
  bCocheMonde:{fr:"vues n'importe où", en:"seen anywhere"},
  bCocheIci:{fr:"vues dans la zone", en:"seen in the area"},
  bReste:{fr:"restent à voir", en:"still to find"},
  qJamais:{fr:"Jamais vues, nulle part", en:"Never seen, anywhere"},
  qPasIci:{fr:"Jamais vues ici", en:"Never seen here"},
  qVues:{fr:"Déjà vues, n'importe où", en:"Already seen, anywhere"},
  qVuesIci:{fr:"Déjà vues ici", en:"Already seen here"},
  qTout:{fr:"Tout l'inventaire", en:"The whole inventory"},


  sansListe:{fr:"Liste personnelle en cours de lecture", en:"Reading your list"},
  sansListeD:{fr:"La soustraction attend ta liste. Quelques secondes.",
    en:"The subtraction is waiting for your list. A few seconds."},
  toutCoche:{fr:"Rien ne te manque ici", en:"Nothing missing here"},
  toutCocheD:{fr:"Élargis le lieu, ou change de groupe.",
    en:"Widen the place, or change group."},

  mFenetre:{fr:"Observations des quatre semaines autour d'aujourd'hui…",
    en:"Records from the four weeks around today…"},
  rEspece:{fr:"espèce", en:"species"},
  gRienAMontrer:{fr:"Rien à cartographier", en:"Nothing to map"},
  gRienCompte:{fr:"Essaie une autre période, ou élargis la zone.",
    en:"Try another period, or widen the area."},
  gRienResp:{fr:"Les effectifs mondiaux ne sont pas encore connus : repasse au nombre d'espèces.",
    en:"World totals are not known yet: switch back to species count."},
  couvGlobale:{fr:"de l'inventaire coché", en:"of the inventory ticked"},
  couvEspeces:{fr:"espèces vues ici", en:"species seen here"},
  couvListe:{fr:"espèces sur ton compte", en:"species on your account"},
  aVoir:{fr:"à voir", en:"to find"}
}).forEach(([k, v]) => { for (const l in v) TEXTES[l][k] = v[l]; });
