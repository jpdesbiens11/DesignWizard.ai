/* DynamiteOrbit.ai — a requirement READ BY THE MACHINE (JP, 27 novembre 2026, par menu : « Requis lisibles + pointillés » ; sa vision : « tagger les
   ID de requis et mettre des lignes pointillées pour ceux qui sont des limites min / max directement sur chacun des graphiques temporels de
   mission… jouer tous les profils et en retirer un fichier de constat »). A requirement proven by a TEST (letter T) that speaks of a quantity the
   bench records becomes an ORACLE — what a mission must show for it to be held :
     bound      the quantity stays between min and max while the contactor is closed (« doit rester entre… en service ») ;
     envelope   what the missions must reach — the operating envelope they cover (« fournir 360 A en continu ») ;
     reaction   when the condition holds for `hold`, the expected answer comes within `within` (« si… pendant plus de 100 ms, ouvrir le contactor »).
   The tool PROPOSES the oracle from the statement — the usual phrasings of a requirement in French — and a person confirms it, as every value the
   tool invents ; what it cannot read is said, never guessed. The verdict is read on the record of the bench (sw/sw_live.js L.rec, one line a
   SECOND) : a time shorter than a second is not judged, and the verdict says so. The quantities are those of the module on the bench (the
   plant of the ESS, sw/sw_pack.js) : a new product declares its own. What it follows : requirements-based testing — each requirement has its
   pass / fail criterion, the test judges against the requirement, not against the software (the standards themselves were not read). Pure. */

import { keyOf, isNeed, maturityOf } from "./reqs.js";

const num = (s) => Number(String(s).replace(",", "."));
const toMs = (v, u) => (/^s$/i.test(u) ? num(v) * 1000 : num(v));
/** One line of the bench, every second. */
export const RESOLUTION = 1000;

/** What the bench records, in the units of physics. of(x, ix) : the value on a line of the record (ix : the index of the outputs). */
export const SIGNALS = {
  vblock_max: { label: "Highest cell block voltage", fr: "tension du cell block le plus haut", short: "V bloc max", unit: "V", panel: "v", of: (x) => x.vmax / 1000 },
  vblock_min: { label: "Lowest cell block voltage", fr: "tension du cell block le plus bas", short: "V bloc min", unit: "V", panel: "v", of: (x) => x.vmin / 1000 },
  vspread: { label: "Cell block spread", fr: "écart entre le plus haut et le plus bas cell block", short: "écart", unit: "V", of: (x) => (x.vmax - x.vmin) / 1000 },
  temp_max: { label: "Hottest cell temperature", fr: "température de la cell la plus chaude", short: "T max", unit: "°C", panel: "t", of: (x) => x.temp / 10 },
  current: { label: "Module current (+ discharge)", fr: "courant du module (+ en décharge)", short: "I", unit: "A", panel: "i", of: (x) => x.current / 1000 },
  current_abs: { label: "Module current, either way", fr: "courant du module, en charge ou en décharge", short: "|I|", unit: "A", panel: "i", of: (x) => Math.abs(x.current) / 1000 },
  state: { label: "Module state", fr: "état du module", short: "état", unit: "", of: (x) => x.state || 0 },
  contactor: { label: "Contactor", fr: "contactor (1 fermé, 0 ouvert)", short: "contactor", unit: "", of: (x, ix) => (ix.contactor >= 0 ? x.out[ix.contactor] : (x.state || 0) >= 3 ? 0 : 1) },
  pump: { label: "Cooling pump", fr: "pompe de refroidissement", short: "pompe", unit: "", of: (x, ix) => (ix.pump >= 0 ? x.out[ix.pump] : null) },
  bleed: { label: "Cell blocks being balanced", fr: "cell blocks en équilibrage", short: "équilibrage", unit: "", of: (x) => x.bleed || 0 },
  /* the 1.5D model of the module (sw/sw_pack_model.js, JP 28 novembre 2026) : what a requirement on the state of charge or the power may read */
  soc: { label: "State of charge (mean of the CORE)", fr: "état de charge, moyenne des CORE", short: "SoC", unit: "%", panel: "s", of: (x) => (x.soc ?? 0) / 10 },
  power: { label: "Module power (+ discharge)", fr: "puissance du module (+ en décharge)", short: "P", unit: "kW", panel: "p", of: (x) => (x.pw ?? 0) / 1000 },
};
export const STATES = ["Normal", "Derated", "Emergency", "Shutdown"];
const STATE_OF = { normal: 0, derated: 1, emergency: 2, shutdown: 3 };

/* ---------- reading a statement ---------- */
/* a condition : a verb, a number, its unit, charge or discharge, how long — « dépasse 4,25 V pendant plus de 100 ms », « , ou 65 °C en charge » */
const CLAUSE = /(?:(dépasse|au-dessus de|descend sous|sous)\s+|,\s*ou\s+)(\d+(?:[,.]\d+)?)\s*(V|A|°C)(\s+en\s+(?:charge|décharge))?(?:,?\s*pendant plus de\s+(\d+(?:[,.]\d+)?)\s*(ms|s))?/gi;
const UP = /dépasse|au-dessus/i;
function signalFor(unit, up) { return unit === "V" ? (up ? "vblock_max" : "vblock_min") : unit === "°C" ? "temp_max" : "current_abs"; }
/* what the software must do : open the contactor, put the module in a state, ask for the pump, balance */
function targetOf(t) {
  if (/ouvrir le contactor/i.test(t)) return { signal: "contactor", is: 0 };
  const s = t.match(/l'état\s+(Derated|Emergency|Shutdown)/i); if (s) return { signal: "state", atLeast: STATE_OF[s[1].toLowerCase()] };
  if (/demander le refroidissement|pompe/i.test(t)) return { signal: "pump", is: 1 };
  if (/est déchargé|équilibrer/i.test(t)) return { signal: "bleed", atLeast: 1 };
  return null;
}
/* how long the answer may take : the statement first (« en 50 ms au plus », « 1 s plus tard »), else the acceptance criteria (« en moins de 3 s »,
   « entre 100 et 150 ms ») */
function withinOf(r) {
  const st = r.statement || "", ac = r.acceptance_criteria || "";
  let m = st.match(/en\s+(\d+(?:[,.]\d+)?)\s*(ms|s)\s+au plus/i) || ac.match(/en moins de\s+(\d+(?:[,.]\d+)?)\s*(ms|s)\b/i); if (m) return toMs(m[1], m[2]);
  m = ac.match(/entre\s+\d+(?:[,.]\d+)?\s+et\s+(\d+(?:[,.]\d+)?)\s*(ms|s)\b/i); if (m) return toMs(m[1], m[2]);
  return null;
}
/** What the tool reads in a requirement. → { list: [oracle], why } — why says, when the list is empty, why : « offbench » (not proven by a test),
    « tbd » (a value is still to define), « unread » (no condition the bench records : to write by hand). */
export function proposeOracles(r) {
  if (!r || isNeed(r)) return { list: [], why: "need" };
  if (!/T/.test(r.verification_method || "")) return { list: [], why: "offbench" };
  const t = r.statement || "", list = [];
  /* a range per cell block : « 2,80 V à 4,20 V par cell block » */
  const band = t.match(/(\d+(?:[,.]\d+)?)\s*V\s*à\s*(\d+(?:[,.]\d+)?)\s*V\s+par cell block/i);
  if (band && /rester/i.test(t)) { list.push({ kind: "bound", signal: "vblock_min", min: num(band[1]) }, { kind: "bound", signal: "vblock_max", max: num(band[2]) }); return { list, why: "" }; }
  const target = targetOf(t);
  /* what the missions must reach : « fournir 360 A en continu en décharge », « courant de charge de 72 A au plus » */
  if (!target) {
    const dis = t.match(/fournir\s+(\d+(?:[,.]\d+)?)\s*A\b[^.]*décharge/i), ch = t.match(/courant de charge de\s+(\d+(?:[,.]\d+)?)\s*A\s+au plus/i);
    if (dis) list.push({ kind: "envelope", signal: "current", max: num(dis[1]) }); if (ch) list.push({ kind: "envelope", signal: "current", min: -num(ch[1]) });
    return { list, why: list.length ? "" : /\bTB[DC]\b/.test(t) ? "tbd" : "unread" };
  }
  /* the conditions, in their order ; a « , ou 65 °C » shares the verb before it, and a duration said at the end of such a group holds for all of it */
  const clauses = []; let verb = null, m; CLAUSE.lastIndex = 0;
  while ((m = CLAUSE.exec(t))) {
    const own = m[1] || null; if (own) verb = own; if (!verb) continue;
    const before = t.slice(Math.max(0, m.index - 18), m.index), off = /arrêter\s*$/i.test(before);      // « … et l'arrêter sous 38 °C » : the answer undone
    const mode = m[4] ? (/décharge/i.test(m[4]) ? "discharge" : "charge") : "";
    clauses.push({ group: own ? clauses.length : clauses.length ? clauses[clauses.length - 1].group : 0, up: UP.test(verb), value: num(m[2]), unit: m[3], when: mode, hold: m[5] ? toMs(m[5], m[6]) : null, off });
  }
  if (!clauses.length) return { list: [], why: /\bTB[DC]\b/.test(t) ? "tbd" : "unread" };
  for (const c of clauses) if (c.hold === null) { const last = [...clauses].reverse().find((x) => x.group === c.group && x.hold !== null); c.hold = last ? last.hold : 0; }
  const within = withinOf(r), spread = t.match(/à plus de\s+(\d+(?:[,.]\d+)?)\s*mV du plus bas/i);
  for (const c of clauses) {
    const sig = signalFor(c.unit, c.up), when = [{ signal: sig, op: c.up ? ">" : "<", value: c.value }];
    if (spread && sig === "vblock_max") when.push({ signal: "vspread", op: ">", value: num(spread[1]) / 1000 });
    const then = c.off ? { signal: target.signal, is: 0 } : target;
    list.push({ kind: "reaction", if: when, mode: c.when, hold: c.hold, then, within: within !== null ? Math.max(within, c.hold) : null });
  }
  return { list, why: "" };
}

/* ---------- what the project keeps : a reading confirmed by a person ---------- */
/** The oracles of a requirement : those a person confirmed (R.oracles), else the tool's proposal. → { list, why, sure } */
export function oraclesFor(R, r) {
  const k = keyOf(r), kept = R && R.oracles && R.oracles[k];
  if (kept && kept.statement === (r.statement || "")) return { list: kept.list, why: kept.list.length ? "" : "person", sure: true };
  return { ...proposeOracles(r), sure: false };
}
/** Confirms (or rewrites) the reading of a requirement, in the step that changes the project. list : the oracles ([] : not judged on the bench). */
export function keepOracles(R, r, list) { R.oracles = R.oracles || {}; R.oracles[keyOf(r)] = { list: JSON.parse(JSON.stringify(list)), statement: r.statement || "" }; return R.oracles[keyOf(r)]; }

/* ---------- in words ---------- */
const fr = (v) => String(+(+v).toFixed(3)).replace(".", ",");
const dur = (ms) => (ms >= 1000 ? `${fr(ms / 1000)} s` : `${fr(ms)} ms`);
const say = (c) => { const S = SIGNALS[c.signal]; return `${S.short} ${c.op} ${S.unit === "V" && c.value < 1 ? `${fr(c.value * 1000)} mV` : `${fr(c.value)} ${S.unit}`}`.trim(); };
const sayThen = (t) => (t.signal === "contactor" ? (t.is ? "contactor fermé" : "contactor ouvert") : t.signal === "state" ? `état ${STATES[t.atLeast]} ou plus` : t.signal === "pump" ? (t.is ? "pompe en marche" : "pompe arrêtée") : t.signal === "bleed" ? "équilibrage en marche" : t.signal);
/* a point of the envelope in words : a current says its way (charge, discharge) */
const envWord = (o, v) => (o.signal === "current" ? `${fr(Math.abs(v))} A en ${v < 0 ? "charge" : "décharge"}` : `${SIGNALS[o.signal].short} = ${fr(v)} ${SIGNALS[o.signal].unit}`);
/** An oracle in one line : « V bloc max > 4,25 V · 100 ms ⇒ contactor ouvert ≤ 150 ms ». */
export function oracleText(o) {
  const S = SIGNALS[o.signal] || {};
  if (o.kind === "bound") return `${S.short} ${o.min !== undefined ? `≥ ${fr(o.min)}` : ""}${o.min !== undefined && o.max !== undefined ? " et " : ""}${o.max !== undefined ? `≤ ${fr(o.max)}` : ""} ${S.unit}, contactor fermé`;
  if (o.kind === "envelope") return `Les missions vont jusqu'à ${envWord(o, o.max !== undefined ? o.max : o.min)}`;
  return `${o.if.map(say).join(" et ")}${o.mode ? ` en ${o.mode === "charge" ? "charge" : "décharge"}` : ""}${o.hold ? ` · ${dur(o.hold)}` : ""} ⇒ ${sayThen(o.then)}${o.within ? ` ≤ ${dur(o.within)}` : ""}`;
}

/* ---------- the verdict, read on a record of the bench ---------- */
/** The record as values of the signals. plant : the plant of the software (its contactor and pump), recRefs : the outputs recorded. */
export function seriesOf(rec, recRefs = [], plant = {}) {
  const ix = { contactor: recRefs.indexOf(plant && plant.contactor), pump: recRefs.indexOf(plant && plant.pump) };
  return (rec || []).map((x) => { const s = { t: x.t }; for (const [k, S] of Object.entries(SIGNALS)) s[k] = S.of(x, ix); return s; });
}
const holds = (c, s) => (c.op === ">" ? s[c.signal] > c.value : s[c.signal] < c.value);
/* the way the module goes on each line : its current ; with the contactor open, the way it was going when it was cut off — a software that
   opens the very second a limit is reached has answered, it has not left the way the requirement names */
const waysOf = (S) => { const w = new Array(S.length); for (let i = 0; i < S.length; i++) { const c = S[i].current; w[i] = c > 0.5 ? 1 : c < -0.5 ? -1 : S[i].contactor === 0 && i ? w[i - 1] : 0; } return w; };
const modeOk = (o, way) => !o.mode || (o.mode === "charge" ? way < 0 : way > 0);
const met = (t, s) => (t.is !== undefined ? s[t.signal] === t.is : s[t.signal] >= t.atLeast);
const VERDICT = { pass: "tenue", fail: "échoue", none: "non exercée", covered: "couverte", uncovered: "non couverte" };
/** Judges one oracle. S : seriesOf. → { verdict (pass | fail | none | covered | uncovered), text, at, delay, margin } */
export function judge(o, S) {
  if (!S.length) return { verdict: "none", text: "Aucun enregistrement." };
  if (o.kind === "envelope") {
    const ext = o.max !== undefined ? Math.max(...S.map((s) => s[o.signal])) : Math.min(...S.map((s) => s[o.signal])), want = o.max !== undefined ? o.max : o.min, ok = o.max !== undefined ? ext >= 0.98 * want : ext <= 0.98 * want;
    return { verdict: ok ? "covered" : "uncovered", text: ok ? `La mission atteint ${envWord(o, ext)}.` : `La mission va jusqu'à ${envWord(o, ext)}, l'exigence demande ${envWord(o, want)} : l'enveloppe n'est pas couverte.`, extreme: ext };
  }
  if (o.kind === "bound") {
    const out = (s) => (o.min !== undefined && s[o.signal] < o.min) || (o.max !== undefined && s[o.signal] > o.max), closed = (s) => s.contactor === 1;
    let run = 0, worst = 0, at = null, margin = Infinity;
    for (const s of S) { if (closed(s)) margin = Math.min(margin, ...[o.min !== undefined ? s[o.signal] - o.min : Infinity, o.max !== undefined ? o.max - s[o.signal] : Infinity]);
      if (out(s) && closed(s)) { run++; if (run > worst) { worst = run; at = s.t; } } else run = 0; }
    if (worst > 1) return { verdict: "fail", text: `Hors borne, contactor fermé, pendant ${worst} s (dès ${Math.round(at / 1000) - worst + 1} s).`, at, margin };
    return { verdict: "pass", text: Number.isFinite(margin) ? `Tenue : au plus près, ${fr(margin)} ${SIGNALS[o.signal].unit} de la borne${worst ? " (une ligne hors borne : moins d'une seconde, non jugée)" : ""}.` : "Tenue.", margin };
  }
  /* a reaction : each time the condition starts and holds long enough, the answer must come in time */
  const way = waysOf(S), cond = (s, i) => modeOk(o, way[i]) && o.if.every((c) => holds(c, s)), need = Math.max(1, Math.ceil((o.hold || 0) / RESOLUTION)), late = (o.within !== null && o.within !== undefined ? o.within : (o.hold || 0)) + RESOLUTION;
  const trials = [];
  for (let i = 0; i < S.length; i++) {
    if (!cond(S[i], i) || (i && cond(S[i - 1], i - 1))) continue;
    let j = i; while (j + 1 < S.length && cond(S[j + 1], j + 1) && j - i + 1 < need) j++;
    if (j - i + 1 < need) continue;      // too short to count
    const t0 = S[i].t, hit = S.slice(i).find((s) => s.t <= t0 + late && met(o.then, s));
    trials.push({ t0, ok: !!hit, delay: hit ? hit.t - t0 : null });
  }
  if (!trials.length) return { verdict: "none", text: "La condition n'arrive jamais dans cette mission." };
  const bad = trials.find((x) => !x.ok), first = bad || trials[0];
  const said = o.within !== null && o.within !== undefined ? `en ${dur(o.within)} (plus une ligne du banc)` : "dans la seconde (l'exigence ne dit pas de délai : une ligne du banc)";
  return bad ? { verdict: "fail", text: `À ${Math.round(bad.t0 / 1000)} s, la condition tient, mais « ${sayThen(o.then)} » ne vient pas ${said}.`, at: bad.t0 }
    : { verdict: "pass", text: `${trials.length} fois ; réponse en ${first.delay ? dur(first.delay) : "moins d'une seconde"} (le banc relève une ligne par seconde).`, at: first.t0, delay: first.delay };
}
/** The verdict of every requirement the bench can judge, on one record. → [{ key, req, oracle, n, sure, verdict, text, at }] */
export function verdicts(R, S) {
  const out = [];
  for (const r of (R && R.rows) || []) { if (isNeed(r) || maturityOf(r) === "out") continue; const O = oraclesFor(R, r);
    O.list.forEach((o, n) => out.push({ key: keyOf(r), req: r, oracle: o, n, sure: O.sure, ...judge(o, S) })); }
  return out;
}
export const verdictWord = (v) => VERDICT[v] || v;
/** What a chart panel draws : one dashed line per limit, tagged by the key of its requirement. panel : "v" | "i" | "t". → [{ key, value, when, sure, verdict, kind }] */
export function chartLines(R, results, panel) {
  const lines = [], put = (x, signal, value, o) => { const S = SIGNALS[signal]; if (!S || S.panel !== panel) return; lines.push({ key: x.key, value, when: o.mode || "", sure: x.sure, verdict: x.verdict, kind: o.kind }); };
  for (const x of results) { const o = x.oracle;
    if (o.kind === "reaction") for (const c of o.if) { put(x, c.signal, c.value, o); if (c.signal === "current_abs") put(x, c.signal, -c.value, o); }
    else { if (o.min !== undefined) put(x, o.signal, o.min, o); if (o.max !== undefined) put(x, o.signal, o.max, o); } }
  return lines;
}
/** For the guide : the requirements proven by a test that the machine reads, to confirm ; those it cannot read, to write. disc : the discipline seen. */
export function oracleGuide(R, reqs) {
  const unsure = [], unread = [];
  for (const r of reqs) { const O = oraclesFor(R, r); if (O.list.length && !O.sure) unsure.push(keyOf(r)); else if (!O.list.length && (O.why === "unread" || O.why === "tbd")) unread.push(keyOf(r)); }
  const out = [];
  if (unsure.length) out.push({ level: "warn", text: `${unsure.length} exigence${unsure.length > 1 ? "s" : ""} lue${unsure.length > 1 ? "s" : ""} par la machine : la lecture (signal, borne, durée, réponse) est proposée par l'outil — confirmez-la.`, keys: unsure });
  if (unread.length) out.push({ level: "tip", text: `${unread.length} exigence${unread.length > 1 ? "s" : ""} prouvée${unread.length > 1 ? "s" : ""} par essai que la machine ne sait pas lire (signal non relevé par le banc, ou valeur TBD) : à écrire, ou à jouer hors du banc.`, keys: unread });
  return out;
}
