/* DesignWizard.ai — project store: one JSON document per project (parts, assemblies, analyses), with undo / redo and
   auto-save. Two back-ends, chosen at start: the local server (python designwizard.py: files on disk, Onshape proxy)
   or the browser alone (static hosting: localStorage + export / import of the project file). */

const LS_INDEX = "dw.projects", LS_PREFIX = "dw.project.", LS_LAST = "dw.last";
const HEADERS = { "Content-Type": "application/json", "X-DW-Request": "1" };
const clone = (o) => JSON.parse(JSON.stringify(o));
const now = () => new Date().toISOString();

class Store {
  constructor() {
    this.mode = "browser"; this.project = null; this.server = null;
    this.hooks = [];
    this.listeners = new Map(); this.undoStack = []; this.redoStack = []; this.saveTimer = 0; this.saveState = "saved";
  }
  on(evt, fn) { if (!this.listeners.has(evt)) this.listeners.set(evt, new Set()); this.listeners.get(evt).add(fn); return () => this.listeners.get(evt).delete(fn); }
  emit(evt, data) { (this.listeners.get(evt) || []).forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } }); }

  async init() {
    try {
      const r = await fetch("api/ping", { cache: "no-store" });
      if (r.ok) { const j = await r.json(); if (j && j.ok) { this.mode = "server"; this.server = j; } }
    } catch (e) { /* static hosting: browser mode */ }
    return this.mode;
  }
  async api(method, path, body) {
    const r = await fetch(path, { method, headers: HEADERS, body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store" });
    const j = await r.json().catch(() => ({ ok: false, error: `Réponse illisible du serveur local (${r.status}).` }));
    if (!j.ok) throw new Error(j.error || `Erreur ${r.status}`);
    return j;
  }

  /* ---------- projects ---------- */
  async list() {
    if (this.mode === "server") return (await this.api("GET", "api/projects")).projects;
    try { return JSON.parse(localStorage.getItem(LS_INDEX) || "[]"); } catch (e) { return []; }
  }
  blank(name) {
    const id = (name || "projet").normalize("NFD").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "projet";
    return { dw: "project/1", id: `${id}-${Date.now().toString(36)}`, name: name || "Nouveau projet", description: "", created: now(), updated: now(),
      author: "", parts: [], assemblies: [], log: [] };
  }
  async create(name, seed) {
    const p = Object.assign(this.blank(name), seed ? clone(seed) : {});
    if (seed && seed.id) p.id = `${seed.id}-${Date.now().toString(36)}`;
    p.name = name || p.name;
    this.adopt(p);
    await this.saveNow();
    return p;
  }
  async open(id) {
    let p;
    if (this.mode === "server") p = (await this.api("GET", `api/projects/${encodeURIComponent(id)}`)).project;
    else p = JSON.parse(localStorage.getItem(LS_PREFIX + id) || "null");
    if (!p) throw new Error(`Projet « ${id} » introuvable.`);
    this.adopt(p);
    return p;
  }
  adopt(p) {
    p.parts = p.parts || []; p.assemblies = p.assemblies || []; p.log = p.log || [];
    this.project = p; this.undoStack = []; this.redoStack = []; this.saveState = "saved";
    try { localStorage.setItem(LS_LAST, p.id); } catch (e) { /* private mode */ }
    this.emit("project", p); this.emit("change", { label: "open" });
  }
  lastId() { try { return localStorage.getItem(LS_LAST); } catch (e) { return null; } }
  async remove(id) {
    if (this.mode === "server") await this.api("DELETE", `api/projects/${encodeURIComponent(id)}`);
    else {
      localStorage.removeItem(LS_PREFIX + id);
      localStorage.setItem(LS_INDEX, JSON.stringify((await this.list()).filter((x) => x.id !== id)));
    }
    if (this.project && this.project.id === id) { this.project = null; this.emit("project", null); }
  }
  async saveNow() {
    const p = this.project;
    if (!p) return;
    clearTimeout(this.saveTimer);
    p.updated = now();
    try {
      if (this.mode === "server") await this.api("PUT", `api/projects/${encodeURIComponent(p.id)}`, { project: p });
      else {
        localStorage.setItem(LS_PREFIX + p.id, JSON.stringify(p));
        const idx = (await this.list()).filter((x) => x.id !== p.id);
        idx.unshift({ id: p.id, name: p.name, updated: p.updated, parts: p.parts.length, assemblies: p.assemblies.length });
        localStorage.setItem(LS_INDEX, JSON.stringify(idx));
      }
      this.saveState = "saved";
    } catch (e) {
      this.saveState = "error";
      this.emit("error", new Error(`Enregistrement impossible : ${e.message}. Correctif : exportez le projet (menu Projet → Exporter) pour ne rien perdre.`));
    }
    this.emit("saved", this.saveState);
  }
  touch() { this.saveState = "dirty"; clearTimeout(this.saveTimer); this.saveTimer = setTimeout(() => this.saveNow(), 700); this.emit("saved", this.saveState); }

  /* ---------- edits with undo ---------- */
  /** Apply `fn(project)` as one undoable step named `label`. */
  commit(label, fn, extra = {}) {
    const p = this.project;
    if (!p) throw new Error("Aucun projet ouvert.");
    const before = JSON.stringify(p);
    fn(p);
    for (const hook of this.hooks) hook(p, extra);              // e.g. linked interfaces adapt in the same undo step
    const after = JSON.stringify(p);
    if (after === before) return false;
    this.undoStack.push({ label, snap: before });
    if (this.undoStack.length > 60) this.undoStack.shift();
    this.redoStack = [];
    p.log.push({ when: now(), text: label });
    if (p.log.length > 400) p.log.shift();
    this.touch();
    this.emit("change", { label, ...extra });
    return true;
  }
  undo() { return this._swap(this.undoStack, this.redoStack, "Annuler"); }
  redo() { return this._swap(this.redoStack, this.undoStack, "Rétablir"); }
  _swap(from, to, verb) {
    const step = from.pop();
    if (!step) return null;
    to.push({ label: step.label, snap: JSON.stringify(this.project) });
    const id = this.project.id;
    this.project = JSON.parse(step.snap); this.project.id = id;
    this.touch();
    this.emit("change", { label: `${verb} : ${step.label}`, undo: true });
    return step.label;
  }

  /* ---------- parts ---------- */
  get parts() { return this.project ? this.project.parts : []; }
  part(id) { return this.parts.find((x) => x.id === id) || null; }
  nextPartId(prefix = "DW") {
    let n = this.parts.length + 1, id;
    do { id = `${prefix}-${String(n++).padStart(4, "0")}`; } while (this.part(id));
    return id;
  }
  addPart(spec, label) {
    const s = clone(spec);
    s.dw = s.dw || "part/1";
    if (!s.id || this.part(s.id)) s.id = this.uniqueId(s.id || "DW-0001");
    this.commit(label || `Pièce ajoutée : ${s.id} ${s.name || ""}`, (p) => p.parts.push(s), { part: s.id });
    return s.id;
  }
  uniqueId(base) {
    if (!this.part(base) && !this.assembly(base)) return base;
    for (let i = 2; i < 999; i++) { const id = `${base}-${i}`; if (!this.part(id) && !this.assembly(id)) return id; }
    return `${base}-${Date.now().toString(36)}`;
  }
  updatePart(id, fn, label) {
    return this.commit(label || `Pièce modifiée : ${id}`, (p) => { const i = p.parts.findIndex((x) => x.id === id); if (i < 0) throw new Error(`Pièce « ${id} » introuvable.`); const r = fn(p.parts[i]); if (r) p.parts[i] = r; }, { part: id });
  }
  removePart(id) {
    return this.commit(`Pièce retirée : ${id}`, (p) => {
      p.parts = p.parts.filter((x) => x.id !== id);
      for (const a of p.assemblies) { const gone = new Set(a.instances.filter((i) => i.part === id).map((i) => i.id)); a.instances = a.instances.filter((i) => !gone.has(i.id)); a.mates = (a.mates || []).filter((m) => !gone.has(m.a.inst) && !gone.has(m.b.inst)); }
    }, { part: id });
  }

  /* ---------- assemblies ---------- */
  get assemblies() { return this.project ? this.project.assemblies : []; }
  assembly(id) { return this.assemblies.find((x) => x.id === id) || null; }
  addAssembly(name) {
    const a = { dw: "assembly/1", id: this.uniqueId(`ASM-${String(this.assemblies.length + 1).padStart(3, "0")}`), name: name || "Assemblage", instances: [], mates: [] };
    this.commit(`Assemblage créé : ${a.id}`, (p) => p.assemblies.push(a), { assembly: a.id });
    return a.id;
  }
  updateAssembly(id, fn, label) {
    return this.commit(label || `Assemblage modifié : ${id}`, (p) => { const a = p.assemblies.find((x) => x.id === id); if (!a) throw new Error(`Assemblage « ${id} » introuvable.`); fn(a, p); }, { assembly: id });
  }

  exportJson() { return JSON.stringify(this.project, null, 1); }
}

export const store = new Store();
export { clone };
