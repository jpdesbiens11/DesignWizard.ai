/* DesignWizard.ai — Assemblage : a sub-assembly seen from its parent (demande de JP : « Sous-assemblages »). An assembly goes
   into another one as ONE instance : it is put together in its own document and carried here as a rigid whole — its card on the
   right says what it holds and how it can be joined ; the dialog « Ajouter » offers the assemblies that can go in (never one
   that holds this one) ; the bill of materials reads flat (every part through the levels) or by level.
   The model is core/asm_levels.js ; this module draws it. */

import { el, icon, btn, badge, table, fmtMass, fmtDims, unitInput } from "../core/dom.js";
import { store } from "../core/store.js";
import { canHold, flatAsm, partCounts, bomLevels } from "../core/asm_levels.js";
import { hardware } from "../core/assembly_logic.js";

const find = (id) => store.assembly(id);
const partName = (id) => { const s = store.part(id); return s ? s.name || s.id : id; };

/** The card of the sub-assembly selected in its parent. o : { inst, ctx, fix(), remove(), move(k, v) } */
export function subTab(body, o) {
  const { inst, ctx } = o, sub = find(inst.asm), g = (ctx.asm.groups || {})[inst.id], leaves = ctx.asm.instances.filter((i) => i.group === inst.id);
  const drop = btn("Retirer", o.remove, { small: true, icon: "trash", danger: true });
  if (!sub || !g) {      // gone from the project, or it would contain this assembly : nothing of it is built — what it was, and the way out
    body.append(el("h3", null, inst.asm), el("p", { class: "atelier-hint warn" }, icon("warning"), sub ? ` Ce sous-assemblage contient déjà cet assemblage : il se contiendrait lui-même. Il est laissé de côté.` : ` Le sous-assemblage ${inst.asm} n'est plus dans le projet : rien de lui n'est construit. Ctrl + Z s'il vient d'être supprimé.`),
      el("div", { class: "form-actions", style: { justifyContent: "flex-start" } }, drop)); return; }
  const m = ctx.sol.placements[inst.id], mass = leaves.reduce((s, i) => s + (ctx.built[i.part] ? ctx.built[i.part].mass : 0), 0), used = new Set((ctx.asm.mates || []).flatMap((k) => [`${k.a.inst}/${k.a.iface}`, `${k.b.inst}/${k.b.iface}`]));
  body.append(el("h3", null, icon("assembly"), " ", sub.name || sub.id),
    el("p", { class: "muted", style: { fontSize: ".84rem" } }, `${sub.id} · sous-assemblage · occurrence ${inst.id} · ${leaves.length} pièce${leaves.length > 1 ? "s" : ""} · ${fmtMass(mass)}${m ? ` · position ${fmtDims([m[12], m[13], m[14]], 1).replace(/ × /g, " ; ")}` : ""}`),
    el("div", { class: "form-actions", style: { justifyContent: "flex-start" } }, el("a", { class: "btn btn-small btn-primary", href: `#/assembly/${encodeURIComponent(sub.id)}` }, icon("edit"), "Ouvrir le sous-assemblage"),
      btn(inst.fixed ? "Libérer" : "Fixer", o.fix, { small: true, icon: "lock", tip: inst.fixed ? "Il suit de nouveau ses accouplements" : "Il porte les autres : sa place ne dépend d'aucun accouplement" }), drop),
    el("p", { class: "atelier-hint" }, icon("info"), " Un sous-assemblage se monte dans son propre document et se porte ici d'un seul bloc : ses pièces gardent entre elles la place qu'elles y ont, et il suffit qu'une seule soit accouplée pour que tout suive. Pour le modifier, ouvrez-le."));
  const counts = [...partCounts(sub, find)];
  body.append(el("div", { class: "side-section", "data-fold-note": `${leaves.length} pièce${leaves.length > 1 ? "s" : ""}` }, el("h3", null, `Ce qu'il contient (${leaves.length})`),
    counts.map(([id, n]) => el("p", { style: { fontSize: ".86rem", margin: "0 0 .25rem" } }, icon("part"), " ", el("b", null, partName(id)), el("span", { class: "muted" }, ` — ${id}${n > 1 ? ` × ${n}` : ""}`)))));
  /* how it joins this assembly : the interfaces of its parts that no joint uses — inside it or here */
  const free = leaves.flatMap((i) => ((ctx.built[i.part] || {}).interfaces || []).map((it) => ({ i, it }))), open = free.filter((f) => !used.has(`${f.i.id}/${f.it.id}`)), mated = free.filter((f) => (ctx.asm.mates || []).some((k) => !k.of && ((k.a.inst === f.i.id && k.a.iface === f.it.id) || (k.b.inst === f.i.id && k.b.iface === f.it.id))));
  body.append(el("div", { class: "side-section", "data-fold-note": `${mated.length} accouplée${mated.length > 1 ? "s" : ""}, ${open.length} libre${open.length > 1 ? "s" : ""}` }, el("h3", null, `Ses interfaces vers cet assemblage (${mated.length + open.length})`),
    [...mated.map((f) => [f, true]), ...open.map((f) => [f, false])].map(([f, on]) => el("p", { style: { fontSize: ".86rem", margin: "0 0 .3rem" } }, badge(f.it.side, f.it.side === "B" ? "b" : "a"), " ", el("b", null, f.it.name), el("span", { class: "muted" }, ` — ${partName(f.i.part)}`), on ? " — accouplée ici" : f.it.external ? " — externe" : " — libre")),
    !mated.length && !open.length ? el("p", { class: "muted" }, "Toutes les interfaces de ses pièces sont prises à l'intérieur : il ne peut pas s'accoupler ici. Laissez une interface libre dans le sous-assemblage, ou placez-le à la main.") : null));
  if (!ctx.sol.placedBy[inst.id] && !inst.fixed) {
    const t = (inst.placement && inst.placement.t) || [0, 0, 0];
    body.append(el("div", { class: "side-section" }, el("h3", null, "Position manuelle"), el("div", { class: "form-row" }, ["X", "Y", "Z"].map((ax, k) => { const u = unitInput(ax, { value: t[k], step: "1" }, (v) => o.move(k, v || 0), { event: "onChange", length: true });
      return el("label", { class: "field", style: { minWidth: "70px" } }, el("span", { class: "field-label" }, u.label), u.input); }))));
  }
}

/** The assemblies that can go into `a`, as cards for the dialog « Ajouter » : one that holds `a` is shown, greyed, with the reason. */
export function subChoices(a, pick) {
  return store.assemblies.filter((x) => x.id !== a.id).map((x) => { const ok = canHold(a, x, find), n = (flatAsm(x, find).instances || []).length;
    return el("button", { class: "card lift", type: "button", disabled: !ok, "data-sub": x.id, "data-tip": ok ? "Il se porte d'un seul bloc ; ses interfaces libres s'accouplent aux pièces de cet assemblage" : `${x.id} contient déjà ${a.id} : un assemblage ne peut pas se contenir lui-même`, onClick: () => pick(x.id) },
      el("h3", null, icon("assembly"), " ", x.name || x.id), el("p", { class: "muted", style: { margin: 0, fontSize: ".82rem" } }, `${x.id} · ${n} pièce${n > 1 ? "s" : ""}${ok ? "" : " · contient déjà cet assemblage"}`)); });
}

/** The bill of materials by level : a sub-assembly is one line, what ONE of it holds comes under it — its parts, its own
    sub-assemblies, then the hardware of its own joints. → [{ level, kind: "part" | "assembly" | "hardware", id, name, qty, lost? }] */
export function levelRows(ctx, asm) {
  const out = [], own = (doc) => { const f = flatAsm(doc, find) || { instances: [], mates: [] }; return hardware({ ...f, mates: (f.mates || []).filter((m) => !m.of) }, ctx.built); };
  const walk = (doc, level, trail) => {
    for (const r of bomLevels(doc, find).filter((x) => x.level === 0)) {
      if (r.kind === "part") { out.push({ ...r, level, name: partName(r.id) }); continue; }
      const sub = find(r.id), ok = !!sub && !r.lost && !trail.includes(r.id);
      out.push({ ...r, level, name: sub ? sub.name || sub.id : "absent du projet", ...(ok ? {} : { lost: true }) }); if (ok) walk(sub, level + 1, [...trail, doc.id]);
    }
    for (const h of own(doc)) out.push({ level, kind: "hardware", id: h.id, name: `${h.name}${h.unit ? ` (${h.unit})` : ""}`, qty: h.qty });
  };
  walk(asm, 0, [asm.id]);
  return out;
}
/** The table and the CSV of the bill of materials by level. */
export const levelTable = (rows) => table(["Niv.", "Référence", "Désignation", "Qté"], rows.map((r) => [String(r.level + 1), el("code", { style: { marginLeft: `${r.level * 0.9}rem` } }, r.kind === "assembly" ? icon("assembly") : null, r.kind === "assembly" ? " " : "", r.id), r.name, String(r.qty).replace(".", ",")]));
export const levelCsv = (rows) => "﻿Niveau;Type;Reference;Designation;Quantite\n" + rows.map((r) => [r.level + 1, r.kind === "assembly" ? "sous-assemblage" : r.kind === "hardware" ? "visserie" : "piece", r.id, `"${(r.name || "").replace(/"/g, '""')}"`, r.qty].join(";")).join("\n");
