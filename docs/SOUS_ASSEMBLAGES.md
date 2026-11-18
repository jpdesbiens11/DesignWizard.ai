# Sous-assemblages — un assemblage dans un assemblage

Demande de JP (18 novembre 2026, choix « Sous-assemblages ») : la structure d'un assemblage n'avait qu'un niveau. Un
produit se monte pourtant par modules — un bloc de refroidissement, une carte avec son support, un train roulant — que
l'on assemble à part, puis que l'on pose d'un seul geste.

## Ce que l'on voit

- **Un assemblage entre dans un autre comme une seule ligne.** Le bouton « + » de la liste des pièces ouvre « Ajouter
  à l'assemblage » : les **pièces**, puis les **sous-assemblages** (les autres assemblages du projet). Un sous-assemblage
  est un assemblage comme les autres : il se crée avec le « + » de la liste des assemblages et se monte dans son propre
  écran.
- **Il se porte d'un seul bloc.** Ses pièces gardent entre elles la place qu'elles ont dans son document. Il suffit
  qu'**une** de ses pièces soit accouplée à une pièce du parent pour que tout suive ; sans accouplement il reste où on
  le pose (position manuelle), et il peut être la pièce fixe.
- **Il s'accouple tout seul**, comme une pièce : les interfaces que ses pièces laissent libres cherchent leur jumelle
  dans le parent (même type, même clé ou même géométrie). Deux pièces d'un même sous-assemblage ne sont jamais
  accouplées depuis le parent : ce joint-là appartient au sous-assemblage.
- **Dans la liste**, sa ligne porte le pictogramme d'assemblage, son nom, son nombre de pièces, son état (fixe, matée,
  libre), l'interrupteur **On / Off** et l'œil — comme une pièce. Un clic sur l'une de ses pièces dans la vue
  sélectionne **le bloc entier** ; le clic droit ouvre son menu (« Ouvrir le sous-assemblage », le montrer seul,
  On / Off, fixer, retirer).
- **Sa fiche**, à droite : ce qu'il contient, les interfaces par lesquelles il tient ici et celles qui restent libres,
  et le bouton qui l'ouvre. Pour le modifier, on l'ouvre : rien de son contenu ne se change depuis le parent.
- **La nomenclature se lit de deux façons** : **par niveaux** — chaque sous-assemblage est une ligne avec sa quantité, et
  ce qu'**un** exemplaire contient vient dessous (ses pièces, ses propres sous-assemblages, la visserie de ses propres
  joints) — ou **à plat** — toutes les pièces à travers les niveaux, quantités additionnées. Chacune a son CSV.
- **Un assemblage ne peut pas se contenir lui-même**, à aucune profondeur : dans « Ajouter », un assemblage qui contient
  déjà celui-ci est montré grisé, avec la raison. Un fichier qui porterait malgré tout une boucle est ouvert sans
  tourner en rond : le sous-assemblage fautif est laissé de côté, et le guide le dit.
- **Là où il sert** : ouvert, un sous-assemblage dit de quels assemblages il fait partie. Le supprimer prévient, le
  retire aussi de ses parents avec les accouplements qui passaient par lui — en une étape, que Ctrl + Z ramène.

## Ce qui suit, et ce qui ne suit pas encore

Tout ce qui **compte des pièces** lit l'assemblage **ouvert** — chaque pièce une fois, là où elle est :

| Suit | Comment |
|---|---|
| Vue 3D, masse, centre de gravité, dimensions hors tout | chaque pièce à sa place résolue |
| Accouplements, santé des joints, registre des joints (CSV) | ceux du parent et ceux de chaque sous-assemblage |
| Interférences | entre toutes les pièces, y compris à l'intérieur d'un sous-assemblage |
| Nomenclature | à plat, et par niveaux |
| Gamme d'assemblage | le sous-assemblage est **une étape** : « le monter à part, selon sa propre gamme », puis le poser |
| DFA, bilan DFx, rapport de revue | sur le produit entier |
| Dessin d'ensemble | la liste de **son niveau** : un sous-assemblage est une ligne et une bulle, au milieu du bloc (v0.93) ; « à plat » au choix |
| Isolation, Simulation, Rendu, Étiquettes | toutes les pièces |
| STEP, envoi vers Onshape | toutes les pièces à leur place, **avec les niveaux** : un sous-assemblage est un produit du fichier (v0.93) |
| Guide | sous-assemblage disparu, boucle, bloc non accouplé ; les joints d'un sous-assemblage restent l'affaire de son écran |
| Revue et révisions | un assemblage est revu et libéré avec les pièces de ses sous-assemblages, **et avec la révision de chaque sous-assemblage, gelée** (v0.93) ; « Employée dans » remonte les niveaux |
| Interfaces liées | un accouplement lié entre le parent et une pièce d'un sous-assemblage adapte l'autre côté |
| On / Off, variantes | un sous-assemblage à Off sort de tout, avec les joints qui passent par lui ; une variante le retient |
| Aller-retour IA (`.dwiz`) | `place s1 asm=SUB` ; un assemblage qui se contiendrait est refusé à l'import |

### Ce qui sort avec ses niveaux (v0.93)

- **Le dessin d'ensemble liste son niveau.** C'est l'usage d'une liste de pièces : un sous-assemblage y est **une
  ligne** — son numéro, son nom, sa révision, « Sub-assembly, n parts » — et **une bulle**, au milieu du bloc ; ses
  pièces et la visserie de ses propres joints sont sur **son** dessin, qui a sa liste. Les notes de la feuille le
  disent (« 6 part(s) placed, 2 of them inside 1 sub-assembly listed as one item each »). Dans l'écran Dessins, le
  choix **« Nomenclature du dessin »** — *Ce niveau* ou *À plat : toutes les pièces* — n'apparaît que si l'assemblage
  porte un sous-assemblage ; il vaut pour le projet (`project.drawing.asmBom`), une étape annulable.
  Code : `bomTop` (`core/assembly_logic.js`), `makeAssemblyDrawing`, `centerKey` (`draw/asm_drawing.js`).
- **Le STEP garde les niveaux.** Un sous-assemblage est un **produit** du fichier, entre l'assemblage et ses pièces ;
  posé deux fois, il est écrit une fois et placé deux fois. Chaque pièce est à sa place : relu, le fichier donne les
  mêmes solides aux mêmes endroits que le fichier à plat (essai sur le vrai noyau). Les trois sorties qui écrivent le
  STEP d'un assemblage — le bouton de l'Assemblage, le dossier de commande, l'envoi Onshape — passent par la même
  liste : `stepItems` (`core/asm_scene.js`), d'après `placedTree` (`core/assembly_logic.js` : l'assemblage en arbre
  de nœuds posés, chaque matrice dans le repère du nœud au-dessus).
- **La révision d'un sous-assemblage est gelée dans son parent.** Un assemblage ne se libère que si chacun de ses
  sous-assemblages l'est — à la lettre, avec tout ce qu'il contient — ; sa libération note leur numéro et leur
  révision (`subs`), comme elle note ceux des pièces. Un sous-assemblage qui avance demande la révision suivante du
  parent. Voir [REVISIONS.md](REVISIONS.md).

### Former un sous-assemblage, le dissoudre (v0.94)

Un produit se découpe en modules **après coup** : on ne recommence pas l'assemblage.

- **Former.** Le bouton à côté du « + » de la liste des pièces, le menu d'une pièce (« Former un sous-assemblage
  avec… ») ou la palette ouvrent un dialogue : un nom, les pièces et les sous-assemblages à cocher, et — en direct —
  **ce qui va se passer** : combien d'accouplements passent à l'intérieur, combien restent entre le bloc et
  l'assemblage, et ce qui cloche (une pièce qu'aucun accouplement ne relie aux autres ne serait que posée dans le
  bloc ; un bloc qu'aucun accouplement ne relierait au reste ; une variante qui ne retiendra plus ces pièces).
  L'action attend un nom et au moins une pièce ; Entrée valide. Les pièces cochées quittent l'assemblage ensemble et y
  reviennent d'un seul bloc ; le bloc prend la place de la première ; s'il contient la pièce fixe, il devient le bloc
  fixe. **Rien ne bouge** : chaque pièce est écrite là où le solveur l'avait mise.
- **Dissoudre.** Le bouton de la fiche du bloc, ou son menu : le bloc est remplacé par ce qu'il contient, ses
  accouplements remontent, ceux qui passaient par lui nomment de nouveau les pièces directement. Le sous-assemblage
  reste dans le projet. Posé deux fois, chaque exemplaire se dissout à part (ses pièces prennent un nom à elles).
- Les deux sont **une étape annulable**, et l'inverse l'une de l'autre. Ce qui nomme une instance suit : l'ordre de la
  gamme, les étiquettes, les messages épinglés. Une variante du parent **lâche** les pièces qui entrent dans un bloc
  (elle ne règle pas l'intérieur d'un sous-assemblage) ; à la dissolution, une variante qui mettait le bloc de côté met
  de côté ce qu'il contenait.
- Code : `web/js/core/asm_form.js` (pur : `formPlan`, `formSub`, `dissolveSub`, `looseIn`, `placementOf`),
  `formDialog` (`web/js/modules/asm_sub.js`).

**La vue éclatée ouvre les blocs.** Un sous-assemblage s'écarte d'un bloc *et* s'ouvre : chaque pièce garde, en plus
de la poussée du bloc, celle qu'elle a dans son propre sous-assemblage (`burst`, `solveLevels`).

**Le Rover de la démonstration est par modules** : « Châssis roulant » (le châssis et ce qu'il porte, 14 pièces) et
« Plateau électronique » (la plaque et ce qu'elle porte, 16 pièces), formés par la même opération que le bouton, et
un seul accouplement au niveau du produit — la plaque du plateau sur les colonnettes du châssis, d'une pièce d'un
module à une pièce de l'autre. Un essai dissout les deux modules et retrouve les trente pièces à la même place.

Pas encore fait :

- l'**envoi vers Onshape** reçoit le STEP à niveaux, mais ce qu'Onshape en fait n'a pas été vu (aucun envoi réel) ;
- une **variante** du parent ne choisit pas la variante de ses sous-assemblages : un sous-assemblage entre tel qu'il est ;
- ses pièces masquées dans son propre écran sont montrées dans le parent (masquer se fait au niveau du bloc) ;
- former un bloc ne se fait pas encore en cochant les pièces **dans la vue** (Ctrl + clic) : le dialogue les liste.

## Dans le fichier

Une instance nomme une pièce **ou** un assemblage :

```
{ "id": "i1", "part": "DRV-BASE", "fixed": true, "placement": { … } }
{ "id": "s5", "asm": "ASM-002", "placement": { … }, "fixed"?, "hidden"?, "off"? }
```

Un accouplement du parent qui tient à une pièce **dans** un sous-assemblage la nomme par son chemin :
`{ "a": { "inst": "i1", "iface": "IF5" }, "b": { "inst": "s5~i1", "iface": "IF1" } }` — l'instance `i1` du
sous-assemblage posé sous l'identifiant `s5`. Sur deux niveaux : `t1~s5~i1`. Voir [FORMAT.md](FORMAT.md).

## Code

- `web/js/core/asm_levels.js` (pur) — `flatAsm` (l'assemblage ouvert : chaque pièce avec son `group`, les joints de
  chaque niveau, `groups`, `lost`), `partCounts`, `openInstances`, `bomLevels`, `canHold` / `holds` (pas de boucle),
  `dropInstances` (ce qui part avec une pièce ou un sous-assemblage), `topOf`, `ownsKey`, `usedIn`.
- `web/js/core/assembly_logic.js` — `solve` porte un sous-assemblage d'un bloc (`groups`, `local`) ; `solveLevels`
  résout chaque sous-assemblage seul, puis le parent ; `candidates` / `autoMate` cherchent les joints entre niveaux.
- `web/js/core/asm_scene.js` — `buildAssembly` rend l'assemblage ouvert (`ctx.asm`) et ses niveaux (`ctx.levels`) :
  tout écran qui passe par lui suit sans rien changer.
- `web/js/modules/asm_sub.js` — la fiche d'un sous-assemblage, les choix du dialogue, la nomenclature par niveaux ;
  `web/js/modules/assembly.js`.

**Règle pour la suite** : ce qui compte les pièces d'un assemblage ne lit jamais `asm.instances` directement — il passe
par `buildAssembly` (écran) ou par `flatAsm` / `partCounts` / `openInstances` (fonction pure).

## Ce qui est vérifié, ce qui ne l'est pas

Vérifié dans Chromium, sur la démonstration : le dissipateur et son isolant sortis du variateur, mis dans un
sous-assemblage, et ce sous-assemblage ajouté par le dialogue — il s'accouple seul, et le variateur retrouve
**exactement sa masse (464,5 g) et ses dimensions (160 × 110 × 72 mm)** ; la ligne du bloc, sa fiche, son menu ; la
nomenclature par niveaux et à plat ; On / Off (le compte et la masse suivent) ; la gamme (une étape pour le bloc) ; le
DFA ; le dessin d'ensemble ; le guide sans erreur ; l'écran du sous-assemblage (« Sous-assemblage de : … ») ; le parent
offert grisé dans le dialogue du sous-assemblage ; la suppression du sous-assemblage puis Ctrl + Z ; le retrait d'une
pièce du projet (le joint du parent part avec elle) ; dix-huit écrans visités sans erreur avec un sous-assemblage dans
le projet. Tests : `tests/node/asm_levels.test.mjs` (structure, solveur à un et deux niveaux, joints entre niveaux),
`tests/node/asm_levels_readers.test.mjs` (retraits, guide, revue, gamme, `.dwiz`, câblage).

Pas vérifié : un grand produit à plusieurs niveaux (le Rover n'a pas été refait en sous-assemblages) ; le temps de
construction sur un assemblage de plus de cinquante pièces ; l'envoi réel vers Onshape ; deux membres d'une équipe qui
modifient le parent et le sous-assemblage en même temps.
