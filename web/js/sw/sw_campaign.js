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
/** Every mission of the software, each requirement judged on each — in slices : yields { mission, missions, name, done, total }.
    → { when, profiles: [{ id, name, seconds }], rows: [{ key, n, req, oracle, text, sure, by: { [profile]: verdict }, overall }], unread: [{ key, why }], counts, design } */
export function* campaignRun(project, d, { profiles = profilesOf(d), when = new Date().toISOString(), slice = 20000 } = {}) {
  const R = project && project.reqs, rows = new Map(), done = [];
  for (let i = 0; i < profiles.length; i++) { const p = profiles[i], g = missionRun(d, p, slice); let r = g.next();
    while (!r.done) { yield { mission: i, missions: profiles.length, name: p.name, ...r.value }; r = g.next(); }
    const L = r.value; done.push({ id: p.id, name: p.name, seconds: Math.round(((L.rec || []).at(-1) || { t: 0 }).t / 1000) });
    for (const v of R ? verdicts(R, seriesOf(L.rec, L.recRefs, d.plant)) : []) { const k = `${v.key}#${v.n}`;
      if (!rows.has(k)) rows.set(k, { key: v.key, n: v.n, req: v.req, oracle: v.oracle, text: oracleText(v.oracle), sure: v.sure, by: {} });
      rows.get(k).by[p.id] = v.verdict; } }
  const out = [...rows.values()].map((r) => ({ ...r, overall: Object.values(r.by).reduce((a, b) => (RANK[b] > RANK[a] ? b : a), "none") }));
  const mine = R ? forDiscipline(R, "sw").reqs : [], unread = mine.filter((r) => !oraclesFor(R, r).list.length).map((r) => ({ key: keyOf(r), why: oraclesFor(R, r).why }));
  const counts = { fail: 0, pass: 0, none: 0, uncovered: 0, covered: 0 }; for (const r of out) counts[r.overall] = (counts[r.overall] || 0) + 1;
  return { when, profiles: done, rows: out, unread, counts, design: d.id };
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
