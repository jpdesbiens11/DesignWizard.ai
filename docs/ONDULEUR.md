# Onduleur de traction — démonstration de principe

Demande de JP (point 7 du plan, 20 novembre 2026) : « une NOUVELLE démonstration, à côté du Rover et de la fusée : boîtier moulé
d'un onduleur triphasé de traction monté par une bride sur le cylindre d'un moteur ; côtés courbes, pans coupés, cavités de
hauteurs différentes ; couvercle embouti à rabats avec joint silicone collé ; petit couvercle dessous ; potting ; connecteurs
(trois AC, DC + / −), filtre, carte de commande, carte de puissance sous les IGBT, IGBT, condensateur de bus, busbars laminés.
S'inspirer des principes d'un onduleur du commerce : aucune marque, aucun dessin copié. »

Accueil → « Onduleur de traction » (`web/js/demo/demo_inverter.js`, `inverterProject()`), assemblage `INV-ASM`, 16 pièces,
21 occurrences.

## Ce que l'on voit, de bas en haut

| Pièce | Ce qu'elle montre |
|---|---|
| Carter du moteur (contexte) | Le cylindre Ø 220 mm et deux paires d'appuis taraudés M8 : il situe l'onduleur, rien de plus. |
| Boîtier moulé (`INV-HOUSING`, A380, die casting) | Un côté courbe sur le moteur, des pans coupés côté connecteurs ; une **selle** qui épouse le cylindre ; quatre pattes de bride ; trois cavités de **hauteurs différentes** — étage de puissance (fond à 118), condensateur (125), filtre (140) ; un passage du busbar dans la paroi ; sous le porte-à-faux, le compartiment AC ; les passages des connecteurs. |
| Carte de puissance, modules IGBT, potting | La carte **sous** les trois modules demi-pont, sur quatre entretoises ; le gel coulé l'enveloppe avec le pied des modules (la masse coulée a les logements de la carte, des modules et des entretoises). |
| Busbar laminé DC + / film / DC − | Trois plaques empilées au-dessus des modules et du condensateur, par le passage de la paroi. |
| Condensateur de bus, filtre CEM, carte de commande | Des enveloppes : le condensateur dans sa cavité, le filtre près des connecteurs DC, la carte de commande en haut de l'étage de puissance. |
| Connecteurs AC ×3, DC ×2 | Des enveloppes génériques avec leur collerette, dans les passages du boîtier. |
| Joint silicone collé, couvercle embouti à rabats | Le cordon sur le plan de joint ; le couvercle en 5052 dont les rabats couvrent le joint. |
| Petit couvercle | Ferme le compartiment AC, dessous, au-delà du moteur. |

## Ce qui est vérifié, ce qui ne l'est pas

Vérifié (`tests/node/inverter.test.mjs`) : chaque pièce se construit sans erreur ; les trois profondeurs des cavités ; la selle
plus bas que le dessus du moteur, le joint sur le plan de joint et le couvercle au-dessus, le petit couvercle sous le porte-à-faux ;
**rien ne traverse rien** (21 occurrences, deux à deux) ; chaque texte des dessins a son anglais ; aucune marque.

**Ce n'est pas un produit** : les cotes sont des exemples d'ordre de grandeur, lues nulle part ; les pièces du commerce sont des
enveloppes génériques ; les dépouilles, rayons et épaisseurs du boîtier sont à reprendre avec le fondeur ; les liaisons AC des
modules aux connecteurs et le refroidissement ne sont pas dessinés ; aucune vis n'est posée. Les cartes se conçoivent dans le PCBA.
