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

## 2. Les essais

Chaque bloc de la bibliothèque (44 gabarits, `web/js/pcba/blocks.js`) a ses essais (88 en tout,
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
- `note` — une remarque sur un essai, montrée sur sa fiche.

Le guide signale un relevé hors plage ; le dossier de revue du projet dit, pour chaque carte, combien d'essais sont
au plan, combien sont de côté et combien ont des relevés.

## 5. Avec une IA

« Copier pour une IA » envoie la carte, la fiche de l'essai en cours et une consigne : relire l'essai comme le
ferait un ingénieur d'essais. La réponse revient par « Réimporter… » : aperçu des changements, validation, une seule
étape annulable. **Seuls les notes et les essais de côté se reprennent : une réponse ne peut pas réécrire un relevé**
— ce sont des mesures.

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
  constante de temps RC, coupure RC, bobine RL, résonance RLC, diode, gain et saturation d'un amplificateur) ; les 88
  essais des 44 blocs tournent et donnent des mesures finies ; les blocs de la carte de démonstration reliés entre eux
  donnent ses trois rails, et le régulateur tient sa sortie à la moitié de sa tension d'entrée nominale ; les valeurs clés rejoignent le calcul de conception
  du bloc (ou l'écart est expliqué) ; les fiches, le document Word et PDF, les plages, les relevés et leur verdict,
  l'aller-retour `.dwiz` du bloc `lab`.
- **Essayé dans Chromium** sur la carte de démonstration : ouverture depuis la barre du haut et depuis le PCBA,
  lecture, pause, position, vitesse, pistes et composants qui s'allument, deux oscilloscopes, DEL qui s'allume et
  s'éteint, écriture I²C, fonction de transfert, relevé conforme puis hors plage, guide, Ctrl + Z, essai mis de
  côté, plan annulé puis enregistré en Word et en PDF, aller-retour IA, fenêtre de 1366 px.
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
