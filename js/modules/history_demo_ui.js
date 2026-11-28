/* DynamiteOrbit.ai — Historique : « La démonstration a avancé » (JP, 28 novembre 2026, his « BM 8s8p - 21700 » stopped at P8 : « où est le
   concept 5 ? » ; by menu : « Proposer, aperçu d'abord »). When the project is a copy of a demonstration that has gained points since, they are
   offered — when the copy is opened from its card on the home page, and at the head of the history — with their preview : what comes, which
   point of the copy they hang from, and that nothing of the person's work moves. « Ajouter » puts them in the history ; « Ajouter et aller à
   P… » then goes to the newest of them, a return like any other (what no point keeps is first kept by a point « Avant le retour »).
   What it follows : fetching a remote's new commits in a version-control client, then checking one out when one chooses. The rules :
   core/history_demo.js ; the demonstrations : demo/demo_seeds.js. Also the return to a point, shared with modules/history.js. */

import { el, btn, toast, modal } from "../core/dom.js";
import { store } from "../core/store.js";
import { historyOf, pointOf, addPoint, restoreInto, sinceThen, changeCount, contextOf } from "../core/history.js";
import { demoPlan, addDemoPoints, demoLine } from "../core/history_demo.js";
import { seedOf, seedHistory } from "../demo/demo_seeds.js";

const tag = (b, data) => { Object.assign(b.dataset, data); return b; };      // a button marked for the tests and the news
const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;
const when = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? String(iso || "") : d.toLocaleString("fr-CA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); };
const pendingNow = () => { const p = store.project, h = historyOf(p), head = pointOf(h, h.head); return head ? changeCount(sinceThen(p, head.id)) : 0; };

/** Go back to a point, without asking : what no point keeps is kept first by a point « Avant le retour » ; then ONE undoable step. */
export function returnTo(id) {
  const pt = pointOf(historyOf(store.project), id); if (!pt) return null;
  if (pendingNow()) store.writeHistory("Point avant le retour", (x) => addPoint(x, { kind: "before", label: `Avant le retour à ${pt.id}`, context: contextOf(x) }));
  const changed = store.commit(`Retour au point ${pt.id} — ${pt.label}`, (x) => { restoreInto(x, id); });
  if (!changed) store.writeHistory("Vous êtes ici", (x) => { historyOf(x).head = id; });
  return pt;
}

/** What the demonstration the open project is a copy of has more. seed : its history, when one already has it (the home page) ; else it is
    rebuilt (once per visit). → { seed, plan, name } | null */
export function demoNews(project = store.project, seed = null) {
  const s = seedOf(project); if (!project || !s) return null;
  let H = seed; if (!H) { try { H = seedHistory(s); } catch (e) { return null; } }
  if (!H || !(H.points || []).length) return null;
  const plan = demoPlan(historyOf(project), H);
  return plan.none || plan.nothing ? null : { seed: H, plan, name: s.name };
}

/** The preview, then the points added — and, at the person's choice, the return to the newest of them. o : { onDone(points, went) }
    → a promise of { added, went } (nothing added : added = []) */
export function offerDemo(news, o = {}) {
  return new Promise((resolve) => {
    let out = { added: [], went: false }, applying = false;
    const p = store.project, h = historyOf(p), { plan, seed } = news, F = plan.fresh, tip = F.slice().sort((a, b) => b.n - a.n)[0], pending = pendingNow(), head = pointOf(h, h.head);
    const branches = [...new Set(F.map((f) => f.branch))], hue = ["#7c3aed", "#0891b2", "#dc2626", "#2563eb"];
    const apply = (go) => {
      applying = true; m.close();
      let pts = []; store.writeHistory("Points de la démonstration ajoutés", (x) => { const real = demoPlan(historyOf(x), seed); pts = addDemoPoints(x, seed, real); });
      const last = pts.slice().sort((a, b) => b.n - a.n)[0];
      if (go && last) returnTo(last.id);
      out = { added: pts, went: !!(go && last) };
      toast(pts.length ? `${plural(pts.length, "point ajouté", "points ajoutés")} à l'historique (${pts.map((x) => x.id).join(", ")})${out.went ? ` ; vous êtes à ${last.id}${pending ? ` — vos changements sont gardés par un point « Avant le retour »` : ""}` : " ; « vous êtes ici » n'a pas bougé"}.` : "Rien à ajouter : l'historique a déjà ces points.", "success", 8000);
      if (o.onDone) o.onDone(pts, out.went);
      resolve(out);
    };
    const anchors = plan.anchors.map((a) => el("p", { class: "small", "data-demo-anchor": a.mine }, F.some((f) => f.parent === a.mine && f.onto === "ancestor") ? "Le point de la démonstration d'où ils partent n'est plus dans votre copie : ils s'attachent au plus proche, " : "Ils s'attachent à ",
      el("b", null, `votre ${a.mine}`), ` « ${a.label} » : le même point de la démonstration (même date, même auteur)${a.drift ? ` ; son contenu a évolué avec l'outil depuis votre copie — votre ${a.mine} reste tel quel` : ""}.`));
    if (F.some((f) => f.onto === "root")) anchors.push(el("p", { class: "small warn" }, `Aucun point d'où ils partent n'est dans votre copie : ils s'attachent à votre premier point — à vérifier.`));
    const m = modal(`La démonstration a avancé : ${plural(F.length, "point nouveau", "points nouveaux")}`, [
      el("p", null, `Votre « ${p.name} » a ${plural(plan.present, "point", "points")} de la démonstration, jusqu'à ${plan.last}. Elle en a, depuis, sur ${branches.length > 1 ? "les branches" : "la branche"} `,
        ...branches.flatMap((b, i) => [i ? ", " : "", el("b", { style: `color:${hue[i % hue.length]}` }, b)]), " :"),
      el("ul", { class: "hist-demo-list", "data-demo-points": "" }, F.map((f) => el("li", { style: `--lane:${hue[branches.indexOf(f.branch) % hue.length]}` }, el("b", null, f.id), f.label,
        el("small", null, `${when(f.at)}${f.by ? ` · ${f.by}` : ""}${f.onto !== "fresh" ? ` · part de ${f.parent}` : ""}`)))),
      ...anchors,
      el("div", { class: "hist-demo-keep" }, `✓ Rien de votre travail ne bouge : vos ${plural((h.points || []).length, "point", "points")}, « vous êtes ici » (${head ? head.id : "—"}) et ${pending ? plural(pending, "changement qu'aucun point ne garde", "changements qu'aucun point ne garde") : "le produit"} restent tels quels.`,
        el("small", null, "Un ajout à l'historique, pas au produit ; Ctrl + Z n'y touche pas.")),
      el("div", { class: "form-actions" }, btn("Plus tard", () => m.close()),
        tag(btn(`Ajouter ${F.length > 1 ? `les ${F.length} points` : "le point"}`, () => apply(false), { icon: "plus", tip: "Dans l'historique, à côté de votre travail ; vous restez où vous êtes" }), { demoAdd: "" }),
        tag(btn(`Ajouter et aller à ${tip.id}`, () => apply(true), { primary: true, icon: "branch", tip: `Le produit devient celui de ${tip.id} — un retour, annulable par Ctrl + Z${pending ? ` ; vos ${pending} changements sont d'abord gardés par un point « Avant le retour »` : ""}` }), { demoGo: "" })),
    ], { wide: true, onClose: () => { if (!applying) resolve(out); } });
  });
}
/** The section at the head of the history : what the demonstration has more, and the button that opens the preview. → a node, or null */
export function demoSection(news, o = {}) {
  if (!news) return null;
  const b = btn("Voir et ajouter…", () => offerDemo(news, o), { primary: true, small: true, icon: "branch", tip: "L'aperçu d'abord : ce qui vient, d'où cela part, et que rien de votre travail ne bouge" });
  tag(b, { demoOpen: "" });
  return el("div", { class: "side-section hist-demo", "data-fold-note": `${news.plan.fresh.length} nouveau${news.plan.fresh.length > 1 ? "x" : ""}`, "data-history-demo": "" }, el("h3", null, "La démonstration a avancé"),
    el("p", { class: "small" }, `${demoLine(news.plan)}. Votre copie s'arrête à ${news.plan.last} ; rien de votre travail ne bougera.`), el("div", { class: "form-actions" }, b));
}
