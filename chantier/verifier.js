/* Contrôle statique après découpe : tout identifiant appelé doit être déclaré quelque part,
   dans l'un des quatre fichiers ou parmi les objets du navigateur. Ne remplace pas un essai
   réel, mais attrape ce qu'une découpe rate typiquement — une fonction oubliée en route. */

const fs = require('fs');
const acorn = require('acorn');
const walk = require('acorn-walk');

const jeux = {
  ici:   ['site/commun/textes.js', 'site/commun/socle.js', 'site/commun/inventaire.js',
          'site/ici/modules.js'],
  quoi:  ['site/commun/textes.js', 'site/commun/socle.js', 'site/commun/inventaire.js',
          'site/quoi/textes.js', 'site/commun/comparaison.js',
          'site/quoi/modules.js'],
  coche: ['site/commun/textes.js', 'site/commun/socle.js', 'site/commun/inventaire.js',
          'site/coche/textes.js', 'site/commun/liste-perso.js', 'site/coche/modules.js']
};
const fichiers = jeux[process.argv[2] || 'ici'];

const declares = new Set();
const arbres = [];

for (const f of fichiers) {
  const src = fs.readFileSync(f, 'utf8');
  const a = acorn.parse(src, { ecmaVersion: 2022 });
  arbres.push([f, src, a]);
  // Déclarations de premier niveau : elles sont partagées entre scripts classiques.
  for (const n of a.body) {
    if (n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration') declares.add(n.id.name);
    if (n.type === 'VariableDeclaration')
      for (const d of n.declarations)
        if (d.id.type === 'Identifier') declares.add(d.id.name);
  }
}

const globaux = new Set(['window','document','navigator','location','history','console','Math',
  'JSON','Object','Array','Map','Set','Promise','Date','Number','String','Boolean','Error',
  'URL','URLSearchParams','Intl','indexedDB','localStorage','setTimeout','clearTimeout',
  'setInterval','fetch','requestAnimationFrame','L','undefined','NaN','Infinity','globalThis',
  'AbortController','Response','Request','isNaN','parseInt','parseFloat','encodeURIComponent',
  'decodeURIComponent','performance','matchMedia','Uint8Array','Float64Array','Int32Array',
  'DOMParser','Blob','FileReader','Image','CustomEvent','Event','TextDecoder','structuredClone',
  'isFinite','Proxy','Symbol','Reflect','WeakMap','RegExp','Function','process',
  'createImageBitmap']);

let ennuis = 0;
for (const [f, src, a] of arbres) {
  const locaux = new Set();
  // Tout ce qui est déclaré où que ce soit dans le fichier : approximation suffisante,
  // puisqu'on cherche des noms absents partout, pas des fuites de portée.
  walk.full(a, n => {
    if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier') locaux.add(n.id.name);
    if ((n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression'
      || n.type === 'ArrowFunctionExpression') ) {
      if (n.id) locaux.add(n.id.name);
      for (const p of n.params) {
        const noms = [];
        (function pars(x) {
          if (!x) return;
          if (x.type === 'Identifier') noms.push(x.name);
          else if (x.type === 'AssignmentPattern') pars(x.left);
          else if (x.type === 'RestElement') pars(x.argument);
          else if (x.type === 'ObjectPattern') x.properties.forEach(q => pars(q.value || q.argument));
          else if (x.type === 'ArrayPattern') x.elements.forEach(pars);
        })(p);
        noms.forEach(x => locaux.add(x));
      }
    }
    if (n.type === 'ObjectPattern') n.properties.forEach(q => {
      const v = q.value || q.argument;
      if (v && v.type === 'Identifier') locaux.add(v.name);
    });
    if (n.type === 'ArrayPattern') n.elements.forEach(e => {
      if (e && e.type === 'Identifier') locaux.add(e.name);
    });
    if (n.type === 'CatchClause' && n.param && n.param.type === 'Identifier') locaux.add(n.param.name);
    if (n.type === 'ClassDeclaration' && n.id) locaux.add(n.id.name);
    if (n.type === 'ImportDeclaration') n.specifiers.forEach(s => locaux.add(s.local.name));
    if (n.type === 'LabeledStatement') locaux.add(n.label.name);
  });

  const voir = (n, etat, ancetres) => {
    if (n.type !== 'Identifier') return;    // « Pattern » couvre aussi objets et tableaux
      const p = ancetres[ancetres.length - 2];
      if (!p) return;
      if (p.type === 'MemberExpression' && p.property === n && !p.computed) return;
      if (p.type === 'Property' && p.key === n && !p.computed) return;
      if (p.type === 'MethodDefinition' && p.key === n) return;
      if (p.type === 'LabeledStatement' || p.type === 'BreakStatement'
        || p.type === 'ContinueStatement') return;
      const nom = n.name;
      if (declares.has(nom) || locaux.has(nom) || globaux.has(nom)) return;
    console.log(`${f} : « ${nom} » référencé, déclaré nulle part`);
    ennuis++;
  };
  /* Une cible d'affectation est visitée sous le type « Pattern » : sans ce second point
     d'entrée, « x = 1 » avec un x jamais déclaré passait inaperçu. */
  walk.ancestor(a, { Identifier: voir, Pattern: voir });
}

console.log(ennuis ? `\n${ennuis} identifiant(s) sans déclaration` : '\nAucun identifiant orphelin.');
