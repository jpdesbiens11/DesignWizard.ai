# DesignWizard.ai — consignes pour Claude

Consignes permanentes de JP (propriétaire du dépôt). Elles s'appliquent à toute session.

## Façon de travailler

- **Écrire en français** à JP ; les termes techniques restent en anglais. Code et commentaires en anglais.
- **Faire les routines soi-même, sans demander** : tester, commiter, pousser la branche de travail, mettre `main` à
  jour, publier la démo. JP ne fait pas le secrétariat : ne lui donner une étape manuelle que si aucun outil de la
  session ne peut la faire, et dire alors laquelle, en une ligne, avec le lien direct.
- **Toute question à JP passe par un menu à cliquer** (l'outil de question à choix), jamais par une question posée
  dans le texte. Proposer deux à quatre choix, le conseillé en premier. Pas de question pour ce qui a une réponse
  évidente : choisir, le dire, continuer.
- Dire ce qui est vérifié et ce qui ne l'est pas ; ne jamais annoncer comme fait ce qui n'a pas tourné.
- **Communications et marketing** (demande de JP) : la présentation, les communications et le matériel marketing sont
  déposés dans le Google Drive de JP, dossier « DesignWizard.ai — Communications et marketing » (sous-dossiers
  `Présentations`, `Communications`, `Marketing`), au fur et à mesure qu'ils sont produits ; fichiers nommés
  `Sujet_AAAA-MM-JJ`. Le dossier « DesignWizard.ai » du Drive est l'arbre de travail de l'application : ne rien y déposer
  d'autre. Le connecteur Drive refuse un fichier de plus de 3 Mo environ : le dire à JP, ne pas contourner sans son accord.

## Publier (routine)

1. `node --test tests/node/*.test.mjs` et `python -m unittest discover -s tests/py -t .` : tout doit passer.
2. Commiter, pousser la branche de travail, puis pousser le même commit sur `main` (avance rapide seulement).
3. Le flux « Publier la démo » (`.github/workflows/pages.yml`) rejoue les tests et pousse `web/` sur `gh-pages` ;
   la démo est à https://jpdesbiens11.github.io/DesignWizard.ai/. Vérifier que le flux a réussi et que la page répond.
4. Ne jamais forcer `main`. La branche `gh-pages` est réécrite par le flux : ne pas y travailler.

## Règles du projet

- Application statique : modules ES, aucun outil de construction, aucune dépendance npm, aucune ressource externe
  sauf le service de connexion de Google et son sélecteur de fichiers (Équipe : lire le miroir partagé par un membre —
  choix de JP, la permission reste `drive.file`). Fichiers source de moins de 500 lignes. DOM par `el()` et `textContent`.
- Une brique = un module pur et testé, un écran, une entrée dans le rapport, ses mots dans `web/js/core/dwiz_names.js`.
- Format de fichier : `.dwiz` (voir `docs/FORMAT.md`) ; le JSON reste accepté. Nom anglais de l'Atelier : « Shop ».
- **Aller-retour IA partout** (demande de JP) : chaque module doit pouvoir exporter son artéfact sous une forme qu'une IA
  comprend (`.dwiz` + consigne courte), comme on confierait une tâche à un technicien ou à un stagiaire, puis
  réimporter l'artéfact modifié pour mettre à jour le projet — avec un aperçu des changements et la validation de
  l'humain avant d'appliquer (une seule étape annulable). Toute nouvelle brique naît avec cette fonction.
- **Guide partout** (demande de JP) : chaque écran dit en direct ce qui manque ou cloche — quatre niveaux, « à corriger »,
  « à entrer », « à vérifier », « conseil » (`web/js/core/guide.js`, bouton « Guide » de la barre du haut). Une valeur que
  l'outil invente est un exemple : son champ clignote jusqu'à ce qu'elle soit entrée ou confirmée, et l'action attend.
  Toute nouvelle brique donne sa liste au guide (fonction pure testée + `setGuide`). Voir `docs/GUIDAGE.md`.
- **Visuel, symbole, couleur** (demande de JP) : jamais une longue liste de texte seule. Tout choix à faire dans une liste
  se présente groupé par nature, chaque groupe avec sa couleur, chaque élément avec un pictogramme qui montre le concept
  et un titre court ; le détail vient ensuite. Les studios gardent tous la même structure : volet de gauche (ce que l'on
  entre), centre (ce que l'on regarde), volet de droite (ce que l'on choisit et ce que l'on obtient).
- **La marque sur tous les documents** (demande de JP) : tout ce que la plateforme produit — PDF, Word, texte, CSV, DXF, STEP, STL, Gerber, perçage, FeatureScript, `.dwiz`, JSON, ce qui part vers Drive ou vers Onshape, la présentation — porte le visuel de DesignWizard.ai là où le format le permet et la note « DesignWizard.ai™ by DynamiteAgile™ · Co-Intelligence WorkFlow™ — document généré par DesignWizard.ai. La version électronique fait foi ; la version imprimée est pour référence. » (`web/js/core/brand.js`, une seule source). Les livrables à lire (PDF, Word, dessins) portent en plus la **note de confidentialité** du projet et suivent le **gabarit des documents** : cartouche d'en-tête encadré sur chaque page (marque, titre, n° de document, révision, date, page), page de titre avec approbation et journal des révisions (`core/pdfdoc.js`, `core/docx.js`, `docIdentity`). Un écran enregistre un fichier par `download()`, jamais par un `Blob` à lui. Tout nouvel export naît avec la marque ; voir `docs/BRAND.md`.
- **Un média, pas une valeur** (demande de JP) : dans les modèles analytiques, une propriété de matière ou de fluide ne se tape pas — elle vient d'un **média connu** choisi dans la base (`web/js/analysis/physics/media.js`, écran `#/media`), affichée à côté, non modifiable. Menus : solides d'abord, puis liquides, puis gaz, par groupe et par nom. Tout nouveau modèle déclare ses médias (`MODEL_MEDIA`) ; tout nouveau média dit d'où viennent ses valeurs (`basis`) ; voir `docs/MEDIAS.md`.
- **Termes techniques en anglais** (demande de JP) : tout terme technique — procédé, opération, forme, interface, matière première, vocabulaire du mold (draft, parting line, slide, gate, riser…), soudage, revêtement, finition — se montre **en anglais, comme le métier le nomme** ; l'explication autour reste en français. Chaque table de vocabulaire donne `label` (anglais, ce que les écrans et les documents montrent) et `fr` (l'équivalent, pour le glossaire de l'Aide : `web/js/core/terms.js`). Toute nouvelle brique apporte ses termes avec les deux noms ; voir `docs/TERMES.md`.
- **Unités partout** (demande de JP) : le projet reste en millimètres et en SI ; les écrans écrivent dans le système choisi (SI ou impérial hybride — pouce, livre-force, psi ; le m, le m/s et le kg restent, une masse se lit « kg (lb) »). Une valeur qu'un écran écrit passe par `fmtLen` / `fmtDims` / `fmtMass`, une phrase d'outil par `inUnits`, un champ par `fieldValue` / `fromShown` (`web/js/core/units.js`, `core/dom.js`). Une carte électronique se lit en mil et en pouces (`web/js/pcba/board_units.js`) ; ses fichiers de fabrication restent en millimètres. **Les calculs d'ingénierie restent en SI** (choix de JP, 17 novembre 2026 : « les calculs d'ingénierie sont toujours en SI en ingénierie au Québec ») : les écrans de calcul — modèles analytiques, simulation, isolation —, la note de calcul et le classeur ne suivent pas le choix d'unités (`CALC_UNITS`) ; le choix est celui de la conception. Un nouveau calcul naît en SI. Toute nouvelle brique suit ; ce qui reste en millimètres est dit dans `docs/UNITES.md`.
- **Flèches à vitesse progressive** (demande de JP) : dans tout champ numérique, une flèche (▲ ▼ ou ↑ ↓) ajoute ou retire 1 ; maintenue ou cliquée vite, elle accélère — ×2, ×5, ×10 — et un témoin à côté du champ dit la vitesse ; n'importe quelle décimale se tape partout (`web/js/core/stepper.js`, une seule paire de flèches pour toute l'application). Un nouveau champ numérique est un `input[type=number]` ordinaire : il en hérite sans rien déclarer ; ne pas lui refaire des flèches à lui. Voir `docs/ERGONOMIE.md`.
- **Une opération longue se voit et s'annule** (demande de JP) : tout ce qui peut durer — construire, analyser, router, projeter — montre le voile commun : ce qui se fait, une ligne de progression, le temps écoulé, un mot quand rien n'avance, et un bouton « Annuler » qui arrête vraiment, puis « Reprendre » (`web/js/core/busy.js`, `core/progress.js` ; `vp.setBusy(texte, { done, total, cancel })` dans une vue 3D, `busyVeil` ailleurs ; `kernel.cancel()` ; un export ou un envoi passe par `underVeil`). Ne jamais laisser l'écran figé sans dire pourquoi ; une nouvelle opération longue naît avec son voile et son annulation. Voir `docs/ERGONOMIE.md`.
- **Dessins en anglais, classeur vivant** (choix de JP) : tout ce que l'outil écrit sur un dessin est en anglais, en millimètres ou en pouces selon les unités choisies (`docs/DESSINS.md`). Ce que le projet a tapé s'y écrit dans son anglais quand le projet l'a donné (`project.drawing.words`, `web/js/core/drawing_words.js`) ; toute démonstration arrive avec l'anglais de ses dessins (`web/js/demo/demo_words.js`). Tout modèle analytique part avec un classeur Excel dont les résultats, les marges et les verdicts sont des formules (`web/js/analysis/physics/xl_*.js`) ; un nouveau modèle arrive avec les siennes, vérifiées par les tests (`docs/CALCULS.md`).
- **Sources partout** (demande de JP) : toute méthode, convention ou norme qu'un outil utilise a sa ligne dans le registre des sources (`web/js/core/methods.js`, écran Aide) — ce qu'elle couvre, ce que l'outil en prend, et son **niveau de vérification vrai** (lu, testé, page lue, extrait, à vérifier, usage, choix maison, non lu). Une définition qui prête à débat (les TRL, par exemple) se cite telle que publiée, avec ses références en bas de page. Toute nouvelle brique ajoute ses lignes ; voir `docs/SOURCES.md`.
- Vie privée : aucune adresse courriel dans le dépôt (les comptes approuvés sont des empreintes dans `web/acces.json`),
  aucun secret ; l'identifiant client OAuth est public. Pas de contenu H55.
- Étude de logiciels tiers : méthode REA (`docs/REA.md`) — seulement ce que l'on possède ou que l'on est autorisé à
  étudier ; jamais le code d'un service propriétaire.
- Visuels : inspiration de principes, pas de portrait, pas de nom de personne vivante, pas de marque.
- Procédés spéciaux (demande de JP) : moulage, extrusion, découpe laser de précision, tôlerie pliée et impression 3D vivent dans
  l'Atelier. Leurs valeurs sont des valeurs typiques de guides publiés ; chaque fiche dit ce qui a été lu et ce qui
  ne l'a pas été (`basis`, `SOURCES`) — ne jamais donner pour vérifié un chiffre qui ne l'est pas.
- Connecteurs et cellules (demande de JP) : la bibliothèque renvoie aux **séries standard de l'industrie des grands
  fabricants** et aux normes publiées — fabricant et série cités en texte, comme référence de compatibilité, sans logo
  ni dessin copié. Valeurs nominales publiées, avec la façon dont elles ont été vérifiées ; la fiche du fabricant fait foi. **Chaque série a son modèle**, reconstruit par
  la plateforme d'après les cotes publiées (`web/js/cad/connector_series.js`, générateurs `cad/connector_models.js`), avec
  son empreinte de carte ; chaque série dit le niveau de lecture de ses cotes (`dims` : lues, lues en partie, à vérifier)
  et ce qui a été lu (`basis`). Aucun dessin ni modèle 3D de fabricant n'entre dans le dépôt. Toute nouvelle famille
  arrive avec sa série.

## Documents de référence

`docs/VISION.md` (objectif et briques), `docs/ARCHITECTURE.md`, `docs/FORMAT.md`, `docs/SIMULATION.md`,
`docs/PCBA.md`, `docs/GAMMES.md` (gammes de fabrication et d'assemblage), `docs/MOULAGE.md` (pièce moulée), `docs/EXTRUSION.md` (profilé extrudé), `docs/PROCEDES.md` (procédés spéciaux de l'Atelier : découpe laser par matière en feuille, impression 3D par matière, sources lues et non lues), `docs/TOLERIE.md` (tôlerie pliée : bloc `folded`, développé à plat et DXF avec lignes de pliage, règles de pliage mesurées), `docs/JOINTS.md` (registre des joints, joint collé, santé des accouplements), `docs/IA.md` (aller-retour IA), `docs/GUIDAGE.md` (le guide : avertissements en direct, champs qui clignotent, niveaux), `docs/ERGONOMIE.md` (audit d'ergonomie de tous les écrans, `tools/ergo_audit.mjs`), `docs/ITERATIONS.md` (itérations MVP, revues de passage, convergence), `docs/EQUIPE.md` (travail à plusieurs en miroir, fusion par artéfact, messages @membre), `docs/REVISIONS.md` (révisions libérées, numéros, règle 3F, pièces gelées dans l'assemblage), `docs/ELECTRIQUE.md` (bibliothèque de connecteurs et de cellules, joints soudés, contact à pression et ses trois formes — bossages, lames, bande), `docs/DESSINS.md` (dessins, cotes à bulles, caractéristiques spéciales, révisions et cas d'emploi), `docs/PRESENTATION.md` (présentation guidée `web/presentation.html` : pages, notes, captures), `docs/VIDEO.md` (vidéo de présentation de 2 min 33, française et anglaise : ligne de temps, rendu, voix de synthèse ; film parlé : pas de sous-titres sauf quand le son du lecteur est coupé), `docs/SOURCES.md` (registre des sources des méthodes, conventions et normes ; niveaux de vérification), `docs/MARKETING.md` (étiquettes et autocollants posés sur une face plane ou un cylindre, rendu marketing), `docs/CALCULS.md` (note de calcul Word / PDF et classeur Excel d'un calcul analytique, formules vivantes), `docs/MEDIAS.md` (base des médias : solides, liquides, gaz ; propriétés dérivées dans les modèles analytiques), `docs/TERMES.md` (termes techniques en anglais, glossaire anglais ↔ français), `docs/UNITES.md` (choix d'unités de la conception : SI ou impérial hybride ; SI à l'intérieur, conversion à l'affichage ; les calculs restent en SI), `docs/GOOGLE.md`, `docs/REA.md`, `docs/BRAND.md`.
