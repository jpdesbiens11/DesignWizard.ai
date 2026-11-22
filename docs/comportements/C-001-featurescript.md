# C-001 — Reconstruire une pièce dans Onshape par FeatureScript

## 1. La question

Une pièce DynamiteOrbit peut-elle se reconstruire **nativement** dans Onshape, avec ses paramètres modifiables, à
partir d'un script FeatureScript généré ?

## 2. La cible

| | |
|---|---|
| Cible | FeatureScript, le langage de fonctions personnalisées d'Onshape, et sa bibliothèque standard |
| Version / date | bibliothèque standard visée : `2014` ; script généré en novembre 2026 |
| Autorisation | langage et bibliothèque **documentés publiquement** par l'éditeur pour que ses utilisateurs écrivent leurs fonctions ; essais à faire sur **notre propre compte**, dans un document de test. Aucun code d'Onshape n'est inspecté. |

## 3. Les preuves

| # | Ce que l'on affirme | Source | État |
|---|---|---|---|
| P1 | Une fonction personnalisée se déclare par `defineFeature`, avec ses entrées dans `precondition` | documentation publique de FeatureScript | inféré (non exécuté) |
| P2 | `isLength`, `isAngle`, `isInteger`, `isReal` déclarent des entrées bornées | idem | inféré |
| P3 | `fCuboid`, `fCylinder` créent des solides élémentaires ; `opExtrude`, `opRevolve`, `opBoolean`, `opFillet`, `opChamfer`, `opShell` les opérations | idem | inféré |
| P4 | La logique géométrique du script (signes, repères, motifs, booléens, suivi des paramètres) reconstruit le même solide que notre noyau | `tests/node/exports.test.mjs` : chaque script est exécuté par une **émulation** de ces opérations sur le noyau Open CASCADE, volume et enveloppe comparés à `buildPart` | confirmé (dans l'émulation) |
| P5 | Tous les gabarits et toutes les pièces de démonstration se convertissent sans opération ignorée | même test | confirmé |

## 4. La spécification du comportement

- **Entrées** : une pièce `.dwiz` (après réécriture des verbes d'atelier en opérations du noyau).
- **Sorties** : un seul fichier `.fs` : en-tête `FeatureScript 2014;`, import de `onshape/std/geometry.fs`, une
  fonction `defineFeature` dont chaque paramètre réglable est une entrée bornée ; avertissements et liste des
  opérations non converties.
- **Transformations** : formules des paramètres traduites en arithmétique FeatureScript (la pièce reste
  paramétrique) ; profils en esquisses ; trous en cylindres soustraits ; motifs en boucles ; interfaces recompilées
  symboliquement ; « détourer » en intersection booléenne.
- **Cas limites** : paramètre dont le nom est un mot réservé (renommé) ; profil issu d'un générateur (figé, avec
  avertissement) ; sélecteur d'arêtes non traduisible (opération laissée en commentaire `// NON CONVERTI`) ; pièce
  sans volume au moment d'une intersection (ignorée, avec la raison).

## 5. Notre implémentation

- Fichiers : `web/js/cad/featurescript.js`, `fs_expr.js`, `fs_helpers.js`, `fs_gen.js`, `fs_features.js`,
  `fs_interfaces.js`.
- Tests : `tests/node/exports.test.mjs` (11 tests).

## 6. Écarts connus

- Les filetages ne sont pas représentés : un trou taraudé devient un perçage au diamètre d'avant-trou.
- Les zones de cuivre d'un PCB et la géométrie STEP importée ne sont pas exportées.
- Un profil issu d'un générateur (`gen: heatsink`…) ne suit plus les paramètres une fois dans Onshape.

## 7. Ce que l'on ne sait pas

**Le script n'a jamais été exécuté dans Onshape.** Tant que ce n'est pas fait, P1 à P3 restent inférés.

| Inconnue | Comment le savoir |
|---|---|
| Le script est-il accepté tel quel par l'éditeur de Feature Studio (noms et signatures exacts) ? | Créer un Feature Studio dans un document de test, coller le script d'une pièce simple (gabarit « Plaque usinée »), lire les erreurs. |
| `fCone` (fraisures) a-t-il la signature utilisée ? | Même essai avec une pièce qui a une fraisure. |
| Après une intersection booléenne, le solide garde-t-il l'identité attendue par les opérations suivantes ? | Essai avec une pièce de l'Atelier (plaque détourée, puis perçages). |
| Les requêtes d'arêtes émises (`dwSelectEdges`) sélectionnent-elles les mêmes arêtes que notre noyau ? | Comparer visuellement congés et chanfreins sur la base du boîtier de la démonstration. |
| Le volume obtenu dans Onshape est-il celui de `buildPart` ? | Lire la masse dans Onshape, comparer à l'onglet Fiche. |

Chaque essai fait devient une ligne « confirmé » au § 3, ou une ligne au § 6.
