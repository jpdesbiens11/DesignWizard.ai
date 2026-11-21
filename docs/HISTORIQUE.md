# Historique de conception : points de restauration et arbre des branches

*Point 9 de la suite convenue avec JP (20 novembre 2026) : « voir un projet pièce / assemblage / PCBA / logiciel / DFx
comme un écosystème balancé sur des compromis… ces itérations sont la colonne vertébrale ». Choix cliqués le même
jour : un point garde la définition complète du produit, les fichiers lourds rangés une seule fois et cités par chaque
point ; un point s'exporte en `.dwiz` autonome ; commencer par les points et l'arbre, le paquet pour l'IA ensuite.*

Écran : **Produit › Historique** (`#/history`), ou menu Projet › Historique et points de restauration.

## 1. Ce qu'un point garde

Un point garde **tout le produit** à un moment : pièces, assemblages, cartes, logiciel, cas de charge, registres de
revue, itérations MVP, révisions, journal de l'IA. Il ne garde pas ce qui n'est pas la définition : le journal
d'activité (`log`), l'horloge (`updated`), l'identifiant du projet, ni l'historique lui-même.

Le projet est **découpé par artéfact** — une pièce, un assemblage, une carte, un registre — et chaque artéfact est
rangé **une seule fois** sous l'empreinte de son contenu (`history.objects`). Un point n'est qu'une liste
« artéfact → empreinte ». Un point qui change une pièce coûte cette pièce ; un STEP importé de 170 ko qui ne change
jamais est rangé une fois pour tous les points (essai : le deuxième point d'un projet qui porte un STEP coûte moins de
3 ko).

L'empreinte : deux hachages de 32 bits (cyrb53) et la longueur du texte. Deux textes égaux ont la même empreinte ; une
collision entre deux textes différents est hors de portée d'un historique de conception — c'est un **choix de
l'outil**, dit comme tel au registre des sources.

Un point dit aussi :

- **quand** et **pourquoi** : posé à la main (avec un nom et une note, que la dictée du système peut taper), ou
  **automatique** — après une réponse d'IA appliquée, ou avant un retour ;
- **son journal** : ce qui a été fait entre le point d'avant et lui (les étapes du journal d'activité) ;
- **l'itération MVP** ouverte à ce moment, et **l'état des révisions** (gelées, libérées, refusées, les dernières).

## 2. Revenir, comparer, repartir

- **Revenir à un point** : le produit redevient celui du point. C'est **une étape annulable** (Ctrl + Z). Si des
  changements ne sont gardés par aucun point, un point automatique « Avant le retour » les garde d'abord.
- **Comparer** : la fiche d'un point dit ce qui diffère du produit maintenant, ou d'un autre point choisi — artéfact
  par artéfact, ajouté, retiré ou modifié, groupé par nature et en couleur.
- **Repartir** : après un retour, le point suivant a pour parent le point où l'on est revenu — **une branche
  s'ouvre**. L'historique est un **arbre**.
- **Abandonner une branche** : elle est mise de côté, pâle dans l'arbre, et **gardée** ; « Reprendre » la remet. La
  branche où l'on est ne s'abandonne pas. Rien n'est effacé.
- **Emporter un point** : un `.dwiz` autonome — un projet complet, qui s'ouvre seul (menu Projet › Importer), sans
  l'historique.

L'historique **n'est pas défait par Ctrl + Z** : annuler défait un changement du produit, pas un point. Une étape
d'annulation garde le projet sans son historique (`store.js`), ce qui évite aussi de recopier soixante fois un long
historique.

## 3. Ce que l'on voit

Les trois places de tout studio :

- **à gauche** : « Poser un point » (nom, note ; Entrée dans le nom pose le point), **où l'on en est** — le point
  « vous êtes ici » et ce qui a changé depuis —, les branches, ce que pèse l'historique, le guide ;
- **au centre** : l'arbre, dessiné comme le graphe des commits d'un client de gestion de versions — une rangée par
  point, du premier au dernier, une voie par branche ; le point « vous êtes ici » cerclé, comme dans le gestionnaire
  d'instantanés d'une machine virtuelle ; dessous, en pointillé, « Maintenant » quand des changements ne sont gardés
  par aucun point. Un point est un bouton : clic ou Entrée le choisit, ↑ ↓ passent au voisin. La vue se zoome et se
  déplace comme toute vue 2D (barre « − % + · Ajuster · Loupe ») ;
- **à droite** : la fiche du point choisi — genre, date, auteur, note, itération MVP, révisions, son journal, la
  comparaison ; « Revenir à ce point » et « .dwiz » épinglés en tête.

Pictogrammes et couleurs des points : posé à la main (bleu), après une réponse d'IA (violet, étincelle), avant un retour
(gris, flèche de retour).

## 4. Le point automatique après une réponse d'IA

Quelle que soit la porte — le bouton « IA » d'un studio (`modules/ai_loop.js`) ou la porte « Avec l'IA » de l'Atelier
(`modules/shop_ai.js`) —, une réponse appliquée écrit une nouvelle première ligne dans `project.aiJournal`. Quand
cette ligne apparaît, un point « Après l'IA : … » se pose (`core/history_auto.js`, installé une fois par `main.js`). Une
annulation, ou l'ouverture d'un projet, ne fait que noter ce qui est connu.

## 5. Où il vit, ce qui en sort

L'historique est dans le projet : `project.history = { v: 1, head, objects, points }` (voir `docs/FORMAT.md`). Il voyage
avec le projet — son fichier `.dwiz`, son dossier Drive, l'export du menu Projet. Il **ne part pas** vers une IA (la
boucle commune, la porte de l'Atelier, le paquet d'une itération MVP), ni dans le **miroir d'équipe** : chaque membre
garde son historique, le miroir porte le produit. La vue « code » du projet ne le montre pas.

Le rapport de revue a une section « Historique de conception » : une ligne par point.

## 6. Ce qui est vérifié, ce qui ne l'est pas

Vérifié par des essais (`tests/node/history.test.mjs`) : le découpage, l'empreinte, un artéfact rangé une fois, le
retour, la branche, l'abandon et la reprise, la comparaison, le `.dwiz` d'un point et l'aller-retour du format, le point
automatique, l'annulation qui laisse l'historique en place. Essayé dans Chromium sur la démonstration (22 contrôles) :
poser un point, le changement dessiné en pointillé, le deuxième point qui ne range que la pièce changée, le retour et
son annulation, la branche et son abandon, le point automatique après une réponse d'IA, le `.dwiz` emporté, la
comparaison, le clavier, la barre de zoom, le guide, l'historique gardé après un rechargement.

Mesuré : la démonstration pèse 89 ko d'historique pour 4 points (16 à 20 artéfacts rangés). **Non mesuré** : un produit
avec plusieurs STEP importés et une centaine de points ; un historique gardé dans Google Drive (le fichier du projet
grossit d'autant ; une limite du navigateur pour le mode sans compte, environ 5 Mo, n'a pas été atteinte).

## 7. Reste

- **(b) Le paquet d'écosystème** pour l'IA : un `.dwiz` complet (zip) — tous les artéfacts, la carte des dépendances,
  l'état des vérifications, l'étape MVP et les révisions gelées, le cadre de conception (les règles que l'outil vérifie
  et celles que le projet écrit), la demande cadrée par le module où l'on est.
- **(c) « Ce que cela dérange »** à l'import d'une réponse : interfaces qui ne s'accordent plus, accouplements rompus,
  écarts de DFx, cas à relancer, dessins à refaire — accepté artéfact par artéfact.
- Rattacher une révision gelée au point qui la porte ; un point posé tout seul au gel d'une révision.
- Élaguer : retirer d'un coup les artéfacts qu'aucun point ne cite plus (aujourd'hui rien n'est jamais retiré).
