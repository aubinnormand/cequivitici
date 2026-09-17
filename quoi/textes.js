/* ============================================================
   Textes propres à l'outil Identification
   ============================================================ */

/* Le tronc commun est dans commun/textes.js ; seules les clés que cet outil est seul à
   utiliser sont ici, greffées sur la même table. Français et anglais pour l'instant : la
   fonction de traduction retombe sur l'anglais pour toute langue où une clé manque, ce qui
   donne une page cohérente plutôt qu'un mélange de clés brutes. */

Object.entries({
  sousQuoi:{
    fr:"Des espèces probables à la bonne réponse : ce qui vit là où tu as observé, les confusions possibles et les critères pour trancher.",
    en:"From likely species to the right answer: what lives where you made your observation, the possible look-alikes and the criteria to decide."},

  oCandidats:{fr:"Candidats", en:"Candidates"},
  videCandidats:{
    fr:"Les espèces plausibles ici à cette période, classées par fréquence d'observation.",
    en:"The species plausible here for this period, ranked by observation frequency."},

  qAttente:{fr:"Chargement de la période en cours…", en:"Loading this time window…"},
  qFenetreIndispo:{fr:"Période indisponible", en:"Time window unavailable"},
  qFenetreIndispoD:{
    fr:"Les observations de cette période n'ont pas pu être chargées. Réessaie plus tard, ou choisis une autre période.",
    en:"Records for this period could not be loaded. Try again later, or pick another period."},
  qRien:{fr:"Rien à cette période", en:"Nothing for this period"},
  qRienD:{
    fr:"Aucune espèce du groupe choisi n'a été observée ici pendant cette période. Élargis le groupe, le lieu ou la période.",
    en:"No species from the chosen group was recorded here during this period. Widen the group, the place, or the period."},
  qNote:{fr:"{0} · {1} observations au total.", en:"{0} · {1} records in total."},
  qBiais:{
    fr:"À garder en tête : la fréquence d'observation n'est pas la fréquence des individus. Les espèces spectaculaires, diurnes et faciles à photographier sont massivement sur-représentées.",
    en:"Keep in mind: observation frequency is not the frequency of individuals. Spectacular, diurnal and easy-to-photograph species are massively over-represented."},
  qPartTitre:{fr:"{0} observations · {1}", en:"{0} records · {1}"},
  qCandidats:{fr:"candidats", en:"candidates"},
  qComparer:{fr:"Comparer", en:"Compare"},

  cpPanier:{fr:"Retenues", en:"Selected"},

  acOui:{fr:"De saison · {0} obs. sur la période", en:"In season · {0} records in this period"},
  acPeu:{fr:"Peu vue à cette période · {0} obs.", en:"Rarely seen in this period · {0} records"},
  acNon:{fr:"Jamais vue ici à cette période", en:"Never recorded here in this period"},
  acTitre:{
    fr:"Période choisie dans l'onglet Candidats ({0}) : {1} observations dans la zone sur {2} au total, soit {3} %. « De saison » à partir de 5 %.",
    en:"Period chosen in the Candidates tab ({0}): {1} records in the area out of {2} in total, i.e. {3} %. “In season” from 5 %."},

  oConfusions:{fr:"Confusions", en:"Look-alikes"},
  videConfusions:{
    fr:"Les espèces avec lesquelles chaque candidat retenu est le plus souvent confondu, et depuis quelle source.",
    en:"The species each selected candidate is most often confused with, and from which source."},
  cfSansPanier:{fr:"Aucune espèce retenue", en:"No species selected"},
  cfSansPanierD:{
    fr:"Retiens au moins un candidat depuis l'onglet Candidats pour voir ses confusions possibles.",
    en:"Select at least one candidate from the Candidates tab to see its possible confusions."},
  cfAttente:{fr:"Recherche des confusions en cours…", en:"Looking for possible confusions…"},
  cfAvec:{fr:"Confusions avec {0}", en:"Confused with {0}"},
  cfAucune:{fr:"Aucune confusion connue pour cette espèce.", en:"No known confusion for this species."},
  cfForce:{fr:"{0} corrections", en:"{0} corrections"},
  cfPresente:{fr:"Présente dans la zone", en:"Present in the area"},
  cfAbsente:{fr:"Absente de la zone", en:"Not in the area"},
  cfIciTotal:{fr:"{0} obs. dans la zone, toutes dates", en:"{0} records in the area, all dates"},
  cfGroupePresentes:{fr:"Présentes dans la zone", en:"Present in the area"},
  cfGroupePresentesD:{
    fr:"Déjà observées dans la zone chargée : ce sont les confusions qui te concernent vraiment.",
    en:"Already recorded in the loaded area: these are the confusions that really matter to you."},
  cfGroupeAbsentes:{fr:"Absentes de la zone", en:"Not in the area"},
  cfGroupeAbsentesD:{
    fr:"Jamais observées dans la zone chargée. Elles se confondent ailleurs, mais ici on peut en principe les écarter.",
    en:"Never recorded in the loaded area. They get confused elsewhere, but here they can in principle be ruled out."},
  cfAucunePresente:{
    fr:"Aucune des confusions connues n'a été observée dans la zone.",
    en:"None of the known look-alikes has been recorded in the area."},
  cfPic:{fr:"Pic en {0} ({1} %)", en:"Peaks in {0} ({1}%)"},
  cfComparer:{fr:"Comparer", en:"Compare"},
  cfRetirer:{fr:"Retirer", en:"Remove"},

  oCriteres:{fr:"Critères", en:"Criteria"},
  videCriteres:{
    fr:"Les critères que les déterminateurs eux-mêmes ont écrits, pour chaque candidat retenu.",
    en:"The criteria the identifiers themselves wrote, for each selected candidate."},
  crSansPanier:{fr:"Aucune espèce retenue", en:"No species selected"},
  crSansPanierD:{
    fr:"Retiens au moins un candidat depuis l'onglet Candidats pour lire ses critères.",
    en:"Select at least one candidate from the Candidates tab to read its criteria."},
  crAttente:{fr:"Lecture des identifications et des commentaires…", en:"Reading identifications and comments…"},
  crNotes:{fr:"{0} critères", en:"{0} criteria"},
  crAucune:{fr:"Aucun critère trouvé", en:"No criteria found"},
  crAucuneD:{
    fr:"Personne n'a laissé de texte utile pour cette espèce, ici ou ailleurs.",
    en:"No one has left a useful note for this species, here or elsewhere."},
  crSource_id:{fr:"identification", en:"identification"},
  crSource_com:{fr:"commentaire", en:"comment"},
  crSource_aide:{fr:"aide à l'identification", en:"ID tip"},
  crAideNominee:{fr:"Aide à l'identification nominée sur iNaturalist", en:"Nominated as an ID tip on iNaturalist"},
  crVotes:{fr:"{0} vote(s)", en:"{0} vote(s)"},
  crAides:{fr:"Aides à l'identification nominées", en:"Nominated ID tips"},
  crPhMot:{fr:"Chercher un mot dans les critères (ex. aile, wing)…", en:"Search the criteria for a word (e.g. wing)…"},
  crTrouves:{fr:"{0} note(s) contenant ce mot", en:"{0} note(s) containing this word"},
  crRienMot:{fr:"Aucune note ne contient « {0} ».", en:"No note contains “{0}”."},
  crPlus:{fr:"Afficher les {0} autres", en:"Show the other {0}"},
  cpPlus:{fr:"+ de photos", en:"More photos"},
  doNbPhotos:{fr:"{0} photos", en:"{0} photos"},
  doPhoto:{fr:"Photo {0} de l'observation", en:"Observation photo {0}"},
  doFlottant:{fr:"Mon observation · {0} photo(s)", en:"My observation · {0} photo(s)"},
  doRayon:{fr:"Rayon du cercle autour du point", en:"Radius of the circle around the point"},
  doAutoOpt:{fr:"Rayon automatique", en:"Automatic radius"},
  doRayonAuto:{fr:"Cercle de {0} km de rayon, ajusté à la densité d'observations", en:"{0} km radius circle, adjusted to observation density"},
  doRayonFixe:{fr:"Cercle de {0} km de rayon", en:"{0} km radius circle"},
  doDensite:{fr:"Estimation de la densité d'observations autour du point…", en:"Estimating observation density around the point…"},
  crOu_ici:{fr:"ici", en:"here"},
  crOu_ailleurs:{fr:"ailleurs", en:"elsewhere"},
  crVoir:{fr:"Voir l'observation", en:"See the record"},

  geoHors:{fr:"Hors présence attendue", en:"Outside expected range"},
  geoHorsTitre:{
    fr:"Le modèle géographique d'iNaturalist n'attend pas cette espèce dans la zone. Elle y a pourtant été observée : erreur de détermination, espèce rare ou en expansion, ou limite du modèle.",
    en:"iNaturalist's geographic model does not expect this species in the area. It has been recorded there nonetheless: misidentification, rare or spreading species, or a limit of the model."},

  geoPtNon:{fr:"Non attendue à ce point", en:"Not expected at this point"},
  geoPtNonTitre:{
    fr:"Le modèle géographique d'iNaturalist n'attend pas cette espèce à l'endroit de l'observation. Ce n'est pas une impossibilité — espèce rare, en expansion, ou limite du modèle — mais c'est un argument fort contre elle.",
    en:"iNaturalist's geographic model does not expect this species where the observation was made. Not an impossibility — rare or spreading species, or a limit of the model — but a strong argument against it."},
  geoPtOui:{fr:"Attendue à ce point", en:"Expected at this point"},
  geoPtOuiTitre:{
    fr:"Le modèle géographique d'iNaturalist attend cette espèce à l'endroit de l'observation.",
    en:"iNaturalist's geographic model expects this species where the observation was made."},
  geoMuet:{fr:"Modèle muet", en:"No model"},
  geoMuetTitre:{
    fr:"Le modèle géographique d'iNaturalist ne couvre pas cette espèce (trop peu d'observations), ou n'a pas pu être lu : aucun verdict.",
    en:"iNaturalist's geographic model does not cover this species (too few records), or could not be read: no verdict."},
  geoFiltreToutes:{fr:"Toutes les espèces de la zone", en:"All species in the area"},
  geoFiltreAttendues:{fr:"Seulement celles attendues au point", en:"Only those expected at the point"},
  cfJamaisZone:{fr:"jamais observée dans la zone", en:"never recorded in the area"},
  cfGroupePoint:{fr:"Compatibles avec le point de l'observation", en:"Compatible with the observation's location"},
  cfGroupePointD:{
    fr:"Espèces que le modèle géographique d'iNaturalist attend à cet endroit (ou qu'il ne couvre pas). Ce sont les confusions à examiner, qu'elles aient été observées dans la zone ou non.",
    en:"Species that iNaturalist's geographic model expects at this location (or does not cover). These are the look-alikes to examine, whether recorded in the area or not."},
  cfAucunePoint:{
    fr:"Aucune des confusions connues n'est attendue à cet endroit.",
    en:"None of the known look-alikes is expected at this location."},
  cfGroupeHorsPoint:{fr:"Non attendues à ce point", en:"Not expected at this point"},
  cfGroupeHorsPointD:{
    fr:"Le modèle ne les attend pas à cet endroit : elles se confondent ailleurs, mais ici on peut en principe les écarter.",
    en:"The model does not expect them at this location: they get confused elsewhere, but here they can in principle be ruled out."},
  attTitrePoint:{fr:"Attendues à ce point, jamais observées dans la zone", en:"Expected at this point, never recorded in the area"},
  attNotePoint:{
    fr:"Espèces du même groupe observées dans un rayon de {0} km pendant la période, que le modèle géographique d'iNaturalist attend au point de l'observation, mais que personne n'a encore notées dans la zone. Des hypothèses à garder en tête, pas des constats.",
    en:"Species of the same group recorded within {0} km during the period, which iNaturalist's geographic model expects at the observation's location, but which nobody has recorded in the area yet. Hypotheses to keep in mind, not findings."},
  biGeoPoint:{fr:"Non attendue à ce point par iNaturalist", en:"Not expected at this point by iNaturalist"},
  rpAuPoint:{fr:"Au point de l'observation", en:"At the observation's location"},
  attTitre:{fr:"Attendues ici, jamais observées dans la zone", en:"Expected here, never recorded in the area"},
  attNote:{
    fr:"Espèces du même groupe observées dans un rayon de {0} km pendant la période, que le modèle géographique d'iNaturalist attend dans la zone, mais que personne n'y a encore notées. Ce sont des hypothèses à garder en tête, pas des constats.",
    en:"Species of the same group recorded within {0} km during the period, which iNaturalist's geographic model expects in the area, but which nobody has recorded there yet. Hypotheses to keep in mind, not findings."},
  attEnCours:{fr:"modèle interrogé · {0} / {1}", en:"querying the model · {0} / {1}"},
  attEtiquette:{fr:"Attendue, jamais observée ici", en:"Expected, never recorded here"},
  attAlentours:{fr:"{0} obs. dans un rayon de {1} km", en:"{0} records within {1} km"},
  attAucune:{fr:"Aucune espèce des alentours n'est attendue ici sans y avoir été observée.", en:"No nearby species is expected here without having been recorded."},
  attErreur:{fr:"Les espèces des alentours n'ont pas pu être lues.", en:"Nearby species could not be read."},

  cfSourceT_genus:{fr:"Source : repli sur le même genre.", en:"Source: fallback to the same genus."},
  cfSourceD_genus:{
    fr:"iNaturalist n'a pas fourni de recensement des corrections pour cette espèce. L'outil montre à la place les espèces du même genre observées dans la zone, par fréquence. La parenté n'est pas la ressemblance : c'est une piste, pas une liste de pièges avérés.",
    en:"iNaturalist provided no correction data for this species. The tool shows instead the species of the same genus recorded in the area, by frequency. Kinship is not resemblance: a lead, not a list of proven pitfalls."},
  cfSourceT_family:{fr:"Source : repli sur la même famille.", en:"Source: fallback to the same family."},
  cfSourceD_family:{
    fr:"Pas de recensement des corrections, et aucune autre espèce du même genre dans la zone : l'outil montre les espèces de la même famille observées ici. La parenté n'est pas la ressemblance.",
    en:"No correction data, and no other species of the same genus in the area: the tool shows species of the same family recorded here. Kinship is not resemblance."},
  cfSourceT_rien:{fr:"Aucune source.", en:"No source."},
  cfSourceD_rien:{
    fr:"Ni recensement des corrections, ni espèce apparentée dans la zone.",
    en:"Neither correction data nor related species in the area."},

  crCite:{fr:"cite {0}", en:"mentions {0}"},
  crDistingue:{fr:"Ce qui la distingue de {0}", en:"What sets it apart from {0}"},
  crDistingueD:{
    fr:"Notes sur cette espèce qui citent une autre espèce retenue. Ce sont presque toujours les critères qui les séparent. Les noms cités sont surlignés.",
    en:"Notes on this species that mention another selected species. These are almost always the criteria that separate them. Mentioned names are highlighted."},
  crDistingueRien:{
    fr:"Aucune note sur cette espèce ne cite les autres espèces retenues. Regarde aussi les critères de l'autre espèce : la comparaison y est peut-être écrite dans l'autre sens.",
    en:"No note on this species mentions the other selected species. Check the other species' criteria too: the comparison may be written the other way round."},
  crUneSeule:{
    fr:"Retiens au moins deux espèces pour voir les notes qui les départagent.",
    en:"Select at least two species to see the notes that tell them apart."},
  crAutres:{fr:"Autres critères", en:"Other criteria"},
  crAutresD:{
    fr:"Les notes dans ta langue d'abord, puis les plus développées.",
    en:"Notes in your language first, then the most detailed."},

  doTitre:{fr:"Partir d'une observation", en:"Start from an observation"},
  doIntro:{
    fr:"Facultatif. Colle le lien d'une observation iNaturalist, ou choisis un point et une date : le lieu devient un cercle autour du point (rayon ajusté à la densité d'observations, ou choisi), la période se centre sur la date, et le groupe devient l'ordre du taxon proposé (ou, au choix, son règne, son embranchement, sa classe, sa famille ou son genre). Tu pourras ensuite redescendre la taxonomie branche par branche.",
    en:"Optional. Paste the link to an iNaturalist observation, or pick a point and a date: the place becomes a circle around the point (radius adjusted to observation density, or chosen), the period centres on the date, and the group becomes the order of the suggested taxon (or, as you choose, its kingdom, phylum, class, family or genus). You can then walk down the taxonomy branch by branch."},
  doPhLien:{fr:"Lien ou numéro d'observation iNaturalist…", en:"iNaturalist observation link or number…"},
  doNiveau:{fr:"Groupe à charger", en:"Group to load"},
  doN_kingdom:{fr:"Partir du règne", en:"Start from the kingdom"},
  doN_phylum:{fr:"Partir de l'embranchement", en:"Start from the phylum"},
  doN_class:{fr:"Partir de la classe", en:"Start from the class"},
  doN_order:{fr:"Partir de l'ordre", en:"Start from the order"},
  doN_family:{fr:"Partir de la famille", en:"Start from the family"},
  doN_genus:{fr:"Partir du genre", en:"Start from the genus"},
  oTaxonomie:{fr:"Taxonomie", en:"Taxonomy"},
  videTaxonomie:{
    fr:"Descendre la taxonomie niveau par niveau, jusqu'aux espèces : la part des observations de chaque groupe ici à cette période, et les photos de ses espèces principales.",
    en:"Walk down the taxonomy level by level, down to species: each group's share of the records here at this time, and photos of its main species."},
  taToutes:{fr:"Afficher toutes les espèces ({0})", en:"Show all species ({0})"},
  taGroupes:{fr:"Revenir aux groupes", en:"Back to groups"},
  taToutesTitre:{fr:"Toutes les espèces de {0} · {1}", en:"All species of {0} · {1}"},
  taRayonKm:{fr:"rayon {0} km", en:"{0} km radius"},
  taPhotos:{fr:"Photos affichées", en:"Photos shown"},
  taVoirCandidats:{fr:"Voir ces espèces dans Candidats", en:"Show these species in Candidates"},
  taEspecesDirectes:{fr:"Espèces rattachées directement à {0}", en:"Species placed directly under {0}"},
  r_subphylum:{fr:"sous-embr.", en:"subphylum"},
  r_subclass:{fr:"sous-classe", en:"subclass"},
  r_infraclass:{fr:"infra-classe", en:"infraclass"},
  r_superorder:{fr:"super-ordre", en:"superorder"},
  r_infraorder:{fr:"infra-ordre", en:"infraorder"},
  r_parvorder:{fr:"parvordre", en:"parvorder"},
  r_zoosection:{fr:"section", en:"zoosection"},
  r_zoosubsection:{fr:"sous-section", en:"zoosubsection"},
  r_epifamily:{fr:"épifamille", en:"epifamily"},
  r_subfamily:{fr:"sous-famille", en:"subfamily"},
  r_supertribe:{fr:"super-tribu", en:"supertribe"},
  r_tribe:{fr:"tribu", en:"tribe"},
  r_subtribe:{fr:"sous-tribu", en:"subtribe"},
  r_subgenus:{fr:"sous-genre", en:"subgenus"},
  r_section:{fr:"section", en:"section"},
  r_subsection:{fr:"sous-section", en:"subsection"},
  r_complex:{fr:"complexe", en:"complex"},
  r_hybrid:{fr:"hybride", en:"hybrid"},
  r_variety:{fr:"variété", en:"variety"},
  r_form:{fr:"forme", en:"form"},
  guPropose:{fr:"proposé sur l'observation", en:"suggested on the observation"},
  guDetail:{fr:"{0} obs. · {1} esp.", en:"{0} records · {1} sp."},
  doLire:{fr:"Lire l'observation", en:"Read the observation"},
  doOuPoint:{fr:"Ou un point et une date", en:"Or a point and a date"},
  doPoint:{fr:"Choisir le point sur la carte", en:"Pick the point on the map"},
  doAppliquer:{fr:"Utiliser", en:"Use"},
  doSansPoint:{fr:"aucun point choisi", en:"no point chosen"},
  doLecture:{fr:"Lecture de l'observation…", en:"Reading the observation…"},
  doLienInvalide:{fr:"Lien ou numéro non reconnu.", en:"Link or number not recognised."},
  doIntrouvable:{fr:"Observation introuvable.", en:"Observation not found."},
  doSansLieu:{fr:"Cette observation n'a pas de position lisible.", en:"This observation has no readable position."},
  doEchec:{fr:"L'observation n'a pas pu être lue.", en:"The observation could not be read."},
  doObs:{fr:"Observation n° {0}", en:"Observation #{0}"},
  doSansTaxon:{fr:"sans identification", en:"not identified"},
  doFloute:{
    fr:"Position floutée par son auteur (à une vingtaine de kilomètres près) : le rayon ne descend pas sous 50 km.",
    en:"Position obscured by its author (to within about twenty kilometres): the radius does not go below 50 km."},
  doVoirObs:{fr:"Voir sur iNaturalist", en:"See on iNaturalist"},

  oBilan:{fr:"Bilan", en:"Summary"},
  videBilan:{
    fr:"Pour chaque espèce retenue, garde-la ou écarte-la avec une raison. Le bilan se recopie dans un commentaire iNaturalist.",
    en:"For each selected species, keep it or rule it out with a reason. The summary can be pasted into an iNaturalist comment."},
  biSansPanier:{fr:"Aucune espèce retenue", en:"No species selected"},
  biSansPanierD:{
    fr:"Retiens des candidats depuis l'onglet Candidats, puis reviens ici pour les écarter un à un.",
    en:"Select candidates from the Candidates tab, then come back here to rule them out one by one."},
  biIntro:{
    fr:"Garde ou écarte chaque espèce. Les boutons clairs sont ce que les données disent contre elle : un clic l'écarte pour cette raison.",
    en:"Keep or rule out each species. The light buttons are what the data say against it: one click rules it out for that reason."},
  biZone:{fr:"Jamais observée dans la zone", en:"Never recorded in the area"},
  biSaison:{fr:"Aucune observation dans la zone pendant {0}", en:"No record in the area during {0}"},
  biPeu:{fr:"Seulement {0} obs. dans la zone pendant {1}", en:"Only {0} records in the area during {1}"},
  biGeo:{fr:"Hors de la présence attendue par iNaturalist", en:"Outside the range expected by iNaturalist"},
  biRienContre:{fr:"Rien dans les données ne l'écarte.", en:"Nothing in the data rules it out."},
  biAppliquer:{fr:"Écarter pour cette raison", en:"Rule out for this reason"},
  biGardee:{fr:"Gardée", en:"Kept"},
  biEcarter:{fr:"Écartée :", en:"Ruled out:"},
  biR_saison:{fr:"hors saison", en:"out of season"},
  biR_geo:{fr:"hors présence attendue", en:"outside expected range"},
  biR_zone:{fr:"absente de la zone", en:"absent from the area"},
  biR_critere:{fr:"critère visible", en:"visible feature"},
  biR_autre:{fr:"autre raison", en:"other reason"},
  biPhNote:{fr:"Précision (ex. : tarses jaunes visibles)", en:"Detail (e.g. yellow tarsi visible)"},
  biResume:{fr:"Bilan à recopier", en:"Summary to paste"},
  biCopier:{fr:"Copier", en:"Copy"},
  biCopie:{fr:"Copié.", en:"Copied."},
  biEntete:{fr:"Candidats examinés — {0}", en:"Candidates examined — {0}"},
  biGardees:{fr:"Gardée(s) :", en:"Kept:"},
  biEcartees:{fr:"Écartée(s) :", en:"Ruled out:"},
  biObs:{fr:"observation n° {0}", en:"observation #{0}"},
  biAutour:{fr:"autour de {0} (rayon {1} km)", en:"around {0} ({1} km radius)"},
  biPied:{
    fr:"(Fréquences et saisons d'après les observations iNaturalist de la zone ; présence attendue d'après le modèle géographique d'iNaturalist.)",
    en:"(Frequencies and seasons from iNaturalist records in the area; expected presence from iNaturalist's geographic model.)"},

  oRepartition:{fr:"Répartition", en:"Range"},
  videRepartition:{
    fr:"L'aire de répartition de chaque candidat retenu, d'après iNaturalist, sur la même carte et sous les mêmes couleurs.",
    en:"The range of each selected candidate, according to iNaturalist, on the same map and under the same colours."},
  rpC_attendue:{fr:"Présence attendue", en:"Expected range"},
  rpC_observations:{fr:"Observations", en:"Records"},
  rpEspece:{fr:"Espèce", en:"Species"},
  rpRecadrer:{fr:"Recadrer sur la zone", en:"Back to the area"},
  rpDispoOui:{fr:"✓ affichée", en:"✓ shown"},
  rpDispoNon:{fr:"— rien près de la zone", en:"— nothing near the area"},
  rpDispoAbsente:{fr:"— non disponible", en:"— not available"},
  rpDispoInconnu:{fr:"? non vérifiable", en:"? cannot check"},
  rpTrop:{fr:"Seules les {0} premières espèces retenues sont cartographiées.",
    en:"Only the first {0} selected species are mapped."},
  rpNoteAttendue:{
    fr:"Présence attendue : le modèle géographique d'iNaturalist, celui qu'utilise l'identification automatique. Il indique, par mailles d'une quarantaine de kilomètres, où l'espèce est attendue d'après l'ensemble des observations. Disponible pour la plupart des espèces bien observées.",
    en:"Expected range: iNaturalist's geographic model, the one used by automatic identification. It shows, in cells about forty kilometres wide, where the species is expected given all records. Available for most well-recorded species."},
  rpNoteObservations:{
    fr:"Observations : la grille de toutes les observations de l'espèce dans le monde, au niveau de validation choisi. Plus la maille est intense, plus elle compte d'observations.",
    en:"Records: the grid of all records of the species worldwide, at the chosen validation level. The more intense a cell, the more records it holds."},
  rpSansPanier:{fr:"Aucune espèce retenue", en:"No species selected"},
  rpSansPanierD:{
    fr:"Retiens au moins un candidat depuis l'onglet Candidats pour voir sa répartition.",
    en:"Select at least one candidate from the Candidates tab to see its range."},
}).forEach(([k, v]) => { for (const l in v) TEXTES[l][k] = v[l]; });
