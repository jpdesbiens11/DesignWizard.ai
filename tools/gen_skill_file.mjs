// Regenerates skills/ergonomie-ui.md — the whole skill in ONE file, to attach to any chat — from the skill folder
// (skills/ergonomie-ui/SKILL.md and its references). One source : the folder ; never edit the single file by hand.
//   node tools/gen_skill_file.mjs
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), dir = path.join(root, "skills/ergonomie-ui");
export const ANNEXES = [["A", "contrat"], ["B", "honnetete"], ["C", "mecanismes"], ["D", "aller-retour-ia"]];
const read = (p) => readFileSync(path.join(dir, p), "utf8");
const body = (text) => text.replace(/^---\n[\s\S]*?\n---\n+/, ""), untitled = (text) => text.replace(/^# .*\n+/, ""), titleOf = (text) => (text.match(/^# (.*)$/m) || [])[1] || "";

/** The single file, as text. */
export function singleFile() {
  const skill = body(read("SKILL.md")), letter = Object.fromEntries(ANNEXES.map(([l, name]) => [name, l]));
  const main = untitled(skill).replace(/\[references\/([\w-]+)\.md\]\(references\/\1\.md\)/g, (_, name) => `annexe ${letter[name]}, plus bas`);
  const out = [
    "<!-- Fichier généré par tools/gen_skill_file.mjs à partir de skills/ergonomie-ui/ : ne pas modifier à la main. -->",
    "", `# ${titleOf(skill)} — fichier unique`, "",
    "> **Pour la personne.** Joignez ce fichier à une conversation avec Claude et dites ce que vous voulez en faire : « applique ces règles à",
    "> mon projet », « relis cet écran avec », « on démarre une application ensemble ».",
    ">", "> **Pour l'agent qui le reçoit.** Ce document est une méthode à appliquer, pas un texte à résumer. Commence par « D'abord : où es-tu ? ».",
    "> Les annexes A à D sont le détail de chaque partie : ne déroule que celle que la demande appelle.",
    ">", "> Source : DesignWizard.ai, licence MIT — dossier `skills/ergonomie-ui` du dépôt (le même contenu, en skill).", "",
    main.trimEnd(), "",
  ];
  for (const [l, name] of ANNEXES) { const text = read(`references/${name}.md`); out.push("---", "", `# Annexe ${l} — ${titleOf(text)}`, "", untitled(text).trimEnd(), ""); }
  return out.join("\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) { writeFileSync(path.join(root, "skills/ergonomie-ui.md"), singleFile()); console.log("skills/ergonomie-ui.md written"); }
