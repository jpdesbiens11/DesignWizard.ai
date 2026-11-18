/* DesignWizard.ai — what is missing or odd in a load case, said while the designer builds it and before the solver is
   asked. Pure : the tree of the Simulation shows the list, the « Lancer » button waits for what blocks.
   An entry : { level, id (the item of the case, A1 / E2 / Q1 / T1, or null), text, field (the value to look at, when one) }.
   Levels : "error" (the case cannot be solved or means nothing), "todo" (a value the tool invented and the designer
   has not entered or confirmed), "warn" (it will run, but probably not what is meant), "tip". The first two block. */

import { loadDir, supportKey, supportDofs } from "./bc_tree.js";

const n = (v, d = 3) => String(Math.round(v * 10 ** d) / 10 ** d).replace(".", ",");
const ORDER = { error: 0, todo: 1, warn: 2, tip: 3 };
/** What an item still asks : [field] — the values created by default and not yet entered or confirmed. */
export const asks = (x) => (x && typeof x === "object" && Array.isArray(x.ask) ? x.ask : []);
export const ASK_WORDS = { F: ["la force", "N"], p: ["la pression", "MPa"], P: ["la puissance", "W"], T: ["la température", "°C"] };

/** @param st  the load case : { kind, fixed: [regionKey], loads: [{ region, mode, F, dir, p, ask }], power: [{ region, P, ask }],
 *             fixedT: [{ region, T, ask }], conv: { on, h, Tamb }, thermo: { uniform, T, Tref } }
 *  @param o   { regionOk(key) → false when the place no longer exists on the mesh, regionName(key) }
 *  @returns   the entries, the most serious first */
export function caseIssues(st, o = {}) {
  const out = [], ok = o.regionOk || (() => true), name = o.regionName || ((k) => k), add = (level, id, text, field) => out.push({ level, id, text, ...(field ? { field } : {}) });
  const heat = st.kind === "thermal" || (st.kind === "thermo" && !(st.thermo && st.thermo.uniform)), mech = st.kind !== "thermal";
  const gone = (id, key) => { if (!ok(key)) add("error", id, `${id} : sa face n'existe plus sur ce maillage. Correctif : « Choisir dans la vue », puis cliquez la face.`); };
  const todo = (id, x) => { for (const f of asks(x)) { const w = ASK_WORDS[f] || [f, ""]; add("todo", id, `${id} : entrez ${w[0]} (${n(x[f])} ${w[1]} est un exemple).`, f); } };
  if (mech) {
    if (!st.fixed.length) add("error", null, "Le produit n'est tenu nulle part : le calcul n'a pas de réponse. Correctif : clic droit sur une face → « Appui ici ».");
    const keys = st.fixed.map(supportKey);
    st.fixed.forEach((x, i) => { const id = `A${i + 1}`, k = keys[i], d = supportDofs(x); gone(id, k);
      if (!d.some(Boolean)) add("error", id, `${id} ne bloque aucune direction : il ne tient rien. Correctif : cochez X, Y ou Z.`, "dofs");
      if (keys.indexOf(k) < i && d.every((v, j) => v === supportDofs(st.fixed[keys.indexOf(k)])[j])) add("tip", id, `${id} tient le même endroit que A${keys.indexOf(k) + 1} : un seul suffit.`); });
  }
  if (st.kind === "structure") {
    if (!st.loads.length) add("error", null, "Aucun effort : il n'y a rien à calculer. Correctif : clic droit sur une face → « Effort ici ».");
    st.loads.forEach((l, i) => {
      const id = `E${i + 1}`, a = st.fixed.findIndex((x) => supportKey(x) === l.region && supportDofs(x).every(Boolean)); gone(id, l.region); todo(id, l);
      if (a >= 0) add("warn", id, `${id} pousse sur ${name(l.region)}, qui est encastrée (A${a + 1}) : l'effort part droit dans l'appui, la pièce ne travaille pas. Correctif : déplacez l'effort ou l'appui.`);
      if (l.mode !== "pressure" && !loadDir(l)) add("error", id, `${id} : la force n'a pas de direction — ses trois composantes sont nulles. Correctif : donnez-lui une direction.`, "vec");
      if (l.mode === "pressure") { if (l.p === 0) add("warn", id, `${id} : pression nulle, elle ne fait rien.`, "p"); else if (l.p < 0) add("tip", id, `${id} : pression négative — elle tire sur la face, comme une dépression.`, "p"); else if (l.p > 50) add("warn", id, `${id} : ${n(l.p)} MPa, soit ${n(l.p * 10, 0)} bar. Vérifiez l'unité : 1 bar = 0,1 MPa.`, "p"); }
      else if (l.F === 0) add("warn", id, `${id} : force nulle, elle ne fait rien.`, "F"); else if (l.F < 0) add("tip", id, `${id} : force négative — elle agit à l'opposé de la direction donnée. Plus clair : une valeur positive et l'autre sens.`, "F");
    });
  }
  if (st.kind === "thermo" && st.thermo && st.thermo.uniform && st.thermo.T === st.thermo.Tref) add("warn", null, "La température en service est celle du montage : rien ne se dilate, aucune contrainte.");
  if (heat) {
    if (!st.power.length) add(st.fixedT.length > 1 ? "tip" : "error", null, st.fixedT.length > 1 ? "Aucune source : la chaleur va seulement d'une température imposée à l'autre." : "Aucune source de chaleur : il n'y a rien à calculer. Correctif : clic droit sur une face → « Source de chaleur ici ».");
    if (!st.fixedT.length && !(st.conv && st.conv.on)) add("error", null, "La chaleur n'a aucune sortie : la température monterait sans limite. Correctif : cochez la convection, ou imposez une température sur une face.");
    if (st.conv && st.conv.on) { if (!(st.conv.h > 0)) add("error", null, "Convection : le coefficient d'échange doit être positif (air calme : 5 à 15 W/m²·K)."); else if (st.conv.h > 2000) add("warn", null, `Convection de ${n(st.conv.h, 0)} W/m²·K : au-delà d'une plaque froide à eau. Vérifiez la valeur.`); }
    st.power.forEach((x, i) => { const id = `Q${i + 1}`; gone(id, x.region); todo(id, x); if (!(x.P > 0)) add("warn", id, `${id} : une source de ${n(x.P)} W ${x.P < 0 ? "retire de la chaleur — est-ce voulu ?" : "ne chauffe pas."}`, "P");
      if (st.fixedT.some((t) => t.region === x.region)) add("warn", id, `${id} chauffe ${name(x.region)}, qui est tenue à une température : la chaleur repart aussitôt, sans traverser la pièce.`); });
    st.fixedT.forEach((x, i) => { const id = `T${i + 1}`; gone(id, x.region); todo(id, x); if (x.T < -273.15) add("error", id, `${id} : ${n(x.T)} °C est sous le zéro absolu.`, "T"); });
  }
  return out.sort((a, b) => ORDER[a.level] - ORDER[b.level]);
}
/** The entries that must be dealt with before a run. */
export const blocking = (list) => (list || []).filter((x) => x.level === "error" || x.level === "todo");
