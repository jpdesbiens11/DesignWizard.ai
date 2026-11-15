/* DesignWizard.ai — parts taken from the electrical library : a connector or a cell becomes a part of the project, with its
   electrical role and its interfaces, ready to be placed in the assembly. The envelope of a connector is INDICATIVE : it is
   sized from the pitch, the number of poles and the current alone — the maker's 3D model replaces it when the part number
   is chosen. What is exact is what the library carries : the family, its current, its voltage, its standards. Pure. */

import { CONNECTOR_KINDS } from "../cad/elec_library.js";

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
/** The nets of the poles : HV+ and HV− for two high-voltage poles, one net for a signal connector, numbered otherwise. */
export function poleNets(c, poles, net) {
  const n = Math.max(1, Math.round(poles)), base = net || (c.domain === "hv" ? "HV" : "LV");
  if (c.domain !== "hv") return [base];
  return n === 2 ? [`${base}+`, `${base}-`] : Array.from({ length: n }, (_, i) => `${base}${i + 1}`);
}
/** A connector as a part. o : { id, poles, net, mount: "panel" | "board", external, partner }. */
export function connectorPart(c, o = {}) {
  const poles = Math.max(1, Math.round(o.poles || (c.domain === "hv" ? 2 : 4))), E = connectorEnvelope(c, poles), nets = poleNets(c, poles, o.net), panel = (o.mount || (c.domain === "hv" || c.kind === "circular" || c.sealed ? "panel" : "board")) === "panel";
  const key = slug(`${o.id || c.id}_${c.series}`), external = o.external ?? c.domain === "hv", partner = o.partner || (external ? "Câble ou appareil extérieur" : "Faisceau"), fl = panel ? 2 : 0, nose = panel ? r1(Math.min(12, E.W * 0.3)) : 0, e = panel ? r1(Math.max(4, E.H * 0.25)) : 0;
  const cw = r1(Math.max(0.6, Math.min(E.L / (nets.length + 1) * 0.5, E.H * 0.4))), bodies = {}, features = [];
  if (panel) features.push({ op: "box", id: "bride", name: "Bride", size: ["L + 2*e", fl, "H + 2*e"], at: ["-e", 0, "-e"] }, { op: "box", id: "nez", name: "Nez", size: ["L", nose, "H"], at: [0, -nose, 0] });
  features.push({ op: "box", id: "corps", name: "Corps", size: ["L", "W", "H"], at: [0, fl, 0] });
  nets.forEach((net, k) => { const x = `L*${k + 1}/${nets.length + 1} - ${r1(cw / 2)}`, at = [x, -nose + 0.5, `H/2 - ${r1(cw / 2)}`], size = [cw, `W + ${r1(fl + nose - 1)}`, cw], name = nets.length === 1 ? "contacts" : `pole${k + 1}`;
    bodies[name] = { material: "CU-C110", net, kind: "conductor", label: net };
    features.push({ op: "box", id: `log${k + 1}`, mode: "cut", size, at }, { op: "box", id: `ct${k + 1}`, name: `Contact ${net}`, body: name, size, at }); });
  const interfaces = panel ? [{ id: "IF1", type: "cutout", name: "Passage dans la paroi", key: `${key}_paroi`, partner: "Paroi du boîtier", side: "B", face: "-Y", level: 0, at: ["L/2", "H/2"], params: { shape: "rect", w: "L + 0.6", h: "H + 0.6", r: 1, fix: { screw: E.H > 30 ? "M4" : "M3", n: 2, pitch: `L + ${e}` } } },
    { id: "IF2", type: "planar", name: `Raccordement ${nets.join(" / ")}`, key: `${key}_raccord`, partner, side: "A", face: "-Y", at: ["L/2", "H/2"], params: { w: "L", h: "H" }, ...(external ? { external: true } : {}) }]
    : [{ id: "IF1", type: "planar", name: "Pose sur la carte", key: `${key}_pose`, partner: "Carte", side: "A", face: "-Z", at: ["L/2", "W/2"], params: { w: "L", h: "W" } },
      { id: "IF2", type: "planar", name: `Raccordement ${nets.join(" / ")}`, key: `${key}_raccord`, partner, side: "A", face: "+Z", at: ["L/2", "W/2"], params: { w: "L", h: "W" }, ...(external ? { external: true } : {}) }];
  return { dw: "part/1", id: o.id || `CN-${c.id.toUpperCase()}`, name: `${c.maker} ${c.series} — ${poles} pôle${poles > 1 ? "s" : ""}`, function: `${CONNECTOR_KINDS[c.kind]} ${c.domain === "hv" ? "haute tension / puissance" : "basse tension"} : ${c.use || ""}`.trim(),
    family: "connector", process: "purchased", material: "GENERIC-COMPONENT", elec: { kind: "insulator" },
    library: { ref: c.id, maker: c.maker, series: c.series, kind: c.kind, poles, a: c.a, v: c.v, ...(c.std ? { std: c.std } : {}), ...(c.sealed ? { sealed: c.sealed } : {}), ...(c.hvil ? { hvil: true } : {}), seen: c.seen },
    params: { L: P(E.L, "Longueur (rangée des pôles)"), W: P(E.W, "Profondeur"), H: P(E.H, "Hauteur"), ...(panel ? { e: P(e, "Débord de la bride") } : {}) }, bodies, features: [...features, { op: "interfaces" }], interfaces,
    notes: [`Référence : ${c.maker} ${c.series} — ${c.a} A par contact${c.v ? `, ${c.v} V` : ""}${c.std ? ` ; ${c.std}` : ""}. Valeurs nominales publiées ; la fiche du fabricant fait foi.`, "Enveloppe indicative : remplacer par le modèle 3D du fabricant quand la référence est choisie.", ...(c.note ? [c.note.charAt(0).toUpperCase() + c.note.slice(1) + "."] : [])] };
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
