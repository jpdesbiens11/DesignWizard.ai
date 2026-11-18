/* DesignWizard.ai — Simulation : symmetries and cuts, in the side panel and under the right click.
   The planes about which the product is its own mirror are found on the mesh and proposed ; one click solves a half, a
   quarter or an eighth instead of the whole. A cut can also be put anywhere, to isolate a zone : its plane then carries
   the condition the analyst chooses. The physics is in analysis/fea/symmetry.js ; this is only its screen. */

import { el, btn } from "../core/dom.js";
import { CUT_BC } from "../analysis/fea/symmetry.js";

const AX = "XYZ", fr = (x) => String(Math.round(x * 100) / 100).replace(".", ",");
/** How much of the product a set of cuts leaves, as it is said : « 1/4 ». */
export const fraction = (copies) => (copies > 1.05 ? `1/${Math.round(copies * 10) / 10}`.replace(".", ",") : "entier");

/** The section of the side panel. o : { st (st.cuts), kind, syms (findSymmetries of the whole product), bbox (of the whole),
    symmetric(plane) → { ok, notes }, apply() (the cuts changed : mesh again) } */
export function cutsSection(o) {
  const { st } = o, heat = o.kind !== "structure", sec = el("div", { class: "side-section" }), symAt = st.cuts.findIndex((c) => c.bc === "sym"), hasSym = symAt >= 0;      // one plane of symmetry at a time, for now
  const add = (c) => { st.cuts = [...st.cuts.filter((x) => x.axis !== c.axis), c]; o.apply(); }, set = (i, patch) => { st.cuts[i] = { ...st.cuts[i], ...patch }; o.apply(); };
  const rows = [el("h3", null, el("span", { class: "grow" }, "Symétries et coupes"), btn("", () => { const free = [0, 1, 2].find((a) => !st.cuts.some((c) => c.axis === a)) ?? 0; add({ axis: free, at: (o.bbox[free] + o.bbox[free + 3]) / 2, keep: 1, bc: "free" }); },
    { small: true, icon: "plus", tip: "Ajouter un plan de coupe : il isole une zone du produit, avec la condition de votre choix sur le plan" }))];
  /* what the mesh says : the planes of symmetry not yet used */
  for (const s of o.syms.filter((x) => !st.cuts.some((c) => c.axis === x.axis))) {
    if (!s.ok) { rows.push(el("p", { class: "muted small", style: { margin: ".1rem 0" } }, `Plan ${s.name} : pas de symétrie (${fr(s.mismatch * 100)} % des cubes sans vis-à-vis).`)); continue; }
    const chk = o.symmetric({ axis: s.axis, at: s.at });
    rows.push(el("div", { class: "bc-row" }, el("span", { class: "grow small" }, `Plan ${s.name} = ${fr(s.at)} mm : le produit est symétrique${chk.ok ? ", son chargement aussi." : "."}`),
      btn(chk.ok ? "Utiliser" : "Forcer", () => add({ axis: s.axis, at: s.at, keep: 1, bc: "sym" }), { small: true, primary: chk.ok && !hasSym, disabled: hasSym, tip: hasSym ? `Une seule symétrie à la fois pour l'instant : le plan ${AX[st.cuts[symAt].axis]} l'est déjà. Retirez-la pour utiliser celle-ci.` : chk.ok ? "Ne résoudre qu'un côté du plan : même réponse, deux fois moins de cubes — ou des cubes plus fins pour le même temps" : "Le chargement n'est pas le même des deux côtés : le résultat ne vaudra que pour un chargement symétrique" })));
    for (const n of chk.notes.slice(0, 3)) rows.push(el("p", { class: "form-error small", style: { margin: "0 0 .2rem" } }, n));
  }
  /* the cuts in use : where the plane is, then which side is solved and what the plane carries */
  st.cuts.forEach((c, i) => rows.push(el("div", { class: "card", style: { padding: ".35rem .45rem", margin: ".3rem 0" }, "data-cut": AX[c.axis] },
    el("div", { style: { display: "flex", gap: ".3rem", alignItems: "center" } },
      el("select", { "aria-label": "Axe du plan", style: { flex: "0 0 5.2rem" }, onChange: (e) => { const a = +e.target.value; set(i, { axis: a, at: (o.bbox[a] + o.bbox[a + 3]) / 2 }); } }, [0, 1, 2].map((a) => el("option", { value: a, selected: a === c.axis, disabled: a !== c.axis && st.cuts.some((x) => x.axis === a) }, `Plan ${AX[a]}`))),
      el("span", { class: "small" }, "à"), el("input", { type: "number", "aria-label": "Position du plan (mm)", value: Math.round(c.at * 100) / 100, step: "any", style: { flex: "1 1 auto", minWidth: 0 }, onChange: (e) => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) set(i, { at: v }); } }), el("span", { class: "small" }, "mm"),
      el("button", { class: "icon-btn", type: "button", "aria-label": "Retirer ce plan", onClick: () => { st.cuts.splice(i, 1); o.apply(); } }, "×")),
    el("div", { style: { display: "flex", gap: ".3rem", alignItems: "center", marginTop: ".3rem" } },
      el("select", { "aria-label": "Côté gardé", "data-tip": "Le côté du plan que l'on résout", style: { flex: "0 0 5.2rem" }, onChange: (e) => set(i, { keep: +e.target.value }) }, [[1, `côté +${AX[c.axis]}`], [-1, `côté −${AX[c.axis]}`]].map(([v, l]) => el("option", { value: v, selected: v === (c.keep < 0 ? -1 : 1) }, l))),
      el("select", { "aria-label": "Condition sur le plan", style: { flex: "1 1 auto", minWidth: 0 }, onChange: (e) => set(i, { bc: e.target.value, ...(e.target.value === "temp" && !Number.isFinite(c.T) ? { T: 25 } : {}) }) },
        Object.entries(CUT_BC).filter(([k]) => (k === "temp" ? heat : k !== "fixed" || o.kind !== "thermal")).map(([k, l]) => el("option", { value: k, selected: k === c.bc, title: l, disabled: k === "sym" && hasSym && symAt !== i }, k === "sym" && hasSym && symAt !== i ? "Symétrie (une seule à la fois)" : l.split(" : ")[0]))),
      c.bc === "temp" ? el("input", { type: "number", "aria-label": "Température du plan (°C)", value: c.T ?? 25, step: "any", style: { flex: "0 0 3.6rem" }, onChange: (e) => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) set(i, { T: v }); } }) : null))));
  rows.push(el("p", { class: "muted small" }, st.cuts.length ? "Symétrie : rien ne traverse le plan — ni déplacement, ni chaleur ; le plan est une frontière bloquée, listée avec les appuis (S1), et un seul plan peut l'être pour l'instant. Les efforts et les puissances que le plan partage sont comptés pour leur part ; la face de coupe n'échange rien avec l'air."
    : "Un produit identique des deux côtés d'un plan, tenu et chargé de même, se résout sur un seul côté. Clic droit sur la pièce : « Couper ici »."));
  sec.append(...rows); sec.setAttribute("data-fold-note", st.cuts.length ? `${st.cuts.length} plan${st.cuts.length > 1 ? "s" : ""}` : "aucune");
  return sec;
}
/** What a right click offers for cuts : a plane through the point shown, square to one of the two axes the face does not look along. */
export function cutMenu(hit, st, apply) {
  if (!hit || !hit.point || !hit.normal) return [];
  const n = hit.normal.map(Math.abs), face = n.indexOf(Math.max(...n)), out = [{ title: "Couper le modèle ici" }];
  for (const a of [0, 1, 2]) if (a !== face) out.push({ label: `Plan ${AX[a]} = ${fr(hit.point[a])} mm`, icon: "section", run: () => { st.cuts = [...st.cuts.filter((c) => c.axis !== a), { axis: a, at: Math.round(hit.point[a] * 100) / 100, keep: 1, bc: "free" }]; apply(); } });
  return out;
}
