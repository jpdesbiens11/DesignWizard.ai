/* DynamiteOrbit.ai — Logiciel : the BANK OF MISSION PROFILES (demande de JP, 24 novembre 2026 : « choisir des profils parmi une banque de profils
   de mission en .txt qui peuvent venir de l'IA selon les cas, avec les bonnes variables changeantes le long du profil »).
   A mission profile is a plain text file, one event per line — a person writes it, an AI writes it from the prompt below, the tool reads it :

     # DynamiteOrbit.ai — mission profile (dynamiteorbit/mission-profile@1)
     name: Charge rapide
     kind: charge
     # t (s) | title | what happens | changes : variable = value unit ; …
     0    | Le chargeur est branché | Le module est à moitié chargé. | adc_v = 3.7 V ; adc_i = -60 A
     16   | Comm : timeout du round-robin | Un connecteur décroche.  | lost = 1
     19.5 | Acquittement             | On acquitte.                   | ack = pulse 0.3 s

   The variables are the INPUTS of the bench of this software (sw/sw_live.js liveInputs) — by id or by name —, in the units of physics (V, A,
   °C, %…) : the tool converts to what the software keeps. A logic input takes 0 or 1, or « pulse <s> s » (pressed, then released). What the
   file cannot say is refused line by line, with its reason ; nothing is applied until the person accepts. Pure : no page. */

import { liveInputs } from "./sw_live.js";
import { plantOf, packLimits } from "./sw_pack.js";
import { shownUnit, toShown, toInside } from "./sw_units.js";

export const PROFILE_FORMAT = "dynamiteorbit/mission-profile@1";
/* what drives the MODULE on the bench (sw/sw_pack.js, design.plant) : written « module.<name> = value unit » — JP, 25 novembre 2026 : « exporter et
   importer un profil de charge et décharge » ; a fifth field names the limits an event crosses on purpose (« ov, hvw ») */
export const PLANT_VARS = [
  { key: "mode", name: "module.mode", unit: "", values: ["charge", "discharge", "power", "rest"], text: "ce que fait le module : charge (le chargeur), discharge (la charge tire), power (une puissance imposée), rest (au repos)" },
  { key: "power", name: "module.power", unit: "kW", min: -1000, max: 1000, text: "la puissance imposée en mode power : + en décharge, − en charge (le courant en découle, tenu aux limites du module)" },
  { key: "start", name: "module.start", unit: "V", min: 2.5, max: 4.2, text: "la tension de départ des CORE, au repos (repart de là)" },
  { key: "a", name: "module.load", unit: "A", min: 0, max: 600, text: "le courant que la charge tire, en décharge" },
  { key: "push", name: "module.push", unit: "A", min: 0, max: 600, text: "un chargeur qui pousse ce courant quoi qu'on lui demande (0 : il obéit)" },
  { key: "cvFail", name: "module.cv_fail", unit: "", values: ["0", "1"], text: "1 : le chargeur oublie sa tension constante (il continue au-delà de 4,2 V)" },
  { key: "heatTo", name: "module.heat_to", unit: "°C", min: 0, max: 150, text: "une chaleur du dehors amène le CORE le plus chaud à cette température (0 : aucune)" },
  { key: "amb", name: "module.ambient", unit: "°C", min: -40, max: 85, text: "la température de l'air autour du module" },
  { key: "cellHi", name: "module.cell_hi", unit: "V", min: 0, max: 5, text: "cell emulator : tient le cell block le plus haut à cette tension (0 : le vrai)" },
  { key: "cellLo", name: "module.cell_lo", unit: "V", min: 0, max: 5, text: "cell emulator : tient le cell block le plus bas à cette tension (0 : le vrai)" }];
const pv = (k) => PLANT_VARS.find((v) => v.name === k.trim().toLowerCase() || v.key === k.trim());
const KINDS = ["charge", "discharge", "mission", "test"];
const num = (x) => String(+x.toFixed(3));
const vars = (d) => liveInputs(d).filter((i) => i.kind !== "contact");

/** A profile as text. */
export function profileTxt(p, d) {
  const by = Object.fromEntries(vars(d).map((i) => [i.id, i]));
  const val = (id, v) => { const i = by[id]; return i && i.kind === "analog" ? `${num(toShown(v, i.unit))} ${shownUnit(i.unit)}`.trim() : String(v); };
  const lines = [`# DynamiteOrbit.ai — mission profile (${PROFILE_FORMAT})`, `name: ${p.name || p.id}`, `kind: ${p.kind || "mission"}`, "# t (s) | title | what happens | changes : variable = value unit ; …"];
  for (const e of p.events || []) { if (e.hidden) continue; const ch = [...Object.entries(e.plant || {}).map(([k, v]) => { const V = PLANT_VARS.find((x) => x.key === k); return V ? `${V.name} = ${V.values ? v : `${num(Number(v))} ${V.unit}`}`.trim() : null; }).filter(Boolean),
      ...Object.entries(e.set || {}).map(([k, v]) => `${k} = ${val(k, v)}`), ...Object.entries(e.pulse || {}).map(([k, ms]) => `${k} = pulse ${num(ms / 1000)} s`)];
    const covers = [].concat(e.target || []);
    lines.push([num(e.t / 1000), e.title, e.says, ch.join(" ; "), ...(covers.length ? [covers.join(", ")] : [])].map((x) => String(x || "").replace(/\|/g, "/")).join(" | ")); }
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
    const set = {}, pulse = {}, plant = {}, hasPlant = !!plantOf(d);
    for (const c of (f[3] || "").split(";").map((x) => x.trim()).filter(Boolean)) {
      const m = c.match(/^(.+?)\s*=\s*(.+)$/); if (!m) { errors.push({ line: at, text: `« ${c} » : attendu variable = valeur.` }); continue; }
      const P = pv(m[1]); if (P) { if (!hasPlant) { errors.push({ line: at, text: `${P.name} : ce logiciel n'a pas de module simulé sur son banc.` }); continue; }
        const v = m[2].trim(); if (P.values) { if (!P.values.includes(v)) errors.push({ line: at, text: `${P.name} prend ${P.values.join(", ")}.` }); else plant[P.key] = P.key === "cvFail" ? Number(v) : v; continue; }
        const q = v.match(/^(-?[\d.,]+)\s*(.*)$/), x = q ? Number(q[1].replace(",", ".")) : NaN; if (!q || (q[2] && q[2] !== P.unit)) { errors.push({ line: at, text: `${P.name} se donne en ${P.unit}.` }); continue; }
        if (x < P.min || x > P.max) { errors.push({ line: at, text: `${P.name} : ${v} est hors de ${P.min} à ${P.max} ${P.unit}.` }); continue; } plant[P.key] = x; continue; }
      const i = find(m[1]); if (!i) { errors.push({ line: at, text: `« ${m[1]} » n'est pas une entrée du banc de ce logiciel (${inputs.map((x) => x.id).join(", ")}).` }); continue; }
      const v = m[2].trim(), pu = v.match(/^pulse\s+([\d.,]+)\s*s$/i);
      if (pu) { if (i.kind !== "digital") errors.push({ line: at, text: `${i.id} : une impulsion ne se donne qu'à une entrée logique.` }); else pulse[i.id] = Math.round(Number(pu[1].replace(",", ".")) * 1000); continue; }
      if (i.kind === "digital") { if (!/^[01]$/.test(v)) errors.push({ line: at, text: `${i.id} : une entrée logique prend 0 ou 1 (ou « pulse 0.3 s »).` }); else set[i.id] = Number(v); continue; }
      const q = v.match(/^(-?[\d.,]+)\s*(.*)$/), want = shownUnit(i.unit); if (!q) { errors.push({ line: at, text: `${i.id} : « ${v} » n'est pas une valeur.` }); continue; }
      if (q[2] && q[2] !== want) { errors.push({ line: at, text: `${i.id} se donne en ${want}, pas en ${q[2]}.` }); continue; }
      const x = toInside(Number(q[1].replace(",", ".")), i.unit); if (x < i.min || x > i.max) { errors.push({ line: at, text: `${i.id} : ${v} est hors de ce que la broche peut lire (${num(toShown(i.min, i.unit))} à ${num(toShown(i.max, i.unit))} ${want}).` }); continue; }
      set[i.id] = x; }
    const lims = new Set(packLimits(d).map((l) => l.id).concat(inputs.map((i) => i.id))), target = (f[4] || "").split(",").map((x) => x.trim()).filter(Boolean);
    for (const x of target.filter((x) => !lims.has(x))) errors.push({ line: at, text: `« ${x} » (5e champ) n'est pas un seuil de ce logiciel (${[...lims].join(", ")}).` });
    const tg = target.filter((x) => lims.has(x));
    events.push({ t, id: `e${events.length + 1}`, title: f[1] || `Événement ${events.length + 1}`, says: f[2] || "", set, ...(Object.keys(plant).length ? { plant } : {}), ...(Object.keys(pulse).length ? { pulse } : {}), ...(tg.length ? { target: tg.length === 1 ? tg[0] : tg } : {}) }); });
  if (!events.length) errors.push({ line: 0, text: "Aucun événement lu." });
  events.sort((a, b) => a.t - b.t);
  return { profile: events.length ? { id: id || `p-${(name || "profil").toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "profil"}`, name: name || "Profil importé", kind, events } : null, errors };
}

/** The prompt an AI is given to write a mission profile for THIS software : the format, the variables of its bench with their units and ranges. */
export function profilePrompt(d, ask = "") {
  const rows = vars(d).map((i) => i.kind === "analog" ? `- ${i.id} — ${i.name} — en ${shownUnit(i.unit)}, de ${num(toShown(i.min, i.unit))} à ${num(toShown(i.max, i.unit))}${i.lo !== undefined ? ` (plage vraisemblable ${num(toShown(i.lo, i.unit))} à ${num(toShown(i.hi, i.unit))})` : ""}` : `- ${i.id} — ${i.name} — logique : 0 ou 1, ou « pulse 0.3 s » (appuyé puis relâché)`);
  const pl = plantOf(d), mod = pl ? ["", "LE MODULE SIMULÉ (il mène les tensions, le courant et la température ; le logiciel lui répond — contacteur, dératation, pompe) :", ...PLANT_VARS.map((v) => `- ${v.name} — ${v.text}${v.values ? ` (${v.values.join(" | ")})` : ` — en ${v.unit}, de ${v.min} à ${v.max}`}`),
    "Les entrées que le module mène ne se donnent pas à la main : pilote le module. Un 5e champ, facultatif, nomme les seuils qu'un événement doit franchir :", ...packLimits(d).map((l) => `- ${l.id} — ${l.name} (${l.what})`)] : [];
  return [`Tu écris un PROFIL DE MISSION pour le logiciel « ${(d && d.name) || "logiciel"} » de DynamiteOrbit.ai, au format ${PROFILE_FORMAT}.`,
    "Un profil est une suite d'événements dans le temps : ce qui arrive au produit (courant, tension, température, communication, boutons), dit en une phrase, et ce que cela met sur les entrées du banc.",
    "", "FORMAT (texte brut, une ligne par événement, champs séparés par « | ») :", "name: <nom court>", "kind: charge | discharge | mission | test",
    "t (s) | titre court | ce qui arrive, en une phrase | variable = valeur unité ; variable = valeur unité", "",
    "VARIABLES (les entrées du banc de ce logiciel — n'en invente aucune) :", ...rows, ...mod, "",
    "RÈGLES : le premier événement à t = 0 donne l'état de départ de chaque grandeur ; les temps croissent ; une valeur reste jusqu'à ce qu'un événement la change ; les unités sont celles écrites ci-dessus ; un courant qui entre dans le produit (charge) est négatif ; place des événements critiques au fil du profil (communication, tension, courant, température), chacun suivi de son retour à la normale ; termine par une ligne « Fin du profil ». Réponds par le fichier seul, sans commentaire.",
    ...(ask ? ["", `LA DEMANDE : ${ask}`] : [])].join("\n");
}
