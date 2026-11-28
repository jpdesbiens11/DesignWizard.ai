/* DynamiteOrbit.ai — project store: one document per project (parts, assemblies, analyses), with undo / redo and
   auto-save. Three back-ends: the local server (python designwizard.py: files on disk, Onshape proxy), the user's own
   Google Drive (the hosted application, once signed in: one folder per product, see google/drive_fs.js), or the
   browser alone (localStorage + export / import of the project file). */

import { dropInstances } from "./asm_levels.js";

const LS_INDEX = "dw.projects", LS_PREFIX = "dw.project.", LS_LAST = "dw.last";
const HEADERS = { "Content-Type": "application/json", "X-DW-Request": "1" };
const clone = (o) => JSON.parse(JSON.stringify(o));
/* What an undo step keeps : the project WITHOUT its history (core/history.js) — the restore points are not undone by Ctrl + Z, and a long
   history is not copied sixty times. */
const bare = (p) => JSON.stringify(p && p.history ? { ...p, history: undefined } : p);
const now = () => new Date().toISOString();

class Store {
  constructor() {
    this.mode = "browser"; this.project = null; this.server = null; this.drive = null;
    this.hooks = [];
    this.loaders = [];              // what is done to a project when it is opened (a document kept by an older version takes what a newer one expects)
    this.listeners = new Map(); this.undoStack = []; this.redoStack = []; this.saveTimer = 0; this.saveState = "saved";
  }
  on(evt, fn) { if (!this.listeners.has(evt)) this.listeners.set(evt, new Set()); this.listeners.get(evt).add(fn); return () => this.listeners.get(evt).delete(fn); }
  emit(evt, data) { (this.listeners.get(evt) || []).forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } }); }

  async init() {
    // The local server only exists on the user's own machine: a hosted page (GitHub Pages…) goes straight to browser mode.
    const host = globalThis.location ? location.hostname : "";
    if (!(["localhost", "127.0.0.1", "[::1]", ""].includes(host) || /\.localhost$/.test(host))) return this.mode;
    try {
      const r = await fetch("api/ping", { cache: "no-store" });
      if (r.ok) { const j = await r.json(); if (j && j.ok) { this.mode = "server"; this.server = j; } }
    } catch (e) { /* static hosting: browser mode */ }
    return this.mode;
  }
  /** Use the signed-in user's Google Drive as the store (the hosted application). `fs` = createDriveFs(...). */
  useDrive(fs) { this.mode = "drive"; this.drive = fs; }
  async api(method, path, body) {
    const r = await fetch(path, { method, headers: HEADERS, body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store" });
    const j = await r.json().catch(() => ({ ok: false, error: `Réponse illisible du serveur local (${r.status}).` }));
    if (!j.ok) throw new Error(j.error || `Erreur ${r.status}`);
    return j;
  }

  /* ---------- projects ---------- */
  async list() {
    if (this.mode === "server") return (await this.api("GET", "api/projects")).projects;
    if (this.mode === "drive") return this.drive.listProjects();
    try { return JSON.parse(localStorage.getItem(LS_INDEX) || "[]"); } catch (e) { return []; }
  }
  blank(name) {
    const id = (name || "projet").normalize("NFD").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "projet";
    return { dw: "project/1", id: `${id}-${Date.now().toString(36)}`, name: name || "Nouveau projet", description: "", created: now(), updated: now(),
      author: "", parts: [], assemblies: [], log: [] };
  }
  async create(name, seed) {
    if (this.creating) return this.creating;                    // a second click while the first project is still being written (a few seconds in Drive) : the same project, not a twin
    this.creating = (async () => {
      const p = Object.assign(this.blank(name), seed ? clone(seed) : {});
      if (seed && seed.id) p.id = `${seed.id}-${Date.now().toString(36)}`;
      p.name = name || p.name;
      this.adopt(p);
      await this.saveNow();
      return p;
    })();
    try { return await this.creating; } finally { this.creating = null; }
  }
  /** Opens a project. cancelOpen() while it is being read calls it off : the project in hand stays, and the call is refused with an error whose `cancelled` is true. */
  async open(id) {
    const mine = this.openSeq = this.openSeq || 0;
    let p;
    if (this.mode === "server") p = (await this.api("GET", `api/projects/${encodeURIComponent(id)}`)).project;
    else if (this.mode === "drive") p = await this.drive.openProject(id);
    else p = JSON.parse(localStorage.getItem(LS_PREFIX + id) || "null");
    if (!p) throw new Error(`Projet « ${id} » introuvable.`);
    if (mine !== this.openSeq) { const e = new Error("Ouverture annulée."); e.cancelled = true; throw e; }
    this.adopt(p);
    return p;
  }
  cancelOpen() { this.openSeq = (this.openSeq || 0) + 1; }
  adopt(p) {
    p.parts = p.parts || []; p.assemblies = p.assemblies || []; p.boards = p.boards || []; p.log = p.log || [];
    for (const f of this.loaders || []) f(p);
    this.project = p; this.undoStack = []; this.redoStack = []; this.saveState = "saved";
    try { localStorage.setItem(LS_LAST, p.id); } catch (e) { /* private mode */ }
    this.emit("project", p); this.emit("change", { label: "open" });
  }
  lastId() { try { return localStorage.getItem(LS_LAST); } catch (e) { return null; } }
  async remove(id) {
    if (this.mode === "server") await this.api("DELETE", `api/projects/${encodeURIComponent(id)}`);
    else if (this.mode === "drive") await this.drive.trashProject(id);          // to the Drive bin: recoverable for 30 days
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
      else if (this.mode === "drive") {
        if (this.saving) { this.saveAgain = true; return; }       // one write at a time; the latest state is written next
        this.saving = true; this.emit("saved", "saving");
        try { await this.drive.saveProject(p); } finally { this.saving = false; }
        if (this.saveAgain) { this.saveAgain = false; this.touch(); return; }
      } else {
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
  touch() { this.saveState = "dirty"; clearTimeout(this.saveTimer); this.saveTimer = setTimeout(() => this.saveNow(), this.mode === "drive" ? 2500 : 700); this.emit("saved", this.saveState); }

  /* ---------- edits with undo ---------- */
  /** Apply `fn(project)` as one undoable step named `label`. */
  commit(label, fn, extra = {}) {
    const p = this.project;
    if (!p) throw new Error("Aucun projet ouvert.");
    const before = bare(p);
    fn(p);
    for (const hook of this.hooks) hook(p, extra);              // e.g. linked interfaces adapt in the same undo step
    const after = bare(p);
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
    to.push({ label: step.label, snap: bare(this.project) });
    const id = this.project.id, history = this.project.history;
    this.project = JSON.parse(step.snap); this.project.id = id;
    if (history) this.project.history = history;              // the restore points stay where they are
    this.touch();
    this.emit("change", { label: `${verb} : ${step.label}`, undo: true });
    return step.label;
  }

  /** Change the HISTORY of the project (core/history.js : a point posed, a branch set aside) — saved, but not an undo step. */
  writeHistory(label, fn) {
    const p = this.project; if (!p) throw new Error("Aucun projet ouvert.");
    const r = fn(p); this.touch(); this.emit("change", { label, history: true }); return r;
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
      dropInstances(p.assemblies, (i) => i.part === id);      // its instances leave every assembly, with the joints that held to them — those of a parent through a sub-assembly too
    }, { part: id });
  }

  /* ---------- assemblies ---------- */
  get assemblies() { return this.project ? this.project.assemblies : []; }
  /** Deletes an assembly : it leaves the assemblies that held it as a sub-assembly, with the joints that went through it. One undoable step. */
  removeAssembly(id) { return this.commit(`Assemblage supprimé : ${id}`, (p) => { p.assemblies = p.assemblies.filter((x) => x.id !== id); dropInstances(p.assemblies, (i) => i.asm === id); }, { assembly: id }); }
  assembly(id) { return this.assemblies.find((x) => x.id === id) || null; }
  addAssembly(name) {
    const a = { dw: "assembly/1", id: this.uniqueId(`ASM-${String(this.assemblies.length + 1).padStart(3, "0")}`), name: name || "Assemblage", instances: [], mates: [] };
    this.commit(`Assemblage créé : ${a.id}`, (p) => p.assemblies.push(a), { assembly: a.id });
    return a.id;
  }
  updateAssembly(id, fn, label) {
    return this.commit(label || `Assemblage modifié : ${id}`, (p) => { const a = p.assemblies.find((x) => x.id === id); if (!a) throw new Error(`Assemblage « ${id} » introuvable.`); fn(a, p); }, { assembly: id });
  }

  /* ---------- electronic boards (PCBA) ---------- */
  get boards() { return this.project ? this.project.boards || [] : []; }
  board(id) { return this.boards.find((x) => x.id === id) || null; }
  addBoard(doc) {
    const b = { ...doc, id: this.uniqueId(doc.id || `PCBA-${String(this.boards.length + 1).padStart(3, "0")}`) };
    this.commit(`Carte créée : ${b.id} ${b.name || ""}`, (p) => { p.boards = p.boards || []; p.boards.push(b); }, { board: b.id });
    return b.id;
  }
  updateBoard(id, fn, label) {
    return this.commit(label || `Carte modifiée : ${id}`, (p) => { const b = (p.boards || []).find((x) => x.id === id); if (!b) throw new Error(`Carte « ${id} » introuvable.`); fn(b, p); }, { board: id });
  }
  removeBoard(id) { return this.commit(`Carte retirée : ${id}`, (p) => { p.boards = (p.boards || []).filter((x) => x.id !== id); }, { board: id }); }

  exportJson() { return JSON.stringify(this.project, null, 1); }
}

/** A name no project bears yet : « name », then « name (2) », « name (3) »… */
export const freshName = (name, taken) => { if (!taken.includes(name)) return name; let n = 2; while (taken.includes(`${name} (${n})`)) n++; return `${name} (${n})`; };
export const store = new Store();
export { clone };
