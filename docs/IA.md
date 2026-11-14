# Travailler avec une IA — l'aller-retour

DesignWizard.ai ne cache pas une IA dans ses menus : il rend chaque artéfact **lisible par une IA et par un humain**,
et organise l'aller-retour entre les deux. On confie une tâche à une IA comme à un technicien ou à un stagiaire ;
elle rend l'artéfact modifié ; l'outil montre ce qui a changé ; l'humain décide.

## Le geste

1. **Choisir l'artéfact.** Le bouton à l'étincelle de la barre du haut prend ce que montre l'écran — la pièce, l'assemblage
   ou la carte ouverte, sinon le projet entier. Une liste permet d'en choisir un autre sans quitter l'écran.
2. **Écrire la demande**, en langage courant : « passe le régulateur à 2 A », « ajoute quatre trous M4 aux coins »,
   « renomme les nets du bus CAN », « vérifie que chaque fonction a un critère chiffré ».
3. **Copier la demande et l'artéfact.** Le texte copié contient la demande, les règles du jeu (ne changer que ce qui est
   demandé, garder numéros et repères, rendre l'artéfact complet) et l'artéfact au format `.dwiz` (voir
   [FORMAT.md](FORMAT.md)). On le colle dans l'assistant de son choix.
4. **Coller la réponse.** L'outil y retrouve l'artéfact, le relit, et **liste chaque changement** : ajouts,
   modifications, retraits, avec l'ancienne et la nouvelle valeur.
5. **Appliquer — ou non.** L'application est une seule étape du projet, que Ctrl + Z annule.

## Les garde-fous

- **Rien ne part sans un geste.** L'outil n'appelle aucun service : il copie un texte, que l'on colle où l'on veut.
- **Les vérifications passent avant l'humain.** Une pièce que le langage refuse, un assemblage qui cite une pièce
  absente, une carte dont une broche n'existe pas : la réponse est signalée et ne peut pas être appliquée telle quelle.
- **Le numéro ne change pas.** Si la réponse porte un autre numéro, il est ramené à celui de l'artéfact.
- **La géométrie importée reste.** Le contenu d'un STEP importé n'est pas envoyé : une note le remplace, et il est
  remis en place au retour.
- **La conséquence entière est montrée.** Sur une carte, changer les paramètres d'un bloc suffit : ses composants et
  ses nets sont reconstruits, et la liste des changements les montre avant l'application.

## Ce qui fait l'aller-retour

| Artéfact | Où | Ce que les vérifications regardent |
|---|---|---|
| Pièce | tout écran d'une pièce ; onglet Fichier | langage de pièce (opérations, paramètres, interfaces) |
| Assemblage | écran Assemblage, Isolation | chaque pièce posée existe dans le projet |
| Carte électronique | écran PCBA (étape Revue) | composants, broches et nets cohérents ; blocs reconstruits |
| Projet entier | Accueil, Rapport, menu Projet | les trois contrôles ci-dessus, document par document |

Le projet entier porte aussi ses analyses (modèles de physique gardés, simulations) et ses réglages de dessin : ils font
l'aller-retour avec lui.

## Pourquoi cela marche

Le format `.dwiz` a été conçu pour cela : une instruction par ligne, des mots du métier, la plus importante d'abord,
sans perte par rapport au modèle interne. Une IA le lit sans notice ; un humain relit sa réponse sans outil. Toute
nouvelle brique de la plateforme naît avec ses mots dans le format — donc avec son aller-retour.
