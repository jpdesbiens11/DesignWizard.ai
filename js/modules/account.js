/* DynamiteOrbit.ai — Compte: Google sign-in, the project as a folder tree in the user's own Google Drive, the theme,
   and — for the administrator — the list of accounts approved for the hosted demo (hashes only, see core/access.js). */

import { el, clear, icon, btn, badge, field, toast, modal, copyText, download, fmt, debounce } from "../core/dom.js";
import { pageVeil } from "../core/busy.js";
import { registerModule, refresh, setStatus, rebuildShell, iconScaleRow } from "../core/app.js";
import { store } from "../core/store.js";
import { session, signIn, signOut, shortHash } from "../core/access.js";
import { accessCard } from "./account_access.js";
import { authMessage } from "../google/auth.js";
import { THEMES, currentTheme, applyTheme } from "../core/theme.js";
import { projectArtifacts } from "../core/artifacts.js";
import { CONFIG } from "../config.js";
import { releaseFiles } from "../core/plm.js";
import { toDwiz } from "../core/dwiz.js";
import { TREE } from "../google/drive_fs.js";

const AUTO = "dw.drive.auto";
const autoOn = () => { try { return localStorage.getItem(AUTO) === "1"; } catch (e) { return false; } };
const sayError = (e) => toast(e && e.status ? `Google Drive : ${e.message}` : authMessage(e), "error", 7000);

/* Keep the project file in Drive up to date after each local save, when the user asked for it. */
const pushLater = debounce(async () => {
  if (!session.account || !store.project || !autoOn() || store.mode === "drive") return;
  try { await session.fs.saveProject(store.project); setStatus("Projet enregistré dans Drive", "done"); } catch (e) { setStatus("Drive : enregistrement impossible", "bad"); }
}, 4000);
store.on("saved", (s) => { if (s === "saved") pushLater(); });

export async function connect(choose = false) {
  try { const a = await signIn({ choose }); toast(`Connecté à Google${a.admin ? " — administrateur" : ""}.`, "success"); return a; }
  catch (e) { sayError(e); return null; }
}
export async function saveToDrive() {
  if (!session.account && !(await connect())) return null;
  try {
    setStatus("Enregistrement dans Drive…", "busy");
    const r = await session.fs.saveProject(store.project);
    setStatus("Projet enregistré dans Drive", "done"); toast(`Projet enregistré dans Drive : ${r.folder.name}.`, "success");
    return r;
  } catch (e) { setStatus("Drive : erreur", "bad"); sayError(e); return null; }
}
export async function openFromDrive() {
  if (!session.account && !(await connect())) return;
  try {
    const list = await session.fs.listProjects();
    if (!list.length) { toast("Aucun projet DynamiteOrbit.ai dans ce Drive pour l'instant.", "info"); return; }
    const m = modal("Ouvrir depuis Google Drive", el("div", { class: "grid" }, list.map((p) => el("button", { class: "card lift", type: "button", onClick: async () => {
      m.close();
      const veil = pageVeil(); let off = false;      // reading can be called off ; once the project is being written here, it is left to finish
      veil.set(`Lecture de « ${p.name} » dans Google Drive…`, { kind: "drive", cancel: () => { off = true; veil.set(""); toast("Ouverture annulée : rien n'a été ajouté à vos projets.", "info"); } });
      try { const obj = await session.fs.loadProject(p.folder); if (off) return; veil.set(`Ouverture de « ${obj.name || p.name} »…`, { kind: "drive" }); await store.create(obj.name || p.name, obj); veil.set(""); toast(`Projet « ${obj.name || p.name} » ouvert depuis Drive.`, "success"); refresh(); } catch (e) { veil.set(""); if (!off) sayError(e); }
    } }, el("h3", null, icon("folder"), " ", p.name), el("p", { class: "muted small" }, p.updated ? new Date(p.updated).toLocaleString("fr-CA") : "")))), { wide: true });
  } catch (e) { sayError(e); }
}
export async function publishToDrive(onStep = () => {}) {
  if (!session.account && !(await connect())) return null;
  try {
    const { items, errors } = await projectArtifacts((t) => { setStatus(t, "busy"); onStep(t); });
    items.push(...releaseFiles(store.project, toDwiz, TREE.revisions));      // each released revision in a folder of its own
    await session.fs.saveProject(store.project);
    const r = await session.fs.publish(store.project, items, (i, n, it) => { setStatus(`Drive : ${i} / ${n} — ${it.name}`, "busy"); onStep(`${i} / ${n} — ${it.name}`); });
    setStatus(`${r.files.length} fichier(s) publiés dans Drive`, "done");
    toast(`${r.files.length} fichier(s) publiés dans « ${r.folder.name} »${r.archived.length ? ` ; ${r.archived.length} dossier(s) de pièces retirées rangé(s) dans 99_Archives` : ""}${errors.length ? ` ; ${errors.length} artéfact(s) non produits` : ""}.`, errors.length ? "warn" : "success", 7000);
    return { ...r, errors };
  } catch (e) { setStatus("Drive : erreur", "bad"); sayError(e); return null; }
}

function render(main) {
  const page = el("div", { class: "page" });
  main.append(page);
  page.append(el("div", { class: "page-head" }, el("div", { class: "grow" }, el("h1", null, "Compte, Drive et accès"),
    el("p", { class: "muted" }, "Vos fichiers restent chez vous : sur ce poste, ou dans votre propre Google Drive. L'application ne voit que les fichiers qu'elle a créés."))));
  const grid = el("div", { class: "account-grid" });
  page.append(grid);
  const who = el("section", { class: "card taped" }), drive = el("section", { class: "card taped" }), theme = el("section", { class: "card taped" }), access = el("section", { class: "card taped access-card" });
  grid.append(who, drive, theme, access);
  let tree = null;

  function drawWho() {
    clear(who); who.append(el("h2", null, "Compte Google"));
    const a = session.account;
    if (!session.configured) {
      who.append(el("p", null, "La connexion Google n'est pas configurée sur ce site : il manque l'identifiant client OAuth (public) dans ", el("code", null, "web/js/config.js"), "."),
        el("p", { class: "muted small" }, "Cinq minutes dans la console Google Cloud suffisent ; la marche à suivre est dans ", el("a", { href: `https://github.com/${CONFIG.repo}/blob/main/docs/GOOGLE.md`, target: "_blank", rel: "noopener noreferrer" }, "docs/GOOGLE.md"), ". Sans compte, tout le reste de l'application fonctionne."));
      return;
    }
    if (!a) { who.append(el("p", null, "Connectez-vous pour ranger le projet dans votre Google Drive et le retrouver sur un autre poste."), el("div", { class: "form-actions", style: { justifyContent: "flex-start" } }, btn("Se connecter avec Google", async () => { await connect(); }, { primary: true, icon: "user" }))); return; }
    who.append(el("div", { class: "who" }, icon(a.admin ? "admin" : "user"), el("div", null, el("b", null, a.name), el("small", null, a.email))),
      el("p", null, a.admin ? badge("Administrateur", "ok") : a.approved ? badge("Compte approuvé", "ok") : badge(session.hosted ? "Non approuvé" : "Usage local", "neutral"), " ", el("span", { class: "muted small", "data-tip": a.hash || "" }, a.hash ? `empreinte ${shortHash(a.hash)}…` : "")),
      el("div", { class: "form-actions", style: { justifyContent: "flex-start" } }, btn("Autre compte", () => connect(true), { small: true, icon: "refresh" }), btn("Se déconnecter", () => signOut(), { small: true, icon: "lock" })));
  }

  function drawDrive() {
    clear(drive); drive.append(el("h2", null, "Google Drive"));
    if (!session.configured) { drive.append(el("p", { class: "muted" }, "Disponible une fois la connexion Google configurée.")); return; }
    const auto = el("input", { type: "checkbox", checked: autoOn(), onChange: (e) => { try { localStorage.setItem(AUTO, e.target.checked ? "1" : "0"); } catch (x) { /* private window */ } if (e.target.checked) pushLater(); } });
    drive.append(el("p", { class: "muted small" }, "Le projet devient un dossier lisible par tous : pièces, assemblages, analyses, rapports — STEP, STL, DXF, PDF, FeatureScript et gammes rangés par numéro de pièce."),
      el("div", { class: "form-actions", style: { justifyContent: "flex-start" } },
        store.mode === "drive" ? null : btn("Enregistrer le projet", async () => { if (await saveToDrive()) loadTree(); }, { primary: true, icon: "save", disabled: !store.project }),
        btn("Publier les artéfacts", async () => { if (await publishToDrive()) loadTree(); }, { icon: "export", disabled: !store.project, tip: "Construit et dépose tous les fichiers d'échange de chaque pièce et de chaque assemblage" }),
        store.mode === "drive" ? null : btn("Ouvrir depuis Drive…", () => openFromDrive(), { icon: "folder" })),
      store.mode === "drive" ? el("p", { class: "small" }, icon("check"), " Google Drive est le stockage de cette application : chaque modification y est enregistrée.") : el("label", { class: "check" }, auto, "Enregistrer le projet dans Drive après chaque modification"));
    const box = el("div", { style: { marginTop: ".7rem" } });
    drive.append(box);
    if (!session.account) { box.append(el("p", { class: "muted small" }, "Connectez-vous pour voir l'arborescence.")); return; }
    if (!tree) { box.append(btn("Afficher l'arborescence du projet", () => loadTree(), { small: true, icon: "refresh" })); return; }
    box.append(el("h3", null, el("span", { class: "grow" }, tree.folder ? tree.folder.name : "Dossier du projet"), tree.folder && tree.folder.webViewLink ? el("a", { class: "btn btn-small", href: tree.folder.webViewLink, target: "_blank", rel: "noopener noreferrer" }, icon("external"), "Ouvrir dans Drive") : null));
    const node = (list) => el("ul", { class: "drive-tree" }, list.map((f) => el("li", null,
      f.link ? el("a", { href: f.link, target: "_blank", rel: "noopener noreferrer" }, icon(f.folder ? "folder" : "copy"), f.name, f.size ? el("small", null, `${fmt(f.size / 1024, 0)} Ko`) : null) : el("span", null, icon(f.folder ? "folder" : "copy"), f.name),
      f.children && f.children.length ? node(f.children) : null)));
    box.append(tree.items.length ? node(tree.items) : el("p", { class: "muted small" }, "Ce projet n'est pas encore dans Drive : enregistrez-le."));
  }
  async function loadTree() {
    if (!session.account || !store.project) return;
    try { const f = await session.fs.projectFolder(store.project, false); tree = { folder: f, items: f ? await session.fs.tree(f.id, 4) : [] }; } catch (e) { sayError(e); tree = { folder: null, items: [] }; }
    drawDrive();
  }

  function drawTheme() {
    clear(theme); theme.append(el("h2", null, "Thème"));
    const cur = currentTheme();
    theme.append(el("div", { class: "theme-grid" }, THEMES.map((t) => el("button", { class: "stock-card" + (t.key === cur ? " on" : ""), type: "button", "aria-pressed": t.key === cur ? "true" : "false", onClick: () => { applyTheme(t.key); rebuildShell(); } },
      icon("palette"), el("b", null, t.label), el("small", null, t.text)))));
    theme.append(el("div", { class: "account-icon-scale" }, el("h3", null, "Taille des icônes du haut de la fenêtre"),
      el("p", { class: "muted small" }, "La barre du haut, le fil d'Ariane, les onglets de travail et la tête des volets de gauche et de droite. Le texte garde sa taille ; ce navigateur garde le choix."),
      iconScaleRow()));
  }

  const drawAccess = () => accessCard(access);      // the list of accounts, said clearly (modules/account_access.js)

  const redraw = () => { drawWho(); drawDrive(); drawAccess(); };
  const off = session.on(() => { tree = null; redraw(); });
  drawWho(); drawDrive(); drawTheme(); drawAccess();
  return () => off();
}

registerModule({ key: "account", label: "Compte", icon: "user", hidden: true, tip: "Compte Google, Google Drive, thème et accès à la démo", render });
