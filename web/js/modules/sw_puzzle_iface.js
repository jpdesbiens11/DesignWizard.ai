/* DynamiteOrbit.ai — Logiciel : the INTERFACE BLOCK of a piece of the puzzle (JP, 25 novembre 2026 : « dupliquer une fonction pour la mettre à
   3 places mais pouvoir ouvrir un bloc d'interface où on voit la combinaison de tout… compris d'un coup d'œil »).
   One picture, no wire : in the middle the piece, big ; against its left, what it takes, snapped in ; on its right, every place it goes — each
   one with the piece's tab in its notch. One sentence : one piece, n places ; changing its values changes them everywhere.
   What it follows : a non-modal dialog (role dialog, Esc closes, focus to it) ; the « where used » list of a CAD part, drawn. */

import { el, btn } from "../core/dom.js";
import { pieceInterface } from "../sw/sw_puzzle.js";
import { BANDS } from "../sw/sw_puzzle.js";
import { SIGNAL_TYPES, keyPath } from "../sw/sw_blocks.js";
import { physText } from "../sw/sw_units.js";

const NS = "http://www.w3.org/2000/svg";
const S = (tag, a = {}, ...kids) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(a)) if (v !== null && v !== undefined) n.setAttribute(k, v); for (const c of kids.flat()) if (c) n.append(c); return n; };
const col = (p) => (BANDS.find((b) => b.id === p.band) || BANDS[1]).color;
const cut = (s, n) => (String(s).length > n ? `${String(s).slice(0, n - 1)}…` : String(s));
const W = 170, H = 50, G = 10;
/** A piece as one shape : body, tab on the right, notches on the left. */
function shape(x, y, h, p, out, ins, value) {
  const right = out ? keyPath(out, W, h / 2, 1, 7, 9) : "", left = [...ins].sort((a, b) => b.y - a.y).map((q) => keyPath(q.type, 0, q.y, -1, 7, 9)).join(" ");
  const g = S("g", { transform: `translate(${x} ${y})`, class: "swi-piece", style: `--dom:${col(p)}` }, S("path", { d: `M 8 0 L ${W - 8} 0 Q ${W} 0 ${W} 8 ${right} L ${W} ${h - 8} Q ${W} ${h} ${W - 8} ${h} L 8 ${h} Q 0 ${h} 0 ${h - 8} ${left} L 0 8 Q 0 0 8 0 Z`, class: "swi-body" }),
    out ? S("path", { d: keyPath(out, W, h / 2, 1, 7, 9).replace(/^L/, "M"), class: "swp-tab", style: `--key:${SIGNAL_TYPES[out].color}` }) : null,
    ...ins.map((q) => S("path", { d: keyPath(q.type, 0, q.y, -1, 7, 9).replace(/^L/, "M"), class: "swp-tab", style: `--key:${SIGNAL_TYPES[q.type].color}` })),
    S("text", { x: 14, y: h / 2 - (value ? 3 : -5), class: "swi-t" }, cut(p.title, 20)), value ? S("text", { x: 14, y: h / 2 + 14, class: "swi-v" }, value) : null);
  return g;
}
/** Opens the interface block of piece `id` over `host`. o : { onPick, value(ref) } → { close } */
export function swIface(host, design, id, o = {}) {
  for (const x of host.querySelectorAll(".swi")) x.remove();
  const I = pieceInterface(design, id); if (!I.piece) return { close() {} };
  const p = I.piece, vText = (q) => { if (!q.show || !o.value) return ""; const v = o.value(q.show.ref); return q.show.unit === "0/1" ? (v === 1 ? "ACTIF" : "repos") : physText(v, q.show.unit); };
  const takes = I.takes, gives = I.gives, n = gives.length, tall = Math.max(H, takes.length * (H + G) - G), rows = Math.max(1, n), hR = rows * (H + G) - G, h = Math.max(tall, hR), mid = (h - tall) / 2;
  const svg = S("svg", { class: "swi-svg", viewBox: `-4 -4 ${W * 4 + 70} ${h + 8}`, width: W * 4 + 70, role: "img", "aria-label": `${p.title} : ce qu'elle prend, et les ${n} endroits où elle va` });
  const ins = takes.map((t, i) => ({ y: i * (H + G) + H / 2, type: t.type }));
  takes.forEach((t, i) => svg.append(shape(0, mid + i * (H + G), H, t.piece, t.type, [], `${t.loop ? "↺ pas d'avant · " : ""}${vText(t.piece)}`)));
  const out = gives[0] ? gives[0].type : null; svg.append(shape(takes.length ? W : W, mid, tall, p, null, takes.length ? ins : [], vText(p)));
  const hub = S("g", { class: "swi-hub" }); svg.append(hub);
  gives.forEach((g, i) => { const y = (h - hR) / 2 + i * (H + G); svg.append(shape(W * 2 + 40, y, H, p, g.type, [], "jumeau"), shape(W * 3 + 40, y, H, g.piece, null, [{ y: H / 2, type: g.type }], vText(g.piece))); });
  if (out) svg.append(S("text", { x: W * 2 + 20, y: h / 2 + 6, "text-anchor": "middle", class: "swi-eq" }, "="));
  const box = el("div", { class: "swi", role: "dialog", "aria-label": `Bloc d'interface : ${p.title}`, tabindex: "-1", style: `--dom:${col(p)}`, onKeydown: (e) => { if (e.key === "Escape") { e.stopPropagation(); api.close(); } } },
    el("header", null, el("b", null, `${p.title} — le bloc d'interface`), btn("×", () => api.close(), { small: true, tip: "Fermer (Échap)" })),
    el("p", { class: "swi-say" }, n > 1 ? `Une seule pièce, branchée à ${n} endroits. À gauche, ce qu'elle prend ; à droite, chaque endroit où elle va. Changer ses valeurs les change partout.` : n === 1 ? "Une seule pièce, branchée à un endroit." : "Cette pièce ne nourrit rien : c'est le bout d'une rangée."),
    svg,
    el("p", { class: "swi-keys" }, [...new Set([...takes, ...gives].map((x) => x.type))].map((t) => el("span", { style: `--key:${SIGNAL_TYPES[t].color}` }, el("i"), SIGNAL_TYPES[t].fr))),
    el("div", { class: "swi-foot" }, btn("Ouvrir sa fiche", () => { api.close(); if (o.onPick) o.onPick({ obj: p.id }); }, { small: true, icon: "edit" })));
  box.dataset.swIface = p.id; host.append(box); box.focus();
  const api = { close() { box.remove(); } };
  return api;
}
