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

## 5 bis. Les branches nommées, MAIN au centre, la fusion et l'équipe

Demande de JP (21 novembre 2026) : « faire des branches visuellement en parallèle et de pouvoir les merger ensemble au
MAIN (la branche du centre)… des designs différents en équipe en parallèle ». Choix cliqués le même jour : **une
branche se fusionne d'un bloc** ; une pièce que le côté qui l'emporte n'a pas **reste, à Off, grisée, activable**.

- **Chaque point a une branche**, par son nom. Le premier point est sur **MAIN**, la branche principale. Un point
  continue la branche de son parent quand le parent en est le bout ; revenir à un point qui n'est pas le bout de sa
  branche et continuer **ouvre une nouvelle branche** — le volet propose de la nommer (« couvercle embouti », « piste
  de Sam »…), sinon « Branche 2 », « Branche 3 »… Un historique gardé avant les noms les prend par la même règle.
- **« Nouvelle branche ici »** (demande de JP, 22 novembre : « je ne vois pas le bouton pour commencer une branche parallèle ») :
  sur **n'importe quel point**, le dernier de MAIN compris — bouton de la marge de droite, ou « Nouvelle branche » dans la
  section « Les branches » pour partir d'où l'on est. On nomme la branche (le nom proposé est « Branche N ») ; si le point
  n'est pas « vous êtes ici », le produit y revient d'abord (un retour, annulable). Son premier point, **« Départ de … »**,
  se pose tout de suite : la branche se voit dans l'arbre, à côté ; ce qui avait changé depuis « ici » part avec elle, et
  la branche d'où elle part **ne bouge pas**. Les points suivants continuent la branche. « Revenir à MAIN » et
  « Travailler sur cette branche » passent de l'une à l'autre ; « Fusionner dans MAIN » ne paraît que lorsque la branche
  apporte quelque chose. C'est l'usage d'un client de gestion de versions (créer une branche sur un commit, puis
  basculer de l'une à l'autre) ; `startBranch` et `branchSuggestion` de `web/js/core/history_branches.js`.
- **« Fusionner dans MAIN » depuis un point de branche** (JP, 22 novembre : « il manque un bouton pour qu'à partir du point
  d'une branche on merge avec le MAIN pour revenir dans le chemin principal après des tests concluants ») : dans la marge de
  droite de tout point d'une branche, le bouton est toujours là — en bleu quand la branche apporte quelque chose, sinon il
  dit pourquoi il n'y a rien à fusionner. Il fusionne **jusqu'à ce point** : les points d'après restent dans la branche
  (`mergePlan(h, nom, point)`) ; l'aperçu d'abord, une étape annulable, puis « vous êtes ici » revient sur MAIN, au point de
  fusion. Le bouton de la section « Les branches » fusionne la branche entière.
- **L'arbre** : une colonne par branche, **MAIN au centre** — autant de colonnes à sa gauche qu'à sa droite —, plus
  épaisse, nommée en tête ; les autres branches s'ouvrent à droite, puis à gauche, dans l'ordre où elles naissent, et
  leur nom est écrit sur leur dernier point. Un point de fusion reçoit une seconde ligne, en tirets, depuis le bout de
  la branche qu'il reprend.
- **Fusionner dans MAIN**, d'un bloc : la base de la branche est le point où elle a quitté MAIN, ou son dernier point
  déjà fusionné. Ce que la branche a changé depuis passe dans MAIN, **entier** ; ce qu'elle n'a pas touché reste comme
  MAIN l'a. Quand les deux ont changé le même artéfact, **la branche l'emporte** et l'aperçu nomme ce que MAIN perd.
  **Rien n'est effacé** : un artéfact que la branche a retiré reste dans MAIN ; une occurrence d'un assemblage que MAIN
  a et que la version de la branche n'a pas **revient à Off, grisée**, avec ses accouplements, prête à être activée
  dans l'Assemblage pour la replacer. L'aperçu dit tout cela avant ; la fusion est **une étape annulable** (Ctrl + Z),
  puis un point « Fusion dans MAIN » se pose sur MAIN. Une branche continue après une fusion ; la suivante ne reprend
  que ce qui est neuf.
- **En équipe** : chacun travaille sur sa branche, dans son navigateur ; « Lire le travail d'un coéquipier » lit son
  fichier de projet (`.dwiz` ou `.json`) et l'ajoute comme **une branche à elle**, partie du **point que les deux
  fichiers partagent** (leur historique voyage dans le fichier) ; sans point commun, du point d'ici le plus proche de
  son produit — dit comme tel, à vérifier. Deux fichiers du même produit peuvent écrire un artéfact avec ses clés dans
  un autre ordre : la comparaison se fait **au contenu**, l'ordre des clés n'est pas un changement. « Vous êtes ici » ne
  bouge pas.

Ce que l'on suit : les branches d'un client de gestion de versions — une ligne principale toujours là, des branches
qui en partent et y reviennent par un point de fusion — et sa fusion à trois (base, branche, MAIN), faite ici **par
artéfact**, sans fusion à l'intérieur d'un artéfact. Cœur : `web/js/core/history.js` (noms : `branchNames`,
`nextBranch`, `tipOf`, `MAIN`) et `web/js/core/history_branches.js` (`branchList`, `branchLayout`, `baseOf`, `mergePlan`,
`importPlan`, `importBranch`) ; écran : `modules/history_branches_ui.js`, arbre : `modules/history_tree.js`. Essais :
`tests/node/history_branches.test.mjs`.

**Ce qui n'est pas fait** : fusionner une branche dans une autre que MAIN ; choisir, artéfact par artéfact, le côté qui
l'emporte (JP a choisi le bloc) ; une fusion à l'intérieur d'une pièce (deux personnes qui changent deux cotes de la
même pièce : la version de la branche l'emporte entière) ; renommer une branche ; un miroir d'équipe qui porte les
branches tout seul (aujourd'hui, le fichier se passe à la main).

## 5 ter. Effacer un point

Demande de JP (22 novembre 2026) : « je veux dorénavant être capable d'effacer ces points de sauvegarde individuellement
et ensuite les autres se réattachent, ou si un seul concept sur la branche, elle meurt et on revient par défaut au
MAIN ».

- **« Effacer ce point »**, dans la marge de droite de tout point, à côté de « .dwiz ». Avant d'effacer, la boîte dit
  ce que cela fait : quels points se rattachent et à quoi, si la branche garde d'autres points ou disparaît, où va
  « vous êtes ici », et combien d'artéfacts seul ce point gardait.
- **Les points d'après se rattachent au point d'avant** : un point du milieu de MAIN effacé, son suivant repart de son
  parent, et une branche qui partait de lui part désormais de ce parent. Rien d'autre ne bouge ; chaque branche garde
  son nom (les noms sont écrits sur chaque point avant l'effacement).
- **Une branche qui n'avait que ce point disparaît.** Si « vous êtes ici » y était, **le produit revient au dernier
  point de MAIN** — une étape annulable du produit (Ctrl + Z ramène le produit, pas le point). Si la branche garde
  d'autres points, « vous êtes ici » remonte d'un point et le produit ne change pas.
- Les artéfacts que plus aucun point ne cite s'en vont : l'historique s'allège.
- **Un point effacé ne revient pas** (l'historique n'est pas dans l'annulation) : la boîte le dit, et propose de
  l'emporter d'abord en `.dwiz`.

Pur : `deletePlan` (ce que cela ferait) et `deletePoint` de `web/js/core/history.js` ; écran : `modules/history.js`.
Usage suivi : effacer un instantané dans le gestionnaire d'instantanés d'une machine virtuelle — ses enfants restent et
pendent de son parent. Choix maison : le retour à MAIN quand la branche de « vous êtes ici » disparaît (demande de JP).

## 6. Ce qui est vérifié, ce qui ne l'est pas

Branches, fusion et import d'un coéquipier : essais `tests/node/history_branches.test.mjs`, et essayés dans Chromium sur
le Rover (une branche ouverte et nommée, l'aperçu de la fusion, la fusion, l'occurrence revenue à Off, Ctrl + Z ; le
fichier `.dwiz` d'un coéquipier lu en branche, un seul changement annoncé).

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
