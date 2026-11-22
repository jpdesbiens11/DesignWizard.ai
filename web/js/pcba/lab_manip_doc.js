/* DesignOrbit.ai — Labo, « Manipulation en labo » on paper : the procedure of a test, step by step, with a PICTURE OF THE BOARD
   for every step that touches it (demande de JP : « permettre l'importation des procédures en pdf avec un format complet
   pour un travail en lab… le cahier de travail et de notes »). The same steps as the screen (pcba/lab_manip.js), the same
   points — a ring on the pad, the lead that goes there, the pin written small — drawn as vectors, so the page prints sharp.
   One document, two uses : EMPTY, it is the procedure one takes to the bench, with a box for each reading and lines for
   the notes ; FILLED — what was ticked, read, let pass and noted is in the notebook of the board (board.lab) — it is the
   report of the test. Nothing is written by an assistant, and nothing here decides : the steps and their state come from
   pcba/lab_manip.js. Pure : → a document model for core/pdfdoc.js. */

import { labOf, testKey, expectedText, SAFETY } from "./lab_plan.js";
import { manipSteps, manipState, placedPoints, readingSays, readUnit } from "./lab_manip.js";
import { plainStep, plainReading, screenToBench, whyDifferent, WORDS } from "./lab_plain.js";
import { eng } from "./lab_bench.js";

const KIND = { safety: "Sécurité", set: "Régler l'appareil", connect: "Brancher sur la carte", guard: "Vérifier avant d'alimenter", power: "Mise sous tension", do: "Geste à la main", read: "Relever", off: "Couper" };
const hour = (iso) => { const d = iso ? new Date(iso) : null; return d && !Number.isNaN(d.getTime()) ? `${String(d.getHours()).padStart(2, "0")} h ${String(d.getMinutes()).padStart(2, "0")}` : ""; };      // the hour of the bench : local time, as on the screen
/** The picture of a step : the part of the board around its points, the parts that are there, the pads, and the marks.
    R : the resolved board ; pp : placedPoints(R, step). → { draw(sheet, x, y, w, h), width, height, caption } or null when the step touches nothing on the board */
export function stepFigure(R, pp) {
  const on = pp.points.filter((p) => p.at); if (!on.length || !pp.box) return null;
  const B = R.bbox, m = 2, v = [Math.max(B[0] - m, pp.box[0]), Math.max(B[1] - m, pp.box[1]), Math.min(B[2] + m, pp.box[2]), Math.min(B[3] + m, pp.box[3])], vw = v[2] - v[0], vh = v[3] - v[1];
  if (!(vw > 1 && vh > 1)) return null;
  const width = 120, height = Math.min(95, (width * vh) / vw), inside = (x, y) => x >= v[0] && x <= v[2] && y >= v[1] && y <= v[3], touched = new Set(on.map((p) => p.ref));
  const draw = (sheet, x, y, fw, fh) => {
    const k = Math.min(fw / vw, fh / vh), X = (px) => x + (px - v[0]) * k, Y = (py) => y + (v[3] - py) * k, cl = (a, lo, hi) => Math.max(lo, Math.min(hi, a));
    sheet.rect(x, y, vw * k, vh * k, { fill: "#eef2ee", color: "#20242a", w: 0.25 });
    const bx0 = cl(B[0], v[0], v[2]), bx1 = cl(B[2], v[0], v[2]), by0 = cl(B[1], v[1], v[3]), by1 = cl(B[3], v[1], v[3]); if (bx1 > bx0 && by1 > by0) sheet.rect(X(bx0), Y(by1), (bx1 - bx0) * k, (by1 - by0) * k, { fill: "#dfe9df", color: "#5a6b5a", w: 0.2 });
    for (const p of R.parts || []) { const [x0, y0, x1, y1] = p.box; if (x1 < v[0] || x0 > v[2] || y1 < v[1] || y0 > v[3]) continue; const a = cl(x0, v[0], v[2]), b = cl(x1, v[0], v[2]), c = cl(y0, v[1], v[3]), d = cl(y1, v[1], v[3]), hit = touched.has(p.ref);
      sheet.rect(X(a), Y(d), (b - a) * k, (d - c) * k, { fill: hit ? "#ffffff" : "#f3f5f3", color: hit ? "#20242a" : "#9aa59a", w: hit ? 0.3 : 0.15 });
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, s = cl(Math.min(x1 - x0, y1 - y0) * k * 0.5, 1.6, 3.2); if (inside(cx, cy) && (x1 - x0) * k > s * 1.6) sheet.text(X(cx), Y(cy), p.ref, { size: s, color: hit ? "#20242a" : "#7b867b", align: "center", baseline: "middle" }); }
    for (const p of R.pads || []) if (inside(p.x, p.y)) sheet.rect(X(p.x - p.w / 2), Y(p.y + p.h / 2), p.w * k, p.h * k, { fill: touched.has(p.ref) ? "#c79a2e" : "#d9c79a", color: null });
    const cx = on.reduce((a, p) => a + p.at.x, 0) / on.length, cy = on.reduce((a, p) => a + p.at.y, 0) / on.length, DIR = [[-0.7, 0.7], [0.7, 0.7], [-0.7, -0.7], [0.7, -0.7]];
    on.forEach((p, i) => { const px = X(p.at.x), py = Y(p.at.y), vx = p.at.x - cx, vy = p.at.y - cy + 0.6 * Math.hypot(p.at.x - cx, p.at.y - cy), n = Math.hypot(vx, vy), d = n > 1e-6 ? [vx / n, vy / n] : DIR[i % 4];
      const lx = cl(px + d[0] * 11, x + 4, x + vw * k - 4), ly = cl(py - d[1] * 11, y + 4, y + vh * k - 4);
      sheet.circle(px, py, 2.6, { color: "#ffffff", w: 1.1, fill: null }); sheet.circle(px, py, 2.6, { color: p.color, w: 0.6, fill: null }); sheet.polyline([[px, py], [lx, ly]], { color: p.color, w: 0.35 });
      sheet.circle(lx, ly, 3, { fill: p.color, color: "#ffffff", w: 0.4 }); sheet.text(lx, ly, p.label, { size: 3.4, color: "#ffffff", align: "center", baseline: "middle" });
      const right = lx - x < vw * k * 0.75; sheet.text(lx + (right ? 4 : -4), ly, `${p.ref} · ${p.pin}`, { size: 2.6, color: "#20242a", align: right ? "left" : "right", baseline: "middle" }); });
  };
  return { draw, width, height, caption: pp.points.map((p) => `${p.label} : ${p.word} → ${p.signal}${p.at ? ` (${p.ref}, broche ${p.pin})` : " — ce point n'est pas sur la carte"}`).join("   ·   ") };
}
/** The procedure of one test, as blocks of a document : what to understand, then each step — its picture, its action, its reading, its note. */
export function manipBlocks(board, R, sheet) {
  const key = testKey(sheet.blockId, sheet.test), L = labOf(board), steps = manipSteps(sheet), st = manipState(sheet, steps, L, key), out = [], p = (text, style) => out.push({ type: "p", text, style });
  out.push({ type: "h1", text: `${sheet.id ? `${sheet.id} — ` : ""}${sheet.title}` });
  out.push({ type: "kv", rows: [["Bloc", sheet.block || "—"], ["Nature", sheet.nature ? `${sheet.nature.label} — ${sheet.nature.fr}` : "—"], ["Matériel", (sheet.gear || []).map((g) => g.label).join(", ") || "—"], ["Durée", `${sheet.minutes || 15} min au laboratoire`], ["Étapes", `${steps.length} — ${st.done} faite${st.done > 1 ? "s" : ""}${st.stopped ? " — ESSAI ARRÊTÉ sur un relevé hors plage" : st.finished ? " — essai terminé" : ""}`]] });
  out.push({ type: "h2", text: "Comprendre" }); p(`Pourquoi cet essai. ${sheet.why}`); p(`À quoi s'attendre. ${typeof sheet.expect === "string" ? sheet.expect : ""}`);
  { const map = screenToBench(sheet); out.push({ type: "h2", text: "L'écran du Labo et le vrai banc" }); p("L'écran est une simulation : il connaît chaque fil, à chaque instant. Le banc est une vraie carte, lue avec un appareil à la fois.", "muted");
    if (map.length) out.push({ type: "table", head: ["À l'écran du Labo", "Au vrai banc"], widths: [50, 50], rows: map.map((m) => [m.screen, m.bench]) }); out.push({ type: "list", items: whyDifferent(sheet).map((w) => `${w.title}. ${w.text}`) }); }
  out.push({ type: "h2", text: "Faire" }); p("Une étape à la fois, dans l'ordre : chaque étape s'ouvre quand celles d'avant sont faites. Un relevé hors de sa plage arrête l'essai — on coupe, on refait la mesure une fois, on compare les pièces à la nomenclature. On ne corrige jamais un relevé.", "muted");
  st.steps.forEach((s, i) => {
    const tick = L.ticks.find((t) => t.test === key && t.step === s.id), note = L.notes.find((n) => n.test === key && n.step === s.id);
    out.push({ type: "h3", text: `${i + 1}. ${KIND[s.kind] || ""} — ${s.title}` });
    { const plain = `${plainStep(s)}${s.needs === "reading" ? ` ${plainReading(sheet.rows[s.row])}` : ""}`; if (plain.trim()) p(`En clair. ${plain}`); }
    if (s.instrument) p(`Appareil : ${s.instrument}${s.gear && s.gear.kind === "supply" ? ` — ${s.gear.v !== null && s.gear.v !== undefined ? `${String(s.gear.v).replace(".", ",")} V` : "tension de la note"}${s.gear.ilim ? `, limite ${eng(s.gear.ilim, "A")}` : ""}, sortie ${s.gear.on ? "ACTIVE" : "COUPÉE"}` : s.gear && s.gear.kind === "generator" ? `, sortie ${s.gear.on ? "ACTIVE" : "COUPÉE"}` : ""}.`, "muted");
    p(s.text); if (s.list) out.push({ type: "list", items: s.list }); if (s.why) p(`Pourquoi. ${s.why}`, "note");
    const fig = stepFigure(R, placedPoints(R, s)); if (fig) out.push({ type: "figure", ...fig });
    if (s.needs === "reading") { const row = sheet.rows[s.row], U = readUnit(row.ceiling ? row.band.high : row.expected, row.unit), says = readingSays(row, s.value ?? null);
      out.push({ type: "table", head: ["Relevé", row.ceiling ? "Simulé" : "Attendu", "Accepté", `Mesuré (${U.label || "—"})`, "Verdict"], widths: [30, 16, 22, 16, 16], rowHeight: 9, rows: [[row.label, expectedText(row), row.band.text, s.value !== undefined ? String(+(s.value * U.k).toPrecision(6)).replace(".", ",") : "", says.v === "ok" ? "conforme" : says.v === "out" ? "HORS PLAGE" : ""]] });
      if (says.v === "out") p(`${says.text} ${says.action}`, "warn");
      if (s.pass) p(`Laissé passer par ${s.pass.by}${s.pass.when ? ` à ${hour(s.pass.when)}` : ""}${s.pass.why ? ` — ${s.pass.why}` : ""}.`, "warn"); }
    else p(tick ? `[ X ]  Fait${tick.when ? ` à ${hour(tick.when)}` : ""}.` : "[     ]  Fait.");
    p(note ? `Notes : ${note.text}` : "Notes : ______________________________________________________________________", note ? undefined : "muted");
  });
  out.push({ type: "h2", text: "À retenir" }); p(sheet.learn || "");
  out.push({ type: "signatures", roles: ["Fait par", "Relu par (superviseur)"] });
  return out;
}
/** The document of the manipulations. sheets : the tests to put in (one, or the whole plan), simulated (pcba/lab_plan.js). o : { date, project, author } */
export function manipDoc(board, R, sheets, o = {}) {
  const date = o.date || new Date(0), out = [{ type: "toc" }, { type: "pagebreak" }], one = sheets.length === 1;
  out.push({ type: "h1", text: "Avant de commencer" }, { type: "p", text: `Ce cahier est celui des manipulations de la carte ${board.id} « ${board.name || ""} », révision ${board.revision || "A"}, à faire au vrai banc. Chaque étape qui touche la carte en montre l'endroit : un anneau sur la pastille, la lettre du cordon qui y va, la référence et la broche en petit.` },
    { type: "p", text: "Vide, c'est la procédure à emporter au banc : une case par relevé, des lignes pour les notes. Rempli — ce qui a été coché, relevé et noté dans l'outil s'y retrouve —, c'est le compte rendu de l'essai.", style: "muted" },
    { type: "kv", rows: [["Carte", `${board.id} — ${board.name || ""}`], ["Révision", board.revision || "A"], ["Projet", (o.project && o.project.name) || "—"], ["Fait par", o.author || "—"], ["Date", date.toISOString().slice(0, 10)], ["Essais", String(sheets.length)]] },
    { type: "h2", text: "Sécurité" }, { type: "list", items: SAFETY },
    { type: "h2", text: "Les lettres des cordons" }, { type: "table", head: ["Lettre", "Cordon"], widths: [16, 84], rows: [["+ / −", "les cordons rouge et noir de l'alimentation"], ["R / N", "les pointes rouge et noire du multimètre"], ["S / M", "la sonde de l'oscilloscope et sa pince de masse — la pince ne va que sur la masse"], ["S2", "la sonde de la voie 2 de l'oscilloscope"], ["S−", "la pointe − d'une sonde différentielle — pour une tension entre deux points dont aucun n'est la masse"], ["G / G−", "le point chaud du générateur et son retour"], ["C", "la charge, ou le composant d'essai"]] },
    { type: "h2", text: "Les mots du banc" }, { type: "table", head: ["Mot", "Ce que c'est"], widths: [26, 74], rows: WORDS.map((w) => [`${w.word} — ${w.en}`, w.says]) },
    { type: "p", text: "Les valeurs attendues viennent d'une simulation, où chaque circuit intégré est un comportement TYPIQUE : la fiche technique du composant monté fait foi. Les règles de sécurité de votre établissement passent avant ce cahier.", style: "muted" });
  for (const s of sheets) { out.push({ type: "pagebreak" }); out.push(...manipBlocks(board, R, s)); }
  const tag = one ? `-${String(sheets[0].id || [sheets[0].blockId, sheets[0].test].filter(Boolean).join("-")).toLowerCase()}` : "";      // a test of the plan has its number ; one opened from its block is named by its block and its test
  return { title: `Manipulations en laboratoire — ${board.id}`, subtitle: one ? `${sheets[0].id ? `${sheets[0].id} — ` : ""}${sheets[0].title}` : board.name || "", subject: "Manipulations en laboratoire", author: o.author || "", date, reference: `${board.id}-MANIP${tag.toUpperCase()}`, revision: board.revision || "A", header: `${board.id} rév. ${board.revision || "A"} — Manipulations en laboratoire`, footer: "DesignOrbit.ai", blocks: out, name: `${board.id}-rev${board.revision || "A"}-manipulations${tag}` };
}
