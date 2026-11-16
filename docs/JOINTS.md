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
| `gap` | épaisseur du film de colle, en mm — **tenue par construction** : le côté B porte des plots de calage de cette hauteur (quatre aux coins, trois en ligne sur une plage étroite), et le plan d'accouplement est sur leurs sommets |
| `adhesive` | `epoxy`, `acrylic`, `polyurethane`, `cyanoacrylate`, `silicone`, `tape` — des familles génériques, sans marque |
| `prep` | `degrease`, `abrade`, `primer`, `plasma` |
| `cure` | texte libre ; à défaut, celui de la famille de colle |

Chaque famille porte sa plage usuelle de film, une tenue typique au cisaillement, son maintien et sa polymérisation
(`ADHESIVES` dans `web/js/cad/interfaces.js`) : des ordres de grandeur pour dimensionner, la fiche du produit acheté
fait foi.

Ce que l'outil en tire :

- **la géométrie** : les plots dans la pièce du côté B ; un ruban double face n'en a pas, il est sa propre épaisseur ;
- **l'accouplement** : la pièce collée se pose à `gap` de l'autre — vérifié dans l'assemblage résolu ;
- **la nomenclature** : le volume de colle, film plus 30 % de bourrelet, en mL (un ruban : en cm²) ;
- **la gamme** : préparer les plages, déposer le cordon, appuyer jusqu'en butée sur les plots, maintenir, polymériser,
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
