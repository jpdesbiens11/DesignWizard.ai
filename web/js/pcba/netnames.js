/* DynamiteOrbit — PCBA: the naming convention of nets. A net name says what the copper carries, so that a schematic,
   a layout, a Gerber viewer and a colleague read the same thing. */

export const NET_CONVENTION = [
  { pattern: "+<tension>V", example: "+24V, +5V, +3V3", meaning: "Rail d'alimentation ; le V tient lieu de virgule : +3V3 = 3,3 V. Suffixe _IN avant protection." },
  { pattern: "GND, PGND, AGND, CHASSIS", example: "GND", meaning: "Masses : logique, puissance, analogique, châssis." },
  { pattern: "<FONCTION>_<SIGNAL>", example: "CAN_TX, I2C_SCL, PWM_H", meaning: "Signal entre blocs : la fonction d'abord, le signal ensuite, en majuscules." },
  { pattern: "…_N", example: "RESET_N, CS_N", meaning: "Signal actif à l'état bas." },
  { pattern: "…_H / …_L, …_P / …_N", example: "CAN_H / CAN_L", meaning: "Paire différentielle : les deux pistes se routent ensemble." },
  { pattern: "AIN<n>, DOUT<n>", example: "AIN0, DOUT1", meaning: "Entrée analogique ou sortie logique du microcontrôleur, attribuée dans l'ordre." },
  { pattern: "<bloc>_<NOM>", example: "B3_SW, B3_FB", meaning: "Net interne à un bloc : préfixé du repère du bloc, il n'en sort pas." },
];

/** Name of a supply rail : 24 → "+24V", 3.3 → "+3V3", −12 → "-12V". */
export function railName(v) {
  const a = Math.abs(v), whole = Math.floor(a + 1e-9), frac = Math.round((a - whole) * 10);
  return `${v < 0 ? "-" : "+"}${whole}V${frac ? frac : ""}`;
}
const GROUND = /^(GND(_\w+)?|PGND|AGND|DGND|CHASSIS|PE)$/, RAIL = /^[+-]\d+V\d?(_\w+)?$/;
/** Class of a net from its name and voltage : "ground", "hv" (60 V and above), "power" or "signal". */
export function netClass(name, voltage = 0) {
  if (GROUND.test(name)) return "ground";
  if (Math.abs(voltage) >= 60) return "hv";
  return RAIL.test(name) ? "power" : "signal";
}
/** Does a name follow the convention ? → { ok, hint }. */
export function checkNetName(name) {
  const s = String(name || "");
  if (!s) return { ok: false, hint: "Nom de net vide." };
  if (GROUND.test(s) || RAIL.test(s)) return { ok: true, hint: "" };
  if (/[a-z]/.test(s)) return { ok: false, hint: `« ${s} » : les noms de net s'écrivent en majuscules (${s.toUpperCase()}).` };
  if (!/^[A-Z][A-Z0-9]*(_[A-Z0-9+-]+)*$/.test(s)) return { ok: false, hint: `« ${s} » : lettres, chiffres et « _ » seulement ; « + » et « - » sont réservés aux rails (+5V).` };
  return { ok: true, hint: "" };
}
/** Name of a net that stays inside a block. */
export const localNet = (blockId, name) => `${blockId}_${name}`;
