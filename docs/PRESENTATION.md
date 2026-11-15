# La présentation guidée

`web/presentation.html` — en ligne : https://jpdesbiens11.github.io/DesignWizard.ai/presentation.html

Une présentation en pages, pour les **concepteurs, techniciens et ingénieurs en mécatronique** qui travaillent avec les
outils traditionnels. Elle part de la conception d'aujourd'hui (six outils autour d'une pièce, des vérifications qui
arrivent trop tard), pose le principe (l'interface d'abord), puis visite les briques une à une, **de l'idée jusqu'à
l'assemblage prêt à commander pièce par pièce**. Même modèle que la présentation de DynamiteAgile : un fil conducteur
en bas de chaque page, des notes pour le présentateur, une annexe de questions probables.

## Présenter

| Touche | Effet |
|---|---|
| → · Espace · Page suivante | page suivante |
| ← · Page précédente | page précédente |
| Début · Fin | première et dernière page |
| F | plein écran |
| N | notes du présentateur, à l'écran |
| R | rejouer l'animation de la page |
| Échap | fermer les notes ou l'image agrandie |

- Un clic passe à la page suivante (le bord gauche de l'écran revient en arrière) ; sur un téléphone, on glisse.
- Un clic sur une capture l'agrandit. « Ouvrir dans la démo » ouvre l'écran correspondant de l'application.
- L'adresse garde la page : `presentation.html#9` ouvre la page 9.
- **PDF** : Ctrl + P → « Enregistrer au format PDF » ; chaque page de la présentation est une page du PDF.

Environ 25 pages pour une vingtaine de minutes, puis l'outil en direct : charger la démonstration, ouvrir l'Atelier,
ajouter une interface, suivre la pièce jusqu'à son dossier de commande.

## Le fil conducteur

Douze stations, dans l'ordre d'un projet : Idée · Atelier · Pièce · Procédés · Électrique · Assemblage · Physique ·
Isolation · DFx · Dessins · Revue · Commande. Chaque page dit sa station (`data-stage`) ; le repère avance d'une page à
l'autre. `debut` : avant la première station ; `fin` : après la dernière.

## Modifier

- Le texte et les notes sont dans `web/presentation.html` : une `<section class="slide">` par page, ses notes dans
  `<aside class="notes">`. Les éléments marqués `r` apparaissent l'un après l'autre.
- Le style est dans `web/css/presentation.css`, la navigation dans `web/js/presentation.js` (fonctions pures testées :
  position des stations, repère, échelle). Aucune ressource externe, aucun style ni script dans la page : la politique de
  sécurité de la page ne laisse passer que les fichiers du site.
- Les captures (`web/img/tour/*.jpg`) se refont après une version qui change un écran :

  ```bash
  python3 designwizard.py --port 8130 --no-browser --data /tmp/tour
  node tools/tour_shots.mjs http://127.0.0.1:8130 web/img/tour
  ```

  Cet outil demande Playwright ; il ne fait pas partie de l'application et les tests ne le lancent pas.
- `tests/node/presentation.test.mjs` vérifie que chaque page a son titre, ses notes et sa station, que chaque image
  existe et que rien ne vient de l'extérieur.

## Ce que la présentation affirme

Elle ne donne aucun chiffre de gain de temps : personne ne l'a mesuré. Elle dit ce que l'outil fait, et consacre une page
à ce qu'il ne prétend pas (valeurs typiques, simulation simplifiée, pas un remplaçant de la CAO de production, projet
jeune). La démo en ligne s'ouvre sur approbation ; sur son propre poste, l'application s'ouvre sans compte.
