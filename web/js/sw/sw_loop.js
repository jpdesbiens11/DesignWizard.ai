/* DynamiteOrbit.ai — Logiciel : THE AI LOOP (JP, 27 novembre 2026 : « export de toutes les données HIL + prompt → IA → nouvelle version du logiciel
   importée, qui rejoue tous les duty cycles pour voir si la mise à jour est bonne » ; « un genre de ML en design » ; choix par menu : « Boucle IA »).
   1. THE PACKAGE : the findings of the last campaign, the requirements the software must hold (statement, limits read by the machine), the
      software itself, and the instruction — correct what fails, touch neither the hardware interfaces nor the bench nor the missions.
   2. THE CANDIDATE : the answer read back — a whole software, same form. What the loop keeps frozen is put back from the current version
      (the pins on their nets, the module on the bench, the missions, the board) and said ; a value the answer changed is an EXAMPLE again.
   3. THE GATE : the whole campaign played again on the candidate, compared limit by limit and mission by mission. A cell that held and no
      longer holds is a REGRESSION ; one regression, or a software that does not run, and the version is refused. The tool calls no assistant :
      the package leaves as a file, the answer comes back pasted. Exploring may be fuzzy ; accepting is not. Pure. */

import { KINDS, cfgOf } from "./sw_objects.js";
import { problems } from "./sw_design.js";
import { cpuOf } from "./sw_cpu.js";
import { findingsCsv, findingsMd } from "./sw_campaign.js";
import { forDiscipline, keyOf } from "../core/reqs.js";
import { oraclesFor, oracleText, verdictWord } from "../core/req_oracle.js";
import { stampText } from "../core/brand.js";

/* what the loop never lets an answer change : the bench and the missions are the yardstick, the board is the hardware */
const FROZEN_KEYS = ["plant", "profiles", "profile", "board", "scenario", "id"];

/** What an assistant may see of a campaign : the HOLDOUT SET left out (sw/sw_req_missions.js — played at every campaign, never shown), each
    verdict read again on the missions it sees ; `held` : the limits that fail only on missions it does not see. */
export function visibleCampaign(C) {
  const hidden = new Set(C.profiles.filter((p) => p.origin === "reserve").map((p) => p.id)), profiles = C.profiles.filter((p) => !hidden.has(p.id)), RANK = { fail: 5, uncovered: 4, pass: 3, covered: 3, none: 1 };
  const rows = C.rows.map((r) => { const by = Object.fromEntries(Object.entries(r.by).filter(([k]) => !hidden.has(k))), v = Object.values(by);
    const overall = r.oracle && r.oracle.kind === "envelope" ? (v.includes("covered") ? "covered" : "uncovered") : v.reduce((a, b) => (RANK[b] > RANK[a] ? b : a), "none");
    return { ...r, by, overall, heldOut: r.overall === "fail" && overall !== "fail" }; });
  const counts = { fail: 0, pass: 0, none: 0, uncovered: 0, covered: 0 }; for (const r of rows) counts[r.overall]++;
  return { ...C, profiles, rows, counts, reserve: hidden.size };
}
/** The instruction for the assistant, with what failed. */
export function loopPrompt(project, d, C0) {
  const C = visibleCampaign(C0), R = project && project.reqs, mine = R ? forDiscipline(R, "sw").reqs : [], fails = C.rows.filter((r) => r.overall === "fail"), unc = C.rows.filter((r) => r.overall === "uncovered"), held = C.rows.filter((r) => r.heldOut);
  const pins = (d.objects || []).filter((o) => o.hw && o.hw.net).map((o) => `${o.id} (${o.name}) → ${o.hw.net} · ${o.hw.pin}`);
  return [
    "Tu es l'ingénieur de logiciel embarqué de DynamiteOrbit.ai. Le logiciel ci-joint (software.json) a été joué sur un banc HIL VIRTUEL : chaque mission profile, une ligne par seconde, jugée par les exigences du produit lues par la machine. Le constat est dans constat.md et constat.csv.",
    "", "TA TÂCHE — corrige le logiciel pour que les exigences ÉCHOUÉES tiennent, sans en faire échouer d'autres. Change des seuils, des délais, ajoute ou relie des objets des genres disponibles ; dis en tête, exigence par exigence, ce que tu changes et pourquoi.",
    "", "CE QUI NE CHANGE PAS — les broches et leurs nets (interfaces HW), le module sur le banc (plant), les missions (profiles), la carte (board) : l'outil les remet tels quels. Les exigences ne se changent pas ici : si une exigence te paraît fausse ou contradictoire, dis-le, ne la contourne pas. N'invente pas de genre d'objet.",
    "", `LES MISSIONS (${C.profiles.length} montrées) — écrites à partir des exigences : nominal, chaque limite approchée, franchie et tenue, puis revenue (un cell emulator tient un cell block à une tension), l'enveloppe, des corner cases, des pannes injectées. ${C.reserve ? `Un LOT DE RÉSERVE de ${C.reserve} missions tirées au hasard dans l'enveloppe est joué aussi, sans t'être montré : une version réglée sur les seules missions que tu vois y sera prise.` : ""}`,
    "", `CE QUI ÉCHOUE (${fails.length}) :`, ...fails.map((r) => `- ${r.key} — ${r.text} — échoue sur ${C.profiles.filter((p) => r.by[p.id] === "fail").map((p) => p.name).join(", ")} — « ${String(r.req.statement || "").slice(0, 300)} »`),
    ...(held.length ? ["", `ÉCHOUE AUSSI SUR LE LOT DE RÉSERVE (${held.length}) — tu ne vois pas ces missions ; corrige la cause, pas la mission :`, ...held.map((r) => `- ${r.key} — ${r.text}`)] : []),
    ...(unc.length ? ["", `ENVELOPPE NON COUVERTE (${unc.length}) — les missions ne l'atteignent pas ; ce n'est pas au logiciel de la couvrir :`, ...unc.map((r) => `- ${r.key} — ${r.text}`)] : []),
    "", `LES EXIGENCES DU LOGICIEL (${mine.length}) : voir requirements.md.`, "", `LES INTERFACES HW (gelées, ${pins.length}) :`, ...pins.map((x) => `- ${x}`),
    "", `GENRES DISPONIBLES — ${Object.entries(KINDS).map(([k, K]) => `${k} (entrées ${K.ports.in.map((p) => p.key).join(", ") || "—"} ; sorties ${K.ports.out.map((p) => p.key).join(", ") || "—"} ; paramètres ${K.params.map((p) => p.key).join(", ") || "—"})`).join(" ; ")}.`,
    "", "RÉPONSE ATTENDUE — tes explications, puis UN SEUL bloc ```json avec le logiciel ENTIER, même forme que software.json. Toute valeur que tu changes reste un exemple : ne l'inscris pas dans « sure ».",
  ].join("\n");
}
/** The requirements of the software, for the assistant : statement and the limits the machine reads. */
export function requirementsMd(project) {
  const R = project && project.reqs, mine = R ? forDiscipline(R, "sw").reqs : [];
  return stampText("requirements.md", `${["# Exigences du logiciel", "", ...mine.map((r) => { const O = oraclesFor(R, r); return `- **${keyOf(r)}** — ${r.statement || r.title || ""}${O.list.length ? `\n  - lu par la machine${O.sure ? "" : " (à confirmer)"} : ${O.list.map(oracleText).join(" ; ")}` : ""}`; })].join("\n")}\n`);
}
/** The package : files for a .zip. → [{ name, bytes }] */
export function loopFiles(project, d, C) {
  const V = visibleCampaign(C);      // the holdout set never leaves
  return [{ name: "PROMPT.md", bytes: stampText("PROMPT.md", `${loopPrompt(project, d, C)}\n`) }, { name: "constat.md", bytes: findingsMd(V) }, { name: "constat.csv", bytes: findingsCsv(V) },
    { name: "requirements.md", bytes: requirementsMd(project) }, { name: "software.json", bytes: `${JSON.stringify(d, null, 1)}\n` }];
}

/** An answer read back : the software it carries, made a candidate. → { ok, doc, errors: [text], kept: [text], lines: [text] } */
export function readCandidate(text, d) {
  const out = { ok: false, doc: null, errors: [], kept: [], lines: [] };
  let doc; try { const m = String(text || "").match(/```json\s*([\s\S]*?)```/); doc = JSON.parse(m ? m[1] : text); } catch (e) { out.errors.push("La réponse ne contient pas de JSON lisible (un bloc ```json)."); return out; }
  if (!doc || !Array.isArray(doc.objects) || !Array.isArray(doc.wires)) { out.errors.push("La réponse ne contient pas un logiciel : il manque « objects » ou « wires »."); return out; }
  const bad = doc.objects.filter((o) => !KINDS[o.kind]); if (bad.length) out.errors.push(`Genres inconnus : ${bad.map((o) => `${o.id} (${o.kind})`).join(", ")}.`);
  /* frozen : the bench, the missions, the board, put back ; a pin on its net, put back */
  for (const k of FROZEN_KEYS) { if (JSON.stringify(doc[k]) !== JSON.stringify(d[k]) && doc[k] !== undefined) out.kept.push(`« ${k} » remis tel quel : le banc, les missions et la carte ne changent pas dans la boucle.`); if (d[k] === undefined) delete doc[k]; else doc[k] = JSON.parse(JSON.stringify(d[k])); }
  const was = new Map((d.objects || []).map((o) => [o.id, o]));
  for (const o of d.objects || []) { if (!o.hw && !o.bench) continue; const n = doc.objects.find((x) => x.id === o.id);
    if (!n) { doc.objects.push(JSON.parse(JSON.stringify(o))); out.kept.push(`${o.id} remis : une interface HW ne se retire pas.`); continue; }
    if (JSON.stringify(n.hw) !== JSON.stringify(o.hw) || n.kind !== o.kind || (o.bench && n.bench !== o.bench)) { Object.assign(n, { kind: o.kind, hw: o.hw, bench: o.bench, params: { ...(n.params || {}), ...(o.kind === n.kind ? {} : o.params) } }); if (!o.hw) delete n.hw; if (!o.bench) delete n.bench; out.kept.push(`${o.id} : sa broche et son net remis (interface HW gelée).`); } }
  /* a value the answer changed or brought is an example again */
  doc.objects = doc.objects.map((o) => { const p = was.get(o.id), c0 = p && KINDS[p.kind] ? cfgOf(p) : {}, c1 = KINDS[o.kind] ? cfgOf(o) : {}; return { ...o, sure: (p ? p.sure || [] : []).filter((k) => c0[k] === c1[k]) }; });
  for (const o of doc.objects) { const p = was.get(o.id); if (!p) out.lines.push(`+ ${o.name || o.id} (${KINDS[o.kind] ? KINDS[o.kind].label : o.kind}) — ajouté`);
    else { const c0 = cfgOf(p), c1 = KINDS[o.kind] ? cfgOf(o) : {}, ch = Object.keys({ ...c0, ...c1 }).filter((k) => c0[k] !== c1[k]); if (ch.length) out.lines.push(`~ ${o.name || o.id} : ${ch.map((k) => `${k} ${c0[k]} → ${c1[k]}`).join(", ")}`); } }
  for (const o of d.objects || []) if (!doc.objects.some((x) => x.id === o.id)) out.lines.push(`− ${o.name || o.id} — retiré`);
  const wa = new Set((d.wires || []).map((w) => `${w.from}>${w.to}`)), wb = new Set(doc.wires.map((w) => `${w.from}>${w.to}`));
  for (const w of wb) if (!wa.has(w)) out.lines.push(`+ fil ${w.replace(">", " → ")}`); for (const w of wa) if (!wb.has(w)) out.lines.push(`− fil ${w.replace(">", " → ")}`);
  if (!out.errors.length) { const P = problems(doc, cpuOf(doc)).filter((p) => p.level === "error"); for (const p of P) out.errors.push(`Ne tourne pas : ${p.text}`); }
  out.doc = doc; out.ok = !out.errors.length; if (out.ok && !out.lines.length) { out.ok = false; out.errors.push("Aucun changement : c'est la version actuelle."); }
  return out;
}

const GOOD = new Set(["pass", "covered"]), BAD = new Set(["fail", "uncovered"]);
/** Two campaigns compared, limit by limit, mission by mission. A cell that held and no longer holds is a regression.
    → { rows: [{ key, n, text, was, now, change, cells: [{ profile, was, now, regressed }] }], fixed, regressed, same, accept } */
export function compareCampaigns(before, after) {
  const key = (r) => `${r.key}#${r.n}`, B = new Map(before.rows.map((r) => [key(r), r])), rows = [], both = new Set(before.profiles.map((p) => p.id));
  for (const a of after.rows) { const b = B.get(key(a)) || null;
    /* a mission the first campaign did not play is no regression */
    const cells = after.profiles.filter((p) => both.has(p.id)).map((p) => { const was = b ? b.by[p.id] || "none" : "none", now = a.by[p.id] || "none"; return { profile: p.name, was, now, regressed: (GOOD.has(was) && BAD.has(now)) || (was === "none" && now === "fail") }; });
    const was = b ? b.overall : "none", now = a.overall, regressed = cells.some((c) => c.regressed || (c.was === "covered" && c.now !== "covered")), fixed = !regressed && ((was === "fail" && !BAD.has(now)) || (was === "uncovered" && now === "covered"));
    rows.push({ key: a.key, n: a.n, text: a.text, was, now, cells, change: regressed ? "regressed" : fixed ? "fixed" : was === now ? "same" : "moved" }); }
  const n = (c) => rows.filter((r) => r.change === c).length;
  return { rows, fixed: n("fixed"), regressed: n("regressed"), same: n("same"), moved: n("moved"), accept: n("regressed") === 0 };
}
/** The comparison as Markdown, marked : what a reviewer keeps of one turn of the loop. */
export function compareMd(cmp, title = "Boucle IA — comparaison des campagnes") {
  const W = { regressed: "RÉGRESSION", fixed: "corrigée", same: "inchangée", moved: "a bougé" };
  return stampText("comparaison.md", `${[`# ${title}`, "", `${cmp.fixed} corrigée(s) · ${cmp.regressed} régression(s) · ${cmp.same} inchangée(s) — ${cmp.accept ? "ACCEPTABLE : aucune régression" : "REFUSÉE : au moins une régression"} · banc VIRTUEL.`, "",
    "| Exigence | Limite | Avant | Après | |", "|---|---|---|---|---|", ...cmp.rows.map((r) => `| ${r.key} | ${r.text} | ${verdictWord(r.was)} | ${verdictWord(r.now)} | ${W[r.change]} |`)].join("\n")}\n`);
}
