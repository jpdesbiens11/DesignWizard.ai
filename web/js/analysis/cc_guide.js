/* DesignOrbit.ai — isolation : what the creepage and clearance analysis of an assembly still asks for, said to the guide. Pure.
   The analysis is a calculation : its lines are written in millimetres and stay so, whatever the units chosen for the design.
   What the list reads is what the project keeps — the nets, and the light summary of the last analysis (asm.isolation.results). It cannot
   see that the geometry has moved since : only that a net analysed is gone. */

const many = (n, one, more) => `${n} ${n > 1 ? more : one}`, fr = (v, d = 2) => String(Math.round(v * 10 ** d) / 10 ** d).replace(".", ",");

/** The nets of an assembly : those kept in asm.isolation, completed with the nets its parts declare (pcb.nets, elec.net). part(id) → the part, or nothing. */
export function netsOf(asm, part = () => null) {
  const a = asm || {}, nets = new Map((((a.isolation || {}).nets) || []).map((n) => [n.name, { ...n }]));
  for (const inst of a.instances || []) {
    const s = part(inst.part); if (!s) continue;
    for (const [name, def] of Object.entries((s.pcb && s.pcb.nets) || {})) if (!nets.has(name)) nets.set(name, { name, kind: def.kind || "dc", voltage: def.voltage ?? 0, floating: !!def.floating });
    const own = s.elec && s.elec.net;
    if (own && !nets.has(own)) nets.set(own, { name: own, kind: "dc", voltage: 0 });
  }
  return [...nets.values()];
}

/* why a pair fails, in a few words : the distance measured against the one required */
const short = (r) => (typeof r.clr === "number" && typeof r.clrReq === "number" && r.clr < r.clrReq ? `clearance ${fr(r.clr)} mm pour ${fr(r.clrReq)} requis`
  : typeof r.crp === "number" && typeof r.crpReq === "number" && r.crp < r.crpReq ? `creepage ${fr(r.crp)} mm pour ${fr(r.crpReq)} requis` : "distance insuffisante");

/** What the isolation of an assembly asks for. nets : netsOf(asm, …) ; o.here : true on the Isolation screen itself, where an assembly without
    potentials is worth a word. → [{ level, text, field }] */
export function isolationGuide(asm, nets, o = {}) {
  const out = [], a = asm || {}, id = a.id || "Assemblage", say = (level, text, field) => out.push({ level, text: `${id} — isolation : ${text}`, field }), list = nets || [];
  if (list.length < 2) { if (o.here) say("tip", "moins de deux potentiels, rien à comparer — donnez un net aux conducteurs (pièces électriques, cartes), ou ajoutez les potentiels de l'assemblage.", "nets"); return out; }
  if (!list.some((n) => Math.abs(Number(n.voltage) || 0) > 0)) { say("todo", `aucun des ${list.length} potentiels n'a de tension — entrez-les : sans tension, aucune distance n'est requise.`, "voltage"); return out; }
  const results = (a.isolation || {}).results || [];
  if (!results.length) { say("tip", `${list.length} potentiels, analyse pas encore lancée — écran Isolation, bouton « Analyser ».`, "run"); return out; }
  const names = new Set(list.map((n) => n.name)), gone = [...new Set(results.flatMap((r) => [r.a, r.b]).filter((n) => !names.has(n)))];
  if (gone.length) say("warn", `résultats périmés — ${gone.length > 1 ? "des potentiels analysés n'existent plus" : "un potentiel analysé n'existe plus"} (${gone.slice(0, 3).join(", ")}) : relancez l'analyse.`, "run");
  const bad = results.filter((r) => r.ok === false), open = results.filter((r) => r.ok !== true && r.ok !== false);
  if (bad.length) say("error", `${many(bad.length, "paire en défaut", "paires en défaut")} — ${bad[0].a} ↔ ${bad[0].b} (${short(bad[0])})${bad.length > 1 ? "…" : ""}`, "results");
  if (open.length) say("warn", `${many(open.length, "paire sans verdict", "paires sans verdict")} (${open[0].a} ↔ ${open[0].b}${open.length > 1 ? "…" : ""}) : à examiner à l'écran Isolation.`, "results");
  return out;
}

/** The potentials of a board, read without its copper : the voltages its nets declare. Enough to tell whether a result kept is stale. */
export const boardLevelNames = (board) => [...new Set(((board && board.nets) || []).map((n) => `${String(Math.round((Number(n.voltage) || 0) * 1000) / 1000).replace(".", ",").replace("-", "−")} V`))].map((name) => ({ name, voltage: 1 }));
/** What the isolation of a board analysed ALONE still asks for : only a board whose analysis was run says something — its pairs in fault,
    its stale results. A board never analysed asks for nothing here (its screen says the rest). → [{ level, text, field }] */
export function boardIsolationGuide(board) {
  if (!(((board || {}).isolation || {}).results || []).length) return [];
  return isolationGuide(board, boardLevelNames(board)).filter((x) => x.field === "run" || x.field === "results").map((x) => ({ ...x, text: x.text.replace(" — isolation : ", " — isolation de la carte seule : ") }));
}
