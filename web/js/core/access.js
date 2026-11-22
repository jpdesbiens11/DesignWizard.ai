/* DesignOrbit.ai — who may use the hosted demo, and who administers it.
   The list of approved accounts is a public file (web/acces.json) that holds NO e-mail address: each account is a
   slow salted hash (PBKDF2-SHA-256) of its lower-cased address, so the file can live in a public repository.
   - Local use (python designwizard.py, localhost): no gate, no account needed.
   - Hosted demo: Google sign-in, then the hash of the signed-in address must be in the list ("approved" or "admins").
   This gate is an access policy for the hosted page, not a secret: the code is open (MIT) and runs locally for
   anyone. Real enforcement of who can sign in is done by Google when the OAuth consent screen is in « Testing »
   mode with its list of test users (see docs/GOOGLE.md). */

import { CONFIG } from "../config.js";
import { loadGis, createAuth } from "../google/auth.js";
import { createDrive } from "../google/drive.js";
import { createDriveFs } from "../google/drive_fs.js";

export const normalizeEmail = (e) => String(e || "").trim().toLowerCase();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

/** Slow salted hash of an e-mail address (hex, 64 characters). */
export async function accessHash(email, salt, iterations = 210000, subtle = globalThis.crypto && globalThis.crypto.subtle) {
  if (!subtle) throw new Error("https-requis");                 // Web Crypto only exists on secure pages (https or localhost)
  const enc = new TextEncoder(), key = await subtle.importKey("raw", enc.encode(normalizeEmail(email)), "PBKDF2", false, ["deriveBits"]);
  return hex(await subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(`designwizard.ai/${salt}`), iterations }, key, 256));
}
export const isHash = (s) => /^[0-9a-f]{64}$/.test(String(s || "").trim().toLowerCase());
export const shortHash = (h) => String(h || "").slice(0, 12).replace(/(.{4})(?=.)/g, "$1 ");

/** Is the page served from somewhere else than the user's own machine? */
export function isHosted(loc = globalThis.location) {
  if (!loc) return false;
  if (/[?&]porte(=|&|$)/.test(loc.search || "")) return true;   // « ?porte » previews the door on a local machine (it can only close, never open)
  if (loc.protocol === "file:") return false;
  return !(["localhost", "127.0.0.1", "[::1]", "::1", ""].includes(loc.hostname) || /\.localhost$/.test(loc.hostname));
}
const EMPTY = { v: 1, mode: "approved", salt: "", iterations: 210000, admins: [], approved: [] };
export async function loadAccess(fetch = globalThis.fetch.bind(globalThis), url = CONFIG.accessFile) {
  try {
    const rep = await fetch(url, { cache: "no-store" });
    if (!rep.ok) return { ...EMPTY, missing: true };
    const j = await rep.json();
    return { ...EMPTY, ...j, admins: (j.admins || []).filter(isHash), approved: (j.approved || []).filter(isHash) };
  } catch (e) { return { ...EMPTY, missing: true }; }
}
/** Rights of a hash against the list. mode "open" = every signed-in account may use the demo. */
export function decide(list, hash) {
  const admin = !!hash && (list.admins || []).includes(hash);
  return { admin, approved: admin || (!!hash && (list.approved || []).includes(hash)) || (list.mode === "open" && !!hash) };
}
/** A new list with one more approved (or admin) hash; returns the same list when it is already there. */
export function approve(list, hash, admin = false) {
  const h = String(hash).trim().toLowerCase();
  if (!isHash(h)) throw new Error("Empreinte invalide : 64 caractères hexadécimaux attendus.");
  const key = admin ? "admins" : "approved";
  if ((list[key] || []).includes(h)) return list;
  return { ...list, [key]: [...(list[key] || []), h] };
}
export function revoke(list, hash) { return { ...list, approved: (list.approved || []).filter((h) => h !== hash), admins: (list.admins || []).filter((h) => h !== hash) }; }
/** The file to commit as web/acces.json. */
export const accessFileText = (list) => `${JSON.stringify({ v: 1, mode: list.mode || "approved", salt: list.salt, iterations: list.iterations, admins: list.admins || [], approved: list.approved || [] }, null, 2)}\n`;
/* ---------- the list, said in words for who administers it (demande de JP : « voir clairement les comptes ajoutés et leur permission ») ---------- */
const USER_CAN = ["ouvrir la démo en ligne", "créer et enregistrer ses projets dans SON Google Drive", "lire le projet qu'un membre de son équipe lui partage"];
/** What each role may do on the hosted demo — the same words on the screen and in the documentation. */
export const ROLES = { user: { label: "Utilisateur approuvé", short: "Utilisateur", icon: "user", color: "#16a34a", line: "Ouvre la démo et crée ses projets dans son Google Drive.", can: USER_CAN },
  admin: { label: "Administrateur", short: "Administrateur", icon: "admin", color: "#7c3aed", line: "Comme un utilisateur, et gère cette liste d'accès.", can: [...USER_CAN, "approuver, retirer et nommer les comptes de cette liste"] } };
const roleIn = (list, h) => (((list && list.admins) || []).includes(h) ? "admin" : ((list && list.approved) || []).includes(h) ? "user" : null);
/** The accounts of a list, one line each, against the list that is PUBLISHED : `state` says what is online ("online"), what was added here
    and waits to be published ("new"), whose role changed ("changed"), and what was taken away ("removed"). names : { hash: a name the
    administrator gave, kept in his browser only }. → [{ hash, role, was, name, you, state }], administrators first */
export function accessRows(draft, published, myHash = null, names = {}) {
  const all = [...new Set([...((draft && draft.admins) || []), ...((draft && draft.approved) || []), ...((published && published.admins) || []), ...((published && published.approved) || [])])];
  const rows = all.map((h) => { const now = roleIn(draft, h), was = published ? roleIn(published, h) : now; return { hash: h, role: now || was, was, name: names[h] || "", you: !!myHash && h === myHash, state: !now ? "removed" : !was ? "new" : was !== now ? "changed" : "online" }; });
  return rows.sort((a, b) => (a.role === b.role ? 0 : a.role === "admin" ? -1 : 1));
}
/** How many changes wait to be published : the accounts that differ from the published list, and the opening mode. */
export const pendingAccess = (draft, published) => (published ? accessRows(draft, published).filter((r) => r.state !== "online").length + ((draft.mode || "approved") !== (published.mode || "approved") ? 1 : 0) : 0);
/** A new list where a hash has ONE role : administrator or approved user. */
export function setRole(list, hash, admin) { return approve(revoke(list, String(hash).trim().toLowerCase()), hash, admin); }
/** Where the file is edited on GitHub : paste, commit — the demo republishes itself. */
export const editUrl = (repo = CONFIG.repo, file = "web/acces.json") => `https://github.com/${repo}/edit/main/${file}`;
/** The names an administrator gives to the fingerprints (« Testeur », an address) : read from what HIS browser kept — never in the file. */
export function readNames(text) {
  try { const j = JSON.parse(text || "{}"); return j && typeof j === "object" && !Array.isArray(j) ? Object.fromEntries(Object.entries(j).filter(([h, n]) => isHash(h) && typeof n === "string" && n.trim()).map(([h, n]) => [h, n.trim().slice(0, 80)])) : {}; } catch (e) { return {}; }
}
/** A draft kept between two visits : only a list that still differs from the published one is worth keeping. → the draft, or null */
export function readDraft(text, published) {
  try { const j = JSON.parse(text || "null"); if (!j || typeof j !== "object" || j.salt !== published.salt) return null;
    const d = { ...published, mode: j.mode === "open" ? "open" : "approved", admins: (j.admins || []).filter(isHash), approved: (j.approved || []).filter(isHash) }; return pendingAccess(d, published) ? d : null; } catch (e) { return null; }
}
/** GitHub issue that asks for access: carries the fingerprint, never the address. */
export function requestUrl(hash, repo = CONFIG.repo) {
  const body = `Bonjour,\n\nJe souhaite accéder à la démo de DesignOrbit.ai.\n\nEmpreinte d'accès : ${hash}\n\n(L'empreinte est calculée dans mon navigateur à partir de mon adresse Google ; l'adresse elle-même n'est pas publiée. Je vous l'envoie en privé si besoin.)\n`;
  return `https://github.com/${repo}/issues/new?title=${encodeURIComponent("Demande d'accès à la démo")}&labels=${encodeURIComponent("acces")}&body=${encodeURIComponent(body)}`;
}

/* ---------- the signed-in session (one per page) ---------- */
const listeners = new Set();
export const session = { account: null, list: null, auth: null, drive: null, fs: null, configured: !!CONFIG.clientId, hosted: isHosted(),
  on(fn) { listeners.add(fn); return () => listeners.delete(fn); } };
const emit = () => { for (const fn of [...listeners]) { try { fn(session); } catch (e) { console.error(e); } } };
const HINT = "dw.google.hint";
const remembered = () => { try { return localStorage.getItem(HINT) || ""; } catch (e) { return ""; } };

/** Sign in with Google (from a click), read who it is, and work out the rights. Returns the account. */
export async function signIn({ choose = false, deps = {} } = {}) {
  if (!CONFIG.clientId && !deps.auth) throw new Error("sans-client");
  if (!session.auth) {
    if (!deps.auth) await loadGis();
    session.auth = deps.auth || createAuth({ clientId: CONFIG.clientId, scopes: CONFIG.scopes });
    session.drive = deps.drive || createDrive({ token: () => session.auth.token() });
    session.fs = createDriveFs(session.drive, { root: CONFIG.driveRoot });
  }
  await (choose ? session.auth.chooseAccount() : session.auth.signIn(remembered()));
  const me = await session.drive.me();
  if (!session.list) session.list = await loadAccess(deps.fetch);
  const email = normalizeEmail(me.email), hash = session.list.salt ? await accessHash(email, session.list.salt, session.list.iterations) : null;
  session.account = { email, name: me.name || email, picture: null, hash, ...decide(session.list, hash) };
  try { localStorage.setItem(HINT, email); } catch (e) { /* private window */ }
  emit();
  return session.account;
}
export function signOut() {
  if (session.auth) session.auth.signOut();
  if (session.fs) session.fs.forget();
  session.account = null;
  try { localStorage.removeItem(HINT); } catch (e) { /* private window */ }
  emit();
}
