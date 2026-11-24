/* DynamiteOrbit.ai — Logiciel : typical SENSORS and ACTUATORS (demande de JP, 24 novembre 2026 : « des blocs sensors typiques qui peuvent envoyer
   leur data au CPU, des types d'actuateurs aussi typiques »).
   A sensor is hardware : what the software sees of it is a PIN — a channel of the converter, a logic input — and the block that makes a
   quantity of it. A sensor brick therefore puts, in one click, the pin block tagged with its device and, wired to it, its acquisition block
   preset with the TYPICAL scaling of such a sensor (an analog input scaled, or a debounce). An actuator brick puts the output pin tagged with
   its device. Nothing new runs and nothing new is written in C : the pins and the blocks are those of the library, and every preset value is
   a reference value — amber, to confirm with the datasheet of the part the board carries. Values typical of such sensors, never those of a
   reference ; the NTC is linearised over a narrow range, and the sheet says so (a lookup table is planned).
   A device the tool cannot simulate yet (a bus sensor, a motor) is in the library « à venir ». Pure : no page. */

const C12 = 4095, VREF = 3300;
/** counts → value : value = mV × num / den + offset (sw/sw_objects.js analog_in). */
export const DEVICES = {
  /* ---------- sensors : analog ---------- */
  ntc: { side: "sensor", pin: "pin_adc", icon: "thermal", label: "NTC thermistor", fr: "thermistance CTN (10 kΩ, pont diviseur)", text: "Une température par une thermistance dans un pont diviseur. Linéarisée de 0 à 60 °C : une table d'interpolation (à venir) tiendra la courbe entière.",
    measure: { unit: "0.1 °C", num: -1, den: 2, offset: 1075, lo: -200, hi: 1000, n: 8 }, range: [0, 600] },
  rtd: { side: "sensor", pin: "pin_adc", icon: "thermal", label: "RTD (Pt100) + amplifier", fr: "sonde Pt100 et son amplificateur", text: "Une température par une sonde à résistance de platine et un amplificateur de 0 à 3 V pour −50 à 250 °C.",
    measure: { unit: "0.1 °C", num: 1, den: 1, offset: -500, lo: -500, hi: 2500, n: 4 }, range: [-500, 2500] },
  vdiv: { side: "sensor", pin: "pin_adc", icon: "bolt", label: "Voltage divider", fr: "pont diviseur de tension", text: "Une tension plus haute que le CPU ne la supporte, ramenée par deux résistances (ici ÷ 2).",
    measure: { unit: "mV", num: 2, den: 1, offset: 0, lo: 500, hi: 6000, n: 4 }, range: [0, 6600] },
  hall_i: { side: "sensor", pin: "pin_adc", icon: "sensor", label: "Hall current sensor", fr: "capteur de courant à effet Hall", text: "Un courant dans les deux sens, sans contact : la moitié de l'alimentation à 0 A, une pente en mV par ampère.",
    measure: { unit: "mA", num: 400, den: 1, offset: -660000, lo: -500000, hi: 500000, n: 2 }, range: [-200000, 200000] },
  shunt: { side: "sensor", pin: "pin_adc", icon: "sensor", label: "Shunt + amplifier", fr: "shunt et amplificateur", text: "Un courant par la tension d'une résistance de mesure, amplifiée : 0 à 3,3 V pour 0 à 33 A.",
    measure: { unit: "mA", num: 10, den: 1, offset: 0, lo: -500, hi: 33000, n: 4 }, range: [0, 33000] },
  pressure: { side: "sensor", pin: "pin_adc", icon: "flow", label: "Pressure transducer", fr: "capteur de pression ratiométrique", text: "0,5 à 4,5 V pour 0 à 1000 kPa, ramenés au CPU par un pont ÷ 1,5 ; sous 0,3 V ou au-dessus de 3,1 V, un fil est coupé.",
    measure: { unit: "kPa", num: 3, den: 8, offset: -125, lo: -50, hi: 1050, n: 4 }, range: [0, 1000] },
  pot: { side: "sensor", pin: "pin_adc", icon: "param", label: "Potentiometer (position)", fr: "potentiomètre de position", text: "Une position sur sa course, de 0 à 1000 ‰ — une pédale, un levier, un bras.",
    measure: { unit: "‰", num: 1000, den: VREF, offset: 0, lo: 20, hi: 980, n: 4 }, range: [0, 1000] },
  /* ---------- sensors : logic ---------- */
  button: { side: "sensor", pin: "pin_din", icon: "check", label: "Push button", fr: "bouton-poussoir", text: "Un appui : 1 tant qu'il est enfoncé. Il rebondit : un anti-rebond le suit.", debounce: 30 },
  limit_sw: { side: "sensor", pin: "pin_din", icon: "lock", label: "Limit switch", fr: "fin de course", text: "Une butée atteinte : 1 quand la pièce touche. Il vibre : un anti-rebond le suit.", debounce: 20 },
  hall_sw: { side: "sensor", pin: "pin_din", icon: "sensor", label: "Hall presence sensor", fr: "détecteur de présence à effet Hall", text: "Un aimant présent ou non : une sortie propre, sans rebond." },
  aux: { side: "sensor", pin: "pin_din", icon: "power", label: "Auxiliary contact", fr: "contact auxiliaire", text: "Le contact qui dit si un contactor ou un relais a vraiment suivi l'ordre." },
  /* ---------- actuators ---------- */
  relay: { side: "actuator", icon: "power", label: "Relay / contactor coil", fr: "bobine de relais ou de contactor", text: "Une bobine commandée par un transistor : 1 l'attire. Sa diode de roue libre est sur la carte." },
  led: { side: "actuator", icon: "sparkle", label: "LED indicator", fr: "témoin lumineux", text: "Un témoin lumineux et sa résistance sur la carte : 1 l'allume, 0 l'éteint." },
  buzzer: { side: "actuator", icon: "warning", label: "Buzzer", fr: "avertisseur sonore", text: "Un avertisseur à oscillateur intégré : 1 le fait sonner." },
  valve: { side: "actuator", icon: "flow", label: "Solenoid valve", fr: "électrovanne", text: "Une vanne tout ou rien : 1 l'ouvre (ou la ferme, selon son type)." },
  heater: { side: "actuator", icon: "thermal", label: "Heater", fr: "élément chauffant", text: "Un chauffage tout ou rien, commandé par un transistor ou un relais statique." },
  fan: { side: "actuator", icon: "refresh", label: "Fan (on / off)", fr: "ventilateur", text: "Un ventilateur tout ou rien ; sa vitesse variable attend la sortie à modulation (à venir)." },
};
/** Planned devices : shown, never placed. */
export const DEVICES_PLANNED = [
  { side: "sensor", id: "encoder_dev", label: "Quadrature encoder", fr: "codeur incrémental", text: "Une position par deux voies A / B : attend le bloc de codeur." },
  { side: "sensor", id: "imu", label: "IMU (I²C / SPI)", fr: "centrale inertielle", text: "Accélérations et vitesses angulaires par un bus : attend les blocs de communication." },
  { side: "sensor", id: "tof", label: "Distance sensor (ToF)", fr: "capteur de distance à temps de vol", text: "Une distance par un bus : attend les blocs de communication." },
  { side: "actuator", id: "dc_motor", label: "DC motor (H-bridge)", fr: "moteur à courant continu", text: "Un sens et une vitesse : attend la sortie à modulation et le pont en H." },
  { side: "actuator", id: "servo", label: "Servo motor", fr: "servomoteur", text: "Une position par une impulsion de 1 à 2 ms : attend la sortie à modulation." },
  { side: "actuator", id: "stepper", label: "Stepper motor", fr: "moteur pas à pas", text: "Des pas et une direction : attend le bloc de pas." },
];
/** The physical range a bench gives a sensor, in the unit of its measure. */
export const deviceRange = (key) => (DEVICES[key] && DEVICES[key].range) || null;
/** What a device brick puts on the page, at (x, y) : the pin tagged with its device and, for a sensor, its acquisition block wired to it.
    ids : a function base → a free id. → { objects, wires } — every preset value left as a reference value (not in `sure`). */
export function devicePlacement(key, x, y, ids) {
  const D = DEVICES[key]; if (!D) return { objects: [], wires: [] };
  if (D.side === "actuator") { const id = ids(`${key}_out`); return { objects: [{ id, kind: "pin_dout", device: key, name: `${D.label}`, params: {}, sure: [], x, y }], wires: [] }; }
  const pin = ids(`${key}_pin`), base = { id: pin, kind: D.pin, device: key, name: D.pin === "pin_adc" ? `${D.label} — voie` : D.label, params: {}, sure: [], x, y };
  if (D.measure) { const q = ids(key); return { objects: [base, { id: q, kind: "analog_in", name: D.label.replace(/ \(.*\)| \+ .*/, ""), params: { ...D.measure }, sure: [], x: x + 320, y }], wires: [{ from: `${pin}.counts`, to: `${q}.counts` }] }; }
  if (D.debounce) { const q = ids(`${key}_db`); return { objects: [base, { id: q, kind: "debounce", name: `${D.label} — anti-rebond`, params: { t: D.debounce }, sure: [], x: x + 320, y }], wires: [{ from: `${pin}.level`, to: `${q}.in` }] }; }
  return { objects: [base], wires: [] };
}
export { C12 };
