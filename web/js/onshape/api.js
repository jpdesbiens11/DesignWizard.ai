// DesignOrbit.ai - browser client of the local server API (python designwizard.py).
// Onshape forbids direct browser calls (no CORS): everything goes through /api/onshape/* of the
// local server, which holds the API keys. Every function resolves with the JSON payload of the
// server (without the `ok` flag) and throws Error(message in French) on {ok:false} or network failure.

const cfg = { baseUrl: '', headers: {} };
let availability = null;

/** Tests / non-browser hosts: point the client at another origin, add headers (e.g. Origin in Node). */
export function configure({ baseUrl, headers } = {}) {
  if (baseUrl !== undefined) cfg.baseUrl = String(baseUrl).replace(/\/+$/, '');
  if (headers) cfg.headers = { ...headers };
  availability = null;
}

const NO_SERVER = 'Le serveur local DesignOrbit.ai ne répond pas. Correctif : lancez « python designwizard.py » '
  + 'puis ouvrez http://127.0.0.1:8070/ (Onshape et l\'enregistrement des projets en ont besoin).';

const enc = (s) => encodeURIComponent(String(s));

function qs(params) {
  const out = [];
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null && v !== '') out.push(`${enc(k)}=${enc(v)}`);
  }
  return out.length ? `?${out.join('&')}` : '';
}

async function call(method, path, body, { rawBody = false, binary = false } = {}) {
  const init = { method, headers: { 'X-DW-Request': '1', ...cfg.headers }, cache: 'no-store' };
  if (body !== undefined) {
    if (rawBody) {
      init.body = body;
      init.headers['Content-Type'] = 'application/octet-stream';
    } else {
      init.body = JSON.stringify(body);
      init.headers['Content-Type'] = 'application/json';
    }
  }
  let res;
  try {
    res = await fetch(cfg.baseUrl + path, init);
  } catch (e) {
    throw new Error(NO_SERVER);
  }
  if (binary && res.ok) return new Uint8Array(await res.arrayBuffer());
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }
  if (!data || data.ok !== true) {
    const msg = data && typeof data.error === 'string' ? data.error
      : `Réponse inattendue du serveur local (HTTP ${res.status}). Correctif : vérifiez que la page est servie par `
        + '« python designwizard.py » et non par un hébergement statique.';
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  delete data.ok;
  return data;
}

// ---------- availability ----------

/** GET /api/ping -> {app, version, mode:"server", onshape:{connected, user?}} */
export function ping() { return call('GET', '/api/ping'); }

/**
 * true when the page talks to the local server; false when it is served statically (file://, GitHub Pages...).
 * The result is cached; pass {force:true} to probe again.
 */
export function available({ force = false } = {}) {
  if (!availability || force) {
    const isFile = typeof location !== 'undefined' && location.protocol === 'file:' && !cfg.baseUrl;
    availability = isFile ? Promise.resolve(false)
      : ping().then((p) => p.app === 'DesignOrbit.ai' && p.mode === 'server', () => false);
  }
  return availability;
}

// ---------- Onshape: connection ----------

/** -> {connected, user?:{name, email?}, baseUrl, plan?}. {verify:true} re-checks the keys (1 API call). */
export function status({ verify = false } = {}) { return call('GET', `/api/onshape/status${qs({ verify: verify ? 1 : '' })}`); }

/** keys = {accessKey, secretKey, baseUrl?} -> status. The secret is stored server-side only. */
export function connect(keys) { return call('POST', '/api/onshape/connect', keys || {}); }

export function disconnect() { return call('POST', '/api/onshape/disconnect', {}); }

// ---------- Onshape: documents ----------

/** opts = {limit (max 20), offset, filter} -> {items:[{id,name,owner,modifiedAt,defaultWorkspaceId,href,public}], next?} */
export function listDocuments(q = '', opts = {}) {
  return call('GET', `/api/onshape/documents${qs({ q, limit: opts.limit, offset: opts.offset, filter: opts.filter })}`);
}

/** opts = {description, public} -> {id, name, defaultWorkspaceId, href, public} */
export function createDocument(name, opts = {}) {
  return call('POST', '/api/onshape/documents', { name, description: opts.description, public: !!opts.public });
}

/** -> [{id, name}] */
export async function listWorkspaces(did) {
  return (await call('GET', `/api/onshape/documents/${enc(did)}/workspaces`)).items;
}

/** type = PARTSTUDIO | ASSEMBLY | DRAWING | BLOB | ... -> [{id, name, elementType, dataType, filename}] */
export async function listElements(did, wid, type) {
  return (await call('GET', `/api/onshape/documents/${enc(did)}/w/${enc(wid)}/elements${qs({ type })}`)).items;
}

/** Parts of a part studio -> [{partId, name, partNumber, bodyType}] */
export async function partsOf(did, wid, eid) {
  return (await call('GET', `/api/onshape/documents/${enc(did)}/w/${enc(wid)}/e/${enc(eid)}/parts`)).items;
}

// ---------- Onshape: import ----------

/** Uint8Array -> base64, by chunks (no call-stack overflow on large files). */
export function bytesToBase64(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < u8.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, u8.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

/**
 * importFile({did, wid, filename, bytes | text | contentBase64, kind:'step'|'pdf'|'blob', options?, elementId?})
 *   step -> {translationId, state, elementId (uploaded blob tab), name}
 *   pdf / blob -> {elementId, name}; pass elementId to UPDATE an existing blob tab.
 */
export function importFile({ did, wid, filename, bytes, text, contentBase64, kind = 'blob', options, elementId }) {
  let b64 = contentBase64;
  if (b64 === undefined && typeof text === 'string') b64 = bytesToBase64(new TextEncoder().encode(text));
  if (b64 === undefined && bytes) b64 = bytesToBase64(bytes);
  return call('POST', '/api/onshape/import', { did, wid, filename, contentBase64: b64 || '', kind, options, elementId });
}

/** -> {state:'ACTIVE'|'DONE'|'FAILED', resultElementIds, failureReason, requestElementId} */
export function translation(tid) { return call('GET', `/api/onshape/translations/${enc(tid)}`); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function poll(read, { timeoutMs, intervalMs, onTick, what }) {
  const t0 = Date.now();
  let delay = intervalMs;
  for (let n = 1; ; n += 1) {
    const st = await read();
    if (onTick) onTick({ ...st, elapsedMs: Date.now() - t0, polls: n });
    if (st.state !== 'ACTIVE') return st;
    if (Date.now() - t0 + delay > timeoutMs) {
      throw new Error(`${what} : Onshape n'a pas terminé en ${Math.round(timeoutMs / 1000)} s. Correctif : `
        + 'patientez puis vérifiez le document dans Onshape avant de relancer.');
    }
    await sleep(delay);
    delay = Math.min(delay * 1.5, 8000); // sparse polling: every call counts against the annual API quota
  }
}

/** Polls until DONE; throws on FAILED / timeout. opts = {timeoutMs=180000, intervalMs=1500, onTick} */
export async function waitTranslation(tid, { timeoutMs = 180000, intervalMs = 1500, onTick } = {}) {
  const st = await poll(() => translation(tid), { timeoutMs, intervalMs, onTick, what: 'Conversion du STEP' });
  if (st.state !== 'DONE') {
    throw new Error(`Onshape n'a pas pu convertir le fichier (${st.failureReason || st.state}). Correctif : `
      + 'vérifiez le STEP exporté (ouvrez-le dans un autre outil CAO) puis relancez.');
  }
  return st;
}

// ---------- Onshape: drawings ----------

/** createDrawing({did, wid, name, elementId, partId?, size?:'A3', standard?, views?, template?:{did,wid,eid}}) -> {elementId, name, warnings} */
export function createDrawing(params) { return call('POST', '/api/onshape/drawings', params); }

/** modifyDrawing(did, wid, eid, {description, jsonRequests}) -> {requestId, state} */
export function modifyDrawing(did, wid, eid, { description, jsonRequests }) {
  return call('POST', `/api/onshape/drawings/${enc(did)}/${enc(wid)}/${enc(eid)}/modify`, { description, jsonRequests });
}

/** -> {state, output:{status, results:[{status, logicalId?, errorDescription?}]}|null, failureReason, statusCode} */
export function modifyStatus(did, wid, eid, requestId) {
  return call('GET', `/api/onshape/drawings/${enc(did)}/${enc(wid)}/${enc(eid)}/modify/${enc(requestId)}`);
}

/** Polls a modify request until it leaves ACTIVE (returns DONE or FAILED status; throws on timeout). */
export function waitModify(did, wid, eid, requestId, { timeoutMs = 90000, intervalMs = 1500, onTick } = {}) {
  return poll(() => modifyStatus(did, wid, eid, requestId),
    { timeoutMs, intervalMs, onTick, what: 'Modification du dessin' });
}

// ---------- Onshape: metadata, raw ----------

/** setMetadata({did, wid, eid, partId?, properties:{name?, partNumber?, description?, revision?, material?}}) -> {set:[], skipped:[{property, reason}]} */
export function setMetadata(params) { return call('POST', '/api/onshape/metadata', params); }

/** raw({method, path, query?, body?}) -> {data}. Only allow-listed Onshape paths (see docs/ONSHAPE.md). */
export function raw(params) { return call('POST', '/api/onshape/raw', params); }

// ---------- local projects (same server) ----------

export const projects = {
  list: async () => (await call('GET', '/api/projects')).projects,
  load: async (id) => (await call('GET', `/api/projects/${enc(id)}`)).project,
  save: (id, project) => call('PUT', `/api/projects/${enc(id)}`, { project }),
  remove: (id) => call('DELETE', `/api/projects/${enc(id)}`),
  files: async (id) => (await call('GET', `/api/projects/${enc(id)}/files`)).files,
  getFile: (id, name) => call('GET', `/api/projects/${enc(id)}/files/${enc(name)}`, undefined, { binary: true }),
  putFile: (id, name, bytes) => call('PUT', `/api/projects/${enc(id)}/files/${enc(name)}`, bytes, { rawBody: true }),
};
