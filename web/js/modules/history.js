/* DesignWizard.ai — Historique : the restore points of the product and the tree of their branches (point 9 of the plan agreed with JP : « ces
   itérations sont la colonne vertébrale » ; choices clicked on 20 November : a point keeps the complete definition, heavy files stored once,
   the points and the tree first, the package for an AI next). Route : #/history[/<point>].
   The same three places as every studio. Left, what one does and where one is : pose a point (a name, a note one may dictate), what changed
   since the point « vous êtes ici », the branches — set one aside or take it up again —, what the history weighs, the guide. Centre, what one
   looks at : the tree (modules/history_tree.js). Right, the point chosen : when, why, its own journal, the MVP iteration and the revisions of
   that moment, what differs from now or from another point ; go back to it, or take it away as a .dwiz that stands alone.
   Going back is ONE undoable step (Ctrl + Z) ; before it, what is kept by no point is kept by an automatic point « Avant le retour ». The
   history itself is not undone. Every rule is in core/history.js. */

import { el, clear, btn, toast, download, confirmBox, field } from "../core/dom.js";
import { store } from "../core/store.js";
import { registerModule, setGuide } from "../core/app.js";
import { guideBox } from "../core/guide.js";
import { toDwiz } from "../core/dwiz.js";
import { historyOf, pointOf, addPoint, restoreInto, sinceThen, diffTrees, changeCount, branches, setDropped, weight, pointProject, contextOf, historyGuide, POINT_KINDS, ART_KINDS } from "../core/history.js";
import { historyTree } from "./history_tree.js";

const VERB = { added: ["ajouté", "#16a34a"], removed: ["retiré", "#dc2626"], changed: ["modifié", "#b45309"] };
const kb = (n) => (n < 1024 ? `${n} o` : n < 1048576 ? `${(n / 1024).toFixed(n < 10240 ? 1 : 0).replace(".", ",")} ko` : `${(n / 1048576).toFixed(1).replace(".", ",")} Mo`);
const when = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? String(iso || "") : d.toLocaleString("fr-CA", { dateStyle: "medium", timeStyle: "short" }); };
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
  const st = { sel: args[0] || null, cmp: "now", name: "", note: "" };
  const tree = historyTree(host, { onPick: (id) => { st.sel = id; st.cmp = "now"; mark(); draw(); } });
  const mark = () => { try { history.replaceState(null, "", `#/history${st.sel ? `/${encodeURIComponent(st.sel)}` : ""}`); } catch (e) { /* a page without history */ } };

  function pose() {
    const p = store.project, n = (historyOf(p).points || []).length + 1;
    let r = null; store.writeHistory("Point de restauration posé", (x) => { r = addPoint(x, { kind: "manual", label: st.name.trim() || `Point ${n}`, note: st.note.trim(), by: (x.team && x.team.owner) || "", context: contextOf(x) }); });
    st.name = ""; st.note = ""; st.sel = r.point.id; mark(); draw();
    toast(r.same ? `${r.point.id} posé — rien n'avait changé depuis le point d'avant : il garde le même produit, sous un autre nom.` : `${r.point.id} posé : la définition complète du produit est gardée, chaque artéfact rangé une seule fois.`, "success", 6000);
  }
  async function goBack(id) {
    const p = store.project, h = historyOf(p), pt = pointOf(h, id), head = pointOf(h, h.head), pending = head ? changeCount(sinceThen(p, head.id)) : 0;
    const ok = await confirmBox(`Revenir au point ${pt.id}`, `Le produit redevient celui du point « ${pt.label} » (${when(pt.at)}) : pièces, assemblages, cartes et registres.${pending ? ` Les ${pending} changement${pending > 1 ? "s" : ""} qu'aucun point ne garde encore seront d'abord gardés par un point automatique « Avant le retour ».` : ""} Ce que vous ferez ensuite ouvrira une branche. Le retour est une étape annulable (Ctrl + Z).`, "Revenir à ce point");
    if (!ok) return;
    if (pending) store.writeHistory("Point avant le retour", (x) => addPoint(x, { kind: "before", label: `Avant le retour à ${pt.id}`, context: contextOf(x) }));
    const changed = store.commit(`Retour au point ${pt.id} — ${pt.label}`, (x) => { restoreInto(x, id); });
    if (!changed) store.writeHistory("Vous êtes ici", (x) => { historyOf(x).head = id; });
    st.sel = id; draw(); toast(`Vous êtes au point ${pt.id}. Le prochain point posé partira d'ici.`, "success", 6000);
  }
  function takeAway(id) {
    const p = store.project, doc = pointProject(p, id), pt = pointOf(historyOf(p), id);
    download(`${fileName(`${p.name || p.id}_${pt.id}_${pt.label}`)}.dwiz`, toDwiz(doc), "text/plain;charset=utf-8");
    toast(`${pt.id} téléchargé : un projet complet, qui s'ouvre seul (menu Projet › Importer).`, "success", 5000);
  }
  const drop = (tip, on) => { store.writeHistory(on ? "Branche abandonnée" : "Branche reprise", (x) => setDropped(x, tip, on)); draw(); };

  function drawLeft(p, h, head, d) {
    clear(left);
    left.append(el("div", { class: "side-head" }, el("h2", null, "Historique")),
      el("div", { class: "side-actions" }, el("div", { class: "side-actions-row" }, btn("Poser un point", () => { const f = left.querySelector("[data-history-name]"); if (f) f.focus(); else pose(); }, { primary: true, icon: "save", tip: "Garder la définition complète du produit, telle qu'elle est maintenant" }))));
    const body = el("div", { class: "side-scroll" }); left.append(body);
    const name = el("input", { type: "text", value: st.name, placeholder: "Ce que ce point garde, en quelques mots", "data-history-name": "", maxlength: "120", onInput: (e) => { st.name = e.target.value; }, onKeydown: (e) => { if (e.key === "Enter") { e.preventDefault(); pose(); } } });
    const note = el("textarea", { rows: "3", placeholder: "Pourquoi maintenant, ce que l'on essaie ensuite (la dictée du système tape ici)", "data-history-note": "", onInput: (e) => { st.note = e.target.value; } }, st.note);
    body.append(el("div", { class: "side-section", "data-fold-note": "nom et note" }, el("h3", null, "Poser un point"),
      el("p", { class: "muted small" }, "Un point garde TOUT le produit : pièces, assemblages, cartes, logiciel, cas de charge, revues et révisions. Un artéfact qui n'a pas changé n'est pas recopié."),
      field("Nom du point", name), field("Note", note), el("div", { class: "form-actions" }, btn("Poser le point", pose, { primary: true, icon: "save", cls: "", tip: "Entrée dans le champ du nom fait de même" }))));
    const n = changeCount(d);
    body.append(el("div", { class: "side-section", "data-fold-note": head ? `${n} changement${n > 1 ? "s" : ""}` : "aucun point" }, el("h3", null, "Où l'on en est"),
      head ? el("p", { class: "small" }, "Vous êtes ici : ", el("b", null, `${head.id} — ${head.label}`), `, posé le ${when(head.at)}.`) : el("p", { class: "muted small" }, "Aucun point encore : le premier gardera le produit tel qu'il est."),
      head ? (n ? el("div", null, el("p", { class: "small" }, `Depuis, ${n} artéfact${n > 1 ? "s ont" : " a"} changé — aucun point ne les garde encore :`), changeList(d)) : el("p", { class: "muted small" }, "Rien n'a changé depuis : ce point garde le produit tel qu'il est.")) : null));
    const B = branches(h);
    if (B.length > 1 || B.some((b) => b.dropped)) body.append(el("div", { class: "side-section", "data-fold-note": `${B.length} branche${B.length > 1 ? "s" : ""}` }, el("h3", null, "Les branches"),
      el("p", { class: "muted small" }, "Revenir à un point puis continuer ouvre une branche. Une branche abandonnée reste gardée, pâle dans l'arbre ; on peut la reprendre."),
      el("ul", { class: "hist-branches" }, B.map((b) => { const tip = pointOf(h, b.tip); return el("li", { class: b.dropped ? "dropped" : "" },
        el("button", { type: "button", class: "linklike", onClick: () => { st.sel = b.tip; mark(); draw(); tree.focus(b.tip); } }, `${b.tip} — ${tip.label}`),
        el("span", { class: "muted small" }, ` ${b.points.length} point${b.points.length > 1 ? "s" : ""}${b.here ? " · vous êtes sur cette branche" : ""}${b.dropped ? " · abandonnée" : ""}`),
        b.here ? null : btn(b.dropped ? "Reprendre" : "Abandonner", () => drop(b.tip, !b.dropped), { small: true, tip: b.dropped ? "La branche redevient une branche comme les autres" : "La mettre de côté : elle reste gardée, pâle dans l'arbre" })); }))));
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
    right.append(el("div", { class: "side-head" }, el("h2", null, `${pt.id} — ${pt.label}`)),
      el("div", { class: "side-actions" }, el("div", { class: "side-actions-row" },
        btn("Revenir à ce point", () => goBack(pt.id), { primary: true, icon: "undo", disabled: here && !changeCount(sinceThen(p, pt.id)), tip: here ? "Vous êtes déjà ici ; revenir défait ce qui a changé depuis" : "Le produit redevient celui de ce point — une étape annulable" }),
        btn(".dwiz", () => takeAway(pt.id), { icon: "download", tip: "Ce point comme un projet complet, qui s'ouvre seul" }))));
    const body = el("div", { class: "side-scroll" }); right.append(body);
    body.append(el("div", { class: "side-section", "data-fold-note": K.label }, el("h3", null, "Ce point"),
      el("p", { class: "hist-kindline", style: `--dom:${K.color}` }, el("span", { class: "hist-kind" }, K.label), ` ${K.fr}.`),
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
    else tree.draw(h, st.sel, changeCount(d));
    drawLeft(p, h, head, d); drawRight(p, h, pointOf(h, st.sel));
    setGuide(historyGuide(p).map((x) => ({ ...x, go: () => { const f = left.querySelector("[data-history-name]"); if (f) f.focus(); } })));
  }
  const off = store.on("change", () => draw());
  draw();
  return () => { off(); tree.destroy(); };
}

registerModule({ key: "history", label: "Historique", icon: "history", tip: "Les points de restauration du produit et l'arbre de leurs branches : revenir, comparer, repartir", render });
