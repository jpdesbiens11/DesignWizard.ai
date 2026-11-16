# La pièce moulée

Dans l'Atelier (*Shop*), « Moulage » est une matière première comme une autre : on ne prend rien sur l'étagère, la
matière remplit un moule. La différence est que **la pièce se dessine d'elle-même**. Le concepteur dit trois choses :

1. **ce qu'elle contient** — le volume à loger (longueur, largeur, hauteur) et les interfaces de ce qui se fixe
   dedans (case « à l'intérieur » : une carte, un module, sur colonnettes) ;
2. **ce qu'elle rencontre dehors** — couvercle, fixations sous le fond, ouvertures dans les parois ;
3. **sa matière** — c'est elle qui choisit le procédé : un plastique s'injecte (injection molding), un alliage de
   fonderie se coule en high pressure die casting (A380, Zamak 3), ou en sand casting, permanent mold ou low pressure
   die casting (A356-T6, au choix).

La synthèse (`web/js/core/shop_mold.js`, `shop_mold_more.js`) écrit alors une pièce ordinaire du langage (`tub`, `boss`,
`pad`, `pocket`, `hole`, interfaces) : tout reste modifiable, paramètre par paramètre, dans le studio de pièce.

## Trois pièces moulées

| Ce que fait la pièce | Ce que le compagnon dessine |
|---|---|
| **Coque — elle contient** (boîtier, carter) | une cuve à paroi unique autour du volume à loger, avec colonnettes, bossages, goussets, nervures du fond |
| **Couvercle — il ferme** | assorti au boîtier voisin : même contour, mêmes rayons, même dépouille ; une **lèvre de centrage** qui descend dans le bord, entre la paroi et les bossages ; des trous au droit des bossages, ou des crochets dans les fenêtres |
| **Platine nervurée — elle porte** | une pièce pleine : une paroi, une ceinture et des nervures croisées dessous, des bossages sous ses filets ; le dessus reste plan |

Le compagnon reconnaît un couvercle quand la pièce reprend le **plan de joint** d'une voisine. Le couvercle lit ce que son
boîtier a consigné dans `mold` (contour, paroi, rayons, dépouille, fermeture) : les deux sont tirés des mêmes nombres, et
un test pose le couvercle sur le boîtier et vérifie qu'ils ne partagent aucun volume.

**Fermeture par vis ou par clips.** Avec des clips, le boîtier n'a plus ni bossage ni vis : des fenêtres s'ouvrent dans
ses grands côtés, et le couvercle porte des lames à crochet. La lame est dimensionnée par sa déformation à
l'encliquetage, ε = 1,5 × épaisseur × flèche / longueur², tenue sous 2 % (1 % pour une matière chargée de fibres) : une
matière plus raide donne une lame plus longue. Un métal coulé ne fléchit pas assez, un boîtier trop peu profond ne loge
pas la lame : la fermeture reste alors vissée, et le compagnon le dit. Le prix des clips est compté : un tiroir par rangée
de fenêtres, un éjecteur incliné par crochet.

## Ce que la pièce décide seule

| Décision | Règle du mouleur appliquée |
|---|---|
| **Une seule paroi nominale** | la valeur usuelle de la matière, épaissie si la matière a loin à courir (longueur d'écoulement / paroi), toujours dans la plage de la matière |
| **Rayons faits avant d'évider** | rayon extérieur = paroi + rayon intérieur ; le rayon intérieur vaut au moins la moitié de la paroi, et la paroi garde son épaisseur dans les angles |
| **Colonnettes** de ce qui se fixe dedans | diamètre ≥ 2 × le trou (2,5 × en métal) ; insert posé à chaud en plastique, taraudage repris en métal |
| **Bossages de fermeture** | détachés des parois d'au moins une paroi et reliés par des goussets, jamais noyés dans l'angle ; pas plus hauts que 3 diamètres |
| **Pas de masse dans un bossage** | son trou descend aussi bas qu'une broche le peut (3 × Ø), et une seconde broche l'évide par dessous : il ne reste qu'un voile d'une paroi |
| **Deux fûts ne se touchent pas** | si une colonnette occupe le coin, les bossages de fermeture glissent le long des grands côtés |
| **Nervures du fond** | fond large : nervures basses (55 % de la paroi en plastique, 80 % en métal) plutôt qu'une paroi plus épaisse ; une nervure s'écarte d'une colonnette ou d'un trou |
| **Fermeture proposée** | quatre vis et un plan de joint si rien n'est déclaré (à retirer s'il n'y a pas de couvercle) |
| **Ouvertures latérales** | comptées : chacune demande un tiroir dans le moule |
| **Dépouille réelle** | parois, bossages, goussets et nervures **penchent dans le modèle** ; le bord garde la cote nominale, le fond est plus étroit, et le volume à contenir est compté au fond. Une seule paroi impose un seul angle : le plus grand de ceux que demande le procédé |
| **Plan de joint, tiroirs, éjection** | consignés pour le mouliste dans `mold` |

Chaque décision est écrite en clair sous la pièce proposée (« Ce que le compagnon a décidé »).

## Cinq procédés, nommés comme le métier les nomme

| Procédé (`process`) | En français | Le moule | Comment il se remplit |
|---|---|---|---|
| **Injection molding** (`injection_molding`) | moulage par injection | acier : cavity (moitié fixe) et core (moitié mobile, avec les ejector pins) | sous haute pression, par le gate |
| **High pressure die casting — HPDC** (`die_casting`) | fonderie sous pression | acier : cover die et ejector die | un piston pousse le métal par le runner et l'ingate ; overflows et vents à l'opposé ; pas de riser |
| **Low pressure die casting — LPDC** (`lp_die_casting`) | fonderie basse pression | moule métallique permanent, posé sur le four | une faible pression de gaz fait monter le métal dans le riser tube : la cavité se remplit **par le bas, de bas en haut, jusqu'aux risers** ; la pression est tenue pendant que la pièce fige |
| **Permanent mold casting** (`permanent_mold`) | moulage en coquille par gravité | moule métallique permanent | par gravité : sprue, runner, ingate au parting line ; risers sur les masses |
| **Sand casting** (`sand_casting`) | moulage au sable | sable, cope et drag autour d'un pattern, détruit au décochage | par gravité ; des cores en sable font les creux, il n'y a pas de slide |

L'alliage choisit ses procédés : A380 et Zamak 3 vont en HPDC ; A356-T6 va en sand casting, en permanent mold ou en LPDC —
l'Atelier propose alors les trois, en boutons, et la pièce garde le procédé choisi.

## Les chiffres, par procédé

| | Injection molding | HPDC | LPDC | Permanent mold | Sand casting |
|---|---|---|---|---|---|
| Paroi (sans donnée matière) | 1,0 à 4,0 mm, usuelle 2,5 | 1,5 à 4,5 mm, usuelle 2,5 | 3 à 10 mm, usuelle 4 | 4 à 12 mm, usuelle 5 | 4 à 12 mm, usuelle 5 |
| Longueur d'écoulement / paroi | 150 | 110 | 80 | 70 | 60 |
| Rayon intérieur / paroi | 0,5 | 0,6 | 0,6 | 0,75 | 0,75 |
| Nervure / paroi, hauteur / paroi | 0,55 · 3 | 0,8 · 4 | 0,8 · 4 | 0,8 · 4 | 0,8 · 4 |
| Bossage / trou | 2,0 | 2,5 | 2,5 | 2,5 | 2,5 |
| Draft extérieur / cores | 1° / 1° | 1° / 2° | 2° / 3° | 2° / 3° | 2° / 3° |
| Filetage | insert | taraudé après coulée | taraudé après coulée | taraudé après coulée | taraudé après coulée |
| Surépaisseur d'usinage | — | 0,5 mm | 1,5 mm | 1,5 mm | 2,5 mm |

Ce sont des règles de pouce d'usage courant, réunies dans `MOLD_RULES` : elles dimensionnent une première pièce, elles
ne remplacent pas l'avis du mouliste ni la fiche de la matière achetée. **Les deux colonnes nouvelles sont les moins
sûres** : la paroi minimale du LPDC (environ 3 mm) et celle du permanent mold (un guide de fonderie demande 4,6 mm,
d'autres 3 à 4,5 mm) ont été vues en extrait ; leur draft, leur surépaisseur et leur longueur d'écoulement sont pris
entre le die casting et la gravité, sans lecture. Chaque fiche le dit (`basis`).

## La pièce pensée par son mold

Une pièce moulée est ce que son moule laisse sortir. L'onglet **Mold** de la pièce (studio de pièce, à côté de DFx) le
montre et le fait choisir ; tout vient de `web/js/core/mold_plan.js`, pur et testé.

| Question | Ce que la plateforme en fait |
|---|---|
| **Par où la matière entre — le gate** | Des tuiles, une par gate que le procédé accepte, avec son pictogramme : Pin gate / hot tip, Edge gate, Submarine (tunnel) gate, Direct sprue gate, Valve gate en injection ; Ingate, runner and overflows en HPDC ; Bottom gate (riser tube) en LPDC ; Sprue, runner and ingate par gravité. Puis la face ou le côté. Le gate proposé est un **exemple** : ses tuiles clignotent et le guide le demande, jusqu'à ce qu'il soit choisi ou confirmé. |
| **Où le mold s'ouvre — pull et parting line** | Le pull est celui de la pièce (`mold.pull`) ; le parting line court au bord supérieur d'une coque, ou autour de la face plane d'un couvercle ou d'une platine. Il est tracé en rouge sur le modèle, avec la flèche du pull. |
| **Le mold se ferme-t-il simplement, ou a-t-il des slides** | Toute face latérale qui porte une ouverture, un trou ou une fixation demande un **slide** (un **core** en sable en sand casting) ; chaque crochet de clip un **lifter**. Sans rien de tout cela : « Open / close », deux moitiés. Une flèche orange par slide sur le modèle ; le guide rappelle ce que chacun coûte et comment le supprimer. |
| **Où sont les risers** | En LPDC, permanent mold et sand casting : un riser au-dessus de chaque masse isolée qui atteint le haut du moule (un bossage, plusieurs s'ils se touchent), dessiné sur son col ; sans masse, un au milieu de chaque grand côté. Diamètre par la règle des modules : module du riser ≥ 1,2 × celui de la masse, col ≥ 1,1 ×. On peut les placer à la main (`mold.risers`). En HPDC, pas de riser : overflows et vents, à l'opposé de l'ingate. |
| **Ce qui reste sur la pièce — witness marks** | La liste, en couleurs : gate vestige (ce qu'il laisse, ce qu'on en fait — arasé, cisaillé, scié puis poncé / *buffed*), parting line et flash, ejector pin marks côté core, lignes de témoin des slides, pastille de chaque riser une fois scié, meulé et poncé (elle disparaît sur une face reprise en usinage), traces des overflows. |
| **Les faces d'aspect** | Six boutons : les faces où rien ne doit se voir. Un gate, des ejector pins ou un riser sur une de ces faces, et le guide le dit — « à corriger » pour le gate. |

Les **notes du dessin** s'écrivent d'elles-mêmes (mold, gate et vestige, risers, ejector pin marks) et un bouton les porte
sur la pièce. Le bouton **Copier pour une IA ou un mouliste** copie le plan de moule en clair, la consigne et la pièce en
`.dwiz` ; la réponse revient par l'import habituel, avec l'aperçu des changements.

Dans le fichier, le bloc `mold` gagne trois clés, toutes facultatives : `gating { kind, side }` (le gate choisi),
`cosmetic [faces]` et `risers [{ at [u, v], d }]` (risers placés à la main).

**Ce que cela ne fait pas.** Ni simulation de remplissage, ni calcul de solidification : le gate est placé au centre d'une
face ou au milieu d'un côté, pas optimisé. Le nombre de risers n'est pas calculé à partir d'une distance d'alimentation ;
le module d'une masse est estimé par sa forme simple (plaque : épaisseur / 2 ; fût : diamètre / 4), pas mesuré sur la
pièce. Le parting line est un plan, tracé sur l'enveloppe de la pièce. Les hauteurs de vestige sont des ordres de
grandeur d'un seul guide de fournisseur. Les slides sont comptés par face, sans vérifier leur course. Le mouliste et la
fonderie ont le dernier mot.

## Dans le fichier de la pièce

```
stock molded
mold process=injection_molding pull=+Z parting="bord supérieur" wall=2.5 draft=1 draft_inside=1 modelled arch=shell closure=screws slides=1 machined=0
do tub coque size=[L, W, H] wall=wall rc=rc rf=rf draft=dp
```

`mold` porte ce que le mouliste doit savoir et ce que le couvercle doit lire : le sens de démoulage, le plan de joint, la
dépouille et si elle est modélisée, l'architecture, la fermeture (et les cotes des clips), le nombre de tiroirs et
d'éjecteurs inclinés, la surépaisseur des faces reprises, le seuil et l'éjection proposés.

## Le draft dans le langage de pièce

- **`tub`** — la cuve moulée : `size` (extérieur au bord), `wall`, `rc` et `rf` (rayons extérieurs des angles et du fond),
  `draft` en degrés. L'extérieur et l'intérieur sont chacun un bloc qui penche puis reçoit ses rayons ; l'un est retiré
  de l'autre. Aucune surface décalée : la construction tient pour toutes les parois et tous les angles essayés
  (4 tailles × 3 parois × 4 angles).
- **`draft`** sur `boss` (un cône, diamètre gardé au sommet) et sur `pad` (plus large au pied).
- **`draft`** en opération : penche les faces du corps qui courent le long du démoulage, autour d'un plan neutre.

Décochez « Dépouille modélisée » dans l'Atelier pour un modèle droit : la dépouille est alors seulement déclarée, et le
bilan DFx le rappelle.

## Ce qui vérifie la pièce

- **Plastique** : les règles `MLD-01` à `MLD-11` (paroi, dépouille — lue dans le modèle —, bossages, rayons, longueur
  d'écoulement, parois uniformes, broches de noyau, déformation des clips).
- **Métal** : le livre de fonderie `CST-01` à `CST-08` (`web/js/analysis/dfx_rules_casting.js`) — paroi dans la plage
  de l'alliage, dépouille, rayons, bossages, reprises d'usinage, trous venus de fonderie, sections massives, tiroirs.
  L'anneau laissé autour d'un taraudage usiné après coulée n'est pas compté comme une paroi de fonderie.
- Les épaisseurs sont **mesurées sur le maillage** de la pièce construite : une lame mince ou une masse ne se cachent
  pas. Un point qui paraît épais est remesuré en travers : une nervure vue dans sa hauteur n'est pas prise pour une masse,
  et l'uniformité se juge contre la paroi elle-même (une nervure à 55 % de la paroi est mince exprès). Les tests construisent la pièce dans le vrai noyau pour quatre matières et exigent zéro erreur et zéro avis.

La gamme de fabrication ([GAMMES.md](GAMMES.md)) suit : mise en forme au moule, dégrappage ou détourage, pose des
inserts ou reprises d'usinage, avec les questions à poser au mouliste (plan de joint, points d'injection, porosité).

## Limites

- Trois architectures : coque ouverte sur le dessus, couvercle à lèvre, platine nervurée. Pas encore de charnière,
  de surmoulage, de couvercle à jupe extérieure ni de joint d'étanchéité.
- La dépouille est modélisée sur les parois, les bossages, les goussets et les nervures ; les colonnettes courtes des
  interfaces, les lames de clip et la tranche d'un couvercle restent droites. Le crochet d'un clip n'a pas son chanfrein
  d'entrée, et les têtes de vis d'un couvercle ne sont pas noyées.
- L'export Onshape écrit la cuve droite (boîte, congés, coque) et signale la dépouille à y appliquer.
- Ni simulation de remplissage, ni calcul de retassure, ni coût d'outillage : les règles sont géométriques.
- Dans un boîtier profond, la partie d'un bossage que les deux broches n'atteignent pas reste pleine : le compagnon le
  dit et propose de porter la fermeture sur le couvercle.
- Les chiffres n'ont pas été relus par un mouliste.
