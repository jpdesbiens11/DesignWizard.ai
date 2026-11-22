/* DynamiteOrbit — Logiciel : the LIST OF DELIVERY (cycle en V, « 7 Livraison ») : what must hold before the package leaves — the reference
   and its level chosen, the CPU chosen, the requirements written, confirmed and allocated, no tile nobody asked for, every value confirmed,
   the design without error, every test passed and confirmed, every requirement proven — by a test, or signed when it is proven by an
   analysis or a review. Each line says where to go to settle it. It is the tool's own list : it does not replace the design review, nor the
   authority that accepts a software, and the screen says so. Pure. */

import { problems, unsure } from "./sw_design.js";
import { liveReqs, trace, reqQuality, REQ_KINDS, VERIFY, TRACE_STATES } from "./sw_req.js";
import { testsOf, runAll } from "./sw_test.js";
import { cpuOf } from "./sw_cpu.js";
import { stdOf, levelOf } from "./sw_std.js";

/** → [{ id, ok, text, step (the step of the V where it is settled), page? }] */
export function releaseChecks(d, cpu, run) {
  if (!d) return [{ id: "none", ok: false, text: "Le logiciel n'existe pas encore.", step: "design" }];
  const R = liveReqs(d), T = trace(d, run ? run.results : null), tests = testsOf(d).filter((t) => t.on !== false), errs = problems(d, cpu).filter((p) => p.level === "error"), U = unsure(d);
  const failed = tests.filter((t) => run && run.results[t.id] && !run.results[t.id].ok), toTest = T.rows.filter((x) => x.state !== "off" && x.req.verify === "test"), proven = toTest.filter((x) => x.state === "verified"), toSign = T.rows.filter((x) => x.state === "tosign");
  const S = stdOf(d), L = levelOf(d), say = (n, one, many) => `${n} ${n > 1 ? many : one}`;
  return [
    { id: "std", ok: !!(S && L), text: S && L ? `Référence : ${S.name}, ${S.levelWord} ${L.id}.` : "Choisir la référence de sécurité et le niveau.", step: "arch", page: "cpu" },
    { id: "cpu", ok: !!(cpu && cpu.key !== "generic"), text: cpu && cpu.key !== "generic" ? `CPU : ${cpu.name}.` : "Choisir un CPU dont la fiche a été lue.", step: "arch", page: "cpu" },
    { id: "reqs", ok: R.length > 0 && !R.some((r) => r.sure === false || reqQuality(r).some((q) => q.level !== "tip")), text: !R.length ? "Écrire les exigences." : `Exigences : ${say(R.length, "écrite", "écrites")}${R.some((r) => r.sure === false) ? ", des exemples à confirmer" : ""}${R.some((r) => reqQuality(r).some((q) => q.level !== "tip")) ? ", des phrases à reprendre" : ""}.`, step: "req" },
    { id: "alloc", ok: R.length > 0 && !T.rows.some((x) => x.state === "untraced") && !T.orphans.length, text: T.orphans.length ? `${say(T.orphans.length, "tuile qu'aucune exigence ne demande", "tuiles qu'aucune exigence ne demande")}.` : T.rows.some((x) => x.state === "untraced") ? "Des exigences ne sont allouées à aucune tuile." : "Chaque exigence a ses tuiles, chaque tuile son exigence.", step: "req" },
    { id: "design", ok: !errs.length && d.objects.length > 0, text: errs.length ? `${say(errs.length, "erreur", "erreurs")} dans la conception : ${errs[0].text}` : "La conception est sans erreur.", step: "design", page: "objects" },
    { id: "values", ok: !U.length, text: U.length ? `${say(U.length, "valeur d'exemple", "valeurs d'exemple")} à confirmer.` : "Toutes les valeurs sont confirmées.", step: "design", page: "values" },
    { id: "tests", ok: tests.length > 0 && !failed.length && !tests.some((t) => t.sure === false) && !tests.some((t) => !(t.expect || []).length), text: !tests.length ? "Écrire les essais." : failed.length ? `${say(failed.length, "essai échoue", "essais échouent")}.` : tests.some((t) => t.sure === false) ? "Des essais d'exemple à relire et confirmer." : `${say(tests.length, "essai réussi", "essais réussis")}.`, step: "verify" },
    { id: "proven", ok: toTest.length > 0 && proven.length === toTest.length, text: `${proven.length} sur ${toTest.length} exigences prouvées par essai.`, step: "verify" },
    { id: "signed", ok: !toSign.length, text: toSign.length ? `${say(toSign.length, "exigence prouvée par analyse ou revue attend", "exigences prouvées par analyse ou revue attendent")} sa signature.` : "Ce qui se prouve par analyse ou par revue est signé.", step: "req" },
  ];
}
export const releaseReady = (checks) => checks.every((c) => c.ok);

/** The software in the design-review file : per software, the reference, where the delivery stands, and each requirement with its proof.
    → [{ name, std, ready, left (lines not ok), rows: [[id, kind, text, proven by, tests, state]] }] */
export function swReport(project) {
  return ((project && project.software) || []).map((d) => {
    const cpu = cpuOf(d), run = runAll(d), C = releaseChecks(d, cpu, run), T = trace(d, run.results), S = stdOf(d), L = levelOf(d);
    return { name: d.name || d.id || "Logiciel", std: S ? `${S.name}${L ? ` ${S.levelWord} ${L.id}` : ""}` : "aucune référence choisie", ready: releaseReady(C), left: C.filter((c) => !c.ok).map((c) => c.text),
      rows: T.rows.map((x) => [x.req.id, REQ_KINDS[x.req.kind].fr, x.req.text, VERIFY[x.req.verify].fr, x.tests.join(", ") || "—", TRACE_STATES[x.state][0]]) };
  });
}
