/* DesignWizard.ai — the page says when a newer version is published. The application is one page, kept open for hours : what
   is published meanwhile does not reach it until it is loaded again — the designer looked for a button his page did not have yet.
   A small file, version.json, says what is published. The page reads it now and then (and each time one comes back to it) ; when
   it is newer than what runs, a button of the top bar offers the update : what is not saved is saved, the files the page had
   loaded are fetched anew — so that the page does not come back half old, half new — and the page loads again.
   The first half is pure ; installUpdateCheck() and updateButton() touch the page. */

/** « 0.86.1 » → [0, 86, 1]. */
export const parseVersion = (v) => String(v == null ? "" : v).trim().split(".").map((x) => parseInt(x, 10) || 0);
/** Is version `a` newer than `b` ? */
export function newer(a, b) {
  const x = parseVersion(a), y = parseVersion(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d > 0; }
  return false;
}
/** The version a version.json gives, or null when the file is not one. */
export const versionOf = (doc) => (doc && typeof doc.version === "string" && /^\d+(\.\d+){1,3}$/.test(doc.version.trim()) ? doc.version.trim() : null);
/** Is it time to look again ? now, last : ms ; never more often than every two minutes. */
export const dueCheck = (now, last, every = 120000) => !last || now - last >= every;
/** The files of this site the page had loaded, to fetch anew : scripts, styles, pictures drawn as text — not the heavy kernel.
    names : the addresses the browser remembers ; origin : this site. → addresses without their query, each once */
export function ownFiles(names, origin) {
  const out = new Set();
  for (const n of names || []) { const u = String(n).split("#")[0].split("?")[0]; if (u.startsWith(origin + "/") && /\.(js|mjs|css|json|svg|html)$/.test(u)) out.add(u); }
  return [...out];
}

/* ---------- the page ---------- */
let state = { running: null, found: null, busy: false }, save = null, last = 0, looking = false, installed = false;
const listeners = new Set(), tell = () => { for (const f of listeners) f(state); };

async function look() {
  if (state.found || looking || document.hidden || !dueCheck(Date.now(), last)) return;
  last = Date.now(); looking = true;
  try { const r = await fetch(`version.json?t=${last}`, { cache: "no-store" }); const v = r.ok ? versionOf(await r.json()) : null; if (v && newer(v, state.running)) { state = { ...state, found: v }; tell(); } }
  catch (e) { /* offline, or a server without the file : nothing to say */ }
  finally { looking = false; }
}
/** Saves, fetches anew what the page had loaded, loads the page again. */
export async function applyUpdate() {
  if (state.busy) return; state = { ...state, busy: true }; tell();
  try { if (save) await save(); } catch (e) { /* what could not be saved is said by the store */ }
  const files = [...ownFiles(performance.getEntriesByType("resource").map((e) => e.name), window.location.origin), window.location.href.split("#")[0]];
  await Promise.race([Promise.allSettled(files.map((u) => fetch(u, { cache: "reload" }))), new Promise((done) => setTimeout(done, 12000))]);
  window.location.reload();
}

/** Starts watching. o : { running (the version of this page), save() → Promise (what is not saved yet) }. Called once, at start. */
export function installUpdateCheck(o) {
  if (installed || typeof document === "undefined") return; installed = true;
  state = { running: o.running, found: null, busy: false }; save = o.save || null;
  setTimeout(look, 12000); setInterval(look, 10 * 60 * 1000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) look(); }); window.addEventListener("focus", look);
  tell();
}
/** The button of the top bar : nothing while the page is up to date. → element */
export function updateButton() {
  const b = document.createElement("button"); b.type = "button"; b.className = "btn btn-small btn-primary update-btn"; b.id = "update-btn"; b.hidden = true;
  const paint = (s) => { b.hidden = !s.found; if (!s.found) return; b.disabled = s.busy; b.textContent = s.busy ? "Mise à jour…" : `Mettre à jour · v${s.found}`;
    b.setAttribute("data-tip", `La version ${s.found} est publiée ; cette page est la ${s.running}. Un clic : le projet est enregistré, puis la page se recharge avec la nouvelle version.`); };
  b.addEventListener("click", applyUpdate);
  listeners.clear(); listeners.add(paint); paint(state);      // one top bar : the one drawn last
  return b;
}
