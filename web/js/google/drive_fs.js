/* DesignOrbit.ai — the product as a folder tree in the user's own Google Drive: the data store of the online
   application, and a place a colleague or a shop can browse without the application.

     DesignOrbit.ai/
       LISEZ-MOI.txt
       <Nom du projet>/
         <Nom du projet>.project.dwiz      the whole project — what the application opens
         LISEZ-MOI.txt                     what is where, with the list of parts
         01_Pieces/<numéro> — <nom>/       .part.dwiz · .step · .stl · .dxf · _decoupe.dxf · .pdf · .fs · _gamme.txt
         02_Assemblages/<numéro> — <nom>/  .assembly.dwiz · .step · _nomenclature.csv
         03_Analyses/                      physique.dwiz
         04_Rapports/
         05_Commandes/<date> <numéro> ×<quantité>/     dossier de commande .zip · demande_de_prix.txt
         06_Revisions/<numéro>_<révision> <nom>/       the frozen .dwiz of each released revision (core/plm.js)
         99_Archives/                      folders of the parts removed from the project — nothing is ever deleted

   Rules of the tree: numbered folders so they sort in the order of the work; « number — name » so a folder is found
   by either; dates first (ISO) where time matters; one folder per part, named after it and renamed with it.
   Folders and files are found by their appProperties (role, project id, part number), never by their name: the user
   may rename, move and share them in Drive. Pure logic over a drive client (drive.js): testable with a fake one. */

import { FOLDER } from "./drive.js";
import { toDwiz, fromDwiz } from "../core/dwiz.js";
import { stampText } from "../core/brand.js";

export const TREE = { parts: "01_Pieces", assemblies: "02_Assemblages", analyses: "03_Analyses", reports: "04_Rapports", orders: "05_Commandes", revisions: "06_Revisions", archives: "99_Archives" };
const OLD_PROJECT_FILES = ["projet.dwiz", "projet.dwproject.json"];   // names written by the first versions; still read
const README = "LISEZ-MOI.txt";
/** A name Drive and every file system accept. */
export const safeName = (s) => String(s || "sans nom").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) || "sans nom";
export const projectFileName = (project) => `${safeName(project.name || project.id)}.project.dwiz`;
/** « number — name » : the folder of a part or of an assembly. */
export const itemFolderName = (id, name) => safeName(name && name !== id ? `${id} — ${name}` : id);
const day = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** The note left at the top of a project folder for whoever opens it without the application. */
export function readmeText(project, when = new Date()) {
  const parts = (project.parts || []).map((p) => `  ${p.id} — ${p.name || ""}${p.material ? ` (${p.material})` : ""}`), asms = (project.assemblies || []).map((a) => `  ${a.id} — ${a.name || ""}`);
  return [`${project.name || project.id}`, project.description || "", "",
    "Ce dossier est tenu par DesignOrbit.ai. Vous pouvez le lire, le partager et le renommer ; ne modifiez pas les", "fichiers à la main : ouvrez le projet dans l'application, elle les réécrit.", "",
    `${projectFileName(project)}   le projet entier (format .dwiz : du texte, une instruction par ligne)`,
    `${TREE.parts}/        une pièce par dossier : fiche .dwiz, STEP, STL, DXF, dessin PDF, FeatureScript, gamme`,
    `${TREE.assemblies}/   un assemblage par dossier : fiche .dwiz, STEP, nomenclature`,
    `${TREE.analyses}/      physique vérifiée par des modèles analytiques`, `${TREE.reports}/      rapports de revue de conception`,
    `${TREE.orders}/     dossiers de commande de prototypes, un par envoi, datés`, `${TREE.archives}/      pièces retirées du projet (rien n'est supprimé)`, "",
    parts.length ? `Pièces (${parts.length}) :` : "Aucune pièce pour l'instant.", ...parts, asms.length ? `\nAssemblages (${asms.length}) :` : "", ...asms, "",
    `Mis à jour le ${day(when)}.`].filter((l) => l !== "").join("\n").replace(/\n(Ce dossier|Pièces|Aucune pièce|Mis à jour)/g, "\n\n$1") + "\n";
}
const ROOT_README = `DesignOrbit.ai\n\nUn dossier par produit. Chaque dossier contient le projet (fichier .project.dwiz) et, rangés par numéro,\nses pièces, ses assemblages, ses analyses, ses rapports et ses commandes de prototypes.\n\nCes dossiers sont créés par l'application DesignOrbit.ai, qui ne voit dans votre Drive que ce qu'elle y a créé.\n`;

export function createDriveFs(drive, { root = "DesignOrbit.ai" } = {}) {
  const cache = new Map();                                     // key -> folder or file
  const once = async (key, make) => { if (!cache.has(key)) cache.set(key, await make()); return cache.get(key); };
  const rootFolder = () => once("/", async () => {
    const found = await drive.find({ role: "root", mime: FOLDER, limit: 5 });
    if (found[0]) return found[0];
    const f = await drive.createFolder({ name: root, role: "root" });
    await drive.upload({ name: README, mime: "text/plain", bytes: ROOT_README, parent: f.id, role: "readme" });
    return f;
  });
  /** Sub-folder `name` of `parent`, created when missing (the fixed, numbered folders). */
  const folder = (parent, name, role = "folder", props) => once(`${parent}/${name}`, async () => (await drive.find({ parent, name, mime: FOLDER, limit: 5 }))[0] || drive.createFolder({ name, parent, role, props }));
  /** Folder of a project: found by its id whatever its current name, renamed when the project was renamed. */
  async function projectFolder(project, create = true) {
    const key = `project:${project.id}`, name = safeName(project.name || project.id);
    let f = cache.get(key) || (await drive.find({ role: "project", props: { pid: project.id }, mime: FOLDER, limit: 5 }))[0] || null;
    if (!f && create) f = await drive.createFolder({ name, parent: (await rootFolder()).id, role: "project", props: { pid: project.id } });
    else if (f && f.name !== name && create) f = await drive.rename(f.id, name);
    if (f) cache.set(key, f);
    return f;
  }
  /** Folder of one part or assembly: found by its number, named « number — name », renamed with it. */
  async function itemFolder(project, kind, id, name) {
    const pf = await projectFolder(project), parent = (await folder(pf.id, kind === "assembly" ? TREE.assemblies : TREE.parts)).id, key = `${kind}:${project.id}:${id}`, want = itemFolderName(id, name);
    let f = cache.get(key) || (await drive.find({ parent, role: kind, props: { pn: id }, mime: FOLDER, limit: 5 }))[0] || null;
    if (!f) f = await drive.createFolder({ name: want, parent, role: kind, props: { pid: project.id, pn: id } });
    else if (f.name !== want) f = await drive.rename(f.id, want);
    cache.set(key, f);
    return f;
  }
  /** Create or replace the file `name` in folder `parent`. */
  async function put(parent, name, mime, raw, role = "file", props) {
    const bytes = stampText(name, raw);                        // a text file of the tree carries the note of the platform (core/brand.js) ; the note is a comment, the file reads back the same
    const same = (await drive.find({ parent, name, limit: 5 })).find((f) => f.mimeType !== FOLDER);
    return same ? drive.replace(same.id, { mime, bytes }) : drive.upload({ name, mime, bytes, parent, role, props });
  }
  return {
    rootFolder, projectFolder, itemFolder, folder, put,
    /** Projects of this Drive, most recent first: { id (project id), name, updated, folder, link }. */
    async listProjects() {
      const list = await drive.find({ role: "project", mime: FOLDER, limit: 200 });
      return list.map((f) => ({ id: (f.appProperties || {}).pid || f.id, pid: (f.appProperties || {}).pid || null, name: f.name, updated: f.modifiedTime || null, modified: f.modifiedTime || null, folder: f.id, link: f.webViewLink || null }))
        .sort((a, b) => String(b.updated || "").localeCompare(String(a.updated || "")));
    },
    /** Save the project file (named after the project; renamed with it). Returns { folder, file }. */
    async saveProject(project) {
      const f = await projectFolder(project), key = `file:${project.id}`, name = projectFileName(project), text = toDwiz(project);
      let file = cache.get(key) || (await drive.find({ parent: f.id, role: "project-file", limit: 5 }))[0] || null;
      if (file) { file = await drive.replace(file.id, { mime: "text/plain", bytes: text }); if (file.name !== name) file = await drive.rename(file.id, name); }
      else { file = await drive.upload({ name, mime: "text/plain", bytes: text, parent: f.id, role: "project-file", props: { pid: project.id } }); await put(f.id, README, "text/plain", readmeText(project), "readme"); }
      cache.set(key, file);
      return { folder: f, file };
    },
    /** Read a project back from its folder (.dwiz, or the JSON of the first versions). */
    async loadProject(folderId) {
      let found = await drive.find({ parent: folderId, role: "project-file", limit: 5 });
      for (const old of OLD_PROJECT_FILES) if (!found.length) found = await drive.find({ parent: folderId, name: old, limit: 2 });
      if (!found.length) throw new Error("Ce dossier ne contient pas de fichier de projet (.project.dwiz).");
      const text = await drive.text(found[0].id), obj = /^\s*\{/.test(text) ? JSON.parse(text) : fromDwiz(text);
      if (!obj || Array.isArray(obj) || !Array.isArray(obj.parts)) throw new Error("Le fichier de projet lu dans Drive n'est pas un projet DesignOrbit.ai.");
      cache.set(`file:${obj.id}`, found[0]);
      return obj;
    },
    /** Open a project by its id. */
    async openProject(pid) {
      const f = await projectFolder({ id: pid }, false);
      if (!f) throw new Error(`Projet « ${pid} » introuvable dans Google Drive.`);
      return this.loadProject(f.id);
    },
    /** Send the folder of a project to the Drive bin (recoverable for 30 days). */
    async trashProject(pid) { const f = await projectFolder({ id: pid }, false); if (f) await drive.trash(f.id); cache.delete(`project:${pid}`); cache.delete(`file:${pid}`); },
    /** Publish files into the project tree. items: [{ of: {kind, id, name} | path: [folders], name, mime, bytes }]. onStep(done, total, item). */
    async publish(project, items, onStep = () => {}) {
      const pf = await projectFolder(project), out = [];
      let n = 0;
      for (const it of items) {
        let parent = pf.id;
        if (it.of) parent = (await itemFolder(project, it.of.kind, it.of.id, it.of.name)).id;
        else for (const seg of it.path || []) parent = (await folder(parent, safeName(seg))).id;
        const file = await put(parent, safeName(it.name), it.mime, it.bytes, "artifact", { pid: project.id });
        out.push({ ...it, bytes: undefined, id: file.id, link: file.webViewLink || null });
        onStep(++n, items.length, it);
      }
      await put(pf.id, README, "text/plain", readmeText(project), "readme");
      const archived = await this.archiveRemoved(project);
      return { folder: pf, files: out, archived };
    },
    /** Folders of parts and assemblies that left the project go to 99_Archives. Returns their names. */
    async archiveRemoved(project) {
      const pf = await projectFolder(project, false), moved = [];
      if (!pf) return moved;
      for (const [kind, dir, ids] of [["part", TREE.parts, (project.parts || []).map((p) => p.id)], ["assembly", TREE.assemblies, (project.assemblies || []).map((a) => a.id)]]) {
        const parent = (await drive.find({ parent: pf.id, name: dir, mime: FOLDER, limit: 2 }))[0];
        if (!parent) continue;
        for (const f of await drive.find({ parent: parent.id, role: kind, mime: FOLDER, limit: 200 })) {
          if (ids.includes((f.appProperties || {}).pn)) continue;
          await drive.move(f.id, (await folder(pf.id, TREE.archives)).id, parent.id);
          cache.delete(`${kind}:${project.id}:${(f.appProperties || {}).pn}`); moved.push(f.name);
        }
      }
      return moved;
    },
    /** File an order package: 05_Commandes/<date> <number> ×<quantity>/ with the archive and the request for quotation. */
    async saveOrder(project, pkg, { partId, quantity = 1, variant = null } = {}, when = new Date()) {
      const pf = await projectFolder(project), orders = await folder(pf.id, TREE.orders), dir = await folder(orders.id, safeName(`${day(when)} ${partId}${variant ? ` ${variant}` : ""} ×${quantity}`), "order", { pid: project.id, pn: partId });
      const zipFile = await put(dir.id, pkg.name, "application/zip", pkg.bytes, "order-package", { pid: project.id });
      await put(dir.id, "demande_de_prix.txt", "text/plain", pkg.rfq, "order-rfq", { pid: project.id });
      return { folder: dir, file: zipFile };
    },
    /** The tree under a folder, `depth` levels deep: [{ id, name, folder, link, modified, size, children }]. */
    async tree(folderId, depth = 3) {
      const out = [];
      for (const f of await drive.find({ parent: folderId, limit: 200 })) {
        const isFolder = f.mimeType === FOLDER;
        out.push({ id: f.id, name: f.name, folder: isFolder, link: f.webViewLink || null, modified: f.modifiedTime || null, size: f.size ? Number(f.size) : null,
          children: isFolder && depth > 1 ? await this.tree(f.id, depth - 1) : [] });
      }
      return out.sort((a, b) => (a.folder === b.folder ? a.name.localeCompare(b.name, "fr") : a.folder ? -1 : 1));
    },
    forget: () => cache.clear(),
  };
}
