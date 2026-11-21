# Logiciel — le logiciel embarqué d'un BMS, par objets reliés

Demande de JP (20 novembre 2026) : « est-ce qu'on peut avoir une approche de design logiciel via des objets visuels
adaptés qui se codent tout seuls en librairie, module et structure de fichiers pour un CPU de BMS embarqué, sachant
les in/out à gérer, leurs plages et le CPU choisi ». Choix cliqués le même jour : **des tuiles reliées** ; **un
microcontrôleur de sécurité à double cœur d'abord** ; « EFC » = energy flow counter, nommé par sa fonction.

Écrans : le groupe **Logiciel** de la barre du haut (depuis la v0.128.0 ; avant, Électronique › Logiciel, `#/sw`).
Première tranche, v0.121.0 : **une chaîne complète**, du dessin au C compilé. Depuis la v0.128.0, le **cycle en V** (§ 4 ter).

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
