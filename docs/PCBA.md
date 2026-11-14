# PCBA — une carte électronique conçue à partir de ses fonctions

La brique **PCBA** (onglet PCBA) mène une carte de ce qu'elle doit faire jusqu'au dossier qu'on envoie à l'atelier :
fonctions, blocs de circuit, implantation conceptuelle, layout détaillé, vérifications, fichiers de fabrication,
rapport de revue. Elle vise le prototype rapide d'une carte sur mesure — une carte de contrôle, un petit étage de
puissance — pas la carte dense à quinze couches.

## 1. Le parcours

L'écran dessine le parcours en haut de page ; chaque case dit où en est la carte, et se clique.

| Étape | Ce que l'on décide | Ce que l'outil en tire |
|---|---|---|
| 1. **Fonctions** | ce que la carte doit faire, avec ses critères | l'arbre fonctionnel ; chaque fonction reçoit un bloc |
| 2. **Architecture** | les paramètres de chaque bloc, les nets qui les relient | composants, nets nommés, dimensionnement écrit, contrôle électrique, nomenclature |
| 3. **Implantation** | contour, trous, couches, vernis ; une zone par bloc | empilage, classes de nets, zones sans conflit |
| ◇ Revue préliminaire | le concept est-il le bon ? | rapport Word et PDF |
| 4. **Layout** | où va chaque composant, quel cuivre le relie | placement et routage automatiques, que l'on retouche |
| 5. **Vérifications** | — | règles électriques, règles de conception, DFM / DFA / DFT |
| 6. **Fabrication** | — | Gerber, perçage, placement, nomenclature, netlist, notes ; délai |
| ◇ Revue détaillée | la carte peut-elle partir ? | rapport Word et PDF |

## 2. Fonctions, blocs et bibliothèque du métier

Une **fonction** dit le besoin (« abaisser 24 V vers 5 V, 1 A »), son type (principale, contrainte, technique) et ses
critères avec leur flexibilité (F0 impératif … F3 libre). Un **bloc** est le petit circuit éprouvé qui la remplit. Les
18 blocs fournis couvrent l'électronique de commande basse tension :

- **Raccorder** : bornier d'alimentation, connecteur d'entrées-sorties, liaison carte à carte ;
- **Protéger** : fusible, MOSFET contre l'inversion, diode TVS, réservoir ;
- **Alimenter** : régulateur abaisseur à découpage, régulateur linéaire ;
- **Calculer** : microcontrôleur 32 bits avec découplage, quartz, remise à zéro ;
- **Mesurer** : température par CTN, courant par shunt, tension du bus, centrale inertielle ;
- **Commander** : demi-pont de puissance, commande de charge côté bas ;
- **Communiquer** : CAN, RS-485 ; **Signaler** : témoin ; **Tester** : connecteur de programmation, points de test et mires.

Chaque bloc **se dimensionne lui-même et l'écrit** comme un calcul à la main : inductance et pont de contre-réaction
du régulateur (séries E6 / E96), résistance de la DEL, shunt et sa puissance, calibre du fusible, échauffement du
régulateur linéaire — qui change de boîtier quand il chaufferait trop.

La **bibliothèque** tient 76 composants génériques (passifs, diodes, transistors, circuits intégrés, capteurs,
connecteurs) sur 49 empreintes : des *classes* de composants au brochage usuel, sans marque ni référence. La
référence exacte se saisit dans la nomenclature ; sa fiche technique fait foi. La bibliothèque **s'enrichit** : un
composant se crée à partir d'un nom de boîtier et d'une liste de broches, et se range dans la carte (`library`).

Un microcontrôleur offre ses broches *à la demande* : la broche CAN_TX ne rejoint un net que lorsqu'un bloc apporte
ce net. Une mesure prend la première entrée analogique libre (AIN0, AIN1…).

### Nomenclature des nets

| Forme | Exemple | Sens |
|---|---|---|
| `+<tension>V` | `+24V`, `+3V3` | rail d'alimentation ; le V tient lieu de virgule |
| `GND`, `PGND`, `AGND`, `CHASSIS` | `GND` | masses |
| `<FONCTION>_<SIGNAL>` | `CAN_TX`, `I2C_SCL` | signal entre blocs |
| `…_N` | `RESET_N` | actif à l'état bas |
| `…_H / …_L` | `CAN_H / CAN_L` | paire différentielle |
| `<bloc>_<NOM>` | `B3_SW` | net interne à un bloc |

## 3. Implantation conceptuelle, puis layout détaillé

**Conceptuel** : une zone par bloc. Les blocs qui partagent des nets sont voisins ; un bloc qui porte un composant
imposé par la mécanique reste autour de lui ; les connecteurs vont au bord. Les zones se glissent et se
redimensionnent à la souris.

**Détaillé** : dans chaque zone, le composant principal d'abord, puis ses condensateurs de découplage contre la
broche d'alimentation qu'ils servent, puis le reste ; mires aux coins. Le **routeur** est un routeur en labyrinthe
sur grille de 0,25 mm (A*), sur 2 ou 4 couches, à vias traversants :

- largeur et isolement de la classe du net, élargis d'après IPC-2221 pour son courant et IPC-2221B pour sa tension ;
- une piste se rétrécit pour entrer dans une petite pastille ;
- un net qui possède un **plan** (masse, alimentation) ne reçoit qu'un court tronçon et un via par pastille ;
- quand une liaison est bloquée, il défait ce qui gêne et le refait (« rip-up ») ;
- **chaque liaison est vérifiée au micron contre tout le cuivre avant d'être posée** ;
- le cuivre verrouillé à la main est conservé.

Mesuré : la carte de démonstration (63 composants, 35 nets, 60 × 90 mm, 4 couches) se route à **137 liaisons sur
137** en 7 s, 955 mm de pistes, 114 vias, aucun constat au-dessus de la simple remarque. Une carte de 57 composants
se route à 99 % sur 2 couches comme sur 4.

## 4. Vérifications

- **Contrôle électrique** (11 règles) : fonction sans solution, broche en l'air, alimentation sans source, deux
  sorties reliées, circuit intégré sans découplage, tenue en tension insuffisante.
- **Règles de conception** (29 règles) : court-circuit, isolement, largeur, bord de carte, perçage, couronne, trous
  trop proches, via dans une pastille, liaisons ouvertes, composants superposés ou sous une tête de vis, pont de
  vernis épargne, mires, composants des deux côtés, découplage éloigné, accès de test, haute tension avec ou sans
  vernis. Chaque constat donne la mesure, la limite et l'endroit.

## 5. Dossier de fabrication

| Fichier | Contenu |
|---|---|
| `.GTL` `.G1` `.G2` `.GBL` | cuivre, dessus → dessous (Gerber RS-274X avec attributs X2, nets compris) |
| `.GTS` `.GBS` | ouvertures du vernis épargne |
| `.GTO` `.GBO` | sérigraphie (repères, broche 1, numéro et révision) |
| `.GTP` `.GBP` | pâte à braser |
| `.GKO` | contour |
| `-vernis-*.gbr` | **vernis de tropicalisation** : la zone à vernir, connecteurs, points de test et appuis de vis épargnés |
| `-assemblage-*.gbr` | plan d'assemblage |
| `-PTH.DRL` `-NPTH.DRL` | perçages métallisés et non métallisés (Excellon) |
| `-placement.csv` | pick-and-place |
| `-nomenclature.csv` | nomenclature |
| `-netlist.ipc` `-netlist.csv` | netlist d'essai de la carte nue (IPC-D-356A) et liste des nets |
| `-fabrication.txt` | empilage, finition, perçages, consignes d'assemblage et de vernissage |

Le **jumeau mécanique** reporte les composants (encombrements, hauteurs) et les nets sur la pièce « pcb » de la carte :
elle apparaît telle quelle dans l'assemblage, l'analyse d'isolation et la simulation.

## 6. Revue de conception

Deux rapports, en **Word** (modifiable) et en **PDF** : la revue **préliminaire** (objet, arbre fonctionnel,
architecture et dimensionnement, implantation conceptuelle, nomenclature préliminaire, risques, liste de
vérification) et la revue **détaillée** (en plus : layout, constats des vérifications, matrice de conformité
fonctions → solutions → vérifications, dossier de fabrication). La liste de vérification se remplit d'après les
données. La **structure fonctionnelle** s'exporte seule, en tableur, en texte ou en JSON.

## 7. Si vous venez d'un outil de schéma et de routage classique

Le parcours part des fonctions, mais tout ce qu'un habitué d'un outil ECAD classique (Altium Designer, KiCad…)
cherche est à un clic, dans la barre « Vues classiques » :

| Vous cherchez | Ici |
|---|---|
| l'éditeur de schéma, les feuilles hiérarchiques | **Schéma** : une feuille par bloc, chaque broche avec l'étiquette de son net |
| l'éditeur de carte, le panneau des couches | **Carte et couches** (étape Layout) |
| le gestionnaire d'empilage | **Empilage** |
| les règles de conception, le contrôle des règles | **Règles**, puis Vérifications |
| les classes de nets | **Classes de nets** |
| la nomenclature | **Nomenclature** |
| les sorties de fabrication | **Sorties de fabrication** (étape Fabrication) |

Les fichiers sortent aux extensions que ces outils et les ateliers reconnaissent, et s'y rouvrent pour contrôle.

## 8. Aller-retour avec une IA

Le bouton « Confier à l'IA » (étape Revue, et barre du haut sur tout écran) exporte la carte en `.dwiz` avec votre
demande, formulée comme à un technicien. La réponse se colle ; l'écran liste chaque changement ; vous appliquez ou
non, en une étape annulable. Changer les paramètres d'un bloc suffit : ses composants et ses nets sont reconstruits.
Le geste et ses garde-fous sont décrits dans [IA.md](IA.md).

## 9. Ce qui est vérifié, ce qui ne l'est pas

- **Vérifié par les tests** : bibliothèque et blocs (chaque composant, chaque broche citée), dimensionnements contre
  le calcul à la main, synthèse, placement, routage sans défaut d'isolement, chaque règle provoquée seule, relecture
  de chaque fichier Gerber et Excellon par le lecteur du dépôt, rapports Word (ouverts par une bibliothèque Word
  indépendante et par LibreOffice) et PDF.
- **Non vérifié** : les fichiers n'ont pas encore été ouverts dans un visualiseur Gerber tiers ni envoyés à un
  atelier ; la netlist IPC-D-356A suit le format à colonnes fixes mais n'a pas été validée par un outil d'essai.
  Faites relire le dossier par l'atelier avant la première commande.

## 10. Limites

- Vias traversants seulement ; pas de paires différentielles routées ensemble, pas d'égalisation de longueurs, pas
  de contrôle d'impédance.
- Plans pleins sur une couche entière, sans freins thermiques ; pas de zones de cuivre partielles.
- Composants orientés par quarts de tour.
- Le routeur donne un premier routage : sur une carte dense à 2 couches il laisse des liaisons à reprendre.
- Empreintes et prix typiques : la fiche technique et le devis font foi.
