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
| **Busbar, circuit flexible** | La ligne d'état (section, longueurs, masse) |
| **Dessins** | Les **cotes** — en pouces, trois décimales, sans zéro avant le point (`.472`, `6.299`), comme ASME Y14.5 écrit une cote en pouces —, les tolérances géométriques, le tableau des trous, la note 1 (« dimensions in inches, converted from the millimetre model »), la case Units et la masse du cartouche (« 111.1 g (3.92 oz) »), l'arbre des cotes de l'écran |

**Comment.** Trois outils, tous dans `core/units.js` (purs, testés) et repris par `core/dom.js` :

- `measure`, `measures`, `massText` (`fmtLen`, `fmtDims`, `fmtMass` côté écran) pour une valeur que le code écrit lui-même :
  les décimales de l'outil en SI, **quatre chiffres significatifs** quand la valeur est convertie ;
- `fieldValue` / `fromShown` pour un champ : ce qui est tapé revient en millimètres, sans poussière de virgule flottante ;
- `proseUnits` (`inUnits`) pour une **phrase** écrite en millimètres par un outil : chaque quantité est convertie là où
  elle se trouve, à trois chiffres significatifs — « de 0,2 à 0,4 mm », « 160 × 110 × 42 mm », « 1 250 N » —, une masse
  reçoit sa lecture impériale entre parenthèses, et ce qui n'est pas une quantité ne bouge pas (« M3 × 0,5 », « 1,5 d »,
  « ISO 2768-mK », « 3 A/mm² »).

Sur un dessin, les **clés des cotes restent en millimètres** : la classe (SC, CSC, référence) donnée à une cote tient
quel que soit le système. Le modèle, lui, ne change jamais d'unité.

## Ce qui reste en millimètres et en SI

- **Les champs des autres écrans** : busbar, circuit flexible, étiquettes, isolation, simulation (efforts, pressions),
  carte électronique, éditeur d'une interface dans la pièce, panneaux du mold et de l'extrusion. On y tape encore des
  millimètres, et leurs libellés le disent.
- **Leurs phrases** : isolation (les distances des normes sont en millimètres), simulation, carte, plan du mold,
  bibliothèque, infobulles, écran du rapport de revue.
- **Les documents exportés** : rapports PDF et Word, gammes, CSV, classeur et note de calcul (unités du modèle). Les
  fichiers d'échange — STEP, STL, DXF, Gerber, perçage, `.dwiz` — sont en millimètres par nature, et le restent.
- **Sur un dessin en pouces** : la tolérance générale reste « ISO 2768-mK » (des classes définies en millimètres) ; le
  DXF du développé d'une tôle reste en millimètres ; les notes tapées dans la pièce restent telles qu'écrites.
- Le **calcul détaillé** d'un modèle analytique (il s'écrit en SI, comme dans sa source — l'écran le dit) et la fiche
  texte d'un calcul rangée dans Drive.
- Une valeur convertie est **arrondie pour être lue** (quatre chiffres significatifs, trois dans une phrase, trois
  décimales sur un dessin) : la valeur exacte est celle du projet, en millimètres.

## Les facteurs

| Unité | Vaut | |
|---|---|---|
| pouce (in) | 25,4 mm | exact |
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
