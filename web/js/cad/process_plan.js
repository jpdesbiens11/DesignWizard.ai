/* DesignWizard.ai — the detailed manufacturing routing of a part, written for the discussion with a supplier : phase
   by phase — station, work holding, operations with their tools and their checks — then the characteristics the
   interfaces ask to hold and the questions worth asking before the order. It is built on the routing of cad/shop.js
   (operations in shop order) and proposes ; the supplier's own routing prevails. */

import { routing, FACE_FR } from "./shop.js";
import { PROCESSES, material } from "./materials.js";
import { evalDeep, resolveParams } from "./expr.js";
import { patternPoints, interfaceType } from "./interfaces.js";
import { thread, clearanceHole } from "./standards.js";
import { finishPlan } from "../core/plan_doc.js";

const fr = (v, d = 2) => (typeof v === "number" && Number.isFinite(v) ? String(Math.round(v * 10 ** d) / 10 ** d).replace(".", ",") : String(v ?? "—"));
const OPPOSITE = { "+X": "-X", "-X": "+X", "+Y": "-Y", "-Y": "+Y", "+Z": "-Z", "-Z": "+Z" };
const STATION = { cnc_milling: ["Scie à ruban", "Centre d'usinage 3 axes"], cnc_turning: ["Scie ou embarreur", "Tour à commande numérique"], laser_cut: ["Découpe laser de précision", "Perceuse, taraudeuse"], sheet_metal: ["Découpe laser", "Presse plieuse, taraudeuse"],
  extrusion_al: ["Presse à filer, scie", "Centre d'usinage (reprises)"], extrusion_plastic: ["Extrudeuse, scie", "Perceuse (reprises)"], fdm: ["Imprimante 3D (dépôt de fil)", "Établi (reprises)"], mjf: ["Imprimante 3D (lit de poudre)", "Établi (reprises)"], sla: ["Imprimante 3D (résine)", "Établi (reprises)"], lpbf: ["Machine de fusion laser sur lit de poudre, four de détente", "Centre d'usinage (reprises)"],
  injection_molding: ["Presse à injecter", "Établi (reprises)"], die_casting: ["Fonderie sous pression", "Centre d'usinage (reprises)"], sand_casting: ["Fonderie", "Centre d'usinage (reprises)"], pcb: ["Fabricant de circuits imprimés", "Fabricant de circuits imprimés"] };
const NEAR_NET = new Set(["fdm", "mjf", "sla", "lpbf", "injection_molding", "die_casting", "sand_casting"]);
const RAW = { extrusion_al: "profilé filé sur une filière dédiée", extrusion_plastic: "profilé extrudé sur une filière dédiée", injection_molding: "matière en granulés", die_casting: "alliage en lingots", sand_casting: "alliage en lingots", fdm: "filament", mjf: "poudre", sla: "résine liquide", lpbf: "poudre métallique certifiée (lot et nombre de réutilisations)", pcb: "panneau FR-4" };
/** How an operation is checked, read from what it says. */
function controlOf(text) {
  if (/Tarauder|taraud|insert/i.test(text)) return "Tampon fileté entre / n'entre pas";
  if (/Aléser|H7|H8/.test(text)) return "Tampon lisse";
  if (/Percer|Découper .*Ø|Lamer|Fraisurer/.test(text)) return "Pige ou pied à coulisse ; position au dessin";
  if (/Fraiser|Surfacer|Épauler|Charioter|Détourer|Évider/.test(text)) return "Pied à coulisse, jauge de profondeur";
  if (/Débiter|Couper|Tronçonner/.test(text)) return "Réglet, longueur ± 0,5 mm";
  if (/Plier/.test(text)) return "Rapporteur d'angle, ± 1°";
  if (/bavur|Chanfreiner/i.test(text)) return "Visuel et toucher";
  return "";
}

/** What each interface asks the shop to hold, in plain words. */
function characteristics(spec, scope) {
  const out = [];
  for (const i of spec.interfaces || []) {
    let p = {}; try { p = evalDeep({ ...(interfaceType(i.type).params || {}), ...(i.params || {}) }, scope); } catch (e) { p = i.params || {}; }
    const name = `${i.id}${i.name ? ` « ${i.name} »` : ""}`;
    if (i.type === "bolt_pattern") {
      const n = patternPoints(p.pattern).length, pat = p.pattern || {}, span = pat.type === "circle" || pat.pcd ? `sur Ø ${fr(pat.pcd)}` : n > 1 ? `entraxes ${fr(pat.dx)} × ${fr(pat.dy)}` : "";
      const o = i.opts || {}, th = thread(p.screw || "M4");
      out.push({ text: i.side === "B" ? `${name} : ${n} × ${p.screw} ${o.thread === "insert" ? "(inserts)" : o.thread === "clearance" ? `Ø ${fr(clearanceHole(p.screw))} de passage` : "taraudés"}, ${span} ; positions ± 0,1` : `${name} : ${n} × Ø ${fr(clearanceHole(p.screw, o.fit || "medium"))} (passage ${p.screw})${o.head === "cbore" ? `, lamages Ø ${fr(th.cbore)}` : ""}, ${span} ; positions ± 0,1`,
        control: i.side === "B" && o.thread !== "clearance" ? "Tampon fileté ; entraxes au pied à coulisse" : "Pige ; entraxes au pied à coulisse" });
    } else if (i.type === "fit") out.push({ text: `${name} : ${i.side === "B" ? "alésage" : "portée"} Ø ${fr(p.d)} ${String(p.fit || "H7/g6").split("/")[i.side === "B" ? 0 : 1] || ""}, longueur ${fr(p.length)}`, control: i.side === "B" ? "Tampon lisse ou alésomètre" : "Micromètre" });
    else if (i.type === "planar") out.push({ text: `${name} : face d'appui ${fr(p.w)} × ${fr(p.h)}, planéité 0,1, état de surface Ra 3,2`, control: "Marbre et cales, visuel" });
    else if (i.type === "pins") out.push({ text: `${name} : ${p.n || 2} × Ø ${fr(p.d)} ${i.side === "B" ? "serrés (goupilles chassées)" : "glissants"}, entraxe ${fr(p.pitch)} ± 0,02`, control: "Tampon lisse ; entraxe sur machine à mesurer" });
    else if (i.type === "cutout") out.push({ text: `${name} : découpe ${p.shape === "round" || p.shape === "circle" ? `Ø ${fr(p.d)}` : `${fr(p.w)} × ${fr(p.h)}, rayons ${fr(p.r)}`}`, control: "Pied à coulisse, gabarit du composant" });
    else if (i.type === "rail") out.push({ text: `${name} : ${i.side === "B" ? `rainure de ${fr(p.t)}, profondeur ${fr(p.depth)}` : `languette de ${fr(p.t)}`}, sur ${fr(p.length)}`, control: "Cale d'épaisseur" });
  }
  return out;
}

/** Questions worth asking the supplier before the order, from what the part is. */
function questions(spec, r, facts, opts) {
  const q = [], add = (topic, text) => q.push({ topic, text }), st = r.stock, proc = spec.process, qty = (opts.order && opts.order.quantity) || (spec.order && spec.order.quantity) || (spec.intent && spec.intent.quantity) || 1;
  add("Délai et prix", `Prix et délai pour ${qty} pièce${qty > 1 ? "s" : ""}${qty < 5 ? ", puis pour 5 et 25" : ""} ? Le lancement est-il facturé à part ?`);
  if (st && !st.additive) add("Matière", st.exact ? `Le brut ${st.label} est-il en stock ? Les faces restent brutes : état de livraison acceptable ?` : st.standard ? `Le brut ${st.label} est-il en stock ? Sinon, quel brut proche proposez-vous ?` : `Le brut ${st.label} n'est pas une taille courante : que proposez-vous à la place, et à quel délai ?`);
  if (material(spec.material) && ["metal", "sheet"].includes(material(spec.material).cls)) add("Matière", "Fournissez-vous le certificat matière (type 3.1) ?");
  if (r.utilisation !== null && r.utilisation < 0.3 && st && !st.additive) add("Matière", `Seulement ${Math.round(r.utilisation * 100)} % du brut reste dans la pièce : un brut plus proche de la forme est-il possible ?`);
  if (r.setups.length > 2) add("Posages", `La gamme prévoit ${r.setups.length} posages (${r.setups.map((f) => FACE_FR[f] || f).join(", ")}) : pouvez-vous en regrouper (4e axe, étau double, montage) ?`);
  const taps = r.steps.filter((s) => /tarauder/i.test(s.text));
  if (taps.length) add("Filetages", "Taraudage coupé ou par déformation ? La profondeur utile indiquée est-elle garantie ?");
  const deep = (facts.holes || []).filter((h) => !h.through && h.depth > 5 * h.d);
  if (deep.length) add("Perçages", `${deep.length} perçage(s) borgne(s) de plus de 5 fois le diamètre : débourrage ou foret long, quelle tolérance de position tenez-vous au fond ?`);
  if ((spec.interfaces || []).some((i) => i.type === "fit" || i.type === "pins")) add("Tolérances", "Les ajustements (alésages, goupilles) sont-ils alésés ou interpolés ? Quel moyen de contrôle ?");
  add("Tolérances", "Tolérance générale ISO 2768-mK et cotes d'interface à ± 0,1 : y a-t-il une cote que vous déconseillez à ce prix ?");
  if (spec.finish && !/brut|aucun/i.test(spec.finish)) add("Finition", `Finition « ${spec.finish} » : faite chez vous ou sous-traitée ? Délai ajouté ? Zones à épargner (filetages, portées, appuis électriques) ?`);
  if (proc === "sheet_metal") add("Pliage", "Rayon de pliage et outillage disponibles ? Sens du laminage par rapport aux plis ? Tolérance d'angle ?");
  if (proc === "laser_cut" || proc === "sheet_metal") add("Découpe", "Quelle source laser et quel gaz pour cette matière ? Bavure, oxyde ou bord carbonisé : quel état de bord est livré, comment est-il contrôlé ?");
  if (proc === "fdm" || proc === "mjf" || proc === "sla") add("Impression", "Orientation d'impression proposée ? Supports sur quelles faces ? Tenue des cotes d'interface sans reprise ?");
  if (proc === "lpbf") add("Impression métal", "Orientation et supports proposés ? Détente avant séparation, compaction isostatique, traitement de l'alliage : qui les fait, avec quel certificat ? Éprouvettes fabriquées avec la pièce ? Lot de poudre et nombre de réutilisations ?");
  if (proc === "injection_molding") add("Outillage", "Plan de joint, points d'injection et éjecteurs proposés ? Dépouilles suffisantes ? Moule prototype (aluminium) ou série ?");
  if (proc === "die_casting" || proc === "sand_casting") { add("Outillage", "Plan de joint, attaques de coulée, évents et éjecteurs proposés ? Dépouilles suffisantes ? Prix et durée de vie du moule ?"); add("Fonderie", "Quelle porosité garantissez-vous dans les zones taraudées et étanches ? Contrôle par radiographie ou par ressuage ?"); add("Reprises", "Quelles surépaisseurs d'usinage sur les plans d'appui et les alésages ? Les reprises sont-elles faites chez vous ?"); }
  if (proc === "extrusion_al" || proc === "extrusion_plastic") add("Outillage", "Prix et délai de la filière ? Longueur minimale de commande ? Tolérances du profil (EN 755-9) ?");
  if (proc === "pcb") add("Circuit imprimé", "Classe de fabrication, finition et délai ? Essai électrique à 100 % ?");
  add("Contrôle", "Fournissez-vous un relevé des cotes d'interface avec la première pièce ?");
  for (const f of ((opts.dfx && opts.dfx.findings) || []).filter((x) => x.severity !== "info").slice(0, 6)) add("Fabricabilité", `${f.title} — ${f.message} Qu'en pensez-vous ?`);
  return q;
}

/** The detailed routing of a part. opts : { dfx (result of the DFx analysis), order, route (routing already computed) }. */
export function processPlan(spec, built, opts = {}) {
  const r = opts.route || routing(spec, built), facts = (built && built.facts) || {}, proc = spec.process, stations = STATION[proc] || ["Débit", "Atelier"], near = NEAR_NET.has(proc), phases = [], notes = (spec.plan && spec.plan.notes) || {};
  let scope = {}; try { scope = (built && built.params && built.params.scope) || resolveParams(spec.params || {}).scope; } catch (e) { scope = {}; }
  const op = (s) => ({ text: s.text, tools: s.tools || [], control: controlOf(s.text), source: s.source || null, iface: s.iface || null });
  const phase = (key, title, station, steps, extra = {}) => { if (steps.length || extra.force) phases.push({ key, title, station, ops: steps.map(op), note: notes[key] || "", ...extra }); };
  const of = (kinds) => r.steps.filter((s) => kinds.includes(s.kind));
  const bare = proc === "pcb";      // a bare board comes drilled and routed from its maker : one phase
  phase("stock", near ? "Mise en forme" : bare ? "Fabrication de la carte nue" : "Approvisionnement et débit", stations[0], [...of(["stock", "cut"]), ...(near ? of(["machine"]) : bare ? of(["machine", "hole"]) : [])]);
  if (bare) { /* nothing is taken up again */ } else if (!near) {
    const work = of(["machine", "hole"]), free = work.filter((s) => !s.face), faces = [...new Set(work.filter((s) => s.face).map((s) => s.face))];
    faces.forEach((f, i) => phase(`setup:${f}`, `${proc === "cnc_turning" ? "Tournage" : proc === "sheet_metal" || proc === "laser_cut" ? "Reprise" : "Usinage"} — posage ${i + 1}, ${FACE_FR[f] || f}`, stations[1], [...(i === 0 ? free : []), ...work.filter((s) => s.face === f)],
      { hold: proc === "cnc_turning" ? "mandrin trois mors, butée de longueur" : `étau ou bridage, appui sur la face opposée (${FACE_FR[OPPOSITE[f]] || OPPOSITE[f]})` }));
    if (!faces.length) phase("setup:free", "Usinage", stations[1], free);
  } else phase("rework", "Reprises", stations[1], of(["hole"]));
  phase("bend", "Pliage", "Presse plieuse", of(["bend"]), { hold: "butée arrière réglée sur la cote du bord ; premier pli contrôlé à l'équerre avant la série" });
  const fin = of(["finish"]), surface = fin.filter((s) => /^Finition/.test(s.text));
  phase("deburr", "Ébavurage", "Établi", bare ? [] : fin.filter((s) => !/^Finition/.test(s.text)));
  phase("surface", "Traitement de surface", "Sous-traitant", surface, { outsourced: surface.length > 0 && !/brut|aucun|peinture maison/i.test(spec.finish || ""), checks: surface.length ? ["Épaisseur et teinte conformes ; zones épargnées respectées", "Certificat du sous-traitant joint"] : [] });
  const chars = characteristics(spec, scope);
  phase("check", "Contrôle", "Métrologie", [], { force: true, checks: [...chars.map((c) => `${c.text} — ${c.control}`), "Aspect : pas de bavure, pas de choc, pas de rayure sur les faces fonctionnelles"] });
  phase("pack", "Marquage et conditionnement", "Expédition", [], { force: true, checks: [`Identifier : ${spec.id}, révision ${spec.revision || "A"}`, "Protéger les faces d'appui et les filetages ; emballer pièce par pièce"] });
  const m = material(spec.material), st = r.stock, qty = (opts.order && opts.order.quantity) || (spec.order && spec.order.quantity) || (spec.intent && spec.intent.quantity) || null;
  return finishPlan({ kind: "fabrication", id: spec.id, name: spec.name || "", revision: spec.revision || "A",
    facts: [["Matériau", m ? m.name : spec.material || "à définir"], ["Procédé", PROCESSES[proc] ? PROCESSES[proc].fr : proc || "à définir"], ["Matière première", st ? st.label : RAW[proc] || (spec.extrusion ? RAW.extrusion_al : spec.pcb ? RAW.pcb : "à définir")], ...(spec.finish ? [["Finition", spec.finish]] : []), ...(qty ? [["Quantité", String(qty)]] : []),
      ["Posages", String(r.setups.length || 1)], ...(r.utilisation !== null ? [["Matière utile", `${Math.round(r.utilisation * 100)} % du brut`]] : [])],
    phases, characteristics: chars, questions: questions(spec, r, facts, opts), advice: r.advice, points: (spec.plan && spec.plan.points) || [], setups: r.setups, utilisation: r.utilisation });
}

/** The part as it stands after the phase of index k : the features of the later phases are left out, and the interfaces
    until the last phase that works on them. Returns a spec to build, or null when the whole part is the right picture. */
export function stateSpec(spec, plan, k) {
  if (k >= plan.phases.length - 1 || NEAR_NET.has(spec.process) || spec.process === "pcb") return null;
  const phaseOf = new Map(), ifaceAt = Math.max(-1, ...plan.phases.map((ph, i) => (ph.ops.some((o) => o.iface) ? i : -1)));
  plan.phases.forEach((ph, i) => ph.ops.forEach((o) => { if (o.source) phaseOf.set(o.source, i); }));
  const features = (spec.features || []).filter((f) => f && (f.op === "interfaces" ? ifaceAt <= k : !phaseOf.has(f.id) || phaseOf.get(f.id) <= k));
  if (features.length === (spec.features || []).length && ifaceAt <= k) return null;
  return { ...spec, features, interfaces: ifaceAt <= k ? spec.interfaces : [] };
}
