/* DynamiteOrbit.ai — Logiciel : what the seven screens of the group share (choix cliqué de JP, 21 novembre 2026 : « Cycle en V »).
   THE V, drawn above every screen of the group as the flow of the PCBA is drawn above its screen : the left branch goes down (define, design,
   simulate the model), the code sits at the bottom, the right branch goes up (prove, deliver) ; the steps made for each other are joined by a
   dashed line — the requirements and the verification that proves them, the design and the simulation that tries it. Each box says where its
   step stands ; a click (or Entrée) opens it. What it follows : the V-model of the trade (each phase of design has its phase of test) and the
   flow diagram of the PCBA screen of this tool.
   THE STEP CARD, at the head of the left panel : the step in plain words, what one does, where it stands, its pages (« Tuiles · Valeurs »,
   « En direct · Démarrage ») and the words of the trade it uses ; the step before and after. sw/sw_steps.js decides it all. */

import { el, icon, btn } from "../core/dom.js";
import { VSTEPS, STEPS as PAGES, vStates, vstepOf, wordsIn } from "../sw/sw_steps.js";

const NS = "http://www.w3.org/2000/svg", S = (tag, attrs = {}, ...kids) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs || {})) if (v !== null && v !== undefined && v !== false) { if (k.startsWith("on")) n.addEventListener(k.slice(2).toLowerCase(), v); else n.setAttribute(k, v); } for (const c of kids.flat()) if (c !== null && c !== undefined) n.append(c); return n; };
/* where each box stands in the V : x of its left edge, y of its top */
const POS = { req: [6, 2], arch: [176, 26], design: [346, 50], sim: [516, 74], code: [686, 96], verify: [856, 50], release: [1026, 2] }, BW = 148, BH = 38;
/** The address of a step, and of one of its pages. */
export const vHash = (key, page = "") => `#/${vstepOf(key).mod}${page ? `/${page}` : ""}`;

/** The V. → an element : the diagram, and a line that says the reference the project follows */
export function vBand(d, cpu, cur, run, std) {
  const st = vStates(d, cpu, run), svg = S("svg", { class: "swv-band", viewBox: "0 0 1180 138", role: "group", "aria-label": "Le cycle en V du logiciel : sept étapes", "data-sw-v": "" });
  const mid = (k) => [POS[k][0] + BW / 2, POS[k][1] + BH / 2];
  svg.append(S("text", { class: "swv-branch", x: 6, y: 132 }, "Définir et concevoir ↘"), S("text", { class: "swv-branch", x: 1174, y: 132, "text-anchor": "end" }, "↗ Prouver et livrer"));
  for (const [a, b] of [["req", "verify"], ["design", "sim"]]) { const [x1, y1] = mid(a), [x2, y2] = mid(b); svg.append(S("path", { class: "swv-pair", d: `M${x1 + BW / 2} ${y1}L${x2 - BW / 2} ${y2}` })); }
  VSTEPS.forEach((s, i) => { const nx = VSTEPS[i + 1]; if (!nx) return; const [x1, y1] = POS[s.key], [x2, y2] = POS[nx.key]; svg.append(S("path", { class: "swv-arrow", d: `M${x1 + BW} ${y1 + BH / 2}L${x2 - 4} ${y2 + BH / 2}` })); });
  for (const s of VSTEPS) {
    const [x, y] = POS[s.key], state = st[s.key].state, on = s.key === cur, go = () => { location.hash = vHash(s.key); };
    svg.append(S("g", { class: `swv-node ${state}${on ? " on" : ""}`, tabindex: "0", role: "button", "aria-current": on ? "step" : null, "data-sw-v-step": s.key, "aria-label": `${s.n}. ${s.title} — ${st[s.key].text}`, style: `--dom:${s.color}`,
      onClick: go, onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } } },
      S("title", null, `${s.n}. ${s.long} — ${st[s.key].text}`),
      S("rect", { x, y, width: BW, height: BH, rx: 8 }), S("rect", { class: "swv-dom", x, y, width: 5, height: BH, rx: 2 }),
      S("text", { class: "swv-label", x: x + 13, y: y + 16 }, `${s.n}. ${s.title}`, state === "done" ? S("tspan", { class: "swv-ok" }, " ✓") : null),
      S("text", { class: "swv-en", x: x + 13, y: y + 30 }, s.en)));
  }
  return el("div", { class: "swv-head" }, svg, el("p", { class: "swv-std", "data-sw-std": "" }, icon("lock"), " ", std));
}
/** The card of the step, at the head of the left panel. page : the page shown (a key of PAGES) or "". go(page) : open another page of the step. */
export function stepCard(d, cpu, cur, page, run, go) {
  const s = vstepOf(cur), st = vStates(d, cpu, run)[cur], i = VSTEPS.indexOf(s), prev = VSTEPS[i - 1], next = VSTEPS[i + 1], P = PAGES.find((x) => x.key === page);
  const words = wordsIn(`${s.plain} ${s.do} ${P ? `${P.plain} ${P.do}` : ""}`);
  return el("div", { class: "side-section sw-stepcard", "data-sw-step": s.key, "data-fold-note": `étape ${s.n} sur ${VSTEPS.length}`, style: `--dom:${s.color}` }, el("h3", null, `Étape ${s.n} — ${s.long}`),
    s.pages.length > 1 ? el("div", { class: "seg sw-pages", role: "tablist", "aria-label": "Les pages de l'étape" }, s.pages.map((k) => { const q = PAGES.find((x) => x.key === k), b = btn(q.title === "Objets" ? "Tuiles" : q.title, () => go(k), { small: true, cls: k === page ? "on" : "" }); b.setAttribute("role", "tab"); b.setAttribute("aria-selected", k === page ? "true" : "false"); b.dataset.swPage = k; return b; })) : null,
    el("p", { class: "sw-plain", "data-sw-plain": "" }, el("span", { class: "sw-tag" }, "En clair"), " ", s.plain), el("p", null, el("span", { class: "sw-tag do" }, "On fait"), " ", P && s.pages.length > 1 ? P.do : s.do),
    el("p", { class: `sw-state ${st.state}`, "data-sw-state-of": st.state }, icon(st.state === "done" ? "check" : st.state === "todo" ? "warning" : "info"), " ", st.text),
    words.length ? el("details", { class: "sw-words", "data-sw-words": String(words.length) }, el("summary", null, `Les mots de cette étape (${words.length})`), el("dl", null, words.flatMap((w) => [el("dt", null, w.word, el("small", null, ` — ${w.en}`)), el("dd", null, w.says)]))) : null,
    el("div", { class: "sw-nav" }, prev ? btn(`← ${prev.n}. ${prev.title}`, () => { location.hash = vHash(prev.key); }, { small: true, tip: prev.long }) : el("span"), next ? (() => { const b = btn(`${next.n}. ${next.title} →`, () => { location.hash = vHash(next.key); }, { small: true, primary: st.state === "done", tip: next.long }); b.dataset.swNext = next.key; return b; })() : null));
}
/** The frame of a screen of the group : the V above, the studio below. → { page, head, left, view, right, studio } */
export function swShell(main, viewCls = "") {
  const head = el("div", { class: "swv-top" }), left = el("aside", { class: "side" }), view = el("div", { class: `viewport ${viewCls}` }), right = el("aside", { class: "side right" }), studio = el("div", { class: "studio swv-body" }, left, view, right), page = el("div", { class: "swv-page" }, head, studio);
  main.append(page); return { page, head, left, view, right, studio };
}
