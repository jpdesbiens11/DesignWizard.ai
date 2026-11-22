/* DesignWizard.ai — Labo, the bench as instruments one SETS (point 6, JP, 20 novembre 2026 : « chaque appareil dessiné, ses cordons
   tirés jusqu'aux points de la carte, et ses réglages changés SUR l'appareil — pas dans une section du volet de gauche ; ce qui ne se
   règle pas ici (le circuit vient du PCBA) est dit »).
   A sheet of the plan (pcba/lab_plan.js) knows, as data, which instrument goes on which pin (`links`). This file turns them into the
   instruments of the bench : what each one is, the points its leads go to, what one can turn on its front — the voltage and the
   current limit of a supply, the resistance of a load — and, when nothing can be turned there, why. A setting is kept in the notebook
   of the board (`board.lab.gears`, pcba/lab_plan.js setGear) and the simulated bench reads it (`env.gear`, pcba/lab_bench.js) : the
   test is simulated again with it, and its sheet, its expected values and its plan follow. What a test makes on purpose — a ramp, a
   dip, a reversed supply, a programmed current — stays the test's. A button of the board is pressed by a click on it in the view :
   the simulation was run with the press the test writes ; the click shows the moment of it where the button is held, or released
   (`pressFrames`). Pure : no page. */

/** What can be turned on the front of an instrument, with the range the tool accepts. */
export const KNOBS = {
  supply: [{ k: "v", label: "Tension", unit: "V", min: 0, max: 60, step: 0.1 }, { k: "ilim", label: "Limite", unit: "A", min: 0.001, max: 10, step: 0.01 }],
  load: [{ k: "r", label: "Résistance", unit: "Ω", min: 0.1, max: 1e7, step: 1 }],
};
const NAMES = { supply: "Alimentation de laboratoire", load: "Charge", generator: "Générateur de fonctions", scope: "Oscilloscope", meter: "Multimètre", wire: "Composant d'essai", cell: "Pile de la carte", press: "Votre doigt", logic: "Adaptateur de bus" };
/** Why an instrument has nothing to turn here : said, never hidden. */
const FIXED = {
  generator: "Le signal du générateur est celui de l'essai : sa forme, son amplitude et sa fréquence sont dans les réglages de la fiche.",
  logic: "Le signal logique est celui de l'essai : il est écrit par la fiche.",
  scope: "L'oscilloscope ne change rien au circuit : ses calibres se règlent pour bien voir, d'après la fiche.",
  meter: "Le multimètre lit ; il ne change rien au circuit. Un seul à la fois : chaque relevé dit où vont ses pointes.",
  wire: "Un composant que la fiche pose pour l'essai : sa valeur est celle de l'essai.",
  cell: "La pile de la carte : sa tension est celle d'une pile neuve, pas un réglage.",
  press: "Cliquez sur le bouton dans la vue de la carte : appuyé tant que vous tenez le clic, relâché ensuite.",
  shape: "Cette source fait l'essai : sa forme (rampe, creux, inversion) est écrite par l'essai, pas réglée ici. Sa limite de courant se règle.",
  sink: "Une charge à courant programmé par l'essai : son profil est celui de l'essai.",
};
/** What never changes on the bench, and where it does : the circuit itself. */
export const CIRCUIT_NOTE = "Le circuit vient du PCBA : ses composants et leurs valeurs se changent dans le PCBA, pas sur le banc.";

const lead = (lead, at, signal) => ({ lead, signal: signal || "", ...(at && at.ref ? { ref: at.ref, pin: at.pin } : {}) });
/** The key of an instrument in the notebook : its kind and the signal its + goes to (« supply:VIN »). */
export const gearKey = (instr, to) => `${instr}:${to}`;

/** The instruments of a sheet, in the order of the bench — what feeds, what loads, what drives, what reads, what one does by hand.
    → [{ key, kind, name, to, v, ilim, r, set (a setting made on it), knobs: [{ k, label, unit, min, max, step, value }], fixed (why nothing turns), leads: [{ lead, signal, ref?, pin? }] }] */
export function benchGear(sheet) {
  const L = (sheet && sheet.links) || [], out = [], scoped = ((sheet && sheet.gearIds) || []).includes("scope"), seen = new Set();
  const push = (x) => { if (seen.has(x.key)) return; seen.add(x.key); out.push({ v: null, ilim: null, r: null, set: false, knobs: [], fixed: "", ...x }); };
  for (const l of L.filter((x) => x.instr === "supply")) {
    const free = !!l.free, knobs = KNOBS.supply.filter((k) => free || k.k === "ilim").map((k) => ({ ...k, value: l[k.k] }));
    push({ key: gearKey("supply", l.to), kind: "supply", name: NAMES.supply, to: l.to, v: l.v, ilim: l.ilim, set: !!l.set, knobs, fixed: free ? "" : FIXED.shape, leads: [lead("minus", l.backAt, l.back), lead("plus", l.at, l.to)] });
  }
  for (const l of L.filter((x) => x.instr === "cell")) push({ key: gearKey("cell", l.to), kind: "cell", name: NAMES.cell, to: l.to, fixed: FIXED.cell, leads: [lead("plus", l.at, l.to)] });
  for (const l of L.filter((x) => x.instr === "load" || x.instr === "wire")) {
    const free = l.instr === "load" && !!l.free && Number.isFinite(l.r);
    push({ key: gearKey(l.instr, l.to), kind: l.instr === "load" ? "load" : "wire", name: NAMES[l.instr], to: l.to, r: l.r, set: !!l.set, knobs: free ? KNOBS.load.map((k) => ({ ...k, value: l.r })) : [], fixed: free ? "" : l.instr === "wire" ? FIXED.wire : FIXED.sink, leads: [lead("load", l.at, l.to), lead("load", l.backAt, l.back)] });
  }
  for (const l of L.filter((x) => x.instr === "generator" || x.instr === "logic")) push({ key: gearKey(l.instr, l.to), kind: "generator", name: NAMES[l.instr], to: l.to, fixed: FIXED[l.instr], leads: [lead("back", l.backAt, l.back), lead("hot", l.at, l.to)] });
  const probes = L.filter((x) => x.instr === "scope").filter((l, i, a) => a.findIndex((q) => q.to === l.to) === i);
  if (probes.length && scoped) { const ground = probes.find((p) => p.backAt && !p.float);
    push({ key: "scope", kind: "scope", name: NAMES.scope, to: probes[0].to, fixed: FIXED.scope, channels: probes.map((p) => p.ch || 1),
      leads: [...(ground ? [lead("clip", ground.backAt, ground.back)] : []), ...probes.map((p) => lead(p.ch === 2 ? "probe2" : "probe", p.at, p.to)), ...probes.filter((p) => p.float).map((p) => lead("probeRef", p.backAt, p.back))] }); }
  else if (probes.length) { const p = probes[0]; push({ key: "meter", kind: "meter", name: NAMES.meter, to: p.to, fixed: FIXED.meter, leads: [lead("black", p.backAt, p.back), lead("red", p.at, p.to)] }); }
  for (const l of L.filter((x) => x.instr === "press")) push({ key: gearKey("press", l.to), kind: "press", name: NAMES.press, to: l.to, fixed: FIXED.press, leads: [lead("part", l.at, l.to)] });
  return out;
}

/** A value typed on an instrument, checked against what the tool accepts. → { ok, value (SI), text (why not, in words) } */
export function checkKnob(kind, k, raw) {
  const K = (KNOBS[kind] || []).find((x) => x.k === k); if (!K) return { ok: false, value: null, text: "Ce réglage n'existe pas sur cet appareil." };
  const v = typeof raw === "number" ? raw : Number(String(raw ?? "").trim().replace(",", "."));
  if (!Number.isFinite(v)) return { ok: false, value: null, text: `${K.label} : un nombre, en ${K.unit}.` };
  if (v < K.min || v > K.max) return { ok: false, value: null, text: `${K.label} : entre ${K.min} et ${K.max} ${K.unit} sur ce banc.` };
  return { ok: true, value: v, text: "" };
}

/** What the settings of a test change, in sentences for the guide and the sheet : a setting differs from what the test proposes.
    gears : labOf(board).gears for this test ; gear : benchGear(sheet) */
export function gearWords(gear) {
  return gear.filter((g) => g.set).map((g) => g.kind === "supply" ? `${g.name} sur ${g.to} réglée à ${fmt(g.v)} V${g.ilim ? `, limite ${fmtA(g.ilim)}` : ""} : les valeurs attendues suivent ce réglage.` : `${g.name} sur ${g.to} réglée à ${fmtR(g.r)} : les valeurs attendues suivent ce réglage.`);
}
const fmt = (x) => (x === null || x === undefined ? "—" : String(+(+x).toPrecision(3)).replace(".", ","));
const fmtA = (a) => (a >= 1 ? `${fmt(a)} A` : `${fmt(a * 1e3)} mA`);
const fmtR = (r) => (r >= 1e6 ? `${fmt(r / 1e6)} MΩ` : r >= 1e3 ? `${fmt(r / 1e3)} kΩ` : `${fmt(r)} Ω`);

/** For a test with a button held by hand : which frames of the run have it pressed, and the moment to show for « held » and « released ».
    R : the result of a run in time (pcba/lab_bench.js tranResult) ; env : the env it ran with (only `press` is read).
    → null when the test has no press ; else { pressed: [bool per frame], down: q (0..1), up: q (0..1) | null when it is never released } */
export function pressFrames(R, env) {
  if (!R || R.kind !== "tran" || !env || typeof env.press !== "function" || !R.t || !R.frames) return null;
  const step = R.step || 1, pressed = []; for (let q = 0; q < R.frames; q++) { const k = Math.min(R.t.length - 1, q * step); pressed.push(!!env.press(R.t[k])); }
  /* the moment shown : the END of the longest run of frames in that state — what the circuit does once it has settled there */
  const settle = (want) => { let best = null, len = 0, start = -1; for (let q = 0; q <= pressed.length; q++) { const on = q < pressed.length && pressed[q] === want; if (on && start < 0) start = q; if (!on && start >= 0) { if (q - start > len) { len = q - start; best = q - 1; } start = -1; } } return best; };
  const d = settle(true), u = settle(false), n = Math.max(1, R.frames - 1);
  return d === null ? null : { pressed, down: d / n, up: u === null ? null : u / n };
}
