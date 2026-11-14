/* DesignWizard.ai — the project as a folder tree in the user's own Google Drive, easy to browse and to share:

     DesignWizard.ai/
       <Projet>/
         projet.dwiz                    the whole project (what « Ouvrir depuis Drive » reads back)
         01_Pieces/<PN> <nom>/          PN.part.dwiz · PN.step · PN.stl · PN.dxf · PN.pdf · PN.fs · PN_gamme.txt
         02_Assemblages/<ASM>/          ASM.step · ASM_nomenclature.csv
         03_Analyses/                   physique, isolation, DFx
         04_Rapports/                   rapport de revue de conception

   Folders and files are found again by their appProperties (role, project id), not by their name, so the user may
   rename or move them in Drive. Pure logic over a drive client (see drive.js): testable with a fake one. */

import { FOLDER } from "./drive.js";
import { toDwiz, fromDwiz } from "../core/dwiz.js";

export const TREE = { parts: "01_Pieces", assemblies: "02_Assemblages", analyses: "03_Analyses", reports: "04_Rapports" };
export const PROJECT_FILE = "projet.dwiz";
const LEGACY_PROJECT_FILE = "projet.dwproject.json";           // written by the first versions; still read
/** A name Drive and every file system accept. */
export const safeName = (s) => String(s || "sans nom").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) || "sans nom";

export function createDriveFs(drive, { root = "DesignWizard.ai" } = {}) {
  const cache = new Map();                                     // "parentId/name" -> folder
  async function rootFolder() {
    if (cache.has("/")) return cache.get("/");
    const found = await drive.find({ role: "root", mime: FOLDER, limit: 5 });
    const f = found[0] || await drive.createFolder({ name: root, role: "root" });
    cache.set("/", f);
    return f;
  }
  /** Sub-folder `name` of `parent`, created when missing. */
  async function folder(parent, name, role = "folder", props) {
    const key = `${parent}/${name}`;
    if (cache.has(key)) return cache.get(key);
    const found = await drive.find({ parent, name, mime: FOLDER, limit: 5 });
    const f = found[0] || await drive.createFolder({ name, parent, role, props });
    cache.set(key, f);
    return f;
  }
  /** Folder of a project (found by its id, whatever its current name; renamed when the project was renamed). */
  async function projectFolder(project, create = true) {
    const r = await rootFolder(), key = `project:${project.id}`;
    if (cache.has(key)) return cache.get(key);
    const found = await drive.find({ role: "project", props: { pid: project.id }, mime: FOLDER, limit: 5 });
    let f = found[0] || null;
    const name = safeName(project.name || project.id);
    if (!f && create) f = await drive.createFolder({ name, parent: r.id, role: "project", props: { pid: project.id } });
    else if (f && f.name !== name) f = await drive.rename(f.id, name);
    if (f) cache.set(key, f);
    return f;
  }
  /** Create or replace the file `name` in folder `parent`. */
  async function put(parent, name, mime, bytes, role = "file", props) {
    const found = await drive.find({ parent, name, limit: 5 });
    const same = found.find((f) => f.mimeType !== FOLDER);
    return same ? drive.replace(same.id, { mime, bytes }) : drive.upload({ name, mime, bytes, parent, role, props });
  }
  return {
    rootFolder, projectFolder, folder, put,
    /** Projects saved in this Drive, most recent first. */
    async listProjects() {
      const list = await drive.find({ role: "project", mime: FOLDER, limit: 200 });
      return list.map((f) => ({ id: f.id, name: f.name, pid: (f.appProperties || {}).pid || null, modified: f.modifiedTime || null, link: f.webViewLink || null }))
        .sort((a, b) => String(b.modified || "").localeCompare(String(a.modified || "")));
    },
    /** Save the project file. Returns { folder, file }. */
    async saveProject(project) {
      const f = await projectFolder(project);
      const file = await put(f.id, PROJECT_FILE, "text/plain", toDwiz(project), "project-file", { pid: project.id });
      return { folder: f, file };
    },
    /** Read a project back from its folder. */
    async loadProject(folderId) {
      let found = await drive.find({ parent: folderId, name: PROJECT_FILE, limit: 2 });
      if (!found.length) found = await drive.find({ parent: folderId, name: LEGACY_PROJECT_FILE, limit: 2 });
      if (!found.length) throw new Error(`Ce dossier ne contient pas de fichier ${PROJECT_FILE}.`);
      const text = await drive.text(found[0].id), obj = /^\s*\{/.test(text) ? JSON.parse(text) : fromDwiz(text);
      if (!obj || !Array.isArray(obj.parts)) throw new Error("Le fichier de projet lu dans Drive n'est pas un projet DesignWizard.");
      return obj;
    },
    /** Publish files into the project tree. items: [{ path: ["01_Pieces", "PN nom"], name, mime, bytes }]. onStep(done, total, item). */
    async publish(project, items, onStep = () => {}) {
      const pf = await projectFolder(project), out = [];
      let n = 0;
      for (const it of items) {
        let parent = pf.id;
        for (const seg of it.path || []) parent = (await folder(parent, safeName(seg))).id;
        const file = await put(parent, safeName(it.name), it.mime, it.bytes, "artifact", { pid: project.id });
        out.push({ ...it, bytes: undefined, id: file.id, link: file.webViewLink || null });
        onStep(++n, items.length, it);
      }
      return { folder: pf, files: out };
    },
    /** The tree under a folder, `depth` levels deep: [{ id, name, folder, link, modified, size, children }]. */
    async tree(folderId, depth = 3) {
      const list = await drive.find({ parent: folderId, limit: 200 });
      const out = [];
      for (const f of list) {
        const isFolder = f.mimeType === FOLDER;
        out.push({ id: f.id, name: f.name, folder: isFolder, link: f.webViewLink || null, modified: f.modifiedTime || null, size: f.size ? Number(f.size) : null,
          children: isFolder && depth > 1 ? await this.tree(f.id, depth - 1) : [] });
      }
      return out.sort((a, b) => (a.folder === b.folder ? a.name.localeCompare(b.name, "fr") : a.folder ? -1 : 1));
    },
    forget: () => cache.clear(),
  };
}
