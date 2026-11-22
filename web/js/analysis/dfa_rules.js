/* DynamiteOrbit — DFA (design for assembly) rules of an assembly, in the spirit of Boothroyd-Dewhurst: fewer parts,
   fewer and standard fasteners, one assembly direction (top-down), parts that locate themselves and cannot be mounted
   the wrong way round.
   asm = { id, name, instances: [{id, part, fixed, placement}], mates: [{id, a: {inst, iface}, b: {inst, iface}, linked}] }
   ctx = { parts: {partId: {spec, built}}, hardware: [{id, name, qty, kind, size, length, mate}] (derived from the mates when absent),
           interference: [{a, b, volume}] | null, placements: {instId: matrix16 (column-major)} }
   Auto-fixes are patches of PART specs: every entry carries a `part` field naming the part to patch with applyPatch(). */

import { INTERFACE_TYPES, patternPoints } from "../cad/interfaces.js";
import { liveAsm } from "../core/asm_live.js";
import { THREADS } from "../cad/standards.js";
import { IDENTITY, matPoint, matDir, matFromPlacement } from "../cad/vec.js";
import { rule, num, round, makeFinding, sortFindings, summarize } from "./dfx_core.js";

const S = { bd: "Boothroyd-Dewhurst — Product Design for Manufacture and Assembly", thumb: "Règle de pouce DFA (rule of thumb)", pk: "Poka-yoke (Shingo) — détrompage", lang: "DynamiteOrbit part language (interfaces partagées)" };
const RULES = [
  rule("ASM-01", "Aucune interférence", "Aucun volume commun entre deux pièces", "error", "Les pièces ne peuvent pas être assemblées.", "Contrôle d'interférence de l'assemblage"),
  rule("DFA-01", "Pièces reliées à une pièce fixe", "Chaque instance est reliée par des liaisons (mates) à une instance fixe", "warn", "Une pièce flottante n'a ni position ni fixation définies.", S.lang),
  rule("DFA-02", "Interfaces toutes appariées", "Chaque interface d'une pièce est liée à son partenaire", "info", "Une interface libre est une fixation oubliée ou une géométrie inutile.", S.lang),
  rule("DFA-03", "Interfaces liées identiques", "Les deux côtés d'une liaison ont le même type et les mêmes « params »", "error", "Les trous ne tombent pas en face : montage impossible.", S.lang, { fix: true }),
  rule("DFA-04", "Variété de la visserie", "≤ 3 références de vis (taille × longueur) dans l'assemblage", "warn", "Chaque référence de plus = un outil, un bac et un risque d'erreur de plus.", S.bd, { fix: true }),
  rule("DFA-05", "Nombre de fixations", "Le moins de vis possible ; avertissement au-delà de 4 fixations par pièce en moyenne", "info", "Une vis ne fait que tenir : c'est du temps de montage sans fonction.", S.bd),
  rule("DFA-06", "Nombre de pièces (minimum théorique)", "Deux pièces du même matériau liées rigidement peuvent souvent n'en faire qu'une", "info", "Critères de Boothroyd : mouvement relatif, matériau différent, démontage nécessaire — sinon la pièce est candidate à la fusion.", S.bd),
  rule("DFA-07", "Directions d'assemblage", "≤ 3 directions d'assemblage distinctes", "warn", "Chaque direction de plus impose de retourner l'assemblage (réorientation).", S.bd),
  rule("DFA-08", "Assemblage par le dessus (top-down)", "La majorité des liaisons s'assemblent selon −Z", "info", "La gravité aide : pas de maintien, pas de retournement.", S.bd),
  rule("DFA-09", "Pièces lourdes et centrage", "Pièce > 2 kg : deux éléments de positionnement (goupilles, centrage) avant vissage", "warn", "Sans centrage, l'opérateur porte la pièce pendant qu'il cherche les trous.", S.thumb),
  rule("DFA-10", "Détrompage (poka-yoke)", "Un motif de vis symétrique sur une pièce qui ne l'est pas doit être détrompé", "info", "La pièce peut être montée tournée de 180° (ou 90°).", S.pk),
  rule("DFA-11", "Liaisons valides", "Chaque liaison désigne deux interfaces existantes, de même type et de côtés opposés (A / B)", "error", "Une liaison invalide ne positionne rien.", S.lang, { fix: true }),
];
export const BOOK_ASSEMBLY = [{ process: "assembly", title: "Assembly (DFA)", fr: "Assemblage (DFA)", category: "DFA",
  steps: ["Fixer une pièce de base, poser chaque pièce sur celle qui la porte", "Assembler par le dessus (−Z), en une seule direction si possible", "Réduire le nombre de pièces et de vis ; une seule taille de vis",
    "Centrer les pièces lourdes avant de les visser, détromper les pièces symétriques", "Vérifier les interférences, la masse et le centre de gravité"], rules: RULES }];
const BY_ID = new Map(RULES.map((r) => [r.id, r]));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const SIZES = Object.keys(THREADS);

/** Check an assembly. Returns { findings (errors first), summary, metrics: {parts, instances, uniqueParts, fasteners,
    fastenerTypes (size × length), screwSizes, mass_g, cog, directions, topDown, theoreticalMin, assemblyTime_s, dfaIndex}, rules, skipped }. */
export function checkAssembly(asm, ctx = {}) {
  asm = liveAsm(asm || {}); ctx = ctx || {};      // what is put aside (off) is not checked
  const instances = Array.isArray(asm.instances) ? asm.instances : [], mates = Array.isArray(asm.mates) ? asm.mates : [], parts = ctx.parts || {};
  const findings = [], ran = [], skipped = [];
  const add = (id, o) => { const r = BY_ID.get(id) || {}; findings.push(makeFinding({ ...o, id, severity: o.severity || r.severity, category: "DFA", process: "assembly", title: r.title, source: r.source })); };
  const run = (id, fn) => { ran.push(id); try { fn(); } catch (e) { skipped.push({ id, error: String(e && e.message || e) }); } };
  const inst = new Map(instances.map((i) => [i.id, i]));
  const partOf = (id) => { const i = inst.get(id); return (i && parts[i.part]) || null; };
  const nameOf = (id) => { const p = partOf(id); return `« ${id} »${p && p.spec && p.spec.name ? ` (${p.spec.name})` : ""}`; };
  const matrix = (id) => {
    const m = (ctx.placements || {})[id], pl = (inst.get(id) || {}).placement;
    if (Array.isArray(m) && m.length === 16) return m;
    if (Array.isArray(pl) && pl.length === 16) return pl;
    return pl && typeof pl === "object" ? matFromPlacement(pl) : IDENTITY;
  };
  const ifaceOf = (ref) => {
    const p = ref && partOf(ref.inst);
    if (!p) return null;
    const b = ((p.built && p.built.interfaces) || []).find((x) => x.id === ref.iface);
    if (b) return b;
    const list = (p.spec && p.spec.interfaces) || [], k = list.findIndex((x, i) => (x.id || `IF${i + 1}`) === ref.iface);
    return k >= 0 ? { ...list[k], id: ref.iface } : null;
  };
  const merged = (it) => { const t = INTERFACE_TYPES[it.type]; return t ? { ...t.params, ...(it.params || {}) } : it.params || {}; };
  // resolved mates: A = the side the screw enters ("A"), B = the other one
  const M = mates.map((m) => {
    const ia = ifaceOf(m.a), ib = ifaceOf(m.b), flip = ia && ib && ia.side === "B" && ib.side !== "B";
    return { m, ia, ib, ok: !!(ia && ib && ia.type === ib.type && INTERFACE_TYPES[ia.type]), A: flip ? { ref: m.b, it: ib } : { ref: m.a, it: ia }, B: flip ? { ref: m.a, it: ia } : { ref: m.b, it: ib } };
  });
  const dirOf = (x) => { const f = x.A.it && x.A.it.frame; if (!f) return null; const d = matDir(matrix(x.A.ref.inst), f.n), l = Math.hypot(d[0], d[1], d[2]) || 1; return d.map((v) => v / l); };
  const whereOf = (x) => { const f = x.A.it && x.A.it.frame; return f ? matPoint(matrix(x.A.ref.inst), f.o) : null; };
  const massOf = (id) => { const p = partOf(id); return (p && p.built && p.built.mass) || 0; };

  // hardware: given by the caller, else derived from the mates (grip = thickness of the A part along the interface normal)
  let hardware = Array.isArray(ctx.hardware) ? ctx.hardware : null;
  if (!hardware) {
    hardware = [];
    for (const x of M) {
      if (!x.ok) continue;
      try {
        const t = INTERFACE_TYPES[x.A.it.type], pa = partOf(x.A.ref.inst), bb = pa && pa.built && pa.built.bbox, n = x.A.it.frame && x.A.it.frame.n;
        const ax = n ? [0, 1, 2].find((k) => Math.abs(n[k]) > 0.5) : undefined, grip = bb && ax !== undefined ? bb[3 + ax] - bb[ax] : 3;
        for (const h of t.hardware(merged(x.A.it), { ...t.optsA, ...(x.A.it.opts || {}) }, { ...t.optsB, ...(x.B.it.opts || {}) }, grip) || []) hardware.push({ ...h, mate: x.m.id });
      } catch (e) { /* unknown screw: reported by the part rules */ }
    }
  }
  const screws = hardware.filter((h) => h && h.kind === "screw"), qty = (h) => (typeof h.qty === "number" ? h.qty : 1);
  const fasteners = hardware.reduce((s, h) => s + qty(h), 0), screwTypes = new Map(), sizeQty = new Map();
  for (const h of screws) { const k = `${h.size}×${h.length ?? "?"}`; screwTypes.set(k, (screwTypes.get(k) || 0) + qty(h)); sizeQty.set(String(h.size), (sizeQty.get(String(h.size)) || 0) + qty(h)); }

  run("ASM-01", () => {
    for (const c of Array.isArray(ctx.interference) ? ctx.interference : []) add("ASM-01", { value: round(c.volume ?? 0, 1), limit: 0, unit: "mm³", feature: `${c.a} / ${c.b}`, where: Array.isArray(c.at) ? c.at : null,
      message: `Interférence entre « ${c.a} » et « ${c.b} »${c.volume !== undefined ? ` : ${num(c.volume, 1)} mm³ de volume commun` : ""}. Limite : 0 mm³. Correctif : déplacer l'une des pièces, ou creuser celle qui doit laisser passer l'autre.` });
  });
  run("DFA-11", () => {
    for (const x of M) {
      const ref = (r) => (r && r.inst ? `${r.inst}.${r.iface}` : "référence manquante"), miss = [!x.ia && ref(x.m.a), !x.ib && ref(x.m.b)].filter(Boolean);
      if (miss.length) add("DFA-11", { value: miss.join(", "), limit: "interface existante", feature: x.m.id, message: `Liaison « ${x.m.id} » : interface introuvable (${miss.join(", ")}) ; attendu : deux interfaces existantes. Correctif : relier la liaison à une interface existante ou la supprimer.` });
      else if (x.ia.type !== x.ib.type) add("DFA-11", { value: `${x.ia.type} / ${x.ib.type}`, limit: "même type", feature: x.m.id, where: whereOf(x), message: `Liaison « ${x.m.id} » : types différents (${x.ia.type} sur ${nameOf(x.m.a.inst)}, ${x.ib.type} sur ${nameOf(x.m.b.inst)}) ; attendu : le même type des deux côtés. Correctif : relier deux interfaces de même type.` });
      else if (x.ia.type !== "planar" && (x.ia.side === "B") === (x.ib.side === "B")) add("DFA-11", { value: `${x.ia.side || "A"} / ${x.ib.side || "A"}`, limit: "A / B", feature: x.m.id, where: whereOf(x), message: `Liaison « ${x.m.id} » : les deux interfaces sont du même côté (${x.ia.side || "A"}) ; attendu : un côté A et un côté B. Correctif : passer l'une des deux en « side »: "${x.ia.side === "B" ? "A" : "B"}".`,
        fix: { label: `Passer ${x.m.b.inst}.${x.m.b.iface} en côté ${x.ia.side === "B" ? "A" : "B"}`, patch: [{ target: "interface", part: inst.get(x.m.b.inst).part, id: x.m.b.iface, path: "side", value: x.ia.side === "B" ? "A" : "B" }] } });
    }
  });
  run("DFA-03", () => {
    for (const x of M) {
      if (!x.ok) continue;
      const t = INTERFACE_TYPES[x.ia.type], pa = merged(x.ia), pb = merged(x.ib);
      if (same(pa, pb)) continue;
      const geo = t.signature(pa) !== t.signature(pb), keys = [...new Set([...Object.keys(pa), ...Object.keys(pb)])].filter((k) => !same(pa[k], pb[k]));
      add("DFA-03", { severity: geo ? "error" : "warn", value: keys.join(", "), limit: "params identiques", feature: x.m.id, iface: x.m.b.iface, where: whereOf(x),
        message: `Liaison « ${x.m.id} » rompue : les « params » de ${x.m.a.inst}.${x.m.a.iface} et de ${x.m.b.inst}.${x.m.b.iface} diffèrent (${keys.map((k) => `${k} : ${JSON.stringify(pa[k])} ≠ ${JSON.stringify(pb[k])}`).join(" ; ")})${geo ? " — les deux côtés ne tombent pas en face" : ""}. Limite : params identiques des deux côtés. Correctif : recopier les params de ${x.m.a.inst}.${x.m.a.iface} sur ${x.m.b.inst}.${x.m.b.iface}.`,
        fix: { label: `Recopier les params de ${x.m.a.inst}.${x.m.a.iface} sur ${x.m.b.inst}.${x.m.b.iface}`, patch: [{ target: "interface", part: inst.get(x.m.b.inst).part, id: x.m.b.iface, path: "params", value: JSON.parse(JSON.stringify(x.ia.params || {})) }] } });
    }
  });
  run("DFA-01", () => {
    if (!instances.length) return;
    const adj = new Map(instances.map((i) => [i.id, []]));
    for (const m of mates) if (m.a && m.b && adj.has(m.a.inst) && adj.has(m.b.inst)) { adj.get(m.a.inst).push(m.b.inst); adj.get(m.b.inst).push(m.a.inst); }
    let roots = instances.filter((i) => i.fixed).map((i) => i.id);
    if (!roots.length) { roots = [instances[0].id]; add("DFA-01", { value: 0, limit: 1, unit: "instance fixe", message: `Aucune instance fixe dans l'assemblage (limite : au moins 1) : ${nameOf(instances[0].id)} est prise comme base. Correctif : marquer la pièce de base « fixed ».` }); }
    const seen = new Set(roots), todo = roots.slice();
    while (todo.length) for (const n of adj.get(todo.pop()) || []) if (!seen.has(n)) { seen.add(n); todo.push(n); }
    for (const i of instances) if (!seen.has(i.id)) add("DFA-01", { value: (adj.get(i.id) || []).length, limit: 1, unit: "liaison vers la base", feature: i.id, where: matPoint(matrix(i.id), [0, 0, 0]),
      message: `L'instance ${nameOf(i.id)} est flottante : ${(adj.get(i.id) || []).length} liaison(s), aucune chaîne de liaisons ne la relie à une pièce fixe (limite : au moins une). Correctif : lier une de ses interfaces à une pièce déjà fixée, ou la marquer « fixed ».` });
  });
  run("DFA-02", () => {
    const used = new Set(mates.flatMap((m) => [m.a, m.b].filter(Boolean).map((r) => `${r.inst}|${r.iface}`)));
    for (const i of instances) {
      const p = partOf(i.id), list = ((p && p.built && p.built.interfaces) || (p && p.spec && p.spec.interfaces) || []).map((x, k) => ({ ...x, id: x.id || `IF${k + 1}` })).filter((x) => !x.external && !used.has(`${i.id}|${x.id}`));        // an external interface waits for nothing inside the product
      if (list.length) add("DFA-02", { severity: list.some((x) => x.key || x.partner) ? "warn" : "info", value: list.length, limit: 0, unit: "interfaces libres", feature: i.id,
        message: `${nameOf(i.id)} : ${list.length} interface(s) sans liaison — ${list.map((x) => `${x.id} (${x.type}${x.partner ? ` → ${x.partner}` : ""})`).join(", ")} ; limite : 0. Correctif : ajouter la pièce partenaire et la liaison, ou supprimer l'interface si elle ne sert pas.` });
    }
  });
  run("DFA-04", () => {
    if (screwTypes.size <= 3) return;
    const sizes = [...sizeQty.entries()].sort((a, b) => a[1] - b[1]);      // least used first
    let fix = null;
    for (const [minor] of sizes) {
      const k = SIZES.indexOf(String(minor).toUpperCase()), near = [SIZES[k - 1], SIZES[k + 1]].filter((s) => s && (sizeQty.get(s) || 0) > sizeQty.get(minor)).sort((a, b) => sizeQty.get(b) - sizeQty.get(a))[0];
      if (k < 0 || !near) continue;
      const patch = [];
      for (const x of M) if (x.ok && x.ia.type === "bolt_pattern" && String(merged(x.ia).screw).toUpperCase() === String(minor).toUpperCase()) for (const r of [x.m.a, x.m.b]) patch.push({ target: "interface", part: inst.get(r.inst).part, id: r.iface, path: "params.screw", value: near });
      if (patch.length) { fix = { label: `Passer les motifs ${minor} en ${near}`, patch }; break; }
    }
    add("DFA-04", { value: screwTypes.size, limit: 3, unit: "références de vis",
      message: `${screwTypes.size} références de vis différentes (${[...screwTypes.entries()].map(([k, n]) => `${n} × ${k}`).join(", ")}). Limite : ≤ 3. Correctif : ${fix ? `${fix.label[0].toLowerCase()}${fix.label.slice(1)}, puis ` : ""}uniformiser les épaisseurs serrées pour retomber sur les mêmes longueurs.`, fix });
  });
  run("DFA-05", () => {
    if (!fasteners) return;
    const per = new Map();
    for (const h of screws) per.set(h.mate || "?", (per.get(h.mate || "?") || 0) + qty(h));
    const many = fasteners > 4 * Math.max(1, instances.length);
    add("DFA-05", { severity: many ? "warn" : "info", value: fasteners, limit: 4 * Math.max(1, instances.length), unit: "fixations",
      message: `${fasteners} élément(s) de fixation pour ${instances.length} pièce(s) (${[...per.entries()].map(([k, n]) => `${n} vis sur « ${k} »`).join(", ") || "aucune vis"}). Repère : ≤ 4 par pièce en moyenne. Correctif : ${many ? "remplacer des vis par des clips, des crochets ou un emboîtement tenu par 2 vis" : "aucun — vérifier que chaque vis est nécessaire (une vis ne fait que tenir)"}.` });
  });
  // Boothroyd: two parts of the same material, rigidly fastened, that are neither purchased nor boards are candidates for merging
  const group = new Map(instances.map((i) => [i.id, i.id])), find = (a) => { while (group.get(a) !== a) a = group.get(a); return a; }, pairs = [];
  run("DFA-06", () => {
    for (const x of M) {
      const pa = x.ok && partOf(x.m.a.inst), pb = x.ok && partOf(x.m.b.inst);
      if (!pa || !pb || !pa.spec || !pb.spec || x.ia.type === "rail" || x.m.a.inst === x.m.b.inst) continue;
      const fixedProc = (s) => ["purchased", "pcb"].includes(s.process);
      if (!pa.spec.material || pa.spec.material !== pb.spec.material || fixedProc(pa.spec) || fixedProc(pb.spec)) continue;
      if (find(x.m.a.inst) !== find(x.m.b.inst)) { group.set(find(x.m.b.inst), find(x.m.a.inst)); pairs.push(`${x.m.a.inst} + ${x.m.b.inst} (${pa.spec.material})`); }
    }
    if (pairs.length) add("DFA-06", { value: instances.length, limit: instances.length - pairs.length, unit: "pièces",
      message: `${instances.length} pièces, minimum théorique ${instances.length - pairs.length} : ${pairs.join(", ")} sont du même matériau et liées rigidement. Critères de Boothroyd — mouvement relatif ? matériau différent nécessaire ? démontage nécessaire ? Correctif : si la réponse est trois fois non, fusionner ces pièces en une seule (et supprimer leurs vis).` });
  });
  const dirs = [], mateDirs = M.map(dirOf).filter(Boolean);
  for (const d of mateDirs) if (!dirs.some((e) => e[0] * d[0] + e[1] * d[1] + e[2] * d[2] > 0.985)) dirs.push(d);
  const down = mateDirs.filter((d) => d[2] < -0.985).length, topDown = mateDirs.length ? down / mateDirs.length : null;
  const axisName = (d) => { const k = [0, 1, 2].reduce((a, b) => (Math.abs(d[b]) > Math.abs(d[a]) ? b : a)); return Math.abs(d[k]) > 0.985 ? `${d[k] > 0 ? "+" : "−"}${"XYZ"[k]}` : `(${d.map((v) => num(v, 2)).join(" ; ")})`; };
  run("DFA-07", () => {
    if (dirs.length > 1) add("DFA-07", { severity: dirs.length > 3 ? "warn" : "info", value: dirs.length, limit: 3, unit: "directions",
      message: `${dirs.length} directions d'assemblage (${dirs.map(axisName).join(", ")}). Limite : ≤ 3, l'idéal est une seule. Correctif : ${dirs.length > 3 ? "regrouper les fixations sur les mêmes faces pour ne pas retourner l'assemblage" : "aucun — regrouper les fixations si une direction peut être supprimée"}.` });
  });
  run("DFA-08", () => {
    if (topDown !== null && topDown < 0.5) add("DFA-08", { value: round(topDown * 100, 0), limit: 50, unit: "% top-down",
      message: `${num(topDown * 100, 0)} % des liaisons (${down} sur ${mateDirs.length}) s'assemblent par le dessus (−Z). Repère : ≥ 50 %. Correctif : retourner l'assemblage ou déplacer les fixations pour que les pièces se posent et se vissent de haut en bas.` });
  });
  run("DFA-09", () => {
    for (const i of instances) {
      const m = massOf(i.id);
      if (i.fixed || m <= 2000) continue;
      let loc = 0;
      for (const x of M) if (x.ok && (x.m.a.inst === i.id || x.m.b.inst === i.id)) loc += x.ia.type === "pins" || x.ia.type === "rail" ? 2 : x.ia.type === "fit" ? 1 : 0;
      if (loc < 2) add("DFA-09", { value: loc, limit: 2, unit: "éléments de positionnement", feature: i.id, where: matPoint(matrix(i.id), (partOf(i.id).built.cog) || [0, 0, 0]),
        message: `${nameOf(i.id)} pèse ${num(m / 1000, 2)} kg et n'a que ${loc} élément(s) de positionnement (goupilles, centrage, glissière). Limite : 2 pour une pièce de plus de 2 kg. Correctif : ajouter une interface « pins » (2 goupilles) pour que la pièce se pose avant le vissage.` });
    }
  });
  run("DFA-10", () => {
    for (const x of M) {
      if (!x.ok || x.ia.type !== "bolt_pattern") continue;
      const p = merged(x.ia), pat = p.pattern || {}, n = patternPoints(pat).length, type = pat.type || (pat.pcd ? "circle" : pat.nx || pat.ny ? "rect" : "single");
      const turns = n < 2 ? 0 : type === "circle" ? n : type === "rect" ? (Math.abs((pat.dx || 0) - (pat.dy || 0)) < 1e-6 && Math.round(pat.nx || 2) === Math.round(pat.ny || 2) ? 4 : 2) : 0;
      if (!turns) continue;
      for (const side of [x.A, x.B]) {
        const id = side.ref.inst, pt = partOf(id), bb = pt && pt.built && pt.built.bbox, f = side.it.frame;
        if (!bb || !f || (inst.get(id) || {}).fixed || mates.filter((m) => (m.a && m.a.inst === id) || (m.b && m.b.inst === id)).length > 1) continue;   // another mate already keys the part
        const off = [0, 1, 2].filter((k) => Math.abs(f.n[k]) < 0.5).map((k) => Math.abs(f.o[k] - (bb[k] + bb[3 + k]) / 2) / Math.max(bb[3 + k] - bb[k], 1e-9));
        const others = ((pt.built.interfaces || []).length > 1);
        if (Math.max(...off) <= 0.02 && !others) continue;      // the part looks symmetric about the pattern: any orientation is fine
        add("DFA-10", { value: turns, limit: 1, unit: "orientations possibles", feature: id, iface: side.ref.iface, where: whereOf(x),
          message: `${nameOf(id)} peut se monter dans ${turns} orientations sur la liaison « ${x.m.id} » (motif ${p.screw} ${type === "circle" ? `de ${n} vis sur un cercle` : `${Math.round(pat.nx || 2)} × ${Math.round(pat.ny || 2)}`}) alors que la pièce n'est pas symétrique ; limite : une seule orientation possible. Correctif : décaler une vis du motif, ou ajouter une goupille de détrompage (interface « pins »).` });
        break;
      }
    }
  });

  // metrics: mass and centre of gravity (parts only), rough Boothroyd-style design efficiency
  let mass = 0; const cg = [0, 0, 0];
  for (const i of instances) { const p = partOf(i.id), m = massOf(i.id); if (!m) continue; const c = matPoint(matrix(i.id), p.built.cog || [0, 0, 0]); mass += m; for (let k = 0; k < 3; k++) cg[k] += c[k] * m; }
  const theoreticalMin = instances.length ? new Set(instances.map((i) => find(i.id))).size : 0;
  /* Assembly time estimate (s): 6 s to handle and insert a part (+3 s above 2 kg), 8 s per fastener, 9 s per extra
     assembly direction (reorientation). DFA index = 100 × 3 s × theoretical minimum number of parts / estimated time
     (Boothroyd-Dewhurst design efficiency, with flat times instead of the full handling / insertion tables). */
  const time = instances.reduce((s, i) => s + 6 + (massOf(i.id) > 2000 ? 3 : 0), 0) + 8 * fasteners + 9 * Math.max(0, dirs.length - 1);
  const metrics = { parts: instances.length + fasteners, instances: instances.length, uniqueParts: new Set(instances.map((i) => i.part)).size, fasteners, fastenerTypes: screwTypes.size, screwSizes: sizeQty.size,
    mass_g: round(mass, 1), cog: mass > 0 ? cg.map((v) => round(v / mass, 2)) : null, directions: dirs.length, topDown: topDown === null ? null : round(topDown, 2), mates: mates.length,
    theoreticalMin, assemblyTime_s: time, dfaIndex: time > 0 ? Math.min(100, Math.round(100 * 3 * theoreticalMin / time)) : null };
  const sorted = sortFindings(findings);
  return { findings: sorted, summary: summarize(sorted), metrics, rules: [...new Set(ran)], skipped };
}
