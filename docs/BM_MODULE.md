# BM 8s8p - 21700 — le module de batterie, itéré avec JP

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

## Itération 3 — le support de cellules

Choix de JP, par menu (21 novembre) : **le support de cellules**.

- **Ce que la géométrie laisse** : dans une rangée, les cellules se suivent au pas de 21,7 mm et une P45B fait 21,55 mm au
  plus — il reste **0,15 mm entre deux cellules** : aucune paroi ne passe entre elles. Le support les tient là où il y a de
  la place : **une épine** dans le jeu de 3 mm entre les deux rangées, dont les **dents** s'avancent entre les cellules de
  chaque rangée, et **une barre** dans chaque jeu de 3 mm des petits bouts. Sur les grands côtés, l'isolant de flanc et la
  jambe du busbar tiennent les cellules.
- **Une poche autour de chaque cellule**, Ø 21,8 mm : **0,125 mm de jeu au rayon** sur la plus grosse P45B que la fiche
  permet (Ø 21,55 mm). Les dents **tiennent** la cellule, elles ne la pincent pas : la tenue par frottement ou par collage
  est à choisir.
- **Moulable, d'après les règles de l'outil** : le premier jet avait deux défauts que le bilan DFx a relevés — la pointe des
  dents tombait à 0,12 mm, et là où quatre cellules se rencontrent l'épine faisait un bloc d'environ 11 mm (retassures).
  Les dents s'arrêtent donc à **4 mm de l'axe de la rangée** (pointe de 1,4 mm, au-dessus du minimum de 1,2 mm du PC/ABS
  que l'outil retient), et un **noyautage** traverse chaque bloc — Ø 8 mm entre quatre cellules, Ø 5,2 mm à chaque bout —
  en laissant des parois de 1,5 mm. Bilan : **aucune erreur ; un avertissement** (MLD-08, parois non uniformes, 1,9:1 pour
  1,5:1 conseillé) — les dents s'épaississent vers l'épine (2,3 mm en médiane, 4,4 mm pour les 10 % les plus épaisses,
  mesurés sur le maillage) : à évider à une prochaine itération.
- **Le flex garde son passage** : chaque barre s'arrête à 1,2 mm du bout du CORE ; les doigts du flex descendent à 0,8 mm
  du bout, 0,2 mm d'épaisseur — le noyau 3D vérifie qu'ils ne touchent pas la barre.
- **Deux supports identiques par CORE** (`BM-HOLDER`) : l'un en haut des cellules, contre le busbar +, l'autre en bas,
  contre le busbar −, 8 mm de haut chacun (exemple). Une seule pièce, d'un seul tenant (≈ 4,9 cm³, ≈ 5,6 g en PC/ABS) ;
  **moulée par injection**, PC/ABS d'une nuance V-0 à choisir (exemple, aucune fiche de matière lue). Le module compte
  désormais **128 pièces**, dont 16 supports.
- **Vérifié par le noyau 3D** : la pièce se construit sans erreur, d'un seul solide ; dans le CORE, les deux supports ne
  traversent ni cellule, ni busbar, ni isolant, ni flex, ni carte.
- **Pas encore dessiné** : la dépouille, les détrompeurs, les congés, l'emboîtement d'un CORE au suivant ; **non analysé** :
  la tenue mécanique (aucun calcul de vibration ni de choc).

## Itération 4 — le busbar laminé, le flex en boîte, une CTN sous chaque cellule

Consignes de JP (21 novembre) : « 2 busbars en L pourraient être joints dans un busbar laminé en forme de 8, en multicouche
avec Nomex entre les conducteurs et une enveloppe isolante mince externe, pour assembler une seule pièce sur la ligne » ;
« même stratégie PCBA + PCB flex, mais il arriverait en feuille avec des pré-plis pour le rabattre en forme de boîte en
déposant le core + busbar sur la section centrale, puis l'assemblage PCB serait replié jusqu'à ce que le PCB rigide soit
déposé sur le top des busbars » ; « joindre les panneaux verticaux du flex même si les traces ne font pas la largeur » ;
des CTN sous le centre des cellules, par des rondelles. Le menu des choix n'a pas pu s'afficher deux fois : construit avec
les choix conseillés, dits ici et faciles à changer.

- **Lecture retenue du « 8 »** : les deux L d'un même CORE — le + (sur les bornes +, puis le flanc +Y) et le − (sous les
  fonds, puis le flanc −Y) — deviennent **une seule pièce laminée** (`BM-BB-LAM`, `demo/demo_bm_lam.js`) : deux conducteurs
  de cuivre, du **papier aramide** (0,25 mm, exemple) entre le cuivre et les cellules, une **enveloppe en film PET** (0,1 mm,
  exemple) dehors. Le contact série reste celui que JP a gardé à l'itération 2 : la jambe + d'un CORE presse la jambe − du
  suivant ; l'enveloppe laisse ces faces nues. Le CORE et son busbar forment un bloc, posé d'un geste sur le flex.
  **Autre lecture possible**, à dire si c'est elle : un « Z » par liaison série (le dessus du CORE k, la cloison et le dessous
  du CORE k+1 dans le même cuivre) — il supprimerait les contacts pressés à 360 A, mais une pièce enjamberait deux CORE.
- **Un défaut des itérations 1 à 3 corrigé** : la plaque + reposait sur tout le dessus des cellules. Sur une vraie 21700, le
  bord serti autour de la calotte + est le godet, au −. Le papier passe maintenant entre les deux, avec une **fenêtre au droit
  de chaque calotte** et un **bossage de soudure** dedans. La fiche de la P45B (p. 2) ne cote ni la calotte ni le bord serti :
  fenêtre de 8 mm en exemple.
- **Une CTN sous le centre de chaque cellule** : la plaque − est percée d'un trou de 6 mm sous chaque cellule ; les soudures −
  se font de part et d'autre, à 6,5 mm du centre (exemples). La CTN est sur le flex, dans le trou ; sa **rondelle thermique**
  (`BM-PUCK`, pad silicone chargé, Ø 5 × 1,55 mm, exemple) la presse contre le godet. Posée sur la CTN quand le flex est à plat,
  la rondelle est centrée par le trou quand le CORE descend.
- **Le flex en boîte** (`BM-FLEX-BOX`, `demo/demo_bm_box.js`) : livré à plat, avec ses pré-plis. Sa **section centrale** est
  sous le CORE, sur l'enveloppe du busbar, et porte les 8 CTN et la prise B−. **Deux panneaux pleine largeur** (44 mm) se
  relèvent aux petits bouts, dans les jeux de 3 mm — les grands côtés sont aux jambes du busbar, qui pressent le CORE voisin.
  Le panneau X− se rabat sur le dessus et continue dans la carte rigide (un **rigid-flex** : le joint flex-carte de
  l'itération 2 disparaît) ; le rabat X+ prend B+ par une fenêtre de l'enveloppe. La carte rigide est posée sur le busbar.
- **La brique du flex s'étend** (`core/flex_tree.js`) : des **points sur le cœur** (`spots`), sonde ou prise posée sur la face
  tournée vers ce qu'elle surveille, et une **patte de prise de largeur choisie** (`tabW`) sur une branche large. L'écran du
  flex les montre, il ne les édite pas encore.
- **Vérifié par le noyau 3D** : toutes les pièces se construisent ; dans le CORE, rien ne traverse rien — busbar, flex,
  rondelles, supports, carte, cellules. Pas d'un CORE au suivant : **50,9 mm** (46,4 + 2 × (0,25 + 2,0)). Le module compte
  **168 pièces** (21 par CORE).

### Retour DFM (demandé par JP)

- **Le busbar laminé** : une pièce de moins à poser, et le papier remplace les isolants de flanc. Mais un laminé plié sur trois
  faces se lamine sur un gabarit en forme, ou se plie après lamination avec de grands rayons : **à voir avec un fabricant**.
  La brique de laminé de l'outil (`core/busbar_lam.js`) ne fait que des laminés plats.
- **La soudure** : on ne soude pas au laser 2 mm de cuivre sur une calotte. Il faut une languette mince par cellule, ou un
  bossage formé dans une zone amincie, qui reprend aussi la tolérance de hauteur (± 0,15 mm, fiche p. 2) et la dilatation : la
  fiche demande de ne pas forcer sur les bornes et de ne pas forcer ni tourner la borne + (§ 7.4.1 et 7.4.3, p. 12). Les
  bossages dessinés montrent la place, pas la manière.
- **Le flex en boîte** : excellent pour la fabrication. Tout se pose à plat en un seul passage SMT, CTN comprises ; le CORE se
  dépose d'un geste ; un rigid-flex supprime le joint flex-carte. Prévoir des dégagements aux coins et aucun cuivre dans un
  coin, croiser les plis à 90° ; le pré-pliage se valide avec le fournisseur du flex (la règle de rayon de l'outil, 6 fois
  l'épaisseur, est une règle de pouce non vérifiée). La carte rigide sur le busbar demande une couche isolante dessous — la
  fiche recommande une barrière plastique entre cellule et PCBA (§ 8.3, p. 13) : l'enveloppe en tient lieu ici, à confirmer.
- **Les rondelles et le support** : les combiner se fait, dans cet ordre de préférence — (1) poser les rondelles sur le flex
  à plat (c'est ce qui est dessiné : flex et rondelles forment un sous-ensemble, que le trou centre) ; (2) fixer le flex au
  support du bas par **heat staking** (des plots du support fondus à travers des trous du flex) ; (3) intégrer les rondelles
  au support demande un **fond** au support, sous les cellules, avec des fenêtres pour les soudures − : possible, mais plus de
  matière et une soudure à travers le support. **Surmouler le flex dans du PC/ABS est à éviter** : la matière injectée est
  plus chaude que le point de fusion des soudures sans plomb (ordre de grandeur courant, non relu ici) ; pour encapsuler une
  CTN, mieux vaut un moulage basse pression en hot-melt, que l'outil ne décrit pas encore.
- **La mesure** : au centre du fond, la CTN lit la cellule et non le cuivre, qui moyenne tout ; l'éloigner du bord du trou.
  **À demander à Molicel** : la P45B a-t-elle un évent au fond ? La fiche ne le dit pas ; si oui, ni rondelle ni pad dessus.

## Ce qu'il contient

| Élément | Ce que c'est | Où |
|---|---|---|
| Carte de CORE 1S8P | la carte du PCBA (`CORE-1S8P-PCBA`, 92,8 × 46,4 mm) et son jumeau mécanique `CORE-1S8P-PCBA-PCB` | Électronique › PCBA ; Pièces |
| Cellule 21700 du CORE | `BM-CELL-21700`, l'enveloppe la plus grande publiée pour une 21700 (Ø 21,7 × 70,8 mm), bornes soudables | Pièces |
| Busbar laminé du CORE | `BM-BB-LAM` : le conducteur + (bornes +, flanc +Y) et le conducteur − (fonds, flanc −Y) en une pièce, papier aramide côté cellules, film PET dehors, fenêtres et bossages de soudure, un trou sous chaque cellule | Pièces |
| Flex en boîte du CORE | `BM-FLEX-BOX` : la section centrale sous le CORE (8 CTN, B−), deux panneaux pleine largeur aux petits bouts, le X− continue dans la carte (rigid-flex), le rabat X+ prend B+ | Pièces |
| Rondelle thermique d'une CTN | `BM-PUCK` : un disque de pad thermique dans le trou de la plaque −, entre la CTN et le godet ; huit par CORE | Pièces |
| Support de cellules du CORE | `BM-HOLDER` : une épine entre les rangées, deux barres aux bouts, une poche par cellule, cinq noyautages ; deux par CORE | Pièces |
| CORE 1S8P | `BM-CORE-ASM` : 8 cellules en deux rangées de 4, deux supports, le busbar laminé, le flex en boîte, 8 rondelles, la carte dessus | Assemblage |
| BM 8s8p - 21700 | `BM-8S8P-ASM` : 8 CORE côte à côte, tous dans le même sens | Assemblage |

## La géométrie, telle que dessinée

- **Repère d'un CORE** : X le long d'une rangée de 4 (92,8 mm), Y en travers des deux rangées (46,4 mm), Z vers le haut ;
  les cellules sont posées sur z = 0. Le busbar laminé est dessiné dans ce repère : leur place dans le CORE
  est l'origine, ce qui les rend faciles à reprendre.
- **Le dessus d'un CORE** = 4 × 21,7 + 2 × 3 = 92,8 mm par 2 × 21,7 + 3 = 46,4 mm : les cellules d'une rangée se touchent,
  3 mm aux deux bouts et entre les rangées — la taille de la carte.
- **La série** : la jambe + d'un CORE presse la jambe − du CORE suivant, face contre face (itération 1 : 49,4 mm d'un CORE
  au suivant avec 1 mm de cuivre ; itération 2 : 51,4 mm avec 2 mm ; itération 4 : 50,9 mm, le papier aramide de 0,25 mm
  remplaçant l'isolant de 0,5 mm).
- La jambe + s'arrête à 5 mm du bas, la jambe − à 5 mm du haut : aucune des deux ne frôle la plaque de l'autre polarité
  de son propre CORE (exemple, paramètre `z0`).

## Ce qui est un exemple, et ce qui n'est pas dessiné

**Exemples, à itérer** (dits sur chaque pièce, en paramètres) : le papier aramide (0,25 mm), l'enveloppe (0,1 mm), le retrait
des jambes (5 mm), les fenêtres, les bossages et les trous du busbar, la rondelle thermique, la hauteur et la matière du
support. Le cuivre (2,0 mm) est dimensionné, par un
modèle simple. Les pièces sont posées à leur place (« fixe »), sans accouplements : les soudures cellule ↔ busbar et les
CTN ↔ busbar ne sont pas encore des interfaces appariées, d'où les « interfaces sans jumelle » que l'écran signale.

**Pas encore dessiné** : les languettes de soudure minces (les bossages en tiennent la place) ; le chant du cuivre aux
petits bouts, nu ; la dépouille du support de cellules ; les bornes du module (B+ au bout du dernier CORE, B− au bout du premier) ; le boîtier longitudinal ; le BMS
central, ses connecteurs et le faisceau RS-485.

**Non vérifié** : l'échauffement réel du cuivre dans le module fermé (le modèle est une barre seule à l'air libre) ; la
chaleur des cellules elles-mêmes à 45 A (la fiche donne ≤ 8 mΩ à 1 kHz à l'expédition, pas la résistance en courant
continu) ; la tenue des plis du flex à l'assemblage ; la lamination d'une pièce pliée sur trois faces ; la mesure par
la rondelle (aucun essai) ; la tenue des cellules dans leur support
(vibration, choc) ; l'isolation entre CORE ; la conformité de quoi que ce soit.
