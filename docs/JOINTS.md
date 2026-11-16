# Les joints

Une interface est définie **une fois** et portée par **deux pièces** : même type, même clé, mêmes paramètres ; côté A
sur l'une, côté B sur l'autre. C'est ce qui permet à l'assemblage de s'accoupler seul. Un **joint** est une paire
d'interfaces accouplées : il a un numéro, un genre, et ce qui le tient.

## Le registre des joints

Écran Assemblage, onglet Mates → « Joints ». Une ligne par joint :

| Colonne | Contenu |
|---|---|
| N° | `M1`, `M2`… — **gardé pour toujours** : un joint retiré ne rend pas son numéro (`mseq` dans l'assemblage) |
| Joint | Boulonné, Collé, Encliqueté, Emmanché, En appui, Goupillé, Traversant, Guidé |
| Pièces | la pièce et l'interface de chaque côté, la clé partagée |
| Ce qui le tient | tiré des interfaces en parcourant l'assemblage : vis, inserts, écrous, goupilles, colle |
| Procédé | `4 × M3` ; film, plage, colle et préparation d'un collage ; ajustement d'un emmanchement |

« Registre (.csv) » l'écrit pour un tableur. La même visserie et la même colle entrent dans la nomenclature (onglet BOM)
et dans la gamme d'assemblage ([GAMMES.md](GAMMES.md)), avec le couple de serrage ou les étapes de collage.

## Interne ou externe

Une interface **interne** attend sa jumelle sur une autre pièce du projet : tant qu'elle est seule, l'assemblage la
montre « libre », propose la pièce complémentaire, et la règle DFA-02 la signale.

Une interface **externe** (`external` dans le fichier ; case à cocher dans l'Atelier et dans le dialogue d'interface)
regarde ce qui entoure le produit — le châssis du client, un mur, un câble. Elle n'attend aucune pièce du projet : elle
est listée à part (« Interfaces externes »), comme le contrat du produit avec son environnement, et aucune règle ne
cherche son vis-à-vis. Dans un premier design écrit par une IA, une interface sans jumelle qui n'est pas marquée externe
est signalée dans l'aperçu.

## Le joint collé

Type d'interface `bond` (« Je me colle sur… » dans l'Atelier) : deux plages planes de `w × h`.

| Paramètre | Sens |
|---|---|
| `gap` | épaisseur du film de colle, en mm — **tenue par construction**, de l'une des deux façons ci-dessous |
| `lip` | largeur de la lèvre d'appui qui entoure le logement de colle, en mm (3 par défaut) |
| `adhesive` | `epoxy`, `acrylic`, `polyurethane`, `cyanoacrylate`, `silicone`, `tape` — des familles génériques, sans marque |
| `prep` | `degrease`, `abrade`, `primer`, `plasma` |
| `cure` | texte libre ; à défaut, celui de la famille de colle |

Chaque famille porte sa plage usuelle de film, une tenue typique au cisaillement, son maintien et sa polymérisation
(`ADHESIVES` dans `web/js/cad/interfaces.js`) : des ordres de grandeur pour dimensionner, la fiche du produit acheté
fait foi.

### Ce qui tient le film : un logement de colle, ou des plots

Le côté B porte la géométrie. Deux options (`opts`) :

- **`well: true` — le logement de colle** (ce que propose l'Atelier pour un nouveau joint) : une poche de `w × h`,
  profonde de `gap`, entourée d'une **lèvre d'appui** de `lip` mm. L'autre pièce repose sur la lèvre : elle n'écrase pas
  la colle, qui garde son épaisseur et reste contenue. Le plan d'accouplement est la face elle-même. La plage prend
  donc `w + 2 × lip` par `h + 2 × lip` sur la pièce.
- **`pips` — des plots de calage** de la hauteur du film (quatre aux coins, trois en ligne sur une plage étroite) : le
  plan d'accouplement est sur leurs sommets. C'est ce que gardent les pièces écrites avant le logement de colle.

Un ruban double face n'a ni l'un ni l'autre : il est sa propre épaisseur.

**Valeurs d'usage, non recoupées à une norme** : lèvre de 3 mm et plus, logement de 0,2 à 0,4 mm de profondeur —
règle d'atelier donnée par JP. La santé du joint signale une lèvre de moins de 3 mm ; la profondeur est comparée à la
plage usuelle de la famille de colle, la fiche du produit acheté fait foi.

**Le joint suit la face.** Dans un bloc ou une plaque, la poche se creuse dans la face. Sur une **coque moulée**, le
dessus est ouvert : une plage de collage « sur le dessus » monte sur un **massif adossé au grand côté avant**, jusqu'au
plan de joint, évidé par dessous pour ne pas faire de masse (comme les bossages) ; la coque s'agrandit de la profondeur
du massif pour que le volume demandé reste libre. Au fond de la coque (« à l'intérieur ») ou sur une paroi, la poche se
creuse dans la paroi.

Ce que l'outil en tire :

- **la géométrie** : le logement de colle et sa lèvre, ou les plots, dans la pièce du côté B ;
- **l'accouplement** : la pièce collée se pose à `gap` de l'autre — vérifié dans l'assemblage résolu ;
- **la nomenclature** : le volume de colle, film plus 30 % de bourrelet, en mL (un ruban : en cm²) ;
- **la gamme** : préparer les plages, déposer le cordon, appuyer jusqu'en butée sur la lèvre d'appui (ou sur les plots), maintenir, polymériser,
  chacun avec son contrôle ; un film hors de la plage de la colle devient une question à l'atelier.

## La santé des accouplements

Chaque joint porte un verdict (`web/js/core/joint_health.js`), recalculé après chaque montage et chaque recherche
d'interférences :

| Verdict | Quand |
|---|---|
| **Sain** | les deux côtés disent la même chose, la géométrie est d'accord |
| **À vérifier** | les paramètres partagés ont divergé (joint non lié, pièce réimportée) ; deux côtés A ou deux côtés B ; clés différentes ; prise de filet plus courte que la matière ne le demande (acier 1 × d, aluminium et cuivre 1,5 × d, plastique 2 × d) ; filet taillé dans le plastique sans insert ; jeu d'une glissière hors de 0,1 à 0,5 mm par face, rainure de moins de 1 mm, languette posée devant la rainure ; film de colle hors de la plage de sa colle, ou sans plots de calage |
| **Rompu** | une interface a disparu ; les deux interfaces ne sont pas du même genre ; le joint contredit les autres (sur-contraint) ; les deux pièces se traversent |

L'assemblage a aussi son verdict d'ensemble : nombre de joints sains, à vérifier, rompus, interfaces **internes** encore
sans jumelle, pièces qu'aucun joint ne tient. Il s'affiche sous la vue (cliquez-le pour ouvrir le registre), en tête de
l'onglet Mates, sur chaque joint avec ses raisons en clair, dans le registre `.csv` (colonnes « Santé » et « Remarques »)
et dans le rapport. C'est une aide pour régler vite un emboîtement, pas un calcul de tenue.

Une **glissière** (`rail`) s'accouple « retournée » (`flip`) : les deux repères coïncident au lieu de se faire face, la
languette est dans la rainure et affleure le bout du profilé ([EXTRUSION.md](EXTRUSION.md)).

## Boîtier et couvercle

Créer une pièce dans l'Atelier à côté de ses voisines **crée l'assemblage** s'il n'existe pas, et l'accouple. Chaque
montage est suivi d'une recherche d'interférences entre pièces voisines, sans la demander : « aucune interférence » ou le
nombre de volumes communs s'affiche sous la vue.

Un couvercle moulé à clips ([MOULAGE.md](MOULAGE.md)) n'a qu'un joint, le plan de joint : le registre le dit
« Encliqueté », et la gamme écrit « Encliqueter… jusqu'au clic » au lieu de vis à serrer.

## Limites

- La tenue d'un collage n'est pas calculée : la surface et la tenue typique sont données, le calcul et l'essai sur
  éprouvettes restent à faire.
- Pas de rainure de colle, de joint torique ni de cordon de soudure comme types d'interface.
- L'interférence est cherchée jusqu'à 14 pièces ; au-delà, elle se lance à la main.
- Le numéro d'un joint est celui de la liaison (`M…`) : il n'y a pas de numérotation séparée par genre de joint.

## L'arbre des accouplements

Dans le volet de gauche de l'Assemblage, sous les pièces, les accouplements se lisent comme le cas de charge de la
Simulation : un arbre **par état** — rompus d'abord, puis à vérifier, puis sains —, chacun avec son numéro, les deux
pièces qu'il joint et la couleur de son état (rouge, orange, vert).

- Un **clic** sur un accouplement allume ses deux pièces, montre son étiquette sur le modèle et ouvre sa fiche à droite.
- L'**œil d'un état** affiche ou masque ses étiquettes sur le modèle. Ce qui cloche se montre d'office ; ce qui est sain
  reste discret tant qu'on ne le demande pas. Un clic sur une étiquette du modèle sélectionne sa ligne.
- Un accouplement rompu dit pourquoi sous son nom, et le guide de la barre du haut le compte.

Modèle pur : `web/js/core/asm_tree.js` (`mateTree`, `mateLabels`, `MATE_COLORS`) ; dessin : `web/js/modules/asm_tree.js`.

## Un mate, montré

Un clic sur un mate — sa fiche dans l'onglet **Mates**, sa ligne dans l'arbre ou son étiquette sur le modèle — montre
**ce qu'il est**, quelle que soit la nature de l'interface. Le même code sert les neuf types
(`web/js/core/mate_view.js`, pur et testé ; `web/js/modules/asm_mate.js` pour l'écran).

- **Dans la vue 3D** : les deux pièces du joint passent en transparence et ce qui les tient apparaît à sa place —
  chaque vis avec sa tête (posée sur la face, noyée dans son lamage ou fraisée), son insert ou son écrou ; chaque
  goupille à cheval sur le plan de joint, chassée du côté B ; la portée d'un ajustement ; le contour de la zone d'appui,
  du film de colle, de l'ouverture d'un panneau, de la rainure, de la zone soudée ou de la zone de contact. Le repère de
  l'interface et le nom du joint (`M1 — Bolt pattern`) sont posés sur le plan de joint. Un second clic rend aux pièces
  leur aspect.
- **Dans la fiche** : une **coupe schématique** du joint (A au-dessus, B en dessous, ce qui les lie au milieu ; les
  valeurs écrites sont les vraies, les proportions ne le sont pas), les deux côtés nommés — pièce, interface — et le
  tableau de **ce qui définit le joint**.

| Type | Ce que la fiche dit | Ce que la vue montre |
|---|---|---|
| Bolt pattern | Screws (quantité, norme, longueur), Pattern, Side A — clearance hole (jeu, counterbore ou countersink), Side B — thread (tapped hole, heat-set insert, ou clearance hole et hex nut), standoff, Grip, Position tolerance | tête et tige de chaque vis, insert ou écrou |
| Dowel pins | Dowel pins (quantité, norme), Pitch, Side A — slip fit (F7), Side B — press fit (P7), Position tolerance | chaque goupille, à sa profondeur |
| Shaft / bore fit | Fit (Ø et ajustement), Side A — shaft, Side B — bore, Perpendicularity | la portée de l'arbre, le contour de l'alésage |
| Planar contact | Contact area, pad, Flatness | le contour de l'appui |
| Bonded joint | Adhesive, Bond area, Bond line, glue well ou pips, Quantity | le contour du film de colle |
| Panel cut-out | Opening, Side A — panel, Fixing | le contour de l'ouverture |
| Rail | Side A — tongue, Side B — groove (profondeur, jeu), Length | le contour de la rainure |
| Welded or wire-bonded joint | Process, Weld area, Welds ou Wires, Side A — tab, Current | la zone soudée |
| Pressure contact | Form, Contact area, Contact points, Plating, Force, Current | la zone de contact |

Le **côté A** est toujours celui où la vis entre, l'arbre, la languette, le panneau ; le **côté B** le filetage,
l'alésage, la rainure — quel que soit l'ordre dans lequel le mate nomme ses deux pièces.

Ce que cela ne fait pas : la visserie montrée est une **représentation** (cylindres aux cotes de la norme — tête, tige,
insert, écrou —, sans filet ni empreinte) ; elle n'entre ni dans la masse ni dans la recherche d'interférences, et une
tête de vis qui toucherait une troisième pièce n'est pas signalée. La coupe est un schéma, pas une coupe du modèle.
