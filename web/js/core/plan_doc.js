/* DesignOrbit.ai — a routing sheet, whatever it describes : the manufacture of a part (to talk with a supplier),
   the assembly of a product or of an electronic board (to talk with the prototyping engineers). One shape for the
   three, one text and one document made from it :
   plan = { kind: "fabrication" | "assemblage" | "carte", id, name, revision, title, audience,
            facts: [[label, value]],
            phases: [{ key, n, title, station, hold, outsourced, ops: [{ n, text, tools, control }], tools, checks, note }],
            tools: [text], hardware: [{ id, name, qty }], characteristics: [{ text, control }],
            questions: [{ topic, text }], advice: [text], points: [text] }
   The document follows the model of core/docx.js and core/pdfdoc.js. */

export const PLAN_KINDS = {
  fabrication: { title: "Gamme de fabrication", audience: "le fournisseur", ask: "Points à discuter avec le fournisseur", sign: ["Demandeur", "Fournisseur"] },
  assemblage: { title: "Gamme d'assemblage", audience: "les ingénieurs de prototypage", ask: "Points à discuter avec le prototypage", sign: ["Concepteur", "Ingénieur de prototypage"] },
  carte: { title: "Gamme d'assemblage de la carte", audience: "l'assembleur de cartes", ask: "Points à discuter avec l'assembleur", sign: ["Concepteur", "Assembleur"] },
};
const uniq = (list) => [...new Set(list.filter(Boolean))];

/** Numbers the phases by tens and their operations inside ; gathers the tools. Returns the plan. */
export function finishPlan(plan) {
  plan.phases.forEach((ph, i) => {
    ph.n = (i + 1) * 10; ph.ops = ph.ops || []; ph.checks = ph.checks || [];
    ph.ops.forEach((op, k) => { op.n = `${ph.n}.${k + 1}`; op.tools = op.tools || []; });
    ph.tools = uniq([...(ph.tools || []), ...ph.ops.flatMap((o) => o.tools)]);
  });
  plan.tools = uniq(plan.phases.flatMap((ph) => ph.tools));
  for (const k of ["facts", "hardware", "characteristics", "questions", "advice", "points"]) plan[k] = plan[k] || [];
  plan.title = `${PLAN_KINDS[plan.kind].title} — ${plan.id}`;
  return plan;
}

/** The routing sheet as plain text : for an e-mail, a quote request, the traveller that follows the part. */
export function planText(plan) {
  const K = PLAN_KINDS[plan.kind], out = [`${K.title.toUpperCase()} — ${plan.id} ${plan.name || ""}`.trim() + (plan.revision ? `, révision ${plan.revision}` : ""), ...plan.facts.map(([k, v]) => `${k} : ${v}`), ""];
  for (const ph of plan.phases) {
    out.push(`${String(ph.n).padStart(3)}  ${ph.title}${ph.station ? ` — ${ph.station}` : ""}${ph.outsourced ? " (sous-traité)" : ""}`);
    if (ph.hold) out.push(`       Prise de pièce : ${ph.hold}`);
    for (const op of ph.ops) out.push(`     ${op.n.padEnd(6)} ${op.text}${op.control ? `  [contrôle : ${op.control}]` : ""}`);
    for (const c of ph.checks) out.push(`       ✓ ${c}`);
    if (ph.tools.length) out.push(`       Outillage : ${ph.tools.join(" ; ")}`);
    if (ph.note) out.push(`       Note : ${ph.note}`);
  }
  if (plan.hardware.length) out.push("", "VISSERIE ET FOURNITURES", ...plan.hardware.map((h) => `  ${String(h.qty).padStart(3)} × ${h.name}`));
  if (plan.characteristics.length) out.push("", "CARACTÉRISTIQUES À TENIR", ...plan.characteristics.map((c) => `  - ${c.text}${c.control ? ` — ${c.control}` : ""}`));
  if (plan.questions.length || plan.points.length) out.push("", K.ask.toUpperCase(), ...plan.questions.map((q, i) => `  ${i + 1}. [${q.topic}] ${q.text}`), ...plan.points.map((t) => `  • ${t}`));
  if (plan.advice.length) out.push("", "REMARQUES", ...plan.advice.map((a) => `  - ${a}`));
  out.push("", "Généré par DesignOrbit.ai — proposition à valider avec " + K.audience + ".");
  return out.join("\n");
}

/** One line for a report : how many phases, what is subcontracted, what is left to discuss, what was noted. */
export function planSummary(plan) {
  const out = plan.phases.filter((p) => p.outsourced).length, notes = plan.phases.filter((p) => p.note).length, ask = plan.questions.length + plan.points.length;
  return `${plan.phases.length} phases${out ? `, dont ${out} sous-traitée${out > 1 ? "s" : ""}` : ""} · ${ask} point${ask > 1 ? "s" : ""} à discuter avec ${PLAN_KINDS[plan.kind].audience}${notes ? ` · ${notes} note${notes > 1 ? "s" : ""} de discussion` : ""}`;
}

/** The key of each phase, for whoever annotates the sheet (the notes of an artefact are filed under these keys). */
export const planKeys = (plan) => ["CLÉS DES PHASES (pour « plan notes »)", ...plan.phases.map((ph) => `  ${ph.key} : ${ph.n} ${ph.title}`)].join("\n");

/** The routing sheet as a document. meta : { author, date, project, figures: [{ png, pngSize, draw, width, height, caption, phase }] }. */
export function planDoc(plan, meta = {}) {
  const K = PLAN_KINDS[plan.kind], out = [], figs = meta.figures || [], date = meta.date || new Date(0);
  const fig = (f) => out.push({ type: "figure", png: f.png, pngSize: f.pngSize, draw: f.draw, width: f.width, height: f.height, caption: f.caption });
  out.push({ type: "h1", text: "1. Objet" }, { type: "p", text: `${K.title} de ${plan.id} « ${plan.name || ""} ». Proposition tirée du modèle, à discuter et à valider avec ${K.audience} : l'ordre, les postes et les contrôles sont une base de discussion, pas une instruction figée.` },
    { type: "kv", rows: [...(meta.project ? [["Projet", meta.project]] : []), ["Référence", `${plan.id}${plan.revision ? `, révision ${plan.revision}` : ""}`], ...plan.facts, ["Phases", `${plan.phases.length}, dont ${plan.phases.filter((p) => p.outsourced).length} sous-traitée(s)`], ["Date", date.toISOString().slice(0, 10)]] });
  for (const f of figs.filter((x) => x.phase === undefined || x.phase === null)) fig(f);
  out.push({ type: "h1", text: "2. Déroulement, phase par phase" }, { type: "table", head: ["N°", "Phase", "Poste", "Opérations", "Outillage"], widths: [6, 22, 18, 36, 18],
    rows: plan.phases.map((ph) => [{ text: String(ph.n), bold: true }, { text: ph.title, bold: true }, `${ph.station || "—"}${ph.outsourced ? " (sous-traité)" : ""}`, String(ph.ops.length || ph.checks.length), ph.tools.join(" ; ") || "—"]) });
  for (const ph of plan.phases) {
    out.push({ type: "h2", text: `${ph.n} — ${ph.title}` });
    const head = [ph.station ? `Poste : ${ph.station}${ph.outsourced ? " (sous-traité)" : ""}.` : "", ph.hold ? `Prise de pièce : ${ph.hold}.` : ""].filter(Boolean).join(" ");
    if (head) out.push({ type: "p", text: head, style: "muted" });
    for (const f of figs.filter((x) => x.phase === ph.key)) fig(f);
    if (ph.ops.length) out.push({ type: "table", head: ["N°", "Opération", "Outillage", "Contrôle"], widths: [8, 50, 22, 20], rows: ph.ops.map((op) => [op.n, op.text, op.tools.join(" ; ") || "—", op.control || "—"]) });
    if (ph.checks.length) out.push({ type: "checklist", items: ph.checks.map((c) => ({ text: c, state: "open" })) });
    if (ph.note) out.push({ type: "p", text: `Note : ${ph.note}`, style: "note" });
  }
  let n = 2; const sec = (t) => out.push({ type: "h1", text: `${++n}. ${t}` });
  if (plan.hardware.length) { sec("Visserie et fournitures"); out.push({ type: "table", head: ["Qté", "Désignation", "Repère"], widths: [10, 60, 30], rows: plan.hardware.map((h) => [String(h.qty), h.name, h.id || ""]) }); }
  if (plan.tools.length) { sec("Outillage"); out.push({ type: "list", items: plan.tools }); }
  if (plan.characteristics.length) { sec("Caractéristiques à tenir"); out.push({ type: "table", head: ["Caractéristique", "Contrôle"], widths: [68, 32], rows: plan.characteristics.map((c) => [c.text, c.control || "—"]) }); }
  sec(K.ask);
  out.push({ type: "table", head: ["N°", "Sujet", "Question", "Réponse"], widths: [6, 16, 46, 32], rows: [...plan.questions.map((q, i) => [String(i + 1), q.topic, q.text, ""]), ...plan.points.map((t, i) => [String(plan.questions.length + i + 1), "À voir", t, ""])] });
  if (plan.advice.length) { sec("Remarques tirées du modèle"); out.push({ type: "list", items: plan.advice }); }
  sec("Accord"); out.push({ type: "signatures", roles: K.sign });
  return { title: `${K.title} — ${plan.id}`, subtitle: plan.name || "", subject: K.title, author: meta.author || "", date, reference: `${plan.id}-GAMME`, revision: plan.revision || "A", header: `${plan.id}${plan.revision ? ` rév. ${plan.revision}` : ""} — ${K.title}`, footer: "DesignOrbit.ai", blocks: [{ type: "toc" }, { type: "pagebreak" }, ...out] };
}
