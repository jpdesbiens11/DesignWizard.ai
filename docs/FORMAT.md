# Le format `.dwiz` — un seul format pour tout le produit mécatronique

`.dwiz` (prononcé « di-wiz », pour **D**esign**Wiz**ard) est le format de fichier de la plateforme. Il a été conçu
pour trois lecteurs à la fois : **l'ingénieur ou le technicien** qui conçoit, **l'atelier** qui fabrique, et
**l'IA** qui aide l'un et l'autre. Un fichier `.dwiz` se lit de haut en bas comme une fiche d'atelier : pourquoi la
pièce existe, à quoi elle se raccorde, de quoi elle est faite, comment elle se fait, ce qu'il faut savoir.

Le nom et l'extension sont une proposition : ils tiennent dans deux constantes (`web/js/core/dwiz_names.js`).

## 1. Un exemple complet

```text
dwiz part/1 PN-0042 "Plaque d'adaptation"

# Pourquoi — l'intention de conception
function "Porte le capteur sur le bâti."
intent loads="5 N en bout" quantity=10
order quantity=4 need_by=2026-12-01

# À quoi elle se raccorde — ses interfaces, le contrat avec les pièces voisines
interface IF1 bolt_pattern side=A face=-Z at=[L/2, W/2] key=frame_mount partner=Bâti name="Fixation au bâti"
  params screw=M5 pattern={type: rect, nx: 2, ny: 2, dx: 80, dy: 50}
interface IF2 bolt_pattern side=B face=+Z at=[L/2, W/2] key=sensor_mount partner=Capteur name="Fixation du capteur"
  params screw=M3 pattern={type: rect, nx: 2, ny: 2, dx: 24, dy: 18}
  opts depth=through

# De quoi elle est faite — matière, procédé, matière première
material AL6061-T6
process cnc_milling
stock plate L=L W=W t=t

# Ses poignées — les paramètres que l'on règle
param L 105 min=105 max=400 step=1 unit=mm label=Longueur group=Enveloppe
param W 75 min=75 max=300 step=1 unit=mm label=Largeur group=Enveloppe
param t 5 min=3 max=50 step=0.5 unit=mm label=Épaisseur group=Enveloppe
param r 4 min=0 max=20 step=0.5 unit=mm label="Rayon des coins" group=Détails

# Comment elle se fait — les opérations, dans l'ordre de l'atelier
do outline id=contour profile={rect: [0, 0, L, W], r: r}
do interfaces
do deburr id=ebavurage

# Ce qu'il faut savoir — notes du dessin, révision, hypothèses
note "Casser les angles vifs 0,2 à 0,5 mm"
interview
  assume "Épaisseur 5 mm : taraudage M3, 1,5 × d = 4,5 mm en prise → taille du commerce suivante."
```

Rien n'y est caché : pas de binaire, pas d'identifiant opaque, pas d'esquisse à deviner. La géométrie est une
conséquence de ce texte ; la plateforme la construit avec un noyau B-Rep exact.

## 2. Les règles de la notation

| Règle | Exemple |
|---|---|
| La première ligne dit ce qu'est le fichier : genre/version, numéro, nom | `dwiz part/1 PN-0042 "Plaque"` |
| **Une instruction par ligne** : un mot, puis sa valeur | `material AL6061-T6` |
| Un bloc : le mot, puis des `nom=valeur` | `intent loads="5 N" quantity=10` |
| Les valeurs les plus parlantes s'écrivent sans leur nom, en premier | `stock plate L=L W=W t=t` · `do drill …` · `interface IF1 bolt_pattern …` |
| Une ligne **en retrait** précise la ligne du dessus | `  params screw=M5 …` sous `interface …` |
| Une ligne en retrait qui commence par `nom=valeur` continue la ligne du dessus | pour couper une ligne longue |
| `#` commence un commentaire | `# Pourquoi — l'intention` |
| `mot = valeur` écrit une valeur brute, telle quelle | `param wall = 3` · `parts = []` |

**Valeurs.**

| Forme | Exemple | Lu comme |
|---|---|---|
| Nombre | `12` · `-0.5` · `1e-3` | un nombre |
| Mot nu | `AL6061-T6` · `+Z` · `M5` · `L/2` | un texte (ou une formule simple) |
| Texte entre guillemets | `"Rayon des coins"` · `« Ébavurer »` | un texte |
| Formule entre parenthèses | `(L - 2*inset)` · `(max(t, 2))` | une formule des paramètres |
| Liste | `[L/2 - 30, W/2]` | les formules s'y écrivent nues, séparées par des virgules |
| Bloc en ligne | `{rect: [0, 0, L, W], r: r}` | des `nom: valeur` |
| Texte long | `step <<<` … lignes … `>>>` | un texte de plusieurs lignes, tel quel |
| `true` · `false` · `null` | | vrai, faux, vide |

Unités : millimètres, degrés, grammes. Axes : X à droite, Y vers l'arrière, Z vers le haut.

## 3. Sans perte, et jumeau du JSON

`.dwiz` est une **notation** du modèle de données de la plateforme, pas un second modèle. Tout document a un jumeau
JSON exact : `fromDwiz(toDwiz(x))` redonne `x`, pour toute pièce, tout assemblage et tout projet — c'est vérifié par
les tests sur tous les gabarits et les deux projets de démonstration. Le JSON reste accepté partout (collage, dépôt,
import, réponse d'une IA).

Ce qu'un module ne connaît pas encore n'est jamais perdu : une clé inconnue est écrite `clé valeur`, relue telle
quelle, et rangée sous « Autres données ». Un fichier écrit par une version plus récente reste lisible par une plus
ancienne, et inversement.

## 4. Les genres de document, et les noms à venir

Le genre est le premier mot après `dwiz`. Il donne l'ordre de lecture du document et les mots de ses listes.

| Genre | Fichier | Contenu | Mots propres |
|---|---|---|---|
| `part` | `PN-0042.part.dwiz` | une pièce : intention, interfaces, matière, opérations | `interface`, `param`, `do`, `note`, `assume`, `asked`, `component`, `zone`, `net`, `inside`, `outside`, `body` |
| `assembly` | `DRV-ASM.assembly.dwiz` | pièces posées, interfaces accouplées, isolation | `place`, `mate`, `net` |
| `project` | `variateur.project.dwiz` | le produit ; ses pièces et assemblages suivent, un document après l'autre | `physics`, `log` |

Noms réservés aux modules à venir — le format s'étend, la notation ne change pas :

| Genre | Module | Contenu prévu |
|---|---|---|
| `order` | Commande | lot de pièces à fabriquer : quantités, date voulue, atelier, prix et délai reçus |
| `test` | Essai | plan d'essai de laboratoire : mesure, valeur prévue par la physique, valeur mesurée |
| `board` | Carte | carte électronique complète : schéma, empilage, placement |
| `harness` | Faisceau | câbles, connecteurs, longueurs, cheminement entre interfaces électriques |
| `firmware` | Micrologiciel | brochage, périphériques, paramètres du CPU liés aux interfaces de la carte |
| `requirement` | Exigence | ce que le produit doit faire, relié aux pièces, analyses et essais qui le prouvent |
| `review` | Revue | décision de revue de conception : verdicts, réserves, signatures |

**Ajouter un genre ou un mot** se fait dans un seul fichier, `web/js/core/dwiz_names.js` : l'ordre des sections, et
pour chaque liste le mot de ses lignes et les valeurs écrites sans leur nom. Le lecteur et l'écrivain
(`web/js/core/dwiz.js`) sont génériques et ne changent pas.

## 5. Le vocabulaire d'une pièce

Le vocabulaire complet (familles, procédés, matériaux, types d'interface, formes de matière première, verbes
d'atelier, opérations du noyau) est dans [PART_LANGUAGE.md](PART_LANGUAGE.md). En bref :

- **`intent`** — `loads`, `environment`, `quantity`, `priority` : pourquoi la pièce existe.
- **`order`** — `quantity`, `need_by`, `note` : la commande du prototype.
- **`interface`** — `bolt_pattern`, `planar`, `fit`, `cutout`, `rail`, `pins` ; côté `A` ou `B`, même `key` et mêmes
  `params` sur la pièce voisine.
- **`stock`** — `plate`, `sheet`, `block`, `bar_flat`, `bar_round`, `tube_round`, `tube_rect`, `angle`, `profile`,
  `print` : ce que l'on prend sur l'étagère.
- **`do`** — verbes d'atelier `drill`, `tap`, `cbore`, `csink`, `ream`, `mill`, `groove`, `face`, `step`, `outline`,
  `turn`, `bore`, `break_edges`, `deburr`, `finish` ; opérations du noyau `box`, `cylinder`, `extrude`, `revolve`,
  `hole`, `pocket`, `pad`, `slot`, `boss`, `shell`, `fillet`, `chamfer` ; `do interfaces` marque l'endroit où la
  géométrie des interfaces est taillée.

## 6. Pourquoi ce format aide l'IA

- **L'ordre est celui du raisonnement** : intention, interfaces, matière, opérations. Une IA qui lit le début sait
  déjà à quoi sert la pièce avant de voir une cote.
- **Les mots sont ceux du métier** (`stock plate`, `do tap`), pas ceux d'un logiciel (`Sketch3`, `Extrude7`).
- **Tout est nommé** : une cote est un paramètre avec son libellé, ses bornes et son unité ; une formule dit d'où
  vient une position.
- **Une ligne = une décision** : un `diff` Git montre exactement ce qui a changé entre deux révisions.
- **Les erreurs nomment leur ligne** : « Ligne 12 : valeur sans nom après « do » : écrivez nom=valeur ».

## 7. Lire et écrire `.dwiz` dans un programme

```js
import { toDwiz, fromDwiz } from "./web/js/core/dwiz.js";

const text = toDwiz(part);        // pièce, assemblage, projet, ou liste de documents
const again = fromDwiz(text);     // l'objet d'origine, à l'identique
```

Les deux fonctions sont pures (aucune dépendance, aucun accès réseau) et fonctionnent dans le navigateur comme dans
Node.
