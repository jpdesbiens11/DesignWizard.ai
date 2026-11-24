/* DynamiteOrbit.ai — Logiciel : the BANK OF MISSION PROFILES (demande de JP, 24 novembre 2026 : « choisir des profils parmi une banque de profils
   de mission en .txt qui peuvent venir de l'IA selon les cas, avec les bonnes variables changeantes le long du profil »).
   A mission profile is a plain text file, one event per line — a person writes it, an AI writes it from the prompt below, the tool reads it :

     # DynamiteOrbit.ai — mission profile (dynamiteorbit/mission-profile@1)
     name: Charge rapide
     kind: charge
     # t (s) | title | what happens | changes : variable = value unit ; …
     0    | Le chargeur est branché | Le module est à moitié chargé. | adc_v = 3.7 V ; adc_i = -60 A
     16   | Comm : la chaîne se tait | Un connecteur décroche.        | lost = 1
     19.5 | Acquittement             | On acquitte.                   | ack = pulse 0.3 s

   The variables are the INPUTS of the bench of this software (sw/sw_live.js liveInputs) — by id or by name —, in the units of physics (V, A,
   °C, %…) : the tool converts to what the software keeps. A logic input takes 0 or 1, or « pulse <s> s » (pressed, then released). What the
   file cannot say is refused line by line, with its reason ; nothing is applied until the person accepts. Pure : no page. */

import { liveInputs } from "./sw_live.js";
import { shownUnit, toShown, toInside } from "./sw_units.js";

export const PROFILE_FORMAT = "dynamiteorbit/mission-profile@1";
const KINDS = ["charge", "discharge", "mission", "test"];
const num = (x) => String(+x.toFixed(3));
const vars = (d) => liveInputs(d).filter((i) => i.kind !== "contact");

/** A profile as text. */
export function profileTxt(p, d) {
  const by = Object.fromEntries(vars(d).map((i) => [i.id, i]));
  const val = (id, v) => { const i = by[id]; return i && i.kind === "analog" ? `${num(toShown(v, i.unit))} ${shownUnit(i.unit)}`.trim() : String(v); };
  const lines = [`# DynamiteOrbit.ai — mission profile (${PROFILE_FORMAT})`, `name: ${p.name || p.id}`, `kind: ${p.kind || "mission"}`, "# t (s) | title | what happens | changes : variable = value unit ; …"];
  for (const e of p.events || []) { if (e.hidden) continue; const ch = [...Object.entries(e.set || {}).map(([k, v]) => `${k} = ${val(k, v)}`), ...Object.entries(e.pulse || {}).map(([k, ms]) => `${k} = pulse ${num(ms / 1000)} s`)];
    lines.push([num(e.t / 1000), e.title, e.says, ch.join(" ; ")].map((x) => String(x || "").replace(/\|/g, "/")).join(" | ")); }
  return `${lines.join("\n")}\n`;
}

/** Reads a profile. → { profile: { id, name, kind, events } | null, errors: [{ line, text }] } */
export function parseProfileTxt(text, d, id = null) {
  const inputs = vars(d), find = (k) => { const q = k.trim().toLowerCase(); return inputs.find((i) => i.id.toLowerCase() === q) || inputs.find((i) => i.name.toLowerCase() === q); };
  const errors = [], events = []; let name = "", kind = "mission";
  String(text || "").split(/\r?\n/).forEach((raw, n) => { const line = raw.trim(), at = n + 1; if (!line || line.startsWith("#")) return;
    const head = line.match(/^(name|nom|kind|genre)\s*:\s*(.+)$/i); if (head) { if (/^(name|nom)$/i.test(head[1])) name = head[2].trim(); else kind = KINDS.includes(head[2].trim().toLowerCase()) ? head[2].trim().toLowerCase() : "mission"; return; }
    const f = line.split("|").map((x) => x.trim()); if (f.length < 3) { errors.push({ line: at, text: "Une ligne d'événement a au moins trois champs : t (s) | titre | ce qui arrive | changements." }); return; }
    const t = Math.round(Number(String(f[0]).replace(",", ".")) * 1000); if (!Number.isFinite(t) || t < 0) { errors.push({ line: at, text: `Le temps « ${f[0]} » n'est pas un nombre de secondes.` }); return; }
    const set = {}, pulse = {};
    for (const c of (f[3] || "").split(";").map((x) => x.trim()).filter(Boolean)) {
      const m = c.match(/^(.+?)\s*=\s*(.+)$/); if (!m) { errors.push({ line: at, text: `« ${c} » : attendu variable = valeur.` }); continue; }
      const i = find(m[1]); if (!i) { errors.push({ line: at, text: `« ${m[1]} » n'est pas une entrée du banc de ce logiciel (${inputs.map((x) => x.id).join(", ")}).` }); continue; }
      const v = m[2].trim(), pu = v.match(/^pulse\s+([\d.,]+)\s*s$/i);
      if (pu) { if (i.kind !== "digital") errors.push({ line: at, text: `${i.id} : une impulsion ne se donne qu'à une entrée logique.` }); else pulse[i.id] = Math.round(Number(pu[1].replace(",", ".")) * 1000); continue; }
      if (i.kind === "digital") { if (!/^[01]$/.test(v)) errors.push({ line: at, text: `${i.id} : une entrée logique prend 0 ou 1 (ou « pulse 0.3 s »).` }); else set[i.id] = Number(v); continue; }
      const q = v.match(/^(-?[\d.,]+)\s*(.*)$/), want = shownUnit(i.unit); if (!q) { errors.push({ line: at, text: `${i.id} : « ${v} » n'est pas une valeur.` }); continue; }
      if (q[2] && q[2] !== want) { errors.push({ line: at, text: `${i.id} se donne en ${want}, pas en ${q[2]}.` }); continue; }
      const x = toInside(Number(q[1].replace(",", ".")), i.unit); if (x < i.min || x > i.max) { errors.push({ line: at, text: `${i.id} : ${v} est hors de ce que la broche peut lire (${num(toShown(i.min, i.unit))} à ${num(toShown(i.max, i.unit))} ${want}).` }); continue; }
      set[i.id] = x; }
    events.push({ t, id: `e${events.length + 1}`, title: f[1] || `Événement ${events.length + 1}`, says: f[2] || "", set, ...(Object.keys(pulse).length ? { pulse } : {}) }); });
  if (!events.length) errors.push({ line: 0, text: "Aucun événement lu." });
  events.sort((a, b) => a.t - b.t);
  return { profile: events.length ? { id: id || `p-${(name || "profil").toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "profil"}`, name: name || "Profil importé", kind, events } : null, errors };
}

/** The prompt an AI is given to write a mission profile for THIS software : the format, the variables of its bench with their units and ranges. */
export function profilePrompt(d, ask = "") {
  const rows = vars(d).map((i) => i.kind === "analog" ? `- ${i.id} — ${i.name} — en ${shownUnit(i.unit)}, de ${num(toShown(i.min, i.unit))} à ${num(toShown(i.max, i.unit))}${i.lo !== undefined ? ` (plage vraisemblable ${num(toShown(i.lo, i.unit))} à ${num(toShown(i.hi, i.unit))})` : ""}` : `- ${i.id} — ${i.name} — logique : 0 ou 1, ou « pulse 0.3 s » (appuyé puis relâché)`);
  return [`Tu écris un PROFIL DE MISSION pour le logiciel « ${(d && d.name) || "logiciel"} » de DynamiteOrbit.ai, au format ${PROFILE_FORMAT}.`,
    "Un profil est une suite d'événements dans le temps : ce qui arrive au produit (courant, tension, température, communication, boutons), dit en une phrase, et ce que cela met sur les entrées du banc.",
    "", "FORMAT (texte brut, une ligne par événement, champs séparés par « | ») :", "name: <nom court>", "kind: charge | discharge | mission | test",
    "t (s) | titre court | ce qui arrive, en une phrase | variable = valeur unité ; variable = valeur unité", "",
    "VARIABLES (les entrées du banc de ce logiciel — n'en invente aucune) :", ...rows, "",
    "RÈGLES : le premier événement à t = 0 donne l'état de départ de chaque grandeur ; les temps croissent ; une valeur reste jusqu'à ce qu'un événement la change ; les unités sont celles écrites ci-dessus ; un courant qui entre dans le produit (charge) est négatif ; place des événements critiques au fil du profil (communication, tension, courant, température), chacun suivi de son retour à la normale ; termine par une ligne « Fin du profil ». Réponds par le fichier seul, sans commentaire.",
    ...(ask ? ["", `LA DEMANDE : ${ask}`] : [])].join("\n");
}
