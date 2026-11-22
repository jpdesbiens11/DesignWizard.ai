/* DesignOrbit.ai — the Google file picker, for one purpose : let a person point at a file another member shared with them.
   The application only holds the « drive.file » permission : it sees the files it created for this account, and the files
   the person opens with it — one by one, through this picker. Picking a file once is what lets the application read it
   again later, alone. Nothing wider is ever asked.
   The Google script is loaded on the first use only (the CSP of index.html allows https://apis.google.com for it, and
   the picker's own frame from https://docs.google.com). */

const API_URL = "https://apis.google.com/js/api.js";

/** The Cloud project number, which Google calls the « app ID » : the digits that open an OAuth client ID. */
export const appIdOf = (clientId) => (String(clientId || "").match(/^(\d+)-/) || [])[1] || "";

/** Loads the picker library once. → the google.picker namespace. */
export function loadPicker(doc = globalThis.document, root = globalThis) {
  if (root.google && root.google.picker) return Promise.resolve(root.google.picker);
  if (loadPicker.pending) return loadPicker.pending;
  const fail = (code) => { loadPicker.pending = null; return new Error(code); };
  loadPicker.pending = new Promise((resolve, reject) => {
    const ready = () => { if (!root.gapi || !root.gapi.load) { reject(fail("selecteur-indisponible")); return; }
      root.gapi.load("picker", { callback: () => (root.google && root.google.picker ? resolve(root.google.picker) : reject(fail("selecteur-indisponible"))), onerror: () => reject(fail("selecteur-indisponible")), timeout: 15000, ontimeout: () => reject(fail("google-injoignable")) }); };
    if (root.gapi && root.gapi.load) { ready(); return; }
    const s = doc.createElement("script");
    s.src = API_URL; s.async = true; s.onload = ready; s.onerror = () => reject(fail("google-injoignable"));
    doc.head.append(s);
  });
  return loadPicker.pending;
}

/** French sentence for an error of this module. */
export function pickerMessage(e) {
  const code = String((e && e.message) || e);
  return ({ "selecteur-indisponible": "Le sélecteur de fichiers de Google n'a pas pu se charger.", "google-injoignable": "Google est injoignable : vérifiez la connexion Internet.",
    "sans-projet": "Le sélecteur de fichiers demande l'identifiant client Google (voir docs/GOOGLE.md)." })[code] || `Sélecteur de fichiers : ${code}`;
}

/** Shows the picker and waits for the person. → { id, name } of the file chosen, or null when they close it.
    o : { picker (the google.picker namespace), token, appId, key (optional browser API key), title,
          fileIds (show exactly these files — the mirror a member said is theirs), mine (false : only what was shared with me) } */
export function pickFile(o) {
  const P = o.picker;
  if (!o.appId) return Promise.reject(new Error("sans-projet"));
  return new Promise((resolve) => {
    const view = new P.DocsView(P.ViewId.DOCS).setIncludeFolders(false);
    if (P.DocsViewMode && view.setMode) view.setMode(P.DocsViewMode.LIST);                 // no thumbnails under drive.file
    if (o.fileIds && o.fileIds.length) view.setFileIds(o.fileIds.join(","));
    else { view.setMimeTypes("text/plain"); if (o.mine === false && view.setOwnedByMe) view.setOwnedByMe(false); }
    let b = new P.PickerBuilder().addView(view).setOAuthToken(o.token).setAppId(o.appId).setCallback((data) => {
      const action = data && (data.action || data[P.Response && P.Response.ACTION]);
      if (action === P.Action.PICKED) { const d = (data.docs || data[P.Response.DOCUMENTS] || [])[0]; resolve(d && d.id ? { id: d.id, name: d.name || "" } : null); }
      else if (action === P.Action.CANCEL) resolve(null);
    });
    if (o.key) b = b.setDeveloperKey(o.key);
    if (o.title && b.setTitle) b = b.setTitle(o.title);
    if (b.setLocale) b = b.setLocale("fr");
    b.build().setVisible(true);
  });
}
