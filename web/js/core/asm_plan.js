/* DesignWizard.ai — the assembly routing of a product, written for the discussion with the prototyping engineers :
   which part goes on which, in which order, through which interface, with which screws, tightened how, checked how.
   The sequence comes from the mated interfaces — the fixed part first, then whatever mates with what is already
   there, covers last — and can be reordered by hand (assembly.plan.order). Torques are usual values for class 8.8
   screws, lowered for boards and for threads in light alloy or plastic : indicative, to confirm by a tightening test. */

import { resolveParams, evalDeep } from "../cad/expr.js";
import { liveAsm, asmVariantNow } from "./asm_live.js";
import { variantFacts } from "./variant_out.js";
import { flatAsm, finder, topOf, isSub } from "./asm_levels.js";
import { patternPoints, interfaceType, ADHESIVES, BOND_PREPS } from "../cad/interfaces.js";
import { finishPlan } from "./plan_doc.js";
import { WELD_PROCESSES, PLATINGS, CONTACT_TESTS, CONTACT_FORMS, contactEstimate, contactForm } from "../cad/interfaces_elec.js";

const TORQUE = { M2: 0.3, "M2.5": 0.6, M3: 1.1, M4: 2.6, M5: 5.2, M6: 9, M8: 22, M10: 43, M12: 75 };      // N·m, steel class 8.8, dry
const BOARD = { M2: 0.2, "M2.5": 0.4, M3: 0.6, M4: 1.2 }, HEX = { M2: 1.5, "M2.5": 2, M3: 2.5, M4: 3, M5: 4, M6: 5, M8: 6, M10: 8, M12: 10 };
const COVER = /couvercle|capot|cover|carter|lid\b/i, THERMAL = /therm|chaleur|refroid/i, SINK = /dissipateur|radiateur|heat ?sink/i;
const fr = (v, d = 2) => String(Math.round(v * 10 ** d) / 10 ** d).replace(".", ",");
const HW = { screw: (h) => `Vis ${/ISO10642/.test(h.id) ? "à tête fraisée ISO 10642" : "à tête cylindrique six pans creux ISO 4762"} ${h.size} × ${h.length}`, insert: (h) => `Insert à chaud ${h.size}`, nut: (h) => `Écrou hexagonal ISO 4032 ${h.size}`, pin: (h) => h.name };

/** One interface of a part, with its parameters evaluated. */
function ifaceOf(spec, id) {
  const i = spec && (spec.interfaces || []).find((x) => x.id === id); if (!i) return null;
  let scope = {}; try { scope = resolveParams(spec.params || {}).scope; } catch (e) { scope = {}; }
  let params = {}; try { params = evalDeep({ ...(interfaceType(i.type).params || {}), ...(i.params || {}) }, scope); } catch (e) { params = i.params || {}; }
  return { id: i.id, type: i.type, side: i.side || "A", name: i.name || "", params, opts: i.opts || {} };
}

/** The order in which the instances are assembled : [instance ids]. */
export function assemblyOrder(asm, parts) {
  asm = liveAsm(asm);
  const all = asm.instances.map((i) => i.id), given = ((asm.plan && asm.plan.order) || []).filter((id) => all.includes(id));
  if (given.length) return [...new Set([...given, ...all])];
  const base = asm.instances.find((i) => i.fixed) || asm.instances[0]; if (!base) return [];
  const placed = [base.id], cover = (id) => { const i = asm.instances.find((x) => x.id === id), s = parts.get(i.part) || {}; return COVER.test(`${s.id} ${s.name || ""}`) ? 1 : 0; };
  const links = (id) => (asm.mates || []).filter((m) => (topOf(m.a.inst) === id && placed.includes(topOf(m.b.inst))) || (topOf(m.b.inst) === id && placed.includes(topOf(m.a.inst)))).length;      // a joint to a part inside a sub-assembly holds the sub-assembly
  while (placed.length < all.length) {
    const rest = all.filter((id) => !placed.includes(id)), ready = rest.filter((id) => links(id) > 0), pool = ready.length ? ready : rest;
    placed.push(pool.sort((a, b) => cover(a) - cover(b) || links(b) - links(a) || all.indexOf(a) - all.indexOf(b))[0]);
  }
  return placed;
}

/** The assembly routing. ctx : { hardwareOf(mate) → [{ id, kind, size, length, qty, name }], mass, dfa (DFA result) } — all optional. */
export function assemblyPlan(asm, project, ctx = {}) {
  const find = finder(project), leaves = new Map(((flatAsm(asm, find) || {}).instances || []).map((i) => [i.id, i]));      // every part through the levels : a joint of this assembly may hold to a part inside a sub-assembly
  const variant = ctx.variant === undefined ? asmVariantNow(asm) : ctx.variant;      // the routing says which variant of the assembly it mounts
  asm = liveAsm(asm);      // a part put aside is not in the routing
  const parts = new Map((project.parts || []).map((p) => [p.id, p])), inst = new Map(asm.instances.map((i) => [i.id, i])), order = assemblyOrder(asm, parts), notes = (asm.plan && asm.plan.notes) || {};
  /* a step is an instance of THIS assembly — a part, or a sub-assembly put together apart and mounted as one block */
  const subOf = (id) => { const i = inst.get(id); return isSub(i) ? find(i.asm) || { id: i.asm, name: "" } : null; }, partOf = (id) => (leaves.get(id) || inst.get(id) || {}).part;
  const nameOf = (id) => { const sub = subOf(id); if (sub) return `le sous-assemblage ${sub.name ? `${sub.name} (${sub.id})` : sub.id}`; const s = parts.get(partOf(id)) || {}; return s.name ? `${s.name} (${s.id})` : partOf(id) || id; }, specOf = (id) => parts.get(partOf(id)) || {};
  const phases = [], totals = new Map(), sizes = new Set(), q = [], ask = (topic, text) => q.push({ topic, text }), loose = [];
  const hw = (m, A, B) => { let list = []; try { list = ctx.hardwareOf ? ctx.hardwareOf(m) : interfaceType(A.type).hardware(A.params, A.opts, B.opts, specOf(m.a.inst).pcb ? 1.6 : 3) || []; } catch (e) { list = []; } return list; };
  let thermal = false, boards = 0, bonded = 0, snapped = 0, welded = 0, pressed = 0;
  order.forEach((id, k) => {
    const spec = specOf(id), before = order.slice(0, k), ops = [], checks = [], tools = [], isBoard = spec.family === "pcb";
    if (isBoard) { boards++; checks.push("Protection contre les décharges : bracelet et tapis ; tenir la carte par ses bords"); }
    if (subOf(id)) { ops.push({ text: `Monter ${nameOf(id)} à part, selon sa propre gamme`, tools: [] }); checks.push("Sous-assemblage complet et contrôlé avant de le monter"); }
    if (!k) { ops.push({ text: `Poser ${nameOf(id)} sur le plan de travail, interfaces accessibles`, tools: [] }); checks.push("Pièce propre ; filetages et inserts dégagés"); }
    const joints = (asm.mates || []).filter((m) => (topOf(m.a.inst) === id && before.includes(topOf(m.b.inst))) || (topOf(m.b.inst) === id && before.includes(topOf(m.a.inst))));
    if (k && !joints.length) { loose.push(id); ops.push({ text: `Positionner ${nameOf(id)} à la main : aucune interface accouplée ne la tient`, tools: [] }); }
    for (const m of joints) {
      const fa = ifaceOf(specOf(m.a.inst), m.a.iface), fb = ifaceOf(specOf(m.b.inst), m.b.iface); if (!fa || !fb) continue;
      const [A, B, ia, ib] = fa.side === "B" ? [fb, fa, m.b.inst, m.a.inst] : [fa, fb, m.a.inst, m.b.inst], other = topOf(m.a.inst) === id ? topOf(m.b.inst) : topOf(m.a.inst), label = A.name || B.name || interfaceType(A.type).label;
      if ((THERMAL.test(`${A.name} ${B.name}`) || SINK.test(`${spec.name || ""} ${spec.id} ${specOf(other).name || ""} ${specOf(other).id}`)) && (A.type === "planar" || A.type === "bolt_pattern")) { thermal = true; ops.push({ text: `Déposer l'interface thermique (pâte ou feuille) sur la plage d'appui — ${label}`, tools: ["Spatule ou pochoir"], control: "Couche régulière, sans manque" }); }
      if (A.type === "bolt_pattern") {
        const s = A.params.screw, n = patternPoints(A.params.pattern).length, list = hw(m, A, B), screw = list.find((h) => h.kind === "screw"), into = B.opts.thread === "insert" ? "les inserts" : B.opts.thread === "clearance" ? "les trous de passage, avec écrous" : B.opts.standoff ? "les colonnettes" : "les taraudages";
        const soft = /^AL|ALU/i.test(specOf(ib).material || "") && B.opts.thread !== "insert" ? 0.75 : B.opts.thread === "insert" ? 0.5 : 1, board = specOf(ia).family === "pcb" || specOf(ib).family === "pcb";
        const t = board && BOARD[s] ? BOARD[s] : (TORQUE[s] || 0) * soft;
        ops.push({ text: `Présenter ${nameOf(id)} sur ${nameOf(other)} — ${label}`, tools: [] }, { text: `Engager ${n} ${screw ? HW.screw(screw).replace(/^Vis/, "vis") : `vis ${s}`} dans ${into} de ${nameOf(ib)}, à la main, sans serrer`, tools: [] },
          { text: `Serrer en croix${t ? ` à ${fr(t)} N·m` : ""}`, tools: [`Clé six pans de ${fr(HEX[s] || 0)} mm`, "Clé ou tournevis dynamométrique"], control: t ? "Couple indicatif, à confirmer par un essai de serrage" : "" });
        sizes.add(s);
        for (const h of list) { const row = totals.get(h.id) || { id: h.id, name: (HW[h.kind] || ((x) => x.name))(h), qty: 0 }; row.qty += h.qty; totals.set(h.id, row); }
        if (isBoard || specOf(other).family === "pcb") checks.push("Aucun composant ni piste sous les têtes de vis");
      } else if (A.type === "fit") { const cls = String(A.params.fit || "H7/g6").split("/")[1] || "g6", how = /^[a-h]/.test(cls) ? "à la main" : /^[j-n]/.test(cls) ? "au maillet" : "à la presse"; ops.push({ text: `Emmancher ${nameOf(ia)} dans ${nameOf(ib)} ${how} — Ø ${fr(A.params.d)} ${A.params.fit}`, tools: how === "à la main" ? [] : [how === "au maillet" ? "Maillet" : "Presse"], control: "Portée en butée, sans jeu" }); }
      else if (A.type === "bond") {                              // a bonded joint : prepare, lay the adhesive, press onto the gap-control pips, hold, cure
        const ad = ADHESIVES[A.params.adhesive] || ADHESIVES.epoxy, list = hw(m, A, B), dose = list.find((h) => h.kind === "adhesive"), tape = A.params.adhesive === "tape", lo = ad.gap[0], hi = ad.gap[1], well = [A, B].some((x) => x && x.side === "B" && x.opts && x.opts.well); bonded++;
        ops.push({ text: `${BOND_PREPS[A.params.prep] || BOND_PREPS.degrease} — ${label}`, tools: ["Isopropanol et chiffons non pelucheux"], control: "Plages propres et sèches ; coller dans l'heure" },
          tape ? { text: `Poser le ruban sur la plage de ${nameOf(ib)} (${fr(A.params.w)} × ${fr(A.params.h)} mm), maroufler, retirer le film protecteur`, tools: [ad.tool] }
            : { text: `Déposer ${dose ? `${fr(dose.qty)} mL de ` : ""}${ad.label.toLowerCase()} ${well ? "dans le logement de colle" : "en cordon continu sur la plage"} de ${nameOf(ib)} (${fr(A.params.w)} × ${fr(A.params.h)} mm)`, tools: [ad.tool], control: "Cordon continu, sans bulle" },
          { text: `Présenter ${nameOf(id)} sur ${nameOf(other)} et appuyer ${tape ? "fermement sur toute la plage" : `jusqu'en butée sur ${well ? "la lèvre d'appui du logement de colle" : "les plots de calage"} : film de ${fr(A.params.gap)} mm`}`, tools: [], control: tape ? "Contact sur toute la surface" : "Bourrelet régulier sur le pourtour ; essuyer l'excès" },
          { text: `Maintenir : ${ad.hold}. Polymérisation : ${A.params.cure || ad.cure}`, tools: tape ? [] : ["Pinces ou gabarit de maintien"], control: "Ne pas charger le joint avant la fin de la polymérisation" });
        if (!tape && (A.params.gap < lo - 1e-9 || A.params.gap > hi + 1e-9)) ask("Collage", `${label} : film de ${fr(A.params.gap)} mm pour une ${ad.label.toLowerCase()}, dont la plage usuelle est ${fr(lo)} à ${fr(hi)} mm — changer l'épaisseur ou la colle ?`);
        for (const h of list) { const row = totals.get(h.id) || { id: h.id, name: `${h.name}${h.unit ? ` (${h.unit})` : ""}`, qty: 0 }; row.qty = Math.round((row.qty + h.qty) * 100) / 100; totals.set(h.id, row); }
      } else if (A.type === "planar" && [specOf(ia), specOf(ib)].some((sp) => sp.mold && (sp.mold.closure === "clips" || sp.mold.lifters > 0))) { snapped++;
        ops.push({ text: `Encliqueter ${nameOf(id)} sur ${nameOf(other)} : présenter les crochets en face des fenêtres, appuyer jusqu'au clic — ${label}`, tools: [], control: "Tous les crochets engagés ; plan de joint sans jour" }); }
      else if (A.type === "planar") ops.push({ text: `Mettre ${nameOf(id)} en appui sur ${nameOf(other)} — ${label}`, tools: [], control: "Appui sans jour" });
      else if (A.type === "pins") { ops.push({ text: `Chasser ${A.params.n || 2} goupilles Ø ${fr(A.params.d)} dans ${nameOf(ib)}`, tools: ["Maillet ou presse"] }, { text: `Présenter ${nameOf(ia)} sur les goupilles`, tools: [], control: "Engagement sans forcer" }); for (const h of hw(m, A, B)) { const row = totals.get(h.id) || { id: h.id, name: h.name, qty: 0 }; row.qty += h.qty; totals.set(h.id, row); } }
      else if (A.type === "cutout") { ops.push({ text: `Passer ${nameOf(ib)} dans la découpe de ${nameOf(ia)} et le fixer — ${label}`, tools: [] }); for (const h of hw(m, A, B)) { const row = totals.get(h.id) || { id: h.id, name: (HW[h.kind] || ((x) => x.name))(h), qty: 0 }; row.qty += h.qty; totals.set(h.id, row); } }
      else if (A.type === "weld") { const W = WELD_PROCESSES[A.params.process] || WELD_PROCESSES.laser, n = Math.round(A.params.n || 1); welded++;      // a permanent electrical joint : prepare, clamp, weld, prove
        ops.push({ text: `${W.prep} — ${label}`, tools: [] }, { text: `${W.label} : ${n} ${W.unit}${n > 1 ? "s" : ""} entre ${nameOf(ia)} et ${nameOf(ib)}, zone de ${fr(A.params.w)} × ${fr(A.params.h)} mm`, tools: [W.tool], control: W.control });
        for (const h of hw(m, A, B)) { const row = totals.get(h.id) || { id: h.id, name: h.name, qty: 0 }; row.qty += h.qty; totals.set(h.id, row); } }
      else if (A.type === "contact") { const P = PLATINGS[A.params.plating] || PLATINGS.Ag, e = contactEstimate(A.params); pressed++;
        ops.push({ text: `Vérifier les deux plages de contact (${P.label.toLowerCase()}) : propres, sans rayure ni trace de doigt — ${label}`, tools: ["Gants"] }, A.params.weld === "projection" && contactForm(A.params, A.opts) === "cone" ? { text: `Souder par bossage ${nameOf(ia)} sur ${nameOf(ib)} : les ${Math.round(A.params.n || 1)} bossages fondent ensemble sous l'effort et le courant — paramètres de la qualification`, tools: ["Soudeuse par résistance, électrodes planes"], control: "Arrachement sur éprouvettes ; résistance de la liaison en 4 fils" }
          : { text: `Presser ${nameOf(ia)} sur ${nameOf(ib)} jusqu'en butée : les ${Math.round(A.params.n || 1)} ${CONTACT_FORMS[contactForm(A.params, A.opts)].unit}s ${contactForm(A.params, A.opts) === "cone" ? "portent" : "fléchissent"}`, tools: [], control: `Résistance de la liaison en 4 fils : environ ${fr(e.rTotal)} mΩ attendus` });
        for (const h of hw(m, A, B)) { const row = totals.get(h.id) || { id: h.id, name: h.name, qty: 0 }; row.qty += h.qty; totals.set(h.id, row); } }
      else if (A.type === "rail") ops.push({ text: `Glisser ${nameOf(ia)} dans la glissière de ${nameOf(ib)} jusqu'en butée — ${label}`, tools: [], control: "Butée atteinte, pas de point dur" });
    }
    const conns = isBoard ? ((spec.pcb && spec.pcb.components) || []).filter((c) => c.kind === "connector" || c.kind === "terminal") : [];
    if (conns.length) checks.push(`Raccorder ${conns.map((c) => c.ref).join(", ")} (${conns.length} connecteur${conns.length > 1 ? "s" : ""}) ; faisceaux sans contrainte`);
    phases.push({ key: id, title: k ? `Monter ${nameOf(id)}` : `Préparer ${nameOf(id)}`, station: "Établi de montage", ops, checks, note: notes[id] || "", inst: id, part: (inst.get(id) || {}).part, ...(subOf(id) ? { asm: subOf(id).id } : {}) });
  });
  phases.push({ key: "final", title: "Contrôle final", station: "Établi de montage", ops: [], checks: ["Toutes les vis serrées au couple et marquées", "Aucune pièce ni vis en trop sur l'établi", "Essai fonctionnel selon le plan d'essai", ...(boards ? ["Contrôle des distances d'isolement si le produit porte de la haute tension (voir Isolation)"] : [])], note: notes.final || "" });
  const hardware = [...totals.values()].sort((a, b) => a.name.localeCompare(b.name, "fr", { numeric: true })), nScrews = hardware.filter((h) => /^Vis/.test(h.name)).reduce((s, h) => s + h.qty, 0), covers = order.filter((id) => COVER.test(`${specOf(id).id} ${specOf(id).name || ""}`));
  ask("Posage", "Faut-il un gabarit pour tenir la première pièce pendant le vissage ? Tout se monte-t-il par le même côté, ou faut-il retourner l'ensemble ?");
  ask("Accès", "L'accès de l'outil est-il libre pour chaque vis, clé et embout compris ?");
  if (sizes.size > 2) ask("Visserie", `${sizes.size} tailles de vis (${[...sizes].join(", ")}) : peut-on en réduire le nombre ?`);
  if (nScrews > 12) ask("Visserie", `${nScrews} vis au total : des clips, des ergots ou un vissage commun sont-ils possibles ?`);
  for (const id of loose) ask("Tenue", `${nameOf(id)} n'a aucune interface accouplée : comment est-elle tenue et repérée ?`);
  if (boards) ask("Cartes", "Dans quel ordre monter et raccorder les cartes ? Les connecteurs restent-ils accessibles une fois tout en place ?");
  if (thermal) ask("Thermique", "Quelle interface thermique, quelle épaisseur, quel couple pour l'écraser sans voiler la carte ou la semelle ?");
  if (covers.length) ask("Essai", "Peut-on essayer le produit avant de fermer le capot ? Que faut-il pouvoir mesurer capot ouvert ?");
  if (welded) ask("Soudure", "Les paramètres de soudure ou de câblage sont à qualifier sur éprouvettes (arrachement, coupe, résistance) avant la série ; quel contrôle en ligne, à quelle fréquence ?");
  if (pressed) ask("Contacts", `Quel serrage tient les barres pressées, et avec quel effort par point de contact ? Essais à prévoir — ${CONTACT_TESTS}.`);
  if (bonded) ask("Collage", "Colle, préparation de surface et polymérisation sont à valider par un essai de cisaillement sur éprouvettes ; quelle durée de vie en pot, quelle température et quelle humidité à l'atelier ?");
  if (snapped) ask("Clips", "Le produit doit-il pouvoir se rouvrir ? Combien de fois, et avec quel outil pour dégager les crochets sans les blanchir ?");
  ask("Couples", "Les couples indiqués sont des valeurs usuelles : lesquels faut-il confirmer par un essai de serrage, et faut-il un frein-filet ?");
  for (const f of ((ctx.dfa && ctx.dfa.findings) || []).filter((x) => x.severity !== "info").slice(0, 6)) ask("Montage", `${f.title} — ${f.message}`);
  return finishPlan({ kind: "assemblage", id: asm.id, name: asm.name || "", revision: asm.revision || "A",
    facts: [...variantFacts(variant), ["Pièces", String(leaves.size)], ...(asm.instances.some(isSub) ? [["Sous-assemblages", String(asm.instances.filter(isSub).length)]] : []), ["Étapes", String(order.length)], ["Vis", `${nScrews} en ${sizes.size} taille${sizes.size > 1 ? "s" : ""}`], ...(ctx.mass ? [["Masse", `${fr(ctx.mass, 0)} g`]] : [])],
    phases, hardware, questions: q, points: (asm.plan && asm.plan.points) || [], order });
}
