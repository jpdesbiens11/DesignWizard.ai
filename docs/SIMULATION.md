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
     est totalement empêchée), la contrainte due au seul **écart de température interne**
     (σ ≈ E α ΔT / 2 (1 − ν)) et, entre deux matériaux collés, celle du **bilame** (σ ≈ E Δα ΔT / 2).
2. **La simulation.** Un clic ; le solveur tourne à côté de la page, qui reste utilisable.
3. **Le recoupement.** Un tableau « à la main / simulation / écart » et un verdict :
   - écart de 20 % ou moins : **concordant**, le résultat est crédible ;
   - jusqu'à 50 % : **écart notable**, regarder où la simulation concentre la contrainte ;
   - au-delà : **discordant**, ne retenir ni l'un ni l'autre avant d'avoir compris pourquoi.

Une simulation gardée (« Ajouter au rapport ») entre dans le rapport de revue avec son estimation, son résultat et
son écart.

Trois précisions qui comptent :

- **Une borne se lit comme une borne.** En thermo-mécanique, E α ΔT est le maximum possible loin des appuis : la
  simulation doit rester dessous, et le rapport contrainte nominale / borne donne le **taux de bridage** réel de la
  pièce. Une pièce tenue d'un seul côté doit, elle, se dilater de α ΔT L à 20 % près.

- **Une fourchette quand les appuis sont vissés.** Une pièce tenue par des vis de part et d'autre de l'effort est une
  poutre sur deux appuis, quelque part entre l'appui simple et l'encastrement : l'estimation donne les deux bornes, et
  la simulation doit tomber entre elles.
- **La contrainte nominale, pas la pointe.** Sous une vis ou au bord d'un encastrement, la contrainte calculée est une
  pointe locale qui dépend du maillage ; un calcul à la main ne la prédit pas. Le recoupement compare donc la
  contrainte **hors zones d'appui** (à deux cubes de distance). La pointe reste affichée, avec sa marge.

## 2. Le maillage : un seul gabarit, le cube

La pièce est découpée en **cubes identiques** : une grille régulière posée sur son enveloppe, dont on garde les
cubes dont le centre est dans la matière. La finesse se règle par un seul curseur (environ 500 à 16 000 cubes).

- C'est robuste : aucun mailleur à régler, aucune géométrie qui « ne maille pas ».
- C'est rapide : tous les éléments étant identiques, leur matrice se calcule **une fois** par matériau.
- C'est grossier, et assumé : un détail plus petit qu'un cube (petit trou, congé, chanfrein) disparaît ; une surface
  courbe devient un escalier.

Dans un assemblage, les corps qui se touchent partagent leurs nœuds : les contacts sont **collés** en structure et
**parfaits** en thermique. Chaque corps garde son matériau.

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

## 4. Ce qui est vérifié

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

Un cas de 3 400 cubes (13 400 inconnues) se résout en environ 0,6 s ; une plaque mince tenue par des vis demande
plus d'itérations (quelques secondes).

## 5. Ce que la brique ne fait pas

- **Concentrations de contrainte** : la contrainte de pointe d'un maillage grossier est indicative. Au bord d'un
  encastrement, autour d'un trou ou dans un congé, la valeur locale réelle peut être deux à trois fois plus élevée.
- **Linéaire, statique, petits déplacements** : pas de plasticité, de flambage, de contact qui s'ouvre, de fatigue,
  de dynamique.
- **Thermique en régime permanent** seulement ; pas de rayonnement. En thermo-mécanique, les propriétés ne varient
  pas avec la température et le coefficient de dilatation est isotrope.
- **Matériaux isotropes**, valeurs typiques : la fiche de la nuance fait foi.
- **Parois minces** : il faut au moins un cube dans l'épaisseur, donc beaucoup de cubes pour une grande pièce mince.

Pour ces cas, la brique dit *où regarder* ; un calcul détaillé ou l'essai en laboratoire tranche.
