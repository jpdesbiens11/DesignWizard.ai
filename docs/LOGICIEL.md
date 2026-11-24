# Logiciel — le logiciel embarqué d'un BMS, par objets reliés

Demande de JP (20 novembre 2026) : « est-ce qu'on peut avoir une approche de design logiciel via des objets visuels
adaptés qui se codent tout seuls en librairie, module et structure de fichiers pour un CPU de BMS embarqué, sachant
les in/out à gérer, leurs plages et le CPU choisi ». Choix cliqués le même jour : **des tuiles reliées** ; **un
microcontrôleur de sécurité à double cœur d'abord** ; « EFC » = energy flow counter, nommé par sa fonction.

Écrans : le groupe **Logiciel** de la barre du haut (depuis la v0.128.0 ; avant, Électronique › Logiciel, `#/sw`).
Première tranche, v0.121.0 : **une chaîne complète**, du dessin au C compilé. Depuis la v0.128.0, le **cycle en V** (§ 4 ter). Depuis la v0.189.0, **des blocs à clés, de gauche à droite** (§ 4 quinquies).

## 1. L'idée

Chaque chose que le CPU doit gérer est un **objet** posé sur la page. Un objet est un **genre** — ce qu'il lit (ses
entrées), ce qu'il donne (ses sorties), ce que l'on règle (ses valeurs) — et un comportement écrit **une seule fois**,
comme un pas en nombres entiers. On relie les objets par des **fils**, d'une sortie à une entrée. L'outil simule le
dessin dans le navigateur, puis en écrit le C. Rien ne se tape en code libre.

Tout signal est un nombre entier dans une unité dite sur son port (mV, mA, ms, 0,1 °C, 0 / 1), avec la plage qu'il
peut prendre. **Un fil est refusé quand les unités diffèrent** ; une plage qui ne tient pas dans celle de l'entrée est
dite, sans bloquer. **Une boucle** — un défaut qui inhibe l'objet dont il vient — s'ouvre comme dans un schéma-bloc :
un de ses fils porte **la valeur du pas d'avant** (trait interrompu) ; l'outil le fait de lui-même quand un fil ferme
une boucle, et le dit.

## 2. Les objets (`web/js/sw/sw_objects.js`)

| Nature | Objet | Ce qu'il fait |
| --- | --- | --- |
| Brancher (Pins) | ADC channel, Digital input, Digital output | ce qui touche le microcontrôleur |
| Mesurer | Analog input | comptes → grandeur : échelle, moyenne glissante, drapeau « vraisemblable » |
| Mesurer | Energy counter | l'énergie qui sort du pack et celle qui y entre (le mot du projet : « energy flow counter ») |
| Décider | Limit | seuil avec délai et hystérésis |
| Décider | Fault latch | défaut retenu jusqu'à l'acquittement |
| Commander | Contactor driver | ferme sur demande, ouvre sur un défaut, relit le contact auxiliaire |

Les valeurs qu'un genre propose sont des **exemples**, typiques d'une telle carte et dits comme tels : chaque champ
clignote jusqu'à ce qu'il soit entré ou confirmé, et **les fichiers attendent** (`unsure`, `ready`). Un objet se met à
Off (il n'est ni simulé ni écrit) et se duplique (la copie naît à Off).

## 3. Le CPU choisi (`web/js/sw/sw_cpu.js`)

Une **fiche** : ce contre quoi le dessin est vérifié (nombre de voies analogiques, de broches, résolution du
convertisseur) et ce que le squelette de la couche matérielle doit dire. Première fiche réelle : **TMS570LS1224**
(Texas Instruments, deux Arm Cortex-R4F en lockstep), en boîtiers LQFP 144 et BGA 337 — fabricant et série cités en
texte, comme référence. Source : fiche technique SPNS190B (octobre 2012, révisée en février 2015), **lue** : 172
pages, chaque valeur relue sur la page citée, que l'écran montre.

Ce que la fiche technique **ne dit pas** est dit aussi : elle qualifie le composant « for Safety-Critical
Applications » et décrit son architecture (lockstep, autotests, ECC), mais **ne cite aucune norme** — ni ISO 26262,
ni IEC 61508, ni ASIL, ni SIL. Le manuel de sécurité du fabricant n'a pas été lu. Le tableau 3-1 donne des maximums :
des fonctions sont multiplexées, toutes les broches ne sont pas libres à la fois.

La fiche « générique » est celle qu'un projet remplit pour son propre CPU : ses valeurs ne sont celles d'aucun composant.

## 4. Ce que l'outil écrit (`web/js/sw/sw_c.js`)

```
bms/
  lib/        un module par GENRE d'objet utilisé (dw_analog, dw_limit, dw_latch, dw_contactor, dw_energy)
  cfg/        une table par objet posé : seuils, délais, échelles
  io/         signal ↔ broche
  app/        le pas du logiciel : chaque objet, dans l'ordre des fils ; tous les signaux dans une structure
  hal/        l'interface au microcontrôleur ; hal/<cpu>/ : le squelette, à écrire avec la bibliothèque du
              fabricant ; hal/host/ : ce qui permet à un ordinateur de faire tourner l'essai
  test/       le scénario du dessin en vecteurs, le programme qui imprime la trace, et la trace attendue
  doc/        objet ↔ fichiers ↔ ce qu'il doit faire (une phrase testable par objet)
```

C99 sobre : pas d'allocation, types à largeur fixe, aucun nombre à virgule, ASCII. **Dos à dos** : compilé avec
`-std=c99 -Wall -Wextra -pedantic -Werror`, le programme d'essai doit imprimer, caractère pour caractère, ce que le
modèle donne pour le même scénario (`cExpected`). Le README du dossier donne la ligne de commande.

## 4 bis. Pas à pas : sept étapes, une simulation en direct, le code à l'écran, le chargement (v0.124.0)

Demande de JP (20 novembre 2026), sur l'écran `#/sw` : les entrées et les sorties des blocs ne sont pas claires, les
références aux pages de la fiche non plus, le guide ne se voit pas, le code final ne se voit qu'une fois téléchargé ;
le vouloir **pas à pas, comme pour un étudiant de 16 ans** ; essayer **le démarrage, l'initialisation, la mémoire** ;
**une vraie simulation en temps réel**, en pause, où l'on change les entrées et voit le logiciel réagir ; et
**l'important : voir le paquet final et savoir comment il se charge dans le microcontrôleur choisi**.

**Les sept étapes** (`web/js/sw/sw_steps.js`), numérotées en tête du volet de gauche — CPU, Objets, Valeurs,
Démarrage, Simulation, Code, Chargement. Chacune dit **en clair** ce qu'elle est et **ce que l'on fait**, si elle est
faite (lu dans le logiciel, jamais coché à la main), et déplie les **mots du métier** qu'elle emploie (le mot, son nom
anglais, une phrase). L'adresse garde l'étape (`#/sw/live`). Le **guide** est dans le volet, sous l'étape.

- **CPU** — la fiche du CPU est au CENTRE : chaque chiffre, ce que la fiche dit, et une colonne « Page de la fiche »
  dont chaque page est un lien vers le document, ouvert à cette page.
- **Objets** — chaque tuile dit sous sa tête **ENTRÉES** (à gauche, une flèche qui ENTRE dans la tuile) et **SORTIES**
  (à droite, un point qui en sort), et son rang dans le pas (« n° 3 ») ; sa fiche dit, ligne par ligne, d'où vient chaque
  entrée, où va chaque sortie, sa plage et ce qu'elle vaut (`ioRows`).
- **Valeurs** — la liste des tuiles qui ont des valeurs d'exemple à relire ; un clic ouvre leur fiche, la valeur clignote.
- **Démarrage** (`web/js/sw/sw_start.js`) — ce qui se passe, dans l'ordre : ce que le CPU fait seul (lu dans sa fiche :
  3 497 cycles de l'oscillateur en quatre phases, tableau 6-3, p. 52), `hal_init()`, `bms_init()`, puis le pas, tuile après
  tuile. **L'essai de démarrage** : signaux à 0 après l'initialisation, aucune sortie commandée au premier pas ni pendant
  une seconde d'entrées au repos, ce qui bascule pendant ce repos (dit, non jugé : une mesure à 0 se dit « non
  vraisemblable », c'est voulu). **La mémoire** : les octets de RAM et de réglages, lus des structures que les fichiers
  déclarent (`memoryPlan` de `sw_c.js`, alignement naturel) — un essai les compare au `sizeof` d'un compilateur C. La taille
  du CODE ne se connaît qu'une fois compilé pour le CPU, et c'est dit.
- **Simulation** (`web/js/sw/sw_live.js`, écran `modules/sw_bench.js`) — le **même pas** que le scénario rejoue et que le C
  fait (`machine` de `sw_design.js`), une période à la fois. Le banc est dans le volet de droite : une grandeur se règle
  par un curseur et un champ, dans l'unité de la mesure qu'elle nourrit (l'écran dit les comptes que la broche lit, et
  quand la valeur sort de sa plage vraisemblable) ; une demande est un interrupteur ; un contact **suit sa bobine**, ou
  est **coincé ouvert**, ou **soudé fermé**. Sous la page : **Marche / Pause / Un pas / Redémarrer**, la vitesse (temps
  réel, 5 ou 20 fois plus lent), un **chronogramme** des dernières secondes ; à gauche, le journal de ce qui a basculé.
  Usages suivis : le transport d'un simulateur, le chronogramme d'un analyseur logique. Depuis la v0.125.0, ce panneau
  du bas **se grandit** par sa bordure du haut et **se replie** par son bouton ▾ (le transport reste), et la page des
  tuiles **se zoome et se déplace** : molette autour du pointeur, glisser du fond, barre « − % + · Ajuster · Loupe » en
  haut à droite ; elle s'ouvre ajustée à la fenêtre (`docs/ERGONOMIE.md`).
- **Code** — chaque fichier du paquet s'ouvre au centre, avec ses numéros de ligne ; le README d'abord.
- **Chargement** (`web/js/sw/sw_load.js`) — sept gestes, du paquet au CPU, dits pour quelqu'un qui apprend ; pour le
  TMS570LS1224, ce que **le fabricant publie** sur chacun, ses mots entre guillemets, avec la page lue : la sonde sur la
  carte du kit d'évaluation, la prise JTAG, les broches JTAG du CPU (p. 20), le générateur de pilotes et les ateliers qui
  en reprennent le code, l'outil de programmation, le temps d'écriture de la flash (tableau 6-23, p. 77), le verrou JTAG
  (p. 109). La même suite, en anglais, est dans le paquet : `doc/LOADING.md` (24 fichiers en tout).

**Lu pour le chargement** : les pages des produits du kit LAUNCHXL2-TMS57012, de HALCoGen, d'UniFlash et de Code Composer
Studio (Texas Instruments), le 20 novembre 2026. **Pas lu** : les guides d'utilisation de ces outils et du kit.
**Rien n'a été essayé** : aucun outil n'a été installé ni lancé, rien n'a été chargé dans un CPU. La page du kit dit le CPU
« IEC 61508 SIL 3 and ISO 26262 ASIL D certified » ; le certificat n'a pas été lu, et la fiche technique ne cite aucune norme.

## 4 ter. Le cycle en V (v0.128.0)

Demande de JP (21 novembre 2026) : « sortir et bonifier la suite d'outils logiciel de l'onglet électronique… la même suite
d'outils et de genre d'outils que pour la mécanique et l'électronique, tout en favorisant la facilité d'utilisation,
l'ergonomie, la compréhension rapide des jeunes ingénieurs, et garantir un résultat aux normes et pratiques
industrielles ». Choix cliqués : **« Cycle en V »** et la référence **« au choix du projet »**.

Le logiciel a son groupe dans la barre du haut, sept écrans dans l'ordre du V ; le V est dessiné au-dessus de chacun
(`modules/sw_vband.js`), chaque étape dit où elle en est, et les étapes faites l'une pour l'autre sont reliées en
pointillé — les exigences et la vérification qui les prouve, la conception et la simulation qui l'essaie.

| Étape | Écran | Ce que l'on y fait | Module |
|---|---|---|---|
| 1 Exigences | `#/swreq` | une phrase avec « doit », un genre, une preuve, les tuiles qui la réalisent ; la carte de traçabilité | `sw/sw_req.js`, `modules/sw_req.js`, `modules/sw_trace_map.js` |
| 2 Architecture | `#/swarch` | la référence de sécurité et son niveau, le CPU, la période | `sw/sw_std.js`, `modules/sw.js` |
| 3 Conception | `#/sw` | les tuiles, les fils, les valeurs (pages « Tuiles » et « Valeurs ») | `sw/sw_design.js` |
| 4 Simulation | `#/swsim` | le modèle en direct, l'essai de démarrage et la mémoire | `sw/sw_live.js`, `sw/sw_start.js` |
| 5 Code | `#/swcode` | le C écrit par l'outil, fichier par fichier | `sw/sw_c.js` |
| 6 Vérification | `#/swtest` | les essais sur le modèle, la matrice, la couverture du modèle | `sw/sw_test.js`, `modules/sw_verify.js` |
| 7 Livraison | `#/swrel` | la liste de livraison, le paquet, les sept gestes du chargement | `sw/sw_release.js`, `sw/sw_load.js` |

Les anciennes adresses (`#/sw/live`, `#/sw/code`…) mènent à l'étape de leur page. La marche vers le haut suit le V :
chaque étape monte vers celle à laquelle elle répond (l'Architecture et la Vérification vers les Exigences, la
Conception vers l'Architecture, la Simulation et le Code vers la Conception, la Livraison vers la Vérification), et les
Exigences vers la carte dans le PCBA ; la marche vers le bas en est l'inverse exact.

**Exigences** (`sw/sw_req.js`). Cinq genres (Functional, Safety, Performance, Interface, Robustness), trois preuves (essai,
analyse, revue). L'outil relit chaque phrase — pas de « doit », mot vague, pas de nombre pour une performance ou une
sécurité, deux « doit » —, d'après des usages du métier écrits de mémoire : aucun guide de rédaction n'a été lu. Chaque
tuile dit en une phrase ce qu'elle fait : ce sont les **exigences de bas niveau**, tirées du dessin. La **trace** va dans
les deux sens ; une tuile qu'aucune exigence ne demande est signalée (une fonction que personne n'a demandée). Une
exigence prouvée par analyse ou par revue se **signe** d'un nom. On / Off, copie née à Off ; les six exigences de
l'exemple sont des exemples à confirmer.

**Référence** (`sw/sw_std.js`). **RTCA DO-178C** (aéronautique, niveau DAL A à E) ou **ISO 26262** partie 6
(automobile, ASIL QM, A à D). Ce que l'outil en dit vient de **pages publiques lues le 21 novembre 2026** (Wikipedia,
CC BY-SA 4.0 : « DO-178C », « DO-178B », « ISO 26262 », « Modified condition/decision coverage », « V-model (software
development) ») : le nombre d'objectifs par niveau DO-178C et ceux à tenir avec indépendance, les traces dans les deux
sens, MC/DC au niveau A ; l'ASIL selon gravité, exposition et contrôlabilité, MC/DC « highly recommended » pour ASIL D.
**Les normes elles-mêmes, payantes, n'ont pas été lues.** Ce que ces pages ne disent pas — la couverture demandée aux
niveaux B, C, D de DO-178C et A, B, C d'ISO 26262 — n'est pas affirmé, et l'écran le dit.

**Essais** (`sw/sw_test.js`). Un essai est un scénario — ce que lit chaque broche, instant après instant, écrit dans
l'unité de ce qu'elle mesure (mV pour une voie qui mesure une tension ; écrit et relu à l'identique) — et des attendus : un
signal qui vaut une valeur à un instant, ou qui passe à une valeur dans une fenêtre (un temps de réponse). Il tourne sur
le **modèle**, le même pas que le C (l'essai dos à dos tient l'égalité). Un essai qui n'attend rien ne prouve rien. La
**couverture du modèle** dit, sur l'ensemble des essais, quelle sortie 0 / 1 n'a jamais pris l'une de ses deux valeurs ;
la **couverture structurelle** que les normes demandent (instructions, décisions, MC/DC) se mesure sur le C compilé, avec
un outil de couverture : le modèle ne la donne pas. Les cinq essais de l'exemple réussissent.

**Livraison** (`sw/sw_release.js`). Neuf lignes : la référence, le CPU, les exigences (écrites, confirmées, bien
écrites), l'allocation, la conception sans erreur, les valeurs confirmées, les essais (réussis, confirmés), les
exigences prouvées, les preuves signées ; chacune dit l'étape où la régler. C'est la liste de l'outil : elle ne remplace
ni la revue de conception ni l'autorité qui accepte un logiciel. Le rapport de revue porte une section par logiciel.

**Les deux documents du logiciel** (v0.129.0, `sw/sw_docs.js`, `modules/sw_docs_ui.js`). La **spécification des
exigences** (`<id>-SRS`) : la référence suivie, chaque exigence avec son genre, sa preuve, ses tuiles et son état — un
exemple le dit sur sa ligne —, ce que l'outil a trouvé dans les phrases, ce que fait chaque tuile (les exigences de bas
niveau), la trace jusqu'aux fichiers C et aux essais. Le **rapport de vérification** (`<id>-SVR`) : où et quand les
essais ont tourné (sur le modèle, avec la version de l'outil), le bilan, la matrice de traçabilité, chaque essai avec son
scénario dans l'unité de ses broches, ce que l'on attendait et ce qui a été trouvé, la couverture du modèle, ce que la
référence demande au code, la liste de livraison. Word et PDF, au gabarit des documents de la plateforme (cartouche,
page de titre, approbations, note de confidentialité). La spécification est en tête du volet des Exigences, le rapport
en tête de celui de la Vérification, les deux dans la Livraison. **Le paquet C en porte la même matière**, en ASCII :
`doc/REQUIREMENTS.md` (exigence ↔ tuiles ↔ fichiers ↔ essais) et `doc/VERIFICATION.md` (chaque essai, son scénario,
ses attendus, la couverture du modèle) ; il compile toujours dos à dos. Le plan de ces documents suit l'usage du métier,
écrit de mémoire : aucun gabarit d'une norme n'a été lu, et ils ne tiennent pas lieu des données du cycle de vie qu'une
norme demande.

Non fait ici, et dit : l'essai d'intégration sur la carte et l'essai sur le CPU ; l'aller-retour IA d'une exigence ou
d'un essai. **Aucune prétention de conformité ni de certification** : une norme se tient par un processus,
des revues indépendantes et une autorité ; l'outil aide à tenir les traces que ce processus demande.


## 4 quinquies. Des blocs à clés, de gauche à droite (v0.189.0)

Demande de JP, 24 novembre 2026 : « au lieu du cycle en V standard, très ennuyeux… un système de blocs logiciels à clés (comme des blocs LEGO) et à couleurs, une vue de gauche à droite, entrées et sorties, un peu comme LabVIEW mais avec des blocs plus ergonomiques » ; puis « des blocs capteurs typiques qui envoient leurs données au CPU, des actionneurs typiques » et « qu'ils se connectent tout seuls quand on les approche avec des interfaces compatibles ». Le V reste (sa structure et ses étapes étaient bonnes) ; c'est sa présentation qui change.

**Ce qui ne change pas.** Un bloc est un objet (`sw/sw_objects.js`) : ses ports, ses valeurs, son pas en entiers ; un fil est permis par `wireCheck` ; le C est écrit et prouvé dos à dos. Tout ce qui suit est la façon de le **voir** et de le **poser**.

- **La clé d'un port** = le type de ce qu'il porte (`SIGNAL_TYPES`, `typeOf`, `keyPath` de `sw/sw_blocks.js`) : décision 0 / 1 = dent carrée (vert), grandeur physique = dent ronde (orange), comptes bruts = queue d'aronde (gris), commande en ‰ = flèche (rose), état = pointe (violet), temps = marche (bleu). Une sortie est une **languette**, une entrée une **encoche** de même forme : seule une clé de même forme y entre, et le fil prend la couleur de son type (comme LabVIEW colore ses fils par type de donnée ; les blocs à encoches sont la convention de la programmation visuelle pour débutants).
- **La famille d'un bloc** = sa couleur et sa colonne, de gauche à droite : capteurs, entrées de la carte, acquérir, décider, réguler, commander, communiquer, veiller, sorties de la carte, actionneurs (`FAMILIES`).
- **De gauche à droite.** « Ranger de gauche à droite » place chaque bloc une colonne après le dernier bloc qu'il lit, les entrées de la carte d'abord, ses sorties en dernier (`columns`, `flowLayout`) — une étape annulable. Les entrées et les sorties de la carte sont posées sur deux **rails**.
- **Les blocs s'emboîtent.** Un bloc lâché à moins de 28 px d'une place où l'une de ses encoches rencontre une languette de même clé (ou l'inverse) s'aimante, s'emboîte, et chaque paire de ports qui se font face et s'accordent est reliée — sans fil dessiné (`snapAt`, `docked`). L'écarter le déboîte. Les fils restent pour les liaisons à distance.
- **La bibliothèque par domaine** (`LIBRARY`, `PACKS`) : le commun de tout logiciel embarqué — broches, entrée analogique, **anti-rebond**, seuil, **temporisation au travail (TON)**, **porte logique**, mémoire de défaut, **régulateur PI** à intégrale bornée, **rampe** (les cinq nouveaux : `sw/sw_kinds_more.js`, leur C : `sw/sw_c_more.js`, prouvés dos à dos par `tests/node/sw_blocks.test.mjs`) ; les **capteurs et actionneurs typiques** (`sw/sw_devices.js`) ; batterie · BMS / ESS ; robot ; puissance ; appareil autonome. Un bloc que l'outil ne sait pas encore faire tourner (PWM, CAN, chien de garde, codeur, commande vectorielle…) est montré en pointillé, « à venir », et ne se pose pas.
- **Capteurs et actionneurs.** Un capteur est du matériel : le logiciel n'en voit qu'une **broche** et le bloc qui en fait une grandeur. Une brique de capteur pose donc la broche, marquée de son capteur, et son bloc d'acquisition relié, à la **mise à l'échelle typique** d'un tel capteur (CTN linéarisée de 0 à 60 °C, Pt100 et amplificateur, pont diviseur, courant à effet Hall, shunt, pression ratiométrique, potentiomètre ; bouton et fin de course suivis d'un anti-rebond). Un actionneur pose la broche de sortie qui le commande (bobine, témoin, avertisseur, électrovanne, chauffage, ventilateur). Rien de nouveau ne s'écrit en C ; chaque valeur est une **valeur de référence**, ambre, à confirmer avec la fiche de la pièce que la carte porte.
- **Aligné sur la carte.** Le logiciel tourne sur la carte du produit qui porte un microcontrôleur et dont le nom dit qu'elle commande (`hostBoard`) ; chaque bloc porte son étiquette — la carte et le CPU ; pour une broche, le net de la carte (`mcuNets`), choisi dans sa fiche : vert relié, ambre à relier ; le guide le dit (`hwProblems`).
- **D'où vient une valeur** (`VALUE_SOURCES`, `valueChips`) : verte, donnée par une exigence (en pointillé tant que l'exigence n'est pas confirmée) ; bleue, tapée ou confirmée ; ambre, valeur de référence de l'outil.

### Les exigences, entrée standard

Les exigences du projet restent où le projet les tient ; l'outil les **lit** dans une structure, `dynamiteorbit/sw-requirements@1` (`sw/sw_req_import.js`) : `system` (nom, domaine, période), `signals` (ce que le logiciel lit sur la carte ou lui donne : nom, sens, analogique ou logique, unité, plage, `hw` : carte, broche, net), `requirements` (id, phrase avec « shall », genre, preuve, `block` de la bibliothèque, `input` — un signal ou une autre exigence —, `output`, `values`, `source`). « Copier le prompt (format standard) » donne à un assistant la consigne et le catalogue des blocs, écrit depuis la bibliothèque elle-même : il convertit le document du projet, sans inventer de nombre. « Importer des exigences… » montre l'aperçu (blocs, valeurs données, valeurs de référence, blocs à venir, notes), puis pose tout en **une étape annulable**, rangé de gauche à droite. **Les exigences arrivent « à confirmer »** : elles sont passées par un assistant, et la réponse d'un assistant ne confirme rien ; confirmer une exigence (étape 1) confirme les valeurs qu'elle donne. Les unités V, A, °C, %, s sont converties dans celles des blocs.

### Le banc du logiciel

La simulation (étape 4) se présente comme le Labo d'une carte : au-dessus des blocs, **un instrument par entrée du logiciel**, réglé sur sa face — un afficheur dans l'unité du capteur, un bouton, les comptes que cela met à la broche, une plage hors de laquelle l'afficheur passe à l'ambre ; un interrupteur et son témoin pour une entrée logique ; un sélecteur pour un contact qui suit sa bobine ou reste coincé ; puis **les témoins** de ce que le logiciel commande. Dessous, le chronogramme sur un **écran d'analyseur** (sombre dans tous les thèmes). Les fils qui portent un 1 s'allument, ceux dont la grandeur bouge défilent. Rien n'est calculé à l'écran : c'est le pas du modèle, le même que le C (`modules/sw_lab.js`, `modules/sw_bench.js`).

**Reste** : la sortie à modulation (PWM) et un moteur simulé derrière, pour que les actionneurs proportionnels et le PI se voient tourner ; une table d'interpolation (la CTN sur toute sa courbe) ; les blocs Communiquer et Veiller ; les signaux d'une exigence reliés aux broches lues sur la carte (`sw/hwsw.js`) ; un bloc qui s'emboîte au clavier ; l'essai au toucher.

## 4 quater. La machine à états d'un module (v0.165.0)

Un genre d'objet de plus, `module_state` (« Module state machine », Décider) : **normal**, **dératé** tant qu'un avertissement tient,
**urgence** quand la chaîne des cartes se tait plus longtemps que le silence admis, **arrêt** — contacteur ouvert — sur un défaut ou
quand l'urgence dure ; on ne sort de l'arrêt que par un acquittement, sans défaut. Son pas en entiers, son C (`lib/dw_state.c`), sa
phrase d'exigence, et sa place dans un essai dos à dos : le logiciel du module BM 8s8p (`sw/sw_bm_design.js`), joué sur son banc,
écrit en C, compilé et comparé pas à pas (`tests/node/sw_module_state.test.mjs`). Voir `docs/BM_MODULE.md`, itération 15.

## 5. Ce qui est vérifié, ce qui ne l'est pas

Vérifié : 6 essais Node (`tests/node/sw_objects.test.mjs`) — objets, fils, guide, simulation, et le C compilé qui
redonne la trace du modèle sur **deux scénarios** (la surtension qui ouvre le contactor ; un contact auxiliaire qui ne
suit pas) ; le squelette du CPU compile ; 24 vérifications dans Chromium, dont le `.zip` téléchargé, extrait, compilé
avec la ligne du README et comparé.

Non vérifié, et dit à l'écran comme dans les fichiers : le C est un **squelette**, il n'a tourné sur **aucun
microcontrôleur** ; le code des registres reste à écrire avec la bibliothèque du fabricant (aucun code de fabricant
n'est repris) ; **aucune prétention de certification** — sous DO-178C ou ISO 26262, un générateur de code doit
lui-même être qualifié (DO-330 côté aéronautique, non lu). Les usages sur lesquels l'approche s'appuie (blocs dont on
génère le code, logiciel en couches, retard d'un pas pour ouvrir une boucle) sont écrits de mémoire.

Le pas à pas (v0.124.0) : 7 essais Node de plus (`tests/node/sw_steps.test.mjs`) — la machine pas à pas redonne, nombre
pour nombre, la trace du scénario ; le banc ouvre le contactor quand la cellule dépasse son seuil et voit un contact
soudé ; l'essai de démarrage trouve une sous-tension qui commande une sortie au repos ; la mémoire égale le `sizeof` du
compilateur ; 26 vérifications dans Chromium, les sept étapes une à une. Non essayé : au toucher, sur Firefox et Safari,
et par un vrai débutant.

Le cycle en V (v0.128.0) : 12 essais Node (`tests/node/sw_v.test.mjs`) — les niveaux et ce que les pages lues en
disent, la relecture des exigences, la trace dans les deux sens, les cinq essais de l'exemple qui réussissent et un
attendu hors fenêtre qui échoue, la couverture du modèle, le scénario écrit en mV et relu à l'identique, la liste de
livraison (l'exemple n'est pas prêt ; tout confirmé, il l'est), les sept étapes, les marches du V. Les deux documents
(v0.129.0) : 5 essais Node (`tests/node/sw_docs.test.mjs`) — chaque exigence et chaque essai de l'exemple y sont, un
essai qui échoue se lit dans le rapport, le PDF et le Word s'écrivent, le paquet reste en ASCII et compile dos à dos.

## 6. Reste

La machine à états comme une tuile que l'on ouvre (précharge, marche, charge, défaut) ; les objets Communiquer
(liaison RS-485 — le pilote existe, `docs/LIAISON_SERIE.md` —, CAN) et Veiller (watchdog, autotest) ; les tensions de
cellules reçues de l'électronique de cellules par la liaison (l'exemple lit une cellule sur une voie analogique, pour
le banc) ; les broches lues sur la carte (`sw/hwsw.js`) plutôt que tapées ; le banc du pack (`sw/plant.js`,
`sw/bms_hw.js`) et les pannes injectées ; la couverture ; le
journal de l'aller-retour IA (la réponse s'applique en une étape annulable, avec aperçu, mais n'entre pas au journal).

## 4 sexies. Trois niveaux, les unités de la physique, l'essai sur la carte (v0.190.0)

Demandes de JP, 24 novembre 2026 : « beaucoup trop de texte et d'étapes pour un ingénieur mécanique… trois niveaux de compréhension :
novice, intermédiaire et expert » ; « tous les aspects physiques en unités de la physique… gère la complexité en arrière-plan » ;
« être guidé comme pour le labo électronique, même interface, à tester le logiciel embarqué étape par étape sur la carte cible » ;
« importer une liste d'exigences SW de DynamiteAgile… le prompt du format via l'icône IA ».

- **Niveaux** (`sw/sw_levels.js`, bascule `modules/sw_level_ui.js`, gardée par le navigateur de chacun : `dw.sw.level`) — Novice : 3 étapes
  (ce qu'il doit faire, les blocs, essayer), une phrase par étape, des blocs nus, les capteurs et actionneurs plutôt que des broches, et
  **l'outil pose et emboîte les blocs** (`autoPlace` : la dernière sortie libre de la même clé, l'unité de ce qui nourrit le bloc, une
  valeur de référence de cette unité — `REF_BY_UNIT`) ; Intermédiaire : 5 étapes, la carte et les valeurs sur les blocs, les mots repliés ;
  Expert : le V complet. Le logiciel et ses règles ne changent pas avec le niveau : seulement ce qui se montre.
- **Unités de la physique** (`sw/sw_units.js`) : afficheurs, valeurs, instruments du banc et analyseur en V, A, °C, %, Wh ; ce que l'on
  tape est converti dans les entiers du logiciel (mV, mA, 0,1 °C, ‰), sur lesquels le C est prouvé dos à dos.
- **Exigences de DynamiteAgile** : l'export .csv de Goldmine se lit tel quel (`agileReqs`) — les exigences allouées au logiciel
  (colonne « allocation »), toutes sinon, et c'est dit ; le bouton « IA » des écrans du Logiciel (`modules/sw_ai.js`) donne le prompt
  du format standard avec les exigences du projet (leurs identifiants), ses broches et les nets de sa carte (`reqPromptWith`) ; une
  exigence renvoyée avec le même identifiant n'est pas doublée : elle reçoit son bloc. Une réponse appliquée entre au journal.
- **Essai sur la carte** (`sw/sw_hil.js`, écran `modules/sw_hil_ui.js`, le même que la Manipulation en labo) : sur la carte de
  l'Électronique — la sonde de programmation, l'alimentation réglée sortie coupée, le noir d'abord, le court-circuit cherché avant
  d'alimenter, le courant à la mise sous tension, le programme chargé — puis chaque entrée tenue par une source là où son net touche
  la carte (jamais sur la sortie d'un circuit : à la place du capteur, réglée jusqu'à la bonne tension), et chaque sortie relevée au
  multimètre, au repos puis chaque entrée au-delà de son seuil ; **ce que la sortie doit lire vient du modèle** (le même pas que le C).
  Un net non relié est proposé par son nom (AIN0, DIN0, DOUT0) et dit comme tel ; relevés et notes dans `project.swLab`. Rien de cette
  procédure n'a tourné sur une vraie carte, et l'écran le dit.

## 4 septies. La vue casse-tête, un seul lien par paire (v0.191.0)

Demandes de JP, 24 novembre 2026 : « je déteste cette interface et ce graphique… une vue simplifiée du schéma bloc qui branche en
arrière-plan ses bonnes interfaces, mais qui montre un seul lien en UI comme Node-RED pour les débutants… après un spaghetti de liens dans
un gros LabVIEW, ça devient incompréhensible… des pièces de casse-tête aux interfaces compatibles » ; choix cliqué : « Casse-tête 2D, 1 lien ».

- **Les pièces** (`sw/sw_puzzle.js` : `pieces`) : un capteur et le bloc qui le lit sont UNE pièce (« CTN · 30 °C ») ; une commande et la broche
  qu'elle mène aussi (« Contactor · ACTIF ») ; tout autre bloc est une pièce. Le logiciel du BM : 18 blocs, 12 pièces.
- **Trois bandes**, de gauche à droite : Capter, Décider (autant de colonnes que la chaîne a de pas), Agir (`puzzleLayout`).
- **Un seul lien par paire** (`links`) : il remplace tous les fils entre deux pièces (le nombre est écrit dessus) ; il s'allume quand il
  porte un 1, défile quand ce qu'il porte bouge ; un lien qui revient en arrière (la valeur du pas d'avant) est en tirets.
- **Relier** : un clic sur le tenon d'une pièce, puis sur la pièce qu'elle nourrit ; l'outil branche en arrière-plan chaque entrée libre
  qu'une sortie de la première peut nourrir (`connectPieces`), un bloc qui suit une unité prend celle de ce qu'on lui donne (avec une valeur
  de référence de cette unité). Les pièces qui ne peuvent pas la prendre se grisent.
- **La vue suit le niveau** : casse-tête pour le Novice et l'Intermédiaire, blocs détaillés pour l'Expert ; une bascule en haut du centre,
  gardée par le navigateur (`dw.sw.view`). Le banc (étape Essayer) se lit sur les mêmes pièces.

**Gardée en mémoire** (JP : « garde l'idée du 3D en mémoire, c'est super intéressant pour un concepteur mécanique ») : les mêmes pièces en 3D,
empilées en couches comme un vrai objet — capteurs en bas, décisions au milieu, actions en haut —, une vue que l'on tourne comme une pièce.

## 4 octies. Le profil d'utilisation, raconté (v0.192.0)

Demande de JP, 24 novembre 2026 : « pour la partie Essayer, un profil d'utilisation temporel avec des événements types qui arrivent et
déclenchent le logiciel via le matériel, et dont on voit la réponse (feedback produit et logiciel)… superposer la storyline temporelle avec un
pop-up qui raconte les événements, et laisser le multi-graphe du logiciel en dessous ».

- **Le profil** (`sw/sw_story.js`) : des événements datés — ce qui arrive au produit, en mots, et ce que cela met sur les broches (`set`,
  les entrées du banc). L'outil en écrit un pour tout logiciel (`autoProfile`) : la mise sous tension, puis chaque entrée au-delà du seuil
  qui la lit et son retour, chaque entrée logique basculée et rendue ; **l'entrée qui verrouille un défaut vient en dernier** (sinon le
  produit resterait à l'arrêt et l'on ne verrait plus rien). Un projet peut garder le sien (`design.profile`).
- **Joué sur le modèle** (`playProfile`, le même pas que le C) : pour chaque événement, ce que le logiciel et le produit ont répondu — chaque
  décision, l'état du module (NORMAL, DÉRATÉ, URGENCE, ARRÊT), ce que le logiciel commande sur la carte —, avec le temps écoulé.
- **À l'écran** (`modules/sw_story_ui.js`) : la ligne du temps sous les pièces, un numéro par événement, le curseur du banc qui court ;
  « Jouer le profil d'utilisation » repart de zéro en temps réel ; **la bulle** raconte l'événement puis coche les réponses quand le temps
  les atteint ; un clic sur un numéro rejoue jusqu'à lui. Le chronogramme reste dessous, ce que le logiciel commande en premier.
