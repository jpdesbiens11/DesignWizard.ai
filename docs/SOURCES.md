# Sources — d'où viennent les méthodes, les conventions et les normes

Chaque outil de la plateforme s'appuie sur quelque chose : une norme, un manuel, le guide d'un fabricant, une règle
d'atelier, ou un choix de la plateforme. L'aide (`#/help/sources`) en tient le registre, **un seul pour toute
l'application** : `web/js/core/methods.js`.

## Ce que montre l'écran

Les références sont groupées par nature, chaque groupe avec sa couleur et son pictogramme :

| Groupe | Ce qu'il couvre |
|---|---|
| Isolement électrique | lignes de fuite, distances dans l'air, essais |
| Dessins et tolérances | GD&T, cotation, formats, tolérances générales |
| Calculs et simulation | modèles à la main, éléments finis, matières |
| Fabrication, assemblage et procédés | règles DFx, visserie, tôlerie, moulage, extrusion, impression 3D, laser |
| Cartes, connecteurs et conducteurs | PCBA, bibliothèque électrique, contacts, busbars |
| Projet, revues et fichiers | maturité, révisions, formats d'échange |

Une ligne est **fermée** tant qu'on ne la clique pas : sa nature (norme, manuel, méthode, guide, convention, format),
son nom, un titre court et son niveau de vérification. Un clic l'ouvre sur trois phrases — **ce qu'elle couvre**, **ce
que l'outil en prend**, **comment elle a été vérifiée** — et sur deux liens : l'outil, et le document du dépôt qui en
parle. Les pastilles du haut filtrent par niveau de vérification.

Un lien ouvre l'aide sur un groupe ou sur une ligne : `#/help/sources/isolation`, `#/help/sources/asme-y14-5`. L'écran
d'isolation et celui des itérations MVP y renvoient.

## Les niveaux de vérification

Le registre ne dit jamais plus que ce qui a été fait.

| Niveau | Ce qu'il veut dire |
|---|---|
| **lu** | le document lui-même a été ouvert et lu pendant le développement |
| **testé** | méthode de calcul : ses résultats sont comparés, par des tests, à des valeurs de manuel ou à des solutions exactes |
| **page lue** | seule la page de présentation (titre, objet) a été lue ; le texte de la norme ne l'a pas été |
| **extrait** | vu en extrait ou par un résumé de recherche seulement : à relire avant de s'y fier |
| **à vérifier** | valeurs ou règles reprises de la référence sans relecture consignée du document : à comparer à votre copie |
| **usage** | règle de pouce ou valeur typique d'usage courant, dite comme telle : l'atelier, le fournisseur ou la fiche font foi |
| **choix maison** | convention de la plateforme, ou valeur donnée par le propriétaire du projet : aucune norme derrière |
| **non lu** | citée par sa désignation ; le texte n'a pas été lu |

Aujourd'hui, 56 lignes : 4 lues, 13 testées, 1 page lue, 6 en extrait, 12 à vérifier, 10 d'usage, 8 choix maison,
2 non lues. Les deux que JP a nommées :

- **Lignes de fuite et distances dans l'air — IEC 60664-1** : *à vérifier*. Les tables sont saisies d'après les tables
  publiées ; les tests les comparent au moteur d'origine dont le module est porté, pas à la norme.
- **GD&T — ASME Y14.5-2018** : *à vérifier*. Aucune relecture de la norme n'est consignée ; le drapeau hexagonal qui
  relie une tolérance à son élément est un repère de la plateforme, pas un symbole de la norme — la note du dessin le dit.

## Ajouter une ligne

Toute nouvelle brique ajoute ses lignes au registre, avec le niveau de vérification vrai :

```js
M("identifiant", "groupe", "nature", "niveau", "Nom court", "Titre", "Ce qu'elle couvre.", "Ce que l'outil en prend.",
  "Comment c'est vérifié.", "#/outil", "Ouvrir l'outil", "docs/DOCUMENT.md")
```

`methodProblems()` refuse une ligne sans groupe, sans nature, sans niveau ou sans l'une de ses trois phrases. Les tests
(`tests/node/methods.test.mjs`) vérifient en plus que les outils et les documents pointés existent, que ce que la page
dit de l'IEC 60664-1, de l'ASME Y14.5 et de la tôlerie est ce que le code et les documents en disent, que seules les
références dont un document a été ouvert sont marquées « lu », et qu'aucune règle du livre DFx n'est sans source.

## Ce que ce registre n'est pas

- Ce n'est pas une preuve de conformité : la norme, ou la fiche du fabricant, fait toujours foi.
- Le niveau « testé » dit que le calcul reproduit une valeur de manuel, pas qu'il a été confronté à un essai.
- Les descriptions de ce que couvre une norme non lue sont écrites de pratique : elles situent la référence, elles ne
  la résument pas.
- Les sources détaillées de certaines briques restent dans leur document : procédés spéciaux (`docs/PROCEDES.md`),
  tôlerie (`docs/TOLERIE.md`), bibliothèque électrique (`docs/ELECTRIQUE.md`), niveaux de maturité (`docs/ITERATIONS.md`).
