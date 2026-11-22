/* DesignOrbit.ai — PCBA: the electrical rule check — what a careful reader of the schematic would catch before any
   copper is drawn : functions without a solution, pins left in the air, supplies without a source, outputs fighting
   each other, capacitors under-rated for their net. */

import { LIBRARY } from "./library.js";
import { libraryOf, resolveBoard } from "./model.js";
import { checkNetName } from "./netnames.js";
import { ruleTitle } from "../analysis/dfx_titles.js";

export const ERC_RULES = [
  { id: "ERC-01", title: "Fonction sans solution", why: "Une fonction que rien ne remplit est une exigence oubliée." },
  { id: "ERC-02", title: "Bloc sans fonction", why: "Un circuit que rien ne justifie coûte, chauffe et tombe en panne pour rien." },
  { id: "ERC-03", title: "Broche non connectée", why: "Une entrée en l'air prend n'importe quel état ; une alimentation oubliée arrête le circuit." },
  { id: "ERC-04", title: "Net à une seule broche", why: "Un net qui ne va nulle part est une liaison oubliée." },
  { id: "ERC-05", title: "Deux sources sur un même net", why: "Deux sorties d'alimentation ou deux sorties logiques reliées se combattent." },
  { id: "ERC-06", title: "Alimentation sans source", why: "Des broches d'alimentation reliées entre elles, mais à aucune source." },
  { id: "ERC-07", title: "Circuit intégré sans découplage", why: "Sans condensateur sur son alimentation, un circuit intégré oscille ou se réinitialise." },
  { id: "ERC-08", title: "Tenue en tension insuffisante", why: "Un condensateur ou un semi-conducteur sous-dimensionné claque à la première surtension." },
  { id: "ERC-09", title: "Nom de net hors convention", why: "Un nom lisible évite les erreurs de câblage et de revue." },
  { id: "ERC-10", title: "Valeur manquante", why: "Sans valeur, le composant ne peut être ni commandé ni monté." },
  { id: "ERC-11", title: "Définition incohérente", why: "Composant, broche ou repère que la carte ne sait pas résoudre." },
].map((r) => ({ ...r, fr: r.title, title: ruleTitle(r.title) }));      // shown in English, as the trade names what the rule checks ; the French word goes to the glossary
const TITLE = Object.fromEntries(ERC_RULES.map((r) => [r.id, r.title]));
const FEEDS = new Set(["connector", "terminal", "inductor", "fuse", "mosfet", "transistor", "diode", "resistor", "testpoint", "switch", "relay", "transformer"]);
const ACTIVE = new Set(["ic", "mcu", "sensor", "optocoupler"]);

/** Electrical rule check of a board document. → { findings: [{ rule, severity, title, message, refs, nets }], summary: { error, warn, info }, free } */
export function erc(board, lib = LIBRARY) {
  const L = libraryOf(board, lib), R = resolveBoard(board, lib), findings = [];
  const add = (rule, severity, message, refs = [], nets = []) => findings.push({ rule, severity, title: TITLE[rule], message, refs, nets });
  for (const p of R.problems) add("ERC-11", "error", p);
  const fs = board.functions || [];
  for (const f of fs) if (!f.block && f.kind !== "contrainte" && !fs.some((c) => c.parent === f.id)) add("ERC-01", "warn", `${f.id} « ${f.name} » n'a pas de bloc qui la remplit.`);
  for (const b of board.blocks || []) if (!b.function || !fs.some((f) => f.id === b.function)) add("ERC-02", "info", `Le bloc ${b.id} « ${b.name} » n'est rattaché à aucune fonction.`);

  const src = new Map((board.parts || []).map((p) => [p.ref, p]));
  let free = 0;
  for (const part of R.parts) {
    const spec = src.get(part.ref) || {}, nc = new Set((spec.nc || []).map(String)), open = new Map();
    for (const i of part.pads) { const pad = R.pads[i]; if (!pad.net && pad.type !== "nc" && !nc.has(pad.n) && !nc.has(pad.name)) open.set(pad.name, pad); }
    for (const pad of open.values()) {
      if (part.kind === "mcu" && pad.type === "bidir") { free++; continue; }
      const sev = pad.type === "power_in" || pad.type === "gnd" ? "error" : pad.type === "in" ? "warn" : "info";
      add("ERC-03", sev, `${part.ref} (${part.def.name}) : la broche ${pad.name} n'est reliée à rien${sev === "info" ? "" : pad.type === "in" ? " — une entrée en l'air est indéterminée" : " — le composant n'est pas alimenté"}.`, [part.ref]);
    }
    if (!part.value && ["resistor", "capacitor", "inductor"].includes(part.kind)) add("ERC-10", "warn", `${part.ref} (${part.def.name}) n'a pas de valeur.`, [part.ref]);
  }
  if (free) add("ERC-03", "info", `${free} broche(s) d'entrée-sortie du microcontrôleur restent libres.`);

  for (const net of R.nets) {
    const pads = net.pads.map((i) => R.pads[i]), parts = (pad) => R.parts.find((p) => p.ref === pad.ref), pins = new Map(pads.map((p) => [`${p.ref}.${p.name}`, p]));
    const list = [...pins.values()], refs = [...new Set(list.map((p) => p.ref))];
    if (pins.size === 1) add("ERC-04", FEEDS.has(parts(list[0]).kind) ? "info" : "warn", `Le net ${net.name} ne relie que ${list[0].ref}.${list[0].name}.`, refs, [net.name]);
    const sources = list.filter((p) => p.type === "power_out"), outs = list.filter((p) => p.type === "out");
    if (new Set(sources.map((p) => p.ref)).size > 1) add("ERC-05", "error", `Le net ${net.name} reçoit deux sorties d'alimentation : ${sources.map((p) => `${p.ref}.${p.name}`).join(", ")}.`, refs, [net.name]);
    if (new Set(outs.map((p) => p.ref)).size > 1) add("ERC-05", "error", `Le net ${net.name} relie deux sorties : ${outs.map((p) => `${p.ref}.${p.name}`).join(", ")}.`, refs, [net.name]);
    const loads = list.filter((p) => p.type === "power_in");
    if (loads.length && net.class !== "ground" && !sources.length && !list.some((p) => FEEDS.has(parts(p).kind))) add("ERC-06", "error", `Le net ${net.name} alimente ${loads.map((p) => p.ref).join(", ")} mais ne vient d'aucune source.`, refs, [net.name]);
    const ics = [...new Set(loads.filter((p) => ACTIVE.has(parts(p).kind)).map((p) => p.ref))];
    if (ics.length && !list.some((p) => parts(p).kind === "capacitor")) add("ERC-07", "warn", `Aucun condensateur de découplage sur ${net.name}, qui alimente ${ics.join(", ")}.`, ics, [net.name]);
    const v = Math.abs(net.voltage || 0);
    if (v > 0) for (const pad of list) {                         // a supply pin of an active part, or any pin of a switch or a diode, must hold the net voltage
      const part = parts(pad), rated = part.def.ratings && part.def.ratings.V;
      if (!rated || rated >= v || part.kind === "capacitor" || (ACTIVE.has(part.kind) && pad.type !== "power_in")) continue;
      if (!["mosfet", "transistor", "diode", "fuse", "connector", "terminal"].includes(part.kind) && !ACTIVE.has(part.kind)) continue;
      add("ERC-08", "error", `${pad.ref} (${part.def.name}, ${rated} V) est relié à ${net.name} à ${String(v).replace(".", ",")} V.`, [pad.ref], [net.name]);
    }
    const name = checkNetName(net.name);
    if (!name.ok) add("ERC-09", "info", name.hint, [], [net.name]);
  }
  const volt = new Map(R.nets.map((n) => [n.name, Math.abs(n.voltage || 0)]));
  for (const part of R.parts) {                                 // a capacitor sees the difference between its two nets
    const rated = part.def.ratings && part.def.ratings.V, nets = [...new Set(part.pads.map((i) => R.pads[i].net).filter(Boolean))];
    if (part.kind !== "capacitor" || !rated || nets.length < 2) continue;
    const v = Math.abs((volt.get(nets[0]) || 0) - (volt.get(nets[1]) || 0));
    if (rated < 1.5 * v) add("ERC-08", "warn", `${part.ref} (${part.def.name}, ${rated} V) entre ${nets[0]} et ${nets[1]} voit ${String(v).replace(".", ",")} V : prévoir au moins 1,5 fois la tension.`, [part.ref], nets);
  }
  const order = { error: 0, warn: 1, info: 2 };
  findings.sort((a, b) => order[a.severity] - order[b.severity] || a.rule.localeCompare(b.rule));
  const summary = { error: 0, warn: 0, info: 0 };
  for (const f of findings) summary[f.severity]++;
  return { findings, summary, free, used: Object.keys(L).length };
}
