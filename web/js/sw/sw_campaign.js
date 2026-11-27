/* DynamiteOrbit.ai — Logiciel : THE CAMPAIGN — every mission profile played on the virtual bench, each requirement judged on each (JP, 27
   novembre 2026 : « des tests logiciels embarqués HIL virtuels, qui ne coûtent rien, pour valider les profils de missions et les différences specs,
   limites, corner cases, performances et safety, avec une panoplie de profils… itérer rapidement »).
   A mission is played as the bench plays it (sw/sw_live.js : the software, one period at a time, against the module of sw/sw_pack.js), without a
   screen and without stopping on a fault — the profile's own acknowledgements carry on. The record of the bench (one line a second) is judged
   by the oracles of the requirements (core/req_oracle.js) ; the campaign gathers the verdicts : one row per limit of a requirement, one column per
   mission, and the overall verdict — fail if one mission fails it. The FINDINGS file says it all, as CSV and as Markdown, with the mark of the
   platform. A requirement the machine cannot read is said, never judged. Virtual : the module is TYPICAL, and every file says so. Pure. */

import { liveStart, liveStep, liveSet, liveDrive } from "./sw_live.js";
import { expandProfile, profilesOf } from "./sw_story.js";
import { seriesOf, verdicts, oracleText, oraclesFor, verdictWord } from "../core/req_oracle.js";
import { forDiscipline, keyOf } from "../core/reqs.js";
import { stampText } from "../core/brand.js";
import { campaignMissions, missionSig } from "./sw_req_missions.js";

/** One mission, played in slices of `slice` steps : yields { done, total } (ms of the mission) between slices ; returns the live run (its record :
    L.rec, L.recRefs). A screen pumps it and stays alive ; a test drains it. */
export function* missionRun(d, profile, slice = 20000) {
  const L = liveStart(d, 0), dt = L.m.dt, E = expandProfile((profile && profile.events) || []), end = (E.length ? E[E.length - 1].t : 0) + 1000;
  let now = 0, i = 0, since = 0;
  while (now <= end) {
    while (i < E.length && E[i].t <= now) { const e = E[i++]; if (e.plant) liveDrive(L, e.plant); for (const [id, v] of Object.entries(e.set || {})) liveSet(L, id, v); }
    const next = i < E.length ? E[i].t : end + dt, n = Math.max(1, Math.min(slice, Math.round((next - now) / dt))); liveStep(L, n); now += n * dt; since += n;
    if (since >= slice) { since = 0; yield { done: now, total: end }; }
  }
  return L;
}
const drain = (g) => { let r = g.next(); while (!r.done) r = g.next(); return r.value; };
/** One mission, played to its end. → the live run */
export const playMission = (d, profile) => drain(missionRun(d, profile, Infinity));
const RANK = { fail: 5, uncovered: 4, pass: 3, covered: 3, none: 1 };
/* A RULE OF THE CAMPAIGN, not a requirement of the list (JP's nominal missions : « rien ne doit réagir à tort ») : in a nominal mission, once the
   contactor has closed, it stays closed and the module never goes to Emergency or Shutdown — a software that trips inside every limit loses the
   product. Derated is allowed : the end of a charge may ask it. Said as a rule of the tool, in the findings and in the files. */
export const NOMINAL_RULE = { key: "NOMINAL", text: "Missions nominales : le contactor reste fermé, aucun état Emergency ni Shutdown", statement: "Règle de la campagne (pas une exigence de la liste) : dans une mission nominale, une fois fermé, le contactor reste fermé et le module n'entre jamais en Emergency ni en Shutdown." };
/** The nominal rule on one record. → pass | fail */
export function nominalVerdict(S) { let on = false; for (const s of S) { if (s.contactor === 1) on = true; else if (on) return "fail"; if (on && s.state >= 2) return "fail"; } return on ? "pass" : "fail"; }
/** Every mission of the software, each requirement judged on each — in slices : yields { mission, missions, name, done, total }.
    The missions : those written from the requirements (sw/sw_req_missions.js), unless the caller gives its own.
    → { when, profiles: [{ id, name, origin, keys, seconds }], rows: [{ key, n, req, oracle, text, sure, by: { [profile]: verdict }, overall }], unread: [{ key, why }], counts, design } */
export function* campaignRun(project, d, { profiles: all = campaignMissions(project, d), when = new Date().toISOString(), slice = 20000 } = {}) {
  const R = project && project.reqs, rows = new Map(), done = [], profiles = all.filter((p) => !p.off);      // a mission set Off is kept, never played
  for (let i = 0; i < profiles.length; i++) { const p = profiles[i], g = missionRun(d, p, slice); let r = g.next();
    while (!r.done) { yield { mission: i, missions: profiles.length, name: p.name, ...r.value }; r = g.next(); }
    const L = r.value; done.push({ id: p.id, name: p.name, origin: p.origin || "project", cls: p.cls || "functional", level: p.level || 3, keys: p.keys || [], seconds: Math.round(((L.rec || []).at(-1) || { t: 0 }).t / 1000) });
    const S = seriesOf(L.rec, L.recRefs, d.plant);
    if (p.origin === "nominal") { const k = `${NOMINAL_RULE.key}#0`; if (!rows.has(k)) rows.set(k, { key: NOMINAL_RULE.key, n: 0, req: { statement: NOMINAL_RULE.statement, title: NOMINAL_RULE.text }, oracle: { kind: "nominal" }, text: NOMINAL_RULE.text, sure: true, rule: true, by: {} }); rows.get(k).by[p.id] = nominalVerdict(S); }
    for (const v of R ? verdicts(R, S) : []) { const k = `${v.key}#${v.n}`;
      if (!rows.has(k)) rows.set(k, { key: v.key, n: v.n, req: v.req, oracle: v.oracle, text: oracleText(v.oracle), sure: v.sure, by: {} });
      rows.get(k).by[p.id] = v.oracle.kind === "envelope" && v.verdict === "uncovered" ? "none" : v.verdict; } }      // an envelope : covered by one mission, not missed by the others
  const out = [...rows.values()].sort((a, b) => Number(!!a.rule) - Number(!!b.rule)).map((r) => ({ ...r, overall: r.oracle.kind === "envelope" ? (Object.values(r.by).includes("covered") ? "covered" : "uncovered") : Object.values(r.by).reduce((a, b) => (RANK[b] > RANK[a] ? b : a), "none") }));
  const mine = R ? forDiscipline(R, "sw").reqs : [], unread = mine.filter((r) => !oraclesFor(R, r).list.length).map((r) => ({ key: keyOf(r), why: oraclesFor(R, r).why }));
  const counts = { fail: 0, pass: 0, none: 0, uncovered: 0, covered: 0 }; for (const r of out) counts[r.overall] = (counts[r.overall] || 0) + 1;
  return { when, profiles: done, rows: out, unread, counts, design: d.id, sig: missionSig(profiles) };
}
/** The campaign, played to its end. */
export const runCampaign = (project, d, o = {}) => drain(campaignRun(project, d, { ...o, slice: Infinity }));
const WHY = { offbench: "prouvée autrement que par essai", tbd: "une valeur TBD", unread: "aucune grandeur que le banc relève", need: "un besoin, pas une exigence", person: "« ne pas juger au banc », dit par une personne" };
const csvCell = (x) => { const s = String(x ?? ""); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
/** The findings as CSV : one line per limit of a requirement, one column per mission, the overall verdict. */
export function findingsCsv(C) {
  const head = ["key", "external_id", "limit", "read by", ...C.profiles.map((p) => p.name), "overall"];
  const lines = C.rows.map((r) => [r.key, r.req.external_id || "", r.text, r.sure ? "confirmed" : "proposed", ...C.profiles.map((p) => r.by[p.id] || "none"), r.overall]);
  for (const u of C.unread) lines.push([u.key, "", `not judged : ${WHY[u.why] || u.why}`, "", ...C.profiles.map(() => ""), "not read"]);
  return stampText("constat.csv", `${[head, ...lines].map((l) => l.map(csvCell).join(",")).join("\r\n")}\r\n`);
}
/** The findings as Markdown : the summary, then each requirement that fails, then the whole table. */
export function findingsMd(C, title = "Constat de la campagne") {
  const P = C.profiles, n = (k) => C.counts[k] || 0, W = (v) => verdictWord(v);
  const out = [`# ${title}`, "", `${C.when} · ${P.length} mission${P.length > 1 ? "s" : ""} (${P.map((p) => `${p.name}, ${p.seconds} s`).join(" ; ")}) · banc VIRTUEL : module simulé, valeurs typiques.`, "",
    `- échouées : ${n("fail")}`, `- tenues : ${n("pass")}`, `- enveloppe non couverte : ${n("uncovered")}`, `- non exercées : ${n("none")}`, `- non lues par la machine : ${C.unread.length}`, ""];
  const fails = C.rows.filter((r) => r.overall === "fail");
  if (fails.length) { out.push("## Ce qui échoue", ""); for (const r of fails) out.push(`- **${r.key}** — ${r.text} — échoue sur ${P.filter((p) => r.by[p.id] === "fail").map((p) => p.name).join(", ")}`); out.push(""); }
  out.push("## Toutes les limites", "", `| Exigence | Limite | ${P.map((p) => p.name).join(" | ")} | Bilan |`, `|---|---|${P.map(() => "---|").join("")}---|`);
  for (const r of C.rows) out.push(`| ${r.key} | ${r.text}${r.sure ? "" : " (à confirmer)"} | ${P.map((p) => W(r.by[p.id] || "none")).join(" | ")} | ${W(r.overall)} |`);
  if (C.unread.length) { out.push("", "## Non jugées", ""); for (const u of C.unread) out.push(`- ${u.key} : ${WHY[u.why] || u.why}`); }
  return stampText("constat.md", `${out.join("\n")}\n`);
}
