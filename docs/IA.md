# Travailler avec une IA — l'aller-retour

DynamiteOrbit ne cache pas une IA dans ses menus : il rend chaque artéfact **lisible par une IA et par un humain**,
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

## La porte « Avec l'IA » de l'Atelier : créer et modifier, avec l'aperçu de ce qui se range où

Demandes de JP (20 novembre 2026) : « propose seulement le bouton IA avec une proposition de prompt… une façon de
réinjecter l'information… quels artéfacts vont être créés en apportant le résultat du prompt, qui peut être un .zip ou
n'importe quelle forme de fichier » ; « pouvoir revenir en arrière si l'IA n'a pas bien compris ». Choix confirmé par
menu : une réponse peut **modifier et créer**.

- **Une phrase, et la consigne est proposée** (`#/shop/ai`, `web/js/modules/shop_ai.js`). On dit ce que l'on veut, on
  choisit ce que l'IA doit rendre — une pièce, plusieurs, un assemblage complet — et ce qu'elle reçoit : les pièces du
  projet avec leurs **interfaces libres** (ce qui naît se raccorde alors à ce qui existe), et « pose-moi tes questions
  d'abord » (l'IA mène l'entrevue, une question à la fois). La consigne porte le langage d'une pièce
  (`LANGUAGE_REFERENCE`). Elle se copie, ou part en **dossier .zip** avec le projet entier (.dwiz), pour un assistant
  à qui l'on donne des fichiers. **L'outil n'appelle aucune IA** : c'est la personne qui porte la consigne et rapporte
  la réponse.
- **La réponse revient sous n'importe quelle forme** : un fichier .dwiz ou .json, plusieurs fichiers, un **.zip**
  (lu sans bibliothèque : `web/js/core/unzip.js`, entrées stockées ou compressées), ou le texte collé. Ce qui n'est ni
  une pièce ni un assemblage est dit, avec le nom du fichier.
- **Rien n'entre avant l'accord** : l'aperçu (`planAnswer`, `web/js/core/ai_door.js`, pur et testé) dit pour chaque
  artéfact ce que la réponse ferait — **créé**, **modifié** (combien de changements), **identique**, **écarté** avec
  sa raison (pièce invalide, numéro donné deux fois, assemblage qui nomme une pièce absente) — et **où il se range**
  dans la structure du produit : « Atelier ▸ Molded », « Atelier ▸ Busbars », « Mécanique ▸ Assemblage ». Une pièce
  qui porte le numéro d'une pièce du projet la modifie ; un numéro nouveau crée.
- **« Appliquer » est une seule étape annulable** (`applyPlan`). On reste sur la page, avec les liens vers ce qui a
  été fait — ouvrir tout de suite un assemblage neuf l'accouplerait et glisserait des étapes entre la réponse et son
  annulation. Un assemblage neuf sans accouplement s'accouple par ses interfaces quand on l'ouvre.
- **Le journal revient à avant une réponse**, même après d'autres changements (`project.aiJournal`, `revertEntry`) :
  ce qu'elle a créé est retiré, ce qu'elle a modifié est remis comme avant — en une étape annulable. Une pièce créée
  qu'un autre assemblage a montée depuis est **gardée**, et c'est dit. Le journal garde les vingt dernières réponses.
- **Cartes et feuilles de dessin dans la même réponse** (v0.144.0) : une réponse peut porter, à côté des pièces et des
  assemblages, des **cartes** (`board/1`, rangées « Électronique ▸ PCBA » ; une carte dont un bloc n'est pas dans la
  bibliothèque est écartée, et c'est dit) et des **feuilles de dessin** (`drawing/1`, rangées « Mécanique ▸ Dessins »),
  relues comme la boucle commune les relit — une feuille peut appartenir à une pièce que la même réponse crée :
  l'application pose les pièces d'abord, puis les assemblages, les cartes et les feuilles. Le journal garde tout, le
  cartouche du projet compris. Les cas de simulation gardent leur aller-retour par le bouton « IA » de leur écran.
- Essayé dans Chromium (23 vérifications : consigne, dossier, réponse en fichier et en .zip, aperçu, application,
  Ctrl + Z, journal, texte collé, réponse illisible). Aucune vraie réponse d'assistant n'a été essayée ici : les
  réponses d'essai sont faites à partir du projet lui-même.

## Le bouton « IA » de chaque écran, et un seul journal

Demande de JP (20 novembre 2026) : « s'assurer que c'est possible, dans tous les modules ou les pages fonctionnelles, de
faire des allers-retours avec l'IA… de pouvoir revenir en arrière si l'IA n'a pas bien compris ».

- **Un bouton « IA » visible, au même endroit sur tous les studios** : en tête du volet de gauche, à côté de la marche
  d'escalier (`web/js/core/stairs_ui.js`, installé une fois — un écran n'a rien à déclarer). Il ouvre la boucle commune
  (`web/js/modules/ai_loop.js`) sur **ce que l'écran montre** — la pièce, l'assemblage ou la carte — et sur le projet
  entier quand il n'en montre pas (`aiTargetOf` de `web/js/core/stairs.js`, pur et testé : une seule règle, que suit
  aussi le bouton de la barre du haut). Sa bulle nomme ce qui part. Sur le plancher de l'Atelier, sans volet, le
  bouton du fil d'Ariane mène à la porte « Avec l'IA ».
- **Un seul journal** : une réponse appliquée par la boucle commune — depuis n'importe quel écran, sur une pièce, un
  assemblage, une carte ou tout le projet — entre dans le même journal que celles de la porte de l'Atelier, **dans
  l'étape même qui l'applique** (`journalChange`, un crochet du magasin). Le journal se lit dans la boîte de
  dialogue de la boucle et sur la page « Créer avec l'IA » ; « Revenir à avant » retire ce qu'une réponse a créé,
  remet ce qu'elle a modifié **ou retiré**, même après d'autres changements. Le journal ne part jamais chez un
  assistant. **Les écrans qui ont leur propre aller-retour** — circuit flexible, circuit ramifié, étiquettes, séance
  photo, Labo — y entrent aussi (v0.144.0, `applyAnswer` de `web/js/modules/ai_loop.js`) : même marque « Brouillon IA »,
  même entrée au journal, dans l'étape même. Les révisions et l'équipe n'importent pas de réponse d'IA : une révision
  gelée ne change plus, un miroir d'équipe vient d'une personne.
- **Dessins, Simulation, Isolation : ce que l'écran montre, pas la pièce derrière** (v0.141.0, `web/js/core/ai_more.js`,
  pur et testé). Chacun part comme un petit document de son genre, avec le numéro de ce à quoi il appartient :
  - **la feuille de dessin** (`drawing/1`) d'une pièce ou d'un assemblage : le cartouche du projet (dessiné par, vérifié,
    approuvé, statut, organisation, note de confidentialité, projection, arêtes cachées, nomenclature à plat ou par
    niveau — il vaut pour **toutes** les feuilles du projet, et la consigne le dit), **l'anglais de chaque texte que le
    dessin écrit** (ceux qui n'en ont pas encore arrivent vides, à remplir), la coupe, les classes de cotes (SC, CSC,
    REF), les notes, la date, les notes générales mises à Off, le **bloc « UNLESS OTHERWISE SPECIFIED »** (des valeurs
    qu'une réponse change redeviennent des exemples : une réponse ne confirme jamais le bloc) et les **vues de détail**
    d'une pièce (lettre, vue, centre et rayon dans le plan de la vue, échelle, On / Off). Les vues, l'échelle et le format
    sont calculés : ils ne se confient pas ;
  - **le cas de charge** (`loadcase/1`) d'une pièce ou d'un assemblage : le cas en cours et les autres, par leur nom —
    appuis, efforts, puissances, convection, zones, instruments. Une réponse appliquée **remet l'écran Simulation à
    jour** (il ne relisait son cas qu'après une annulation) ; les simulations gardées ne sont pas refaites, et c'est dit ;
  - **les réglages d'isolation** (`isolation/1`) d'un assemblage — potentiels et tensions, degré de pollution, altitude,
    catégorie de surtension, champ, niveau de chaque paire, rôles des corps — ou d'une carte (ses potentiels viennent du
    PCBA : ils ne se changent pas ici). Les résultats de la dernière analyse sont **retirés** quand les réglages
    changent : ils ne valent plus ; on relance « Analyser ».
  Chaque réponse est relue avant d'être appliquée (un genre de cas, une projection, un niveau d'isolation qui n'existent
  pas l'arrêtent), montrée changement par changement, appliquée en **une étape annulable**, et **entre au journal** — qui
  garde maintenant aussi les cas de charge et le cartouche : « Revenir à avant » les défait. Le menu « Artéfact » de la
  boîte de dialogue mène toujours à la pièce, à l'assemblage, à la carte ou au projet entier.
- Pas encore : les écrans qui ont leur propre aller-retour (circuit flexible, étiquettes, studio photo, Labo, révisions,
  équipe) ne passent pas encore par le journal ; les cartes et les dessins dans une réponse de la porte de l'Atelier.
- Essayé dans Chromium (19 vérifications : le bouton sur douze écrans avec la bonne cible, l'ouverture de la boucle,
  une réponse appliquée, le journal, le retour à avant après un autre changement).

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

## Le format de DynamiteAgile, tel quel

L'analyse fonctionnelle d'un projet s'échange avec DynamiteAgile **dans son propre format de fichier**, le Project
Starter (`"format": "dynamite-project-starter"`, version 1), celui que lit son écran « Commencer »
(`web/js/core/dynamite.js`). Dans l'écran PCBA, étape Revue, « Structure fonctionnelle » :

- **DynamiteAgile (.json)** écrit le fichier : `project` (clé de Space tirée du nom), et l'objet `diamond` —
  l'**arbre fonctionnel** (la fonction primaire du produit, les fonctions de la carte en fonctions secondaires, celles
  de ses blocs en fonctions *technique*, la fonction de chaque pièce mécanique), la **structure fonctionnelle** (les
  connecteurs de bord deviennent des entrées et sorties, les flux d'énergie et d'information relient les fonctions
  secondaires) et les **pièces** posées sur leurs fonctions (conçues ou achetées).
- **Importer de DynamiteAgile…** lit l'arbre d'un tel fichier (ou d'un Space exporté) dans la carte : les fonctions
  nouvelles arrivent en « Brouillon IA », celles qui y sont déjà sont laissées, rien n'est retiré — une étape annulable.

Les règles vérifiées à l'écriture comme à la lecture sont celles du format : la première fonction sans parent est la
fonction primaire, de type usage ; trois niveaux, une fonction technique seule au quatrième ; un flux part d'une entrée
ou d'une fonction et arrive à une fonction ou à une sortie ; les pièces se posent sur des fonctions secondaires ou
tertiaires ; 160 caractères par fonction, aucun balisage. Le lecteur a été éprouvé sur les trois fichiers d'exemple du
dépôt de DynamiteAgile. Dans l'autre sens, six fichiers écrits ici — le premier design d'exemple, le variateur de
démonstration, un projet à deux cartes, un projet sans carte, un projet vide, des textes à nettoyer — ont été soumis au
validateur de DynamiteAgile lui-même (`tools/check_starter.py`, version 0.60.104) : tous acceptés, avec ses seuls avis
d'usage (aucun requis, aucun backlog, aucun code de temps, que DynamiteOrbit n'exporte pas). Cette vérification est faite
à la main : la suite de tests de ce dépôt ne dépend pas de celui de DynamiteAgile.

## Pourquoi cela marche

Le format `.dwiz` a été conçu pour cela : une instruction par ligne, des mots du métier, la plus importante d'abord,
sans perte par rapport au modèle interne. Une IA le lit sans notice ; un humain relit sa réponse sans outil. Toute
nouvelle brique de la plateforme naît avec ses mots dans le format — donc avec son aller-retour.

## La bascule aperçu / code

Dans la barre du haut, deux boutons côte à côte — l'œil et `</>` — comme dans une conversation avec Claude. `</>`
(ou **Alt + C**) remplace l'écran par **le code de ce qu'il montre** ; l'œil (ou Échap) rend l'écran, intact.

| Ce que montre l'écran | Code proposé |
|---|---|
| une pièce (studio, profilé, carte PCB, dessin, simulation) ou la proposition de l'Atelier | **FeatureScript** — la même définition qu'Onshape : à coller dans un Feature Studio — et **`.dwiz`** |
| un assemblage (assemblage, isolation, dessin d'assemblage) | `.dwiz` de l'assemblage, et le FeatureScript de chacune de ses pièces à la suite |
| une carte électronique | `.dwiz` |
| tout autre écran | `.dwiz` du projet entier, sans ses registres de revue |

Trois gestes : **Copier** (le texte tel quel), **Télécharger**, et **Copier pour une IA**. Ce dernier place devant le
code une consigne courte et formelle (`web/js/core/code_sources.js`, `aiCodePrompt`) :

1. **l'entrevue** — au plus cinq questions, une à la fois, puis un résumé en trois lignes et l'accord de l'ingénieur ;
2. **la réponse attendue** — un seul bloc ```` ```dwiz ```` contenant l'élément en entier, mêmes repères, mêmes clés
   d'interface, puis la liste des changements ; aucun résultat d'analyse ;
3. **le retour** — coller la réponse dans « Confier à l'IA » : les changements se voient avant d'être appliqués.

Quand le code copié est du FeatureScript, le `.dwiz` l'accompagne : l'IA lit la géométrie exacte dans le premier et
répond dans le format du second. La boucle de mise à jour reste donc celle de la spécification de haut niveau ; le
FeatureScript sert à lire, à reconstruire dans Onshape, ou à demander une variante à part.

Limites : le FeatureScript n'est pas relu en sens inverse (une réponse en FeatureScript ne revient pas dans
DynamiteOrbit), et il reste expérimental — généré, non exécuté dans Onshape.
