/* DynamiteOrbit.ai — the reading of a requirement BY THE MACHINE, on the pages Exigences (JP, 27 novembre 2026, par menu : « Requis lisibles +
   pointillés »). Under the card of a requirement the bench can judge, its oracle in one line — dashed while the tool proposes it ; in the right
   margin, each oracle with its numbers to correct (the limit, how long it must hold, how soon the answer must come), « Confirmer la lecture »
   and « Ne pas juger au banc ». Every change is one undoable step ; a reading follows its requirement until its statement changes. The rules are
   pure (core/req_oracle.js). What it follows : the pass / fail criterion of requirements-based testing, read from the sentence, signed by a person. */

import { el, btn, icon } from "../core/dom.js";
import { oraclesFor, keepOracles, oracleText, SIGNALS } from "../core/req_oracle.js";
import { keyOf } from "../core/reqs.js";

const WHY = { offbench: "Prouvée autrement que par un essai (inspection, analyse, démonstration) : elle ne se juge pas au banc.", tbd: "Une valeur est encore TBD : la machine la lira quand elle sera fixée.",
  unread: "La machine ne sait pas la lire : aucune condition chiffrée sur ce que le banc relève (tensions, température, courant, état, contactor, pompe, équilibrage).", person: "Une personne a décidé de ne pas la juger au banc.", need: "" };

/** The line under a card : the oracles of the requirement, or nothing. */
export function oracleLine(R, r) {
  const O = oraclesFor(R, r); if (!O.list.length) return null;
  return el("div", { class: `rq-oracle${O.sure ? "" : " guess"}`, "data-rq-oracle": keyOf(r), title: O.sure ? "Lue par la machine, confirmée" : "Lue par la machine : proposée par l'outil, à confirmer" },
    O.list.map((o) => el("span", null, icon("ruler"), " ", oracleText(o))));
}

/* the numbers of an oracle one corrects : the limit(s), how long, how soon */
function fields(o, edit) {
  const num = (label, get, set, unit) => el("label", { class: "rq-ofield" }, el("span", null, label), el("input", { type: "number", step: "any", value: String(get()), onChange: (e) => { const v = Number(e.target.value); if (Number.isFinite(v)) edit((x) => set(x, v)); } }), el("small", null, unit));
  if (o.kind === "reaction") return [...o.if.map((c, i) => num(SIGNALS[c.signal].short, () => c.value, (x, v) => { x.if[i].value = v; }, SIGNALS[c.signal].unit || "")),
    num("pendant plus de", () => o.hold || 0, (x, v) => { x.hold = v; }, "ms"), num("réponse en", () => (o.within === null || o.within === undefined ? "" : o.within), (x, v) => { x.within = v; }, "ms")];
  return [o.min !== undefined ? num(o.kind === "envelope" ? "jusqu'à" : "min", () => o.min, (x, v) => { x.min = v; }, SIGNALS[o.signal].unit) : null,
    o.max !== undefined ? num(o.kind === "envelope" ? "jusqu'à" : "max", () => o.max, (x, v) => { x.max = v; }, SIGNALS[o.signal].unit) : null];
}

/** The section of the right margin. commit(label, fn(reqs)) : one undoable step on project.reqs. */
export function oracleSection(R, r, commit) {
  const O = oraclesFor(R, r), k = keyOf(r);
  const keep = (list, label) => commit(`${k} : ${label}`, (L) => keepOracles(L, L.rows.find((x) => keyOf(x) === k) || r, list));
  const sec = el("div", { class: "side-section", "data-fold-note": O.list.length ? (O.sure ? "confirmée" : "proposée") : "aucune", "data-rq-oracles": k }, el("h3", null, "Lue par la machine"));
  if (!O.list.length) { sec.append(el("p", { class: "small muted" }, WHY[O.why] || WHY.unread)); if (O.why === "person") sec.append(btn("Laisser l'outil la relire", () => commit(`${k} : lecture rendue à l'outil`, (L) => { if (L.oracles) delete L.oracles[k]; }), { small: true, icon: "refresh" })); return sec; }
  sec.append(el("p", { class: "small muted" }, "Ce que le banc doit montrer pour qu'elle soit tenue. Les pointillés de la vue Mission portent sa clé ; le verdict s'y lit, profil par profil."));
  O.list.forEach((o, i) => sec.append(el("div", { class: `rq-ocard${O.sure ? "" : " guess"}` }, el("b", null, oracleText(o)),
    el("div", { class: "rq-ofields" }, fields(o, (fn) => { const list = JSON.parse(JSON.stringify(O.list)); fn(list[i]); keep(list, "lecture corrigée"); })))));
  const ok = O.sure ? null : btn("Confirmer la lecture", () => keep(O.list, "lecture confirmée"), { small: true, primary: true, icon: "check", tip: "La lecture proposée par l'outil est la bonne : elle devient celle du projet" }); if (ok) ok.dataset.rqOracleOk = "";
  sec.append(el("div", { class: "rq-oacts" }, ok, btn("Ne pas juger au banc", () => keep([], "pas jugée au banc"), { small: true, icon: "cross", tip: "Cette exigence se prouve ailleurs : aucun pointillé, aucun verdict" })));
  return sec;
}
