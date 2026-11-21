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

## 6. Ce qui est vérifié, ce qui ne l'est pas

Vérifié par des essais (`tests/node/eco.test.mjs`) : la carte sur la démonstration (montage, clés, accouplements,
jumeau, calcul, cas), ce qu'un changement dérange (proche et lointain), les règles du projet (On / Off, copie à Off,
numéros jamais redonnés), le cadre (seulement les procédés employés, l'isolation dite « saisie »), la consigne et les
fichiers (sans historique, STEP remplacé, aucune adresse). Essayé dans Chromium sur la démonstration.

**Pas essayé** : une vraie réponse d'assistant sur un paquet ; la façon dont un assistant lit `cadre.md` quand il est
long (le DFx de la démonstration en fait environ 20 ko). Le logiciel ne dit pas sur quelle carte il tourne : la carte
ne le relie à rien.

## 7. Reste

- **(c) « Ce que cela dérange » à l'import** : après une réponse, ce que l'outil trouve dérangé — interfaces qui ne
  s'accordent plus, accouplements rompus, écarts de DFx, cas à relancer, dessins à refaire —, accepté artéfact par
  artéfact.
- Les cartes et le logiciel dans une réponse de la porte « Avec l'IA ».
- Relier le logiciel à la carte dont il prend les broches.
