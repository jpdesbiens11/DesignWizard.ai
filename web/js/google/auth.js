/* DynamiteOrbit.ai — Google sign-in (Google Identity Services, token flow), same pattern as SuperChef.ai.
   The access token lives in memory only — never in localStorage, never in a cookie. It lasts an hour and is renewed
   without a prompt a few minutes before it ends. The Google script is loaded on the first sign-in only, so the
   application stays fully offline until the user asks for Google. */

const MARGIN_MS = 5 * 60 * 1000;
const GIS_URL = "https://accounts.google.com/gsi/client";

/** Load the Google Identity Services script once (needs the CSP of index.html to allow it). */
export function loadGis(doc = globalThis.document) {
  if (globalThis.google && globalThis.google.accounts && globalThis.google.accounts.oauth2) return Promise.resolve(globalThis.google);
  if (loadGis.pending) return loadGis.pending;
  loadGis.pending = new Promise((resolve, reject) => {
    const s = doc.createElement("script");
    s.src = GIS_URL; s.async = true;
    s.onload = () => (globalThis.google && globalThis.google.accounts ? resolve(globalThis.google) : reject(new Error("google-indisponible")));
    s.onerror = () => { loadGis.pending = null; reject(new Error("google-injoignable")); };
    doc.head.append(s);
  });
  return loadGis.pending;
}

/** French sentence for an error code of this module or of Google. */
export function authMessage(e) {
  const code = String((e && e.message) || e);
  return ({ "google-indisponible": "Le service de connexion Google n'a pas pu se charger.", "google-injoignable": "Google est injoignable : vérifiez la connexion Internet.",
    "non-connecte": "Vous n'êtes pas connecté à Google.", "https-requis": "Le contrôle d'accès demande une page servie en HTTPS (ou en local).", "sans-client": "La connexion Google n'est pas configurée (identifiant client manquant, voir docs/GOOGLE.md).",
    popup_closed: "La fenêtre Google a été fermée avant la fin.", popup_failed_to_open: "Le navigateur a bloqué la fenêtre Google : autorisez les fenêtres pour ce site.",
    access_denied: "Google a refusé l'accès : ce compte n'est pas autorisé pour cette application, ou vous avez refusé les permissions." })[code] || `Connexion Google impossible (${code}).`;
}

export function createAuth({ clientId, scopes, google = () => globalThis.google, now = () => Date.now() }) {
  let token = null, expires = 0, client = null, pending = null, hint = "";
  const g = () => (typeof google === "function" ? google() : google);

  function getClient() {
    if (client) return client;
    if (!clientId) throw new Error("sans-client");
    const G = g();
    if (!G || !G.accounts || !G.accounts.oauth2) throw new Error("google-indisponible");
    client = G.accounts.oauth2.initTokenClient({
      client_id: clientId, scope: scopes,
      callback: (rep) => {
        const p = pending; pending = null;
        if (!p) return;
        if (rep.error) { p.reject(new Error(rep.error)); return; }
        token = rep.access_token; expires = now() + Number(rep.expires_in || 3600) * 1000;
        p.resolve(token);
      },
      error_callback: (err) => { const p = pending; pending = null; if (p) p.reject(new Error((err && err.type) || "erreur-google")); },
    });
    return client;
  }
  // login_hint: Google skips the account chooser; with consent already given the window closes by itself.
  function request(prompt, loginHint) {
    if (pending) return pending.promise;
    let resolve, reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    pending = { promise, resolve, reject };
    try { getClient().requestAccessToken(loginHint ? { prompt, login_hint: loginHint } : { prompt }); }
    catch (e) { pending = null; reject(e); }
    return promise;
  }
  return {
    /** First call: from a click (Google requires a user gesture). */
    signIn: (loginHint) => { hint = loginHint || ""; return request("", hint); },
    chooseAccount: () => { hint = ""; return request("select_account"); },
    /** A valid token, renewed when needed. */
    async token() {
      if (token && now() < expires - MARGIN_MS) return token;
      if (!token) throw new Error("non-connecte");
      return request("", hint);
    },
    signedIn: () => Boolean(token) && now() < expires,
    signOut() { const G = g(); if (token && G && G.accounts && G.accounts.oauth2 && G.accounts.oauth2.revoke) G.accounts.oauth2.revoke(token, () => {}); token = null; expires = 0; },
  };
}
