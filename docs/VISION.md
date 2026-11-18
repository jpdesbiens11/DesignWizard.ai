# Vision — réinventer la conception mécatronique, à partir de l'intention

> **DesignWizard.ai by DynamiteAgile™** — libre (MIT), ouvert, bâti brique par brique.

## 0. L'objectif

**Commander en quelques jours des pièces faisables, prototyper la physique du produit, l'essayer au laboratoire —
et fermer la boucle de conception avant de lancer la production** (prototypes, mini-série ou série).

Tout le reste en découle. La plateforme est alignée sur le **DFx** — la conception pour la fabrication, le montage,
l'essai — parce que c'est ce qui rend l'ingénieur et le technicien de conception productifs : une pièce qui n'est
pas fabricable demain matin ne teste rien. Chaque écran répond donc à l'une de ces questions :

| Question | Brique |
|---|---|
| À quoi sert la pièce, à quoi se raccorde-t-elle ? | Intention, Interfaces |
| Peut-on la faire avec ce qu'il y a sur l'étagère, en combien d'opérations ? | Atelier (« Shop » en anglais) |
| La physique fonctionne-t-elle ? | Physique |
| Est-elle fabricable, montable, isolée ? | DFx, Isolation |
| Quand peut-elle être sur le banc d'essai ? | Commande : verdict, délai, dossier pour l'atelier |

## 1. Le constat

Les logiciels de CAO actuels demandent à l'ingénieur de penser comme le logiciel : choisir un plan, tracer une
esquisse, la contraindre, l'extruder, recommencer. Ce sont des raccourcis techniques hérités des années 1990, pas la
façon dont une personne conçoit une pièce. Un artisan, lui, entre dans son atelier avec trois choses en tête :

1. **à quoi la pièce se raccorde** — ses interfaces, leur forme, ce qu'elles doivent tenir, guider ou laisser passer ;
2. **dans quoi elle est faite** — le matériau et la matière première : une plaque, une barre, un tube, un profilé ;
3. **comment il va la faire** — scier, fraiser, percer, tarauder, plier, imprimer.

La forme finale n'est que la conséquence de ces trois décisions. DesignWizard.ai prend ces décisions comme **entrée**
et laisse le logiciel — aidé par l'IA — produire la géométrie, les vérifications et les documents.

## 2. Le principe : l'intention d'abord

| CAO conventionnelle | DesignWizard.ai |
|---|---|
| L'entrée est une esquisse sur un plan | L'entrée est l'**intention** : interfaces, matériau, matière première, procédé |
| L'arbre de construction décrit des opérations géométriques | La **gamme** décrit des opérations d'atelier (débiter, fraiser, percer, tarauder…) |
| Les interfaces sont des conséquences du modèle | Les interfaces sont des **contrats** écrits avant la pièce |
| La fabricabilité est vérifiée à la fin | La pièce **naît fabricable** : elle part d'un brut du commerce et d'outils réels |
| La physique demande un outil d'éléments finis | Des **modèles analytiques reconnus** donnent 80 % de la réponse en une seconde |
| Les contraintes d'assemblage se posent une à une | Les interfaces identiques **s'accouplent seules** et restent liées |
| Format fermé, lié à un éditeur | Un format texte, `.dwiz`, lisible par l'ingénieur, l'atelier et l'IA ; licence MIT |
| La commande est un autre métier, plus tard | Le verdict « prête à commander », le délai et le dossier pour l'atelier sont dans l'outil |

L'IA n'est pas un gadget ajouté à un outil ancien : elle tient le rôle du compagnon d'atelier. On lui décrit le besoin ;
elle propose les interfaces, la matière et la gamme dans un langage que la plateforme construit et vérifie. Tout ce
qu'elle écrit reste lisible et modifiable par un humain, paramètre par paramètre.

## 3. Les briques technologiques

La plateforme se construit par étages. Chaque brique est utile seule, testée, et sert de fondation à la suivante.

| Brique | Nom | Ce qu'elle apporte | État |
|---|---|---|---|
| B0 | **Intention** | Fonction de la pièce, charges, milieu, quantité | Atelier (Shop), étape 1 |
| B1 | **Interfaces** | Contrats typés A/B (boulonnage, appui, ajustement, découpe, rail, broches) | En place |
| B2 | **Matière & procédé** | Matériaux, matière première du commerce, opérations d'atelier, gamme | Atelier (Shop), étapes 3–4 |
| B3 | **Pièce** | Noyau B-Rep (OpenCascade), format `.dwiz`, paramètres intuitifs | En place |
| B4 | **Artéfacts & commande** | STEP, DXF, STL, PDF, FeatureScript ; verdict de commande, délai, dossier pour l'atelier | En place (FeatureScript expérimental) |
| B5 | **Physique & simulation** | Modèles analytiques (poutre, flambage, boulon, écoulement, thermique, conducteur) ; éléments finis simplifiés — structure, thermique et thermo-mécanique — recoupés par le calcul à la main | En place |
| B6 | **Assemblage** | Accouplement automatique des interfaces, dépendances liées, nomenclature | En place |
| B7 | **Isolation & DFx** | Lignes de fuite et distances dans l'air (IEC 60664-1), 133 règles DFM/DFA | En place |
| B8 | **Dessins & rapport** | 2D coté avec GD&T dérivé des interfaces, rapport de revue de conception | En place |
| B9 | **Échange ouvert** | Google Drive (arborescence de projet), Onshape (envoi natif) | Drive en place ; Onshape à valider sur un compte réel |
| B10 | **Carte électronique (PCBA)** | Des fonctions aux Gerber : bibliothèque du métier, blocs dimensionnés, implantation conceptuelle puis détaillée, règles, dossier de fabrication, revue Word et PDF | En place ; dossier à faire relire par un atelier |
| B11 | **Gammes** | Fabrication d'une pièce pas à pas (pour le fournisseur), assemblage d'un produit et d'une carte (pour le prototypage) : phases, outils, contrôles, questions, notes, Word et PDF | En place ; à faire relire par un atelier |

| B12 | **Pièce moulée** | Plastique injecté, métal coulé sous pression ou par gravité : la coque se dessine d'elle-même autour de ce qu'elle contient, avec les règles du mouleur ; couvercle assorti, clips, platine nervurée, dépouille réelle dans le modèle ; livre de règles de fonderie | En place ; à faire relire par un mouliste |
| B13 | **Premier design & revue** | Une description détaillée, une entrevue menée par une IA, un premier design complet (pièces, assemblage, carte, analyses) lu sans être cru ; registre de revue par artéfact, révisions, itération complète | En place ; éprouvé avec des réponses simulées |

Briques suivantes envisagées : tôlerie pliée et mise à plat, tournage, usinage 5 axes (accessibilité d'outil),
soudure ; cinématique d'assemblage ; chaînes de cotes ; faisceaux et micrologiciel liés à la carte ; coût et empreinte.

**L'aller-retour avec une IA est partout** : tout artéfact — pièce, assemblage, carte — s'exporte en `.dwiz` avec une
demande, comme on confie une tâche à un technicien ; la réponse se réimporte, l'écran liste les changements, l'humain
décide. Toute nouvelle brique naît avec cette fonction.

## 4. Le « modèle Linux » : ouvert, en salle blanche

L'objectif est un équivalent **ouvert** des plateformes de CAO en nuage — ce que Linux a été pour Unix : les mêmes
services rendus à l'utilisateur, une réalisation indépendante, un code que chacun peut lire, corriger et étendre.

La méthode suivie est celle de **REA — Reverse Engineer Anything** : un comportement à la fois, sur une cible que l'on
possède ou que l'on est autorisé à étudier, des preuves gardées, une spécification écrite, puis notre propre
implémentation, vérifiée. Son application au projet est décrite dans [REA.md](REA.md).

Règles du projet :

- **Réimplémentation en salle blanche.** On reproduit des *fonctions* et des *comportements* observables et
  documentés publiquement (documentation d'API, normes, manuels, articles), jamais du code, des ressources graphiques
  ou des secrets d'un éditeur. Aucune décompilation de logiciel propriétaire, aucun contournement de protection, aucun
  usage contraire aux conditions d'un service.
- **Formats ouverts d'abord.** STEP (ISO 10303), DXF (spécification publiée, lue par tous les logiciels DWG), STL, PDF,
  SVG, JSON. Le DWG lui-même est un format propriétaire non documenté : la plateforme écrit du DXF, que tout outil DWG
  ouvre.
- **Interopérabilité plutôt que copie.** Avec Onshape, l'échange passe par son API publique et par FeatureScript, son
  langage documenté : une pièce DesignWizard.ai peut se reconstruire nativement dans Onshape, paramètres compris.
- **Noms et marques.** Les noms de produits tiers ne servent qu'à désigner l'interopérabilité. L'identité visuelle
  s'inspire de principes (les carnets de la Renaissance, les premiers principes, la simplicité), jamais du portrait ou
  de la marque de quelqu'un.
- **Tout est texte.** Une pièce, un assemblage, un projet sont des fichiers `.dwiz` (voir [FORMAT.md](FORMAT.md)) :
  une instruction par ligne, comparables dans Git, compris par une IA sans notice. Le JSON en est le jumeau exact.
- **Pas de serveur obligatoire.** L'application est statique ; le calcul se fait dans le navigateur ; les fichiers
  de l'utilisateur restent chez lui (disque local ou son propre Google Drive).

## 5. La physique « à 80 % »

Avant un calcul par éléments finis, un ingénieur d'expérience pose un modèle simple : une poutre encastrée, un
écoulement laminaire dans un tube rond, une résistance thermique en série. Ces modèles ont une solution exacte, des
hypothèses connues et un domaine de validité clair. La brique Physique les rend immédiats :

- chaque modèle répond à **une question** (« La poutre plie-t-elle trop ? », « Le boulon tient-il ? ») ;
- ses entrées sont **reprises de la pièce** (dimensions, matériau) et restent modifiables ;
- le résultat montre le **calcul pas à pas**, les hypothèses, la référence (Roark, Shigley, VDI 2230, Incropera,
  White, IPC-2221) et **avertit** quand on sort du domaine de validité ;
- le verdict rejoint le rapport de revue de conception.

Ce n'est pas un substitut à la validation finale : c'est le moyen de savoir tôt si « la physique derrière marche ».
L'essai en laboratoire sur la pièce commandée confirme le modèle ; le genre de document `test` (plan d'essai :
valeur prévue, valeur mesurée) est réservé dans le format pour fermer cette boucle.

## 5 bis. Commander

Une pièce n'est utile que sur le banc d'essai. Pour chaque pièce, la plateforme dit :

- si elle est **prête à commander** — elle se construit, son matériau et son procédé sont définis, aucune règle DFx
  ne bloque ;
- **en combien de jours ouvrables** un atelier de prototypage rapide la livre, et ce qui rallonge ce délai (brut hors
  série, posages, finition sous-traitée, quantité) ;
- la **voie rapide** quand le procédé visé demande un outillage : imprimer ou usiner le prototype, garder le moule ou
  la filière pour la série ;
- et elle prépare le **dossier de commande** : demande de prix rédigée, STEP, dessin PDF, DXF, STL, gamme et fiche
  `.dwiz` dans une seule archive.

Les délais sont des ordres de grandeur ; le devis de l'atelier fait foi.

## 6. Ce que la plateforme n'est pas (encore)

- Pas un remplaçant complet d'un modeleur généraliste : surfaces libres, grands assemblages (les sous-assemblages sont là,
  voir [SOUS_ASSEMBLAGES.md](SOUS_ASSEMBLAGES.md) ; les produits de centaines de pièces restent à éprouver) viendront
  par briques.
- Pas un outil certifié : les tableaux de normes sont à confirmer contre les éditions officielles ; les propriétés de
  matériaux sont typiques.
- L'envoi vers Onshape et le FeatureScript généré n'ont pas encore été validés sur un compte réel.

## 7. Contribuer

Le dépôt est sous licence MIT. Les retours d'essai, bogues et idées passent par les gabarits de tickets GitHub ;
voir [GUIDE_COLLABORATEURS.md](GUIDE_COLLABORATEURS.md) et [ARCHITECTURE.md](ARCHITECTURE.md). Une nouvelle brique
suit toujours le même contrat : un module pur et testé, un écran, une entrée dans le rapport.
