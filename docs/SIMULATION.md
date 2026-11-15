# Simulation — des éléments finis volontairement simples

La brique **Simulation** (onglet Physique → Simulation) calcule en quelques secondes les déformations, les contraintes
ou les températures d'une pièce ou d'un assemblage — et, en **thermo-mécanique**, ce que la température fait à une
pièce tenue. Elle vise **80 % de la réalité ou mieux**, pas la dernière
décimale : assez pour décider de commander le prototype, pas pour signer une note de calcul.

Elle ne remplace pas le calcul à la main ; elle le suit. L'écran écrit d'abord **l'estimation analytique** du modèle
simple équivalent, puis lance la simulation, puis compare les deux.

## 1. La démarche, dans l'ordre de l'écran

1. **Avant de calculer — l'estimation à la main.** Dès que les appuis et les efforts sont posés, l'écran reconnaît le
   modèle simple équivalent et écrit le calcul pas à pas, comme un analyste le ferait dans un tableur :
   - structure : **poutre encastrée chargée en bout** (σ = M c / I, δ = F L³ / 3 E I) ou **barre en
     traction-compression** (σ = F / A, δ = F L / E A). La portée L est lue entre l'appui et le point d'application ;
     la section — aire, moments quadratiques, fibre la plus éloignée — est **la section réelle**, lue sur le maillage
     au droit de l'appui ;
   - thermique : **conduction 1-D** vers une face tenue en température (ΔT = P L / k A), ou **bilan global de
     convection** (T = T∞ + P / h A) avec le **nombre de Biot**, qui dit si la pièce est quasi isotherme — auquel cas
     le bilan à la main suffit presque ;
   - thermo-mécanique : la **dilatation libre** (δ = α ΔT L), la **borne de bridage** (σ = E α ΔT si la dilatation
     est totalement empêchée dans une direction, E α ΔT / (1 − ν) dans deux), la contrainte due au seul **écart de
     température interne** (σ ≈ E α ΔT / 2 (1 − ν)) et, entre matériaux différents collés, le **bilame de
     Timoshenko** : contrainte à la jonction (σ ≈ E Δα ΔT / 2) et courbure de l'empilage (κ ≤ 3 Δα ΔT / 2 t).
2. **La simulation.** Un clic ; le solveur tourne à côté de la page, qui reste utilisable.
3. **Le recoupement.** Un tableau « à la main / simulation / écart » et un verdict :
   - écart de 20 % ou moins : **concordant**, le résultat est crédible ;
   - jusqu'à 50 % : **écart notable**, regarder où la simulation concentre la contrainte ;
   - au-delà : **discordant**, ne retenir ni l'un ni l'autre avant d'avoir compris pourquoi.

Une simulation gardée (« Ajouter au rapport ») entre dans le rapport de revue avec son estimation, son résultat et
son écart.

Trois précisions qui comptent :

- **Une borne se lit comme une borne.** En thermo-mécanique, E α ΔT / (1 − ν) est le maximum possible **au cœur de
  la pièce**, loin des appuis : la simulation doit rester dessous, et le rapport contrainte au cœur / borne donne le
  **taux de bridage** réel de la pièce. Une pièce tenue d'un seul côté doit, elle, se dilater de α ΔT L à 20 % près.
- **Près d'un appui qui bloque la dilatation, la contrainte dépasse cette borne** : l'effort de bridage de toute la
  pièce passe par quelques vis. L'écran l'affiche à part, avec la pointe, et rappelle le remède : un trou de passage
  ou un appui glissant.
- **Plusieurs matériaux : une fourchette.** Le déplacement attendu va de la dilatation du matériau le plus stable à
  celle du matériau qui se dilate le plus, augmentée de la flèche du bilame le plus défavorable (κ L² / 2, avec
  l'épaisseur moyenne de matière de l'empilage). La simulation **colle** les pièces : l'effet bilame y est entier,
  alors que des pièces vissées glissent un peu — la courbure réelle est plus faible.

- **Une fourchette quand les appuis sont vissés.** Une pièce tenue par des vis de part et d'autre de l'effort est une
  poutre sur deux appuis, quelque part entre l'appui simple et l'encastrement : l'estimation donne les deux bornes, et
  la simulation doit tomber entre elles.
- **La contrainte nominale, pas la pointe.** Sous une vis ou au bord d'un encastrement, la contrainte calculée est une
  pointe locale qui dépend du maillage ; un calcul à la main ne la prédit pas. Le recoupement compare donc la
  contrainte **hors zones d'appui** (à deux cubes de distance). La pointe reste affichée, avec sa marge.

### À la souris, sur la pièce

- **Choisir une face** : chaque appui et chaque effort se choisit dans la liste — la région s'allume quand on survole
  sa ligne — ou **à la souris** : le bouton cible, puis un clic sur la face (ou l'interface) dans la vue. La face
  s'allume en bleu sous le curseur, puis en vert quand elle est choisie.
- **Symboles** : des cônes bleus là où la pièce est tenue ; des flèches rouges pour une force, dans son sens, avec sa
  valeur ; des flèches orange pour une pression ; des losanges pour la chaleur et les températures imposées.
- **Échelle des couleurs** : son bas et son haut se règlent au curseur ou au clavier, la vue suit en direct. Ce qui
  dépasse l'échelle passe en magenta, ce qui est dessous en gris — pour voir d'un coup d'œil où l'on dépasse une
  limite. « Auto » revient à l'échelle qui couvre tout le résultat.
- **Coupe** : comme dans toutes les vues 3D, un bouton inverse le côté coupé (Maj + S).

### Le cas de charge est un arbre

Dans le panneau de gauche, le cas de charge se lit comme l'arbre d'un outil de calcul, par type :

| Type | Numéro | Couleur | Symbole sur le modèle |
|---|---|---|---|
| Appuis (encastrement) | A1, A2… | bleu | cônes |
| Efforts — force | E1, E2… | rouge | flèches dans le sens de la force |
| Efforts — pression | E… | orange | flèches normales à la face |
| Sources de chaleur | Q1… | orange vif | losanges |
| Températures imposées | T1… | cyan | losanges |

- Un **clic sur une ligne** la sélectionne : sa face s'allume sur le modèle dans la couleur de son type, ses valeurs
  s'ouvrent sous la ligne (« Choisir dans la vue » pour pointer la face à la souris ; la liste des régions reste là pour
  une interface difficile à cliquer).
- L'**œil d'un type** affiche ou masque ses étiquettes sur le modèle (`A1`, `E1 · 100 N −Z`…). L'élément sélectionné
  garde toujours la sienne. Un clic sur une étiquette du modèle sélectionne sa ligne.
- **+** ajoute un élément du type et attend le clic d'une face ; un clic droit sur une face du modèle fait de même.

Le modèle de l'arbre est pur (`web/js/analysis/fea/bc_tree.js` : `bcTree`, `bcLabels`, `BC_COLORS`) ; le panneau le
dessine (`web/js/modules/fea_tree.js`).

## 2. Le maillage : un seul gabarit, le cube

La pièce est découpée en **cubes identiques** : une grille régulière posée sur son enveloppe, dont on garde les
cubes dont le centre est dans la matière. La finesse se règle par un seul curseur (environ 500 à 16 000 cubes).

- C'est robuste : aucun mailleur à régler, aucune géométrie qui « ne maille pas ».
- C'est rapide : tous les éléments étant identiques, leur matrice se calcule **une fois** par matériau.
- C'est grossier, et assumé : un détail plus petit qu'un cube (petit trou, congé, chanfrein) disparaît ; une surface
  courbe devient un escalier.

Dans un assemblage, les corps qui se touchent partagent leurs nœuds : les contacts sont **collés** en structure et
**parfaits** en thermique. Chaque corps garde son matériau. Un corps que le maillage grossier ne relie à aucune
pièce tenue (un petit composant, par exemple) est **laissé de côté**, et l'écran dit lesquels.

## 3. Les éléments et le solveur

| | Structure | Thermique |
|---|---|---|
| Élément | hexaèdre à 8 nœuds **à modes incompatibles** (Wilson, Taylor) | hexaèdre à 8 nœuds trilinéaire |
| Inconnues | 3 déplacements par nœud | 1 température par nœud |
| Pourquoi | l'hexaèdre ordinaire est beaucoup trop raide en flexion ; les modes incompatibles rendent la flexion juste **même avec un seul élément dans l'épaisseur** | suffisant pour la conduction |
| Conditions aux frontières | encastrement, ou appui par direction ; force répartie sur une région ; pression sur une face ; **champ de température** (dilatation α (T − T de montage)) | température imposée ; puissance sur une région ; convection (h, T∞) sur les faces exposées |
| Résultat | déplacements, contrainte de von Mises aux nœuds, réaction d'appui | températures, bilan de puissance |

Le système est résolu par un **gradient conjugué préconditionné** (diagonale), sans jamais assembler la matrice :
le produit se fait élément par élément. Tout le code — maillage, éléments, solveur — est dans ce dépôt
(`web/js/analysis/fea/`), sous licence MIT, sans bibliothèque externe.

Les régions des conditions aux frontières sont des **faces de l'enveloppe** ou des **interfaces** de la pièce : on
tient une pièce par là où elle se fixe, on la charge par là où elle reçoit l'effort.

## 4. Symétries et coupes : résoudre une partie au lieu du tout

Un produit identique des deux côtés d'un plan, **tenu et chargé de même**, se résout sur un seul côté : rien ne
traverse ce plan. Un demi, un quart ou un huitième des cubes donne la même réponse — ou des cubes plus fins pour le
même temps de calcul. C'est le premier geste d'un analyste ; l'écran le fait avec lui.

**Trouver les plans.** La section « Symétries et coupes » du volet de gauche lit le maillage : pour chaque axe, elle
compare chaque cube à son vis-à-vis de l'autre côté du plan milieu (matière et matériau). Elle dit aussi si **le
chargement** est symétrique : chaque appui, chaque effort, chaque source doit être sa propre image ou avoir son jumeau
de l'autre côté ; un effort qui pousse *à travers* le plan est antisymétrique, et l'écran le dit. Deux réponses « oui » :
le bouton **« Utiliser »** coupe le modèle. Un seul « oui » : « Forcer », en connaissance de cause.

**Couper où l'on veut.** Le bouton « + », ou un clic droit sur la pièce (« Couper le modèle ici »), pose un plan à
l'endroit choisi pour **isoler une zone**. Chaque plan se règle : son axe, sa position, le côté gardé, et ce que le
plan porte :

| Condition sur le plan | Structure | Thermique |
|---|---|---|
| **Symétrie** | aucun déplacement à travers le plan, glissement libre dans le plan | aucune chaleur ne traverse |
| **Tenu** | le plan est encastré : ce que l'on a retiré est rigide | — |
| **Libre** | rien de l'autre côté | aucune chaleur ne traverse |
| **Température** | — | le plan est à la température donnée |

**Ce que le calcul fait de la coupe** (`web/js/analysis/fea/symmetry.js`) :

- le maillage place un de ses plans **exactement** sur chaque coupe, et le budget de cubes est dépensé sur ce qui
  est gardé : au même réglage de finesse, un quart de modèle a des cubes plus petits ;
- les appuis, les efforts et les sources gardent le sens qu'ils ont **sur le produit entier** : une force de 100 N sur
  une face que le plan partage en deux vaut 50 N sur le demi-modèle ; un nœud du plan porte la moitié de sa part (le
  quart sur l'arête où deux plans se croisent) ; ce qui est entièrement du côté retiré est porté par son jumeau ;
- la **face de coupe est à l'intérieur du produit** : ni convection, ni pression dessus ;
- l'estimation à la main reste faite **sur le produit entier** : une coupe change le coût, pas la réponse ;
- le rapport dit quelle part du produit a été résolue, et avec quelles conditions.

La vue montre ce qui est résolu : on voit l'intérieur du produit par la face de coupe, et les symboles ne sont
dessinés que sur le côté gardé.

## 5. Ce qui est vérifié

Les tests (`tests/node/fea.test.mjs`, `tests/node/fea_precheck.test.mjs`) comparent le solveur à des solutions
exactes :

| Cas | Simulation | Solution exacte | Écart |
|---|---|---|---|
| Poutre encastrée acier 100 × 10 × 10 mm, 100 N en bout, 2 × 2 cubes dans la section — flèche | 0,1894 mm | 0,1920 mm | −1,3 % |
| Même poutre, **un seul cube dans l'épaisseur** — flèche | 0,1892 mm | 0,1920 mm | −1,5 % |
| Même poutre — contrainte de flexion à mi-portée | 30,0 MPa | 30 MPa | +0,1 % |
| Barre en traction — contrainte et allongement | — | F / A, F L / E A | moins de 3 % |
| Plaque carrée encastrée sous pression, un cube d'épaisseur — flèche au centre | 0,00546 mm | 0,00524 mm | +4 % |
| Même plaque — contrainte au bord de l'encastrement (pointe) | 8,9 MPa | 10,9 MPa | −19 % |
| Barre en conduction, 10 W, une face à 20 °C — température de l'autre face | 70,4 °C | 70 °C | +0,5 % |
| Bloc refroidi par convection — température moyenne | 129,2 °C | 129,2 °C | 0 |
| Deux matériaux en série — températures d'interface et de bout | — | résistances en série | moins de 2 % |
| Bloc libre chauffé de 100 K — dilatation selon X, Y, Z | 0,0920 · 0,0460 · 0,0230 mm | α ΔT L | 0 (aucune contrainte) |
| Barre aluminium bridée entre deux murs, + 100 K — contrainte | 158,7 MPa | E α ΔT = 158,7 MPa | 0 |
| Lame libre, écart de température dans l'épaisseur — flèche, **un seul cube dans l'épaisseur** | −2,300 mm | κ = α ΔT / t → −2,3 mm | 0 |
| Bilame, deux couches égales — flèche en bout | 1,534 mm | Timoshenko, 1,5 mm | +2,3 % |
| Même bilame — contrainte à la jonction | 71,4 MPa | E Δα ΔT / 2 (1 − ν) = 71,4 MPa | 0 |
| Barre chauffée en bout (champ de température calculé, puis dilatation) — allongement | 0,05746 mm | 0,0575 mm | −0,1 % |
| Poutre fléchie dans son plan de symétrie, **demi-modèle** — flèche et contrainte de pointe | celles du modèle entier | modèle entier, mêmes cubes | moins de 0,5 % |
| Plaque encastrée sous pression, **quart de modèle** — flèche au centre | celle du modèle entier | modèle entier, mêmes cubes | moins de 0,2 % |
| Bloc chauffé, refroidi par convection, **demi-modèle** — températures et bilan | celles du modèle entier, 2,5 W sur 5 | modèle entier | moins de 0,2 % |
| Poutre coupée à mi-longueur, plan **tenu** — flèche | — | F L³ / 3 E I avec L = 50 mm | moins de 5 % |

Un cas de 3 400 cubes (13 400 inconnues) se résout en environ 0,6 s ; une plaque mince tenue par des vis demande
plus d'itérations (quelques secondes).

Sur le projet de démonstration, en thermo-mécanique (navigateur, de 2 800 à 4 100 cubes, une à deux secondes) :

| Cas | À la main | Simulation | Lecture |
|---|---|---|---|
| Capot plastique tenu par quatre vis, porté de 20 à 80 °C | au cœur ≤ 17,6 MPa ; déplacement ≤ 0,83 mm | au cœur 7,2 MPa ; 0,29 mm | bridage 41 % ; 32 MPa près des vis, pointe 52 MPa |
| Dissipateur tenu par quatre vis, champ de température calculé | au cœur ≤ 37,9 MPa ; ≤ 0,039 mm | au cœur 21,0 MPa ; 0,031 mm | bridage 55 % |
| Assemblage complet (cuivre, aluminium, FR-4, plastique) tenu par une face, à 80 °C | déplacement de 0,16 à 4,9 mm | 2,6 mm | dans la fourchette ; 13 petits composants laissés de côté |

## 6. Ce que la brique ne fait pas

- **Concentrations de contrainte** : la contrainte de pointe d'un maillage grossier est indicative. Au bord d'un
  encastrement, autour d'un trou ou dans un congé, la valeur locale réelle peut être deux à trois fois plus élevée.
- **Linéaire, statique, petits déplacements** : pas de plasticité, de flambage, de contact qui s'ouvre, de fatigue,
  de dynamique.
- **Thermique en régime permanent** seulement ; pas de rayonnement. En thermo-mécanique, les propriétés ne varient
  pas avec la température et le coefficient de dilatation est isotrope.
- **Matériaux isotropes**, valeurs typiques : la fiche de la nuance fait foi.
- **Parois minces** : il faut au moins un cube dans l'épaisseur, donc beaucoup de cubes pour une grande pièce mince.
- **Symétries** : planes et parallèles aux faces de l'enveloppe ; pas de symétrie cyclique (un secteur d'une pièce de
  révolution), pas d'antisymétrie. Les réactions affichées sont celles de la partie résolue. Le contrôle du chargement
  compare la position et la taille des régions, pas leur forme exacte : il se lit comme un garde-fou.

Pour ces cas, la brique dit *où regarder* ; un calcul détaillé ou l'essai en laboratoire tranche.
