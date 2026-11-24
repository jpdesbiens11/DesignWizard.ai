/* DynamiteOrbit.ai — Logiciel : the software TRIED ON ITS BOARD, step by step (demande de JP, 24 novembre 2026 : « être guidé comme pour le labo
   électronique, même interface, à tester le logiciel embarqué étape par étape sur une carte cible HW, celle de la section Électronique »).
   The board is the one the software runs on (sw/sw_blocks.js hostBoard) ; the steps follow the order that protects a board at the bench, as the
   Labo does (pcba/lab_manip.js) : safety, the programming probe, the supply set with its output OFF, the cords black first, a short sought
   BEFORE powering, the power with an eye on the current, the program loaded — then the software tried : every input of the software set by a
   source where its net reaches the board, every output read with the multimeter where its net is easy to touch. What each output must read is
   computed by the MODEL — the same step as the C (sw/sw_live.js) — for the case : at rest, then each input pushed past its threshold.
   Every value is in the units of physics (V, A) ; a net the software was not linked to is proposed by its name (AIN0 for a converter channel,
   DIN0, DOUT0…) and said to be a proposal. Nothing of this has run on a real board : the procedure says what to do and what the model expects.
   Pure : → { board, steps: [{ id, kind, title, text, why, instrument, gear, points: [{ lead, signal, ref, pin }], needs, expect? }], notes } */

import { KINDS, cfgOf } from "./sw_objects.js";
import { liveStart, liveSet, liveStep } from "./sw_live.js";
import { hostBoard } from "./sw_blocks.js";
import { liveWires, split } from "./sw_design.js";
import { DEVICES } from "./sw_devices.js";

const fr = (n, d = 2) => (Math.round(n * 10 ** d) / 10 ** d).toFixed(d).replace(/\.?0+$/, "").replace(".", ",").replace("-", "−");
const MCU = /^U-MCU/;
/** The pads of a net, the easiest to touch first : a test point, a connector, a passive part, then the rest — the pin of a chip last. */
export function touchOf(board, net) {
  const n = ((board && board.nets) || []).find((x) => x.name === net); if (!n) return null; const comp = Object.fromEntries(((board.parts) || []).map((p) => [p.ref, p.comp || ""]));
  const rank = (pin) => { const r = pin.split(".")[0]; return /^TP/.test(r) ? 0 : /^J/.test(r) ? 1 : /^[RCL]\d/.test(r) ? 2 : MCU.test(comp[r]) ? 4 : 3; };
  const best = [...n.pins].sort((a, b) => rank(a) - rank(b))[0], [ref, pin] = [best.slice(0, best.indexOf(".")), best.slice(best.indexOf(".") + 1)];
  return { ref, pin, net, chip: n.pins.some((p) => /^U/.test(p) && /OUT/i.test(p.split(".")[1]) && !MCU.test(comp[p.split(".")[0]])) };
}
const netByName = (board, re) => ((board && board.nets) || []).find((n) => re.test(n.name)) || null;
/** The net of a pin block : the one linked in its sheet, or one proposed by its name (AIN<channel>, DIN<n>, DOUT<n>, LED…). → { net, proposed } | null */
export function netOf(board, d, o) {
  if (o.hw && o.hw.net) return { net: o.hw.net, proposed: false }; const K = KINDS[o.kind], c = cfgOf(o), objs = (d.objects || []).filter((q) => KINDS[q.kind] && KINDS[q.kind].pin === K.pin), i = objs.indexOf(o);
  const names = ((board && board.nets) || []).map((n) => n.name), want = K.pin === "ain" ? [`AIN${c.channel}`, `AIN${i}`] : K.pin === "din" ? [`DIN${i}`] : o.device === "led" ? ["LED_STATUS", `DOUT${i}`] : [`DOUT${i}`];
  const hit = want.find((w) => names.includes(w)); return hit ? { net: hit, proposed: true } : null;
}
/** The pin voltage, in mV, that makes an analog input read a value (the inverse of its scaling, sw/sw_objects.js analog_in). */
const pinMv = (m, v) => { const c = cfgOf(m); return Math.round(((v - c.offset) * c.den) / c.num); };
/** What every board output reads, the inputs held at `set` for `ms`. → { objId: 0 | 1 } */
function outputsAfter(d, set, ms) { const L = liveStart(d); for (const [id, v] of Object.entries(set)) liveSet(L, id, v); liveStep(L, Math.ceil(ms / (d.period || 10))); const out = {}; for (const o of (d.objects || []).filter((x) => !x.off && KINDS[x.kind] && KINDS[x.kind].pin === "dout")) out[o.id] = L.m.last[`${o.id}.level`] ? 1 : 0; return { out, L }; }

export function hilSteps(project, d) {
  const board = hostBoard(project, d), steps = [], notes = []; if (!board || !d) return { board, steps, notes: ["Aucune carte du produit avec un microcontrôleur : le PCBA de la carte de commande la donnera."] };
  const add = (s) => steps.push({ points: [], why: "", instrument: "", needs: "tick", gear: null, ...s }), at = (net) => touchOf(board, net), P = (lead, t, signal) => (t ? { lead, signal: signal || t.net, ref: t.ref, pin: t.pin } : null);
  const gnd = netByName(board, /^GND$/), vin = netByName(board, /^\+?(12|24|5)V_IN$|^VIN$|^\+12V_IN$/i) || netByName(board, /^\+?(12|24)V/i), gT = gnd && at(gnd.name), vT = vin && at(vin.name), volts = vin ? Number((/(\d+)V/i.exec(vin.name) || [])[1]) || null : null;
  const swd = ["SWDIO", "SWCLK"].map((n) => netByName(board, new RegExp(`^${n}$`))).filter(Boolean).map((n) => at(n.name)), gndProbe = gnd && swd[0] ? (() => { const j = gnd.pins.find((p) => p.startsWith(`${swd[0].ref}.`)); return j ? { ref: swd[0].ref, pin: j.split(".")[1], net: "GND" } : gT; })() : gT;
  add({ id: "safety", kind: "safety", title: "Avant de toucher la carte", text: `Bracelet antistatique relié au poste. La carte « ${board.name || board.id} » est HORS TENSION, rien n'est branché dessus.`, why: "Une décharge du doigt détruit un microcontrôleur sans rien montrer." });
  add({ id: "probe", kind: "connect", title: "Brancher la sonde de programmation", instrument: "Sonde de programmation (USB)", gear: { kind: "logic" }, points: [...swd.map((t) => P("probe", t)), P("clip", gndProbe, "GND")].filter(Boolean),
    text: swd.length ? `Sur le connecteur ${swd[0].ref} : SWDIO, SWCLK et la masse — le câble de la sonde ne se pose que dans un sens.` : "La carte n'a pas de connecteur de programmation reconnu (SWDIO, SWCLK) : branchez la sonde comme le dit le PCBA.", why: "La sonde charge le programme dans le microcontrôleur, puis laisse lire ses variables pendant qu'il tourne." });
  const psu = (on) => ({ kind: "supply", v: volts, ilim: 0.2, on });
  add({ id: "set-supply", kind: "set", title: "Régler l'alimentation, sortie COUPÉE", instrument: "Alimentation de laboratoire", gear: psu(false), text: `Tension : ${volts ? `${volts} V` : "celle de l'entrée de la carte (PCBA)"}. Limite de courant : 0,2 A — assez pour la carte, trop peu pour la détruire.`, why: "La limite de courant est la ceinture de sécurité du banc." });
  add({ id: "con-supply", kind: "connect", title: "Brancher l'alimentation — le noir d'abord", instrument: "Alimentation de laboratoire", gear: psu(false), points: [P("minus", gT, "GND"), P("plus", vT)].filter(Boolean), text: vT ? `Le cordon noir sur ${gT.ref}.${gT.pin} (GND), puis le rouge sur ${vT.ref}.${vT.pin} (${vT.net}).` : "Le noir sur la masse, puis le rouge sur l'entrée d'alimentation de la carte.", why: "La masse d'abord : la carte ne voit jamais une tension qui flotte." });
  add({ id: "guard", kind: "guard", title: "Chercher un court-circuit AVANT d'alimenter", instrument: "Multimètre", gear: { kind: "meter", mode: "cont" }, points: [P("black", gT, "GND"), P("red", vT)].filter(Boolean), text: "Multimètre en continuité entre l'entrée et la masse : il ne doit PAS sonner (un bip bref, c'est le condensateur qui se charge).", why: "Un court-circuit trouvé ici coûte une minute ; trouvé sous tension, une carte." });
  add({ id: "power", kind: "power", danger: true, title: "Mettre sous tension, l'œil sur le courant", instrument: "Alimentation de laboratoire", gear: psu(true), points: [P("plus", vT)].filter(Boolean), needs: "reading", expect: { lo: 0.005, hi: 0.15, unit: "A", what: "le courant sur l'afficheur de l'alimentation" }, text: "Activez la sortie et lisez le courant. Une carte de commande qui dort tire quelques dizaines de milliampères.", why: "Un courant à la limite dit un court-circuit : coupez aussitôt." });
  add({ id: "flash", kind: "do", title: "Charger le logiciel dans le microcontrôleur", instrument: "Sonde de programmation (USB)", gear: { kind: "logic" }, points: swd.map((t) => P("probe", t)).filter(Boolean), text: `Dans l'outil du fabricant du CPU : ouvrir le programme compilé depuis le paquet (« Fichiers C (.zip) », doc/LOADING.md), « Programmer », puis « Lancer ». Le logiciel refait son pas toutes les ${d.period || 10} ms.`, why: "Sans programme, la carte ne fait rien ; avec le mauvais, elle fait n'importe quoi : vérifiez le nom du fichier." });

  /* the inputs and outputs of the software on this board */
  const objs = (d.objects || []).filter((o) => !o.off && KINDS[o.kind]), W = liveWires(d), L0 = liveStart(d), rest = { ...L0.set }, ins = [], outs = [];
  for (const i of L0.inputs) { const o = objs.find((x) => x.id === i.id), n = netOf(board, d, o), t = n && at(n.net), m = i.kind === "analog" ? objs.find((x) => x.id === split((W.find((w) => w.from === `${o.id}.counts`) || { to: "" }).to)[0]) : null;
    if (!t) { notes.push(`${o.name} : aucun net de la carte ne lui correspond — elle reste au repos pendant l'essai.`); continue; } ins.push({ i, o, m, n, t }); }
  for (const o of objs.filter((x) => KINDS[x.kind].pin === "dout")) { const n = netOf(board, d, o), t = n && at(n.net); if (!t) { notes.push(`${o.name} : aucun net de la carte ne lui correspond — elle n'est pas relevée.`); continue; } outs.push({ o, n, t }); }
  const say = (x) => `${x.n.net}${x.n.proposed ? " (net proposé par son nom : à confirmer dans la fiche du bloc)" : ""}`;
  for (const x of ins) {
    if (x.i.kind === "analog" && x.m) { const v = rest[x.i.id], mv = pinMv(x.m, v), U = x.i.unit, D = x.o.device && DEVICES[x.o.device];
      add({ id: `src-${x.o.id}`, kind: "connect", title: `Remplacer « ${x.i.name} » par une source`, instrument: "Source de tension réglable", gear: { kind: "supply", v: mv / 1000, ilim: 0.01, on: false }, points: [P("minus", gT, "GND"), P("plus", x.t, x.n.net)].filter(Boolean),
        text: x.t.chip ? `Le net ${say(x)} est la sortie d'un circuit de la carte : n'y injectez rien. Débranchez le ${D ? D.fr : "capteur"} et branchez la source à sa place sur son connecteur ; réglez-la jusqu'à lire ${fr(mv / 1000, 3)} V au multimètre sur ${x.t.ref}.${x.t.pin}.` : `Débranchez le ${D ? D.fr : "capteur"}. La source, limitée à 10 mA, sur ${x.t.ref}.${x.t.pin} — ${say(x)} — réglée à ${fr(mv / 1000, 3)} V : le logiciel lit alors ${physNote(v, U)}.`,
        why: "Une source tient la place du capteur : on choisit ce que le logiciel lit, sans chauffer ni refroidir quoi que ce soit." }); }
    else if (x.i.kind === "digital") add({ id: `src-${x.o.id}`, kind: "connect", title: `Tenir « ${x.i.name} » à ${rest[x.i.id] ? "1" : "0"}`, instrument: "Fil de liaison", gear: { kind: "load" }, points: [P("part", x.t, x.n.net)].filter(Boolean), text: `Un fil de ${x.t.ref}.${x.t.pin} (${say(x)}) à ${rest[x.i.id] ? "+3,3 V" : "la masse"}.`, why: "Une entrée en l'air lit n'importe quoi : on la tient." });
    else if (x.i.kind === "contact") { const coil = outs.find((y) => y.o.id === x.i.of); add({ id: `src-${x.o.id}`, kind: "connect", title: `Boucler « ${x.i.name} » sur sa commande`, instrument: "Fil de liaison", gear: { kind: "load" }, points: [P("part", x.t, x.n.net), coil ? P("part", coil.t, coil.n.net) : null].filter(Boolean), text: coil ? `Sans contactor au banc : un fil de ${coil.t.ref}.${coil.t.pin} à ${x.t.ref}.${x.t.pin} — le contact « suit » la bobine.` : "Le contact auxiliaire réel, câblé.", why: "Le logiciel vérifie que le contact suit l'ordre : il faut un retour, réel ou bouclé." }); }
  }
  /* the cases : at rest, then each input pushed past the threshold that reads it — what each output must read, from the model */
  const thresholds = (m) => objs.filter((q) => q.kind === "limit" && W.some((w) => w.from === `${m.id}.value` && w.to === `${q.id}.value`));
  const cases = [{ id: "rest", title: "Au repos", set: {}, ms: 2000, text: "Tout au repos, comme réglé." }];
  for (const x of ins) { if (x.i.kind === "analog" && x.m) for (const q of thresholds(x.m)) { const c = cfgOf(q), past = c.above ? c.trip + Math.max(1, Math.round(Math.abs(c.trip) * 0.03)) : c.trip - Math.max(1, Math.round(Math.abs(c.trip) * 0.03)), mv = pinMv(x.m, past);
      cases.push({ id: `${x.o.id}-${q.id}`, title: `${x.i.name} au-delà de « ${q.name} »`, set: { [x.i.id]: past }, ms: c.delay + 500, text: `Réglez la source à ${fr(mv / 1000, 3)} V (le logiciel lit ${physNote(past, x.i.unit)}, au-delà du seuil de ${physNote(c.trip, x.i.unit)}) et attendez ${fr((c.delay + 500) / 1000, 1)} s.` }); }
    if (x.i.kind === "digital") cases.push({ id: `${x.o.id}-on`, title: `${x.i.name} à ${rest[x.i.id] ? "0" : "1"}`, set: { [x.i.id]: rest[x.i.id] ? 0 : 1 }, ms: 3000, text: `Passez le fil de ${x.t.ref}.${x.t.pin} à ${rest[x.i.id] ? "la masse" : "+3,3 V"} et attendez 3 s.` }); }
  for (const k of cases) { const { out } = outputsAfter(d, k.set, k.ms);
    if (k.id !== "rest") add({ id: `case-${k.id}`, kind: "do", title: k.title, text: k.text, why: "Ce que le modèle a fait à l'écran, la carte doit le refaire : c'est le même pas, écrit en C." });
    for (const y of outs) { const on = out[y.o.id] === 1, D = y.o.device && DEVICES[y.o.device];
      add({ id: `read-${k.id}-${y.o.id}`, kind: "read", title: `${k.id === "rest" ? "Au repos" : k.title} : relever « ${y.o.name} »`, instrument: "Multimètre", gear: { kind: "meter", mode: "dcv" }, points: [P("black", gT, "GND"), P("red", y.t, y.n.net)].filter(Boolean), needs: "reading",
        expect: on ? { lo: 2.6, hi: 3.6, unit: "V", what: `la tension de ${y.n.net}` } : { lo: 0, hi: 0.4, unit: "V", what: `la tension de ${y.n.net}` },
        text: `Multimètre en volts continus : la pointe noire sur la masse, la rouge sur ${y.t.ref}.${y.t.pin} (${say(y)}). Le logiciel doit la tenir à ${on ? "1 — environ 3,3 V" : "0 — environ 0 V"}${D ? ` : ${D.fr} ${on ? "commandé" : "au repos"}` : ""}.`, why: on ? "Le modèle a commandé cette sortie dans ce cas." : "Le modèle n'a pas commandé cette sortie dans ce cas." }); } }
  add({ id: "off", kind: "off", title: "Couper, puis débrancher", instrument: "Alimentation de laboratoire", gear: psu(false), text: "Sortie de l'alimentation coupée, puis les sources, puis les cordons — le rouge d'abord, le noir en dernier. Rebranchez les capteurs.", why: "Débrancher sous tension fait des étincelles là où on ne regarde pas." });
  return { board, steps, notes };
}
const physNote = (v, unit) => { const m = { mV: [1000, "V", 3], mA: [1000, "A", 2], "0.1 °C": [10, "°C", 1], "‰": [10, "%", 1] }[unit] || [1, unit || "", 0]; return `${fr(v / m[0], m[2])} ${m[1]}`.trim(); };

/** The state of the steps, from the notebook of the board's software (project.swLab[design]) : done, open, locked, stopped. → [{ done, open, bad, value }] */
export function hilState(steps, nb = {}) {
  let blocked = false; return steps.map((s) => { const t = (nb.ticks || {})[s.id], r = (nb.readings || {})[s.id], pass = (nb.pass || {})[s.id], bad = s.needs === "reading" && r !== undefined && s.expect && !(r >= s.expect.lo && r <= s.expect.hi) && !pass;
    const done = s.needs === "reading" ? r !== undefined && (!bad || !!pass) : !!t, open = !blocked; if (!done) blocked = true; if (bad) blocked = true; return { done, open, bad, value: r, pass }; });
}
