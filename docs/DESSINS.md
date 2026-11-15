# Dessins, cotes et révisions

Le dessin d'une pièce ou d'un assemblage se génère depuis le modèle 3D et les interfaces. Il n'est jamais retouché à la
main : ce qui doit y figurer se décide dans la conception, et dans le volet de gauche de l'écran Dessins.

## La feuille

Format **tabloïd** — 11 × 17 po (431,8 × 279,4 mm, ANSI B), paysage — pour l'écran et pour le PDF vectoriel.

| Zone | Contenu |
|---|---|
| **Bas à gauche** | les notes, toujours : la référence à **ASME Y14.5-2018**, la matière et le procédé, le sens des cotes encadrées, la légende des classes en usage, puis les notes propres à la pièce |
| **Milieu** | les trois vues standard — plan, élévation, profil — à la plus grande échelle normalisée qui tient, centrées dans ce qui reste hors des notes et de la colonne du cartouche |
| **Haut à droite** | le tableau des révisions, puis une petite vue isométrique (illustrative, hors échelle) |
| **Bas à droite** | le cartouche ; au-dessus : pour une pièce, les tolérances géométriques, le tableau des trous et celui des cotes de définition ; pour un assemblage, la **nomenclature** |

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
La coupe prend la rangée de la vue de dessus, à sa droite, à l'échelle de la feuille quand elle tient (sinon à une
échelle plus petite, écrite sous son titre). Le **plan de coupe** est tracé sur la vue de dessus, avec ses flèches dans
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
