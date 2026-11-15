# Architecture de DesignWizard.ai

Version 0.1.0 — première itération. Ce document dit comment la plateforme est faite, où se trouve quoi, ce qui est
vérifié, ce qui ne l'est pas, et ce qui est prévu ensuite.

## Principes

- **Les interfaces d'abord.** Une interface est un contrat typé entre deux pièces (`bolt_pattern`, `planar`, `fit`,
  `cutout`, `rail`, `pins`) : un côté A, un côté B, des paramètres partagés. D'une seule définition sortent la
  géométrie de chaque côté, le repère de mate, la visserie de la BOM et le GD&T du dessin.
- **Un langage de pièce** (JSON, « DW part/1 », voir [PART_LANGUAGE.md](PART_LANGUAGE.md)) : c'est ce que l'assistant
  écrit à la fin de l'entrevue et ce que le noyau construit. Tout nombre peut être une expression des paramètres.
- **Aucune dépendance à l'exécution.** Pas de framework, pas d'outil de build, pas de CDN : modules ES natifs, noyau
  CAO et vue 3D dans le dépôt. Python : bibliothèque standard seulement.
- **Le design « Carnet » de DynamiteAgile** : papier quadrillé, graphite, surligneur par outil (`--acc`), cartes
  tracées au crayon. Les écrans se construisent avec `el()` et `textContent`, jamais `innerHTML` sur une donnée.
- **L'IA reste dehors.** La plateforme n'appelle aucun modèle : elle écrit le prompt, vous menez l'entrevue dans
  Claude, vous collez la réponse. Aucune clé d'IA, aucune donnée de projet envoyée par la plateforme.

## Où se trouve quoi

```
designwizard.py            serveur local (statique, projets sur disque, proxy Onshape)
server/                    store.py (projets, historique, corbeille) · onshape.py (client de l'API Onshape)
web/index.html             page unique
web/css/app.css            design Carnet
web/js/main.js             point d'entrée : enregistre les outils, démarre la coquille
web/js/core/               coquille et logique sans noyau
    app.js  store.js  dom.js           routeur, projet avec annuler / rétablir, aides DOM
    viewer.js  viewport.js             vue 3D (three.js) : orbite, vues, coupe, éclaté, mesure, repères
    assembly_logic.js  links.js        mates automatiques, solveur de placement, BOM · dépendance entre interfaces liées
    prompts.js  importer.js            prompts génériques · « coller n'importe quoi »
    nl.js  palette.js                  la baguette (Ctrl + K) et son petit langage
    companion.js  part_edit.js         pièce complémentaire · dialogues de feature et d'interface
web/js/cad/                noyau CAO (tourne dans un Web Worker, et dans Node pour les tests)
    occ.js                             seule couche qui parle à OpenCascade
    expr.js  profile*.js               expressions sûres (sans eval) · profils 2D, générateurs, mesures de section
    features.js  interfaces.js         opérations (box, extrude, hole, pocket, shell, fillet…) · interfaces A / B
    family_extrusion.js  family_pcb.js familles de haut niveau compilées en features
    build.js  worker.js  client.js     constructeur de pièce · worker · client à promesses avec cache
    standards.js  materials.js         visserie ISO, ajustements · matériaux et procédés
    templates.js  language_doc.js      gabarits paramétriques · référence du langage (source unique)
web/js/analysis/
    cc_rules.js                        distances requises IEC 60664-1 (tables, altitude, IT, essais)
    cc_geom.js cc_clearance.js cc_creepage.js cc_paths.js   chemins mesurés sur les maillages
    cc_scene.js  cc_worker.js          scène de l'assemblage complet · worker d'analyse
    dfx_core.js dfx_rules*.js dfa_rules.js  règles DFM / DFA / DFx, correctifs déclaratifs
web/js/draw/               feuille PDF et SVG (même API), aides au dessin, composition du dessin d'une pièce
web/js/modules/            un fichier par écran
web/js/onshape/            client du proxy local et orchestration de l'envoi
web/js/demo/               projets de démonstration
tests/node  tests/py       tests (noyau réel, règles, chemins, DFx, dessins · serveur et Onshape simulé)
tools/                     génération des icônes Carnet, de la doc du langage, d'une feuille de démonstration
```

## Le chemin d'une pièce

1. **Spec** (JSON) → `expr.resolveParams` résout les paramètres (y compris dérivés) → `expr.evalDeep` évalue chaque
   nombre écrit comme expression.
2. Les blocs `extrusion` / `pcb` sont compilés en features ; les features s'exécutent dans l'ordre sur des *corps*
   nommés ; les interfaces sont compilées en features (trous, bossages, découpes) et taillées au repère
   `{"op": "interfaces"}` ou à la fin.
3. Le noyau rend, par corps : le solide (gardé dans le worker), son maillage, ses propriétés ; et pour la pièce : les
   repères d'interface, les *faits* (trous, poches, parois, métriques de section) dont se servent les règles DFx.
4. Une feature qui échoue est signalée et sautée : la pièce se construit quand même. Un congé refusé par le noyau
   est retenté arête par arête.

## L'assemblage et la dépendance

- `assembly_logic.candidates` apparie les interfaces libres de même type, de côtés opposés, de même clé (ou de même
  signature géométrique). `autoMate` prend les meilleures, une interface ne servant qu'une fois.
- `assembly_logic.solve` part des pièces fixes et place les autres de proche en proche : les repères des deux
  interfaces coïncident, normales opposées. Un mate redondant est vérifié (écart > 0,05 mm signalé).
- `links.propagate` s'exécute dans la même étape d'annulation que la modification : pour chaque mate *lié*, les
  valeurs évaluées de l'interface modifiée sont comparées à l'autre côté ; si un champ de l'autre pièce est piloté
  par un de ses paramètres (`"dx": "pcbL"`), **c'est ce paramètre qui bouge** — toute la pièce suit ; sinon le champ
  est remplacé.

## Isolation

- `cc_rules.js` porte le moteur de DynamiteAgile 0.50.9 : tension de travail (DC, AC, système IT flottant), tension
  de choc (F.1), clearance (F.2, cas A / B, minimum PD, altitude A.2), creepage par material group (F.4), largeur de
  rainure X, essais après assemblage. Chaque résultat garde les étapes de son calcul.
- `cc_paths.js` mesure sur les maillages de l'assemblage complet : la clearance est le fil tendu dans l'air qui
  contourne les solides (graphe de visibilité sur les arêtes, puis resserrage) ; le creepage est le plus court chemin
  sur les surfaces isolantes (points de Steiner, Dijkstra, rainures plus étroites que X pontées, isolants en contact
  continus, conducteurs flottants traversés sans compter).
- Validation : le produit d'exemple DEMO-HVB, dont les distances sont connues par construction, est reproduit
  (tests `cc_paths.test.mjs`).
- **À décider** : un joint non collé entre deux isolants est aujourd'hui un chemin de creepage mais pas de clearance
  (`opts.jointClearance` l'active). À trancher selon votre lecture de la norme.

## Sécurité

- Le serveur n'écoute que sur `127.0.0.1` ; toute écriture exige l'origine du serveur et l'en-tête `X-DW-Request`.
- CSP stricte sur chaque réponse. Seul le worker du noyau a le droit d'évaluer du code (la colle Emscripten
  d'OpenCascade en a besoin) : il n'a ni DOM ni cookie, et ne peut charger que depuis ce serveur.
- Les clés Onshape sont gardées par le serveur dans `data/` (hors dépôt, fichier protégé) et ne reviennent jamais au
  navigateur. Rien n'est envoyé à Onshape sans l'écran de confirmation.

## Ce qui n'est pas vérifié

- **Onshape** : testé contre un serveur simulé seulement. Voir le tableau « confirmé / non confirmé » de
  [ONSHAPE.md](ONSHAPE.md).
- **Tables IEC 60664-1** : à comparer à votre copie de la norme.
- **Règles DFx** : plusieurs seuils sont des règles de pouce, marquées comme telles dans le livre des règles.
- **Navigateurs** : essayé sous Chromium ; Firefox et Safari restent à essayer.

## Limites de cette itération

- Dessins : cotes hors tout, cotes de détail des opérations simples, motifs de vis, tableau des trous, GD&T des
  interfaces, une coupe A-A hachurée ([DESSINS.md](DESSINS.md)) ; pas de chaîne de cotes, de coupe brisée ni de vue de détail.
- Pas de famille tôlerie pliée (déplié, rayon de pliage).
- Mates : par interfaces uniquement ; pas de contraintes libres entre faces quelconques.
- Une pièce importée en STEP n'a ni paramètres ni dessin ; les noms de ses solides sont lus au mieux.
- À plusieurs : en miroir, synchronisé par Drive ou par échange de fichiers ([EQUIPE.md](EQUIPE.md)) ; pas de temps réel.

## Suite envisagée

1. Entrevue dans l'application avec une clé d'API Claude, en plus du copier / coller.
2. « Envelopper » : générer le boîtier autour des pièces choisies, colonnettes et découpes alignées sur leurs interfaces.
3. Mates et variables natifs Onshape, reliés aux paramètres de la plateforme.
4. Chaînes de cotes le long des interfaces ; coupes brisées et vues de détail dans les dessins.
5. Bibliothèque de pièces standard insérées en 3D depuis la BOM.
6. Revue à plusieurs : messages par artéfact et messages épinglés sur le 3D existent ([EQUIPE.md](EQUIPE.md)) ; restent
   les annotations sur le rapport.


## Itération 2 — ce qui s'est ajouté, et où

| Brique | Fichiers | Rôle |
|---|---|---|
| Matière première | `web/js/cad/stock.js` | formes du commerce, séries de tailles, taille à acheter, conseils |
| Atelier (*Shop*) | `web/js/cad/shop.js` | verbes d'atelier réécrits en opérations du noyau (`expandSpec`, structurel : les formules restent du texte), gamme de fabrication (`routing`) |
| Intention | `web/js/core/shop_intent.js`, `web/js/modules/shop.js` | synthèse déterministe d'une pièce depuis ses interfaces, sa matière et son brut ; écran « Atelier » |
| Format `.dwiz` | `web/js/core/dwiz.js`, `web/js/core/dwiz_names.js` | lecture / écriture génériques et sans perte ; vocabulaire par genre de document |
| Commande | `web/js/cad/order.js`, `web/js/core/zip.js` | verdict « prête à commander », délai, demande de prix, archive du dossier |
| Artéfacts | `web/js/core/artifacts.js`, `web/js/cad/stl.js`, `web/js/draw/dxf.js`, `web/js/cad/featurescript.js` + `fs_*.js` | un générateur pour les téléchargements, Drive et le dossier de commande |
| Physique | `web/js/analysis/physics/*`, `web/js/modules/physics.js` | 21 modèles : `{ inputs, compute → values, checks, steps }`, `run`, `prefill` depuis la pièce |
| PCBA | `web/js/pcba/*` (`model.js` document et géométrie résolue ; `library*.js`, `footprints.js` ; `blocks*.js`, `synth.js`, `erc.js` ; `place.js`, `route*.js` ; `art.js`, `gerber*.js`, `drill.js`, `fabfiles.js` ; `drc*.js` ; `review*.js` ; `status.js`, `twin.js`, `worker.js`), `web/js/modules/pcba*.js` | carte électronique des fonctions aux Gerber ; voir [PCBA.md](PCBA.md) |
| Gammes | `web/js/core/plan_doc.js`, `web/js/cad/process_plan.js`, `web/js/core/asm_plan.js`, `web/js/pcba/assembly_plan.js`, `web/js/modules/plan_view.js`, `part_gamme.js`, `asm_gamme.js` | gamme de fabrication d'une pièce, d'assemblage d'un produit et d'une carte : une même forme, un même écran, un même document (voir `docs/GAMMES.md`) |
| Pièce moulée | `web/js/core/shop_mold.js` (`MOLD_RULES`, `moldProcess`, `molded`), `web/js/core/shop_mold_more.js` (`moldArch`, `moldedCover`, `moldedPlate`, `clipPlan`, `hostOf`), opérations `tub` et `draft` de `web/js/cad/features.js` sur `draft` de `web/js/cad/occ.js`, forme `molded` de `stock.js`, `web/js/analysis/dfx_rules_casting.js` (CST-01 à 08) | la coque d'une pièce moulée écrite depuis le volume à contenir, les interfaces et les chiffres du mouleur par procédé ; règles de fonderie ; `mold` dans le fichier de la pièce |
| Profilé extrudé | `web/js/core/shop_extrusion.js` (`EXTRUSION_RULES`, `extrusionProcess`, `extruded`), générateur de section `fitted` dans `web/js/cad/profile_gen.js` (rainures, crochets, nervures d'appui, canaux de vis en C) — voir [EXTRUSION.md](EXTRUSION.md) |
| Procédés spéciaux | `web/js/cad/special_processes.js` (`LASER_FAMILIES`, `laserProfile`, `laserLimits`, `sheetSeries`, `AM_PROCESSES`, `AM_MATERIALS`, `amLimits`, `printProcess`, `printSteps`, `cutStep`, `processSheet`, `processBrief`, `specialRows`, `SOURCES` : pur), règles `web/js/analysis/dfx_rules_special.js` (`LAS-`, `AM-1x`), écran et carte de l'Atelier `web/js/modules/shop_special.js` (`#/process`), sous-onglets communs `web/js/modules/shop_tabs.js` — voir [PROCEDES.md](PROCEDES.md) |
| Panneaux des studios | `web/js/core/panes.js` (`mountPanes`, `clampPane`, `dragPane`, `readPanes`, `writePanes`) : la bordure d'un panneau latéral se glisse, un panneau se replie (bouton, double clic, Entrée) ; une largeur par écran, gardée dans le navigateur ; posé par `app.js` sur tout `.studio` |
| Arbre du cas de charge | `web/js/analysis/fea/bc_tree.js` (pur), `web/js/modules/fea_tree.js` — voir [SIMULATION.md](SIMULATION.md) ; corps de l'Isolation groupés par type : `web/js/analysis/cc_groups.js` (`bodyGroups`) |
| Sens d'impression | `web/js/analysis/am_supports.js` (`supportReport`, `rankDirections` : pur, sur le maillage de la pièce), onglet `web/js/modules/part_print.js`, mot `print.dir` de la pièce — voir [PROCEDES.md](PROCEDES.md) |
| Santé des accouplements | `web/js/core/joint_health.js` (`jointHealth`, `assemblyHealth`, `HEALTH`, `engagement`) : pur, lit l'assemblage, les pièces construites, le résultat du solveur et les interférences — voir [JOINTS.md](JOINTS.md) |
| Itérations MVP | `web/js/core/mvp.js` (`openIteration`, `freeze`, `snapshot`, `convergence`, `trend`, `criteria`, `recordReview`, `closeIteration`, `reviewPackage`, `readReviewAnswer`, `applyReview`, `agenda`), écran `web/js/modules/mvp.js` (`#/mvp`) — voir [ITERATIONS.md](ITERATIONS.md) |
| Équipe (miroirs) | `web/js/core/team.js` (`joinTeam`, `forkMirror`, `stampLocal`, `mergeMirror`, `resolveConflict`, `post`, `setDone`, `inbox`, `threads`, `teamRows` : pur — lignée par artéfact, aucune copie centrale), `web/js/core/team_sync.js` (`readMirrors`, `applyMirrors`, `linkMirror`, `parseMirror` : lecteur injecté), `web/js/google/picker.js` (sélecteur de fichiers de Google : `loadPicker`, `pickFile`, `appIdOf`), `share` dans `web/js/google/drive.js`, écran `web/js/modules/team.js` (`#/team`), messages épinglés sur le 3D : `pinsOf` et `web/js/modules/view_pins.js` (`mountPins`, monté par le studio de pièce et l'assemblage) — voir [EQUIPE.md](EQUIPE.md) |
| Révisions libérées | `web/js/core/plm.js` (`planRelease`, `release`, `formFitFunction`, `compatibility`, `restore`, `releaseFiles`, `newReference` : pur — numéros, révisions figées, règle 3F, pièces gelées dans l'assemblage), écran `web/js/modules/plm.js` (`#/plm`) — voir [REVISIONS.md](REVISIONS.md) |
| Bibliothèque électrique | `web/js/cad/elec_library.js` (`CONNECTORS`, `CELLS`, `ELEC_STANDARDS`, `pickConnectors`), `web/js/core/elec_parts.js` (`connectorPart`, `cellPart`), `web/js/cad/interfaces_elec.js` (types `weld` et `contact`, `contactEstimate`, `weldEstimate`), écran `web/js/modules/library.js` (`#/library`) — voir [ELECTRIQUE.md](ELECTRIQUE.md) |
| Bascule aperçu / code | `web/js/core/code_sources.js` (`elementFor`, `codeSources`, `aiCodePrompt` : pur), `web/js/core/code_view.js` (le bouton de la barre du haut et le panneau de code) — voir [IA.md](IA.md) |
| Circuit flexible | `web/js/core/flex.js` (`flexPart`, `allTracks`, `layTracks`, `trackAmps`, `addSensor`, `fitSensor`, `flexChecks`), écran `web/js/modules/flex.js` (`#/flex`) ; géométrie de bande partagée avec `core/busbar.js` — voir [ELECTRIQUE.md](ELECTRIQUE.md) |
| Busbar laminé, pad thermique, remplissage | `web/js/core/busbar_lam.js` (`laminatePart`, `laminateChecks`, `lamFlexTracks` — le circuit de mesure pris entre deux plaques —, `thermalPadPart`), `web/js/cad/fill.js` (`fillCavity`, appelé par le noyau : `fill`), `web/js/modules/asm_fill.js` — voir [ELECTRIQUE.md](ELECTRIQUE.md) |
| Busbars | `web/js/core/busbar.js` (`busbarPart`, `legsOf`, `stripProfile`, `locate`, `addContact`, `addTerminal`, `fit`, `busbarChecks`), écran `web/js/modules/busbar.js` (`#/busbar`) — voir [ELECTRIQUE.md](ELECTRIQUE.md) |
| Dessins | `web/js/draw/dim_model.js` (`dimensionList`, `setDimClass`, `classNotes` : toutes les cotes d'une pièce, numérotées, classées), `web/js/draw/part_drawing.js` (`composeDrawing` : feuille tabloïd), `web/js/draw/asm_drawing.js` (`composeAssemblyDrawing`, `placeBalloons`), noyau `hlrAsm` — voir [DESSINS.md](DESSINS.md) |
| Révisions et cas d'emploi | `web/js/core/review.js` (`partsOf`, `staleParts`, `whereUsed`, `revisionRows`) : un assemblage retient la révision de chaque pièce avec laquelle il a été revu |
| Premier design | `web/js/core/first_design.js` (`firstDesignPrompt`, `readFirstDesign`, `adoptIteration`), `web/js/modules/first_design.js`, `web/js/demo/demo_first_design.js` (écrit par `tools/gen_first_design_example.mjs`) | le prompt d'entrevue ; la lecture du fichier rendu — pièces validées, carte reconstruite depuis ses blocs, analyses calculées ici ; l'aperçu avant création |
| Revue de conception | `web/js/core/review.js` (`reviewItems`, `approve`, `askRevision`, `markDrafts`, `changedKeys`, `iterationRequest`, `signature`), `web/js/modules/review.js` | état de chaque artéfact, signature du contenu revu, révisions, demande d'itération complète ; écran « Revue » |
| Échange avec DynamiteAgile | `web/js/core/dynamite.js` (`toProjectStarter`, `checkStarter`, `importDiamond`, `starterKey`) | l'arbre fonctionnel, la structure fonctionnelle et les pièces au format « dynamite-project-starter » ; les règles de ce format ; l'arbre d'un fichier lu dans une carte, en brouillon |
| Joints | `web/js/core/assembly_logic.js` (`joints`, `jointsCsv`, `nextJoint`, `hardware`), type `bond` et `ADHESIVES` de `web/js/cad/interfaces.js`, étapes de collage et d'encliquetage de `web/js/core/asm_plan.js` | registre des joints numérotés ; interfaces internes ou externes ; joint collé à plots de calage, colle en nomenclature et en gamme ; interférence cherchée après chaque montage |
| PCBA, briques mobiles | `web/js/pcba/move.js` (`moveGroup`, `pruneCopper`, `followMoves`), option `keep` et passe de finition de `route.js`, `blocks_io.js`, `blocks_link.js`, `library_more.js` | un bloc ou un composant se déplace avec son cuivre et la carte se reconnecte ; 26 sous-circuits et 30 composants de plus |
| PCBA, tracé manuel | `web/js/pcba/manual.js` (`copperFaults`, `snapPoint`, `addTrack`, `addVia`, `moveCorner`…), `web/js/modules/pcba_trace.js` | une piste tracée clic par clic, vérifiée contre les règles de son net avant d'être posée ; sélection, suppression, sommets |
| Le modèle sous la souris | `web/js/core/viewport.js` (les gestes communs à toutes les vues 3D : sélection, mesure dans le repère de la vue, clic droit, raccourcis ; un écran ajoute les siens par `menuFor`, `onKey`, `keys`), `web/js/core/view_select.js` (ce que vise un clic, sélection, mesure, menu), `web/js/core/view_marks.js` (face allumée, symboles d'appui et d'effort), `web/js/modules/part_gestures.js` | sélection de faces, d'arêtes et de points, Ctrl + clic, clic droit, raccourcis ; dialogues flottants liés à la vue ; bascule de coupe dans toutes les vues |
| Garde-fous de co-intelligence | `web/js/core/ai_draft.js` (`markAiDraft`, `confirmDraft`, `draftsOf`, `normsIn`) | ce qu'une IA ajoute ou modifie est un brouillon jusqu'à confirmation ; une norme citée attend son édition et sa clause ; la revue en dépend |
| Structure fonctionnelle | `web/js/pcba/structure.js`, `web/js/core/drawio.js` | sous-systèmes, entrées, sorties et flux tirés de la carte ; arbre des fonctions et structure en pages draw.io modifiables |
| Aller-retour IA | `web/js/core/ai_loop.js`, `web/js/modules/ai_loop.js` | exporter un artéfact avec une demande, relire la réponse, lister les changements, appliquer en une étape |
| Simulation | `web/js/analysis/fea/*` (`voxel.js`, `hex8.js`, `solve.js`, `index.js`, `precheck.js`, `symmetry.js` — symétries et coupes —, `worker.js`), `web/js/modules/fea.js`, `web/js/modules/fea_cuts.js` | maillage en cubes identiques, hexaèdre à modes incompatibles, gradient conjugué sans matrice ; structure, thermique et thermo-mécanique (dilatation α (T − T de montage)) ; estimation analytique avant calcul et recoupement |
| Google | `web/js/google/auth.js`, `drive.js`, `drive_fs.js`, `web/js/config.js` | jeton en mémoire, portée `drive.file`, arborescence du projet |
| Accès | `web/js/core/access.js`, `web/js/core/gate.js`, `web/acces.json`, `web/js/modules/account.js` | porte de la démo hébergée, empreintes de comptes, administrateur |
| Thèmes | `web/css/themes.css`, `web/js/core/theme.js`, `web/js/boot.js` | jetons CSS par `html[data-theme]` ; la vue 3D lit `--view-edge` |

Règles tenues : modules ES sans outil de construction ; aucune dépendance npm ; fichiers source de moins de
500 lignes ; DOM construit avec `el()` et `textContent` ; une nouvelle brique = un module pur et testé, un écran, une
entrée dans le rapport, et ses mots dans `dwiz_names.js`.

Ordre de construction d'une pièce : paramètres → `expandSpec` (brut et verbes d'atelier → opérations du noyau) →
blocs de famille (`extrusion`, `pcb`) → opérations → interfaces → opérations placées après `do interfaces`.
