# Logiciel — le logiciel embarqué d'un BMS, par objets reliés

Demande de JP (20 novembre 2026) : « est-ce qu'on peut avoir une approche de design logiciel via des objets visuels
adaptés qui se codent tout seuls en librairie, module et structure de fichiers pour un CPU de BMS embarqué, sachant
les in/out à gérer, leurs plages et le CPU choisi ». Choix cliqués le même jour : **des tuiles reliées** ; **un
microcontrôleur de sécurité à double cœur d'abord** ; « EFC » = energy flow counter, nommé par sa fonction.

Écran : `#/sw` (Électronique › Logiciel). Première tranche, v0.121.0 : **une chaîne complète**, du dessin au C compilé.

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

## 6. Reste

La machine à états comme une tuile que l'on ouvre (précharge, marche, charge, défaut) ; les objets Communiquer
(liaison RS-485 — le pilote existe, `docs/LIAISON_SERIE.md` —, CAN) et Veiller (watchdog, autotest) ; les tensions de
cellules reçues de l'électronique de cellules par la liaison (l'exemple lit une cellule sur une voie analogique, pour
le banc) ; les broches lues sur la carte (`sw/hwsw.js`) plutôt que tapées ; le banc du pack (`sw/plant.js`,
`sw/bms_hw.js`) et les pannes injectées ; la couverture ; le zoom de la page (elle défile, la loupe l'agrandit) ; le
journal de l'aller-retour IA (la réponse s'applique en une étape annulable, avec aperçu, mais n'entre pas au journal).
