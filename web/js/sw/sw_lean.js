/* DynamiteOrbit.ai — Logiciel : THE LEAN PATH (JP, 27 novembre 2026 : « lean tout ce qui n'est pas des requis, interfaces HW, fonctions… passer
   rapidement à des tests logiciels embarqués HIL virtuels » ; choix par menu : « Alléger le parcours d'abord » — le groupe Logiciel réduit à
   Exigences · Interfaces · Missions · Banc HIL · Constats · Export ; les blocs détaillés et le cycle en V restent au niveau Expert).
   What a person writes : the requirements (DynamiteAgile), the hardware interfaces (the board) and the functions. What the tool plays : every
   mission profile on the virtual bench, each requirement judged on each mission (sw/sw_campaign.js). The code stays hidden until the export.
   Pure. */

import { KINDS, cfgOf } from "./sw_objects.js";
import { physText } from "./sw_units.js";
import { hostBoard, hwProblems } from "./sw_blocks.js";
import { plantOf, coverage } from "./sw_pack.js";
import { profilesOf } from "./sw_story.js";
import { hwFunctions } from "../pcba/lab_system.js";
import { forDiscipline } from "../core/reqs.js";
import { oraclesFor, proposeOracles } from "../core/req_oracle.js";

/** The six steps, in the order one goes : each is a screen (mod) of the Logiciel group. */
export const LEAN = [
  { key: "reqs", mod: "lreq", n: 1, title: "Exigences", en: "Requirements", icon: "report", color: "#2563eb", says: "Ce que le produit doit faire, lu de DynamiteAgile : une exigence prouvée par essai devient un oracle que le banc juge." },
  { key: "io", mod: "swio", n: 2, title: "Interfaces", en: "HW interfaces", icon: "chip", color: "#b45309", says: "Chaque entrée et chaque sortie du logiciel, sur son net et sa broche de la carte — ou dite par une autre carte, dans sa frame." },
  { key: "missions", mod: "swmis", n: 3, title: "Missions", en: "Mission profiles", icon: "flow", color: "#7c3aed", says: "Les mission profiles que le banc joue : ce que chacun fait au produit, les limites qu'il franchit, ce qu'il laisse." },
  { key: "bench", mod: "swsim", n: 4, title: "Banc HIL", en: "Virtual HIL", icon: "play", color: "#dc2626", says: "Le logiciel tourne contre le module simulé, une mission à la fois : les limites des exigences en pointillé, l'arrêt sur défaut." },
  { key: "findings", mod: "swfind", n: 5, title: "Constats", en: "Findings", icon: "check", color: "#16a34a", says: "Toutes les missions jouées d'un coup : chaque exigence tenue, échouée ou non exercée, et le fichier de constat." },
  { key: "export", mod: "swrel", n: 6, title: "Export", en: "Export", icon: "download", color: "#0f766e", says: "Le paquet C, caché jusqu'ici, part vers le microcontrôleur quand les constats sont verts." },
];
/* the screens of the V and of the detailed design : the Expert's (they stay, behind) */
export const EXPERT_KEYS = ["swreq", "swarch", "sw", "swcode", "swtest", "swref"];
export const LEAN_KEYS = LEAN.map((s) => s.mod);
/** The screens of the Logiciel group a level shows in the top bar. */
export const navKeys = (level) => [...LEAN_KEYS, ...(level === "expert" ? EXPERT_KEYS : [])];
export const leanOf = (key) => LEAN.find((s) => s.key === key) || null;
/** The step of the lean path a screen of the V belongs to (for its head, at the novice and intermediate levels). */
export const V_TO_LEAN = { req: "reqs", arch: "io", design: "io", sim: "bench", code: "export", verify: "findings", release: "export" };

/** The hardware interfaces of the software : grouped by the function of the board that carries each pin, then what other boards SAY (their
    frames). Each line : its direction, its net and pin, its range in the units of physics, the device behind it. → { board, groups, problems } */
export function interfacesOf(project, d) {
  const board = d ? hostBoard(project, d) : null; if (!d) return { board: null, groups: [], problems: [] };
  const objs = (d.objects || []).filter((o) => !o.off && KINDS[o.kind]), O = Object.fromEntries(objs.map((o) => [o.id, o])), W = d.wires || [];
  const range = (o) => { const K = KINDS[o.kind]; if (K.pin !== "ain") return { text: K.pin === "din" ? "0 / 1 (entrée logique)" : "0 / 1 (sortie logique)", unit: "" };
    const w = W.find((x) => x.from === `${o.id}.counts`), m = w ? O[w.to.split(".")[0]] : null; if (!m) return { text: "comptes du convertisseur", unit: "counts" };
    const c = cfgOf(m); return { text: `${physText(c.lo, c.unit, false)} à ${physText(c.hi, c.unit)}`, unit: c.unit, reads: m.name }; };
  const groups = board ? hwFunctions(board, d, {}) : [{ fn: "frames", name: "Sans carte", items: objs.filter((o) => KINDS[o.kind].pin).map((o) => ({ id: o.id, name: o.name, net: "", pin: "", dir: KINDS[o.kind].pin, device: o.device || "" })) }];
  for (const g of groups) g.items = g.items.map((x) => { const o = O[x.id]; return { ...x, ...range(o), from: o.bench ? "frame" : "board", source: o.bench || "", vehicle: o.vehicle || "" }; });
  return { board, groups, problems: hwProblems(project, d) };
}

/** Where each step of the lean path stands. campaign : the last campaign played (sw/sw_campaign.js) or null.
    → { [key]: { state: "done" | "todo" | "wait" | "info", text } } */
export function leanStates(project, d, campaign = null) {
  const R = project && project.reqs, mine = R ? forDiscipline(R, "sw").reqs : [], tested = mine.filter((r) => /T/.test(r.verification_method || "") && proposeOracles(r).list.length);
  const unsure = tested.filter((r) => !oraclesFor(R, r).sure);
  const io = d ? interfacesOf(project, d) : null, bad = io ? io.problems.filter((x) => x.level === "error" || x.level === "check") : [];
  const P = d ? profilesOf(d) : [], left = d && plantOf(d) ? coverage(d, P).left : [];
  const fails = campaign ? campaign.rows.filter((x) => x.overall === "fail") : [];
  return {
    reqs: { state: !mine.length ? "todo" : unsure.length ? "todo" : "done", text: !mine.length ? "Aucune exigence allouée au logiciel : lisez la liste de DynamiteAgile." : unsure.length ? `${unsure.length} lecture${unsure.length > 1 ? "s" : ""} par la machine à confirmer.` : `${mine.length} exigences, leurs oracles confirmés.` },
    io: { state: !d ? "wait" : bad.length ? "todo" : "done", text: !d ? "Le logiciel n'existe pas encore." : bad.length ? `${bad.length} interface${bad.length > 1 ? "s" : ""} à corriger.` : io.board ? `Aligné sur ${io.board.id}.` : "Aucune carte : le logiciel n'est aligné sur aucun matériel." },
    missions: { state: !d ? "wait" : !P.length ? "todo" : left.length ? "info" : "done", text: !P.length ? "Aucune mission." : `${P.length} mission${P.length > 1 ? "s" : ""}${left.length ? ` — ${left.length} limite${left.length > 1 ? "s" : ""} jamais franchie${left.length > 1 ? "s" : ""}` : ""}.` },
    bench: { state: !d ? "wait" : plantOf(d) ? "info" : "todo", text: !d ? "Le logiciel n'existe pas encore." : plantOf(d) ? "Le module simulé est sur le banc." : "Aucun module simulé sur le banc." },
    findings: { state: !d ? "wait" : !campaign ? "todo" : fails.length ? "todo" : "done", text: !campaign ? "La campagne n'a pas encore été jouée." : fails.length ? `${fails.length} exigence${fails.length > 1 ? "s" : ""} échouée${fails.length > 1 ? "s" : ""}.` : "Aucune exigence échouée." },
    export: { state: !campaign ? "wait" : fails.length ? "wait" : "info", text: !campaign ? "D'abord les constats." : fails.length ? "Des exigences échouent encore : le paquet attend." : "Prêt : le paquet peut partir." },
  };
}
