# Les unités

À l'intérieur, rien ne change : chaque outil calcule dans ses unités pratiques du SI (mm, N, MPa, kPa, °C, L/min) et le
fichier du projet reste en SI. Le choix d'unités ne touche que **ce qui se lit et ce qui se tape** : une valeur est
convertie au moment de l'afficher, et reconvertie au moment où elle est entrée (`web/js/core/units.js`, pur et testé ;
`web/js/core/units_ui.js` pour les boutons).

## Deux systèmes

| Système | Ce qui se lit |
|---|---|
| **SI** | mm, µm, mm², N, N·m, MPa, GPa, kPa, L/min — comme avant |
| **Impérial** (hybride d'ingénierie) | in, µin, in², in³, in⁴, lbf, lbf·in, lbf/in, ksi, Msi, psi, gal/min (US) |

Dans le système impérial, **le mètre, le mètre par seconde et le kilogramme restent** : une vitesse se lit en m/s, une
masse volumique en kg/m³, et une masse se lit « kg (lb) » — les deux à la fois. Restent aussi le °C et le kelvin, le
watt, l'ampère et tout ce qui est thermique ou électrique (W/m·K, K/W, A/mm², Ω). **Ni slug, ni poundal, ni BTU.**

## La pression a son propre choix

Une pression donnée en kPa — une perte de charge, une pression sur une plaque — se lit en **kPa, bar, psi ou atm**, au
choix, quel que soit le système (le SI propose kPa, l'impérial psi). Dans le résultat d'un modèle, la tuile d'une
pression donne en plus sa valeur **dans les trois autres unités**, en petit sous le chiffre.

## Où choisir

- Dans les **modèles analytiques** (Physique), en haut du volet de gauche : « Unités » — SI ou Impérial, puis la
  pression.
- Dans le **menu du compte** (barre du haut), sous la taille de l'affichage : le même choix, pour toute la plateforme —
  l'écran en cours se redessine aussitôt.

Le choix est gardé dans le navigateur ; il n'est pas écrit dans le projet, qui se lit donc de la même façon chez un
collègue qui a choisi l'autre système.

## Ce qui suit le choix aujourd'hui

Un changement d'unités redessine l'écran en cours.

| Où | Ce qui se lit et se tape dans l'unité choisie |
|---|---|
| **Modèles analytiques** | En entier : champs (valeur, unité, bornes), résultats, vérifications et limites, étiquettes du modèle en 3D, calculs gardés |
| **Pièces** | Les **paramètres** : valeur, curseur, unité affichée — on tape des pouces, le projet garde des millimètres. La ligne d'état (masse, enveloppe, volume), la fiche (masse, volume, enveloppe, centre de gravité), les constats DFx de la pièce et leurs correctifs |
| **Vues 3D** | La mesure entre deux points ou deux faces et ses ΔX · ΔY · ΔZ, le Ø d'un cylindre, ce que mesure une sélection (point, arête, face, entraxe), le pas de la grille |
| **Atelier** | Les longueurs de l'intention (enveloppe, plages, entraxes, diamètres, film de colle, lèvre, colonnettes, hauteur des bords d'une tôle), la masse et l'enveloppe de la proposition, le brut, la gamme, les outils, les remarques et les décisions du compagnon |
| **Assemblage** | Masse, enveloppe, position d'une occurrence, nomenclature, constats DFA |
| **DFx** | Les constats, ce qui a été mesuré, la limite et le pourquoi de chaque règle, le libellé des correctifs, le livre des règles |
| **Guide** | Toutes ses lignes, sur tous les écrans |
| **Gammes** | Opérations, prises de pièce, outillage, contrôles, caractéristiques à tenir, remarques |
| **Busbar, circuit flexible, étiquettes** | Les **champs** : largeur, épaisseur, longueurs des branches, rayon de pli, positions des raccordements, largeur des pistes, taille d'une étiquette — un courant, une tension, un nombre restent ce qu'ils sont. La ligne d'état, les épaisseurs d'isolant du menu, la liste des raccordements |
| **Simulation** | Un effort se tape en lbf, une pression en ksi, la position d'un plan de coupe en pouces ; l'arbre du cas de charge, les étiquettes de la vue, la contrainte de pointe, le déplacement, **l'échelle des couleurs** (bornes tapées et curseurs), le recoupement à la main, le matériau |
| **Isolation** | Les distances mesurées et requises des paires de nets (« 0,652 / 0,247 in »), les étiquettes des chemins dans la vue |
| **Assemblage** | La position manuelle d'une occurrence (X, Y, Z) |
| **Dessins** | La position du plan de la coupe A-A |
| **Carte électronique (PCBA)** | Lue comme le métier la lit : en **mil** (un millième de pouce) pour les pistes, les isolements, les perçages, les vias, l'empilage et le vernis ; en **pouces** dès un pouce — le contour de la carte, la longueur de cuivre posée. Les champs se tapent de même : contour en pouces, largeur de piste, isolement, position d'un composant et vernis en mil. Une feuille de cuivre porte son nom d'usage : « 1 oz (1,38 mil) ». Constats, livre de règles, classes de nets, gamme de la carte et **rapport de revue** (aperçu, Word, PDF) suivent |
| **Documents** | Le **dossier de revue** (Word, PDF) et les **gammes** (Word, PDF, texte) : phrases, listes et cellules de tableau sont converties à l'enregistrement (`docUnits`) |
| **Dessins** | Les **cotes** — en pouces, trois décimales, sans zéro avant le point (`.472`, `6.299`), comme ASME Y14.5 écrit une cote en pouces —, les tolérances géométriques, le tableau des trous, la note 1 (« dimensions in inches, converted from the millimetre model »), la case Units et la masse du cartouche (« 111.1 g (3.92 oz) »), l'arbre des cotes de l'écran |

**Comment.** Trois outils, tous dans `core/units.js` (purs, testés) et repris par `core/dom.js` :

- `measure`, `measures`, `massText` (`fmtLen`, `fmtDims`, `fmtMass` côté écran) pour une valeur que le code écrit lui-même :
  les décimales de l'outil en SI, **quatre chiffres significatifs** quand la valeur est convertie ;
- `fieldValue` / `fromShown` pour un champ : ce qui est tapé revient en millimètres, sans poussière de virgule flottante ;
- `unitField` / `unitInput` (`core/dom.js`) pour un champ dont le libellé se lit comme une longueur : « Largeur » devient
  « Largeur (in) », la valeur s'affiche et se tape en pouces, le projet la reçoit en millimètres ; un libellé qui nomme une
  autre unité — (A), (V), (N), (°) — ou qui compte des choses n'est pas touché ;
- `docUnits` pour un **document à lire** (le modèle que `core/docx.js` et `core/pdfdoc.js` impriment) : ses phrases, ses
  listes et ses cellules, bloc par bloc ; une valeur et son unité rangées dans deux cellules restent ensemble, telles quelles ;
- `boardLen` / `boardDims` / `boardField` / `boardBack` / `boardProse` / `boardDoc` (`web/js/pcba/board_units.js`) pour
  **une carte** : la même chose, lue en mil sous un pouce et en pouces au-delà ; un métier qui lit une unité à sa façon
  donne sa règle à `proseUnits` et à `docUnits` (`o.rule`) ;
- `proseUnits` (`inUnits`) pour une **phrase** écrite en millimètres par un outil : chaque quantité est convertie là où
  elle se trouve, à trois chiffres significatifs — « de 0,2 à 0,4 mm », « 160 × 110 × 42 mm », « 16,56 / 6,27 mm »
  (mesuré / requis : les deux dans l'unité qui suit), « 1 250 N » —, une masse
  reçoit sa lecture impériale entre parenthèses, et ce qui n'est pas une quantité ne bouge pas (« M3 × 0,5 », « 1,5 d »,
  « ISO 2768-mK », « 3 A/mm² »).

Sur un dessin, les **clés des cotes restent en millimètres** : la classe (SC, CSC, référence) donnée à une cote tient
quel que soit le système. Le modèle, lui, ne change jamais d'unité.

## Ce qui reste en millimètres et en SI

- **Les formules de la pièce** : une cote d'interface ou d'opération s'écrit comme une expression du langage de pièce
  (« wall + so », « L - 2*wall - 7 »), en millimètres ; l'éditeur d'une interface et l'onglet du code le restent donc.
- **Les fichiers de fabrication de la carte** : Gerber, perçage, placement, netlist d'essai, notes de fabrication et la
  gamme rangée dans le dossier sont en millimètres — c'est ce que l'atelier reçoit. **La grille de la carte** reste
  métrique aussi : un composant se cale sur 0,25 mm (9,84 mil), une zone sur 0,5 mm ; taper 500 mil pose à 502 mil.
  Les empreintes de la bibliothèque sont décrites en millimètres.
- **Les panneaux du mold, de l'impression et de l'ancienne entrevue d'extrusion**, la bibliothèque électrique, les
  infobulles, les raccourcis clavier des étiquettes (un pas de 1 mm est un pas de 1 mm).
- **Le calcul détaillé** : les étapes d'un modèle analytique, la « lecture du cas » de la simulation et le calcul des
  distances d'isolation s'écrivent en SI, comme dans leur source — seuls leurs résultats sont convertis. JP le
  confirme (17 novembre 2026) : « les calculs d'ingénierie sont toujours en SI en ingénierie au Québec ».
- **Les documents** qui ne sont pas des phrases : la note de calcul et le classeur Excel (unités du modèle), les CSV. Les fichiers d'échange — STEP, STL, DXF, Gerber, perçage, `.dwiz` — sont en millimètres par nature.
- **Sur un dessin en pouces** : la tolérance générale reste « ISO 2768-mK » (des classes définies en millimètres) ; le
  DXF du développé d'une tôle reste en millimètres ; les notes tapées dans la pièce restent telles qu'écrites.
- **La taille d'un outil métrique** : « Clé six pans de 3 mm » reste telle quelle dans une gamme — c'est le nom de l'outil
  d'une vis M4, pas une mesure ; de même une désignation de filetage (« M4 », « M3 × 0,5 »).
- Une valeur convertie est **arrondie pour être lue** (quatre chiffres significatifs, trois dans une phrase, trois
  décimales sur un dessin) : la valeur exacte est celle du projet, en millimètres.

## Les facteurs

| Unité | Vaut | |
|---|---|---|
| pouce (in) | 25,4 mm | exact |
| mil | 0,0254 mm | un millième de pouce, exact — l'unité d'une carte électronique |
| livre (lb) | 0,453 592 37 kg | exact |
| livre-force (lbf) | 4,448 221 615 260 5 N | livre × 9,806 65 m/s² |
| psi | 6,894 757 kPa | livre-force par pouce carré |
| ksi · Msi | 6,894 757 MPa · 6,894 757 GPa | |
| atmosphère normale (atm) | 101,325 kPa | exact |
| bar | 100 kPa | exact |
| gallon US | 3,785 411 784 L | 231 po³, exact |
| once (oz) | 28,349 5 g | livre ÷ 16 |

Ces valeurs sont des valeurs de définition, écrites de mémoire et recoupées par des tests d'arithmétique ; le recueil
du NIST (SP 811, annexe B) n'a pas été relu — voir la ligne « Unités » du registre des sources ([SOURCES.md](SOURCES.md)).
