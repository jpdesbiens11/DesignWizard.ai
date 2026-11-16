/* DesignWizard.ai — PCBA: the trade component library — low-voltage embedded control and motor-drive electronics.
   Every entry is a GENERIC class of part with the pinout usual for its class ; the designer writes the exact
   reference (mpn) once it is chosen, and the data sheet of that reference prevails. Prices are typical prototype
   unit prices in CAD. A board adds its own components in board.library (makeComponent builds one from a package). */

import { footprint } from "./footprints.js";
import { PARTS } from "./library_parts.js";
import { MORE_PARTS } from "./library_more.js";
import { SERIES_PARTS } from "./library_series.js";

const TYPE = [[/^(GND\d*|VSS\w*|COM|PGND|AGND|V-|EP)$/, "gnd"], [/^(VIN|VCC|VDD\w*|V\+|VIO|VBAT|VM)$/, "power_in"], [/^(VOUT|VREF)$/, "power_out"], [/^NC\d*$/, "nc"],
  [/^(P[A-D]\d+|SWDIO|SDA|SDO|CANH|CANL|IO\d*)$/, "bidir"], [/^(NRST|BOOT0|EN\d*|SWCLK|SCL|HIN|LIN|TXD|DI|DE|RE_N|STB|IN[A-D]?[+-]?|FB|OSC_IN|CS|SCK|MOSI|WP|A[0-2]|G|B)$/, "in"],
  [/^(OSC_OUT|HO|LO|RXD|RO|OUT[A-D]?|SW|PG|INT\d*|MISO|RESET_N)$/, "out"]];
const typeOf = (name) => (TYPE.find(([re]) => re.test(name)) || [0, "passive"])[1];
/** Pins from a list of names in pin order ; "NAME:type" forces the type, "NAME@7" forces the pin number. */
function pinList(names) {
  return names.map((s, i) => {
    const m = /^([^:@]+)(?::(\w+))?(?:@(\w+))?$/.exec(s);
    return { n: m[3] || String(i + 1), name: m[1], type: m[2] || typeOf(m[1]) };
  });
}

/** A complete component from a package name : { id, kind, name, package, pins: [names] | [{ n, name, type }], … }. */
export function makeComponent(spec) {
  const fp = footprint(spec.package);
  if (!fp) throw new Error(`Boîtier inconnu « ${spec.package} ».`);
  const pins = (spec.pins || []).length ? (typeof spec.pins[0] === "string" ? pinList(spec.pins) : spec.pins.map((p) => ({ n: String(p.n), name: p.name || String(p.n), type: p.type || typeOf(p.name || "") })))
    : [...new Set(fp.pads.map((p) => p.n))].map((n) => ({ n, name: n, type: "passive" }));
  const kind = spec.kind || "other", bare = ["connector", "terminal", "switch", "testpoint", "fiducial"].includes(kind);
  return { id: spec.id, kind, prefix: spec.prefix || PREFIX[kind] || "X", name: spec.name || spec.id, package: spec.package, desc: spec.desc || "", pins, pads: fp.pads, body: spec.body || fp.body, courtyard: fp.courtyard,
    coat: spec.coat ?? !bare, polar: spec.polar ?? (pins.length > 2 || ["diode", "led"].includes(kind)), ratings: spec.ratings || {}, price: spec.price || 0, mpn: spec.mpn || "", maker: spec.maker || "" };
}
export const PREFIX = { resistor: "R", capacitor: "C", inductor: "L", diode: "D", led: "D", transistor: "Q", mosfet: "Q", ic: "U", mcu: "U", sensor: "U", connector: "J", terminal: "J", fuse: "F", crystal: "Y",
  relay: "K", transformer: "T", optocoupler: "U", switch: "SW", testpoint: "TP", fiducial: "FID", heatsink: "HS", mechanical: "H", other: "X" };

/** The trade library : id → component. */
export const LIBRARY = Object.fromEntries([...PARTS, ...MORE_PARTS, ...SERIES_PARTS].map((p) => [p.id, makeComponent(p)]));

export const CATEGORIES = [
  { key: "passive", label: "Passifs", kinds: ["resistor", "capacitor", "inductor"] }, { key: "semi", label: "Diodes et transistors", kinds: ["diode", "led", "transistor", "mosfet"] },
  { key: "ic", label: "Circuits intégrés", kinds: ["ic", "mcu", "optocoupler"] }, { key: "sensor", label: "Capteurs", kinds: ["sensor"] },
  { key: "connector", label: "Connecteurs et bornes", kinds: ["connector", "terminal"] }, { key: "protect", label: "Protection et horloge", kinds: ["fuse", "crystal"] },
  { key: "mech", label: "Essai, repères et mécanique", kinds: ["switch", "testpoint", "fiducial", "heatsink", "mechanical", "relay", "transformer", "other"] },
];

const plain = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
/** Components whose id, name, package or description holds every word of the query. */
export function findComponents(query, lib = LIBRARY) {
  const words = plain(query).split(/\s+/).filter(Boolean);
  return Object.values(lib).filter((c) => { const hay = plain(`${c.id} ${c.name} ${c.package} ${c.desc} ${c.kind}`); return words.every((w) => hay.includes(w)); })
    .sort((a, b) => a.name.localeCompare(b.name, "fr", { numeric: true }));
}

/** What is wrong with a component definition, in plain French ; an empty list means it can be used. */
export function checkComponent(def) {
  const out = [], pins = def.pins || [], pads = def.pads || [];
  if (!def.id) out.push("Identifiant manquant.");
  if (!pads.length) out.push("Aucune pastille : choisissez un boîtier.");
  if (!pins.length) out.push("Aucune broche déclarée.");
  if (!Array.isArray(def.body) || !(def.body[0] > 0 && def.body[1] > 0 && def.body[2] > 0)) out.push("Encombrement du boîtier manquant (largeur, hauteur, épaisseur).");
  const pn = new Set(pins.map((p) => String(p.n)));
  if (pn.size !== pins.length) out.push("Deux broches portent le même numéro.");
  for (const p of pads) if (!pn.has(String(p.n))) out.push(`La pastille ${p.n} ne correspond à aucune broche.`);
  for (const p of pins) if (!pads.some((x) => String(x.n) === String(p.n))) out.push(`La broche ${p.n} (${p.name}) n'a pas de pastille.`);
  for (let i = 0; i < pads.length; i++) for (let j = i + 1; j < pads.length; j++) {
    const a = pads[i], b = pads[j];
    if (String(a.n) !== String(b.n) && Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2) out.push(`Les pastilles ${a.n} et ${b.n} se recouvrent.`);
  }
  for (const p of pads) if (p.drill > 0 && (Math.min(p.w, p.h) - p.drill) / 2 < 0.15) out.push(`Pastille ${p.n} : couronne de moins de 0,15 mm autour du perçage.`);
  return out;
}
