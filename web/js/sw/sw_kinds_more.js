/* DynamiteOrbit.ai — Logiciel : the CONVENTIONAL blocks of embedded software (demande de JP, 24 novembre 2026 : « most SW used the same kind of
   library and structure for embedded SW into HW… there needs to be conventional sw functions for embedded systems and specific functions »).
   Five kinds that nearly every embedded program carries, whatever the product — a battery, a robot, a drive, a standalone device :
     debounce   a contact or a request believed only once it has held : the filter of every push button and every auxiliary contact
     on_delay   an on-delay timer (TON) : the output follows the input once it has held for the preset time
     logic      AND · OR · XOR · NOT of two decisions
     pid        a PI(D-less) regulator in whole numbers, its integral clamped (anti-windup) : the heart of a motor, a heater, a charger
     ramp       a rate limiter : a setpoint that may not jump
     balancing  passive balancing of ONE cell block : its bleed resistor on while it stands above the lowest by more than a delta, above a
                floor voltage, and the pack is not discharging (run once per CORE)
     state_lamp the general state shown on three lamps : green (good), yellow (to watch), red (over a limit) — the colours of a traffic light
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
  balancing: { nature: "command", label: "Passive balancing", fr: "équilibrage passif", icon: "bolt", text: "Décharge un bloc de cellules par sa résistance tant qu'il dépasse le plus bas de plus de l'écart donné, au-dessus d'une tension minimale, et seulement quand le pack ne se décharge pas ; il s'arrête quand l'écart est revenu sous la moitié — l'hystérésis évite de battre. Un bloc par CORE.",
    ports: { in: [{ key: "v", label: "cell block", unit: "mV", min: 0, max: 6000 }, { key: "low", label: "lowest", unit: "mV", min: 0, max: 6000 }, { key: "i", label: "current", unit: "mA", min: -1000000, max: 1000000, free: 1 }], out: [{ key: "bleed", label: "bleed", ...B }] },
    params: [P("v_min", "Tension minimale pour équilibrer", 3900, "mV", "Sous cette tension, on n'équilibre pas : la courbe des cellules y dit mal leur état de charge.", { min: 0, max: 5000 }),
      P("delta", "Écart qui déclenche", 20, "mV", "Le bloc se décharge tant qu'il dépasse le plus bas de plus de cet écart.", { min: 1, max: 1000 }),
      P("hyst", "Écart de retour", 10, "mV", "Il s'arrête quand l'écart est revenu sous celui-ci.", { min: 0, max: 1000 })],
    init: () => ({ on: 0 }),
    step(s, c, i) { const d = i.v - i.low, ok = i.v >= c.v_min && i.i <= 0; if (!ok) s.on = 0; else if (!s.on && d > c.delta) s.on = 1; else if (s.on && d <= c.hyst) s.on = 0; return { bleed: s.on }; } },
  state_lamp: { nature: "command", label: "Status lamp (green · yellow · red)", fr: "voyant d'état général", icon: "sparkle", text: "Montre l'état général sur trois témoins, comme un feu de circulation : vert, tout va bien ; jaune, une condition à surveiller (dératé) ; rouge, une limite dépassée (urgence, arrêt). Un seul témoin allumé à la fois.",
    ports: { in: [{ key: "state", label: "state", unit: "state", min: 0, max: 3 }], out: [{ key: "green", label: "green", ...B }, { key: "yellow", label: "yellow", ...B }, { key: "red", label: "red", ...B }] },
    params: [], init: () => ({}),
    step(s, c, i) { const q = i.state; return { green: q === 0 ? 1 : 0, yellow: q === 1 ? 1 : 0, red: q >= 2 ? 1 : 0 }; } },
};
/** What a design of these kinds must check, for the guide. → [{ level, text, obj, field }] */
export function moreProblems(o, c, period) {
  const out = [], say = (level, text, field) => out.push({ level, text, obj: o.id, field });
  if (o.kind === "pid" && c.umin >= c.umax) say("error", `${o.name} : la commande minimale doit être sous la maximale (${c.umin} ≥ ${c.umax}).`, "umin");
  if (o.kind === "ramp" && Math.trunc((c.rate * (period || 10)) / 1000) < 1) say("error", `${o.name} : la pente (${c.rate} par seconde) ne fait pas même 1 unité par pas de ${period || 10} ms — la valeur ne bougerait jamais.`, "rate");
  for (const [k, f] of [["debounce", "t"], ["on_delay", "pt"]]) if (o.kind === k && period && c[f] % period) say("check", `${o.name} : le temps (${c[f]} ms) n'est pas un multiple de la période (${period} ms) — il sera arrondi au pas suivant.`, f);
  return out;
}
