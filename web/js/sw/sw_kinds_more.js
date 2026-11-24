/* DynamiteOrbit.ai — Logiciel : the CONVENTIONAL blocks of embedded software (demande de JP, 24 novembre 2026 : « most SW used the same kind of
   library and structure for embedded SW into HW… there needs to be conventional sw functions for embedded systems and specific functions »).
   Five kinds that nearly every embedded program carries, whatever the product — a battery, a robot, a drive, a standalone device :
     debounce   a contact or a request believed only once it has held : the filter of every push button and every auxiliary contact
     on_delay   an on-delay timer (TON) : the output follows the input once it has held for the preset time
     logic      AND · OR · XOR · NOT of two decisions
     pid        a PI(D-less) regulator in whole numbers, its integral clamped (anti-windup) : the heart of a motor, a heater, a charger
     ramp       a rate limiter : a setpoint that may not jump
   Each is a step in whole numbers, written ONCE : the browser simulates it, sw/sw_c_more.js writes its C, and the C must print what this
   file gives (back to back). The figures are EXAMPLES, said as such — none is that of a component or of a project.
   Pure : no page. */

const B = { unit: "0/1", min: 0, max: 1 }, MS = "ms", div = (a, b) => Math.trunc(a / b);      // a division as C makes it : toward zero
const P = (key, label, value, unit, text, o = {}) => ({ key, label, value, unit, text, ...o });
export const QUANTITY_UNITS = ["mV", "mA", "0.1 °C", "kPa", "‰", "rpm"];
export const LOGIC_OPS = ["AND", "OR", "XOR", "NOT"];
const BIG = 10000000;

export const MORE_KINDS = {
  debounce: { nature: "decide", label: "Debounce", fr: "anti-rebond", icon: "check", text: "Ne croit un changement d'une entrée logique que lorsqu'il a tenu le temps donné : un bouton qui rebondit, un contact qui vibre ne passent pas.",
    ports: { in: [{ key: "in", label: "in", ...B }], out: [{ key: "out", label: "out", ...B }] },
    params: [P("t", "Temps de tenue", 50, MS, "Combien de temps l'entrée doit garder sa nouvelle valeur pour qu'on la croie.", { min: 0, max: 60000 })],
    init: () => ({ out: 0, t: 0 }),
    step(s, c, i, dt) { if (i.in !== s.out) { s.t += dt; if (s.t >= c.t) { s.out = i.in ? 1 : 0; s.t = 0; } } else s.t = 0; return { out: s.out }; } },
  on_delay: { nature: "decide", label: "On-delay timer", fr: "temporisation au travail (TON)", icon: "history", text: "La sortie passe à 1 quand l'entrée est à 1 depuis le temps donné ; elle retombe dès que l'entrée retombe.",
    ports: { in: [{ key: "in", label: "in", ...B }], out: [{ key: "q", label: "q", ...B }] },
    params: [P("pt", "Temps prédéfini", 500, MS, "Combien de temps l'entrée doit rester à 1.", { min: 0, max: 600000 })],
    init: () => ({ et: 0 }),
    step(s, c, i, dt) { if (i.in) { if (s.et < c.pt) s.et += dt; } else s.et = 0; return { q: i.in && s.et >= c.pt ? 1 : 0 }; } },
  logic: { nature: "decide", label: "Logic gate", fr: "porte logique", icon: "flow", text: "Combine deux décisions : ET, OU, OU exclusif — ou inverse la première (NON).",
    ports: { in: [{ key: "a", label: "a", ...B }, { key: "b", label: "b", ...B, free: 1 }], out: [{ key: "y", label: "y", ...B }] },
    params: [P("op", "Opération", "AND", "", "AND : les deux à 1. OR : l'une ou l'autre. XOR : une seule des deux. NOT : l'inverse de a.", { choices: LOGIC_OPS })],
    init: () => ({}),
    step(s, c, i) { const a = i.a ? 1 : 0, b = i.b ? 1 : 0; return { y: c.op === "AND" ? a & b : c.op === "OR" ? a | b : c.op === "XOR" ? a ^ b : 1 - a }; } },
  pid: { nature: "control", label: "PI regulator", fr: "régulateur PI", icon: "param", text: "Amène une mesure à sa consigne : une part proportionnelle à l'écart, une part qui l'accumule dans le temps ; la commande reste dans ses bornes et l'accumulation s'y arrête (anti-windup).",
    ports: { in: [{ key: "sp", label: "setpoint", unit: "*", min: -BIG, max: BIG }, { key: "pv", label: "measure", unit: "*", min: -BIG, max: BIG }], out: [{ key: "u", label: "command", unit: "‰", min: "umin", max: "umax" }] },
    params: [P("unit", "Unité de la mesure", "mV", "", "La même pour la consigne et la mesure.", { choices: QUANTITY_UNITS }),
      P("kp", "Gain proportionnel", 500, "‰ / 1000", "La commande (en ‰) que donne un écart de 1000 unités, à lui seul.", { min: 0, max: 100000 }),
      P("ki", "Gain intégral", 100, "‰ / 1000 / s", "Ce que la commande gagne chaque seconde pour un écart de 1000 unités qui dure.", { min: 0, max: 100000 }),
      P("umin", "Commande minimale", 0, "‰", "La plus petite commande : 0 ‰ pour un rapport cyclique.", { min: -1000, max: 1000 }),
      P("umax", "Commande maximale", 1000, "‰", "La plus grande commande : 1000 ‰ = toujours conduire.", { min: -1000, max: 1000 })],
    init: () => ({ acc: 0 }),
    step(s, c, i, dt) { const e = i.sp - i.pv, lo = c.umin * 1000000, hi = c.umax * 1000000;      // acc : ‰ × 10⁶ — the integral kept in whole numbers
      s.acc = Math.max(lo, Math.min(hi, s.acc + c.ki * e * dt)); const u = div(c.kp * e, 1000) + div(s.acc, 1000000);
      return { u: Math.max(c.umin, Math.min(c.umax, u)) }; } },
  ramp: { nature: "control", label: "Ramp", fr: "rampe (limiteur de pente)", icon: "bolt", text: "Suit son entrée sans jamais aller plus vite que la pente donnée : une consigne ne saute pas, un moteur ne prend pas un à-coup.",
    ports: { in: [{ key: "x", label: "target", unit: "*", min: -BIG, max: BIG }], out: [{ key: "y", label: "value", unit: "*", min: -BIG, max: BIG }] },
    params: [P("unit", "Unité", "mV", "", "Celle de ce qui lui est relié.", { choices: QUANTITY_UNITS }),
      P("rate", "Pente maximale", 1000, "unités/s", "De combien la valeur peut changer en une seconde, au plus.", { min: 1, max: BIG })],
    init: () => ({ y: 0, primed: 0 }),
    step(s, c, i, dt) { if (!s.primed) { s.y = i.x; s.primed = 1; } else { const m = div(c.rate * dt, 1000), d = i.x - s.y; s.y += Math.max(-m, Math.min(m, d)); } return { y: s.y }; } },
};
/** What a design of these kinds must check, for the guide. → [{ level, text, obj, field }] */
export function moreProblems(o, c, period) {
  const out = [], say = (level, text, field) => out.push({ level, text, obj: o.id, field });
  if (o.kind === "pid" && c.umin >= c.umax) say("error", `${o.name} : la commande minimale doit être sous la maximale (${c.umin} ≥ ${c.umax}).`, "umin");
  if (o.kind === "ramp" && Math.trunc((c.rate * (period || 10)) / 1000) < 1) say("error", `${o.name} : la pente (${c.rate} par seconde) ne fait pas même 1 unité par pas de ${period || 10} ms — la valeur ne bougerait jamais.`, "rate");
  for (const [k, f] of [["debounce", "t"], ["on_delay", "pt"]]) if (o.kind === k && period && c[f] % period) say("check", `${o.name} : le temps (${c[f]} ms) n'est pas un multiple de la période (${period} ms) — il sera arrondi au pas suivant.`, f);
  return out;
}
