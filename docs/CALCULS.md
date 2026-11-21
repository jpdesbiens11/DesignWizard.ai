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
`.xlsx` maison, sans dépendance — met en fichier. Cinq feuilles, six quand le modèle cherche une valeur pas à pas :

| Feuille | Ce qu'elle contient |
|---|---|
| **Calcul** | La question, le verdict ; les **médias** à choisir dans une liste et leurs propriétés en cases pâles (lues dans la feuille Medias) ; les **cases jaunes** à remplir, bornées à la plage du modèle ; les résultats ; les vérifications avec marge et verdict coloré ; le domaine de validité |
| **Iterations** | Un tableau par donnée, calculé par la plateforme : la donnée varie de la moitié à une fois et demie sa valeur, les autres sont gardées. Une **case jaune pour essayer une valeur** (résultat interpolé entre deux points) et la **courbe** du premier résultat. Un journal des itérations à remplir |
| **Medias** | La base des médias que le modèle lit, avec toutes leurs propriétés |
| **Solveur** | Seulement pour trois modèles (voir plus bas) : le tableau des pas d'une résolution — une ligne par pas, en formules |
| **Methode** | Le calcul étape par étape (valeurs de l'export), les hypothèses, le domaine de validité, la référence |
| **Notice** | Ce qu'est le classeur, ce qui est vivant et ce qui est figé, les unités, les limites, la confidentialité, la marque |

**Classeur vivant : les 22 modèles.** Les résultats, les marges et le verdict sont des **formules**
(`xl_formulas.js` et ses quatre familles : `xl_structure.js`, `xl_joints.js`, `xl_thermal.js`, `xl_electrical.js`) :
on change une case jaune, ou le média, tout suit ; une pression en kPa se lit aussi en psi, bar et atm.

- **Les choix** (vis M6, classe 8.8, bords encastrés, couche interne…) se lisent dans les tables du modèle par des `IF`
  imbriqués ; les coefficients de Roark de la plaque sont lus **entre les points de la table**, par les mêmes droites
  que la plateforme.
- **Toutes les vérifications du modèle sont là.** Celle qui n'a de sens qu'avec une charge — décollement d'un
  assemblage vissé, glissement, arrachement du taraudage, couple à transmettre d'un frettage, jeu d'une dilatation —
  affiche « — » et **se réveille quand sa case jaune est remplie**. Une température se juge sur son échauffement
  au-dessus de la référence ; une règle de pouce ne dit jamais « NON », au pire « JUSTE ».
- **Domaine de validité** : chaque limite que le modèle signale à l'écran a sa ligne, en mots, recalculée, avec son état
  à côté — « OK » dans le domaine, « JUSTE » dehors. Une ligne de contexte (le jeu d'une dilatation, la précharge
  d'une vis) affiche « — » : le modèle n'en fait pas une limite.
- **Le verdict du haut de la feuille est celui de l'écran** : « NON » quand une vérification échoue, « JUSTE » quand une
  marge est courte **ou que le modèle sort de son domaine de validité**, « OK » sinon. Il lit les vérifications et les
  lignes du domaine d'un seul `COUNTIF`.
- **Feuille Solveur.** Trois modèles cherchent une valeur qui n'a pas de formule directe. Un tableur n'a pas de
  solveur dans ses formules : le classeur refait donc les pas de la plateforme, un par ligne. Dissipateur à l'air libre
  (bilan convection + rayonnement) : dichotomie de 36 pas ; busbar (Joule contre convection et rayonnement) : dichotomie
  de 40 pas ; dissipateur ventilé : les six passes du modèle. L'air y est calculé comme dans la plateforme (gaz parfait,
  loi de Sutherland). Ni macro, ni référence circulaire, ni complément.
- **Seul cas figé** : un calcul gardé d'avant la base des médias, dont le fluide a été saisi à la main. Ses formules
  n'auraient rien à lire ; le classeur part avec ses valeurs et la Notice le dit.

Une formule qui nommerait une case absente du classeur fait échouer l'export, au lieu d'y écrire un zéro.

## Ce qui est vérifié, et comment

- **Contre des exemples publiés.** Chaque modèle est rejoué contre des exemples chiffrés que d'autres ont publiés : la
  source, ce qu'elle imprime, ce que l'outil trouve, l'écart — dans l'onglet « Calcul », groupe « Validation », et dans
  `docs/VALIDATION.md`. Un modèle sans exemple le dit ; la note de calcul et le classeur n'en disent rien de plus.

- **Par les tests, à chaque publication.** `xl_eval.js` lit une formule comme un tableur la lit — le signe moins avant
  la puissance, les puissances de gauche à droite, une division par zéro qui est une **erreur** et non un infini, `IF`
  qui ne calcule que sa branche. Le classeur de chaque modèle est recalculé ainsi pour 115 jeux de cases jaunes (les
  valeurs proposées, puis ce qui réveille chaque branche : autre choix, charge nulle, cote hors plage, autre média) :
  chaque résultat redonne celui de la plateforme à 0,01 % près, chaque marge au millième, chaque verdict — celui de chaque
  vérification et **celui du haut de la feuille, égal au verdict de l'écran dans les 115 cas**, dont 40 hors du domaine de
  validité et 16 où toutes les vérifications passent : seul le domaine y dit « JUSTE » —, et chaque vérification s'est
  réveillée dans un cas au moins.
- **Dans LibreOffice, une fois** (17 novembre 2026) : 100 jeux tapés dans les cases jaunes des 21 classeurs, recalculés
  par LibreOffice — 791 résultats, 234 vérifications et les 100 verdicts de feuille (dont 14 « JUSTE » par le seul
  domaine de validité), **tous égaux à la plateforme**, aucune cellule en erreur, y
  compris une classe de vis relue comme un nombre (8.8) après un choix dans la liste. Le fichier s'ouvre aussi avec
  `openpyxl`.
- **Non vérifié : Microsoft Excel lui-même** (non disponible ici), et l'allure des graphiques dans Excel. Les fonctions
  employées (`IF`, `AND`, `OR`, `MIN`, `MAX`, `ROUND`, `ABS`, `SQRT`, `LN`, `LOG10`, `EXP`, `TANH`, `PI`, `INDEX`,
  `MATCH`, `COUNTIF`, `TEXT`, `FORECAST`, `OFFSET`) sont communes aux deux tableurs.

## Limites

- Les propriétés d'un fluide sont tabulées à la température de l'export : changer la température hors ligne ne les
  change pas (la case de la température n'est pas jaune).
- La case d'essai de la feuille Iterations interpole, une seule donnée à la fois : exacte aux points du tableau,
  approchée entre eux.
- Le classeur reste en unités du modèle (mm, N, MPa, kPa, °C), quel que soit le choix d'unités de l'écran.
- La feuille Solveur alourdit le fichier (environ 200 Ko pour un dissipateur, contre 100 Ko) : c'est le prix d'un
  bilan résolu sans macro.
