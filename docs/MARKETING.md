# Marketing — étiquettes et rendu

Deux briques pour ce que le produit **montre** : ce qui est collé, riveté ou marqué dessus, et l'image que l'on en
tire. Elles vivent sur l'**assemblage** (`labels`, `render`), voyagent dans le fichier `.dwiz` et se retrouvent dans le
rapport.

## Les étiquettes

Écran **Étiquettes** (`Projet → Étiquettes et autocollants…`, route `#/labels/<assemblage>` ; `web/js/core/labels.js`,
`web/js/core/label_raster.js`, `web/js/modules/labels.js`). Une étiquette appartient à un assemblage et se pose sur
**une instance**, sur une **face plane** ou **enroulée sur un cylindre**.

```
label E1 sticker name="Autocollant DesignWizard.ai" inst=coque_centrale w=420 h=120 turn=90
  on p=[101.6, 0, 760] axis=[0, 0, 1] c=[0, 0, 0] r=101.6
  art type=logo text=DesignWizard.ai sub="by DynamiteAgile™" ink="#26323f" paper="#ffffff" shape=round
```

- **Son genre** (`kind`), sur trois tuiles : *autocollant* (vinyle posé à la main), *plaque signalétique* (rivetée ou
  collée), *marquage direct* (gravé ou tampographié, sans épaisseur).
- **Sa taille** en millimètres (`w`, `h`) et sa **rotation** (`turn`, en degrés) : sur un cylindre, 0 se lit autour,
  90 le long de l'axe.
- **Son motif** (`art`), sur trois tuiles : la **marque DesignWizard.ai** (le sigle, et le nom à côté quand
  l'étiquette est assez large), un **texte** (une ligne, une seconde plus petite, ajustées à la largeur), une **image**
  que vous apportez (PNG, JPEG ou SVG, gardée dans le projet). Encre, fond, forme (angles vifs, coins arrondis, bouts
  ronds).
- **Où elle est** (`inst`, `on`) : un point de la surface et sa normale, dans les coordonnées de la pièce ; sur un
  cylindre, l'axe, un point de l'axe et le rayon. La pose se fait **à la souris** : l'étiquette choisie, un clic sur
  une face la pose là ; un clic droit propose d'en créer une à cet endroit. ← → ↑ ↓ la glissent (autour du cylindre et
  le long de son axe), R la tourne de 15°, Suppr la retire.

**Sur un cylindre, l'étiquette est développée sans étirement** : un millimètre du motif est un millimètre d'arc
(`labelPatch` — l'angle vaut la longueur divisée par le rayon). Une face ni plane ni cylindrique (cône, sphère,
congé) la reçoit **à plat sur son plan tangent**, avec un avertissement : elle ne l'épouse pas.

**Le motif est un seul SVG, à l'échelle** (`labelSvg`) : il sert de texture dans la vue 3D et de **fichier pour
l'imprimeur** (`.svg`, largeur et hauteur en millimètres). La **liste** part en `.csv` : repère, genre, motif, pièce,
surface, taille, aire. Les deux portent la note de la plateforme.

**Ce que l'écran dit** (`labelGuide`, donné au guide) : étiquette à poser, texte à écrire (son champ clignote), image à
apporter ; étiquette plus longue que le tour du cylindre (à corriger) ou que son demi-tour (à vérifier) ; pièce
porteuse disparue de l'assemblage ; plus petit texte sous 2 mm ; encre et fond de la même couleur ; image lourde.

**Avec une IA** : les étiquettes partent avec leur consigne ; au retour, la liste des changements et ce que les
étiquettes revenues demandent, avant d'appliquer en une étape annulable. La pose (`inst`, `on`) n'est jamais reprise
de la réponse : elle reste celle de la souris.

**Dans l'exemple de la fusée** : l'autocollant DesignWizard.ai, 420 × 120 mm, enroulé sur la coque centrale et lu le
long de la fusée.

### Limites

- Cylindres et plans seulement ; pas de cône ni de surface gauche.
- La largeur d'un texte est **estimée** (pas de mesure de police hors navigateur) : un texte très large peut toucher le
  bord — le motif exporté est à relire.
- L'étiquette ne sait rien des arêtes de la face : elle peut dépasser d'une face plane, à vous de la tenir dedans.
- Un vinyle réel s'étire un peu sur un petit rayon : le fabricant d'étiquettes fait foi.
- Les mentions réglementaires d'une plaque signalétique ne sont pas vérifiées.
