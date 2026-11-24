/* DynamiteOrbit.ai — a long operation says where it stands. What a busy veil shows is worked out here, away from the screen : how far the
   operation is (a count read in its own words, « Construction 3 / 24 », or the bytes of the kernel being downloaded), how long it has been
   running, and — when nothing has moved for a while — a word that says so and what can be done. Pure, tested ; the veil itself is drawn by
   core/busy.js. */

const fr = (v, d = 1) => (Math.round(v * 10 ** d) / 10 ** d).toFixed(d).replace(".", ",").replace(/,0+$/, "");

/** The count an operation writes in its text : « Construction 3 / 24 : X » → { done: 2, total: 24 } (the third is being done). null without one. */
export function countIn(text) {
  const m = /(\d+)\s*\/\s*(\d+)/.exec(String(text || "")); if (!m) return null;
  const n = Number(m[1]), total = Number(m[2]);
  return total > 0 && n >= 1 && n <= total ? { done: n - 1, total } : null;
}
/** How far : a number from 0 to 1, or null when it cannot be said. */
export const ratioOf = (done, total) => (Number.isFinite(done) && total > 0 ? Math.min(1, Math.max(0, done / total)) : null);
/** Bytes received, as one reads them : « 8,4 / 23 Mo ». */
export const bytesText = (done, total) => `${fr(done / 1e6, 1)} / ${fr(total / 1e6, 0)} Mo`;
/** The time an operation has been running : nothing under three seconds, then « 12 s », « 1 min 05 s ». */
export function elapsedText(ms) {
  if (!(ms >= 3000)) return "";
  const s = Math.floor(ms / 1000);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s`;
}
/** After this long without any progress, the veil says so. */
export const STALL_MS = 15000;
/** What to say when nothing has moved for `ms`. kind : "download" (the kernel is on its way), "drive" (Google Drive is read or written) or
    anything else ; canCancel : false for what must not be stopped half-way (a project being written). "" while all is well. */
export function stallHint(ms, kind, canCancel = true) {
  if (!(ms >= STALL_MS)) return "";
  const what = kind === "download" ? "Le téléchargement n'avance plus : vérifiez la connexion — un VPN le ralentit beaucoup." : kind === "drive" ? "Google Drive tarde à répondre : vérifiez la connexion." : "C'est plus long que prévu : l'opération tourne encore.";
  return `${what} ${canCancel ? "Vous pouvez annuler, puis réessayer." : "Laissez-la finir : l'arrêter maintenant laisserait un travail à moitié écrit."}`;
}
/** A long job that can be called off. opts : { text, show(text, o), hide(), stop() } — show draws the veil (o : { done, total, kind, cancel } ;
    cancel is absent for a step that must run to its end), hide takes it away, stop really stops what runs (the kernel, a request in flight).
    job(say, signal) : say(text, done, total, { kind, hold }) moves the veil — hold : true for a step that must not be stopped half-way ;
    signal.off turns true once cancelled, for a job that can stop between two steps.
    Resolves with the job's result ; with undefined once cancelled, whatever the job did afterwards. An error of the job is thrown again,
    unless it is the error of a cancellation. */
export async function cancellable(job, { text = "", show = () => {}, hide = () => {}, stop } = {}) {
  const signal = { off: false };
  const cancel = () => { if (signal.off) return; signal.off = true; hide(); if (stop) stop(); };
  const say = (t, done, total, o = {}) => { if (!signal.off) show(t || text, { done, total, kind: o.kind, cancel: o.hold ? undefined : cancel }); };
  say(text);
  try { const r = await job(say, signal); if (signal.off) return undefined; hide(); return r; }
  catch (e) { if (signal.off) return undefined; hide(); if (e && e.cancelled) return undefined; throw e; }
}
/** What a veil shows. o : { text, done, total (of the operation), stage : { text, done, total } (of the kernel, bytes), kind ("drive" for what
    waits for Google Drive), canCancel, startedAt, changedAt, now }.
    → { title, sub, ratio (0…1 or null : unknown), elapsed, hint, kind } */
export function busyView(o = {}) {
  const st = o.stage && o.stage.text ? o.stage : null, bytes = st && st.total > 0, own = Number.isFinite(o.done) && o.total > 0 ? { done: o.done, total: o.total } : countIn(o.text);
  const kind = st && (!bytes || st.done < st.total) ? "download" : o.kind || "work", now = o.now || 0;      // a kernel announced but not yet counted is a download that has not started coming
  return { title: o.text || (st ? st.text : "En cours…"), kind,
    sub: st ? (bytes ? `${st.text} — ${bytesText(Math.min(st.done, st.total), st.total)}, une seule fois` : st.text) : "",
    ratio: kind === "download" ? (bytes ? ratioOf(st.done, st.total) : null) : own ? ratioOf(own.done, own.total) : null,
    elapsed: elapsedText(now - (o.startedAt || now)), hint: stallHint(now - (o.changedAt || o.startedAt || now), kind, o.canCancel !== false) };
}
