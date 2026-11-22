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

## Itération 5 — le support du bas et ses rondelles, en une pièce

Choix de JP, par menu (21 novembre) : la lecture du « 8 » est confirmée — **une pièce laminée par CORE** ; ensuite,
**le support et les rondelles en un**.

- **Le support du bas a maintenant un fond** (`BM-HOLDER-BASE`, `coreBase` de `demo/demo_bm_holder.js`) : 1,5 mm de PC/ABS
  sous les cellules (exemple ; l'outil retient 1,2 à 3,5 mm pour ce matériau). Le fond **isole les godets de la plaque −** :
  le papier aramide n'est plus utile sous les cellules, le busbar laminé ne le porte plus que sur les bornes + et les
  flancs. La plaque − est sous le fond ; **deux fenêtres de soudure par cellule** (Ø 6 mm, à 7 mm du centre) laissent monter
  ses bossages jusqu'au godet.
- **Les rondelles sont des corps du support** : une pièce, deux matières — le support en PC/ABS et ses 8 rondelles en
  silicone chargé, souple et conducteur de chaleur, **moulées en deuxième injection (2K)**. Chaque rondelle (Ø 5 × 2,8 mm)
  part du fond de sa cellule, traverse le trou de la plaque − et repose sur sa CTN, sur le flex. Elle **centre aussi le busbar
  laminé** à la pose. Le surmoulage d'un silicone sur un thermoplastique est un procédé établi, mais la nuance, sa
  conductivité et son adhérence au PC/ABS sont à valider avec un mouleur : aucune fiche de matière n'a été lue.
- **Le support du haut** reste sans fond (`BM-HOLDER`) : en haut, le papier du laminé isole la plaque + des bords sertis.
- **Vérifié par le noyau 3D** : les pièces se construisent ; le support du bas est d'un seul tenant ; les rondelles
  remplissent leur logement sans traverser le support ; rien ne traverse rien dans le CORE. **Bilan DFx du support du bas** :
  aucune erreur ; un avertissement (MLD-08, parois non uniformes, 2,4:1 — le fond de 1,5 mm contre les dents, jusqu'à
  3,5 mm mesurés sur le maillage). Entre une rondelle et une fenêtre de soudure, 1,5 mm de fond.
- **Ce qui change ailleurs** : la pile sous les cellules passe à 3,6 mm (fond, cuivre, film) ; les panneaux du flex en boîte
  s'allongent d'autant. Le CORE compte **13 pièces**, le module **104**.
- **Pas fait** : le heat staking du flex au support — la plaque − est entre les deux, les plots devraient la traverser par
  des trous de plus dans le cuivre ; ce sont les rondelles qui posent le flex.

## Itération 6 — les 4 contacts entre deux CORE, pressés jusqu'à leurs butées

Demande de JP (21 novembre) : « simuler les 4 interfaces LV et HV sur les surfaces des busbars verticaux, forme circulaire
planaire, qui peuvent se déplacer sous la pression au bout des cores… jusqu'à ce qu'on arrive à des butées sur ces mêmes
busbars à la périphérie des contacts… le contact négatif est seulement un rond gravé avec écriture… tous les contacts +
sont des ressorts… le pourtour est gravé au laser ». Choix de JP, par menu : **LV = le signal RS-485 en daisy chain**,
**HV = la puissance du CORE, + d'un côté, − de l'autre** ; le ressort : **une couronne de lames**.

- **Lu ainsi** : sur chaque joint entre deux CORE, 4 contacts ronds — **2 HV** (les 360 A du CORE, 180 A chacun) et
  **2 LV** (RS-485 A et B). Sur la jambe + (+Y) d'un CORE, les **ressorts** ; sur la jambe − (−Y) du CORE suivant, des
  **plages planes**. Tout le module garde une seule variante de CORE : chaque CORE porte ses ressorts d'un côté et ses
  plages de l'autre (`demo/demo_bm_contacts.js`).
- **Le ressort : une couronne de lames-ponts** en cuivre-béryllium C17200 durci, estampée — deux anneaux plats tiennent
  les deux bouts de chaque lame, la lame bombée entre les deux. HV : 10 lames de 7 × 2,5 × 0,25 mm, argentées, Ø 26 mm,
  levée libre 0,65 mm (`BM-SPRING-HV`). LV : 4 lames de 4 × 1 × 0,1 mm, dorées, Ø 12,6 mm, levée libre 0,43 mm
  (`BM-SPRING-LV`). Exemples. Les couronnes sont dessinées **libres, telles qu'estampées**.
- **Les butées, à la périphérie** : autour de chaque ressort HV, un **anneau de cuivre** de 0,35 mm (Ø 28–32 mm) sur la
  jambe + ; autour de chaque ressort LV, le **rebord isolant de son insert**, à la même hauteur. Pressés jusqu'aux butées,
  deux CORE sont à **0,35 mm** l'un de l'autre : le pas d'un CORE au suivant passe à **51,25 mm**.
- **Les gravures au laser** : un cercle gravé (0,4 mm de large, 0,05 mm de profondeur, exemple) autour de chaque contact,
  sur les deux jambes ; côté −, la plage HV n'est que ce cercle sur le cuivre nu. Le **texte gravé** (HV 1, HV 2,
  RS-485 A, RS-485 B, + ou −) est écrit dans la note du busbar : l'outil ne dessine pas de texte gravé.
- **Les contacts LV sont des îlots** : une plage de cuivre (net RS485_A ou RS485_B) dans un insert isolant en PA66-GF30,
  posé dans un trou de Ø 17,4 mm de la jambe, sur le papier aramide. Le ressort LV de A ne touche que la plage A du CORE
  suivant, et B que B ; la butée LV est isolant contre isolant. Le fil qui monte le signal de la plage à la carte n'est
  **pas dessiné** (une queue du flex, ou un fil — à décider).
- **Le calcul : un nouveau modèle analytique**, « Spring contact · to its stop » (`spring_stop`, domaine Assemblages) :
  une lame tenue aux deux bouts et poussée au centre (k = 192 E I / l³), la flèche où sa fibre extrême atteint la limite
  élastique, puis, au-delà, **une courbe élasto-plastique choisie par l'outil** — l'effort tend vers 1,5 fois celui de la
  première plastification (rotule d'une section rectangulaire) ; la déformation permanente une fois relâchée ; la
  résistance de Holm des points de contact et celle des lames ; le courant qu'un point supporte. Les deux couronnes sont
  gardées dans le projet, avec leur calcul :
  - **Contact HV** : la lame descend de 0,30 mm pour 0,12 mm de course élastique — elle **passe en plastique, c'est
    voulu** (la demande de JP), et le verdict est « à vérifier ». À la butée : environ 42 N par lame, 420 N par contact,
    0,12 mm de déformation permanente, 28 µΩ par contact. Remonté, il redonne le même effort à la butée, en élastique
    (la relaxation n'est pas comptée).
  - **Contact LV** : 0,08 mm de descente pour 0,10 mm de course élastique — **élastique jusqu'à la butée**, 2,6 N par lame.
- **Ce que le noyau 3D vérifie** : toutes les pièces se construisent ; dans le CORE, rien ne traverse rien ; avec le CORE
  suivant posé au pas, **les butées se touchent et seules les crêtes des lames entrent** dans la plage d'en face — de
  0,30 mm (HV, dans le cuivre de la jambe −) et de 0,08 mm (LV, chacune dans SA plage) : la course que le modèle prend.
- **Ce qui change ailleurs** : le CORE compte **17 pièces** (4 couronnes de plus), le module **136**.
- **Retour DFM** : le **cuivre-béryllium** donne la meilleure tenue de ressort parmi les alliages de cuivre courants, mais
  l'usinage, le ponçage et la découpe laser dégagent des **poussières toxiques** — estampage, durcissement, revêtement et
  soudure chez un fabricant équipé ; un bronze au phosphore ou un cuivre-nickel-silicium sont des voies sans béryllium,
  moins raides (à comparer dans le modèle). Une lame qui passe en plastique **perd de l'effort avec le temps** (relaxation
  en température, non comptée) : un essai d'écrasement et de vieillissement fait foi. Les butées de cuivre conduisent
  aussi : en parallèle des lames, elles ajoutent un contact dont la résistance n'est pas calculée.
- **Pas fait** : l'effort qui presse le module (les plaques de bout, le boîtier) — 8 contacts × environ 420 N ne se tient
  pas sans elles ; les bornes du module ; le fil des plages LV jusqu'à la carte ; l'isolation entre les plages LV et le
  cuivre vue par l'écran Isolation ; un essai de l'écrasement.

## Itération 7 — le contact HV élastique, le marquage laser, et ce que l'estampage permet

Choix de JP, par menu (21 novembre) : **« Contact HV élastique »** — redimensionner les lames HV pour qu'elles restent
élastiques jusqu'à la butée, et comparer avec la version plastique. Puis, dans le même message : « est-ce vraiment possible
d'estamper ces formes ? elles ne sont pas marquées au laser autour de chaque contact — fais-le, et donne-moi ton avis sur
le contact ».

- **La clé : c'est la butée qui fixe l'écart, pas le ressort.** Deux CORE pressés se posent sur leurs butées : la lame ne
  voit que la tolérance de sa propre hauteur libre, de la butée et de la planéité des faces. L'outil le compte désormais :
  le modèle « Spring contact · to its stop » prend une **tolérance ± sur la course** (`tol`) et vérifie l'effort à la course
  la plus courte et l'élasticité à la plus longue (aussi dans le classeur Excel). Le projet la prend à **± 0,05 mm** (exemple).
- **Le contact HV élastique** : la même tôle (CuBe 0,25 mm), les mêmes 10 lames de 2,5 mm, **des lames plus longues**
  (7 → 9,5 mm) et **moins de course** (0,30 → 0,15 mm). La couronne passe à Ø 30,9 mm, sa butée de cuivre à Ø 33–36 mm ; les
  contacts HV s'écartent (± 24 mm du milieu), les îlots LV montent et descendent (± 18,5 mm).

  | Contact HV, à 180 A | Élastique (itération 7) | Plastique (itération 6) |
  |---|---|---|
  | Lames | 10 × 9,5 × 2,5 × 0,25 mm | 10 × 7 × 2,5 × 0,25 mm |
  | Course (± 0,05) | 0,15 mm — de 0,10 à 0,20 | 0,30 mm — de 0,25 à 0,35 |
  | Course élastique δy | 0,23 mm : **élastique au pire des cotes** | 0,12 mm : plastifie toujours |
  | Effort à la butée | 14,3 N par lame, **143 N** par contact (9,6 N par lame au plus court) | 42 N par lame, 421 N par contact |
  | Déformation permanente | **0** | 0,12 mm |
  | Résistance (points + lames) | **41 µΩ** (11 + 30) | 28 µΩ (7 + 22) |
  | Pertes par contact | 1,3 W | 0,9 W |
  | Densité dans une lame | 14,4 A/mm² | 14,4 A/mm² |

  **Ce qu'on paie pour rester élastique** : trois fois moins d'effort, 45 % de résistance en plus — surtout la résistance des
  lames, plus longues. **Ce qu'on gagne** : une couronne qui se reprend (démontage, réparation, reprise en usine), un effort
  connu à chaque pose, et 3 fois moins d'effort à tenir pour serrer le module (≈ 0,3 kN au lieu de ≈ 0,85 kN pour 2 contacts).
  La version plastique reste là pour comparer : **variante « Plastique — itération 6 »** de la pièce `BM-SPRING-HV`, et son
  calcul gardé dans le projet à côté de celui de la version élastique.
- **Le contact LV** suit la même fenêtre : lames de 5,5 mm (au lieu de 4), course 0,10 ± 0,05 mm, élastique au plus long
  (0,15 contre δy 0,19), 0,63 N par lame au plus court. L'effort minimal pris pour l'or est **0,5 N par lame — une valeur
  d'usage, à confirmer** avec le fabricant de la couronne.
- **Le marquage laser**, maintenant gravé dans la pièce : à côté de chaque cercle, dans un coin libre de la jambe, ce qu'est
  le contact — **HV1 +, HV2 +, RS485 A, RS485 B** sur la jambe +, **HV1 −, HV2 −, RS485 A, RS485 B** sur la jambe −, lisibles de
  l'extérieur, jamais dans la zone de contact. Une **nouvelle opération du langage de pièce, `mark`** (marquage laser) — une
  police à un trait **fabriquée par l'outil** (`cad/stroke_font.js` : capitales, chiffres, + − . /), aucune police de
  fabricant ; les traits sont unis à plat puis gravés d'un seul coup (`cad/features.js`). Dans Onshape, le marquage reste à
  faire d'après le dessin (le FeatureScript le dit).
- **Vérifié** : les pièces se construisent (le busbar en ≈ 2,4 s avec ses 8 marquages) ; rien ne traverse rien dans le CORE ;
  avec le CORE suivant au pas, les butées de cuivre se touchent, les crêtes n'entrent que de 0,15 mm (HV) et 0,10 mm (LV),
  chacune dans sa plage ; chaque étiquette est sur le cuivre de la jambe, à l'écart de tout cercle ; la variante plastique
  se construit ; les calculs gardés sont ceux du modèle.

### Est-ce vraiment estampable ? (retour DFM demandé par JP)

**La couronne de lames : oui, c'est une pièce d'estampage classique** — des ponts de lame (« lanced bridges ») entre deux
anneaux, sur un outil à suivre : percer les fenêtres entre les lames et le trou du centre, frapper le bombé, découper le
contour. Ce qui compte :

1. **Le bombé allonge peu la lame** : ses deux bouts sont tenus, la matière ne peut pas venir des anneaux, mais le bombé ne
   l'allonge que de 0,18 % (HV élastique), 0,87 % (HV plastique), 1,1 % (LV). C'est faisable.
2. **Former avant de durcir** : le cuivre-béryllium se met en forme dans un état formable (recuit ou quart dur), puis se
   durcit par revenu ; l'état « TH04 » des valeurs du modèle vient après la mise en forme. Une bande durcie en usine
   (« mill hardened ») s'estampe telle quelle, avec moins d'allongement. Les valeurs du modèle (E 131 GPa, Re 1000 MPa) sont
   **typiques, non lues** sur une fiche de bande.
3. **Les fenêtres entre les lames** : 0,42 mm au plus étroit pour une tôle de 0,25 (≈ 1,7 t) en HV, 0,57 mm pour 0,1 (5,7 t) en
   LV — au-dessus de la largeur de poinçon d'usage (≈ 1 à 1,5 t). La lame la plus étroite fait 10 t. Faisable.
4. **La tolérance du bombé est le vrai sujet** : ± 0,05 mm demande une frappe de calibrage après le revenu (le revenu bouge
   un peu les cotes), ou un tri. **À ± 0,1 mm, le HV élastique sortirait de sa course élastique au pire des cotes** — alors
   allonger encore les lames (≈ 10,5 mm) ou réduire la course nominale.
5. **Le revêtement** : argent (HV) ou or (LV) sur une sous-couche de nickel, après le revenu ; des couronnes en vrac
   s'emmêlent au tonneau — revêtir en bande avant la découpe finale, ou sur support.
6. **La fixation** : souder au laser à travers l'argent est difficile (il réfléchit) et la chaleur adoucit le CuBe durci —
   souder l'anneau extérieur seulement, loin des lames, avant le revêtement ; **mieux : sertir l'anneau extérieur sous la
   rondelle de butée** (une seule pièce de plus qui fait butée et retenue).
7. **Santé** : la poussière de cuivre-béryllium est toxique — estampage, revenu, revêtement et soudure chez un fabricant
   équipé ; pas d'usinage ni de ponçage en atelier.
8. **Une autre voie** : un ruban de contact à lamelles du commerce (« louvered contact band », plusieurs fabricants) dans
   une gorge — cotes et effort donnés par sa fiche. Ou un alliage plus conducteur (un CuBe « haute conductivité » ou un
   CuNiSi) : moins de limite élastique, moins de résistance — à comparer dans le modèle, valeurs à lire sur leurs fiches.

**Les butées de cuivre** : elles fixent l'écart entre deux CORE, donc leur hauteur (0,35 mm) et leur planéité se tolèrent
serré (± 0,02 mm, exemple). Le plus simple : **une rondelle de cuivre** soudée ou brasée sur la jambe avant le laminage. Un
anneau repoussé dans la jambe (demi-cisaillé) est possible, mais laisse un creux au dos, côté papier ; usiner la jambe pour
faire saillir l'anneau l'amincirait.

**Les îlots LV** : la plage de cuivre surmoulée dans l'insert en PA66-GF30 (avec une languette pour le fil), l'insert
emmanché ou collé dans le trou de la jambe. Le rebord de l'insert est tenu **0,02 mm sous les butées de cuivre** : ce sont
elles qui portent l'effort du module, le plastique ne flue pas sous la charge.

**Le marquage laser sur cuivre nu** : le cuivre renvoie l'infrarouge — un laser vert, ou une source à impulsions courtes,
marque mieux. Quelques microns suffisent à lire ; les 0,05 mm dessinés sont pour la vue. Jamais dans une zone de contact.

**Pas fait** : le sertissage sous la rondelle de butée (dessiné : la couronne posée, la butée séparée sur la jambe) ; l'essai
d'écrasement et de résistance d'une couronne réelle ; l'effort qui presse le module ; le fil des plages LV.

## Itération 8 — la couronne HV sertie sous sa rondelle de butée

Choix de JP, par menu (21 novembre) : **« Couronne sertie »** — tenir la couronne HV sous sa butée plutôt que la souder.

- **Une rondelle de butée à part** (`BM-STOP-HV`, deux par CORE) : du cuivre de 0,6 mm, frappé, argenté. Posée sur la jambe +,
  sa **lèvre** passe au-dessus de l'anneau extérieur de la couronne, dans un **logement de 0,25 mm** (l'épaisseur de la
  couronne) ; sa face porte la jambe − du CORE voisin. La couronne n'est que **serrée** : ni soudure à travers l'argent, ni
  chaleur sur le cuivre-béryllium ; elle se remplace en changeant la rondelle. La rondelle est fixée à la jambe par son
  **bord extérieur** (points de soudure cuivre sur cuivre, ou brasure), à 2,5 mm de la couronne, après le laminage.
- **Pourquoi la butée passe de 0,35 à 0,6 mm** : une lèvre qui se frappe demande du cuivre au-dessus d'un anneau de
  0,25 mm — il en reste 0,35. Le pas d'un CORE au suivant passe à **51,5 mm**. La couronne HV garde la même course
  (0,15 ± 0,05 mm) : son sommet libre monte à 0,75 mm ; les calculs sont les mêmes. La plage LV côté + monte de 0,25 mm pour que
  la couronne LV garde sa propre butée de 0,35 mm ; le rebord isolant de l'îlot reste 0,02 mm sous les rondelles.
- **La jambe + redevient plane** : plus d'anneau de butée dans le cuivre du busbar laminé — seulement les gravures, les
  marquages et les îlots LV.
- **Vérifié par le noyau 3D** : rien ne traverse rien dans le CORE (rondelles comprises) ; **la couronne soulevée de 0,05 mm
  entre dans la lèvre** — elle est prise ; avec le CORE suivant au pas, les rondelles se touchent et seules les crêtes
  entrent, de 0,15 mm (HV) et 0,10 mm (LV). Le CORE compte **19 pièces**, le module **152**.
- **Pas fait** : un essai de sertissage (effort de pose, tenue de la lèvre), la tolérance de la rondelle mesurée, la
  tenue du papier aramide derrière un point de soudure — à voir avec le fabricant du busbar.

## Itération 9 — des bandes à lamelles prises dans l'industrie, quatre contacts LV, leurs queues, l'isolation des îlots

Demandes de JP (22 novembre) : « Fil LV et isolation des îlots » ; puis, sur une capture des couronnes : « ces contacts n'ont pas
l'air réalistes et possibles ; s'il le faut imite un design de ce genre d'interface et fais-les en lamelles unidirectionnelles, en te
basant sur un cas réel de l'industrie, fais tes devoirs… on améliore ». Le menu « que portent les contacts LV » a été fermé par un
message : **choix conseillé, annoncé et facile à changer — 4 contacts LV** (RS-485 A et B, +5V_ISO, GND_ISO), parce que les deux
connecteurs de chaîne de la carte de CORE portent ces quatre fils : le côté bus de chaque transceiver isolé est alimenté et référencé
depuis le BMS central.

**Ce qui a été lu** (pages publiques ouvertes pendant le développement ; seuls des nombres et des références sont repris) :

| Source | Ce qui en est pris |
|---|---|
| Multi-Contact (Stäubli), *The MULTILAM Principle*, 2011 — p. 9, 13, 16, 22 | une bande à lamelles entre deux faces planes ; n = longueur / pas, R = Rk / n, I = n × I d'une lamelle (p. 13) ; classes de chute de tension : < 5 mV très bon, 5–12 bon, 13–25 utilisable (p. 9) ; LA-CU : 12 mm de large, pas de 3,5 mm, 7 N par lamelle (p. 16) ; la bande flotte dans son logement (p. 22) |
| Stäubli, page produit de la MULTILAM LA-CU | 40 A et 0,3 mΩ par lamelle |
| Stäubli, catalogue des fiches à fourche (US) — p. 9, 10 | busbars argentés aux plages de contact ; courant assigné limité par 12,5 mV de chute et 80 °C |
| Stäubli, catalogue ClipLam — p. 4, 6, 7 | des bandes tenues dans un cadre plastique entre deux busbars ; joints entiers de 400 A / 50 µΩ, 800 A / 25 µΩ, 1600 A / 13 µΩ, busbars argentés |
| Weftron, fiche LOUVER_tron 112 — p. 2 | 12 mm de large, pas de 3,5 mm, plaques de cuivre sur un ressort en inox (sans béryllium), argent 25 µm au moins, **hauteur de travail 1,5 à 1,9 mm** ; déclassement de la face d'en face (Cu 1, E-Al 0,75, CuZn39Pb3 0,60) |
| TE Connectivity, catalogue LOUVERTAC 65141 (2001) — p. 31, 32 | les types à lame dorés (LAIA, LAIV, LAV) ; une lamelle de LAV de 0,56 mm de haut libre |

**Ce que devient le joint entre deux CORE :**

- **Deux bandes HV à lamelles** (`BM-LAM-HV`) sur la jambe +, verticales, de 40 mm : l'enveloppe de la LOUVER_tron 112 (12 mm, pas de
  3,5 mm, 11 lamelles par bande). Elles sont **dessinées posées**, à leur hauteur de travail : les lamelles inclinées touchent la jambe
  − du CORE voisin. Les plages des deux jambes sont argentées là où elles appuient.
- **Un cadre** (`BM-LAM-CAGE`, PA66-GF30, 1 mm) tient les deux bandes à leur place, une fenêtre par bande — comme le cadre plastique
  d'un joint busbar-busbar du commerce. Plus mince que l'écart, il ne porte pas l'effort.
- **Quatre butées** (`BM-STOP`, cuivre argenté Ø8 × 1,7 mm) aux coins de la jambe tiennent l'écart à **1,7 ± 0,05 mm**, au milieu de
  la plage de travail publiée (1,5 à 1,9 mm), et portent l'effort qui presse le module. Le pas d'un CORE au suivant passe à **52,6 mm**.
- **Quatre contacts LV** en rangée dans le bas de la jambe : un îlot (insert PA66-GF30 dans un trou du cuivre, plage dorée) sur chaque
  jambe ; côté +, la plage est surélevée de 1,25 mm et porte une **courte bande à lamelles dorée** (`BM-LAM-LV`, type LAV : 5 mm, 7
  lamelles) écrasée à 0,45 mm sur la plage d'en face. Le pas et la hauteur de travail de ce type ne sont pas publiés dans ce qui a été
  lu : ce sont des exemples ; aucune résistance n'est publiée pour les versions dorées.
- **Le fil LV : des queues du flex.** Huit branches du flex en boîte montent des grands côtés de sa section centrale, contre la face
  extérieure de chaque jambe, jusqu'au bas de chaque îlot ; le bout se brase sur la languette de la plage (non dessinée). Elles passent
  dans l'écart de 1,7 mm, chacune contre sa jambe. Pour qu'une queue plie autour du busbar sans entrer dans le cuivre, **le pli du
  conducteur − est arrondi à 1,8 mm** (un busbar plié en a un) et la queue plie à 1,9 mm, plus de 6 fois son épaisseur — la règle de
  pose statique d'un flex simple face que l'outil vérifie. Les deux connecteurs de chaîne de la carte deviennent ces pistes : **à
  reporter dans le PCBA**.
- **Le calcul** : un nouveau modèle de l'outil, « Louvre strip · flat joint » (`louvre_strip`, domaine Assemblages), qui ne fait que
  ce que les documents impriment. Gardé dans le projet : 2 bandes × 11 lamelles = 22 lamelles, **880 A assignés** pour 360 A, **13,6 µΩ**,
  **4,9 mV** de chute (« très bon »), 1,8 W, **154 N** pour fermer le joint ; la hauteur, tolérance comprise, reste dans la plage. Les
  valeurs d'une lamelle sont celles de la LA-CU (même largeur, même pas) : la résistance d'une lamelle de la 112 n'est pas dans ce qui a
  été lu — à demander au fabricant.
- **L'isolation des îlots** : un petit assemblage, `BM-JOINT-ASM` — le busbar laminé de deux CORE voisins et tout ce qui est entre
  eux —, avec les potentiels du joint le plus haut de la chaîne : N7 = 29,4 V (le cuivre du joint), et le bus à 0–5 V ; les conducteurs
  éloignés des deux CORE (N6, N8) sont laissés hors de l'analyse, de l'autre côté de leur CORE. Le bus est
  **supposé référencé au − du pack au BMS central** (à confirmer). Niveau Functional (tout reste sous 60 V continus : un choix de
  l'outil, écrit). Un essai le mesure avec le moteur de l'écran Isolation : le bus (0 V) contre le cuivre du joint (29,4 V) — **1,34 mm
  dans l'air pour 0,5 mm requis, 3,98 mm de ligne de fuite pour 0,52 mm requis** (PD2, OVC I, tables intégrées de l'outil, à vérifier
  contre la norme). Les cellules n'y sont pas.

**Retour DFM.** Les bandes à lamelles se coupent à la longueur et se remplacent ; elles ne demandent ni soudure ni revenu chez nous.
Les plages argentées (5 à 10 µm, avec sous-couche de nickel pour beaucoup de manœuvres, selon les fabricants) se font sur le busbar
laminé, avant le laminage ou par masquage. Les butées brasées sur la jambe + fixent l'écrasement : leur hauteur se tient à ± 0,05 mm.
Ce que la bande demande à la face d'en face (planéité, rugosité N6) se spécifie sur le dessin du busbar. **L'effort de fermeture**
(154 N par joint, plus ce que les butées doivent garder) revient aux plaques de bout et au couvercle à verrou de l'itération 11.

**Pas fait** : la languette de la plage et son encoche, la pose et la tenue de la queue (collage), la carte qui reçoit les pistes, un
essai de résistance du joint réel et de l'échauffement à 360 A, le modèle d'un îlot LV (résistance non publiée).

## Itération 10 — le boîtier extrudé le long des 8 CORE, et les deux bornes du module

Demandes de JP (22 novembre, par menu puis par message) : « fil LV et isolation des îlots, puis boîtier et borne du module » ; « un
boîtier extrudé en plastique le long des 8 modules qui contient ces 8 derniers » ; « l'interface des 2 couvercles est vissée au casing
central (des trous sont extrudés dans la section centrale et des vis autotaraudeuses se font des filets au premier assemblage) ». Source :
`web/js/demo/demo_bm_case.js` ; essais : `tests/node/bm_case.test.mjs`.

**Ce qui a été lu** : la recommandation de conception de la vis pour plastiques **EVO PT** (EJOT), imprimée sur la page de son licencié
Semblex (« The Evolution of Direct Fastening into Plastic », section « Simple and universal design recommendation ») — trou **0,85 × d1
± 0,05 mm** mesuré en haut du trou, profondeur d'installation **2 × d1 ou plus**, lamage **1,05 × d1** sur **0,1 × d1**. Les fiches du
fabricant lui-même n'ont pas pu être ouvertes (son site refuse les lectures automatiques). **Pas lu** : le diamètre du bossage (aucun
rapport n'est imprimé sur cette page), la tenue à l'arrachement et le couple dans le PC (le fabricant les calcule avec son outil, EVO
CALC), les valeurs d'un extrudeur pour cette section.

**Le boîtier** (`BM-CASING`, polycarbonate d'une nuance V-0 à choisir, extrusion plastique) :

- **La section est dessinée autour du CORE**, mesuré sur ses pièces : la carte fait la largeur (0 à 92,8 mm), les panneaux du flex sont
  à 0,7 et 92,1 mm, le flex passe sous le CORE à −3,8 mm, le plus haut composant est à 80,3 mm. Cavité de 95,8 × 87,5 mm : 1,5 mm
  à côté de la carte, 1,7 mm au-dessus des composants. Paroi de **2,5 mm** partout (la règle de l'outil pour un plastique dont le cercle
  circonscrit dépasse 150 mm) ; section de 100,8 × 100 mm hors lobes, coupée à **473 mm**.
- **Le CORE ne touche que des rails et des nervures** : deux rails au fond, à 23,2 mm de chaque côté du milieu, 0,5 mm sous le flex ;
  quatre nervures de côté, là où les supports de cellules sont derrière les panneaux du flex (z = 3 et 66 mm), à 0,5 mm du flex. Les
  nervures font 3 mm de large : plus larges, la paroi et la nervure faisaient 4,2 mm au plus épais, au-delà des 4 mm qu'une section
  plastique tient sans retassure (règle EXT-12 de l'outil, vue et corrigée).
- **Les vis des couvercles** : les coins de la cavité sont pris (la carte en haut, le pli du flex en bas), donc chaque coin porte un
  **lobe** dehors, avec un **trou fermé** et une paroi de 2,5 mm autour — un canal ouvert en « C » s'écarterait sous la vis (choix de
  l'outil). Vis **EVO PT 40** (d1 = 4 mm) : le trou vient d'extrusion à Ø2,8 ; il est **percé à Ø3,3, alésé à Ø3,4 ± 0,05 sur 12 mm
  et lamé Ø4,2 × 0,4 mm** à chaque bout, là où la vis travaille — une section extrudée ne tient d'usage que ± 0,3 mm (Ø2,8 + 0,3 reste
  sous le perçage : l'outil coupe toujours). La vis forme son filet au premier vissage. Une interface « motif de vis » par bout attend
  les couvercles de l'itération 11. La règle de l'outil le rappelle : un filet formé dans un plastique supporte peu de démontages — un
  insert si le couvercle doit s'ouvrir souvent.
- **Le canal du busbar de retour**, fermé, sous le fond : 51 × 5 mm pour une barre de **50 × 4 mm**. Calcul gardé dans le projet (modèle
  « busbar » de l'outil, barre seule à l'air libre) : 360 A sur 460 mm, **53,4 °C** sous 60 °C, 1,8 A/mm² — dans son canal fermé
  l'échauffement réel est plus fort, à vérifier avec le module fermé. La **quille** qui porte le canal et les **quatre lobes** guident
  aussi le module dans sa cavité ou sa station de recharge.
- **Ce que l'outil en dit** (DFx) : aucune erreur ; un avertissement, **six creux fermés** (la cavité, le canal, quatre trous) — une
  filière à mandrin et un calibrage, à discuter avec l'extrudeur, avec la planéité des grandes parois. 736 g, 1,56 kg/m, 12 pièces par
  barre de 6 m.
- **Dans l'atelier de fab, le boîtier se joue** : extrudé et coupé, puis ses deux bouts usinés — avant-trou, alésoir, lamage — **le long
  d'un parcours écrit par une IA** (Claude, exemple de démonstration), lu et vérifié par l'outil comme tout parcours.

**Les bornes du module** (pièces de spécialiste, comme le busbar laminé ; elles ne se jouent pas dans l'atelier de fab) :

- **La borne −** (`BM-TERM-NEG`, au fond, dans le sous-assemblage `BM-TERM-NEG-ASM`) : une plaque de cuivre de 2 mm, argentée là où
  les bandes appuient, qui porte **ce que porte une jambe +** — deux bandes HV dans leur cadre, quatre butées, quatre îlots LV surélevés
  et leurs bandes dorées — et presse la jambe − du CORE 1 à l'écart de travail. Ses îlots amènent le RS-485 du BMS central dans la
  chaîne : un fil par îlot passe la plaque d'appui (itération 11).
- **La borne +** (`BM-TERM-POS`, en haut) : une face plane **comme une jambe −**, où appuient les bandes et les butées du CORE 8 ; ses
  plages LV affleurent. Les huit cartes sont identiques et **sans terminaison** (bloc RS-485 du PCBA : terminaison « non ») : la
  **terminaison de 120 Ω du bout de la chaîne se pose ici**, entre les plages A et B ; l'autre est au BMS central.
- Chacune a une **plaque d'appui isolante** de 3 mm (PA66-GF30, exemple) qui transmet l'effort de la pile au couvercle sans conduire, et,
  en haut au dos, une **plage de liaison nue avec deux goujons sertis M6** (exemple) pour le conducteur du couvercle : vers le contacteur
  et le connecteur au fond, vers le busbar de retour en haut.

**Vérifié par les essais** : la section contient le CORE avec les jeux dits ; les trous suivent la recommandation lue ; le boîtier se
construit sans erreur et un seul avertissement ; **aucune interférence** entre le boîtier, les bornes et les pièces des CORE (le boîtier
contre le CORE 1, la section étant la même partout ; chaque borne contre son CORE) ; les bandes de la borne − touchent la jambe − du
CORE 1, la borne + est posée sur les bandes du CORE 8 ; la gamme du boîtier et ses parcours sans alerte. **Le module compte 206
pièces.**

**Pas fait** : les couvercles, le busbar de retour, le latch rotatif et le contacteur (itération 11) ; l'effort que le couvercle doit
garder sur la pile (au moins 154 N par joint, la somme des lamelles, pour que les butées portent) et la tenue des vis à l'arrachement ;
la dépouille et les tolérances réelles de la section, la planéité des grandes parois, le frottement du flex sur les rails à la pose
(un film ou des patins à décider) ; la terminaison posée sur la borne + ; l'échauffement du module fermé.

## Itération 11 a — le busbar de retour et le couvercle du haut : came quart de tour, ressorts, boucle fermée par pression

Demandes de JP (22 novembre) : « un busbar le long du boîtier extrudé qui se connecte aux 2 couvercles… le 2e couvercle vient
fermer la boucle de courant interne, pousse sur les cores pour écraser les contacts LV et HV un sur l'autre en série et se lock
avec un latch rotatif ; l'interface des 2 couvercles est vissée au casing central… soit métal ou plastique robuste supportant les
efforts du latch ». Deux choix proposés par menu — **une came quart de tour** et **des anneaux d'interface en aluminium usiné** ;
réponse de JP par message : « Go, c'est bien les modifs ». Source : `web/js/demo/demo_bm_lid.js` ; essais :
`tests/node/bm_lid.test.mjs`. L'itération est livrée en deux : **11 a**, le bout haut (ici) ; **11 b**, le couvercle du fond
(connecteur LV et HV, contacteur, BMS central peut-être).

- **Le busbar de retour** (`BM-RETURN-BB`, cuivre 50 × 4 mm) court dans le canal fermé du boîtier, du couvercle du fond au bout
  haut, où il se relève à 90° par une **fenêtre fraisée dans le fond** du boîtier : sa **languette** fait face au couvercle. Son
  bout bas sort du boîtier vers le contacteur (trou M10, exemple).
- **L'anneau d'interface** (`BM-LID-RING-TOP`, aluminium 6061-T6 usiné) se visse au bout du boîtier par les quatre vis EVO PT 40
  dans les trous du boîtier ; deux **languettes** entrent le long des parois et finissent chacune par une **lèvre**. Entre un trou
  de vis et la fenêtre, 2 mm de matière : pas de lamage, les têtes se logent dans le couvercle (l'outil avait signalé le lamage
  qui débouchait).
- **Le couvercle** (`BM-LID-TOP`, PA66-GF30, isolant) et **la came quart de tour** (`BM-LATCH-CAM`) : un levier dehors, un arbre,
  un bras dedans ; tourné d'un quart, le bras s'appuie sur les deux lèvres et tient le couvercle contre l'anneau. La rampe qui
  tire le couvercle de quelques millimètres, la butée du quart de tour et le verrou du levier sont à dessiner avec le
  fournisseur du latch.
- **Les ressorts** : quatre sur une **plaque de pression** isolante (`BM-PRESS-PLATE`) qui pousse la plaque d'appui de la borne + —
  **la pile des 8 CORE est tenue par des ressorts**, quelles que soient les tolérances de ses 8 joints —, et deux sur chaque plot
  de contact. Ressorts dessinés à leur longueur posée, efforts visés en exemple, à choisir dans un catalogue.
- **La boucle se ferme par pression** (`BM-BRIDGE`) : le **plot A** presse la plage nue et argentée de la borne + (14 mm en haut, la
  plaque d'appui s'arrête dessous, les goujons de la borne + sont partis), le **plot B** presse la languette du busbar de retour,
  chacun à travers une bande à lamelles — la même que celle des joints, à plat pour le plot A — à sa hauteur de travail ; un
  **shunt souple** (feuillards de cuivre laminés) les relie. Deux plots, deux jeux de ressorts : chaque plot trouve sa face, alors
  que la borne + bouge avec les tolérances de la pile et que la languette est tenue par le boîtier. **Le couvercle retiré, le
  module est ouvert** : un sectionneur de service, d'office. Le BMS central devra le voir avant tout courant (itération 11 b).

**Les efforts, en un seul endroit** (`lidForces`, exemples) : un joint entre deux CORE demande 154 N (22 lamelles × 7 N, valeur
lue du fabricant) ; la plaque de pression en donne 600 N, le plot A 90 N — une réserve de 536 N au-delà de ce que les lamelles
d'un joint demandent, que les butées portent ; un plot demande 77 N (11 lamelles), ses ressorts en donnent 90. En tout **780 N**
sur la came, soit **195 N par vis** de l'anneau. La tenue de ces vis dans le PC reste à calculer avec l'outil du fabricant ou à
essayer ; la réserve à donner contre les accélérations le long du module reste à fixer avec la spécification du véhicule.

**Vérifié par les essais** : toutes les pièces se construisent ; l'anneau usiné, le couvercle et la plaque moulés passent leurs
règles DFx sans avertissement ; **aucune interférence** au bout haut (couvercle, ressorts, pont, busbar de retour, borne +, boîtier,
CORE 8) ; chaque bande à sa hauteur de travail entre sa plage et son plot ; le bras sur les lèvres, chaque ressort entre ses
appuis ; tous les conducteurs de la boucle sur PACK+. **Le module compte 222 pièces.**

**Pas fait** : le couvercle du fond, le contacteur, le connecteur de la cavité ou de la station, le BMS central (11 b) ; la rampe de
la came ; les nervures du couvercle et leur simulation ; l'échauffement du pont et du shunt à 360 A ; la tenue des vis ; un essai
du latch.

## Ce qu'il contient

| Élément | Ce que c'est | Où |
|---|---|---|
| Carte de CORE 1S8P | la carte du PCBA (`CORE-1S8P-PCBA`, 92,8 × 46,4 mm) et son jumeau mécanique `CORE-1S8P-PCBA-PCB` | Électronique › PCBA ; Pièces |
| Cellule 21700 du CORE | `BM-CELL-21700`, l'enveloppe la plus grande publiée pour une 21700 (Ø 21,7 × 70,8 mm), bornes soudables | Pièces |
| Busbar laminé du CORE | `BM-BB-LAM` : le conducteur + (bornes +, flanc +Y) et le conducteur − (fonds, flanc −Y) en une pièce, papier aramide côté cellules, film PET dehors, fenêtres et bossages de soudure, un trou sous chaque cellule | Pièces |
| Flex en boîte du CORE | `BM-FLEX-BOX` : la section centrale sous le CORE (8 CTN, B−), deux panneaux pleine largeur aux petits bouts, le X− continue dans la carte (rigid-flex), le rabat X+ prend B+ | Pièces |
| Support du bas des cellules | `BM-HOLDER-BASE` : le support du bas avec un fond sous les cellules, deux fenêtres de soudure − par cellule, et ses 8 rondelles thermiques moulées en deuxième injection (itération 5 ; les rondelles séparées `BM-PUCK` de l'itération 4 sont dedans) | Pièces |
| Support du haut des cellules | `BM-HOLDER` : une épine entre les rangées, deux barres aux bouts, une poche par cellule, cinq noyautages | Pièces |
| Bandes de contact HV | `BM-LAM-HV` : bande à lamelles de 12 × 40 mm, l'enveloppe de la LOUVER_tron 112 ; deux par CORE, sur la jambe + (itération 9 — elles remplacent les couronnes des itérations 6 à 8) | Pièces |
| Cadre des bandes | `BM-LAM-CAGE` : PA66-GF30, 1 mm, une fenêtre par bande | Pièces |
| Butées | `BM-STOP` : cuivre argenté Ø8 × 1,7 mm, quatre par CORE — l'écart de travail des bandes, et l'effort du module | Pièces |
| Bandes de contact LV | `BM-LAM-LV` : courte bande à lamelles dorée, quatre par CORE, sur les plages surélevées des îlots + | Pièces |
| CORE 1S8P | `BM-CORE-ASM` : 8 cellules en deux rangées de 4, le support du haut, le support du bas et ses rondelles, le busbar laminé, le flex en boîte et ses 8 queues, la carte dessus, 2 bandes HV, leur cadre, 4 butées, 4 bandes LV — 24 pièces | Assemblage |
| Joint entre deux CORE | `BM-JOINT-ASM` : le busbar de deux CORE voisins et ce qui est entre eux, chaque conducteur à son potentiel — pour l'écran Isolation | Assemblage |
| Boîtier extrudé du module | `BM-CASING` : polycarbonate extrudé, 473 mm ; deux rails, quatre nervures, quatre lobes et leurs trous de vis, le canal du busbar de retour (itération 10) | Pièces |
| Bornes du module | `BM-TERM-NEG` (avec ses contacts, `BM-TERM-NEG-ASM`) et `BM-TERM-POS` : cuivre, plaque d'appui, îlots LV, goujons vers les couvercles (itération 10) | Pièces ; Assemblage |
| Busbar de retour | `BM-RETURN-BB` : cuivre 50 × 4 mm dans le canal du boîtier, sa languette relevée au bout haut (itération 11 a) | Pièces |
| Couvercle du haut | `BM-LID-TOP-ASM` : anneau d'interface en aluminium, couvercle, came quart de tour, plaque de pression, huit ressorts, pont de contact et ses deux bandes (itération 11 a) | Assemblage |
| BM 8s8p - 21700 | `BM-8S8P-ASM` : 8 CORE côte à côte, tous dans le même sens, la borne − avant le CORE 1, la borne + après le CORE 8, le boîtier autour, le busbar de retour, le couvercle du haut — 222 pièces | Assemblage |

## La géométrie, telle que dessinée

- **Repère d'un CORE** : X le long d'une rangée de 4 (92,8 mm), Y en travers des deux rangées (46,4 mm), Z vers le haut ;
  les cellules sont posées sur z = 0. Le busbar laminé est dessiné dans ce repère : leur place dans le CORE
  est l'origine, ce qui les rend faciles à reprendre.
- **Le dessus d'un CORE** = 4 × 21,7 + 2 × 3 = 92,8 mm par 2 × 21,7 + 3 = 46,4 mm : les cellules d'une rangée se touchent,
  3 mm aux deux bouts et entre les rangées — la taille de la carte.
- **La série** : la jambe + d'un CORE presse la jambe − du CORE suivant, face contre face (itération 1 : 49,4 mm d'un CORE
  au suivant avec 1 mm de cuivre ; itération 2 : 51,4 mm avec 2 mm ; itération 4 : 50,9 mm, le papier aramide de 0,25 mm
  remplaçant l'isolant de 0,5 mm ; itération 6 : 51,25 mm — les deux jambes ne se touchent plus, ce sont les butées des
  contacts qui portent ; itération 8 : 51,5 mm, les rondelles de butée de 0,6 mm ; itération 9 : 52,6 mm, l'écart de 1,7 mm des bandes à lamelles).
- **Le boîtier** court le long de Y, de −29 à 444 mm dans le repère du module (le CORE 1 à l'origine) : 11 mm au-delà des goujons de
  chaque borne, la place des couvercles — un exemple jusqu'à l'itération 11. Sa section est dessinée dans le plan X Z du repère d'un CORE.
- La jambe + s'arrête à 5 mm du bas, la jambe − à 5 mm du haut : aucune des deux ne frôle la plaque de l'autre polarité
  de son propre CORE (exemple, paramètre `z0`).

## Ce qui est un exemple, et ce qui n'est pas dessiné

**Exemples, à itérer** (dits sur chaque pièce, en paramètres) : le papier aramide (0,25 mm), l'enveloppe (0,1 mm), le retrait
des jambes (5 mm), les fenêtres, les bossages et les trous du busbar, la rondelle thermique, la hauteur et la matière du
support. Le cuivre (2,0 mm) est dimensionné, par un
modèle simple. Les pièces sont posées à leur place (« fixe »), sans accouplements : les soudures cellule ↔ busbar et les
CTN ↔ busbar ne sont pas encore des interfaces appariées, d'où les « interfaces sans jumelle » que l'écran signale.

**Pas encore dessiné** : les languettes de soudure minces (les bossages en tiennent la place) ; le chant du cuivre aux
petits bouts, nu ; la dépouille du support de cellules ; le couvercle du fond, le contacteur, le connecteur de la cavité ; le BMS
central, ses connecteurs et le faisceau RS-485.

**Non vérifié** : l'échauffement réel du cuivre dans le module fermé (le modèle est une barre seule à l'air libre) ; la
chaleur des cellules elles-mêmes à 45 A (la fiche donne ≤ 8 mΩ à 1 kHz à l'expédition, pas la résistance en courant
continu) ; la tenue des plis du flex à l'assemblage ; la lamination d'une pièce pliée sur trois faces ; la mesure par
la rondelle (aucun essai) ; la tenue des cellules dans leur support
(vibration, choc) ; l'isolation entre CORE ; la conformité de quoi que ce soit.
