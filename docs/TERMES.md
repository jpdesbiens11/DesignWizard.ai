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
vocabulaire) et les noms des domaines et des menus de l'application. Les noms d'interface écrits dans un projet
existant ne changent pas : seuls les noms proposés par défaut sont en anglais.

## Les dessins : en anglais partout

Choix de JP : **tout ce que l'outil écrit sur un dessin est en anglais** — noms des vues (FRONT, TOP, RIGHT, ISOMETRIC,
SECTION A-A), SCALE, cartouche (Title, Part No., Rev., Material, Finish, Mass, Scale, Sheet, Size, Drawn, Checked,
Approved, General tolerances, Project, Status, Units), REVISIONS, NOTES et notes générales, BILL OF MATERIALS, GEOMETRIC
TOLERANCES, HOLE TABLE, DEFINITION DIMENSIONS, le libellé de chaque cote (width, pitch X, first hole from edge X…), les
descriptions de trous (through, depth, counterbore, countersink, tapped, heat-set insert), les notes SC / CSC, et les
notes du DXF du développé (BEND 90 UP R…, FLAT PATTERN, K FACTOR). Les nombres s'écrivent avec un **point décimal**
(2.5, échelle 1:1.5).

Ce que le projet a tapé (nom de la pièce, noms d'interface, libellés de paramètres, notes, finition, nom du projet)
s'écrit dans **son anglais quand le projet l'a donné** — écran Dessins, « Anglais du dessin », `project.drawing.words` ;
voir `docs/DESSINS.md` — et tel quel sinon. Les projets de démonstration arrivent avec le leur. Restent tels
qu'écrits : la note de confidentialité du projet et la note de la marque (phrases fixes, `core/brand.js`). À l'écran, le sélecteur de
classe d'une cote et les messages restent en français : c'est l'interface, pas le dessin.
