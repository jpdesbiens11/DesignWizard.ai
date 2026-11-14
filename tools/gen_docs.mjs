// Regenerates docs/PART_LANGUAGE.md from the single source of the part language (web/js/cad/language_doc.js).
// Usage: node tools/gen_docs.mjs
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { LANGUAGE_REFERENCE } from "../web/js/cad/language_doc.js";
import { INTERFACE_TYPES } from "../web/js/cad/interfaces.js";
import { MATERIALS, PROCESSES } from "../web/js/cad/materials.js";
import { PROFILE_GENERATORS } from "../web/js/cad/profile_gen.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fence = "```";
const out = [
  "<!-- Fichier généré par tools/gen_docs.mjs à partir de web/js/cad/language_doc.js : ne pas modifier à la main. -->",
  "# Le langage de pièce de DesignWizard.ai (DW part/1)", "",
  "Une pièce est un document `.dwiz` (voir [FORMAT.md](FORMAT.md)) ou son jumeau JSON. C'est ce que Claude écrit à la fin de",
  "l'entrevue, ce que montre l'onglet Fichier du studio de pièce, et ce que le noyau construit. La référence ci-dessous est",
  "exactement le texte donné à l'assistant dans le prompt générique",
  "(elle est en anglais parce que les clés du langage le sont).", "",
  fence + "text", LANGUAGE_REFERENCE, fence, "",
  "## Types d'interface", "", "| Type | Nom | Rôle des côtés A et B |", "|---|---|---|",
  ...Object.entries(INTERFACE_TYPES).map(([k, t]) => `| \`${k}\` | ${t.fr} | ${t.doc} |`), "",
  "## Générateurs de profil", "", Object.keys(PROFILE_GENERATORS).map((k) => `\`${k}\``).join(", "), "",
  "## Procédés", "", "| Clé | Procédé |", "|---|---|", ...Object.entries(PROCESSES).map(([k, p]) => `| \`${k}\` | ${p.fr} |`), "",
  "## Matériaux", "", "| Clé | Matériau | Densité (g/cm³) | CTI (V) |", "|---|---|---|---|",
  ...MATERIALS.map((m) => `| \`${m.id}\` | ${m.name} | ${m.rho} | ${m.conductive ? "conducteur" : m.cti ?? "—"} |`), "",
];
writeFileSync(path.join(root, "docs/PART_LANGUAGE.md"), out.join("\n"));
console.log("docs/PART_LANGUAGE.md written");
