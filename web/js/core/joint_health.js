/* DesignOrbit.ai — the health of the joints. A joint is two interfaces mated ; it is HEALTHY when the two sides still say
   the same thing and the geometry agrees with them, TO CHECK when something drifted or sits at the edge of good practice,
   BROKEN when it cannot be assembled as drawn. Pure : reads the assembly, the built parts, the solver result and the
   interferences found — no kernel call. The verdict is a help to fine-tune a fit quickly, not a calculation of strength. */

import { interfaceSignature, ADHESIVES } from "../cad/interfaces.js";
import { thread } from "../cad/standards.js";
import { material } from "../cad/materials.js";
import { ifaceOf, freeInterfaces } from "./assembly_logic.js";
import { contactEstimate, weldEstimate, contactFormNotes } from "../cad/interfaces_elec.js";

export const HEALTH = { ok: { fr: "Sain", tone: "ok" }, check: { fr: "À vérifier", tone: "warn" }, broken: { fr: "Rompu", tone: "danger" } };
const RANK = { ok: 0, check: 1, broken: 2 }, fr = (x) => String(Math.round(x * 100) / 100).replace(".", ",");
/** Thread engagement in diameters, by material class (steel 1 d, aluminium / copper 1.5 d, plastics 2 d). */
export function engagement(mat) { const m = material(mat); if (!m) return 1.5; if (m.cls !== "metal") return 2; return /^(SS|STEEL|BRASS)/.test(m.id) ? 1 : 1.5; }

/** One row per joint : { id, state: "ok" | "check" | "broken", notes: [why, in plain words] }.
    specs : part id → spec ; sol : the result of solve() ; clashes : [{ a, b (instance ids), volume }] from the interference search. */
export function jointHealth(asm, built, specs = {}, sol = null, clashes = []) {
  const inst = new Map((asm.instances || []).map((i) => [i.id, i]));
  return (asm.mates || []).map((m) => {
    const notes = []; let state = "ok";
    const say = (lvl, text) => { if (RANK[lvl] > RANK[state]) state = lvl; notes.push(text); };
    const ia = inst.get(m.a.inst), ib = inst.get(m.b.inst), A = ia && ifaceOf(built, ia.part, m.a.iface), B = ib && ifaceOf(built, ib.part, m.b.iface);
    if (!A || !B) return { id: m.id, state: "broken", notes: [`L'interface ${!A ? m.a.iface : m.b.iface} a disparu de ${!A ? (ia ? ia.part : m.a.inst) : (ib ? ib.part : m.b.inst)} : le joint ne tient plus à rien.`] };
    if (A.type !== B.type) say("broken", `Deux interfaces de genres différents (${A.type} et ${B.type}) ne s'accouplent pas.`);
    else {
      if (A.side === B.side) say("check", `Les deux interfaces sont du côté ${A.side} : l'une doit être le côté A, l'autre le côté B.`);
      const sa = interfaceSignature(A), sb = interfaceSignature(B);
      if (sa !== sb) say("check", `Les deux côtés ne disent plus la même chose : ${sa} sur ${ia.part}, ${sb} sur ${ib.part}${m.linked === false ? " (joint non lié : les paramètres ne se suivent pas)" : ""}.`);
      if (A.key && B.key && A.key !== B.key) say("check", `Clés différentes : « ${A.key} » et « ${B.key} ».`);
      const [T, tp] = A.side === "B" ? [A, ia.part] : [B, ib.part], p = T.params || {}, o = T.opts || {};       // T : the side B, the one that carries the geometry
      if (A.type === "bolt_pattern" && !o.port) {
        const th = thread(p.screw), mat = specs[tp] && specs[tp].material, need = th ? engagement(mat) * th.d : 0, plastic = material(mat) && material(mat).cls !== "metal";
        const cut = o.thread !== "insert" && o.thread !== "clearance";                 // a thread cut in the part itself : not an insert, not a plain hole with a nut behind
        if (th && typeof o.depth === "number" && cut && o.depth < need - 0.05) say("check", `Prise de filet de ${fr(o.depth)} mm dans ${tp} : il en faut ${fr(need)} (${fr(engagement(mat))} × d pour cette matière).`);
        if (plastic && cut && !o.standoff) say("check", `Filet taillé dans le plastique de ${tp} : un insert tient mieux au remontage.`);
      } else if (A.type === "rail") {
        const c = o.clearance ?? 0.2;
        if (c < 0.1) say("check", `Jeu de ${fr(c)} mm par face dans la glissière : la pièce risque de coincer (0,1 mm au moins).`);
        else if (c > 0.5) say("check", `Jeu de ${fr(c)} mm par face dans la glissière : la pièce flotte (0,5 mm au plus).`);
        if (Number(p.depth) < 1) say("check", `Rainure profonde de ${fr(Number(p.depth))} mm seulement : la prise est faible (1 mm au moins).`);
        if (!m.flip) say("check", "La languette est posée devant la rainure, pas dedans : cochez « retourner » pour l'y glisser.");
      } else if (A.type === "bond") {
        const g = ADHESIVES[p.adhesive || "epoxy"];
        if (g && (p.gap < g.gap[0] - 1e-9 || p.gap > g.gap[1] + 1e-9)) say("check", `Film de colle de ${fr(p.gap)} mm hors de la plage de cette colle (${fr(g.gap[0])} à ${fr(g.gap[1])} mm).`);
        if (!o.well && o.pips === false && p.adhesive !== "tape") say("check", "Ni logement de colle ni plot de calage : l'épaisseur du film n'est pas tenue par la pièce, et la pièce qui s'appuie écrase la colle.");
        if (o.well && p.adhesive !== "tape" && !(Number(p.lip ?? 3) >= 3 - 1e-9)) say("check", `Lèvre d'appui de ${fr(Number(p.lip) || 0)} mm autour du logement de colle : 3 mm et plus pour que la pièce qui s'appuie porte franchement.`);
      } else if (A.type === "contact" || A.type === "weld") {
        for (const id of [ia.part, ib.part]) { const mat = material(specs[id] && specs[id].material); if (mat && !mat.conductive) say("broken", `${id} est en ${mat.name} : un joint électrique relie deux conducteurs.`); }
        for (const t of (A.type === "contact" ? [...contactEstimate(A.params || {}).notes, ...contactFormNotes(A.params || {}, A.opts || {})] : weldEstimate(A.params || {}).notes)) say("check", t);
        if (A.type === "contact" && !(asm.mates || []).some((x) => x !== m && [x.a.inst, x.b.inst].includes(m.a.inst) && [x.a.inst, x.b.inst].includes(m.b.inst) && ["bolt_pattern", "pins"].includes((ifaceOf(built, (inst.get(x.a.inst) || {}).part, x.a.iface) || {}).type)))
          say("check", "Aucun serrage entre les deux barres : un contact à pression demande une vis ou un clip qui tienne l'effort.");
      }
    }
    for (const q of (sol && sol.problems) || []) if (q.mate === m.id) say("broken", q.kind === "conflict" ? `Sur-contraint : ce joint place la pièce à ${fr(q.dev)} mm de là où les autres joints la mettent.` : q.msg);
    for (const c of clashes || []) if ((c.a === m.a.inst && c.b === m.b.inst) || (c.a === m.b.inst && c.b === m.a.inst)) say("broken", `Les deux pièces se traversent : ${fr(c.volume)} mm³ en commun.`);
    return { id: m.id, state, notes };
  });
}

/** The assembly as a whole : its joints, the internal interfaces still waiting for their twin, the parts no joint holds.
    → { rows, counts: { ok, check, broken }, free, floating, state, text } */
export function assemblyHealth(asm, built, specs = {}, sol = null, clashes = []) {
  const rows = jointHealth(asm, built, specs, sol, clashes), counts = { ok: 0, check: 0, broken: 0 };
  for (const r of rows) counts[r.state]++;
  const free = freeInterfaces(asm, built).filter((f) => !f.external).length, floating = sol ? (sol.floating || []).length : 0;
  const state = counts.broken ? "broken" : counts.check || free || floating ? "check" : "ok", parts = [];
  if (rows.length) parts.push(`${rows.length} joint${rows.length > 1 ? "s" : ""} : ${[[counts.ok, counts.ok > 1 ? "sains" : "sain"], [counts.check, "à vérifier"], [counts.broken, counts.broken > 1 ? "rompus" : "rompu"]].filter(([n]) => n).map(([n, w]) => `${n} ${w}`).join(", ")}`); else parts.push("aucun joint");
  if (free) parts.push(`${free} interface${free > 1 ? "s" : ""} interne${free > 1 ? "s" : ""} sans jumelle`);
  if (floating) parts.push(`${floating} pièce${floating > 1 ? "s" : ""} non accouplée${floating > 1 ? "s" : ""}`);
  return { rows, counts, free, floating, state, text: parts.join(" · ") };
}
