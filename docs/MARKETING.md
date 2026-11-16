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

### Limites des étiquettes

- Cylindres et plans seulement ; pas de cône ni de surface gauche.
- La largeur d'un texte est **estimée** (pas de mesure de police hors navigateur) : un texte très large peut toucher le
  bord — le motif exporté est à relire.
- L'étiquette ne sait rien des arêtes de la face : elle peut dépasser d'une face plane, à vous de la tenir dedans.
- Un vinyle réel s'étire un peu sur un petit rayon : le fabricant d'étiquettes fait foi.
- Les mentions réglementaires d'une plaque signalétique ne sont pas vérifiées.

## Le rendu

Écran **Rendu** (`Projet → Rendu marketing…`, route `#/render/<assemblage>` ; `web/js/core/render_looks.js`,
`web/js/core/render_stage.js`, `web/js/modules/render.js`). Le produit sous une lumière de studio, en perspective,
avec la **finition de chaque pièce**, ses **étiquettes**, un sol qui prend son ombre et un décor que ses métaux
reflètent ; l'image part en **PNG**, la marque de la plateforme dans le coin.

```
render scene=studio shot=hero size=portrait ground=true labels=true
  look FUS-4060 paint-gloss color="#d6453d"
  look FUS-4020 metal-anodized color="#1f4e79"
  look FUS-1020 metal-polished
```

- **Le décor** (`scene`), sur trois tuiles : studio clair, studio sombre, plein air.
- **Le point de vue** (`shot`), sur cinq tuiles : trois-quarts, profil, de face, contre-plongée, plongée — la caméra
  se place pour que **tout le produit tienne** dans l'image, quel que soit son format (un produit élancé remplit une
  image en hauteur). La souris tourne autour (glisser), approche (molette), déplace (Maj + glisser) ; « Garder ce
  point de vue » le range avec l'assemblage (`view`).
- **L'image** (`size`) : écran 16:9, carré, portrait 2:3, bandeau 3:1, 4K ; ombre au sol et étiquettes au choix.
- **Les finitions** (`looks`), une par **pièce** (toutes ses instances la portent), **groupées par nature**, chaque
  groupe avec sa couleur et chaque finition avec sa petite sphère :
  - *peintures* — brillante, satinée, mate, métallisée (elles prennent leur couleur) ;
  - *métaux* — poli, brossé, microbillé, aluminium anodisé (teinté) ;
  - *plastiques et élastomères* — brillant, grainé, caoutchouc ;
  - *composites* — carbone tissé, stratifié verre-époxy ;
  - *transparents* — verre, plastique transparent.
  Une pièce sans choix montre la **finition de sa matière** (métal brossé, plastique grainé, caoutchouc, stratifié).
  Un clic sur une pièce, dans l'image ou dans la liste, ouvre ses tuiles.
- **Les motifs** — stries du brossé, sergé du carbone, grain, paillettes — sont de petites tuiles calculées
  (`patternPixels`), projetées sur la pièce par les axes de sa boîte (`boxUv`) : aucune image externe.

**Ce que l'écran dit** (`renderGuide`) : décor, point de vue ou format inconnu ; finition inconnue ; couleur illisible ;
finition gardée pour une pièce sortie de l'assemblage ; couleur choisie pour une finition qui montre celle de la
matière ; rien de choisi (un conseil).

**Avec une IA** : le bloc `render` part avec sa consigne ; au retour, la liste des changements avant d'appliquer en
une étape annulable.

**Dans l'exemple de la fusée** : coques en peinture brillante blanche, ogive rouge, ailerons anodisés bleus, réservoir
brossé, tuyère microbillée, serpentin poli, jupe transparente ; image en portrait, vue de trois-quarts.

### Limites du rendu

- **Ce n'est pas un rendu physiquement exact** : pas de lancer de rayons, pas de réflexions entre pièces ; les reflets
  sont ceux d'un décor de synthèse, l'ombre est une ombre portée simple.
- Les finitions sont des **réglages d'image** réglés à l'œil, pas des mesures de brillance ni des finitions d'atelier :
  la finition réelle d'une pièce reste celle de sa fiche (`finish`).
- Une finition habille le **corps principal** de la pièce ; ses autres corps gardent la finition de leur matière.
- Les motifs sont projetés par les axes de la pièce : une couture peut se voir là où la surface tourne d'un axe à
  l'autre.
- Pas d'image de fond importée, pas de profondeur de champ, pas d'animation.

