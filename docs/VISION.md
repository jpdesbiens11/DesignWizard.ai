# Vision — réinventer la conception mécatronique, à partir de l'intention

> **DesignWizard.ai by DynamiteAgile™** — libre (MIT), ouvert, bâti brique par brique.

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
| Format fermé, lié à un éditeur | Fichier texte lisible, formats ouverts, licence MIT |

L'IA n'est pas un gadget ajouté à un outil ancien : elle tient le rôle du compagnon d'atelier. On lui décrit le besoin ;
elle propose les interfaces, la matière et la gamme dans un langage que la plateforme construit et vérifie. Tout ce
qu'elle écrit reste lisible et modifiable par un humain, paramètre par paramètre.

## 3. Les briques technologiques

La plateforme se construit par étages. Chaque brique est utile seule, testée, et sert de fondation à la suivante.

| Brique | Nom | Ce qu'elle apporte | État |
|---|---|---|---|
| B0 | **Intention** | Fonction de la pièce, charges, milieu, quantité | Atelier, étape 1 |
| B1 | **Interfaces** | Contrats typés A/B (boulonnage, appui, ajustement, découpe, rail, broches) | En place |
| B2 | **Matière & procédé** | Matériaux, matière première du commerce, opérations d'atelier, gamme | Atelier, étapes 3–4 |
| B3 | **Pièce** | Noyau B-Rep (OpenCascade), langage de pièce `DW part/1`, paramètres intuitifs | En place |
| B4 | **Artéfacts** | STEP, DXF, STL, PDF, FeatureScript — ce que l'industrie échange | En place (FeatureScript expérimental) |
| B5 | **Physique** | Modèles analytiques : poutre, flambage, boulon, écoulement, thermique, conducteur | En place |
| B6 | **Assemblage** | Accouplement automatique des interfaces, dépendances liées, nomenclature | En place |
| B7 | **Isolation & DFx** | Lignes de fuite et distances dans l'air (IEC 60664-1), 110 règles DFM/DFA | En place |
| B8 | **Dessins & rapport** | 2D coté avec GD&T dérivé des interfaces, rapport de revue de conception | En place |
| B9 | **Échange ouvert** | Google Drive (arborescence de projet), Onshape (envoi natif) | Drive en place ; Onshape à valider sur un compte réel |

Briques suivantes envisagées : tôlerie pliée et mise à plat, tournage, usinage 5 axes (accessibilité d'outil),
moulage, soudure ; cinématique d'assemblage ; chaînes de cotes ; schéma électrique lié au PCB ; coût et empreinte.

## 4. Le « modèle Linux » : ouvert, en salle blanche

L'objectif est un équivalent **ouvert** des plateformes de CAO en nuage — ce que Linux a été pour Unix : les mêmes
services rendus à l'utilisateur, une réalisation indépendante, un code que chacun peut lire, corriger et étendre.

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
- **Tout est texte.** Une pièce, un assemblage, une analyse sont des fichiers JSON lisibles, comparables dans Git.
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

## 6. Ce que la plateforme n'est pas (encore)

- Pas un remplaçant complet d'un modeleur généraliste : surfaces libres, tôlerie pliée, grands assemblages viendront
  par briques.
- Pas un outil certifié : les tableaux de normes sont à confirmer contre les éditions officielles ; les propriétés de
  matériaux sont typiques.
- L'envoi vers Onshape et le FeatureScript généré n'ont pas encore été validés sur un compte réel.

## 7. Contribuer

Le dépôt est sous licence MIT. Les retours d'essai, bogues et idées passent par les gabarits de tickets GitHub ;
voir [GUIDE_COLLABORATEURS.md](GUIDE_COLLABORATEURS.md) et [ARCHITECTURE.md](ARCHITECTURE.md). Une nouvelle brique
suit toujours le même contrat : un module pur et testé, un écran, une entrée dans le rapport.
