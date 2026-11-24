# Marketing — étiquettes et rendu

Deux briques pour ce que le produit **montre** : ce qui est collé, riveté ou marqué dessus, et l'image que l'on en
tire. Elles vivent sur l'**assemblage** (`labels`, `render`), voyagent dans le fichier `.dwiz` et se retrouvent dans le
rapport.

## Les étiquettes

Écran **Étiquettes** (`Projet → Étiquettes et autocollants…`, route `#/labels/<assemblage>` ; `web/js/core/labels.js`,
`web/js/core/label_raster.js`, `web/js/modules/labels.js`). Une étiquette appartient à un assemblage et se pose sur
**une instance**, sur une **face plane** ou **enroulée sur un cylindre**.

```
label E1 sticker name="Autocollant DynamiteOrbit.ai" inst=coque_centrale w=420 h=120 turn=90
  on p=[101.6, 0, 760] axis=[0, 0, 1] c=[0, 0, 0] r=101.6
  art type=logo text=DynamiteOrbit.ai sub="by DynamiteAgile™" ink="#26323f" paper="#ffffff" shape=round
```

- **Son genre** (`kind`), sur trois tuiles : *autocollant* (vinyle posé à la main), *plaque signalétique* (rivetée ou
  collée), *marquage direct* (gravé ou tampographié, sans épaisseur).
- **Sa taille** en millimètres (`w`, `h`) et sa **rotation** (`turn`, en degrés) : sur un cylindre, 0 se lit autour,
  90 le long de l'axe.
- **Son motif** (`art`), sur trois tuiles : la **marque DynamiteOrbit.ai** (le sigle, et le nom à côté quand
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

**Dans l'exemple de la fusée** : l'autocollant DynamiteOrbit.ai, 420 × 120 mm, enroulé sur la coque centrale et lu le
long de la fusée.

### Limites des étiquettes

- Cylindres et plans seulement ; pas de cône ni de surface gauche.
- La largeur d'un texte est **estimée** (pas de mesure de police hors navigateur) : un texte très large peut toucher le
  bord — le motif exporté est à relire.
- L'étiquette ne sait rien des arêtes de la face : elle peut dépasser d'une face plane, à vous de la tenir dedans.
- Un vinyle réel s'étire un peu sur un petit rayon : le fabricant d'étiquettes fait foi.
- Les mentions réglementaires d'une plaque signalétique ne sont pas vérifiées.

## Le studio photo

Demande de JP (19 novembre 2026) : « un module de rendu photo avec éclairage (pouvant être positionné comme dans un
studio), avec des backgrounds built-in pour faire des photo shoots dans le module Assembly. On doit voir les ombres
associées à la position de l'éclairage, comme dans un outil professionnel… par exemple le rover sur une dune de sable
dans le désert, avec un ombrage sur le sable… en ville, désert, en bord de mer, sur un porte-avions, sur un bateau, en
campagne ».

Écran **Studio photo** (bouton « Photo » de l'Assemblage, ou `Projet → Studio photo…` ; route `#/render/<assemblage>`,
sous l'onglet de l'Assemblage). Le produit dans un **décor**, sous des **lumières que l'on place**, en perspective,
avec la finition de chaque pièce et ses étiquettes ; l'image part en **PNG**, la marque de la plateforme dans le coin.

```
render scene=desert shot=road size=hd ground=true labels=true setup=golden ambient=0.5 scale=1.2 quality=max
  light l1 sun az=-108 el=13 power=3.2 soft=0.04 kelvin=3400 shadow=true
  light l2 fill az=20 el=15 power=0.4 soft=1 kelvin=6000 shadow=false off=true
  look RVR-2210-01 paint-matte color="#6f7a4a"
```

### Le décor (`scene`, `scale`)

Onze décors, **groupés par nature**, chacun avec sa vignette :

- *en studio* — studio clair, studio sombre : un fond sans raccord ;
- *sur terre* — plein air (un sol neutre sous un vrai ciel), **désert** (au sommet d'une dune, les autres à perte de
  vue), **campagne** (pré, collines, arbres, clôture), **neige** (plaine blanche, sapins) ;
- *en mer* — **bord de mer** (la plage descend vers l'eau), **bateau** (pont en bois, bastingage, cabine),
  **porte-avions** (pont d'envol, lignes peintes, îlot, la mer loin en bas) ;
- *en ville* — **rue** (chaussée, trottoirs, deux rangées d'immeubles), **toit** (terrasse, parapet, la ville autour).

Un décor est un **lieu construit en 3D autour du produit** : un ciel, un sol avec son relief et sa matière, de l'eau,
quelques objets qui disent où l'on est. L'ombre du produit tombe donc sur un **vrai sol** — le sable, les planches,
l'asphalte — et suit la lumière, où qu'elle soit. Le produit se tient sur une place plane ; autour, le terrain
s'éloigne en descendant, pour que rien ne se dresse entre l'appareil et lui (dans le désert, il est sur la crête).

**Tout est fabriqué par l'outil**, à partir de bruit et de boîtes (`web/js/core/photo_sets.js`) : aucune photographie,
aucune image d'environnement (HDRI) n'entre dans le dépôt, et rien ne montre un lieu, un navire ou une marque réels —
l'îlot du porte-avions est un empilement de boîtes sans numéro ni pavillon. Le décor se met **à l'échelle du produit**
(« Taille du produit dans le décor », 40 à 250 %) : c'est une toile de fond, pas un lieu mesuré, et l'écran le dit.

### Les lumières (`setup`, `lights`, `ambient`)

- **Un éclairage tout fait** (`setup`), sur huit tuiles en deux groupes — *Studio lights* : **Three-point**
  (principale, appoint, contre-jour), **High key**, **Low key**, **Backlit** ; *Daylight* : **Midday sun**, **Morning
  sun**, **Golden hour**, **Overcast**. Il se pose **par rapport à l'appareil** du point de vue choisi, comme le fait un
  photographe ; chaque décor arrive avec le sien (le désert, un soleil du matin).
- **Le plan** : le studio **vu de dessus**, l'appareil en bas comme sur un schéma d'éclairage. Chaque lampe y est une
  pastille que l'on **glisse autour du produit** — vers le bord, elle descend sur l'horizon ; vers le centre, elle
  monte au-dessus. Au clavier : ← → tournent de 5°, ↑ ↓ montent ou descendent (Maj : 15°).
- **Dans la vue**, chaque lampe est un disque à la couleur de sa lumière, relié au produit par un trait : on la
  **prend et on la tire**, elle glisse sur une sphère autour du produit. Les lampes ne sont jamais dans l'image.
- **Chaque lampe** (`light`) : sa nature — *Key light*, *Fill light*, *Rim light*, *Top light*, *Sun* —, où elle se
  tient (`az`, `el`), sa **puissance** (1 : une lampe ordinaire), sa **douceur** (la taille de la source : 0 un point,
  une ombre nette ; 1 une grande boîte à lumière, une ombre qui fond), sa **température** de couleur (`kelvin` ;
  Tungsten 3200, Daylight 5600, Overcast 6500), et si elle **porte une ombre**. Chaque lampe a son **On / Off** et sa
  **copie** (née à Off) ; au plus six lampes, dont les **trois plus fortes** portent une ombre.
- **La lumière d'ambiance** (`ambient`) : ce qui vient de partout — le ciel, les murs — et reste dans une ombre.
- Dès qu'une lampe est déplacée, les lumières sont **à soi** : elles restent où on les a mises, quel que soit le point
  de vue ; « Revenir à un éclairage tout fait » les retire.

### L'image qui s'affine (`quality`, `exposure`)

Pendant que quelque chose bouge, la vue dessine **une** image : chaque lampe en un point, des ombres nettes. Dès que
rien ne bouge, elle **s'affine** : la scène est redessinée 16, 48 ou 160 fois — chaque fois les lampes déplacées un peu
à l'intérieur de leur propre taille, le ciel vu d'un autre côté, l'appareil décalé d'une fraction de pixel — et l'écran
montre la **moyenne**. Les ombres fondent comme une vraie source les fait fondre (nettes au contact, floues plus loin),
les bords sont propres, et ce que le ciel n'atteint pas s'assombrit (le dessous du produit). La puce « Affinage 12 / 48 »
dit où elle en est. « Faire l'image » affine de la même façon au format demandé, sous un voile qui dit la passe en
cours et s'annule. L'**exposition** se règle en crans (+1 : deux fois plus clair).

C'est la façon de faire des **visionneuses temps réel** (des images accumulées quand rien ne bouge) ; ce **n'est pas un
lancer de rayons**.

### Comment font les outils du métier, et ce qui est repris

Lu par un résumé automatique de leurs pages d'aide (19 novembre 2026 ; niveau « extrait » du registre des sources) :

| Outil | Ce que sa documentation décrit | Ce que le studio en reprend |
|---|---|---|
| KeyShot (manuel) | Un environnement lumineux sphérique (HDRI) que l'on tourne ; un fond au choix (environnement, couleur, image de fond) ; des ombres au sol ; des lumières physiques (surface, point, projecteur) placées comme des pièces, en nombres ou à la poignée ; des « pins » posés par azimut et élévation | Azimut / élévation ; lampes placées à la main ; ombre au sol ; température en kelvins |
| Onshape Render Studio (aide) | Un dôme d'environnement que l'on tourne, un sol dont on règle l'ombre, des lumières (point, sphère, disque, rectangle, infinie) en lumens et kelvins | Le sol qui reçoit l'ombre ; la lumière « infinie » (le soleil) |
| Blender (manuel) | Un « shadow catcher » : un sol qui ne reçoit que l'ombre ; un soleil dont on règle l'angle apparent ; des modèles de ciel | L'ombre plus ou moins douce selon la taille de la source |
| three.js (manuel, « Shadows ») | Chaque lumière qui porte une ombre redessine la scène ; l'ombre d'une lumière directionnelle vit dans une boîte | Trois ombres au plus ; la boîte serrée sur le produit |
| « Three-point lighting », « Color temperature » (Wikipédia) | Principale à 30–45° de côté et de haut, appoint de l'autre côté à moitié moins, contre-jour derrière ; 3200 K les lampes de studio, 5500–6000 K le flash, 6500 K le ciel couvert | L'éclairage « Three-point » et les trois repères de température |

**Ce qui n'est pas repris, et pourquoi.** Ces outils éclairent d'abord par une **photographie d'environnement** (HDRI)
et montrent une **image de fond** : le dépôt n'en contient aucune (aucune ressource externe, aucune image d'autrui), les
décors sont donc construits. Leur rendu final est un **lancer de rayons** : la bibliothèque libre qui le ferait ici
(three-gpu-pathtracer, MIT) demande aujourd'hui WebGPU et une version de three.js plus récente que celle du dépôt (son
README et son paquet, lus le 19 novembre 2026) — non installée ; c'est une suite possible, à décider.

### Le point de vue, l'image, les finitions

- **Le point de vue** (`shot`), sur six tuiles : trois-quarts, **près du sol** (de trois-quarts, bas : le décor
  derrière le produit), profil, de face, contre-plongée, plongée — la caméra se place pour que **tout le produit
  tienne** dans l'image, quel que soit son format. La souris tourne autour (glisser), approche (molette), déplace
  (Maj + glisser) ; « Garder ce point de vue » le range avec l'assemblage (`view`). L'appareil ne passe pas sous le sol.
- **L'image** (`size`) : écran 16:9, carré, portrait 2:3, bandeau 3:1, 4K ; étiquettes au choix.
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

**Ce que l'écran dit** (`renderGuide`, `lightGuide`) : décor, point de vue ou format inconnu ; aucune lumière, ou
toutes à Off (l'image serait noire) ; aucune lumière ne porte d'ombre ; plus de trois ombres ; une lumière sur l'horizon ;
finition inconnue ; couleur illisible ; finition gardée pour une pièce sortie de l'assemblage ; couleur choisie pour une
finition qui montre celle de la matière ; rien de choisi (un conseil).

**Avec une IA** : le bloc `render` part avec sa consigne ; au retour, la liste des changements avant d'appliquer en
une étape annulable.

**Dans l'exemple de la fusée** : coques en peinture brillante blanche, ogive rouge, ailerons anodisés bleus, réservoir
brossé, tuyère microbillée, serpentin poli, jupe transparente ; image en portrait, vue de trois-quarts.
**Dans celui du Rover** : le studio s'ouvre dans le désert, près du sol, sous un soleil du matin.

**Code** : `web/js/core/photo_sets.js` (décors, relief, ciel, matières, objets — pur), `core/photo_lights.js` (lumières,
éclairages tout faits, plan, échantillons — pur), `core/render_looks.js` (ce qu'un rendu garde), `core/photo_set_build.js`
(le décor en 3D), `core/photo_rig.js` (les lampes), `core/photo_accum.js` (l'image qui s'affine), `core/render_stage.js`
(la scène), `modules/render.js` et `modules/render_lights.js` (l'écran).

**Vérifié** (Chromium, rendu logiciel, sur le Rover) : le studio ouvert depuis l'Assemblage ; les onze décors, un à un,
à l'œil ; une lampe déplacée sur le plan au clavier puis à la souris, et prise dans la vue ; une lampe ajoutée, sa
puissance, son ombre, Off, sa copie née à Off, son retrait ; l'ambiance ; un éclairage tout fait puis Ctrl + Z ; le
décor et la taille du produit ; le guide quand tout est à Off ; l'image de 1920 × 1080 enregistrée sous son voile.
**Pas vérifié** : la vitesse et l'aspect sur une vraie carte graphique (tout a tourné en rendu logiciel) ; le 4K et la
finesse maximale ; Firefox, Safari, le toucher ; un produit très grand ou très plat dans chaque décor ; l'avis d'un
photographe sur les éclairages.

### Limites du rendu

- **Ce n'est pas un rendu physiquement exact** : pas de lancer de rayons, pas de réflexions entre pièces, pas de
  lumière renvoyée d'une pièce à l'autre ; les reflets sont ceux du ciel du décor et d'une tache claire là où se tient
  chaque lampe. Puissance et température sont **relatives** : ni lumens, ni lux.
- Les décors sont **dessinés, pas photographiés** : ils ont l'air de ce qu'ils sont — des volumes simples. Seul le
  produit porte une ombre : un arbre, un immeuble n'en portent pas sur lui. La mer ne bouge pas.
- Le décor n'est pas à l'échelle : il se règle sur la taille du produit.
- Les finitions sont des **réglages d'image** réglés à l'œil, pas des mesures de brillance ni des finitions d'atelier :
  la finition réelle d'une pièce reste celle de sa fiche (`finish`).
- Une finition habille le **corps principal** de la pièce ; ses autres corps gardent la finition de leur matière.
- Les motifs sont projetés par les axes de la pièce : une couture peut se voir là où la surface tourne d'un axe à
  l'autre.
- Pas d'image de fond importée ni d'environnement photographié, pas de profondeur de champ, pas d'animation, pas de
  lampe à faisceau (projecteur) : toutes éclairent en lumière parallèle.

