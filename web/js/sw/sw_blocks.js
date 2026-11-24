/* DynamiteOrbit.ai — Logiciel : the software as BLOCKS that key into each other (demande de JP, 24 novembre 2026 : « instead of the V shape
   standard process very boring… a SW block system with key shape (like lego block) and color, a design view from left to right, input
   output, similar to labview in a way but with more ergonomic blocks »).
   What a block is does not change (sw/sw_objects.js : its ports, its values, its step) ; this file says how it is SEEN :
     - the KEY of a port is the shape of what it carries — a 0 / 1 decision is a square tooth, a physical quantity a round one, raw counts a
       dovetail, a state a point, a command an arrow, a time a step. An output is a tab, an input a notch of the same shape : only what fits
       may be wired, as the units already decide (sw/sw_design.js wireCheck) ; and the wire takes the colour of its type, as the wires of a
       block-diagram tool do (LabVIEW colours its wires by data type) ;
     - the FAMILY of a block is its colour and its column, read from left to right as the signal flows : the board's inputs, acquire,
       decide, regulate, command, the board's outputs ;
     - the LIBRARY : the blocks every embedded program shares (« Commun embarqué »), and those of a domain — battery / ESS, robot, power
       drive, standalone device. A block the tool cannot run yet is shown, greyed, « à venir » : never placed, never pretended ;
     - the HARDWARE TAG of a block : the board the software runs on, and for a pin the pin or the net of that board it reads or drives —
       the software is aligned on the hardware of the same project, by default ;
     - where a VALUE comes from : a requirement of the project (green), typed or confirmed by someone (blue), or a reference value the tool
       proposed (amber, an example to confirm).
   Pure : no page. */

import { KINDS, NATURES, portsOf, cfgOf } from "./sw_objects.js";
import { liveWires, order, split, confirmedReqs, wireCheck } from "./sw_design.js";
import { productBoards } from "../pcba/board_role.js";
import { DEVICES, DEVICES_PLANNED } from "./sw_devices.js";

/* ---------- the keys : one shape and one colour per type of signal ---------- */
export const SIGNAL_TYPES = {
  bool: { key: "bool", shape: "square", color: "#16a34a", fr: "Décision 0 / 1", label: "Boolean", text: "Vrai ou faux : un seuil franchi, une demande, un contact fermé." },
  quantity: { key: "quantity", shape: "round", color: "#ea580c", fr: "Grandeur physique", label: "Physical quantity", text: "Une tension, un courant, une température, une énergie, une vitesse — un entier dans son unité." },
  raw: { key: "raw", shape: "dovetail", color: "#64748b", fr: "Comptes bruts", label: "Raw counts", text: "Ce que donne le convertisseur, avant toute mise à l'échelle." },
  command: { key: "command", shape: "arrow", color: "#db2777", fr: "Commande", label: "Command (‰)", text: "Ce que le logiciel demande à un actionneur : un rapport cyclique, en pour mille." },
  state: { key: "state", shape: "point", color: "#7c3aed", fr: "État", label: "State (enum)", text: "Un état parmi quelques-uns : normal, dératé, urgence, arrêt." },
  time: { key: "time", shape: "step", color: "#0284c7", fr: "Temps", label: "Time", text: "Une durée, en millisecondes." },
};
/** The type of a signal, from its unit. */
export const typeOf = (unit) => (unit === "0/1" ? "bool" : unit === "counts" ? "raw" : unit === "state" ? "state" : unit === "‰" ? "command" : unit === "ms" ? "time" : "quantity");

/** The profile of a key on a vertical edge at x, centred on y, travelling DOWN (dir 1) or UP (dir -1). It always bulges toward +x : the tab of
    an output sticks out of the right edge, the notch of an input goes into the left edge — so the tab of one block fits the notch of the next.
    → an SVG path fragment (it starts with « L » from the edge, ends on the edge) */
export function keyPath(type, x, y, dir = 1, a = 7, k = 9) {
  const shape = (SIGNAL_TYPES[type] || SIGNAL_TYPES.quantity).shape, f = (n) => Math.round(n * 100) / 100;
  if (shape === "round") return dir > 0 ? `L ${f(x)} ${f(y - a)} A ${k} ${a} 0 0 1 ${f(x)} ${f(y + a)}` : `L ${f(x)} ${f(y + a)} A ${k} ${a} 0 0 0 ${f(x)} ${f(y - a)}`;
  const P = { square: [[0, -a], [k, -a], [k, a], [0, a]], dovetail: [[0, -a * 0.55], [k, -a], [k, a], [0, a * 0.55]], point: [[0, -a], [k, 0], [0, a]],
    arrow: [[0, -a * 0.45], [k * 0.45, -a * 0.45], [k * 0.45, -a], [k, 0], [k * 0.45, a], [k * 0.45, a * 0.45], [0, a * 0.45]],
    step: [[0, -a], [k, -a], [k, 0], [k * 0.5, 0], [k * 0.5, a], [0, a]] }[shape];
  return (dir > 0 ? P : [...P].reverse()).map(([dx, dy]) => `L ${f(x + dx)} ${f(y + dy)}`).join(" ");
}

/* ---------- the families : colour and column, from left to right ---------- */
export const FAMILIES = [
  { id: "sensor", fr: "Capteurs", label: "Sensors", color: "#0f766e", icon: "sensor", text: "Le matériel qui mesure : une thermistance, un capteur de courant, un bouton. Une brique pose sa broche et son bloc d'acquisition, reliés, aux valeurs typiques à confirmer." },
  { id: "hw_in", fr: "Entrées de la carte", label: "Board inputs", color: "#475569", icon: "chip", text: "Ce que le CPU lit sur la carte : une voie du convertisseur, une broche." },
  { id: "acquire", fr: "Acquérir", label: "Acquire", color: "#0891b2", icon: "sensor", text: "Faire d'un nombre brut une grandeur que l'on comprend, et dire si on peut la croire." },
  { id: "decide", fr: "Décider", label: "Decide", color: "#7c3aed", icon: "wizard", text: "Comparer, attendre, combiner, retenir : ce qui fait d'une mesure une décision." },
  { id: "control", fr: "Réguler", label: "Control", color: "#d97706", icon: "param", text: "Amener une grandeur à sa consigne, sans à-coup." },
  { id: "act", fr: "Commander", label: "Actuate", color: "#dc2626", icon: "power", text: "Agir sur le matériel, et relire que l'ordre a été suivi." },
  { id: "comm", fr: "Communiquer", label: "Communicate", color: "#2563eb", icon: "link", text: "Échanger avec une autre carte ou le véhicule : une trame, un message." },
  { id: "safety", fr: "Veiller", label: "Supervise", color: "#059669", icon: "lock", text: "Surveiller le logiciel lui-même et garder ce qui doit survivre à une coupure." },
  { id: "hw_out", fr: "Sorties de la carte", label: "Board outputs", color: "#334155", icon: "chip", text: "Ce que le CPU commande sur la carte : une broche, une sortie à modulation." },
  { id: "actuator", fr: "Actionneurs", label: "Actuators", color: "#be123c", icon: "power", text: "Le matériel qui agit : une bobine, un témoin, une vanne, un chauffage. Une brique pose la broche de sortie qui le commande." },
];
export const familyOf = (kind, o) => { if (o && o.device && DEVICES[o.device]) return FAMILIES.find((f) => f.id === DEVICES[o.device].side); const K = KINDS[kind]; if (!K) return FAMILIES[2]; const id = K.pin ? (K.pin === "dout" ? "hw_out" : "hw_in") : { measure: "acquire", decide: "decide", control: "control", command: "act" }[K.nature] || "decide"; return FAMILIES.find((f) => f.id === id); };

/* ---------- the library : common blocks first, then the blocks of a domain ---------- */
export const PACKS = [
  { id: "core", fr: "Commun embarqué", label: "Common embedded", color: "#475569", icon: "chip", text: "Ce que presque tout logiciel embarqué porte, quel que soit le produit : lire, filtrer, comparer, temporiser, réguler, commander, surveiller." },
  { id: "io", fr: "Capteurs · actionneurs", label: "Sensors · actuators", color: "#0f766e", icon: "sensor", text: "Le matériel typique autour du CPU : ce qui mesure (température, tension, courant, pression, position, boutons) et ce qui agit (bobine, témoin, vanne, chauffage)." },
  { id: "bms", fr: "Batterie · BMS / ESS", label: "Battery · BMS / ESS", color: "#16a34a", icon: "bolt", text: "Un pack, ses cellules, ses contactors, son énergie : surveiller, protéger, compter." },
  { id: "robot", fr: "Robot · mouvement", label: "Robot · motion", color: "#0891b2", icon: "flow", text: "Des moteurs, des codeurs, une trajectoire : faire bouger juste, et s'arrêter à temps." },
  { id: "drive", fr: "Puissance · moteur", label: "Power · motor drive", color: "#d97706", icon: "power", text: "Un onduleur ou un variateur : la commande vectorielle, la modulation, les protections rapides." },
  { id: "device", fr: "Appareil autonome", label: "Standalone device", color: "#7c3aed", icon: "sensor", text: "Un appareil à pile, à boutons et à témoins : veiller, réveiller, montrer." },
];
const E = (pack, kind) => ({ pack, kind, family: familyOf(kind).id });
const L = (pack, id, family, label, fr, text) => ({ pack, id, family, label, fr, text, planned: true });
/** The library. A block with a `kind` is placed and runs ; a `planned` one is shown, greyed — the tool cannot run it yet. */
export const LIBRARY = [
  E("core", "pin_adc"), E("core", "pin_din"), E("core", "analog_in"), E("core", "debounce"), E("core", "limit"), E("core", "on_delay"), E("core", "logic"), E("core", "fault_latch"),
  E("core", "pid"), E("core", "ramp"), E("core", "pin_dout"),
  L("core", "lowpass", "acquire", "Low-pass filter", "filtre passe-bas", "Lisser une mesure bruitée, au premier ordre."),
  L("core", "lookup", "acquire", "Lookup table 1D", "table d'interpolation", "D'une mesure à une grandeur par une table : une thermistance, une courbe de capteur."),
  L("core", "pwm_out", "hw_out", "PWM output", "sortie à modulation", "Un rapport cyclique sur une broche de minuterie."),
  L("core", "uart_frame", "comm", "Serial frame (UART / RS-485)", "trame série", "Envoyer et recevoir une trame : la liaison existe déjà côté pilote (PCBA, interface matériel / logiciel)."),
  L("core", "can_msg", "comm", "CAN message", "message CAN", "Un message périodique vers le véhicule ou une autre carte."),
  L("core", "watchdog", "safety", "Watchdog", "chien de garde", "Le logiciel prouve qu'il tourne ; sinon, le CPU redémarre."),
  L("core", "nvm", "safety", "Non-volatile memory", "mémoire non volatile", "Garder un compteur, un défaut, un réglage à travers une coupure."),
  E("bms", "energy_counter"), E("bms", "module_state"), E("bms", "contactor"),
  L("bms", "soc", "acquire", "State of charge (coulomb counting)", "état de charge", "La charge restante, par le courant compté."),
  L("bms", "balancing", "act", "Passive balancing", "équilibrage passif", "Décharger la cellule la plus haute, sur ordre."),
  L("bms", "precharge", "act", "Precharge sequence", "précharge", "Fermer d'abord par une résistance, puis le contactor principal."),
  L("bms", "imd", "safety", "Insulation monitor", "contrôle d'isolement", "Surveiller la résistance d'isolement du pack."),
  L("robot", "encoder", "hw_in", "Quadrature encoder", "codeur incrémental", "Une position et une vitesse à partir de deux voies A / B."),
  L("robot", "hbridge", "act", "Motor driver (H-bridge)", "pont en H", "Le sens et le rapport cyclique d'un moteur à courant continu."),
  L("robot", "profile", "control", "Motion profile", "profil de mouvement", "Accélérer, rouler, freiner : une trajectoire trapézoïdale."),
  L("robot", "estop", "safety", "Emergency stop", "arrêt d'urgence", "Couper le mouvement, et le dire."),
  L("drive", "foc", "control", "Field-oriented control", "commande vectorielle", "Clarke, Park, deux régulateurs PI et la modulation."),
  L("drive", "svpwm", "hw_out", "Space-vector PWM", "modulation vectorielle", "Trois rapports cycliques pour un pont triphasé."),
  L("drive", "ocp", "safety", "Fast overcurrent trip", "surintensité rapide", "Couper le pont avant que les composants ne souffrent."),
  L("device", "button", "decide", "Button (short / long press)", "bouton (appui court / long)", "Un appui court, un appui long, un double clic."),
  L("device", "led_pattern", "act", "LED / buzzer pattern", "motif de témoin", "Un témoin qui dit l'état : fixe, clignotant, éteint."),
  L("device", "sleep", "safety", "Sleep and wake-up", "veille et réveil", "Dormir pour durer, se réveiller sur un bouton ou une minuterie."),
  /* typical sensors and actuators (sw/sw_devices.js) : a brick puts the pin and what reads it */
  ...Object.entries(DEVICES).map(([device, D]) => ({ pack: "io", device, family: D.side, label: D.label, fr: D.fr, text: D.text })),
  ...DEVICES_PLANNED.map((D) => ({ pack: "io", id: D.id, family: D.side, label: D.label, fr: D.fr, text: D.text, planned: true })),
];

/* ---------- left to right : columns by the flow of the wires ---------- */
export const BLOCK = { W: 230, HEAD: 32, TAG: 22, ROW: 26, CHIPS: 24, PAD: 10, COL: 320, GAP: 34 };
/** The size of a block, and where its ports are. */
export function blockBox(o) {
  const P = portsOf(o), rows = Math.max(1, P.in.length, P.out.length), lines = chipLayout(o).reduce((m, c) => Math.max(m, c.row + 1), 0), chips = lines ? lines * 20 + 4 : 0;
  return { x: o.x || 0, y: o.y || 0, w: BLOCK.W, h: BLOCK.HEAD + BLOCK.TAG + rows * BLOCK.ROW + chips + BLOCK.PAD, top: BLOCK.HEAD + BLOCK.TAG };
}
export const portY = (o, dir, key) => { const p = portsOf(o)[dir], i = Math.max(0, p.findIndex((x) => x.key === key)); return BLOCK.HEAD + BLOCK.TAG + i * BLOCK.ROW + BLOCK.ROW / 2; };
/** The column of each block, read from the wires : the board's inputs first, its outputs last, every other block one column after the
    latest block it reads (a wire that carries the value of the step before does not count). → { id: column } */
export function columns(d) {
  const objs = (d.objects || []).filter((o) => KINDS[o.kind]), W = liveWires(d).filter((w) => !w.delay), col = {}, ord = order(d).ids;
  for (const o of objs) col[o.id] = KINDS[o.kind].pin && KINDS[o.kind].pin !== "dout" ? 0 : 1;
  for (const id of [...ord, ...objs.map((o) => o.id).filter((x) => !ord.includes(x))]) for (const w of W) if (split(w.to)[0] === id) col[id] = Math.max(col[id], (col[split(w.from)[0]] || 0) + 1);
  const last = Math.max(1, ...objs.filter((o) => KINDS[o.kind].pin !== "dout").map((o) => col[o.id] + 1));
  for (const o of objs) if (KINDS[o.kind].pin === "dout") col[o.id] = last;
  return col;
}
/** Where each block goes, from left to right : its column, then down the column in the order of what feeds it (fewer crossings). → { id: { x, y } } */
export function flowLayout(d) {
  const objs = (d.objects || []).filter((o) => KINDS[o.kind]), col = columns(d), W = liveWires(d), out = {}, by = {};
  for (const o of objs) (by[col[o.id]] = by[col[o.id]] || []).push(o);
  for (const c of Object.keys(by).map(Number).sort((a, b) => a - b)) {
    const feeders = (o) => W.filter((w) => split(w.to)[0] === o.id).map((w) => out[split(w.from)[0]]).filter(Boolean), at = (o) => { const f = feeders(o); return f.length ? f.reduce((s, p) => s + p.y, 0) / f.length : Infinity; };
    const list = [...by[c]].sort((a, b) => at(a) - at(b) || (a.y || 0) - (b.y || 0)); let y = 20;
    for (const o of list) { const want = at(o), top = Number.isFinite(want) ? Math.max(y, Math.round(want / 10) * 10) : y; out[o.id] = { x: 20 + c * BLOCK.COL, y: top }; y = top + blockBox(o).h + BLOCK.GAP; }
  }
  return out;
}

/* ---------- the values : where each comes from ---------- */
export const VALUE_SOURCES = {
  req: { key: "req", color: "#16a34a", fr: "Exigence", text: "Donnée par une exigence du projet — en pointillé tant que l'exigence n'est pas confirmée." },
  sure: { key: "sure", color: "#2563eb", fr: "Confirmée", text: "Tapée ou confirmée par quelqu'un du projet." },
  ref: { key: "ref", color: "#d97706", fr: "Référence", text: "Valeur de référence proposée par l'outil : un exemple, à confirmer." },
};
export const sourceOf = (o, key) => (o.src && o.src[key] ? "req" : (o.sure || []).includes(key) ? "sure" : "ref");
/** The values shown on a block : those that set its behaviour (not its unit, not a pin number). A value given by a requirement is PENDING while
    that requirement is not confirmed — an answer of an assistant confirms nothing. → [{ key, label, value, unit, source, pending }] */
export function valueChips(o, d) {
  const K = KINDS[o.kind]; if (!K || K.pin) return []; const c = cfgOf(o), ok = d ? confirmedReqs(d) : new Set();
  return K.params.filter((p) => p.key !== "unit" && p.key !== "bits" && p.key !== "vref").map((p) => { const source = sourceOf(o, p.key); return { key: p.key, label: p.label, value: c[p.key], unit: p.unit === "*" ? c.unit : p.unit, source, pending: source === "req" && !ok.has(o.src[p.key]) && !(o.sure || []).includes(p.key) }; });
}

/* ---------- blocks that KEY into each other (demande de JP, 24 novembre 2026 : « qu'il se connecte automatiquement car on les approche les uns
   des autres avec des interfaces compatibles, comme un jeu de blocs… une interface mécanique avec keying serait plus visuelle que des fils ») ---------- */
export const SNAP = 28;
/** Is a wire DOCKED : the tab of its output sits in the notch of its input, the two blocks side by side ? */
export function docked(d, w) {
  const O = Object.fromEntries((d.objects || []).map((o) => [o.id, o])), [a, ap] = split(w.from), [b, bp] = split(w.to), A = O[a], B = O[b]; if (!A || !B || !KINDS[A.kind] || !KINDS[B.kind]) return false;
  return (B.x || 0) === (A.x || 0) + BLOCK.W && (A.y || 0) + portY(A, "out", ap) === (B.y || 0) + portY(B, "in", bp);
}
/** Where a block dropped at (x, y) keys in : the nearest place, within SNAP, where one of its notches meets a tab of the same key on another
    block (or one of its tabs a free notch), and every pair of ports that then face each other and fit. → { x, y, wires: [{ from, to }], with } or null */
export function snapAt(d, id, x, y) {
  const objs = (d.objects || []).filter((o) => !o.off && KINDS[o.kind]), M = objs.find((o) => o.id === id); if (!M) return null;
  const taken = new Set(liveWires(d).map((w) => w.to)), PM = portsOf(M), fits = (from, to) => !taken.has(to) && wireCheck(d, from, to).ok;
  let best = null;
  for (const B of objs) { if (B.id === id) continue; const PB = portsOf(B);
    for (const i of PM.in) for (const o of PB.out) { if (!fits(`${B.id}.${o.key}`, `${id}.${i.key}`)) continue; const tx = (B.x || 0) + BLOCK.W, ty = (B.y || 0) + portY(B, "out", o.key) - portY(M, "in", i.key), dd = Math.hypot(tx - x, ty - y); if (dd <= SNAP && (!best || dd < best.dd)) best = { x: tx, y: ty, dd, B }; }
    for (const o of PM.out) for (const i of PB.in) { if (!fits(`${id}.${o.key}`, `${B.id}.${i.key}`)) continue; const tx = (B.x || 0) - BLOCK.W, ty = (B.y || 0) + portY(B, "in", i.key) - portY(M, "out", o.key), dd = Math.hypot(tx - x, ty - y); if (dd <= SNAP && (!best || dd < best.dd)) best = { x: tx, y: ty, dd, B }; } }
  if (!best) return null;
  const moved = { ...M, x: best.x, y: best.y }, B = best.B, left = B.x + BLOCK.W === best.x, wires = [];
  const [src, dst] = left ? [B, moved] : [moved, B];
  for (const o of portsOf(src).out) for (const i of portsOf(dst).in) if ((src.y || 0) + portY(src, "out", o.key) === (dst.y || 0) + portY(dst, "in", i.key) && fits(`${src.id}.${o.key}`, `${dst.id}.${i.key}`) && !wires.some((w) => w.to === `${dst.id}.${i.key}`)) wires.push({ from: `${src.id}.${o.key}`, to: `${dst.id}.${i.key}` });
  return wires.length ? { x: best.x, y: best.y, wires, with: B.id } : null;
}

const fmt = (v) => String(v).replace("-", "−");
/** The value chips of a block, laid out in rows inside its width : the key of the value (its technical name), the value, its unit. → [{ ...chip, text, x, w, row }] */
export function chipLayout(o, d) {
  const out = []; let x = 8, row = 0;
  for (const c of valueChips(o, d)) { const text = `${c.key} ${fmt(c.value)}${c.unit ? ` ${c.unit}` : ""}`, w = Math.min(BLOCK.W - 16, Math.round(text.length * 5.7 + 14));
    if (x + w > BLOCK.W - 8) { x = 8; row++; } out.push({ ...c, text, x, w, row }); x += w + 4; }
  return out;
}

/* ---------- the hardware : the board the software runs on, the pin or the net of a pin block ---------- */
const MCU = /^U-MCU/;
/** The board the software runs on : the one the design names, else the first board of the product that carries a microcontroller and whose
    name says it commands (BMS, control, commande, central), else the first that carries one. → a board or null */
export function hostBoard(project, d) {
  const boards = productBoards(project), named = d && d.board && boards.find((b) => b.id === d.board); if (named) return named;
  const withMcu = boards.filter((b) => (b.parts || []).some((p) => MCU.test(p.comp || "")));
  return withMcu.find((b) => /bms|central|control|command|ctrl/i.test(`${b.id} ${b.name || ""}`)) || withMcu[0] || null;
}
/** The nets of a board that reach a pin of its microcontroller. → [{ net, pin ("U3.PA0") }] */
export function mcuNets(board) {
  if (!board) return []; const mcus = new Set((board.parts || []).filter((p) => MCU.test(p.comp || "")).map((p) => p.ref));
  return (board.nets || []).flatMap((n) => (n.pins || []).filter((x) => mcus.has(String(x).split(".")[0])).map((pin) => ({ net: n.name, pin }))).sort((a, b) => a.net.localeCompare(b.net));
}
/** The tag of a block. → { state ("linked" | "board" | "missing" | "none"), board (name or ""), text } */
export function hwTag(project, d, o) {
  const b = hostBoard(project, d), K = KINDS[o.kind], name = b ? b.name || b.id : "";
  if (!K || !K.pin) return b ? { state: "board", board: name, text: `${name} · CPU` } : { state: "none", board: "", text: "aucune carte dans le projet" };
  const at = K.pin === "ain" ? `ADC ${cfgOf(o).channel}` : `GPIO ${cfgOf(o).pin}`;
  if (o.hw && o.hw.net) return { state: "linked", board: name, text: `${name ? `${name} · ` : ""}${o.hw.net}${o.hw.pin ? ` · ${o.hw.pin}` : ""}` };
  return { state: "missing", board: name, text: `${at} · net à relier` };
}
/** What the hardware alignment asks, for the guide. → [{ level, text, obj }] */
export function hwProblems(project, d) {
  const b = hostBoard(project, d), out = [], pins = (d.objects || []).filter((o) => !o.off && KINDS[o.kind] && KINDS[o.kind].pin);
  if (!b) { if (pins.length) out.push({ level: "tip", text: "Aucune carte du produit avec un microcontrôleur : le logiciel n'est aligné sur aucun matériel. Le PCBA de la carte de commande l'y attachera d'office." }); return out; }
  const nets = new Set(mcuNets(b).map((x) => x.net)), open = pins.filter((o) => !(o.hw && o.hw.net));
  if (open.length) out.push({ level: "check", text: `${open.length} bloc${open.length > 1 ? "s" : ""} de broche sans net de la carte ${b.name || b.id} : choisissez le net dans sa fiche — l'étiquette du bloc passe au vert.`, obj: open[0].id });
  for (const o of pins) if (o.hw && o.hw.net && !nets.has(o.hw.net)) out.push({ level: "error", text: `${o.name} : le net « ${o.hw.net} » ne touche plus le microcontrôleur de ${b.name || b.id}.`, obj: o.id });
  return out;
}
export { NATURES };
