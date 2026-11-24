# Essai pilote — une heure avec DynamiteOrbit.ai

> Ce fichier est écrit par `node tools/pilot_kit.mjs --docs` à partir de `tools/pilot/content.mjs` : changez le contenu là, pas ici.
> Le robot `tools/pilot_walk.mjs` suit ce parcours sur l'outil et vérifie que chaque mot cité « entre guillemets » est bien à l'écran.

Savoir où un nouveau venu hésite, ce qu'il comprend seul et ce qui lui manque en premier. Ce n'est pas un examen de la personne : c'est l'outil que l'on essaie.

L'outil est un logiciel libre en développement actif. Rien de ce qu'il calcule ne remplace la vérification d'un ingénieur ; chaque méthode dit dans l'Aide ce qui a été lu, testé ou repris de mémoire.

## Avant de commencer

- Un ordinateur avec Chrome ou Edge, une fenêtre d'au moins 1366 px de large, une souris à molette. L'outil n'a pas été essayé au toucher, ni sur Firefox et Safari.
- L'outil, de l'une de ces deux façons. En ligne : https://jpdesbiens11.github.io/DynamiteOrbit.ai/ — connexion Google ; à la première visite l'écran montre une « empreinte d'accès » et un bouton « Demander l'accès » : l'administrateur l'approuve, puis la porte s'ouvre. Sur votre poste : Python 3.9 ou plus récent, « git clone https://github.com/jpdesbiens11/DynamiteOrbit.ai.git », puis « python designwizard.py » dans le dossier — rien d'autre à installer, rien ne quitte votre poste.
- Une heure sans interruption. Ne préparez rien : c'est le premier contact que l'on veut voir.
- La fiche de retour, à côté de vous. Notez au fil de l'eau : où vous avez hésité, ce que vous avez cherché sans le trouver.
- Rien de confidentiel : l'essai se fait sur la démonstration, pas sur vos produits.

## Le parcours

| | Station | Où | Durée |
|---|---|---|---|
| 0 | Entrer | Accueil | 0 – 5 min |
| 1 | L'assemblage | Mécanique › 3 Assemblage | 5 – 12 min |
| 2 | L'Atelier : une pièce née de l'intention | Mécanique › 1 Atelier | 12 – 20 min |
| 3 | Une pièce : ses cotes, ses règles, son dossier | Mécanique › 2 Pièces | 20 – 26 min |
| 4 | Le calcul à la main | Mécanique › 5 Physique | 26 – 31 min |
| 5 | La simulation, après l'estimation | Mécanique › 5 Physique · Simulation, onglet Simulation | 31 – 37 min |
| 6 | L'isolation électrique | Électronique › 4 Isolation | 37 – 42 min |
| 7 | La carte électronique et son Labo | Électronique › 2 PCBA, puis 3 Labo | 42 – 49 min |
| 8 | Le dessin | Mécanique › 4 Dessins | 49 – 53 min |
| 9 | La revue et son dossier | Produit › 1 DFx, 2 Revue, 3 Rapport | 53 – 57 min |
| 10 | Confier une tâche à une IA | Le bouton à étincelle de la barre du haut | 57 – 60 min |

Total : 60 minutes.

### 0. Entrer — 5 min

*Accueil.* Ouvrir l'outil, charger la démonstration, repérer la barre du haut.

1. Ouvrez l'outil (en ligne ou sur votre poste). Vous êtes sur l'accueil.
2. Cliquez « Charger la démonstration ». L'assemblage du variateur s'ouvre.
3. Regardez la barre du haut : quatre groupes — « Mécanique », « Électronique », « Logiciel », « Produit ». Cliquez-en un : ses écrans se déplient, numérotés dans l'ordre où l'on conçoit. Échap referme.
4. À droite de la barre, le bouton « Guide » dit ce qui manque ou cloche sur l'écran ouvert ; le point d'interrogation ouvre l'Aide.

**À remarquer.** Sur l'accueil, « Le parcours » liste les écrans dans l'ordre d'une conception.

**À noter sur la fiche.** Avez-vous su où cliquer en premier ? Qu'attendiez-vous de trouver sur l'accueil ?

### 1. L'assemblage — 7 min

*Mécanique › 3 Assemblage.* Voir un produit entier, monté par ses interfaces.

1. Tournez la vue en glissant dans la vue ; la molette zoome. Sous la vue, essayez « Vue éclatée » (le curseur écarte les pièces), « Rayons X » et, dans le menu de coupe, « Coupe X ».
2. Volet de droite, onglet « Mates » : cliquez un accouplement — ses deux interfaces se montrent dans la vue.
3. Onglet « BOM » : la nomenclature, visserie comprise. Onglet « Gamme » : la gamme d'assemblage, phase par phase.
4. Volet de gauche : mettez le « Couvercle » à Off par son interrupteur. Il reste dans la liste, mais ne compte plus. Remettez-le à On — ou faites Ctrl + Z.
5. Cliquez « Interférences » : l'outil cherche les volumes communs entre les pièces.

**À remarquer.** Chaque accouplement est né de deux interfaces qui se correspondent : personne ne l'a posé à la main.

**À noter sur la fiche.** Les accouplements faits seuls sont-ils ceux que vous auriez posés ? Un geste de la vue 3D vous a-t-il manqué ?

### 2. L'Atelier : une pièce née de l'intention — 8 min

*Mécanique › 1 Atelier.* Faire une pièce sans esquisse : dire à quoi elle sert, l'outil propose.

1. Ouvrez l'Atelier, puis la porte « Pas à pas ».
2. Question 1 : dans « Nom de la pièce », tapez un nom (par exemple : Équerre de capteur), dites en une phrase à quoi elle sert, puis « Suivant ». Questions 2 et 3 — ses contraintes, ses voisines : répondez, ou « Passer ».
3. Question 4 : cliquez « Je me visse sur… », puis « On se visse sur moi ». La pièce se dessine à mesure, à droite.
4. Question 5 : choisissez un matériau, par exemple « Aluminium 6061-T6 » ; ce que le procédé choisi ne sait pas travailler est grisé.
5. Question 6 : lisez « Gamme de fabrication » et « Ce que le compagnon a décidé » ; la fiche « Ce qui est retenu » ramène à une question d'un clic.
6. « Créer la pièce » : elle arrive dans le projet, prête à être ajustée.

**À remarquer.** Changez une interface de face, ou la matière première : la pièce, la gamme et les décisions changent ensemble.

**À noter sur la fiche.** La pièce proposée est-elle celle qu'un artisan aurait faite ? Qu'auriez-vous voulu dire à l'outil, sans le pouvoir ?

### 3. Une pièce : ses cotes, ses règles, son dossier — 6 min

*Mécanique › 2 Pièces.* Ajuster une pièce, et voir ce que l'outil en vérifie et en tire.

1. Ouvrez les Pièces, puis la Base du boîtier dans la liste de gauche.
2. Onglet « Paramètres » : changez « Longueur » avec les flèches du champ — tenues, elles accélèrent. La pièce se reconstruit ; le couvercle, lié par ses interfaces, suit.
3. Volet de gauche, « Arbre de construction » : mettez l'opération posts à Off, puis à On — les colonnettes disparaissent, puis reviennent.
4. Onglet « DFx » : cliquez un constat pour le situer sur la pièce.
5. Onglet « Artéfacts » : « STEP » enregistre le fichier d'échange, « Dossier de commande (.zip) » réunit ce qu'un atelier demande.

**À remarquer.** Ctrl + Z annule chaque geste, un à la fois, et dit lequel.

**À noter sur la fiche.** Les constats de fabrication sont-ils justes pour vos procédés ? Lesquels manquent ?

### 4. Le calcul à la main — 5 min

*Mécanique › 5 Physique.* Poser une question de physique simple, et lire le calcul pas à pas.

1. Ouvrez la Physique. À droite, choisissez « Structure », puis « Cantilever · end load ».
2. À gauche, « Reprendre ses dimensions » lit la longueur, la section et le matériau sur une pièce du projet.
3. Groupe « Matériau » : une propriété ne se tape pas — elle vient d'un média choisi dans la base.
4. Changez la charge, dans « Chargement ». Lisez ensuite les onglets « Résultat », « Calcul » (pas à pas) et « Rapport » (note de calcul, classeur).

**À remarquer.** Les calculs restent en SI, quel que soit le système d'unités choisi pour la conception.

**À noter sur la fiche.** Le calcul pas à pas est-il celui que vous feriez à la main ?

### 5. La simulation, après l'estimation — 6 min

*Mécanique › 5 Physique · Simulation, onglet Simulation.* Lancer un calcul par éléments finis, et le recouper avec une estimation.

1. Ouvrez la tuile Physique · Simulation, puis l'onglet Simulation ; la Base du boîtier est choisie, avec son « Cas de charge ».
2. Un champ clignote : la pression est un exemple que l'outil a inventé. Tapez la vôtre, ou gardez-la par le bouton « Garder 0.002 MPa » à côté du champ. Tant que ce n'est pas fait, l'action attend.
3. Lisez « Avant de calculer — l'estimation à la main » : l'ordre de grandeur attendu, avant tout calcul.
4. « Lancer la simulation » : un voile dit ce qui se fait et depuis combien de temps ; son bouton d'annulation arrête vraiment.
5. Onglet « Résultat » : la carte des contraintes, et le recoupement avec l'estimation.

**À remarquer.** Une valeur inventée par l'outil n'est jamais prise pour une décision : elle clignote jusqu'à ce que vous la confirmiez.

**À noter sur la fiche.** L'estimation à la main vous aide-t-elle à croire le résultat — ou à en douter ?

### 6. L'isolation électrique — 5 min

*Électronique › 4 Isolation.* Mesurer les distances d'isolement sur le produit entier.

1. Ouvrez l'Isolation.
2. « Analyser » : l'outil mesure, pour chaque paire de potentiels, la distance dans l'air et la ligne de fuite sur l'assemblage complet.
3. Dans « Paires de nets », une paire sort non conforme : l'écart entre les deux zones haute tension de la carte de puissance est volontairement trop court. Cliquez-la : son chemin se trace dans la vue.
4. « Rôle des corps » : chaque corps est le conducteur d'un potentiel, ou un isolant.

**À remarquer.** Les valeurs requises viennent de tables saisies, « à vérifier » contre votre copie de la norme : l'Aide le dit.

**À noter sur la fiche.** Le résultat correspond-il à ce que vous mesureriez à la main ?

### 7. La carte électronique et son Labo — 7 min

*Électronique › 2 PCBA, puis 3 Labo.* Voir une carte conçue par ses fonctions, puis l'essayer sur un banc simulé.

1. Ouvrez le PCBA : en haut, le parcours de la carte ; dessous, les vues classiques — « Schéma », « Carte et couches », « Nomenclature ».
2. Cliquez « Labo », dans l'en-tête de la carte.
3. Un essai joue : les pistes et les composants du régulateur s'allument, deux oscilloscopes montrent ce qui commute et ce qui sort. La barre d'espace arrête et relance.
4. À gauche, choisissez « Témoin lumineux », puis l'essai « Clignotement » : la DEL s'allume et s'éteint sur la carte.
5. À droite, onglet « Fiche » : pourquoi cet essai, à quoi s'attendre, le montage, les étapes. Onglet « Relevés » : ce que l'on mesurera au vrai laboratoire se tape à côté de l'attendu.
6. « Plan de test (.docx) » écrit le plan de test fonctionnel de toute la carte.

**À remarquer.** Les circuits intégrés sont simulés par leur comportement typique, dit comme tel sur chaque fiche.

**À noter sur la fiche.** La fiche d'essai est-elle celle que vous donneriez à un stagiaire ? Et si l'électronique n'est pas votre métier : avez-vous compris ce que fait la carte ?

### 8. Le dessin — 4 min

*Mécanique › 4 Dessins.* Lire le dessin que l'outil a tracé, et l'enregistrer.

1. Ouvrez les Dessins, puis la Base du boîtier.
2. Le dessin est déjà tracé : vues, cotes à bulles, tolérances tirées des interfaces, cartouche. Ctrl + molette zoome la feuille ; « Agrandir » aussi.
3. À droite : « Cotes », « Cartouche », et les références de tolérancement. « PDF » enregistre le dessin.

**À remarquer.** Tout ce que l'outil écrit sur un dessin est en anglais, comme le métier le fait.

**À noter sur la fiche.** Le dessin est-il un bon point de départ ? Qu'y changeriez-vous d'abord ?

### 9. La revue et son dossier — 4 min

*Produit › 1 DFx, 2 Revue, 3 Rapport.* Voir ce qu'une revue de conception trouve prêt.

1. DFx : « Points à régler » réunit ce que les règles ont trouvé dans tout le projet ; un clic mène à l'endroit.
2. Revue : chaque pièce, assemblage et carte se marque « Revu » ou « À réviser », avec une note.
3. Rapport : le dossier de revue de conception — « PDF » ou « Word ».

**À remarquer.** Le rapport dit, pour chaque carte, où en est son plan de test.

**À noter sur la fiche.** Présenteriez-vous ce dossier en revue de conception ? Que lui manque-t-il ?

### 10. Confier une tâche à une IA — 3 min

*Le bouton à étincelle de la barre du haut.* Voir comment une tâche part vers un assistant, et revient.

1. Sur l'écran d'une pièce, cliquez le bouton à étincelle de la barre du haut — « Confier à l'IA » : la pièce s'exporte avec une demande, formulée comme à un technicien.
2. Avec un assistant sous la main : collez la demande, puis collez sa réponse dans l'outil. Chaque changement est listé ; vous acceptez ou non — en une seule étape, annulable.
3. Sans assistant : lisez seulement la demande. Cette station est facultative.

**À remarquer.** Rien ne s'applique sans que vous ayez vu la liste des changements.

**À noter sur la fiche.** Confieriez-vous une tâche de cette façon ? Laquelle en premier ?

## La fiche de retour

Pour chaque station : faite ou non, et où l'on a hésité. Puis six affirmations, de 1 (pas du tout) à 5 (tout à fait) :

1. J'ai su quoi faire sur chaque écran, sans aide.
2. L'outil montre clairement ce qu'il a supposé et ce que j'ai décidé.
3. La pièce née de l'intention est une pièce que je pourrais faire fabriquer.
4. Les vérifications — fabrication, isolation, calcul — sont celles que je ferais.
5. Les documents produits — dessin, gamme, plan de test, dossier de revue — sont un bon point de départ.
6. Je referais un essai sur l'un de mes propres produits.

Et cinq questions ouvertes :

- Trois choses qui m'ont plu.
- Trois endroits où j'ai hésité ou été arrêté.
- Ce qui m'a manqué en premier, par rapport à mes outils habituels.
- Ce que je n'ai pas cru, ou que j'aurais voulu vérifier moi-même.
- Un mot pour décrire l'outil à un collègue.

Les deux documents — le parcours et la fiche, en Word et en PDF — s'écrivent par `node tools/pilot_kit.mjs <dossier>`.

## Envoyer son avis

- Un ticket « Retour d'essai » : https://github.com/jpdesbiens11/DynamiteOrbit.ai/issues/new/choose — ou la fiche remise à la personne qui vous a invité.
- Joignez si vous le pouvez une image de l'écran où vous avez hésité (bouton à appareil photo de la vue).
- N'envoyez rien de confidentiel.

## Pour la personne qui anime

- Laissez la personne lire et cliquer seule. Si elle bloque, attendez trente secondes avant de dire quoi que ce soit — puis notez la question qu'elle a posée, pas la réponse.
- Demandez-lui de dire tout haut ce qu'elle cherche. Notez ses mots : ce sont ceux que l'écran devrait employer.
- Notez l'heure au début de chaque station. Une station qui déborde se coupe : passez à la suivante, et notez-le.
- À la fin, la fiche de retour d'abord, la discussion ensuite : la fiche se remplit mieux avant d'avoir entendu l'avis des autres.

## Ce qui est vérifié, ce qui ne l'est pas

- **Vérifié** : le robot ouvre chaque écran du parcours sur la démonstration, dans Chromium, et y trouve chaque mot que les étapes citent (`node tools/pilot_walk.mjs <adresse> <dossier>`). Un test tient que chaque mot cité est de ceux que le robot cherche, et que les durées font une heure.
- **Non vérifié** : le parcours n'a encore été suivi par personne d'autre que son auteur et son robot. Les durées sont une estimation : le premier essai les corrigera. Rien n'a été mesuré sur le temps gagné ou perdu avec l'outil, et ce parcours ne promet rien là-dessus.
