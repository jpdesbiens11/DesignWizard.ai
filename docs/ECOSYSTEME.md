# Écosystème : tout le produit pour une IA

*Point 9 b de la suite convenue avec JP (20 novembre 2026) : « voir un projet pièce / assemblage / PCBA / logiciel / DFx
comme un écosystème balancé sur des compromis ». Choix cliqués le même jour : le cadre de conception donné à l'IA =
les règles que l'outil vérifie déjà (DFx par procédé, interfaces, isolation, unités, jalons MVP) plus celles que le
projet écrit ; l'entrevue écrite ou dictée — la dictée du système tape dans le champ, l'outil n'appelle aucune IA et
n'ouvre aucun micro.*

Écran : **Produit › Écosystème** (`#/eco`), ou **« Tout le contexte (.zip) »** dans la boîte « IA » de chaque écran,
qui y mène avec ce que l'écran montre (`#/eco/<artéfact>/<écran>`).

## 1. Pourquoi un paquet, et pas un artéfact

Un artéfact seul ne dit pas ce qu'il dérange. Alléger la base d'un boîtier touche l'assemblage qui la pose, les pièces
qui partagent ses clés d'interface ou qui s'y accouplent, le calcul qui la lit, le cas de charge à relancer — et
l'isolant posé sur le dissipateur posé sur la base, à deux pas. Le paquet donne à l'IA **tout le produit et ses
liens**, avec **l'état des vérifications** et **le cadre**, pour qu'elle voie les compromis avant de changer quoi que
ce soit.

## 2. La carte de ce qui dépend de quoi

Au centre, en quatre colonnes, dans l'ordre où l'on bâtit : les assemblages, les pièces (groupées par procédé, une
couleur par groupe), les cartes et le logiciel, les calculs et les cas de charge. Un lien va de ce qui dépend vers ce
dont il dépend :

| Lien | Ce qu'il veut dire |
|---|---|
| **monte** | l'assemblage pose cette pièce : la changer change l'assemblage |
| **contient** | un sous-assemblage, porté d'un seul bloc |
| **partage l'interface** | deux pièces qui portent la même clé d'interface s'adaptent l'une à l'autre |
| **accouplée à** | un accouplement de l'assemblage les tient ensemble |
| **jumeau mécanique** | la pièce « pcb » suit la carte à chaque changement |
| **calcule** | un modèle analytique lit cette pièce : à refaire quand elle change |
| **cas de charge** | une simulation lit cette pièce : à relancer quand elle change |

L'artéfact confié est **entouré** ; ce qu'il dérange est **cerné d'ambre**, avec le nombre de pas ; le reste s'efface.
Un clic (ou Entrée) sur une pièce, un assemblage ou une carte en fait l'artéfact confié. Chaque genre de lien se montre
ou se cache (On / Off, dans « Les liens »). La carte se zoome et se déplace comme toute vue 2D.

Ce qu'un changement dérange se lit en remontant les liens (`ecoImpact`) : ce qui dépend de l'artéfact, et, le long
d'une clé partagée, d'un accouplement ou d'un jumeau, dans les deux sens.

## 3. L'entrevue

Trois champs, comme on confierait une tâche à un technicien : **ce que je veux**, **ce qui ne doit pas bouger**,
**comment je saurai que c'est réussi** ; et « Pose-moi tes questions d'abord, une à la fois ». Un champ laissé vide
devient dans la consigne une question que l'IA doit poser. La dictée du système tape dans ces champs.

## 4. Le cadre de conception

À droite :

- **Règles du projet** : ce que le projet impose et que l'outil ne sait pas vérifier (« le boîtier reste en
  aluminium moulé », « pas de pièce plus large que 120 mm »). Chaque règle est **On ou Off** — à Off, elle est gardée
  mais ne part pas —, se **copie** (la copie naît à Off), se réécrit, se retire ; chaque changement est une étape
  annulable (`project.frame.rules`).
- **Ce que l'outil vérifie** : le DFx des procédés que le produit emploie (les règles du livre de règles, avec leur
  limite et leur raison ; une règle seulement documentée le dit), les interfaces et leurs clés, l'isolation, les
  unités, les jalons MVP — **chacun avec son niveau de vérification** tiré du registre des sources : « saisie, à
  vérifier » pour les tables d'isolation, « lue » pour les TRL, « choix de l'outil » pour ses propres règles.

## 5. Le paquet

Un `.zip`, chaque fichier portant la note de la plateforme :

| Fichier | Ce qu'il porte |
|---|---|
| `consigne.md` | la demande (écran d'où elle vient, artéfact confié, entrevue), ce que l'artéfact dérange, comment travailler, comment la réponse revient |
| `projet.dwiz` | tout le produit, **sans l'historique** ; une pièce importée en STEP porte une marque à la place de sa géométrie |
| `dependances.md`, `dependances.json` | la carte, lisible et exacte |
| `verifications.md` | le guide (à corriger, à entrer, à vérifier, conseils) et l'état de la revue de chaque artéfact |
| `cadre.md` | les règles de l'outil avec leur niveau de vérification, puis celles du projet |
| `etat.md` | l'itération MVP, les révisions gelées et libérées (qui ne changent plus), le point de restauration « ici » |
| `langage.md` | la référence du langage d'une pièce, pour qu'une pièce rendue soit valide |

Chaque fichier s'ouvre à l'écran avant de partir (« Ce que contient le paquet »). La consigne demande de rendre
**seulement** les artéfacts créés ou modifiés, complets, en `.dwiz`, en gardant les identifiants et les clés
d'interface, et de finir par **« Ce que cela dérange »**. La réponse revient par le bouton « IA » d'un écran ou par la
porte « Avec l'IA » de l'Atelier : aperçu, une étape annulable, journal, et un point de restauration posé tout seul.

## 5 bis. À l'import : ce que cela dérange, accepté artéfact par artéfact

Demande de JP (points 2 et 9 c, 20 novembre 2026) : « à l'import, l'aperçu actuel plus "ce que cela dérange" —
interfaces qui ne s'accordent plus, accouplements rompus, écarts de DFx, cas à relancer, dessins à refaire —, accepté
artéfact par artéfact ».

Quand une réponse d'IA MODIFIE un artéfact du projet, l'aperçu dit aussi ce que ce changement fait au reste du produit,
lu du projet lui-même (`disturbs` de `web/js/core/ai_disturb.js`, pur), en trois niveaux, chacun avec sa couleur et son
pictogramme :

| Niveau | Ce qu'il veut dire | Exemples |
|---|---|---|
| **Rompu** | ce qui tenait ne tient plus | une interface qu'une autre pièce porte encore disparaît ; un accouplement nomme une interface que la pièce n'a plus ; un relevé du Labo appartient à un bloc retiré ; un nouveau point « à corriger » du guide |
| **À refaire** | à relancer ou à refaire | le calcul analytique qui lit la pièce ; sa simulation (le cas et ses essais) ; ses vues de détail tracées sur l'ancienne forme ; l'isolation d'un assemblage ou d'une carte ; les essais du Labo des blocs changés |
| **À regarder** | rien n'est faux, quelque chose a bougé | une interface partagée qui change ; l'assemblage qui monte la pièce ; le jumeau d'une carte ; une révision gelée ou libérée (le changement ira dans une nouvelle révision) ; les occurrences retirées d'un assemblage |

Un nouveau nom ou une note ne déplace aucune géométrie : rien n'est signalé. Le contenu est comparé sans tenir compte
de l'ordre des clés (un `.dwiz` relu écrit les siennes dans son ordre). Un artéfact NOUVEAU ne dérange rien de ce qui
existe : ce qu'il demande est vérifié par l'aperçu.

- **Dans la porte « Avec l'IA »** (`#/shop/ai`) : sous chaque ligne modifiée, sa boîte ; chaque ligne qui crée ou
  modifie a son interrupteur **On / Off** — l'artéfact est accepté ou refusé, un par un. Refuser une création refuse
  avec elle ce qui en dépend (un assemblage qui la monte, la feuille de dessin d'un assemblage refusé : `acceptRows`), et
  la ligne le dit ; la reprendre rend ce qu'elle avait emporté. Seul ce qui est accepté est appliqué, en une étape
  annulable, au journal. Le guide dit qu'une modification acceptée rompt quelque chose.
- **Dans la boucle commune de chaque écran** (bouton « IA » : une pièce, un assemblage, une carte) : la même boîte sous
  la liste des changements (`disturbBox` de `modules/ai_disturb_ui.js`).

Rien n'est décidé par l'outil : il dit où regarder. Les lignes d'un écran de page mènent à l'artéfact visé.

## 6. Ce qui est vérifié, ce qui ne l'est pas

Vérifié par des essais (`tests/node/eco.test.mjs`) : la carte sur la démonstration (montage, clés, accouplements,
jumeau, calcul, cas), ce qu'un changement dérange (proche et lointain), les règles du projet (On / Off, copie à Off,
numéros jamais redonnés), le cadre (seulement les procédés employés, l'isolation dite « saisie »), la consigne et les
fichiers (sans historique, STEP remplacé, aucune adresse). Essayé dans Chromium sur la démonstration.

« Ce que cela dérange » (`tests/node/ai_disturb.test.mjs`) : interface qui disparaît ou change, accouplement rompu,
calcul, cas, vues de détail, révision gelée, occurrences retirées, assemblage parent, jumeau d'une carte, relevés
orphelins ; la même pièce relue d'un `.dwiz` ne dérange rien ; un refus emporte ce qui en dépend. Essayé dans Chromium
sur la démonstration du boîtier : la porte (DRV-BASE sans une de ses interfaces : deux « rompu » ; la pièce nouvelle
refusée emporte l'assemblage qui la monte, puis reprise) et la boucle d'une pièce (DRV-COVER : deux « rompu »).

**Pas essayé** : une vraie réponse d'assistant sur un paquet ; la façon dont un assistant lit `cadre.md` quand il est
long (le DFx de la démonstration en fait environ 20 ko). Le logiciel ne dit pas sur quelle carte il tourne : la carte
ne le relie à rien.

## 7. Reste

- ~~(c) « Ce que cela dérange » à l'import~~ — fait (v0.157.0, § 5 bis). Reste : les cartes et les feuilles de dessin
  acceptées une à une dans la boucle commune du projet entier ; un changement de cote dans une interface comparé à ce
  que porte la pièce d'en face (aujourd'hui : « à regarder »).
- Les cartes et le logiciel dans une réponse de la porte « Avec l'IA ».
- Relier le logiciel à la carte dont il prend les broches.
