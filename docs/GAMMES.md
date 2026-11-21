# Les gammes — parler fabrication avec le fournisseur, montage avec le prototypage

Une **gamme** dit comment une chose se fait, étape par étape. DesignWizard.ai en écrit trois, tirées du modèle,
chacune pour un interlocuteur précis :

| Gamme | Où | Pour parler avec | Ce qu'elle porte |
|---|---|---|---|
| **Fabrication** d'une pièce | Pièces → onglet « Gamme » | le fournisseur | phases (débit, posages d'usinage, reprises, ébavurage, traitement sous-traité, contrôle, emballage), prise de pièce, opérations avec outils et contrôles, caractéristiques à tenir tirées des interfaces |
| **Assemblage** d'un produit | Assemblage → onglet « Gamme » | les ingénieurs de prototypage | une étape par pièce, dans l'ordre que donnent les interfaces accouplées ; vis, couples indicatifs, clés, contrôles, visserie totale |
| **Assemblage d'une carte** | PCBA → étape « Fabrication » | l'assembleur de cartes | pâte, pose, refusion, inspection, traversants, nettoyage, programmation et essai, vernis, contrôle final — avec ce que la carte demande (boîtiers à pas fin, zones à épargner) |

Ce sont des **propositions** : la gamme de l'atelier fait foi. Elles servent à ouvrir la discussion avec les bons
mots, et à garder ce qui s'y dit.

## Ce que montre l'écran

- **Les phases**, numérotées de dix en dix (10, 20, 30…), leurs opérations (20.1, 20.2…), l'outillage, le contrôle de
  chaque opération.
- **La vue, étape par étape.** Un clic sur une phase montre la pièce *telle qu'elle est après cette phase* (les
  opérations suivantes sont retirées et la pièce est reconstruite), ou le produit *tel qu'il est à cette étape du
  montage*, la pièce en cours surlignée. Un second clic revient à l'ensemble.
- **L'ordre de montage** se change avec les flèches ; un lien revient à l'ordre tiré des interfaces.
- **Une note par phase** : ce que l'atelier propose, ce qui est convenu.
- **Les points à discuter** : des questions tirées du modèle (brut en stock ? taraudage coupé ou déformé ? posages à
  regrouper ? couples à confirmer ? pochoir, mires, masquage du vernis ?) et les vôtres.
- **Les sorties** : Word et PDF (phases, images de chaque étape, tableau des questions avec une colonne « Réponse »,
  signatures), texte brut pour un courriel, copie dans le presse-papiers. La gamme de fabrication part aussi dans le
  dossier de commande de la pièce ; celle de la carte, dans son dossier de fabrication.

## L'atelier de fab — la gamme jouée, étape par étape

Le dernier écran du groupe **Mécanique**, « Atelier de fab » (`#/fab/<pièce>`), joue la gamme de fabrication d'une
pièce comme on la ferait voir à un stagiaire ou à un fournisseur : de la réception du brut au conditionnement. Il
s'ouvre sur la **gamme par défaut** (choix de JP), le bouton « IA » à sa place habituelle, en tête du volet de gauche.

**Ce qui se joue, et ce qui ne se joue pas** (JP, 21 novembre : « seules les pièces machinées et moulées, extrudées,
stampées ou découpées au laser peuvent être animées… tu ne devrais pas rendre une démo de la gamme qui est fausse ») :
les pièces **usinées** (fraisage, tournage), **moulées ou coulées**, **extrudées**, **embouties** (tôlerie) ou
**découpées au laser**. Une carte nue, un circuit flexible, une pièce achetée ou laminée (un busbar laminé), une
impression 3D ne se jouent pas : la marge de gauche les nomme, avec la raison, et leur gamme écrite reste dans l'onglet
« Gamme » de la pièce ; la marche vers le bas d'une pièce ne propose l'atelier que pour une pièce qu'il joue
(`fabPlayable` de `web/js/core/fab_path.js`).

**L'outil qui usine, le long d'un parcours écrit par une IA** (même message : « voir l'outil d'usinage bouger
seulement pour les pièces usinées ou sur-usinées après moulage métallique… simuler un parcours d'usinage avec les
allers-retours IA… et mentionner la possibilité pour forcer les gens à le demander à Claude ») : l'outil ne bouge que
dans une phase d'usinage — les posages d'une pièce usinée ou extrudée, les reprises d'une pièce coulée (`toolMoves`).
L'outil **n'écrit pas** le parcours : il est demandé à Claude, ou à l'IA de son choix, par « Demander le parcours à
Claude », qui ouvre l'aller-retour de la pièce avec la demande déjà écrite (la phase, ses opérations, les perçages de sa
face, la boîte de la pièce, le repère, le format). La réponse revient comme toute réponse : un aperçu, la validation,
une étape annulable, le journal. Le parcours se range dans la pièce :

```dwiz
plan paths={"setup:-Z": [{tool: drill, d: 3.3, by: "Claude (IA)", note: "…", gcode: "G21 G90\nG0 X10 Y10 Z-30\nG83 X10 Y10 Z6 R-2 Q2\nG80"}]}
```

Une passe : un outil (`center`, `drill`, `tap`, `reamer`, `endmill`, `facemill`, `chamfer`, `boring`, `turning`), son
diamètre, et son parcours — un G-code simple (G0, G1, G2 / G3 dans le plan XY avec I et J, cycles de perçage G81 à G85
avec R, en mm et en absolu) ou une liste de positions `[g, x, y, z]` —, **dans le repère de la pièce**, le point étant
le bout de l'outil. L'écran le lit (ce qu'il ne lit pas est dit : pouces, incrémental, un code inconnu), le vérifie
contre la pièce d'avant la phase — un outil qui descend dans l'étau, un rapide qui entre dans la matière, un repère qui
n'est pas celui de la pièce — et l'anime : la pièce d'avant la phase, l'outil le long du parcours (le travail dans sa
couleur, les rapides en pointillé), puis la pièce d'après. « Jouer la gamme » et le film usinent là où un parcours est
écrit ; le diaporama dit qui l'a écrit. Trois exemples, écrits par une IA pour la démonstration : le dissipateur du
variateur (pointage, perçage et taraudage par-dessous ; la note dit pourquoi le taraudage n'a que 4 mm utiles), le
disque de la fusée (perçages débouchants), la jupe de tuyère (dressage, chariotage et alésage au tour).

**Au tour**, la pièce est couchée dans l'axe du mandrin, le bout travaillé libre ; une face radiale (un perçage en
travers, un méplat : outil motorisé) est tournée vers le haut. **Une pièce dont toute la forme vient de l'usinage** —
rien ne reste après le débit — part d'un **brut supposé**, dit comme tel : la boîte de la pièce ; au tour, une barre,
ou un tube si la pièce est creuse de bout en bout, avec 1 mm de surépaisseur (`blankSpec`).

- **Chaque phase a son poste**, dessiné par l'outil : scie à ruban pour le débit d'une barre, table de découpe laser
  pour un flan, moule ouvert pour une pièce moulée ou coulée, plateau d'impression, filière d'extrusion, étau sous la
  broche pour un posage de fraisage, mandrin à trois mors pour le tour, presse plieuse, établi d'ébavurage, bac de
  traitement, marbre de contrôle, carton. **La pièce est tournée vers l'outil** — la face usinée regarde la broche (en
  haut), ou la tourelle du tour (vers +X) — et posée sur le montage, sans qu'aucun mors n'entre dans la matière. Avant
  le pliage, une tôle se voit **à plat** (le flan développé de la vue « Plié · À plat »).
- **La pièce après chaque phase** : celle que l'onglet « Gamme » montre déjà (les opérations suivantes retirées), avec
  son encombrement et sa masse, dits dans le volet de droite et sur la diapositive.
- **Jouer la gamme** enchaîne les étapes ; ← et → passent de l'une à l'autre.
- **L'ordre est celui de l'atelier** : les étapes se glissent dans le flux (ou se déplacent par leurs flèches) ; l'ordre
  est gardé dans la pièce (`plan order=[…]`), la gamme le suit partout — l'onglet « Gamme », ses documents, le dossier de
  commande — et se renumérote de dix en dix. Le guide dit ce qu'un ordre dérange : brut qui n'est pas en tête,
  ébavurage ou traitement avant le dernier usinage, contrôle trop tôt, conditionnement qui n'est pas le dernier. « Revenir
  à l'ordre de l'outil » efface l'ordre gardé, en une étape annulable.
- **Partager avec le fournisseur** : un **diaporama** `.pptx` — une page de titre, une diapositive par phase avec l'image
  de l'étape, son poste, sa prise de pièce, ses opérations et ses outils, ses contrôles, les mesures après la phase, et
  un **cadre « Réponse du fournisseur »** —, un **film** `.webm` des étapes, le titre de chaque étape incrusté, et la gamme
  en Word, PDF ou texte, avec ses images. Tous portent la marque et la note de confidentialité du projet.
- **La réponse du fournisseur** se tape, phase par phase, dans le volet de droite (`plan comments`), à côté de la note
  de l'atelier ; elle repart dans le diaporama suivant et voyage dans le `.dwiz`.

```dwiz
plan order=[stock, "setup:-Z", "setup:+Z", deburr, check, pack] comments={stock: "Barre de 50 en stock, deux semaines."}
```

Les montages sont des **montages de PRINCIPE**, fabriqués par l'outil : aucune machine, aucun montage, aucune marque
de fabricant ; l'atelier choisit les siens, et l'écran, le diaporama et le film le disent. Ce n'est pas une simulation
d'usinage : un parcours d'IA n'est pas un programme de machine — ni vitesses ni avances réelles, ni compensation de
rayon, ni collision du porte-outil, ni enlèvement de matière en continu, ni efforts de coupe.

## Ce qui est gardé, et où

La gamme elle-même n'est **pas** enregistrée : elle se recalcule du modèle, donc elle ne peut pas le contredire. Ce
qui est gardé, c'est ce que l'humain y ajoute, sous `plan`, dans l'artéfact :

```dwiz
# dans une pièce
plan
  notes
    "setup:-Z" "Le fournisseur propose un taraudage par déformation."
  point "Demander un essai d'anodisation sur une chute."

# dans un assemblage
plan order=[i1, i5, i3, i2, i4]
  notes i5="Monter le dissipateur en premier : accès par dessous."
  point "Faut-il un gabarit de vissage ?"
```

`notes` range une note par **clé de phase** (`stock`, `setup:<face>`, `rework`, `deburr`, `surface`, `check`, `pack`
pour une pièce ; l'identifiant de la pièce posée ou `final` pour un assemblage ; `prep`, `paste_top`, `place_top`,
`reflow_top`, `inspect`, `tht`, `clean`, `test`, `coat`, `final` pour une carte). `order` fixe l'ordre de montage.

## Aller-retour IA

Le bouton « IA » de la gamme ouvre le dialogue habituel ([IA.md](IA.md)) sur l'artéfact, et joint la gamme calculée
**pour référence**, avec les clés de ses phases. On peut donc demander, comme à un technicien : « ajoute une note à
chaque phase d'usinage sur le bridage », « propose trois points à voir avec l'anodiseur », « monte le dissipateur
avant les cartes ». La réponse revient, l'écran liste les changements, l'humain valide.

## Limites, dites franchement

- Les **couples de serrage** sont des valeurs usuelles (vis de classe 8.8, abaissées pour les cartes, les inserts et
  les filets dans l'alliage léger) : à confirmer par un essai de serrage.
- Les **postes** et les **prises de pièce** sont génériques ; la gamme ne connaît pas le parc de machines de votre
  fournisseur.
- L'état de la pièce après une phase vient de l'arbre de construction : une forme faite en plusieurs phases chez
  l'atelier apparaît dans la phase de son opération.
- Ces gammes n'ont pas encore été relues par un atelier ni par un assembleur.
- L'atelier de fab montre **une image par étape** : la caméra ne vole pas d'un poste à l'autre ; l'outil ne bouge que
  dans une phase d'usinage dont le parcours a été écrit, et le parcours se lit selon l'usage des commandes numériques
  (ISO 6983 non lue ; chaque constructeur a ses variantes). Le brut d'une pièce tout usinée est supposé. Les gestes
  d'un moule, d'une presse plieuse ou d'une filière ne sont pas animés. Le diaporama n'a pas été ouvert dans PowerPoint — il a été relu par python-pptx et
  rendu par LibreOffice. Le film est en WebM (VP9 ou VP8, selon ce que le navigateur enregistre).

## Dans le code

| Fichier | Rôle |
|---|---|
| `web/js/core/plan_doc.js` | la forme commune d'une gamme ; `finishPlan`, `planText`, `planDoc`, `planSummary`, `planKeys` |
| `web/js/cad/process_plan.js` | `processPlan(spec, built)` : gamme de fabrication ; `stateSpec` : la pièce après une phase |
| `web/js/core/asm_plan.js` | `assemblyOrder`, `assemblyPlan(asm, project)` : gamme d'assemblage |
| `web/js/pcba/assembly_plan.js` | `boardAssemblyPlan(board, lib)` : gamme d'assemblage d'une carte |
| `web/js/modules/plan_view.js` | l'écran commun : phases, notes, points, sorties, bouton IA |
| `web/js/modules/part_gamme.js`, `asm_gamme.js`, `pcba_out.js` | les trois onglets |
| `web/js/core/fab_scene.js` | l'atelier de fab : `stationKind`, `placeFor` (la pièce tournée vers l'outil), `fixtureOf`, `sceneOf` |
| `web/js/core/fab_flow.js` | l'ordre de l'atelier : `flowKeys`, `moveKey`, `dropKey`, `orderIssues`, `stepMeasures` |
| `web/js/core/pptx.js` | un diaporama `.pptx` écrit à la main (16:9, marque, note, pages) |
| `web/js/core/fab_path.js` | ce que l'atelier joue (`fabPlayable`), où l'outil bouge (`toolMoves`), le G-code lu (`parseGcode`), les passes (`passesOf`), leurs défauts (`pathIssues`), l'animation (`timeline`, `tipAt`), la demande à l'IA (`pathAsk`) |
| `web/js/demo/demo_paths.js` | les parcours d'exemple, écrits par une IA pour trois pièces des démonstrations |
| `web/js/modules/fab.js`, `fab_out.js` | l'écran de l'atelier ; le diaporama et le film |
| `tests/node/fab_shop.test.mjs`, `fab_path.test.mjs` | postes, placement sans interférence, ordre gardé et suivi, diaporama, branchements ; ce qui se joue, le G-code lu, les défauts d'un parcours, les exemples propres contre la pièce, le brut supposé |
| `tests/node/plans.test.mjs` | les trois gammes, leurs textes et leurs documents |
