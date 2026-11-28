/* DynamiteOrbit.ai — a part made ELSEWHERE, brought in (demande de JP, 28 novembre 2026 : « faire les pièces les plus complexes en 3D dans
   OnShape ou Inventor et les importer comme une nouvelle pièce en stp »). The file is read by the kernel (cad/step_read.js), the tool proposes
   interfaces of the types it has (core/step_interfaces.js), and this dialog shows them grouped by kind — a colour and a pictogram per kind,
   a short title, then what was read — each with its On / Off and, for a through hole, the face it meets its neighbour by. On : confirmed by
   the person, it mates ; Off : kept as a proposal, to confirm later in the part. The material is asked here : the mass measured on the solid
   waits for it. Used by the Assembly (a STEP dropped on it becomes a part placed beside the assembly) and by the part studio. */

import { el, btn, badge, onOff, icon, field, modal, toast, fmtMass, fmtDims, fmtLen } from "../core/dom.js";
import { kernel } from "../cad/client.js";
import { store } from "../core/store.js";
import { underVeil, pageVeil } from "../core/busy.js";
import { stepSpec } from "../core/importer.js";
import { proposeInterfaces, readSummary, projectInterfaces, applyProposals } from "../core/step_interfaces.js";
import { materialMenu, materialLabel, materialOrDefault } from "../cad/materials.js";

/** The kinds of interface a file is read for, in the order the dialog shows them. */
export const KINDS = [
  { type: "bolt_pattern", label: "Bolt patterns", fr: "motifs de vis", icon: "bolt", color: "#2563eb" },
  { type: "pins", label: "Dowel pins", fr: "goupilles", icon: "mate", color: "#ca8a04" },
  { type: "fit", label: "Shaft / bore fits", fr: "arbres et alésages", icon: "lathe", color: "#7c3aed" },
  { type: "planar", label: "Flat faces", fr: "appuis plans", icon: "plate", color: "#64748b" },
];

/** Build the part in the kernel and read its faces. → { built, found } */
export async function readStep(spec) {
  const built = await kernel.build(spec);
  return { built, found: await kernel.recognize(spec.id) };
}

/** The dialog. o : { spec, built, found, title, ok (the label of the button that confirms), later (the label of the one that keeps everything
    as proposals, or null), done({ picks, material, read }) , cancel() }. */
export function proposalsDialog(o) {
  const r = proposeInterfaces(o.found, { have: o.spec.interfaces || [], others: projectInterfaces(store.parts, o.spec.id), dropped: (o.spec.imported || {}).dropped });
  const picks = r.proposals.map((p) => ({ p, on: p.on !== false, flip: false }));
  let material = o.spec.material || "", closed = false;
  const b = o.built, vol = b ? b.volume : 0, box = b ? b.bbox : [0, 0, 0, 0, 0, 0];
  const massLine = el("p", { class: "small", "data-step-mass": "" });
  const showMass = () => { const m = materialOrDefault(material); massLine.replaceChildren(icon(material ? "check" : "warning"), material ? ` Masse : ${fmtMass(vol * m.rho / 1000)} (${m.name}, ${m.rho} g/cm³).` : " Masse : à entrer — elle attend la matière (la densité). La forme, elle, est celle du fichier."); };
  const matSel = el("select", { "data-step-material": "", class: material ? "" : "need", onChange: (e) => { material = e.target.value; e.target.classList.toggle("need", !material); showMass(); } },
    el("option", { value: "" }, "— à entrer —"), materialMenu().map((f) => el("optgroup", { label: f.family }, f.list.map((m) => el("option", { value: m.id, selected: m.id === material }, materialLabel(m))))));
  showMass();
  const head = el("div", { class: "step-read" },
    el("p", { class: "small" }, el("b", null, "Lu dans le fichier : "), `${r.counts.faces} faces, dont ${r.counts.planes} planes et ${r.counts.cyls} cylindriques le long des axes · ${r.counts.holes} trou${r.counts.holes > 1 ? "s" : ""} · volume ${fmtLen(vol / 1000, 2, "cm³")} · boîte ${fmtDims([box[3] - box[0], box[4] - box[1], box[5] - box[2]], 1)}.`),
    field("Matière", matSel, "À entrer : la masse, le DFx et la simulation en dépendent."), massLine);
  const list = el("div", { class: "step-kinds" });
  const draw = () => {
    list.replaceChildren(...KINDS.map((k) => {
      const mine = picks.filter((x) => x.p.type === k.type); if (!mine.length) return null;
      return el("div", { class: "step-kind", style: { "--kind": k.color }, "data-step-kind": k.type },
        el("h4", null, icon(k.icon), ` ${k.label} `, el("span", { class: "muted" }, `· ${k.fr} (${mine.length})`)),
        mine.map((x) => { const shown = x.flip && x.p.alt ? x.p.alt : x.p;
          return el("div", { class: `step-prop${x.on ? "" : " off"}`, "data-step-prop": x.p.id },
            el("div", { class: "step-prop-head" }, onOff(x.on, (on) => { x.on = on; draw(); }, x.p.name), el("b", null, x.p.name), badge(`côté ${x.p.side || "A"}`, x.p.side === "B" ? "b" : "a"), badge(`face ${shown.face}`, "neutral"),
              x.p.alt ? btn("Autre face", () => { x.flip = !x.flip; draw(); }, { small: true, icon: "refresh", tip: `Un trou traversant se rencontre par l'une ou l'autre face : prendre la face ${(x.flip ? x.p : x.p.alt).face}` }) : null,
              badge(x.on ? "confirmée" : "proposée", x.on ? "ok" : "warn")),
            el("p", { class: "small muted" }, x.p.why), x.p.like ? el("p", { class: "small" }, icon("link"), ` Même motif que ${x.p.like} : prêt à s'y emboîter.`) : null);
        }));
    }).filter(Boolean));
    if (!picks.length) list.append(el("p", { class: "muted" }, "Aucune interface reconnue : l'outil ne pose une interface que sur un motif de trous, un alésage, un arbre ou une face plane qui regarde le long d'un axe de la pièce. Ajoutez-la à la main dans la pièce."));
  };
  draw();
  const rest = r.unread.length ? el("details", { class: "step-unread" }, el("summary", null, `Ce qui n'est pas lu (${r.unread.length})`), el("ul", null, r.unread.map((t) => el("li", { class: "small" }, t)))) : null;
  const note = el("p", { class: "muted small" }, icon("info"), " Une interface proposée est un exemple : elle ne s'accouple à rien tant qu'elle n'est pas confirmée (On). La forme du fichier n'est jamais modifiée : les trous, l'alésage, la face y sont déjà.");
  const finish = (all) => { closed = true; m.close(); o.done({ picks: picks.map((x) => ({ ...x, on: all === false ? false : x.on })), material, read: readSummary(o.found, r, new Date().toISOString().slice(0, 10)) }); };
  const m = modal(o.title, [head, list, rest, note, el("div", { class: "form-actions" }, o.later ? btn(o.later, () => finish(false), { tip: "Toutes les interfaces restent des propositions, à confirmer plus tard dans la pièce" }) : null, btn(o.ok, () => finish(true), { primary: true, icon: "check" }))].filter(Boolean),
    { wide: true, onClose: () => { if (!closed && o.cancel) o.cancel(); } });
  m.box.dataset.stepDialog = "";
  return { r, m };
}

/** Where a part brought into an assembly is put : beside what is already there, on the +X side, its bottom at the bottom of the assembly
    (the first part of an empty assembly : at the origin, and fixed). asmBox, partBox : [x0, y0, z0, x1, y1, z1] in mm. */
export function besideAssembly(asmBox, partBox) {
  if (!asmBox || asmBox.every((x) => x === 0)) return [0, 0, 0];
  const gap = Math.max(20, 0.15 * Math.max(asmBox[3] - asmBox[0], asmBox[4] - asmBox[1])), r1 = (x) => Math.round(x * 10) / 10 + 0;
  return [r1(asmBox[3] + gap - partBox[0]), r1((asmBox[1] + asmBox[4]) / 2 - (partBox[1] + partBox[4]) / 2), r1(asmBox[2] - partBox[2])];
}
/** A STEP brought into an assembly : read under a veil, its interfaces proposed, then ONE undoable step that adds the part — its interfaces
    and its material as the dialog left them — and places it beside the assembly. o : { veil (a 3D view : { set: vp.setBusy }), bbox() (of
    the assembly, as it is shown) }. → { kind: "step", id, inst, placed: true } — placed : the screen keeps it, nothing is opened */
export async function stepIntoAssembly(asmId, text, filename, o = {}) {
  const spec = stepSpec(text, filename);
  let read = null;
  try { read = await underVeil(o.veil || pageVeil(), `Lecture de ${filename}…`, () => readStep(spec)); } catch (e) { toast(`${filename} : ${e.message}`, "error", 9000); return { kind: "step", placed: true }; }
  if (!read) return { kind: "step", placed: true };
  return new Promise((res) => proposalsDialog({ spec, built: read.built, found: read.found, title: `Pièce importée : ${spec.name}`, ok: "Confirmer et poser dans l'assemblage", later: "Poser, confirmer plus tard",
    done: ({ picks, material, read: summary }) => {
      const added = applyProposals(spec, picks, summary); if (material) spec.material = material;
      let iid = null;
      store.commit(`STEP importé et posé dans ${asmId} : ${spec.id}`, (p) => {
        p.parts.push(spec);
        const a = p.assemblies.find((x) => x.id === asmId); let n = a.instances.length + 1; do { iid = `i${n++}`; } while (a.instances.some((i) => i.id === iid));
        a.instances.push({ id: iid, part: spec.id, ...(a.instances.length ? {} : { fixed: true }), placement: { t: besideAssembly(o.bbox ? o.bbox() : null, read.built.bbox), r: [0, 0, 0] } });
      }, { assembly: asmId, part: spec.id });
      const on = added.filter((i) => !i.proposed).length;
      toast(`« ${spec.name} » posée à côté de l'assemblage, ${on} interface${on > 1 ? "s" : ""} confirmée${on > 1 ? "s" : ""}${added.length > on ? `, ${added.length - on} à confirmer dans la pièce` : ""}. Glissez sa poignée (au milieu de la pièce) devant une interface compatible : elle s'emboîte.`, "success", 9000);
      res({ kind: "step", id: spec.id, inst: iid, placed: true });
    },
    cancel: () => { kernel.forget(spec.id); toast("Import annulé : rien n'a été ajouté au projet.", "info"); res({ kind: "step", placed: true }); } }));
}
