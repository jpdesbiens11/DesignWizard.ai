# Le Labo — laboratoire d'électronique virtuel et plan de test fonctionnel

> Demande de JP : « après le module PCBA, un laboratoire d'électronique virtuel pour pré-tester les cartes avant de
> les faire fabriquer, et planifier un plan de test fonctionnel avec toutes les instructions, le détail des
> manipulations et les mesures attendues… pour des étudiants du bac en stage et de jeunes ingénieurs : le pourquoi de
> chaque essai et à quoi s'attendre, puis des manipulations très détaillées, comme un labo éducatif, mais pour de
> vrais résultats avec de vraies pièces. Les pistes et les composants doivent s'allumer, en orange ou en rouge ; on
> doit voir à l'oscilloscope le signal injecté et le signal de sortie ; un composant qui change d'état le montre. »

Le Labo est l'écran `#/elab/<carte>`, dans le groupe **Électronique** de la barre du haut, après le PCBA (qui y mène
aussi par son bouton « Labo »). Il fait deux choses avec la même simulation :

1. **Montrer** ce que fait chaque bloc de la carte sur un banc simulé — alimentation de laboratoire, générateur,
   charge, oscilloscope — avant que la carte existe.
2. **Écrire le plan de test fonctionnel** de la carte : une fiche par essai, avec le montage qui a servi à la
   simulation et les valeurs qu'elle a données, à retrouver au vrai laboratoire.

Ce n'est **pas** un simulateur de circuits général, ni un remplaçant de la fiche technique : voir « Ce qui est
simulé » et « Limites ».

## 1. L'écran

Même structure que les autres studios.

| Volet | Contenu |
|---|---|
| **Gauche** — ce que l'on choisit | En tête, épinglés : « Plan de test (.docx) » et « PDF ». Puis **le bloc à l'essai** (les blocs de la carte, groupés par nature — Raccorder, Protéger, Alimenter, Calculer, Mesurer, Commander, Communiquer, Signaler, Tester —, une couleur et un pictogramme par groupe), **l'essai** (ceux du bloc, chacun avec le dessin de sa nature et son interrupteur On / Off), ce que le guide demande, et l'aller-retour avec une IA. |
| **Centre** — ce que l'on regarde | **La carte vue de dessus** : les pistes et les composants du bloc s'allument avec le courant — du cuivre à l'orange, puis au rouge, avec un halo ; une liaison pas encore routée se montre en pointillé. Une DEL s'allume vraiment, un composant qui change d'état porte une étiquette (régulateur en régulation, interrupteur fermé, mémoire écrite…). Dessous, **la barre de lecture** (Pause / Rejouer, position, vitesse ÷ 4 à × 2 — la barre d'espace arrête et relance), puis **deux oscilloscopes** : voie 1, ce que l'on injecte ou ce qui commande ; voie 2, ce qui sort. Pour un essai en fréquence, les oscilloscopes cèdent la place à la **fonction de transfert** (gain et phase, coupure à −3 dB marquée). |
| **Droite** — ce que l'on obtient | Onglet **Fiche** : Comprendre (pourquoi cet essai, à quoi s'attendre), Le montage, Les réglages, Les étapes, Si le résultat s'écarte, Hypothèses de la simulation. Onglet **Relevés** : les états en direct, puis chaque mesure — attendue, plage acceptée, calcul de conception, et un champ pour **ce que l'on mesure au vrai laboratoire**, jugé « conforme » ou « hors plage ». |

L'écran s'ouvre sur un essai où quelque chose bouge, et le rejoue en boucle au ralenti : une fenêtre de 20 µs est
montrée en cinq secondes. L'oscilloscope a dix divisions par huit ; ses calibres sont dans la série 1 – 2 – 5, les
mêmes que ceux que la fiche demande de régler sur le vrai.

### Ce que les couleurs veulent dire

- **Une piste** s'allume selon la tension de son net : fixe et faible pour un rail continu, battante pour un signal
  — elle « flashe » pendant les cycles actifs.
- **Un composant** s'allume selon le courant qui le traverse, rapporté à son propre plus fort courant pendant
  l'essai : chacun va jusqu'au rouge quand il travaille le plus.
- **Une étiquette d'état** dit ce que le composant fait à cet instant : `1,8 mA` sur une DEL allumée, `5,00 V` sur
  un régulateur en régulation, `registre 0x10 mis à 0x40` sur un capteur I²C qui vient d'être écrit.

C'est une image du fonctionnement, pas une carte thermique : un composant rouge n'est pas un composant chaud.

## 1 bis. Le banc au-dessus de la carte : régler sur l'appareil

Demande de JP (20 novembre 2026, point 6) : « dans un lab, c'est intéressant de bien montrer comment les trucs sont
connectés… chaque appareil dessiné, ses cordons tirés jusqu'aux points de la carte, et ses réglages changés SUR
l'appareil — pas dans une section du volet de gauche ; ce qui ne se règle pas ici (le circuit vient du PCBA) est dit ».

- **Les appareils de l'essai** sont dessinés en bandeau au-dessus de la carte, dans l'ordre du banc : ce qui alimente,
  ce qui charge, ce qui envoie un signal, ce qui lit, ce que l'on fait à la main (`benchGear` de
  `web/js/pcba/lab_gear.js`, lu des liaisons de la fiche).
- **Un cordon par fil**, de la borne de l'appareil (dessinée : + et − d'une alimentation, COM et VΩ d'un multimètre,
  CH1 et CH2 d'un oscilloscope) jusqu'au point de la carte où il est pincé, de la couleur du fil ; le point est
  marqué sur la carte comme dans la manipulation (anneau, lettre, broche écrite en petit). Plusieurs fils sur la même
  pastille s'écartent en éventail. Les cordons suivent le zoom et le déplacement de la vue.
- **Ce qui se règle se tape sur l'écran de l'appareil** : la tension et la limite de courant d'une alimentation, la
  résistance d'une charge, et (v0.166.0) **le niveau haut, le niveau bas et la fréquence d'un générateur** quand l'essai
  lui donne un sinus ou un créneau simples — une forme que l'essai écrit point par point (impulsion, rampe, marches) reste
  la sienne, et une réponse en fréquence balaie toute sa plage : l'appareil le dit, et rien ne s'y règle. Entrée applique, Échap rend la valeur affichée, un champ vidé revient à ce que l'essai
  propose ; ↺ sur la carte de l'appareil revient à tout ce que l'essai propose. Chaque réglage est **une étape
  annulable** du carnet de la carte (`gear`) et l'essai est **simulé de nouveau** avec lui : les courbes, les valeurs
  attendues, la fiche, la manipulation et le plan de test suivent (le plan est le banc tel qu'il est réglé). Une
  valeur hors de ce que le banc accepte (0 à 60 V, 1 mA à 10 A, 0,1 Ω à 10 MΩ) est refusée et dite.
- **Ce qui ne se règle pas le dit**, sur l'appareil même : une source dont la forme EST l'essai (une rampe, un creux,
  une tension inversée) garde sa forme — seule sa limite se règle ; le générateur, l'oscilloscope, le multimètre, un
  composant d'essai, la pile, une charge à courant programmé. Et, au bout du bandeau : **le circuit vient du PCBA** —
  ses composants et leurs valeurs se changent dans le PCBA, pas sur le banc (lien « Ouvrir le PCBA »).
- **Un bouton de la carte s'appuie d'un clic dans la vue** : tenir le clic (ou la barre d'espace, le bouton ayant le
  focus) montre l'instant de la simulation où il est tenu — la DEL s'allume, l'état « Bouton appuyé » s'affiche, le
  doigt dessiné appuie — ; relâcher montre l'instant où il ne l'est pas (`pressFrames`). C'est la simulation que
  l'essai a jouée, avec l'appui qu'il écrit : le clic choisit l'instant montré, il ne relance rien.
- Le guide dit, en conseil, chaque appareil réglé autrement que l'essai le propose : « les valeurs attendues suivent
  ce réglage ». Une réponse d'IA ne change pas les réglages du banc (le réimport garde ceux de la carte).

Usage suivi : la face avant d'un appareil de banc — la valeur se tape là où l'afficheur la montre ; un cordon va de la
borne de l'appareil au point où il est pincé. Choix maison : les cordons dessinés par-dessus l'écran, de la carte de
l'appareil à la carte électronique.

### La plaque d'essai

Demande de JP (22 novembre 2026, sur une capture du Labo : « une vue breadboard plus clean… voir clairement ce qui se
connecte où sur la carte en laissant sortir les traces vers le breadboard de manière clean et en connectant les
instruments sur les pins du breadboard bien identifiés par tag de carte et d'équipement »).

- En haut à gauche de la vue, **« Plaque d'essai · Carte »** (un groupe de deux boutons radio ; ← → aussi). « Plaque
  d'essai » est la vue d'office ; le choix est gardé dans ce navigateur (`dw.lab.view`).
- **Plaque d'essai** : à côté de la carte, une plaque d'essai dessinée par l'outil. Chaque point de la carte que
  touche un appareil a **sa rangée** ; un **fil** part de sa pastille (un point de soudure, un anneau qui bat) et
  rejoint le premier trou de sa rangée. La rangée porte **l'étiquette du point** — la référence et la broche de la
  carte, puis son signal (« C3.1 · VIN ») — et le titre de la plaque, le nom de la carte. Les cordons des appareils
  arrivent dans les trous suivants, chacun avec sa lettre, et **l'étiquette de l'appareil** est écrite au bout de la
  rangée (« Alim. + », « Osc. S2 », « Charge C »). La rangée de la masse est sombre, son fil noir ; le fil du + d'une
  alimentation est rouge ; les autres ont chacun leur couleur.
- **Les fils ne se croisent jamais** : ils sortent de la carte tout droit, chacun dans son couloir, puis tournent une
  fois vers leur rangée ; les rangées gardent l'ordre de leurs points, et les couloirs sont rangés selon le sens où
  chaque fil tourne. Deux pastilles sur la même ligne : celle de droite sort tout droit, celle de gauche monte d'abord
  un peu — jamais jusqu'à la pastille suivante. Un essai le tient sur tous les essais des trois cartes d'exemple et
  sur trois mille jeux de points tirés au hasard (`crossings`).
- **Ce que la main fait sur la carte y reste** : le doigt sur un bouton, la pile dans son support sont marqués sur la
  carte, comme avant.
- La carte continue de s'allumer avec le courant ; le zoom, « Ajuster » et la loupe couvrent la carte et la plaque.
- **Carte** : la vue d'avant, les cordons directement sur les pastilles.

Placement : `breadLayout` et `crossings` de `web/js/pcba/lab_breadboard.js` (pur) ; dessin : `drawBread` de
`web/js/modules/elab_bread.js`, appelé par la vue de la carte (`labBoard().bread(on)`). Les trous des cordons sont les
marques que les cordons cherchent (`.lab-mark[data-gear] .lab-mark-dot`) : les cordons y descendent d'eux-mêmes.

Usage suivi : la vue « breadboard » des outils de prototypage (une rangée de cinq trous reliés, un fil par liaison) et
la sortie d'une piste routée (tout droit, un couloir par piste). Choix maison : une rangée par point plutôt qu'une
plaque réelle à 2,54 mm ; la plaque n'existe pas sur le vrai banc tant qu'on ne l'y pose pas — c'est une façon de
voir les liaisons, et le montage de la fiche reste celui des points de la carte.

## 1 ter. La table : plusieurs cartes sur le même banc

Demande de JP (20 novembre 2026, point 6) : « Labo à plusieurs cartes : deux vues à bascule — la table et le schéma des
liaisons, où un lien se change (l'outil refuse l'incompatible) ; deux cartes dont les interfaces s'accordent se relient
d'office ». Le bouton « La table » du Labo (`#/elab/table`, `modules/elab_table.js`) :

- **Les broches d'une carte** sont celles de ses connecteurs (J…), chacune sur un net de la carte, avec sa nature —
  alimentation, masse, signal, haute tension — et sa tension (`portsOf` de `web/js/pcba/lab_table.js`). Un connecteur de
  programmation (SWD) est dit : il va à la sonde de débogage, jamais à une autre carte.
- **Deux vues à bascule** : « Table » — les cartes posées côte à côte, leur contour et leurs connecteurs là où ils sont,
  les câbles entre elles, l'alimentation de laboratoire dessinée au-dessus et cordée à la carte qu'aucune autre ne nourrit
  (`benchFeeds`) ; « Schéma des liaisons » — une colonne par carte, ses broches en lignes, les câbles entre les colonnes.
- **Reliées d'office** : une carte posée sur la table se relie aux autres par les nets que leurs connecteurs partagent,
  avec une seule masse (`autoLinks`, `putBoard`) ; « Relier d'office » le refait.
- **Le montage est verrouillé** d'office — les câbles viennent des cartes et de l'IA ; un clic sur une broche dit ce
  qu'elle porte. **Déverrouillé**, ils se changent à la souris (JP, 22 novembre : « permettre les changements de connexion
  à la souris… lock / unlock setup ; si un expert HW designer veut s'amuser en connaissance de cause ») : un clic sur une
  broche puis sur une broche d'une autre carte, ou un glisser de l'une à l'autre. **L'outil refuse l'incompatible et dit
  pourquoi** (`linkCheck`) : une masse sur une alimentation, une alimentation sur un signal, deux tensions différentes, une
  haute tension sur une broche basse tension, deux liaisons différentes, les deux fils d'une paire croisés, deux broches
  d'une même carte, un connecteur de programmation. Chaque câble se met à Off ou se retire ; chaque changement est une
  étape annulable.
- La table est gardée dans le projet (`labTable`) et voyage dans le `.dwiz` ; le guide dit un câble qui ne tient plus
  (une carte a changé sous lui) et une carte posée sans câble.
- **Câblage, pas simulation** : les cartes de la table ne sont pas simulées ensemble ; chaque carte s'essaie dans la vue
  « Une carte ». L'écran le dit.

Usage suivi : un schéma de câblage — les broches en colonnes, un fil tiré de broche à broche. Choix maison : la masse
unique posée d'office, l'alimentation du banc posée sur la plus haute tension que rien ne nourrit.

## 2. Les essais

Chaque bloc de la bibliothèque (45 gabarits, `web/js/pcba/blocks.js`) a ses essais (92 en tout,
`web/js/pcba/lab_bench.js`). Un essai a une **nature**, qui dit avec quoi on le regarde :

| Nature | En français | Ce que l'on regarde |
|---|---|---|
| Power-up | Mise sous tension | la première fois : limite de courant, tensions des rails |
| DC levels | Niveaux statiques | ce que l'on lit au multimètre |
| Time response | Réponse dans le temps | ce que l'on voit à l'oscilloscope |
| Frequency response | Réponse en fréquence | la fonction de transfert, point par point |
| Function | Fonction | ce que le bloc doit faire : commuter, détecter, signaler |
| Bus | Bus de communication | niveaux et trames d'une liaison |

Quelques exemples de ce qui est simulé :

- **Alimenter** — régulateur abaisseur : première mise sous tension avec démarrage progressif, tension en charge,
  découpage et ondulation (nœud de commutation en voie 1, ondulation en couplage AC en voie 2, courant dans
  l'inductance) ; régulateur linéaire : entrée qui monte (chute minimale), échelon de charge.
- **Protéger** — inversion de polarité, surtension brève écrêtée ; seuil et relâchement d'un reset.
- **Mesurer** — pont à CTN selon la température (tableau à 0, 25, 50 et 85 °C) et son filtre ; shunt et capteur à
  effet Hall selon le courant ; amplificateur : gain, bande passante, puis sinus écrêté par les rails ; comparateur
  et son hystérésis ; entrée isolée par optocoupleur.
- **Commander** — charge inductive et sa pointe à la coupure, relais, pont en H (avant, frein, arrière), séquence
  d'un moteur pas à pas, demi-pont avec temps mort.
- **Communiquer** — niveaux CAN, RS-485, RS-232, LIN ; un caractère sur une liaison série ; une écriture I²C, à
  laquelle la mémoire, l'horloge ou la centrale inertielle répond par ses acquittements — et dit ce qu'elle a reçu.
- **Signaler** — une DEL qui clignote, les rebonds d'un bouton et ce qu'il en reste après le filtre.
- **Raccorder, Tester** — continuité des broches, carte hors tension : rien à simuler, la fiche dit où poser les
  pointes.

## 3. Le plan de test fonctionnel

« Plan de test (.docx) » ou « PDF » simule chaque essai de la carte, l'un après l'autre — le voile dit lequel, et
« Annuler » arrête entre deux — puis enregistre le document, au gabarit des documents de la plateforme (cartouche,
page de titre, journal des révisions, marque, note de confidentialité).

Le plan s'adresse à quelqu'un qui apprend le métier :

1. **À qui s'adresse ce plan, et comment s'en servir.**
2. **Sécurité** — huit règles du banc ; trois de plus si la carte porte un net de classe haute tension ou de 50 V
   et plus.
3. **Matériel** — chaque instrument, ce à quoi il sert, les essais qui le demandent.
4. **Avant de mettre sous tension** — liste à cocher : inspection, polarités, pas de court-circuit entre chaque
   rail et la masse.
5. **Ordre des essais** — comme le courant : ce qui protège et alimente d'abord, puis ce qui calcule, mesure,
   commande, communique, signale. Fiches numérotées E-01, E-02…
6. **Fiches d'essai**, une par page. Chaque fiche a deux moitiés :
   - **COMPRENDRE** — pourquoi cet essai, à quoi s'attendre.
   - **FAIRE** — le montage (chaque instrument, sur quelle patte de quel composant, **nommé comme sur la carte** :
     « patte 1 de C5 », « broche SW de U1 »), les réglages (tension et limite de courant de l'alimentation, calibre
     et couplage de chaque voie, base de temps, déclenchement), les étapes une à une, et le tableau des relevés avec
     une case « Mesuré » et une case « Conforme ».
   - **Si le résultat s'écarte** — où chercher —, **À retenir**, et les **hypothèses de la simulation**.

   Une fiche est écrite pour les instruments de son essai : un essai « au multimètre » dit où poser la pointe rouge
   et la pointe noire, et ne parle ni d'oscilloscope ni de déclenchement ; le générateur n'est cité que s'il y en a
   un. Un relevé qui demande un instrument que l'on n'a pas toujours — l'ondulation du courant dans une inductance
   demande une sonde de courant — est donné pour comprendre, marqué facultatif, et la fiche est complète sans lui.
7. **Essais d'ensemble** — la carte entière, une fois chaque bloc conforme.
8. **Feuille de résultats** et signatures.

### Les plages

La valeur « attendue » est ce que la simulation a donné, avec le montage de la fiche. La plage acceptée dépend de ce
que l'on mesure (`band()` de `web/js/pcba/lab_plan.js`) :

| Mesure | Plage |
|---|---|
| une tension | ± 5 % (± 50 mV au moins) |
| un courant | ± 20 % |
| un temps, une fréquence | ± 25 % |
| un gain (sans unité) | ± 10 % |
| un compte (acquittements, fronts) | exactement |
| une largeur (hystérésis) | ± 25 %, jamais négative |
| **un plafond** — ondulation, creux à l'échelon, niveau bas, écart récessif | « moins de… » |
| **un courant à la première mise sous tension** | la valeur simulée + 10 mA laissés au courant de repos des circuits intégrés, **qui n'est pas simulé** |

Une ondulation simulée est un plancher de la vraie (ni résistance série des condensateurs, ni tracé) : la fiche donne
donc un plafond — cinq fois le simulé, 20 mV au moins — et le dit.

La colonne « calcul de conception » rappelle ce que le bloc avait calculé à la main ; un écart de plus de 15 % est
signalé. Exemple de la démonstration : le filtre devant le convertisseur du pont à CTN coupe à 17,7 Hz dans la
simulation, contre 106 Hz au calcul — le calcul simplifié avait laissé de côté la résistance du pont lui-même.

**Toutes ces plages sont un choix maison** : elles se resserrent d'après la fiche technique de chaque composant.

## 4. Les relevés, les essais de côté, les notes

Ce que le Labo garde est dans le bloc `lab` de la carte, donc dans le projet, le `.dwiz` et l'historique :

```
lab
  reading B4/levels what="Tension de sortie" value=3.31
  skip B4/dropout
  note B4/levels text="Mesurer aussi à pleine charge."
```

- `reading` — une valeur mesurée au vrai laboratoire, pour une mesure d'un essai (`bloc/essai`). Elle se tape dans
  l'unité affichée (3,3 mA, pas 0,0033 A) ; chaque relevé est une étape annulable.
- `skip` — un essai mis à **Off** : gardé, avec ses relevés, mais hors du plan (règle « On / Off et copies »).
- `note` — une remarque sur un essai, montrée sur sa fiche ; avec `step`, ce que l'on a noté au banc sur une étape.
- `gear` — un réglage fait sur un appareil du banc (`bloc/essai`, l'appareil — `supply:VDD`, `load:OUT` —, et `v`,
  `ilim` ou `r`). Voir § 1 bis.
- `tick` — une étape du banc faite (`bloc/essai`, l'étape, l'heure) ; `pass` — un superviseur a laissé passer une
  étape (qui, pourquoi, l'heure). Voir § 4 bis.

Le guide signale un relevé hors plage ; le dossier de revue du projet dit, pour chaque carte, combien d'essais sont
au plan, combien sont de côté et combien ont des relevés.

## 4 bis. Manipulation en labo

Demande de JP : « un étudiant de 1re année… chaque étape pointée sur le schéma ou la carte directement, au lieu de
numéros de broches… s'assurer qu'on ne détruit pas les circuits par de mauvaises manipulations… un mode
"Manipulation en labo", plein écran, avec les étapes à faire et les notes / mesures à noter ».

« Manipulation en labo », en tête du volet de gauche, ouvre l'essai choisi **par-dessus la page, une étape par
écran** (`modules/elab_manip.js`) :

- **à gauche, la carte** — les pastilles que l'étape touche portent un anneau qui bat, le cordon qui y va (« + »,
  « − », pointe rouge « R », noire « N », sonde « S », pince de masse « M ») et, en petit, la référence et la broche.
  La vue se cadre sur les points en gardant au moins un bon tiers de la carte autour, pour savoir où l'on est ;
  « Toute la carte » dézoome. Une étape qui se fait sur l'appareil le dit ;
- **à droite, l'étape** — son genre (Sécurité, Régler l'appareil, Brancher sur la carte, Vérifier avant d'alimenter,
  Mise sous tension, Relever, Couper), ce qu'il faut faire, **l'appareil dessiné avec son réglage**
  (`modules/elab_gear.js` : tension, limite de courant et état de la sortie d'une alimentation, position du
  sélecteur d'un multimètre, voie d'un oscilloscope), le **pourquoi**, puis UNE action : « C'est fait », ou le
  relevé à taper dans l'unité affichée ; une case de notes — un champ de texte ordinaire : la dictée du système y
  tape, l'outil n'ouvre aucun micro et n'appelle aucun service.

**Tout se calcule sans IA** : les étapes viennent du journal du banc simulé (`pcba/lab_manip.js`, `manipSteps`), les
mêmes pour chaque essai ; chaque mesure dit quels signaux elle lit (`at`, relevé par le banc), et un signal se
ramène à une pastille par le même choix que les mots de la fiche (connecteur, point de test, patte d'un composant).

**L'ordre est le garde-fou.** Sécurité ; chaque source réglée **sortie coupée** ; les cordons posés, le noir
d'abord ; la **recherche d'un court-circuit avant d'alimenter** ; la relecture du montage ; alors seulement la mise
sous tension ; les relevés un à un ; la coupure. Un essai sans alimentation — le générateur seul fait vivre le
circuit — a les mêmes étapes, le générateur à la place de l'alimentation.

**Les verrous** (`manipState`) : une étape s'ouvre quand celles d'avant sont faites — cochée, ou relevée **et dans
sa plage**. Lire la suite est permis (les pastilles du haut, « Suivant », les flèches) ; la faire attend son tour, et
l'écran dit quelle étape attend. **Un relevé hors plage arrête l'essai** : l'écran dit de couper, de refaire la
mesure une fois, de comparer les pièces à la nomenclature — jamais de corriger le relevé. **Un superviseur peut
laisser passer**, avec son nom et sa raison : c'est écrit dans le carnet de la carte (`pass`) et montré au bilan.
Un relevé facultatif (il demande un appareil que tous les bancs n'ont pas) se passe d'un clic.

À la fin, **le bilan** : chaque relevé avec son attendu et son verdict, les passages, les notes.

Clavier : Entrée fait l'action, ← → changent d'étape, F met en plein écran, Échap ferme. Chaque coche, relevé et
note est une étape annulable (Ctrl + Z). Fermer ne perd rien : tout est dans le bloc `lab` de la carte.

**Sur papier** (`pcba/lab_manip_doc.js`). « PDF », en haut de l'écran, sort la procédure de l'essai au gabarit des
documents : pour chaque étape, ce qu'il faut faire, l'appareil et son réglage, le pourquoi, **une image de la carte**
quand l'étape la touche — dessinée en vecteurs : l'anneau sur la pastille, la lettre du cordon, la référence et la
broche —, une case « Fait », une case par relevé, des lignes de notes, et deux signatures. **Vide, c'est la
procédure ; remplie de ce que le carnet de la carte garde** — coches avec leur heure, relevés et leur verdict,
passages par un superviseur, notes —, **c'est le compte rendu**. « Tout le plan » fait le même cahier pour tous les
essais de la carte, sous le voile, annulable (233 pages pour les 26 essais de la carte de démonstration, à la v0.119.0).

Choix pris d'office (le menu a été fermé deux fois par un message ; ils se changent) : le mode est pensé pour un
portable ou l'écran du banc ; les étapes sont **verrouillées**, un superviseur passe outre et c'est noté ; le PDF
est écrit par l'outil.

### La première carte : mettre la pile, appuyer, relâcher

Point 4 de la suite convenue (JP, 21 novembre 2026 : « une pile, deux boutons, une DEL rouge et une DEL jaune »). L'exemple
**première carte** (PCBA et Labo) est la carte la plus simple : une pile bouton CR2032 et deux boutons qui allument chacun
leur DEL — S1 la rouge, S2 la jaune. Rien à programmer : on y apprend le circuit, les mesures, et l'ordre qui protège une
carte. Deux blocs sont nés pour elle, chacun avec ses essais :

| Bloc | Essai | Ce qu'il montre |
|---|---|---|
| **Pile** (`battery`) | « La pile, à vide puis en charge » | 3 V à vide, environ 2,95 V sous 5 mA : la chute dans la résistance interne de la pile (10 Ω, une valeur **typique** d'une pile neuve, pas lue sur une fiche — d'où une plage large) |
| **Bouton et témoin** (`push_led`) | « Appui : la DEL s'allume » | le bouton en série avec la résistance et la DEL : relâché, rien ne passe ; appuyé, environ 2 mA (560 Ω pour la rouge, 510 Ω pour la jaune, Vf typiques 1,9 V et 2,0 V) |
| **Carte entière** | « La carte entière sur sa pile, tous les boutons à la fois » | la pile au repos, puis tous les boutons appuyés : les DEL se partagent la pile, dont la tension baisse ; le courant de chaque DEL se lit sur la tension de sa résistance (I = U ÷ R) — il n'y a pas d'alimentation dont lire l'afficheur |

La manipulation en labo apprend un **geste à la main** (`do`), pointé sur la carte comme un branchement : « Appuyer sur
le bouton — et le tenir » avant les relevés qui le demandent, « Relâcher le bouton » à la fin (la DEL doit s'éteindre).
Sur une carte qui vit sur sa pile, la pile est **hors de son support** pendant la recherche de court-circuit, se met en
place ensuite (« Mettre la pile en place, le + vers le haut » — c'est la mise sous tension), et se retire à la fin. Un
relevé fait au repos (`before`) passe avant l'appui. Quand l'essai d'un bloc prend une alimentation de laboratoire à la
place de la pile, sa note dit de retirer la pile d'abord. Le banc écrit ces gestes dans son journal (`B.press`,
`B.cell` de `web/js/pcba/lab_bench.js`) ; la simulation appuie sur le bouton par `env.press` de l'essai.

## 4 ter. Le Labo dit en clair — et le banc relève ce que l'écran trace

Demande de JP (20 novembre 2026, sur une capture du bloc « Microcontrôleur » de la carte RS-485) : « je ne comprends
pas exactement comment faire les manips pour cette carte comme ingénieur mécanique ou étudiant : une partie est encore
cryptique, sûrement pour un pro du domaine. Simplifier et expliquer comme à un enfant de 16 ans. Il semble y avoir des
différences entre les mesures virtuelles du labo et ce qui est demandé dans le labo réel : expliquer pourquoi. »

**Ce qui clochait vraiment.** L'audit des 90 essais des gabarits de blocs a montré que la remarque était fondée :

- dans **47 essais faits au multimètre**, l'écran traçait une courbe — le rail d'alimentation, le plus souvent — que la
  fiche faisait brancher au multimètre **sans jamais demander de la relever** ;
- un essai (« Première mise sous tension » du microcontrôleur) demandait un **temps de 938 µs… au multimètre** ;
- dans les essais à l'oscilloscope qui lisent deux signaux, l'étape pointait la **pince de masse sur le second signal**,
  et l'essai du moteur pas à pas faisait poser la masse de la sonde sur une sortie du pont : au vrai banc, la pince est
  reliée à la terre, et c'est un court-circuit.

**La règle, tenue par le générateur des fiches** (`sheetFrom` de `web/js/pcba/lab_plan.js`, donc pour tout essai, d'un
bloc ou de la carte entière) :

| Ce que l'écran montre | Ce que la fiche demande |
| --- | --- |
| une courbe, dans un essai **au multimètre**, qui s'est stabilisée | un relevé « Tension sur X, une fois établie » : **la fin de la courbe** (`end` : la voie) |
| une courbe qui bouge encore à la fin (une tension montée à la main) | rien : c'est le bouton de l'alimentation ; le multimètre **surveille** un point, la valeur se lit sur l'alimentation |
| un **temps** ou une **fréquence**, dans un essai sans oscilloscope | la ligne « demande un oscilloscope », **facultative**, rangée en dernier (`scope`) |
| une tension **entre deux points** (`pair` : la mesure a lu une différence) | au multimètre : la pointe rouge sur l'un, la noire sur l'autre |
| une tension entre deux points **vivants**, à l'oscilloscope (`float`) | une sonde différentielle, ou deux sondes et leur différence — **jamais** la pince de masse |

Un seul multimètre, une mesure à la fois : les étapes « poser les pointes » d'avance ont disparu ; **chaque relevé dit
où vont les pointes** (la noire sur la masse d'abord), et le montre sur la carte. Dans un essai à l'oscilloscope, deux
signaux prennent deux sondes (S et S2), la pince (M) restant sur la masse ou là où une source de l'essai a déjà son retour.

**Dit en clair** (`web/js/pcba/lab_plain.js`, pur ; `web/js/modules/elab_plain.js`) :

- **« En clair »**, sous le titre de chaque étape : une ou deux phrases, sans mot du métier, avec l'image de l'eau
  quand elle aide — la tension est une pression, le courant un débit, la limite de courant un robinet de sécurité ;
- **« Les mots de cette étape »** : les mots du banc que l'étape emploie se déplient — quinze mots, chacun avec son nom
  du métier en anglais et une phrase ;
- **chaque point** de la légende dit ce qu'est son signal (« NRST — la remise à zéro : tant que ce fil reste bas, la
  puce attend sans rien faire ») ;
- **« Écran et banc »** (bouton du haut, et sur la première étape) : la correspondance — ce que le Labo a tracé, ce que
  l'on fait au banc pour chaque chose — puis **pourquoi ce n'est pas pareil**, en raisons courtes : des courbes à l'écran
  et un chiffre au banc ; l'écran rejoue au ralenti ; le courant partout à l'écran et à un seul endroit au banc ; le
  vrai chiffre un peu plus haut (le courant de repos n'est pas simulé) ; un temps très court ne se lit pas au
  multimètre ; le programme de la puce ne tourne pas ; des puces « typiques » ; une carte parfaite.

Dans le Labo même : sous les deux oscilloscopes, une ligne dit comment l'essai se fait au vrai banc, et un **anneau
blanc au bout de chaque courbe** porte ce que le multimètre y lit ; la fiche a son groupe « L'écran et le vrai banc ».
Le PDF des manipulations porte la phrase « En clair » de chaque étape, la correspondance et les mots du banc.

Ce qui n'est pas fait : le plan de test en Word / PDF n'a pas ce groupe (il a les nouveaux relevés) ; l'image de l'eau
est une image d'enseignement écrite de mémoire, sans source relue ; aucun débutant n'a encore lu ces phrases au banc.

## 5. Avec une IA

« Copier pour une IA » envoie la carte, la fiche de l'essai en cours et une consigne : relire l'essai comme le
ferait un ingénieur d'essais. La réponse revient par « Réimporter… » : aperçu des changements, validation, une seule
étape annulable. **Seuls les remarques et les essais de côté se reprennent : une réponse ne peut réécrire ni un
relevé, ni une étape cochée, ni un passage par un superviseur, ni une note prise au banc** — c'est ce qui s'est
passé au laboratoire.

## 6. Ce qui est simulé

- **Le solveur** (`web/js/pcba/lab_mna.js`) — analyse nodale modifiée : point de fonctionnement, réponse dans le
  temps (Euler implicite à pas fixe, Newton pour les diodes et les amplificateurs), réponse en fréquence en petits
  signaux. Résistances, condensateurs, inductances, sources, diodes, amplificateurs, sources commandées,
  interrupteurs.
- **Le circuit** vient du bloc lui-même : ses composants, leurs valeurs, ses nets (`blockCircuit`,
  `web/js/pcba/lab_devices.js`). Changer un paramètre du bloc dans le PCBA change la simulation.
- **Les circuits intégrés** sont remplacés par leur **comportement typique**, vu de l'extérieur : un régulateur
  linéaire tient sa sortie au-delà de sa chute minimale ; un régulateur à découpage est un modèle moyenné, avec
  démarrage progressif et limite de courant ; un transceiver donne ses niveaux typiques ; une mémoire écoute son
  adresse. Chaque fiche liste ces hypothèses.
- **Le banc** (`makeBench`) : chaque instrument branché câble la simulation **et** écrit le journal dont la fiche
  tire son montage — le plan décrit donc exactement le montage simulé.

## 6 bis. Les blocs ensemble : la carte entière

Choix de JP (19 novembre 2026) : simuler la chaîne de la carte d'un seul tenant, pour que les essais d'ensemble du plan
aient aussi leurs valeurs attendues.

Dans le volet de gauche, la tuile **« La carte entière »** précède les blocs. Les circuits de tous les blocs y sont
reliés par les nets de la carte (`web/js/pcba/lab_board.js`) : un net d'un bloc est le net de la carte qui porte l'une
de ses broches ; ce qui reste à l'intérieur d'un bloc garde un nom à lui ; chaque élément porte la référence de sa
pièce, si bien que ce qui s'allume est une pièce de la carte. Une seule alimentation de laboratoire, sur ce qui vient
du dehors ; chaque rail naît du précédent (`powerTree` : entrées, puis rails dans l'ordre où la puissance voyage).

Deux essais, qui terminent le plan (fiches « Carte entière », section « Essais d'ensemble ») :

| Essai | Ce que l'on relève | Plage |
|---|---|---|
| **Mise sous tension de la carte entière** | la tension de chaque rail ; le temps d'établissement du dernier rail ; le courant d'entrée, carte au repos | rails : ± 5 % ; temps et courant : un plafond (le courant simulé est un plancher) |
| **Montée et baisse lentes de la tension d'entrée** | la tension d'entrée à laquelle chaque rail régulé s'établit, puis lâche | ± 15 % : ce sont des seuils de comportements typiques |

Sur la carte de démonstration : 24 V, 5 V et 3,3 V établis ; le 5 V s'établit et lâche vers 5,2 V d'entrée (sa sortie
divisée par le rapport cyclique le plus grand du régulateur), le 3,3 V vers 4,5 V (mise en marche typique du
régulateur à découpage) — le rail le plus bas arrive le premier et lâche le dernier.

Ce que cette simulation ne fait pas, et que l'écran comme la fiche disent : le **programme du microcontrôleur ne
tourne pas** — ses broches ne commandent rien, une entrée de transceiver laissée seule est tenue au repos par son
rappel interne ; le courant de repos des circuits intégrés n'est pas là ; un bloc qui n'a pas encore ses composants
sur la carte est laissé de côté, et c'est dit.

## 7. Ce qui est vérifié, ce qui ne l'est pas

- **Vérifié par les tests** (`tests/node/lab.test.mjs`) : le solveur contre des réponses exactes (pont diviseur,
  constante de temps RC, coupure RC, bobine RL, résonance RLC, diode, gain et saturation d'un amplificateur) ; les 90
  essais des 45 blocs tournent et donnent des mesures finies ; les blocs de la carte de démonstration reliés entre eux
  donnent ses trois rails, et le régulateur tient sa sortie à la moitié de sa tension d'entrée nominale ; les valeurs clés rejoignent le calcul de conception
  du bloc (ou l'écart est expliqué) ; les fiches, le document Word et PDF, les plages, les relevés et leur verdict,
  l'aller-retour `.dwiz` du bloc `lab`.
- **Essayé dans Chromium** sur la carte de démonstration : ouverture depuis la barre du haut et depuis le PCBA,
  lecture, pause, position, vitesse, pistes et composants qui s'allument, deux oscilloscopes, DEL qui s'allume et
  s'éteint, écriture I²C, fonction de transfert, relevé conforme puis hors plage, guide, Ctrl + Z, essai mis de
  côté, plan annulé puis enregistré en Word et en PDF, aller-retour IA, fenêtre de 1366 px.
- **Manipulation en labo** — vérifié par les tests (`tests/node/lab_manip.test.mjs`) : pour les 26 essais de la carte
  de démonstration, l'ordre des étapes (sources réglées avant tout branchement, court-circuit cherché avant la
  mise sous tension, relevés après), chaque point nommé sur une pièce est une pastille de la carte, les verrous, le
  relevé hors plage qui arrête, le passage par un superviseur, l'aller-retour `.dwiz` des coches, des passages et
  des notes. Essayé dans Chromium (18 vérifications) : ouverture, étape verrouillée, branchement pointé, relevé
  hors plage, passage, note gardée quand on clique « Suivant », bilan, Échap et retour du curseur, fenêtre de
  1100 px ; le PDF d'un essai téléchargé depuis l'écran. Le cahier : l'image d'une étape et ses marques, une case
  par relevé, le cahier vide puis rempli, le document passé dans l'écrivain de PDF. **Non vérifié** : le plein écran du navigateur lui-même (le robot ne le déclenche pas), le toucher, une
  tablette, la dictée ; aucun étudiant n'a déroulé un essai avec.
- **Le banc réglé sur l'appareil** (§ 1 bis) — vérifié par les tests (`tests/node/lab_gear.test.mjs`) : les appareils
  de chaque essai de chaque bloc, chacun avec son dessin, une borne par fil, et un réglage ou la phrase qui dit
  pourquoi il n'en a pas ; le refus d'une valeur hors plage ; le carnet (`gear`) gardé, rendu, et dans le `.dwiz` ;
  l'essai simulé de nouveau avec le réglage (plus de volts, plus de courant), le plan qui suit, la carte entière
  aussi ; une rampe qui reste celle de l'essai ; les instants appuyé et relâché d'un bouton. Essayé dans Chromium sur
  la première carte : bandeau, cinq cordons, bouton tenu (DEL allumée) puis relâché, 4,5 V tapés sur l'alimentation
  (2,05 → 4,65 mA attendus), Ctrl + Z qui revient à 3 V et relance l'essai, aucune erreur. **Non vérifié** : le
  toucher, un bandeau de plus de cinq appareils sur un petit écran, un lecteur d'écran.
- **Non vérifié** : aucune carte réelle n'a été mesurée pour comparer — ni les valeurs, ni les plages. Les
  comportements typiques et les niveaux des bus sont écrits de mémoire, sans relecture d'une fiche technique ni d'une
  norme (registre des sources : `lab-devices` « usage », `lab-bus` « à vérifier »). Le plan n'a pas été déroulé par
  un étudiant sur un vrai banc. Firefox, Safari et le toucher n'ont pas été essayés.

## 8. Limites

- Les blocs se simulent ensemble pour deux essais de la carte au repos (§ 6 bis) ; les liaisons de signal entre blocs
  — bus, entrées analogiques, sorties — n'ont pas de valeurs simulées d'ensemble : le programme du microcontrôleur
  ne tourne pas. Le plan en garde la liste à suivre de bout en bout.
- Pas de résistance série des condensateurs, pas d'inductance des pistes, pas de bruit, pas de dérive en
  température des semi-conducteurs, pas de rayonnement. Le courant de repos des circuits intégrés n'est pas simulé.
- Euler implicite amortit ce qui oscille vite : un dépassement réel peut être plus fort que le simulé.
- Les microcontrôleurs ne sont pas exécutés : le Labo simule ce qui les entoure, pas leur programme.
- Un essai dure une seconde au plus dans le navigateur ; il tourne d'un trait, sous le voile. Le plan complet, lui,
  s'annule entre deux essais.
- Les calculs sont en SI, comme tous les écrans de calcul (`docs/UNITES.md`).

## 9. Pour une nouvelle brique

Un nouveau gabarit de bloc arrive avec ses essais (`T.<gabarit>` dans `lab_bench.js` — au moins un, chacun avec son
`why`, son `expect`, son `learn`) et, s'il porte un circuit intégré d'une famille nouvelle, son comportement dans
`lab_devices.js` avec la note qui dit ce qui est typique. Un test tient que chaque bloc de la bibliothèque a son
essai et que chaque essai tourne.
