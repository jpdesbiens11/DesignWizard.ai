/* DynamiteOrbit — Logiciel : the REQUIREMENTS of a software — what it must do, said before it is drawn (cycle en V, choix cliqué de JP le
   21 novembre 2026 : « 1 Exigences »). A requirement is one sentence with « doit », measurable, of one kind (function, safety, performance,
   interface, robustness), verified one way (a test on the model, an analysis, a review), and ALLOCATED to the tiles that carry it out. The
   tiles say, each, what they do in one sentence of their own (sw/sw_c.js requirement) : those are the requirements of the lower level, drawn
   from the design. The TRACE goes both ways : a requirement to its tiles and to the tests that prove it, a tile back to the requirement it
   serves — a tile no requirement asks for is a function nobody asked for, to be justified or removed.
   The rules of writing are the usual ones of the trade (one requirement per sentence, a « doit », no vague word, a number when it is a
   performance) — practice widely published ; no guide of writing was read for this, and the registry of sources says so.
   On / Off and a copy born Off, as every list of the tool ; a requirement the tool proposes is an EXAMPLE until confirmed. Pure. */

import { KINDS } from "./sw_objects.js";
import { requirement } from "./sw_c.js";

export const REQ_KINDS = {
  functional: { fr: "Fonction", label: "Functional", color: "#2563eb", icon: "wizard", text: "Ce que le logiciel fait quand tout va bien." },
  safety: { fr: "Sécurité", label: "Safety", color: "#dc2626", icon: "warning", text: "Ce qu'il fait pour qu'une panne ne devienne pas un danger." },
  performance: { fr: "Performance", label: "Performance", color: "#b45309", icon: "bolt", text: "En combien de temps, à quelle cadence, avec quelle précision : un nombre et son unité." },
  interface: { fr: "Interface", label: "Interface", color: "#0891b2", icon: "link", text: "Ce qu'il échange avec la carte ou un autre système : une broche, une trame, une plage." },
  robustness: { fr: "Robustesse", label: "Robustness", color: "#7c3aed", icon: "lock", text: "Ce qu'il fait d'une entrée fausse : fil coupé, valeur hors plage." },
};
export const VERIFY = {
  test: { fr: "Essai", label: "Test", text: "Un essai sur le modèle le prouve : un scénario, ce que l'on attend, réussi ou non." },
  analysis: { fr: "Analyse", label: "Analysis", text: "Un calcul ou une analyse le prouve — le temps d'un pas, la mémoire : une personne le signe." },
  review: { fr: "Revue", label: "Review", text: "Une personne le vérifie à la lecture, et le signe." },
};
const VAGUE = ["rapide", "rapidement", "environ", "approximativement", "suffisant", "suffisamment", "adéquat", "approprié", "convivial", "facile", "minimiser", "maximiser", "optimiser", "si possible", "autant que possible", "etc", "et/ou", "normalement", "généralement", "beaucoup", "peu"];

export const reqsOf = (d) => (d && d.reqs) || [];
export const liveReqs = (d) => reqsOf(d).filter((r) => r.on !== false);
const nextId = (list, prefix) => `${prefix}-${String(list.reduce((m, x) => Math.max(m, Number(String(x.id).split("-")[1]) || 0), 0) + 1).padStart(3, "0")}`;
export function addReq(d, o = {}) { d.reqs = d.reqs || []; const r = { id: nextId(d.reqs, "SWR"), text: String(o.text || "").trim(), kind: REQ_KINDS[o.kind] ? o.kind : "functional", verify: VERIFY[o.verify] ? o.verify : "test", objs: [...(o.objs || [])], on: true, sure: o.sure !== false }; d.reqs.push(r); return r; }
export function copyReq(d, id) { const L = reqsOf(d), r = L.find((x) => x.id === id); if (!r) return null; const c = { ...JSON.parse(JSON.stringify(r)), id: nextId(L, "SWR"), on: false }; L.splice(L.indexOf(r) + 1, 0, c); return c; }
export function setReq(d, id, o) { const r = reqsOf(d).find((x) => x.id === id); if (!r) return null; for (const k of ["text", "kind", "verify", "objs", "on", "sure", "why", "signed"]) if (o[k] !== undefined) r[k] = o[k]; return r; }
export function removeReq(d, id) { const n = reqsOf(d).length; d.reqs = reqsOf(d).filter((x) => x.id !== id); for (const t of d.tests || []) t.reqs = (t.reqs || []).filter((x) => x !== id); return d.reqs.length < n; }

/** How a requirement is written : the usual rules of the trade. → [{ level ("todo" | "warn" | "tip"), text }] */
export function reqQuality(r) {
  const t = String((r && r.text) || "").trim(), low = t.toLowerCase(), out = []; if (!t) return [{ level: "todo", text: "L'exigence est vide : une phrase, avec « doit »." }];
  const shall = (low.match(/\bdoi(t|vent)\b|\bshall\b/g) || []).length;
  if (!shall) out.push({ level: "warn", text: "Une exigence dit ce que le logiciel « doit » faire : écrivez « Le logiciel doit… »." });
  if (shall > 1) out.push({ level: "tip", text: "Deux « doit » dans une phrase : ce sont sans doute deux exigences, à séparer pour les vérifier chacune." });
  for (const w of VAGUE) if (new RegExp(`(^|[^\\p{L}])${w.replace("/", "\\/")}([^\\p{L}]|$)`, "u").test(low)) out.push({ level: "warn", text: `Mot vague « ${w} » : il ne se vérifie pas — donnez un nombre, une unité, une condition.` });
  if ((r.kind === "performance" || r.kind === "safety") && !/\d/.test(t)) out.push({ level: "warn", text: `Une exigence de ${REQ_KINDS[r.kind].fr.toLowerCase()} se chiffre : un seuil, un temps, avec son unité.` });
  if (t.length > 320) out.push({ level: "tip", text: "Phrase longue : une exigence courte se vérifie mieux." });
  return out;
}
/** The requirements of the lower level : what each tile says it does, drawn from the design. → [{ obj, name, kind, text }] */
export const designReqs = (d) => ((d && d.objects) || []).filter((o) => !o.off && KINDS[o.kind]).map((o) => ({ obj: o.id, name: o.name, kind: o.kind, text: requirement(d, o) }));

/** The trace, both ways. results : the runs of the tests (sw/sw_test.js runAll) or null. → { rows: [{ req, objs, tests, state, text }], orphans: [object ids no requirement asks for] }
    state : "off" | "untraced" (no tile) | "verified" | "failed" | "untested" (verified by test, no test passed yet) | "signed" (analysis / review signed) | "tosign" */
export function trace(d, results = null) {
  const objs = new Set(((d && d.objects) || []).filter((o) => !o.off && KINDS[o.kind]).map((o) => o.id)), tests = ((d && d.tests) || []).filter((t) => t.on !== false), rows = [];
  for (const r of reqsOf(d)) {
    const mine = (r.objs || []).filter((x) => objs.has(x)), T = tests.filter((t) => (t.reqs || []).includes(r.id)).map((t) => t.id), runs = T.map((id) => results && results[id]).filter(Boolean);
    let state;
    if (r.on === false) state = "off";
    else if (!mine.length && r.verify === "test") state = "untraced";
    else if (r.verify !== "test") state = r.signed ? "signed" : "tosign";
    else if (runs.some((x) => !x.ok)) state = "failed";
    else if (runs.length && runs.every((x) => x.ok)) state = "verified";
    else state = "untested";
    rows.push({ req: r, objs: mine, tests: T, state });
  }
  const asked = new Set(liveReqs(d).flatMap((r) => r.objs || []));
  return { rows, orphans: [...objs].filter((id) => !asked.has(id)) };
}
export const TRACE_STATES = { verified: ["Vérifiée", "ok"], failed: ["Essai échoué", "danger"], untested: ["Pas encore essayée", "warn"], untraced: ["Sans tuile", "warn"], signed: ["Signée", "ok"], tosign: ["À signer", "neutral"], off: ["Off", "neutral"] };
/** What the guide says of the requirements. → [{ level, text, req? }] */
export function reqGuide(d, results = null) {
  const out = [], L = reqsOf(d), T = trace(d, results);
  if (!L.length) return [{ level: "todo", text: "Aucune exigence : écrivez d'abord ce que le logiciel doit faire — c'est ce que la vérification prouvera." }];
  for (const r of liveReqs(d)) { for (const q of reqQuality(r)) out.push({ ...q, text: `${r.id} : ${q.text}`, req: r.id }); if (r.sure === false) out.push({ level: "warn", text: `${r.id} est une exigence d'exemple proposée par l'outil : relisez-la et confirmez-la.`, req: r.id }); }
  for (const row of T.rows) { if (row.state === "untraced") out.push({ level: "todo", text: `${row.req.id} n'est allouée à aucune tuile : dites quelles tuiles la réalisent.`, req: row.req.id });
    if (row.state === "failed") out.push({ level: "error", text: `${row.req.id} : un essai qui la prouve échoue.`, req: row.req.id }); }
  if (T.orphans.length) out.push({ level: "warn", text: `${T.orphans.length} tuile${T.orphans.length > 1 ? "s" : ""} qu'aucune exigence ne demande (${T.orphans.slice(0, 4).join(", ")}${T.orphans.length > 4 ? "…" : ""}) : une fonction que personne n'a demandée se justifie, ou se retire.` });
  return out;
}
