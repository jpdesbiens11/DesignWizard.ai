/* DynamiteOrbit — the pilot trial, written : the path of one hour and the feedback sheet, each as a Word and a PDF document at the
   template of the platform's documents — and, with --docs, the guide of the repository (docs/ESSAI_PILOTE.md). Not part of the
   application. Every file is named « Sujet_AAAA-MM-JJ », as the deposit in Drive wants (CLAUDE.md).
     node tools/pilot_kit.mjs <out folder> [--date AAAA-MM-JJ] [--docs]
   The words are in tools/pilot/content.mjs ; the robot that walks the path is tools/pilot_walk.mjs. */
import { mkdirSync, writeFileSync } from "node:fs"; import { join } from "node:path"; import { fileURLToPath } from "node:url";
import { PILOT, pilotDoc, feedbackDoc, pilotMarkdown, pilotTexts } from "./pilot/content.mjs";
import { gainClaims } from "./launch/content.mjs";
import { docx } from "../web/js/core/docx.js";
import { pdfDoc } from "../web/js/core/pdfdoc.js";

const root = fileURLToPath(new URL("..", import.meta.url)), args = process.argv.slice(2), flag = (n, d) => { const i = args.indexOf(n); return i < 0 ? d : args[i + 1]; }, out = args[0] && !args[0].startsWith("--") ? args[0] : null;
if (!out && !args.includes("--docs")) { console.error("usage : node tools/pilot_kit.mjs <out folder> [--date AAAA-MM-JJ] [--docs]"); process.exit(2); }
const said = gainClaims(pilotTexts()); if (said.length) throw new Error(`the pilot kit gives a figure of gain : ${said.join(", ")} — nobody measured one`);
if (args.includes("--docs")) { writeFileSync(join(root, "docs/ESSAI_PILOTE.md"), pilotMarkdown()); console.log("docs/ESSAI_PILOTE.md written"); }
if (out) {
  const date = flag("--date", new Date().toISOString().slice(0, 10)); if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`--date ${date} : AAAA-MM-JJ`);
  mkdirSync(out, { recursive: true });
  const common = { kind: "Essai pilote", revision: "A", date: new Date(`${date}T12:00:00Z`), project: "DynamiteOrbit", organisation: "DynamiteAgile™" };
  const docs = [["Essai-pilote_Parcours", { ...common, title: `${PILOT.title} — le parcours d'une heure`, subtitle: PILOT.subtitle, header: "Essai pilote — parcours", reference: "DW-PIL-001", blocks: pilotDoc() }],
    ["Essai-pilote_Fiche-de-retour", { ...common, title: `${PILOT.title} — fiche de retour`, subtitle: "À remplir pendant et juste après l'essai", header: "Essai pilote — fiche de retour", reference: "DW-PIL-002", blocks: feedbackDoc() }]];
  for (const [name, doc] of docs) { const w = docx(doc), p = pdfDoc(doc); writeFileSync(join(out, `${name}_${date}.docx`), w); writeFileSync(join(out, `${name}_${date}.pdf`), p); console.log(`${name}_${date}.docx ${Math.round(w.length / 1024)} ko · ${name}_${date}.pdf ${Math.round(p.length / 1024)} ko`); }
}
