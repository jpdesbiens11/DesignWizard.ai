/* DesignWizard.ai — parts taken from the electrical library : a connector or a cell becomes a part of the project, with its
   electrical role and its interfaces, ready to be placed in the assembly. The shape of a connector is INDICATIVE : the form
   of its kind (core/connector_shapes.js), in an envelope sized from the pitch, the number of poles and the current alone —
   the maker's 3D model replaces it when the part number is chosen (useMakerModel). What is exact is what the library
   carries : the family, its current, its voltage, its standards. Pure. */

import { CONNECTOR_KINDS } from "../cad/elec_library.js";
import { connectorFeatures, SHAPE_WORDS, TONES } from "./connector_shapes.js";

const r1 = (x) => Math.round(x * 10) / 10, P = (value, label, group = "Enveloppe indicative") => ({ value, min: r1(value * 0.3), max: r1(value * 3), step: 0.5, unit: "mm", label, group });
const slug = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);

/** L (along the row of poles) × W (along the mating direction) × H, in mm — indicative. */
export function connectorEnvelope(c, poles = 2) {
  const n = Math.max(1, Math.round(poles));
  if (c.kind === "circular") { const d = /M8/.test(c.series) ? 10 : /M12/.test(c.series) ? 14.5 : c.domain === "hv" ? 40 : 26; return { L: d, W: r1(d * 2.4), H: d }; }
  if (c.pitch) return { L: r1(c.pitch * (n + 1)), W: r1(Math.max(3, 2.2 * c.pitch)), H: r1(Math.max(3, 2.6 * c.pitch)) };
  const a = c.a || 10, s = a <= 8 ? 4 : a <= 25 ? 6.5 : a <= 60 ? 14 : a <= 130 ? 22 : a <= 260 ? 32 : 42;      // the room a pole takes grows with its current
  return { L: r1(s * n + s * 0.8), W: r1(s * 1.8 + 8), H: r1(s * 1.5 + 6) };
}
/** How many poles a family is shown and added with, unless said : two for a high-voltage pair, four for a signal connector — inside
    what the family exists in (a 40 to 100 pole mezzanine starts at 40). */
export function defaultPoles(c) {
  const n = String(c.pos || "").match(/\d+/g), lo = n ? +n[0] : 1, hi = n ? +n[n.length - 1] : 60, want = c.domain === "hv" ? 2 : 4;
  return Math.max(lo, Math.min(Math.max(lo, hi), want));
}
/** The nets of the poles : HV+ and HV− for two high-voltage poles, one net for a signal connector, numbered otherwise. */
export function poleNets(c, poles, net) {
  const n = Math.max(1, Math.round(poles)), base = net || (c.domain === "hv" ? "HV" : "LV");
  if (c.domain !== "hv") return [base];
  return n === 2 ? [`${base}+`, `${base}-`] : Array.from({ length: n }, (_, i) => `${base}${i + 1}`);
}
/** A connector as a part. o : { id, poles, net, mount: "panel" | "board", external, partner }. */
export function connectorPart(c, o = {}) {
  const poles = Math.max(1, Math.round(o.poles || defaultPoles(c))), E = connectorEnvelope(c, poles), nets = poleNets(c, poles, o.net), panel = (o.mount || (c.domain === "hv" || c.kind === "circular" || c.sealed ? "panel" : "board")) === "panel";
  const key = slug(`${o.id || c.id}_${c.series}`), external = o.external ?? c.domain === "hv", partner = o.partner || (external ? "Câble ou appareil extérieur" : "Faisceau"), e = panel ? r1(Math.max(4, E.H * 0.25)) : 0;
  const features = connectorFeatures(c, E, { poles, nets, panel, e }), bodies = {};      // the form of its kind, in the envelope
  for (const f of features) if (f.body && !bodies[f.body]) { const k = /^pole(\d+)$/.exec(f.body), net = k ? nets[+k[1] - 1] : nets[0]; bodies[f.body] = { material: "CU-C110", net, kind: "conductor", label: net }; }
  const interfaces = panel ? [{ id: "IF1", type: "cutout", name: "Passage dans la paroi", key: `${key}_paroi`, partner: "Paroi du boîtier", side: "B", face: "-Y", level: 0, at: ["L/2", "H/2"], params: { shape: "rect", w: "L + 0.6", h: "H + 0.6", r: 1, fix: { screw: E.H > 30 ? "M4" : "M3", n: 2, pitch: `L + ${e}` } } },
    { id: "IF2", type: "planar", name: `Raccordement ${nets.join(" / ")}`, key: `${key}_raccord`, partner, side: "A", face: "-Y", at: ["L/2", "H/2"], params: { w: "L", h: "H" }, ...(external ? { external: true } : {}) }]
    : [{ id: "IF1", type: "planar", name: "Pose sur la carte", key: `${key}_pose`, partner: "Carte", side: "A", face: "-Z", level: 0, at: ["L/2", "W/2"], params: { w: "L", h: "W" } },
      { id: "IF2", type: "planar", name: `Raccordement ${nets.join(" / ")}`, key: `${key}_raccord`, partner, side: "A", face: "+Z", at: ["L/2", "W/2"], params: { w: "L", h: "W" }, ...(external ? { external: true } : {}) }];
  return { dw: "part/1", id: o.id || `CN-${c.id.toUpperCase()}`, name: `${c.maker} ${c.series} — ${poles} pôle${poles > 1 ? "s" : ""}`, function: `${CONNECTOR_KINDS[c.kind]} ${c.domain === "hv" ? "haute tension / puissance" : "basse tension"} : ${c.use || ""}`.trim(),
    family: "connector", process: "purchased", material: "GENERIC-COMPONENT", elec: { kind: "insulator" }, look: { color: TONES.housing[c.domain === "hv" ? "hv" : "lv"] },
    library: { ref: c.id, maker: c.maker, series: c.series, kind: c.kind, poles, a: c.a, v: c.v, ...(c.std ? { std: c.std } : {}), ...(c.sealed ? { sealed: c.sealed } : {}), ...(c.hvil ? { hvil: true } : {}), seen: c.seen },
    params: { L: P(E.L, "Longueur (rangée des pôles)"), W: P(E.W, "Profondeur"), H: P(E.H, "Hauteur"), ...(panel ? { e: P(e, "Débord de la bride") } : {}) }, bodies, features: [...features, { op: "interfaces" }], interfaces,
    notes: [`Référence : ${c.maker} ${c.series} — ${c.a} A par contact${c.v ? `, ${c.v} V` : ""}${c.std ? ` ; ${c.std}` : ""}. Valeurs nominales publiées ; la fiche du fabricant fait foi.`, `Forme indicative (${SHAPE_WORDS[c.kind] || "connecteur"}) dans une enveloppe indicative : remplacer par le modèle 3D du fabricant quand la référence est choisie.`, ...(c.note ? [c.note.charAt(0).toUpperCase() + c.note.slice(1) + "."] : [])] };
}
/** A cylindrical cell as a part : its largest published envelope, its terminals as welded interfaces. o : { id, net, process }. */
export function cellPart(cell, o = {}) {
  const key = slug(`${o.id || cell.id}_cell`), weld = (id, name, face, w) => ({ id, type: "weld", name, key: `${key}_${id.toLowerCase()}`, partner: "Busbar ou languette", side: "B", face, at: [0, 0], params: { process: o.process || "laser", w, h: w, n: o.process === "wirebond" ? 2 : 1, t: 0.3, wire: 0.3, wireMat: "Al", i: 0 } });
  return { dw: "part/1", id: o.id || `CELL-${cell.id}`, name: cell.name, function: `Stocke l'énergie : ${cell.capacity[0]} à ${cell.capacity[1]} Ah, ${cell.vNom} V nominal`.replace(/\./g, ","), family: "cell", process: "purchased", material: "LI-ION-CELL", elec: { kind: "conductor", net: o.net || "CELL" },
    library: { ref: cell.id, iec: cell.iec, vNom: cell.vNom, vMax: cell.vMax, vMin: cell.vMin, capacity: cell.capacity, discharge: cell.discharge, mass: cell.mass, std: cell.std, seen: cell.seen },
    params: { d: { value: cell.d, min: cell.dNom - 0.5, max: cell.d + 0.5, step: 0.1, unit: "mm", label: "Diamètre (le plus grand publié)", group: "Enveloppe" }, L: { value: cell.L, min: cell.LNom - 1, max: cell.L + 1, step: 0.1, unit: "mm", label: "Longueur (la plus grande publiée)", group: "Enveloppe" } },
    features: [{ op: "cylinder", id: "cellule", name: "Cellule", d: "d", h: "L", at: [0, 0, 0], axis: "Z" }, { op: "interfaces" }],
    interfaces: [weld("IF1", "Borne +", "+Z", r1(cell.d * 0.35)), weld("IF2", "Borne − (fond du godet)", "-Z", r1(cell.d * 0.5))],
    notes: [`Désignation IEC 61960-3 : ${cell.iec} ; « ${cell.id} » est le nom d'usage. Masse ${cell.mass[0]} à ${cell.mass[1]} g, décharge continue ${cell.discharge[0]} à ${cell.discharge[1]} A selon le modèle.`, `Essais : ${cell.std}. Le godet est au potentiel négatif : l'isoler de ses voisins.`, "Polarité interne non modélisée : la cellule est un seul conducteur pour l'analyse d'isolement."] };
}

/** Puts the maker's 3D model (a STEP file the designer downloaded for the part number chosen) in place of the indicative shape of a
    library part, in place. The library reference, the interfaces and the notes stay ; the shape that was indicative is kept aside so
    that it can come back. text : the content of the STEP file ; file : its name. */
export function useMakerModel(spec, text, file = "modele.step") {
  if (!/^\s*ISO-10303-21/.test(String(text || ""))) throw new Error("Ce fichier n'est pas un STEP (il commence par « ISO-10303-21 »). Sur le site du fabricant, choisissez le format STEP (.step ou .stp).");
  if (!spec.step) spec.indicative = { features: spec.features, ...(spec.bodies ? { bodies: spec.bodies } : {}) };
  spec.step = { text, file }; spec.features = [{ op: "interfaces" }]; delete spec.bodies;      // the parameters stay : the interfaces are placed by them
  spec.notes = [...(spec.notes || []).filter((n) => !/^Forme indicative|^Enveloppe indicative|^Modèle 3D du fabricant/.test(n)), `Modèle 3D du fabricant : ${file}, fourni par le concepteur. Vérifier la place des interfaces : le repère du fichier n'est pas celui de la forme indicative.`];
  if (spec.library) spec.library.model = file;
  return spec;
}
/** Back to the indicative shape : the maker's model is taken out. */
export function dropMakerModel(spec) {
  if (!spec.step) return spec;
  delete spec.step; if (spec.indicative) { spec.features = spec.indicative.features; if (spec.indicative.bodies) spec.bodies = spec.indicative.bodies; delete spec.indicative; }
  spec.notes = (spec.notes || []).filter((n) => !/^Modèle 3D du fabricant/.test(n)); if (spec.library) delete spec.library.model;
  return spec;
}
