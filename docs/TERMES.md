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

## Les systèmes de batteries : le terme publié d'abord

Demande de JP (20 novembre 2026) : « si jamais ces acronymes sont de l'abus de langage comparativement aux normes en
vigueur… recampons-nous sur les standards de l'industrie, les bons noms, et citons les normes en vigueur dans l'aéro ».

L'outil écrit le terme qu'une norme ou une autorité **publie** ; un mot de maison reste un alias du glossaire, avec
ce qui a été trouvé (`web/js/core/battery_terms.js`, carte « Vocabulaire des systèmes de batteries » de l'Aide,
`#/help/batteries`).

| L'outil écrit | En français | Qui le définit ou l'emploie |
|---|---|---|
| Cell | cellule | FAA AC 20-184A, B.1.3 ; EASA MOC-3 SC-VTOL |
| Cell block | bloc de cellules | IEC 62619, art. 3.8 ; IEC 62620, art. 3.7 |
| Battery module | module de batterie | EASA MOC-3 ; document commun des autorités (2024) ; FAA AC 20-184A |
| Battery pack | pack de batterie | document commun des autorités ; ISO 12405-4, art. 3.2 |
| Cell electronics | électronique de cellules | ISO 12405-4, art. 3.5 — le seul nom défini par une norme |
| Battery management system (BMS) | système de gestion de batterie | IEC 62619, IEC 62620 ; autorités ; SAE AIR6897 |
| Energy storage system (ESS) | système de stockage d'énergie | 14 CFR § 27.1353 ; FAA AC 20-184A ; EASA MOC-4 |
| Propulsion battery | batterie de propulsion | EASA SC E-19, EHPS.15 |
| Contactor | contacteur | ISO 12405-4 ; rapport NTSB/AIR-14/01 |

**Mots de maison**, et ce qui a été trouvé :

- **CMB** (cell monitoring board) — aucune norme lue ne le définit ; un article de la NASA l'écrit en toutes
  lettres, sans sigle. L'outil écrit « cell electronics ».
- **BMU** — les normes IEC en font un autre nom du BMS (« battery management unit ») ; un rapport du NTSB l'emploie
  pour « battery monitoring unit ». **BCU** — « battery control unit » pour l'ISO, « battery charger unit » pour le
  même rapport. À écrire en toutes lettres.
- **BM** — un sigle trouvé nulle part : « battery module ».
- **EFC** — rien d'établi pour une partie d'un système de batterie ; le seul sens trouvé est « equivalent full
  cycles », un compteur. Une pièce se nomme par sa fonction.
- **EESS** — pour un aéronef, seulement dans un texte proposé de 2021 ; les textes récents écrivent ESS.

**Quel bus ?** Les textes des autorités lus ne nomment aucun bus. Les manuels publics de batteries d'avion
certifiées qui ont été ouverts montrent ARINC 429, RS-232 et des signaux discrets vers l'aéronef ; MIL-PRF-29595A
cite un bus RS485 comme exemple. Rien de ce qui a été lu ne permet d'écrire que le RS-485 est le choix courant à
l'intérieur d'une batterie d'aéronef — ni l'inverse.

**Niveau de lecture.** Textes des autorités, NTSB, NASA, MIL : ouverts, passages relus. Normes IEC et ISO : aperçus
gratuits seulement (l'article des termes). SAE AIR6897 : la page de présentation. **RTCA DO-311A : non lu.** Ce que
dit un texte est rendu dans nos mots, avec son article ; aucun texte de norme n'est recopié. Aucun vocabulaire
d'entreprise n'est décrit : seulement ce qui est public.
