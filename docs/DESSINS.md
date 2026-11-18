# Dessins, cotes et révisions

Le dessin d'une pièce ou d'un assemblage se génère depuis le modèle 3D et les interfaces. Il n'est jamais retouché à la
main : ce qui doit y figurer se décide dans la conception, et dans le volet de gauche de l'écran Dessins.

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
millimètres : une classe SC ou CSC tient d'un système à l'autre. La tolérance générale reste ISO 2768-mK.

## La feuille

Format **tabloïd** — 11 × 17 po (431,8 × 279,4 mm, ANSI B), paysage — pour l'écran et pour le PDF vectoriel.

| Zone | Contenu |
|---|---|
| **Bande du bas** | à gauche les notes, toujours : la référence à **ASME Y14.5-2018**, la matière et le procédé, le sens des bulles, des drapeaux et des cotes encadrées, la légende des classes en usage, puis les notes propres à la pièce ; à droite le **cartouche** |
| **Tout le reste** | les trois vues standard — plan, élévation, profil — à la **plus grande échelle qui tient** : elles prennent la feuille. Seules les rangées de cotes dont la pièce a besoin sont gardées libres autour d'elles |
| **Coin haut à droite** | là où trois vues laissent la feuille vide : le tableau des révisions, une petite vue isométrique (illustrative, hors échelle), le tableau des **tolérances géométriques** et le **tableau des trous** (150 mm de large). La vue de droite passe dessous, ou tout le bloc reste à sa gauche |
| **Feuille 2** | pour une pièce, le tableau des **cotes de définition** que la feuille 1 ne montre pas sur une vue, en colonnes, avec le même cadre et le même cartouche (« 1/2 », « 2/2 ») ; pour un assemblage, la **nomenclature** reste au-dessus du cartouche |

Échelles : 10:1, 5:1, 2:1, 1:1, **1:1,5**, 1:2, 1:2,5, 1:4, 1:5, 1:10, 1:20. Le 1:1,5 et le 1:2,5 sont des échelles
intermédiaires : elles évitent de tomber d'un coup à la moitié quand le 1:1 ne tient pas. La base du boîtier de la
démonstration (160 × 110 × 42 mm) se dessine au 1:1,5 ; elle était au 1:2,5 quand une colonne de tableaux prenait
toute la droite de la feuille.

## Les tolérances géométriques : un drapeau sur l'élément, le même au tableau

Un cadre de tolérance posé loin de la vue ne dit pas ce qu'il contrôle. Chaque tolérance porte donc un **drapeau
hexagonal** — T1, T2… — distinct de la bulle ronde d'une cote :

- **sur la vue**, le drapeau est relié par une **flèche** à ce qu'il contrôle : pour un motif de trous, un trou du
  motif (le plus à l'extérieur ; « 4× » au tableau dit les autres) ; pour une surface — planéité d'un plan de joint,
  d'une plage d'appui — son arête, sur la vue de droite, qui porte le moins de cotes ; pour un passage ou un
  ajustement, son centre dans la vue qui lui fait face. Deux drapeaux ne se posent pas l'un sur l'autre ;
- **au tableau « Tolérances géométriques »** du coin, une ligne par drapeau : le drapeau, le **cadre de tolérance**
  (symbole, zone, modificateur, références), puis ce à quoi il s'applique — le nombre, les **repères des trous**
  (« A1–A4 », les mêmes qu'au tableau des trous et que sur la vue) et le nom de l'interface.

C'est la pratique que la norme admet quand les cadres ne tiennent pas sur les vues : un tableau, avec un repérage sans
équivoque. ASME Y14.5 n'a pas été relue ligne à ligne pour ce point : la forme du drapeau (un hexagone) est un choix de
la plateforme, dit en note sur chaque dessin.

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
- Les tolérances dimensionnelles viennent des tolérances générales (ISO 2768-mK) et des ajustements des interfaces ;
  pas de tolérance saisie cote par cote.
- Une seule coupe, plane, parallèle à une face ; pas de coupe brisée, de demi-coupe ni de vue de détail. Une pièce à
  plusieurs corps est dessinée sans coupe si le noyau ne parvient pas à la couper. Une seule feuille par dessin. Quand les tableaux débordent, la feuille le dit et
  renvoie à la liste des cotes.
- Le dessin natif envoyé à Onshape reste au format A3 ; seul le PDF est en tabloïd.
- Un sous-assemblage dans un assemblage n'est pas encore géré : la structure a un seul niveau.
