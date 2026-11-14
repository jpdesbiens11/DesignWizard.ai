/* DesignWizard.ai — minimal Google Drive v3 client (scope drive.file: the app only sees the files it created).
   Every response is untrusted data: it is never inserted as HTML. Files are tagged with appProperties so the app
   finds its own folders again without depending on their names. */

const DRIVE = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
export const FOLDER = "application/vnd.google-apps.folder";
export const APP_KEY = "dw";                                    // appProperties key: role of a file in the tree
const FIELDS = "id,name,mimeType,modifiedTime,size,webViewLink,appProperties,parents";

export class GoogleError extends Error {
  constructor(status, message) { super(message || `HTTP ${status}`); this.status = status; }
}
const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'");

export function createDrive({ token, fetch = globalThis.fetch.bind(globalThis) }) {
  async function call(url, { method = "GET", json, raw, type, as = "json" } = {}) {
    const t = await token();
    const rep = await fetch(url, { method, headers: { Authorization: `Bearer ${t}`, ...(json ? { "Content-Type": "application/json" } : raw !== undefined ? { "Content-Type": type } : {}) }, body: json ? JSON.stringify(json) : raw });
    if (!rep.ok) {
      let msg = "";
      try { const j = await rep.json(); msg = (j && j.error && j.error.message) || ""; } catch (e) { /* empty body */ }
      throw new GoogleError(rep.status, msg);
    }
    if (rep.status === 204) return null;
    return as === "text" ? rep.text() : as === "bytes" ? new Uint8Array(await rep.arrayBuffer()) : rep.json();
  }
  const fields = `fields=${encodeURIComponent(FIELDS)}`;
  return {
    /** Who is signed in: {email, name, picture, sub}. */
    me: () => call("https://www.googleapis.com/oauth2/v3/userinfo"),
    /** Files of the app matching a query: {role, props (other appProperties), parent, name, mime}. */
    async find({ role, props, parent, name, mime, limit = 100 } = {}) {
      const q = ["trashed=false"];
      if (role) q.push(`appProperties has { key='${APP_KEY}' and value='${esc(role)}' }`);
      for (const [k, v] of Object.entries(props || {})) q.push(`appProperties has { key='${esc(k)}' and value='${esc(v)}' }`);
      if (parent) q.push(`'${esc(parent)}' in parents`);
      if (name) q.push(`name='${esc(name)}'`);
      if (mime) q.push(`mimeType='${esc(mime)}'`);
      const out = [];
      let page = "";
      do {
        const r = await call(`${DRIVE}/files?q=${encodeURIComponent(q.join(" and "))}&fields=${encodeURIComponent(`nextPageToken,files(${FIELDS})`)}&spaces=drive&orderBy=name&pageSize=${Math.min(limit, 200)}${page ? `&pageToken=${encodeURIComponent(page)}` : ""}`);
        out.push(...(r.files || [])); page = r.nextPageToken || "";
      } while (page && out.length < limit);
      return out;
    },
    createFolder: ({ name, parent, role, props }) => call(`${DRIVE}/files?${fields}`, { method: "POST", json: { name, mimeType: FOLDER, ...(parent ? { parents: [parent] } : {}), appProperties: { [APP_KEY]: role || "folder", ...(props || {}) } } }),
    /** Create a file with its content (multipart). bytes: string | Uint8Array | Blob. */
    upload({ name, mime, bytes, parent, role, props }) {
      const b = `dw-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      const meta = JSON.stringify({ name, mimeType: mime, ...(parent ? { parents: [parent] } : {}), appProperties: { [APP_KEY]: role || "file", ...(props || {}) } });
      const body = new Blob([`--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${b}\r\nContent-Type: ${mime}\r\n\r\n`, bytes, `\r\n--${b}--`]);
      return call(`${UPLOAD}?uploadType=multipart&${fields}`, { method: "POST", raw: body, type: `multipart/related; boundary=${b}` });
    },
    /** Replace the content of an existing file (keeps its id, its link and its revisions). */
    replace: (id, { mime, bytes }) => call(`${UPLOAD}/${encodeURIComponent(id)}?uploadType=media&${fields}`, { method: "PATCH", raw: new Blob([bytes], { type: mime }), type: mime }),
    rename: (id, name) => call(`${DRIVE}/files/${encodeURIComponent(id)}?${fields}`, { method: "PATCH", json: { name } }),
    text: (id) => call(`${DRIVE}/files/${encodeURIComponent(id)}?alt=media`, { as: "text" }),
    bytes: (id) => call(`${DRIVE}/files/${encodeURIComponent(id)}?alt=media`, { as: "bytes" }),
    trash: (id) => call(`${DRIVE}/files/${encodeURIComponent(id)}?${fields}`, { method: "PATCH", json: { trashed: true } }),
    /** Move a file or a folder to another folder (nothing is copied, links keep working). */
    move: (id, to, from) => call(`${DRIVE}/files/${encodeURIComponent(id)}?addParents=${encodeURIComponent(to)}${from ? `&removeParents=${encodeURIComponent(from)}` : ""}&${fields}`, { method: "PATCH", json: {} }),
  };
}
