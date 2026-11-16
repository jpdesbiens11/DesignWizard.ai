# Les termes techniques

La plateforme écrit en français, mais **nomme chaque terme technique comme le métier le nomme, en anglais** : un procédé
(*High pressure die casting*, *Sand casting*, *CNC milling*), une opération (*Drill*, *Counterbore*), une forme
(*Pocket*, *Boss*, *Fillet*), une interface (*Bolt pattern*, *Dowel pins*), une matière première (*Plate*, *Round bar*),
le vocabulaire du mold (*draft*, *parting line*, *slide*, *gate*, *riser*), un soudage, un revêtement, une finition.
L'explication autour du terme reste en français.

## Comment c'est fait

- Chaque table de vocabulaire donne à ses entrées deux noms : `label`, le terme anglais — **celui que tous les écrans,
  les rapports, les gammes et les fichiers montrent** — et `fr`, son équivalent français.
- Les procédés passent par une seule fonction : `processName(id)` (`web/js/cad/materials.js`).
- Le **glossaire** (`web/js/core/terms.js`, écran Aide → « Glossaire », route `#/help/terms`) réunit tout : 398 termes
  en neuf groupes — procédés, mold, opérations et formes, matière première, interfaces et assemblage, électrique,
  finitions et marquage, calculs analytiques, règles DFx / DFA / carte —, chacun avec son équivalent français, et une
  recherche dans les deux langues.
- Les **titres des règles** (DFx, DFA, règles de la carte, contrôles électriques) sont écrits en français dans leurs
  fichiers et montrés en anglais : `rule()` passe par la table `RULE_TITLES` (`web/js/analysis/dfx_titles.js`) et garde
  le français dans `fr`. La limite, la raison et le correctif d'une règle restent en français : c'est l'explication.
- Les **modèles de calcul** (`title` anglais, `fr`) et les **matières** dont le nom était français (`name` anglais,
  `fr`) suivent la même règle ; les familles de matières des menus sont en anglais (*Stainless steel*, *Copper*…).
- Un test relit le code : aucune table de vocabulaire ne peut avoir une entrée sans terme anglais, et aucun écran ne
  peut lire le nom français d'une de ces tables (`tests/node/terms.test.mjs`).

## Les tables

`PROCESSES`, `INTERFACE_TYPES`, `ADHESIVES`, `WELD_PROCESSES`, `PLATINGS`, `CONTACT_FORMS`, `CONTACT_BASES`,
`STOCK_FORMS`, `SHOP_VERBS`, `AM_PROCESSES`, `LASER_FAMILIES`, `ENDS`, `INSULATIONS`, `LABEL_KINDS`, `FINISHES` — plus
les noms des opérations de l'arbre (`FEATURE_LABEL`), les genres de joint du registre (*Bolted*, *Pinned*, *Bonded*…),
les procédés du mold (`MOLDS`) et les gates (`GATES`).

## Ce qui reste en français

Les phrases : explications, conseils, messages du guide, constats du DFx (la limite, la raison, le correctif d'une
règle), les questions et les grandeurs des modèles de calcul (« flèche », « perte de charge »). Restent aussi en
français, par choix : les noms que les exemples donnent à leurs pièces (ce sont des données de projet, pas du
vocabulaire), les noms des domaines et des menus de l'application, et **le vocabulaire des dessins** — noms des vues
(FACE, DESSUS, DROITE), cartouche, NOMENCLATURE, NOTES : la langue d'un dessin est une décision de projet, pas un terme
de métier. Les noms d'interface écrits dans un projet existant ne changent pas : seuls les noms proposés par défaut
sont en anglais.
