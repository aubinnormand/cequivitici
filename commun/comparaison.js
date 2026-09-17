/* ============================================================
   Comparaison
   ============================================================

   Plusieurs espèces côte à côte, sous le même filtre. Repris tel quel du premier outil : la
   vue ne connaît que le panier et les annotations d'iNaturalist, jamais ce qui a servi à
   remplir ce panier. Elle sert donc aussi bien à examiner une liste locale qu'à trancher
   entre deux candidats à déterminer. */

/* Le panier se remplit depuis n'importe quelle vue montrant des fiches : la liste, la
   saisonnalité, les découvertes, les candidats à déterminer. On accepte donc aussi bien un
   élément qu'un sélecteur. */
function brancherPanier(racine, redessiner) {
  const hote = typeof racine === 'string' ? $(racine) : racine;
  if (!hote) return;
  hote.querySelectorAll('[data-panier]').forEach(b => {
    b.addEventListener('click', ev => {
      ev.preventDefault();
      const id = +b.dataset.panier;
      const i = etat.panier.indexOf(id);
      if (i < 0) etat.panier.push(id); else etat.panier.splice(i, 1);
      b.classList.toggle('pris', i < 0);
      b.textContent = i < 0 ? '✓' : '□';
      dessinerComparaison();
      if (redessiner) redessiner();
    });
  });
}

/* Vider ou modifier le panier doit rafraîchir la vue qui l'alimente — la liste dans un
   outil, les candidats dans l'autre. Le module de comparaison ne sait pas laquelle : chaque
   site le lui dit. */
let surPanier = () => {};

/* Une espèce du panier peut ne pas figurer dans l'inventaire : l'outil Identification propose aussi
   des espèces attendues mais jamais observées dans la zone. L'outil dit ici où les trouver. */
let especeExterne = () => null;

/* Une série de photos de référence à placer en tête des colonnes : dans l'outil
   Identification, les photos de l'observation qu'on cherche à nommer. */
let photosReference = () => null;

function boutonPanier(id) {
  return `<button class="choisir${etat.panier.includes(id) ? ' pris' : ''}"
    data-panier="${id}" aria-label="${echap(t('cpAjouter'))}"
    >${etat.panier.includes(id) ? '✓' : '□'}</button>`;
}

/* ============================================================
   Comparaison : plusieurs espèces côte à côte, sous le même filtre
   ============================================================ */

/* Les annotations d'iNaturalist — sexe, stade de vie, phénologie des plantes — ne sont pas
   devinées : on demande le vocabulaire au serveur, qui renvoie les libellés déjà traduits.
   On l'interroge pour la première espèce du panier plutôt qu'en général : le menu ne propose
   alors que ce qui s'applique réellement, la floraison pour une plante, le sexe et le stade
   pour un animal. C'est aussi ainsi qu'apparaît « pas de floraison », l'annotation qui isole
   les individus sans fleur. */
let vocabulaire = null, vocabulairePour = null;
const vocabulaires = new Map();   // taxon (0 : aucun) → termes utilisables
let cpAnnot = '';          // « termeId:valeurId », vide pour toutes les photos
let cpLocal = false;
const cachePhotos = new Map();
const CP_PAR_PAGE = 5;
const cpPages = new Map();   // espèce et filtre → pages de photos demandées par l'utilisateur
const clePhotos = (id, annot = cpAnnot, local = cpLocal, qualite = etat.qualite) =>
  [id, annot, local ? cleInventaire() : '', qualite].join('|');


/* iNaturalist ne traduit pas son vocabulaire d'annotations : les libellés arrivent en anglais
   quelle que soit la langue demandée. On les traduit donc ici, en retombant sur l'original
   pour tout terme inconnu — la plateforme en ajoute régulièrement. */
const ANNOTATIONS = {
  'life stage':{fr:"Stade de vie",es:"Etapa vital",it:"Stadio vitale",de:"Lebensstadium"},
  'sex':{fr:"Sexe",es:"Sexo",it:"Sesso",de:"Geschlecht"},
  'flowers and fruits':{fr:"Fleurs et fruits",es:"Flores y frutos",it:"Fiori e frutti",de:"Blüten und Früchte"},
  'plant phenology':{fr:"Phénologie",es:"Fenología",it:"Fenologia",de:"Phänologie"},
  'alive or dead':{fr:"Vivant ou mort",es:"Vivo o muerto",it:"Vivo o morto",de:"Lebend oder tot"},
  'evidence of presence':{fr:"Indice de présence",es:"Indicio de presencia",it:"Indizio di presenza",de:"Präsenznachweis"},
  'leaves':{fr:"Feuillage",es:"Follaje",it:"Fogliame",de:"Belaubung"},
  'establishment':{fr:"Statut",es:"Estatus",it:"Stato",de:"Status"},
  'adult':{fr:"Adulte",es:"Adulto",it:"Adulto",de:"Adult"},
  'teneral':{fr:"Ténéral",es:"Teneral",it:"Tenerale",de:"Teneral"},
  /* Trois stades distincts que le français confond volontiers : la larve à métamorphose
     complète (chenille, asticot), le juvénile à métamorphose incomplète, et le stade immobile
     intermédiaire. Les libellés lèvent l'ambiguïté plutôt que de la reporter sur l'utilisateur. */
  'pupa':{fr:"Chrysalide ou pupe",es:"Pupa o crisálida",it:"Pupa o crisalide",de:"Puppe"},
  'nymph':{fr:"Juvénile (nymphe)",es:"Ninfa",it:"Ninfa",de:"Nymphe"},
  'larva':{fr:"Larve (chenille, asticot)",es:"Larva",it:"Larva",de:"Larve"},
  'egg':{fr:"Œuf",es:"Huevo",it:"Uovo",de:"Ei"},
  'juvenile':{fr:"Juvénile",es:"Juvenil",it:"Giovane",de:"Jungtier"},
  'subimago':{fr:"Subimago",es:"Subimago",it:"Subimago",de:"Subimago"},
  'female':{fr:"Femelle",es:"Hembra",it:"Femmina",de:"Weiblich"},
  'male':{fr:"Mâle",es:"Macho",it:"Maschio",de:"Männlich"},
  'cannot be determined':{fr:"Indéterminé",es:"Indeterminado",it:"Indeterminato",de:"Unbestimmt"},
  'flowers':{fr:"Fleurs",es:"Flores",it:"Fiori",de:"Blüten"},
  'flower buds':{fr:"Boutons floraux",es:"Botones florales",it:"Boccioli",de:"Blütenknospen"},
  'fruits or seeds':{fr:"Fruits ou graines",es:"Frutos o semillas",it:"Frutti o semi",de:"Früchte oder Samen"},
  'fruits':{fr:"Fruits",es:"Frutos",it:"Frutti",de:"Früchte"},
  'seeds':{fr:"Graines",es:"Semillas",it:"Semi",de:"Samen"},
  'no flowers or fruits':{fr:"Ni fleurs ni fruits",es:"Sin flores ni frutos",it:"Né fiori né frutti",de:"Weder Blüten noch Früchte"},
  'no evidence of flowering or fruiting':{fr:"Ni fleurs ni fruits",es:"Sin flores ni frutos",it:"Né fiori né frutti",de:"Weder Blüten noch Früchte"},
  'flowering':{fr:"En fleur",es:"En flor",it:"In fiore",de:"Blühend"},
  'fruiting':{fr:"En fruit",es:"En fruto",it:"In frutto",de:"Fruchtend"},
  'flower budding':{fr:"En bouton",es:"En botón",it:"In boccio",de:"Knospend"},
  'no evidence of flowering':{fr:"Sans fleur ni fruit",es:"Sin flor ni fruto",it:"Senza fiori né frutti",de:"Ohne Blüte"},
  'alive':{fr:"Vivant",es:"Vivo",it:"Vivo",de:"Lebend"},
  'dead':{fr:"Mort",es:"Muerto",it:"Morto",de:"Tot"},
  'feather':{fr:"Plume",es:"Pluma",it:"Piuma",de:"Feder"},
  'organism':{fr:"Organisme",es:"Organismo",it:"Organismo",de:"Organismus"},
  'scat':{fr:"Crotte",es:"Excremento",it:"Escremento",de:"Kot"},
  'gall':{fr:"Galle",es:"Agalla",it:"Galla",de:"Galle"},
  'track':{fr:"Empreinte",es:"Huella",it:"Impronta",de:"Spur"},
  'bone':{fr:"Os",es:"Hueso",it:"Osso",de:"Knochen"},
  'molt':{fr:"Mue",es:"Muda",it:"Muta",de:"Häutung"},
  'hair':{fr:"Poil",es:"Pelo",it:"Pelo",de:"Haar"},
  'leafmine':{fr:"Mine foliaire",es:"Mina foliar",it:"Mina fogliare",de:"Blattmine"},
  'construction':{fr:"Construction",es:"Construcción",it:"Costruzione",de:"Bau"},
  'bite':{fr:"Morsure",es:"Mordedura",it:"Morso",de:"Bissspur"},
  'breaking leaf buds':{fr:"Débourrement",es:"Brotación",it:"Germogliamento",de:"Knospenaustrieb"},
  'green leaves':{fr:"Feuilles vertes",es:"Hojas verdes",it:"Foglie verdi",de:"Grüne Blätter"},
  'colored leaves':{fr:"Feuilles colorées",es:"Hojas coloreadas",it:"Foglie colorate",de:"Herbstfärbung"},
  'no live leaves':{fr:"Sans feuilles",es:"Sin hojas",it:"Senza foglie",de:"Ohne Blätter"}
};

/* Le libellé traduit se trouve selon les cas dans le champ label, ou dans un tableau labels
   contenant une entrée par langue. On prend la traduction quand elle existe. */
function libelleTerme(x) {
  const l = (x.labels || []).find(y => y.locale === langue || String(y.locale).startsWith(langue));
  const brut = (l && (l.label || l.value_label)) || x.label || '';
  const trad = ANNOTATIONS[String(brut).toLowerCase()];
  return (trad && trad[langue]) || brut;
}

/* Trois niveaux, du plus précis au plus sûr. L'endpoint par taxon d'abord ; sinon le
   vocabulaire général filtré localement sur les clades d'application, que chaque terme
   déclare dans taxon_ids ; et à défaut le vocabulaire entier. Sans ce filtrage, on proposait
   « plume » ou « œuf » sur des plantes. */
function termesUtilisables(liste, e) {
  const lignee = new Set([e.id, ...(e.anc || [])]);
  const filtres = liste.filter(x => {
    const inclus = x.taxon_ids || x.valid_within_taxon_ids;
    const exclus = x.excepted_taxon_ids || [];
    if (exclus.some(id => lignee.has(id))) return false;
    return !inclus || !inclus.length || inclus.some(id => lignee.has(id));
  });
  return filtres.length ? filtres : liste;
}

/* Ordre d'affichage des termes : ce qui distingue le plus deux individus d'abord. Le sexe,
   souvent responsable de plumages ou de livrées entièrement différents ; puis le stade, qui
   change tout autant l'aspect — chenille contre papillon, plante en fleur contre en feuilles.
   Le reste suit dans l'ordre renvoyé par l'API. */
/* Les fleurs et fruits passent devant : chez une plante, ce sont eux qui changent l'aspect,
   et les termes propres aux animaux ne lui sont de toute façon pas proposés. */
const ORDRE_TERMES = ['flowers and fruits', 'plant phenology', 'leaves', 'sex', 'life stage'];

function rangTerme(x) {
  const i = ORDRE_TERMES.indexOf(String(x.label || '').toLowerCase());
  return i < 0 ? ORDRE_TERMES.length : i;
}

async function chargerVocabulaire(e) {
  const taxon = (e && e.id) || 0;
  if (vocabulaires.has(taxon)) return (vocabulaire = vocabulaires.get(taxon), vocabulairePour = taxon, vocabulaire);

  const utilisable = d => (d && d.results || [])
    .map(x => x.values ? x : (x.controlled_attribute || null))
    .filter(x => x && x.values && x.values.length);

  let voc = null;
  try {
    if (taxon) {
      const d = await appel('/controlled_terms/for_taxon', { taxon_id:taxon, locale:langue });
      const v = utilisable(d);
      if (v.length) voc = v;
    }
    if (!voc) {
      const g = await appel('/controlled_terms', { locale:langue });
      voc = e ? termesUtilisables(utilisable(g), e) : utilisable(g);
    }
  } catch (err) { voc = []; }
  voc = trierTermes(voc);
  vocabulaires.set(taxon, voc);
  vocabulaire = voc; vocabulairePour = taxon;
  return voc;
}

function trierTermes(liste) {
  return [...liste].sort((a, b) => rangTerme(a) - rangTerme(b));
}

/* Les options du menu d'annotations, partagé par la comparaison et la taxonomie. */
function optionsAnnotations(voc) {
  return (voc || []).map(terme =>
    `<optgroup label="${echap(libelleTerme(terme))}">${terme.values.map(val =>
      `<option value="${terme.id}:${val.id}"${cpAnnot === terme.id + ':' + val.id ? ' selected' : ''}
        >${echap(libelleTerme(val))}</option>`).join('')}</optgroup>`).join('');
}

async function photosEspece(id, page = 1) {
  const cle = clePhotos(id) + '|' + page;
  if (cachePhotos.has(cle)) return cachePhotos.get(cle);

  /* Toujours en qualité recherche : une photo mal déterminée n'aide pas à comparer.
     On ne desserre que si la sélection est trop pauvre pour donner trois images. */
  const p = { taxon_id:id, photos:'true', captive:'false', verifiable:'true',
              quality_grade:'research', order_by:'observed_on', order:'desc',
              per_page:CP_PAR_PAGE, page, locale:langue };
  if (cpLocal) {
    if (etat.lieux.length) p.place_id = etat.lieux.map(l => l.id).join(',');
    if (etat.zone) Object.assign(p, etat.zone);
  }
  if (cpAnnot) {
    const [terme, valeur] = cpAnnot.split(':');
    p.term_id = terme; p.term_value_id = valeur;
  }

  let res = [];
  const chercher = async p2 => {
    /* En v1 exclusivement : la sélection de champs de la v2 ne garantit pas de recevoir
       toutes les photos d'une observation, or c'est précisément ce qui permet de la
       feuilleter. Cinq observations pèsent peu, et l'appel est prioritaire. */
    const d = await appel('/observations', p2, false, true);
    /* Une entrée par observation, donc par individu, avec toutes ses photos : la comparaison
       porte sur cinq individus distincts, et chacun se feuillette latéralement si son auteur
       l'a photographié sous plusieurs angles. */
    return (d.results || []).map(o => {
      const urls = (o.photos || [])
        .map(ph => ph.medium_url || String(ph.url || '').replace('/square.', '/medium.'))
        .filter(Boolean);
      if (!urls.length) return null;
      const ph = o.photos[0];
      return { obs:o.id, urls, credit:(ph && ph.attribution) || '' };
    }).filter(Boolean);
  };

  /* Les pages suivantes suivent le choix fait pour la première : si elle a dû desserrer la
     validation, elles le font aussi. */
  const premiere = page > 1 ? await photosEspece(id, 1) : null;
  let large = !!(premiere && premiere.large);
  try {
    if (large) delete p.quality_grade;
    res = await chercher(p);
    // Sans photo validée, on desserre : mieux vaut une image à confirmer que rien du tout.
    if (!res.length && page === 1) {
      delete p.quality_grade;
      large = true;
      res = await chercher(p);
    }
  } catch (e) { res = []; }

  res.large = large;
  cachePhotos.set(cle, res);
  return res;
}

/* Calendrier d'une espèce. Si l'analyse mensuelle de l'onglet Saisonnalité a déjà tourné,
   la réponse est en mémoire ; sinon un histogramme suffit, en file prioritaire. */
async function phenoEspece(id) {
  if (etat.phenologie && etat.phenologie.has(id)) return etat.phenologie.get(id);
  const cle = 'pheno:' + id + ':' + etat.qualite + ':' + (cpLocal ? 'zone' : 'monde');
  if (cachePhotos.has(cle)) return cachePhotos.get(cle);
  let v = null;
  try {
    const base = cpLocal ? filtres() : { captive:'false', verifiable:'true', locale:langue };
    if (!cpLocal && etat.qualite === 'research') base.quality_grade = 'research';
    const d = await appel('/observations/histogram',
      { ...base, taxon_id:id, date_field:'observed', interval:'month_of_year' }, false, true);
    const r = (d.results && d.results.month_of_year) || {};
    v = Array.from({ length:12 }, (_, m) => r[m + 1] || r[String(m + 1)] || 0);
  } catch (e) { v = null; }
  cachePhotos.set(cle, v);
  return v;
}

function graphePheno(vals) {
  if (!vals || !vals.some(x => x)) return '';
  const max = Math.max(...vals), courant = dateFenetre().getMonth();
  const l = 100 / 12;
  return `<svg viewBox="0 0 100 26" width="100%" height="26" role="img"
      aria-label="${echap(t('grapheMois'))}">${vals.map((v, i) => {
    const h = (v / max) * 22;
    return `<rect x="${(i * l + l * 0.15).toFixed(2)}" y="${(24 - h).toFixed(2)}"
      width="${(l * 0.7).toFixed(2)}" height="${Math.max(h, 0.6).toFixed(2)}"
      fill="${i === courant ? '#A87C14' : '#9BB39E'}" rx="0.6"
      ><title>${MOIS[i]} · ${nb(v)}</title></rect>`;
  }).join('')}</svg>`;
}

async function dessinerComparaison() {
  const v = $('#v-comparaison');
  if (!v) return;
  const parId = new Map(etat.especes.map(e => [e.id, e]));
  const choix = etat.panier.map(id => parId.get(id) || especeExterne(id)).filter(Boolean);

  if (!choix.length) {
    v.innerHTML = `<div class="vide"><strong>${t('oComparaison')}</strong>${t('videComparaison')}</div>`;
    return;
  }

  // Le vocabulaire suit la première espèce retenue : comparer une plante et un insecte
  // n'a pas de sens, et le menu resterait de toute façon inutilisable dans ce cas.
  const voc = await chargerVocabulaire(choix[0]);
  const options = optionsAnnotations(voc);
  const ref = photosReference();
  const nbCol = choix.length + (ref ? 1 : 0);

  v.innerHTML = `
    <div class="outils">
      <select id="cp-annot">
        <option value=""${cpAnnot ? '' : ' selected'}>${t('cpToutes')}</option>${options}
      </select>
      <label class="bascule"><input type="checkbox" id="cp-local"${cpLocal ? ' checked' : ''}>
        <span>${t('cpLocal')}</span></label>
      <button class="discret" id="cp-vider">${t('cpVider')}</button>
      <span class="compte">${nb(choix.length)} ${t('especes')}</span>
    </div>
    <div id="cp-defil"><div></div></div>
    <div class="colonnes" style="grid-auto-columns:minmax(210px,${
      nbCol <= 2 ? 460 : nbCol === 3 ? 380 : 290}px)">${ref ? `
      <div class="colonne reference">
        <div class="entete"><div>
          <a href="https://www.inaturalist.org/observations/${ref.obs}" target="_blank" rel="noopener"
             style="text-decoration:none"><span class="fr">${echap(ref.titre)}</span></a>
          ${ref.sous ? `<div class="freq">${echap(ref.sous)}</div>` : ''}
        </div></div>
        <div class="pheno"></div>
        <div class="photos">${ref.urls.map((u, i) => `<div class="obs"><div class="defile"><img src="${
          echap(u)}" alt="" data-ref="${i}"></div></div>`).join('')}</div>
      </div>` : ''}${choix.map((e, i) => `
      <div class="colonne" data-esp="${e.id}">
        <div class="entete">
          <div>
            <a href="${lienTaxon(e.id, true)}" target="_blank" rel="noopener"
               style="text-decoration:none">${blocNoms(e.nom, e.nomFr)}</a>
            <div class="freq">${nb(e.nZone)} ${t('obs')}</div>
            ${pastilleIntro(e.id, false, true)}
          </div>
          <div class="actions">
            <button class="plus" data-bouger="${i}:-1" aria-label="${echap(t('cpGauche'))}"
              ${i === 0 ? 'disabled' : ''}>‹</button>
            <button class="plus" data-bouger="${i}:1" aria-label="${echap(t('cpDroite'))}"
              ${i === choix.length - 1 ? 'disabled' : ''}>›</button>
            <button class="plus" data-retirer="${e.id}" aria-label="${echap(t('cpRetirer'))}">×</button>
          </div>
        </div>
        <div class="pheno" id="ph-${e.id}"></div>
        <div class="photos" id="cp-${e.id}"></div>
        <div class="cp-plus" id="cpp-${e.id}"></div>
      </div>`).join('')}</div>
    <p class="note">${t('cpNote')}</p>`;

  /* Les deux barres se suivent l'une l'autre, et le fantôme prend la largeur réelle. */
  const defil = $('#cp-defil'), colonnes = v.querySelector('.colonnes');
  if (defil && colonnes) {
    defil.firstElementChild.style.width = colonnes.scrollWidth + 'px';
    let verrou = false;
    const lier = (a, b) => a.addEventListener('scroll', () => {
      if (verrou) return; verrou = true; b.scrollLeft = a.scrollLeft; verrou = false;
    });
    lier(defil, colonnes); lier(colonnes, defil);
  }

  if (ref) v.querySelectorAll('[data-ref]').forEach(img =>
    img.addEventListener('click', () => ouvrirLoupe(ref.urls, +img.dataset.ref, ref.obs)));
  $('#cp-annot').addEventListener('change', e => { cpAnnot = e.target.value; dessinerComparaison(); });
  $('#cp-local').addEventListener('change', e => { cpLocal = e.target.checked; dessinerComparaison(); });
  $('#cp-vider').addEventListener('click', () => { etat.panier = []; dessinerComparaison(); surPanier(); });
  v.querySelectorAll('[data-retirer]').forEach(b => b.addEventListener('click', () => {
    etat.panier = etat.panier.filter(x => x !== +b.dataset.retirer);
    dessinerComparaison(); surPanier();
  }));
  v.querySelectorAll('[data-bouger]').forEach(b => b.addEventListener('click', () => {
    const [i, sens] = b.dataset.bouger.split(':').map(Number);
    const j = i + sens;
    if (j < 0 || j >= etat.panier.length) return;
    [etat.panier[i], etat.panier[j]] = [etat.panier[j], etat.panier[i]];
    dessinerComparaison();
  }));

  // Les colonnes se remplissent l'une après l'autre, sans bloquer l'affichage.
  for (const e of choix) {
    const calendrier = await phenoEspece(e.id);
    const bloc = $('#ph-' + e.id);
    if (bloc) bloc.innerHTML = graphePheno(calendrier);
    /* Les pages déjà demandées sont en mémoire : un redessin les remet sans requête. */
    const pages = cpPages.get(clePhotos(e.id)) || 1;
    let photos = [], derniere = [];
    for (let pg = 1; pg <= pages; pg++) {
      derniere = await photosEspece(e.id, pg);
      photos = photos.concat(derniere);
    }
    const cible = $('#cp-' + e.id);
    if (!cible) return;                 // la vue a changé entre-temps
    cible.innerHTML = photos.length ? '' : `<div class="vide" style="padding:18px">${t('cpAucune')}</div>`;
    ajouterObs(cible, photos);
    boutonPlusPhotos(e.id, derniere.length >= CP_PAR_PAGE);
  }
}

function ajouterObs(cible, photos) {
  const debut = cible.querySelectorAll('.obs').length;
  cible.insertAdjacentHTML('beforeend', photos.map(o => `<div class="obs">
      <div class="defile">${o.urls.map(u =>
        `<img src="${u}" loading="lazy" alt="" data-loupe="${u}" data-obs="${o.obs}">`).join('')}</div>
      ${o.urls.length > 1
        ? `<span class="pages">${o.urls.map((_, i) =>
            `<i${i ? '' : ' class="on"'}></i>`).join('')}</span>` : ''}
      <span class="credit">${echap(o.credit)}</span>
    </div>`).join(''));
  [...cible.querySelectorAll('.obs')].slice(debut).forEach((bloc, k) => {
    const o = photos[k];
    bloc.querySelectorAll('.defile img').forEach((img, i) =>
      img.addEventListener('click', () => ouvrirLoupe(o.urls, i, o.obs)));
    // Les points suivent la photo affichée pendant le défilement.
    const bande = bloc.querySelector('.defile');
    const points = bloc.querySelectorAll('.pages i');
    if (!bande || points.length < 2) return;
    bande.addEventListener('scroll', () => {
      const i = Math.round(bande.scrollLeft / bande.clientWidth);
      points.forEach((p, j) => p.classList.toggle('on', j === i));
    });
  });
}

/* Cinq individus par espèce suffisent le plus souvent, et chaque page coûte une requête :
   les suivantes ne se chargent qu'à la demande. */
function boutonPlusPhotos(id, encore) {
  const boite = $('#cpp-' + id);
  if (!boite) return;
  boite.innerHTML = encore ? `<button class="discret" data-plus-photos="${id}">${t('cpPlus')}</button>` : '';
  const b = boite.querySelector('button');
  if (!b) return;
  b.addEventListener('click', async () => {
    const cle = clePhotos(id), page = (cpPages.get(cle) || 1) + 1;
    b.disabled = true; b.textContent = '…';
    const photos = await photosEspece(id, page);
    if (clePhotos(id) !== cle) return;
    cpPages.set(cle, page);
    const cible = $('#cp-' + id);
    if (cible) ajouterObs(cible, photos);
    boutonPlusPhotos(id, photos.length >= CP_PAR_PAGE);
  });
}

/* Agrandissement par-dessus la page. La loupe reçoit toute la série de l'observation : les
   vignettes sont trop petites pour qu'on y feuillette confortablement, et le clic ouvre de
   toute façon l'agrandissement. Flèches, glissement et touches du clavier y fonctionnent. */
function ouvrirLoupe(urls, index, obs) {
  const l = $('#loupe'), bande = $('#loupe-bande');
  bande.innerHTML = urls.map(u =>
    `<img src="${String(u).replace('/medium.', '/large.')}" alt="">`).join('');

  const lien = $('#loupe-lien');
  lien.href = 'https://www.inaturalist.org/observations/' + obs;
  lien.textContent = t('cpVoir');

  const seule = urls.length < 2;
  $('#loupe-prec').hidden = seule;
  $('#loupe-suiv').hidden = seule;
  l.hidden = false;
  // La largeur n'est connue qu'une fois la loupe affichée.
  requestAnimationFrame(() => { bande.scrollLeft = index * bande.clientWidth; });
}

function loupeDefiler(sens) {
  const bande = $('#loupe-bande');
  if (bande) bande.scrollBy({ left: sens * bande.clientWidth, behavior:'smooth' });
}



