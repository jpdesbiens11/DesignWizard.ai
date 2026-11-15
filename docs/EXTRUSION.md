# Le profilé extrudé

Dans l'Atelier (*Shop*), « Profilé sur mesure » est une matière première qui **se dessine autour de ce qu'elle
contient**. Le concepteur ne trace pas de section : il dit ce qui entre dans le profilé, et ce que le profilé rencontre.

1. **Ce qu'il contient** — une liste d'éléments, chacun avec sa largeur, sa hauteur et sa tenue :
   - **Glissé** : ses deux bords coulissent dans deux rainures (une carte, une tôle, une platine) ;
   - **Posé à plat** : sur le fond, sur les bossages des angles, ou sur deux nervures à lui ;
   - **Libre** : il doit seulement tenir dedans, avec du jeu (un faisceau, un module).
2. **Sa longueur**, s'il est **fermé** (un tube) ou **ouvert** sur le dessus (un U), et s'il porte des **canaux de vis**
   pour des flasques aux deux bouts (M3, M4, M5).
3. **Sa matière** — elle choisit le procédé : aluminium filé (6063-T5) ou plastique extrudé (PVC-U, ABS, PC).

La synthèse (`web/js/core/shop_extrusion.js`) écrit une pièce ordinaire de la famille `extrusion` : le générateur de
section `fitted` (`web/js/cad/profile_gen.js`), les enveloppes de ce qui est logé, et les interfaces.

## Chaque glissière est une interface

Une rainure n'est pas un détail de la section : c'est une **interface `rail`**, côté B, avec son identité (`IF2`), son nom
et sa clé. La pièce qui glisse la reprend telle quelle, côté A :

- cochez le profilé comme voisin dans l'Atelier : sa glissière libre devient l'interface imposée de la nouvelle pièce ;
- une plaque ou une tôle née ainsi prend **la largeur et l'épaisseur que la rainure attend**, et porte sa languette sur
  sa tranche arrière, à mi-épaisseur ;
- dans l'assemblage, le joint se fait seul (« Guidé ») : la pièce est **glissée dedans**, affleurant le bout du profilé,
  à la hauteur de sa rainure. Un test construit les deux pièces dans le vrai noyau et vérifie qu'elles ne partagent
  aucun volume.

Dans l'autre sens, une pièce qui existe déjà avec une languette libre impose sa glissière au profilé : la section se
dessine autour d'elle.

Les canaux de vis donnent une interface vissée par bout (« Fixation du flasque avant / arrière »), côté B, que le flasque
reprendra ; une face d'appui extérieure (sous le fond, par exemple) se déclare comme d'habitude, interne ou externe.

## Ce que le profilé décide seul

| Décision | Règle de l'extrudeur appliquée |
|---|---|
| **Une seule paroi** | choisie d'après le cercle circonscrit de la section : aluminium 1,5 mm jusqu'à 100 mm, 2 mm jusqu'à 150, 2,5 au-delà ; plastique 1,5 mm jusqu'à 80 mm. Nervures de la même épaisseur |
| **Rainure** | largeur = épaisseur du bord + deux fois le jeu (0,15 mm par face en aluminium, 0,25 en plastique) ; pas plus profonde que 3 fois sa largeur (2 fois en plastique) |
| **Dégagement au fond** | la rainure est plus profonde que le bord de 0,4 mm : un bord d'équerre ne monte jamais sur le rayon du fond |
| **Élément plus étroit que la cavité** | pas de bloc plein derrière la rainure, mais un **crochet** : une nervure venue de la paroi, une âme, une nervure accrochée à l'âme — partout l'épaisseur d'une nervure |
| **Élément posé à plat** | sur le fond ; sur les bossages des angles s'il est assez large ; sinon sur deux nervures sous ses bords |
| **Canaux de vis** | ouverts en « C » sur la cavité, dans un bossage de l'épaisseur de la paroi : aucun mandrin de plus dans la filière, vis autoformeuses, rien à percer ni à tarauder. L'angle extérieur s'arrondit autour du canal |
| **Rayons** | 0,4 mm au moins sur tous les angles, lèvres des canaux comprises |
| **Symétrie** | section symétrique : un écoulement équilibré donne un profilé droit |
| **Plastique fermé** | signalé : un creux demande un calibrage interne ; le U ouvert est le moins cher |

Chaque décision est écrite sous la pièce proposée. La gamme de fabrication se réduit à : extruder, couper à longueur,
ébavurer, contrôler — les rainures et les canaux viennent de la filière.

## Dans le fichier de la pièce

```
family extrusion
extrusion axis=Y length=L
  profile={gen: fitted, W: Wc + 2*t, H: Hc + 2*t, t: t, tf: t, c: 0.15, rails: [{y: t + 10, g: 1.9, d: 1.9, w: 100, relief: 0.4}], ledges: [], ports: {d: 2.7, b: 4.7}}
  inside name="Carte (bord)" w=100 h=1.6 at=[Wc/2 + t, t + 10] clearance=0.05
```

`rails` : hauteur de l'axe de la rainure, largeur, profondeur, largeur de ce qu'elle tient, dégagement ; `ledges` :
nervures d'appui ; `ports` : diamètre du canal de vis et côté du bossage ; `open: true` pour un U. Tout reste modifiable
dans le studio de pièce et l'écran Extrusion.

## Ce qui le vérifie

Le livre d'extrusion `EXT-00` à `EXT-12` : paroi minimale, parois uniformes (2:1), languettes de filière (3:1), rayons,
creux, cercle circonscrit, enveloppes de ce qui est logé (`EXT-09` : rien ne touche le métal, jeu compris). Les tests
(`tests/node/shop_extrusion.test.mjs`) construisent quatre profilés dans le vrai noyau et exigent zéro erreur et zéro
avis pour l'aluminium et pour le U en plastique.

## Limites

- Section rectangulaire, éléments empilés du fond vers le haut, centrés ; pas d'ailettes de refroidissement ni de
  rainures en T dessinées par l'Atelier (les générateurs `heatsink` et `channel` existent dans l'écran Extrusion).
- Un seul jeu par procédé ; pas de tolérances de filière calculées cote par cote (EN 12020-2 / EN 755-9 sont citées).
- Les flasques ne sont pas dessinés seuls : leurs interfaces sont prêtes, la pièce reste à créer dans l'Atelier.
- Les chiffres sont des règles de pouce d'usage courant : l'avis de l'extrudeur prévaut.
