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
  s'allume en bleu sous le curseur, puis en vert quand elle est choisie. Toute face se pointe, intérieure comprise
  (voir plus bas).
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

### Pointer une face — intérieure aussi

Une condition ne vise plus seulement les six côtés du produit et ses interfaces : **toute face du modèle** se pointe.

- Un clic (ou un clic droit) sur le **fond d'un boîtier**, une **paroi intérieure**, le **dessous d'un couvercle**, un
  gradin ou le fond d'une poche désigne cette face : elle s'allume en entier, et la ligne de l'arbre dit où elle est —
  « Face pointée, tournée vers le haut (+Z) — z = 3,2 mm, 132 cm² ».
- **Face cachée ?** Tournez la vue, ou coupez-la (« Coupe » dans la barre de la vue, Maj + S pour changer de côté) : ce
  qui est derrière la coupe se clique.
- Un clic sur le plan le plus extérieur d'un côté désigne toujours ce côté entier, comme avant ; un clic près des vis
  d'une interface, l'interface. Une paroi voisine d'un plan de joint se pointe pour elle-même.
- Le **clic droit** sur une face, comme dans l'Isolation : « Appui ici », « Effort ici », « Pression ici », « Source de
  chaleur ici » — et, pour ce qui s'y trouve déjà, « Régler E2 — Force 250 N vers −Z » (ouvre ses valeurs à gauche) et
  « Retirer E2 ».

Sur ce maillage de cubes, une face pointée est l'ensemble des faces de cubes exposées qui regardent du même côté et se
touchent — dans leur plan, ou d'une couche à la suivante : une paroi en dépouille ou en pente douce, qui est un escalier
ici, reste une seule face ; le fond d'un boîtier et le dessus de son rebord ne se confondent pas. La face est retrouvée
par sa position à chaque maillage ; si la pièce a changé et qu'elle n'existe plus, l'arbre le dit.
Code : `web/js/analysis/fea/patch.js` (pur) — `patchAt`, `patchFaces`, `patchInfo`, `patchSpots` ; le solveur lit la
région `{ patch: { at, dir } }`.

### Les valeurs à entrer clignotent

Quand une condition est posée, l'outil lui donne une valeur d'**exemple** (100 N, 0,1 MPa, 5 W, 25 °C) — comme pour le
premier cas proposé à l'ouverture. Ce n'est pas la vôtre : tant qu'elle n'est pas entrée, sa ligne clignote dans le
volet de gauche avec la mention « à entrer », son champ clignote, et **la simulation ne se lance pas**. Tapez votre
valeur, ou gardez l'exemple (Entrée, ou la coche à côté du champ).

### Ce que le cas de charge signale, pendant qu'on le construit

En tête du cas de charge, le guide liste ce qui manque ou ce qui cloche, le plus grave d'abord ; un clic sur une ligne
mène à l'endroit, qui clignote un instant.

| Niveau | Exemples | Bloque le lancement |
|---|---|---|
| À corriger | Produit tenu nulle part ; aucun effort ; chaleur sans sortie (ni convection ni température imposée) ; face disparue du maillage ; température sous le zéro absolu | oui |
| À entrer | Valeur d'exemple pas encore entrée ni confirmée | oui |
| À vérifier | Effort sur une face encastrée ; valeur nulle ; pression de plus de 50 MPa (unité ?) ; source sur une face tenue en température ; dilatation nulle | non |
| Conseil | Deux appuis sur la même face ; force négative ; pression négative | non |

Les règles sont pures et testées (`web/js/analysis/fea/case_check.js`, `caseIssues`) ; l'affichage est celui du guide
commun à tous les écrans (`web/js/core/guide.js`).

### Aller et venir entre le modèle et le résultat

Deux vues, un bouton à deux positions en bas de la vue 3D (et le même à côté de « Lancer la simulation ») :

- **Modèle et conditions** — le modèle en gris, ses appuis, ses efforts, ses sources et leurs étiquettes. C'est ici que
  le cas se modifie : clic droit sur une face, valeurs à gauche.
- **Résultat n** — le dernier calcul, en couleurs, avec son point le plus sévère.

Un résultat n'est plus perdu quand on retouche le cas ou le maillage : il reste affichable, marqué « d'avant » jusqu'au
prochain calcul. On regarde, on revient au modèle, on corrige, on relance : chaque calcul est un **essai** numéroté, et
le panneau liste les essais de la séance (cubes, contrainte de pointe, déplacement, facteur de sécurité minimal). Les six
derniers se réaffichent d'un clic. Un résultat qui ne bouge plus quand on affine le maillage ou qu'on précise les appuis
est un résultat sur lequel on peut s'appuyer. Dans la vue « Résultat », un clic droit propose de revenir au modèle.

### Le facteur de sécurité en couleurs

« Ce que les couleurs montrent » bascule entre la **contrainte** (échelle réglable, comme avant) et le **facteur de
sécurité** : la limite élastique du matériau divisée par la contrainte de von Mises, en chaque point — par corps dans un
assemblage. Il se lit contre le **facteur visé** (1,25 · 1,5 · 2 · 3 · 4, ou toute valeur de 1 à 20) :

| Couleur | Facteur | Lecture |
|---|---|---|
| Rouge sombre | sous 1 | au-delà de la limite élastique |
| Rouge | de 1 au facteur visé | sous la marge visée |
| Orange, de l'orangé à l'ambre | du facteur visé à 1,5 fois | marge juste |
| Bleu, du bleu au cyan | de 1,5 à 3 fois | marge confortable |
| Vert | 3 fois et plus | large marge — de la matière à gagner, peut-être |
| Gris | — | limite élastique inconnue pour ce matériau |

Le point le plus faible porte son étiquette sur le modèle (« FS 0,73 »), l'indicateur du panneau prend la couleur de sa
bande, et une phrase dit la part de la surface sous la marge. Le facteur est aussi **indicatif** que la contrainte dont
il vient : sur ce maillage grossier, les concentrations locales ne sont pas résolues, et les limites élastiques sont des
valeurs typiques — la fiche de la nuance fait foi. Code : `web/js/analysis/fea/safety.js` (pur), panneau
`web/js/modules/fea_result.js`.

### Avant la simulation : l'écran des modèles analytiques

L'onglet « Modèles analytiques » a la même structure que la Simulation et que les autres studios :

| Volet de gauche — ce que l'on entre | Centre — ce que l'on regarde | Volet de droite — ce que l'on choisit et ce que l'on obtient |
|---|---|---|
| Le modèle en cours, la pièce du projet dont on reprend les dimensions, puis les entrées par groupe (géométrie, chargement, matériau, critères) | En haut, le **schéma 2D** du modèle avec sa question, son verdict et ses trois valeurs clés ; en bas, le **même modèle en 3D**, dessiné aux dimensions tapées, avec ses efforts, ses appuis et ses étiquettes | « Modèles » : les 21 calculs en **tuiles rangées par physique** — une couleur et un pictogramme par physique, le schéma du modèle comme pictogramme de sa tuile, quelques mots dessous ; « Résultat » : verdict, valeurs, vérifications et marges ; « Calcul » : les étapes, les hypothèses, la validité, la source ; « Rapport » : les calculs gardés |

Le 3D est tracé avec les nombres entrés (`web/js/analysis/physics/scene3d.js`, pur et testé) : une portée doublée
double la poutre, douze ailettes en montrent douze. Une disproportion saute aux yeux avant que le verdict ne tombe.
Ce qui est raccourci ou épaissi pour rester lisible le dit dans son étiquette (un tube très long, le cuivre d'une
piste). Ce n'est pas la pièce : c'est le modèle simple que le calcul suppose.

Les valeurs d'un modèle neuf sont des **exemples**. Leur champ est marqué, le prochain à entrer clignote, le guide les
compte, et « Ajouter au rapport » attend qu'elles soient tapées ou confirmées (Entrée dans le champ, ou « Tout
confirmer »). Sans modèle choisi, le centre propose les cinq physiques. Fenêtre étroite : le volet de droite passe
sous celui de gauche au lieu de disparaître.

**Ce que la pièce dit passe dans le modèle.** Ouvrir un modèle sur une pièce y porte d'emblée ce que la pièce dit sans
être construite : les propriétés de sa matière et, pour un **busbar**, sa bande (largeur, épaisseur, longueur le long
de la fibre du milieu — pas l'enveloppe), son courant déclaré et l'émissivité de sa finition (cuivre nu 0,4 ; étamé ou
nickelé 0,1 ; argenté 0,05 ; gainé 0,9 — valeurs typiques). Le bouton « Vérifier l'échauffement » de l'écran Busbars
ouvre donc le calcul déjà rempli ; chaque valeur dit d'où elle vient sous son champ, et reste à vérifier. « Reprendre
ses dimensions » ajoute ce qui demande la pièce construite (enveloppe, masse, trous).

**Garder un calcul, au nom de sa pièce.** « Garder ce calcul » le garde dans le projet sous un **nom** — proposé avec
le nom de la pièce d'abord (« Busbar — Busbar », puis « … (2) »), modifiable (« Busbar HV+ — pointe 150 A »). On en
garde autant qu'on veut par pièce, au fil du temps ; l'onglet « Rapport » les range **par pièce**, le dernier d'abord,
et chacun se rouvre avec ses données. Quand le projet est dans Google Drive, la **fiche** du calcul — données,
résultats, vérifications, étapes, hypothèses, référence — est rangée en texte dans `03_Analyses/<pièce>/<nom>.txt`
(`runSheet`, `runsByPart`, `runName` dans `web/js/analysis/physics/index.js`). L'écriture dans Drive n'a pas été
essayée sur un vrai compte dans cette session.

## 2. Le maillage : un seul gabarit, le cube

La pièce est découpée en **cubes identiques** : une grille régulière posée sur son enveloppe, dont on garde les
cubes dont le centre est dans la matière. La finesse se règle par un seul curseur (environ 500 à 16 000 cubes).

- C'est robuste : aucun mailleur à régler, aucune géométrie qui « ne maille pas ».
- C'est rapide : tous les éléments étant identiques, leur matrice se calcule **une fois** par matériau.
- C'est grossier, et assumé : un détail plus petit qu'un cube (petit trou, congé, chanfrein) disparaît ; une surface
  courbe devient un escalier. Là où un détail compte, une **zone de raffinement** met des cubes plus petits (§ 5).

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

### Le plan de symétrie est une frontière bloquée

Un plan de symétrie ne bouge pas : rien ne le traverse, tout se déforme autour de lui. Dès qu'un plan est utilisé comme
symétrie, il apparaît donc **parmi les appuis** du cas de charge — `S1 · Symétrie · plan X = 40 mm` —, avec ses cônes
bleus sur le plan et son étiquette sur le modèle.

- Ce qui est bloqué est le déplacement **perpendiculaire** au plan ; la matière reste libre de glisser dans le plan. C'est
  la condition qui donne, sur la moitié, le même résultat que sur le produit entier — un encastrement complet du plan le
  fausserait.
- **Un seul plan de symétrie à la fois**, pour l'instant : les autres plans symétriques restent proposés mais grisés, et
  une coupe ordinaire (libre, tenue, température) reste possible sur les autres axes.
- Cette frontière **ne se retire pas seule** : elle porte un cadenas. Si l'on tente de l'effacer, une fenêtre explique
  qu'elle vient de la symétrie et propose de **retirer la symétrie** — le produit entier revient alors dans le calcul.

## 5. Zones de raffinement : des cubes plus petits là où l'on regarde

Un détail — un trou, un congé, le bord d'un appui — demande des cubes plus petits que le reste. Affiner tout le maillage
coûte cher ; une **zone de raffinement** n'affine que là où l'on regarde.

**Ce que l'on place.** Un volume, posé dans le modèle :

| Forme | Ce que l'on donne |
|---|---|
| **Cylindre** | son axe (X, Y ou Z), son diamètre, sa longueur |
| **Prisme à section carrée** | son axe (X, Y ou Z), le côté du carré, sa longueur |

et son centre. Le plus direct : **clic droit sur la pièce → « Raffiner le maillage ici »** — la zone est centrée sur le point,
son axe le long de la normale de la face. Ou le « + » de la section « Zones de raffinement », puis un clic sur la pièce.
La carte de la zone règle sa forme (deux pictogrammes), son axe, ses cotes, son centre (trois champs, ou « Viser » puis
un clic) et sa finesse : des cubes **2, 3 ou 4 fois plus petits**. Les cotes que l'outil propose sont des exemples : elles
clignotent, et le calcul attend qu'elles soient entrées ou confirmées.

**Ce que l'on voit.** Le contour de la zone et son nom (Z1, Z2…), et surtout **sa forme imprimée sur la pièce, en petits
cubes** : ce que le volume partage avec le produit est remaillé, dans la couleur des zones. La ligne du bas compte les
cubes fins à côté de ceux du modèle.

**Comment c'est maillé.** Une zone prend des **cubes entiers du modèle** — sa forme, en cubes : tout cube qu'elle atteint.
Chacun est recoupé en 8, 27 ou 64 cubes, sur les mêmes lignes de grille, et **la géométrie y est relue** : un détail plus
petit qu'un cube du modèle, que le maillage grossier ignorait, réapparaît. Un fragment fin que rien ne relie au reste
est laissé de côté, et l'écran le dit. Une zone compte au plus 40 000 cubes fins ; deux zones ne se touchent jamais (un
cube du modèle reste toujours entre elles).

**Comment c'est résolu : un seul maillage.** Le modèle sans les cubes pris et les cubes fins de chaque zone sont résolus
**ensemble**. Sur le bord d'une zone, chaque nœud fin est **lié** au cube du modèle sur lequel il repose : il se déplace (ou
s'échauffe) comme ce cube le dit à cet endroit. Ces nœuds ne sont pas des inconnues ; leur raideur et leurs efforts sont
reportés sur les coins qui les mènent. La zone raidit ou assouplit donc le modèle autant qu'il faut, et le modèle charge
la zone autant qu'il faut : rien n'est supposé sur le bord.

- Les appuis, les efforts, les sources et la convection **qui tombent dans la zone** y sont repris : une face du produit
  est reportée face par face sur les petits cubes, une interface est le même endroit de l'espace ; un effort réparti
  sur des nœuds est partagé entre la zone et le reste, sans être compté deux fois.
- Les trois physiques, et les symétries : une zone à cheval sur un plan de symétrie est coupée comme le reste.
- Le calcul est fait **deux fois** : le modèle seul d'abord (il dit si le cas tient, et sert de comparaison), puis avec ses
  zones. Compter le double du temps.

**Ce que le résultat dit.** Les chiffres de tête et les couleurs sont ceux du maillage composé. Un tableau donne, par zone,
son maillage, **sa pointe**, ce que **le modèle seul** donnait au même endroit, et l'écart. Une simulation gardée pour la
revue emporte ses zones.

**Ce qu'il faut savoir.**

- Les cubes restent des cubes : une surface courbe est un escalier plus fin, pas une courbe. La pointe monte quand on
  affine ; comparer 2, 3 et 4 fois dit si elle se stabilise. Au fond d'une **entaille vive**, elle ne se stabilise jamais.
- Le lien du bord est un peu plus raide que la matière : laisser le bord de la zone à **deux cubes du modèle** au moins du
  détail regardé. Le guide le signale quand la zone est plus petite que deux cubes.
- Une face pointée, allumée dans la vue, ne l'est pas à l'intérieur d'une zone.

Un premier essai, à sens unique — les déplacements du modèle seul imposés sur le bord de la zone — a été écarté : sur la
plaque trouée du tableau ci-dessous, il donnait de −10 % à +35 % selon la taille de la zone, parce que le modèle grossier
est trop souple ou trop raide là où la zone change la géométrie. Partir de la solution du modèle seul pour gagner du
temps a aussi été essayé, et écarté : cela demande plus d'itérations, pas moins.

Le code : `web/js/analysis/fea/refine.js` (ce qu'est une zone : sa forme, ses cubes, son maillage fin, ses liens, sa part
du cas), `web/js/analysis/fea/composite.js` (le modèle sans ses zones, la résolution liée, la peau composée),
`web/js/modules/fea_zones.js` (l'écran) ; tests : `tests/node/fea_refine.test.mjs`.

## 6. Ce qui est vérifié

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
| Barre en traction, **zones de raffinement** de finesse 2, 3 et 4 (jusqu'à deux à la fois) — contrainte dans tous les cubes | 10,000 MPa | 10 MPa | moins de 0,01 % |
| Plaque 80 × 40 × 5 mm trouée ⌀ 8 mm en traction, **zone** ⌀ 12 puis ⌀ 24 autour du trou, cubes 2 fois plus petits — pointe | 25,2 à 25,4 MPa | maillage fin partout, mêmes petits cubes : 25,4 MPa | moins de 3 % (le modèle seul : 29,7 MPa, +17 %) |
| Même plaque, trou ⌀ 2 mm, **plus petit qu'un cube** — pointe dans la zone | 20,0 MPa | maillage fin partout : 20,0 MPa | moins de 3 % (le modèle seul ne voit pas le trou : 10,1 MPa) |
| Demi-plaque sur son plan de symétrie, avec sa **zone** — pointe et déplacement | ceux de la plaque entière | plaque entière, même zone | moins de 0,1 % |
| Poutre poussée sur une face qu'une **zone** recouvre en partie — réaction d'appui | 120 N | 120 N | moins de 0,01 % |
| Barre entre 100 °C et 20 °C, avec une **zone** — température de chaque nœud | sur la droite | la droite | moins de 0,001 °C |
| Barre chauffée de 3 W et refroidie par convection, avec une **zone** — bilan | 3,000 W évacués | 3 W | moins de 0,01 % |

Un cas de 3 400 cubes (13 400 inconnues) se résout en environ 0,6 s ; une plaque mince tenue par des vis demande
plus d'itérations (quelques secondes).

Sur le projet de démonstration, en thermo-mécanique (navigateur, de 2 800 à 4 100 cubes, une à deux secondes) :

| Cas | À la main | Simulation | Lecture |
|---|---|---|---|
| Capot plastique tenu par quatre vis, porté de 20 à 80 °C | au cœur ≤ 17,6 MPa ; déplacement ≤ 0,83 mm | au cœur 7,2 MPa ; 0,29 mm | bridage 41 % ; 32 MPa près des vis, pointe 52 MPa |
| Dissipateur tenu par quatre vis, champ de température calculé | au cœur ≤ 37,9 MPa ; ≤ 0,039 mm | au cœur 21,0 MPa ; 0,031 mm | bridage 55 % |
| Assemblage complet (cuivre, aluminium, FR-4, plastique) tenu par une face, à 80 °C | déplacement de 0,16 à 4,9 mm | 2,6 mm | dans la fourchette ; 13 petits composants laissés de côté |

## 7. Ce que la brique ne fait pas

- **Concentrations de contrainte** : la contrainte de pointe d'un maillage grossier est indicative. Au bord d'un
  encastrement, autour d'un trou ou dans un congé, la valeur locale réelle peut être deux à trois fois plus élevée.
  Une **zone de raffinement** (§ 5) la regarde de plus près, sans la garantir : des cubes, même petits, restent des cubes.
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
