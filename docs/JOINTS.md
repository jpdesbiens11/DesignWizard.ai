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
