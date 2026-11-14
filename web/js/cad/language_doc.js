/* DesignWizard.ai — reference of the part language ("DW part/1"), single source for docs/PART_LANGUAGE.md and for the
   generic interview prompt given to Claude (or any other assistant). Keep it exact: the builder accepts what is written here. */

export const LANGUAGE_REFERENCE = String.raw`# DesignWizard part language — DW part/1

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
  "process": "cnc_milling | cnc_turning | sheet_metal | laser_cut | extrusion_al | extrusion_plastic | injection_molding | fdm | mjf | pcb | purchased",
  "material": "AL6061-T6 | AL6063-T5 | AL5052-H32 | CU-C110 | BRASS-360 | SS-304 | STEEL-1018 | PA66-GF30 | PC | PC-ABS | ABS | PBT-GF30 | PPS-GF40 | POM | PEEK | PEI-9085 | PA12 | PVC-U | SILICONE | FR4 | FR4-CTI600",
  "elec": { "kind": "conductor | insulator | chassis | none", "net": "HV+" },   // electrical role (isolation analysis); optional
  "params": { ... },                    // section 2
  "interfaces": [ ... ],                // section 3 — START HERE: interfaces first
  "features": [ ... ],                  // section 4
  "extrusion": { ... },                 // section 5 (family extrusion) — replaces the first feature
  "pcb": { ... },                       // section 6 (family pcb)
  "notes": ["Drawing note 1", "..."],   // notes printed on the 2D drawing
  "finish": "Anodised black 10 µm",
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

## 4. Features — built in order
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
- {"op":"shell", "t":2.5, "open":["+Z"]}                              // hollow the part, removing the listed faces
- {"op":"fillet", "r":2, "edges":SEL}   ·   {"op":"chamfer", "d":0.5, "edges":SEL}
- {"op":"interfaces"}                                                 // optional marker: interface geometry is cut here (default: after all features)
Face-based features (hole, pocket, pad, slot, boss) take 2D positions in MODEL coordinates of the face plane ([x,y] on ±Z, [x,z] on ±Y, [y,z] on ±X).
POS = [x,y] | [[x,y],[x,y],...] | {"grid":{"origin":[x,y],"nx":2,"ny":3,"dx":20,"dy":15}} | {"circle":{"center":[x,y],"n":6,"d":50,"start":0}}
SEL = "all" | "vertical" | {"dir":"X|Y|Z"} | {"face":"+Z"} | {"box":[x0,y0,z0,x1,y1,z1]} | {"near":[x,y,z],"tol":1} (keys combine)
P (profile) = {"rect":[x,y,w,h],"r":2} | {"circle":[cx,cy,d]} | {"slot":[x1,y1,x2,y2,w]}
            | {"poly":[[x,y],[x,y,r],...],"r":0}        // polygon; a vertex may carry its own fillet radius as 3rd value
            | {"path":"M0 0 L10 0 A5 5 0 0 1 15 5 Z"}    // SVG path, y up
            | {"outer":P,"holes":[P,...]}

## 5. Extrusion family (aluminium or plastic profile)
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

## 6. PCB family
"pcb": {
  "size": [100, 80], "r": 2, "t": 1.6,                    // or "outline": P. The bottom of the board is z = 0.
  "components": [ {"ref":"U1","name":"MCU","kind":"mcu","at":[50,40],"size":[14,14,1.6],"side":"top"},
                  {"ref":"J1","name":"Power in","kind":"connector","at":[8,40],"size":[12,22,11],"net":null} ],
      // kind: ic mcu connector capacitor inductor relay transformer mosfet sensor heatsink terminal fuse resistor optocoupler other
  "zones": [ {"net":"HV+","side":"top","rect":[5,5,30,20],"name":"HV+ input"} ],          // copper areas that matter for isolation
  "nets": { "HV+": {"kind":"dc","voltage":400}, "HV-": {"kind":"dc","voltage":0}, "LV": {"kind":"dc","voltage":12}, "CHASSIS": {"kind":"dc","voltage":0} }
}
Mounting holes of a board = one "bolt_pattern" interface, side "A", face "-Z" (the board sits on standoffs).

## 7. Rules of a good answer
1. Interfaces first: list every neighbour and what holds / locates / connects the part to it, then draw the part around them.
2. Reuse EXACTLY the "key", "type" and "params" of the interfaces already defined in the project (given in the prompt).
3. Everything a human would tune is a parameter. No raw number repeated twice.
4. Respect the design-for-manufacturing rules of the process (walls, radii, hole sizes, depths).
5. Answer with ONE JSON object in a code block, valid JSON (double quotes, no comments, no trailing commas).`;
