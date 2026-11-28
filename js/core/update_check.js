/* DynamiteOrbit.ai — the page says when a newer version is published. The application is one page, kept open for hours : what
   is published meanwhile does not reach it until it is loaded again — the designer looked for a button his page did not have yet.
   A small file, version.json, says what is published. The page reads it now and then (and each time one comes back to it) ; when
   it is newer than what runs, a button of the top bar offers the update : what is not saved is saved, the files the page had
   loaded are fetched anew — so that the page does not come back half old, half new — and the page loads again.
   The version of the page is always in sight beside the logo (versionChip) : green when it is the one published, orange when a newer one is.
   The first half is pure ; installUpdateCheck(), versionChip() and updateButton() touch the page. */

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
let state = { running: null, found: null, busy: false, checked: 0, online: null }, save = null, last = 0, looking = false, installed = false;
const listeners = new Set(); let chipPaint = null; const tell = () => { for (const f of listeners) f(state); if (chipPaint) chipPaint(state); };      // one chip : the one drawn last

async function look(force = false) {
  if (looking || (!force && (state.found || document.hidden || !dueCheck(Date.now(), last)))) return;
  last = Date.now(); looking = true; tell();
  try { const r = await fetch(`version.json?t=${last}`, { cache: "no-store" }); const v = r.ok ? versionOf(await r.json()) : null; state = { ...state, checked: Date.now(), online: v, found: v && newer(v, state.running) ? v : null }; }
  catch (e) { state = { ...state, checked: Date.now(), online: null }; }      // offline, or a server without the file : said on the chip
  finally { looking = false; tell(); }
}
/** Looks now, whatever the time since the last look (a click on the version). */
export const checkNow = () => look(true);
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
  state = { running: o.running, found: null, busy: false, checked: 0, online: null }; save = o.save || null;
  setTimeout(look, 3000); setInterval(look, 2 * 60 * 1000);      // soon after the page opens, then every two minutes while it is seen
  document.addEventListener("visibilitychange", () => { if (!document.hidden) look(); }); window.addEventListener("focus", look);
  tell();
}
/* the time of the last look, for the tip */
const hhmm = (t) => new Date(t).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" });
/** What the version chip says. Pure. s : the state. → { cls, text, tip, act } */
export function chipOf(s, checking = false) {
  if (s.busy) return { cls: "busy", text: "Mise à jour…", tip: "Le projet est enregistré, puis la page se recharge avec la nouvelle version.", act: null };
  if (s.found) return { cls: "found", text: `v${s.running} → v${s.found}`, tip: `La version ${s.found} est publiée ; cette page est la ${s.running}. Un clic : le projet est enregistré, puis la page se recharge avec la nouvelle version.`, act: "update" };
  if (checking && !s.checked) return { cls: "checking", text: `v${s.running}`, tip: "Vérification de la version publiée…", act: "check" };
  if (!s.checked) return { cls: "unknown", text: `v${s.running}`, tip: "Version de cette page. Un clic : vérifier s'il y a plus récent.", act: "check" };
  if (!s.online) return { cls: "unknown", text: `v${s.running}`, tip: `Version de cette page. La version publiée n'a pas pu être lue (hors ligne ?) — essayé à ${hhmm(s.checked)}. Un clic : réessayer.`, act: "check" };
  return { cls: "ok", text: `v${s.running}`, tip: `À jour : la version publiée est la ${s.online}, vérifiée à ${hhmm(s.checked)} (toutes les deux minutes). Un clic : vérifier maintenant.`, act: "check" };
}
/** The version of the page, always in sight beside the logo (JP, 26 novembre 2026 : « pourquoi le bouton de mise à jour et le numéro de la révision
    en cours ne sont plus visibles… je ne sais jamais si tu as fait ou pas la maj ») : green when the page is the one published, orange — a button —
    when a newer one is. A click checks now, or updates. → element */
export function versionChip() {
  const b = document.createElement("button"); b.type = "button"; b.id = "version-chip"; b.className = "version-chip";
  const dot = document.createElement("i"), t = document.createElement("span"); b.append(dot, t);
  const paint = (s) => { const c = chipOf(s, looking); b.className = `version-chip ${c.cls}`; b.dataset.versionState = c.cls; t.textContent = c.text; b.setAttribute("data-tip", c.tip); b.setAttribute("aria-label", c.tip); b.disabled = !!s.busy; b.dataset.act = c.act || ""; };
  b.addEventListener("click", () => { if (b.dataset.act === "update") applyUpdate(); else checkNow(); });
  chipPaint = paint; paint(state);
  return b;
}
/** Says once, after a reload, that the page now runs a newer version than the one this browser ran before. running ; say(text) ; key in the browser. */
export function sayUpdated(running, say, key = "dw.version.ran") {
  let before = null; try { before = localStorage.getItem(key); localStorage.setItem(key, running); } catch (e) { return; }
  if (before && newer(running, before)) say(`Mise à jour faite : la page est passée de la v${before} à la v${running}. Les nouveautés sont marquées « Nouveau » (l'étoile, en haut).`);
}
/** The button of the top bar : nothing while the page is up to date. → element */
export function updateButton() {
  const b = document.createElement("button"); b.type = "button"; b.className = "btn btn-small btn-primary update-btn"; b.id = "update-btn"; b.hidden = true;
  const paint = (s) => { b.hidden = !s.found; if (!s.found) return; b.disabled = s.busy; b.textContent = s.busy ? "Mise à jour…" : `Mettre à jour · v${s.found}`;
    b.setAttribute("data-tip", `La version ${s.found} est publiée ; cette page est la ${s.running}. Un clic : le projet est enregistré, puis la page se recharge avec la nouvelle version.`); };
  b.addEventListener("click", applyUpdate);
  listeners.add(paint); paint(state);
  return b;
}
