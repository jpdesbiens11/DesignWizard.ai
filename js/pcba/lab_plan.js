/* DynamiteOrbit.ai — the electronics lab : the functional test plan of a board (demande de JP : « planifier un plan de test
   fonctionnel avec toutes les instructions requises, le détail des manipulations et les mesures attendues… destiné à des
   étudiants du bac en stage et à de jeunes ingénieurs : mentorat du pourquoi on fait ces tests et à quoi s'attendre, et
   manipulations très détaillées, comme un labo éducatif, mais pour de vrais résultats avec de vraies pièces »).
   One sheet per test, in two halves : COMPRENDRE (why, what to expect) and FAIRE (the set-up, the settings of each
   instrument, the steps one by one, the table of readings with a box for what was measured). The set-up is the one the
   simulation was wired with (the journal of the bench, pcba/lab_bench.js) ; the expected values are what it gave ; the
   design calculation stands beside them. The values come from TYPICAL behaviours : the plan says so on every sheet.
   Pure : no DOM — the document model goes to core/docx.js and core/pdfdoc.js. */

import { BLOCKS, blockParams, BLOCK_CATEGORIES } from "./blocks.js";
import { NATURES, INSTRUMENTS, blockTests, runTest, eng } from "./lab_bench.js";
import { measure } from "./lab_mna.js";
import { boardTests, runBoardTest, BOARD_KEY } from "./lab_board.js";

const fr = (x, d = 3) => String(+(+x).toPrecision(d)).replace(".", ",");
/** The next value of the 1 – 2 – 5 series at or above x : the steps of every knob of an instrument. */
export function knob(x) { if (!(x > 0)) return 1; const e = Math.pow(10, Math.floor(Math.log10(x))), m = x / e; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * e; }
/** What a row expects, as one reads it : under a ceiling, a simulated value a thousand times smaller is « about nothing », not a number of nanoamperes. */
export const expectedText = (r) => (r.ceiling && Math.abs(r.expected) < 1e-3 * r.band.high ? `≈ 0 ${r.unit}`.trim() : eng(r.expected, r.unit));
/** A gap to the design calculation, signed : « −83 % ». */
export const gapText = (gap) => `${gap > 0 ? "+" : "−"}${Math.abs(Math.round(gap * 100))} %`;
/** The time base that shows a window of `span` seconds on the ten divisions of the screen : the 1 – 2 – 5 step at or just above a tenth of it. */
export const timeBase = (span) => knob((span / 10) * 0.99);
/** How to set a channel of the oscilloscope to see a signal : { vdiv, coupling, mid } — six divisions for its swing, and never finer than 1 mV a division
    (50 mV in DC) : a flat line is a flat line, not its noise. */
export function channelSetting(y, ac = false) { const m = measure(y), span = ac ? m.pp : Math.max(m.pp, Math.abs(m.max), Math.abs(m.min)); return { vdiv: knob(Math.max(span, ac ? 6e-3 : 0.3) / 6), coupling: ac ? "AC" : "DC", mid: (m.min + m.max) / 2, pp: m.pp, min: m.min, max: m.max }; }
/** The band a first reading is accepted in, around what was expected : { low, high, text }. Voltages are tight, currents and times less so — these are
    first-pass bands, to be tightened with the tolerances of the datasheets. */
export function band(m) {
  const v = m.value; if (!Number.isFinite(v)) return { low: NaN, high: NaN, text: "à relever" };
  if (m.exact) return { low: v, high: v, text: `exactement ${fr(v)}` };
  /* a ceiling : what the simulation gives is a floor of the real thing (a ripple without the resistance of the capacitors), or the level must only stay low */
  if (Number.isFinite(m.under)) return { low: -m.under, high: m.under, text: `moins de ${eng(m.under, m.unit)}` };
  /* a supply current at power-up : the integrated circuits take a quiescent current the model does not have — 10 mA are left for it */
  if (m.idle) { const high = 1.2 * v + 0.01, low = v > 2e-3 ? 0.8 * v : 0; return { low: low || -high, high, text: low ? `${eng(low, m.unit)} à ${eng(high, m.unit)}` : `moins de ${eng(high, m.unit)}` }; }
  if (m.tol) { const d = Math.abs(v) * m.tol; return { low: v - d, high: v + d, text: `${eng(v - d, m.unit)} à ${eng(v + d, m.unit)}` }; }      // a threshold of a typical behaviour : judged wider than a rail
  if (m.swing) { const d = Math.abs(v) * 0.25; return { low: Math.max(0, v - d), high: v + d, text: `${eng(Math.max(0, v - d), m.unit)} à ${eng(v + d, m.unit)}` }; }      // a width — never negative, judged by its own size
  const rel = m.unit === "V" ? 0.05 : m.unit === "A" ? 0.2 : m.unit === "s" || m.unit === "Hz" ? 0.25 : 0.1, floor = m.unit === "V" ? 0.05 : m.unit === "A" ? 2e-4 : 0, d = Math.max(Math.abs(v) * rel, floor);
  if (Math.abs(v) < d * 0.02) return { low: -d, high: d, text: `0 ${m.unit} ± ${eng(d, m.unit)}` };      // nothing, to within what an instrument reads
  return { low: v - d, high: v + d, text: `${eng(v - d, m.unit)} à ${eng(v + d, m.unit)}` };
}
export const SAFETY = [
  "Toujours une limite de courant sur l'alimentation de laboratoire, réglée AVANT de brancher la carte : elle est votre fusible le plus rapide.",
  "On câble et on décâble sortie coupée. On ne déplace jamais une sonde ou une pince sur une carte alimentée en puissance.",
  "La pince de masse de l'oscilloscope est reliée à la terre : ne la posez que sur la masse de la carte — jamais sur un point sous tension, jamais sur une masse isolée sans y avoir réfléchi.",
  "Un condensateur reste chargé après la coupure : attendez, puis vérifiez au multimètre avant de toucher.",
  "Lunettes de protection à la première mise sous tension : un condensateur électrolytique monté à l'envers éclate.",
  "Bracelet antistatique relié à la masse du poste dès que l'on touche la carte.",
  "Ce qui chauffe se repère d'abord à la caméra thermique ou au dos du doigt, brièvement — jamais du bout du doigt posé.",
  "Un essai qui ne donne pas la valeur attendue n'est pas raté : on note ce que l'on mesure, PUIS on cherche pourquoi. On ne corrige jamais un relevé pour qu'il ressemble au plan.",
];
export const SAFETY_HV = [
  "Au-dessus de 50 V, on ne travaille jamais seul, et une main reste dans le dos ou dans la poche pendant la mesure.",
  "Les mesures sur la partie haute tension se font à la sonde différentielle isolée ; l'oscilloscope ne se « flotte » pas.",
  "Le bus est déchargé et VÉRIFIÉ au multimètre avant chaque intervention ; un écriteau « sous tension » reste sur le poste pendant l'essai.",
];
const MINUTES = { power: 10, static: 10, dynamic: 20, frequency: 30, function: 15, bus: 20 };
const wave = (w) => { if (typeof w === "number") return `${fr(w)} V continu`; if (!w) return ""; if (w.kind === "sine") return `sinus de ${eng(w.freq, "Hz")}, ${fr(2 * w.amp)} V crête à crête, décalage ${fr(w.offset || 0)} V`; if (w.kind === "square") return `créneau de ${eng(w.freq, "Hz")}, de ${fr(w.low)} V à ${fr(w.high)} V`; if (w.kind === "step") return `échelon de ${fr(w.low || 0)} à ${fr(w.high)} V`; if (w.kind === "ramp") return `rampe de ${fr(w.from)} à ${fr(w.to)} V en ${eng(w.time, "s")}`; return "suite de niveaux programmée (voir la note)"; };

/** Where one puts a clip or a probe to reach a signal of a block : a connector pin, a test point, or the lead of a part. where(name) → text. */
function accessOf(built, refOf) {
  const pinOf = (name) => { if (String(name).includes(".") && name !== "0") { const [p, pin] = String(name).split("."); return [p, pin]; } const gnd = name === "GND" || name === "0", port = built.ports[name], net = built.nets.find((n) => (gnd ? n.name === "GND" || n.name === "0" : n.name === (port ? port.net : name)));
    if (!net || !(net.pins || []).length) return null; return (net.pins.find((p) => /^J\d*\./.test(p)) || net.pins.find((p) => /^TP/.test(p)) || net.pins.find((p) => /^(R|C)/.test(p)) || net.pins[0]).split("."); };
  return Object.assign(textOf, { pick: (name) => { const x = pinOf(name); return x ? { ref: refOf(x[0]), pin: String(x[1]), signal: String(name) } : null; } });      // the same choice as the words : a connector, a test point, the lead of a part
  function textOf(name) { if (name === "GND" || name === "0") return "la masse de la carte (GND)"; const port = built.ports[name], net = built.nets.find((n) => n.name === (port ? port.net : name)); if (String(name).includes(".")) { const [p, pin] = String(name).split("."); return `la broche ${pin} de ${refOf(p)}`; }
    if (!net) return `le signal ${name}`; const pick = net.pins.find((p) => /^J\d*\./.test(p)) || net.pins.find((p) => /^TP/.test(p)) || net.pins.find((p) => /^(R|C)/.test(p)) || net.pins[0], [p, pin] = pick.split(".");
    return `${name} — ${/^J/.test(p) ? `broche ${pin} du connecteur ${refOf(p)}` : /^TP/.test(p) ? `point de test ${refOf(p)}` : `patte ${pin} de ${refOf(p)}`}`; }
}
/** One sheet of the plan : a test of a block, said for the one who does it.
    o : { refs: { local id → reference on the board }, name (the name of the block on the board), id (its number in the plan) }
    → { id, title, nature, block, why, expect, gear, setup: [text], settings: [text], steps: [text], rows: [{ label, expected, band, design, gap }], table, traps: [text], learn, notes, minutes, result } */
export function testSheet(tpl, testId, given = {}, o = {}) {
  const T = BLOCKS[tpl], R = runTest(tpl, testId, given, o.env ? { env: o.env } : {}), test = R.test; if (!T || !test) return null;      // o.env : what was set on the instruments (pcba/lab_gear.js)
  const P = R.P || blockParams(T, given), built = R.built || T.build(P), refOf = (local) => (o.refs && o.refs[local]) || local;
  return sheetFrom(R, test, accessOf(built, refOf), { id: o.id, tpl, P, name: o.name || T.name, refs: built.parts.map((p) => refOf(p.id)).join(", ") });
}
/** Where one reaches a net of the board : a connector pin, a test point, or the lead of a part. */
function boardAccess(board) {
  const pinOf = (name) => { if (/^[A-Z]+\d+\.[^.]+$/.test(String(name))) return String(name).split("."); const net = (board.nets || []).find((n) => n.name === (name === "0" ? "GND" : name)); if (!net || !(net.pins || []).length) return null; return (net.pins.find((p) => /^TP/.test(p)) || net.pins.find((p) => /^J\d/.test(p)) || net.pins.find((p) => /^(R|C)\d/.test(p)) || net.pins[0]).split("."); };
  return Object.assign(textOf, { pick: (name) => { const x = pinOf(name); return x ? { ref: x[0], pin: String(x[1]), signal: String(name) } : null; } });
  function textOf(name) { if (name === "GND" || name === "0") return "la masse de la carte (GND)"; if (/^[A-Z]+\d+\.[^.]+$/.test(String(name)) && !(board.nets || []).some((n) => n.name === name)) { const [r, pin] = String(name).split("."); return `la broche ${pin} de ${r}`; } const net = (board.nets || []).find((n) => n.name === name); if (!net || !(net.pins || []).length) return `le signal ${name}`;
    const pick = net.pins.find((p) => /^TP/.test(p)) || net.pins.find((p) => /^J\d/.test(p)) || net.pins.find((p) => /^(R|C)\d/.test(p)) || net.pins[0], [ref, pin] = pick.split(".");      // a test point is made for a probe ; an input has only its connector
    return `${name} — ${/^J/.test(ref) ? `broche ${pin} du connecteur ${ref}` : /^TP/.test(ref) ? `point de test ${ref}` : `patte ${pin} de ${ref}`}`; }
}
/** The sheet of a test of the WHOLE board (pcba/lab_board.js) : the same sheet, its set-up said on the nets of the board. */
export function boardSheet(board, testId, o = {}) {
  const R = runBoardTest(board, testId, o.env ? { env: o.env } : {}), test = R.test; if (!test) return null;
  return { ...sheetFrom(R, test, boardAccess(board), { id: o.id, tpl: null, P: {}, name: "Carte entière", refs: "toute la carte" }), blockId: BOARD_KEY, board: true };
}
/* a sheet, from what a run gave : R (the result), test, where(name) → how to reach a signal, o : { id, tpl, P, name, refs } */
function sheetFrom(R, test, where, o) {
  /* a probe moved by hand : its channel says the pad of the BOARD it is on, not the name the block gives it */
  for (const e of (R.log || []).filter((x) => x.instr === "scope" && x.atTo)) { const ch = e.ch === 2 ? R.ch2 : R.ch1, q = where.pick ? where.pick(e.atTo) : null; if (ch && q && typeof ch.label === "string") ch.label = ch.label.replace(`→ ${e.atTo}`, `→ ${q.ref}.${q.pin}`); }
  const P = o.P || {}, tpl = o.tpl, refs = o.refs, N = NATURES.find((n) => n.id === test.nature), setup = [], settings = [], steps = [], scoped = test.gear.includes("scope"), gen = (R.log || []).some((e) => e.instr === "generator" || e.instr === "logic");
  /* THE CLIP OF AN OSCILLOSCOPE IS EARTHED : it goes on a ground, or where a source of the test already has its return — never on a live point. A voltage between two
     live points (the two ends of a motor winding) is `float` : a differential probe, or two probes and their difference. */
  const other = (e) => (e.ref && e.ref !== "GND" ? e.ref : e.toRef && e.toRef !== "GND" ? e.toRef : "GND"), returns = new Set((R.log || []).filter((e) => /^(supply|generator|logic)$/.test(e.instr)).map(other)), floats = (e) => e.instr === "scope" && !!e.ref && !/GND/i.test(e.ref) && !returns.has(e.ref);
  for (const e0 of R.log || []) {
    const e = e0.atTo || e0.atRef ? { ...e0, to: e0.atTo || e0.to, ...(e0.atRef ? (e0.instr === "load" ? { toRef: e0.atRef } : { ref: e0.atRef }) : {}) } : e0;      // a lead moved by hand : the set-up says where it now is
    const ref = e.ref && e.ref !== "GND" ? where(e.ref) : "la masse (GND)";
    if (e.instr === "supply") { setup.push(`Alimentation de laboratoire : le + sur ${where(e.to)}, le − sur ${ref}.${e.note ? ` (${e.note}.)` : ""}`); settings.push(`Alimentation de ${e.to} : ${e.v !== null ? `${fr(e.v)} V` : "voir la note du montage"}${e.ilim ? `, limite de courant ${eng(e.ilim, "A")}` : ""} — réglée SORTIE COUPÉE.`); }
    else if (e.instr === "generator") { setup.push(`${e.logic ? "Signal logique (générateur de fonctions, sortie 50 Ω, ou une sortie du microcontrôleur)" : "Générateur de fonctions"} : le point chaud sur ${where(e.to)}, la masse sur ${ref}.${e.note ? ` (${e.note}.)` : ""}`); settings.push(`Générateur sur ${e.to} : ${wave(e.wave)}${e.set ? " — réglé sur l'appareil" : ""}.`); }
    else if (e.instr === "load") setup.push(`Charge : entre ${where(e.to)} et ${e.toRef && e.toRef !== "GND" ? where(e.toRef) : "la masse"} — ${e.l ? `${eng(e.r, "Ω")} en série avec ${eng(e.l, "H")}` : e.r ? `${eng(e.r, "Ω")} (prévoir ${eng(Math.max(0.25, knob(((P.v || P.vout || P.vm || 5) ** 2) / e.r)), "W")})` : e.i !== null && e.i !== undefined ? `courant constant de ${eng(e.i, "A")}` : "courant programmé (voir la note)"}.${e.note ? ` (${e.note}.)` : ""}`);
    else if (e.instr === "wire") setup.push(`${e.pull ? `Résistance de rappel de ${eng(e.r, "Ω")} entre ${where(e.to)} et ${fr(e.pull)} V` : e.c ? `${where(e.to)} : ${e.note}` : `Résistance de ${eng(e.r, "Ω")} entre ${where(e.to)} et ${where(e.toRef)}`}${e.note && !e.c ? ` — ${e.note}` : ""}.`);
    else if (e.instr === "cell") setup.push(`La pile de la carte alimente le circuit : elle se met dans son support (${where(e.to)}), le + vers le haut, une fois le montage vérifié — pas d'alimentation de laboratoire.${e.note ? ` (${e.note}.)` : ""}`);
    else if (e.instr === "press") setup.push(`Le bouton (${where(e.to)}) : appuyez dessus et tenez-le pendant les relevés${e.note ? ` — ${e.note}` : ""}.`);
    else if (e.instr === "logic") setup.push(`Adaptateur de bus ou analyseur logique sur ${where(e.to)}${e.note ? ` : ${e.note}` : ""}.`);
    else if (e.instr === "scope" && scoped && floats(e)) setup.push(`Oscilloscope, voie ${e.ch} : la tension ENTRE ${where(e.to)} et ${ref} — à la sonde différentielle ; à défaut, deux sondes ×10, une sur chaque point, leurs pinces sur la masse de la carte, et la fonction « math » (différence). JAMAIS la pince de masse sur ${e.ref} : elle est reliée à la terre et mettrait ce point en court-circuit.`);
    else if (e.instr === "scope" && scoped) setup.push(`Oscilloscope, voie ${e.ch} : sonde ×10 sur ${where(e.to)}, sa masse sur ${ref}${e.ac ? " — au ressort de masse, pas à la pince" : ""}.`);
    else if (e.instr === "scope") { const line = `Multimètre, en tension continue : pointe rouge sur ${where(e.to)}, pointe noire sur ${ref}.`; if (!setup.includes(line)) setup.push(line); }      // what the screen shows on a channel, one reads with a multimeter
  }
  if (R.kind === "tran" && R.ch1 && R.ch2 && scoped) { const a = channelSetting(R.ch1.y, R.ch1.ac), b = channelSetting(R.ch2.y, R.ch2.ac), span = R.t[R.t.length - 1] - R.t[0], trig = a.pp >= b.pp * 0.2 && a.pp > 1e-3 ? [1, a] : [2, b];
    settings.push(`Oscilloscope, voie 1 (${R.ch1.label}) : ${eng(a.vdiv, "V")} par division, couplage ${a.coupling}.`, `Oscilloscope, voie 2 (${R.ch2.label}) : ${eng(b.vdiv, "V")} par division, couplage ${b.coupling}.`, `Base de temps : ${eng(timeBase(span), "s")} par division. Déclenchement sur la voie ${trig[0]}, front montant, niveau ${fr(trig[1].mid)} V${span > 0.05 || test.nature === "function" ? ", mode normal" : ", mode automatique"}${/bounce|surge|threshold|power/.test(test.id) ? " — puis monocoup (single) pour figer l'événement" : ""}.`); }
  if (R.kind === "tran" && !scoped) settings.push("Multimètre : tension continue, calibre automatique (ou le calibre juste au-dessus de la valeur attendue).");
  if (!test.noSim && R.measures.some((m) => m.unit === "A" && !m.needs)) settings.push("Courants : l'afficheur de l'alimentation pour ce qu'elle débite ; pour une branche de la carte, un multimètre EN SÉRIE (calibre A ou mA — jamais en parallèle) ou la tension aux bornes d'une résistance connue de cette branche, divisée par sa valeur.");
  if (R.kind === "ac") settings.push(`Générateur : sinus, amplitude constante ; fréquences à balayer de ${eng(R.ac.f[0], "Hz")} à ${eng(R.ac.f[R.ac.f.length - 1], "Hz")}, trois points par décade (1 – 2 – 5).`, "Oscilloscope : voie 1 sur l'entrée, voie 2 sur la sortie, mesures automatiques « crête à crête » sur les deux voies.");
  /* WHAT THE BENCH READS IS WHAT THE SCREEN DRAWS (demande de JP : « des différences entre les mesures virtuelles du labo et ce qui est demandé dans le labo réel »).
     In a test done with a multimeter : a time or a frequency cannot be read with it — the row asks for an oscilloscope, and is not owed ; and each curve of the
     screen that has settled is READ — its end is the number the multimeter shows (`end` : the channel). A curve that still moves at its end is what one sweeps by hand. */
  const pick = where.pick || (() => null), meter = !test.noSim && !scoped && R.kind === "tran", M = R.measures.map((m) => (meter && /^(s|Hz)$/.test(m.unit) && !m.needs ? { ...m, needs: "un oscilloscope", scope: true } : m));
  if (meter) for (const e of (R.log || []).filter((x) => x.instr === "scope" && (!x.ref || x.ref === "GND") && !x.atRef).map((x) => (x.atTo ? { ...x, to: x.atTo } : x))) { const ch = e.ch === 2 ? R.ch2 : R.ch1; if (!ch || !ch.y || !ch.y.length || M.some((m) => m.unit === "V" && (m.at || []).length === 1 && m.at[0] === e.to)) continue;
    const z = measure(ch.y, 0.8); if (z.pp > Math.max(0.02, 0.02 * Math.abs(z.mean))) continue; M.push({ label: `Tension sur ${e.to}, une fois établie`, unit: "V", value: Math.abs(z.mean) < 1e-3 ? 0 : z.mean, design: null, gap: null, at: [e.to], end: e.ch || 1 }); }
  const rows = [...M.filter((m) => !m.needs), ...M.filter((m) => m.needs)].map((m) => ({ label: m.label, unit: m.unit, expected: m.value, points: (m.at || []).map(pick).filter(Boolean), band: test.noSim ? { text: "moins de 1 Ω", low: 0, high: 1 } : band(m), design: m.design, gap: m.gap, ...(m.under !== undefined || m.idle ? { ceiling: true } : {}), ...(m.needs ? { optional: true, needs: m.needs } : {}), ...(m.scope ? { scope: true } : {}), ...(m.end ? { end: m.end } : {}), ...(m.pair ? { pair: true } : {}), ...(m.before ? { before: true } : {}) }));
  /* the steps : the same skeleton for every test, then what this one reads */
  if (test.noSim) steps.push("Carte HORS TENSION, aucun instrument branché dessus.", "Multimètre en mode continuité (ou ohmmètre, calibre le plus bas). Touchez les deux pointes ensemble : notez la résistance des cordons, à retrancher.", "Pour chaque ligne du tableau : une pointe sur la broche, l'autre sur le signal ; notez la valeur.", "Puis, broche après broche : une pointe sur la broche, l'autre sur sa voisine. Aucune continuité ne doit apparaître entre deux signaux différents.");
  else {
    steps.push("Vérifiez le montage sur le schéma de la fiche, instrument par instrument, AVANT d'alimenter. Faites-le relire par quelqu'un la première fois.", "Sortie de l'alimentation coupée : réglez la tension et la limite de courant indiquées. Court-circuitez brièvement les cordons pour vérifier que la limite agit, si l'alimentation n'affiche pas sa consigne.");
    if (gen) steps.push("Réglez le générateur SANS le relier à la carte, et vérifiez son signal à l'oscilloscope : amplitude, décalage, fréquence. Coupez sa sortie.");
    steps.push("Activez la sortie de l'alimentation en regardant l'afficheur de courant. Une limitation d'un instant, le temps de charger les condensateurs, est normale ; si elle dure plus d'une seconde : COUPEZ, et cherchez un court-circuit avant toute autre chose.");
    if (gen) steps.push("Reliez le générateur, activez sa sortie.");
    if (R.kind === "tran" && !scoped) steps.push("Un seul multimètre, une mesure à la fois : pour chaque tension du tableau, posez la pointe noire sur la masse, puis la rouge sur le point indiqué, et attendez que le chiffre se stabilise.");
    if (R.kind === "tran" && scoped) steps.push("Réglez l'oscilloscope comme indiqué ; ajustez la base de temps jusqu'à voir deux ou trois cycles, ou l'événement entier.", "Comparez ce que montre l'écran à ce que la fiche annonce sous « À quoi s'attendre ». Faites une capture d'écran : elle ira dans le compte rendu.");
    if (R.kind === "ac") steps.push("À chaque fréquence : notez l'amplitude crête à crête de l'entrée ET de la sortie ; le gain est leur rapport. L'amplitude d'entrée bouge un peu avec la fréquence : on la relit à chaque point.", "Tracez les points sur un papier log – log (ou dans un tableur) : la coupure est là où le gain a perdu 3 dB — il vaut 0,71 fois sa valeur des basses fréquences.");
    for (const x of test.steps || []) steps.push(x);
    for (const m of rows) steps.push(m.optional ? `« ${m.label} » demande ${m.needs} : si le banc n'en a pas, laissez la case vide — la valeur attendue est donnée pour comprendre ce qui se passe.` : `Relevez « ${m.label} » et inscrivez la valeur dans le tableau.${m.end ? ` C'est la fin de la courbe ${m.end === 2 ? "bleue (CH2)" : "jaune (CH1)"} de l'écran.` : ""}`);
    if (R.table) steps.push(`Recommencez pour chaque valeur de « ${R.table.label} » du second tableau${/Température/.test(R.table.label) ? " : air chaud ou bombe de froid sur le composant, thermocouple collé à côté, attendre que la lecture se stabilise" : ""}.`);
    steps.push(`${gen ? "Coupez le générateur, puis l'alimentation" : "Coupez la sortie de l'alimentation"}. Attendez que les tensions soient retombées avant de décâbler.`);
  }
  const traps = [...(test.nature === "power" ? ["L'alimentation passe en limitation : court-circuit, composant à l'envers, ou limite réglée trop bas pour le courant d'appel des condensateurs — remontez-la d'un cran, une seule fois."] : []),
    ...(R.kind === "tran" && scoped ? ["L'écran ne montre rien de stable : vérifiez le déclenchement (bonne voie, niveau à l'intérieur du signal), puis le couplage et le calibre de la sonde (×10 des deux côtés : sur la sonde ET dans le menu de la voie)."] : []),
    ...(R.kind === "ac" ? ["Le gain mesuré est trop bas à toutes les fréquences : l'entrée est peut-être chargée par le générateur — relisez l'amplitude d'entrée SUR la carte, pas sur l'afficheur du générateur."] : []),
    ...(test.nature === "bus" ? ["Aucune réponse : vérifiez d'abord l'alimentation du composant, puis les rappels, puis l'adresse ; un bus ne se dépanne pas à l'analyseur avant d'avoir regardé ses niveaux à l'oscilloscope."] : []),
    "La valeur est hors de la plage : notez-la telle quelle, refaites la mesure une fois, puis comparez les pièces montées à la nomenclature (une résistance d'une décade trop haute donne exactement ce genre d'écart)."];
  /* the same set-up, as data : which instrument, on which pin — what a screen needs to POINT at the board instead of naming a pin (pcba/lab_manip.js) */
  const links = (R.log || []).filter((e) => e.to).map((e) => ({ instr: e.instr, ch: e.ch || null, to: e.to, at: pick(e.atTo || e.to), back: e.atRef || other(e), backAt: pick(e.atRef || other(e)), ...(e.atTo ? { movedTo: true } : {}), ...(e.atRef ? { movedBack: true } : {}), v: e.v ?? null, ilim: e.ilim ?? null, r: e.r ?? null, ...(e.instr === "generator" && e.free && R.kind !== "ac" ? { high: e.high ?? null, low: e.low ?? null, freq: e.freq ?? null } : {}), ...(e.instr === "generator" && R.kind === "ac" ? { sweep: true } : {}), ac: !!e.ac, logic: !!e.logic, note: e.note || "", ...(e.free && !(e.instr === "generator" && R.kind === "ac") ? { free: true } : {}), ...(e.set ? { set: true } : {}), ...(floats(e) ? { float: true } : {}) }));
  return { id: o.id || "", tpl, test: test.id, title: test.title, nature: N, block: o.name, refs, links, noSim: !!test.noSim, why: test.why, expect: R.expect || test.expect, gear: test.gear.map((g) => INSTRUMENTS[g]), gearIds: test.gear, setup, settings, steps, rows, table: R.table || null, traps, learn: test.learn, notes: R.notes || [], minutes: MINUTES[test.nature] || 15, result: R, ok: R.ok };
}
/* the order one tests a board in : what feeds first, then what thinks, what measures, what drives, what talks, what signals */
const ORDER = ["Raccorder", "Protéger", "Alimenter", "Calculer", "Mesurer", "Commander", "Communiquer", "Signaler", "Tester"];
/** The sheets of a board : every test of every block, in the order of the bench, numbered E-01, E-02… board : a "DW board/1" document. */
export function boardSheets(board) { return sheetJobs(board).map(jobSheet).filter(Boolean); }
/** What there is to simulate for the plan of a board, one test at a time — so that a screen can say where it stands and stop between two :
    [{ id, blockId, tpl, test, title, name, params, refs }], in the order of the bench. Nothing is simulated here. */
export function sheetJobs(board) {
  const blocks = (board.blocks || []).filter((b) => BLOCKS[b.template]).sort((a, b) => ORDER.indexOf(BLOCKS[a.template].category) - ORDER.indexOf(BLOCKS[b.template].category)), out = [];
  for (const b of blocks) { const refs = Object.fromEntries((board.parts || []).filter((p) => p.block === b.id && p.local).map((p) => [p.local, p.ref])); for (const t of blockTests(b.template)) out.push({ id: `E-${String(out.length + 1).padStart(2, "0")}`, blockId: b.id, tpl: b.template, test: t.id, title: t.title, name: `${b.name || BLOCKS[b.template].name} (${b.id})`, params: b.params || {}, refs, gear: gearEnv(board, testKey(b.id, t.id)), moves: movesEnv(board, testKey(b.id, t.id), refs) }); }
  for (const t of boardTests(board)) out.push({ id: `E-${String(out.length + 1).padStart(2, "0")}`, blockId: BOARD_KEY, board, test: t.id, title: t.title, name: "Carte entière", gear: gearEnv(board, testKey(BOARD_KEY, t.id)), moves: movesEnv(board, testKey(BOARD_KEY, t.id), null) });      // last : the blocks together, once each one is right
  return out;
}
/** The sheet of one of those : the test is simulated here. */
export function jobSheet(job) { const has = (x) => x && Object.keys(x).length, env = has(job.gear) || has(job.moves) ? { ...(has(job.gear) ? { gear: job.gear } : {}), ...(has(job.moves) ? { moves: job.moves } : {}) } : null;      // what was set on the instruments of this test : its sheet is the bench as it is set
  if (job.board) return boardSheet(job.board, job.test, { id: job.id, ...(env ? { env } : {}) }); const s = testSheet(job.tpl, job.test, job.params, { refs: job.refs, name: job.name, id: job.id, ...(env ? { env } : {}) }); return s ? { ...s, blockId: job.blockId } : null; }
/** Where the lab of a board stands, WITHOUT simulating anything — for a report : { tests, off, measured (tests with a reading), readings, notes, text }. */
export function labSummary(board) {
  const jobs = sheetJobs(board), L = labOf(board), keys = new Set(jobs.map((j) => testKey(j.blockId, j.test))), off = jobs.filter((j) => skipped(board, testKey(j.blockId, j.test))).length, readings = L.readings.filter((r) => keys.has(r.test)), measured = new Set(readings.map((r) => r.test)).size, notes = L.notes.filter((n) => keys.has(n.test)).length;
  return { tests: jobs.length, off, measured, readings: readings.length, notes, text: !jobs.length ? "aucun essai : la carte n'a pas de bloc" : `${jobs.length - off} essai(s) au plan${off ? `, ${off} de côté` : ""} — ${measured ? `${measured} avec des relevés (${readings.length} valeur(s))` : "aucun relevé encore"}${notes ? `, ${notes} note(s)` : ""}` };
}
/** The functional test plan of a board, as a document (core/docx.js, core/pdfdoc.js). o : { date, author, project, sheets (already made) } */
export function labPlanDoc(board, o = {}) {
  const all = o.sheets || boardSheets(board), sheets = all.filter((x) => !skipped(board, testKey(x.blockId, x.test))), out = [], date = o.date || new Date(0), hv = (board.nets || []).some((n) => n.class === "hv" || (n.voltage || 0) >= 50), gear = [...new Set(sheets.flatMap((s) => s.gearIds))];
  const h1 = (t) => out.push({ type: "h1", text: t }), h2 = (t) => out.push({ type: "h2", text: t }), h3 = (t) => out.push({ type: "h3", text: t }), p = (t, style) => out.push({ type: "p", text: t, style }), list = (items, ordered = false) => out.push({ type: "list", items, ordered });
  let n = 0; const sec = (t) => h1(`${++n}. ${t}`);
  out.push({ type: "toc" }, { type: "pagebreak" });
  sec("À qui s'adresse ce plan, et comment s'en servir");
  p(`Ce plan décrit les essais fonctionnels de la carte ${board.id} « ${board.name || ""} », révision ${board.revision || "A"}, à faire à sa réception. Il est écrit pour quelqu'un qui apprend le métier au laboratoire : chaque fiche a deux moitiés.`);
  list(["COMPRENDRE — pourquoi on fait cet essai, et à quoi s'attendre : lisez-la avant de toucher à quoi que ce soit.", "FAIRE — le montage, le réglage de chaque instrument, les étapes une à une, et le tableau des relevés avec une case pour ce que VOUS mesurez."]);
  p("Les valeurs « attendues » viennent d'une simulation du sous-circuit, faite avec le même montage que celui de la fiche. Les circuits intégrés y sont représentés par leur comportement TYPIQUE : la fiche technique de la référence montée fait foi. Un écart entre l'attendu et le mesuré n'est pas une faute : c'est une information, que l'on note et que l'on explique.");
  p("La colonne « calcul de conception » rappelle ce que le concepteur avait prévu à la main. Quand la simulation s'en écarte, la fiche dit pourquoi — c'est souvent une résistance ou une charge que le calcul simplifié avait laissée de côté.", "muted");
  out.push({ type: "kv", rows: [["Carte", `${board.id} — ${board.name || ""}`], ["Révision", board.revision || "A"], ["Projet", (o.project && o.project.name) || "—"], ["Rédacteur", o.author || "—"], ["Date", date.toISOString().slice(0, 10)], ["Essais", `${sheets.length} fiches${all.length > sheets.length ? ` (${all.length - sheets.length} mise(s) de côté)` : ""}, environ ${Math.round(sheets.reduce((s, x) => s + x.minutes, 0) / 60 * 10) / 10} h de laboratoire`]] });
  sec("Sécurité"); list(SAFETY); if (hv) { h2("Cette carte porte une tension dangereuse"); list(SAFETY_HV); }
  sec("Matériel");
  out.push({ type: "table", head: ["Instrument", "Sert à", "Essais"], widths: [28, 42, 30], rows: gear.map((g) => [`${INSTRUMENTS[g].label} — ${INSTRUMENTS[g].fr}`, INSTRUMENTS[g].text, sheets.filter((s) => s.gearIds.includes(g)).map((s) => s.id).join(", ")]) });
  list(["Deux sondes ×10 avec leur ressort de masse ; cordons à pointes fines et grip-fils.", "Résistances de puissance pour les charges indiquées sur les fiches, ou une charge électronique.", "Bracelet antistatique, lunettes, loupe ou binoculaire, tresse à dessouder."]);
  sec("Avant de mettre sous tension");
  p("Dix minutes d'inspection évitent la plupart des cartes détruites à la première mise sous tension.");
  out.push({ type: "checklist", items: ["La carte est la bonne révision, et la nomenclature montée est celle de cette révision.", "À la loupe : aucun pont de soudure entre les broches des circuits intégrés et des connecteurs.", "Chaque condensateur polarisé, chaque diode, chaque circuit intégré est dans le bon sens (repère de la sérigraphie).", ...[...new Set((board.nets || []).filter((x) => x.class === "power" || x.class === "hv").map((x) => x.name))].slice(0, 8).map((x) => `À l'ohmmètre, carte hors tension : pas de court-circuit entre ${x} et GND (quelques ohms au moins, qui montent pendant que les condensateurs se chargent).`), "L'alimentation de laboratoire est réglée, sortie coupée, limite de courant au plus bas utile."].map((text) => ({ text, state: "todo" })) });
  sec("Ordre des essais");
  p("On avance comme le courant : d'abord ce qui protège et alimente, puis ce qui calcule, ce qui mesure, ce qui commande, ce qui communique. Un essai ne se commence que si ceux d'avant sont conformes.");
  out.push({ type: "table", head: ["N°", "Bloc", "Essai", "Nature", "Durée"], widths: [8, 30, 36, 16, 10], rows: sheets.map((s) => [s.id, s.block, s.title, s.nature.fr, `${s.minutes} min`]) });
  sec("Fiches d'essai");
  const card = (s) => {
    out.push({ type: "pagebreak" }); h2(`${s.id} — ${s.block} : ${s.title}`);
    out.push({ type: "kv", rows: [["Nature", `${s.nature.label} — ${s.nature.fr}`], [s.board ? "Pièces" : "Pièces du bloc", s.refs || "—"], ["Instruments", s.gear.map((g) => g.label).join(", ") || "—"], ["Durée", `${s.minutes} min`]] });
    h3("Comprendre"); p(`Pourquoi cet essai. ${s.why}`); p(`À quoi s'attendre. ${s.expect}`);
    h3("Faire"); if (s.setup.length) { p("Le montage :", "muted"); list(s.setup); } if (s.settings.length) { p("Les réglages :", "muted"); list(s.settings); } p("Les étapes :", "muted"); list(s.steps, true);
    out.push({ type: "table", caption: "Relevés", head: ["Mesure", "Attendu", "Plage acceptée", "Calcul de conception", "Mesuré", "Conforme"], widths: [30, 13, 19, 14, 13, 11], rows: s.rows.map((r) => [r.optional ? `${r.label} (${r.needs})` : r.label, expectedText(r), r.band.text, r.design !== null && r.design !== undefined ? `${eng(r.design, r.unit)}${r.gap !== null && Math.abs(r.gap) > 0.15 ? ` (écart ${gapText(r.gap)})` : ""}` : "—", "", "oui / non"]) });
    if (s.table) out.push({ type: "table", caption: `Selon ${s.table.label.toLowerCase()}`, head: [`${s.table.label} (${s.table.unit})`, `${s.table.rows[0].col} — attendu`, "Mesuré"], widths: [34, 33, 33], rows: s.table.rows.map((r) => [fr(r.x), eng(r.y, r.unit), ""]) });
    h3("Si le résultat s'écarte"); list(s.traps);
    p(`À retenir. ${s.learn}`); for (const t of s.notes) p(`Hypothèse de la simulation — ${t}`, "muted");
  };
  for (const s of sheets) if (!s.board) card(s);
  out.push({ type: "pagebreak" }); sec("Essais d'ensemble"); const whole = sheets.filter((s) => s.board);
  p("Une fois chaque bloc conforme, on les essaie ensemble, alimentés par la carte elle-même et non plus par le banc : c'est là que se voient les interactions — un rail qui plonge quand un moteur démarre, une mesure que le découpage bruite.");
  if (whole.length) p(`${whole.length === 1 ? "La fiche qui suit a ses" : `Les ${whole.length} fiches qui suivent ont leurs`} valeurs attendues d'une simulation où les blocs sont reliés par les nets de la carte, l'alimentation de laboratoire à l'entrée. Le programme du microcontrôleur n'y tourne pas : ce sont des essais de la carte au repos.`, "muted");
  const links = (board.nets || []).filter((x) => x.class !== "ground" && new Set((x.pins || []).map((q) => ((board.parts || []).find((pp) => pp.ref === q.split(".")[0]) || {}).block).filter(Boolean)).size > 1).slice(0, 24);
  if (links.length) out.push({ type: "table", caption: "Liaisons entre blocs à suivre de bout en bout", head: ["Signal", "Relie", "Vérifié"], widths: [26, 60, 14], rows: links.map((x) => [x.name, [...new Set((x.pins || []).map((q) => { const part = (board.parts || []).find((pp) => pp.ref === q.split(".")[0]), b = part && (board.blocks || []).find((k) => k.id === part.block); return b ? b.name || b.id : null; }).filter(Boolean))].join(" → "), ""]) });
  for (const s of whole) card(s);
  list(["Alimentez la carte par son entrée normale, limite de courant réglée sur sa consommation prévue plus un quart.", "Refaites le relevé de chaque rail : il ne doit pas avoir bougé depuis l'essai du bloc seul.", "Faites agir chaque sortie de puissance en regardant, à l'oscilloscope, le rail qui alimente le microcontrôleur : pas de creux de plus de 5 %.", "Laissez la carte fonctionner trente minutes à pleine charge, puis relevez la température des composants de puissance."], true);
  sec("Feuille de résultats");
  out.push({ type: "table", head: ["N°", "Essai", "Conforme", "Remarque"], widths: [8, 50, 12, 30], rows: sheets.map((s) => [s.id, `${s.block} — ${s.title}`, "", ""]) });
  out.push({ type: "signatures", roles: ["Essais faits par", "Vérifiés par", "Responsable du projet"] });
  return { title: `Plan de test fonctionnel — ${board.id}`, subtitle: board.name || "", subject: "Plan de test fonctionnel", author: o.author || "", date, reference: `${board.id}-PTF`, revision: board.revision || "A", header: `${board.id} rév. ${board.revision || "A"} — Plan de test fonctionnel`, footer: "DynamiteOrbit.ai", blocks: out, sheets };
}
/** What the lab asks for on a board. → [{ level, text, id }] for the guide */
export function labGuide(board) {
  const out = [], say = (level, text, id = null) => out.push({ level, text, id, field: "lab" }), blocks = (board && board.blocks) || [];
  if (!blocks.length) { say("todo", "La carte n'a aucun bloc fonctionnel : le laboratoire essaie des blocs — ajoutez-en dans le PCBA."); return out; }
  const none = blocks.filter((b) => !blockTests(b.template).length); if (none.length) say("tip", `${none.length} bloc(s) sans essai écrit : ${none.map((b) => b.name || b.id).join(", ")}.`);
  if ((board.nets || []).some((n) => n.class === "hv" || (n.voltage || 0) >= 50)) say("warn", "Cette carte porte plus de 50 V : le plan de test ajoute les règles de la haute tension, et ces essais ne se font jamais seul.");
  say("tip", "Les valeurs attendues viennent de comportements typiques : avant le laboratoire, relisez-les contre les fiches des composants montés.");
  return out;
}

/* ---------- what the lab keeps on a board : the readings of the real bench, the tests set aside, the notes of a review ----------
   board.lab = { readings: [{ test: "B3/ripple", what: "Fréquence de découpage", value (SI) }], skips: [{ test }], notes: [{ test, text, step? }],
                 ticks: [{ test, step, when? }] (a step of the bench done), passes: [{ test, step, by, why, when? }] (a supervisor let it pass) }
   A note with a step is what one wrote at the bench on that step ; without, a remark of a review. */
export const testKey = (blockId, testId) => `${blockId}/${testId}`;
/* what an instrument can be set to : a supply (v, ilim), a load (r), a generator (high, low, freq — pcba/lab_gear.js KNOBS) */
const GEAR_KEYS = ["v", "ilim", "r", "high", "low", "freq"];
/** The leads one may move by hand on the bench (JP, 22 novembre : « permettre les changements de connexion à la souris… lock / unlock setup ») :
    the role of a lead in its instrument — the + and − of a supply, the hot point and the return of a generator, the two ends of a load,
    the probes, the ground clip and the − of a differential probe. */
export const MOVE_ROLES = ["plus", "minus", "hot", "back", "load", "loadBack", "probe", "probe2", "clip", "probeRef"];
export function labOf(board) { const l = (board && board.lab) || {}, list = (x) => (Array.isArray(x) ? x.filter((r) => r && typeof r.test === "string") : []); return { gears: list(l.gears).filter((r) => typeof r.gear === "string" && /^(supply|load|generator):/.test(r.gear)).map((r) => ({ test: r.test, gear: r.gear, ...GEAR_KEYS.reduce((a, k) => (Number.isFinite(Number(r[k])) && r[k] !== null && r[k] !== "" ? { ...a, [k]: Number(r[k]) } : a), {}) })), readings: list(l.readings).filter((r) => typeof r.what === "string" && Number.isFinite(Number(r.value))).map((r) => ({ test: r.test, what: r.what, value: Number(r.value) })), skips: list(l.skips).map((r) => ({ test: r.test })), notes: list(l.notes).filter((r) => typeof r.text === "string" && r.text.trim()).map((r) => ({ test: r.test, text: r.text.trim(), ...(typeof r.step === "string" && r.step ? { step: r.step } : {}) })),
  moves: list(l.moves).filter((r) => typeof r.gear === "string" && MOVE_ROLES.includes(r.role) && /^[^.\s]+\.[^\s]+$/.test(String(r.to || ""))).map((r) => ({ test: r.test, gear: r.gear, role: r.role, to: String(r.to) })),
  ticks: list(l.ticks).filter((r) => typeof r.step === "string").map((r) => ({ test: r.test, step: r.step, ...(r.when ? { when: String(r.when) } : {}) })), passes: list(l.passes).filter((r) => typeof r.step === "string" && typeof r.by === "string" && r.by.trim()).map((r) => ({ test: r.test, step: r.step, by: r.by.trim(), why: String(r.why || "").trim(), ...(r.when ? { when: String(r.when) } : {}) })) }; }
/** A step of the bench ticked (or unticked) : → the new lab block */
export function setTick(board, key, step, on, when = "") { const l = labOf(board), rest = l.ticks.filter((r) => !(r.test === key && r.step === step)); return { ...l, ticks: on ? [...rest, { test: key, step, ...(when ? { when } : {}) }] : rest }; }
/** A supervisor lets a step pass although its reading is out of its band : who, and why — it goes to the report. by empty : the pass is taken away. */
export function setPass(board, key, step, by, why = "", when = "") { const l = labOf(board), rest = l.passes.filter((r) => !(r.test === key && r.step === step)); return { ...l, passes: String(by || "").trim() ? [...rest, { test: key, step, by: String(by).trim(), why: String(why || "").trim(), ...(when ? { when } : {}) }] : rest }; }
/** What one notes at the bench on a step of a test (empty : taken away). The remarks of a review — notes without a step — are left as they are. */
export function setNote(board, key, step, text) { const l = labOf(board), rest = l.notes.filter((r) => !(r.test === key && r.step === step)); return { ...l, notes: String(text || "").trim() ? [...rest, { test: key, step, text: String(text).trim() }] : rest }; }
/** Writes a reading (value null : takes it away). → the new lab block */
export function setReading(board, key, what, value) { const l = labOf(board), rest = l.readings.filter((r) => !(r.test === key && r.what === what)); return { ...l, readings: value === null || value === "" || !Number.isFinite(Number(value)) ? rest : [...rest, { test: key, what, value: Number(value) }] }; }
/** What was set on the instruments of a test (pcba/lab_gear.js), as the simulated bench reads it : { "supply:VIN": { v, ilim }, "load:OUT": { r } }. */
export function gearEnv(board, key) { const out = {}; for (const g of labOf(board).gears.filter((x) => x.test === key)) { const { test, gear, ...v } = g; void test; out[gear] = v; } return out; }
/** A setting made on an instrument : patch { v?, ilim?, r?, high?, low?, freq? } — a value null takes that setting back to what the test proposes ; patch null takes them all back. */
export function setGear(board, key, gear, patch) {
  const l = labOf(board), rest = l.gears.filter((g) => !(g.test === key && g.gear === gear)), cur = l.gears.find((g) => g.test === key && g.gear === gear) || {}, next = { test: key, gear };
  if (patch) for (const k of GEAR_KEYS) { const v = k in patch ? patch[k] : cur[k]; if (v !== null && v !== undefined && Number.isFinite(Number(v))) next[k] = Number(v); }
  return { ...l, gears: Object.keys(next).length > 2 ? [...rest, next] : rest };
}
/** A lead of an instrument moved by hand to a pad of the board (« REF.pin ») — to null : back where the test puts it ; role null : every lead of that instrument back. */
export function setMove(board, key, gear, role, to) {
  const l = labOf(board), rest = l.moves.filter((m) => !(m.test === key && m.gear === gear && (role === null || role === undefined || m.role === role)));
  return { ...l, moves: to && role ? [...rest, { test: key, gear, role, to: String(to) }] : rest };
}
/** The leads moved for a test, in the words of the board : { gear: { role: "REF.pin" } } */
export function movesOf(board, key) { const out = {}; for (const m of labOf(board).moves.filter((x) => x.test === key)) (out[m.gear] = out[m.gear] || {})[m.role] = m.to; return out; }
/** The same, in the words of the circuit simulated : the pads of a block named by its own parts (refs : local id → reference on the board) ;
    the whole board (refs null) keeps the references of the board. A pad outside the block is left out : its circuit does not have it. */
export function movesEnv(board, key, refs) {
  const back = refs ? Object.fromEntries(Object.entries(refs).map(([local, ref]) => [ref, local])) : null, out = {};
  for (const [gear, roles] of Object.entries(movesOf(board, key))) for (const [role, to] of Object.entries(roles)) { const dot = to.indexOf("."), ref = to.slice(0, dot), name = back ? (back[ref] ? `${back[ref]}.${to.slice(dot + 1)}` : null) : to; if (name) (out[gear] = out[gear] || {})[role] = name; }
  return out;
}
export const skipped = (board, key) => labOf(board).skips.some((r) => r.test === key);
export function setSkip(board, key, off) { const l = labOf(board), rest = l.skips.filter((r) => r.test !== key); return { ...l, skips: off ? [...rest, { test: key }] : rest }; }
/** A reading against what was expected : "ok", "out", or "none" when nothing was read. */
export function verdict(row, value) { if (value === null || value === undefined || !Number.isFinite(value)) return "none"; const b = row.band; if (!Number.isFinite(b.low)) return "none"; const slack = 1e-9 * Math.max(1, Math.abs(b.high)); return value >= b.low - slack && value <= b.high + slack ? "ok" : "out"; }
/** Where the lab stands on a board. sheets : boardSheets(board). → { total, off, read (sheets with every reading), ok, out, rows: [{ id, key, title, state: "off" | "todo" | "part" | "ok" | "out" }] } */
export function labStatus(board, sheets) {
  const l = labOf(board), rows = sheets.map((s) => { const key = testKey(s.blockId, s.test); if (l.skips.some((r) => r.test === key)) return { id: s.id, key, title: `${s.block} — ${s.title}`, state: "off" };
    const got = s.rows.map((r) => { const x = l.readings.find((q) => q.test === key && q.what === r.label); return verdict(r, x ? x.value : null); }), n = got.filter((v) => v !== "none").length, missing = s.rows.some((r, i) => !r.optional && got[i] === "none");      // a reading that asks for an instrument one may not have is not owed
    return { id: s.id, key, title: `${s.block} — ${s.title}`, state: got.includes("out") ? "out" : !n ? "todo" : missing ? "part" : "ok" }; });
  return { total: rows.length, off: rows.filter((r) => r.state === "off").length, ok: rows.filter((r) => r.state === "ok").length, out: rows.filter((r) => r.state === "out").length, todo: rows.filter((r) => r.state === "todo" || r.state === "part").length, rows };
}
export { BLOCK_CATEGORIES };
