/* DesignOrbit.ai — Historique : the restore points of the product and the tree of their branches (point 9 of the plan agreed with JP : « ces
   itérations sont la colonne vertébrale » ; choices clicked on 20 November : a point keeps the complete definition, heavy files stored once,
   the points and the tree first, the package for an AI next). Route : #/history[/<point>].
   The same three places as every studio. Left, what one does and where one is : pose a point (a name, a note one may dictate), what changed
   since the point « vous êtes ici », the branches — set one aside or take it up again —, what the history weighs, the guide. Centre, what one
   looks at : the tree (modules/history_tree.js). Right, the point chosen : when, why, its own journal, the MVP iteration and the revisions of
   that moment, what differs from now or from another point ; go back to it, or take it away as a .dwiz that stands alone.
   Going back is ONE undoable step (Ctrl + Z) ; before it, what is kept by no point is kept by an automatic point « Avant le retour ». The
   history itself is not undone. « Nouvelle branche ici » (JP, 22 novembre : « je ne vois pas le bouton pour commencer une branche
   parallèle ») opens a named branch at any point, as a version-control client creates a branch at a commit : on the point chosen (a return
   first when it is not « ici »), a first point « Départ de … » in the new branch. Every rule is in core/history.js and core/history_branches.js. */

import { el, clear, btn, toast, download, confirmBox, field, modal } from "../core/dom.js";
import { store } from "../core/store.js";
import { registerModule, setGuide } from "../core/app.js";
import { guideBox } from "../core/guide.js";
import { toDwiz } from "../core/dwiz.js";
import { historyOf, pointOf, addPoint, restoreInto, sinceThen, diffTrees, changeCount, setDropped, weight, pointProject, contextOf, historyGuide, POINT_KINDS, ART_KINDS, MAIN, deletePlan, deletePoint, nextBranch, branchNames } from "../core/history.js";
import { freeName, startBranch, branchSuggestion, mergePlan } from "../core/history_branches.js";
import { branchSection, branchGuide, openMerge } from "./history_branches_ui.js";
import { historyTree } from "./history_tree.js";

const VERB = { added: ["ajouté", "#16a34a"], removed: ["retiré", "#dc2626"], changed: ["modifié", "#b45309"] };
const kb = (n) => (n < 1024 ? `${n} o` : n < 1048576 ? `${(n / 1024).toFixed(n < 10240 ? 1 : 0).replace(".", ",")} ko` : `${(n / 1048576).toFixed(1).replace(".", ",")} Mo`);
const when = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? String(iso || "") : d.toLocaleString("fr-CA", { dateStyle: "medium", timeStyle: "short" }); };
const tagged = (b, data) => { Object.assign(b.dataset, data); return b; };      // a button marked for the tests and the news
const fileName = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80) || "point";

/** What changed, grouped by what it is : a colour per kind of artefact, the verb in its colour. */
export function changeList(d, max = 14) {
  const rows = [...d.added.map((x) => ["added", x]), ...d.removed.map((x) => ["removed", x]), ...d.changed.map((x) => ["changed", x])]
    .sort((a, b) => Object.keys(ART_KINDS).indexOf(a[1].kind) - Object.keys(ART_KINDS).indexOf(b[1].kind) || a[1].id.localeCompare(b[1].id));
  if (!rows.length) return el("p", { class: "muted small" }, "Rien n'a changé.");
  return el("ul", { class: "hist-changes" }, rows.slice(0, max).map(([v, x]) => el("li", { style: `--dom:${ART_KINDS[x.kind].color}` }, el("span", { class: "hist-kind" }, ART_KINDS[x.kind].fr),
    el("b", null, x.kind === "other" ? x.name : x.id), x.kind !== "other" && x.name ? ` ${x.name}` : "", el("span", { class: "hist-verb", style: `color:${VERB[v][1]}` }, ` — ${VERB[v][0]}`))),
  rows.length > max ? el("li", { class: "muted" }, `… et ${rows.length - max} autre${rows.length - max > 1 ? "s" : ""}`) : null);
}

function render(main, args) {
  clear(main);
  const left = el("aside", { class: "side" }), view = el("div", { class: "viewport hist-view" }), right = el("aside", { class: "side right" });
  main.append(el("div", { class: "studio" }, left, view, right));
  const host = el("div", { class: "hist-host" }), empty = el("div", { class: "hist-empty" }); view.append(host, empty);
  const st = { sel: args[0] || null, cmp: "now", name: "", note: "", branch: "" };
  const tree = historyTree(host, { onPick: (id) => { st.sel = id; st.cmp = "now"; mark(); draw(); } });
  const mark = () => { try { history.replaceState(null, "", `#/history${st.sel ? `/${encodeURIComponent(st.sel)}` : ""}`); } catch (e) { /* a page without history */ } };

  function pose() {
    const p = store.project, n = (historyOf(p).points || []).length + 1;
    let r = null; store.writeHistory("Point de restauration posé", (x) => { const h = historyOf(x), next = nextBranch(h), fresh = next !== MAIN && ![...branchNames(h).values()].includes(next);
      r = addPoint(x, { kind: "manual", label: st.name.trim() || `Point ${n}`, note: st.note.trim(), by: (x.team && x.team.owner) || "", context: contextOf(x), branch: fresh ? freeName(h, st.branch.trim() || next) : next }); });
    st.name = ""; st.note = ""; st.branch = ""; st.sel = r.point.id; mark(); draw();
    toast(r.same ? `${r.point.id} posé — rien n'avait changé depuis le point d'avant : il garde le même produit, sous un autre nom.` : `${r.point.id} posé : la définition complète du produit est gardée, chaque artéfact rangé une seule fois.`, "success", 6000);
  }
  const pendingNow = () => { const p = store.project, h = historyOf(p), head = pointOf(h, h.head); return head ? changeCount(sinceThen(p, head.id)) : 0; };
  /** The return itself, without asking : what no point keeps is kept first by a point « Avant le retour » ; then ONE undoable step. */
  function restoreTo(id) {
    const pt = pointOf(historyOf(store.project), id);
    if (pendingNow()) store.writeHistory("Point avant le retour", (x) => addPoint(x, { kind: "before", label: `Avant le retour à ${pt.id}`, context: contextOf(x) }));
    const changed = store.commit(`Retour au point ${pt.id} — ${pt.label}`, (x) => { restoreInto(x, id); });
    if (!changed) store.writeHistory("Vous êtes ici", (x) => { historyOf(x).head = id; });
  }
  async function goBack(id) {
    const pt = pointOf(historyOf(store.project), id), pending = pendingNow();
    const ok = await confirmBox(`Revenir au point ${pt.id}`, `Le produit redevient celui du point « ${pt.label} » (${when(pt.at)}) : pièces, assemblages, cartes et registres.${pending ? ` Les ${pending} changement${pending > 1 ? "s" : ""} qu'aucun point ne garde encore seront d'abord gardés par un point automatique « Avant le retour ».` : ""} Ce que vous ferez ensuite ouvrira une branche. Le retour est une étape annulable (Ctrl + Z).`, "Revenir à ce point");
    if (!ok) return;
    restoreTo(id); st.sel = id; draw(); toast(`Vous êtes au point ${pt.id}. Le prochain point posé partira d'ici.`, "success", 6000);
  }
  /** « Nouvelle branche ici » : a name, then the branch opens at the point — its first point « Départ de … » is in the tree at once. */
  function openFork(id) {
    const p = store.project, h = historyOf(p), pt = pointOf(h, id || h.head); if (!pt) return;
    const here = pt.id === h.head, pending = pendingNow(), sug = branchSuggestion(h), from = branchNames(h).get(pt.id);
    const name = el("input", { type: "text", placeholder: sug, maxlength: "40", "data-history-fork-name": "", onKeydown: (e) => { if (e.key === "Enter") { e.preventDefault(); go(); } } });
    const go = () => {
      m.close(); if (!here) restoreTo(pt.id);
      let q = null; store.writeHistory("Nouvelle branche", (x) => { q = startBranch(x, name.value.trim() || sug, { by: (x.team && x.team.owner) || "", context: contextOf(x) }); });
      if (!q) return; st.sel = q.id; mark(); draw(); requestAnimationFrame(() => tree.focus(q.id));
      toast(`Branche « ${q.branch} » ouverte (${q.id}), à côté de ${from === MAIN ? "MAIN" : `« ${from} »`}, qui ne bouge pas. Les points suivants iront dans « ${q.branch} » ; « Les branches » passe de l'une à l'autre et la fusionne dans MAIN.`, "success", 9000);
    };
    const m = modal(`Nouvelle branche à partir de ${pt.id}`, [
      el("p", { class: "small" }, `La branche part de ${pt.id} — « ${pt.label} », sur ${from === MAIN ? "MAIN" : `« ${from} »`}. Son premier point, « Départ de … », se pose tout de suite : la branche se voit dans l'arbre, à côté. Ce que vous ferez ensuite ira dans la branche ; ${from === MAIN ? "MAIN" : `« ${from} »`} reste tel qu'il est.`),
      here ? (pending ? el("p", { class: "small" }, `Les ${pending} changement${pending > 1 ? "s" : ""} faits depuis ${pt.id}, qu'aucun point ne garde encore, partent avec la branche.`) : null)
        : el("p", { class: "small" }, `Vous êtes à ${h.head}. Le produit redevient d'abord celui de ${pt.id} — un retour, annulable par Ctrl + Z${pending ? ` ; les ${pending} changement${pending > 1 ? "s" : ""} qu'aucun point ne garde sont d'abord gardés par un point « Avant le retour »` : ""}.`),
      field("Nom de la branche", name, "Par exemple : couvercle embouti, piste de Sam, essai alu"),
      el("p", { class: "muted small" }, "Pour passer d'une branche à l'autre : « Revenir à MAIN », « Travailler sur cette branche » (section « Les branches »). Quand elle est prête : « Fusionner dans MAIN »."),
      el("div", { class: "form-actions" }, btn("Annuler", () => m.close()), tagged(btn("Ouvrir la branche", go, { primary: true, icon: "branch" }), { historyForkGo: "" })),
    ]);
    requestAnimationFrame(() => name.focus());
  }
  function takeAway(id) {
    const p = store.project, doc = pointProject(p, id), pt = pointOf(historyOf(p), id);
    download(`${fileName(`${p.name || p.id}_${pt.id}_${pt.label}`)}.dwiz`, toDwiz(doc), "text/plain;charset=utf-8");
    toast(`${pt.id} téléchargé : un projet complet, qui s'ouvre seul (menu Projet › Importer).`, "success", 5000);
  }
  /** « Effacer ce point » (JP, 22 novembre : « effacer ces points de sauvegarde individuellement… les autres se réattachent, ou si un seul
      concept sur la branche, elle meurt et on revient par défaut au MAIN ») : what it does is said first ; the deletion itself is not undoable. */
  async function erase(id) {
    const h = historyOf(store.project), plan = deletePlan(h, id); if (!plan.ok) { toast(plan.why, "warn", 5000); return; }
    const pt = plan.point, kids = plan.children, lines = [
      kids.length ? `${kids.length > 1 ? `Les points ${kids.join(", ")} se rattachent` : `Le point ${kids[0]} se rattache`} à ${plan.parent || "la racine de l'arbre"}.` : "Aucun point ne part de lui.",
      plan.dies ? `La branche « ${plan.branch} » n'a que ce point : elle disparaît.` : `La branche « ${plan.branch} » garde ses autres points.`,
      plan.here && plan.back ? (plan.back.restore ? `Vous y êtes : le produit revient au dernier point de MAIN, ${plan.back.id} « ${plan.back.label} » (Ctrl + Z ramène le produit, pas le point).` : `Vous y êtes : « vous êtes ici » remonte à ${plan.back.id} ; le produit ne change pas.`) : "Le produit ne change pas.",
      `${plan.freed.length ? `${plan.freed.length} artéfact${plan.freed.length > 1 ? "s" : ""} que seul ce point gardait ${plan.freed.length > 1 ? "sont libérés" : "est libéré"}.` : "Les autres points gardent tout ce qu'il gardait."} Un point effacé ne revient pas : emportez-le d'abord en .dwiz si vous voulez le garder.`];
    const ok = await confirmBox(`Effacer le point ${pt.id} — ${pt.label}`, lines.join(" "), "Effacer le point", true); if (!ok) return;
    if (plan.here && plan.back && plan.back.restore) { if (!store.commit(`Point ${pt.id} effacé — retour à MAIN (${plan.back.id})`, (x) => { deletePoint(x, id); })) store.writeHistory(`Point ${pt.id} effacé`, () => null); }      // the product did not change : the history is saved all the same
    else store.writeHistory(`Point ${pt.id} effacé`, (x) => deletePoint(x, id));
    st.sel = kids[0] || plan.parent || (plan.back && plan.back.id) || null; mark(); draw();
    toast(`${pt.id} effacé${plan.dies ? ` ; la branche « ${plan.branch} » a disparu` : ""}${plan.here && plan.back && plan.back.restore ? ` ; retour à MAIN (${plan.back.id})` : ""}.`, "success", 6000);
  }
  const drop = (tip, on) => { store.writeHistory(on ? "Branche abandonnée" : "Branche reprise", (x) => setDropped(x, tip, on)); draw(); };

  /** Where the next point goes : the branch it continues, or the name of the branch it opens. */
  function whereNext(h) {
    const next = nextBranch(h), fresh = next !== MAIN && ![...branchNames(h).values()].includes(next);
    if (!fresh) return el("p", { class: "small", "data-history-next": next }, "Ce point ira dans ", el("b", null, next === MAIN ? "MAIN" : `« ${next} »`), next === MAIN ? ", la branche principale." : ".");
    const input = el("input", { type: "text", value: st.branch, placeholder: next, maxlength: "40", "data-history-newbranch": "", onInput: (e) => { st.branch = e.target.value; } });
    return el("div", null, el("p", { class: "small" }, "Vous êtes revenu à un point qui n'est pas le bout de sa branche : ce point ", el("b", null, "ouvre une nouvelle branche"), ", à côté."), field("Nom de la nouvelle branche", input, "Par exemple : couvercle embouti, piste de Sam, essai alu"));
  }
  function drawLeft(p, h, head, d) {
    clear(left);
    left.append(el("div", { class: "side-head" }, el("h2", null, "Historique")),
      el("div", { class: "side-actions" }, el("div", { class: "side-actions-row" }, btn("Poser un point", () => { const f = left.querySelector("[data-history-name]"); if (f) f.focus(); else pose(); }, { primary: true, icon: "save", tip: "Garder la définition complète du produit, telle qu'elle est maintenant" }))));
    const body = el("div", { class: "side-scroll" }); left.append(body);
    const name = el("input", { type: "text", value: st.name, placeholder: "Ce que ce point garde, en quelques mots", "data-history-name": "", maxlength: "120", onInput: (e) => { st.name = e.target.value; }, onKeydown: (e) => { if (e.key === "Enter") { e.preventDefault(); pose(); } } });
    const note = el("textarea", { rows: "3", placeholder: "Pourquoi maintenant, ce que l'on essaie ensuite (la dictée du système tape ici)", "data-history-note": "", onInput: (e) => { st.note = e.target.value; } }, st.note);
    body.append(el("div", { class: "side-section", "data-fold-note": "nom et note" }, el("h3", null, "Poser un point"),
      el("p", { class: "muted small" }, "Un point garde TOUT le produit : pièces, assemblages, cartes, logiciel, cas de charge, revues et révisions. Un artéfact qui n'a pas changé n'est pas recopié."),
      field("Nom du point", name), field("Note", note), whereNext(h), el("div", { class: "form-actions" }, btn("Poser le point", pose, { primary: true, icon: "save", cls: "", tip: "Entrée dans le champ du nom fait de même" }))));
    const n = changeCount(d);
    body.append(el("div", { class: "side-section", "data-fold-note": head ? `${n} changement${n > 1 ? "s" : ""}` : "aucun point" }, el("h3", null, "Où l'on en est"),
      head ? el("p", { class: "small" }, "Vous êtes ici : ", el("b", null, `${head.id} — ${head.label}`), `, posé le ${when(head.at)}.`) : el("p", { class: "muted small" }, "Aucun point encore : le premier gardera le produit tel qu'il est."),
      head ? (n ? el("div", null, el("p", { class: "small" }, `Depuis, ${n} artéfact${n > 1 ? "s ont" : " a"} changé — aucun point ne les garde encore :`), changeList(d)) : el("p", { class: "muted small" }, "Rien n'a changé depuis : ce point garde le produit tel qu'il est.")) : null));
    body.append(branchSection(h, { changeList, goTo: (id) => goBack(id), drop, fork: () => openFork(h.head), pick: (id) => { st.sel = id; mark(); draw(); requestAnimationFrame(() => tree.focus(id)); } }));
    const w = weight(h);
    if (w.points) body.append(el("div", { class: "side-section", "data-fold-note": kb(w.bytes) }, el("h3", null, "Ce que pèse l'historique"),
      el("p", { class: "small" }, `${w.points} point${w.points > 1 ? "s" : ""}, ${w.objects} artéfact${w.objects > 1 ? "s" : ""} rangé${w.objects > 1 ? "s" : ""} une seule fois : ${kb(w.bytes)} de plus dans le fichier du projet.`),
      el("p", { class: "muted small" }, "L'historique voyage avec le projet (son fichier .dwiz, son dossier Drive) ; il ne part ni vers une IA, ni dans le miroir d'équipe.")));
    const g = historyGuide(p); body.append(el("div", { class: "side-section", "data-fold-note": g.length ? `${g.length}` : "rien" }, el("h3", null, "À régler — le guide"), guideBox(g)));
  }
  function drawRight(p, h, pt) {
    clear(right);
    if (!pt) { right.append(el("div", { class: "side-head" }, el("h2", null, "Un point")), el("p", { class: "muted small side-scroll" }, "Choisissez un point dans l'arbre : ce qu'il garde, son journal, ce qui a changé depuis, et le retour.")); return; }
    const K = POINT_KINDS[pt.kind] || POINT_KINDS.manual, c = pt.context || {}, here = pt.id === h.head, others = (h.points || []).filter((x) => x.id !== pt.id);
    /* a point of a branch : « Fusionner dans MAIN » up to it, always there — primary when the branch brings something (JP, 22 novembre : « il
       manque un bouton pour qu'à partir du point d'une branche on merge avec le MAIN ») */
    const br = branchNames(h).get(pt.id), plan = br && br !== MAIN ? (() => { try { return mergePlan(h, br, pt.id); } catch (e) { return null; } })() : null, brings = !!plan && !plan.nothing || (here && changeCount(sinceThen(p, pt.id)) > 0);
    const merge = br && br !== MAIN ? tagged(btn("Fusionner dans MAIN", () => openMerge(br, { changeList, pick: (id) => { st.sel = id; mark(); draw(); requestAnimationFrame(() => tree.focus(id)); } }, pt.id),
      { primary: brings, icon: "branch", tip: brings ? `Ce que « ${br} » a changé jusqu'à ${pt.id} passe dans MAIN, d'un bloc — l'aperçu d'abord, une étape annulable ; vous revenez sur MAIN` : `Rien à fusionner : jusqu'à ${pt.id}, « ${br} » garde le produit tel que MAIN l'a` }), { historyMergePoint: pt.id }) : null;
    right.append(el("div", { class: "side-head" }, el("h2", null, `${pt.id} — ${pt.label}`)),
      el("div", { class: "side-actions" }, el("div", { class: "side-actions-row" },
        merge,
        btn("Revenir à ce point", () => goBack(pt.id), { primary: !merge || !brings, icon: "undo", disabled: here && !changeCount(sinceThen(p, pt.id)), tip: here ? "Vous êtes déjà ici ; revenir défait ce qui a changé depuis" : "Le produit redevient celui de ce point — une étape annulable" }),
        tagged(btn("Nouvelle branche ici", () => openFork(pt.id), { icon: "branch", tip: "Partir de ce point dans une branche nommée, à côté : la branche d'où elle part ne bouge pas ; elle se fusionne dans MAIN quand elle est prête" }), { historyFork: pt.id }),
        btn(".dwiz", () => takeAway(pt.id), { icon: "download", tip: "Ce point comme un projet complet, qui s'ouvre seul" }),
        tagged(btn("Effacer ce point", () => erase(pt.id), { icon: "trash", tip: "Effacer ce point seul : les points d'après se rattachent au point d'avant ; une branche qui n'avait que lui disparaît. Ce qu'il fait est dit avant ; un point effacé ne revient pas" }), { historyErase: pt.id }))));
    const body = el("div", { class: "side-scroll" }); right.append(body);
    body.append(el("div", { class: "side-section", "data-fold-note": K.label }, el("h3", null, "Ce point"),
      el("p", { class: "hist-kindline", style: `--dom:${K.color}` }, el("span", { class: "hist-kind" }, K.label), ` ${K.fr}.`),
      el("p", { class: "small", "data-history-branch": branchNames(h).get(pt.id) }, "Branche : ", el("b", null, branchNames(h).get(pt.id)), branchNames(h).get(pt.id) === MAIN ? " — la branche principale, au centre de l'arbre." : ".", pt.merged ? ` Fusion : reprend ${pt.merged} d'un bloc.` : "", pt.kind === "import" ? ` Lu dans le fichier d'un coéquipier${pt.from === "closest" ? " ; parti du point le plus proche — à vérifier" : ""}.` : ""),
      el("p", { class: "small" }, `Posé le ${when(pt.at)}${pt.by ? ` par ${pt.by}` : ""}${pt.parent ? `, après ${pt.parent}` : ", premier point"}.${here ? " Vous êtes ici." : ""}${pt.dropped ? " Sa branche est abandonnée." : ""}`),
      pt.note ? el("p", { class: "hist-note" }, pt.note) : null,
      el("p", { class: "small" }, el("b", null, "Itération MVP : "), c.mvp ? `${c.mvp.name}${c.mvp.trl ? ` (TRL ${c.mvp.trl} visé)` : ""} — ${c.mvp.fr}.` : "aucune ouverte."),
      el("p", { class: "small" }, el("b", null, "Révisions : "), c.revs ? `${c.revs.frozen} gelée(s), ${c.revs.released} libérée(s), ${c.revs.rejected} refusée(s)${c.revs.last && c.revs.last.length ? ` — dernières : ${c.revs.last.map((r) => `${r.pn} rév. ${r.rev} (${r.fr})`).join(", ")}` : ""}.` : "—")));
    const J = pt.journal || [];
    body.append(el("div", { class: "side-section", "data-fold-note": `${J.length} étape${J.length > 1 ? "s" : ""}` }, el("h3", null, "Son journal"),
      el("p", { class: "muted small" }, pt.parent ? `Ce qui a été fait entre ${pt.parent} et ce point.` : "Ce qui a été fait avant ce premier point."),
      J.length ? el("ol", { class: "hist-journal" }, J.slice().reverse().map((x) => el("li", null, el("span", { class: "muted" }, `${String(x.when || "").slice(11, 16)} `), x.text))) : el("p", { class: "muted small" }, "Rien d'inscrit.")));
    const pick = el("select", { "data-history-cmp": "", onChange: (e) => { st.cmp = e.target.value; drawRight(p, h, pt); } },
      el("option", { value: "now", selected: st.cmp === "now" }, "le produit maintenant"), others.map((x) => el("option", { value: x.id, selected: st.cmp === x.id }, `${x.id} — ${x.label}`)));
    const other = st.cmp === "now" ? null : pointOf(h, st.cmp), d = other ? diffTrees(pt.tree, other.tree, h.objects) : sinceThen(p, pt.id);
    body.append(el("div", { class: "side-section", "data-fold-note": `${changeCount(d)} écart${changeCount(d) > 1 ? "s" : ""}` }, el("h3", null, "Comparer"),
      field(`De ${pt.id} à`, pick), changeList(d, 30)));
  }
  function draw() {
    const p = store.project;
    if (!p) { clear(left); clear(right); empty.hidden = false; host.hidden = true; empty.replaceChildren(el("p", null, "Ouvrez un projet : son historique s'affiche ici.")); setGuide([]); return; }
    const h = historyOf(p), head = pointOf(h, h.head), d = head ? sinceThen(p, head.id) : { added: [], removed: [], changed: [] };
    if (st.sel && !pointOf(h, st.sel)) st.sel = null; if (!st.sel && head) st.sel = head.id;
    const none = !(h.points || []).length; empty.hidden = !none; host.hidden = none;
    if (none) empty.replaceChildren(el("h2", null, "Aucun point de restauration"), el("p", null, "Un point garde la définition complète du produit à un moment : on peut y revenir, comparer, repartir dans une autre direction. Un point se pose aussi tout seul après chaque réponse d'IA appliquée."),
      btn("Poser le premier point", pose, { primary: true, icon: "save" }));
    else tree.draw(h, st.sel, changeCount(d), nextBranch(h));
    drawLeft(p, h, head, d); drawRight(p, h, pointOf(h, st.sel));
    setGuide([...historyGuide(p), ...branchGuide(h)].map((x) => ({ ...x, go: () => { const f = left.querySelector("[data-history-name]"); if (f) f.focus(); } })));
  }
  const off = store.on("change", () => draw());
  draw();
  return () => { off(); tree.destroy(); };
}

registerModule({ key: "history", label: "Historique", icon: "history", tip: "Les points de restauration du produit et l'arbre de leurs branches : revenir, comparer, repartir", render });
