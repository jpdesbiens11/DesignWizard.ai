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
45 blocs fournis couvrent la plupart des sous-circuits d'une carte de commande mécatronique basse tension :

- **Raccorder** : bornier d'alimentation, connecteur d'entrées-sorties, liaison carte à carte, embase USB-C,
  connecteur fil à carte ;
- **Protéger** : fusible, MOSFET contre l'inversion, diode TVS, réservoir ; surveillance de l'alimentation ;
- **Alimenter** : régulateur abaisseur, régulateur linéaire, régulateur élévateur, alimentation isolée 1 W,
  référence de tension ;
- **Calculer** : microcontrôleur 32 bits (découplage, quartz, remise à zéro), mémoire de paramètres (EEPROM I²C),
  mémoire flash SPI, horloge temps réel avec pile ;
- **Mesurer** : température par CTN ou par capteur sur la carte, courant par shunt ou par effet Hall (isolé),
  tension du bus, centrale inertielle, entrée tout-ou-rien protégée, entrée isolée par optocoupleur, amplificateur
  et filtre, détection de seuil, entrées de codeur ou de capteurs Hall ;
- **Commander** : demi-pont de puissance, commande de charge côté bas, relais, pont en H pour moteur à courant
  continu, pilote de moteur pas à pas ;
- **Communiquer** : CAN, RS-485, RS-232, LIN, pont USB vers liaison série, isolation de signaux numériques,
  translation de niveaux I²C ;
- **Signaler** : témoin, bouton-poussoir, avertisseur sonore ; **Tester** : connecteur de programmation, points de
  test et mires.

Les blocs **s'agencent comme des briques** : chacun apporte ses nets (`+5V`, `I2C_SCL`, `USB_DP`…) et se raccorde à
ceux qui portent le même nom ; une entrée ou une sortie prend la prochaine broche libre du microcontrôleur
(`AIN0…6`, `DIN0…2`, `DOUT0…3`). Deux blocs qui réclament la même ressource (deux liaisons sur le même port série)
sont signalés par le contrôle électrique.

Chaque bloc **se dimensionne lui-même et l'écrit** comme un calcul à la main : inductance et pont de contre-réaction
du régulateur (séries E6 / E96), résistance de la DEL, shunt et sa puissance, calibre du fusible, échauffement du
régulateur linéaire — qui change de boîtier quand il chaufferait trop.

La **bibliothèque** tient 206 composants génériques (passifs, diodes, transistors, circuits intégrés, capteurs,
relais, connecteurs) sur 65 empreintes : des *classes* de composants au brochage usuel, sans marque ni référence. La
référence exacte se saisit dans la nomenclature ; sa fiche technique fait foi. La bibliothèque **s'enrichit** : un
composant se crée à partir d'un nom de boîtier et d'une liste de broches, et se range dans la carte (`library`).

Un microcontrôleur offre ses broches *à la demande* : la broche CAN_TX ne rejoint un net que lorsqu'un bloc apporte
ce net. Une mesure prend la première entrée analogique libre (AIN0, AIN1…) ; le boîtier 32 broches en offre moins
que le 48 broches (pas de SPI ni de second port série).

### Arbre des fonctions et structure fonctionnelle, à la façon d'une analyse fonctionnelle

- Chaque fonction garde son **numéro pour toujours** (F1, F1.2…) : retirée, elle ne le rend pas.
- L'**arbre** se lit vers la droite « comment ? », vers la gauche « pourquoi ? », de haut en bas « quand ? » ; une
  fonction sans solution y est marquée en rouge.
- La **structure fonctionnelle** se tire de la carte : un bloc est un sous-système, un connecteur est la frontière
  (ce qui entre à gauche, ce qui sort à droite), un net partagé par deux blocs est un **flux** — d'énergie pour une
  alimentation, d'information pour un signal — orienté de la broche qui le pilote vers celles qui l'écoutent.
- Sorties (étape Revue) : fichier **draw.io** modifiable (deux pages), tableau des flux, tableur, texte, JSON, et les
  rapports Word et PDF.

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

- ce que la grille n'a pas pu passer est repris par une **passe de finition** sur une grille deux fois plus fine,
  libre de défaire et de refaire ce que les premières passes ont mis en travers.

Mesuré : la carte de démonstration (63 composants, 35 nets, 60 × 90 mm, 4 couches) se route à **137 liaisons sur
137** en 7 s, 955 mm de pistes, 114 vias, aucun constat au-dessus de la simple remarque. Sur des cartes faites des
nouveaux blocs (90 × 70 mm, 4 couches) : carte USB de 51 composants, 137 liaisons sur 137 ; carte moteur de
65 composants, 138 sur 138 ; carte pas à pas de 42 composants, 102 sur 104 ; cartes de 94 et 106 composants
(150 × 120 mm), 219 sur 222 et 236 sur 250. Ce que le routeur pose est toujours sans défaut d'isolement ; ce qu'il
laisse reste affiché en chevelu, et se termine à la main.

### Tracer à la main

Le routeur propose, le concepteur termine. Dans le layout détaillé, l'outil **« tracer une piste »** :

- un clic sur une pastille (ou sur du cuivre) commence une piste de **son net**, à la largeur de sa classe ;
- chaque clic pose un angle, à 0, 45 ou 90°, accroché au cuivre du net ou à une grille de 0,125 mm ;
- le tronçon sous le curseur est **vert** s'il respecte les règles du net, **rouge** sinon — et ce qui est rouge
  n'est pas posé : la raison s'affiche (« 0,07 mm de la pastille Q1.2 : il en faut 0,2 ») ;
- **V** pose un via et change de couche ; un clic sur du cuivre du même net termine ; Échap annule ; Retour arrière
  retire le dernier point ; la couche et la largeur se changent en cours de tracé ;
- une piste terminée est **une étape annulable**. Le cuivre tracé à la main n'est jamais retiré par le routeur.

Un clic sur une piste ou un via (hors outil de tracé) le sélectionne : net, couche, largeur, longueur, origine
(routeur ou main) ; on le **supprime**, on le **garde** (le routeur n'y touche plus) ou on le rend au routeur ; les
sommets d'une piste sélectionnée se **glissent**, le déplacement étant refusé s'il enfreint une règle. Sur un net
qui a des liaisons ouvertes, « Router ce net » relance le routeur pour lui seul.

### Déplacer un bloc : les pistes suivent

Dans le layout détaillé, on glisse **un composant** ou **un bloc entier** (bascule « Glisser déplace »), et un bloc
se tourne d'un quart de tour depuis le panneau de droite. Le sous-circuit se déplace comme une brique :

- ses pistes et ses vias **internes** — ses propres nets, sa descente vers un plan — le suivent d'une pièce ;
- ce qui le reliait au reste de la carte est retiré jusqu'à la dernière jonction qui sert encore aux autres, puis
  **reposé automatiquement** : seules les liaisons manquantes sont routées, autour du cuivre resté en place ;
- le cuivre d'autres nets sur lequel il se pose est repris de la même façon ; les tronçons devenus inutiles
  (antennes, vias isolés) sont retirés ;
- une position imposée (verrouillée) ne bouge pas ; un déplacement qui sortirait de la carte est refusé ;
- le tout est **une seule étape annulable** (Ctrl+Z).

Mesuré sur la carte de démonstration : le bloc CAN (7 composants) déplacé de 1 mm — 12 pistes et 8 vias suivent,
9 liaisons sont refaites, aucune liaison ouverte, aucune erreur de règle, en moins d'une demi-seconde de calcul.
« Reconnecter » repose les liaisons manquantes sans toucher au reste.

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

**Depuis la v0.112, le jumeau suit la carte de lui-même.** La pièce « pcb » naît au premier composant placé (son
identifiant : celui de la carte suivi de `-PCB`), et reçoit les composants et les nets à chaque changement de la carte,
dans la même étape annulable (`syncTwins` de `web/js/pcba/twin.js`, un crochet du magasin). Elle garde ce qui est à elle :
son contour, son épaisseur, ses zones d'isolation, ses interfaces. Une carte liée à la main à une pièce d'une autre
famille est laissée telle quelle. De la pièce on descend au PCBA, du PCBA on remonte à la pièce (les marches du volet de
gauche). Le bouton ci-dessous reste, pour forcer le report.

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

### Le guide

Le bouton « Guide » de la barre du haut dit ce que la carte demande encore, en quatre niveaux — à corriger, à entrer, à
vérifier, conseil : une fonction sans solution, un brouillon d'IA à relire, des composants à placer, des liaisons à
router, les erreurs du contrôle électrique et des règles de conception. Un clic sur une ligne ouvre l'étape où cela se
règle. Ce que la carte montre d'elle-même se lit depuis n'importe quel écran (« Ailleurs dans le projet ») ; ce que
ses vérifications trouvent, sur son écran (`web/js/pcba/guide.js` ; voir [GUIDAGE.md](GUIDAGE.md)).

### Unités : le mil et le pouce

Avec le système impérial (bouton des préférences), la carte se lit comme le métier la lit en Amérique du Nord :
en **mil** — un millième de pouce, 0,0254 mm — pour les pistes, les isolements, les perçages, les vias, l'empilage et le
vernis, et en **pouces** dès un pouce (le contour, la longueur de cuivre posée). Une piste de 0,15 mm se lit 5,91 mil,
une carte de 60 × 90 mm 2,36 × 3,54 in, une feuille de 35 µm « 1 oz (1,38 mil) ». Les champs suivent : le contour se
tape en pouces ; la largeur d'une piste, l'isolement d'une classe, la position d'un composant et l'épaisseur du vernis
en mil. Constats, livre de règles, gamme de la carte et rapport de revue (aperçu, Word, PDF) disent la même chose.

Ce qui ne change pas : la carte elle-même, gardée en millimètres ; sa **grille** (un composant se cale sur 0,25 mm,
soit 9,84 mil — taper 500 mil pose à 502 mil) ; et tout le **dossier de fabrication** — Gerber, perçage, placement,
netlist, notes — qui part à l'atelier en millimètres. Fonctions : `web/js/pcba/board_units.js` ; voir
[UNITES.md](UNITES.md).

## 8. Aller-retour avec une IA

Le bouton « Confier à l'IA » (étape Revue, et barre du haut sur tout écran) exporte la carte en `.dwiz` avec votre
demande, formulée comme à un technicien. La réponse se colle ; l'écran liste chaque changement ; vous appliquez ou
non, en une étape annulable. Changer les paramètres d'un bloc suffit : ses composants et ses nets sont reconstruits.
Si la réponse **déplace des composants** (seules leurs positions changent), leurs pistes les suivent et leurs
liaisons sont refaites avant l'aperçu : on peut demander « écarte le bloc CAN de 2 mm du connecteur » comme à un
technicien.
Le geste et ses garde-fous sont décrits dans [IA.md](IA.md).

### Et ensuite : le Labo

Le bouton « Labo » de l'en-tête ouvre le laboratoire d'électronique de la carte : chaque bloc sur un banc simulé —
pistes et composants qui s'allument, deux oscilloscopes, fonction de transfert —, et le **plan de test fonctionnel**
à dérouler à la réception de la carte, écrit pour quelqu'un qui apprend. Voir [LABO.md](LABO.md).

## Isolation d'une carte seule

L'écran **Isolation** analyse un assemblage, ou **une carte seule** : le menu « Ce que l'on analyse », en tête du
volet de gauche, liste les cartes (PCBA) puis les assemblages. Depuis le PCBA, la marche « Isolation » y mène ; de
l'Isolation, la marche vers le haut ramène au PCBA.

**Ce qui est mesuré.** La scène est bâtie du document de la carte, sans noyau géométrique
(`web/js/pcba/board_iso.js`) : le stratifié nu avec ses trous, et le **cuivre réel des deux couches externes** —
pastilles, pistes, vias. Le moteur est celui de l'assemblage (`analysis/cc_paths.js`) : la clearance dans l'air, le
creepage sur la surface, d'une face à l'autre par le bord ou par un trou nu.

- **Par potentiel.** Les nets sont regroupés par tension (« 24 V », « 5 V », « 0 V »…) : deux nets à la même tension
  ne se demandent aucune distance, et le verdict d'une paire de potentiels est celui de ses deux nets les plus
  proches — que le résultat nomme, avec la couche. Comparer chaque net à chaque autre demandait plus de trois cents
  paires sur la carte de démonstration ; par potentiel il y en a six, mesurées en une dizaine de secondes.
- **Une tension vient du PCBA.** Elle ne se tape pas dans l'Isolation ; un potentiel se dit seulement alternatif
  (case « AC » : la valeur est alors efficace).
- **Cuivre arrondi.** Un rond est décrit par un polygone qui l'**enveloppe** : une distance mesurée est égale à la
  vraie ou un peu plus courte (moins de 2 % du rayon), jamais plus longue. Quand le chemin est droit sur une couche,
  la distance est ensuite rendue **exacte** par le calcul entre les formes du cuivre, et l'écran le dit.
- **Pastille sans net** : un conducteur flottant, qu'un chemin peut franchir (d1 + d2).
- **« Functional » d'abord.** Sur une carte seule, les paires partent à « Functional » : entre deux nets d'un même
  circuit, aucun essai diélectrique ne fixe la clearance. C'est un **choix de l'outil**, écrit dans le calcul de la
  paire ; la paire qui sépare deux circuits (puissance ↔ commande) se monte à « Basic » ou à « Reinforced », et l'essai
  à 2 U + 1000 V la relève alors.

**Ce qui n'est pas mesuré, et que l'écran dit** (groupe « Ce que cette analyse regarde ») : les couches internes —
entre deux couches, c'est le stratifié qui isole — ; un plan de cuivre sur une couche externe ; les corps des
composants — ce qu'un composant ponte (optocoupleur, transformateur) a les distances de sa propre fiche — ; la vis
d'un trou de fixation, qui se regarde dans l'analyse de l'assemblage. Le cuivre d'une carte ne se voit pas encore
dans l'analyse d'un assemblage : un assemblage sans paire renvoie à la carte.

Le résumé de l'analyse est gardé sur la carte (`board.isolation` : conditions, niveaux, résultats), repris par le
guide du projet et par le rapport. Tests : `tests/node/board_iso.test.mjs`.

## Première carte (exemple du Labo)

Le bouton **Exemple : première carte** du PCBA (et du Labo vide) ajoute la carte la plus simple : une pile bouton CR2032,
deux boutons et deux DEL — chaque bouton allume la sienne, sans microcontrôleur. Elle est bâtie par
`tools/gen_demo_first.mjs` (50 × 34 mm, deux couches, routée, ERC et DRC sans erreur) avec les blocs **Pile** (`battery`)
et **Bouton et témoin** (`push_led`) et des points de test sur la pile et la masse. Ses essais et sa manipulation : voir
`docs/LABO.md` (« La première carte »).

## Carte de CORE (exemple, architecture du projet)

L'exemple « carte de CORE » (bouton **Exemple : carte de CORE** du PCBA) suit l'architecture donnée par le projet le
21 novembre 2026 : un **CORE** est un bloc de 8 cellules 21700 **en parallèle** (1S8P), en deux rangées de 4 ; une
petite carte, **de la taille du dessus du CORE** (92,8 × 46,4 mm), mesure ses 8 températures et sa tension, purge le
bloc sur ordre, et répond au **BMS central** du boîtier par RS-485. Tous les CORE sont posés dans le même sens : **une
seule variante de carte**.

| Fonction | Ce qui la tient sur la carte |
|---|---|
| S'alimenter sur le CORE | B+ et B− arrivent par le **joint du circuit flexible** (`J-FLEX-12`, pas de 1 mm, pastilles soudées), régulateur linéaire 4,2 V → 3,0 V |
| 8 températures | 8 ponts de CTN **déportées** (bloc « CTN », réglage « CTN déportée sur un flex ») : la CTN est sur un rabat du flex, sous les cellules ; le pont et son filtre restent sur la carte |
| La tension du CORE | bloc « Mesure de tension », sur la 9e entrée analogique du microcontrôleur (AIN0…AIN8) |
| Équilibrage passif | bloc « Équilibrage passif » : deux résistances de purge en parallèle, R = 2 V / I (série E24, au-dessus), un MOSFET canal N sur une sortie du microcontrôleur ; 100 mA à 4,2 V par défaut — un exemple |
| Répondre au BMS central | isolateur numérique qui porte la liaison série (réglage « liaison série » : TX et DE vers le bus, RX en retour), transceiver RS-485 **côté bus** (réglage « Côté bus isolé »), deux borniers en chaîne `RS485_A, RS485_B, +5V_ISO, GND_ISO` : **le côté bus est alimenté par le faisceau**, depuis le BMS central |
| Programmer et essayer | SWD, points de test |

Le Labo essaie chaque bloc : le pont d'une CTN déportée donne la même courbe que celui d'une CTN posée sur la carte, et
la purge relève son courant (92 mA attendus à 4,2 V avec deux 91 Ω), le drain en marche et coupé. La fiche
d'interface matériel / logiciel (étape « Revue ») suit chaque signal **à travers la barrière** : TX, RX et DE sont lus
sur les broches du microcontrôleur, côté logique, et la fiche dit par quel canal de l'isolateur chacun passe.

La carte a **4 couches sans plan** : un plan de masse passerait sous la barrière d'isolation. Elle est bâtie par
`tools/gen_demo_core.mjs` (73 composants, 51 nets, tout routé, contrôles électrique et de layout sans erreur) ; essais :
`tests/node/core_board.test.mjs`.

**Ce qui n'est pas fait, et qui est dit.** Les composants sont génériques : aucune référence de microcontrôleur,
d'isolateur ni de transceiver n'est choisie, et aucune fiche n'a été lue pour eux. L'Isolation ne regarde pas encore la
barrière : GND et GND_ISO y sont tous deux au potentiel 0. Le circuit flexible plié en G (le dessus, deux côtés, deux
rabats de 4 CTN), le CORE mécanique et le boîtier ne sont pas encore construits ; le BMS central et sa machine à
états non plus. Les tensions du CORE (3,2–4,2 V) sont des valeurs du projet ; la fiche de la cellule n'a pas été lue.
Rien n'a tourné sur une vraie carte.

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
- Le routeur donne un premier routage : sur une carte dense il laisse quelques liaisons (chiffres au § 3), à tracer
  à la main. Le tracé manuel est simple : pas de « pousser-écarter » des pistes voisines, pas d'arcs.
- Les 26 nouveaux blocs sont vérifiés par le contrôle électrique et par leurs calculs, pas encore sur une carte
  fabriquée ; les constantes propres à une classe de circuit (limite de courant d'un pont en H, gain d'un pilote
  pas à pas) sont typiques : la fiche technique de la référence choisie fait foi.
- Empreintes et prix typiques : la fiche technique et le devis font foi.
