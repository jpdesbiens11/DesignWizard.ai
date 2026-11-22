/* DesignOrbit.ai — Labo, « Manipulation en labo » : a test of the plan, as the steps one does at the bench (demande de JP :
   « un étudiant de 1re année… chaque étape pointée sur le schéma ou la carte directement, au lieu de numéros de broches…
   s'assurer qu'ils font les bonnes choses, avec ou sans supervision, et qu'on ne détruit pas les circuits par de mauvaises
   manipulations »).
   A sheet of the plan (pcba/lab_plan.js) says the set-up in sentences. This file turns the same set-up into STEPS — one
   action each, in the order that protects the board : what to check before touching it, the supply set with its output
   off, each lead put on its point, the search for a short circuit, THEN the power, the readings one by one, the power off.
   Every step that touches the board carries the points it touches (`points`) : a screen shows them ON the board.
   The guards are in the order itself : a step is reached only when the ones before it are done — a reading done means
   read AND inside its band. A reading out of its band stops the test and says what to do ; a supervisor may let it pass,
   by name, and that is written in the notebook of the board (lab.passes).
   Nothing here is written by an assistant : the steps come from the journal of the simulated bench, the same for every
   test. What the tool does not know — a functional test of a circuit built by hand — has no steps here, and says so.
   Pure : no page. */

import { verdict, expectedText } from "./lab_plan.js";
import { eng } from "./lab_bench.js";

const fr = (x, d = 3) => String(+(+x).toPrecision(d)).replace(".", ",");
/** The leads of an instrument, by the colour one finds on the bench. */
export const LEADS = {
  plus: { label: "+", word: "le cordon rouge (+)", color: "#dc2626" }, minus: { label: "−", word: "le cordon noir (−)", color: "#111827" },
  red: { label: "R", word: "la pointe rouge", color: "#dc2626" }, black: { label: "N", word: "la pointe noire", color: "#111827" },
  probe: { label: "S", word: "la sonde", color: "#ca8a04" }, probeRef: { label: "S−", word: "la pointe − de la sonde différentielle", color: "#92400e" }, probe2: { label: "S2", word: "la sonde de la voie 2", color: "#0284c7" }, clip: { label: "M", word: "la pince de masse", color: "#111827" },
  hot: { label: "G", word: "le point chaud du générateur", color: "#2563eb" }, back: { label: "G−", word: "le retour du générateur", color: "#111827" }, load: { label: "C", word: "la charge", color: "#7c3aed" }, part: { label: "•", word: "ici", color: "#0891b2" },
};
const INSTR = { supply: "Alimentation de laboratoire", generator: "Générateur de fonctions", scope: "Oscilloscope", meter: "Multimètre", load: "Charge", wire: "Composant d'essai", logic: "Adaptateur de bus" };
const point = (lead, at, signal) => ({ lead, signal, ...(at ? { ref: at.ref, pin: at.pin } : {}) });
const place = (p) => (p.ref ? `${p.signal} (${p.ref}, broche ${p.pin})` : `le signal ${p.signal}`);

/** The steps of a sheet. → [{ id, kind, title, text, why, instrument, gear (the instrument as one sets it : { kind: "supply" | "meter" | "scope" | "generator" | "load", … }), list? (settings to copy),
      points: [{ lead, signal, ref?, pin? }], needs: "tick" | "reading", row? (index in sheet.rows), danger? }]
    kind : "safety", "set" (an instrument, away from the board), "connect", "guard" (what must be true before the power), "power", "do", "read", "off". */
export function manipSteps(sheet) {
  const S = [], L = sheet.links || [], scoped = (sheet.gearIds || []).includes("scope"), supplies = L.filter((l) => l.instr === "supply"), gens = L.filter((l) => l.instr === "generator" || l.instr === "logic"), probes = L.filter((l) => l.instr === "scope");
  const cells = L.filter((l) => l.instr === "cell"), presses = L.filter((l) => l.instr === "press");      // a board fed by its own cell ; a button the one at the bench holds down
  const add = (s) => S.push({ points: [], why: "", instrument: "", needs: "tick", gear: null, ...s });
  const src = supplies[0] || gens[0] || cells[0] || null;      // what feeds the circuit in this test : a supply, or the generator alone
  const psu = (l, on) => ({ kind: "supply", v: l ? l.v : null, ilim: l ? l.ilim : null, on }), dmm = (mode) => ({ kind: "meter", mode }), osc = (ch) => ({ kind: "scope", ch: ch || 1 }), fg = (on) => ({ kind: "generator", on });
  add({ id: "safety", kind: "safety", title: "Avant de toucher la carte", text: "Bracelet antistatique relié au poste. Lunettes de protection. La carte est HORS TENSION, rien n'est branché dessus.", why: "Une décharge du doigt détruit un circuit intégré sans rien montrer ; un condensateur monté à l'envers éclate à la mise sous tension." });
  if (sheet.noSim) {
    add({ id: "meter", kind: "set", title: "Multimètre en continuité", instrument: INSTR.meter, gear: dmm("cont"), text: "Mode continuité (ou ohmmètre, calibre le plus bas). Touchez les deux pointes ensemble : notez la résistance des cordons, à retrancher.", why: "On mesure des fractions d'ohm : les cordons en font partie." });
  } else {
    supplies.forEach((l, i) => add({ id: `set-supply-${i}`, kind: "set", title: "Régler l'alimentation, sortie COUPÉE", instrument: INSTR.supply, gear: psu(l, false), text: `Tension : ${l.v !== null ? `${fr(l.v)} V` : "celle de la note du montage"}${l.ilim ? `. Limite de courant : ${eng(l.ilim, "A")}` : ""}. Court-circuitez un instant les deux cordons : l'afficheur doit montrer la limite, pas plus.${l.note ? ` ${l.note}.` : ""}`, why: "La limite de courant est le fusible le plus rapide du banc : elle se règle AVANT que la carte soit branchée." }));
    gens.forEach((l, i) => add({ id: `set-gen-${i}`, kind: "set", title: l.logic ? "Préparer le signal logique, sortie coupée" : "Régler le générateur, sortie coupée", instrument: INSTR.generator, gear: fg(false), text: `Réglez le signal sans le relier à la carte, et regardez-le à l'oscilloscope : amplitude, décalage, fréquence. Coupez sa sortie.${l.note ? ` ${l.note}.` : ""}`, why: "Un générateur mal réglé envoie sur une entrée une tension qu'elle ne supporte pas." }));
    supplies.forEach((l, i) => add({ id: `con-supply-${i}`, kind: "connect", title: "Brancher l'alimentation — le noir d'abord", instrument: INSTR.supply, gear: psu(l, false), points: [point("minus", l.backAt, l.back), point("plus", l.at, l.to)], text: `Sortie toujours coupée : ${LEADS.minus.word} sur ${place(point("minus", l.backAt, l.back))}, puis ${LEADS.plus.word} sur ${place(point("plus", l.at, l.to))}.`, why: "La masse d'abord : si le rouge touche un mauvais point, rien n'est encore relié." }));
    L.filter((l) => l.instr === "load" || l.instr === "wire").forEach((l, i) => add({ id: `con-load-${i}`, kind: "connect", title: l.instr === "load" ? "Brancher la charge" : "Poser le composant d'essai", instrument: INSTR[l.instr], gear: { kind: "load", r: l.r }, points: [point("load", l.at, l.to), point("load", l.backAt, l.back)], text: `${l.r ? `${eng(l.r, "Ω")} ` : ""}entre ${place(point("load", l.at, l.to))} et ${place(point("load", l.backAt, l.back))}.${l.note ? ` ${l.note}.` : ""}`, why: "La charge fait débiter le circuit : c'est en charge qu'il se juge." }));
    gens.forEach((l, i) => add({ id: `con-gen-${i}`, kind: "connect", title: "Relier le générateur, sortie coupée", instrument: INSTR.generator, gear: fg(false), points: [point("back", l.backAt, l.back), point("hot", l.at, l.to)], text: `Le retour du générateur (la pince noire de son câble) sur ${place(point("back", l.backAt, l.back))}, puis le point chaud (la pince rouge) sur ${place(point("hot", l.at, l.to))}.` }));
    add({ id: "guard", kind: "guard", title: "Chercher un court-circuit AVANT d'alimenter", instrument: INSTR.meter, gear: dmm("cont"), points: src ? [point("black", src.backAt, src.back), point("red", src.at, src.to)] : [], text: `${cells.length && !supplies.length ? "La pile HORS de son support. " : ""}Multimètre en continuité, une pointe sur la masse, l'autre sur ${supplies.length ? "l'entrée d'alimentation" : cells.length ? "le + du support de pile" : "le point où le générateur entrera"} :` + " il ne doit PAS sonner en continu (un bip bref, le temps de charger les condensateurs, est normal). S'il sonne : ne mettez pas sous tension — cherchez le pont de soudure ou le composant à l'envers.", why: "Un court-circuit trouvé au multimètre ne coûte rien ; trouvé à la mise sous tension, il coûte une piste ou un composant." });
    add({ id: "review", kind: "guard", title: "Relire le montage, instrument par instrument", text: "Reprenez chaque étape de branchement sur la carte, dans l'ordre. La première fois, faites-le relire par quelqu'un.", why: "La plupart des cartes détruites au banc l'ont été par un cordon au mauvais endroit, pas par un défaut de conception." });
    if (supplies.length) add({ id: "power", kind: "power", danger: true, title: "Mettre sous tension, l'œil sur le courant", instrument: INSTR.supply, gear: psu(supplies[0], true), points: supplies[0] ? [point("plus", supplies[0].at, supplies[0].to)] : [], text: "Activez la sortie en regardant l'afficheur de courant. Une limitation d'un instant est normale. Si elle dure plus d'une seconde, ou si quelque chose chauffe ou sent : COUPEZ, et cherchez avant toute autre chose.", why: "La première seconde dit presque tout : un courant qui reste en limite est un court-circuit ou un composant à l'envers." });
    if (cells.length && !supplies.length) add({ id: "cell-in", kind: "power", danger: true, title: "Mettre la pile en place, le + vers le haut", instrument: "Pile de la carte", gear: null, points: [point("plus", cells[0].at, cells[0].to)],
      text: `Glissez la pile dans son support, la face marquée « + » vers le haut : c'est elle qui alimente la carte, il n'y a pas d'alimentation de laboratoire dans cet essai.${cells[0].note ? ` ${cells[0].note}.` : ""} Si quelque chose chauffe : retirez-la aussitôt.`,
      why: "Le support est détrompé, mais une pile forcée à l'envers met la carte sous une tension inversée : regardez le « + » avant de pousser." });
    if (gens.length) add({ id: "gen-on", kind: "power", danger: !supplies.length, title: "Activer la sortie du générateur", instrument: INSTR.generator, gear: fg(true), points: supplies.length ? [] : [point("hot", gens[0].at, gens[0].to)],
      text: supplies.length ? "La carte est alimentée : activez maintenant la sortie du générateur." : "Aucune alimentation dans cet essai : c'est le générateur qui fait vivre le circuit. Activez sa sortie en regardant l'oscilloscope ; si le signal s'écrase, ou si quelque chose chauffe ou sent : COUPEZ.",
      why: supplies.length ? "On n'envoie jamais un signal sur une carte qui n'est pas alimentée : il passerait par les protections des entrées." : "Un signal qui s'écrase dès qu'on le branche dit qu'il débite dans un court-circuit ou dans une protection qui conduit." });
  }
  /* with an oscilloscope, the probes are put once and stay ; with a multimeter there is ONE pair of tips : each reading says where they go, one at a time */
  (sheet.noSim || !scoped ? [] : probes.filter((l, i, a) => a.findIndex((q) => q.to === l.to) === i)).forEach((l, i) => add(l.float
    ? { id: `probe-${i}`, kind: "connect", float: true, title: `Voie ${l.ch || i + 1} : une tension entre deux points vivants`, instrument: `${INSTR.scope} — sonde différentielle`, gear: osc(l.ch || i + 1), points: [point("probeRef", l.backAt, l.back), point(l.ch === 2 ? "probe2" : "probe", l.at, l.to)],
      text: `Cette tension se mesure ENTRE ${place(point("probe", l.at, l.to))} et ${place(point("probeRef", l.backAt, l.back))} : aucun des deux n'est la masse. Sonde différentielle : sa pointe + sur le premier, sa pointe − sur le second. Sans elle : deux sondes ordinaires, une sur chaque point, leurs pinces sur la masse de la carte, et la fonction « math » (différence). Ne posez JAMAIS la pince de masse d'une sonde ordinaire sur ${l.back}.`,
      why: "La pince de masse d'un oscilloscope est reliée à la terre par sa prise de courant : posée sur un point vivant — la sortie d'un pont, un fil de bus —, elle le met en court-circuit à travers l'appareil." }
    : { id: `probe-${i}`, kind: "connect", title: `Poser la sonde de la voie ${l.ch || i + 1}`, instrument: INSTR.scope, gear: osc(l.ch || i + 1), points: [point("clip", l.backAt, l.back), point(l.ch === 2 ? "probe2" : "probe", l.at, l.to)],
      text: `${LEADS.clip.word} sur ${place(point("clip", l.backAt, l.back))}${l.ac ? " — au ressort de masse, pas à la pince" : ""}, puis la sonde ×10 sur ${place(point("probe", l.at, l.to))}.`, why: "La pince de masse de l'oscilloscope est reliée à la terre : elle ne se pose que sur la masse de la carte — jamais sur un signal." }));
  const tune = (sheet.settings || []).filter((t) => /^(Oscilloscope|Base de temps|Multimètre|Générateur :)/.test(t));
  if (tune.length) add({ id: "tune", kind: "set", title: scoped ? "Régler l'oscilloscope" : "Régler le multimètre", instrument: scoped ? INSTR.scope : INSTR.meter, gear: scoped ? osc(0) : dmm("vdc"), list: tune,
    text: scoped ? "Reportez ces réglages sur l'appareil, puis ajustez jusqu'à voir deux ou trois cycles, ou l'événement entier." : "Cordon noir dans la borne COM, cordon rouge dans la borne V. Tournez le sélecteur sur la tension continue : le V surmonté d'un trait droit — pas d'une vague, qui est la tension alternative.",
    why: scoped ? "Un calibre mal choisi fait lire une valeur fausse sans rien signaler : on règle d'après ce que l'on s'attend à voir." : "Un multimètre resté sur « courant » ou sur « ohms » ne mesure pas une tension : il peut même faire un court-circuit entre ses deux pointes." });
  const ground = (L.find((l) => l.backAt) || {}).backAt || null, gnd = (n) => /GND/i.test(n || ""), fed = new Set(supplies.map((l) => l.to));      // where the black tip rests : the ground the instruments of this test already use
  const same = (a, b) => a && b && a.ref === b.ref && a.pin === b.pin, band = (r) => `${r.ceiling ? "Simulé" : "Attendu"} : ${expectedText(r)} — accepté : ${r.band.text}.`, curve = (r) => (r.end ? ` C'est la fin de la courbe ${r.end === 2 ? "bleue (CH2)" : "jaune (CH1)"} que l'écran du Labo a tracée.` : "");
  const pressSteps = [];
  presses.forEach((l, i) => pressSteps.push({ id: `press-${i}`, kind: "do", title: "Appuyer sur le bouton — et le tenir", instrument: "Votre doigt", gear: null, points: [point("part", l.at, l.to)],
    text: `Appuyez sur le bouton ${l.at && l.at.ref ? l.at.ref : ""} montré sur la carte, et gardez-le enfoncé pendant les relevés qui suivent${l.note ? ` (${l.note})` : ""}. Si vous n'avez pas assez de mains : une pince à linge sur le bouton fait l'affaire.`.replace("  ", " "),
    why: "Sur cette carte, c'est le bouton qui ferme le circuit : relâché, rien ne passe, et il n'y a rien à mesurer." }));
  const pressAt = S.length;      // the presses go after the readings done at rest (`before`), before the others
  (sheet.rows || []).forEach((r, i) => { const P = r.points || [], amps = r.unit === "A" && !P.length, byScope = !sheet.noSim && (scoped || !!r.scope), sig = P.filter((p) => !gnd(p.signal)); let pts = [], how = "";
    if (amps) how = "Lisez le courant sur l'afficheur de l'alimentation et inscrivez-le.";
    else if (sheet.noSim) { pts = P.map((p, k) => point(k ? "black" : "red", p, p.signal)); how = "Une pointe sur chaque point montré, lisez la résistance et inscrivez-la."; }
    else if (byScope) {      // a probe per signal ; the clip of an oscilloscope is earthed : it goes on a ground, never on a signal
      pts = P.map((p) => (gnd(p.signal) ? point("clip", p, p.signal) : point(sig.indexOf(p) > 0 ? "probe2" : "probe", p, p.signal))); if (!pts.length) pts = probes.filter((l, k, a) => a.findIndex((q) => q.to === l.to) === k).map((l) => point(l.ch === 2 ? "probe2" : "probe", l.at, l.to)); if (ground && !pts.some((p) => p.lead === "clip")) pts.unshift(point("clip", ground, "GND"));
      how = sig.length > 1 ? `Une sonde par point montré, leurs pinces de masse sur la masse — jamais sur un signal. ${/^(s|Hz)$/.test(r.unit) ? "Le temps se lit entre les deux courbes, aux curseurs de l'oscilloscope." : "La valeur se lit à l'écran, aux curseurs (l'écart entre deux fils : la fonction « math », voie 1 − voie 2)."}` : "Lisez la valeur à l'écran de l'oscilloscope — aux curseurs, ou par ses mesures automatiques — et inscrivez-la."; }
    else if (P.length >= 2 && r.pair) { pts = [point("red", P[0], P[0].signal), point("black", P[1], P[1].signal)]; how = "La pointe rouge sur le premier point, la noire sur le second : le multimètre affiche l'écart entre les deux. Attendez que le chiffre se stabilise, puis inscrivez-le."; }
    else if (P.length >= 2) { const watch = P.find((p) => !fed.has(p.signal)) || P[0], swept = P.some((p) => fed.has(p.signal)); pts = [...(ground && !same(ground, watch) ? [point("black", ground, "GND")] : []), point("red", watch, watch.signal)];      // two signals that are not a difference : one is watched, the other is what one sweeps
      how = swept ? "La pointe noire sur la masse, la rouge sur le point entouré : le multimètre SURVEILLE ce point pendant que vous tournez le bouton de tension de l'alimentation. La valeur à inscrire se lit sur l'afficheur de l'ALIMENTATION, au moment que dit le titre." : "La pointe noire sur la masse, la rouge sur le point entouré. Attendez que le chiffre se stabilise, puis inscrivez-le."; }
    else { pts = P.length ? [...(ground && r.unit !== "A" && !same(ground, P[0]) ? [point("black", ground, "GND")] : []), point("red", P[0], P[0].signal)] : probes.map((l) => point("red", l.at, l.to)); how = "Un seul multimètre, une mesure à la fois : la pointe noire sur la masse, puis la rouge sur le point entouré. Attendez que le chiffre se stabilise, puis inscrivez-le."; }
    add({ id: `read-${i}`, kind: "read", needs: "reading", row: i, title: `Relever : ${r.label}`, instrument: amps ? `${INSTR.supply} — son afficheur de courant` : byScope ? INSTR.scope : INSTR.meter, gear: amps ? psu(supplies[0], true) : sheet.noSim ? dmm("cont") : byScope ? osc(0) : dmm(r.unit === "Ω" ? "ohm" : "vdc"), points: pts,
      text: `${r.optional ? `Demande ${r.needs} : si le banc n'en a pas, passez cette étape — la valeur attendue est donnée pour comprendre ce qui se passe. ` : ""}${how} ${band(r)}${curve(r)}`, why: i === 0 ? sheet.expect || "" : "" }); });
  if (pressSteps.length) { const k = S.findIndex((s, j) => j >= pressAt && s.kind === "read" && !(sheet.rows[s.row] || {}).before); S.splice(k < 0 ? S.length : k, 0, ...pressSteps.map((x) => ({ why: "", needs: "tick", ...x }))); }
  if (presses.length) add({ id: "release", kind: "do", title: "Relâcher le bouton", instrument: "Votre doigt", gear: null, points: presses.map((l) => point("part", l.at, l.to)), text: "Relâchez : la DEL doit s'éteindre aussitôt. Si elle reste allumée, le bouton est collé ou une soudure le court-circuite.", why: "Un essai se termine en revenant au repos : c'est la moitié de la fonction du bouton." });
  if (cells.length && !supplies.length && !sheet.noSim) { add({ id: "off", kind: "off", title: "Retirer la pile, décâbler", instrument: "Pile de la carte", gear: null, points: [point("plus", cells[0].at, cells[0].to)], text: "Retirez la charge, puis la pile de son support : la carte n'a plus de source. Rangez la pile à part — deux piles bouton qui se touchent dans une poche se déchargent l'une dans l'autre.", why: "Une pile bouton laissée en place se décharge lentement, et une pile avalée est un danger grave pour un enfant : elle se range." }); return S; }
  add({ id: "off", kind: "off", title: sheet.noSim ? "Ranger" : "Couper, attendre, décâbler", instrument: sheet.noSim ? INSTR.meter : supplies.length ? INSTR.supply : INSTR.generator, gear: sheet.noSim ? null : supplies.length ? psu(supplies[0], false) : fg(false), text: sheet.noSim ? "Retirez les pointes. Notez ce qui s'écarte." : `${gens.length && supplies.length ? "Coupez le générateur, puis l'alimentation" : gens.length ? "Coupez la sortie du générateur" : "Coupez la sortie de l'alimentation"}. Attendez que les tensions soient retombées — vérifiez-le au multimètre — avant de retirer un cordon.`, why: sheet.noSim ? "" : "Un condensateur reste chargé après la coupure ; un cordon retiré sous tension fait une étincelle au mauvais endroit." });
  return S;
}

/** Where a test stands at the bench. lab : labOf(board) ; key : the key of the test.
    → { steps: [{ ...step, state: "done" | "now" | "locked", value?, verdict?, pass? }], at (index of the step to do), done, total, stopped (a reading out of its band, not let pass), finished } */
export function manipState(sheet, steps, lab, key) {
  const ticks = new Set((lab.ticks || []).filter((t) => t.test === key).map((t) => t.step)), passes = new Map((lab.passes || []).filter((p) => p.test === key).map((p) => [p.step, p]));
  let open = true, at = -1, stopped = null;
  const out = steps.map((s, i) => {
    let done = false, v = null, value = null; const pass = passes.get(s.id) || null;
    if (s.needs === "reading") { const row = sheet.rows[s.row], x = (lab.readings || []).find((q) => q.test === key && q.what === row.label); value = x ? x.value : null; v = verdict(row, value); done = v === "ok" || (v === "out" && !!pass) || (row.optional && ticks.has(s.id)) || (v === "none" && !!pass); }
    else done = ticks.has(s.id);
    const state = !open ? "locked" : done ? "done" : "now";
    if (open && !done) { open = false; at = i; if (v === "out" && !pass) stopped = s.id; }
    return { ...s, state, ...(value !== null ? { value } : {}), ...(v ? { verdict: v } : {}), ...(pass ? { pass } : {}) };
  });
  const done = out.filter((s) => s.state === "done").length;
  return { steps: out, at: at < 0 ? steps.length - 1 : at, done, total: steps.length, stopped, finished: done === steps.length };
}
/** Why a step cannot be done yet : the step that waits before it, in words. */
export function lockReason(state, i) {
  const s = state.steps[i]; if (!s || s.state !== "locked") return "";
  const w = state.steps[state.at];
  return state.stopped === w.id ? `« ${w.title} » est hors de sa plage : l'essai est arrêté. Coupez l'alimentation, cherchez la cause ; un superviseur peut laisser passer, et c'est noté.` : `D'abord : « ${w.title} ».`;
}
/** The pad of a point on a resolved board (pcba/model.js resolveBoard) : → { x, y, w, h } or null when the board does not have it. */
export function padOf(R, p) { if (!p || !p.ref) return null; const pad = (R.pads || []).find((q) => q.ref === p.ref && (q.n === String(p.pin) || q.name === String(p.pin))) || null; return pad ? { x: pad.x, y: pad.y, w: pad.w, h: pad.h } : null; }
/** The points of a step, placed : → [{ ...point, at: { x, y } | null, color, label, word }] ; and the box to look at (the points, with room around). */
export function placedPoints(R, step) {
  const pts = (step.points || []).map((p) => { const pad = padOf(R, p), L = LEADS[p.lead] || LEADS.part; return { ...p, at: pad ? { x: pad.x, y: pad.y } : null, color: L.color, label: L.label, word: L.word }; }), on = pts.filter((p) => p.at);
  if (!on.length) return { points: pts, box: null };
  /* enough of the board around the points to know WHERE one is : never less than a good third of the board */
  const xs = on.map((p) => p.at.x), ys = on.map((p) => p.at.y), B = R.bbox || [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], least = 0.4 * Math.max(B[2] - B[0], B[3] - B[1], 20);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2, half = Math.max(least, 1.6 * (Math.max(...xs) - Math.min(...xs)), 1.6 * (Math.max(...ys) - Math.min(...ys))) / 2;
  return { points: pts, box: [cx - half, cy - half, cx + half, cy + half] };
}
/** The unit a reading is typed in : 3,3 mA, not 0,0033 A. → { k (what one types × 1 / k = SI), label } */
export function readUnit(v, unit) { const a = Math.abs(v || 0), [k, p] = !unit || a === 0 ? [1, ""] : a >= 1e6 ? [1e-6, "M"] : a >= 1e3 ? [1e-3, "k"] : a >= 1 ? [1, ""] : a >= 1e-3 ? [1e3, "m"] : a >= 1e-6 ? [1e6, "µ"] : [1e9, "n"]; return { k, label: `${p}${unit || ""}` }; }
/** What a reading says, in a sentence for the one at the bench. */
export function readingSays(row, value) {
  const v = verdict(row, value);
  if (v === "none") return { v, text: "", action: "" };
  if (v === "ok") return { v, text: `Dans la plage (${row.band.text}).`, action: "" };
  return { v, text: `Hors de la plage (${row.band.text}) : notez la valeur telle quelle.`, action: "COUPEZ l'alimentation. Refaites la mesure une fois. Puis comparez les pièces montées à la nomenclature — on ne corrige jamais un relevé pour qu'il ressemble au plan." };
}
