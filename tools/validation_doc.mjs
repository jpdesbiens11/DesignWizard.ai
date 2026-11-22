/* DynamiteOrbit — docs/VALIDATION.md, written from the reference cases themselves : every case is replayed, and the table says
   what the source prints, what the tool finds and the gap. A test holds the file to what this script writes.
     node tools/validation_doc.mjs          writes docs/VALIDATION.md
     import { validationDoc }               the text, for the test */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runCase, casesFor, coverage, gapText, READ_LEVELS, HOW, FEA_KINDS } from "../web/js/analysis/validation.js";
import { CASES, GAPS, NONE, CONVERTED } from "../web/js/analysis/validation_cases.js";
import { FEA_CASES, FEA_GAPS, solveFea } from "../web/js/analysis/validation_fea.js";
import { MODELS, DOMAINS, shortTitle } from "../web/js/analysis/physics/index.js";

const ALL = [...CASES, ...FEA_CASES];
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? String(Number(v.toPrecision(4))).replace(".", ",") : "—"), pct = (t) => `± ${String(Number((t * 100).toFixed(2))).replace(".", ",")} %`, cell = (t) => String(t).replace(/\|/g, "\\|");

function familyBlock(id, name, title) {
  const list = casesFor(ALL, id), out = [`### ${name} — ${title}`, ""];
  if (!list.length) { out.push(`**Aucun cas.** ${NONE[id] || "Aucun exemple publié n'a encore été rejoué."}`, ""); return out; }
  out.push("| Cas | Source | Grandeur | La source imprime | L'outil trouve | Écart | Tolérance |", "|---|---|---|---|---|---|---|");
  for (const c of list) { const r = runCase(c, { fea: solveFea });
    r.rows.forEach((x, i) => out.push(`| ${i ? "" : cell(`${c.title} *(${HOW[c.how].label})*`)} | ${i ? "" : cell(`[${c.source.name}](${c.source.url}) — ${c.source.where} · ${READ_LEVELS[c.source.read].label}`)} | ${cell(x.label)} | ${cell(x.printed)} | ${num(x.obtained)}${x.unit ? ` ${x.unit}` : ""} | ${r.ok || x.ok ? "" : "**"}${gapText(x.gap)}${r.ok || x.ok ? "" : "**"} | ${pct(x.tol)} |`)); }
  out.push("");
  for (const c of list) if (c.mesh) out.push(`- *${c.title}* — maillage : ${c.mesh}`);
  const gaps = GAPS[id] || FEA_GAPS[id]; if (gaps) out.push(`- **Ce que ces cas ne couvrent pas** : ${gaps}`);
  out.push(""); return out;
}

export function validationDoc() {
  const cov = coverage(ALL), sources = new Map(); for (const c of ALL) sources.set(c.source.name, c.source);
  const L = ["# Validation des calculs — des exemples publiés, rejoués", "",
    "> Ce fichier est écrit par `node tools/validation_doc.mjs` à partir des cas eux-mêmes (`web/js/analysis/validation_cases.js`,", "> `web/js/analysis/validation_fea.js`) : ne pas le modifier à la main. Un test le tient à jour.", "",
    "Demande de JP : « pour tous les modèles dans la simulation physique… des exemples de validation des équations qui sont référencées", "par une source existante… qu'on est capable de reproduire des exemples simples pour chacun des modèles : analytique, thermique,", "structural ».", "",
    "## Le principe", "",
    "Un **cas de référence** est un exemple chiffré que quelqu'un d'autre a publié — un manuel libre, une page d'ingénierie, des notes de", "cours — avec ses données et son résultat imprimé. L'outil le rejoue avec son propre modèle et montre, côte à côte, ce que la source", "imprime, ce que l'outil trouve, et l'écart. Les règles, tenues par `tests/node/validation.test.mjs` :", "",
    "- **la valeur attendue est celle que la source imprime**, jamais une valeur recalculée ici avec la même formule ;", "- une source n'est dite « page lue » que si sa page a été ouverte et ses nombres copiés tels qu'imprimés ;", "- un cas est **rejoué fidèlement** : une donnée que le modèle a dû ramener dans sa plage fait échouer le cas ;", "- la **tolérance suit les chiffres imprimés** : un résultat imprimé avec deux chiffres ne se retrouve pas à 0,1 % près ;", "- un modèle **sans cas le dit**, et un modèle qui en a dit **ce qu'ils ne couvrent pas** : rien n'est tenu pour validé d'office.", "",
    "D'une source, seuls **des nombres et la référence** sont repris : aucun texte, aucune figure. Un cas retrouvé dit que la formule est", "bien écrite ; il ne dit pas qu'elle s'applique à une pièce donnée — le domaine de validité de chaque modèle reste ce qu'il est.", "",
    "Trois façons de rejouer un exemple :", "", ...Object.values(HOW).map((h) => `- **${h.label}** — ${h.text}`), "",
    "## Où cela se voit", "",
    "- **Modèles analytiques** (`#/physics`) : une coche sur la tuile de chaque modèle recoupé ; sous le schéma, une pastille « n cas publiés", "  retrouvés » ou « Sans cas de référence » ; dans l'onglet « Calcul », le groupe **Validation** — chaque cas avec sa source (lien, niveau", "  de lecture, licence), ce que la source donne, puis une ligne par grandeur : la source, l'outil, l'écart, la tolérance. « Charger ce cas", "  dans le modèle » met les données de la source dans les champs.", "- **Simulation** (`#/fea`) : le groupe **Validation** du volet de droite, pour la physique du cas ouvert ; les cas se rejouent dans la", "  page, sous le voile, en deux secondes au plus.", "- **Aide** (`#/help/validation`) : le tableau d'ensemble, modèle par modèle.", "",
    "## Où l'on en est", "",
    `**${cov.covered} des ${cov.total} modèles** ont au moins un exemple publié rejoué — ${cov.cases} cas, dont ${cov.read} lus sur la page de leur source.`, `Sans cas : ${cov.missing.map((m) => `\`${m.id}\``).join(", ") || "aucun"}.`, ""];
  for (const d of DOMAINS) { L.push(`## ${d.label}`, ""); for (const m of MODELS.filter((x) => x.domain === d.id)) L.push(...familyBlock(m.id, shortTitle(m), m.fr || m.title)); }
  L.push("## Simulation", "", "Le solveur lui-même, sur un petit maillage de cubes construit pour l'exemple. L'écart d'une simulation est aussi celui de son maillage :", "chaque cas dit le sien.", "");
  for (const k of FEA_KINDS) L.push(...familyBlock(k.id, k.short, k.title));
  L.push("## Les sources et leurs licences", "", "| Source | Lecture | Licence dite par la source |", "|---|---|---|", ...[...sources.values()].map((s) => `| [${cell(s.name)}](${s.url.replace(/\/[^/]*$/, "/")}) | ${READ_LEVELS[s.read].label} | ${cell(s.licence || "—")} |`), "",
    "Les pages ont été ouvertes le 20 novembre 2026. Les ouvrages d'OpenStax sont sous CC BY-NC-SA 4.0 et demandent que leur contenu ne soit", "pas versé dans un modèle de langage : rien n'en est repris ici que des nombres d'exemples et leur référence, cités comme on cite un", "ouvrage. Si cet usage devait gêner, les cas qui s'y appuient se retirent sans rien casser — leur modèle dirait alors qu'il n'a pas de cas.", "",
    `Les exemples en unités impériales sont convertis : ${CONVERTED.replace("Unités impériales de la source converties avec les définitions exactes : ", "")}`, "",
    "## Ajouter un cas", "",
    "1. Trouver un exemple **publié** qui imprime ses données et son résultat ; ouvrir la page et les relire.", "2. L'écrire dans `validation_cases.js` (ou `validation_fea.js` pour le solveur) : `source` (nom, endroit, adresse, niveau de lecture,", "   licence), `given` (ce que la source donne, tel qu'imprimé), `inputs` (les mêmes, dans les unités du modèle), `expect` (`value`,", "   `printed`, `tol`), et `free` pour ce que la source ne donne pas et qui ne change rien.", "3. Retirer le modèle de `NONE`, dire dans `GAPS` ce que le cas ne couvre pas.", "4. `node tools/validation_doc.mjs`, puis les tests.", "",
    "## Ce qui n'est pas fait", "",
    `- ${cov.missing.length} modèles n'ont aucun cas (voir plus haut) ; la plaque n'est recoupée que par ses coefficients.`, "- Aucun cas ne vient d'un **essai** : ce sont des exemples de manuels, résolus par leurs auteurs avec les mêmes théories.", "- Les sources sont des pages publiques ; les manuels cités par les modèles (Roark, Shigley, Incropera, White) n'ont pas été ouverts.", "- La simulation n'a que quatre cas, tous sur des barreaux : voir `docs/SIMULATION.md` pour ses recoupements internes.", "");
  return L.join("\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) { const file = new URL("../docs/VALIDATION.md", import.meta.url); writeFileSync(file, validationDoc()); console.log(`docs/VALIDATION.md écrit (${validationDoc().split("\n").length} lignes).`); }
