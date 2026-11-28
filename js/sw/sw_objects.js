/* DynamiteOrbit.ai — Logiciel : the software of an embedded BMS, as OBJECTS one links (demande de JP : « une approche de design logiciel
   via des objets visuels adaptés qui se codent tout seuls en librairie, module et structure de fichiers pour un CPU de BMS embarqué,
   sachant les in/out à gérer, leurs plages et le CPU choisi » ; choix cliqués : des tuiles reliées, un microcontrôleur de sécurité à
   double cœur d'abord).
   An object is a KIND — what it reads (ports in), what it gives (ports out), what one sets (params) — and a behaviour written ONCE, as
   a step in whole numbers. The same step is what the browser simulates and what the tool writes in C (sw/sw_c.js) : fixed-width
   integers, a division that truncates, no allocation — so the C compiled on a computer must give back, number for number, what this
   file gives (the back-to-back test).
   Every signal is a whole number in a unit said on its port (mV, mA, ms, 0.1 °C, 0 / 1) with the range it may take : a wire is refused
   when the units differ, and said when the range of what leaves does not fit in what receives (sw/sw_design.js).
   The kinds are grouped by nature, as everywhere in the tool : Brancher (the pins), Mesurer, Décider, Commander. The figures a kind
   proposes are EXAMPLES, typical of such a board and said as such — never those of a component reference.
   Pure : no page. */

import { MORE_KINDS, QUANTITY_UNITS } from "./sw_kinds_more.js";

export const NATURES = [
  { id: "pin", label: "Pins", fr: "Brancher", color: "#64748b", icon: "chip", text: "Ce qui touche le microcontrôleur : une voie du convertisseur, une entrée, une sortie." },
  { id: "measure", label: "Measure", fr: "Mesurer", color: "#0891b2", icon: "sensor", text: "Faire d'un nombre du convertisseur une grandeur que l'on comprend, et dire si elle est vraisemblable." },
  { id: "decide", label: "Decide", fr: "Décider", color: "#7c3aed", icon: "wizard", text: "Comparer, attendre, retenir : ce qui fait d'une mesure une décision." },
  { id: "control", label: "Control", fr: "Réguler", color: "#d97706", icon: "param", text: "Amener une grandeur à sa consigne, sans à-coup : régulateur, rampe." },
  { id: "command", label: "Command", fr: "Commander", color: "#dc2626", icon: "power", text: "Agir sur le matériel, et relire que l'ordre a été suivi." },
];
const B = { unit: "0/1", min: 0, max: 1 }, MS = "ms", div = (a, b) => Math.trunc(a / b);      // a division as C makes it : toward zero
const P = (key, label, value, unit, text, o = {}) => ({ key, label, value, unit, text, ...o });

/** The kinds of objects. ports : { in: [{ key, label, unit, min, max }], out: […] } — a unit of "*" follows a parameter ; params : [{ key, label, value (an example), unit, text, min?, max?, choices? }] ;
    init() → the memory of an instance ; step(s, c, i, dt) → its outputs (s : memory, changed ; c : its parameters ; i : its inputs ; dt : ms). */
export const KINDS = {
  pin_adc: { nature: "pin", label: "ADC channel", fr: "voie du convertisseur", icon: "sensor", text: "Une voie analogique du microcontrôleur : elle donne des comptes, de 0 à la pleine échelle du convertisseur.",
    ports: { in: [], out: [{ key: "counts", label: "counts", unit: "counts", min: 0, max: 4095 }] }, params: [P("channel", "Voie", 0, "", "Le numéro de la voie du convertisseur, lu sur la carte.", { min: 0, max: 63 })], pin: "ain" },
  pin_din: { nature: "pin", label: "Digital input", fr: "entrée logique", icon: "chip", text: "Une broche du microcontrôleur que le logiciel lit : 0 ou 1 — un contact, une demande.", ports: { in: [], out: [{ key: "level", label: "level", ...B }] }, params: [P("pin", "Broche", 0, "", "Le numéro de la broche d'entrée.", { min: 0, max: 255 })], pin: "din" },
  pin_dout: { nature: "pin", label: "Digital output", fr: "sortie logique", icon: "chip", text: "Une broche du microcontrôleur que le logiciel commande : 0 ou 1 — une bobine, un témoin.", ports: { in: [{ key: "level", label: "level", ...B }], out: [] }, params: [P("pin", "Broche", 0, "", "Le numéro de la broche de sortie.", { min: 0, max: 255 })], pin: "dout" },
  analog_in: { nature: "measure", label: "Analog input", fr: "entrée analogique", icon: "sensor", text: "Des comptes du convertisseur à une grandeur : mise à l'échelle, moyenne glissante, et un drapeau « vraisemblable » quand la valeur reste dans sa plage.",
    ports: { in: [{ key: "counts", label: "counts", unit: "counts", min: 0, max: 65535 }], out: [{ key: "value", label: "value", unit: "*", min: "lo", max: "hi" }, { key: "valid", label: "valid", ...B }] },
    params: [P("unit", "Unité de la valeur", "mV", "", "Ce que la valeur veut dire une fois mise à l'échelle.", { choices: QUANTITY_UNITS }), P("bits", "Résolution du convertisseur", 12, "bit", "Lue sur la fiche du CPU.", { min: 8, max: 16 }), P("vref", "Référence du convertisseur", 3300, "mV", "La tension qui donne la pleine échelle.", { min: 500, max: 5500 }),
      P("num", "Échelle : numérateur", 2, "", "La valeur vaut la tension lue × numérateur ÷ dénominateur + décalage : c'est le pont diviseur ou le capteur.", { min: -100000, max: 100000 }), P("den", "Échelle : dénominateur", 1, "", "", { min: 1, max: 100000 }), P("offset", "Décalage", 0, "*", "Ajouté après l'échelle (un capteur de courant centré au milieu de sa plage en a un).", { min: -10000000, max: 10000000 }),
      P("lo", "Plage : plus petite valeur vraisemblable", 500, "*", "En dessous, la mesure n'est pas crue : fil coupé, capteur débranché.", { min: -10000000, max: 10000000 }), P("hi", "Plage : plus grande valeur vraisemblable", 5000, "*", "Au-dessus, la mesure n'est pas crue.", { min: -10000000, max: 10000000 }), P("n", "Moyenne glissante", 4, "éch.", "Sur combien d'échantillons : 1, 2, 4, 8 ou 16.", { choices: [1, 2, 4, 8, 16] })],
    init: () => ({ buf: new Array(16).fill(0), k: 0, sum: 0, primed: 0 }),
    step(s, c, i) { const full = (1 << c.bits) - 1, mv = div(i.counts * c.vref, full), x = div(mv * c.num, c.den) + c.offset;
      if (!s.primed) { for (let q = 0; q < c.n; q++) s.buf[q] = x; s.sum = x * c.n; s.primed = 1; } else { s.sum += x - s.buf[s.k]; s.buf[s.k] = x; } s.k = (s.k + 1) % c.n;
      const value = div(s.sum, c.n); return { value, valid: value >= c.lo && value <= c.hi ? 1 : 0 }; } },
  energy_counter: { nature: "measure", label: "Energy counter", fr: "compteur d'énergie", icon: "bolt", text: "Ce qui compte l'énergie qui sort du pack et celle qui y entre, à partir du courant et de la tension — le mot du projet : « energy flow counter ».",
    ports: { in: [{ key: "i", label: "current", unit: "mA", min: -1000000, max: 1000000 }, { key: "v", label: "voltage", unit: "mV", min: 0, max: 1000000 }], out: [{ key: "e_out", label: "energy out", unit: "mWh", min: 0, max: 2000000000 }, { key: "e_in", label: "energy in", unit: "mWh", min: 0, max: 2000000000 }] },
    params: [], init: () => ({ a_out: 0, a_in: 0, e_out: 0, e_in: 0 }),
    step(s, c, i, dt) { const p = div(i.i * i.v, 1000), K = 3600000;      // mW ; an accumulator of mW·ms, emptied of its whole mWh at each step : it never grows
      if (p > 0) { s.a_out += p * dt; const q = div(s.a_out, K); s.e_out += q; s.a_out -= q * K; } else if (p < 0) { s.a_in += -p * dt; const q = div(s.a_in, K); s.e_in += q; s.a_in -= q * K; }
      return { e_out: s.e_out, e_in: s.e_in }; } },
  limit: { nature: "decide", label: "Limit", fr: "seuil avec délai et hystérésis", icon: "warning", text: "Déclenche quand la valeur reste au-delà du seuil pendant le délai ; ne revient que lorsqu'elle repasse le seuil de retour.",
    ports: { in: [{ key: "value", label: "value", unit: "*", min: -10000000, max: 10000000 }], out: [{ key: "trip", label: "trip", ...B }] },
    params: [P("unit", "Unité de la valeur", "mV", "", "La même que ce qui lui est relié.", { choices: QUANTITY_UNITS }), P("above", "Sens", 1, "", "1 : déclenche au-dessus du seuil (surtension, surtempérature). 0 : en dessous (sous-tension).", { choices: [1, 0] }),
      P("trip", "Seuil", 4250, "*", "La valeur à ne pas dépasser.", { min: -10000000, max: 10000000 }), P("clear", "Seuil de retour", 4150, "*", "Où la valeur doit revenir pour que le seuil se relâche : l'hystérésis évite de battre.", { min: -10000000, max: 10000000 }), P("delay", "Délai", 100, MS, "Combien de temps la valeur doit rester au-delà du seuil : un parasite ne déclenche pas.", { min: 0, max: 600000 })],
    init: () => ({ t: 0, tripped: 0 }),
    step(s, c, i, dt) { const over = c.above ? i.value >= c.trip : i.value <= c.trip, back = c.above ? i.value <= c.clear : i.value >= c.clear;
      if (!s.tripped) { if (over) { s.t += dt; if (s.t >= c.delay) s.tripped = 1; } else s.t = 0; } else if (back) { s.tripped = 0; s.t = 0; }
      return { trip: s.tripped }; } },
  fault_latch: { nature: "decide", label: "Fault latch", fr: "mémoire de défaut", icon: "lock", text: "Retient un défaut dès qu'une de ses entrées passe à 1 ; ne l'oublie que sur un acquittement, toutes les entrées revenues à 0.",
    ports: { in: [{ key: "a", label: "a", ...B }, { key: "b", label: "b", ...B, free: 1 }, { key: "c", label: "c", ...B, free: 1 }, { key: "reset", label: "reset", ...B, free: 1 }], out: [{ key: "fault", label: "fault", ...B }] }, params: [], init: () => ({ fault: 0 }),
    step(s, c, i) { const any = i.a || i.b || i.c ? 1 : 0; if (any) s.fault = 1; else if (i.reset) s.fault = 0; return { fault: s.fault }; } },
  module_state: { nature: "decide", label: "Module state machine", fr: "machine à états du module", icon: "flow", text: "L'état du module, dit au véhicule : normal ; dératé tant qu'un avertissement tient ; urgence quand la chaîne des cartes se tait ; arrêt — contacteur ouvert — sur un défaut, ou quand l'urgence dure. On ne sort de l'arrêt que par un acquittement, sans défaut.",
    ports: { in: [{ key: "fault", label: "fault", ...B }, { key: "lost", label: "chain lost", ...B, free: 1 }, { key: "warn_a", label: "warning a", ...B, free: 1 }, { key: "warn_b", label: "warning b", ...B, free: 1 }, { key: "reset", label: "reset", ...B, free: 1 }],
      out: [{ key: "state", label: "state", unit: "state", min: 0, max: 3 }, { key: "close", label: "close", ...B }, { key: "derate", label: "derate", ...B }, { key: "emergency", label: "emergency", ...B }] },
    params: [P("t_lost", "Silence admis de la chaîne", 500, MS, "Combien de temps la chaîne des cartes peut se taire avant l'urgence.", { min: 10, max: 60000 }), P("t_emerg", "Durée admise de l'urgence", 1000, MS, "Combien de temps l'urgence dure avant que le contacteur s'ouvre : le temps qu'a le véhicule pour s'arrêter.", { min: 10, max: 600000 })],
    init: () => ({ st: 0, tl: 0, te: 0 }),
    step(s, c, i, dt) {      // 0 normal, 1 derated, 2 emergency, 3 stop (contactor open)
      if (i.fault) { s.st = 3; s.tl = 0; s.te = 0; }
      else if (s.st === 3) { if (i.reset) { s.st = 0; s.tl = 0; s.te = 0; } }
      else {
        if (i.lost) { if (s.tl < c.t_lost) s.tl += dt; } else s.tl = 0;
        if (s.tl >= c.t_lost) { if (s.st !== 2) { s.st = 2; s.te = 0; } else { s.te += dt; if (s.te >= c.t_emerg) { s.st = 3; s.te = 0; } } }
        else { s.st = i.warn_a || i.warn_b ? 1 : 0; s.te = 0; }
      }
      return { state: s.st, close: s.st < 3 ? 1 : 0, derate: s.st === 1 ? 1 : 0, emergency: s.st === 2 ? 1 : 0 }; } },
  contactor: { nature: "command", label: "Contactor driver", fr: "commande d'un contactor", icon: "power", text: "Ferme le contactor sur demande, l'ouvre sur un défaut, et relit son contact auxiliaire : s'il ne suit pas l'ordre à temps, c'est un défaut — soudé, ou bobine coupée.",
    ports: { in: [{ key: "request", label: "request", ...B }, { key: "inhibit", label: "inhibit", ...B }, { key: "feedback", label: "feedback", ...B }], out: [{ key: "drive", label: "drive", ...B }, { key: "fault", label: "fault", ...B }] },
    params: [P("t_fb", "Temps de réponse admis", 50, MS, "Combien de temps le contact auxiliaire a pour suivre l'ordre.", { min: 1, max: 5000 })], init: () => ({ drive: 0, t: 0, fault: 0 }),
    step(s, c, i, dt) { if (i.feedback !== s.drive) { s.t += dt; if (s.t >= c.t_fb) s.fault = 1; } else { s.t = 0; if (!i.request) s.fault = 0; }      // the order given at the step before is what the contact must follow
      s.drive = i.request && !i.inhibit && !s.fault ? 1 : 0; return { drive: s.drive, fault: s.fault }; } },
};
Object.assign(KINDS, MORE_KINDS);      // the conventional blocks of every embedded program (sw/sw_kinds_more.js)
/** The parameters of an object : what its kind proposes, with what the object says in their place. */
export const cfgOf = (obj) => { const K = KINDS[obj.kind]; return Object.fromEntries((K ? K.params : []).map((p) => [p.key, obj.params && obj.params[p.key] !== undefined ? obj.params[p.key] : p.value])); };
/** A port of an object, as it is once its parameters are known : { key, label, unit, min, max, free? } — "*" is the unit the object chose, « lo » / « hi » its range. */
export function portOf(obj, dir, key) {
  const K = KINDS[obj.kind], p = K && (K.ports[dir] || []).find((x) => x.key === key); if (!p) return null; const c = cfgOf(obj), val = (v) => (typeof v === "string" ? c[v] : v);
  const bits = obj.kind === "pin_adc" && obj.bits ? (1 << obj.bits) - 1 : null;
  return { ...p, unit: p.unit === "*" ? c.unit : p.unit, min: val(p.min), max: bits !== null && p.key === "counts" ? bits : val(p.max) };
}
/** The ports of an object. → { in: […], out: […] } */
export const portsOf = (obj) => { const K = KINDS[obj.kind]; return { in: (K ? K.ports.in : []).map((p) => portOf(obj, "in", p.key)), out: (K ? K.ports.out : []).map((p) => portOf(obj, "out", p.key)) }; };
/** The unit a parameter is read in : "*" is the unit the object chose. */
export const paramUnit = (obj, p) => (p.unit === "*" ? cfgOf(obj).unit : p.unit);
