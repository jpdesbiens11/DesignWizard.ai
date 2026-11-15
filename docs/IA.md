# Travailler avec une IA — l'aller-retour

DesignWizard.ai ne cache pas une IA dans ses menus : il rend chaque artéfact **lisible par une IA et par un humain**,
et organise l'aller-retour entre les deux. On confie une tâche à une IA comme à un technicien ou à un stagiaire ;
elle rend l'artéfact modifié ; l'outil montre ce qui a changé ; l'humain décide.

## Le geste

1. **Choisir l'artéfact.** Le bouton à l'étincelle de la barre du haut prend ce que montre l'écran — la pièce, l'assemblage
   ou la carte ouverte, sinon le projet entier. Une liste permet d'en choisir un autre sans quitter l'écran.
2. **Écrire la demande**, en langage courant : « passe le régulateur à 2 A », « ajoute quatre trous M4 aux coins »,
   « renomme les nets du bus CAN », « vérifie que chaque fonction a un critère chiffré ».
3. **Copier pour l'IA.** Le texte copié contient la demande, les règles du jeu (ne changer que ce qui est
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

### Les mêmes garde-fous que DynamiteAgile

Le geste est celui du *Co-Intelligence WorkFlow* de la plateforme DynamiteAgile : **on copie pour l'IA, on travaille
avec l'assistant de son choix, on réimporte avec un aperçu.** Trois garde-fous en viennent, appliqués à l'arbre
fonctionnel d'une carte (fonctions et blocs) :

- **« Brouillon IA ».** Ce qu'une réponse ajoute ou modifie arrive marqué ; ce qu'elle ne touche pas garde son état.
  Un humain relit, corrige, puis **confirme** : l'élément redevient le sien. La revue de conception ne passe pas tant
  qu'il reste un brouillon.
- **Une norme nommée par l'IA n'est pas une référence.** Les normes que la réponse cite (ISO, IEC, IPC, EN, UL…)
  sont relevées dans l'aperçu ; l'élément ne se confirme qu'avec, pour chacune, son **édition** et sa **clause**.
- **Un numéro de fonction est gardé pour toujours** : une fonction retirée ne rend pas son numéro.

L'aperçu avant import est un essai à blanc : il dit ce qui arriverait en brouillon et quelles normes seraient à
confirmer, sans rien changer.

### Les gammes

Le bouton « IA » d'une gamme (pièce, assemblage, carte) ouvre le même dialogue et joint la gamme calculée **pour
référence**, avec les clés de ses phases : l'IA peut l'annoter (`plan` → `notes`, `point`), changer l'ordre de montage
(`plan order=[…]`) ou modifier ce qui produit la gamme. Voir [GAMMES.md](GAMMES.md).

## Le premier design complet, par entrevue

Avant d'avoir la moindre pièce, on peut demander à une IA **le premier jet du produit entier**. Accueil → « Premier
design avec une IA… » (aussi dans le menu Projet et dans l'écran Revue) :

1. **Décrire le produit**, en détail : ce qu'il fait, où il vit, son énergie, les pièces imaginées, les cotes connues,
   les efforts, la quantité. Plus la description est précise, plus l'entrevue est courte.
2. **Copier le prompt d'entrevue** et le coller dans l'assistant de son choix. À la manière du *Project Starter* de
   DynamiteAgile, l'assistant mène l'entrevue : une question à la fois, des réponses à cliquer (le conseillé en premier,
   « Je ne sais pas » toujours offert), six blocs — produit, architecture, interfaces, électronique, efforts et
   physique, fabrication — un récapitulatif par bloc. Il ne redemande pas ce que la description dit déjà.
3. **Charger le fichier** qu'il rend : un seul objet JSON — toutes les pièces dans le langage de pièce, l'assemblage
   (ses pièces posées, sans liaison), la carte par ses fonctions et ses blocs du catalogue, les analyses par leurs
   données d'entrée, et un `brief` : réponses de l'entrevue, hypothèses, questions ouvertes.
4. **Lire l'aperçu**, puis créer le projet. Rien n'est créé avant.

Le fichier est **lu, pas cru** (`web/js/core/first_design.js`) :

| Ce que l'IA écrit | Ce que l'outil en fait |
|---|---|
| Une pièce | Elle passe par le langage de pièce ; une opération inconnue ou un repère en double la fait refuser, avec la raison |
| Les interfaces | Une clé portée par deux pièces, côté A et côté B, s'accouple ; portée par une seule, elle regarde l'extérieur ; par trois, c'est signalé |
| L'assemblage | Les pièces absentes sont retirées ; les liaisons se font seules, par les clés, à l'ouverture |
| La carte | Reconstruite ici depuis ses fonctions et ses blocs : composants, nets, contour et trous hérités de sa pièce ; fonctions et blocs en « Brouillon IA » |
| Une analyse | **Calculée ici** à partir de ses données d'entrée ; un résultat écrit par l'IA n'est jamais repris |

Ce qui est refusé donne une **demande de correction** prête à copier dans la même conversation. Un tel fichier déposé ou
collé n'importe où dans l'outil est reconnu et suit le même chemin. « Voir un exemple » charge une description et la
réponse correspondante (un module de température : boîtier moulé, couvercle, platine, carte, quatre analyses).

## La revue de conception

Tout ce qu'une IA a écrit arrive dans l'écran **Revue** en « Brouillon IA ». Chaque artéfact — pièce, assemblage, carte,
analyse — y a son état, sa révision, ce que l'outil constate (la pièce se construit-elle ? que dit le DFx ? quel verdict
pour l'analyse ?) et une note de revue. En tête : les questions ouvertes et les hypothèses de l'IA, à lire en premier.

| État | Sens |
|---|---|
| Brouillon IA | écrit ou modifié par une IA, pas encore relu |
| À revoir | fait à la main, jamais passé en revue |
| À réviser | la revue demande une modification (note en clair) |
| Revu | relu et validé par une personne |
| Modifié depuis la revue | validé, puis modifié — à la main ou par une IA : à revoir |

Trois gestes, par artéfact : **Revu** ; **À réviser** (la note est gardée) ; l'étincelle, qui confie *cette pièce seule*
à une IA avec la note pour demande. Et un geste pour tout le projet : **Itération complète avec l'IA** envoie le projet
avec toutes les notes de la revue, nomme ce qui est déjà revu et ne doit pas bouger, et revient avec la liste de ses
changements — une seule étape, annulable. Au retour :

- ce que la réponse a changé repasse en « Brouillon IA » ; ce qu'elle n'a pas touché garde son état ;
- le registre de revue et le `brief` restent ceux du projet : ils ne partent pas, et ne se laissent pas réécrire ;
- une analyse dont les données ont changé est recalculée ici.

Valider un artéfact déjà validé dont le contenu a changé crée sa **révision suivante** (A → B), avec une ligne
d'historique. Le registre (`project.review.items`, `web/js/core/review.js`) voyage dans le fichier du projet ; le
rapport de revue en imprime l'état, artéfact par artéfact.

## Pourquoi cela marche

Le format `.dwiz` a été conçu pour cela : une instruction par ligne, des mots du métier, la plus importante d'abord,
sans perte par rapport au modèle interne. Une IA le lit sans notice ; un humain relit sa réponse sans outil. Toute
nouvelle brique de la plateforme naît avec ses mots dans le format — donc avec son aller-retour.
