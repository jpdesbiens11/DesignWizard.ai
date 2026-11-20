# Validation des calculs — des exemples publiés, rejoués

> Ce fichier est écrit par `node tools/validation_doc.mjs` à partir des cas eux-mêmes (`web/js/analysis/validation_cases.js`,
> `web/js/analysis/validation_fea.js`) : ne pas le modifier à la main. Un test le tient à jour.

Demande de JP : « pour tous les modèles dans la simulation physique… des exemples de validation des équations qui sont référencées
par une source existante… qu'on est capable de reproduire des exemples simples pour chacun des modèles : analytique, thermique,
structural ».

## Le principe

Un **cas de référence** est un exemple chiffré que quelqu'un d'autre a publié — un manuel libre, une page d'ingénierie, des notes de
cours — avec ses données et son résultat imprimé. L'outil le rejoue avec son propre modèle et montre, côte à côte, ce que la source
imprime, ce que l'outil trouve, et l'écart. Les règles, tenues par `tests/node/validation.test.mjs` :

- **la valeur attendue est celle que la source imprime**, jamais une valeur recalculée ici avec la même formule ;
- une source n'est dite « page lue » que si sa page a été ouverte et ses nombres copiés tels qu'imprimés ;
- un cas est **rejoué fidèlement** : une donnée que le modèle a dû ramener dans sa plage fait échouer le cas ;
- la **tolérance suit les chiffres imprimés** : un résultat imprimé avec deux chiffres ne se retrouve pas à 0,1 % près ;
- un modèle **sans cas le dit**, et un modèle qui en a dit **ce qu'ils ne couvrent pas** : rien n'est tenu pour validé d'office.

D'une source, seuls **des nombres et la référence** sont repris : aucun texte, aucune figure. Un cas retrouvé dit que la formule est
bien écrite ; il ne dit pas qu'elle s'applique à une pièce donnée — le domaine de validité de chaque modèle reste ce qu'il est.

Trois façons de rejouer un exemple :

- **rejoué tel quel** — Les données de la source sont entrées, son résultat est comparé.
- **rejoué à l'envers** — La source cherche une donnée que le modèle demande : son résultat imprimé est entré, et c'est sa donnée imprimée qui est retrouvée.
- **coefficients comparés** — Les coefficients du modèle sont comparés à ceux d'une table publiée ; aucun exemple chiffré complet n'a été rejoué.

## Où cela se voit

- **Modèles analytiques** (`#/physics`) : une coche sur la tuile de chaque modèle recoupé ; sous le schéma, une pastille « n cas publiés
  retrouvés » ou « Sans cas de référence » ; dans l'onglet « Calcul », le groupe **Validation** — chaque cas avec sa source (lien, niveau
  de lecture, licence), ce que la source donne, puis une ligne par grandeur : la source, l'outil, l'écart, la tolérance. « Charger ce cas
  dans le modèle » met les données de la source dans les champs.
- **Simulation** (`#/fea`) : le groupe **Validation** du volet de droite, pour la physique du cas ouvert ; les cas se rejouent dans la
  page, sous le voile, en deux secondes au plus.
- **Aide** (`#/help/validation`) : le tableau d'ensemble, modèle par modèle.

## Où l'on en est

**18 des 24 modèles** ont au moins un exemple publié rejoué — 27 cas, dont 25 lus sur la page de leur source.
Sans cas : `junction_temperature`, `heatsink_natural`, `heatsink_forced`, `lumped_mass`, `pcb_trace`, `adiabatic_pulse`.

## Structure

### Cantilever · end load — Poutre encastrée, charge en bout (cantilever)

| Cas | Source | Grandeur | La source imprime | L'outil trouve | Écart | Tolérance |
|---|---|---|---|---|---|---|
| Poutre en I de 5 m encastrée, 3 kN en bout *(rejoué tel quel)* | [The Engineering ToolBox (2013), « Cantilever Beam Calculations: Formulas, Loads & Deflections »](https://www.engineeringtoolbox.com/cantilever-beams-d_1848.html) — exemple « Cantilever Beam with Single Load at the End, Metric Units » · page lue | Flèche maximale | 7.6 mm | 7,626 mm | +0,3 % | ± 1 % |
|  |  | Moment maximal | 1.5×10⁴ Nm | 15000 N·m | 0,0 % | ± 0,5 % |
|  |  | Contrainte de flexion | 27.4 MPa | 27,45 MPa | +0,2 % | ± 1 % |

- **Ce que ces cas ne couvrent pas** : La fréquence propre et le cisaillement ne sont pas comparés.

### Cantilever · distributed load — Poutre encastrée, charge répartie (cantilever)

| Cas | Source | Grandeur | La source imprime | L'outil trouve | Écart | Tolérance |
|---|---|---|---|---|---|---|
| Barreau rond de 1 in encastré, 100 lbf/in sur 10 in *(rejoué tel quel)* | [MechaniCalc, « Beam Analysis Validation »](https://mechanicalc.com/calculators/beam-analysis/validation) — cas « Cantilever Beam, Uniform Distributed Force » (valeurs attendues du calcul à la main) · page lue | Flèche maximale | 0.2572 in | 6,533 mm | 0,0 % | ± 0,5 % |
|  |  | Moment maximal | 5000 in-lbf | 564,9 N·m | 0,0 % | ± 0,5 % |

- **Ce que ces cas ne couvrent pas** : La contrainte, la fréquence propre et le cisaillement ne sont pas comparés.

### Two supports · center load — Poutre sur deux appuis, charge au centre

| Cas | Source | Grandeur | La source imprime | L'outil trouve | Écart | Tolérance |
|---|---|---|---|---|---|---|
| Poutre en I de 100 in sur deux appuis, 10 000 lb au centre *(rejoué tel quel)* | [The Engineering ToolBox (2009), « Beams Supported at Both Ends with Continuous and Point Loads: Stress, Deflection, Formulas and Calculators »](https://www.engineeringtoolbox.com/beam-stress-deflection-d_1312.html) — exemple « Beam with a Single Center Load » · page lue | Contrainte de flexion | 5482 psi | 37,8 MPa | 0,0 % | ± 0,5 % |
|  |  | Flèche maximale | 0.025 in | 0,6403 mm | +0,8 % | ± 3 % |

- **Ce que ces cas ne couvrent pas** : La fréquence propre et le cisaillement ne sont pas comparés.

### Two supports · distributed load — Poutre sur deux appuis, charge répartie

| Cas | Source | Grandeur | La source imprime | L'outil trouve | Écart | Tolérance |
|---|---|---|---|---|---|---|
| Poutre en I de 5 m sur deux appuis, 6 N/mm répartis *(rejoué tel quel)* | [The Engineering ToolBox (2009), « Beams Supported at Both Ends with Continuous and Point Loads: Stress, Deflection, Formulas and Calculators »](https://www.engineeringtoolbox.com/beam-stress-deflection-d_1312.html) — exemple « Beam with Uniform Load, Metric Units » · page lue | Contrainte de flexion | 34.3 MPa | 34,32 MPa | 0,0 % | ± 0,5 % |
|  |  | Flèche maximale | 2.98 mm | 2,979 mm | 0,0 % | ± 0,5 % |

- **Ce que ces cas ne couvrent pas** : La fréquence propre et le cisaillement ne sont pas comparés.

### Column buckling — Flambement d'une colonne (Euler / Johnson)

| Cas | Source | Grandeur | La source imprime | L'outil trouve | Écart | Tolérance |
|---|---|---|---|---|---|---|
| Colonne en I d'aluminium de 5 m, encastrée aux deux bouts *(rejoué tel quel)* | [The Engineering ToolBox (2012), « Euler Column Buckling: Formula, Theory & Calculator »](https://www.engineeringtoolbox.com/euler-column-formula-d_1813.html) — exemple « A Column Fixed in both Ends » · page lue | Charge critique | 262594 N = 263 kN | 262600 N | 0,0 % | ± 0,5 % |

- **Ce que ces cas ne couvrent pas** : La parabole de Johnson (colonnes peu élancées) n'a pas de cas ; les autres liaisons d'extrémité non plus.

### Shaft torsion — Torsion d'un arbre rond ou tubulaire

| Cas | Source | Grandeur | La source imprime | L'outil trouve | Écart | Tolérance |
|---|---|---|---|---|---|---|
| Arbre plein de 50 mm, 1000 N·m sur 1 m *(rejoué tel quel)* | [The Engineering ToolBox (2005), « Shafts Torsion »](https://www.engineeringtoolbox.com/torsion-shafts-d_947.html) — exemple « Shear Stress and Angular Deflection in a Solid Cylinder » · page lue | Cisaillement maximal | 40.8 MPa | 40,74 MPa | −0,1 % | ± 1 % |
|  |  | Angle de torsion | 1.2° (0.021 rad) | 1,182 ° | −1,5 % | ± 5 % |
| Arbre creux 50 × 30 mm, 1000 N·m sur 1 m *(rejoué tel quel)* | [The Engineering ToolBox (2005), « Shafts Torsion »](https://www.engineeringtoolbox.com/torsion-shafts-d_947.html) — exemple « Shear Stress and Angular Deflection in a Hollow Cylinder » · page lue | Cisaillement maximal | 46.8 MPa | 46,81 MPa | 0,0 % | ± 0,5 % |
|  |  | Angle de torsion | 1.4° (0.023 rad) | 1,358 ° | −3,0 % | ± 5 % |

- **Ce que ces cas ne couvrent pas** : La marge au cisaillement (0,577 Re) n'est pas comparée.

### Plate under pressure — Plaque rectangulaire sous pression uniforme

| Cas | Source | Grandeur | La source imprime | L'outil trouve | Écart | Tolérance |
|---|---|---|---|---|---|---|
| Plaque appuyée sur ses quatre bords, a / b = 1 *(coefficients comparés)* | [Engineers Edge, « Flat Rectangular Plate with All Edges Simply Supported »](https://engineersedge.com/calculators/flat_rectangular_plate_with_all_edges_simply_supported_15090.htm) — table des coefficients β et α selon a / b, donnée pour ν = 0,3 d'après Roark, 7ᵉ édition · table lue | Coefficient β | 0.2874 | 0,2874 | 0,0 % | ± 0,2 % |
|  |  | Coefficient α | 0.0444 | 0,0444 | 0,0 % | ± 0,2 % |
| Plaque appuyée sur ses quatre bords, a / b = 2 *(coefficients comparés)* | [Engineers Edge, « Flat Rectangular Plate with All Edges Simply Supported »](https://engineersedge.com/calculators/flat_rectangular_plate_with_all_edges_simply_supported_15090.htm) — table des coefficients β et α selon a / b, donnée pour ν = 0,3 d'après Roark, 7ᵉ édition · table lue | Coefficient β | 0.6102 | 0,6102 | 0,0 % | ± 0,2 % |
|  |  | Coefficient α | 0.1110 | 0,111 | 0,0 % | ± 0,2 % |
| Plaque très longue appuyée : coefficient de la contrainte *(coefficients comparés)* | [MIT OpenCourseWare, 2.082 Ship Structural Analysis & Design, notes 24 « Solution of Plate Bending Equation »](https://ocw.mit.edu/courses/2-082-ship-structural-analysis-design-13-122-spring-2003/fb7861b5166b983233284631dcfdafb2_notes_24_plate_bendin.pdf) — dernière page : « k in relation stress = k*p*(b/t)^2 », ν = 0,3 · page lue | Coefficient β | x simply supported -> 0.75, max in center | 0,75 | 0,0 % | ± 1 % |
| Plaque très longue encastrée : coefficient de la contrainte *(coefficients comparés)* | [MIT OpenCourseWare, 2.082 Ship Structural Analysis & Design, notes 24 « Solution of Plate Bending Equation »](https://ocw.mit.edu/courses/2-082-ship-structural-analysis-design-13-122-spring-2003/fb7861b5166b983233284631dcfdafb2_notes_24_plate_bendin.pdf) — dernière page : « k in relation stress = k*p*(b/t)^2 », ν = 0,3 · page lue | Coefficient β | x clamped -> 0.5 max at side mid long length | 0,5 | 0,0 % | ± 1 % |

- **Ce que ces cas ne couvrent pas** : Aucun exemple chiffré complet (dimensions et pression → contrainte et flèche) n'a été trouvé en lecture libre : seuls les coefficients sont recoupés, et ceux de la plaque encastrée seulement à l'élancement infini.

### Thermal mismatch — Dilatation différentielle de deux matériaux assemblés

| Cas | Source | Grandeur | La source imprime | L'outil trouve | Écart | Tolérance |
|---|---|---|---|---|---|---|
| Dalles de béton posées sans jeu, de 5 °C à 38 °C *(rejoué tel quel)* | [OpenStax, University Physics, Volume 2](https://openstax.org/books/university-physics-volume-2/pages/1-3-thermal-expansion) — § 1.3, Example 1.4 · page lue | Contrainte dans 1 si totalement bridé | 7.9 × 10⁶ N/m² | 7,92 MPa | +0,3 % | ± 2 % |

- **Ce que ces cas ne couvrent pas** : Le partage de l'effort entre deux matériaux de raideurs différentes et le jeu aux fixations n'ont pas de cas.

## Assemblages

### Bolted joint — Assemblage vissé métrique (couple → précharge)

| Cas | Source | Grandeur | La source imprime | L'outil trouve | Écart | Tolérance |
|---|---|---|---|---|---|---|
| Vis M30 classe 8.8 serrée à sa charge d'épreuve *(rejoué à l'envers)* | [The Engineering ToolBox (2018), « Bolt Torque Calculator: Loads & Preloads Data and Calculator »](https://www.engineeringtoolbox.com/bolt-torque-load-calculator-d_2065.html) — exemple « Required torque for tightening a Metric bolt to proof load » · page lue | Précharge par vis | 337000 N | 337000 N | 0,0 % | ± 0,2 % |

- **Ce que ces cas ne couvrent pas** : Seule la relation couple → précharge est comparée : la raideur des pièces, le décollement, le glissement et l'arrachement du taraudage n'ont pas de cas.

### Press fit — Emmanchement serré d'un moyeu sur un arbre (Lamé)

| Cas | Source | Grandeur | La source imprime | L'outil trouve | Écart | Tolérance |
|---|---|---|---|---|---|---|
| Deux tubes d'acier frettés, 0,01 mm de serrage au rayon *(rejoué tel quel)* | [Université de Bassorah, génie mécanique, notes de cours « Mechanics of Materials — Chapter Ten : Thick Cylinders »](https://faculty.uobasrah.edu.iq/uploads/teaching/1632208077.pdf) — Example 10.4, p. 89-90 · page lue | Pression de contact | 9.74 MN/m² | 9,75 MPa | +0,1 % | ± 0,5 % |

- **Ce que ces cas ne couvrent pas** : Le couple et l'effort transmissibles (frottement) et les contraintes de von Mises ne sont pas comparés.

### Dowel pin · shear — Goupille ou pion de centrage en cisaillement

| Cas | Source | Grandeur | La source imprime | L'outil trouve | Écart | Tolérance |
|---|---|---|---|---|---|---|
| Goupille de 12 mm d'un assemblage à recouvrement, 20 kN *(rejoué tel quel)* | [Jönköping University, « Applied Mechanics » (M. Cenanovic)](https://mechanics.ju.se/SolidMechanics/ShearStress.html) — § 8.4 Shear stress, Example 2 · page lue | Cisaillement moyen | 176.8 MPa | 176,8 MPa | 0,0 % | ± 0,2 % |
| Axe en double cisaillement, 200 lb *(rejoué à l'envers)* | [Engineering LibreTexts, « Strength of Materials » (Lord, Richardson, Davison, Dillard)](https://eng.libretexts.org/Bookshelves/Mechanical_Engineering/Strength_of_Materials/02%3A_Stress) — chap. 2 Stress, Example 2.4 · page lue | Cisaillement moyen | 3 ksi | 20,69 MPa | 0,0 % | ± 1 % |

- **Ce que ces cas ne couvrent pas** : Le matage des pièces n'est pas comparé.

## Fluides

### Tube · pressure loss — Écoulement dans un tube rond (Hagen-Poiseuille / Darcy-Weisbach)

| Cas | Source | Grandeur | La source imprime | L'outil trouve | Écart | Tolérance |
|---|---|---|---|---|---|---|
| Aiguille de 0,30 mm : solution saline à 0,120 cm³/s *(rejoué tel quel)* | [OpenStax, College Physics 2e](https://openstax.org/books/college-physics-2e/pages/12-4-viscosity-and-laminar-flow-poiseuilles-law) — § 12.4, Example 12.8 · page lue | Perte de charge | P₂ − P₁ = 1.62 × 10⁴ − 1.066 × 10³ N/m² | 15090 Pa | −0,3 % | ± 1 % |
| Conduit d'air de 18 cm et de 20 m, écoulement laminaire *(rejoué à l'envers)* | [OpenStax, University Physics, Volume 1](https://openstax.org/books/university-physics-volume-1/pages/14-7-viscosity-and-turbulence) — § 14.7, Examples 14.8 et 14.9 · page lue | Perte de charge | 0.054 Pa | 0,05395 Pa | −0,1 % | ± 1 % |
|  |  | Nombre de Reynolds | 1835 | 1846 | +0,6 % | ± 2 % |

- **Ce que ces cas ne couvrent pas** : Le régime turbulent (Blasius, Swamee-Jain) n'a pas de cas : l'exemple publié trouvé donne le coefficient de frottement, que le modèle calcule lui-même.

### Calibrated orifice — Orifice ou restriction (coefficient de décharge Cd)

| Cas | Source | Grandeur | La source imprime | L'outil trouve | Écart | Tolérance |
|---|---|---|---|---|---|---|
| Lance d'arrosage : de 18 mm à 5 mm, 0,500 L/s *(rejoué tel quel)* | [OpenStax, College Physics 2e](https://openstax.org/books/college-physics-2e/pages/12-2-bernoullis-equation) — § 12.1, Example 12.2 et § 12.2, Example 12.4 · page lue | Vitesse dans l'orifice | 25.5 m/s | 25,46 m/s | −0,1 % | ± 0,5 % |
|  |  | Perte de charge | P₁ − P₂ = 4.24 × 10⁵ − 1.01 × 10⁵ N/m² | 322300 Pa | −0,2 % | ± 1 % |
| Diaphragme de 50 mm dans un tube de 102 mm, 20 kPa *(rejoué tel quel)* | [The Engineering ToolBox (2004), « Orifice, Nozzle, and Venturi Flow Meters: Principles, Calculations & Data »](https://www.engineeringtoolbox.com/orifice-nozzle-venturi-d_590.html) — exemple « Orifice Flow » · page lue | Débit à la perte de charge admissible | 7.7 kg/s (462 L/min d'eau) | 460,6 L/min | −0,3 % | ± 2 % |

- **Ce que ces cas ne couvrent pas** : La variation de Cd avec le nombre de Reynolds et les gaz n'ont pas de cas.

## Thermique

### Wall · conduction — Conduction 1-D à travers une paroi ou un empilement

| Cas | Source | Grandeur | La source imprime | L'outil trouve | Écart | Tolérance |
|---|---|---|---|---|---|---|
| Fond de casserole en aluminium de 8 mm, 2256 W *(rejoué tel quel)* | [OpenStax, College Physics 2e](https://openstax.org/books/college-physics-2e/pages/14-5-conduction) — § 14.5, Example 14.6 · page lue | Écart de température | 5.33 °C | 5,327 K | −0,1 % | ± 0,5 % |
| Barreau d'acier et barreau d'aluminium bout à bout, de 100 °C à 20 °C *(rejoué à l'envers)* | [OpenStax, University Physics, Volume 2](https://openstax.org/books/university-physics-volume-2/pages/1-6-mechanisms-of-heat-transfer) — § 1.6, Example 1.11 · page lue | Écart de température | 100 °C − 20 °C | 79,8 K | −0,3 % | ± 1 % |

- **Ce que ces cas ne couvrent pas** : L'interface thermique (TIM) et la résistance de contact n'ont pas de cas.

### Junction temperature — Température de jonction d'un composant (chaîne Rjc + Rcs + Rsa)

**Aucun cas.** Aucun exemple publié n'a encore été rejoué. La chaîne de résistances est une simple somme ; elle n'est pas validée ici.

### Fins · natural convection — Dissipateur à ailettes en convection naturelle

**Aucun cas.** Aucun exemple publié d'un dissipateur complet en convection naturelle n'a été trouvé en lecture libre. Le modèle enchaîne plusieurs corrélations (Churchill-Chu, Bar-Cohen & Rohsenow, ailettes) dont aucune n'a été recoupée ici.

### Fins · forced convection — Dissipateur à ailettes en convection forcée

**Aucun cas.** Aucun exemple publié d'un dissipateur complet en convection forcée n'a été trouvé en lecture libre. Les corrélations de la plaque plane et le rendement d'ailette ne sont pas recoupés ici.

### Thermal mass — Masse thermique : constante de temps et échauffement

**Aucun cas.** Aucun exemple publié n'a encore été rejoué.

## Électrique

### Busbar — Barre conductrice (busbar) : résistance, chute de tension, échauffement

| Cas | Source | Grandeur | La source imprime | L'outil trouve | Écart | Tolérance |
|---|---|---|---|---|---|---|
| Fil de cuivre de 3,31 mm² et de 5 m *(rejoué tel quel)* | [OpenStax, University Physics, Volume 2](https://openstax.org/books/university-physics-volume-2/pages/9-3-resistivity-and-resistance) — § 9.3, Example 9.5 · page lue | Résistance à 20 °C | 0.025 Ω | 25380 µΩ | +1,5 % | ± 3 % |
|  |  | Densité de courant | 3.02 × 10³ A/m² | 0,003021 A/mm² | 0,0 % | ± 0,5 % |

- **Ce que ces cas ne couvrent pas** : L'échauffement (convection, rayonnement, résistance à chaud) n'a pas de cas : seules la résistance à 20 °C et la densité de courant sont comparées.

### PCB trace — Piste de PCB : courant admissible (IPC-2221)

**Aucun cas.** La norme IPC-2221 n'est pas en lecture libre, et aucun exemple publié n'a encore été rejoué.

### Current pulse — Échauffement adiabatique de courte durée (I²t, Onderdonk)

**Aucun cas.** Aucun exemple publié n'a encore été rejoué.

## Simulation

Le solveur lui-même, sur un petit maillage de cubes construit pour l'exemple. L'écart d'une simulation est aussi celui de son maillage :
chaque cas dit le sien.

### Structure — Simulation — structure

| Cas | Source | Grandeur | La source imprime | L'outil trouve | Écart | Tolérance |
|---|---|---|---|---|---|---|
| Tige d'acier de 2 m qui porte 550 kg *(rejoué tel quel)* | [OpenStax, University Physics, Volume 1](https://openstax.org/books/university-physics-volume-1/pages/12-3-stress-strain-and-elastic-modulus) — § 12.3, Example 12.8 · page lue | Contrainte de traction | 1.8 × 10⁸ Pa | 179,7 MPa | −0,2 % | ± 3 % |
|  |  | Allongement | 1.8 mm | 1,797 mm | −0,2 % | ± 3 % |
| Barreau rond de 1 in encastré, 100 lbf/in sur 10 in *(rejoué tel quel)* | [MechaniCalc, « Beam Analysis Validation »](https://mechanicalc.com/calculators/beam-analysis/validation) — cas « Cantilever Beam, Uniform Distributed Force » (valeur attendue du calcul à la main) · page lue | Flèche en bout | 0.2572 in | 6,213 mm | −4,9 % | ± 8 % |

- *Tige d'acier de 2 m qui porte 550 kg* — maillage : Tige carrée de même section (5,477 mm de côté, 30,0 mm²), une maille dans la section : 365 mailles. Un bout tenu dans l'axe, l'autre tiré ; la section reste libre de se contracter.
- *Barreau rond de 1 in encastré, 100 lbf/in sur 10 in* — maillage : Barreau rond de 25,4 mm, 10 mailles dans le diamètre (2,54 mm) : 8000 mailles. La charge répartie est appliquée comme un poids propre de 1000 lbf. Une section ronde est dessinée en escalier par les mailles cubiques, et l'écart vient surtout de là : mesuré ici, −23 % avec 6 mailles dans le diamètre, −8 % avec 8, −5 % avec 10, +1 % avec 12.
- **Ce que ces cas ne couvrent pas** : La flexion n'est rejouée que sur une section ronde, que les mailles cubiques dessinent en escalier ; aucune plaque, aucune concentration de contrainte, aucun assemblage de plusieurs pièces n'a de cas publié rejoué. Les essais du solveur contre les formules (traction, flexion, plaque, bilame) sont dans tests/node/fea.test.mjs — ce sont des recoupements internes, pas des cas publiés.

### Thermique — Simulation — thermique

| Cas | Source | Grandeur | La source imprime | L'outil trouve | Écart | Tolérance |
|---|---|---|---|---|---|---|
| Barreau d'acier et barreau d'aluminium bout à bout, de 100 °C à 20 °C *(rejoué tel quel)* | [OpenStax, University Physics, Volume 2](https://openstax.org/books/university-physics-volume-2/pages/1-6-mechanisms-of-heat-transfer) — § 1.6, Example 1.11 · page lue | Température au joint | 41.3 °C | 41,33 °C | +0,1 % | ± 0,5 % |
|  |  | Flux de chaleur | 1.47 W | 1,47 W | 0,0 % | ± 1 % |

- *Barreau d'acier et barreau d'aluminium bout à bout, de 100 °C à 20 °C* — maillage : Deux barreaux carrés de même aire à 0,3 % près (8,85 mm de côté, 78,3 mm²), mailles de 2,21 mm : 3616 mailles. La section ronde de la source ne change rien à une conduction dans une seule direction.
- **Ce que ces cas ne couvrent pas** : La convection n'a pas de cas publié rejoué ; la conduction est rejouée dans une seule direction.

### Thermo-mécanique — Simulation — thermo-mécanique

| Cas | Source | Grandeur | La source imprime | L'outil trouve | Écart | Tolérance |
|---|---|---|---|---|---|---|
| Dalles de béton posées sans jeu, de 5 °C à 38 °C *(rejoué tel quel)* | [OpenStax, University Physics, Volume 2](https://openstax.org/books/university-physics-volume-2/pages/1-3-thermal-expansion) — § 1.3, Example 1.4 · page lue | Contrainte de compression | 7.9 × 10⁶ N/m² | 7,92 MPa | +0,3 % | ± 2 % |

- *Dalles de béton posées sans jeu, de 5 °C à 38 °C* — maillage : Un bloc de 1000 × 200 × 200 mm, mailles de 100 mm : 40 mailles. Les deux bouts sont tenus dans l'axe, les côtés restent libres ; la source ne donne pas de dimensions, et la contrainte n'en dépend pas.
- **Ce que ces cas ne couvrent pas** : La dilatation libre et le bilame n'ont pas de cas publié rejoué (le solveur les recoupe contre les formules dans ses essais).

## Les sources et leurs licences

| Source | Lecture | Licence dite par la source |
|---|---|---|
| [The Engineering ToolBox (2013), « Cantilever Beam Calculations: Formulas, Loads & Deflections »](https://www.engineeringtoolbox.com/) | page lue | page publique, citée comme elle le demande |
| [MechaniCalc, « Beam Analysis Validation »](https://mechanicalc.com/calculators/beam-analysis/) | page lue | © MechaniCalc, Inc. — nombres cités avec la référence |
| [The Engineering ToolBox (2009), « Beams Supported at Both Ends with Continuous and Point Loads: Stress, Deflection, Formulas and Calculators »](https://www.engineeringtoolbox.com/) | page lue | page publique, citée comme elle le demande |
| [The Engineering ToolBox (2012), « Euler Column Buckling: Formula, Theory & Calculator »](https://www.engineeringtoolbox.com/) | page lue | page publique, citée comme elle le demande |
| [The Engineering ToolBox (2005), « Shafts Torsion »](https://www.engineeringtoolbox.com/) | page lue | page publique, citée comme elle le demande |
| [Engineers Edge, « Flat Rectangular Plate with All Edges Simply Supported »](https://engineersedge.com/calculators/) | table lue | © Engineers Edge, LLC — coefficients cités avec la référence |
| [MIT OpenCourseWare, 2.082 Ship Structural Analysis & Design, notes 24 « Solution of Plate Bending Equation »](https://ocw.mit.edu/courses/2-082-ship-structural-analysis-design-13-122-spring-2003/) | page lue | MIT OpenCourseWare |
| [OpenStax, University Physics, Volume 2](https://openstax.org/books/university-physics-volume-2/pages/) | page lue | CC BY-NC-SA 4.0 |
| [The Engineering ToolBox (2018), « Bolt Torque Calculator: Loads & Preloads Data and Calculator »](https://www.engineeringtoolbox.com/) | page lue | page publique, citée comme elle le demande |
| [Université de Bassorah, génie mécanique, notes de cours « Mechanics of Materials — Chapter Ten : Thick Cylinders »](https://faculty.uobasrah.edu.iq/uploads/teaching/) | page lue | notes de cours publiques, sans licence dite |
| [Jönköping University, « Applied Mechanics » (M. Cenanovic)](https://mechanics.ju.se/SolidMechanics/) | page lue | CC BY 4.0 |
| [Engineering LibreTexts, « Strength of Materials » (Lord, Richardson, Davison, Dillard)](https://eng.libretexts.org/Bookshelves/Mechanical_Engineering/Strength_of_Materials/) | page lue | CC BY-NC-SA 4.0 |
| [OpenStax, College Physics 2e](https://openstax.org/books/college-physics-2e/pages/) | page lue | CC BY-NC-SA 4.0 |
| [OpenStax, University Physics, Volume 1](https://openstax.org/books/university-physics-volume-1/pages/) | page lue | CC BY-NC-SA 4.0 |
| [The Engineering ToolBox (2004), « Orifice, Nozzle, and Venturi Flow Meters: Principles, Calculations & Data »](https://www.engineeringtoolbox.com/) | page lue | page publique, citée comme elle le demande |

Les pages ont été ouvertes le 20 novembre 2026. Les ouvrages d'OpenStax sont sous CC BY-NC-SA 4.0 et demandent que leur contenu ne soit
pas versé dans un modèle de langage : rien n'en est repris ici que des nombres d'exemples et leur référence, cités comme on cite un
ouvrage. Si cet usage devait gêner, les cas qui s'y appuient se retirent sans rien casser — leur modèle dirait alors qu'il n'a pas de cas.

Les exemples en unités impériales sont convertis : 1 in = 25,4 mm ; 1 lbf = 4,448 222 N ; 1 psi = 6,894 757 kPa.

## Ajouter un cas

1. Trouver un exemple **publié** qui imprime ses données et son résultat ; ouvrir la page et les relire.
2. L'écrire dans `validation_cases.js` (ou `validation_fea.js` pour le solveur) : `source` (nom, endroit, adresse, niveau de lecture,
   licence), `given` (ce que la source donne, tel qu'imprimé), `inputs` (les mêmes, dans les unités du modèle), `expect` (`value`,
   `printed`, `tol`), et `free` pour ce que la source ne donne pas et qui ne change rien.
3. Retirer le modèle de `NONE`, dire dans `GAPS` ce que le cas ne couvre pas.
4. `node tools/validation_doc.mjs`, puis les tests.

## Ce qui n'est pas fait

- 6 modèles n'ont aucun cas (voir plus haut) ; la plaque n'est recoupée que par ses coefficients.
- Aucun cas ne vient d'un **essai** : ce sont des exemples de manuels, résolus par leurs auteurs avec les mêmes théories.
- Les sources sont des pages publiques ; les manuels cités par les modèles (Roark, Shigley, Incropera, White) n'ont pas été ouverts.
- La simulation n'a que quatre cas, tous sur des barreaux : voir `docs/SIMULATION.md` pour ses recoupements internes.
