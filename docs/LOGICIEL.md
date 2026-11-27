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

## 4 quaterdecies. Le casse-tête sans fil (v0.199.0)

Demandes de JP, 25 novembre 2026 : « enlever les lignes pour connecter directement les blocs par l'interface physique au lieu de fils… un
keying qui peut différer selon le type de compatibilité » ; puis « s'il faut dupliquer une fonction pour la mettre à 3 places, mais pouvoir
ouvrir un bloc d'interface où on voit la combinaison de tout, let's do it ; le visuel doit être simple et se comprendre d'un coup d'œil ».
Trois façons ont été montrées en image (arbres et jumeaux, rails typés, prises nommées) ; la première est retenue.

- **Chaque rangée finit sur une action** (ou sur une décision que rien ne lit) ; ce qu'elle demande s'emboîte contre son bord gauche, et
  ainsi de suite vers la gauche : la languette d'une pièce dans l'encoche de la suivante, sans écart (`puzzleForest` de `web/js/sw/sw_puzzle.js`).
- **La clé dit ce que la prise porte** : sa forme et sa couleur viennent du type du signal (`SIGNAL_TYPES`, `keyPath` de `sw/sw_blocks.js`) —
  une décision 0 / 1, une grandeur, un état, une commande ; la légende est sous les rangées. Une pièce qui prend deux branches est aussi
  haute que les deux.
- **Une pièce partagée est posée une fois**, là où elle sert d'abord (la plus grande rangée d'abord) ; ailleurs c'est un **jumeau** — la
  même pièce, en pointillé, sa valeur en direct. Une boucle (la valeur du pas d'avant) est un jumeau marqué ↺.
- **Le bloc d'interface** (`modules/sw_puzzle_iface.js`, `pieceInterface`) : le « ×n » d'une pièce, ou un clic sur un jumeau, l'ouvre — la
  pièce au milieu, ce qu'elle prend emboîté à sa gauche, et chaque endroit où elle va, avec sa clé. « Ouvrir sa fiche » mène à ses valeurs.
- Brancher reste deux clics : la prise ronde en bas à droite d'une pièce, puis la pièce qu'elle nourrit ; l'outil choisit les bonnes prises
  (`connectPieces`). Le logiciel ne change pas : seule la façon de le voir change.

Ce qui suit : l'échelle de la logique à relais (IEC 61131-3), une sortie par échelon et un contact répété autant de fois qu'il est lu ; les
piles des langages par blocs qui s'emboîtent sans fil. Vérifié par `tests/node/sw_puzzle.test.mjs` : chaque pièce touche celle qu'elle
nourrit, sa clé est celle de l'encoche, rien ne se chevauche, chaque pièce est posée une seule fois hors jumeaux. Non vérifié : un essai
par une personne qui n'a jamais programmé.

## 4 quindecies. Une seule simulation du module, des profils tirés des seuils (v0.201.0)

Demande de JP, 25 novembre 2026 : « le comportement de ces 2 fenêtres doit suivre le même profil de recharge en simulation ; présentement, c'est
séparé. On doit définir le profil de charge et de décharge afin de couvrir tous les cas de l'enveloppe de fonctionnement et trigger les safety…
exporter et importer un profil… le démarrer et voir les conséquences dans la logique SW implantée » ; choix cliqué : « Tirés des seuils du logiciel ».

- **Le module sur le banc** (`web/js/sw/sw_pack.js`) : les 8 CORE (courbe, résistance, équilibrage passif de `sw_balance.js`), un chargeur
  (0,1 C, montée, 2 C, tension constante) ou une charge, la température du CORE le plus chaud (I²R, résistances, air ou pompe). Il tourne AVEC le
  logiciel, une seconde à la fois (`liveStep`, `sw/sw_live.js`) : contacteur ouvert, aucun courant ; dératé, le courant tenu à 0,5 C (le véhicule
  et le chargeur tiennent la demande 30 s) ; pompe en marche, quatre fois mieux refroidi. Ses capteurs vont aux broches que `design.plant` nomme —
  le banc les montre lues, pas réglées.
- **Les deux fenêtres et le banc montrent la même chose** : « Charge et équilibrage » suit le module du banc (son transport est celui du banc),
  le monitoring aussi ; le temps va jusqu'à ×400 ; un profil applique chaque événement à son instant exact (`setAdvance`), même en accéléré.
- **Les profils** : `missionProfiles` écrit la charge et la décharge à partir des seuils du logiciel (`packLimits`) — chacun franchi au moins
  une fois par la physique : courant (chargeur qui pousse, charge qui tire), température (chaleur du dehors), communication, tension haute
  (chargeur qui oublie sa tension constante), tension basse (module qui se vide) ; un défaut retenu est acquitté. `coverage` dit ce qu'un
  profil ne franchit pas. Les réponses du logiciel sont recueillies pendant que le profil joue.
- **Les fenêtres dans les volets** (v0.201.2, JP) : le monitoring s'ouvre par-dessus le volet de gauche, « Charge et équilibrage » par-dessus
  celui de droite (inversés en v0.201.4, JP) (`dockOver` de `modules/sw_drag.js`) ; le volet reste dessous, intact, et revient au clic sur le ×.
- **Le fichier** (`sw/sw_profiles.js`) porte `module.mode`, `module.start`, `module.load`, `module.push`, `module.cv_fail`, `module.heat_to`,
  `module.ambient`, et en 5e champ les seuils visés ; il revient tel quel ; le prompt pour l'IA les nomme.

Ce que le banc montre déjà, et qui est à revoir : le seuil « High voltage — watch » (4,18 V) est franchi pendant une charge normale à 4,2 V, et
le module oscille entre normal et dératé toutes les 30 s — un seuil d'exemple trop serré, à confirmer. Tout est TYPIQUE (courbe, résistance,
masse thermique, refroidissement) et l'écran le dit. Vérifié par `tests/node/sw_pack.test.mjs` (chaque seuil déclenché, contacteur ouvert,
aller-retour du fichier) et dans le navigateur ; non vérifié : un essai sur une vraie batterie.

## 4 sedecies. La vue Mission, l'arrêt sur défaut (v0.202.0)

Demande de JP, 26 novembre 2026, sur une capture du banc : « replace the central part of the simulation with an overlay that shows the duty cycle of
the component vs. time, we can export/import actual profile, when we meet a limit, user must restart the profile by clicking on "continue" if fault
is manageable ».

- **L'enregistrement** (`sw/sw_live.js`) : le module sur le banc garde une ligne par seconde — tensions du CORE le plus haut et du plus bas,
  température, courant, état du module, chaque sortie du logiciel, le nombre de CORE qui s'équilibrent (`L.rec`) ; `recordCsv` l'écrit en CSV.
- **La vue Mission** (`modules/sw_mission.js`) prend la place des pièces pendant qu'un module est sur le banc : trois panneaux (tensions,
  courant, température) avec les seuils du logiciel en pointillé (jaune : à surveiller ; rouge : défaut retenu), l'état du module en bande de
  couleur, une bande par composant avec son **taux de marche** (`dutyOf`), les événements numérotés, le curseur de maintenant. Le chronogramme
  des dernières secondes s'efface derrière elle ; « Voir les pièces » ramène les pièces et lui.
- **Un défaut arrête le profil** (`modules/sw_story_ui.js`) : quand le module passe en URGENCE ou à l'ARRÊT, le temps s'arrête, un bandeau dit
  les conditions qui ont déclenché et l'événement en cours ; « Continuer » reprend — « Acquitter et continuer » quand la cause est retombée (une
  pression de 0,3 s sur l'acquittement), sinon le temps la fera retomber et le profil acquittera ensuite.
- En tête de la Mission : exporter le profil joué (.txt), en importer un (la banque), exporter l'enregistrement (.csv, avec la marque).

Vérifié par `tests/node/sw_mission.test.mjs` et dans le navigateur (charge jouée à ×400 : arrêt à la surchauffe, « Continuer », arrêt à la
perte de communication). Non vérifié : un essai sur une vraie batterie.

## 4 septdecies. Brancher à la souris, une porte qui grandit, la Mission en plein écran (v0.203.0)

Demandes de JP, 25 et 26 novembre 2026 : « déconnecter et connecter les blocs à la souris manuellement ; pour les grands blocs, il prendrait de la
hauteur si on branche le dernier connecteur, si c'est possible de l'agrandir ; pour un bloc fermé in/out, aucune expansion automatique » ;
« we don't see the title… and the axis measure » ; « a full screen mode for the central area… with a normal screen button to get back ».

- **Les prises libres** (`freeSlots` de `web/js/sw/sw_snap.js`) : chaque entrée qu'aucun fil n'atteint est une prise en pointillé, à la clé de
  son type, sous ce qui est emboîté ; la pièce en est plus haute (`SNAP.SLOT`).
- **Glisser-déposer** (`modules/sw_puzzle_view.js`) : une pièce prise suit le pointeur ; la prise la plus proche s'allume — verte si la clé va
  (`connectTo` : la sortie qui entre dans CETTE prise), rouge sinon, et la raison est dite au lâcher ; une pièce emboîtée tirée loin de sa voisine
  s'en débranche (`detach`). Chaque geste est une étape annulable.
- **Une porte qui grandit, sans changer le C d'un genre** : une porte ET, OU ou OU exclusif (associatives) aux entrées prises offre « + » ; une
  décision lâchée là ajoute une porte de même opération en cascade (`growInto`, `grownOf`) — la vue montre la chaîne comme UNE pièce, « (3
  entrées) ». Tout autre genre est fermé.
- **La Mission** : titres au-dessus des panneaux, unité, graduations et grille, temps gradué en minutes, étiquettes de seuils qui ne se
  chevauchent plus ; « Plein écran » (Marche / Pause, bandeau du défaut et « Continuer » dedans), « Écran normal » ou Échap.

Vérifié par `tests/node/sw_snap.test.mjs` et dans le navigateur (Over-voltage débranché puis rebranché par glisser ; plein écran, arrêt,
« Continuer », Échap). Non vérifié : le glisser au toucher.

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

## 4 nonies. Monitoring du BM-SWAP, profils de charge et de décharge (v0.193.0)

Demandes de JP, 24 novembre 2026 : « des cas extrêmes au niveau tension et température de cellules qui déclenchent les limites et l'alarme, une
LED d'état général (vert = bon, jaune = warning, rouge = over limit)… si on tombe à rouge, un son de buzzer dans le canal de son du PC, pas trop
agressant… le contacteur ouvre 2 secondes dans le profil… un tableau de bord au pilote du BM qui allume des LED quand on a des conditions à
surveiller, avec les valeurs… un pop-up ouvert / fermé, titre « Monitoring du BM-SWAP » » ; puis, sur une capture : « la fenêtre du profil cache
les valeurs… jouer chaque partie une à la fois… Suivant… une pompe à WEG pour du cooling liquide » ; puis : « un profil de charge et un de
décharge avec des événements critiques — comm, voltage, current, temperature —, un bouton pour passer de l'un à l'autre, réservés à un produit
avec un ESS… ou une banque de profils de mission en .txt qui peuvent venir de l'IA ».

- **Le témoin d'état** : un nouveau genre de bloc, `state_lamp` (`sw/sw_kinds_more.js`, son C `dw_lamp` dans `sw/sw_c_more.js`) — l'état
  d'un module sur trois sorties, une seule allumée : vert (NORMAL), jaune (DÉRATÉ), rouge (URGENCE, ARRÊT). Prouvé dos à dos avec le logiciel
  du BM.
- **Le logiciel du BM** (`sw/sw_bm_design.js`) : la tension la plus basse en plus de la plus haute ; des seuils « à surveiller » (4,18 V,
  3,10 V, 60 °C, 95 A en décharge et en charge) qui dératent, des limites (4,25 V, 2,80 V, 75 °C) qui retiennent un défaut et ouvrent le
  contacteur ; un bouton d'acquittement ; trois DEL, un buzzer sur le rouge, une pompe de refroidissement eau-glycol (WEG, nouvelle brique
  `pump` de `sw/sw_devices.js`) qui démarre à 45 °C. Tous les seuils sont des exemples, à confirmer. Un projet ouvert avant cette version
  garde l'ancien logiciel : « Mettre à jour le logiciel du BM » (étape Essayer) le remplace en une étape annulable.
- **Deux profils de mission** (`design.profiles`) : **Charge** et **Décharge**, chacun avec ses événements critiques au fil du temps — la
  chaîne RS-485 qui se tait, une tension, un courant au-delà de ce que le module tient, une température — ; chaque cas rouge ouvre le
  contacteur et quelqu'un acquitte **2 s plus tard** (en vrai, des millisecondes ; 2 s pour le voir). Un acquittement est une impulsion
  (`pulse`), son relâchement un événement caché (`expandProfile`). La bascule Charge | Décharge n'apparaît que lorsque le logiciel garde
  plusieurs profils : un produit avec un ESS les reçoit ; un autre produit joue celui que l'outil écrit, ou ceux qu'il importe.
- **La banque** (`sw/sw_profiles.js`, `modules/sw_profile_bank.js`) : un profil est un **.txt**, une ligne par événement
  (`t (s) | titre | ce qui arrive | variable = valeur unité ; …`), les variables étant les entrées du banc de ce logiciel, en unités de la
  physique (V, A, °C). Le prompt pour une IA nomme ces variables, leurs unités et leurs plages, et prend la demande en une phrase ; à
  l'import, chaque ligne fautive est dite avec sa raison (variable inconnue, unité, valeur hors de ce que la broche lit), et rien n'entre
  avant « Ajouter à la banque » — une étape annulable. Un profil s'exporte en .txt et se relit à l'identique.
- **« Suivant »** (`modules/sw_story_ui.js`) : un seul événement, le temps qui court jusqu'à ce que tout ce qu'il cause soit arrivé, puis
  l'arrêt — on lit l'état, les valeurs et les sorties. **Le récit** est une bande sous la ligne du temps : il ne cache plus les pièces.
- **La fenêtre « Monitoring du BM-SWAP »** (`sw/sw_monitor.js`, pur ; `modules/sw_monitor_ui.js`) : lue dans le logiciel, rien à déclarer
  — l'état général en feu tricolore, une DEL par seuil (rouge s'il mène à un défaut, jaune s'il fait dératé ; un seuil qui ne fait que
  démarrer une pompe est une action, rangée avec le produit), sa valeur en unités physiques et son seuil ; le contacteur, le défaut, la
  chaîne, la pompe, le buzzer. Elle flotte, se déplace par sa barre de titre (place gardée), se ferme, ou s'ouvre dans sa propre fenêtre
  pour un deuxième écran. Le titre vient du logiciel (`design.monitor.title`).
- **Le son** (`modules/sw_sound.js`) : tant qu'un buzzer commandé par le logiciel sonne, l'ordinateur joue un carillon doux — deux notes
  sinusoïdales descendantes, faibles, toutes les deux secondes —, fait par le navigateur (Web Audio), rien d'enregistré ; il se coupe dans
  la fenêtre de monitoring, et le choix est gardé (`dw.sw.sound`). Un navigateur ne laisse une page faire du son qu'après un clic sur elle.

Non vérifié : le son sur Safari et Firefox, la fenêtre à part sur un vrai deuxième écran, un profil écrit par une vraie IA.

## 4 decies. Des exigences sans bout libre, le tour guidé, le questionnaire (v0.194.0)

Demandes de JP, 24 novembre 2026 : « voici un exemple de fichier de requis… s'assurer que tout est couvert par des blocs et des interfaces ? je l'ai
essayé et il y a des bouts libres » ; « je ne vois pas les 9 choses à corriger, ce serait le fun d'avoir un tour guidé » ; « pour approuver les
paramètres de chaque bloc, un questionnaire pop-up qui passe au travers de chaque bloc, avec un Approve en haut à droite et un Next… un « ? »
dans le coin des blocs avec des entrées à confirmer » ; « des blocs non connectés comme le Buzzer… compléter le schéma ».

- **Le format des exigences** (`sw/sw_req_import.js`) : un bloc à plusieurs entrées ou sorties les nomme toutes — `"inputs": { "a": "SWR-017",
  "b": "SWR-018" }`, `"outputs": { "emergency": "emerg_flag" }` ; une source peut nommer le port d'un autre bloc (`"SWR-024.close"`). Sans
  `inputs`, un bloc prend aussi les identifiants que sa phrase cite (« SWR-017 OR SWR-018 ») ; une source à plusieurs sorties donne la
  première qui convient, et l'aperçu le dit. L'exigence de mise à l'échelle d'un signal déclaré est portée par le bloc de ce signal (plus de
  second bloc sans entrée). Une exigence sur la période du logiciel est tenue par l'architecture. Le prompt demande « aucune entrée de bloc
  sans fil, aucun signal inutilisé ».
- **Les bouts libres** (`looseEnds`) : un signal lu par aucun bloc, une sortie commandée par aucun, une entrée de bloc reliée à rien, une
  exigence dont le bloc est à venir ou qui n'en nomme aucun — dits dans l'aperçu de l'import, avant d'appliquer ; le guide dit aussi une
  broche lue par aucun bloc. **Un fichier qui déclare ses signaux devient un logiciel neuf** (une étape annulable) ; « Compléter le
  logiciel actuel » reste au choix — c'est ce mélange qui laissait des bouts libres.
- **Le tour guidé** (`modules/sw_fix_ui.js`) : « n à corriger », en haut à gauche des blocs, prend les points du guide un à un — ce qui
  cloche, en mots, « Aller au bloc », « Précédent », « Suivant » ; une chose corrigée sort de la liste.
- **Le questionnaire** : « n valeurs à approuver » passe chaque bloc dont des valeurs sont à confirmer — valeurs tapées en V, A, °C, leur
  origine (une exigence, ou la référence de l'outil) —, « Approuver » en haut à droite confirme le bloc (et ce qui a été tapé) en une étape
  annulable, « Plus tard » le remet à la fin ; rouvert, il ne montre que ce qui reste. Un **« ? »** orange marque le coin de chaque bloc
  (ou pièce du casse-tête) qui a des valeurs à approuver ; un clic ouvre le questionnaire sur lui.
- **Le logiciel du BM** : « Mettre à jour le logiciel du BM » remplace un schéma d'avant la v0.193.0 (un Buzzer posé seul, par exemple) par
  le schéma complet, sans bout libre ; les exigences qui nommaient des blocs disparus les perdent, et le guide les dit.

Non vérifié : la version 2 du fichier d'exigences de JP n'entre pas au dépôt (c'est sa base d'essai) ; l'essai automatique utilise un fichier
fabriqué. Les blocs « à venir » (protection rapide, état de charge, équilibrage, CAN, chien de garde, mémoire, pente, vraisemblance) laissent
leurs exigences portées par rien, et c'est dit.

## 4 undecies. Les broches et la carte, sans faux problème (v0.195.0)

JP, 24 novembre 2026, sur une capture : « j'ai une valeur qui semble ne pas être prise en compte… que je n'arrive pas à régler pour partir la
simulation, c'est quoi la bonne valeur ? ». Ce n'était pas la voie : le point du guide était « 14 blocs de broche sans net de la carte », et le
tour menait au premier bloc, la voie en surbrillance. Trois défauts derrière :

- **Une valeur relue d'une liaison n'est pas une broche** : les tensions et la température des CORE arrivent par la chaîne RS-485 ; le banc
  les tient à la place (`bench` sur l'objet : son étiquette dit « Banc · … », sa fiche dit pourquoi, le guide n'en demande rien).
- **Ce que la carte ne peut pas porter est du matériel à ajouter, pas un réglage** : `hwProblems` compte, par sorte de broche (analogique,
  entrée, sortie), les nets du microcontrôleur encore libres ; tant qu'il en reste, relier est « à vérifier » (et le tour amène sur le net) ;
  au-delà, c'est un conseil — « un net à ajouter dans son PCBA ; rien à régler ici : la simulation tourne ». En Novice, la fiche d'une
  broche à relier montre le net à choisir.
- **Une broche n'est jamais partagée** : deux broches sur la même voie ADC ou le même GPIO sont une erreur, avec la première voie libre
  proposée (`nextPin`) ; une broche posée prend d'office la première libre.
- **Le logiciel du BM** relie ce que la carte du BMS central porte (`AIN0` : courant du module ; `DIN0` : contact auxiliaire ; `DOUT0` :
  bobine du contacteur ; `LED_STATUS` : DEL verte) ; les autres sorties (DEL jaune et rouge, buzzer, pompe) et le bouton d'acquittement
  attendent des nets à ajouter au PCBA de la carte. « Mettre à jour le logiciel du BM » reprend cette version.

## 4 duodecies. Charge et équilibrage passif (v0.196.0)

Demande de JP, 24 novembre 2026 : « pour le profil de charge, on doit partir avec les batteries à 3,0 V (plage de 100 % de SOC de 2,5 V à 4,2 V)
et aussi avoir une opération du mode de balancement passif visuel entre plusieurs cellules débalancées ; probablement que la charge ralentit
pendant ce temps, et on passe de 0,1 C à 2 C, et on peut voir en mode accéléré ce que ça donne ».

- **Le bloc « Passive balancing »** (`balancing`, `sw/sw_kinds_more.js`, son C `dw_balance`) : un bloc de cellules se décharge par sa
  résistance tant qu'il dépasse le plus bas de plus de `delta` (20 mV), au-dessus de `v_min` (3,90 V), et seulement quand le pack ne se
  décharge pas ; il s'arrête sous `hyst` (10 mV). C'est le SWR-043 d'un fichier d'exigences : ses clés sont celles du fichier. Le logiciel
  du BM le porte (un par CORE dans la simulation).
- **Le profil de charge** part de 3,0 V : 0,1 C, puis 2 C (72 A, le maximum de la fiche Molicel P45B : 9 A par cellule, 8 en parallèle),
  l'équilibrage qui se branche à 4,19 V, la charge qui ralentit, la résistance qui se débranche sous 10 mV.
- **La fenêtre « Charge et équilibrage »** (`sw/sw_balance.js`, pur ; `modules/sw_balance_ui.js`) : 8 CORE en série, chacun sa capacité et
  son état de charge de départ (déséquilibrés, en exemple), une courbe de tension TYPIQUE (0 % = 2,5 V, 100 % = 4,2 V, écrite de mémoire),
  une résistance par CORE (exemple). Le chargeur : 0,1 C pendant 2 min, montée à 2 C en 1 min, 2 C, **ralenti pendant qu'une résistance
  décharge** (0,5 C d'office, réglable — 0,1 C allonge la charge de plusieurs heures), tension constante à 4,2 V sur le CORE le plus haut,
  fin quand le courant tombe sous 0,05 C et que l'écart est sous le seuil. **Le logiciel décide** : le pas du bloc, une fois par CORE, sur
  des tensions corrigées de la chute courant × résistance (sans cela, 2 C le fait battre autour de 3,90 V). À l'écran : une colonne par
  CORE (niveau, tension, écart au plus bas, résistance allumée et son courant), le chargeur en A et en C, la phase, l'écart, la chaleur
  dissipée, les tensions dans le temps ; ×1 à ×10 000.
- **Ce qu'on y apprend** : à 0,5 A par résistance, rattraper quelques pour cent d'un CORE de 36 Ah prend des heures — l'essentiel de la
  charge simulée est l'équilibrage en fin de charge. Non vérifié : la courbe et la résistance réelles de la P45B (fiche p. 3 : ≤ 8 mΩ à
  1 kHz, pas une résistance en continu).

## 4 terdecies. L'équilibrage visible, les sources citées (v0.197.0)

JP, 25 novembre 2026 : « la fenêtre de charge et équilibrage ne peut être déplacée… je ne vois pas les cellules progresser… une lumière verte quand
le balancing commence, en parallèle ou en série avec la recharge, peu importe le standard de l'industrie… mettre des sources pour le comportement et
ajouter une section Références dans le bas du menu Logiciel ».

- **Les fenêtres flottantes se déplacent** par leur barre de titre, leur place gardée (`modules/sw_drag.js`).
- **L'équilibrage tourne pendant la charge** : ce que prévoit le manuel d'un circuit de surveillance du commerce (TI BQ76952, § 10.1 :
  « pendant la charge ou au repos »). Ralentir la charge pendant qu'une résistance décharge reste un réglage (« Pendant l'équilibrage »,
  2 C d'office), dit comme un choix du projet : aucune source lue ne le demande.
- **La lumière verte** : « Équilibrage actif · n CORE » en tête de la fenêtre de charge ; dans le monitoring, une DEL « Passive balancing »
  (lue dans le logiciel : un bloc `balancing`) et, tant que la charge tourne, **les 8 CORE** — leur niveau, leur tension, leur écart, bordés de
  vert quand leur résistance décharge.
- **Références** (`sw/sw_refs.js`, écran `#/swref`, dernière tuile du groupe Logiciel) : quinze sources, par sujet, chacune avec son niveau de
  lecture (les mots du registre de la plateforme), ce qu'elle dit que l'outil utilise et les écrans qui la citent ; `refCite(id)` pose un
  numéro [n] sur un écran. **Ce qu'aucune source lue ne dit** est listé à part (`REF_GAPS`). Les sources ont été ouvertes et lues pour cette
  version ; les pages de l'ISO et d'Analog Devices ont refusé la lecture automatique, et c'est dit.

## Les exigences du produit, d'abord (v0.204.0)

Le groupe Logiciel commence par la page des exigences du produit (`#/lreq`), la même liste de DynamiteAgile que la Mécanique et l'Électronique, filtrée sur le logiciel ; l'étape 1 du V (`#/swreq`, « Exigences du logiciel ») les reçoit sous leurs clés par « Vers les exigences du logiciel (V) » ou « Depuis le produit (n) ». Voir `docs/EXIGENCES.md`.

Les exigences du produit prouvées par essai sont **lues par la machine** et tracées en pointillé tagué sur la vue Mission, avec leur verdict profil par profil (v0.205.0) : voir `docs/EXIGENCES.md`, « Lue par la machine ».

## Deux types de cartes : les CORE boards transmettent, la principale écoute (v0.207.0, v0.208.0)

JP, 27 novembre 2026 : « 2 pcb types that speak to each other when powered with 12 V… the main might not send anything to the core pcb… use the
core pcb to feed all other functions using sensors from core + sensors from the main » ; choix par menu : round-robin fixe (CORE 1 ouvre le cycle,
chaque CORE transmet après la précédente), passive balancing local au threshold, sans 12 V la carte principale en standby sur le module et les
CORE boards silent ; « utilise les termes anglais techniques toujours ».

- **Le logiciel du BMS central ne transmet rien aux CORE** : ce que leurs frames apportent (la plus haute et la plus basse cell block voltage,
  la NTC la plus chaude, le balancing, le timeout du round-robin) reste une entrée du banc, dite comme telle ; ce que la carte principale lit
  elle-même a sa broche.
- **Le bloc « Passive balancing » quitte le logiciel du BM** — il reste dans la bibliothèque, pour un BMS à balancing central. Le balancing est
  la règle de chaque CORE board (`CORE_BALANCE`, `coreBleed`, `localRule` de `sw/sw_balance.js` ; `plant.balance` du logiciel) : le module simulé
  du banc la fait tourner, « Charge et équilibrage » le dit (`data-bal-local`), et le monitoring montre « Balancing des CORE — local, signalé
  dans leur frame » (une entrée `pin_din` marquée `device: "balancing"`).
- **Le 12 V** (`wake`, `DIN0`) entre dans la condition de fermeture du contactor avec l'ENABLE du véhicule et la présence. Sans lui, le logiciel
  tourne en standby, le contactor reste ouvert, et un round-robin silent n'est pas une emergency (`silent` = timeout ET WAKE → `module.lost`) ;
  le monitoring suit l'entrée que nomme `plant.lost`.
- **Non fait** : le firmware de la CORE board (l'outil montre un logiciel par projet), la lecture des frames des CORE et l'écriture de celle du
  véhicule. Voir `docs/BM_MODULE.md` (itération 18).

## Le parcours allégé : six étapes, la campagne HIL virtuelle (v0.210.0)

JP, 27 novembre 2026 : « lean tout ce qui n'est pas des requis, interfaces HW, fonctions… passer rapidement à des tests logiciels embarqués HIL
virtuels, qui ne coûtent rien, pour valider les profils de missions et les différences specs, limites, corner cases, performances et safety… itérer
rapidement » ; choix par menu : « Alléger le parcours d'abord ».

| Étape | Écran | Ce qu'elle montre |
|---|---|---|
| 1 Exigences | `#/lreq` | les exigences du produit allouées au logiciel, lues par la machine (oracles) |
| 2 Interfaces | `#/swio` | chaque entrée et sortie du logiciel sous la fonction de la carte qui la porte : net, broche, plage, capteur ou actionneur ; puis ce que les autres cartes disent dans leurs frames (`interfacesOf`) |
| 3 Missions | `#/swmis` | une carte par mission profile : durée, événements, limites franchies ; ce qu'aucune mission n'atteint |
| 4 Banc HIL | `#/swsim` | le banc existant : le logiciel contre le module simulé, la vue Mission |
| 5 Constats | `#/swfind` | la campagne : toutes les missions jouées, chaque exigence jugée sur chacune ; le constat en .csv et .md (`runCampaign`, `findingsCsv`, `findingsMd`) |
| 6 Export | `#/swrel` | le paquet C, quand les constats sont verts |

- **Pour tous les niveaux**, la barre du haut montre ces six écrans (`navKeys` de `web/js/sw/sw_lean.js`) ; le **niveau Expert** y ajoute le
  cycle en V et les blocs détaillés (`EXPERT_KEYS`). Sous Expert, la tête des écrans du V et leur carte d'étape suivent les six étapes
  (`modules/sw_lean_ui.js`, `V_TO_LEAN`).
- **La campagne** (`web/js/sw/sw_campaign.js`) joue chaque mission comme le banc, sans écran ni arrêt sur défaut, en tranches (`campaignRun`) :
  l'écran montre sa progression et « Annuler ». Pour la tenir rapide, le pas du logiciel est écrit une fois (`machine` de `sw/sw_design.js` : le
  plan du pas précalculé, le même pas) et le banc ne garde pas de trace pendant une campagne (`liveStart(d, 0)`) — 35 s → 7 s pour les deux
  missions du BM, les mêmes verdicts, les essais dos à dos en C inchangés.
- **Premier constat du BM** (deux missions, 72 et 74 min simulées) : ESS-REQ-002 (≤ 4,20 V en service), ESS-REQ-015 (65 °C en charge) et
  ESS-REQ-024 (équilibrage) échouent ; ESS-REQ-003 et 004 (360 A, 72 A) non couvertes ; 23 exigences non lues par la machine.
- **Virtuel** : le module est typique ; l'écran et les fichiers le disent. **Ensuite** : les missions tirées des exigences (phase 2), puis la
  boucle IA (constat + consigne → nouvelle version → toute la campagne rejouée, acceptée sans régression).

## La boucle IA : nouvelle version, acceptée sans régression (v0.211.0)

JP, 27 novembre 2026 : « export de toutes les données HIL + prompt → IA → nouvelle version du logiciel importée, qui rejoue tous les duty cycles
pour voir si la mise à jour est bonne » ; « un genre de ML en design » ; choix par menu : « Boucle IA ». Sur l'écran Constats (`#/swfind`), trois
gestes (`web/js/sw/sw_loop.js`, pur ; `modules/sw_loop_ui.js`) :

1. **Le paquet** (`loopFiles`) — un .zip : `PROMPT.md` (la consigne : corriger ce qui échoue sans rien faire échouer d'autre ; ne toucher ni aux
   interfaces HW, ni au banc, ni aux missions, ni aux exigences ; une valeur changée reste un exemple), `constat.md` et `constat.csv`,
   `requirements.md` (chaque exigence et ses limites lues par la machine), `software.json`. Tout porte la marque. L'outil n'appelle aucune IA.
2. **La nouvelle version** (`readCandidate`) — la réponse collée ou en fichier : ses changements dits ; ce que la boucle **remet** (le banc
   `plant`, les missions `profiles`, la carte, chaque broche sur son net) dit aussi ; une valeur changée par la réponse perd sa confirmation ; un
   logiciel qui ne tourne pas, un genre inconnu ou « aucun changement » sont refusés avant tout.
3. **La porte** (`compareCampaigns`) — toute la campagne rejouée sur la nouvelle version, sous le voile (progression, « Annuler »), comparée
   limite par limite **et mission par mission** : une case qui tenait et ne tient plus, ou un nouvel échec, est une **régression**. Une seule, et
   « Accepter » reste fermé. Accepter est **une étape annulable**, écrite au journal des réponses d'IA (`journalChange`), qui pose un point
   « Après l'IA » dans l'historique ; la comparaison sort en .md (`compareMd`).

**Essayé sur le BM** : une version qui ouvre à 4,20 V corrige ESS-REQ-002 sans régression — acceptée ; une version qui monte la
surtempérature à 90 °C fait échouer ESS-REQ-015 en décharge — refusée ; une version qui déplace la bobine du contactor sur un autre net la voit
remise. **Non vérifié** : un tour avec une vraie réponse d'assistant (le format est celui de l'aller-retour existant du logiciel).


## Les missions tirées des exigences (v0.212.0)

JP, 27 novembre 2026 : « toutes les missions de l'équipement — les variations in / out que le logiciel doit tenir dans les bornes des requis » ;
choix par menu : « les missions viennent des requis ». La campagne ne joue plus les profils écrits à partir des seuils du logiciel : sa mesure
est lue dans les exigences (`web/js/sw/sw_req_missions.js`, pur ; écran `#/swmis`).

| Sorte | Ce que la mission fait |
|---|---|
| Nominal | une charge à 1 C jusqu'au bout de la tension constante, une décharge à 2 C jusqu'à 0,4 V au-dessus de la limite basse — rien ne doit réagir à tort |
| Limites des exigences | chaque limite lue par la machine (borne ou réaction) : **approchée** (à 0,02 V, 3 °C ou 5 % de la limite), **franchie et tenue** (0,03 à 0,05 V, 3 °C ou 10 % au-delà), puis **revenue** et acquittée ; deux limites sur la même grandeur à la même valeur font une seule mission (ESS-REQ-002 et 014 à 2,80 V) |
| Enveloppe | ce que le produit doit atteindre : 360 A en décharge, 72 A en charge, tenus 60 s |
| Corner cases | le plus grand courant d'un sens, au bord de la température qui retire le service dans ce sens (360 A à 73 °C, 72 A à 63 °C) |
| Pannes injectées | le round-robin des CORE perdu, le 12 V perdu, le contact auxiliaire du contactor resté ouvert, puis collé pendant un défaut |
| Profils du projet | les duty cycles importés dans la banque du banc ; ceux que l'outil a écrits à partir des seuils restent sur le banc (`projectProfiles`, marque `from: "thresholds"`) |
| Lot de réserve | 4 missions de 8 segments tirées au hasard dans l'enveloppe et autour, d'une graine lue dans les exigences (`reserveSeed`) : le même lot tant qu'elles ne changent pas |

- **Le cell emulator du banc** (`cellHi`, `cellLo` de `sw/sw_pack.js`, aussi dans les .txt de la banque) : un canal qui tient le cell block le plus
  haut ou le plus bas à une tension, comme un banc HIL de BMS. Une montée lente franchit un seuil d'un mV, que la seconde suivante efface ; la
  mission le franchit nettement et l'y tient. Les broches du logiciel et la règle de la CORE board lisent le bloc tenu.
- **Le juge** (`core/req_oracle.js`) lit le sens de marche qu'avait le module quand son contactor l'a coupé : un logiciel qui ouvre à 75,0 °C pile
  a répondu, il n'a pas « quitté la décharge ». ESS-REQ-013, 014 et 015 à 75 °C, « non exercées » avant, sont jugées et tiennent.
- **Une enveloppe** est couverte par une mission ; les autres ne la « manquent » pas (le bilan d'avant déclarait ESS-REQ-004 non couverte alors
  que la mission Charge l'atteignait).
- **La règle nominale** (`NOMINAL_RULE`, `nominalVerdict` de `sw/sw_campaign.js`) : dans une mission nominale, une fois fermé, le contactor reste
  fermé et le module n'entre jamais en Emergency ni en Shutdown. C'est une **règle de la campagne, pas une exigence de la liste**, et la ligne le dit.
- **Dans la boucle IA**, le lot de réserve ne part pas (`visibleCampaign` : le constat et la consigne le retirent, la consigne dit qu'il existe et
  nomme les limites qui n'échouent que là) ; la porte le rejoue. La porte rejoue les missions de la version en main (`missionsOf`), et une
  campagne jouée sur d'autres missions (`missionSig`) est à rejouer d'abord ; une mission que la première campagne n'a pas jouée n'est pas une
  régression.

**Le constat du BM** : 22 missions, 4 h simulées, 12 s. 14 limites jugées : ESS-REQ-002 (4,20 V), 015 (65 °C en charge) et 024
(équilibrage) échouent ; 013, 014, 015 (75 °C), 016, 047 et la règle nominale tiennent ; 003 et 004 couvertes ; 0 non exercée.

**Trois versions à la porte** : ouvrir à 4,20 V corrige ESS-REQ-002 mais coupe le contactor au bout d'une charge nominale — refusée ; ouvrir à
4,21 V passe toutes les missions visibles de ESS-REQ-002, pas le lot de réserve (un cell block tenu à 4,205 V) ; ouvrir au-delà de 4,200 V
(4,201) corrige ESS-REQ-002 sans régression — acceptée. **Constat pour JP** : à 360 A, le module tombe sous 3,10 V (chute de 1,15 V sur la
résistance typique) et se dérate dans la seconde ; ESS-REQ-003 dit « en continu » — l'oracle ne juge que l'atteinte, pas la tenue.

**Ce que les missions ne font pas** (`GAPS`) : une limite franchie moins d'une seconde (le banc relève une ligne par seconde) ; une exigence non
lue par la machine (les pannes l'exercent sans la juger) ; le froid (ESS-REQ-050 non lue). Le module est typique.
