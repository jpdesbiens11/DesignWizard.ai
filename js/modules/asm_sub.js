/* DynamiteOrbit.ai — Assemblage : a sub-assembly seen from its parent (demande de JP : « Sous-assemblages »). An assembly goes
   into another one as ONE instance : it is put together in its own document and carried here as a rigid whole — its card on the
   right says what it holds and how it can be joined ; the dialog « Ajouter » offers the assemblies that can go in (never one
   that holds this one) ; the bill of materials reads flat (every part through the levels) or by level.
   Forming a sub-assembly from parts already placed : a dialog — a name, the instances to tick, and, live, what will happen (the
   joints that go inside, those that stay, what would only be put by hand, the variants that let go) ; dissolving is a button
   of the card. The models are core/asm_levels.js and core/asm_form.js ; this module draws them. */

import { el, clear, icon, btn, badge, field, modal, table, fmtMass, fmtDims, unitInput } from "../core/dom.js";
import { formPlan } from "../core/asm_form.js";
import { isSub } from "../core/asm_levels.js";
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
      btn(inst.fixed ? "Libérer" : "Fixer", o.fix, { small: true, icon: "lock", tip: inst.fixed ? "Il suit de nouveau ses accouplements" : "Il porte les autres : sa place ne dépend d'aucun accouplement" }),
      o.dissolve ? btn("Dissoudre", o.dissolve, { small: true, icon: "explode", tip: "Remplacer le bloc par ce qu'il contient : ses pièces et ses accouplements remontent dans cet assemblage, à la même place. Le sous-assemblage reste dans le projet ; Ctrl + Z pour revenir." }) : null, drop),
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

/** The dialog « Former un sous-assemblage » : the instances of the assembly to tick — parts, then sub-assemblies —, a name, and what
    will happen, said before it is done. Nothing is invented : the action waits for a name and for one instance at least.
    o : { asm, pre: [instance ids ticked], nameOf(instance) → text, done(chosen ids, name) } */
export function formDialog(o) {
  const a = o.asm, picked = new Set((o.pre || []).filter((x) => a.instances.some((i) => i.id === x))), sum = el("div", { class: "form-sum", role: "status", "aria-live": "polite" });
  const name = el("input", { type: "text", placeholder: "ex. Plateau électronique, Module moteur", "aria-label": "Nom du sous-assemblage", "data-field": "sub-name" });
  const go = btn("Former le sous-assemblage", () => { if (go.disabled) return; m.close(); o.done(a.instances.filter((i) => picked.has(i.id)).map((i) => i.id), name.value.trim()); }, { primary: true, icon: "assembly" });
  const line = (kind, text) => el("p", { class: `atelier-hint${kind === "warn" ? " warn" : ""}`, style: { margin: ".3rem 0" } }, icon(kind === "warn" ? "warning" : "info"), ` ${text}`), named = (ids) => ids.map((x) => o.nameOf(a.instances.find((i) => i.id === x))).join(", ");
  const say = () => {
    const plan = formPlan(a, [...picked]), n = plan.ids.length; clear(sum);
    if (!n) sum.append(line("info", "Cochez les pièces qui partent ensemble : elles reviendront ici d'un seul bloc."));
    else { sum.append(line("info", `${n} élément${n > 1 ? "s" : ""} en un bloc · ${plan.inner.length} accouplement${plan.inner.length > 1 ? "s" : ""} passe${plan.inner.length > 1 ? "nt" : ""} à l'intérieur · ${plan.across.length} reste${plan.across.length > 1 ? "nt" : ""} entre le bloc et cet assemblage. Rien ne bouge.`));
      if (plan.ground) sum.append(line("info", "La pièce fixe en fait partie : le bloc devient ce qui porte l'assemblage."));
      if (plan.loose.length) sum.append(line("warn", `Aucun accouplement ne relie ${named(plan.loose)} aux autres pièces cochées : dans le bloc, ${plan.loose.length > 1 ? "elles resteront posées où elles sont" : "elle restera posée où elle est"}, sans être tenue${plan.loose.length > 1 ? "s" : ""}. Un bloc se choisit autour de ce qui le porte.`));
      if (!plan.across.length && n < a.instances.length) sum.append(line("warn", "Aucun accouplement ne reliera le bloc au reste : il restera posé là où il est."));
      if (plan.variants.length) sum.append(line("warn", `${plan.variants.length > 1 ? "Les variantes" : "La variante"} ${plan.variants.map((v) => `« ${v} »`).join(", ")} ne retiendr${plan.variants.length > 1 ? "ont" : "a"} plus ces pièces : une variante ne règle pas l'intérieur d'un sous-assemblage.`)); }
    if (n && !name.value.trim()) sum.append(line("info", "Donnez-lui un nom : c'est un assemblage à part entière, avec son dessin, sa gamme et sa révision."));
    go.disabled = !n || !name.value.trim();
  };
  const row = (i) => el("label", { class: "check pick-row" }, el("input", { type: "checkbox", checked: picked.has(i.id), "data-pick": i.id, onChange: (e) => { if (e.target.checked) picked.add(i.id); else picked.delete(i.id); say(); } }),
    icon(isSub(i) ? "assembly" : "part"), el("span", { class: "grow" }, o.nameOf(i)), el("small", { class: "muted" }, i.id), i.off ? el("span", { class: "off-chip" }, "Off") : i.fixed ? badge("fixe", "neutral") : null);
  const parts = a.instances.filter((i) => !isSub(i)), subs = a.instances.filter(isSub), group = (color, mark, title, list) => (list.length ? [el("h3", { class: "pick-head", style: { "--pick": color } }, icon(mark), ` ${title} (${list.length})`), el("div", { class: "pick-rows" }, list.map(row))] : []);
  name.addEventListener("input", say); name.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); go.click(); } });
  const m = modal("Former un sous-assemblage", [el("p", { class: "muted" }, "Les éléments cochés quittent cet assemblage ensemble et y reviennent d'un seul bloc : un assemblage à part entière. Chaque pièce reste où elle est."),
    field("Nom du sous-assemblage", name), ...group("#0c66e4", "part", "Pièces", parts), ...group("#7a5af8", "assembly", "Sous-assemblages", subs), sum,
    el("div", { class: "form-actions" }, btn("Annuler", () => m.close()), go)], { wide: true });
  say(); setTimeout(() => name.focus(), 60);
  return m;
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
