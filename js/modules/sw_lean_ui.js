/* DynamiteOrbit.ai — Logiciel : the head of the LEAN PATH (JP, 27 novembre 2026, par menu : « Alléger le parcours d'abord » — Exigences ·
   Interfaces · Missions · Banc HIL · Constats · Export ; le cycle en V au niveau Expert). Six numbered cards, left to right, each with its
   pictogram, its colour, its short name and where it stands (sw/sw_lean.js leanStates) ; the switch of the level beside them. It heads the
   three screens of the path (Interfaces, Missions, Constats), the screens of the V at the novice and intermediate levels, and the page of the
   requirements of the software. The last campaign played is kept here, for the session : the path and the Export read it.
   What it follows : a stepper (aria-current="step"), the same look as the path of the levels (modules/sw_level_ui.js). */

import { el, icon } from "../core/dom.js";
import { store } from "../core/store.js";
import { LEAN, leanStates } from "../sw/sw_lean.js";
import { levelSwitch } from "./sw_level_ui.js";
import { campaignMissions, reserveSeed } from "../sw/sw_req_missions.js";

let memo = null;
/** The last campaign played in this session (sw/sw_campaign.js), for a software — or null. */
export const lastCampaign = (d) => (memo && d && memo.design === d.id ? memo : null);
export const rememberCampaign = (C) => { memo = C; };
let mm = null;
/** Every mission of the campaign for a software (sw/sw_req_missions.js), kept while the requirements, their readings and the bench do not change. */
export function missionsOf(d) {
  if (!d) return []; const p = store.project, R = p && p.reqs;
  const key = [d.id, reserveSeed(R), JSON.stringify((R && R.oracles) || {}), JSON.stringify((R && R.alloc) || {}), JSON.stringify(d.plant || null), JSON.stringify(d.missionPlan || null), JSON.stringify((d.profiles || []).map((x) => [x.id, (x.events || []).length]))].join("¦");
  if (!mm || mm.key !== key) mm = { key, list: campaignMissions(p, d) };
  return mm.list;
}
/** The software the path reads : the first of the project that has a module on its bench, else the first. */
export const leanDesign = () => { const all = (store.project && store.project.software) || []; return all.find((d) => d.plant) || all[0] || null; };

/** The head : the six steps, the one shown lit, and the level switch. cur : a key of LEAN. */
export function leanHead(cur, d = leanDesign()) {
  const st = leanStates(store.project, d, lastCampaign(d));
  return el("div", { class: "swv-head swl-head", "data-sw-lean": cur },
    el("nav", { class: "swl-path", "aria-label": "Le parcours du logiciel", "data-sw-path": "lean" },
      LEAN.map((s, i) => { const S = st[s.key] || { state: "", text: "" }, on = s.key === cur;
        return [i ? el("span", { class: "swl-arrow", "aria-hidden": "true" }, "➜") : null,
          el("a", { class: `swl-step ${S.state}${on ? " on" : ""}`, href: `#/${s.mod}`, style: `--dom:${s.color}`, "aria-current": on ? "step" : null, "data-sw-path-step": s.key, "data-tip": `${s.says}${S.text ? ` — ${S.text}` : ""}` },
            el("span", { class: "swl-n" }, S.state === "done" ? "✓" : String(s.n)), icon(s.icon, "swl-ico"), el("b", null, s.title))]; }).flat().filter(Boolean)),
    levelSwitch());
}
