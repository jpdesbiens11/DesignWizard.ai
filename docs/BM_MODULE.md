# BM 8s8p - 21700 — le module de batterie, première itération

Demande de JP (21 novembre 2026) : « créer un nouveau projet pour ces pièces et assembly qui s'appelle BM 8s8p - 21700 et
tout mettre ce qui a trait au core 1s8p dedans… commencer un assembly des 8 cores pour voir où on en est et après on
itérera ensemble le design ».

Le projet s'ouvre depuis l'accueil, carte **« BM 8s8p - 21700 »** (exemples) : il est créé dans votre espace comme un
projet à vous, ouvert sur l'assemblage du module. Source : `web/js/demo/demo_bm.js` ; essais :
`tests/node/bm_project.test.mjs`. L'architecture qui fait foi est celle de JP (CLAUDE.md, point 20).

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
- **La série** : la jambe + d'un CORE (face extérieure à y = 46,4 + 0,5 + 1,0 = 47,9 mm) presse la jambe − du CORE suivant,
  face contre face. D'un CORE au suivant : **49,4 mm** (`CORE_PITCH`). Le module mesure 93 × 395 × 80 mm et pèse
  6,1 kg (64 cellules à l'enveloppe la plus grande, 16 busbars de cuivre, 8 cartes).
- La jambe + s'arrête à 5 mm du bas, la jambe − à 5 mm du haut : aucune des deux ne frôle la plaque de l'autre polarité
  de son propre CORE (exemple, paramètre `z0`).

## Ce qui est un exemple, et ce qui n'est pas dessiné

**Exemples, à itérer** (dits sur chaque pièce, en paramètres) : l'épaisseur du cuivre (1,0 mm), celle de l'isolant
(0,5 mm de papier aramide), le retrait des jambes (5 mm). Les pièces sont posées à leur place (« fixe »), sans
accouplements : les soudures cellule ↔ busbar ne sont pas encore des interfaces appariées, d'où les « interfaces sans
jumelle » que l'écran signale.

**Pas encore dessiné** : les fenêtres de soudure laser ; le flex plié en G (le dessus, deux côtés, deux rabats de
4 CTN sous les cellules) ; un support de cellules ; le passage du flex dans les jeux de 3 mm ; les bornes du module
(B+ au bout du dernier CORE, B− au bout du premier) ; le boîtier longitudinal ; le BMS central, ses connecteurs et le
faisceau RS-485.

**Non vérifié** : la lecture des « busbars en U insérés par le dessus » — dessinée ici comme deux busbars en L par CORE
dont les jambes se pressent — est à confirmer par JP ; la fiche de la cellule (une 21700 de type Molicel P45B) n'a pas
été lue ; aucun calcul d'échauffement du cuivre n'est fait ; l'isolation entre CORE n'est pas analysée.
