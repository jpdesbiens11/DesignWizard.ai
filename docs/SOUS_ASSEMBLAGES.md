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
| Dessin d'ensemble | toutes les pièces, repérées et listées |
| Isolation, Simulation, Rendu, Étiquettes | toutes les pièces |
| STEP, envoi vers Onshape | toutes les pièces, à leur place |
| Guide | sous-assemblage disparu, boucle, bloc non accouplé ; les joints d'un sous-assemblage restent l'affaire de son écran |
| Revue et révisions | un assemblage est revu et libéré avec les pièces de ses sous-assemblages ; « Employée dans » remonte les niveaux |
| Interfaces liées | un accouplement lié entre le parent et une pièce d'un sous-assemblage adapte l'autre côté |
| On / Off, variantes | un sous-assemblage à Off sort de tout, avec les joints qui passent par lui ; une variante le retient |
| Aller-retour IA (`.dwiz`) | `place s1 asm=SUB` ; un assemblage qui se contiendrait est refusé à l'import |

Pas encore fait :

- le **dessin d'ensemble** liste les pièces à plat : pas de ligne « sous-assemblage » dans son tableau, pas de bulle
  propre au bloc ;
- le **STEP** et l'envoi **Onshape** sortent une structure à plat (les pièces, sans le niveau intermédiaire) ;
- la **révision** d'un sous-assemblage n'est pas gelée dans celle de son parent : ce sont ses pièces qui le sont ;
- une **variante** du parent ne choisit pas la variante de ses sous-assemblages : un sous-assemblage entre tel qu'il est ;
- ses pièces masquées dans son propre écran sont montrées dans le parent (masquer se fait au niveau du bloc) ;
- on ne peut pas **dissoudre** un sous-assemblage dans son parent, ni en **former** un à partir de pièces choisies : il
  faut le créer, puis l'ajouter.

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
