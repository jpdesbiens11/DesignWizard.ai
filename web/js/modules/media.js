/* DesignWizard.ai — the base of media, to consult : every solid, liquid and gas the analytical models read their properties
   from. Solids first, then liquids, then gases ; in each, by group then by name ; a colour and a pictogram per state. A
   line opens on all the medium gives, with the units, the French word of each property and where the values come from ;
   a fluid shows its values at the temperature one types. Nothing is edited here : the values are those of the platform.
   Route : #/media[/<medium id>]. The data : analysis/physics/media.js. */

import { el, icon, fmt } from "../core/dom.js";
import { registerModule } from "../core/app.js";
import { MEDIA, MEDIA_STATES, MEDIA_PROPS, MODEL_MEDIA, mediaMenu, medium, mediumProps } from "../analysis/physics/media.js";
import { model, shortTitle } from "../analysis/physics/index.js";

const COLS = { solid: ["rho", "E", "Re", "k", "cp", "cte"], liquid: ["rho", "mu_mPa", "k", "cp", "Pr"], gas: ["rho", "mu_mPa", "k", "cp", "Pr"] };
const num = (v) => { if (typeof v !== "number" || !Number.isFinite(v)) return "—"; const a = Math.abs(v); return fmt(v, a === 0 || a >= 1000 ? 0 : a >= 100 ? 1 : a >= 10 ? 2 : a >= 1 ? 3 : Math.min(8, 3 - Math.floor(Math.log10(a)))); };
/** The models that read a medium of this state. */
const usedBy = (state) => Object.entries(MODEL_MEDIA).filter(([, slots]) => slots.some((s) => s.states.includes(state))).map(([id]) => shortTitle(model(id))).filter(Boolean);

function detail(m) {
  const box = el("div", { class: "media-detail", "data-medium-detail": m.id }), table = el("tbody"), at = m.at ? el("input", { type: "number", value: "20", step: "5", min: String(m.range[0]), max: String(m.range[1]), "aria-label": "Température", "data-medium-T": "", style: { width: "5.5rem" } }) : null;
  const draw = () => { const P = mediumProps(m.id, at ? Number(at.value) : undefined) || {};
    table.replaceChildren(...Object.entries(MEDIA_PROPS).filter(([k]) => typeof P[k] === "number" && Number.isFinite(P[k])).map(([k, d]) => el("tr", { "data-prop": k }, el("td", null, el("b", null, d.label), el("small", { class: "muted" }, ` — ${d.fr}`)), el("td", { class: "nowrap", style: { textAlign: "right" } }, num(P[k])), el("td", { class: "muted" }, d.unit)))); };
  if (at) at.addEventListener("input", draw); draw();
  box.append(...(at ? [el("p", { class: "small", style: { margin: "0 0 .3rem" } }, "Propriétés à ", at, ` °C — valables de ${m.range[0]} à ${m.range[1]} °C, à 1 atm.`)] : []), el("table", { class: "data" }, table),
    el("p", { class: "muted small", style: { margin: ".35rem 0 0" } }, el("b", null, "D'où viennent ces valeurs : "), m.basis), ...(m.fr ? [el("p", { class: "muted small", style: { margin: ".15rem 0 0" } }, `En français : ${m.fr}.`)] : []));
  return box;
}

function render(main, args = []) {
  const page = el("div", { class: "page" }), host = el("div"), count = el("small", { class: "muted" }), focus = medium(args[0]);
  const find = el("input", { type: "search", placeholder: "Chercher un média : 6061, cuivre, glycol, helium…", "aria-label": "Chercher un média", "data-media-find": "", style: { width: "100%", margin: ".2rem 0 .8rem" } });
  main.append(page);
  page.append(el("div", { class: "page-head" }, el("div", { class: "grow" }, el("h1", null, "Base des médias"),
    el("p", { class: "muted" }, "Les solides, les liquides et les gaz que les modèles analytiques connaissent. Un modèle ne demande pas une valeur — « E = 69 GPa » — mais un média : ses propriétés en découlent, écrites à côté et non modifiables. ", count)),
    el("a", { class: "btn", href: "#/physics" }, icon("physics"), "Modèles analytiques")), find, host);
  const draw = () => { const states = mediaMenu(null, find.value), n = states.reduce((s, x) => s + x.count, 0);
    count.textContent = `${n} média${n > 1 ? "s" : ""}${find.value.trim() ? ` sur ${MEDIA.length}` : ""}.`;
    host.replaceChildren(...(states.length ? states.map((st) => el("section", { class: "card media-state", style: `--dom:${st.color}; margin-bottom: 1rem`, "data-media-state": st.id },
      el("header", { class: "src-group-head" }, icon(st.icon), el("div", { class: "grow" }, el("b", null, st.label), el("small", null, `${st.hint} — lus par : ${usedBy(st.id).join(", ") || "aucun modèle"}`)), el("span", { class: "src-count" }, String(st.count))),
      st.groups.map((g) => el("div", { class: "media-group", "data-media-group": g.group }, el("h3", null, g.group),
        el("table", { class: "data media-table" }, el("thead", null, el("tr", null, el("th", null, "Média"), COLS[st.id].map((k) => el("th", { "data-tip": `${MEDIA_PROPS[k].label} — ${MEDIA_PROPS[k].fr}` }, MEDIA_PROPS[k].label.replace(/^.* /, ""), el("small", null, ` ${MEDIA_PROPS[k].unit}`))))),
          el("tbody", null, g.list.flatMap((m) => { const open = focus && focus.id === m.id, more = el("tr", { class: "media-more", hidden: !open }, el("td", { colSpan: COLS[st.id].length + 1 }, open ? detail(m) : null));
            const row = el("tr", { class: "media-row" + (open ? " sel" : ""), "data-medium": m.id, tabindex: "0", "data-tip": "Cliquer : toutes ses propriétés, et d'où elles viennent" }, el("td", null, el("b", null, m.name)), COLS[st.id].map((k) => el("td", { style: { textAlign: "right" } }, num(m.props[k]))));
            const toggle = () => { const show = more.hidden; if (show && !more.firstChild.firstChild) more.firstChild.append(detail(m)); more.hidden = !show; row.classList.toggle("sel", show); };
            row.addEventListener("click", toggle); row.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
            return [row, more]; }))))))) : [el("p", { class: "muted" }, "Aucun média ne correspond.")])); };
  find.addEventListener("input", draw); draw();
  page.append(el("p", { class: "muted small" }, "Valeurs typiques à 20 °C (et à 1 atm pour les fluides) : elles dimensionnent un premier calcul, elles ne remplacent pas la fiche de la nuance ou du fluide acheté. Les solides sont ceux de la bibliothèque de matières des pièces."));
  if (focus) setTimeout(() => { const r = host.querySelector(`[data-medium="${focus.id}"]`); if (r) r.scrollIntoView({ block: "center" }); }, 60);
  return null;
}

registerModule({ key: "media", label: "Base des médias", icon: "physics", hidden: true, tip: "Solides, liquides et gaz : les propriétés que les modèles analytiques lisent", render });
