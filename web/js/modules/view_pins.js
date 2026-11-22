/* DynamiteOrbit — messages pinned on the 3D. A right click on a face writes a message at that very point of the part ; it
   shows in the view as a numbered mark, is answered and closed from its card, belongs to the thread of its artefact (Équipe)
   and travels in the mirror like any message. A pin is kept in the coordinates of the part — in an assembly, with the
   instance it was put on, so it follows the part when the assembly moves. Shared by the part studio and the assembly. */

import { el, btn, toast, modal, promptBox } from "../core/dom.js";
import { store } from "../core/store.js";
import { post, setDone, pinsOf, labelOf } from "../core/team.js";
import { memberName } from "./team.js";

const day = (s) => String(s || "").slice(0, 16).replace("T", " ");
/* a point of an object, where the object now stands in the view (column-major 4 × 4, as three.js keeps it) */
const through = (e, [x, y, z]) => [e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]];

/** Mounts the pins of one artefact on a viewport. o : { key: () => "part:ID" | "assembly:ID" }. → { draw, menu(hit), dispose } */
export function mountPins(vp, o) {
  const viewer = vp.viewer;
  /* where a pin is in the view : on its instance when it has one, else as it was written */
  const world = (pin) => { if (!pin.inst) return pin.at;
    const obj = [...viewer.objects.values()].find((x) => x.def.data && x.def.data.inst === pin.inst && x.group.visible); return obj ? through(obj.group.matrixWorld.elements, pin.at) : null; };
  function draw() {
    viewer.clearOverlays("pin"); if (!store.project) return;
    for (const x of pinsOf(store.project, o.key())) { const at = world(x.msg.pin); if (!at) continue;
      const b = viewer.addLabel(at, String(x.n), "pin", `pin${x.open ? "" : " done"}`, () => card(x.msg.id));
      b.dataset.tip = `@${x.msg.by} : ${x.msg.text}${x.replies.length ? ` (${x.replies.length} réponse${x.replies.length > 1 ? "s" : ""})` : ""}`; b.setAttribute("aria-label", `Message épinglé ${x.n}`); }
  }
  async function write(hit) {
    const by = await memberName(); if (!by) return;
    const text = await promptBox("Épingler un message ici", "Message", "", "« @nom » appelle un membre. Le message reste attaché à cet endroit de la pièce, et part avec le projet."); if (!text) return;
    const inst = hit.def && hit.def.data ? hit.def.data.inst : null;
    try { store.commit("Message épinglé", (x) => { post(x, { by, on: o.key(), text, date: new Date(), pin: { at: hit.local, ...(inst ? { inst } : {}) } }); }); } catch (e) { toast(e.message, "error", 6000); }
  }
  /* the card of a pin : the message, its answers, an answer to write, the box that closes it */
  function card(id) {
    const body = el("div"); let off = () => {};
    const m = modal("Message épinglé", body, { float: true, onClose: () => off() });
    const line = (q) => el("div", { class: "param", style: { gridTemplateColumns: "minmax(0,1fr)", marginBottom: ".3rem" } }, el("div", null, el("b", null, `@${q.by}`), el("small", { class: "muted" }, ` ${day(q.at)}`), el("div", null, q.text)));
    const paint = () => { const p = store.project, x = p ? pinsOf(p, o.key()).find((q) => q.msg.id === id) : null; if (!x) { m.close(); return; }
      const input = el("input", { type: "text", placeholder: "Répondre… @nom appelle un membre", "aria-label": "Réponse" });
      const send = async () => { const v = input.value.trim(); if (!v) return; const by = await memberName(); if (!by) return; try { store.commit("Réponse à un message épinglé", (y) => { post(y, { by, re: id, text: v, date: new Date() }); }); } catch (e) { toast(e.message, "error", 6000); } };
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
      body.replaceChildren(el("p", { class: "muted small" }, `Repère ${x.n} — ${labelOf(p, o.key())}`), line(x.msg), ...x.replies.map(line),
        el("div", { style: { display: "flex", gap: ".4rem", alignItems: "center", margin: ".4rem 0" } }, el("div", { style: { flex: "1 1 auto" } }, input), btn("Répondre", send, { small: true, icon: "check" })),
        el("div", { class: "form-actions", style: { justifyContent: "space-between" } }, el("label", { class: "check", "data-tip": "Coché : la demande est traitée, pour tout le monde" },
          el("input", { type: "checkbox", checked: !!x.msg.done, onChange: (e) => store.commit(e.target.checked ? "Message traité" : "Message rouvert", (y) => { setDone(y, id, (y.team && y.team.owner) || x.msg.by, e.target.checked, new Date()); }) }), "fait"),
          el("a", { class: "btn btn-small", href: `#/team/${encodeURIComponent(o.key())}`, onClick: () => m.close() }, "Voir le fil dans Équipe")));
    };
    off = store.on("change", paint); paint();
  }
  const menu = (hit) => (hit && hit.local ? [{ label: "Épingler un message ici…", icon: "edit", run: () => write(hit) }] : []);
  const offStore = store.on("change", draw);
  return { draw, menu, dispose: () => offStore() };
}
