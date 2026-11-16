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
- Le **glossaire** (`web/js/core/terms.js`, écran Aide → « Glossaire », route `#/help/terms`) réunit tout : 198 termes
  en sept groupes — procédés, mold, opérations et formes, matière première, interfaces et assemblage, électrique,
  finitions et marquage —, chacun avec son équivalent français, et une recherche dans les deux langues.
- Un test relit le code : aucune table de vocabulaire ne peut avoir une entrée sans terme anglais, et aucun écran ne
  peut lire le nom français d'une de ces tables (`tests/node/terms.test.mjs`).

## Les tables

`PROCESSES`, `INTERFACE_TYPES`, `ADHESIVES`, `WELD_PROCESSES`, `PLATINGS`, `CONTACT_FORMS`, `CONTACT_BASES`,
`STOCK_FORMS`, `SHOP_VERBS`, `AM_PROCESSES`, `LASER_FAMILIES`, `ENDS`, `INSULATIONS`, `LABEL_KINDS`, `FINISHES` — plus
les noms des opérations de l'arbre (`FEATURE_LABEL`), les genres de joint du registre (*Bolted*, *Pinned*, *Bonded*…),
les procédés du mold (`MOLDS`) et les gates (`GATES`).

## Ce qui reste en français

Les phrases : explications, conseils, messages du guide, constats du DFx. À l'intérieur, les termes du mold sont déjà en
anglais (draft, slide, gate, core…), mais **pas tous les autres** : les titres des 133 règles DFx, des règles des cartes
et de leurs contrôles électriques, les noms des matières de la bibliothèque (« Inox 304 », « Titane »…), les noms que
les exemples donnent à leurs pièces et à leurs opérations, et le vocabulaire des dessins n'ont pas été repris. Les noms
d'interface écrits dans un projet existant ne changent pas : seuls les noms proposés par défaut sont en anglais.
