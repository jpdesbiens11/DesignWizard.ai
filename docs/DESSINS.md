# Dessins, cotes et révisions

Le dessin d'une pièce ou d'un assemblage se génère depuis le modèle 3D et les interfaces. Il n'est jamais retouché à la
main : ce qui doit y figurer se décide dans la conception, et dans les volets de l'écran Dessins — à gauche les cotes
et leurs classes ; à droite tout ce que la feuille écrit d'autre (cartouche, tolérances générales, vues de détail,
notes, anglais du dessin).

## La langue du dessin

**Anglais partout** (choix de JP) : tout ce que l'outil écrit sur une feuille — noms des vues (FRONT, TOP, RIGHT,
ISOMETRIC, SECTION A-A), SCALE, cartouche, REVISIONS, NOTES, BILL OF MATERIALS, GEOMETRIC TOLERANCES, HOLE TABLE,
DEFINITION DIMENSIONS, libellés des cotes, descriptions des trous, notes SC / CSC, notes du DXF du développé — est en
anglais, avec le point décimal (2.5 ; échelle 1:1.5). Ce que le projet a écrit (nom de la pièce, noms d'interface, notes
de la pièce, finition) s'écrit **dans son anglais quand le projet l'a donné**, tel qu'il a été tapé sinon ; la note de
confidentialité et la note de la marque sont des phrases fixes (`docs/BRAND.md`). Voir `docs/TERMES.md`.

**L'anglais du dessin.** Le projet garde, une fois, l'anglais de ses propres textes : `project.drawing.words`
`{ texte : anglais }` (`web/js/core/drawing_words.js`, pur et testé). Un texte traduit pour une pièce l'est sur tous les
dessins du projet ; les écrans, eux, gardent le texte tel qu'il a été tapé.

- Écran Dessins, volet de droite, **« Anglais du dessin »** : combien de textes de la feuille ont leur anglais, et un
  dialogue qui les liste — nom, finition, interfaces, paramètres, notes, nom du projet — une ligne chacun. Le bouton
  « = » garde un texte déjà en anglais. Un seul enregistrement, annulable.
- **Aller-retour IA** : « Copier pour une IA » donne la consigne et la liste en JSON ; la réponse collée remplit les
  lignes, que l'on relit avant d'enregistrer. Les clés hors de la liste sont ignorées.
- **Guide** : un conseil dit combien de textes du projet sont encore écrits tels quels sur la feuille en vue.
- Les **projets de démonstration** arrivent avec leur anglais (`web/js/demo/demo_words.js` : variateur, rover, fusée,
  busbars) : leurs dessins sont en anglais d'un bout à l'autre ; un test le garantit. Ces traductions sont proposées
  par l'outil et **n'ont pas été relues par quelqu'un du métier** : `node tools/words_review.mjs <fichier.xlsx>` écrit le
  classeur à faire relire — une feuille par démonstration, chaque texte avec sa nature (nom de pièce, finition,
  interface, paramètre, note), la pièce où il se trouve, son anglais, et deux colonnes jaunes pour la correction et
  une remarque. Les corrections se reportent à la main dans `demo_words.js`.
- Restent tels que tapés : les descriptions du journal des révisions, et le texte des clés du projet (numéros de pièce).

**Unités.** Le dessin suit le choix d'unités (`docs/UNITES.md`) : en SI, des millimètres ; dans le système impérial, des
**pouces** — trois décimales, sans zéro avant le point (`.472`), la note 1 dit que les cotes sont converties du modèle en
millimètres, la case Units dit « in », la masse ajoute les onces ou les livres. Les clés des cotes restent en
millimètres : une classe SC ou CSC tient d'un système à l'autre. Le bloc de tolérances générales a ses valeurs en pouces
(X.XX, X.XXX), les siennes, que le projet entre ou confirme.

## La feuille

Format **tabloïd** — 11 × 17 po (431,8 × 279,4 mm, ANSI B), paysage — pour l'écran et pour le PDF vectoriel.

| Zone | Contenu |
|---|---|
| **Bande du bas** | à gauche les notes : la référence à **ASME Y14.5-2018** et au bloc de tolérances, la matière et le procédé, le sens des bulles, des cadres et des cotes encadrées, la légende des classes en usage — chacune à On ou à Off pour le projet —, puis les notes propres à la pièce ; à droite le **bloc « UNLESS OTHERWISE SPECIFIED »** et le **cartouche** |
| **Tout le reste** | les trois vues standard — plan, élévation, profil — à la **plus grande échelle qui tient** : elles prennent la feuille. Seules les rangées de cotes dont la pièce a besoin sont gardées libres autour d'elles |
| **Coin haut à droite** | là où trois vues laissent la feuille vide : le tableau des révisions, une petite vue isométrique (illustrative, hors échelle) et le **tableau des trous** (150 mm de large). La vue de droite passe dessous, ou tout le bloc reste à sa gauche |
| **Le blanc qui reste** | les **cadres de tolérance**, chacun près de sa feature, et les **vues de détail** |
| **Feuille 2** | pour une pièce, le tableau des **cotes de définition** que la feuille 1 ne montre pas sur une vue, en colonnes, avec le même cadre et le même cartouche (« 1/2 », « 2/2 ») ; pour un assemblage, la **nomenclature** reste au-dessus du cartouche |

Échelles : 10:1, 5:1, 2:1, 1:1, **1:1,5**, 1:2, 1:2,5, 1:4, 1:5, 1:10, 1:20. Le 1:1,5 et le 1:2,5 sont des échelles
intermédiaires : elles évitent de tomber d'un coup à la moitié quand le 1:1 ne tient pas. La base du boîtier de la
démonstration (160 × 110 × 42 mm) se dessine au 1:1,5 ; elle était au 1:2,5 quand une colonne de tableaux prenait
toute la droite de la feuille.

## Le bloc « UNLESS OTHERWISE SPECIFIED »

Demande de JP (21 novembre 2026) : « tolérances générales par défaut = bloc du cartouche ASME ». À gauche du cartouche,
le bloc que portent les dessins nord-américains : l'unité des cotes, la tolérance d'une cote **selon son nombre de
décimales**, celle d'un angle, et la norme de lecture des symboles. Un seul bloc pour tous les dessins du projet
(`project.drawing.uos`, `web/js/draw/uos.js`) ; ISO 2768 reste au choix (une classe pour toutes les cotes sans
tolérance).

| Base | Ce que le bloc écrit (valeurs d'exemple) |
|---|---|
| ASME, en millimètres | X ±0,5 · X.X ±0,2 · X.XX ±0,05 · angles ±0,5° |
| ASME, en pouces | X.XX ±.01 · X.XXX ±.005 · angles ±0,5° |
| ISO 2768 | la classe du projet (mK proposée) · angles |

Ces valeurs sont des **exemples** : elles ne viennent d'aucune norme (chaque entreprise a les siennes). Dans la marge de
droite, leurs champs sont en pointillé et le prochain à entrer clignote ; la feuille écrit en rouge « EXAMPLE VALUES -
TO BE CONFIRMED » sous le bloc ; le guide le dit, et en fait une erreur si le statut dit le dessin émis. Entrer chaque
valeur, ou « Confirmer ces valeurs », en fait celles du projet. Une réponse d'IA peut proposer d'autres valeurs : elles
redeviennent des exemples — une réponse ne confirme jamais le bloc.

En millimètres, les cotes s'écrivent sans zéros inutiles : leur nombre de décimales suit la valeur, pas une intention de
tolérance. Une cote qui demande mieux que le bloc se tolère par son interface (ajustement, cadre de position).

## Les tolérances géométriques : de vrais cadres, sur la feuille

Chaque tolérance que les interfaces donnent est un **cadre de tolérance** (symbole, zone, modificateur, références) posé
sur la feuille, sa **ligne de repère** sur la feature qu'elle contrôle — il n'y a plus de drapeaux T1, T2… ni de
tableau :

- pour un **motif de trous**, la flèche va au trou le plus à l'extérieur ; au-dessus du cadre, « 4X » et les **repères
  des trous** (« A1–A4 », les mêmes qu'au tableau des trous et que sur la vue) ;
- pour une **surface** — planéité d'un plan de joint, d'une plage d'appui — la flèche va à son arête, sur la vue de
  droite de préférence ;
- pour un **passage** : un passage rond reçoit une **position** diamétrale ; un passage d'une autre forme, le **profil
  de sa surface** par rapport à A, B et C, qui le situe, l'oriente et le dimensionne d'un coup — l'usage d'ASME Y14.5
  pour une ouverture non circulaire ;
- pour un ajustement, son centre dans la vue qui lui fait face ; l'ajustement s'écrit sous le cadre.

L'outil pose chaque cadre **là où la feuille est blanche**, au plus près de sa feature (`web/js/draw/sheet_room.js` :
tout ce qui est tracé sur la feuille est noté sur une grille fine, les vues entières) ; la ligne de repère traverse le
moins de traits possible. Si aucun blanc n'est trouvé, le cadre est posé quand même et le guide le dit, à vérifier.
ASME Y14.5 n'a pas été relue ligne à ligne : l'endroit où un cadre est posé est un choix de la plateforme.

## Les vues de détail

Comme dans un modeleur : « **Choisir une zone** » (marge de droite), puis sur une vue de la feuille, appuyez au centre de
la zone, glissez jusqu'au rayon, relâchez — Échap annule. La zone devient une **vue de détail** : DETAIL D, son échelle
sous elle, son cercle en trait mixte et sa lettre sur la vue d'origine (`web/js/draw/detail_view.js`). Les lettres
évitent I, O, Q et celles des références ; l'échelle proposée est la première échelle normalisée au moins deux fois plus
grande que la feuille, et se change sur la ligne du détail.

**Les vues se replacent seules** : un détail prend le blanc le plus proche de sa vue ; quand il n'y en a pas, la feuille
essaie à une ou deux échelles plus petites ; sinon, les vues gardent leur échelle et le détail passe sur une feuille à
part, « DETAIL VIEWS », et le guide le dit. Chaque détail est gardé sur la pièce (`details`), dans le plan de sa vue :
il suit la pièce et l'échelle de la feuille ; il se met à Off, se copie (la copie naît à Off), se retire — chaque
changement une étape annulable.

**Les cotes d'un détail** (JP, 22 novembre, point 5 : « des cotes dans une vue de détail ») : une cote linéaire dont les
deux points tombent dans le cercle d'un détail **se donne sur le détail**, et seulement là — une cote se donne une fois,
là où elle se lit le mieux (ASME Y14.5 ; `dimsInDetail`, `detailRoom`). Les cotes horizontales sous le cercle, les
verticales à sa droite, avec leur bulle et leur classe ; DETAIL D et son échelle passent sous elles. Le détail prend
donc un peu plus de place : il arrive que les vues descendent d'une échelle de plus. Une cote par repère (un rayon) et
une cote qui sort du cercle restent sur la vue d'origine. La ligne du détail, dans la marge de droite, dit combien il
en porte.

**Un détail se déplace à la main** : sur la première feuille, appuyez sur un détail, glissez, relâchez — il reste où on
l'a mis (`place`, sur le détail, ramenée dans le cadre ; `detailMover` de `modules/drawing_sheet_ui.js`), une étape
annulable ; « ↻ » sur sa ligne le remet là où la feuille est blanche. **Les vues projetées ne se déplacent pas** : de
face, de dessus et de droite restent alignées, comme l'usage le veut (ASME Y14.3, ISO 128) — un détail, lui, se place
librement.

**Un dessin d'assemblage a ses vues de détail** (JP, point 5) : le même outil, « Choisir une zone », sur une vue de
l'ensemble ; le détail se pose dans le blanc de toute la feuille — hors des vues, de leurs bulles et cotes, de la vue
isométrique, de la nomenclature, des notes et du cartouche — ou là où on le glisse ; sans place, le guide le dit. Il
est gardé sur l'assemblage (`details`) et voyage dans l'aller-retour IA de la feuille.

## Le cartouche et les textes de la feuille

Dans la marge de droite : le **titre** (le nom de la pièce ou de l'assemblage : le changer ici le change partout), dessiné,
vérifié, approuvé, statut, **date** (vide : la date du jour), **finition** (celle de la pièce), organisation, note de
confidentialité, projection, arêtes cachées, coupe A-A, révision. La matière se choisit dans le studio de la pièce ;
format, unités, masse et échelle sont calculés. Chaque **note générale** que l'outil écrit se met à Off pour tout le
projet (`project.drawing.notesOff`) ; les notes propres à la pièce restent dessous.

Le bouton « IA » confie la feuille entière (`drawing/1`, `web/js/core/ai_more.js`) : cartouche, bloc de tolérances,
notes à Off, anglais des textes, coupe, classes de cotes, vues de détail.

## Chaque cote a sa bulle

`web/js/draw/dim_model.js` dresse la liste de **toutes les cotes que la conception définit**, numérotées une fois pour
toutes tant que la pièce ne change pas :

1. les cotes hors tout — un paramètre de conception qui *est* une cote hors tout lui donne son nom ;
2. pour chaque motif de vis : ses entraxes et la position de son premier trou depuis les bords de référence. Ce sont des
   **cotes de base** (encadrées) : le groupe est tolérancé en position par un seul cadre, `⌖ Ø0,2 Ⓜ | A | B | C`,
   comme le permet ASME Y14.5 ; un motif circulaire donne son diamètre de perçage ;
3. les trous, groupés par face, diamètre et réalisation (`4× Ø 4,5 — débouchant`) ;
4. les **cotes de détail** : chaque paramètre de conception qu'une opération utilise tel quel, coté **là où cette
   opération le montre** (voir ci-dessous) ;
5. les autres paramètres de conception, puis ce que chaque interface définit (largeur d'une plage, diamètre d'un
   ajustement, épaisseur d'une rainure…).

Une cote est dessinée **sur une vue**, hors de la pièce et dans une rangée à elle, tant qu'il reste de la place sur le
côté de la vue ; sinon elle va **au tableau**. Dans les deux cas elle porte une **bulle ronde** avec son numéro, juste
après son texte. Rien n'est oublié : le volet de gauche liste les mêmes cotes, avec le même numéro.

## Les cotes de détail, une à une

`locateParams` lit les opérations de la pièce et situe chaque paramètre qu'une opération emploie **tel quel** :

| Dans la pièce | Sur le dessin |
|---|---|
| la largeur ou la hauteur d'une poche ou d'un relief rectangulaire | une cote sur la vue qui fait face à cette opération, entre ses deux bords |
| sa position écrite « `centre - taille / 2` » | la cote du **centre**, depuis le bord de référence |
| sa position donnée directement | la cote du bord, depuis le bord de référence |
| la paroi d'une coque ouverte vers le haut | l'épaisseur, sur la vue de dessus |
| le rayon des coins d'un contour | `R 6`, par une ligne de repère depuis le coin |
| la taille d'un bloc ajouté | sa longueur et sa largeur sur la vue de dessus, sa hauteur sur la vue de face |

Un paramètre qui n'est atteint qu'à travers une formule (« `H - wall` ») reste au tableau : aucune arête ne le mesure à
elle seule. Les cotes de détail passent **avant** celles des motifs de vis pour les rangées autour des vues — un motif
peut être tabulé comme groupe, ASME Y14.5 le permet. Deux rangées de plus existent pour elles : sous la vue de dessus,
et à droite de la vue de face.

## La coupe A-A

Une pièce qui a quelque chose à l'intérieur — coque, poche, trou, bossage — reçoit une **coupe A-A** : le plan passe en
travers de la longueur, par le milieu ; ce qui est entre l'œil et le plan est retiré ; la **face coupée est hachurée**.
La coupe prend la **rangée de la vue de face**, à droite de la vue de droite, à l'échelle de la feuille : le calcul de
l'échelle lui garde cette place. À défaut, elle se met à droite de la vue de dessus, au besoin à une échelle plus
petite, écrite sous son titre. Le **plan de coupe** est tracé sur la vue de dessus, avec ses flèches dans
le sens du regard et la lettre A.

Dans l'écran Dessins, « Coupe A-A » règle le plan : automatique, en travers de la longueur ou de la largeur avec sa
position en millimètres, ou aucune. Le choix est gardé dans la pièce (`section`) et voyage avec elle.

Côté noyau : `web/js/cad/section_view.js` (`sectionView`, `sectionOf`) coupe le solide et projette ce qui reste ; les
hachures sont dans `web/js/draw/hatch.js`, qui remplit entre les contours sans qu'on ait à lui dire lesquels sont des
trous.

## Classer une cote

Dans le volet de gauche, chaque cote reçoit sa classe (`characteristics` dans le fichier de la pièce) :

| Classe | Sur le dessin |
|---|---|
| Normale | la valeur |
| Référence | la valeur entre parenthèses : `(42)` — à ne pas contrôler |
| **SC** — caractéristique spéciale | un losange et « SC » après la bulle |
| **CSC** — caractéristique spéciale critique | un triangle pointe en bas et « CSC » après la bulle |

Le symbole suit la bulle dans le sens de la cote : il ne recouvre ni le texte ni la pièce. Les notes en donnent la
légende dès qu'une classe est utilisée. Le lien avec l'AMDEC de conception (DFMEA) n'est pas encore fait : la classe se
choisit à la main. Les symboles de caractéristiques spéciales varient d'un client à l'autre ; ceux-ci sont un choix par
défaut.

## Le dessin d'un assemblage

Les pièces posées sont projetées ensemble (arêtes visibles). Chaque pièce de la nomenclature porte une **bulle de
repère** reliée à la pièce par un trait, sur la vue où elle se distingue le mieux ; les bulles se rangent autour de la
vue sans se toucher. La **nomenclature** est posée sur le cartouche : repère, quantité, numéro, désignation, **révision
de chaque pièce**, matière ; la visserie et les consommables suivent. Les cotes hors tout portent leurs petites bulles,
numérotées après les repères : aucun numéro ne sert deux fois sur la feuille.

**Un assemblage qui porte des sous-assemblages liste son niveau** (v0.93) : chaque sous-assemblage est une ligne —
numéro, nom, sa révision, « Sub-assembly, n parts » — et une bulle au milieu du bloc ; ses pièces sont sur son propre
dessin. La visserie listée est celle des joints de ce niveau. Le choix « Nomenclature du dessin » de l'écran permet
de lister plutôt toutes les pièces (« à plat ») ; les notes de la feuille disent ce qu'elle liste. Voir
[SOUS_ASSEMBLAGES.md](SOUS_ASSEMBLAGES.md).

## Révisions : de la pièce à l'assemblage et aux dessins

- Un **dessin porte toujours la révision de ce qu'il dessine**. Son tableau des révisions reprend l'historique de la
  revue (date, raison), et son statut passe à « Revu » quand la révision affichée a été validée.
- La revue fait avancer la révision d'une pièce validée puis modifiée : A → B ([ITERATIONS.md](ITERATIONS.md), écran
  Revue).
- Un **assemblage retient avec quelle révision de chaque pièce il a été revu**. Quand une pièce change, puis passe à la
  révision suivante, tous les assemblages qui l'emploient le disent — « à revalider : BASE rév. A → B » — sans que rien
  n'ait été touché dans l'assemblage lui-même. Le revalider lui donne sa propre révision suivante, avec la raison dans
  son historique.
- **Cas d'emploi** : l'écran Dessins montre, pour chaque pièce, les assemblages qui l'emploient et la révision avec
  laquelle ils ont été revus ; le rapport en donne le tableau complet.

C'est le socle d'une gestion de configuration : pas une base de données à part, mais des faits que le projet porte et
vérifie lui-même.

## Le dessin d'une variante

Une pièce ou un assemblage qui garde des variantes ([VARIANTES.md](VARIANTES.md)) a **un dessin par variante** : le
choix « Variante dessinée » du volet de gauche, ou le bouton de dessin sur la ligne de la variante. La feuille est
tracée d'après une copie — le document n'est pas changé —, le cartouche ajoute « — VARIANT <nom> » au titre, le PDF
porte le nom de la variante. Numéro de pièce, révision et classes de cotes restent ceux du document.

## Limites

- Sont cotés sur vue : les cotes hors tout, les cotes de détail décrites plus haut et, s'il reste de la place, celles des
  motifs de vis ; le reste est tabulé. Pas de cote d'angle ni de chaîne de cotes ; les trous hors motif, les bossages et
  les profils quelconques gardent leurs cotes au tableau.
- Les tolérances dimensionnelles viennent du bloc de tolérances générales et des ajustements des interfaces ; pas de
  tolérance saisie cote par cote.
- Une seule coupe, plane, parallèle à une face ; pas de coupe brisée ni de demi-coupe. Une vue de détail porte les
  cotes linéaires entières de sa zone ; une cote par repère reste sur sa vue ; un détail d'assemblage n'a pas de cote. Une pièce à
  plusieurs corps est dessinée sans coupe si le noyau ne parvient pas à la couper. Quand les tableaux débordent, la feuille le dit et
  renvoie à la liste des cotes.
- Le dessin natif envoyé à Onshape reste au format A3 ; seul le PDF est en tabloïd.
- Un assemblage qui contient des sous-assemblages ([SOUS_ASSEMBLAGES.md](SOUS_ASSEMBLAGES.md)) est dessiné avec toutes ses
  pièces, à plat : pas de ligne « sous-assemblage » dans son tableau, pas de bulle propre au bloc.
