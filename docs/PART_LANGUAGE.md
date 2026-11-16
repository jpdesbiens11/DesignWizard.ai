<!-- Fichier généré par tools/gen_docs.mjs à partir de web/js/cad/language_doc.js : ne pas modifier à la main. -->
# Le langage de pièce de DesignWizard.ai (DW part/1)

Une pièce est un document `.dwiz` (voir [FORMAT.md](FORMAT.md)) ou son jumeau JSON. C'est ce que Claude écrit à la fin de
l'entrevue, ce que montre l'onglet Fichier du studio de pièce, et ce que le noyau construit. La référence ci-dessous est
exactement le texte donné à l'assistant dans le prompt générique
(elle est en anglais parce que les clés du langage le sont).

```text
# DesignWizard part language — DW part/1

A part is ONE JSON object. Units: millimetres, degrees, grams. Axes: X to the right, Y to the back, Z up.
Every number may be an expression of the part parameters: "L/2 - 10", "max(t, 2)", "W - 2*wall".
Functions: min max abs sqrt floor ceil round sin cos tan (degrees) hypot clamp(v,lo,hi) if(cond,a,b), constant pi.

## 1. Skeleton
{
  "dw": "part/1",
  "id": "PN-0001",                      // part number (letters, digits, - _)
  "name": "Short name of the part",
  "function": "One sentence: what the part does in the product.",
  "family": "prismatic | plate | sheet | enclosure | extrusion | pcb | busbar | turned | purchased",
  "process": "cnc_milling | cnc_turning | sheet_metal | laser_cut | extrusion_al | extrusion_plastic | injection_molding | die_casting | lp_die_casting | permanent_mold | sand_casting | fdm | mjf | sla | lpbf | pcb | purchased",
  "material": "AL6061-T6 | AL6063-T5 | AL5052-H32 | CU-C110 | BRASS-360 | SS-304 | STEEL-1018 | PA66-GF30 | PC | PC-ABS | ABS | PBT-GF30 | PPS-GF40 | POM | PEEK | PEI-9085 | PA12 | PVC-U | SILICONE | FR4 | FR4-CTI600",
  "elec": { "kind": "conductor | insulator | chassis | none", "net": "HV+" },   // electrical role (isolation analysis); optional
  "intent": { "loads": "20 N at the tip, vibration", "environment": "-20..60 °C, indoor", "quantity": 50, "priority": "cost | mass | stiffness | lead_time" },   // optional: why the part exists
  "params": { ... },                    // section 2
  "interfaces": [ ... ],                // section 3 — START HERE: interfaces first
  "stock": { ... },                     // section 4 — the raw material taken from the rack (replaces the first feature)
  "features": [ ... ],                  // sections 4 and 5 — Shop operations and kernel features, in order
  "extrusion": { ... },                 // section 6 (family extrusion) — replaces the first feature
  "folded": { ... },                    // section 6b (folded sheet metal) — replaces the stock and the first feature
  "pcb": { ... },                       // section 7 (family pcb)
  "notes": ["Drawing note 1", "..."],   // notes printed on the 2D drawing
  "finish": "Anodised black 10 µm",
  "look": { "color": "#3d86e6", "opacity": 0.6 },   // optional: the colour of the part ON SCREEN, to tell parts apart (not a finish; leave it out and the part shows the colour of its material)
  "interview": { "questions": [ {"q": "...", "a": "..."} ], "assumptions": ["..."] }   // what was asked and assumed
}

## 2. Parameters — the intuitive handles of the part
"params": {
  "L": { "value": 120, "min": 60, "max": 300, "step": 1, "unit": "mm", "label": "Length", "group": "Envelope" },
  "wall": 3,                                      // short form
  "half": { "expr": "L/2" }                       // derived (read-only)
}
Give every dimension a human would want to tune as a parameter (5 to 15 of them), with a label and sensible min / max.
Use the parameters everywhere else instead of raw numbers.

## 3. Interfaces — the contract with the neighbouring parts
An interface is shared by two parts: side "A" on one part, side "B" on the other, SAME "type", SAME "key", SAME "params".
The platform generates the holes / bosses / cut-outs of each side, mates the parts automatically in the assembly, links the
parameters (change one side, the other follows), adds the screws to the BOM and writes the GD&T of the drawing.
{
  "id": "IF1", "type": "bolt_pattern", "name": "PCB mounting",
  "key": "ctrl_pcb_mount",              // same key on the partner part = same interface
  "partner": "Control PCB",             // who is on the other side (name of the neighbour)
  "external": true,                     // only when it looks outside the product (customer chassis, wall, cable): no part of the project mates with it
  "side": "A",                          // "A" or "B" (see each type)
  "face": "+Z",                         // face carrying the interface: "+Z" top, "-Z" bottom, "+X" right, "-X" left, "+Y" back, "-Y" front
  "at": ["L/2", "W/2"],                 // position of the interface origin on that face, in MODEL coordinates of the face plane:
                                        //   [x, y] on ±Z   ·   [x, z] on ±Y   ·   [y, z] on ±X
  "level": "wall + 6",                  // optional: height of the mating plane along the face axis (default: the outside of the part)
  "rot": 0,                             // optional rotation of the pattern about the face normal
  "params": { ... }, "opts": { ... }
}
Types (params are shared, opts belong to one side):
- "bolt_pattern": params { "screw": "M2|M2.5|M3|M4|M5|M6|M8|M10|M12", "pattern": {"type":"rect","nx":2,"ny":2,"dx":70,"dy":50} | {"type":"circle","n":6,"pcd":60,"start":0} | {"type":"points","pts":[[u,v],...]} | {"type":"single"} }
    side A = clearance holes (the screw enters here): opts { "fit": "close|medium|loose", "head": "none|cbore|csink", "depth": "through" | number }
    side B = threaded side: opts { "thread": "tapped|insert|clearance", "depth": number, "standoff": {"h": 6, "d": 7} }   // standoff = raised boss; then "level" is the TOP of the boss
- "planar": params { "w": 40, "h": 30 } — two flat faces in contact (thermal pad, sealing plane, datum). opts B { "pad": 0.5 } raises a pad.
- "fit": params { "d": 12, "length": 8, "fit": "H7/g6" } — A = shaft (boss), B = bore.
- "cutout": params { "shape": "rect"|"round", "w": 20, "h": 10, "r": 1, "d": 12, "fix": {"screw":"M3","n":2,"pitch":28} } — A = panel (opening + fixing holes; ALWAYS give opts {"depth": wall thickness + 0.5} on a hollow part), B = the component mounted in it.
- "rail": params { "t": 1.6, "depth": 3, "length": 60 } — A = tongue (board edge, rib), B = groove; the rail runs along the first axis of "at".
- "pins": params { "d": 4, "pitch": 40, "n": 2, "length": 12 } — A = slip-fit holes, B = press-fit holes.
On a hollow part, bolt_pattern side A must also give opts {"depth": ...} or the holes cross the whole part.

## 4. Raw stock and Shop operations — make the part the way a craftsman would
PREFERRED for machined, cut and turned parts: say which raw stock is taken from the rack, then list the Shop operations.
The platform builds the solid, picks the commercial size to buy, writes the routing sheet and reports the material utilisation.
"stock": { "form": F, ...finished size of the blank }      // min corner at the origin; L along X, W along Y, t / H along Z
  F = "plate"     {"L","W","t"}            rolled plate (standard thicknesses 3 4 5 6 8 10 12 15 16 20 25 30 40 50…)
    | "sheet"     {"L","W","t"}            thin sheet, laser cut (0.5 0.8 1 1.2 1.5 2 2.5 3 4 5 6)
    | "block"     {"L","W","H"}            sawn block machined on several faces
    | "bar_flat"  {"w","h","L"}            flat or square bar; runs along X ("axis":"Y"|"Z" to change)
    | "bar_round" {"d","L"}                round bar, centred on its axis, Z by default — the stock of turned parts
    | "tube_round" {"d","t","L"} | "tube_rect" {"w","h","t","L"} | "angle" {"a","b","t","L"}     // commercial sections
    | "profile"   {"profile":P,"L"}        custom extruded section
    | "print"     {}                       additive: no blank, the features below ADD the material
    | "molded"    {}                       moulded (injection, die casting, gravity casting): no blank either
Shop verbs (entries of "features", same common fields and face / position conventions as section 5):
- {"op":"drill", "face":"+Z", "at":POS, "d":5.5, "depth":"through"|12}
- {"op":"tap", "face":"+Z", "at":POS, "thread":"M4", "depth":8}            // tap drill + thread
- {"op":"cbore", "face":"+Z", "at":POS, "screw":"M5"}                      // clearance hole + counterbore for a cap screw
- {"op":"csink", "face":"+Z", "at":POS, "screw":"M4"}                      // clearance hole + 90° countersink
- {"op":"ream", "face":"+Z", "at":POS, "d":8, "fit":"H7", "depth":10}
- {"op":"mill", "face":"+Z", "rect":[x,y,w,h], "r":3, "depth":5}           // closed pocket ("r" ≥ tool radius); also "circle", "profile"
- {"op":"groove", "face":"+Z", "from":[x,y], "to":[x,y], "w":6, "depth":3}
- {"op":"face", "face":"+Z", "to":z}                                       // mill the whole face down to level z
- {"op":"step", "face":"+Z", "rect":[x,y,w,h], "to":z}                     // open shoulder: remove everything beyond level z over the rectangle
- {"op":"outline", "profile":P}                                            // cut the contour of a plate / sheet (laser, waterjet, router)
- {"op":"turn", "from":z0, "to":z1, "d":12}                                // round stock: reduce the diameter between two positions along the axis
- {"op":"bore", "d":6, "depth":20, "face":"+Z"}                            // hole on the axis of a turned part
- {"op":"break_edges", "d":0.5, "edges":SEL}   ·   {"op":"deburr"}   ·   {"op":"finish", "note":"Anodised black"}
Every verb becomes one line of the routing sheet. Kernel features of section 5 may be mixed in the same list.

## 5. Features — kernel operations, built in order
Common fields: "op", optional "id", "name", "body" (default "main"), "mode": "add" | "cut", "suppressed": true.
- {"op":"box", "size":[sx,sy,sz], "at":[x,y,z]}                       // "at" = min corner (default 0,0,0); or "center":[x,y,z]
- {"op":"cylinder", "d":10, "h":20, "at":[x,y,z], "axis":"Z"}         // "at" = centre of the base
- {"op":"extrude", "profile":P, "plane":"XY|XZ|YZ", "at":0, "length":10, "symmetric":false, "mode":"add|cut"}
      // XY extrudes along +Z, XZ along +Y, YZ along +X; "at" = position of the sketch plane along that axis
- {"op":"revolve", "profile":P, "plane":"XZ", "axis":"Z", "angle":360}
- {"op":"hole", "face":"+Z", "at":POS, "d":4.5, "depth":"through"|8, "thread":"M4", "cbore":{"d":8,"depth":4.4}, "csink":{"d":9,"angle":90}, "start":z}
      // with "thread" and no "d", the hole takes the tap drill diameter. "start" = level of the face (default: outside of the part)
- {"op":"pocket", "face":"+Z", "rect":[x,y,w,h], "r":3, "depth":5}     // or "profile":P, "circle":[cx,cy,d], "slot":[x1,y1,x2,y2,w]; "depth":"through"
- {"op":"pad", "face":"+Z", "rect":[x,y,w,h], "r":0, "h":2, "start":z} // raised counterpart of pocket
- {"op":"slot", "face":"+Z", "from":[x,y], "to":[x,y], "w":5, "depth":3}
- {"op":"boss", "face":"+Z", "at":POS, "d":8, "h":6, "start":z, "hole":{"thread":"M3","depth":6}}
      // "tip": top diameter — makes a POINTED boss (a cone from "d" at the foot to "tip" at the top: an embossed contact or welding projection)
- {"op":"coil", "d":6, "di":4, "r":40, "r1":60, "h":120, "turns":8, "at":[x,y,z], "axis":"Z"}   // a tube wound in a helix (cooling coil, spring): "at" = centre of the base, "r" = radius of the centre line there, "r1" at the top (a cone when it differs), "d" = tube diameter, "di" = its bore (0 or absent: solid); the pitch h / turns must exceed d
- {"op":"arch", "face":"+Z", "at":POS, "l":6, "w":2, "h":0.6, "t":0.3, "dir":[0,1]}   // a spring blade formed in a strip: an arch of span l along dir (in the face plane), w wide, rising by h; t = blade thickness (hollow under it)
- {"op":"shell", "t":2.5, "open":["+Z"]}                              // hollow the part, removing the listed faces
- {"op":"tub", "size":[L,W,H], "wall":2.5, "rc":4, "rf":4, "draft":1}   // moulded shell open on +Z: one wall everywhere, outside radii rc (corners) and rf (floor), real draft in degrees (the rim keeps L x W, the floor is narrower)
- {"op":"draft", "angle":1, "pull":"+Z", "neutral":z}                    // lean the faces of the body that run along the pull; do it before the fillets
  "draft": degrees is also accepted by "boss" (a cone, diameter kept at the top) and "pad" (wider at its foot): moulded bosses and ribs
- {"op":"fillet", "r":2, "edges":SEL}   ·   {"op":"chamfer", "d":0.5, "edges":SEL}
- {"op":"interfaces"}                                                 // optional marker: interface geometry is cut here (default: after all features)
Face-based features (hole, pocket, pad, slot, boss) take 2D positions in MODEL coordinates of the face plane ([x,y] on ±Z, [x,z] on ±Y, [y,z] on ±X).
POS = [x,y] | [[x,y],[x,y],...] | {"grid":{"origin":[x,y],"nx":2,"ny":3,"dx":20,"dy":15}} | {"circle":{"center":[x,y],"n":6,"d":50,"start":0}}
SEL = "all" | "vertical" | {"dir":"X|Y|Z"} | {"face":"+Z"} | {"box":[x0,y0,z0,x1,y1,z1]} | {"near":[x,y,z],"tol":1} (keys combine)
P (profile) = {"rect":[x,y,w,h],"r":2} | {"circle":[cx,cy,d]} | {"slot":[x1,y1,x2,y2,w]}
            | {"poly":[[x,y],[x,y,r],...],"r":0}        // polygon; a vertex may carry its own fillet radius as 3rd value
            | {"path":"M0 0 L10 0 A5 5 0 0 1 15 5 Z"}    // SVG path, y up
            | {"outer":P,"holes":[P,...]}
            | {"gen":"heatsink","W":80,"base":5,"fin":18,"tf":2,"n":9}                 // generators of usual sections:
            | {"gen":"channel","W":40,"H":30,"t":3} | {"gen":"angle","A":40,"B":30,"t":3} | {"gen":"tube","W":60,"H":40,"t":2.5} | {"gen":"round_tube","D":30,"t":2}
            | {"gen":"card_enclosure","W":110,"H":50,"t":2.5,"slots":2,"slot_t":1.9,"slot_d":1.5,"first":6,"pitch":15}   // tube with card-guide grooves

## 6. Extrusion family (aluminium or plastic profile)
"extrusion": {
  "profile": P,              // cross-section; x horizontal, second axis up
  "length": "L",
  "axis": "Y",               // extrusion axis (default Y: the section is drawn in XZ)
  "inside":  [ {"name":"Control PCB","w":100,"h":1.6,"at":[0,12],"clearance":0.3} ],   // envelopes that must fit INSIDE (centre, size)
  "outside": [ {"name":"Fan 40 mm","w":40,"h":40,"at":[0,-25],"clearance":1} ]          // envelopes sitting OUTSIDE against it
}
Extrusion design rules to respect in the profile: uniform walls (aluminium ≥ 1.2 mm, plastic ≥ 1.0 mm), radii on every corner
(≥ 0.4 mm), no gap deeper than 3 × its width (4 × with care), as few hollows as possible, symmetric when possible.
Machining after extrusion (holes, cut-outs) goes in "features" and "interfaces".

## 6b. Folded sheet metal (family "sheet", process "sheet_metal")
"folded": {
  "base": ["L", "W"],        // the flat base: min corner at the origin, thickness from z = 0 to z = t
  "t": "t", "r": "r",        // sheet thickness; inside radius of EVERY bend (one tool) — at least the minimum of the material (1 × t)
  "flanges": [ {"side":"+X","h":"h","dir":"up"}, {"side":"-Y","h":"h","dir":"up"} ],
                             // one folded edge per side of the base (+X -X +Y -Y), at 90°, "up" or "down"; h = OUTSIDE height, from the far face of the base
  "relief": 3.5,             // optional: square notch where two folded edges meet (default r + t + 0.5)
  "k": 0.44                  // optional: neutral-fibre factor of the flat pattern (typical value; the shop has its own)
}
No "stock" with "folded": the blank is the flat pattern, computed by the platform with its bend lines (DXF).
Holes and interfaces go in "features" / "interfaces": on the base (faces ±Z; an interface there takes "level": "t" on +Z, 0 on -Z) or on a
folded edge (faces ±X ±Y, position [along the edge, z]); a hole in a folded edge takes the depth of the sheet ("through" also pierces the edge across).
Rules checked on the block: r ≥ minimum of the material, h ≥ 4 × t, hole edge ≥ 2.5 × t + r from a bend and ≥ 2 × t from a free edge, relief ≥ r + t + 0.5.

## 7. PCB family
"pcb": {
  "size": [100, 80], "r": 2, "t": 1.6,                    // or "outline": P. The bottom of the board is z = 0.
  "components": [ {"ref":"U1","name":"MCU","kind":"mcu","at":[50,40],"size":[14,14,1.6],"side":"top"},
                  {"ref":"J1","name":"Power in","kind":"connector","at":[8,40],"size":[12,22,11],"net":null} ],
      // kind: ic mcu connector capacitor inductor relay transformer mosfet sensor heatsink terminal fuse resistor optocoupler other
  "zones": [ {"net":"HV+","side":"top","rect":[5,5,30,20],"name":"HV+ input"} ],          // copper areas that matter for isolation
  "nets": { "HV+": {"kind":"dc","voltage":400}, "HV-": {"kind":"dc","voltage":0}, "LV": {"kind":"dc","voltage":12}, "CHASSIS": {"kind":"dc","voltage":0} }
}
Mounting holes of a board = one "bolt_pattern" interface, side "A", face "-Z" (the board sits on standoffs).

## 8. Rules of a good answer
1. Interfaces first: list every neighbour and what holds / locates / connects the part to it, then draw the part around them.
2. Reuse EXACTLY the "key", "type" and "params" of the interfaces already defined in the project (given in the prompt).
3. Everything a human would tune is a parameter. No raw number repeated twice.
4. Respect the design-for-manufacturing rules of the process (walls, radii, hole sizes, depths).
5. Think like the shop: choose the raw stock first (a commercial size), then the fewest operations and set-ups.
6. Answer with ONE JSON object in a code block, valid JSON (double quotes, no comments, no trailing commas).

## 9. The .dwiz file — the same part, one instruction per line
The platform stores and exchanges parts as .dwiz text. It is the SAME model as the JSON above, written to be read by people, shops and AIs:
dwiz part/1 PN-0001 "Short name"                        # first line: kind/version, part number, name
function "One sentence: what the part does."            # a key and its value
stock plate L=L W=W t=t                                 # a block: the word, then name=value (the stock form comes first, without its name)
param L 120 min=60 max=300 unit=mm label="Length"       # one line per parameter;  "param wall = 3"  is the short form
interface IF1 bolt_pattern side=A face=+Z at=[L/2, W/2] key=pcb_mount
  params screw=M3 pattern={type: rect, nx: 2, ny: 2, dx: 70, dy: 50}       # indented lines belong to the line above
do tap face=+Z at=[10, 10] thread=M4 depth=(t - 1)      # one line per feature or Shop operation, in order; (…) is a formula of the parameters
note "Break sharp edges 0.2 to 0.5 mm"                  # one line per drawing note
Values: numbers, bare words, "text", (formulas), [lists], {name: value}; "key = value" writes any raw value; "#" starts a comment.
A .dwiz document is accepted as an answer in place of the JSON object; both are read.
```

## Types d'interface

| Type | Nom | Rôle des côtés A et B |
|---|---|---|
| `bolt_pattern` | Motif de vis | Fixation vissée. A = côté trous de passage (la vis entre par ce côté) ; B = côté fileté (taraudage, insert, ou colonnette « standoff »). |
| `planar` | Appui plan | Deux faces planes en appui (appui thermique, plan de joint, face de référence). A et B sont symétriques ; « pad » ajoute une surface surélevée côté B. |
| `bond` | Joint collé | Collage entre deux plages planes de w × h. A = plage lisse ; B = plage qui tient l'épaisseur du film de colle (« gap », mm) : avec l'option « well », un logement de colle de w × h creusé de « gap », entouré d'une lèvre d'appui de « lip » mm (3 mm et plus) sur laquelle l'autre pièce repose sans écraser la colle ; sinon, des plots de calage de la hauteur du film (« pips »). « adhesive » (epoxy, acrylic, polyurethane, cyanoacrylate, silicone, tape), « prep » (degrease, abrade, primer, plasma) et « cure » (texte libre) décrivent le procédé ; la colle entre dans la nomenclature. |
| `fit` | Ajustement arbre / alésage | Centrage cylindrique. A = arbre (bossage cylindrique) ; B = alésage. « fit » = ajustement ISO (ex. H7/g6). |
| `cutout` | Découpe de panneau | Ouverture pour un connecteur, un afficheur, un évent. A = panneau (découpe + trous de fixation) ; B = composant qui s'y monte (trous filetés seulement). |
| `rail` | Glissière / guide-carte | Une languette (bord de PCB, tôle, nervure) glisse dans une rainure. A = languette (aucune géométrie ajoutée) ; B = rainure usinée ou extrudée le long de u. |
| `pins` | Goupilles de positionnement | Deux goupilles donnent la position précise. A = trous glissants ; B = trous serrés où les goupilles sont chassées. |
| `weld` | Joint soudé ou câblé par fils | Liaison électrique permanente entre deux conducteurs sur une zone de w × h. A = le côté mince (languette, bout de busbar, départ des fils) ; B = la borne (capot de cellule, barre épaisse, plage). « process » : laser, resistance, ultrasonic, wirebond. « n » : cordons, points ou fils ; « t » : épaisseur de la languette ; « wire » et « wireMat » (Al, Cu) pour le wirebonding ; « i » : courant à porter (A). Aucune géométrie ajoutée. |
| `contact` | Contact à pression | Contact à pression entre deux plages PLANES de conducteurs massifs (busbars) : zone de w × h. A = le côté qui porte les points de contact (« n ») ; B = la plage plane revêtue. « form » : cone (bossages emboutis en pointe dans la barre, de 1 mm et plus), bridge (lames cambrées en pont dans une barre mince ; « t » épaisseur de la lame) ou band (bande de lamelles rapportée). « gap » : la hauteur comprimée ; « force » : l'effort par point (N). « plating » : Ag, Sn, Au, Ni ; « base » : Cu, CuBe, CuNiSi, CuSn ; « duty » : power ou signal ; « i » : courant (A) ; « u » : tension de service (V continu). « weld » : projection — les bossages servent de bossages de soudage (option). Un serrage (vis, clip) doit tenir les deux barres. |

## Générateurs de profil

`heatsink`, `channel`, `angle`, `tube`, `round_tube`, `card_enclosure`, `fitted`

## Procédés

| Clé | Procédé |
|---|---|
| `cnc_milling` | Usinage CNC (fraisage) |
| `cnc_turning` | Tournage CNC |
| `sheet_metal` | Tôlerie (découpe laser + pliage) |
| `laser_cut` | Découpe laser de précision (feuille, plaque) |
| `extrusion_al` | Extrusion aluminium |
| `extrusion_plastic` | Extrusion plastique |
| `injection_molding` | Moulage par injection |
| `die_casting` | Fonderie sous pression (haute pression) |
| `lp_die_casting` | Fonderie basse pression (moule métallique rempli par le bas) |
| `permanent_mold` | Moulage en coquille par gravité (moule permanent) |
| `sand_casting` | Moulage au sable |
| `fdm` | Impression 3D FDM |
| `mjf` | Impression 3D MJF / SLS |
| `sla` | Impression 3D résine (SLA) |
| `lpbf` | Impression 3D métal (fusion laser sur lit de poudre) |
| `pcb` | Fabrication de PCB |
| `purchased` | Pièce achetée |

## Matériaux

| Clé | Matériau | Densité (g/cm³) | CTI (V) |
|---|---|---|---|
| `AL6061-T6` | Aluminium 6061-T6 | 2.7 | conducteur |
| `AL6063-T5` | Aluminium 6063-T5 (extrusion) | 2.7 | conducteur |
| `AL5052-H32` | Aluminium 5052-H32 (sheet) | 2.68 | conducteur |
| `CU-C110` | Copper C110 (ETP) | 8.89 | conducteur |
| `BRASS-360` | Brass C360 | 8.5 | conducteur |
| `SS-304` | Stainless steel 304 | 8 | conducteur |
| `STEEL-1018` | Steel 1018 (zinc plated) | 7.87 | conducteur |
| `SS-316L` | Inox 316L | 7.98 | conducteur |
| `SS-17-4PH` | Inox 17-4 PH (durci par précipitation) | 7.8 | conducteur |
| `ALSI10MG` | Aluminium AlSi10Mg (impression 3D métal) | 2.67 | conducteur |
| `TI-6AL-4V` | Titane Ti-6Al-4V (grade 5 ; ELI : grade 23) | 4.43 | conducteur |
| `IN718` | Alliage de nickel 718 (Inconel 718) | 8.19 | conducteur |
| `IN625` | Alliage de nickel 625 (Inconel 625) | 8.44 | conducteur |
| `AL-A380` | Aluminium A380 (die casting) | 2.71 | conducteur |
| `ZAMAK-3` | Zamak 3 (zinc, die casting) | 6.6 | conducteur |
| `AL-A356-T6` | Aluminium A356-T6 (casting) | 2.68 | conducteur |
| `PA66-GF30` | PA66-GF30 | 1.36 | 400 |
| `PC` | Polycarbonate | 1.2 | 250 |
| `PC-ABS` | PC/ABS | 1.15 | 250 |
| `ABS` | ABS | 1.05 | 600 |
| `PBT-GF30` | PBT-GF30 | 1.53 | 250 |
| `PPS-GF40` | PPS-GF40 | 1.65 | 175 |
| `POM` | POM (acetal) | 1.41 | 600 |
| `PEEK` | PEEK | 1.3 | 150 |
| `PEI-9085` | PEI ULTEM 9085 (FDM) | 1.34 | 150 |
| `PEKK` | PEKK (FDM haute température) | 1.28 | 150 |
| `PA12` | PA12 (MJF / SLS) | 1.01 | 600 |
| `PA11` | PA11 (MJF / SLS) | 1.04 | 600 |
| `RESIN-SLA` | Résine photopolymère rigide (SLA) | 1.18 | 175 |
| `PMMA` | Acrylique (PMMA) | 1.19 | 600 |
| `PVC-U` | PVC rigid (extrusion) | 1.4 | 600 |
| `SILICONE` | Silicone rubber | 1.15 | 600 |
| `FR4` | FR4 PCB (standard, CTI 175) | 1.85 | 175 |
| `FR4-CTI600` | FR4 PCB (high CTI 600) | 1.85 | 600 |
| `NOMEX-410` | Nomex 410 (aramid paper) | 0.96 | 175 |
| `PET-FILM` | Film polyester (PET) isolant | 1.39 | 250 |
| `PI-FILM` | Film polyimide (PI) isolant | 1.42 | 150 |
| `THERMAL-PAD` | Pad thermique silicone chargé | 2.5 | 600 |
| `GAP-FILLER` | Composé thermique de remplissage (deux composants) | 2.8 | 600 |
| `EPOXY` | Epoxy potting / body | 1.8 | 200 |
| `LI-ION-CELL` | Cellule Li-ion cylindrique (homogénéisée) | 2.65 | conducteur |
| `GENERIC-COMPONENT` | Electronic component (plastic body) | 1.6 | 175 |
