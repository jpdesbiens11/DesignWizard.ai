# Le guide : ce que l'outil dit pendant qu'on travaille

Demande de JP : guider l'utilisateur **partout**, dès qu'il laisse quelque chose d'incomplet ou fait une erreur — sans
attendre qu'un calcul échoue ou qu'un fournisseur réponde.

## Ce que l'utilisateur voit

- **Le bouton « Guide »** de la barre du haut, sur tous les écrans. Son compteur dit ce qui attend sur l'écran courant ; il
  passe au jaune pour un point à vérifier, au rouge clignotant pour ce qui bloque. Un clic ouvre la liste : « Sur cet
  écran », puis « Ailleurs dans le projet ». Un clic sur une ligne mène à l'endroit.
- **Dans l'écran**, là où l'on travaille : la même liste en tête du cas de charge de la Simulation, à côté de la pièce
  proposée dans l'Atelier.
- **Les champs qui attendent clignotent** : le nom d'une pièce pas encore nommée, une valeur d'exemple que l'outil a mise
  à la place de la vôtre (100 N, 5 W…). Ils cessent dès qu'ils sont entrés ou confirmés.
- **Ce qui bloque retient l'action** : « Créer la pièce » attend un nom, « Lancer la simulation » attend les valeurs à
  entrer et un cas qui a un sens.

## Quatre niveaux, partout les mêmes

| Niveau | Sens | Bloque |
|---|---|---|
| À corriger | Sans cela, le résultat n'existe pas ou ne veut rien dire | oui |
| À entrer | Une valeur que l'outil a inventée, ou un champ obligatoire resté vide | oui |
| À vérifier | Ça marchera, mais ce n'est sans doute pas ce que vous vouliez | non |
| Conseil | Un geste qui rend la suite plus simple | non |

Chaque ligne dit **ce qui cloche, pourquoi, et le correctif** quand il y en a un.

## Ce qui est contrôlé aujourd'hui

| Où | Exemples | Code (pur, testé) |
|---|---|---|
| Tout le projet — pièces | Aucune géométrie ; aucune matière ; procédé inhabituel pour la matière ; paramètre hors de ses propres bornes, minimum au-dessus du maximum, dimension nulle ; deux interfaces du même numéro ; interface sans clé ; interface qu'aucune autre pièce ne reprend ; pièce sans fonction | `web/js/core/guide_checks.js` — `partIssues` |
| Tout le projet — assemblages | Aucune pièce ; aucune pièce fixe ; instance d'une pièce disparue ; accouplement rompu ; pièce accouplée à rien ; pièce du projet dans aucun assemblage | `guide_checks.js` — `assemblyIssues`, `projectIssues` |
| Équipe | Conflit à trancher ; message qui vous est adressé — dits sur tous les écrans | `guide_checks.js` — `teamIssues` |
| Atelier (intention) | Pièce sans nom ; nom déjà pris ; aucune interface ; quantité nulle ; matière qui ne se vend pas dans la matière première choisie ; deux interfaces du même nom. Une matière première choisie à la main (un clic sur sa tuile, un second pour la libérer) **grise les matières que son procédé ne travaille pas**. Ce que le compagnon ajoute de lui-même — la fermeture d'une coque moulée, son plan de joint — est montré **parmi les interfaces**, à garder ou à retirer, et « Créer la pièce » attend la réponse | `web/js/core/shop_check.js` — `briefIssues`, `formTakes`, `materialChoices` |
| DFx (points du projet) | Les compteurs du haut sont l'entrée : à régler, à corriger, à vérifier, conseils, conformes — un clic montre les points comptés, chacun avec ce qui a été mesuré, le pourquoi de sa règle et son correctif. Un correctif est **essayé avant d'être appliqué** : s'il crée un point à corriger, il est retenu et le dit. Depuis la Revue, la pastille « DFx : n à vérifier » d'une pièce mène à ses points (`#/dfx/points/<pièce>`) | `web/js/analysis/dfx_board.js` — `dfxItems`, `dfxCounts`, `dfxView`, `fixOutcome` |
| Physique (modèles analytiques) | Aucun modèle choisi ; valeur absente ou hors de ce que le modèle accepte ; valeurs d'exemple à entrer ou à confirmer (« Tout confirmer », ou Entrée dans le champ) ; valeurs reprises d'une pièce, à vérifier ; limite de validité du modèle. Le champ d'exemple est marqué en pointillé, **le prochain à entrer clignote**, et « Ajouter au rapport » attend | `web/js/analysis/physics/index.js` — `exampleKeys`, `inputIssues` |
| Circuits flexibles | Bande : pistes plus larges que la bande, rayon de pli trop court, courant d'une piste. Circuit ramifié : branche trop étroite pour ses pistes, branche qui dépasse son bord ou touche sa voisine, partie trop courte entre deux plis, potentiel d'une prise de tension à entrer (son champ clignote), carte rigide sans épaisseur ; un clic mène à la branche et à son champ | `web/js/core/flex.js` — `flexChecks` ; `web/js/core/flex_tree.js` — `treeChecks`, `treeGuide` |
| Étiquettes | Étiquette à poser ; texte à écrire (son champ clignote) ; image à apporter ; plus longue que le tour du cylindre, ou que son demi-tour ; pièce porteuse disparue ; texte sous 2 mm ; encre et fond de la même couleur | `web/js/core/labels.js` — `labelGuide` |
| Rendu | Décor, point de vue ou format inconnu ; finition inconnue ; couleur illisible ; finition gardée pour une pièce sortie de l'assemblage ; couleur sans effet sur la finition choisie | `web/js/core/render_looks.js` — `renderGuide` |
| Simulation (cas de charge) | Produit tenu nulle part ; aucun effort ; chaleur sans sortie ; face disparue ; effort sur une face encastrée ; unité douteuse ; valeurs d'exemple | `web/js/analysis/fea/case_check.js` — `caseIssues` |

Les règles de fabrication restent au DFx, les règles électriques à la carte et à l'Isolation : le guide ne les double
pas, il dit ce qui manque **avant** qu'elles puissent tourner.

## Ajouter un écran au guide

1. Écrire une fonction **pure** qui lit l'état de l'écran et rend des entrées `{ level, text, field?, id? }` ; la tester.
2. Dans l'écran : `setGuide(liste)` (de `core/app.js`) à chaque changement — le bouton de la barre suit ; `guideBox(liste,
   { go })` (de `core/guide.js`) pour l'afficher sur place ; `nudge(element)` pour mener l'œil à l'endroit.
3. Un champ qui attend une valeur prend la classe `need` (`needField`) : il clignote. Le clignotement s'arrête pour qui a
   demandé à son système de réduire les animations ; le champ reste surligné.
4. Ce qui bloque (`error`, `todo`) retient l'action de l'écran, et le dit.

## Ce qui n'est pas fait

Pas encore d'entrées propres aux écrans Pièce (au-delà de ce que disent les données), Assemblage (interférences, santé
des joints — ils ont leurs propres indicateurs), Isolation, PCBA, Dessins et Commande. Le guide ne juge pas la
conception : il ne remplace ni le DFx ni la revue.
