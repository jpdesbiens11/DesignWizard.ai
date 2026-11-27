/* DynamiteOrbit.ai — the list of the product READ AGAIN from DynamiteAgile (JP, 27 novembre 2026 : « après, ça va avoir des itérations ; on va
   les envoyer dans DynamiteAgile ; une fois terminés, on va les exporter, les ramener »). Before anything changes, the dialog says what the new
   export does to the list the project holds — lines added, changed column by column, removed, the keys DynamiteAgile gave to the lines of a
   draft, the stage before and after — and waits for a person : « Appliquer » is one undoable step. The rules are pure (core/reqs.js mergePlan). */

import { el, btn, icon, modal } from "../core/dom.js";
import { mergePlan, stageOf, STAGES, keyOf, COLUMN_FR } from "../core/reqs.js";

const MAX = 12;      // lines shown per group ; the count says the rest
const cut = (t, n = 90) => { const s = String(t || ""); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };

/** Opens the preview. R : the list the project holds ; list : the new reading ({ head, rows }) ; apply() : does it (one step). → the dialog */
export function openMerge(R, list, file, apply) {
  const P = mergePlan(R, list), before = stageOf(R), after = stageOf({ rows: list.rows }), A = STAGES[after.stage], B = STAGES[before.stage];
  const tile = (n, label, color, ic) => el("div", { class: "rq-mtile", style: `--c:${color}` }, icon(ic), el("b", null, String(n)), el("span", null, label));
  const group = (title, n, items, open = false) => n ? el("details", { class: "rq-mgroup", open }, el("summary", null, `${title} (${n})`), el("ul", { class: "small" }, items.slice(0, MAX), n > MAX ? el("li", { class: "muted" }, `… et ${n - MAX} autre${n - MAX > 1 ? "s" : ""}`) : null)) : null;
  const nothing = !P.added.length && !P.removed.length && !P.changed.length && !P.keyed.length;
  const ok = btn("Appliquer", () => { m.close(); apply(P); }, { primary: true, icon: "check" }); ok.dataset.rqMergeApply = "";
  const m = modal(`Relire « ${file || "l'export"} »`, [
    el("p", { class: "muted small" }, "Chaque ligne est retrouvée par sa clé, sinon par son identifiant (une ligne d'un brouillon reçoit sa clé dans DynamiteAgile). L'allocation confirmée ici est gardée quand le fichier ne la dit pas. Rien ne change avant « Appliquer » — une seule étape, annulable."),
    el("div", { class: "rq-mtiles", "data-rq-merge": "" }, tile(P.added.length, "ajoutées", "#16a34a", "plus"), tile(P.changed.length, "modifiées", "#d97706", "edit"), tile(P.removed.length, "retirées", "#dc2626", "trash"),
      tile(P.keyed.length, "clés données par DynamiteAgile", "#2563eb", "link"), tile(P.same, "inchangées", "#64748b", "check")),
    el("p", { class: "rq-mstage" }, el("span", { class: "rq-schip", style: `--c:${B.color}` }, icon(B.icon), B.fr), " → ", el("span", { class: "rq-schip", style: `--c:${A.color}` }, icon(A.icon), A.fr),
      after.stage === "final" && before.stage === "draft" ? el("b", null, " La version finale : la structure du produit peut se bâtir sur elle.") : after.stage === "draft" ? ` — ${after.draft} ligne${after.draft > 1 ? "s" : ""} encore avant « Accepted »${after.tbd ? `, ${after.tbd} TBD` : ""}.` : null),
    nothing ? el("p", { class: "lab-note" }, icon("check"), " Le fichier dit exactement ce que le projet a déjà.") : null,
    group("Ajoutées", P.added.length, P.added.map((r) => el("li", null, el("b", null, keyOf(r)), ` — ${cut(r.statement || r.title)}`)), true),
    group("Modifiées", P.changed.length, P.changed.map((c) => el("li", null, el("b", null, c.key), c.was !== c.key ? el("small", { class: "muted" }, ` (était ${c.was})`) : null, " — ",
      c.fields.map((f, i) => el("span", { class: "rq-mfield" }, i ? " · " : "", `${COLUMN_FR[f.h] || f.h} : `, el("s", null, cut(f.from, 40) || "vide"), " → ", el("b", null, cut(f.to, 40) || "vide"))))), true),
    group("Retirées — absentes du fichier", P.removed.length, P.removed.map((r) => el("li", null, el("b", null, keyOf(r)), ` — ${cut(r.statement || r.title)}`)), true),
    group("Clés données par DynamiteAgile", P.keyed.length, P.keyed.map((k) => el("li", null, `${k.from} → `, el("b", null, k.to)))),
    el("div", { class: "form-actions" }, btn("Annuler", () => m.close()), ok)], { wide: true });
  return m;
}
