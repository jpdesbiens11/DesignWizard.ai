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
- Dans le **menu du compte** (barre du haut), sous la taille de l'affichage : le même choix, pour toute la plateforme.

Le choix est gardé dans le navigateur ; il n'est pas écrit dans le projet, qui se lit donc de la même façon chez un
collègue qui a choisi l'autre système.

## Ce qui suit le choix aujourd'hui

Les modèles analytiques, en entier : les champs d'entrée (valeur, unité, bornes), les résultats, les vérifications et
leurs limites, les étiquettes du modèle en 3D, les lignes des calculs gardés et celles du rapport de revue.

Ce qui ne le suit pas encore : le **calcul détaillé** d'un modèle (il s'écrit en SI, comme dans sa source — l'écran le
dit), la fiche texte d'un calcul rangée dans Drive, et **le reste de la plateforme** — cotes de la CAO, dessins, DFx,
simulation, isolation, gammes — qui reste en millimètres et en SI.

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
