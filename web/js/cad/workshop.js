/* DesignWizard.ai — the workshop: a part is made the way a craftsman makes it. It starts from raw stock (spec.stock,
   see stock.js) and its "features" may use workshop verbs — drill, tap, counterbore, countersink, ream, mill, face,
   step, groove, outline, turn, bore, break_edges, deburr, finish — next to the kernel operations.
   expandSpec() rewrites stock and verbs into kernel features, structurally (expressions are kept as text, so the
   part stays parametric and every downstream tool sees a plain part). routing() writes the routing sheet ("gamme de
   fabrication"): stock, cutting, operations by set-up, tools, finishing. */

import { thread, clearanceHole, END_MILLS } from "./standards.js";
import { stockFeatures, stockForm } from "./stock.js";
import { evalDeep } from "./expr.js";
import { FACES, faceKey } from "./vec.js";
import { PROCESSES } from "./materials.js";

const BIG = 4000;                                              // "beyond the part" for open cuts (mm)
const round2 = (x) => Math.round(x * 100) / 100;
const fr = (x, d = 2) => (typeof x === "number" ? (Math.round(x * 10 ** d) / 10 ** d).toLocaleString("fr-CA") : String(x));
/** a (+|-) b on numbers or expressions. */
const ex = (a, op, b) => (typeof a === "number" && typeof b === "number" ? (op === "-" ? a - b : a + b) : `(${a}) ${op} (${b})`);
const carry = (f, extra) => {
  const o = { id: f.id, name: f.name, body: f.body, suppressed: f.suppressed, when: f.when, shop: f.op, ...extra };
  for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k];
  return o;
};
const need = (f, keys) => { for (const k of keys) if (f[k] === undefined || f[k] === null) throw new Error(`« ${f.op} » : « ${k} » manquant.`); };
const axisPlane = { X: "YZ", Y: "XZ", Z: "XY" };

/** Box removing everything beyond level `to` on the outside of `face`, over rect [a, b, w, h] of the face plane (model coordinates). */
function openCut(f, rect) {
  const face = faceKey(f.face || "+Z"), F = FACES[face], [i, j] = F.plane, k = F.axis, up = F.n[k] > 0;
  const at = [0, 0, 0], size = [0, 0, 0];
  at[i] = rect[0]; at[j] = rect[1]; size[i] = rect[2]; size[j] = rect[3];
  at[k] = up ? f.to : ex(f.to, "-", BIG); size[k] = BIG;
  return carry(f, { op: "box", mode: "cut", at, size });
}

/* verb -> { fr: label, icon, doc: one line for the language reference, expand(f, ctx) -> kernel features } */
export const SHOP_VERBS = {
  drill: { fr: "Percer", icon: "drill", expand: (f) => { need(f, ["d"]); return [carry(f, { op: "hole", face: f.face, at: f.at, d: f.d, depth: f.depth ?? "through", start: f.start })]; } },
  tap: { fr: "Tarauder", icon: "tap", expand: (f) => { need(f, ["thread"]); thread(f.thread); return [carry(f, { op: "hole", face: f.face, at: f.at, thread: f.thread, depth: f.depth ?? "through", start: f.start })]; } },
  cbore: { fr: "Lamer", icon: "drill", expand: (f) => { need(f, ["screw"]); const th = thread(f.screw);
    return [carry(f, { op: "hole", face: f.face, at: f.at, d: clearanceHole(f.screw, f.fit || "medium"), depth: f.depth ?? "through", cbore: { d: th.cbore, depth: round2(th.head[1] + 0.4) }, start: f.start })]; } },
  csink: { fr: "Fraiser (fraisure)", icon: "drill", expand: (f) => { need(f, ["screw"]); const th = thread(f.screw);
    return [carry(f, { op: "hole", face: f.face, at: f.at, d: clearanceHole(f.screw, f.fit || "medium"), depth: f.depth ?? "through", csink: { d: th.csk, angle: 90 }, start: f.start })]; } },
  ream: { fr: "Aléser", icon: "drill", expand: (f) => { need(f, ["d"]); return [carry(f, { op: "hole", face: f.face, at: f.at, d: f.d, depth: f.depth ?? "through", fit: f.fit || "H7", start: f.start })]; } },
  mill: { fr: "Fraiser une poche", icon: "mill", expand: (f) => [carry(f, { op: "pocket", face: f.face, rect: f.rect, circle: f.circle, profile: f.profile, r: f.r, depth: f.depth, start: f.start })] },
  groove: { fr: "Rainurer", icon: "mill", expand: (f) => { need(f, ["from", "to", "w"]); return [carry(f, { op: "slot", face: f.face, from: f.from, to: f.to, w: f.w, depth: f.depth, start: f.start })]; } },
  face: { fr: "Surfacer", icon: "mill", expand: (f) => { need(f, ["to"]); return [openCut(f, [-BIG, -BIG, 2 * BIG, 2 * BIG])]; } },
  step: { fr: "Épauler", icon: "mill", expand: (f) => { need(f, ["rect", "to"]); return [openCut(f, f.rect)]; } },
  outline: { fr: "Détourer", icon: "laser", expand(f, ctx) {
    need(f, ["profile"]);
    const flat = ctx.stock && stockForm(ctx.stock.form).flat, len = f.length ?? (flat ? (ctx.stock.t ?? ctx.stock.H) : undefined);
    if (len === undefined) throw new Error("« outline » : donnez « length » (épaisseur traversée) quand le brut n'est pas une plaque.");
    return [carry(f, { op: "extrude", profile: f.profile, plane: f.plane || "XY", at: f.at ?? 0, length: len, mode: "intersect" })];
  } },
  turn: { fr: "Charioter", icon: "lathe", expand(f, ctx) {
    need(f, ["from", "to", "d"]);
    const axis = String((ctx.stock && ctx.stock.axis) || f.axis || "Z").toUpperCase(), D = ctx.stock && ctx.stock.d !== undefined ? ex(ctx.stock.d, "+", 2) : BIG;
    return [carry(f, { op: "extrude", mode: "cut", plane: axisPlane[axis] || "XY", at: f.from, length: ex(f.to, "-", f.from), profile: { outer: { circle: [0, 0, D] }, holes: [{ circle: [0, 0, f.d] }] } })];
  } },
  bore: { fr: "Aléser dans l'axe", icon: "lathe", expand: (f) => { need(f, ["d"]); return [carry(f, { op: "hole", face: f.face || "+Z", at: [0, 0], d: f.d, depth: f.depth ?? "through", fit: f.fit, start: f.start })]; } },
  break_edges: { fr: "Casser les angles", icon: "deburr", expand: (f) => [carry(f, { op: "chamfer", d: f.d ?? 0.5, edges: f.edges ?? "all" })] },
  deburr: { fr: "Ébavurer", icon: "deburr", expand: () => [] },   // no geometry: a line of the routing and a note of the drawing
  finish: { fr: "Finition", icon: "palette", expand: () => [] },
};
export const isShopVerb = (op) => Object.prototype.hasOwnProperty.call(SHOP_VERBS, op);

/** Rewrite stock + workshop verbs into kernel features. Problems are pushed to `log` (the part still builds). */
export function expandSpec(spec, log = []) {
  if (!spec || (!spec.stock && !(spec.features || []).some((f) => f && isShopVerb(f.op)))) return spec;
  const out = { ...spec }, feats = [], ctx = { stock: spec.stock || null };
  if (spec.stock) {
    try { feats.push(...stockFeatures(spec.stock)); } catch (e) { log.push({ level: "error", feature: "stock", msg: `Matière première : ${e.message}` }); }
    if (spec.extrusion || spec.pcb) log.push({ level: "warn", feature: "stock", msg: "« stock » s'ajoute au bloc « extrusion » / « pcb » : gardez un seul des deux pour éviter deux bruts superposés." });
  }
  for (const f of spec.features || []) {
    if (!f || !isShopVerb(f.op)) { feats.push(f); continue; }
    try { feats.push(...SHOP_VERBS[f.op].expand(f, ctx)); }
    catch (e) { log.push({ level: "error", feature: f.id, op: f.op, msg: `Opération d'atelier « ${f.id || f.op} » : ${e.message}` }); }
  }
  out.features = feats;
  delete out.stock;
  return out;
}

/** Declare the raw stock of a part that starts with a plain block or a rectangular plate: returns {stock, features} or null. */
export function stockFromFirstFeature(spec) {
  const feats = spec.features || [], f = feats[0], zero = (v) => v === undefined || v === 0 || (Array.isArray(v) && v.every((x) => x === 0));
  if (!f || spec.stock || spec.extrusion || spec.pcb || (f.mode && f.mode !== "add") || (f.body && f.body !== "main")) return null;
  if (f.op === "box" && f.size && zero(f.at) && !f.center) return { stock: { form: "block", L: f.size[0], W: f.size[1], H: f.size[2] }, features: feats.slice(1) };
  const r = f.profile && f.profile.rect;
  if (f.op === "extrude" && (f.plane || "XY") === "XY" && zero(f.at) && !f.symmetric && r && zero(r[0]) && zero(r[1]) && (f.length ?? f.h) !== undefined) {
    const rest = feats.slice(1);
    return { stock: { form: "plate", L: r[2], W: r[3], t: f.length ?? f.h }, features: f.profile.r ? [{ op: "outline", id: f.id || "contour", name: f.name || "Contour", profile: f.profile }, ...rest] : rest };
  }
  return null;
}

/* ---------- routing sheet ---------- */
const FACE_FR = { "+Z": "dessus", "-Z": "dessous", "+X": "droite", "-X": "gauche", "+Y": "arrière", "-Y": "avant" };
const countAt = (at) => {
  if (!at) return 1;
  if (Array.isArray(at)) return at.length && typeof at[0] !== "number" && typeof at[0] !== "string" ? at.length : 1;
  if (at.grid) return Math.round(at.grid.nx || 1) * Math.round(at.grid.ny || 1);
  if (at.circle) return Math.round(at.circle.n || 1);
  return 1;
};
const depthText = (h) => (h.through || h.depth === "through" || h.depth === undefined || h.depth === null ? "débouchant" : `profondeur ${fr(h.depth)}`);
/** One line and its tools for a hole described like a `hole` feature or a hole fact. */
function holeLine(h, n) {
  const q = n > 1 ? `${n} × ` : "", tools = [];
  let text;
  if (h.thread) { const th = thread(h.thread); tools.push(`Foret Ø${fr(th.tap)}`, `Taraud ${String(h.thread).toUpperCase()}`); text = `Percer ${q}Ø${fr(th.tap)} et tarauder ${String(h.thread).toUpperCase()}, ${depthText(h)}`; }
  else {
    tools.push(`Foret Ø${fr(h.d)}`);
    if (h.cbore) { tools.push(`Fraise à lamer Ø${fr(h.cbore.d)}`); text = `Percer ${q}Ø${fr(h.d)} et lamer Ø${fr(h.cbore.d)} × ${fr(h.cbore.depth)}`; }
    else if (h.csink) { tools.push(`Fraise à chanfreiner ${h.csink.angle || 90}°`); text = `Percer ${q}Ø${fr(h.d)} et fraiser à ${h.csink.angle || 90}° Ø${fr(h.csink.d)}`; }
    else if (h.insert || h.fit === "insert") text = `Percer ${q}Ø${fr(h.d)} pour insert, ${depthText(h)}`;
    else if (/^[A-Z]\d$/.test(h.fit || "")) { tools.push(`Alésoir Ø${fr(h.d)} ${h.fit}`); text = `Percer et aléser ${q}Ø${fr(h.d)} ${h.fit}, ${depthText(h)}`; }
    else text = `Percer ${q}Ø${fr(h.d)}, ${depthText(h)}`;
  }
  return { text, tools };
}
/** Largest standard end mill that makes inside corners of radius r (0 = sharp: no tool can). */
const endMill = (r) => { const fit = END_MILLS.filter((d) => d / 2 <= r + 1e-6); return fit.length ? fit[fit.length - 1] : null; };
function pocketLine(f, what) {
  const r = f.r ?? (f.circle ? f.circle[2] / 2 : f.slot ? f.slot[4] / 2 : f.w ? f.w / 2 : 0), d = endMill(r);
  const tools = d ? [`Fraise 2 tailles Ø${fr(d)}`] : [];
  const through = f.depth === "through" || f.depth === undefined;
  return { text: `${what}${through ? ", débouchant" : `, profondeur ${fr(f.depth)}`}${r ? ` (rayons de coin ${fr(r)})` : ""}`, tools };
}

const BEAM = new Set(["laser_cut", "sheet_metal"]);              // the contour and the through holes are cut in one pass
const CUT_BY_PROCESS = { laser_cut: "Découper le contour au laser / jet d'eau", sheet_metal: "Découper le contour au laser", pcb: "Détourer le panneau", cnc_turning: "Tronçonner", extrusion_al: "Couper à longueur", extrusion_plastic: "Couper à longueur" };
const NEAR_NET = { fdm: ["Imprimer en FDM (orienter la plus grande face sur le plateau)", "Retirer les supports"], mjf: ["Imprimer en MJF / SLS", "Dépoudrer et microbiller"],
  injection_molding: ["Mouler par injection (outillage dédié)", "Dégrapper et contrôler les retassures"] };

/** Routing sheet of a part. `built` = result of the kernel build (params.scope, facts). */
export function routing(spec, built) {
  const scope = (built && built.params && built.params.scope) || {}, facts = (built && built.facts) || {}, steps = [], tools = new Set(), faces = new Set(), advice = [];
  const add = (kind, text, o = {}) => { steps.push({ kind, text, face: o.face || null, source: o.source || null, iface: o.iface || null }); (o.tools || []).forEach((t) => tools.add(t)); if (o.face && kind !== "stock") faces.add(o.face); };
  const st = facts.stock || null, proc = spec.process, nearNet = !!NEAR_NET[proc];   // moulded / printed: the shapes come out of the tool, only inserts and threads are operations
  if (st) {
    add("stock", `Approvisionner : ${st.label}`);
    if (!st.additive) add("cut", `${CUT_BY_PROCESS[proc] || "Débiter à la scie"}${st.allowance ? ` (surépaisseur d'usinage ${fr(st.allowance)} mm)` : ""}`);
    if (!st.exact && !st.additive && st.raw && st.raw.t) add("machine", `Surfacer à l'épaisseur finie (brut de ${fr(st.raw.t)} mm)`, { tools: ["Fraise à surfacer"], face: "+Z" });
    advice.push(...(st.advice || []));
  } else if (spec.extrusion) { add("stock", "Extruder le profilé (filière dédiée)"); add("cut", "Couper à longueur"); }
  else if (spec.pcb) add("stock", "Fabriquer le circuit imprimé (panneau FR4), détourer");
  else if (!NEAR_NET[proc] && proc !== "purchased") add("stock", "Brut à définir : la pièce ne déclare pas sa matière première (« stock »)");
  for (const line of NEAR_NET[proc] || []) add("machine", line);

  let feats = [];
  try { feats = evalDeep(spec.features || [], scope); } catch (e) { advice.push(`Gamme incomplète : ${e.message}`); }
  const ifaceSteps = () => {
    const groups = new Map();
    for (const h of facts.holes || []) if (h.iface) { const k = [h.iface, h.face, h.d, h.thread, h.cbore && h.cbore.d, h.csink && h.csink.d, h.through ? "t" : h.depth, h.fit, h.insert].join("|"); if (!groups.has(k)) groups.set(k, { h, n: 0 }); groups.get(k).n++; }
    for (const { h, n } of groups.values()) {
      const it = (spec.interfaces || []).find((x) => x.id === h.iface), l = holeLine(h, n), tail = ` — interface ${h.iface}${it && it.name ? ` « ${it.name} »` : ""}`;
      if (nearNet) {
        if (h.insert || h.fit === "insert") add("hole", `Poser ${n} insert(s)${it && it.params && it.params.screw ? ` ${it.params.screw}` : ""} à chaud${tail}`, { iface: h.iface });
        else if (h.thread) add("hole", `Tarauder ${n > 1 ? `${n} × ` : ""}${String(h.thread).toUpperCase()} en reprise${tail}`, { tools: [`Taraud ${String(h.thread).toUpperCase()}`], iface: h.iface });
        continue;
      }
      if (BEAM.has(proc) && h.through && !h.thread && !h.cbore && !h.csink) add("cut", `Découper ${n > 1 ? `${n} × ` : ""}Ø${fr(h.d)} dans la même passe${tail}`, { iface: h.iface });
      else add("hole", l.text + tail, { face: h.face, tools: l.tools, iface: h.iface });
    }
    if (nearNet) return;
    for (const p of facts.pockets || []) if (p.iface) { const l = pocketLine({ r: p.rMin, depth: p.through ? "through" : p.depth }, `Fraiser l'ouverture ${fr(p.w)} × ${fr(p.h)}`); add("machine", `${l.text} — interface ${p.iface}`, { face: p.face, tools: l.tools, iface: p.iface }); }
    const bosses = new Map();
    for (const b of facts.bosses || []) if (b.iface) bosses.set(b.iface, (bosses.get(b.iface) || 0) + 1);
    for (const [id, n] of bosses) add("machine", `Laisser ${n} bossage(s) — interface ${id}`, { iface: id });
  };
  let ifaceDone = false, shaped = 0;
  for (const f of feats) {
    if (!f || f.suppressed || (f.when !== undefined && !f.when)) continue;
    const face = f.face ? faceKey(f.face) : null, o = { face, source: f.id }, n = countAt(f.at);
    try {
      if (f.op === "interfaces") { ifaceSteps(); ifaceDone = true; }
      else if (nearNet && !["tap", "deburr", "finish"].includes(f.op) && !(f.op === "hole" && f.thread)) shaped++;
      else if (["drill", "tap", "cbore", "csink", "ream", "bore", "hole"].includes(f.op)) {
        const k = isShopVerb(f.op) ? SHOP_VERBS[f.op].expand(f, {})[0] : f;
        const through = k.depth === "through" || k.depth === undefined, l = holeLine({ ...k, through }, f.op === "bore" ? 1 : n);
        if (BEAM.has(proc) && through && !k.thread && !k.cbore && !k.csink) add("cut", `Découper ${n > 1 ? `${n} × ` : ""}Ø${fr(k.d)} dans la même passe`, o);
        else add("hole", f.op === "bore" ? l.text.replace("Percer", "Percer dans l'axe") : l.text, { ...o, face: face || "+Z", tools: l.tools });
      } else if (f.op === "mill" || f.op === "pocket") { const l = pocketLine(f, "Fraiser une poche"); add("machine", l.text, { ...o, tools: l.tools }); }
      else if (f.op === "groove" || f.op === "slot") { const l = pocketLine({ ...f, r: f.w / 2 }, `Fraiser une rainure de ${fr(f.w)}`); add("machine", l.text, { ...o, tools: l.tools }); }
      else if (f.op === "face") add("machine", `Surfacer jusqu'à la cote ${fr(f.to)}`, { ...o, tools: ["Fraise à surfacer"] });
      else if (f.op === "step") add("machine", `Épauler jusqu'à la cote ${fr(f.to)} (zone ${fr(f.rect[2])} × ${fr(f.rect[3])})`, { ...o, tools: ["Fraise 2 tailles"] });
      else if (f.op === "outline") { if (!BEAM.has(proc)) add("cut", "Détourer le contour de la pièce", { ...o, face: null, tools: proc === "cnc_milling" ? ["Fraise 2 tailles"] : [] }); }
      else if (f.op === "turn") add("machine", `Charioter Ø${fr(f.d)} de ${fr(f.from)} à ${fr(f.to)}`, { ...o, tools: ["Outil à charioter"] });
      else if (f.op === "break_edges" || f.op === "chamfer") add("finish", `Chanfreiner ${fr(f.d ?? 0.5)} × 45°`, { ...o, face: null, tools: ["Fraise à chanfreiner 90°"] });
      else if (f.op === "fillet") add("machine", `Rayonner R${fr(f.r)}`, { ...o, face: null });
      else if (f.op === "deburr") add("finish", f.note || "Ébavurer, casser les angles vifs 0,2 à 0,5 mm", o);
      else if (f.op === "finish") add("finish", `Finition : ${f.note || spec.finish || "à préciser"}`, o);
      else if (f.op === "shell") add("machine", `Évider, paroi ${fr(f.t)}`, o);
      else if (f.op === "extrude" && f.mode === "cut") add("machine", "Fraiser le profil (enlèvement)", o);
      else if (["boss", "pad"].includes(f.op)) add("machine", `Laisser ${n > 1 ? `${n} bossages` : "un bossage"} (matière conservée autour)`, o);
      else if (["box", "cylinder", "extrude", "revolve"].includes(f.op) && !st) add("machine", `Mettre en forme : ${f.name || f.op}`, o);
    } catch (e) { advice.push(`Opération « ${f.id || f.op} » : ${e.message}`); }
  }
  if (!ifaceDone) ifaceSteps();
  if (nearNet && shaped) steps.splice(1, 0, { kind: "machine", text: `${shaped} forme(s) venue(s) d'outillage ou d'impression (coque, bossages, ouvertures) : aucune reprise`, face: null, source: null, iface: null });
  if (!steps.some((s) => s.kind === "finish" && /bavur/i.test(s.text)) && proc !== "purchased") add("finish", "Ébavurer, casser les angles vifs 0,2 à 0,5 mm");
  if (spec.finish && !steps.some((s) => /^Finition/.test(s.text))) add("finish", `Finition : ${spec.finish}`);
  add("check", "Contrôler les cotes des interfaces (voir le dessin)");
  const rank = { stock: 0, cut: 1, machine: 2, hole: 2, finish: 3, check: 4 };
  steps.sort((a, b) => rank[a.kind] - rank[b.kind]);           // stable: workshop order is kept inside each stage
  steps.forEach((s, i) => { s.n = (i + 1) * 10; });

  const setups = [...faces];
  if (setups.length > 2 && (proc === "cnc_milling" || !proc)) advice.push(`${setups.length} faces usinées (${setups.map((f) => FACE_FR[f] || f).join(", ")}) : autant de posages. Correctif : regroupez les usinages sur une ou deux faces.`);
  const utilisation = st && st.rawVolume && built && built.volume ? built.volume / st.rawVolume : null;
  if (utilisation !== null && utilisation < 0.25 && !st.additive) advice.push(`Seulement ${Math.round(utilisation * 100)} % du brut reste dans la pièce (ratio matière ${fr(1 / utilisation, 1)}:1). Correctif : un brut plus proche de la forme (cornière, tube, profilé) ou un autre procédé.`);
  return { steps, tools: [...tools], setups, advice, stock: st, utilisation, process: PROCESSES[proc] ? PROCESSES[proc].fr : null };
}
export { FACE_FR };
