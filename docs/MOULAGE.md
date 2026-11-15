# La pièce moulée

Dans l'Atelier (*Shop*), « Moulage » est une matière première comme une autre : on ne prend rien sur l'étagère, la
matière remplit un moule. La différence est que **la pièce se dessine d'elle-même**. Le concepteur dit trois choses :

1. **ce qu'elle contient** — le volume à loger (longueur, largeur, hauteur) et les interfaces de ce qui se fixe
   dedans (case « à l'intérieur » : une carte, un module, sur colonnettes) ;
2. **ce qu'elle rencontre dehors** — couvercle, fixations sous le fond, ouvertures dans les parois ;
3. **sa matière** — c'est elle qui choisit le procédé : un plastique s'injecte, un alliage de fonderie se coule sous
   pression (A380, Zamak 3) ou par gravité (A356-T6).

La synthèse (`web/js/core/shop_mold.js`) écrit alors une pièce ordinaire du langage (`box`, `fillet`, `shell`, `boss`,
`pad`, `hole`, interfaces) : tout reste modifiable, paramètre par paramètre, dans le studio de pièce.

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
| **Dépouille et plan de joint** | déclarés pour le mouliste dans `mold` (le modèle reste droit) |

Chaque décision est écrite en clair sous la pièce proposée (« Ce que le compagnon a décidé »).

## Les chiffres, par procédé

| | Injection plastique | Fonderie sous pression | Fonderie par gravité |
|---|---|---|---|
| Paroi (sans donnée matière) | 1,0 à 4,0 mm, usuelle 2,5 | 1,5 à 4,5 mm, usuelle 2,5 | 4 à 12 mm, usuelle 5 |
| Longueur d'écoulement / paroi | 150 | 110 | 60 |
| Rayon intérieur / paroi | 0,5 | 0,6 | 0,75 |
| Nervure / paroi, hauteur / paroi | 0,55 · 3 | 0,8 · 4 | 0,8 · 4 |
| Bossage / trou | 2,0 | 2,5 | 2,5 |
| Dépouille extérieure / noyaux | 1° / 1° | 1° / 2° | 2° / 3° |
| Filetage | insert | taraudé après coulée | taraudé après coulée |
| Surépaisseur d'usinage | — | 0,5 mm | 2,5 mm |

Ce sont des règles de pouce d'usage courant, réunies dans `MOLD_RULES` : elles dimensionnent une première pièce, elles
ne remplacent pas l'avis du mouliste ni la fiche de la matière achetée.

## Dans le fichier de la pièce

```
stock molded
mold process=injection_molding pull=+Z parting="bord supérieur" wall=2.5 draft=1 draft_inside=1 slides=1 machined=0
```

`mold` porte ce que le modèle ne dessine pas : le sens de démoulage, le plan de joint, les dépouilles à porter au
moule, le nombre de tiroirs, la surépaisseur des faces reprises, le seuil et l'éjection proposés.

## Ce qui vérifie la pièce

- **Plastique** : les règles `MLD-01` à `MLD-10` (paroi, dépouille, bossages, rayons, longueur d'écoulement, parois
  uniformes, broches de noyau).
- **Métal** : le livre de fonderie `CST-01` à `CST-08` (`web/js/analysis/dfx_rules_casting.js`) — paroi dans la plage
  de l'alliage, dépouille, rayons, bossages, reprises d'usinage, trous venus de fonderie, sections massives, tiroirs.
  L'anneau laissé autour d'un taraudage usiné après coulée n'est pas compté comme une paroi de fonderie.
- Les épaisseurs sont **mesurées sur le maillage** de la pièce construite : une lame mince ou une masse ne se cachent
  pas. Les tests construisent la pièce dans le vrai noyau pour quatre matières et exigent zéro erreur et zéro avis.

La gamme de fabrication ([GAMMES.md](GAMMES.md)) suit : mise en forme au moule, dégrappage ou détourage, pose des
inserts ou reprises d'usinage, avec les questions à poser au mouliste (plan de joint, points d'injection, porosité).

## Limites

- Une seule architecture : la **coque ouverte sur le dessus** (boîtier, capot, carter). Pas encore de pièce pleine
  nervurée, de clips, de charnières ni de surmoulage.
- La **dépouille n'est pas modélisée** : elle est déclarée, et son effet sur les jeux est chiffré dans le bilan DFx.
- Ni simulation de remplissage, ni calcul de retassure, ni coût d'outillage : les règles sont géométriques.
- Dans un boîtier profond, la partie d'un bossage que les deux broches n'atteignent pas reste pleine : le compagnon le
  dit et propose de porter la fermeture sur le couvercle.
- Les chiffres n'ont pas été relus par un mouliste.
