# La base des médias

Dans les modèles analytiques, **une propriété de matière ou de fluide ne se tape pas**. Une valeur seule — « E = 69 GPa »,
« μ = 1,0 mPa·s » — ne dit rien à qui la lit ; un média — « Aluminium 6061-T6 », « Water » — dit ce que c'est. Le
concepteur choisit donc un **média connu** dans un menu ; ses propriétés en découlent, écrites à côté, non modifiables.

## La base

`web/js/analysis/physics/media.js` (pur, testé) réunit tout ce que les modèles savent lire :

| État | Ce qu'il contient | D'où il vient |
|---|---|---|
| **Solides** (42) | les matières de la bibliothèque des pièces qui ont des propriétés : métaux d'abord, puis plastiques, puis isolants, interfaces thermiques et composants — par groupe (Acier, Aluminium, Cuivre…), puis par nom | `cad/materials.js` et `analysis/physics/props.js` : valeurs typiques à température ambiante |
| **Liquides** (5) | Water, Ethylene glycol / water 50 %, Mineral oil ISO VG 32, 46 et 68 | corrélations de `props.js`, fonction de la température |
| **Gaz** (4) | Air, Nitrogen N₂, Carbon dioxide CO₂, Helium — à 1 atm | gaz parfait et loi de Sutherland, fonction de la température |

Chaque média donne ce qu'il peut : ρ, E, G, ν, Re, Rm, α, k, cp, résistivité à 20 °C et son coefficient de température,
température maximale de service, point de fusion pour un solide ; ρ, μ, k, cp et Prandtl pour un fluide. Chacun dit
**d'où viennent ses valeurs** (`basis`).

L'écran **Base des médias** (`#/media`, bouton dans les modèles analytiques, lien « base » à côté de chaque menu) la
montre : une carte par état, une table par groupe, une recherche dans les deux langues. Un clic sur une ligne l'ouvre :
toutes les propriétés, avec l'unité et le mot français, et la source. Un fluide montre ses valeurs à la température
que l'on tape. Rien ne s'y modifie.

## Dans un modèle

Chaque modèle déclare ses médias (`MODEL_MEDIA`) : la poutre lit E, Re et ρ de son matériau ; la dilatation
différentielle a deux matériaux ; l'emmanchement, un pour le moyeu et un pour l'arbre ; la paroi en conduction, un par
couche et un pour l'interface thermique ; le tube et l'orifice, un liquide ou un gaz. Dix-neuf modèles sur vingt et un en
ont (la température de jonction et la piste de carte n'en lisent pas).

- Le menu range les **solides d'abord, puis les liquides, puis les gaz**, par groupe et par nom ; un modèle n'offre que
  les états qui lui conviennent.
- Les propriétés données par le média s'affichent en **lecture seule**, sous le menu. Changer de média les change toutes
  d'un coup. Pour un fluide, elles suivent la température entrée.
- Le média proposé à l'ouverture est un **exemple** : son menu clignote et le guide le demande, jusqu'à ce qu'il soit
  choisi ou confirmé. Les valeurs qu'il donne, elles, ne sont plus des exemples à confirmer une à une.
- **Reprendre une pièce** donne son matériau au premier média du modèle : les valeurs suivent.
- Un média qui n'a pas une propriété (un plastique n'a pas de résistivité) : le calcul le dit dans ses limites de
  validité, et garde la valeur d'exemple — à vérifier.

Le calcul lui-même ne change pas : le média remplit les mêmes entrées qu'avant. Un calcul gardé **avant** la base n'a pas
de média : il garde les valeurs qui avaient été tapées, et son menu l'indique.

## Ce qui reste tapé

Ce qui n'est pas une propriété d'un média : les dimensions, les efforts, les températures, les coefficients de frottement
et de serrage, la classe d'une vis, la limite élastique d'une goupille, les résistances thermiques d'un composant.

## Limites

- La base est celle de la plateforme : on ne peut pas encore y ajouter son propre média. Une matière absente se demande,
  ou s'approche par la plus voisine.
- Les solides n'ont qu'une valeur, à température ambiante ; les propriétés d'un fluide sont à 1 atm.
- Les gaz et les deux huiles ajoutés avec la base (N₂, CO₂, He, ISO VG 46 et 68) ont des constantes **écrites de mémoire,
  non relues** ; leurs valeurs à 20 °C tombent sur les valeurs usuelles à 1 % près, et des tests le vérifient. Voir le
  registre des sources.
