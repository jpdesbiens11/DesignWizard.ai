/* DynamiteOrbit.ai — Logiciel : THE PACK on the bench, one simulation for every window (demande de JP, 25 novembre 2026 : « le comportement de ces 2
   fenêtres doit suivre le même profil de recharge en simulation ; présentement, c'est séparé. On doit définir le profil de charge et de décharge
   afin de couvrir tous les cas de l'enveloppe de fonctionnement et trigger les safety… exporter et importer un profil… le démarrer et voir les
   conséquences dans la logique SW implantée » ; choix cliqué : « Tirés des seuils du logiciel »).
   The PLANT is the module itself : N cell blocks in series (sw/sw_balance.js : capacity, state of charge, typical curve, resistance, the passive
   balancing of each block by the step of the software's block), a CHARGER (0.1 C, ramp, 2 C, constant voltage) or a LOAD, a lumped TEMPERATURE of
   the hottest block (I²R and the resistors heat it, the air or the pump cool it). It runs WITH the software, one second at a time : what the
   software commands acts on it — the contactor open, no current ; DERATED, the current is held to `cDerate` ; the pump on, it cools four times
   better — and what it measures goes to the pins the software reads (`design.plant` names them). A profile drives it (`plant` on an event : the
   mode, the load, a charger that pushes too hard or forgets its constant voltage, heat from outside) ; the logic inputs stay on `set`.
   missionProfiles WRITES the charge and the discharge from the software's own thresholds : each limit that reads the pack is crossed once, and
   brought back when it can be ; `coverage` says which one a profile leaves untouched. Everything is TYPICAL (the curve, the resistance, the
   thermal mass, the cooling) and the screens say so. Pure : no page. */

import { KINDS, cfgOf } from "./sw_objects.js";
import { liveWires, split } from "./sw_design.js";
import { ocv, socAt, BALANCE_DEFAULTS, balanceSpec, phaseText } from "./sw_balance.js";

/* 8 cells of about 70 g per block, about 1 000 J/(kg·K) ; a closed module loses about 0,5 W/K by the air ; the pump : four times more — examples */
export const PACK_DEFAULTS = { ...BALANCE_DEFAULTS, mcp: 560, hA: 0.5, pumpGain: 4, amb: 25, cDerate: 0.5, hold: 30 };
/* past 100 % the curve keeps rising, steeply : a charger that forgets its constant voltage overcharges — typical, to see the limit trip */
const ocvX = (soc) => (soc > 1 ? 4.2 + (soc - 1) * 3 : ocv(soc));
/** What links the plant to the software : the bench inputs it drives and the outputs it obeys — `design.plant`, or nothing. */
export const plantOf = (d) => (d && d.plant && d.plant.vmax ? d.plant : null);

/** A pack at rest at `start` volts (or the start of the drive). */
export function packStart(d, over = {}) {
  const S = { ...PACK_DEFAULTS, ...balanceSpec(d, over), ...over }, base = socAt(S.start);
  const P = { S, t: 0, soc: Array.from({ length: S.n }, (_, k) => Math.min(1, Math.max(0, base + (S.spread[k % S.spread.length] || 0) * 0.5))), cap: Array.from({ length: S.n }, (_, k) => S.capAh * (S.capSpread[k % S.capSpread.length] || 1)),
    bleed: new Array(S.n).fill(0), mem: Array.from({ length: S.n }, () => KINDS.balancing.init()), bledAh: new Array(S.n).fill(0), i: 0, temp: S.amb, phase: "rest", done: false, trace: [],
    drive: { mode: "rest", a: 0, push: 0, cvFail: 0, heatTo: 0, amb: S.amb, cMax: S.cHigh }, since: 0, held: -1 };
  P.v = P.soc.map(ocvX); sample(P); return P;
}
/** Changes what drives the pack (an event of a profile). A new charge starts its soft start again. */
export function packDrive(P, patch = {}) { const was = P.drive.mode; Object.assign(P.drive, patch); if (patch.mode && patch.mode !== was) P.since = 0; if (patch.start !== undefined) { const b = socAt(patch.start); P.soc = P.soc.map((_, k) => Math.min(1, Math.max(0, b + (P.S.spread[k % P.S.spread.length] || 0) * 0.5))); P.v = P.soc.map(ocvX); } return P; }
const PH = { rest: "Au repos", load: "Décharge", derate: "Dératé : courant tenu bas", open: "Contacteur ouvert : aucun courant", push: "Le chargeur pousse trop fort", runaway: "Le chargeur oublie sa tension constante" };
export const packPhase = (p) => PH[p] || phaseText(p);
/** One second (S.dt) of the pack, under what the software commands : out = { closed, derate, pump }. → P */
export function packStep(P, out = {}) {
  const S = P.S, D = P.drive, C1 = S.capAh, closed = out.closed !== false, dt = S.dt;
  /* the vehicle and the charger, asked to derate, hold the lower current a while (S.hold s) : they do not beat with the threshold */
  if (out.derate) P.held = P.t + S.hold; const derate = P.t < P.held;
  const ocvs = P.soc.map(ocvX), hi = Math.max(...ocvs), anyBleed = P.bleed.some(Boolean); let I = 0, phase = "rest";      // I > 0 : into the pack (charge)
  if (D.mode === "charge") { const s = P.since, want0 = s < S.soft ? S.cLow * C1 : s < S.soft + S.ramp ? (S.cLow + (D.cMax - S.cLow) * (s - S.soft) / S.ramp) * C1 : D.cMax * C1;
    let want = anyBleed ? Math.min(want0, S.cBal * C1) : want0; if (derate) want = Math.min(want, S.cDerate * C1);
    const cv = D.cvFail ? Infinity : Math.max(0, (S.vTop - hi) / S.r); I = Math.min(want, cv);
    phase = D.cvFail && I > 0 ? "runaway" : derate ? "derate" : I < want - 1e-9 ? "cv" : anyBleed && want < want0 - 1e-9 ? "bal" : s < S.soft ? "soft" : s < S.soft + S.ramp ? "ramp" : "cc";
    if (D.push) { I = D.push; phase = "push"; } }
  else if (D.mode === "discharge") { I = -Math.abs(D.a || 0); if (derate) I = Math.max(I, -S.cDerate * C1); phase = derate ? "derate" : "load"; }
  if (!closed) { I = 0; phase = "open"; }
  P.i = I; P.phase = phase; P.since += dt;
  let bleedW = 0;
  for (let k = 0; k < S.n; k++) { const ib = P.bleed[k] ? P.v[k] / S.rBal : 0; bleedW = Math.max(bleedW, ib * P.v[k]);
    P.soc[k] = Math.min(1.15, Math.max(0, P.soc[k] + (I - ib) * dt / 3600 / P.cap[k])); P.v[k] = ocvX(P.soc[k]) + I * S.r; P.bledAh[k] += ib * dt / 3600; }
  /* the software's « Passive balancing » step, block by block, on voltages corrected of the drop the current makes — never while it discharges */
  const vr = P.v.map((x) => Math.round((x - I * S.r) * 1000)), low = Math.min(...vr);
  for (let k = 0; k < S.n; k++) P.bleed[k] = KINDS.balancing.step(P.mem[k], S.cfg, { v: vr[k], low, i: -Math.round(I * 1000) }, dt * 1000).bleed;
  /* the hottest block : I²R and its resistor heat it, the air (or the pump) cools it toward the ambient ; heat from outside adds */
  /* heat from outside (`heatTo`, °C) : it brings the hottest block toward that temperature (a time constant of a minute), then holds it there */
  const hA = S.hA * (out.pump ? S.pumpGain : 1), amb = D.amb ?? S.amb, own = I * I * S.r + bleedW;
  const ext = D.heatTo ? Math.max(0, hA * (D.heatTo - amb) - own + (P.temp < D.heatTo ? S.mcp * (D.heatTo - P.temp) / 60 : 0)) : 0;
  P.temp += (own + ext - hA * (P.temp - amb)) * dt / S.mcp;
  P.t += dt; if (P.t % 10 === 0) sample(P);
  P.done = D.mode === "charge" && phase === "cv" && I < S.endC * C1 && !P.bleed.some(Boolean) && Math.max(...vr) - low <= S.cfg.delta;
  return P;
}
function sample(P) { P.trace.push({ t: P.t, i: P.i, v: [...P.v], soc: [...P.soc], bleed: [...P.bleed], phase: P.phase, temp: P.temp }); if (P.trace.length > 4000) P.trace.splice(0, P.trace.length - 4000); }
/** What the pins read, in the units the software keeps : mV of the highest and the lowest block (at their terminals), 0.1 °C, mA (+ : discharge). */
export function packSense(P) { const mv = P.v.map((x) => Math.round(x * 1000)); return { vmax: Math.max(...mv), vmin: Math.min(...mv), temp: Math.round(P.temp * 10), current: Math.round(-P.i * 1000) }; }

/* ---------- the profiles, written from the thresholds of the software ---------- */
/** The limits of the software that read the pack : { id, name, what (vmax | vmin | temp | current), above, trip, clear, delay, latch } */
export function packLimits(d) {
  const pl = plantOf(d); if (!pl) return [];
  const W = liveWires(d), objs = (d.objects || []).filter((o) => !o.off && KINDS[o.kind]), out = [];
  const latches = (q, seen = new Set()) => { if (seen.has(q.id)) return false; seen.add(q.id); return W.some((w) => w.from.startsWith(`${q.id}.`) && objs.some((x) => w.to.startsWith(`${x.id}.`) && (x.kind === "fault_latch" || (x.kind === "logic" && latches(x, seen))))); };
  for (const what of ["vmax", "vmin", "temp", "current"]) { const pin = pl[what], m = objs.find((o) => W.some((w) => w.from === `${pin}.counts` && w.to === `${o.id}.counts`)); if (!m) continue;
    for (const q of objs.filter((x) => x.kind === "limit" && W.some((w) => w.from === `${m.id}.value` && w.to === `${x.id}.value`))) { const c = cfgOf(q); out.push({ id: q.id, name: q.name, what, above: !!c.above, trip: c.trip, clear: c.clear, delay: c.delay || 0, latch: latches(q) }); } }
  return out;
}
/* runs the plant alone (contactor closed, nothing derated) under a list of drives, to find WHEN a quantity crosses a value — the profiles are
   timed on the physics, not guessed */
/* (kept for a profile that wants a time from the physics) */
export function until(d, drives, test, max = 4 * 3600) { const P = packStart(d, drives.start ? { start: drives.start } : {}); packDrive(P, drives); for (let s = 0; s < max; s++) { packStep(P, { closed: true, pump: drives.pump }); if (test(packSense(P), P)) return P.t; } return null; }
const fr = (x, n = 2) => String(+x.toFixed(n)).replace(".", ",");
const ev = (t, id, title, says, more = {}) => ({ t: Math.round(t * 1000), id, title, says, set: {}, ...more });
/** The charge and the discharge of the module, from its thresholds. → [{ id, name, kind, events }] (times in ms, `plant` on each event) */
export function missionProfiles(d) {
  const pl = plantOf(d); if (!pl) return [];
  const L = packLimits(d), S = packStart(d).S, C1 = S.capAh, A = (x) => fr(x / 1000, 0), V = (x) => fr(x / 1000, 2), T = (x) => fr(x / 10, 0), ack = pl.ack ? { pulse: { [pl.ack]: 300 } } : {};
  const pick = (what, above) => L.filter((l) => l.what === what && l.above === above).sort((a, b) => (above ? a.trip - b.trip : b.trip - a.trip));
  /* ---------- CHARGE : from 3,0 V, the charger, every limit of the charge crossed ---------- */
  const ch = [ev(0, "plug", `Le chargeur est branché : batterie presque vide, ${fr(S.start, 1)} V`, `Les CORE partent de ${fr(S.start, 2)} V au repos (0 % = 2,5 V, 100 % = 4,2 V), ${S.amb} °C. Le chargeur commence à 0,1 C, monte à ${S.cHigh} C — ${fr(S.cHigh * C1, 0)} A —, puis tient 4,2 V.`, { plant: { mode: "charge", start: S.start, cvFail: 0, push: 0, heatTo: 0, amb: S.amb } })];
  let t = 240;
  for (const l of pick("current", false)) { const a = Math.round(Math.abs(l.trip) * 1.15 / 100) * 100; ch.push(ev(t, `${l.id}-in`, `Courant : la borne pousse ${A(a)} A`, `Une borne trop forte pousse ${A(a)} A — au-delà de « ${l.name} » (${A(Math.abs(l.trip))} A) : après ${fr(l.delay / 1000, 1)} s, le logiciel réagit.`, { plant: { push: a / 1000 }, target: l.id }));
    ch.push(ev(t + 60, `${l.id}-out`, "Le chargeur revient à la normale", "La borne a lu la demande du module : elle reprend sa consigne.", { plant: { push: 0 } })); t += 180; }
  for (const l of pick("temp", true)) { const to = (l.trip + 30) / 10; ch.push(ev(t, `${l.id}-in`, `Température : un CORE chauffe au-delà de ${T(l.trip)} °C`, `Le soleil, un local chaud : le CORE le plus chaud monte au-delà de « ${l.name} » (${T(l.trip)} °C).`, { plant: { heatTo: to }, target: l.id }));
    const back = 150; ch.push(ev(t + back, `${l.id}-out`, "Température : le module refroidit", "La chaleur du dehors est partie ; la pompe et l'air ramènent le CORE vers l'ambiante.", { plant: { heatTo: 0 } }));
    if (l.latch) ch.push(ev(t + back + 300, `${l.id}-ack`, "Acquittement", "Le défaut est retenu : quelqu'un l'acquitte, une fois le CORE refroidi.", ack)); t += back + (l.latch ? 420 : 120); }
  if (pl.lost) { ch.push(ev(t, "lost-in", "Comm : la chaîne des cartes se tait", "Un connecteur de la chaîne décroche : le module ne lit plus ses CORE.", { set: { [pl.lost]: 1 }, target: pl.lost })); ch.push(ev(t + 30, "lost-out", "Comm : la chaîne répond de nouveau", "Le connecteur est remis.", { set: { [pl.lost]: 0 } })); ch.push(ev(t + 60, "lost-ack", "Acquittement", "On acquitte le défaut de communication.", ack)); t += 240; }
  /* then the charger forgets its constant voltage : the CORE climb past « to watch », then past the limit — by themselves, when the physics says */
  const ovs = pick("vmax", true);
  if (ovs.length) { ch.push(ev(t + 1500, "runaway", "Le chargeur oublie sa tension constante", `Un chargeur en panne continue à pousser au-delà de 4,2 V : le CORE le plus haut passe ${ovs.map((x) => `« ${x.name} » (${V(x.trip)} V)`).join(", puis ")}.`, { plant: { cvFail: 1 }, target: ovs.map((x) => x.id) }));
    ch.push(ev(t + 1500 + 900, "unplug", "Le chargeur est débranché", "On débranche le chargeur fautif : le module reste arrêté, ses CORE trop hauts, jusqu'à ce qu'on le décharge.", { plant: { mode: "rest", cvFail: 0 } })); }
  ch.push(ev((ch[ch.length - 1].t / 1000) + 120, "end", "Fin du profil de charge", "Le profil est joué. Exportez-le, changez-le, ou rejouez-le pas à pas.", {}));
  /* ---------- DISCHARGE : from a full module, the load, every limit of the discharge crossed ---------- */
  const load = 2 * C1, dc = [ev(0, "start", `Le module est plein : ${fr(4.15, 2)} V, il part`, `Les CORE sont à 4,15 V au repos, ${S.amb} °C. La charge tire ${fr(load, 0)} A — 2 C.`, { plant: { mode: "discharge", start: 4.15, a: load, heatTo: 0, amb: S.amb } })];
  t = 240;
  for (const l of pick("current", true)) { const a = Math.round(l.trip * 1.15 / 100) * 100; dc.push(ev(t, `${l.id}-in`, `Courant : la charge tire ${A(a)} A`, `Une montée, une accélération : le module donne ${A(a)} A — au-delà de « ${l.name} » (${A(l.trip)} A) : il se dérate après ${fr(l.delay / 1000, 1)} s.`, { plant: { a: a / 1000 }, target: l.id }));
    dc.push(ev(t + 60, `${l.id}-out`, `La charge revient à ${fr(load, 0)} A`, "Le véhicule a lu la demande du module : il revient à 2 C.", { plant: { a: load } })); t += 180; }
  for (const l of pick("temp", true)) { const to = (l.trip + 30) / 10; dc.push(ev(t, `${l.id}-in`, `Température : le module chauffe au-delà de ${T(l.trip)} °C`, `Une longue montée par temps chaud : le CORE le plus chaud passe « ${l.name} » (${T(l.trip)} °C).`, { plant: { heatTo: to }, target: l.id }));
    const back = 150; dc.push(ev(t + back, `${l.id}-out`, "Température : le module refroidit", "La chaleur du dehors est partie.", { plant: { heatTo: 0 } }));
    if (l.latch) dc.push(ev(t + back + 300, `${l.id}-ack`, "Acquittement", "On acquitte le défaut, une fois le CORE refroidi.", ack)); t += back + (l.latch ? 420 : 120); }
  if (pl.lost) { dc.push(ev(t, "lost-in", "Comm : la chaîne des cartes se tait", "Une vibration fait décrocher un connecteur de la chaîne.", { set: { [pl.lost]: 1 }, target: pl.lost })); dc.push(ev(t + 30, "lost-out", "Comm : la chaîne répond de nouveau", "Le connecteur est remis.", { set: { [pl.lost]: 0 } })); dc.push(ev(t + 60, "lost-ack", "Acquittement", "On acquitte le défaut de communication.", ack)); t += 240; }
  /* the module empties : each low limit comes by itself, when the physics says */
  const lows = pick("vmin", false);
  if (lows.length) { dc.push(ev(t + 60, "empty", "Le module se vide", `La charge continue à tirer ${fr(load, 0)} A : le CORE le plus bas descend sous ${lows.map((x) => `« ${x.name} » (${V(x.trip)} V)`).join(", puis ")}.`, { plant: { a: load }, target: lows.map((x) => x.id) })); t += 2400; }
  dc.push(ev(t + 120, "stop", "La charge s'arrête", "Le véhicule s'arrête : plus de courant. Le module reste arrêté jusqu'à sa prochaine charge.", { plant: { mode: "rest", a: 0 } }));
  dc.push(ev(t + 240, "end", "Fin du profil de décharge", "Le profil est joué. Exportez-le, changez-le, ou rejouez-le pas à pas.", {}));
  const sort = (list) => list.sort((a, b) => a.t - b.t);
  return [{ id: "charge", name: "Charge", kind: "charge", events: sort(ch) }, { id: "discharge", name: "Décharge", kind: "discharge", events: sort(dc) }];
}
/** Which limits of the software a profile crosses on purpose (`target`), and which it leaves untouched. → { covered: [limit], left: [limit] } */
export function coverage(d, profiles) {
  const L = packLimits(d), hit = new Set((profiles || []).flatMap((p) => p.events || []).flatMap((e) => [].concat(e.target || [])));
  return { covered: L.filter((l) => hit.has(l.id)), left: L.filter((l) => !hit.has(l.id)) };
}
export { split };
