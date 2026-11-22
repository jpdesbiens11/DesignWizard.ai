# La présentation guidée

`web/presentation.html` — en ligne : https://jpdesbiens11.github.io/DynamiteOrbit.ai/presentation.html

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

Vingt-neuf pages et une annexe, pour une vingtaine de minutes, puis l'outil en direct : charger la démonstration, ouvrir l'Atelier,
ajouter une interface, suivre la pièce jusqu'à son dossier de commande.

## Ce qu'elle montre depuis la v0.70

Mise à jour avec ce qui est arrivé depuis la v0.58 : une page de plus à la station Physique — « Un média, pas une
valeur — et le calcul part avec vous » (base des médias, note de calcul Word et PDF, classeur Excel vivant pour les 21
modèles) — et, dans les pages existantes : les mots de l'atelier en anglais et le choix d'unités SI ou impérial (Pièce),
le plan du mold (Procédés), les cinquante séries de connecteurs avec leur modèle et leur empreinte (Électrique), les
dessins écrits en anglais et cotés en millimètres ou en pouces (Dessins), les premiers pas guidés (dernière page). Toutes
les captures ont été refaites sur la version 0.70. L'écran de la bibliothèque électrique n'est pas montré en capture :
il cite des fabricants par leur nom, ce que le matériel de présentation évite.

## Ce qui a changé depuis (v0.71 à v0.73)

Pas de page nouvelle ; le texte suit l'outil : l'anglais des dessins porte aussi le vocabulaire du projet (Dessins, avec
une note sur le dialogue et l'aller-retour IA) ; le choix d'unités suit dans le busbar, le circuit flexible, les
étiquettes, la simulation, l'isolation et les documents (Pièce, DFx) ; la carte se lit en mil et en pouces
(Électrique) ; le calcul reste en SI et le verdict du classeur lit le domaine de validité (Physique). Seule la capture
du dessin a été refaite (v0.71) : les autres écrans n'ont pas changé d'aspect en SI. Le pied de chaque page a été
desserré : la ligne de la plateforme et la note de la marque ne se touchent plus à l'impression.

## Depuis la v0.75

Une page de plus à la station Électrique — « La conception dans vos unités, les calculs en SI » — avec la capture de la
carte lue en mil et en pouces (`unites`, prise par `tools/tour_shots.mjs` dans le système impérial). Elle dit le
choix de JP : SI ou impérial pour la conception, SI toujours pour les calculs. **Toutes les captures ont été refaites
sur la v0.75** ; huit sont restées identiques à l'octet près, les écrans n'ayant pas changé.

## Depuis la v0.91

Deux pages de plus, et toutes les captures refaites sur la v0.91 (dix-neuf images ; la barre du haut et les volets ont
changé d'aspect depuis la v0.75) :

- station Assemblage — « Par modules, et en plusieurs versions » : un sous-assemblage porté d'un seul bloc, les pièces à
  On / Off, les variantes gardées sous un nom et leur dessin (capture `modules` : le dissipateur et son isolant en
  sous-assemblage du variateur, deux variantes) ;
- station Physique — « Comparer des cas sans refaire le modèle » : conditions à On / Off et copies, le cas que chaque
  résultat a calculé, les zones de raffinement, le cas gardé dans le projet (capture `cas` : la pression doublée à la
  place de la première, mise à Off).

Le confort de l'interface n'a pas de page à lui : la page de la pièce le porte. Sa capture (`piece`) montre maintenant
la rotation automatique — le pivot, ses arcs, deux sens allumés ensemble — et un groupe replié ; son texte et ses notes
disent la vue qui tourne autour du point saisi, les groupes repliables, le zoom, la loupe et l'annulation des opérations
longues. La présentation tient ainsi dans ses deux garde-fous (trente pages au plus, annexe comprise ; moins de 500
lignes), que `tests/node/presentation.test.mjs` vérifie.

La capture `cas` montre le recoupement « discordant » de la démonstration : l'estimation à la main (une plaque) ne
convient pas à ce boîtier, et l'outil le dit. Les notes de la page l'expliquent ; on ne l'a pas maquillé.

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

## Où elle est déposée

En ligne, la page est toujours celle de la dernière version publiée. Une copie datée — le PDF, le fichier HTML autonome
(une seule page, qui s'ouvre sans réseau) et les notes du présentateur — va dans le Google Drive du projet, dans
« DesignOrbit.ai » → « Communications et marketing » → `Présentations`. La plus récente reste en tête du dossier ; celle
qu'elle remplace descend dans « Versions précédentes ». Les communications et le matériel marketing vont à côté, chacun
dans le sous-dossier de son sujet, à mesure qu'ils sont produits.

## Ce que la présentation affirme

Elle ne donne aucun chiffre de gain de temps : personne ne l'a mesuré. Elle dit ce que l'outil fait, et consacre une page
à ce qu'il ne prétend pas (valeurs typiques, simulation simplifiée, pas un remplaçant de la CAO de production, projet
jeune). La démo en ligne s'ouvre sur approbation ; sur son propre poste, l'application s'ouvre sans compte.

## La storyline

Une **histoire animée**, en un seul fichier HTML : Hugo, étudiant en génie mécanique, mène un produit de l'idée au
résultat avec la plateforme, avec trois coéquipiers et un assistant IA. Chaque écran est une **capture réelle** de
l'application (l'exemple Rover) ; un curseur s'y déplace là où l'histoire dit que la main va, la narration et les
échanges de l'équipe défilent à côté. Lecture automatique, ← → et Espace ; `fichier.html#7` ouvre la scène 7, en pause.

```bash
python3 designwizard.py --port 8141 --no-browser --data /tmp/dw_storyline
```

```bash
node tools/storyline.mjs http://localhost:8141 Storyline_Hugo.html
```

- Le récit — scènes, narration, répliques, où va le curseur — est dans `tools/storyline_story.mjs` : c'est le seul
  fichier à retoucher pour changer l'histoire. Personnages de fiction ; aucun portrait, des initiales.
- `tools/storyline.mjs` charge l'exemple, pose les étiquettes et le rendu de l'équipe, capture chaque écran (WebP, dans
  le fichier), relève où sont les boutons que le curseur visite, et écrit le fichier avec la note de la plateforme.
- Le fichier pèse environ 1,7 Mo : il passe par le connecteur Drive (limite d'environ 3 Mo). Il se dépose dans le
  dossier de communications du Drive, sous-dossier `Storyline`, nommé `Storyline_Sujet_AAAA-MM-JJ.html`.

