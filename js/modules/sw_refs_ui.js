/* DynamiteOrbit.ai — Logiciel › Références (demande de JP, 25 novembre 2026 : « ajouter une section Références dans le bas du menu Logiciel
   afin de pointer efficacement vers ces références quand tu les cites »). The last tile of the group Logiciel (#/swref, #/swref/<id>) :
   left, the subjects, each with its colour and pictogram ; centre, the references of the subject, numbered as the screens cite them [n] —
   title, publisher, date, HOW IT WAS READ, what it says that the tool uses, the screens that cite it, and the link to the document ;
   right, the one chosen, and what no source read says. A screen cites with refCite(id) : a small [n] that opens this page on that line.
   The list is sw/sw_refs.js. What it follows : the numbered bibliography of a technical report, the reading levels of the platform's
   register (Aide). */

import { el, icon, clear } from "../core/dom.js";
import { registerModule, setGuide } from "../core/app.js";
import { METHOD_HOW } from "../core/methods.js";
import { REFS, REF_TOPICS, REF_GAPS, refOf, refNumber } from "../sw/sw_refs.js";
import { swShell } from "./sw_vband.js";

/** A citation on any screen : [n], a link that opens the references on this line. */
export function refCite(id) { const r = refOf(id); if (!r) return el("span", null, ""); return el("a", { class: "ref-cite", href: `#/swref/${encodeURIComponent(id)}`, "data-ref-cite": id, "data-tip": `${r.title} — ${r.by}` }, `[${refNumber(id)}]`); }

function render(main, args = []) {
  clear(main);
  const { head, left, view, right } = swShell(main, "sw-view swref-view"), want = args[0] ? decodeURIComponent(args[0]) : null;
  const st = { topic: null, sel: want && refOf(want) ? want : null };
  head.replaceChildren(el("div", { class: "swref-top" }, icon("library"), el("b", null, "Références du Logiciel"), el("span", { class: "muted small" }, "chaque source dit comment elle a été lue ; un numéro [n] sur un écran ouvre sa ligne ici")));
  const how = (r) => { const H = METHOD_HOW[r.how] || METHOD_HOW.none; return el("span", { class: `badge swref-how ${H.tone}`, "data-tip": H.text }, H.label); };
  function draw() {
    clear(left); clear(view); clear(right);
    left.append(el("div", { class: "side-head" }, el("h2", null, "Références")),
      el("div", { class: "side-section" }, el("h3", null, "Par sujet"), el("nav", { class: "swref-topics" },
        [{ id: null, label: "Toutes", icon: "library", color: "#0891b2" }, ...REF_TOPICS].map((T) => el("button", { type: "button", class: `swref-topic${st.topic === T.id ? " on" : ""}`, style: `--dom:${T.color}`, "aria-pressed": st.topic === T.id ? "true" : "false", "data-ref-topic": T.id || "all", onClick: () => { st.topic = T.id; draw(); } },
          icon(T.icon), el("span", null, T.label), el("small", null, String(T.id ? REFS.filter((r) => r.topic === T.id).length : REFS.length)))))),
      el("div", { class: "side-section" }, el("h3", null, "Niveaux de lecture"), el("ul", { class: "swref-levels" }, ["read", "page", "unread"].map((k) => el("li", null, el("span", { class: `badge ${METHOD_HOW[k].tone}` }, METHOD_HOW[k].label), " ", METHOD_HOW[k].text)))));
    const page = el("div", { class: "page swref-page" });
    for (const T of REF_TOPICS.filter((x) => !st.topic || x.id === st.topic)) { const list = REFS.filter((r) => r.topic === T.id); if (!list.length) continue;
      page.append(el("h3", { class: "swref-h", style: `--dom:${T.color}` }, icon(T.icon), T.label), el("ol", { class: "swref-list" }, list.map((r) => el("li", { class: `swref-card${st.sel === r.id ? " sel" : ""}`, id: `ref-${r.id}`, "data-ref": r.id, value: String(refNumber(r.id)), onClick: () => { st.sel = r.id; draw(); } },
        el("div", { class: "swref-line" }, el("b", { class: "swref-n" }, `[${refNumber(r.id)}]`), el("b", null, r.title), how(r)),
        el("small", { class: "muted" }, [r.by, r.date].filter(Boolean).join(" · ")),
        el("ul", { class: "swref-says" }, r.says.map((t) => el("li", null, t))),
        el("div", { class: "swref-foot" }, r.url ? el("a", { href: r.url, target: "_blank", rel: "noopener noreferrer", class: "swref-url", onClick: (e) => e.stopPropagation() }, icon("external"), " Ouvrir le document") : el("span", { class: "muted small" }, "Document du projet (pas de lien public)"),
          r.cites.length ? el("span", { class: "small muted" }, `Cité par : ${r.cites.join(" · ")}`) : null))))); }
    view.append(page);
    const r = st.sel && refOf(st.sel);
    right.append(...[el("div", { class: "side-head" }, el("h2", null, r ? `[${refNumber(r.id)}]` : "Ce qu'aucune source ne dit")),
      r ? el("div", { class: "side-section" }, el("h3", null, r.title), el("p", { class: "small" }, [r.by, r.date].filter(Boolean).join(" · ")), el("p", null, how(r), " ", (METHOD_HOW[r.how] || METHOD_HOW.none).text), el("ul", null, r.says.map((t) => el("li", { class: "small" }, t))), r.url ? el("p", null, el("a", { href: r.url, target: "_blank", rel: "noopener noreferrer" }, icon("external"), " Ouvrir le document")) : null) : null,
      el("div", { class: "side-section" }, el("h3", null, "Ce qu'aucune source lue ne dit"), el("ul", { class: "swref-gaps" }, REF_GAPS.map((t) => el("li", { class: "small" }, t))))].filter(Boolean));
    if (r) setTimeout(() => { const c = view.querySelector(`[data-ref="${CSS.escape(r.id)}"]`); if (c && c.scrollIntoView) c.scrollIntoView({ block: "center" }); }, 0);
  }
  draw(); setGuide([]);
  return () => setGuide([]);
}
registerModule({ key: "swref", label: "Références", icon: "library", tip: "Les sources que les écrans du Logiciel citent, et comment chacune a été lue", render });
