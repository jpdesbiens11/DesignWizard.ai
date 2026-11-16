# Ce qu'un calcul analytique emporte

Un calcul des modèles analytiques (écran Physique) sort de la plateforme sous trois formes, depuis l'onglet
**Résultat** (« Ce calcul, à emporter ») ; l'onglet **Rapport** sort en un seul document tous les calculs gardés.
Tant que le guide demande encore des valeurs, l'export attend, comme « Garder ce calcul ».

## La note de calcul — Word et PDF

`physicsDoc()` (`web/js/analysis/physics/export.js`, pur) écrit le modèle de document neutre que `core/docx.js` et
`core/pdfdoc.js` impriment : **le même gabarit que les autres documents** — cartouche d'en-tête sur chaque page (marque,
titre, n° de document `<pièce>-CALC`, révision, date, page), page de titre avec approbation et journal des révisions,
note de confidentialité et note de la marque au pied de chaque page.

Pour chaque calcul : la question posée, le modèle, la pièce, le verdict, **les médias choisis** ; l'image du modèle aux
dimensions entrées ; les données (avec leur origine : entrée, choix, ou « média : … ») ; les résultats ; les
vérifications avec leur marge et leur verdict en couleur ; les limites de validité ; le calcul étape par étape ; les
hypothèses, le domaine de validité et la référence ; un cadre d'accord à signer. Plusieurs calculs : un sommaire et un
tableau de synthèse d'abord, puis une page par calcul.

## Le classeur — Excel (.xlsx)

Pour itérer hors ligne. `physicsBook()` écrit un classeur à l'image de l'outil, que `core/xlsx.js` — un écrivain
`.xlsx` maison, sans dépendance — met en fichier. Cinq feuilles :

| Feuille | Ce qu'elle contient |
|---|---|
| **Calcul** | La question, le verdict ; les **médias** à choisir dans une liste et leurs propriétés en cases pâles (lues dans la feuille Medias) ; les **cases jaunes** à remplir, bornées à la plage du modèle ; les résultats ; les vérifications avec marge et verdict coloré ; le domaine de validité |
| **Iterations** | Un tableau par donnée, calculé par la plateforme : la donnée varie de la moitié à une fois et demie sa valeur, les autres sont gardées. Une **case jaune pour essayer une valeur** (résultat interpolé entre deux points) et la **courbe** du premier résultat. Un journal des itérations à remplir |
| **Medias** | La base des médias que le modèle lit, avec toutes leurs propriétés |
| **Methode** | Le calcul étape par étape (valeurs de l'export), les hypothèses, le domaine de validité, la référence |
| **Notice** | Ce qu'est le classeur, ce qui est vivant et ce qui est figé, les unités, les limites, la confidentialité, la marque |

**Classeur vivant.** Pour six modèles — le tube (perte de charge), l'orifice et les quatre poutres — les résultats, les
marges et le verdict sont des **formules** (`xl_formulas.js`) : on change une case jaune, ou le média, tout suit ; une
pression en kPa se lit aussi en psi, bar et atm. Les quinze autres modèles partent avec leurs résultats en valeurs, leurs
balayages et la case d'essai ; la Notice le dit.

## Ce qui est vérifié, et comment

- Les formules des six modèles vivants sont évaluées par les tests (un petit lecteur de formules de tableur) pour
  plusieurs jeux de données — régime laminaire et turbulent, autres fluides, sections ronde, tube et quelconque, autres
  matériaux — et redonnent les résultats de la plateforme à 0,01 % près (les propriétés des médias de la feuille sont
  écrites avec cinq chiffres).
- Le même contrôle a été fait une fois **dans LibreOffice** : cases jaunes et média changés, classeur recalculé,
  résultats et verdicts comparés à ceux de la plateforme — tous égaux. Le fichier s'ouvre aussi avec `openpyxl`.
- **Non vérifié : Microsoft Excel lui-même** (non disponible ici), et l'allure des graphiques dans Excel.

## Limites

- Les propriétés d'un fluide sont tabulées à la température de l'export : changer la température hors ligne ne les
  change pas (la case de la température n'est pas jaune).
- La case d'essai de la feuille Iterations interpole, une seule donnée à la fois : exacte aux points du tableau,
  approchée entre eux.
- Le classeur reste en unités du modèle (mm, N, MPa, kPa, °C), quel que soit le choix d'unités de l'écran.
- Les limites de validité relevées à l'export sont du texte : hors du domaine, un classeur vivant recalcule mais seules
  les lignes « Domaine de validité » le disent.
