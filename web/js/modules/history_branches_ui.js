/* DesignOrbit.ai — Historique : the BRANCHES, in the left pane (demande de JP, 21 novembre 2026 ; choices clicked : the whole branch in one
   block ; a part absent from the side that wins enters at Off, greyed). A row per branch, MAIN first, in the colour of its column in the tree :
   where it leaves, who works on it, how many points MAIN does not have yet ; « Fusionner dans MAIN » opens the preview — what comes, what MAIN
   gives up, what MAIN keeps, what comes back at Off — and applies it as ONE undoable step, then a merge point on MAIN. « Lire le travail d'un
   coéquipier » reads their project file (.dwiz or .json) and adds it as a branch of its own, from the point both files share.
   What it follows : the branch list and the merge of a version-control client ; the preview before applying, as the AI round trip does it.
   The rules are in core/history_branches.js ; this draws and asks. */

import { el, btn, toast, modal, field } from "../core/dom.js";
import { store } from "../core/store.js";
import { fromDwiz } from "../core/dwiz.js";
import { MAIN, historyOf, pointOf, addPoint, putDefinition, sinceThen, changeCount, contextOf, tipOf } from "../core/history.js";
import { branchList, branchLayout, mergePlan, importPlan, importBranch, freeName } from "../core/history_branches.js";
import { laneColor } from "./history_tree.js";

const tag = (b, data) => { Object.assign(b.dataset, data); return b; };      // a button marked for the tests and the news
const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;
const asGroup = (list) => ({ added: list.filter((x) => x.how === "added"), removed: [], changed: list.filter((x) => x.how !== "added") });

/** Does a branch bring anything to MAIN ? Its points may keep the product as MAIN has it (a branch just opened). */
const brings = (h, b) => { if (b.name === MAIN || !b.ahead) return false; try { const plan = mergePlan(h, b.name); return !!plan && !plan.nothing; } catch (e) { return true; } };
/** What the guide says about the branches. → [{ level, text }] */
export function branchGuide(h) {
  return branchList(h).filter((b) => !b.dropped && brings(h, b))
    .map((b) => ({ level: "tip", text: `La branche « ${b.name} » a ${plural(b.ahead, "point", "points")} que MAIN n'a pas : « Fusionner dans MAIN » les reprend d'un bloc.` }));
}

/** « Nouvelle branche » : where « vous êtes ici » is ; on any other point, the same button in the right pane. */
const forkRow = (h, ctx) => el("div", { class: "form-actions" }, tag(btn("Nouvelle branche", () => ctx.fork(), { small: true, primary: branchList(h).length < 2, icon: "branch", disabled: !pointOf(h, h.head),
  tip: pointOf(h, h.head) ? `Une branche nommée qui part d'ici (${h.head}), à côté de sa branche — qui ne bouge pas. Sur un autre point : « Nouvelle branche ici », à droite.` : "Posez d'abord un point : une branche part d'un point" }), { historyForkHere: "" }));
/** The section « Les branches ». ctx : { changeList, goTo(id), drop(tip, on), fork(), pick(id), redraw() } */
export function branchSection(h, ctx) {
  const B = branchList(h), lanes = branchLayout(h).lanes;
  if (B.length < 2) return el("div", { class: "side-section", "data-fold-note": "MAIN seule" }, el("h3", null, "Les branches"),
    el("p", { class: "small" }, "Tout est sur MAIN, la branche du centre. Pour essayer une autre direction sans toucher MAIN : « Nouvelle branche » — elle part d'ici, ou de n'importe quel point avec « Nouvelle branche ici » (marge de droite). Le travail continue dans la branche ; « Revenir à MAIN » et « Travailler sur cette branche » passent de l'une à l'autre ; « Fusionner dans MAIN » la ramène, d'un bloc."),
    forkRow(h, ctx), importRow(ctx));
  return el("div", { class: "side-section", "data-fold-note": plural(B.length, "branche", "branches") }, el("h3", null, "Les branches"),
    el("p", { class: "muted small" }, "MAIN est au centre de l'arbre. Une branche y revient d'un bloc : ce qu'elle a changé passe dans MAIN, le reste de MAIN ne bouge pas."), forkRow(h, ctx),
    el("ul", { class: "hist-branch-list", "data-history-branches": "" }, B.map((b) => {
      const tip = pointOf(h, b.tip), main = b.name === MAIN, color = laneColor(lanes, b.name);
      const meta = main ? `${plural(b.points.length, "point", "points")} · la branche principale` : [`part de ${b.fork || "—"}`, b.by ? `par ${b.by}` : "", b.imported ? "importée" : "",
        brings(h, b) ? `${plural(b.ahead, "point", "points")} pas encore dans MAIN` : b.ahead && !b.mergedAt ? "rien de changé encore par rapport à MAIN" : b.mergedAt ? `fusionnée (${b.mergedAt})` : "rien de neuf pour MAIN", b.dropped ? "abandonnée" : ""].filter(Boolean).join(" · ");
      return el("li", { class: `${main ? "main" : ""}${b.dropped ? " dropped" : ""}`, style: `--lane:${color}`, "data-branch": b.name },
        el("span", { class: "hist-branch-name" }, b.name), b.here ? el("span", { class: "muted small" }, " · vous êtes ici") : null,
        el("span", { class: "hist-branch-meta" }, meta, ` — bout : ${tip.id} ${tip.label}`),
        el("div", { class: "hist-branch-acts" },
          b.here && h.head === b.tip ? null : btn(main ? "Revenir à MAIN" : "Travailler sur cette branche", () => ctx.goTo(b.tip), { small: true, icon: "branch", tip: `Le produit redevient celui du bout de « ${b.name} » (${b.tip}) ; les points suivants iront dans cette branche` }),
          !main && !b.dropped ? tag(btn("Fusionner dans MAIN", () => openMerge(b.name, ctx), { small: true, primary: brings(h, b), icon: "branch", tip: brings(h, b) ? "Voir ce qui passerait dans MAIN, puis fusionner d'un bloc (une étape annulable)" : "Rien à fusionner pour l'instant : la branche garde le produit tel que MAIN l'a" }), { historyMerge: b.name }) : null,
          main || b.here ? null : btn(b.dropped ? "Reprendre" : "Abandonner", () => ctx.drop(b.tip, !b.dropped), { small: true, tip: b.dropped ? "La branche redevient une branche comme les autres" : "La mettre de côté : elle reste gardée, pâle dans l'arbre" })));
    })), importRow(ctx));
}

/** « Fusionner dans MAIN » : the preview, then one undoable step and a merge point. What « ici » has that no point keeps is kept first by a
    point « Avant la fusion », on its own branch — the preview already counts it. */
export function openMerge(name, ctx, at = null) {
  const p = store.project, h = historyOf(p), head = pointOf(h, h.head), pending = head ? changeCount(sinceThen(p, head.id)) : 0;
  const trial = pending ? JSON.parse(JSON.stringify(p)) : p; if (pending) addPoint(trial, { kind: "before", label: "Avant la fusion" });
  const last = tipOf(h, name), upTo = !at || (last && at === last.id) || (at === (head && head.id) && pending) ? null : at;      // the last point, or « ici » with changes (its « Avant la fusion » point carries them) : the whole branch
  const plan = mergePlan(historyOf(trial), name, upTo);
  if (!plan || plan.nothing) { toast(`Rien à fusionner : depuis qu'elle a quitté MAIN, « ${name} »${upTo ? ` (jusqu'à ${upTo})` : ""} garde le produit tel que MAIN l'a. Changez quelque chose, posez un point dans la branche, puis fusionnez.`, "info", 8000); return; }
  const go = () => {
    m.close();
    if (pending) store.writeHistory("Point avant la fusion", (x) => addPoint(x, { kind: "before", label: `Avant la fusion de « ${name} »`, context: contextOf(x) }));
    const real = mergePlan(historyOf(store.project), name, upTo);
    store.commit(`Fusion de « ${name} » dans MAIN`, (x) => { putDefinition(x, real.doc); });
    let pt = null; store.writeHistory("Fusion dans MAIN", (x) => { historyOf(x).head = real.main; pt = addPoint(x, { kind: "merge", branch: MAIN, merged: real.tip, label: `Fusion de « ${name} »`, by: (x.team && x.team.owner) || "", context: contextOf(x) }).point; });
    if (pt) ctx.pick(pt.id);
    toast(`« ${name} » est dans MAIN (${pt ? pt.id : ""}).${real.offs.length ? ` ${plural(real.offs.length, "pièce revient", "pièces reviennent")} à Off, grisée${real.offs.length > 1 ? "s" : ""} : activez-les dans l'Assemblage pour les replacer.` : ""} Ctrl + Z défait la fusion.`, "success", 8000);
  };
  const m = modal(`Fusionner « ${name} » dans MAIN`, [
    el("p", { class: "small" }, `La branche part de ${plan.base}${upTo ? ` ; elle est fusionnée jusqu'à ${plan.tip} — les points d'après restent dans la branche` : ""}. Ce qu'elle a changé depuis passe dans MAIN, d'un bloc ; ce qu'elle n'a pas touché reste comme MAIN l'a. Une étape, annulable par Ctrl + Z ; un point de fusion se pose sur MAIN.`),
    pending ? el("p", { class: "small" }, `${plural(pending, "changement", "changements")} qu'aucun point ne garde ${pending > 1 ? "seront d'abord gardés" : "sera d'abord gardé"} par un point « Avant la fusion ».`) : null,
    el("p", { class: "hist-merge-group" }, `Ce qui vient de « ${name} » — ${plan.take.length}`), ctx.changeList(asGroup(plan.take), 40),
    plan.lost.length ? el("div", { "data-merge-lost": "" }, el("p", { class: "hist-merge-group warn" }, `MAIN l'avait changé aussi — sa version est remplacée (${plan.lost.length})`), ctx.changeList({ added: [], removed: [], changed: plan.lost }, 40)) : null,
    plan.kept.length ? el("div", null, el("p", { class: "hist-merge-group" }, `La branche l'a retiré — MAIN le garde (${plan.kept.length})`), ctx.changeList({ added: [], removed: [], changed: plan.kept }, 20)) : null,
    plan.offs.length ? el("div", { "data-merge-offs": "" }, el("p", { class: "hist-merge-group off" }, `Pièces que MAIN a et que la branche n'a pas : elles restent, à Off, grisées (${plan.offs.length})`),
      el("ul", { class: "hist-offs" }, plan.offs.map((o) => el("li", null, `${o.asm}${o.asmName ? ` ${o.asmName}` : ""} · ${o.inst} (${o.part}) — à Off, à activer pour la replacer`)))) : null,
    el("div", { class: "form-actions" }, btn("Annuler", () => m.close()), tag(btn("Fusionner dans MAIN", go, { primary: true, icon: "branch" }), { historyMergeGo: "" })),
  ], { wide: true });
}

/** « Lire le travail d'un coéquipier » : their project file becomes a branch of its own. */
function importRow(ctx) {
  const who = el("input", { type: "text", placeholder: "Qui a fait ce travail", maxlength: "60", "data-history-who": "" });
  const file = el("input", { type: "file", accept: ".dwiz,.json", hidden: true, onChange: async (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) readMate(await f.text(), f.name, who.value.trim(), ctx); } });
  return el("div", { class: "hist-import", "data-history-import": "" }, el("p", { class: "muted small" }, "En équipe : chacun travaille sur sa branche ; le fichier du projet d'un coéquipier (.dwiz) devient une branche ici, à fusionner dans MAIN quand elle est prête."),
    field("Coéquipier", who), file, btn("Lire le travail d'un coéquipier", () => file.click(), { small: true, icon: "upload", tip: "Son fichier de projet (.dwiz ou .json) : son produit devient une branche, partie du point que vos deux fichiers partagent" }));
}
function readMate(text, fileName, by, ctx) {
  let other = null;
  try { other = fromDwiz(text); } catch (e) { try { other = JSON.parse(text); } catch (e2) { other = null; } }
  if (!other || Array.isArray(other) || !(other.parts || other.assemblies || other.boards)) { toast(`« ${fileName} » n'est pas un fichier de projet : il faut le projet entier, tel que « Projet › Enregistrer » l'écrit.`, "error", 7000); return; }
  const h = historyOf(store.project), plan = importPlan(h, other, { by: by || other.name || "l'équipe" });
  if (!plan.base) { toast("Posez d'abord un point : la branche importée part d'un point de ce projet.", "warn", 6000); return; }
  if (plan.same) { toast(`Le produit de « ${fileName} » est déjà celui d'un point d'ici : rien à importer.`, "info", 5000); return; }
  const name = el("input", { type: "text", value: plan.name, maxlength: "40", "data-history-branch-name": "" });
  const go = () => { m.close(); let pt = null; store.writeHistory("Branche importée", (x) => { pt = importBranch(x, other, { ...plan, name: freeName(historyOf(x), name.value) }, { by: by || "", label: `Travail de ${by || other.name || "l'équipe"}` }); }); ctx.pick(pt.id);
    toast(`${pt.id} : la branche « ${pt.branch} » est dans l'arbre. Comparez-la, puis « Fusionner dans MAIN » quand elle est prête.`, "success", 7000); };
  const m = modal("Lire le travail d'un coéquipier", [
    el("p", { class: "small" }, plan.how === "common" ? `Vos deux fichiers partagent le point ${plan.base} : la branche en part.` : `Aucun point commun dans les deux fichiers : la branche part de ${plan.base}, le point d'ici le plus proche de son produit (le plus d'artéfacts identiques) — à vérifier.`),
    el("p", { class: "hist-merge-group" }, `Ce que son produit change depuis ${plan.base} — ${changeCount(plan.changes)}`), ctx.changeList(plan.changes, 40),
    field("Nom de la branche", name), el("p", { class: "muted small" }, "« Vous êtes ici » ne bouge pas : rien ne change dans le produit sur lequel vous travaillez."),
    el("div", { class: "form-actions" }, btn("Annuler", () => m.close()), btn("Ajouter la branche", go, { primary: true, icon: "branch" })),
  ], { wide: true });
}
