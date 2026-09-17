/* Essai de rendu. L'autre essai vérifie que la page démarre ; celui-ci vérifie que les vues
   se dessinent. On injecte un inventaire et une liste personnelle fabriqués de toutes pièces,
   puis on appelle les fonctions de rendu et on regarde ce qui sort du DOM. Aucune requête :
   ce qui est éprouvé, c'est la mise en forme, pas la collecte. */

const fs = require('fs');
const { JSDOM } = require('jsdom');

const outil = process.argv[2] || 'coche';
const JEUX = {
  quoi:  { page:'site/quoi/index.html',
           scripts:['site/commun/textes.js', 'site/commun/socle.js', 'site/commun/inventaire.js',
                    'site/quoi/textes.js',
                    'site/commun/comparaison.js', 'site/quoi/modules.js'],
           onglets:['taxonomie', 'comparaison', 'confusions', 'criteres', 'repartition', 'bilan', 'candidats'] },
  coche: { page:'site/coche/index.html',
           scripts:['site/commun/textes.js', 'site/commun/socle.js', 'site/commun/inventaire.js',
                    'site/coche/textes.js', 'site/commun/liste-perso.js', 'site/coche/modules.js'] },
  ici:   { page:'site/ici/index.html',
           scripts:['site/commun/textes.js', 'site/commun/socle.js',
                    'site/commun/inventaire.js', 'site/ici/modules.js'] }
};
const jeu = JEUX[outil];

const html = fs.readFileSync(jeu.page, 'utf8').replace(/<script src="[^"]*"><\/script>/g, '');
const dom = new JSDOM(html, { url:'https://exemple.org/' + outil + '/', runScripts:'dangerously' });
const w = dom.window;

const incidents = [];
w.console.error = (...a) => incidents.push('console.error : ' + a.join(' '));
w.addEventListener('error', ev => incidents.push('erreur : ' + (ev.error || ev.message)));
dom.virtualConsole.on('jsdomError', e => incidents.push('jsdom : ' + e.message));

/* Un Leaflet de façade, mais qui retient ce qui compte pour ces essais : le conteneur d'une
   carte et son cadrage. Un objet qui accepte tout sans rien retenir ne permettait pas de
   voir qu'une carte pointait vers un élément retiré du document. */
const couche = () => {
  const c = { _n:0,
    addTo(cible) { if (cible && typeof cible._n === 'number') cible._n++; return c; },
    remove(){}, on: () => c, bringToBack: () => c, setStyle: () => c };
  return c;
};
w.L = {
  map(el) {
    const cible = typeof el === 'string' ? w.document.getElementById(el) : el;
    const m = {
      getContainer: () => cible,
      setView(centre, zoom) { m._vue = { centre, zoom }; return m; },
      fitBounds() { m._vue = { centre:{ lat:0, lng:0 }, zoom:9 }; return m; },
      getCenter: () => (m._vue || {}).centre || { lat:0, lng:0 },
      getZoom: () => (m._vue || {}).zoom || 9,
      invalidateSize: () => m, on: () => m, removeLayer(){}, remove(){},
      _panes:{}, getPane(n) { return m._panes[n]; },
      createPane(n) { m._panes[n] = { style:{} }; return m._panes[n]; },
      _n:0
    };
    return m;
  },
  tileLayer: couche, layerGroup: couche, rectangle: couche, circleMarker: couche,
  circle: couche, polygon: couche, geoJSON: couche, marker: couche,
  GridLayer: { extend: () => function (opts) { return couche(opts); } }
};
w.fetch = () => Promise.reject(new Error('réseau coupé'));
w.matchMedia = () => ({ matches:false, addEventListener(){}, addListener(){} });
w.scrollTo = () => {};

for (const f of jeu.scripts) {
  const s = w.document.createElement('script');
  s.textContent = fs.readFileSync(f, 'utf8');
  w.document.body.appendChild(s);
}

/* Un inventaire de synthèse : trois classes, chacune avec un ordre et une famille, et des
   espèces réparties dedans. De quoi faire un arbre à trois niveaux et des décomptes vérifiables. */
w.eval(`
const CLASSES = [[100,'Aves','oiseaux'], [200,'Insecta','insectes'], [300,'Magnoliopsida','dicotylédones']];
/* Trois familles par classe, deux genres par famille : un arbre qui a réellement quelque
   chose à déplier. Une taxonomie linéaire ne prouverait rien, les niveaux d'un seul enfant
   n'étant volontairement pas repliables. */
CLASSES.forEach(([id, nom, fr]) => {
  etat.ancetres.set(id, { nom, nomFr:fr, rang:'class' });
  etat.ancetres.set(id + 1, { nom:nom + 'ales', nomFr:'', rang:'order' });
  for (let f = 0; f < 3; f++) {
    etat.ancetres.set(id + 10 + f, { nom:nom + 'idae' + f, nomFr:'', rang:'family' });
    for (let g = 0; g < 2; g++)
      etat.ancetres.set(id + 30 + f * 2 + g, { nom:nom + 'us' + f + g, nomFr:'', rang:'genus' });
  }
});

etat.especes = [];
let n = 0;
for (const [base, nom] of CLASSES) {
  for (let k = 0; k < 12; k++) {
    const id = base * 100 + k;
    etat.especes.push({
      id, nom: nom + ' espece' + k, nomFr: 'Bestiole ' + (++n), rang:'species',
      nZone: 200 - k * 7, nMonde: 5000, iucn: k === 3 ? 40 : 0,
      photo: 'https://exemple.org/p' + id + '/square.jpg',
      photoPetite: 'https://exemple.org/p' + id + '/square.jpg',
      credit: 'anonyme',
      etab: k % 4 === 0 ? { statut:'introduced', lieu:'France' } : null,
      anc: [base, base + 1, base + 10 + (k % 3), base + 30 + (k % 3) * 2 + (k % 2), id]
    });
  }
}

/* La liste personnelle : un tiers jamais vu, un tiers vu ailleurs, un tiers vu ici. */
const monde = new Map(), ici = new Map();
etat.especes.forEach((e, k) => {
  if (k % 3 === 1) monde.set(e.id, 2 + k);            // vue ailleurs seulement
  if (k % 3 === 2) { monde.set(e.id, 5 + k); ici.set(e.id, 1 + (k % 4)); }
});
etat.phenologie = new Map(etat.especes.map((e, k) =>
  [e.id, Array.from({length:12}, (_, m) => m === (k % 12) ? 50 : 3)]));
etat.charge = true;
construireArbre();
/* Chaque eval a sa propre portée : on dépose sur window ce que l'étape suivante relira. */
window.monde = monde; window.ici = ici;
`);

if (outil === 'coche') {
  w.eval(`perso = { login:'essai', monde, ici, nMonde:monde.size, nIci:ici.size, date:Date.now() };
          construireArbre();`);
}

const d = w.document;
const compte = sel => d.querySelectorAll(sel).length;
const dire = (quoi, val) => console.log(quoi.padEnd(34), val);

if (outil === 'coche') {
  w.eval('dessinerManquants()');
  dire('fiches affichées', compte('#v-manquants .fiche'));
  dire('branches de l\'arbre', compte('#v-manquants .arbre .n-noeud'));
  dire('racine de l\'arbre', (d.querySelector('#v-manquants .arbre .n-nb') || {}).textContent);
  dire('bandeau : blocs', compte('#v-manquants .chiffres .chiffre'));
  dire('  valeurs', [...d.querySelectorAll('#v-manquants .chiffres .v')]
    .map(x => x.textContent).join(' · '));
  dire('légende : états expliqués', compte('#v-manquants .legende-statuts > span'));
  dire('pastilles « introduite »', compte('#v-manquants .fiche .intro'));
  dire('pastilles « pas vue »', compte('#v-manquants .fiche .marque.jamais'));
  dire('pastilles « pas ici »', compte('#v-manquants .fiche .marque.ailleurs'));
  dire('pastilles dans l\'image', compte('#v-manquants .fiche .img .coin'));
  dire('statuts sur l\'image', compte('#v-manquants .fiche .img .statut'));
  dire('  aucun sous le texte', compte('#v-manquants .fiche .bas .iucn') === 0 ? 'oui' : 'NON');
  dire('boutons de lignée', compte('#v-manquants .fiche .plus[data-lignage]'));
  dire('  lignées présentes', compte('#v-manquants .fiche .taxo'));
  dire('  rangs de la première', compte('#v-manquants .fiche .taxo .lig'));
  w.eval("$('#v-manquants .plus[data-lignage]').dispatchEvent(new Event('click'))");
  dire('  ouverte au clic', compte('#v-manquants .fiche.ouvert'));
  w.eval("document.querySelector('#v-manquants .fiche.ouvert .taxo').dispatchEvent(new Event('click'))");
  dire('  refermée au clic', compte('#v-manquants .fiche.ouvert') === 0 ? 'oui' : 'NON');
  dire('fiches marquées cochées', compte('#v-manquants .fiche.f-cochee'));

  // Le filtre « déjà vues ici » doit renverser exactement la sélection.
  // Un seul menu porte les cinq lectures : on les parcourt toutes.
  dire('entrées du menu unique', compte('#v-manquants #k-quoi option'));
  const choisir = v => w.eval(`
    const s = $('#k-quoi'); s.value = '${v}';
    s.dispatchEvent(new Event('change'));
  `);
  dire('valeur par défaut', w.eval("$('#k-quoi').value"));
  for (const v of ['manque:monde', 'manque:ici', 'vues:monde', 'vues:ici', 'toutes:monde']) {
    choisir(v);
    dire('  ' + v, compte('#v-manquants .fiche') + ' fiches · bandeau ' +
      (d.querySelector('#v-manquants .chiffres .v') || {}).textContent);
  }
  choisir('manque:monde');

  w.eval("cocheFiltre = 'toutes'; redessinerManquants();");
  dire('filtre « tout » : fiches', compte('#v-manquants .fiche'));
  dire('  estompées (réf. monde)', compte('#v-manquants .fiche.f-vue'));
  dire('    dont « pas ici »', compte('#v-manquants .fiche.f-ailleurs.f-vue'));
  w.eval("changerReference('ici');");
  dire('  estompées (réf. ici)', compte('#v-manquants .fiche.f-vue'));
  w.eval("changerReference('monde');");

  // Descendre dans une branche doit restreindre la planche.
  w.eval("cocheFiltre = 'manque'; redessinerManquants(); vue.noeud = 100; dessinerManquants();");
  dire('branche « oiseaux » : fiches', compte('#v-manquants .fiche'));
  w.eval('vue.noeud = null; dessinerManquants();');

  /* Le mois : il réduit la zone, pas la liste personnelle. On fabrique un relevé mensuel
     ne contenant qu'une partie des espèces et l'on vérifie que la planche s'y conforme. */
  w.eval(`
    const parId = new Map();
    etat.especes.forEach((e, k) => { if (k % 2 === 0) parId.set(e.id, 7); });
    etat.moisCache.set(etat.qualite + ':3', { parId });
    vue.mois = 3; redessinerManquants();
  `);
  dire('mars : fiches', compte('#v-manquants .fiche'));
  dire('  effectif affiché', (d.querySelector('#v-manquants .fiche .n') || {}).textContent);
  dire('  périodes du menu', compte('#v-manquants #k-mois option'));
  dire('  trié sur le mois', (() => {
    const n = [...d.querySelectorAll('#v-manquants .fiche .n')]
      .map(a => parseInt(a.textContent, 10)).filter(Number.isFinite);
    return n.every((v, i) => i === 0 || v <= n[i - 1]) ? 'oui' : 'NON';
  })());
  dire('  liste perso intacte', w.eval('perso.monde.size'));
  w.eval('vue.mois = 0; redessinerManquants();');
  dire('toute l\'année : fiches', compte('#v-manquants .fiche'));

  /* Les introduites : écartées par défaut, et le réglage vaut pour les quatre onglets. */
  dire('réglage par défaut', w.eval('vue.intro'));
  dire('pastilles introduites visibles', compte('#v-manquants .fiche .intro'));
  w.eval("changerIntro('seul');");
  dire('« seules introduites »', compte('#v-manquants .fiche'));
  dire('  racine de l\'arbre', (d.querySelector('#v-manquants .arbre .n-nb') || {}).textContent);
  w.eval("changerIntro('tout');");
  dire('« toutes »', compte('#v-manquants .fiche'));
  w.eval("changerIntro('sans');");
  dire('« sans introduites »', compte('#v-manquants .fiche'));

  // Tri par responsabilité : il exige les effectifs mondiaux, qu'on fournit ici.
  w.eval(`
    etat.especes.forEach((e, k) => { e.nMonde = 100 + k * 50; });
    etat.refFaite = { toutes:true, research:true };
    cocheTri = 'resp'; redessinerManquants();
  `);
  dire('tri responsabilité : 1re fiche', (d.querySelector('#v-manquants .fiche .n') || {}).textContent);
  dire('  plus de menu de seuil', compte('#v-manquants #k-seuil') ? 'ENCORE LÀ' : 'retiré');
  dire('  plancher appliqué', w.eval(`
    (() => {
      etat.especes[0].nMonde = 3; etat.especes[0].nZone = 3;
      cocheTri = 'resp'; redessinerManquants();
      const prem = document.querySelector('#v-manquants .fiche .noms .sci, #v-manquants .fiche .noms .fr');
      return prem && prem.textContent.includes(nomCourt(etat.especes[0].nom, etat.especes[0].nomFr))
        ? 'NON — la mal documentée est en tête' : 'oui';
    })()
  `));
  w.eval("cocheTri = 'obs'; redessinerManquants();");

  // Sélection d'espèces pour la carte.
  w.eval(`
    const b = document.querySelectorAll('#v-manquants [data-carte]');
    b[0].dispatchEvent(new Event('click'));
    b[1].dispatchEvent(new Event('click'));
  `);
  dire('espèces retenues', w.eval('choisies.length'));
  dire('jetons de légende', compte('#v-manquants .jeton-esp'));
  dire('cases cochées', compte('#v-manquants .choisir.pris'));

  // Le compteur personnel : présent sur les espèces vues, absent sur les nouvelles.
  w.eval("cocheFiltre = 'manque'; redessinerManquants();");
  dire('lignes « de toi » (manque)', compte('#v-manquants .mes-obs'));
  dire('  libellé', (d.querySelector('#v-manquants .mes-obs') || {}).textContent || '(aucune)');
  w.eval("cocheFiltre = 'vues'; redessinerManquants();");
  dire('lignes « de toi » (vues)', compte('#v-manquants .mes-obs'));
  const lien = d.querySelector('#v-manquants .mes-obs');
  dire('lien personnel', lien ? lien.getAttribute('href').replace('https://www.inaturalist.org', '') : 'ABSENT');
  w.eval("cocheFiltre = 'manque'; redessinerManquants();");

  /* L'onglet « Quand ? », fusionné : douze barres tirées de la phénologie, aucune requête,
     et les effectifs du mois — non ceux de l'année. */
  w.eval(`
    const manq = etat.especes.filter(e => garde(e.id) && retenuIntro(e.id));
    // Un pic artificiel en mai, chaque espèce y faisant l'essentiel de son année.
    manq.forEach((e, i) => {
      const p = new Array(12).fill(0);
      p[4] = 40 + i; p[(i % 11) + (i % 11 >= 4 ? 1 : 0)] = 3;
      etat.phenologie.set(e.id, p);
    });
    quandMois = 0; dessinerQuand();
  `);
  dire('quand : barres', compte('#v-quand .qd-barre'));
  dire('  menu des lectures', compte('#v-quand #q-quoi option') + ' entrées');
  dire('  menu sous le graphe', (() => {
    const g = d.querySelector('#v-quand .qd-graphe');
    const m = d.querySelector('#v-quand #q-quoi');
    return g && m && (g.compareDocumentPosition(m) & 4) ? 'oui' : 'NON';
  })());
  dire('  tris proposés', [...d.querySelectorAll('#v-quand #q-tri option')]
    .map(o => o.textContent.trim()).join(' | '));
  /* Le choix « Maintenant » : éteint tant que la fenêtre n'est pas relevée, actif ensuite. */
  dire('  bouton Maintenant', (() => {
    const b = d.querySelector('#v-quand #q-maintenant');
    return b ? (b.disabled ? 'éteint' : 'actif') + ' · ' + b.textContent.trim().slice(0, 34)
      : 'ABSENT';
  })());
  w.eval(`
    const parId = new Map();
    etat.especes.forEach((e, k) => { if (k % 2 === 0) parId.set(e.id, 5 + k); });
    etat.moisCache.set(etat.qualite + ':' + FENETRE, { parId, total:parId.size });
    dessinerQuand();
  `);
  dire('  après relevé de la fenêtre', (() => {
    const b = d.querySelector('#v-quand #q-maintenant');
    return (b.disabled ? 'ÉTEINT' : 'actif') + ', pastille ' +
      (b.querySelector('.pastille-ok') ? 'présente' : 'ABSENTE') +
      ', classe ' + b.className;
  })());
  dire('  position dans la barre', (() => {
    const barre = d.querySelector('#v-quand #q-maintenant').parentElement;
    const els = [...barre.children];
    return (els.indexOf(d.querySelector('#v-quand #q-maintenant')) === els.length - 1)
      ? 'dernier élément' : 'PAS EN DERNIER';
  })());
  w.eval("$('#q-maintenant').dispatchEvent(new Event('click'))");
  dire('  grille de la fenêtre', compte('#v-quand .fiche') + ' fiches');
  dire('    titre', (d.querySelector('#v-quand .tit') || {}).textContent);
  w.eval("$('#q-maintenant').dispatchEvent(new Event('click'))");
  dire('  étiquettes de mois', (() => {
    const l = [...d.querySelectorAll('#v-quand .qd-barre .e')].map(x => x.textContent);
    return l.length + ' · ' + (new Set(l).size === l.length ? 'toutes distinctes' : 'DOUBLON')
      + ' · ' + l.join(' ');
  })());
  dire('  nom de l\'axe', (d.querySelector('#v-quand .qd-titre-axe') || {}).textContent || 'ABSENT');
  dire('  chiffres au-dessus', compte('#v-quand .qd-barre .n') === 0 ? 'retirés' : 'ENCORE LÀ');
  dire('  segments « à voir »', compte('#v-quand .qd-barre rect.m'));
  dire('  segments « déjà vues »', compte('#v-quand .qd-barre rect.v'));
  dire('  légende', compte('#v-quand .qd-legende span'));
  dire('  repères d\'échelle', compte('#v-quand .qd-repere'));
  /* Le menu ne doit pas toucher au graphe : seule la grille change. */
  const avantG = compte('#v-quand .qd-barre rect.m') + '/' + compte('#v-quand .fiche');
  w.eval("cocheFiltre = 'toutes'; dessinerQuand();");
  const apresG = compte('#v-quand .qd-barre rect.m') + '/' + compte('#v-quand .fiche');
  w.eval("cocheFiltre = 'manque'; dessinerQuand();");
  dire('  graphe stable, grille non', avantG + ' → ' + apresG);
  dire('  meilleur mois annoncé', (() => {
    const n = [...d.querySelectorAll('#v-quand .note')][0];
    return n ? n.textContent.slice(0, 60) : 'AUCUNE NOTE';
  })());
  w.eval("document.querySelectorAll('#v-quand [data-mois]')[4].dispatchEvent(new Event('click'))");
  dire('  mai : fiches', compte('#v-quand .fiche'));
  dire('  effectif affiché', (d.querySelector('#v-quand .fiche .n') || {}).textContent);
  dire('  décroissant', (() => {
    const n = [...d.querySelectorAll('#v-quand .fiche .n')]
      .map(x => parseInt(x.textContent, 10)).filter(Number.isFinite);
    return n.every((v, i) => i === 0 || v <= n[i - 1]) ? 'oui' : 'NON';
  })());
  /* Le tri par saisonnalité doit ordonner sur la part de l'année, non sur l'effectif. */
  w.eval("quandTri = 'saison'; dessinerQuand();");
  dire('  tri saison décroissant', (() => {
    const p = [...d.querySelectorAll('#v-quand .fiche .n')]
      .map(x => { const m = x.textContent.match(/·\s*(\d+)\s*%/); return m ? +m[1] : null; })
      .filter(v => v !== null);
    return p.length + ' fiches, ' + (p.every((v, i) => i === 0 || v <= p[i - 1]) ? 'oui' : 'NON');
  })());
  w.eval("quandTri = 'obs'; dessinerQuand();");

  /* La carte de terrain : espèces retenues, position en direct, photos dessous. */
  w.eval(`
    choisies = etat.especes.slice(0, 2).map(e => e.id);
    pointsEspece.clear();
    choisies.forEach((id, i) => pointsEspece.set(id,
      [{ x:3 + i * 0.01, y:43.3 }, { x:3.02, y:43.32 }]));
    photosCache.set(choisies[0], ['https://exemple.org/a/medium.jpg',
                                  'https://exemple.org/b/medium.jpg']);
    dessinerTerrain();
    /* On relève sur-le-champ ce qui est déjà rendu, et au terme du tracé ce qui ne l'est
       pas : la suite de l'essai modifie le panier, et une mesure différée observerait un
       autre état. */
    window.mesureT = { retenues: choisies.length, marques: 0,
      bandes: document.querySelectorAll('#v-terrain .t-espece').length };
    tracerTerrain().then(() => { mesureT.marques = coucheT ? coucheT._n : 0; });
  `);
  setTimeout(() => {
    dire('terrain : carte montée', w.eval(
      'carteT && carteT.getContainer() === document.getElementById("carte-terrain")')
      ? 'oui' : 'NON');
    dire('  espèces retenues', w.eval('mesureT.retenues'));
    dire('  marqueurs posés', w.eval('mesureT.marques'));
    dire('  limites de zone', w.eval('coucheLimT ? "posées" : "aucune"'));
    dire('  bandes de photos', w.eval('mesureT.bandes'));
    dire('  bouton de position', (d.querySelector('#v-terrain #t-suivre') || {}).textContent);
    w.eval('maPosition = { lat:43.3, lng:3.0, precision:18 }; tracerPosition(false);');
    dire('  position et précision', w.eval('coucheMoi ? coucheMoi._n : 0') + ' objets');
    dire('  « Où ? » n\'a plus les retenues',
      w.eval('typeof tracerChoisies === "undefined"') ? 'oui' : 'NON');
  }, 200);

  /* Le classement : une requête, un podium, et la place de la personne connectée. */
  w.eval(`
    classement = { total:342, liste: [
      { id:1, nom:'alpha', icone:'', especes:812, obs:9100 },
      { id:2, nom:'beta',  icone:'', especes:640, obs:7300 },
      { id:3, nom:'gamma', icone:'', especes:512, obs:6000 },
      { id:4, nom:'delta', icone:'', especes:410, obs:5200 },
      { id:5, nom:'essai', icone:'', especes:120, obs:900 }
    ] };
    dessinerClassement();
  `);
  dire('  bouton de classement', compte('#v-classement #cl-lancer') ? 'ENCORE LÀ' : 'retiré');
  dire('classement : lignes', compte('#v-classement .cl-ligne'));
  dire('  médailles', compte('#v-classement .cl-ligne.or') + '/' +
    compte('#v-classement .cl-ligne.argent') + '/' + compte('#v-classement .cl-ligne.bronze'));
  dire('  ma ligne repérée', compte('#v-classement .cl-ligne.moi'));
  dire('  classé sur les espèces', (() => {
    const n = [...d.querySelectorAll('#v-classement .esp')]
      .map(x => parseInt(x.textContent.replace(/\s/g, ''), 10));
    return n.every((v, i) => i === 0 || v <= n[i - 1]) ? 'oui' : 'NON';
  })());

  w.eval("cocheFiltre = 'manque'; redessinerManquants(); dessinerCouverture();");
  dire('lignes de couverture', compte('#v-couverture .couv-ligne'));
  dire('part globale annoncée', (d.querySelector('#v-couverture .chiffre .v') || {}).textContent);
  /* Une seule branche ouverte à la fois, comme dans l'arbre du premier onglet. */
  w.eval("document.querySelector('#v-couverture [data-couv-nom]').dispatchEvent(new Event('click'))");
  dire('après clic sur un nom', compte('#v-couverture .couv-ligne'));
  dire('  ligne sélectionnée', compte('#v-couverture .couv-ligne.sel'));
  // La deuxième ligne est une branche fille : l'ouvrir doit descendre d'un niveau de plus.
  w.eval(`
    const noms = document.querySelectorAll('#v-couverture [data-couv-nom]');
    noms[1].dispatchEvent(new Event('click'));
  `);
  dire('après clic sur une fille', compte('#v-couverture .couv-ligne'));
  // Un autre grand groupe : l'ouvrir doit refermer le précédent.
  w.eval(`
    const noms = document.querySelectorAll('#v-couverture [data-couv-nom]');
    noms[noms.length - 1].dispatchEvent(new Event('click'));
  `);
  dire('après clic sur un autre groupe', compte('#v-couverture .couv-ligne'));
  w.eval("document.querySelector('#v-couverture .couv-ligne.sel .nom').dispatchEvent(new Event('click'))");
  dire('après désélection', compte('#v-couverture .couv-ligne'));
  /* La taxonomie doit descendre jusqu'à l'espèce, pas s'arrêter au genre. */
  w.eval(`
    let garde = 0;
    while (garde++ < 8) {
      const noms = [...document.querySelectorAll('#v-couverture [data-couv-nom]')];
      const feuille = noms[noms.length - 1];
      const avant = noms.length;
      feuille.dispatchEvent(new Event('click'));
      if (document.querySelectorAll('#v-couverture [data-couv-nom]').length === avant) break;
    }
  `);
  dire('dernier rang atteint',
    [...d.querySelectorAll('#v-couverture .n-rang')].pop().textContent);
  const feuille = [...d.querySelectorAll('#v-couverture .nom')].pop();
  dire('  la feuille est un', feuille.tagName.toLowerCase());
  dire('  vers', feuille.getAttribute('href') || 'AUCUN LIEN');
  dire('  branches restées cliquables',
    compte('#v-couverture button.nom') > 0 ? 'oui' : 'NON');
  dire('couleurs de complétude', w.eval(
    '[0, 50, 100].map(p => couleurCompletude(p)).join("  ")'));

  // Sélection d'espèces pour la carte.
  w.eval(`
    const b = document.querySelectorAll('#v-manquants [data-carte]');
    b[0].dispatchEvent(new Event('click'));
    b[1].dispatchEvent(new Event('click'));
  `);
  dire('espèces retenues', w.eval('choisies.length'));
  dire('jetons de légende', compte('#v-manquants .jeton-esp'));
  dire('cases cochées', compte('#v-manquants .choisir.pris'));





  w.eval('dessinerCarteOu()');
  dire('carte sans collecte', (d.querySelector('#v-carte .vide strong') || {}).textContent);
  dire('mois proposés', compte('#v-carte #g-mois option'));

  /* Une grille fabriquée : quatre foyers de points, pour que le découpage en carreaux ait
     quelque chose à découper et que le tracé s'exécute pour de bon. */
  /* Des points, comme en rend la collecte, et le découpage local qui en découle. */
  w.eval(`
    const pts = [];
    [[3.0,43.3],[3.2,43.35],[3.05,43.5],[3.3,43.2]].forEach(([x,y], f) => {
      for (let k = 0; k < 60; k++) pts.push({
        x: x + (k % 7) * 0.004, y: y + (k % 5) * 0.004,
        t: etat.especes[(f * 9 + k) % etat.especes.length].id });
    });
    grillePts = pts;
    grille = construireGrille(pts);
    choisies = etat.especes.filter(e => garde(e.id)).slice(0, 2).map(e => e.id);
    dessinerCarteOu();
  `);
  dire('carreaux calculés', w.eval('grille.cellules.length'));
  dire('espèces écartées de la collecte', w.eval('especesAEcarter().length'));
  dire('paliers proposés', compte('#v-carte #g-palier option'));
  dire('  libellés', [...d.querySelectorAll('#v-carte #g-palier option')]
    .map(o => o.textContent.trim()).join(' | '));
  dire('  volume disponible', w.eval('nb(volumeDisponible())'));
  dire('  palier retenu', w.eval('grilleMax'));
  dire('  aucune n\'est affichable', w.eval(
    'especesAEcarter().every(id => !garde(id) || estIntroduite(id))') ? 'oui' : 'NON');
  dire('bouton de fond', compte('#v-carte #g-fond') ? 'présent' : 'ABSENT');
  dire('menu des lectures', compte('#v-carte #g-quoi option') + ' entrées');
  w.eval('window.ptsCarte = grillePts;');
  dire('  plus de curseur glissant', compte('#v-carte #g-mois') ? 'ENCORE LÀ' : 'retiré');
  dire('  réglette', compte('#v-carte .crans button') + ' crans · ' +
    [...d.querySelectorAll('#v-carte .crans button')]
      .map(b => b.textContent.trim()).join(' '));
  dire('    cran actif', compte('#v-carte .crans button.actif'));
  dire('    rangées de la barre', compte('#v-carte .outils'));
  w.eval("document.querySelectorAll('#v-carte .crans button')[5].dispatchEvent(new Event('click'))");
  dire('    clic sur une graduation', 'mois ' + w.eval('grilleMois'));
  w.eval(`grilleMois = 0; grillePtsMois = 0; grilleReleveePour = null;
          grillePts = ptsCarte; grille = construireGrille(grillePts); dessinerCarteOu();`);
  dire('    graduations', compte('#v-carte .periode .graduations button') + ' · ' +
    [...d.querySelectorAll('#v-carte .periode .graduations button')]
      .map(b => b.textContent).join(' '));
  dire('    rangées d\'outils', compte('#v-carte .outils'));
  dire('  collecte sans exclusion', w.eval('especesAEcarter().length') + ' écartées (introduites)');
  dire('    toutes introduites', w.eval(
    'especesAEcarter().every(id => estIntroduite(id))') ? 'oui' : 'NON');
  /* Basculer de lecture ne doit rien recollecter : même clé de réserve. */
  const cleA = w.eval('cleGrille()');
  w.eval("carteVue = 'toutes'; dessinerCarteOu();");
  dire('  même relevé pour les deux', cleA === w.eval('cleGrille()') ? 'oui' : 'NON');
  w.eval("carteVue = 'jamais'; dessinerCarteOu();");
  /* Les relevés en réserve doivent être visibles et repris d'un clic. */
  w.eval(`
    grilleEnMemoire.clear();
    grilleEnMemoire.set(cleGrille(0),
      { max:grilleMax, mois:0, date:Date.now() - 2 * 86400000, obs:2400 });
    grilleEnMemoire.set(cleInventaire() + '|ou4|1000|m5',
      { max:1000, mois:5, date:Date.now(), obs:640 });
    dessinerCarteOu();
  `);
  /* Le podium : trois carreaux distincts, dans l'ordre des valeurs décroissantes. */
  dire('  podium', w.eval(`
    (() => {
      const c = new Map(grille.cellules.map(x => [x, valeurCarreau(x)]));
      const top = [...grille.cellules].filter(x => c.get(x) > 0)
        .sort((a, b) => c.get(b) - c.get(a)).slice(0, 3);
      return top.length + ' carreaux · ' + top.map(x => c.get(x)).join(' > ');
    })()
  `));
  dire('  liserés dans la légende', compte('#v-carte #g-legende .podium i'));
  dire('  rangée des réserves', compte('#v-carte .reserves') ? 'présente' : 'ABSENTE');
  dire('  jetons de réserve', compte('#v-carte .jeton-res'));
  dire('    dont courant', compte('#v-carte .jeton-res.actif'));
  dire('    libellés', [...d.querySelectorAll('#v-carte .jeton-res')]
    .map(x => x.textContent.replace(/\s+/g, ' ').trim()).join(' | '));
  /* Reprendre un relevé rétablit son palier et sa période. La reprise repasse par la
     réserve, vide dans cet essai : on garde les points de côté. */
  w.eval(`
    window.ptsGardes = grillePts;
    const b = [...document.querySelectorAll('#v-carte [data-res]')]
      .find(x => x.dataset.res.startsWith('1000'));
    if (b) b.dispatchEvent(new Event('click'));
  `);
  dire('  après reprise', w.eval('grilleMax + " · mois " + grilleMois'));
  w.eval(`cocheFiltre = 'manque'; cocheVu = 'monde'; grilleMax = 4000;
          grilleMois = 0; grillePtsMois = 0; grillePts = ptsGardes;
          grille = construireGrille(grillePts); dessinerCarteOu();`);

  /* Vide, la rangée doit rester là et l'annoncer. */
  w.eval("grilleEnMemoire.clear(); dessinerCarteOu();");
  dire('  rangée vide', (() => {
    const r = d.querySelector('#v-carte .reserves');
    return r ? (r.classList.contains('vide') ? 'présente et estompée' : 'présente')
      + ' · ' + (r.querySelector('.rien') || {}).textContent : 'ABSENTE';
  })());
  dire('  opacité des tuiles', w.eval('teinteOu(10, 10)'));
  dire('bouton de collecte', compte('#v-carte #g-lancer') ? 'présent' : 'ABSENT');
  /* La marque « en mémoire » : présente quand les chiffres viennent de la réserve, absente
     quand ils sortent d'une collecte qu'on vient de faire. */
  dire('marque après collecte', compte('#v-carte .en-memoire') ? 'PRÉSENTE À TORT' : 'absente');
  w.eval("grilleDate = Date.now() - 3 * 86400000; dessinerCarteOu();");
  dire('marque depuis la réserve',
    (d.querySelector('#v-carte .en-memoire') || {}).textContent || 'ABSENTE');
  w.eval("grilleDate = 0; dessinerCarteOu();");

  /* Le défaut de mise à jour : chaque changement de réglage réécrit la vue, donc remplace le
     conteneur. L'objet Leaflet doit suivre, et le cadrage être restitué. */
  /* dessinerCarteOu diffère le tracé de trente millisecondes ; l'essai étant synchrone, on
     déclenche le tracé nous-mêmes, ce que ferait le minuteur. */
  const tracer = () => w.eval('tracerGrille(Math.max(...grille.cellules.map(valeurCarreau), 1))');
  const memeConteneur = () => w.eval(
    'carteOu && carteOu.getContainer() === document.getElementById("carte-ou")');
  tracer();
  dire('carte sur le bon conteneur', memeConteneur() ? 'oui' : 'NON');
  w.eval("vueOu = { centre:{ lat:43.3, lng:3.1 }, zoom:11 };");
  w.eval("grilleMesure = 'compte'; dessinerCarteOu();"); tracer();
  dire('  après changement de mesure', memeConteneur() ? 'suit' : 'PERDUE');
  w.eval("changerIntro('tout');"); tracer();
  dire('  après changement d\'introduites', memeConteneur() ? 'suit' : 'PERDUE');
  w.eval("changerIntro('sans');"); tracer();
  dire('  cadrage restitué (zoom)', w.eval('carteOu.getZoom()'));
  const carreauxSans = w.eval('grille.cellules.reduce((a,c) => a + compteManquants(c), 0)');
  w.eval("changerIntro('tout')");
  const carreauxTout = w.eval('grille.cellules.reduce((a,c) => a + compteManquants(c), 0)');
  w.eval("changerIntro('sans')");
  dire('  introduites toujours exclues', carreauxSans === carreauxTout ? 'oui' : 'NON');
  /* Le menu doit agir sur la carte : « tout l'inventaire » compte plus que « ce qui manque ». */
  const nManque = w.eval('grille.cellules.reduce((a,c) => a + compteManquants(c), 0)');
  w.eval("cocheFiltre = 'toutes';");
  const nToutes = w.eval('grille.cellules.reduce((a,c) => a + compteManquants(c), 0)');
  w.eval("cocheFiltre = 'manque';");
  dire('  carte suit le menu',
    nToutes > nManque ? 'oui (' + nManque + ' → ' + nToutes + ')' : 'NON');
  dire('fond courant', w.eval('fondOu'));
  w.eval("$('#g-fond').dispatchEvent(new Event('click'))");
  dire('après un clic', w.eval('fondOu'));
  w.eval("$('#g-fond').dispatchEvent(new Event('click'))");
  dire('après deux clics', w.eval('fondOu'));
  dire('points en réserve', w.eval('grillePts.length'));

  /* Le parcours complet, tel qu'un utilisateur le fait : ouvrir la planche, cocher une
     espèce, passer sur la carte, et regarder si un marqueur est posé. Chaque étape est
     mesurée séparément pour que l'échec dise où il se produit. */
  w.eval(`
    choisies = []; pointsEspece.clear();
    cocheFiltre = 'manque'; grilleMois = 0; grillePtsMois = 0;
    grille = construireGrille(grillePts);
    dessinerManquants();
  `);
  dire('parcours : boutons dans la planche', compte('#v-manquants [data-carte]'));
  w.eval("document.querySelector('#v-manquants [data-carte]').dispatchEvent(new Event('click'))");
  dire('  après le clic, choisies', w.eval('choisies.length'));
  dire('  points connus pour elle', w.eval(
    'grillePts.filter(p => p.t === choisies[0]).length'));
  w.eval('dessinerCarteOu();');
  w.eval('tracerGrille(Math.max(...grille.cellules.map(valeurCarreau), 1))');
  setTimeout(() => {
    dire('  points de l\'espèce en réserve', w.eval(
      '[...pointsEspece.entries()].map(([k, v]) => k + ":" + v.length).join(", ") || "vide"'));
  }, 60);
  /* Les espèces retenues doivent apparaître sur la carte. */
  w.eval(`
    choisies = etat.especes.filter(e => garde(e.id) && retenuIntro(e.id)).slice(0, 2)
      .map(e => e.id);
    window.trace = 0;
    grilleMois = 0; grillePtsMois = 0;
    grille = construireGrille(grillePts);
    dessinerCarteOu();
  `);
  w.eval('tracerGrille(Math.max(...grille.cellules.map(valeurCarreau), 1))');
  dire('retenues sur la carte', w.eval('choisies.length') + ' choisies');
  dire('  points trouvés', w.eval(`
    choisies.map(id => grillePts.filter(p => p.t === id).length).join(' + ')
  `));
  dire('  légende sur la carte de terrain', compte('#v-terrain .jeton-esp'));
  setTimeout(() => {
      
  }, 30);

  /* Le mois se filtre localement sur une collecte générale : aucune requête. */
  w.eval('grillePts.forEach((p, k) => { p.m = (k % 12) + 1; }); grillePtsMois = 0;');
  w.eval('grilleMois = 3; grille = construireGrille(grillePts); dessinerCarteOu();');
  dire('mars : observations retenues', w.eval('grille.obs') + ' sur ' + w.eval('grille.total'));

  /* La fenêtre glissante, en plus des douze mois et de l'année. */
  w.eval('grillePts.forEach((p, k) => { p.s = (k % 52) + 1; });');
  dire('  options du menu', compte('#v-carte #g-mois option'));
  dire('  intitulé de la fenêtre', [...d.querySelectorAll('#v-carte #g-mois option')]
    .map(o => o.textContent.trim())[1]);
  w.eval('grilleMois = FENETRE; grille = construireGrille(grillePts); dessinerCarteOu();');
  dire('  fenêtre : observations', w.eval('grille ? grille.obs : 0') + ' sur '
    + w.eval('grillePts.length'));
  dire('  attendu', w.eval('(() => { const s = new Set(semainesFenetre());'
    + ' return grillePts.filter(p => s.has(p.s)).length; })()'));
  dire('  clé dédiée à la fenêtre', w.eval('/\\|f[\\d.]+$/.test(cleGrille(FENETRE)) ? "oui" : "NON"'));
  w.eval('grilleMois = 3; grille = construireGrille(grillePts);');

  /* Une collecte dédiée ne peut rien apporter quand la générale a tout ramené : le bouton
     doit alors être éteint, et rallumé dès qu'elle a buté sur son plafond. */
  /* Les mois du jeu d'essai suivent le même pas que les espèces : certains ne contiennent
     donc que des espèces déjà cochées, et la carte n'a rien à y montrer. On cherche un mois
     qui porte réellement des manques, plutôt que d'en supposer un. */
  w.eval(`
    grilleMesure = 'compte'; grillePtsMois = 0; grilleDediee = false; grilleEchantillon = false;
    window.moisUtile = 0;
    for (let m = 1; m <= 12 && !moisUtile; m++) {
      grilleMois = m;
      const g = construireGrille(grillePts);
      if (g && Math.max(...g.cellules.map(valeurCarreau), 0) > 0) window.moisUtile = m;
    }
    grilleMois = moisUtile;
    grille = construireGrille(grillePts);
    dessinerCarteOu();
  `);
  dire('  mois porteur de manques', w.eval('moisUtile'));
  dire('  grille du mois', w.eval('grille ? grille.cellules.length + " carreaux" : "AUCUNE"'));
  dire('  générale exhaustive : bouton', w.eval("$('#g-lancer').disabled") ? 'éteint' : 'ALLUMÉ');
  dire('    explication affichée', [...d.querySelectorAll('#v-carte .note')]
    .some(n => n.textContent.includes('ceiling') || n.textContent.includes('plafond'))
    ? 'oui' : 'NON');
  w.eval("grilleEchantillon = true; dessinerCarteOu();");
  dire('  générale plafonnée : bouton', w.eval("$('#g-lancer').disabled") ? 'ÉTEINT' : 'allumé');
  w.eval("grilleEchantillon = false;");

  /* Une collecte dédiée à un mois ne doit jamais être resservie comme l'année entière. */
  w.eval('grillePtsMois = 3;');
  dire('  points dédiés servis en annuel', w.eval(
    'grilleMois = 0; construireGrille(grillePts) === null ? "refusé" : "ACCEPTÉ À TORT"'));
  w.eval('grilleMois = 3; grillePtsMois = 3;');
  dire('  servis pour leur propre mois', w.eval(
    'construireGrille(grillePts) ? "oui" : "NON"'));
  w.eval('grillePtsMois = 0; grilleMois = 3;');
  dire('  réserve générale sans mois', w.eval("/\\|m\\\\d+$/.test(cleGrille(0)) ? \"NON\" : \"oui\""));
  dire('  réserve dédiée au mois', w.eval('cleGrille(3).endsWith("|m3") ? "oui" : "NON"'));
  w.eval('grilleMois = 0; grille = construireGrille(grillePts); dessinerCarteOu();');
  dire('toute l\'année', w.eval('grille.obs'));

  /* Le détail d'un carreau : le chiffre affiché doit être celui du carreau, et le
     classement doit le suivre. */
  w.eval('grilleCellule = grille.cellules[0]; detailCellule(grille.cellules[0]);');
  const chiffres = [...d.querySelectorAll('#g-detail .planche .fiche .n')]
    .map(a => a.textContent.trim());
  dire('détail : trois premiers', chiffres.slice(0, 3).join(' / ') || '(vide)');
  dire('  décroissant', (() => {
    const n = chiffres.map(x => parseInt(x, 10)).filter(Number.isFinite);
    return n.every((v, i) => i === 0 || v <= n[i - 1]) ? 'oui' : 'NON';
  })());
  dire('  somme = obs du carreau', (() => {
    const n = chiffres.map(x => parseInt(x, 10)).filter(Number.isFinite)
      .reduce((a, b) => a + b, 0);
    return n + ' pour ' + w.eval('manquantsDuCarreau(grille.cellules[0]).reduce((a,[,v]) => a+v, 0)');
  })());
  dire('légende sur la carte', compte('#v-carte .jeton-esp'));
  /* « Tout retirer » doit vider la sélection partout, quelle que soit la vue d'où l'on
     clique — les trois barres affichent le même état. */
  dire('barres de sélection', compte('.choix-carte'));
  dire('  jetons avant', compte('.jeton-esp'));
  /* La barre de sélection a quitté « Où ? » pour la carte de terrain : on vide depuis la
     planche, et l'effet doit se voir partout. */
  w.eval("document.querySelector('#v-manquants .vider-choix').dispatchEvent(new Event('click'))");
  dire('  sélection vidée', w.eval('choisies.length') === 0 ? 'oui' : 'NON');
  dire('  jetons restants partout', compte('.jeton-esp'));
  dire('  cases décochées partout', compte('.choisir.pris'));

  /* Un double branchement ferait basculer deux fois : on redessine une seule vue, puis on
     coche depuis une autre. */
  w.eval("dessinerManquants(); dessinerManquants();");
  w.eval("document.querySelector('#v-manquants [data-carte]').dispatchEvent(new Event('click'))");
  dire('  après un clic depuis la planche', w.eval('choisies.length'));
  dire('  répercuté sur la carte', compte('#v-carte .jeton-esp'));
  /* La pondération : on donne à une espèce une responsabilité écrasante et l'on vérifie que
     le carreau désigné comme le meilleur change. */
  dire('mesure par défaut', w.eval('grilleMesure'));
  const meilleurCompte = w.eval(
    'grille.cellules.indexOf(grille.cellules.reduce((a,b) => valeurCarreau(b) > valeurCarreau(a) ? b : a))');
  dire('meilleur carreau (compte)', meilleurCompte);
  /* On vise une espèce réellement manquante, présente dans un carreau que le simple
     décompte ne désignait pas, et on lui donne une responsabilité de 100 %. */
  /* On donne une responsabilité de 100 % à une espèce manquante d'un carreau que le simple
     décompte ne désignait pas, et une responsabilité négligeable à toutes les autres. */
  w.eval(`
    let vise = null;
    for (let i = grille.cellules.length - 1; i >= 0 && !vise; i--) {
      if (i === ${meilleurCompte}) continue;
      for (const id of grille.cellules[i].taxons.keys())
        if (garde(id) && retenuIntro(id)) { vise = id; break; }
    }
    etat.especes.forEach(e => { e.nMonde = e.id === vise ? e.nZone : 1e7; });
    window.vise = vise;
    grilleMesure = 'resp'; dessinerCarteOu();
  `);

  const meilleurPondere = w.eval(
    'grille.cellules.indexOf(grille.cellules.reduce((a,b) => valeurCarreau(b) > valeurCarreau(a) ? b : a))');
  dire('meilleur carreau (pondéré)', meilleurPondere);
  /* La propriété qui compte n'est pas que l'indice change — le carreau le plus riche peut
     contenir l'espèce visée — mais que le carreau désigné la contienne et que le score
     vienne d'elle. */
  dire('le meilleur contient la visée', w.eval(
    'grille.cellules[' + meilleurPondere + '].taxons.has(vise) ? "oui" : "NON"'));
  dire('score du meilleur', w.eval('Math.max(...grille.cellules.map(valeurCarreau)).toFixed(2)'));
  dire('  score dû à la visée', w.eval(
    '(grille.cellules[' + meilleurPondere + '].taxons.get(vise) || 0).toFixed(0)'));
  dire('notes affichées', compte('#v-carte .note'));
  w.eval("grilleMesure = 'compte'; dessinerCarteOu();");
  /* L'échelle doit être monotone en clarté et franchement contrastée d'un bout à l'autre :
     c'est ce qui la rend lisible sans comparer des opacités. */
  const clartes = w.eval(`
    [0, .25, .5, .75, 1].map(p => {
      const [r,g,b] = couleurEchelle(p);
      return Math.round(0.2126*r + 0.7152*g + 0.0722*b);
    }).join(' → ')
  `);
  dire('clarté des cinq arrêts', clartes);
  dire('  croissante ?', w.eval(`
    (() => { const l = [0,.25,.5,.75,1].map(p => { const [r,g,b] = couleurEchelle(p);
      return 0.2126*r + 0.7152*g + 0.0722*b; });
      return l.every((v,i) => i === 0 || v > l[i-1]); })()
  `) ? 'oui' : 'NON');
  dire('légende : barre', compte('#v-carte #g-legende .barre') ? 'présente' : 'ABSENTE');
  dire('  graduations', compte('#v-carte #g-legende .bornes b'));
  dire('teinte basse / haute', w.eval('teinteOu(1, 100)') + '  ' + w.eval('teinteOu(100, 100)'));
} else if (outil === 'quoi') {
  /* Les candidats : la période, la part de chacun, l'arbre qui la suit, et le panier. */
  w.eval(`
    quandVoir = 0;                       // toute l'année : aucune requête
    construireArbre(); dessinerCandidats();
  `);
  dire('périodes proposées', compte('#v-candidats #q-quand option'));
  dire('  première entrée', [...d.querySelectorAll('#v-candidats #q-quand option')]
    .map(o => o.textContent.trim())[0]);
  dire('candidats affichés', compte('#v-candidats .fiche'));
  dire('  statuts sur l\'image', compte('#v-candidats .fiche .img .statut'));
  dire('branches de l\'arbre', compte('#v-candidats .arbre .n-noeud'));
  dire('parts affichées', compte('#v-candidats .fiche .part b'));
  dire('  somme des parts', (() => {
    const p = [...d.querySelectorAll('#v-candidats .fiche .part b')]
      .map(x => parseInt(x.textContent, 10)).filter(Number.isFinite)
      .reduce((a, b) => a + b, 0);
    return p + ' % (arrondis)';
  })());
  dire('  première part', (d.querySelector('#v-candidats .fiche .part b') || {}).textContent);
  dire('  décroissantes', (() => {
    const n = [...d.querySelectorAll('#v-candidats .fiche .n')]
      .map(x => parseInt(x.textContent.replace(/\s/g, ''), 10)).filter(Number.isFinite);
    return n.every((v, i) => i === 0 || v <= n[i - 1]) ? 'oui' : 'NON';
  })());
  dire('note de biais', [...d.querySelectorAll('#v-candidats .note')]
    .some(n => /individual frequency|fréquence des individus/.test(n.textContent))
    ? 'présente' : 'ABSENTE');

  // Le panier alimente la comparaison depuis cette vue.
  w.eval("document.querySelector('#v-candidats [data-panier]').dispatchEvent(new Event('click'))");
  dire('panier après un clic', w.eval('etat.panier.length'));
  dire('  barre de panier', compte('#v-candidats .choix-carte .jeton-esp'));
  w.eval("document.querySelector('#v-candidats [data-oter]').dispatchEvent(new Event('click'))");
  dire('  après retrait', w.eval('etat.panier.length'));

  // Descendre dans une branche restreint les candidats.
  w.eval('vue.noeud = 100; dessinerCandidats();');
  dire('branche « oiseaux »', compte('#v-candidats .fiche'));
  w.eval('vue.noeud = null; dessinerCandidats();');

  /* Confusions : sans réseau, le sondage du point d'entrée échoue et l'on doit retomber sur
     les espèces du même genre présentes localement. */
  /* Le point d'entrée est marqué absent d'emblée : l'essai porte sur le repli, qui est le
     chemin que prendra tout navigateur si l'API ne le sert pas. */
  w.eval(`apiConfusions = false;
          etat.panier = etat.especes.slice(0, 2).map(e => e.id);
          dessinerConfusions();`);
  setTimeout(() => {
    dire('confusions : blocs', compte('#v-confusions .groupe-coche'));
    dire('  source annoncée', (d.querySelector('#v-confusions .groupe-coche .compte') || {}).textContent);
    dire('  espèces proposées', compte('#v-confusions .conf-ligne'));
    dire('  menu latéral', compte('#v-confusions .retenue') + ' entrées, ' +
      compte('#v-confusions .retenue.sel') + ' active');
    /* Le classement doit croiser la force de la confusion et la fréquence locale, et non
       l'une seulement. On fabrique quatre cas de figure et l'on regarde l'ordre obtenu. */
    dire('  classement', w.eval(`
      (() => {
        const e = etat.especes;
        const cas = [
          { id:e[0].id, n:2,   nom:'faible-fréquente' },
          { id:e[1].id, n:300, nom:'forte-fréquente' },
          { id:e[2].id, n:300, nom:'forte-rare' },
          { id:999999,  n:400, nom:'absente-très-forte' }
        ];
        e[0].nZone = 200; e[1].nZone = 200; e[2].nZone = 3;
        return classerConfusions(cas).map(x => x.nom).join(' > ');
      })()
    `));
    dire('  présentes avant absentes', (() => {
      const l = [...d.querySelectorAll('#v-confusions .conf-ligne')]
        .map(x => x.classList.contains('absente') ? 1 : 0);
      return l.every((v, i) => i === 0 || v >= l[i - 1]) ? 'oui' : 'NON';
    })());
    dire('  boutons « Comparer »', compte('#v-confusions [data-comparer]'));
    dire('  longue note retirée', compte('#v-confusions .note') === 0 ? 'oui' : 'NON');
    dire('  noms cliquables', (() => {
      const a = [...d.querySelectorAll('#v-confusions .conf-ligne a.noms')];
      return a.length + ' · ' + (a[0] ? a[0].getAttribute('href')
        .replace('https://www.inaturalist.org', '') : 'AUCUN');
    })());
    dire('  mode d\'emploi', compte('#v-confusions .mode-emploi') ? 'présent' : 'ABSENT');
    dire('  bouton explicite', (d.querySelector('#v-confusions .comparer') || {}).textContent);
    w.eval("document.querySelector('#v-confusions [data-comparer]').dispatchEvent(new Event('click'))");
    dire('  après un clic', w.eval('etat.panier.length') + ' au panier · '
      + (d.querySelector('#v-confusions .comparer') || {}).textContent);
    dire('  toutes du même genre', w.eval(`
      (() => {
        const e = especeParId(etat.panier[0]);
        const g = e.anc.find(a => { const x = etat.ancetres.get(a);
          return x && x.rang === 'genus'; });
        return [...document.querySelectorAll('#v-confusions [data-panier]')]
          .every(b => especeParId(+b.dataset.panier).anc.includes(g));
      })()
    `) ? 'oui' : 'NON');

    /* Critères : le tri privilégie les textes développés, et les formules de politesse
       comme les textes trop courts sont écartés. */
    w.eval(`
      const e0 = etat.especes[0].id;
      /* On passe par la vraie chaîne : filtrage des textes bruts, puis tri. */
      const brutes = [
        { body:"Merci beaucoup !", user:{login:'a'}, created_at:'2024-01-01', observation_id:1 },
        { body:"Tarses jaunes et nervation alaire nette, ce qui exclut l'espèce voisine dans toute la région.",
          user:{login:'b'}, created_at:'2024-02-01', observation_id:2 },
        { body:"À cette date et à cette altitude, la confusion n'est pas possible ici.",
          user:{login:'c'}, created_at:'2024-03-01', observation_id:3 }
      ].map(x => noteUtile({ ...x, source:'id' })).filter(Boolean);
      criteresCache.set(e0, brutes);
      etat.panier = [e0];
      dessinerCriteres();
    `);
    setTimeout(() => {
      dire('critères : notes affichées', compte('#v-criteres .note-id'));
      dire('  la plus longue en tête', (d.querySelector('#v-criteres .note-id p') || {})
        .textContent.slice(0, 30));
      dire('  provenance indiquée', compte('#v-criteres .note-id .qui'));
      dire('  liens vers la source', compte('#v-criteres .note-id .qui a'));
      dire('  politesses écartées', w.eval(`
        [noteUtile({ body:"Merci beaucoup !" }),
         noteUtile({ body:"thanks a lot for this identification, really appreciated" }),
         noteUtile({ body:"Tarses jaunes et nervation alaire nette, ce qui exclut l'espèce voisine." })]
          .map(x => x ? 'gardé' : 'écarté').join(', ')
      `));
    }, 40);

    /* Répartition : le tableau-légende porte une couleur par espèce et deux couches. */
    w.eval(`
      etat.panier = etat.especes.slice(0, 3).map(e => e.id);
      dessinerRepartition();
    `);
    dire('répartition : lignes', compte('#v-repartition .rep-legende tbody tr'));
    dire('  couleurs distinctes', (() => {
      const c = [...d.querySelectorAll('#v-repartition .rep-esp i')].map(i => i.getAttribute('style'));
      return new Set(c).size + ' / ' + c.length;
    })());
    dire('  couches proposées', [...d.querySelectorAll('#v-repartition [data-couche]')]
      .map(x => x.dataset.couche).join(' | '));
    dire('  bouton de fond', compte('#v-repartition #r-fond') ? 'présent' : 'ABSENT');
  }, 60);
} else {
  w.eval('dessinerListe()');
  dire('fiches affichées', compte('#v-liste .fiche'));
  dire('  statuts sur l\'image', compte('#v-liste .fiche .img .statut'));
  dire('branches de l\'arbre', compte('#v-liste .arbre .n-noeud'));
  dire('périodes du menu', compte('#v-liste #f-mois option'));
  dire('  première entrée', [...d.querySelectorAll('#v-liste #f-mois option')]
    .map(o => o.textContent.trim())[0]);
  w.eval('vue.noeud = 100; dessinerListe();');
  dire('branche « oiseaux » : fiches', compte('#v-liste .fiche'));
}

/* Sans IndexedDB dans jsdom, le relevé de réserve doit échouer proprement et laisser la
   carte proposer une collecte, plutôt que de laisser l'onglet vide. */
if (outil === 'coche') {
  /* Sans IndexedDB ni réseau dans jsdom : le relevé échoue, la collecte automatique part
     puis échoue à son tour, et l'onglet doit finir sur le message d'interruption avec de
     quoi réessayer — surtout pas sur une page blanche ni sur une relance en boucle. */
  w.eval('grille = null; grilleReleveePour = null; grilleEchec = null;');
  w.eval("MODULES.find(m => m.id === 'carte').ouvrir()");
  setTimeout(() => {
    /* Sans relevé, la carte doit tout de même être là : c'est elle qui porte les espèces
       retenues et les limites de la zone. */
    dire('sans réserve : bandeau', (d.querySelector('#v-carte .vide strong') || {}).textContent);
    dire('  carte présente', compte('#v-carte #carte-ou') ? 'oui' : 'NON');
    dire('  bouton de collecte', compte('#v-carte #g-lancer') ? 'présent' : 'ABSENT');
    dire('  légende d\'échelle', compte('#v-carte #g-legende') ? 'PRÉSENTE À TORT' : 'absente');
    dire('  aucune collecte lancée', w.eval('grilleEnCours') ? 'OUI — défaut' : 'non');
  }, 200);
}

setTimeout(() => {
  console.log('\nincidents :', incidents.length ? '\n  ' + incidents.join('\n  ') : 'aucun');
}, 800);
