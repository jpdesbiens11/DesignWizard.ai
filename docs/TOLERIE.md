# Tôlerie pliée

Une pièce de tôle pliée est une **base plane** dont certains côtés sont **relevés à la presse plieuse**. Dans
DynamiteOrbit elle se décrit par un bloc `folded` du langage de pièce : le noyau construit le solide avec ses vrais
rayons de pliage, la plateforme calcule le **développé à plat** et l'écrit en DXF avec ses lignes de pliage, le DFx
**mesure** les règles de pliage, la gamme enchaîne la découpe du flan et les plis.

C'est le cinquième procédé spécial de l'Atelier, avec le moulage, l'extrusion, la découpe laser de précision et
l'impression 3D (voir [PROCEDES.md](PROCEDES.md)).

> **Valeurs typiques.** Les limites ci-dessous viennent du recueil de règles de tôlerie du projet et de résumés de
> guides publiés. Le développé repose sur un facteur k de départ. Rien ici n'a été confronté à une table de pliage, à un
> devis ou à une pièce réelle : la section 7 dit ce qui a été lu et ce qui ne l'a pas été. **La table de pliage de
> l'atelier fait foi.**

## 1. Le bloc `folded`

```
folded base=[L, W] t=t r=r
  flange +X h=h dir=up
  flange -Y h=12 dir=down
```

En JSON :

```json
"folded": {
  "base": ["L", "W"],
  "t": "t",
  "r": "r",
  "flanges": [ { "side": "+X", "h": "h", "dir": "up" }, { "side": "-Y", "h": 12, "dir": "down" } ],
  "relief": 3.5,
  "k": 0.44
}
```

| Mot | Sens |
|---|---|
| `base` | Longueur et largeur de la base plane. Son coin minimum est à l'origine, son épaisseur va de z = 0 à z = `t`. |
| `t` | Épaisseur de la tôle. |
| `r` | Rayon **intérieur** de pliage, le même pour tous les plis : un seul outil. Par défaut, une épaisseur. |
| `flanges` | Les bords pliés : un par côté de la base (`+X` droite, `-X` gauche, `+Y` arrière, `-Y` avant), à 90°. |
| `h` | Hauteur **extérieure** du bord, mesurée depuis la face de la base opposée au pli. |
| `dir` | `up` : le bord monte ; `down` : il descend. |
| `relief` | Côté de l'entaille carrée là où deux bords pliés se rejoignent. Par défaut `r + t + 0,5`. |
| `k` | Facteur k du développé (position de la fibre neutre dans l'épaisseur). Par défaut 0,44. |

Toutes les valeurs peuvent être des paramètres ou des expressions. Le bloc **remplace** la matière première (`stock`) et
la première opération : le brut est le flan développé, que la plateforme calcule.

**Trous, découpes et interfaces** se déclarent comme pour toute pièce, dans `do` et `interface` :

- sur la **base**, faces `+Z` et `-Z` ; une interface y prend `level=t` (dessus) ou `level=0` (dessous), sinon elle se
  poserait au sommet des bords pliés ;
- sur un **bord plié**, faces `+X`, `-X`, `+Y`, `-Y`, à la position `[le long du bord, z]` ; un trou y prend la
  **profondeur de la tôle** — « traversant » perce aussi le bord d'en face, comme dans tout logiciel de CAO.

## 2. Ce que le noyau construit

- La **base** : une extrusion de son contour, entaillée d'un carré de `relief` à chaque angle que deux bords pliés
  partagent (le dégagement d'angle des tôliers).
- Chaque **bord plié** : une extrusion du profil du pli et de la paroi, avec ses deux vrais arcs — rayon `r` à
  l'intérieur, `r + t` à l'extérieur. Le pli commence à l'arête de la base.

Un seul corps, des volumes exacts (les tests comparent une cornière, un U et un bac à quatre bords au calcul à la main),
un export STEP et FeatureScript sans rien de particulier : ce sont des opérations ordinaires du noyau. Dans Onshape, la
base et les bords sont écrits avec leurs dimensions du jour.

## 3. Le développé à plat

La longueur développée d'un pli à 90° est celle de sa fibre neutre :

```
pli développé = π/2 × (r + k × t)
```

Un bord de hauteur `h` occupe donc, sur le flan, `pli développé + h − (r + t)` au-delà de l'arête de la base. La
**ligne de pliage** est tracée au milieu du pli. Un bac à quatre bords se développe en croix ; une cornière, en
rectangle.

- L'onglet **Développé** de la pièce dessine le flan : ce que le laser coupe en trait plein, les lignes de pliage en
  trait mixte, avec les chiffres du pli et chaque bord.
- L'artéfact **DXF — développé à plat** (`<pièce>_developpe.dxf`) range le contour, les perçages et les découpes sur le
  calque `CUT`, les lignes de pliage sur le calque `BEND` (type de ligne CENTER), et sur le calque `NOTES` le sens,
  l'angle et le rayon de chaque pli, l'épaisseur, la longueur développée d'un pli et le facteur k — avec la mention
  « valeur typique : à corriger par l'atelier ».
- Un trou ou une découpe **dans un pli** n'a pas de place sur le flan : il est signalé, pas dessiné.
- Un trou borgne n'est pas une découpe du flan : c'est une reprise.

Le **brut** de la pièce est ce flan : « Tôle de 1,5 mm, flan développé 89,4 × 50 mm ». La part du flan qui reste dans
la pièce est affichée dans la gamme.

## 4. Ce que le DFx mesure

| Règle | Limite | Mesurée sur | Correctif en un clic |
|---|---|---|---|
| `SM-01` | Rayon intérieur ≥ minimum de la matière (1 × t pour l'aluminium 5052-H32, le cuivre, l'acier, l'inox) | `folded.r` | Oui : porte le rayon au minimum |
| `SM-02` | Hauteur extérieure d'un bord ≥ 4 × t | chaque bord | Oui : porte la hauteur à 4 × t |
| `SM-03` | Bord du trou à 2,5 × t + R d'un pli | chaque trou, sur la base comme sur un bord | Non : c'est au concepteur de déplacer le trou |
| `SM-04` | Bord du trou à 2 × t d'un bord libre | chaque trou | Non |
| `SM-07` | Dégagement d'angle ≥ R + t + 0,5 | `folded.relief`, s'il y a un angle partagé | Oui |

Les règles communes aux tôles s'appliquent aussi : épaisseur en stock (`MAT-01`), trous pas plus petits que
l'épaisseur (`SM-06`), voile entre trous (`SM-05`), largeur des découpes (`SM-08`).

Une pièce de tôle **sans** bloc `folded` mais évidée (`shell`) reste lue comme un bac plié, comme avant : ses règles de
pliage ne sont alors que des rappels, puisque rien ne décrit ses plis.

## 5. L'Atelier

Dans « Pas à pas » (Atelier → Nouvelle pièce), avec une tôle métallique (aluminium 5052-H32, inox, acier, cuivre) et la matière première
« Tôle ou feuille » :

- **cochez les côtés** de la base à relever, ou
- **placez une interface sur un côté** (droite, gauche, avant, arrière) : ce côté devient un bord plié qui la porte.

La pièce s'écrit seule et chaque décision est consignée : épaisseur (1,5 mm par défaut — elle se choisit pour la
tenue, pas pour les vis), un seul rayon (le minimum de la matière), des bords d'au moins 4 × t + r et assez hauts pour
ce qu'ils portent, des trous à 2,5 × t + r des plis, des dégagements aux angles. Une interface d'un bord plié ne perce
que ce bord. Un taraudage dans une tôle mince est signalé : préférer un écrou ou un insert à sertir.

L'écran **Procédés spéciaux → Tôlerie pliée** montre les règles, ce qui a été lu, et copie la fiche pour une IA.

## 6. Gamme, commande, aller-retour IA

- **Gamme** : approvisionner le flan ; découper le développé au laser, perçages compris ; tarauder à plat s'il y a
  lieu ; **plier chaque bord** (sens, rayon, hauteur, longueur de la ligne de pliage) ; ébavurer ; contrôler. La gamme
  détaillée a sa phase « Pliage » au poste « Presse plieuse ». L'ordre des plis est à confirmer par l'atelier.
- **Rapport** : la pièce figure dans la section « Procédés spéciaux ».
- **Aller-retour IA** : le bloc `folded` est dans le fichier `.dwiz` de la pièce et dans la référence du langage que
  reçoit l'IA ; la consigne « Affiner avec Claude » porte les règles de pliage. La pièce modifiée revient par
  la porte « Avec l'IA » de l'Atelier, avec l'aperçu des changements et la validation habituels.
- **Démonstration** : `DRV-FOOT`, une patte de fixation en aluminium 5052-H32 de 1,5 mm à un pli — une variante murale,
  présente dans le projet mais pas dans l'assemblage.

## 7. Ce qui a été lu, ce qui ne l'a pas été

| Sujet | Valeur de la plateforme | Ce qui a été lu |
|---|---|---|
| Rayon intérieur minimum | 1 × t (fiche de la matière) | Recueil de tôlerie du projet. Non relu sur une source pour cette brique. |
| Bord plié minimum | 4 × t | Résumés de guides publiés : la plupart donnent 4 × t ; certains le lient au vé de la presse (environ 0,7 × son ouverture). |
| Trou près d'un pli | 2,5 × t + R | Résumés de guides publiés : 2 × t + R pour un petit trou, 2,5 × t + R, ou 3 × t + R selon le guide. |
| Dégagement d'angle | R + t + 0,5 mm | Recueil de tôlerie du projet. Non relu. |
| Facteur k | 0,44 | Résumés : valeur de départ courante pour l'acier doux plié en l'air ; une convention, à vérifier par des plis d'essai. |
| Vé de la presse | 6 à 8 × t dans la gamme | Résumés : 6 à 12 × t en pliage en l'air ; « 8 × t » est une simplification. |

**Non lu, non vérifié :** aucun guide n'a été lu en entier (seulement des résumés de recherche) ; aucune norme n'a été
consultée ; le facteur k n'est pas distingué par matière ni par rapport rayon / épaisseur ; le retour élastique n'est pas
modélisé ; rien n'a été confronté à une table de pliage, à un devis ou à une pièce pliée.

Pages d'où viennent les résumés (trouvées par recherche, **non lues en entier**) :

- https://protolabs.com/services/sheet-metal-fabrication/design-guidelines
- https://www.thefabricator.com/article/bending/design-tips-for-sheet-metal-bend-relief-small-holes-hole-distortion-near-bends-and-minimum-flange-widths
- https://www.thefabricator.com/article/bending/press-brake-bending-basics-die-angles-tonnage-and-k-factors
- https://www.durmapress.com/sheet-metal-bending-bend-allowance-calculation-guide/
- https://fractory.com/sheet-metal-bending/

## 8. Limites

- Plis à **90°** seulement ; un bord par côté de la base ; pas de pli sur pli (bord tombé double), pas d'ourlet, pas de
  pli en biais ni de pli au milieu de la base.
- Une base **rectangulaire** : un contour de base libre n'est pas dans le bloc (une découpe traversante de la base, si).
- Les découpes d'un bord plié sont reportées au développé si elles sont entièrement hors du pli ; celles qui naissent
  d'une interface ne le sont pas encore.
- Le dégagement d'angle est carré ; les dégagements ronds ou en larme ne sont pas décrits.
- L'ordre des plis et les collisions avec l'outil ne sont pas vérifiés.

## 9. Où est le code

`web/js/cad/family_folded.js` (pur : `foldedFacts`, `compileFolded`, `flatPattern`, `flatPoint`, `flatHoles`,
`holeToBend`, `holeToEdge`, `foldSteps`), `web/js/draw/dxf_folded.js` (`foldedDxf`, `flatCutouts`),
`web/js/analysis/dfx_rules_folded.js` (`checkFolded`), `web/js/core/shop_folded.js` (`foldedSheet`, `foldSides`,
`canFold`, `FOLD_RULES`, `foldBrief`), `web/js/modules/part_fold.js` (onglet « Développé »), la carte et l'écran dans
`web/js/modules/shop_special.js`. Tests : `tests/node/folded.test.mjs`.
