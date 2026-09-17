/* Essai de démarrage hors navigateur. On charge la vraie page et les quatre scripts dans un
   DOM simulé, sans réseau ni Leaflet : ce qui est vérifié, c'est que le fichier s'évalue
   entièrement, que les branchements trouvent leurs éléments, que les neuf modules se
   déclarent, et qu'un clic d'onglet ne casse rien. Le chargement d'un inventaire, lui,
   demande l'API et n'est pas testé ici. */

const fs = require('fs');
const { JSDOM } = require('jsdom');

const JEUX = {
  ici:   { page:'site/ici/index.html',
           scripts:['site/commun/textes.js', 'site/commun/socle.js',
                    'site/commun/inventaire.js', 'site/ici/modules.js'],
           onglets:['responsabilite', 'bio', 'comm', 'decouverte', 'disparition', 'saison', 'liste'] },
  quoi:  { page:'site/quoi/index.html',
           scripts:['site/commun/textes.js', 'site/commun/socle.js', 'site/commun/inventaire.js',
                    'site/quoi/textes.js',
                    'site/commun/comparaison.js', 'site/quoi/modules.js'],
           onglets:['taxonomie', 'comparaison', 'confusions', 'criteres', 'repartition', 'bilan', 'candidats'] },
  coche: { page:'site/coche/index.html',
           scripts:['site/commun/textes.js', 'site/commun/socle.js',
                    'site/commun/inventaire.js', 'site/coche/textes.js',
                    'site/commun/liste-perso.js', 'site/coche/modules.js'],
           onglets:['carte', 'quand', 'classement', 'terrain', 'couverture', 'manquants'] }
};
const jeu = JEUX[process.argv[2] || 'ici'];

const html = fs.readFileSync(jeu.page, 'utf8')
  .replace(/<script src="[^"]*"><\/script>/g, '');      // on injecte nous-mêmes

/* « dangerously » est ici le mode fidèle : il exécute de vraies balises <script>, donc les
   déclarations de premier niveau sont partagées entre fichiers comme dans un navigateur.
   Avec eval(), chaque fichier aurait sa propre portée et « t » resterait introuvable. */
const dom = new JSDOM(html, { url: 'https://exemple.org/' + (process.argv[2] || 'ici') + '/', runScripts: 'dangerously' });
const w = dom.window;

const incidents = [];
w.console.error = (...a) => incidents.push('console.error : ' + a.join(' '));
w.onerror = (m) => incidents.push('erreur : ' + m);
w.addEventListener('error', ev => incidents.push('erreur : ' + (ev.error || ev.message)));
dom.virtualConsole && dom.virtualConsole.on('jsdomError', e => incidents.push('jsdom : ' + e.message));

// Leaflet n'est pas chargé : toute carte devient un objet inerte qui accepte tout.
const inerte = new Proxy(function () {}, {
  get: () => inerte, apply: () => inerte, construct: () => inerte
});
w.L = inerte;
w.fetch = () => Promise.reject(new Error('réseau coupé pour l\'essai'));
w.matchMedia = () => ({ matches:false, addEventListener(){}, addListener(){} });   // absent de jsdom
w.scrollTo = () => {};

const scripts = jeu.scripts;

for (const f of scripts) {
  const s = dom.window.document.createElement('script');
  s.textContent = fs.readFileSync(f, 'utf8');
  const avant = incidents.length;
  dom.window.document.body.appendChild(s);
  console.log(incidents.length > avant ? 'ÉCHEC   ' : 'évalué  ', f);
}

const d = w.document;
console.log('\nmodules déclarés :', w.eval("MODULES.map(m => m.id).join(', ')"));
console.log('ordre du chargement différé :',
  w.eval("MODULES.filter(m => m.fond).map(m => m.id).join(' → ')"));

// Les textes ont-ils été posés ?
console.log('titre traduit    :', d.querySelector('h1').textContent.trim());
console.log('barre d\'état     :', JSON.stringify(d.querySelector('#etat').textContent));
console.log('bascule          :', [...d.querySelectorAll('nav.marque-site .marque-outils > *')]
  .map(x => x.textContent).join(' | '));
const champs = [...d.querySelectorAll('.champs > div label')].map(x => x.textContent.trim());
console.log('ordre des champs :', champs.join(' → ') || '(aucun)');
const st = d.querySelector('.sub');
console.log('sous-titre       :', st ? st.textContent.trim().slice(0, 80) : '(aucun)');

// Un onglet quelconque : le gestionnaire générique doit trouver son module.
for (const vue of jeu.onglets) {
  d.querySelector(`nav.onglets button[data-vue="${vue}"]`).dispatchEvent(
    new w.Event('click', { bubbles: true }));
}
console.log('onglet actif     :', d.querySelector('nav.onglets button.actif').dataset.vue);
console.log('vue affichée     :', d.querySelector('section.vue.actif').id);

// Le vidage doit passer par tous les modules sans en heurter un.
w.eval('viderModules(cartonVide())');
const premiere = d.querySelector('section.vue');
console.log('après vidage     :', JSON.stringify(premiere.textContent.trim().slice(0, 40)));

setTimeout(() => {
  console.log('\nincidents :', incidents.length ? '\n  ' + incidents.join('\n  ') : 'aucun');
}, 200);
