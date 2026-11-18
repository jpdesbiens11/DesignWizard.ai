# Une interface honnête

Une application outillée fait des suppositions à la place de la personne : une valeur par défaut, une méthode de
calcul, une norme. Le risque n'est pas la supposition ; c'est qu'elle passe pour une décision. Ces règles gardent la
frontière visible.

## 1. Une valeur inventée est un exemple

**Ce que voit l'utilisateur.** Quand l'outil crée quelque chose avec une valeur qu'il a choisie (un effort de 100 N,
une zone de 13 mm), le champ **clignote** et porte une coche. Tant que la valeur n'est pas tapée ou confirmée
(Entrée, ou la coche), l'élément est marqué « à entrer », le guide le liste, et l'action qui en dépend attend.

**Pourquoi.** Une valeur par défaut plausible est la plus dangereuse : rien ne la distingue d'une valeur voulue, et
le résultat qui en sort a l'air juste.

**Comment.** L'élément porte la liste de ce qu'il demande encore (`ask: ["F"]`). Taper une valeur ou la confirmer
retire le champ de la liste. Une seule fonction marque un champ qui attend ; une seule fonction dit si quelque chose
bloque. Ce qui est mis de côté (Off) ne demande rien.

**À ne pas faire.** Pré-remplir en silence ; bloquer sans dire où ; faire confirmer ce que la personne a tapé.

## 2. Un guide en direct, partout

**Ce que voit l'utilisateur.** Chaque écran dit ce qui manque ou cloche, pendant qu'on travaille, sur quatre
niveaux :

| Niveau | Sens | Bloque l'action |
|---|---|---|
| À corriger | le cas ne peut pas être traité, ou ne veut rien dire | oui |
| À entrer | une valeur d'exemple attend la vôtre | oui |
| À vérifier | ça tournera, mais ce n'est sans doute pas ce que vous voulez | non |
| Conseil | une meilleure façon de faire | non |

Le plus grave d'abord, une ligne par point, et **un clic sur une ligne mène à l'endroit** (le champ défile en vue,
clignote un instant ; un groupe replié s'ouvre). La même liste se lit dans l'écran et sous un bouton « Guide »
commun à toute l'application.

**Comment.** Chaque écran a une fonction pure qui prend son état et rend la liste
(`{ niveau, texte, élément, champ, correctif }`). Elle se teste sans page. Le message dit le correctif, pas
seulement le défaut : « Aucun appui : le produit n'est pas tenu. Correctif : clic droit sur une face → Appui ici. »

## 3. Un registre des sources, avec son niveau de vérification

**Ce que voit l'utilisateur.** Dans l'aide, chaque méthode, convention ou norme qu'un outil utilise a sa ligne : ce
qu'elle couvre, ce que l'outil en prend, et **comment elle a été vérifiée** :

| Niveau | Ce que ça veut dire |
|---|---|
| lu | le document a été ouvert et lu |
| testé | les résultats sont comparés, par des tests, à des valeurs de référence |
| page lue | seule la page de présentation a été lue |
| extrait | vu en extrait ou en résumé : à relire avant de s'y fier |
| à vérifier | valeurs reprises sans relecture consignée |
| usage | règle de pouce d'usage courant, dite comme telle |
| choix maison | convention de l'application : aucune norme derrière |
| non lu | citée par sa désignation ; le texte n'a pas été lu |

**Pourquoi.** Un outil qui cite une norme donne l'impression de l'appliquer. Le niveau dit la vérité : jamais plus
que ce qui a été fait. C'est aussi ce qui permet à quelqu'un du métier de savoir quoi relire.

**Comment.** Une seule liste (un module), lue par l'écran d'aide et par les tests. Toute nouvelle fonction y ajoute
ses lignes. Une convention d'interface y a sa place aussi (« usage », ou « choix maison »).

## 4. Un nom, pas un nombre

Une propriété qui vient d'une référence — une matière, un fluide, un composant — **ne se tape pas** : on choisit
l'entrée nommée dans une base, sa valeur s'affiche à côté, non modifiable, et l'entrée dit d'où elle vient.
*Raison : un nombre tapé n'a plus d'origine ; un nom en a une, que l'on peut vérifier.*

## 5. Estimer avant de calculer, puis recouper

Avant un calcul lourd, l'écran écrit **l'estimation à la main** qu'un praticien ferait, pas à pas. Après, il met les
deux côte à côte avec un verdict (concordant, écart notable, discordant) et dit quoi regarder si ça ne concorde pas.
*Raison : un résultat sans ordre de grandeur attendu ne se critique pas.* Le principe vaut hors du calcul : annoncer
ce qu'on attend avant de lancer, comparer après.

## 6. Un résultat se souvient de son cas

Chaque résultat garde ce qui comptait quand il a été produit (« Cas calculé : A1 · E2 — 1 condition à Off »). Dès
qu'une entrée change, le résultat affiché est marqué **« d'avant »** jusqu'au prochain calcul, au lieu de
disparaître ou de rester sans mention. Les essais d'une séance se lisent côte à côte.

## 7. Dire ce que l'outil ne fait pas

Chaque fonction documente ses limites dans le produit (« Ce que cette brique ne fait pas »), et un livrable porte
son identité : qui l'a produit, quelle version, quelle date, et laquelle de la version électronique ou imprimée fait
foi.
