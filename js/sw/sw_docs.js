/* DynamiteOrbit.ai — Logiciel : the two documents a software leaves with (cycle en V, « 7 Livraison » ; point 25 de la suite convenue avec JP :
   « une spécification et un rapport d'essais en Word / PDF ; les exigences, les essais et la trace dans le paquet C »).
     the SPECIFICATION of the requirements — what the software must do : the reference chosen, every requirement with its kind, its proof and
       the tiles that carry it out, what the tool found in its sentence, what each tile says it does (the low-level requirements), the trace ;
     the REPORT of verification — what was shown : every test, its scenario, what was expected and what was found, the trace matrix, the
       coverage of the MODEL, what the reference asks of the code, the list of delivery.
   Both are the document model of core/docx.js and core/pdfdoc.js : the screen adds the identity of the project (docMeta) and the template
   of the documents (title block, title page, approvals). The same content, in plain ASCII, goes into the C package : doc/REQUIREMENTS.md and
   doc/VERIFICATION.md (vPackage).
   What these documents are NOT is said in each : the plan follows the usual practice of the trade, written from memory — no template of a
   standard was read, and they are not the life-cycle data a standard lists ; the tests ran on the model, not on the CPU ; the structural
   coverage of the C is not measured. Requirements and tests that are still examples are marked so on every line. Pure. */

import { FOOT_NOTE_ASCII } from "../core/brand.js";
import { KINDS } from "./sw_objects.js";
import { cFiles, LIB } from "./sw_c.js";
import { cpuOf } from "./sw_cpu.js";
import { REQ_KINDS, VERIFY, TRACE_STATES, reqsOf, liveReqs, reqQuality, designReqs, trace } from "./sw_req.js";
import { testsOf, runAll, modelCoverage, pinScales, pointsText } from "./sw_test.js";
import { STD_SOURCES, stdOf, levelOf, stdAsks } from "./sw_std.js";
import { releaseChecks, releaseReady } from "./sw_release.js";

const FILL = { verified: "ok", signed: "ok", failed: "error", untested: "warn", untraced: "warn", tosign: "muted", off: "muted" };
const day = (d) => (d instanceof Date && !Number.isNaN(d.getTime()) ? d : new Date(0)).toISOString().slice(0, 10);
const stdLine = (d) => { const S = stdOf(d), L = levelOf(d); return S ? `${S.name}${L ? `, ${S.levelWord} ${L.id}` : ` — ${S.levelWord} à choisir`}` : "aucune référence choisie"; };
/** The files of C that carry an object out. */
export function filesOf(obj) { const L = LIB[obj.kind]; return L ? [`lib/${L.mod}.c`, ...(L.cfg ? ["cfg/bms_cfg.c"] : []), "app/bms_app.c"] : ["io/bms_io.h", "hal/hal.h", "app/bms_app.c"]; }
const objName = (d, id) => { const o = ((d && d.objects) || []).find((x) => x.id === id); return o ? o.name : id; };
const verdict = (d, run, t) => { const r = run.results[t.id]; return !(t.expect || []).length ? ["n'attend rien", "warn"] : !r ? ["pas lancé", "muted"] : r.ok ? ["réussi", "ok"] : ["échoue", "error"]; };
const kv = (rows) => ({ type: "kv", rows });

/** What both documents share : who, what, against what. */
function intro(d, o, what) {
  const cpu = cpuOf(d), R = reqsOf(d), ex = liveReqs(d).filter((r) => r.sure === false).length, tex = testsOf(d).filter((t) => t.on !== false && t.sure === false).length;
  return [kv([["Logiciel", `${d.name || d.id}`], ["CPU", cpu.name], ["Période du pas", `${d.period || 10} ms`], ["Référence suivie", stdLine(d)], ["Exigences", `${liveReqs(d).length} à On, ${R.length} en tout`], ["Essais", `${testsOf(d).filter((t) => t.on !== false).length} à On`], ["Rédacteur", o.author || "—"], ["Date", day(o.date)]]),
    ...(ex || tex ? [{ type: "p", style: "warn", text: `${ex ? `${ex} exigence${ex > 1 ? "s" : ""}` : ""}${ex && tex ? " et " : ""}${tex ? `${tex} essai${tex > 1 ? "s" : ""}` : ""} ${ex + tex > 1 ? "sont des exemples proposés" : "est un exemple proposé"} par l'outil, pas encore ${ex + tex > 1 ? "confirmés" : "confirmé"} par le projet : ${what} n'est pas encore celui du projet.` }] : [])];
}
function reference(d) {
  const A = stdAsks(d), S = stdOf(d);
  return [{ type: "list", items: A.lines }, { type: "p", style: "muted", text: `${S ? "La norme elle-même, payante, n'a pas été lue : ce que l'outil en dit vient de pages publiques, résumées, " : "Ce que l'outil dit des références vient de pages publiques, résumées, "}chacune lue à la date dite — ${STD_SOURCES.map((s) => `${s.title}, ${s.read.replace(/^Lue /, "lue ")}, ${s.licence}`).join(" ; ")}.` }];
}

/** The specification of the requirements. o : { date, author } → the document model */
export function srsDoc(d, o = {}) {
  const run = runAll(d), T = trace(d, run.results), ST = Object.fromEntries(T.rows.map((x) => [x.req.id, x.state])), out = [{ type: "toc" }, { type: "pagebreak" }];
  let n = 0; const sec = (t) => out.push({ type: "h1", text: `${++n}. ${t}` });
  sec("Objet du document");
  out.push({ type: "p", text: `Ce document dit ce que le logiciel « ${d.name || d.id} » doit faire : une exigence par phrase, chacune avec son genre, la façon dont elle sera prouvée et les tuiles de la conception qui la réalisent. C'est la branche de gauche du cycle en V ; le rapport de vérification, son vis-à-vis, dit ce qui a été prouvé.` }, ...intro(d, o, "ce document"));
  sec("La référence suivie"); out.push(...reference(d));
  sec("Les exigences du logiciel");
  out.push({ type: "p", style: "muted", text: "Une ligne par exigence à On, rangées par genre. « Preuve » : un essai sur le modèle, une analyse ou une revue signées d'un nom. « État » : ce que la trace en dit au moment où ce document est écrit." });
  for (const [k, K] of Object.entries(REQ_KINDS)) { const L = liveReqs(d).filter((r) => r.kind === k); if (!L.length) continue;
    out.push({ type: "h2", text: `${K.fr} — ${K.label}` }, { type: "table", head: ["N°", "Exigence", "Preuve", "Tuiles qui la réalisent", "État"], widths: [11, 45, 10, 22, 12],
      rows: L.map((r) => [r.sure === false ? `${r.id} (exemple)` : r.id, r.text || "(vide)", VERIFY[r.verify].fr + (r.signed ? ` — signée par ${r.signed.by}` : ""), (r.objs || []).map((id) => objName(d, id)).join(", ") || "—", { text: TRACE_STATES[ST[r.id]][0], fill: FILL[ST[r.id]] }]) }); }
  if (!liveReqs(d).length) out.push({ type: "p", style: "warn", text: "Aucune exigence à On : le logiciel n'a encore rien à prouver." });
  const off = reqsOf(d).filter((r) => r.on === false); if (off.length) out.push({ type: "h2", text: "Mises de côté (Off)" }, { type: "table", head: ["N°", "Exigence"], widths: [12, 88], rows: off.map((r) => [r.id, r.text || "(vide)"]), caption: "Gardées, elles ne comptent pour rien : ni dans la trace, ni dans la livraison." });
  sec("Ce que l'outil a trouvé dans les phrases");
  const Q = liveReqs(d).flatMap((r) => reqQuality(r).map((q) => [r.id, q.text]));
  out.push(Q.length ? { type: "table", head: ["N°", "Remarque"], widths: [12, 88], rows: Q } : { type: "p", text: "Chaque phrase a son « doit », aucun mot vague, un nombre et son unité là où il en faut." },
    { type: "p", style: "muted", text: "Des règles de rédaction d'usage courant, écrites de mémoire : aucun guide de rédaction des exigences n'a été lu pour elles. Elles signalent, elles ne jugent pas : la relecture reste celle d'une personne." });
  sec("Les exigences de bas niveau — ce que fait chaque tuile");
  out.push({ type: "p", text: "Chaque tuile de la conception dit en une phrase ce qu'elle fait, tirée de ses valeurs : ce sont les exigences de bas niveau. Elles sont écrites au-dessus de chaque réglage, dans les fichiers C — en anglais, comme le code qui les porte." },
    { type: "table", head: ["Tuile", "Genre", "Ce qu'elle doit faire", "Fichiers C"], widths: [17, 14, 47, 22], rows: designReqs(d).map((x) => { const obj = d.objects.find((q) => q.id === x.obj); return [x.name, KINDS[x.kind].label, x.text, filesOf(obj).join(", ")]; }) });
  sec("La traçabilité");
  out.push({ type: "p", text: "Dans les deux sens : chaque exigence vers les tuiles qui la réalisent, les fichiers C qui les portent et les essais qui la prouvent ; chaque tuile vers l'exigence qui la demande." },
    { type: "table", head: ["Exigence", "Tuiles", "Fichiers C", "Essais"], widths: [12, 30, 34, 24], rows: T.rows.filter((x) => x.state !== "off").map((x) => [x.req.id, x.objs.map((id) => objName(d, id)).join(", ") || "—", [...new Set(x.objs.flatMap((id) => filesOf(d.objects.find((q) => q.id === id))))].join(", ") || "—", x.tests.join(", ") || "—"]) });
  if (T.orphans.length) out.push({ type: "p", style: "warn", text: `Tuiles qu'aucune exigence ne demande : ${T.orphans.map((id) => objName(d, id)).join(", ")} — une fonction que personne n'a demandée se justifie par une exigence, ou se retire.` });
  sec("Ce qui est vérifié, ce qui ne l'est pas");
  out.push({ type: "list", items: ["Vérifié par l'outil : la forme de chaque phrase, l'allocation de chaque exigence, la trace dans les deux sens, les tuiles qu'aucune exigence ne demande.", "Non vérifié par l'outil : que les exigences soient justes, complètes et suffisantes pour la sécurité du produit — c'est le travail de la revue, par une autre personne que l'auteur.", "Le plan de ce document suit l'usage du métier, écrit de mémoire : aucun gabarit d'une norme n'a été lu, et il ne tient pas lieu des données du cycle de vie qu'une norme demande.", "Aucune prétention de conformité ni de certification."] });
  return { title: `Spécification des exigences du logiciel — ${d.name || d.id}`, subtitle: "Software Requirements Specification", subject: "Spécification des exigences du logiciel", kind: "Spécification des exigences", author: o.author || "", date: o.date || new Date(0), reference: `${d.id}-SRS`, revision: d.revision || "A", header: `${d.id} — Spécification des exigences du logiciel`, footer: "DynamiteOrbit.ai", blocks: out };
}

/** The report of verification. o : { date, author, version } → the document model */
export function svrDoc(d, o = {}) {
  const run = runAll(d), cpu = cpuOf(d), T = trace(d, run.results), tests = testsOf(d).filter((t) => t.on !== false), C = modelCoverage(d, run.results), checks = releaseChecks(d, cpu, run), S = pinScales(d), out = [{ type: "toc" }, { type: "pagebreak" }];
  const byTest = T.rows.filter((x) => x.state !== "off" && x.req.verify === "test"), proven = byTest.filter((x) => x.state === "verified").length, signedRows = T.rows.filter((x) => x.state !== "off" && x.req.verify !== "test"), signed = signedRows.filter((x) => x.state === "signed").length;
  let n = 0; const sec = (t) => out.push({ type: "h1", text: `${++n}. ${t}` });
  sec("Objet du document");
  out.push({ type: "p", text: `Ce document dit ce qui a été prouvé du logiciel « ${d.name || d.id} » : chaque essai, son scénario, ce que l'on attendait et ce qui a été trouvé. C'est la branche de droite du cycle en V ; la spécification des exigences, son vis-à-vis, dit ce qui devait l'être.` }, ...intro(d, o, "ce rapport"),
    { type: "p", style: "muted", text: `Les essais ont tourné sur le MODÈLE, dans le navigateur, le ${day(o.date)}${o.version ? `, version ${o.version} de l'outil` : ""} : le même pas que le C écrit par l'outil (l'essai dos à dos, test/expected.txt du paquet, tient leur égalité). Ils n'ont tourné ni sur la carte ni sur le CPU.` });
  sec("Le bilan");
  out.push(kv([["Essais", `${run.passed} réussi${run.passed > 1 ? "s" : ""}, ${run.failed} échoué${run.failed > 1 ? "s" : ""}, ${run.empty} qui n'attend${run.empty > 1 ? "ent" : ""} rien — sur ${run.total}`], ["Exigences prouvées par essai", `${proven} sur ${byTest.length}`], ["Prouvées par analyse ou revue, signées", `${signed} sur ${signedRows.length}`], ["Couverture du modèle", `${C.full} sortie${C.full > 1 ? "s" : ""} 0 / 1 sur ${C.of} ont pris leurs deux valeurs`], ["Prêt à livrer", releaseReady(checks) ? "oui" : `non — ${checks.filter((c) => !c.ok).length} point${checks.filter((c) => !c.ok).length > 1 ? "s" : ""} de la liste de livraison`]]));
  sec("La matrice de traçabilité");
  out.push({ type: "table", head: ["Exigence", "Genre", "Preuve", "Essais qui la prouvent", "État"], widths: [13, 15, 12, 40, 20], rows: T.rows.filter((x) => x.state !== "off").map((x) => [x.req.sure === false ? `${x.req.id} (exemple)` : x.req.id, REQ_KINDS[x.req.kind].fr, VERIFY[x.req.verify].fr, x.tests.map((id) => { const r = run.results[id]; return `${id} ${r ? (r.ok ? "réussi" : "échoue") : "pas lancé"}`; }).join(", ") || "—", { text: TRACE_STATES[x.state][0], fill: FILL[x.state] }]) });
  sec("Les essais");
  if (!tests.length) out.push({ type: "p", style: "warn", text: "Aucun essai à On." });
  for (const t of tests) { const r = run.results[t.id], [v, fill] = verdict(d, run, t);
    out.push({ type: "h2", text: `${t.id} — ${t.name}` }, kv([["Prouve", (t.reqs || []).join(", ") || "aucune exigence"], ["Durée", `${t.steps} pas de ${d.period || 10} ms (${t.steps * (d.period || 10)} ms)`], ["Confirmé", t.sure === false ? "non — essai d'exemple proposé par l'outil" : "oui"], ["Verdict", v]]),
      { type: "table", head: ["Broche", "Unité", "Ce qu'elle lit — instant en ms : valeur"], widths: [30, 12, 58], rows: Object.entries(S).map(([id, sc]) => { const p = (t.pins || {})[id] || {}; return [sc.name, sc.unit, p.follows ? `suit ${p.follows}${p.delay ? ` avec ${p.delay} ms de retard` : ""}${p.stuck !== undefined ? `, coincée à ${p.stuck}` : ""}` : pointsText(p.points || [[0, 0]], sc)]; }), caption: "Le scénario : ce que le banc fait lire au logiciel, instant après instant." },
      (t.expect || []).length ? { type: "table", head: ["Ce que l'on attend", "Ce qui a été trouvé", "Verdict"], widths: [50, 35, 15], rows: r.checks.map((c) => [c.text, c.got, { text: c.ok ? "réussi" : "échoue", fill: c.ok ? "ok" : "error" }]) } : { type: "p", style: "warn", text: "Cet essai n'attend rien : il ne prouve rien." });
    if (fill === "error") out.push({ type: "p", style: "warn", text: `${t.id} échoue : l'exigence qu'il prouve n'est pas tenue par le modèle.` }); }
  sec("La couverture du modèle");
  const gaps = C.outs.filter((x) => !(x.seen0 && x.seen1));
  out.push({ type: "p", text: "Sur l'ensemble des essais : chaque sortie 0 / 1 d'une tuile a-t-elle pris ses deux valeurs ? Une sortie qui n'a jamais basculé est une décision que les essais n'ont pas exercée." },
    gaps.length ? { type: "table", head: ["Sortie", "A valu 0", "A valu 1"], widths: [60, 20, 20], rows: gaps.map((x) => [x.name, x.seen0 ? "oui" : { text: "jamais", fill: "warn" }, x.seen1 ? "oui" : { text: "jamais", fill: "warn" }]) } : { type: "p", text: "Chaque sortie 0 / 1 a pris ses deux valeurs." },
    { type: "p", style: "muted", text: "C'est une couverture du MODÈLE. La couverture structurelle qu'une norme demande — instructions, décisions, MC/DC — se mesure sur le C compilé pour la cible, avec un outil de couverture : elle n'est pas mesurée ici." });
  sec("Ce que la référence demande au code"); out.push(...reference(d));
  sec("La liste de livraison");
  out.push({ type: "table", head: ["Point", "État"], widths: [82, 18], rows: checks.map((c) => [c.text, { text: c.ok ? "tenu" : "à régler", fill: c.ok ? "ok" : "warn" }]), caption: "La liste de l'outil : elle ne remplace ni la revue de conception, ni l'autorité qui accepte un logiciel." });
  sec("Ce qui est vérifié, ce qui ne l'est pas");
  out.push({ type: "list", items: ["Vérifié : chaque essai à On a tourné sur le modèle au moment où ce rapport a été écrit ; ses attendus sont comparés à ce que le modèle a donné.", "Vérifié ailleurs, par les essais de l'outil : le C écrit par l'outil, compilé sur un ordinateur avec tous les avertissements en erreur, imprime caractère pour caractère ce que le modèle donne.", "Non vérifié : le logiciel sur la carte et sur le CPU (essai d'intégration, essai sur la cible) ; la couverture structurelle du C ; les temps d'exécution.", "Le plan de ce rapport suit l'usage du métier, écrit de mémoire : aucun gabarit d'une norme n'a été lu. Aucune prétention de conformité ni de certification."] });
  return { title: `Rapport de vérification du logiciel — ${d.name || d.id}`, subtitle: "Software Verification Report — essais sur le modèle", subject: "Rapport de vérification du logiciel", kind: "Rapport de vérification", author: o.author || "", date: o.date || new Date(0), reference: `${d.id}-SVR`, revision: d.revision || "A", header: `${d.id} — Rapport de vérification du logiciel`, footer: "DynamiteOrbit.ai", blocks: out, run };
}

/* ---------- the same, in the C package ---------- */
const plain = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[«»]/g, "\"").replace(/[^\n\x20-\x7e]/g, "-");
const cell = (s) => plain(s).replace(/\|/g, "/").replace(/\n/g, " ");
/** doc/REQUIREMENTS.md and doc/VERIFICATION.md : the requirements, their trace down to the files, and what the tests on the model showed. */
export function vDocFiles(d) {
  const run = runAll(d), T = trace(d, run.results), tests = testsOf(d).filter((t) => t.on !== false), C = modelCoverage(d, run.results), ex = liveReqs(d).filter((r) => r.sure === false).length, S = pinScales(d), name = d.name || d.id;
  const req = [`# ${name} - software requirements`, "", FOOT_NOTE_ASCII, "", stdOf(d) ? `Reference followed : ${stdLine(d)} (chosen by the project). What the tool says of it comes from public secondary pages ; the standard itself was not read.` : "Reference followed : none chosen yet - the project chooses RTCA DO-178C (DAL) or ISO 26262 (ASIL), step 2 of the V.",
    ...(ex ? ["", `**${ex} requirement(s) are EXAMPLES proposed by the tool, not confirmed by the project.**`] : []), "",
    "| Id | Kind | Requirement | Proven by | Objects | Files | Tests | State |", "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...T.rows.filter((x) => x.state !== "off").map((x) => `| ${x.req.id}${x.req.sure === false ? " (example)" : ""} | ${REQ_KINDS[x.req.kind].label} | ${cell(x.req.text || "(empty)")} | ${VERIFY[x.req.verify].label}${x.req.signed ? ` - signed by ${cell(x.req.signed.by)}` : ""} | ${x.objs.map((id) => cell(objName(d, id))).join(", ") || "-"} | ${[...new Set(x.objs.flatMap((id) => filesOf(d.objects.find((q) => q.id === id))))].join(", ") || "-"} | ${x.tests.join(", ") || "-"} | ${cell(TRACE_STATES[x.state][0])} |`),
    "", "The low-level requirements - what each object must do - are in doc/TRACE.md, and above each table of cfg/bms_cfg.c.",
    ...(T.orphans.length ? ["", `Objects no requirement asks for : ${T.orphans.map((id) => cell(objName(d, id))).join(", ")}.`] : []), ""].join("\n");
  const ver = [`# ${name} - verification on the model`, "", FOOT_NOTE_ASCII, "", "The tests below ran on the MODEL of the tool : the same step this C writes (back to back : test/bms_test.c must print test/expected.txt). They did NOT run on the board nor on the CPU.", "",
    `Tests : ${run.passed} passed, ${run.failed} failed, ${run.empty} expecting nothing - out of ${run.total}.`, "",
    "| Test | Name | Proves | Steps | Verdict |", "| --- | --- | --- | --- | --- |",
    ...tests.map((t) => { const r = run.results[t.id]; return `| ${t.id}${t.sure === false ? " (example)" : ""} | ${cell(t.name)} | ${(t.reqs || []).join(", ") || "-"} | ${t.steps} x ${d.period || 10} ms | ${!(t.expect || []).length ? "expects nothing" : r.ok ? "passed" : "FAILED"} |`; }),
    ...tests.flatMap((t) => { const r = run.results[t.id]; return ["", `## ${t.id} - ${cell(t.name)}`, "", "Scenario :", "", ...Object.entries(S).map(([id, sc]) => { const p = (t.pins || {})[id] || {}; return `- ${cell(sc.name)} (${sc.unit}) : ${p.follows ? `follows ${p.follows}${p.delay ? `, ${p.delay} ms late` : ""}${p.stuck !== undefined ? `, stuck at ${p.stuck}` : ""}` : cell(pointsText(p.points || [[0, 0]], sc))}`; }), "", "Expected :", "", ...(r.checks.length ? r.checks.map((c) => `- ${c.ok ? "ok    " : "FAILED"} ${cell(c.text)} - found : ${cell(c.got)}`) : ["- nothing : this test proves nothing"])]; }),
    "", "## Coverage of the model", "", `${C.full} of ${C.of} 0/1 outputs took both values.`, ...C.outs.filter((x) => !(x.seen0 && x.seen1)).map((x) => `- ${cell(x.name)} : never ${x.seen1 ? "0" : x.seen0 ? "1" : "0 nor 1"}`),
    "", "Not measured : the structural coverage of the C (statements, decisions, MC/DC), to be measured on the C compiled for the target, with a coverage tool. No claim of compliance nor of certification is made.", ""].join("\n");
  return [{ name: "bms/doc/REQUIREMENTS.md", text: plain(req) }, { name: "bms/doc/VERIFICATION.md", text: plain(ver) }];
}
/** The package : the C the tool writes, and the requirements and the verification beside it when the design has them. */
export function vPackage(d, cpu = cpuOf(d)) {
  const files = cFiles(d, { cpu }); if (!reqsOf(d).length && !testsOf(d).length) return files;
  const R = files.find((f) => f.name === "bms/README.md"); if (R) R.text += "- doc/REQUIREMENTS.md : the requirements, their trace to the objects, the files and the tests ; doc/VERIFICATION.md : what the tests on the model showed\n";
  return [...files, ...vDocFiles(d)];
}
