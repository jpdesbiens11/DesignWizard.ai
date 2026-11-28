/* DynamiteOrbit.ai — Logiciel : the LEVEL a person reads the software at, and the PATH of its steps (demande de JP, 24 novembre 2026 :
   « trois niveaux de compréhension : novice, intermédiaire et expert… monter graduellement les marches de compétences »).
   The level is kept by the browser of each person (`dw.sw.level`) : a student and their teacher look at the same project, each at their own
   level. A switch at the head of every screen of the group changes it ; the screen is drawn again at once.
   THE PATH, for the novice and the intermediate : the steps of the level as big numbered cards, left to right, each with its pictogram, its
   colour, its short name and whether it is done — what a game shows of its levels. The expert keeps the V (modules/sw_vband.js).
   What it follows : a segmented control (role radiogroup, arrows) for the level ; a stepper (aria-current="step") for the path. */

import { el, icon } from "../core/dom.js";
import { LEVELS, DEFAULT_LEVEL, levelSteps } from "../sw/sw_levels.js";

const KEY = "dw.sw.level";
export function getLevel() { try { const v = localStorage.getItem(KEY); return LEVELS[v] ? v : DEFAULT_LEVEL; } catch (e) { return DEFAULT_LEVEL; } }
export function setLevel(v) { if (!LEVELS[v]) return; try { localStorage.setItem(KEY, v); } catch (e) { /* no storage : the level holds until the page is left */ } fallback = v; window.dispatchEvent(new HashChangeEvent("hashchange")); }
let fallback = null;
export const level = () => fallback || getLevel();

/** The switch of the level. */
export function levelSwitch() {
  const cur = level(), items = Object.values(LEVELS);
  const pick = (k) => { if (k !== cur) setLevel(k); };
  return el("div", { class: "swl-switch", role: "radiogroup", "aria-label": "Votre niveau en logiciel", "data-sw-level": cur,
    onKeydown: (e) => { const i = items.findIndex((x) => x.key === cur), d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0; if (d) { e.preventDefault(); pick(items[(i + d + items.length) % items.length].key); } } },
    items.map((L) => el("button", { type: "button", role: "radio", class: `swl-lv${L.key === cur ? " on" : ""}`, style: `--dom:${L.color}`, "aria-checked": L.key === cur ? "true" : "false", tabindex: L.key === cur ? "0" : "-1", "data-level": L.key, "data-tip": L.says, onClick: () => pick(L.key) },
      el("span", { class: "swl-dots", "aria-hidden": "true" }, [1, 2, 3].map((n) => el("i", { class: n <= L.n ? "full" : "" }))), L.fr)));
}
/** The path of the steps of a level. cur : the key of the step shown ; states : { key: { state, text } } (sw/sw_steps.js vStates) ; hash(key) → address. */
export function stepPath(lv, cur, states, hash) {
  const steps = levelSteps(lv);
  return el("nav", { class: "swl-path", "aria-label": "Les étapes du logiciel", "data-sw-path": lv },
    steps.map((s, i) => { const st = (states && states[s.key]) || { state: "", text: "" }, on = s.key === cur;
      return [i ? el("span", { class: "swl-arrow", "aria-hidden": "true" }, "➜") : null,
        el("a", { class: `swl-step ${st.state}${on ? " on" : ""}`, href: hash(s.key), style: `--dom:${s.color}`, "aria-current": on ? "step" : null, "data-sw-path-step": s.key, "data-tip": `${s.says}${st.text ? ` — ${st.text}` : ""}` },
          el("span", { class: "swl-n" }, st.state === "done" ? "✓" : String(s.n)), icon(s.icon, "swl-ico"), el("b", null, s.kid))]; }).flat().filter(Boolean));
}

/* THE VIEW of the blocks (choix cliqué de JP, 24 novembre 2026 : « Casse-tête 2D, 1 lien ») : the puzzle for the novice and the intermediate, the
   blocks and their keys for the expert — and a switch to see the other, kept by the browser (`dw.sw.view`). */
const VKEY = "dw.sw.view";
export function viewMode(lv = level()) { try { const v = localStorage.getItem(VKEY); if (v === "puzzle" || v === "blocks") return v; } catch (e) { /* no storage */ } return lv === "expert" ? "blocks" : "puzzle"; }
export function viewSwitch(lv = level()) {
  const cur = viewMode(lv), set = (v) => { try { localStorage.setItem(VKEY, v); } catch (e) { /* the view holds until the page is left */ } window.dispatchEvent(new HashChangeEvent("hashchange")); };
  return el("div", { class: "swp-switch", role: "radiogroup", "aria-label": "La vue du logiciel", "data-sw-view": cur },
    [["puzzle", "Casse-tête"], ["blocks", "Blocs détaillés"]].map(([k, t]) => el("button", { type: "button", role: "radio", class: k === cur ? "on" : "", "aria-checked": k === cur ? "true" : "false", "data-view": k, "data-tip": k === "puzzle" ? "Des pièces, un lien par paire : l'outil branche les bonnes interfaces en arrière-plan" : "Chaque bloc avec ses clés, chaque liaison avec son fil — pour l'expert", onClick: () => { if (k !== cur) set(k); } }, t)));
}
