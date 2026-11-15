/* DesignWizard.ai — application shell: top bar, hash router (#/module/arg/...), module registry, kernel status,
   project menu, global shortcuts (undo / redo, Ctrl+K wand, paste or drop anything to import). */

import { mountCodeSwitch } from "./code_view.js";
import { el, clear, icon, btn, toast, modal, installTips, download, confirmBox, promptBox } from "./dom.js";
import { store } from "./store.js";
import { kernel } from "../cad/client.js";
import { session, signOut } from "./access.js";
import { THEMES, currentTheme, applyTheme } from "./theme.js";
import { toDwiz } from "./dwiz.js";
import { dwizFileName } from "./dwiz_names.js";

export const APP_VERSION = "0.21.0";
const modules = new Map();
const ORDER = ["home", "shop", "parts", "extrusion", "pcb", "pcba", "assembly", "physics", "creepage", "dfx", "drawings", "review", "report"];
const GROUP_BREAK = new Set(["shop", "assembly", "physics", "review"]);         // a pencil tick before these tabs
export const app = { modules, context: {}, version: APP_VERSION, current: null, cleanup: null, commands: [] };

/** Register a tool: {key, label, icon, tip, hidden, render(main, args) -> cleanup?}. */
export function registerModule(def) { modules.set(def.key, def); }
export function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }
export function setContext(ctx) { app.context = ctx || {}; }

let shellOff = [];                                             // listeners of the current top bar (it is rebuilt on a theme change)
function topbar() {
  shellOff.forEach((off) => off()); shellOff = [];
  const tabs = el("nav", { class: "tabs", "aria-label": "Outils" });
  for (const key of ORDER) {
    const m = modules.get(key);
    if (!m || m.hidden) continue;
    if (GROUP_BREAK.has(key)) tabs.append(el("span", { class: "tab-sep", "aria-hidden": "true" }));
    tabs.append(el("a", { class: "tab", href: `#/${key}`, "data-key": key, "data-tip": m.tip }, icon(m.icon), el("span", null, m.label)));
  }
  const chip = el("span", { class: "chip", id: "kernel-chip" }, "Prêt");
  shellOff.push(kernel.onStage((s) => setStatus(s || "Prêt", s ? "busy" : "")));
  const save = el("span", { class: "chip", id: "save-chip", "data-tip": "État de l'enregistrement du projet" }, "—");
  const showSave = (s) => { save.textContent = s === "saved" ? (store.mode === "drive" ? "Enregistré dans Drive" : "Enregistré") : s === "saving" ? "Enregistrement…" : s === "dirty" ? "Modifié…" : s ? "Non enregistré" : "—"; save.className = "chip" + (s === "error" ? " bad" : s === "saved" ? " done" : s ? " busy" : ""); };
  showSave(store.project ? store.saveState : null);
  shellOff.push(store.on("saved", showSave), store.on("project", () => showSave(store.project ? store.saveState : null)), session.on(() => rebuildShell()));
  const wand = el("button", { class: "wand", type: "button", "data-tip": "La baguette : tapez ce que vous voulez faire (« 4 trous M4 aux coins », « longueur 150 », « aller à Assemblage »…)", onClick: () => app.openPalette && app.openPalette() },
    icon("wizard"), el("span", { class: "wand-text" }, "Que voulez-vous faire ?"), el("kbd", null, "Ctrl K"));
  const tools = el("div", { class: "top-tools" }, wand, chip, save, mountCodeSwitch(app),
    btn("", () => app.aiLoop && app.aiLoop(), { icon: "sparkle", small: true, tip: "Confier à l'IA : exporter ce que montre l'écran (pièce, assemblage, carte) avec une demande, réimporter la réponse et voir les changements avant de les appliquer" }),
    btn("", () => store.undo() || toast("Rien à annuler."), { icon: "undo", small: true, tip: "Annuler (Ctrl+Z)" }),
    btn("", () => store.redo() || toast("Rien à rétablir."), { icon: "redo", small: true, tip: "Rétablir (Ctrl+Y)" }),
    menuButton("Onshape", "onshape", onshapeMenu), menuButton("Projet", "folder", projectMenu),
    menuButton("", session.account && session.account.admin ? "admin" : "user", accountMenu, session.account ? `Compte : ${session.account.email}` : "Compte Google, Drive et thème"),
    el("a", { class: "btn btn-small", href: "#/help", "data-tip": "Aide, raccourcis et guide des collaborateurs" }, icon("help")));
  return el("header", { class: "topbar" },
    el("a", { class: "brand", href: "#/home", "aria-label": "DesignWizard.ai, accueil" }, icon("logo", "brand-logo"),
      el("span", { class: "brand-name" }, el("b", null, "DesignWizard", el("i", null, ".ai")), el("small", null, "by DynamiteAgile™"))),
    tabs, tools);
}
export function setStatus(text, cls = "") { const c = document.getElementById("kernel-chip"); if (c) { c.textContent = text; c.className = "chip " + cls; c.title = text; } }

function menuButton(label, ico, build, tip) {
  const wrap = el("div", { class: "menu-wrap" });
  const b = btn(label, () => {
    const open = wrap.querySelector(".menu");
    document.querySelectorAll(".menu").forEach((m) => m.remove());
    if (open) return;
    const menu = el("div", { class: "menu", role: "menu" });
    build(menu, () => menu.remove());
    wrap.append(menu);
  }, { icon: ico, small: true, tip });
  wrap.append(b);
  return wrap;
}
/** Rebuild the top bar and the current screen (theme changed, account signed in or out). */
export function rebuildShell() { const old = document.querySelector("header.topbar"); if (old) old.replaceWith(topbar()); route(); }
const item = (label, ico, fn, close) => el("button", { class: "menu-item", type: "button", role: "menuitem", onClick: () => { close(); fn(); } }, icon(ico), label);

async function projectMenu(menu, close) {
  const p = store.project;
  menu.append(el("div", { class: "menu-title" }, p ? p.name : "Aucun projet ouvert"));
  menu.append(item("Tous les projets", "folder", () => go("#/home"), close));
  menu.append(item("Nouveau projet…", "plus", async () => { const name = await promptBox("Nouveau projet", "Nom du projet", "Mon produit"); if (name) { await store.create(name); go("#/shop"); } }, close));
  menu.append(item("Premier design avec une IA…", "wizard", () => app.firstDesign && app.firstDesign(), close));
  if (p) {
    menu.append(el("hr"));
    menu.append(item("Renommer le projet…", "edit", async () => { const name = await promptBox("Renommer", "Nom du projet", p.name); if (name) store.commit(`Projet renommé : ${name}`, (x) => { x.name = name; }); }, close));
    menu.append(item("Confier à l'IA…", "sparkle", () => app.aiLoop && app.aiLoop(), close));
    menu.append(item("Itérations MVP et revues…", "check", () => go("#/mvp"), close));
    menu.append(item("Bibliothèque électrique…", "power", () => go("#/library"), close));
    menu.append(item("Busbars et contacts…", "power", () => go("#/busbar"), close));
    menu.append(item("Exporter le projet (.dwiz)", "download", () => download(dwizFileName(p), toDwiz(p), "text/plain;charset=utf-8"), close));
    menu.append(item("Exporter en JSON", "download", () => download(`${p.id}.dwproject.json`, store.exportJson(), "application/json"), close));
  }
  menu.append(item("Importer un projet ou une pièce…", "upload", () => app.pickFile && app.pickFile(), close));
  if (session.configured && store.mode !== "drive") menu.append(item("Ouvrir depuis Google Drive…", "cloud", () => app.openFromDrive && app.openFromDrive(), close));
  menu.append(el("hr"));
  menu.append(el("div", { class: "menu-title" }, store.mode === "server" ? "Serveur local : projets sur le disque" : store.mode === "drive" ? "Projets dans votre Google Drive, dossier « DesignWizard.ai »" : "Mode navigateur : projets gardés dans ce navigateur"));
}
function accountMenu(menu, close) {
  const a = session.account, cur = currentTheme();
  menu.append(el("div", { class: "menu-title" }, a ? a.email : session.configured ? "Non connecté à Google" : "Connexion Google non configurée"));
  if (a) { if (store.project && store.mode !== "drive") menu.append(item("Enregistrer le projet dans Drive", "save", () => app.saveToDrive && app.saveToDrive(), close)); menu.append(item("Se déconnecter", "lock", () => { signOut(); if (store.mode === "drive") location.reload(); }, close)); }
  else if (session.configured) menu.append(item("Se connecter avec Google", "user", () => app.connect && app.connect(), close));
  menu.append(item("Compte, Drive et accès", "cloud", () => go("#/account"), close), el("hr"), el("div", { class: "menu-title" }, "Thème"));
  for (const t of THEMES) { const it = item(t.label, t.key === cur ? "check" : "palette", () => { applyTheme(t.key); rebuildShell(); }, close); if (t.key === cur) it.classList.add("on"); menu.append(it); }
}
function onshapeMenu(menu, close) {
  menu.append(el("div", { class: "menu-title" }, "Onshape"));
  menu.append(item("Connexion et envoi vers Onshape", "onshape", () => go("#/onshape"), close));
  menu.append(el("div", { class: "menu-title" }, store.mode === "server" ? "Les clés restent sur ce poste." : "Demande le serveur local (python designwizard.py)."));
}

function route() {
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  const key = modules.has(parts[0]) ? parts[0] : "home";
  const main = document.getElementById("main");
  if (app.cleanup) { try { app.cleanup(); } catch (e) { console.error(e); } app.cleanup = null; }
  clear(main);
  app.context = {}; app.current = key; app.commands = [];
  document.documentElement.dataset.module = key;
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.key === (key === "mvp" ? "review" : key === "library" || key === "busbar" ? "shop" : key)));
  const tab = document.querySelector(".tab.active"); if (tab && tab.scrollIntoView) tab.scrollIntoView({ block: "nearest", inline: "nearest" });      // the tool in use stays in sight in a narrow bar
  const m = modules.get(key);
  document.title = `${m.label} · DesignWizard.ai`;
  if (!store.project && !["home", "help", "account"].includes(key)) {
    main.append(el("div", { class: "page" }, el("div", { class: "empty" }, el("h2", null, "Aucun projet ouvert"),
      el("p", null, "Ouvrez un projet ou chargez la démonstration pour utiliser cet outil."), el("a", { class: "btn btn-primary", href: "#/home" }, "Aller à l'accueil"))));
    return;
  }
  try { const c = m.render(main, parts.slice(1)); if (typeof c === "function") app.cleanup = c; }
  catch (e) { console.error(e); main.append(el("div", { class: "page" }, el("div", { class: "card" }, el("h2", null, "Cet écran n'a pas pu s'afficher"), el("p", { class: "form-error" }, e.message)))); }
}

export async function start() {
  installTips();
  document.body.append(topbar(), el("main", { id: "main" }));
  store.on("error", (e) => toast(e.message, "error", 8000));
  await store.init();
  const last = store.lastId();
  if (last) { try { await store.open(last); } catch (e) { /* the project is gone: stay on the home page */ } }
  if (!store.project) { try { const list = await store.list(); if (list.length) await store.open(list[0].id); } catch (e) { /* no project yet */ } }   // reopen the most recent one
  window.addEventListener("hashchange", route);
  document.addEventListener("keydown", (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName);
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === "k") { e.preventDefault(); app.openPalette && app.openPalette(); }
    else if (mod && !typing && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); const l = store.undo(); toast(l ? `Annulé : ${l}` : "Rien à annuler."); }
    else if (mod && !typing && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) { e.preventDefault(); const l = store.redo(); toast(l ? `Rétabli : ${l}` : "Rien à rétablir."); }
    else if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); store.saveNow().then(() => toast("Projet enregistré.", "success")); }
  });
  document.addEventListener("click", (e) => { if (!e.target.closest(".menu-wrap")) document.querySelectorAll(".menu").forEach((m) => m.remove()); });
  window.addEventListener("beforeunload", () => { if (store.saveState === "dirty") store.saveNow(); });
  if (!location.hash) location.hash = "#/home";
  route();
}

/** Re-render the current screen (after an undo, an import...). */
export function refresh() { route(); }
export { modal, confirmBox };
