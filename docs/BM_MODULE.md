# BM 8s8p - 21700 — le module de batterie, première itération

Demande de JP (21 novembre 2026) : « créer un nouveau projet pour ces pièces et assembly qui s'appelle BM 8s8p - 21700 et
tout mettre ce qui a trait au core 1s8p dedans… commencer un assembly des 8 cores pour voir où on en est et après on
itérera ensemble le design ».

Le projet s'ouvre depuis l'accueil, carte **« BM 8s8p - 21700 »** (exemples) : il est créé dans votre espace comme un
projet à vous, ouvert sur l'assemblage du module. Source : `web/js/demo/demo_bm.js` ; essais :
`tests/node/bm_project.test.mjs`. L'architecture qui fait foi est celle de JP (CLAUDE.md, point 20).

## Itération 2 — la cellule lue, le cuivre dimensionné, le flex en G

Choix de JP, par menu (21 novembre) : **garder les L pressés** ; dimensionner le cuivre pour **le courant continu maximal
de la Molicel P45B, en charge et en décharge, la valeur la plus élevée**, en 8s8p ; puis **le flex plié en G**.

- **La cellule** est la **Molicel INR-21700-P45B** de la bibliothèque (`21700-P45B`), avec les valeurs de sa fiche lue page
  par page — « Cell Specifications of INR-21700-P45B », INR21700P45B-01, ver. 0.2 : p. 2 Ø 21,40 ± 0,15 × 70,00 ± 0,15 mm,
  70,0 g au plus ; p. 3 **45 A en décharge continue au plus, 9 A en charge continue au plus**, 3,6 V nominal, 4,20 V en fin
  de charge, 2,5 V en fin de décharge, ambiante −40 à 60 °C en décharge ; p. 8 la conformité qu'elle cite ; p. 13 la
  conception d'un pack. D'autres versions de cette fiche, citées par des revendeurs, donnent d'autres valeurs de charge :
  seule la version 0.2 a été lue.
- **Le courant d'un CORE** : la plus grande des deux valeurs, 45 A, × 8 cellules en parallèle = **360 A**, le même dans toute
  la série.
- **Le cuivre** : le modèle « Busbar » de l'outil (barre en convection naturelle, 40 °C autour, la jambe de 86,8 mm × l'épaisseur,
  100 mm de chemin) donne à 360 A :

| Épaisseur | Température | Densité de courant | Verdict |
|---|---|---|---|
| 1,5 mm | 53,7 °C | 2,76 A/mm² | au-dessus du repère de 2,5 A/mm² |
| 1,6 mm | 53,0 °C | 2,59 A/mm² | au-dessus du repère |
| **2,0 mm** | **50,6 °C** | **2,07 A/mm²** | **les deux critères tiennent** |

  Les critères : la barre reste sous **60 °C, l'ambiante que la fiche admet en décharge** (le busbar touche les cellules), et
  sous le repère de 2,5 A/mm² de l'outil. Le calcul est **gardé dans le projet** au nom du busbar + (Physique, « Busbar + du
  CORE — 360 A ») : on le rouvre, on change l'épaisseur, on le refait. C'est une barre seule à l'air libre : dans le module
  fermé, entre deux CORE, l'échauffement réel est plus fort — à vérifier par un essai ou par la Simulation.
- **Les busbars s'arrêtent aux jeux de 3 mm** des petits bouts (86,8 mm de long) : ces jeux sont pour le flex. Le pas d'un
  CORE au suivant devient **51,4 mm** (46,4 + 2 × (0,5 + 2,0)) ; le module mesure 93 × 411 × 80 mm.
- **Le flex en G** (`BM-FLEX-G`, dessiné par le circuit flexible ramifié de l'outil) : son cœur est sous la carte, collé sur le
  busbar + par 0,1 mm d'adhésif ; à chaque petit bout, **le rabat est découpé en 4 doigts** qui sortent du cœur, plongent dans
  le jeu de 3 mm (à 0,8 mm du bout du CORE), se replient sous le CORE et courent sous le busbar − jusqu'à la cellule qu'ils
  surveillent : **une CTN par cellule**, sous le doigt, sa face plate contre le cuivre, au droit de l'axe de la cellule (à 4 mm
  de côté). Deux doigts de plus ramènent **B+** (posé sur le busbar +) et **B−** (sous le busbar −) : la tension du CORE. Les
  plis ont 2 mm de rayon intérieur ; le noyau 3D vérifie que le flex ne traverse ni busbar, ni cellule, ni isolant.
- **La carte** monte de l'épaisseur du flex et de l'adhésif. La fiche de la cellule recommande une barrière isolante entre
  cellule et PCBA (p. 13) : le polyimide du flex en tient lieu sous la carte — à confirmer, il ne couvre pas les bords.

## Ce qu'il contient

| Élément | Ce que c'est | Où |
|---|---|---|
| Carte de CORE 1S8P | la carte du PCBA (`CORE-1S8P-PCBA`, 92,8 × 46,4 mm) et son jumeau mécanique `CORE-1S8P-PCBA-PCB` | Électronique › PCBA ; Pièces |
| Cellule 21700 du CORE | `BM-CELL-21700`, l'enveloppe la plus grande publiée pour une 21700 (Ø 21,7 × 70,8 mm), bornes soudables | Pièces |
| Busbar + du CORE | `BM-BB-POS` : la plaque sur les bornes +, sous la carte, et une jambe qui descend le long du grand côté +Y | Pièces |
| Busbar − du CORE | `BM-BB-NEG` : la plaque sous les fonds des cellules et une jambe qui monte le long du grand côté −Y | Pièces |
| Isolant de flanc du CORE | `BM-ISO-SIDE` : une feuille entre chaque jambe et les godets des cellules | Pièces |
| CORE 1S8P | `BM-CORE-ASM` : 8 cellules en deux rangées de 4, les deux busbars, deux isolants, la carte dessus | Assemblage |
| BM 8s8p - 21700 | `BM-8S8P-ASM` : 8 CORE côte à côte, tous dans le même sens | Assemblage |

## La géométrie, telle que dessinée

- **Repère d'un CORE** : X le long d'une rangée de 4 (92,8 mm), Y en travers des deux rangées (46,4 mm), Z vers le haut ;
  les cellules sont posées sur z = 0. Les busbars et les isolants sont dessinés dans ce repère : leur place dans le CORE
  est l'origine, ce qui les rend faciles à reprendre.
- **Le dessus d'un CORE** = 4 × 21,7 + 2 × 3 = 92,8 mm par 2 × 21,7 + 3 = 46,4 mm : les cellules d'une rangée se touchent,
  3 mm aux deux bouts et entre les rangées — la taille de la carte.
- **La série** : la jambe + d'un CORE presse la jambe − du CORE suivant, face contre face (itération 1 : 49,4 mm d'un CORE
  au suivant avec 1 mm de cuivre ; itération 2 : 51,4 mm avec 2 mm).
- La jambe + s'arrête à 5 mm du bas, la jambe − à 5 mm du haut : aucune des deux ne frôle la plaque de l'autre polarité
  de son propre CORE (exemple, paramètre `z0`).

## Ce qui est un exemple, et ce qui n'est pas dessiné

**Exemples, à itérer** (dits sur chaque pièce, en paramètres) : l'isolant de flanc (0,5 mm de papier aramide), le retrait
des jambes (5 mm), la largeur des doigts du flex (5 mm), l'adhésif (0,1 mm). Le cuivre (2,0 mm) est dimensionné, par un
modèle simple. Les pièces sont posées à leur place (« fixe »), sans accouplements : les soudures cellule ↔ busbar et les
CTN ↔ busbar ne sont pas encore des interfaces appariées, d'où les « interfaces sans jumelle » que l'écran signale.

**Pas encore dessiné** : les fenêtres de soudure laser ; le joint soudé du flex avec la carte (J-FLEX-12) ; un support de
cellules ; les bornes du module (B+ au bout du dernier CORE, B− au bout du premier) ; le boîtier longitudinal ; le BMS
central, ses connecteurs et le faisceau RS-485.

**Non vérifié** : l'échauffement réel du cuivre dans le module fermé (le modèle est une barre seule à l'air libre) ; la
chaleur des cellules elles-mêmes à 45 A (la fiche donne ≤ 8 mΩ à 1 kHz à l'expédition, pas la résistance en courant
continu) ; la tenue des plis du flex à l'assemblage ; l'isolation entre CORE ; la conformité de quoi que ce soit.
