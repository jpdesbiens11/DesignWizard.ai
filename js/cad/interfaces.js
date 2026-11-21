/* DesignWizard.ai — interfaces: the entry point of every part.
   An interface is a typed contract between two parts (bolt pattern, cut-out, fit...). Its `params` are SHARED by both
   sides; each part carries one side ("A" or "B"), a face, a position and an angle. From that single definition the
   platform generates the geometry of each side, the mate frame, the hardware of the BOM and the GD&T of the drawing.
   Face-to-face mating: frames coincide with opposed normals and the same u axis, so a point (u, v) of side A meets
   the point (u, -v) of side B: side B is generated mirrored in v, both sides always line up. */

import { v3, FACES, faceKey, facePoint, rotateFrame } from "./vec.js";
import { thread, clearanceHole, screwLength } from "./standards.js";
import { ELEC_INTERFACES } from "./interfaces_elec.js";

const round2 = (x) => Math.round(x * 100) / 100;

/** Pattern points in the interface frame (side A). */
export function patternPoints(pattern = {}) {
  const t = pattern.type || (pattern.pts ? "points" : pattern.pcd ? "circle" : pattern.nx || pattern.ny ? "rect" : "single");
  if (t === "single") return [[0, 0]];
  if (t === "rect") {
    const nx = Math.max(1, Math.round(pattern.nx || 2)), ny = Math.max(1, Math.round(pattern.ny || 2)), dx = pattern.dx || 0, dy = pattern.dy || 0, out = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) out.push([(i - (nx - 1) / 2) * dx, (j - (ny - 1) / 2) * dy]);
    return out;
  }
  if (t === "circle") {
    const n = Math.max(1, Math.round(pattern.n || 4)), r = (pattern.pcd || 0) / 2, a0 = pattern.start || 0, out = [];
    for (let i = 0; i < n; i++) { const a = (a0 + i * 360 / n) * Math.PI / 180; out.push([r * Math.cos(a), r * Math.sin(a)]); }
    return out;
  }
  if (t === "points") return (pattern.pts || []).map((p) => [p[0], p[1]]);
  throw new Error(`Motif d'interface inconnu « ${t} » (single, rect, circle, points).`);
}

/* Each type: label, what it is for, the shared parameters, the options of each side, and compile(side, p, o) which
   returns features in FRAME coordinates ({op, uv:[[u,v]...], ...}); build.js maps them onto the part's face. */
/** Adhesive families for a bonded joint : usual bond line (mm), typical lap shear on prepared aluminium (MPa, to size — the data
    sheet of the product bought prevails), how it is held and cured. Generic classes : no brand, no reference. */
export const ADHESIVES = {
  epoxy: { label: "Two-part epoxy adhesive", fr: "Colle époxy bicomposant", gap: [0.1, 0.3], shear: 20, hold: "30 min sous pinces", cure: "24 h à 23 °C, ou 1 h à 80 °C", tool: "Cartouche double et buse mélangeuse" },
  acrylic: { label: "Structural acrylic adhesive (MMA)", fr: "Colle acrylique structurale (MMA)", gap: [0.2, 1.0], shear: 18, hold: "10 min sous pinces", cure: "24 h à 23 °C", tool: "Cartouche double et buse mélangeuse" },
  polyurethane: { label: "Polyurethane adhesive", fr: "Colle polyuréthane", gap: [0.5, 3.0], shear: 8, hold: "2 h sous pinces", cure: "48 h à 23 °C", tool: "Pistolet à cartouche" },
  cyanoacrylate: { label: "Cyanoacrylate adhesive", fr: "Colle cyanoacrylate", gap: [0.02, 0.1], shear: 15, hold: "30 s à la main", cure: "24 h à 23 °C", tool: "Flacon doseur" },
  silicone: { label: "Silicone sealant", fr: "Mastic silicone (étanchéité)", gap: [0.5, 3.0], shear: 1.5, hold: "sans effort, pièce posée", cure: "24 h par 3 mm d'épaisseur", tool: "Pistolet à cartouche" },
  tape: { label: "Double-sided acrylic tape", fr: "Ruban double face acrylique", gap: [0.25, 1.1], shear: 0.5, hold: "pression de 15 s au rouleau", cure: "72 h pour la tenue complète", tool: "Rouleau presseur" },
};
/** Surface preparations, in the words of the routing sheet. */
export const BOND_PREPS = {
  degrease: "Dégraisser les deux plages à l'isopropanol, chiffon non pelucheux",
  abrade: "Dégraisser, poncer au grain 180 à 320, dépoussiérer, dégraisser de nouveau",
  primer: "Dégraisser, appliquer le primaire d'adhérence, laisser sécher le temps indiqué",
  plasma: "Dégraisser, traiter au plasma ou à la flamme, coller dans l'heure",
};

export const INTERFACE_TYPES = {
  bolt_pattern: {
    label: "Bolt pattern", fr: "Motif de vis",
    doc: "Fixation vissée. A = côté trous de passage (la vis entre par ce côté) ; B = côté fileté (taraudage, insert, ou colonnette « standoff »).",
    params: { screw: "M4", pattern: { type: "rect", nx: 2, ny: 2, dx: 40, dy: 30 } },
    optsA: { fit: "medium", head: "none", depth: "through" }, optsB: { thread: "tapped", depth: null, standoff: null },
    compile(side, p, o) {
      const th = thread(p.screw), pts = patternPoints(p.pattern);
      if (side === "B" && o.port) return [];                       // screw channels extruded with the profile : nothing to drill or tap
      if (side === "A") {
        const f = { op: "hole", uv: pts, d: clearanceHole(p.screw, o.fit || "medium"), depth: o.depth ?? "through", fit: "clearance" };
        if (o.head === "cbore") f.cbore = { d: th.cbore, depth: round2(th.head[1] + 0.4) };
        if (o.head === "csink") f.csink = { d: th.csk, angle: 90 };
        return [f];
      }
      const insert = o.thread === "insert", clr = o.thread === "clearance";
      const hd = clr ? clearanceHole(p.screw, "medium") : insert ? th.insert[0] : th.tap;
      const depth = o.depth ?? (clr ? "through" : insert ? round2(th.insert[1] + 1) : round2(2.5 * th.d));
      if (o.standoff && o.standoff.h > 0) {
        const od = o.standoff.d || round2(Math.max(2.2 * hd, hd + 2 * (insert ? 1.6 : 1.2)));
        return [{ op: "boss", uv: pts, d: od, h: o.standoff.h, below: true, hole: { d: hd, depth: clr ? "through" : Math.min(depth === "through" ? 1e3 : depth, o.standoff.h + (o.standoff.into || 0)), thread: clr || insert ? undefined : p.screw, insert } }];
      }
      return [{ op: "hole", uv: pts, d: hd, depth, thread: clr || insert ? undefined : p.screw, fit: insert ? "insert" : clr ? "clearance" : "thread" }];
    },
    hardware(p, oA, oB, grip) {
      const th = thread(p.screw), n = patternPoints(p.pattern).length, out = [];
      const eng = oB.thread === "insert" ? th.insert[1] * 0.8 : oB.thread === "clearance" ? th.d * 0.8 + 2 : 1.5 * th.d;
      const L = screwLength(Math.max(1, grip || 3) - (oA.head === "cbore" ? th.head[1] + 0.4 : 0), eng);
      out.push({ id: `${oA.head === "csink" ? "ISO10642" : "ISO4762"}-${p.screw}x${L}`, name: `${oA.head === "csink" ? "Countersunk screw ISO 10642" : "Socket head cap screw ISO 4762"} ${p.screw} × ${L}`, qty: n, kind: "screw", size: p.screw, length: L });
      if (oB.thread === "insert") out.push({ id: `INSERT-${p.screw}`, name: `Heat-set insert ${p.screw}`, qty: n, kind: "insert", size: p.screw });
      if (oB.thread === "clearance") out.push({ id: `ISO4032-${p.screw}`, name: `Hex nut ISO 4032 ${p.screw}`, qty: n, kind: "nut", size: p.screw });
      return out;
    },
    gdt(p, oA, oB) {
      const th = thread(p.screw), H = clearanceHole(p.screw, (oA && oA.fit) || "medium"), fixed = !oB || oB.thread !== "clearance";
      const T = round2(fixed ? (H - th.d) / 2 : H - th.d);     // fixed-fastener (B threaded) or floating-fastener rule, ASME Y14.5 appendix B
      return { symbol: "position", tolerance: T, diameter: true, modifier: "mmc", rule: fixed ? "fixed fastener: T = (H − F) / 2" : "floating fastener: T = H − F", H, F: th.d };
    },
    signature: (p) => `${String(p.screw).toUpperCase()}|${patternPoints(p.pattern).map((q) => q.map(round2).join(",")).sort().join(";")}`,
  },
  planar: {
    label: "Planar contact", fr: "Appui plan",
    doc: "Deux faces planes en appui (appui thermique, plan de joint, face de référence). A et B sont symétriques ; « pad » ajoute une surface surélevée côté B.",
    params: { w: 40, h: 30 }, optsA: {}, optsB: { pad: 0 },
    compile(side, p, o) {
      if (side === "B" && o.pad > 0) return [{ op: "pad", w: p.w, h: p.h, t: o.pad }];
      return [];
    },
    hardware: () => [],
    gdt: (p) => ({ symbol: "flatness", tolerance: round2(Math.max(0.05, Math.max(p.w || 0, p.h || 0) * 0.001)) }),
    signature: (p) => `${round2(p.w || 0)}x${round2(p.h || 0)}`,
  },
  bond: {
    label: "Bonded joint", fr: "Joint collé",
    doc: "Collage entre deux plages planes de w × h. A = plage lisse ; B = plage qui tient l'épaisseur du film de colle (« gap », mm) : avec l'option « well », un logement de colle de w × h creusé de « gap », entouré d'une lèvre d'appui de « lip » mm (3 mm et plus) sur laquelle l'autre pièce repose sans écraser la colle ; sinon, des plots de calage de la hauteur du film (« pips »). « adhesive » (epoxy, acrylic, polyurethane, cyanoacrylate, silicone, tape), « prep » (degrease, abrade, primer, plasma) et « cure » (texte libre) décrivent le procédé ; la colle entre dans la nomenclature.",
    params: { w: 30, h: 12, gap: 0.2, lip: 3, adhesive: "epoxy", prep: "abrade", cure: "" }, optsA: {}, optsB: { pips: true },
    compile(side, p, o) {                                       // the gap is built in : a well of the depth of the bond line inside a lip the mate rests on — or pips of that height, the mating plane on their tops
      if (side !== "B" || !(p.gap > 0) || p.adhesive === "tape") return [];
      if (o.well) return [{ op: "pocket", rectUV: [p.w, p.h], r: round2(Math.min(1, Math.min(p.w, p.h) / 4)), depth: p.gap }];
      if (o.pips === false) return [];
      const d = round2(Math.max(1.2, Math.min(3, Math.min(p.w, p.h) / 4))), ex = round2(p.w / 2 - d), ey = round2(p.h / 2 - d);
      const pts = ex >= d && ey >= d ? [[-ex, -ey], [ex, -ey], [ex, ey], [-ex, ey]] : ex >= d ? [[-ex, 0], [0, 0], [ex, 0]] : ey >= d ? [[0, -ey], [0, 0], [0, ey]] : [[0, 0]];
      return [{ op: "boss", uv: pts, d, h: p.gap, lift: p.gap }];
    },
    hardware(p) {
      const a = ADHESIVES[p.adhesive] || ADHESIVES.epoxy, tape = p.adhesive === "tape";
      return [{ id: `ADH-${String(p.adhesive || "epoxy").toUpperCase()}`, name: a.label, kind: "adhesive", adhesive: p.adhesive || "epoxy", unit: tape ? "cm²" : "mL",
        qty: tape ? Math.max(0.1, round2(p.w * p.h / 100)) : Math.max(0.05, round2(p.w * p.h * (p.gap || 0.2) / 1000 * 1.3)) }];   // 30 % more than the film : the squeeze-out
    },
    gdt: (p) => ({ symbol: "flatness", tolerance: round2(Math.max(0.05, (p.gap || 0.2) / 2)) }),
    signature: (p) => `${round2(p.w || 0)}x${round2(p.h || 0)}@${round2(p.gap || 0)}|${p.adhesive || "epoxy"}`,
  },
  fit: {
    label: "Shaft / bore fit", fr: "Ajustement arbre / alésage",
    doc: "Centrage cylindrique. A = arbre (bossage cylindrique) ; B = alésage. « fit » = ajustement ISO (ex. H7/g6).",
    params: { d: 12, length: 8, fit: "H7/g6" }, optsA: {}, optsB: { depth: null },
    compile(side, p, o) {
      if (side === "A") return [{ op: "boss", uv: [[0, 0]], d: p.d, h: p.length }];
      return [{ op: "hole", uv: [[0, 0]], d: p.d, depth: o.depth ?? round2(p.length + 0.5), fit: (p.fit || "H7/g6").split("/")[0] }];
    },
    hardware: () => [],
    gdt: (p) => ({ symbol: "perpendicularity", tolerance: 0.05, diameter: true, fit: p.fit || "H7/g6" }),
    signature: (p) => `d${round2(p.d)}`,
  },
  cutout: {
    label: "Panel cut-out", fr: "Découpe de panneau",
    doc: "Ouverture pour un connecteur, un afficheur, un évent. A = panneau (découpe + trous de fixation) ; B = composant qui s'y monte (trous filetés seulement).",
    params: { shape: "rect", w: 20, h: 10, r: 1, d: 12, fix: null }, optsA: { depth: "through" }, optsB: {},
    compile(side, p, o) {
      const out = [];
      if (side === "A") {
        if (p.shape === "round") out.push({ op: "hole", uv: [[0, 0]], d: p.d, depth: o.depth ?? "through", fit: "cutout" });
        else out.push({ op: "pocket", rectUV: [p.w, p.h], r: p.r || 0, depth: o.depth ?? "through" });
      }
      if (p.fix && p.fix.screw) {
        const n = Math.max(1, Math.round(p.fix.n || 2)), pitch = p.fix.pitch || (p.w || p.d || 20) + 8, pts = [];
        for (let i = 0; i < n; i++) pts.push([(i - (n - 1) / 2) * pitch, 0]);
        out.push(side === "A" ? { op: "hole", uv: pts, d: clearanceHole(p.fix.screw), depth: o.depth ?? "through", fit: "clearance" }
          : { op: "hole", uv: pts, d: thread(p.fix.screw).tap, depth: round2(2.5 * thread(p.fix.screw).d), thread: p.fix.screw, fit: "thread" });
      }
      return out;
    },
    hardware(p) { return p.fix && p.fix.screw ? [{ id: `ISO4762-${p.fix.screw}x8`, name: `Socket head cap screw ISO 4762 ${p.fix.screw} × 8`, qty: Math.round(p.fix.n || 2), kind: "screw", size: p.fix.screw, length: 8 }] : []; },
    gdt: () => ({ symbol: "position", tolerance: 0.3 }),
    signature: (p) => (p.shape === "round" ? `d${round2(p.d)}` : `${round2(p.w)}x${round2(p.h)}`),
  },
  rail: {
    label: "Rail / card guide", fr: "Glissière / guide-carte",
    doc: "Une languette (bord de PCB, tôle, nervure) glisse dans une rainure. A = languette (aucune géométrie ajoutée) ; B = rainure usinée ou extrudée le long de u.",
    params: { t: 1.6, depth: 3, length: 60 }, optsA: {}, optsB: { clearance: 0.2 },
    compile(side, p, o) {
      if (side === "A" || o.extruded) return [];                    // extruded : the groove is in the section of the profile
      return [{ op: "pocket", rectUV: [p.length, round2(p.t + 2 * (o.clearance ?? 0.2))], r: 0, depth: p.depth }];
    },
    hardware: () => [],
    gdt: (p, oA, oB) => ({ symbol: "parallelism", tolerance: 0.1, width: round2(p.t + 2 * ((oB && oB.clearance) ?? 0.2)) }),
    signature: (p) => `t${round2(p.t)}|${round2(p.length)}`,
  },
  pins: {
    label: "Dowel pins", fr: "Goupilles de positionnement",
    doc: "Deux goupilles donnent la position précise. A = trous glissants ; B = trous serrés où les goupilles sont chassées.",
    params: { d: 4, pitch: 40, n: 2, length: 12 }, optsA: { depth: "through" }, optsB: { depth: null },
    compile(side, p, o) {
      const n = Math.max(1, Math.round(p.n || 2)), pts = [];
      for (let i = 0; i < n; i++) pts.push([(i - (n - 1) / 2) * p.pitch, 0]);
      return [{ op: "hole", uv: pts, d: p.d, depth: side === "A" ? (o.depth ?? "through") : (o.depth ?? round2((p.length || 12) * 0.5)), fit: side === "A" ? "F7" : "P7" }];
    },
    hardware: (p) => [{ id: `ISO8734-${p.d}x${p.length || 12}`, name: `Dowel pin ISO 8734 Ø${p.d} × ${p.length || 12}`, qty: Math.round(p.n || 2), kind: "pin", size: p.d }],
    gdt: () => ({ symbol: "position", tolerance: 0.02, diameter: true }),
    signature: (p) => `d${round2(p.d)}|${round2(p.pitch)}|${Math.round(p.n || 2)}`,
  },
};

Object.assign(INTERFACE_TYPES, ELEC_INTERFACES);                  // welded / wire-bonded joints and lamella pressure contacts (interfaces_elec.js)

export function interfaceType(type) {
  const t = INTERFACE_TYPES[type];
  if (!t) throw new Error(`Type d'interface inconnu « ${type} ». Types : ${Object.keys(INTERFACE_TYPES).join(", ")}.`);
  return t;
}

/** Mate frame of an interface on its part: origin on the mating plane, n outward, u/v in the plane. */
export function interfaceFrame(iface, level) {
  const face = faceKey(iface.face || "+Z"), F = FACES[face];
  const o = facePoint(face, iface.at || [0, 0], level);
  return rotateFrame({ o, u: F.u, v: F.v, n: F.n }, iface.rot || 0);
}

/** Features (face-based, model coordinates) generated by one side of an interface. */
export function compileInterface(iface, level) {
  const type = interfaceType(iface.type), side = iface.side === "B" ? "B" : "A";
  const face = faceKey(iface.face || "+Z"), F = FACES[face], fr = interfaceFrame(iface, level);
  const p = { ...structuredCloneSafe(type.params), ...(iface.params || {}) };
  const o = { ...(side === "A" ? type.optsA : type.optsB), ...(iface.opts || {}) };
  const sign = side === "B" ? -1 : 1;
  const toFace = ([pu, pv]) => { const P = v3.add(fr.o, v3.add(v3.mul(fr.u, pu), v3.mul(fr.v, pv * sign))); return [P[F.plane[0]], P[F.plane[1]]]; };
  const out = [];
  type.compile(side, p, o).forEach((raw, k) => {
    const f = { ...raw, id: `${iface.id}.${k + 1}`, iface: iface.id, face, body: iface.body };
    if (raw.uv) { f.at = raw.uv.map(toFace); delete f.uv; }
    if (raw.op === "boss") { f.start = raw.below ? level - raw.h : level; delete f.below; if (raw.lift) { fr.o = v3.add(fr.o, v3.mul(fr.n, raw.lift)); delete f.lift; } }      // lift : the mating plane is on the tops (gap-control pips)
    else if (raw.op === "arch") { const a0 = toFace([0, 0]), a1 = toFace(raw.dirUV || [1, 0]); f.dir = [round2(a1[0] - a0[0]), round2(a1[1] - a0[1])]; delete f.dirUV; f.start = level; if (raw.lift) { fr.o = v3.add(fr.o, v3.mul(fr.n, raw.lift)); delete f.lift; } }      // a spring blade : its span turns with the interface
    else if (raw.op === "pad") { Object.assign(f, padFeature(raw, fr, F, level)); fr.o = v3.add(fr.o, v3.mul(fr.n, raw.t)); }   // the mating plane is the top of the pad
    else f.start = level;
    if (raw.rectUV) {
      const [w, h] = raw.rectUV, c = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(toFace);
      f.profile = { poly: c, r: raw.r || 0 }; delete f.rectUV; delete f.r;
    }
    out.push(f);
  });
  return { features: out, frame: fr, params: p, opts: o };
}
function padFeature(raw, fr, F, level) {
  const c = [[-raw.w / 2, -raw.h / 2], [raw.w / 2, -raw.h / 2], [raw.w / 2, raw.h / 2], [-raw.w / 2, raw.h / 2]]
    .map(([a, b]) => { const P = v3.add(fr.o, v3.add(v3.mul(fr.u, a), v3.mul(fr.v, b))); return [P[F.plane[0]], P[F.plane[1]]]; });
  return { op: "pad", profile: { poly: c }, start: level, h: raw.t, w: undefined, t: undefined };
}
function structuredCloneSafe(o) { return JSON.parse(JSON.stringify(o)); }

/** Can two interfaces mate? Same type, opposite sides, and the same key or the same geometric signature. */
export function compatible(a, b) {
  if (!a || !b || a.type !== b.type) return { ok: false, why: "types différents" };
  const sideA = a.side === "B" ? "B" : "A", sideB = b.side === "B" ? "B" : "A";
  if (sideA === sideB && a.type !== "planar") return { ok: false, why: "même côté (il faut un A et un B)" };
  const t = interfaceType(a.type);
  const pa = { ...t.params, ...(a.params || {}) }, pb = { ...t.params, ...(b.params || {}) };
  const same = t.signature(pa) === t.signature(pb);
  if (a.key && b.key) return a.key === b.key ? { ok: true, same, by: "key" } : { ok: false, why: "clés différentes" };
  return same ? { ok: true, same, by: "signature" } : { ok: false, why: "géométries différentes" };
}
export const interfaceSignature = (i) => { const t = interfaceType(i.type); return t.signature({ ...t.params, ...(i.params || {}) }); };
