# Une pièce faite ailleurs : import STEP, interfaces reconnues, glisser pour emboîter

Demande de JP (28 novembre 2026, pendant le concept 5 du BM) : « ce serait nice de pouvoir faire les pièces les plus
complexes en 3D dans OnShape ou Inventor et les importer comme une nouvelle pièce en stp ou autre format que tu veux dans
l'assemblage et que l'interface soit reconnue pour le mating en promenant la pièce devant l'interface parent à l'écran. »
Ordre choisi par JP, par menu : 1 → 2 → 3 → 4, publié d'un bloc (v0.217.0).

## 1. Le format : STEP

| Format | Lu ? | Pourquoi |
|---|---|---|
| **STEP** (`.step`, `.stp` — AP203, AP214, AP242) | **oui** | ISO 10303 : ce qu'Onshape, Inventor, SolidWorks, Fusion et les fournisseurs exportent ; le noyau de l'outil (OpenCascade) le lit en solide. |
| IGES (`.igs`, `.iges`) | non | le lecteur IGES n'est pas compilé dans le noyau livré avec l'outil. |
| STL, OBJ, 3MF | non | un maillage de triangles : ni trou, ni cylindre, ni face plane à reconnaître. |
| Parasolid (`.x_t`), ACIS (`.sat`), formats natifs (`.ipt`, `.prt`, `.sldprt`…) | non | le format d'un autre noyau ou d'un logiciel. |

Un fichier non lu est refusé avec sa raison (`STEP_FORMATS`, `notRead` de `web/js/core/importer.js`). Depuis Onshape :
clic droit sur la pièce → *Export* → STEP ; depuis Inventor : *Exporter* → *Format CAO* → STEP (AP214 ou AP242).

## 2. Où le déposer

- **Sur l'Assemblage** — le bouton STEP de la liste des pièces, ou le fichier déposé sur la vue. Le noyau lit le fichier
  sous le voile commun (annulable), le dialogue des interfaces s'ouvre, puis **une seule étape annulable** ajoute la pièce
  au projet et la pose à côté de l'assemblage (côté +X, son dessous au niveau du dessous de l'assemblage), choisie, sa
  poignée prête. L'accouplement automatique la laisse : elle attend que la main l'emboîte (`stepIntoAssembly`,
  `besideAssembly` de `web/js/modules/step_import.js`).
- **Ailleurs** (Atelier, accueil, coller) — la pièce est créée et son studio s'ouvre ; onglet Interfaces :
  « Reconnaître les interfaces… ».

La pièce garde son fichier (`step`), sa nature « Imported (STEP) » dans l'Atelier, et `imported` : le nom du fichier, la
date, ce qui a été lu (`read`) et les propositions écartées (`dropped`). Le fichier lourd est rangé une seule fois dans
l'historique, comme tout STEP importé.

## 3. Ce que l'outil lit, ce qu'il propose

Le noyau lit les faces **planes** et **cylindriques** qui regardent le long d'un axe de la pièce (`readFeatures` de
`web/js/cad/step_read.js`, commande `recognize` du worker). Le reste est pur et tenu par des essais
(`web/js/core/step_interfaces.js`) :

| Ce qui est lu | Ce qui est proposé |
|---|---|
| des trous d'un même diamètre sur une même face, dont le diamètre est un **trou de passage** de la table de l'outil (`cad/standards.js`) | `bolt_pattern`, côté **A** ; lamés : la tête est dans le lamage, la pièce rencontre sa voisine par l'**autre** face |
| … un **foret de taraudage**, ou le **diamètre intérieur de base** ISO (D1 = D − 1,082532 P — Inventor modélise un trou taraudé à ce diamètre) | `bolt_pattern`, côté **B** (taraudé) |
| deux trous lisses d'un diamètre de goupille courant (1,5 à 12 mm) | `pins` (traversants : glissants, côté A ; borgnes : chassés, côté B) |
| un trou seul qu'aucune vis n'explique (Ø ≥ 3 mm) | `fit`, côté **B** (alésage) — l'ajustement H7/g6 est un exemple |
| un cylindre debout sur un épaulement, fini par un disque | `fit`, côté **A** (arbre) |
| la plus grande face plane du dehors (au moins le quart de son côté de la boîte) | `planar` — **Off d'office** : il ne s'accouple qu'à un appui plan des mêmes dimensions |

Les trous d'une face font un motif de la plateforme : rectangle (`rect`), cercle (`circle`), sinon points (`points`). Un
trou **traversant** se rencontre par l'une ou l'autre face : la proposition porte l'autre face (`alt`), et le dialogue a
« Autre face ». Quand une pièce du projet porte **le même motif tourné** d'un quart, d'un demi ou de trois quarts, la
proposition reprend son motif et ce tour (`rot`) : elle s'y emboîtera (« Même motif que … »).

Ce qui n'est pas lu est **dit** dans « Ce qui n'est pas lu » : un trou qui n'ouvre sur aucune face plane, une paroi de trou
qui ne fait pas le tour (coupée par une autre), un diamètre qu'aucune vis ni goupille de la table n'explique, les faces qui
penchent. Rien n'est deviné.

### Proposée, puis confirmée

Une interface lue porte `found` : **la forme du fichier n'est jamais modifiée** — rien n'est percé, rien n'est ajouté
(`web/js/cad/build.js`). Tant qu'une personne ne l'a pas confirmée, elle porte aussi `proposed` : elle est construite (son
repère se voit), mais **elle ne s'accouple à rien** — ni accouplement automatique, ni poignée, ni liste des mates possibles
(`freeInterfaces` de `web/js/core/assembly_logic.js`) — et le guide la donne « à vérifier ». Dans le dialogue, chaque
proposition a son On / Off : On la confirme, Off la garde proposée. Dans la pièce, sa carte est en pointillé et clignote,
avec « Confirmer » et « Écarter » (écartée, la prochaine lecture ne la propose plus).

Le guide d'une pièce importée demande **sa matière** (la masse mesurée sur le volume du fichier attend sa densité ; le
dialogue la demande aussi) et **ses interfaces** tant qu'elle n'en a pas. Une interface lue n'a pas besoin de clé : elle
s'accouple par sa géométrie (même vis, même motif).

## 4. Glisser pour emboîter

**Convention suivie** : le « glisser-déposer sur une fonction » des modeleurs mécaniques — les *SmartMates* de SolidWorks,
la commande *Assembler* d'Inventor : on traîne un composant, la fonction compatible de l'autre s'allume, l'aperçu montre
où l'accouplement le met, relâcher le fait. Les blocs du Logiciel de la plateforme font de même (`snapAt`). Ce qui est
maison est dit : la portée de 36 px, les pas du clavier.

- Au milieu de la pièce choisie (onglet Pièce de la marge de droite), une **poignée carrée** (vert sarcelle) ; près d'un bord
  de la vue, elle se rapproche du milieu de la vue pour rester sous la main.
- **Glisser** : la pièce — et tout ce que ses accouplements y accrochent — suit la main dans le plan de l'écran. Les
  interfaces libres **compatibles** (même règle que l'accouplement automatique : même type, côtés A et B, même clé ou même
  géométrie) s'allument en anneaux verts. Quand une interface de la pièce passe à **36 px** de l'une d'elles, l'anneau
  devient orange, le nom de l'accouplement s'affiche, et la pièce se montre **là où l'accouplement la mettra** ; relâcher
  l'écrit, **en une étape annulable** (`applySnap` de `web/js/core/asm_snap.js`). Le solveur la met exactement où
  l'aperçu l'a montrée (essai).
- Une pièce **tenue** par un accouplement ne bouge pas tant que la main n'est pas à 36 px : alors elle **se détache** — les
  accouplements qui relient son bloc au reste sont retirés et gardés comme écartés, pour que l'accouplement automatique ne
  les remette pas (`applyDrop`). Relâchée ailleurs, elle reste où la main l'a laissée ; reposée sur son ancien joint, rien
  ne change.
- **La pièce de base ne bouge pas** : tout le reste se place à partir d'elle. Un **sous-assemblage** se déplace d'un seul
  bloc et s'emboîte par l'interface d'une de ses pièces (le joint la nomme par son chemin, « S~j1 »).
- Une interface lue dans un fichier n'est pas **liée** à sa voisine : changer le motif de la voisine ne réécrit pas ce
  que le fichier contient.
- **Échap** abandonne. **Clavier** : la poignée est un bouton ; ← ↑ → ↓ déplacent une pièce libre de 5 mm dans le plan de
  l'écran (Maj : 25, Alt : 1) ; **Entrée** l'emboîte sur l'interface compatible la plus proche à l'écran. La liste
  « Mates possibles » de la marge reste l'autre chemin.

## 5. Ce qui est vérifié, ce qui ne l'est pas

Vérifié par `tests/node/step_import.test.mjs` sur une plaque bâtie par le vrai noyau, **écrite en STEP puis relue** comme un
fichier venu d'ailleurs : motif lamé, taraudage traversant, goupilles, arbre, face plane ; propositions posées sur les trous ;
volume inchangé ; une proposition attend ; accouplement avec un motif tourné d'un quart ; la pièce emboîtée là où l'aperçu
l'a montrée, les trous sur les taraudages ; tirée, elle se détache ; un sous-assemblage glissé d'un bloc ; le guide.
Vérifié dans Chromium (Playwright) : le dépôt sur l'Assemblage, le dialogue, la pose, le glisser qui s'allume et emboîte,
la pièce tirée qui se détache, Entrée, le studio Pièces (Confirmer, Relire).

**Pas vérifié** : des fichiers réellement exportés par Onshape et par Inventor (un trou taraudé modélisé au diamètre
nominal n'est pas lu comme un taraudage) ; une pièce dont les faces penchent par rapport à ses axes (rien n'y est proposé) ;
le geste au toucher, sous Firefox et Safari. Lignes du registre des sources : `step-read`, `iso-724-minor`, `asm-snap`.
