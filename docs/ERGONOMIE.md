# Audit d'ergonomie

Un robot ouvre **chaque écran** de l'application, sur le projet de démonstration, à **trois tailles de fenêtre** —
portable 1366 × 768, bureau 1600 × 1000, grand écran 1920 × 1080 — et relève ce qui gêne la lecture et le clic. Il sert à
trouver d'un coup ce que l'on découvre sinon écran par écran.

```bash
python3 designwizard.py --port 8130 --no-browser --data /tmp/audit
node tools/ergo_audit.mjs http://127.0.0.1:8130 /tmp/audit_out
```

L'outil demande Playwright ; il ne fait pas partie de l'application et les tests ne le lancent pas. Il écrit
`report.json` et une capture par écran et par taille, et affiche un résumé.

## Ce qu'il relève

| Relevé | Ce que c'est |
|---|---|
| Page qui déborde | Une barre de défilement horizontale sur la page entière |
| Texte tronqué | Un texte coupé par des points de suspension ou par son cadre |
| Bouton sans nom | Un bouton ou un lien sans texte, sans étiquette, sans info-bulle |
| Cible trop petite | Un bouton de moins de 22 px de côté (hors liens dans une phrase) |
| Commande coupée | Un bouton, un champ ou un titre qui dépasse du bord de la fenêtre |
| Champ sans étiquette | Un champ que rien ne nomme |
| Listes déroulantes | Leur nombre par écran — un indice, pas une faute |

## Résultat — 24 écrans × 3 tailles, version 0.37.1

| Relevé | Avant | Après |
|---|---|---|
| Page qui déborde | 0 | 0 |
| Texte tronqué | 175 | 6 |
| Bouton sans nom | 0 | 0 |
| Cible trop petite | 74 | 2 |
| Commande coupée | 0 | 0 |
| Champ sans étiquette | 6 | 0 |
| Erreur dans la console | 0 | 0 |

Ce qui a été corrigé :

- **Les noms longs ne sont plus coupés** dans les volets : une pièce, un assemblage ou un titre prend une seconde ligne
  (« Variateur compact — assemblage général », « Étrier de montage (titane imprimé) »). Les libellés des paramètres et
  des cotes d'un dessin passent à la ligne au lieu de se terminer par « … ».
- **Ce que la vue dit se lit en entier** : les pastilles en bas de la vue 3D (« 6 pièces · 6 mates · 464,5 g… »,
  « 25 corps : 6 conducteurs avec net… ») étaient limitées à 170 px sur tout écran de moins de 1760 px.
- **Les petits boutons** des arbres (désactiver, supprimer, monter, masquer) font au moins 26 px ; une étiquette
  cliquable de la vue 3D, 24 px.
- **L'état de la barre du haut** ne garde plus le message de l'écran d'avant (« … construit en 300 ms »).
- Les deux zones de texte sans étiquette en ont une.

Ce qui reste, et pourquoi :

- **6 textes tronqués** : la pastille d'état de la barre du haut, à 170 px sur portable — la barre est pleine ; son
  texte entier est dans son info-bulle.
- **2 cibles** de 20 px dans l'écran DFx.
- **Listes déroulantes** : réglé à la v0.66.0 — voir « Les listes en arbre » ci-dessous. Sur la démonstration,
  l'Isolation passe de 38 menus à 6 (les conditions de l'analyse), les Dessins de 40 à 0.

## Les listes en arbre

Ce qu'un écran a en grand nombre se range **par état ou par nature**, comme les accouplements de l'Assemblage et le cas
de charge de la Simulation : un groupe, sa couleur, son compte ; un élément, son numéro et ses quelques mots ; un clic
sélectionne, un second relâche ; **un seul éditeur ouvert à la fois**, sous l'élément choisi — plus de mur de menus.

| Écran | L'arbre | Groupes | Ce que fait un clic |
|---|---|---|---|
| Isolation — corps (volet de gauche) | les corps de l'assemblage | conducteurs par potentiel, sans potentiel, métal flottant, isolants, hors analyse | ouvre le rôle et le potentiel de CE corps |
| Isolation — paires (volet de droite) | les paires de nets | non conformes, à vérifier, à mesurer, conformes | montre ses chemins et son calcul ; l'œil d'un état trace les chemins de toutes ses paires, à sa couleur |
| Dessins — cotes | les cotes de la feuille, au numéro de leur bulle | hors tout, positions et entraxes, trous, cotes de détail, cotes de définition | ouvre la classe de CETTE cote : Normale, REF, SC, CSC |
| Carte — vérifications | les constats (schéma et implantation) | à corriger, à vérifier, remarques | centre la carte sur le constat et dit quoi faire |

Les modèles sont purs et testés (`web/js/core/trees.js`, `tests/node/trees.test.mjs`) ; un seul module les dessine
(`web/js/modules/state_tree.js`), avec les styles des arbres existants (`.bc-tree`).

## Le repère, la grille et la taille de l'affichage

- **Repère X Y Z** : en haut à droite de chaque vue 3D, avec son point central. L'axe qui vient vers l'œil est dessiné
  par-dessus, celui qui s'éloigne est estompé. Un clic sur une lettre regarde le long de son axe.
- **Grille derrière la pièce** : bouton « Grille » de la barre de la vue, ou touche **G**. Elle se pose sur les trois
  faces de la boîte de la pièce qui sont à l'opposé de l'œil — le sol et les deux murs du fond — donc toujours
  *derrière*, quelle que soit la vue. Son pas est un nombre rond de millimètres (0,5 · 1 · 2 · 5 · 10 · 20 · 50…),
  écrit sous le repère, avec un trait plus fort tous les cinq pas. Le choix vaut pour toutes les vues et le navigateur
  le garde (`web/js/core/view_grid.js`, pur et testé).
- **Taille de l'affichage** : menu du compte (l'icône de personne) → « Taille de l'affichage », cinq pas de 90 à
  150 %. Tout suit — textes, boutons, étiquettes des vues 3D, barre du haut — parce que tout est en `rem` ; les volets
  s'élargissent avec leur texte. Le choix est gardé par le navigateur et appliqué avant le premier affichage.

## Poser à la souris, aidé

Demande de JP : poser un trou ou une interface sans mesurer ni taper de valeur. Un outil armé — « Trou de passage »,
« Borne vissée », « Contact à pression » dans l'écran des busbars ; « Trou ici », « Interface ici » dans le studio des
pièces — montre, sur la face survolée :

- une **grille de 5 mm** : c'est là que l'élément tombera si on clique ;
- la **ligne de centre**, en pointillé rouge, dès que l'**axe de symétrie** de la face accroche l'élément ; en violet,
  la ligne d'un **voisin** quand l'élément vient s'aligner sur lui ;
- deux **cotes** vers les bords les plus proches, qui suivent le pointeur ;
- une **fenêtre de coordonnées**, en haut à droite de la vue : la face, les deux coordonnées, et ce qui accroche.

Un **clic pose** l'élément ; **Échap** le lâche ; **Alt** le libère de tout accrochage. L'ordre des accrochages, pour
chacune des deux directions de la face prise à part : l'axe de symétrie, puis l'alignement sur un voisin, puis la grille.
Une fois posé, l'élément se règle au clavier (flèches : 1 mm, Maj : 5 mm, Alt : 0,1 mm) ou en tapant sa **position dans
le volet de gauche**. **Maintenir deux secondes** le pointeur sur un élément le reprend à la souris jusqu'au prochain
clic ; le bouton « Reprendre » de sa carte fait de même.

**Parallèle et perpendiculaire.** Dans toutes les vues, la mesure entre deux points (M) accroche le second point quand
la ligne suit un axe à moins de 6° : la ligne passe au rouge, « ∥ X — relâchez pour accrocher », et la mesure est prise
sur l'axe. Le **clic droit** de chaque vue règle les quatre accrochages (axes de symétrie, alignement sur les voisins,
grille de 5 mm, parallèle / perpendiculaire) ; le choix est gardé d'une session à l'autre.

Code : `web/js/core/snap.js` (les règles, pures et testées), `web/js/core/view_place.js` (la grille, les lignes, les
cotes, la fenêtre, la reprise), `web/js/modules/busbar_place.js`. **Limites** : la grille part du coin de la face et son
pas est fixe (5 mm) ; dans le studio des pièces, les axes sont ceux de l'encombrement de la pièce, pas ceux de chaque
face ; la reprise par maintien n'existe que dans l'écran des busbars ; l'Atelier place ses interfaces par face, sans
position à régler. Rien de cela n'a été essayé sur un écran tactile.

## Les niveaux : un fil d'Ariane, une marche d'escalier, des onglets de travail

Demandes de JP (20 novembre 2026) : « il n'y a présentement pas de façon de monter à l'atelier principal puis aux
sous-composantes de pièces… à quel niveau tu les fais, ce que tu peux faire, comment tu passes d'un niveau à l'autre »,
puis, devant le petit bouton du Labo qui ouvre la carte dans le PCBA : « tu utilises ce concept-là pour remonter de
niveau, vers le niveau qui est lié directement à ce qu'on regarde… en escalier, d'une échelle à l'autre. Si on veut en
skipper plusieurs niveaux, on peut aller dans les menus ». Mise en page choisie par JP sur quatre maquettes : « fil
d'Ariane + plancher », « onglets dans l'outil ».

- **Trois niveaux dans l'Atelier, et un seul chemin** (`web/js/core/shop_levels.js`, pur et testé) :
  **1 — l'Atelier** (`#/shop`) : toutes les pièces du produit, par nature ou par assemblage, les portes pour en créer
  (pas à pas, avec l'IA, du commerce, ou dans un studio) et les étagères que l'on consulte de partout (registre des
  interfaces, procédés spéciaux, bibliothèque électrique) ; **2 — une nature de pièce** (`#/shop/n/<nature>`) : ses
  pièces, ce que son procédé demande, une nouvelle pièce de cette nature ; **3 — une pièce**, dans le studio de sa
  nature (un busbar dans le studio des busbars, un profilé dans celui des profilés, une carte dans le PCB, le reste
  dans Pièces). Une **nature** dit ce qu'est la pièce avant de dire comment elle est faite : *Machined, Molded,
  Extrusion, Sheet metal, Laser cutting, 3D printing, Busbars, Flex PCB, PCB, Off the shelf, Imported* — une couleur et
  un pictogramme chacune (`NATURES`).
- **Le fil d'Ariane dit où l'on est, sur chaque écran de l'Atelier** — Busbars et circuits flexibles compris, qui n'en
  avaient aucun (`web/js/modules/levels_bar.js`). Chaque niveau porte son numéro. C'est l'usage de la barre d'adresse
  d'un explorateur de fichiers : **un clic sur un niveau y remonte** ; **le chevron d'un niveau liste ce qui est à
  côté** — les autres natures, ou les autres pièces : les sœurs d'abord, puis toutes les autres par nature, avec
  recherche. Choisir un busbar depuis un profilé ouvre le studio des busbars. L'ancienne rangée de sous-onglets de
  l'Atelier, qui mêlait des façons de créer, des studios et des étagères, a disparu.
- **On descend comme on monte** (v0.112) : après la marche vers le haut et le bouton « IA », en tête du volet de gauche, les
  pictogrammes de **ce qui est fait à partir de ce que l'écran montre**, avec une flèche vers le bas — l'inverse exact de la
  marche vers le haut (`downOf` de `web/js/core/stairs.js`, un essai tient que chaque marche vers le bas ramène en haut d'où
  l'on vient). Une carte mène à son PCBA, un PCBA à son Labo, une pièce à son dessin et à sa simulation, un assemblage à ses
  sous-assemblages, à son isolation et à son dessin ; quatre au plus, ce qui définit le produit d'abord ; Alt + ↓ prend la
  première. L'usage suivi : l'explorateur de fichiers, où l'on monte au dossier parent et où l'on entre dans un dossier.
- **La marche d'escalier : un pictogramme, toujours au même endroit, vers ce dont l'écran dépend directement**
  (`web/js/core/stairs.js`, pur et testé ; `core/stairs_ui.js`). En tête du volet de gauche, juste après son titre : le
  pictogramme de là où l'on arrive, avec une petite flèche vers le haut. Le Labo monte au PCBA de sa carte ; la
  Simulation, un dessin, un calcul attaché à une pièce, les points DFx d'une pièce montent à la pièce ; l'Isolation, le
  Studio photo, les Étiquettes, le dessin d'un assemblage montent à l'assemblage ; un sous-assemblage monte à
  l'assemblage qui le porte ; une pièce monte à sa nature, une nature à l'Atelier. **Alt + ↑** fait de même. Une page
  sans volet la porte dans son en-tête. C'est le bouton « dossier parent » d'un explorateur ; **une seule marche à la
  fois est un choix maison**, dit ici : sauter plusieurs niveaux, c'est le rôle des menus de la barre du haut et des
  chevrons du fil d'Ariane. Un écran n'a rien à déclarer : il lui suffit d'un volet de gauche avec son `.side-head`,
  et d'une ligne dans `stairOf` qui dit de quoi il dépend.
- **Les onglets de travail gardent plusieurs pièces sous la main** (`web/js/core/work_tabs.js`), sous le fil d'Ariane :
  Ctrl + clic sur une pièce du plancher ou d'un chevron, ou le petit bouton au bout de sa ligne, la **garde** en
  onglet sans quitter la page ; ce que l'on ne fait que regarder passe dans un onglet **de passage**, en italique,
  que la pièce suivante remplace — un double clic, ou son « + », le garde. × ou le clic du milieu ferme. C'est l'usage
  des onglets d'un éditeur. Les onglets sont des adresses, jamais des copies : un seul projet en mémoire, rien ne se
  désynchronise ; ils sont gardés d'une séance à l'autre, par projet, dans le navigateur.
- **Deux sens pour Ctrl + clic, chacun dans son contexte** : sur un **lien** vers une pièce (plancher, chevron), il
  garde un onglet — comme un lien dans un navigateur ; sur une **ligne de liste d'un volet**, il choisit plusieurs
  lignes — comme dans un gestionnaire de fichiers. Le bouton au bout de la ligne fait voir le premier.
- Pas encore : les cartes (PCBA) et les dessins dans les onglets de travail ; la position de la vue 3D n'est pas gardée
  quand on revient à un onglet ; la marche du PCBA vers son PCB attend que chaque carte ait le sien.
- Essayé dans Chromium (61 vérifications : plancher, recherche, par assemblage, Ctrl + clic, onglets gardés après
  rechargement, chevrons, Monter, Alt + ↑, la marche de dix écrans) ; pas au toucher, ni sur Firefox et Safari.

## Une nouvelle pièce : une question à la fois

Demande de JP (20 novembre 2026) : « la première page, qui a vraiment beaucoup d'informations pour définir l'intention
de conception, devait vraiment changer. Les champs qui apparaissent sont les bons… on devrait plus procéder sous forme
d'une entrevue d'intention de conception, aspect par aspect ». Forme choisie par JP sur maquette : « une question à la
fois ».

- **Les mêmes champs, six questions** (`web/js/core/shop_steps.js`, pur et testé) : son rôle (nom, à quoi elle sert),
  ses contraintes (efforts, milieu, quantité, ce qui compte le plus), ses voisines, ses interfaces, sa matière (matériau
  et matière première), la pièce proposée. Rien n'est ajouté, rien n'est perdu : chaque champ de l'intention a sa
  question, et une seule.
- **L'écran** (`web/js/modules/shop_steps.js`) pose les questions PAR-DESSUS la page de l'intention, dont il ne possède
  pas les champs : ses blocs portent `data-step`, et seul celui de la question posée se montre. C'est l'usage de
  l'assistant pas à pas du web : un **rail** qui dit où l'on est (répondu, à dire, en cours — un clic y saute),
  « Retour », « Passer » (rien n'est obligatoire tant que le guide ne le demande pas), « Suivant » — et **Entrée** dans
  un champ.
- **La pièce naît à droite tout du long** : la vue, la gamme et ce que le compagnon a décidé se mettent à jour à
  chaque réponse, comme avant.
- **« Ce qui est retenu »** : une fiche d'une ligne par réponse — répondu, à dire, exemple à confirmer (la matière que
  l'outil a choisie reste un exemple tant qu'elle n'est pas confirmée), rien de dit. **Un clic sur une ligne revient à
  sa question** ; à la dernière question, la fiche se détache : c'est le résumé avant « Créer la pièce ».
- **Le guide ouvre la question dont il parle** : un clic sur « donnez un nom à la pièce » mène à la question 1.
- **« Tout voir sur une page »** ramène la page entière, pour qui la connaît ; le choix est gardé, et
  `#/shop/new/all` y mène d'office.
- Essayé dans Chromium (23 vérifications) ; pas au toucher, ni sur Firefox et Safari.

## Choisir dans une longue liste, et en choisir plusieurs

Demandes de JP (20 novembre 2026) : « un menu déroulant pour choisir la pièce… quand il y a 30 pièces, il faut vraiment
scroller », et « la fonction contrôle doit permettre de faire des multiples sélections ».

- **La pièce que l'on regarde se choisit dans un menu déroulant**, en tête du volet de gauche du studio des pièces
  (`web/js/core/pick_list.js`). Le bouton nomme la pièce affichée ; il ouvre la liste des pièces **groupées par
  procédé** (le nom du métier, une couleur par groupe), chacune avec son pictogramme, son numéro, sa matière et sa
  couleur. Un champ de recherche a le curseur : taper réduit la liste (les accents et la casse ne comptent pas), le
  compte dit « 3 sur 30 ». C'est le *combobox* du web : Entrée, Espace ou ↓ ouvre ; ↑ ↓ Début Fin parcourent ; Entrée
  choisit ; Échap ferme et rend le curseur au bouton ; un clic ailleurs ferme.
- **L'arbre de construction vient donc tout de suite sous le menu**, quel que soit le nombre de pièces. La liste
  entière reste, **sous l'arbre** : « Toutes les pièces », un groupe qui se replie comme les autres.
- **Ctrl + clic choisit plusieurs lignes** (⌘ sur un Mac), **Maj + clic toute une suite** depuis la dernière ligne
  cliquée — l'usage de tout gestionnaire de fichiers (`web/js/core/multi_select.js`, pur et testé). Un clic simple
  garde son sens : ouvrir la pièce, sélectionner l'élément. Les lignes choisies se marquent, et une **barre** apparaît
  en tête de la liste avec ce qui se fait d'un coup, chaque fois en **une seule étape annulable** :
  - dans **Pièces** : « Apparence » (la palette, pour toutes), « Matériau… », « Assemblage » (un nouvel assemblage fait
    de ces pièces) ;
  - dans **l'Assemblage** : « Apparence » (dans cet assemblage), « Grouper » (former un sous-assemblage, les éléments
    déjà cochés), « Off / On », « Masquer / Montrer ». Ctrl + clic sur une pièce **dans la vue 3D** fait de même ; Échap
    vide le choix.
- **Tout réglage touché pendant que plusieurs éléments sont choisis s'applique à toute la sélection** (demande de JP,
  20 novembre : « si on change une propriété, il y a juste la première pièce du lot qui va changer »). Ce n'est plus
  seulement la barre : la pastille de couleur d'une ligne choisie ouvre la palette pour toutes, son interrupteur
  On / Off et son œil agissent sur toutes, le clic droit — sur la ligne comme sur la pièce dans la vue — ouvre le menu
  de la sélection, et le volet de droite montre la fiche du lot. Une ligne qui n'est pas dans la sélection garde ses
  réglages à elle. Chaque geste reste UNE étape annulable (`web/js/modules/asm_group.js` ; dans Pièces, la pastille
  d'une pièce choisie peint toutes les pièces choisies).
- **Les opérations d'une pièce se choisissent aussi à plusieurs**, dans l'arbre de construction : Ctrl + clic, Maj +
  clic ; la barre propose « Off / On », « Dupliquer » (une copie de chacune, née à Off), « Dossier », « Supprimer »
  (`web/js/modules/part_tree.js`).
- Pas encore : la sélection multiple dans les conditions d'un cas de charge et les blocs d'une carte. Le mécanisme est
  commun ; chaque liste y viendra avec ce qui a un sens à faire en lot.

### Un dossier range, il ne change rien

Demande de JP (20 novembre 2026) : « prendre plusieurs caractéristiques, plusieurs pièces d'assemblage… les regrouper
avec un item qui peut les folder ou les défolder… pour montrer le détail ou montrer la vue globale ». C'est l'usage des
*feature folders* des modeleurs mécaniques.

- **Un dossier est un nom porté par les lignes qu'il contient** (`folder`), et rien d'autre (`web/js/core/folders.js`,
  pur et testé ; `core/folders_ui.js`). Aucune opération ne bouge, aucune pièce n'est remontée, aucune révision n'est
  touchée : la signature d'un artéfact l'ignore. Ce n'est pas « Grouper », qui forme un sous-assemblage et change la
  structure du produit — les deux boutons se côtoient, et leurs bulles disent la différence.
- **La ligne d'un dossier** : un chevron, le pictogramme, le nom, combien de lignes (« 4 · 1 à Off »), puis ce qui
  s'applique à tout le dossier — On / Off, et dans un assemblage l'apparence et l'œil —, « renommer » et « défaire »
  (ce qu'il contient reste là, tel quel). **Un clic replie ou déplie** ; Ctrl + clic choisit tout ce qu'il contient.
  L'état replié est un état de la vue, gardé dans le navigateur par liste.
- **Deux sortes de listes** : dans l'arbre d'une pièce, l'ordre est celui de la construction — un dossier montre donc
  chaque **suite** d'opérations qui porte son nom (deux suites séparées se lisent comme deux lignes du même nom, à
  leur place) ; dans un assemblage, l'ordre ne dit rien — un dossier réunit ses éléments là où est le premier.
- Un dossier replié ne cache pas un problème : une opération en erreur y met un point rouge.
- Pas encore : des dossiers dans la liste des pièces du projet (elles se rangent déjà par nature), ni de dossier dans
  un dossier. Essayé dans Chromium (25 vérifications) ; pas au toucher.

## La couleur de chaque pièce

Demande de JP : pouvoir donner soi-même une couleur et une teinte à chaque pièce, pour s'y retrouver d'un coup d'œil.

- **Une pastille** suit chaque pièce dans la liste du studio des pièces et dans celle de l'assemblage. En pointillé, la
  pièce a la couleur de sa matière ; en trait plein, la sienne.
- **Un clic sur la pastille** ouvre le sélecteur, sans quitter la pièce que l'on regarde : une rangée par couleur (gris,
  bleu, cyan, sarcelle, vert, jaune, orange, rouge, rose, violet, brun), une colonne par teinte (très clair, clair, franc,
  foncé, très foncé) ; « Plus clair » et « Plus foncé » règlent la teinte cran par cran ; « Autre… » ouvre la palette
  du système ; « Opaque / Voilé / Transparent » laisse voir ce que la pièce cache ; un bouton ramène la couleur de la
  matière. Le sélecteur reste ouvert pour essayer ; Échap ou un clic ailleurs le ferme. Chaque choix est une étape
  annulable.
- **Deux raccourcis** en tête de liste : « Une couleur par pièce » (chaque pièce qui n'en a pas reçoit la sienne,
  différente de ses voisines ; celles que l'on a choisies restent) et « Couleurs des matières ».
- La fiche de la pièce rappelle son apparence (« Apparence à l'écran »).
- **La palette s'ouvre dans la marge de droite** (demande de JP, 20 novembre 2026), par-dessus l'onglet qui s'y
  trouvait, et **y reste jusqu'à ce qu'on la ferme** (la croix, ou Échap) : la vue reste dégagée pour juger du
  résultat, un clic dans la vue ou dans la liste ne la ferme pas, et l'onglet d'avant réapparaît tel quel à la
  fermeture. La marge se redessine derrière elle à chaque choix ; la palette revient par-dessus. Sur une page sans
  marge de droite, ou quand elle est repliée, la palette flotte à droite de la fenêtre et se ferme d'un clic ailleurs.

### Motif, finition, et ce que l'assemblage en dit

Demande de JP (19 novembre 2026) : « adding color and shading that can be applied to each 3D parts (part & assembly
defined and visible) : including military camouflage color / shade / texture options (4-6 different pattern / color
set — snow, forest, desert, etc.) ».

- **Un motif** se pose sur la pièce, sous le groupe « Camouflage » du sélecteur : **Forest, Jungle, Desert, Snow,
  Urban, Navy** — chacun une vignette de lui-même et un nom court ; « Uni » revient à la couleur. Un motif et une
  couleur ne se cumulent pas : choisir une couleur franche retire le motif (une peinture à la fois) ; la couleur
  reste gardée sous le motif et revient quand il part.
- **Une finition à l'écran** — Mat, Satiné, Brillant, Métallisé — dit comment la surface répond à la lumière de la
  vue. « Satiné » est la vue de toujours : rien n'est gardé pour lui.
- **L'assemblage a son mot à dire.** La pastille d'une ligne de l'assemblage montre ce que la pièce porte **ici** : en
  pointillé, l'apparence de la pièce ; en trait plein, celle que l'assemblage lui donne. Un clic l'ouvre pour **cette
  occurrence seulement** ; la fiche de la pièce (groupe « Apparence ») montre les deux — « Ici » et « La pièce » —,
  et le clic droit propose « Apparence ici… ». Un **sous-assemblage** s'habille d'un seul bloc. La palette en tête de
  la liste habille **tout l'assemblage d'un coup**, et la flèche à côté rend à chaque élément l'apparence de sa pièce.
- **Qui l'emporte** : ce que l'assemblage dit ici couvre l'apparence de la pièce, et l'assemblage du dehors couvre
  celui du dedans — l'usage des modeleurs mécaniques, où une apparence donnée dans un assemblage prend le pas sur
  celle de la pièce. La peinture (couleur ou motif) se prend d'un bloc chez celui qui en donne une ; l'opacité et la
  finition, chacune à part.
- Le motif se voit **partout où la pièce se voit en 3D** : son studio, l'assemblage, les étiquettes, le rapport, et le
  rendu marketing tant qu'aucune finition de rendu n'a été choisie pour elle. Un écran qui colore selon sa propre
  règle (les potentiels de l'Isolation) garde ses couleurs unies. Le STEP, qui ne porte pas de texture, garde la
  couleur de fond du motif.

**Les motifs sont fabriqués par l'outil**, à partir de bruit : quelques couleurs d'un terrain, en taches qui cassent
la silhouette. **Aucun ne reproduit le motif d'une armée ou d'un fabricant** — ce sont des dessins qui ont un
propriétaire ; seuls l'idée et des noms ordinaires sont repris. Une tuile se répète sans couture et se pose par
projection en boîte, une tuile tous les 130 à 170 mm, dans les coordonnées de la pièce : toutes les occurrences d'une
pièce portent le même tissu.

Code : `web/js/core/look_patterns.js` (motifs et finitions, purs), `core/part_look.js` (`overLook` : qui l'emporte),
`core/look_paint.js` (la texture sur une vue), `core/asm_levels.js` (`flatAsm` : à travers les niveaux),
`modules/part_look.js` (un seul sélecteur pour une pièce, une occurrence, tout un assemblage). Vérifié dans Chromium
sur le Rover : un motif puis une finition sur une pièce, sa pastille, la pièce vue dans l'assemblage, « Desert » sur
tout l'assemblage (les trente pièces), un bloc repassé en « Snow » brillant, le menu du clic droit, le retour aux
pièces, Ctrl + Z ; le sous-assemblage lui-même inchangé. Pas vérifié : le rendu marketing avec un motif, à l'œil (la
règle est tenue par un essai) ; les faces courbes de près, où la projection en boîte laisse une couture ; Firefox,
Safari. Pas fait : un motif par corps ou par face ; l'échelle du motif au choix ; un guide (une apparence n'a rien
qui manque ou qui bloque).

C'est une **aide visuelle, pas une finition** : la couleur est gardée dans la pièce (`look`, voir `docs/FORMAT.md`),
elle voyage dans le `.dwiz` et suit la pièce dans l'assemblage, l'isolation et le STEP exporté ; elle ne va sur aucun
dessin, et elle ne touche ni à la revue ni à une révision libérée (la signature de la pièce l'ignore). Elle peint le
corps principal de la pièce ; un corps qui a sa propre couleur (l'isolant d'un busbar, le cuivre d'une carte) la garde.
Code : `web/js/core/part_look.js` (pur, testé), `web/js/modules/part_look.js` (la pastille et le sélecteur).

## Les flèches d'un champ numérique : 1 à la fois, puis plus vite

Demande de JP. Dans **tous** les champs numériques de l'application, les flèches font la même chose, comme l'avance
rapide d'un lecteur vidéo :

- une flèche — à la souris (▲ ▼, au bord droit du champ survolé ou actif) ou au clavier (↑ ↓) — ajoute ou retire **1** ;
- **maintenue**, elle se répète et accélère : ×2 après une seconde, ×5 après 2,2 s, ×10 après 3,6 s ;
- **cliquée vite** (moins de 0,35 s entre deux clics), elle accélère de même : deux clics à chaque vitesse ;
- un **témoin**, juste à côté du champ, dit la vitesse en cours — quatre barres et « ×1 », « ×2 », « ×5 », « ×10 » — et
  s'efface une seconde après le dernier pas ;
- une pause, l'autre flèche ou un autre champ ramènent à ×1 ;
- on **tape** ce que l'on veut : n'importe quelle décimale est acceptée dans n'importe quel champ, et une flèche garde
  les décimales tapées (12,5 devient 13,5) ;
- la valeur reste dans les bornes du champ quand il en a.

Une exception, pour qu'une flèche ne traverse pas le champ d'un coup : un champ dont toute la plage vaut 2 ou moins
(une émissivité de 0 à 1) avance par **dixièmes**. Dans le système impérial, le pas est 1 dans l'unité affichée (un
pouce, un mil).

Comme les flèches d'un navigateur, chaque pas prévient l'écran (`input`) et le relâchement valide (`change`) : aucun
écran n'a rien à déclarer, et un nouveau champ en hérite sans une ligne. Les flèches du navigateur sont masquées ; une
seule paire, posée sur le champ sous le pointeur, sert toute l'application, et suit le champ si l'écran le déplace
pendant le maintien. Code : `web/js/core/stepper.js` (vitesses et valeur d'un pas : purs, testés ; le reste est
vérifié dans un navigateur), styles dans `web/css/app.css`. Un champ peut s'en exclure par `data-no-stepper`.

Pas encore essayé sur un écran tactile ; la molette de la souris ne change pas une valeur.

## Une opération longue dit où elle en est, et s'annule

Demande de JP, après un assemblage resté sur « Construction 1 / 24 » sans autre signe de vie : c'était le noyau
géométrique — 23 Mo, téléchargés une fois par session — qui arrivait lentement, pendant que la barre du haut disait
« Prêt ». Désormais, toute opération qui peut durer montre le même **voile** :

- **ce qui se fait**, dans ses mots (« Construction 5 / 24 : RVR-2200-04 », « Mesure des chemins 3 / 6 ») ;
- **une ligne de progression** : la part faite quand elle se compte, une barre qui défile quand elle ne se compte pas ;
- pendant l'arrivée du noyau, **ses octets** — « Chargement du noyau CAO — 8,4 / 23 Mo, une seule fois » — et la barre
  est alors la sienne : c'est lui que l'on attend ;
- **le temps écoulé**, dès trois secondes ;
- après quinze secondes sans rien de neuf, **un mot** : le téléchargement n'avance plus (connexion, VPN), ou
  l'opération est plus longue que prévu ;
- un bouton **Annuler**. L'opération s'arrête tout de suite ; le voile dit ce qui n'a pas été fait et offre
  **Reprendre**. Rien ne repart tout seul.

Où : la construction d'une pièce et d'un assemblage, la recherche d'interférences, la construction et l'analyse de
l'isolation, la géométrie et la résolution d'une simulation, la projection d'un dessin, le placement et le routage
d'une carte, le **bilan DFx de tout le projet** (« DFM 7 / 25 »), le **dossier de revue** (ses trois temps : analyses,
images, dessins, chacun avec son compte) et le **chargement d'un projet** — depuis l'accueil ou depuis Google Drive.
Annuler une opération du noyau l'arrête pour de bon (le noyau repart à la demande suivante, depuis le cache du
navigateur) ; annuler un routage ou une analyse laisse le projet tel qu'il était ; annuler une ouverture laisse en
main le projet en cours.

Une exception voulue : **l'écriture d'un projet dans Drive ne s'annule pas** — un projet à moitié écrit serait pire
qu'une attente. Le voile dit alors ce qui se passe et depuis quand, et, si Drive tarde, de laisser finir.

La barre du haut ne dit plus « Prêt » en changeant d'écran tant que le noyau arrive.

**Les exports aussi** (v0.80.0). Un fichier qui s'écrit peut durer autant qu'une construction :

- **STEP d'un assemblage** et STEP d'une pièce : le voile de la vue, et Annuler.
- **Dossier de commande**, demande de prix, « Tout télécharger » et chaque fichier d'échange d'une pièce : le voile
  compte les fichiers (« Dossier de commande 4 / 6 : DXF — vues »). Annulé, aucun fichier n'est téléchargé.
- **Ranger la commande dans Drive** : la préparation s'annule ; une fois l'écriture dans Drive commencée, elle va à
  son terme (même exception que pour un projet).
- **Envoi vers Onshape** : la préparation (assemblage, STEP, « Dessin 3 / 6 ») s'annule comme une construction.
  L'envoi lui-même s'arrête **entre deux requêtes** : celle qui est partie finit, rien ne suit, et le résultat dit ce
  qu'Onshape garde déjà — ce qui est créé là-bas y reste — avec « Reprendre l'envoi ».

Après une annulation, le noyau repart de zéro : l'écran reconstruit sa pièce ou son assemblage sans rien demander.

Code : `web/js/core/progress.js` (ce que le voile montre : pur, testé), `web/js/core/busy.js` (le voile),
`vp.setBusy(texte, { done, total, cancel, retry, stopped })` dans une vue 3D, `busyVeil(hôte)` ailleurs ;
`kernel.cancel()` et `kernel.stage()` dans `web/js/cad/client.js` ; le noyau compte ses octets dans
`web/js/cad/occ.js` (`loadKernel`) ; `pageVeil()` pour ce qu'aucun écran ne porte (un projet qui se charge) ;
`store.cancelOpen()` pour renoncer à une ouverture. Un export ou un envoi passe par `underVeil(voile, texte, tâche)`
(`core/busy.js`), posé sur `cancellable` (`core/progress.js`, pur, testé) : la tâche reçoit `say(texte, fait, total)`
pour faire avancer le voile et un `signal` pour s'arrêter entre deux étapes ; `job.signal` arrête `pushToOnshape`.
Sans voile encore : les sorties d'une carte (Gerber, perçage : écrites d'un trait) et la synchronisation d'équipe.

## Les groupes d'un volet se replient, et le volet reste où il était

Demande de JP (18 novembre 2026), dans la Simulation : les « Zones de raffinement » étaient tout en bas du volet de
gauche, sous un long cas de charge ; et chaque valeur entrée ramenait le volet en haut.

**Replier.** Un clic sur le titre d'un groupe le replie : son chevron, qui pointait vers le bas, **pointe à droite**,
et les groupes suivants remontent. Un second clic le rouvre. Alt + clic ne garde que ce groupe ouvert ; le bouton à
double chevron, en tête du volet, replie tout — on ouvre ensuite le seul groupe à modifier — puis déplie tout. Entrée
ou Espace font de même au clavier. Ce qui est replié le reste d'une visite à l'autre (ce navigateur seulement,
`localStorage["dw.fold"]`, par écran, volet et titre).

- Un groupe replié garde son titre et, quand l'écran le sait, **ce qu'il contient** en quelques mots (« 2 conditions »,
  « 1 zone », le nom du matériau) : `data-fold-note` sur la section.
- Un groupe replié qui **attend encore une valeur** (champ qui clignote, ligne « à corriger » ou « à entrer ») le dit :
  son titre passe en ambre. Le guide **rouvre** le groupe où il envoie (`nudge` → `unfoldAround`).
- Un bouton du titre (« + ») fait son travail et rouvre le groupe ; une bascule (l'œil) ne le rouvre pas.
- Aucun écran n'a rien à déclarer : un groupe est une `.side-section` dont le premier enfant est son `h3`. Un écran qui
  dessine ses propres sous-groupes (Appuis, Efforts, Sources… du cas de charge) leur donne `data-fold-key` et la
  classe `fold-head` à leur premier enfant.

**Rester en place.** Un studio redessine tout un volet quand une valeur change. Le volet revient maintenant **où il
était** (jamais plus loin que sa fin, s'il a raccourci), et le curseur **dans le champ** que l'on venait de valider ;
après Tab, dans l'arrêt suivant, comme dans tout formulaire. Rien à déclarer là non plus : un volet est une `.side`, ce
qui défile une `.side-scroll`. Un écran qui veut emmener ailleurs après un changement le fait comme avant (`nudge`).

**Ce que l'on fait reste en haut.** Dans la Simulation, « Lancer la simulation » et la bascule modèle / résultat sont
épinglés en tête du volet de droite (`.side-actions`) : ils ne défilent pas. Le résultat vient ensuite, puis
l'estimation à la main et la méthode — chacun un groupe qui se replie.

Code : `web/js/core/fold.js`, `web/js/core/panel_keep.js` (les moitiés pures sont testées : `tests/node/fold.test.mjs` ;
le reste est vérifié dans Chromium), styles dans `web/css/app.css`. Essayé sur les 23 écrans de l'application : tout
replier, tout déplier, aucune erreur. Pas essayé sur Firefox, Safari ni un écran tactile ; les écrans sans volet à
groupes (Atelier, Itérations, Équipe…) ne changent pas.

## Les marges de gauche et de droite : à glisser, à cacher, sur toutes les pages

*Demande de JP, sur une capture du PCBA : « toutes les marges gauche droite des pages dans l'interface doivent
pouvoir être cachées et redimensionnées, pour plus d'aisance dans la navigation ».*

**Ce que l'on voit.** Entre un volet et le centre, une bordure : on la glisse pour élargir le volet, son bouton le
cache et le ramène (aussi : double clic ou Entrée sur la bordure, flèches ← → pour l'élargir au clavier, Ctrl + B
pour le volet de gauche). La largeur et ce qui est caché sont **les mêmes d'un écran à l'autre**, gardés dans le
navigateur.

**Usage établi.** Les panneaux latéraux des outils de conception et des éditeurs : une séparation que l'on glisse,
un bouton pour replier.

**Ce qui manquait** (v0.123.0). Le mécanisme (`web/js/core/panes.js`) ne se posait que sur un studio enfant direct de
la page : le **PCBA**, dont le studio est sous son propre en-tête, n'avait aucune bordure ; le **Logiciel**, qui
s'ouvre sans volet de droite, n'en recevait pas quand le volet arrivait. Un tour des écrans au robot l'a montré
(treize écrans ont des volets ; deux étaient fautifs). Maintenant un studio reçoit ses bordures **où qu'il soit dans
la page**, et un volet de droite qui apparaît après coup reçoit la sienne.

**Ce qu'un nouvel écran doit faire : rien.** Un `.studio` avec son `aside.side`, et un `aside.side.right` pour le
volet de droite. Un essai tient que tout écran qui a des volets les bâtit dans un studio (`tests/node/panes.test.mjs`).
Non essayé : au toucher ; sous 1100 px de large le volet de droite est caché d'office, comme avant.

## Zoomer ce que montre le centre, et la loupe

Demande de JP (18 novembre 2026), devant une feuille de dessin dont les notes ne se lisaient pas à l'écran.

**Zoom des feuilles.** Le centre de l'écran Dessins zoome : **Ctrl + molette** (ou un pincement) autour du pointeur —
le point de la feuille sous le pointeur y reste —, les boutons **−** et **+** d'une petite barre en haut à droite du
centre (50 % à 800 %, par paliers), un clic sur le pourcentage pour revenir à la largeur (100 %). Une feuille plus
grande que le centre se **glisse** à la souris, ou se fait défiler ; la molette seule défile, comme avant. La barre
reste en place pendant le défilement et revient quand la feuille est retracée ; le zoom tient le temps de la visite de
l'écran. Les vues 3D et la vue d'une carte zoomaient déjà à la molette. Code : `web/js/core/zoom_pane.js`
(`zoomPane(centre)` ; un écran qui montre des feuilles l'appelle une fois).

**Une seule barre pour toute vue qui zoome** (v0.125.0, demande de JP : « redimensionner la vue des blocs aussi, pan,
zoom, ajuster à la fenêtre, loupe. Enlever la loupe dans le menu du top… ça n'a pas d'affaire là »). En haut à droite
d'une feuille de dessin, de la vue d'une carte (PCBA et Labo) et des tuiles du Logiciel : **− · le pourcentage · + ·
Ajuster · Loupe**. Le pourcentage ramène à la taille réelle (100 %) — sur une feuille, à la largeur —, « Ajuster »
fait tout tenir dans la fenêtre. Une vue 3D garde sa barre d'outils, où la loupe a pris sa place à côté de la photo de
la vue. Usage suivi : les contrôles de zoom des outils de dessin et de schéma (moins, pourcentage, plus, ajuster), la
loupe d'une visionneuse de documents. Code : `web/js/core/view_bar.js` (`viewBar`, et les moitiés pures `fitView` /
`zoomView` : le point sous le pointeur reste sous le pointeur) ; une vue qui zoome donne ses fonctions, la barre ne
dessine rien d'autre.

**Les tuiles du Logiciel** se déplacent et se zooment comme la vue d'une carte : la molette zoome autour du pointeur
(15 % à 400 %), un glisser du fond déplace la page (un clic sans glisser ne choisit rien), un glisser d'une tuile la
déplace, comme avant. La page s'ouvre **ajustée** et le reste quand la fenêtre change de taille, tant qu'on ne l'a pas
zoomée ni déplacée.

**Loupe.** Le bouton à loupe de la barre d'une vue l'allume et l'éteint — elle n'est plus dans la barre du haut.
Allumée, une lentille ronde suit le pointeur sur tout artéfact — dessin, carte, schéma, vue 3D — et montre ce qui est
dessous plus gros, du facteur d'un **court curseur** qui apparaît à côté du bouton (× 1,5 à × 8, gardé d'une visite à
l'autre). Le pointeur agit au travers : on clique, on tourne, on fait défiler comme avant. Échap la range ; elle se
range aussi quand on quitte l'écran.

- Un artéfact **vectoriel** (SVG : dessin, carte, schéma) est retracé à l'échelle : il reste net.
- Une vue **peinte en pixels** (les vues 3D) est agrandie telle quelle : pour voir plus, le zoom de la vue fait mieux.
  Ce qu'un écran pose par-dessus une vue 3D (étiquettes, marqueurs) n'est pas dans la lentille.
- Hors d'un artéfact (volets, texte, icônes de moins de 120 × 70 px), la lentille s'efface : la taille de l'affichage
  (menu du compte) grossit le texte.

Code : `web/js/core/loupe.js` ; moitiés pures testées (`tests/node/zoom.test.mjs`), le reste vérifié dans Chromium sur
un dessin, la vue d'une carte, le rendu marketing et les vues 3D de la Simulation et de l'Assemblage. Pas essayé sur
Firefox, Safari ni un écran tactile.

## Le panneau du bas : sa bordure se glisse, son bouton le replie

*Demande de JP (21 novembre 2026) : « une façon de redimensionner le panneau de mesure du bas central ».*

Sous la vue du **Logiciel** (le banc : transport, chronogramme) et du **Labo** (les deux oscilloscopes), le panneau du
bas a une **bordure en haut**, qui s'allume au survol : on la **glisse vers le haut** pour le grandir, la vue du dessus
cède la place — elle garde toujours 140 px. Son bouton **▾** replie le panneau (les commandes qui sont au-dessus de son
contenu restent, comme le transport du banc) ; **▴** le déplie ; un double clic sur la bordure fait de même ; au
clavier, Tab atteint la bordure, ↑ ↓ changent la hauteur de 24 px, Entrée replie. Glisser presque jusqu'en bas le
replie aussi. La hauteur et l'état sont **gardés pour chaque écran** dans le navigateur (`dw.bottom`).

Usage suivi : le panneau du bas d'un outil de développement ou d'un simulateur (console, chronogrammes) — une bordure
qui se glisse, un repli. Code : `mountBottom` de `web/js/core/panes.js` (`clampBottom`, `readBottom`, `writeBottom`,
purs et testés : `tests/node/view_bar.test.mjs`), posé par `core/app.js` sur tout `.bottom-pane` d'un écran. **Un
nouvel écran n'a rien à déclarer** : un `div.bottom-pane` (avec `data-bottom` : le nom sous lequel sa hauteur est
gardée), la partie qui change de hauteur dans un `.bottom-body`, et une vue au-dessus qui cède (`flex: 1 ; min-height:
0`). Essayé dans Chromium (une bordure glissée de 100 px grandit le chronogramme de 240 à 340 px, et les tuiles cèdent
autant) ; pas au toucher.

## Tourner une vue : le pivot se voit, et la vue peut tourner seule

Demande de JP (18 novembre 2026) : en tournant une vue 3D, on ne savait ni autour de quoi elle tournait, ni comment
elle allait tourner. La vue tournait autour de son centre, que rien ne montrait.

- **Le pivot est le point saisi.** La vue tourne autour du point du modèle sous le pointeur au moment de l'appui (le
  centre de la vue si l'on appuie hors du modèle). Ce que l'on tient reste à sa place à l'écran ; le reste tourne
  autour.
- **Trois axes, aucune butée** (retour de JP : « certaines rotations sont bloquées »). La vue tourne autour des deux
  axes de l'écran **et continue par-dessus** : elle passe la verticale et se poursuit, à l'envers, sans s'arrêter. Le
  haut de l'écran est gardé d'un geste au suivant (c'est ce qui manquait : en vue de dessus, la direction du regard ne
  suffit pas à dire où est le haut). « Iso », « Face », « Dessus »… remettent la vue droite.
- **Tourner dans le plan de l'écran est un geste à part entière, et il se voit** (demande de JP, 18 novembre 2026 :
  « je veux la possibilité de tourner dans le plan… ça me gosse »). Ce geste existait, caché derrière Alt + glisser :
  personne ne le trouvait. Maintenant, **un glisser qui part du bord de la vue** tourne l'image autour du centre de la
  vue, comme la main tourne autour de lui — la bande du bord s'allume sous le pointeur, avec son pointeur à elle et un
  mot (« glisser le bord : tourner dans le plan de l'écran »). C'est la « boule virtuelle » des outils 3D : dedans, on
  fait basculer ; dehors, on tourne autour de l'axe du regard. Sous le repère X Y Z, **deux flèches** font la même
  chose par pas de 15° (Maj : 90°, Ctrl : 5°) ; **Alt + ← / →** au clavier ; Alt + glisser reste, de n'importe où.
- **Rotation libre d'office, table tournante au choix.** *Libre* : la pièce suit la main sur les deux axes de
  l'écran, quel que soit son Z — l'orbite usuelle des modeleurs mécaniques ; un cercle de la main fait donc aussi
  rouler un peu l'image, c'est ce que « libre » veut dire. *Table* : le Z du modèle reste vertical, et gauche /
  droite tourne la pièce autour de son Z — vu de dessus, l'image pivote dans son plan XY. L'interrupteur est sous le
  repère X Y Z, à côté des deux flèches ; le choix est gardé d'une visite à l'autre et vaut pour toutes les vues.
- **Les touches fléchées tournent la vue d'un pas** autour de son centre : 15°, 5° avec Ctrl, 90° avec Maj — les pas
  que la page des raccourcis d'Onshape donne pour ses propres flèches (page lue ; ses pages sur la souris et le cube
  de vue n'ont pas pu l'être). Un écran qui pousse un élément avec les flèches (Étiquettes, Circuit flexible) les
  garde tant qu'un élément est choisi.
- **La pièce suit la main, dans les deux sens.** Vers la droite, ce qui est près va à droite ; vers le bas, ce qui est
  près descend (l'œil monte, on voit davantage le dessus) — à l'envers aussi, où le sens de la rotation autour de Z
  est retourné pour que la pièce suive encore la main. La bascule verticale allait jusque-là à l'inverse de la main :
  elle a été remise dans le sens de l'orbite usuelle des outils 3D.
- **Un repère pendant le geste**, posé sur le pivot : le point, l'axe Z en pointillé **tel qu'il se présente à
  l'écran** (penché si la vue a roulé, vers le bas si elle est à l'envers), un anneau avec un arc et une flèche pour
  la rotation autour de Z, un second (orange) pour l'inclinaison, un cercle (vert) pour le tour dans le plan, et les
  angles parcourus depuis l'appui (« Z 73° · incl. 34° · plan 12° »). En rotation libre il n'y a pas d'axe Z à
  montrer : l'anneau est celui de l'écran (« ↔ 73° · ↕ 34° »). Il disparaît au relâchement.
- **Rotation automatique.** Le bouton tenu sans bouger : après un tiers de seconde le pivot se montre et un cercle se
  remplit ; à **deux secondes**, un petit panneau s'ouvre près du pivot — quatre flèches pour le sens (gauche, droite,
  haut, bas), deux pour le roulis, un carré pour arrêter, trois vitesses (lente 9°/s, moyenne 27°/s, rapide 72°/s, la
  dernière choisie est gardée). Rien ne tourne avant qu'un sens soit choisi. Échap, la croix ou un nouveau geste dans
  la vue y mettent fin. Le relâchement qui suit l'appui tenu n'est pas un clic.
- **Les sens se combinent** (demande de JP : « une combinaison des 2 axes orthogonaux… les 2 flèches tournent en même
  temps »). Chaque axe a son interrupteur — ◀ ▶ autour du Z du modèle, ▲ ▼ la bascule, ↺ ↻ le roulis : une flèche
  choisie s'allume **sans éteindre celles des autres axes**, la même une seconde fois arrête son axe, la flèche
  opposée la remplace, ■ arrête tout. Deux ou trois axes vont donc ensemble, chacun à la vitesse choisie : la pièce
  tourne sur son Z pendant que l'œil passe par-dessus, et roule si on le demande. Dans le repère, **chaque axe qui
  tourne a sa flèche qui fait le tour de son anneau** (bleu, orange, vert), et la note dit les sens et la vitesse
  (« Z ▶ + ▲ · 9 °/s »). Seule, la rotation autour de Z garde le sens pris au départ : elle ne se retourne pas quand
  la vue passe par-dessus le haut (à la main, c'est l'inverse qui est voulu : la pièce suit la main). Choix maison :
  aucun usage établi n'a été trouvé pour une rotation automatique à plusieurs axes.
- Un écran qui attend un clic dans la vue (outil armé du Part Studio, endroit à pointer dans la Simulation, mesure)
  garde l'appui tenu pour lui : pas de rotation automatique pendant ce temps. Le déplacement (clic droit ou Maj +
  glisser), le zoom à la molette, le clic et le menu du clic droit sont inchangés.

Code : `web/js/core/view_orbit.js` (la géométrie est pure et testée : `tests/node/view_orbit.test.mjs`), branché dans
`web/js/core/viewer.js` — toutes les vues 3D en héritent. Vérifié dans Chromium sur l'assemblage de la démonstration,
dont la vue de dessus (rotation dans le plan, inclinaison dans les deux sens), le passage par-dessus et le roulis ;
la rotation automatique à deux et trois sens, son passage par-dessus le haut sans retour en arrière, et l'arrêt.
Depuis la v0.95.0, vérifié dans Chromium sur le Part Studio, l'Assemblage, la Simulation, l'Isolation, l'Atelier et
les Étiquettes : la bande du bord qui s'allume, l'image qui suit la main autour du centre (30° de main, 30° d'image),
les deux flèches, l'orbite libre depuis une vue couchée, la table tournante et son maintien après rechargement, les
touches (15°, 5°, 90°, Alt), un outil armé qui garde le bord pour lui, une étiquette choisie qui garde ses flèches.
Pas essayé au toucher (l'appui tenu et le bord y sont laissés au système), ni sur Firefox et Safari.

## Tourner une pièce posée : une poignée dans la vue

Demande de JP (18 novembre 2026), en même temps que la rotation de la vue : « tourner une pièce elle-même… avec une
poignée dans la vue, au lieu de taper un angle ». Jusque-là une pièce d'assemblage n'avait pas d'angle du tout à
régler, sauf le bouton « 90° » d'un accouplement.

- **La pièce choisie porte un anneau orange et une poignée ronde.** L'anneau est dans le plan où elle peut tourner ;
  un trait pointillé montre l'axe. La poignée se pose sur la partie de l'anneau que la vue montre.
- **Ce que « tourner » veut dire dépend de ce qui tient la pièce**, et la poignée le dit dans son info-bulle :
  *posée à la main* (la pièce fixe, ou une pièce qu'aucun accouplement n'atteint) — elle tourne autour de la
  verticale, par le milieu de sa boîte, et sa position est réécrite ; *tenue par un accouplement* — elle tourne
  autour de la normale de cet accouplement, et c'est **l'angle de l'accouplement** qui change. Un sous-assemblage
  tourne d'un seul bloc, de l'une ou l'autre façon.
- **Glisser la poignée** fait tourner la pièce comme la main tourne autour de l'axe : **5° par cran**, 15° avec Maj,
  libre avec Alt. L'arc parcouru et l'angle (« −45° ») se montrent. **Ce qui tient à la pièce suit, en direct** :
  l'assemblage est résolu de nouveau à chaque cran, l'aperçu est donc exactement ce que le relâchement laissera.
- **Relâcher** écrit le changement en **une étape annulable**, nommée (« Couvercle tournée de −45° sur
  l'accouplement M3 »). **Échap** pendant le geste abandonne : rien n'est écrit.
- **Au clavier**, la poignée est un curseur : ← → un cran, Maj : 15°, Alt : 1° ; elle garde le focus d'un cran au
  suivant. **Dans la fiche** de la pièce, le groupe « Orientation » donne le même angle en nombre, pour une valeur
  exacte (champ numérique ordinaire : flèches à vitesse progressive).
- L'anneau quitte la vue quand la fiche montre autre chose (accouplements, nomenclature, gamme).

Code : `web/js/core/asm_turn.js` (pur : `turnOf`, `withTurn`, `applyTurn`, la géométrie de l'anneau),
`web/js/modules/asm_turn.js` (la poignée, la fiche). Vérifié dans Chromium sur le variateur : le couvercle tourné sur
son accouplement (aperçu, écriture, masse inchangée), Échap, le clavier, le nombre tapé, Ctrl + Z ; une pièce posée à
côté, tournée sur place autour de Z et ramenée à zéro au centième ; la poignée replacée quand la pièce est au bord de
la vue. Pas vérifié : le toucher ; un motif de vis lié, que l'angle peut désaligner (la santé des accouplements le
dira, l'outil ne l'empêche pas) ; Firefox et Safari.

## Ce qui est nouveau se voit, le temps d'une revue

L'outil change vite ; la personne qui le relit doit trouver ce qui a changé sans le chercher (demande de JP : « tague-moi
ce qui est nouveau dans l'interface entre les versions… quand on passe à une nouvelle revue seulement cache les tags,
sinon laisse-les actifs, pour la traçabilité et faciliter les checks croisés »).

- **Chaque version déclare ses lignes** dans `web/js/core/whats_new.js` (`NEWS`) : ce qui est nouveau, en une phrase, sur
  quel écran (`where`), et sur **quel élément** de cet écran (`sel`, un sélecteur). Un essai tient que la version qui tourne
  a ses lignes, et que l'élément désigné existe dans le code.
- **L'élément porte une marque** « Nouveau » (`core/whats_new_ui.js`, installé une fois). Les marques vivent dans un seul
  calque au-dessus de la page, placées d'après la position des éléments : rien n'est ajouté dans un écran, aucune mise en
  page ne bouge, un écran ne déclare rien. Une marque ne se montre que si son élément se voit — pas sous une boîte de
  dialogue, pas hors du défilement.
- **Le bouton à l'étoile** de la barre du haut dit combien de lignes restent et ouvre leur liste : « Montrer » mène à
  l'élément, la case coche la ligne.
- **Une ligne cochée garde sa marque**, qui passe au vert et dit « Vu » : c'est la trace de la revue. Rien ne disparaît
  parce qu'on l'a regardé.
- **Seul « Passer à une nouvelle revue » range les marques** : la version de départ de la revue devient la version qui
  tourne, et la version suivante apportera les siennes. La revue rangée est gardée, avec ses coches, et se rouvre du même
  endroit.
- Une première revue remonte de quatre versions. La revue est gardée dans le navigateur, comme les unités.
- **Usage suivi** : la pastille « nouveau » d'une application après une mise à jour, et la liste de contrôle d'une revue.
  Ce qui est propre à l'outil : la marque qui reste une fois vue.
- **Non essayé** : au toucher ; une revue partagée entre deux postes (elle est locale au navigateur).

## Les noms du métier : la carte nue, la carte assemblée

D'une maison à l'autre, la même carte ne porte pas le même nom. L'outil dit **PCB** pour la carte nue et **PCBA** pour la
carte assemblée — l'usage courant. Le menu du compte, « Noms du métier (carte) », en propose trois autres : **PWB · CCA**
(fréquent en aérospatiale et en défense), **PWB · PWA** (plus ancien), et **« Vos mots »**, deux champs pour les mots de la
maison.

- **Un seul endroit** : `nameBoards(texte)` de `web/js/core/board_names.js`. Les écrans sont traduits au moment où ils sont
  dessinés (`core/board_names_ui.js`, installé une fois : le texte d'un élément, son infobulle, son nom accessible) — un
  écran ne déclare rien, un nouvel écran suit sans le savoir. Les documents Word et PDF le sont au moment où ils sont écrits.
- **Ce qui ne change pas, exprès** : les identifiants (`DRV-CTRL-PCBA`), les noms de fichiers, le `.dwiz` et le JSON d'un
  artéfact, les consignes à copier, les fichiers de fabrication, et ce que l'on est en train de taper. Ce sont des données.
- **Revenir au choix d'avant** rend le texte tel qu'il a été écrit : chaque texte traduit garde son original.
- **Ce qui a été lu** : des pages de fabricants de cartes ; la norme de terminologie IPC-T-50 ne l'a pas été. « ECB / ECBA »
  n'a été trouvé nulle part comme terme établi — « Vos mots » le permet sans que l'outil l'affirme.
- **Non essayé** : un mot de la maison plus long que la place d'un onglet ; les fichiers texte (CSV, notes de fabrication),
  qui gardent PCB et PCBA.

## Sur quoi l'interface s'appuie

Question de JP (18 novembre 2026) : crée-t-on une interface nouvelle, ou s'appuie-t-on sur ce qui existe ?

- L'application est **écrite à la main** : c'est la règle du projet (modules ES, aucun outil de construction, aucune
  dépendance npm, aucune ressource externe). Il n'y a ni bibliothèque de composants ni système de design extérieur.
  Le seul moteur repris est three.js, pour le rendu 3D ; la navigation dans une vue est écrite ici, pas reprise de ses
  contrôles d'orbite.
- Jusqu'ici, l'ergonomie s'est faite **demande par demande** : replier un groupe, garder un volet en place, zoomer une
  feuille, montrer un pivot sont des usages établis, redécouverts un à un. Le robot `tools/ergo_audit.mjs` mesure des
  boîtes ; il ne dit pas si un geste suit l'usage.
- Désormais (règle « Conventions établies d'abord » de `CLAUDE.md`) : avant d'écrire une interaction, on nomme l'usage
  établi qu'elle suit — les modeleurs mécaniques pour une vue 3D, les modèles d'interaction du web (rôles, clavier,
  focus) pour un contrôle — et on s'y tient ; on n'invente que là où il n'y en a pas, en le disant.
- Deux plugins officiels d'Anthropic existent pour cela et ne sont pas liés aux séances : « frontend-design » (mise en
  œuvre d'interfaces) et « Design » (critique de design, revue d'accessibilité, textes d'interface). Une fois ajoutés
  par JP, une passe de critique précède chaque livraison d'écran.
- **Ce que le projet prête aux autres** (demande de JP, 18 novembre 2026) : le dossier `skills/ergonomie-ui/` réunit
  ces règles en un skill qu'un autre agent Claude charge de lui-même, et `skills/ergonomie-ui.md` donne le même
  contenu en un seul fichier à joindre à une conversation. Quatre parties : le contrat de travail avec l'agent,
  l'interface honnête, les mécanismes dont tout écran hérite, l'aller-retour IA (recommandé, jamais supposé). Chaque
  règle y dit si c'est un usage établi ou un choix maison. Voir `skills/README.md`.

## La barre du haut : quatre groupes, par discipline

Demande de JP (19 novembre 2026) : « si le menu commence à être peuplé horizontalement, peut-être des drop down
visuels ou flip down, par groupes de modules de conception, par discipline ». L'essai pilote l'avait montré : à
1366 px, les onglets étaient coupés sans que rien ne le dise.

La barre porte l'accueil et **quatre groupes** : **Mécanique** (Atelier, Pièces, Assemblage, Dessins, Physique,
Simulation), **Électronique** (PCB, PCBA, Labo, Isolation), **Logiciel** (les sept étapes du cycle en V, depuis la
v0.128.0 : Exigences, Architecture, Conception, Simulation, Code, Vérification, Livraison), **Produit** (DFx, Revue,
Rapport, Historique, Écosystème). Un clic sur un groupe
fait basculer un panneau de tuiles numérotées, dans l'ordre où l'on conçoit — chacune avec son pictogramme, son nom
et une ligne qui dit ce qu'elle fait. Le groupe de l'écran ouvert est allumé et le nomme : « Électronique · Labo ».

- **Usage suivi** : le bouton de menu du web — le bouton dit qu'il a un panneau et s'il est ouvert (`aria-haspopup`,
  `aria-expanded`), le panneau est un `menu`, les flèches passent d'une tuile à l'autre, Échap ferme et rend le
  curseur au bouton, un clic ailleurs ferme.
- **Choix maison** : le découpage en quatre disciplines et l'ordre des tuiles ; le basculement (« flip ») est un effet,
  coupé quand le système demande moins d'animation.
- Un nouvel écran s'ajoute à un groupe (`NAV` de `web/js/core/app.js`) ; il n'y a plus d'onglet à plat.

Les groupes gardent toujours leur largeur : quand la fenêtre est étroite, c'est le mot d'état des outils (« Prêt »,
« Essai simulé ») qui se raccourcit, et le rappel « Ctrl K » de la baguette s'efface sous 1500 px (il reste dans son
infobulle). Avant cette règle, à 1366 px, la baguette recouvrait le dernier groupe — le robot d'audit ne le voyait
pas, une capture l'a montré.

Essayé dans Chromium à 1280, 1366 et 1600 px (rien n'est coupé ni recouvert, le panneau reste dans la fenêtre), au
clavier ; pas essayé au toucher, ni sur Firefox et Safari.

Fenêtre étroite (mesuré dans Chromium, v0.105.0) : sous 1280 px, les groupes où l'on n'est pas ne gardent que leur
pictogramme et leur chevron — leur nom reste dans la bulle et pour un lecteur d'écran — ; sous 1180 px, le mot d'état du
noyau s'efface. La barre tient ainsi jusqu'à 1100 px sans rien pousser hors de la page ; à 1024 px il reste une
cinquantaine de pixels de défilement horizontal, et c'est dit ici plutôt que caché.

### Le bouton « Annuler » ne bouge pas sous le pointeur

Trouvé en essayant le plan de test du Labo : le voile refaisait ses boutons à chaque ligne de progression, et un clic
sur « Annuler » qui chevauchait deux lignes se perdait (appui sur un bouton, relâchement sur le suivant). Le voile ne
refait plus ses boutons que si leur nature change (`buttons()` de `web/js/core/busy.js`) : toute opération longue en
hérite.

## Une page ouverte annonce la nouvelle version

L'application est une seule page, gardée ouverte des heures : ce qui est publié entre-temps ne l'atteint pas tant
qu'elle n'est pas rechargée. JP a cherché la loupe et le zoom sur une page ouverte avant leur publication. Désormais
la page lit de temps en temps `version.json` (au démarrage, toutes les dix minutes, à chaque retour sur l'onglet) ;
quand la version publiée est plus récente que celle qui tourne, un bouton **« Mettre à jour · v… »** paraît dans la
barre du haut. Un clic : le projet est enregistré s'il ne l'était pas, les fichiers que la page avait chargés sont
redemandés au serveur — pour qu'elle ne revienne pas moitié ancienne, moitié nouvelle —, puis la page se recharge. Sur
le serveur local, la version publiée est celle qui tourne : le bouton ne paraît pas.

Code : `web/js/core/update_check.js` ; `web/version.json` suit `APP_VERSION` (test `tests/node/update.test.mjs`).
Vérifié dans Chromium avec une version publiée simulée ; pas vérifié sur le site publié lui-même (il faut deux
publications successives pour le voir) ni sur Firefox et Safari.

## Ce que l'audit ne voit pas

Il mesure des boîtes, pas le sens : un libellé obscur, un ordre d'actions illogique, une couleur mal choisie, une
fonction introuvable lui échappent. Il ne remplace pas un utilisateur devant l'écran — il lui évite les cailloux.
Rien n'a été mesuré en dessous de 1366 px de large, ni sur un écran tactile.
