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
  ni dessin copié. Valeurs nominales publiées, avec la façon dont elles ont été vérifiées ; la fiche du fabricant fait foi.

## Documents de référence

`docs/VISION.md` (objectif et briques), `docs/ARCHITECTURE.md`, `docs/FORMAT.md`, `docs/SIMULATION.md`,
`docs/PCBA.md`, `docs/GAMMES.md` (gammes de fabrication et d'assemblage), `docs/MOULAGE.md` (pièce moulée), `docs/EXTRUSION.md` (profilé extrudé), `docs/PROCEDES.md` (procédés spéciaux de l'Atelier : découpe laser par matière en feuille, impression 3D par matière, sources lues et non lues), `docs/TOLERIE.md` (tôlerie pliée : bloc `folded`, développé à plat et DXF avec lignes de pliage, règles de pliage mesurées), `docs/JOINTS.md` (registre des joints, joint collé, santé des accouplements), `docs/IA.md` (aller-retour IA), `docs/GUIDAGE.md` (le guide : avertissements en direct, champs qui clignotent, niveaux), `docs/ITERATIONS.md` (itérations MVP, revues de passage, convergence), `docs/EQUIPE.md` (travail à plusieurs en miroir, fusion par artéfact, messages @membre), `docs/REVISIONS.md` (révisions libérées, numéros, règle 3F, pièces gelées dans l'assemblage), `docs/ELECTRIQUE.md` (bibliothèque de connecteurs et de cellules, joints soudés, contact à lamelles), `docs/DESSINS.md` (dessins, cotes à bulles, caractéristiques spéciales, révisions et cas d'emploi), `docs/PRESENTATION.md` (présentation guidée `web/presentation.html` : pages, notes, captures), `docs/GOOGLE.md`, `docs/REA.md`, `docs/BRAND.md`.
