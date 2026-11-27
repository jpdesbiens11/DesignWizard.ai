/* DynamiteOrbit.ai — application shell: top bar, hash router (#/module/arg/...), module registry, kernel status,
   project menu, global shortcuts (undo / redo, Ctrl+K wand, paste or drop anything to import). */

import { mountCodeSwitch } from "./code_view.js";
import { el, clear, icon, btn, toast, modal, installTips, download, confirmBox, promptBox } from "./dom.js";
import { store } from "./store.js";
import { kernel } from "../cad/client.js";
import { session, signOut } from "./access.js";
import { THEMES, currentTheme, applyTheme, SCALES, currentScale, applyScale, ICON_SCALES, currentIconScale, applyIconScale } from "./theme.js";
import { toDwiz } from "./dwiz.js";
import { dwizFileName } from "./dwiz_names.js";
import { mountPanes, mountBottom } from "./panes.js";
import { guideBox, guideCount, guideSummary } from "./guide.js";
import { projectIssues, issuesHere } from "./guide_checks.js";
import { firstStepHere } from "./first_steps.js";
import { docIdentity } from "./brand.js";
import { unitPicker } from "./units_ui.js";
import { installBoardNames, boardNamePicker } from "./board_names_ui.js";
import { installStepper } from "./stepper.js";
import { installFolds } from "./fold.js";
import { installStairs } from "./stairs_ui.js";
import { installWhere } from "./where_ui.js";
import { installShare } from "./share_ui.js";
import { installPanelKeep } from "./panel_keep.js";
import { installLoupe } from "./loupe.js";
import { installUpdateCheck, versionChip, sayUpdated } from "./update_check.js";
import { installWhatsNew, newsButton } from "./whats_new_ui.js";

export const APP_VERSION = "0.204.0";
/** What every document of the open project carries beside its content : approval names, organisation, confidentiality note, extraction stamp (core/brand.js). */
export const docMeta = (when = new Date()) => docIdentity(store.project, when, APP_VERSION);
const modules = new Map();
/* the tools of the top bar, by discipline (demande de JP : « des drop down visuels, ou flip down, par groupes de modules de conception — du haut jusqu'à la
   simulation — par discipline ») : each group flips down its screens, from the one where one designs to the one where one simulates */
export const NAV = [
  { id: "mech", label: "Mécanique", icon: "part", color: "#2563eb", hint: "De l'intention à la simulation", keys: ["mreq", "shop", "parts", "assembly", "drawings", "physics", "fab"], also: { fea: "physics" }, tiles: { physics: { label: "Physique · Simulation", sub: "Calcul à la main, puis éléments finis" } } },
  { id: "elec", label: "Électronique", icon: "chip", color: "#16a34a", hint: "De la carte nue au banc d'essai", keys: ["ereq", "pcb", "pcba", "elab", "creepage"] },
  { id: "soft", label: "Logiciel", icon: "code", color: "#0891b2", hint: "Des exigences du produit au paquet livré, par le cycle en V", keys: ["lreq", "swreq", "swarch", "sw", "swsim", "swcode", "swtest", "swrel", "swref"] },
  { id: "product", label: "Produit", icon: "report", color: "#7c3aed", hint: "Règles, revue, dossier", keys: ["dfx", "review", "report", "history", "eco"] },
];
const SHOP_SCREENS = new Set(["interfaces", "process", "extrusion", "library", "busbar", "flex"]);      // screens of the Shop : its tab stays lit on them (see modules/shop_tabs.js)
export const app = { modules, context: {}, version: APP_VERSION, current: null, cleanup: null, commands: [] };

/** Register a tool: {key, label, icon, tip, hidden, render(main, args) -> cleanup?}. */
export function registerModule(def) { modules.set(def.key, def); }
export function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }
export function setContext(ctx) { app.context = ctx || {}; }

/* ---------- the guide of the top bar : what is missing or odd, on this screen and in the project ---------- */
/** What only the current screen knows (the brief of the Shop, the load case of a simulation) : it hands its list here. */
export function setGuide(list) { app.guide = Array.isArray(list) ? list : []; refreshGuide(); }
function guideLists() {
  const args = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent), key = app.current || "home";
  const ref = (key === "parts" || key === "assembly") && args[1] ? args[1] : null, all = store.project ? projectIssues(store.project) : [];
  const step = key === "start" ? null : firstStepHere(store.project, key);      // the first steps : what one does on this screen, until the project shows it is done
  const here = [...(app.guide || []), ...(key === "home" || key === "help" ? [] : issuesHere(all, key, ref)), ...(step ? [step] : [])], taken = new Set(here);
  return { here, rest: all.filter((x) => !taken.has(x)) };
}
function refreshGuide() {
  const b = document.getElementById("guide-btn"); if (!b) return;
  const g = guideLists(), c = guideCount(g.here), n = c.blocking + c.warn, all = guideSummary([...g.here, ...g.rest]);
  b.querySelector(".guide-n").textContent = n ? String(n) : ""; b.classList.toggle("block", c.blocking > 0); b.classList.toggle("warn", !c.blocking && c.warn > 0);
  b.dataset.tip = n ? `Guide — sur cet écran : ${guideSummary(g.here)}` : all ? `Guide — rien à signaler sur cet écran ; dans le projet : ${all}` : "Guide — rien à signaler";
}
function guideButton() {
  const wrap = el("div", { class: "menu-wrap" }), shut = () => { const m = wrap.querySelector(".menu"); if (m) m.remove(); };
  const follow = (x) => { shut(); if (x.go) x.go(); else if (x.hash) go(x.hash); };
  const open = () => {
    const was = wrap.querySelector(".menu"); document.querySelectorAll(".menu").forEach((m) => m.remove()); if (was) return;
    const g = guideLists(), m = modules.get(app.current || "home");
    wrap.append(el("div", { class: "menu guide-pop", role: "dialog", "aria-label": "Guide" }, el("h4", null, `Sur cet écran — ${m ? m.label : ""}`), guideBox(g.here, { go: follow, max: 8, quiet: "Rien à signaler ici." }),
      el("h4", null, "Ailleurs dans le projet"), guideBox(g.rest, { go: follow, max: 8, quiet: "Rien à signaler." }),
      el("p", { class: "muted small" }, "Le guide se met à jour pendant que vous travaillez. Un clic sur une ligne mène à l'endroit. ", el("a", { href: "#/help", onClick: shut }, "Aide et raccourcis →"))));
  };
  wrap.append(el("button", { class: "btn btn-small guide-btn", type: "button", id: "guide-btn", "aria-haspopup": "dialog", "data-tip": "Guide", onClick: open }, icon("info"), el("span", null, "Guide"), el("b", { class: "guide-n", "aria-live": "polite" })));
  return wrap;
}

/* the borders of the side panels of a studio : put when a screen draws its studio, again when it rebuilds it */
let panesWatch = null;
function studioPanes(main, key) {
  const put = () => { main.querySelectorAll(".studio").forEach((s) => mountPanes(s, key)); main.querySelectorAll(".bottom-pane").forEach((b) => mountBottom(b)); };      // wherever the studio stands in the page : under a header of its own too (the PCBA) ; and the panel at the bottom of a centre
  let due = false; const soon = () => { if (due) return; due = true; requestAnimationFrame(() => { due = false; put(); }); };
  if (panesWatch) panesWatch.disconnect();
  put(); if (typeof MutationObserver !== "undefined") { panesWatch = new MutationObserver(soon); panesWatch.observe(main, { childList: true, subtree: true }); }
}

let shellOff = [];                                             // listeners of the current top bar (it is rebuilt on a theme change)
function topbar() {
  shellOff.forEach((off) => off()); shellOff = [];
  const tabs = el("nav", { class: "tabs", "aria-label": "Outils" }), home = modules.get("home");
  if (home) tabs.append(el("a", { class: "tab", href: "#/home", "data-key": "home", "data-tip": home.tip }, icon(home.icon), el("span", null, home.label)));
  for (const G of NAV) {
    const wrap = el("div", { class: "menu-wrap nav-wrap" }), close = () => { const m = wrap.querySelector(".menu"); if (m) m.remove(); b.setAttribute("aria-expanded", "false"); };
    const b = el("button", { class: "tab nav-group", type: "button", "data-group": G.id, "data-key": "", "aria-haspopup": "true", "aria-expanded": "false", "data-tip": `${G.label} — ${G.hint.toLowerCase()}`, style: `--tab-acc:${G.color}`, onClick: () => {
      const open = wrap.querySelector(".menu"); document.querySelectorAll(".menu").forEach((m) => m.remove()); document.querySelectorAll(".nav-group").forEach((x) => x.setAttribute("aria-expanded", "false")); if (open) return;
      const list = G.keys.map((k) => [k, modules.get(k)]).filter(([, m]) => m), pop = el("div", { class: "menu nav-pop", role: "menu", "aria-label": G.label, style: `--dom:${G.color}` }, el("p", { class: "nav-hint" }, icon(G.icon), el("b", null, G.label), el("small", null, G.hint)),
        list.map(([k, m], i) => el("a", { class: "nav-tile" + (b.dataset.key === k ? " on" : ""), href: `#/${k}`, role: "menuitem", "data-nav": k, onClick: close }, el("span", { class: "nav-step", "aria-hidden": "true" }, String(i + 1)), icon(m.icon), el("span", { class: "nav-text" }, el("b", null, (G.tiles && G.tiles[k] || m).label), el("small", null, G.tiles && G.tiles[k] ? G.tiles[k].sub : String(m.tip || "").split(/ : | — |\. /)[0])))));
      wrap.append(pop); b.setAttribute("aria-expanded", "true"); const first = pop.querySelector(".nav-tile.on") || pop.querySelector(".nav-tile"); if (first) first.focus();
      pop.addEventListener("keydown", (e) => { const t = [...pop.querySelectorAll(".nav-tile")], i = t.indexOf(document.activeElement); if (e.key === "ArrowDown") { e.preventDefault(); t[(i + 1) % t.length].focus(); } else if (e.key === "ArrowUp") { e.preventDefault(); t[(i - 1 + t.length) % t.length].focus(); } });
    } }, icon(G.icon), el("span", { class: "nav-name" }, G.label), icon("chevron-down", "nav-chev"));
    wrap.append(b); tabs.append(wrap);
  }
  const chip = el("span", { class: "chip", id: "kernel-chip" }, "Prêt");
  shellOff.push(kernel.onStage((s) => setStatus(s || "Prêt", s ? "busy" : "")));
  const save = el("span", { class: "chip", id: "save-chip", "data-tip": "État de l'enregistrement du projet" }, "—");
  const showSave = (s) => { save.textContent = s === "saved" ? (store.mode === "drive" ? "Enregistré dans Drive" : "Enregistré") : s === "saving" ? "Enregistrement…" : s === "dirty" ? "Modifié…" : s ? "Non enregistré" : "—"; save.className = "chip" + (s === "error" ? " bad" : s === "saved" ? " done" : s ? " busy" : ""); };
  showSave(store.project ? store.saveState : null);
  shellOff.push(store.on("saved", showSave), store.on("project", () => showSave(store.project ? store.saveState : null)), session.on(() => rebuildShell()));
  const wand = el("button", { class: "wand", type: "button", "data-tip": "La baguette (Ctrl + K) : tapez ce que vous voulez faire (« 4 trous M4 aux coins », « longueur 150 », « aller à Assemblage »…)", onClick: () => app.openPalette && app.openPalette() },
    icon("wizard"), el("span", { class: "wand-text" }, "Que voulez-vous faire ?"), el("kbd", null, "Ctrl K"));
  const tools = el("div", { class: "top-tools" }, wand, chip, save, mountCodeSwitch(app),
    btn("", () => app.aiLoop && app.aiLoop(), { icon: "sparkle", small: true, tip: "Confier à l'IA : exporter ce que montre l'écran (pièce, assemblage, carte) avec une demande, réimporter la réponse et voir les changements avant de les appliquer" }),
    btn("", () => store.undo() || toast("Rien à annuler."), { icon: "undo", small: true, tip: "Annuler (Ctrl+Z)" }),
    btn("", () => store.redo() || toast("Rien à rétablir."), { icon: "redo", small: true, tip: "Rétablir (Ctrl+Y)" }),
    menuButton("Onshape", "onshape", onshapeMenu), menuButton("Projet", "folder", projectMenu),
    menuButton("", session.account && session.account.admin ? "admin" : "user", accountMenu, session.account ? `Compte : ${session.account.email}` : "Compte Google, Drive et thème"),
    newsButton(), guideButton(), el("a", { class: "btn btn-small", href: "#/help", "data-tip": "Aide, raccourcis et guide des collaborateurs" }, icon("help")));
  return el("header", { class: "topbar" },
    el("a", { class: "brand", href: "#/home", "aria-label": "DynamiteOrbit.ai, accueil" }, icon("logo", "brand-logo"),
      el("span", { class: "brand-name" }, el("b", null, "DynamiteOrbit", el("i", null, ".ai")), el("small", null, "by DynamiteAgile™"))),
    versionChip(), tabs, tools);
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
  menu.append(item("Rejoindre un projet partagé (Drive)…", "cloud", () => import("../modules/team.js").then((m) => m.joinFromDrive()), close));
  menu.append(item("Rejoindre un projet partagé (fichier)…", "link", () => import("../modules/team.js").then((m) => { const i = document.createElement("input"); i.type = "file"; i.accept = ".dwiz,.txt"; i.addEventListener("change", () => { if (i.files[0]) m.joinFromFile(i.files[0]); }); i.click(); }), close));
  if (p) {
    menu.append(el("hr"));
    menu.append(item("Renommer le projet…", "edit", async () => { const name = await promptBox("Renommer", "Nom du projet", p.name); if (name) store.commit(`Projet renommé : ${name}`, (x) => { x.name = name; }); }, close));
    menu.append(item("Confier à l'IA…", "sparkle", () => app.aiLoop && app.aiLoop(), close));
    menu.append(item("Itérations MVP et revues…", "check", () => go("#/mvp"), close));
    menu.append(item("Équipe et messages…", "link", () => go("#/team"), close));
    menu.append(item("Révisions et numéros…", "lock", () => go("#/plm"), close));
    menu.append(item("Historique et points de restauration…", "history", () => go("#/history"), close));
    menu.append(item("Écosystème — tout le produit pour une IA…", "branch", () => go("#/eco"), close));
    menu.append(item("Bibliothèque électrique…", "power", () => go("#/library"), close));
    menu.append(item("Busbars et contacts…", "power", () => go("#/busbar"), close));
    menu.append(item("Circuits flexibles…", "chip", () => go("#/flex"), close));
    menu.append(item("Étiquettes et autocollants…", "edit", () => go("#/labels"), close));
    menu.append(item("Studio photo…", "camera", () => go("#/render"), close));
    menu.append(item("Exporter le projet (.dwiz)", "download", () => download(dwizFileName(p), toDwiz(p), "text/plain;charset=utf-8"), close));
    menu.append(item("Exporter en JSON", "download", () => download(`${p.id}.dwproject.json`, store.exportJson(), "application/json"), close));
  }
  menu.append(item("Importer un projet ou une pièce…", "upload", () => app.pickFile && app.pickFile(), close));
  if (session.configured && store.mode !== "drive") menu.append(item("Ouvrir depuis Google Drive…", "cloud", () => app.openFromDrive && app.openFromDrive(), close));
  menu.append(el("hr"));
  menu.append(el("div", { class: "menu-title" }, store.mode === "server" ? "Serveur local : projets sur le disque" : store.mode === "drive" ? "Projets dans votre Google Drive, dossier « DynamiteOrbit.ai »" : "Mode navigateur : projets gardés dans ce navigateur"));
}
function accountMenu(menu, close) {
  const a = session.account, cur = currentTheme();
  menu.append(el("div", { class: "menu-title" }, a ? a.email : session.configured ? "Non connecté à Google" : "Connexion Google non configurée"));
  if (a) { if (store.project && store.mode !== "drive") menu.append(item("Enregistrer le projet dans Drive", "save", () => app.saveToDrive && app.saveToDrive(), close)); menu.append(item("Se déconnecter", "lock", () => { signOut(); if (store.mode === "drive") location.reload(); }, close)); }
  else if (session.configured) menu.append(item("Se connecter avec Google", "user", () => app.connect && app.connect(), close));
  menu.append(item("Compte, Drive et accès", "cloud", () => go("#/account"), close), el("hr"), el("div", { class: "menu-title" }, "Thème"));
  for (const t of THEMES) { const it = item(t.label, t.key === cur ? "check" : "palette", () => { applyTheme(t.key); rebuildShell(); }, close); if (t.key === cur) it.classList.add("on"); menu.append(it); }
  /* the size of what is shown : five steps, each drawn at its own size ; the menu stays open so that the eye can compare */
  const z = currentScale(), row = el("div", { class: "scale-row", role: "group", "aria-label": "Taille de l'affichage" }, SCALES.map(([k, label]) => el("button", { type: "button", class: k === z ? "on" : null, "aria-pressed": k === z ? "true" : "false", "data-tip": `${label} — ${k} %`, "data-scale": String(k), style: { fontSize: `${0.62 + (k - 90) * 0.011}rem` },
    onClick: (e) => { e.stopPropagation(); applyScale(k); for (const b of row.children) { const on = b.dataset.scale === String(k); b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); } } }, "A")));
  menu.append(el("hr"), el("div", { class: "menu-title" }, "Taille de l'affichage"), row);
  menu.append(el("div", { class: "menu-title" }, "Taille des icônes du haut"), iconScaleRow());
  menu.append(el("hr"), el("div", { class: "menu-title", "data-raw": "" }, "Noms du métier (carte)"), boardNamePicker({ keep: true }));      // PCB · PCBA, PWB · CCA, or the words of the house : every screen and every document follows
  menu.append(el("hr"), el("div", { class: "menu-title" }, "Unités"), unitPicker({ keep: true }));      // SI or the imperial hybrid, and the unit of a pressure : the screens that show units follow
}
/** The ratio of the icons at the top of the window : four steps, each showing an icon at its own ratio ; used by the account
    menu and by the « Compte » page. The row stays open, so that the eye can compare. */
export function iconScaleRow() {
  const z = currentIconScale(), row = el("div", { class: "scale-row icon-scale-row", role: "group", "aria-label": "Taille des icônes du haut de la fenêtre" }, ICON_SCALES.map(([k, label, ratio]) => el("button", { type: "button", class: k === z ? "on" : null, "aria-pressed": k === z ? "true" : "false", "data-tip": `${label} — ${ratio}`, "data-icon-scale": String(k),
    onClick: (e) => { e.stopPropagation(); applyIconScale(k); for (const b of row.children) { const on = b.dataset.iconScale === String(k); b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); } } }, el("span", { class: "icon-scale-demo", style: { "--demo": String(k / 100) } }, icon("user")), el("small", null, ratio))));
  return row;
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
  app.context = {}; app.current = key; app.commands = []; app.guide = [];
  setStatus(kernel.stage().text || "Prêt", kernel.stage().text ? "busy" : "");      // what the last screen said (« … construit en 300 ms ») is not about this one — but a kernel still arriving is
  document.documentElement.dataset.module = key;
  const shown = key === "mvp" || key === "team" || key === "plm" ? "review" : key === "render" || key === "labels" ? "assembly" : key === "media" ? "physics" : SHOP_SCREENS.has(key) ? "shop" : key;      // a screen reached from another lights the one it belongs to
  document.querySelectorAll(".tab").forEach((t) => { if (!t.dataset.group) { t.classList.toggle("active", t.dataset.key === shown); return; }
    const G = NAV.find((g) => g.id === t.dataset.group), on = !!G && (G.keys.includes(shown) || !!(G.also && G.also[shown])), n = t.querySelector(".nav-name"); t.classList.toggle("active", on); t.dataset.key = on ? (G.also && G.also[shown]) || shown : ""; if (n) n.textContent = on && modules.get(shown) ? `${G.label} · ${modules.get(shown).label}` : G ? G.label : ""; });
  document.querySelectorAll(".topbar .nav-pop").forEach((m) => m.remove());
  const m = modules.get(key);
  document.title = `${m.label} · DynamiteOrbit.ai`;
  if (app.levels) app.levels(key, parts.slice(1));      // where this screen stands (Shop → nature → part), before it is drawn : a studio then measures the room it really has
  if (!store.project && !["home", "help", "account"].includes(key)) {
    main.append(el("div", { class: "page" }, el("div", { class: "empty" }, el("h2", null, "Aucun projet ouvert"),
      el("p", null, "Ouvrez un projet ou chargez la démonstration pour utiliser cet outil."), el("a", { class: "btn btn-primary", href: "#/home" }, "Aller à l'accueil"))));
    return;
  }
  try { const c = m.render(main, parts.slice(1)); if (typeof c === "function") app.cleanup = c; }
  catch (e) { console.error(e); main.append(el("div", { class: "page" }, el("div", { class: "card" }, el("h2", null, "Cet écran n'a pas pu s'afficher"), el("p", { class: "form-error" }, e.message)))); }
  studioPanes(main, key); refreshGuide();
}

export async function start() {
  installTips();
  document.body.append(topbar(), el("div", { id: "levels", class: "levels", hidden: true }), el("main", { id: "main" }));      // #levels : the breadcrumb and the work tabs (modules/levels_bar.js)
  installStepper();      // the arrows of every number field : 1 at a time, faster when held or clicked quickly
  installFolds();        // the groups of every side panel fold on a click on their title
  installWhatsNew({ running: APP_VERSION });       // what a version changed carries a mark on the screen, for as long as its review is open (core/whats_new.js)
  installBoardNames();       // the names of the trade for a board, mapped on everything that is drawn (core/board_names.js)
  installWhere();      // where am I : the project, then what the screen shows, under the head of every left panel (core/where.js)
  installStairs({ ai: (key) => app.aiLoop && app.aiLoop(key) });       // the step up of every screen, and its « IA » button : one pictogram at the head of the left panel, towards what the screen is made from
  installShare();       // « Partager » on every studio : the link of the element, the files the screen makes, an animation of its 3D view (core/share_ui.js)
  installPanelKeep();    // a panel drawn anew keeps its place, and the cursor its field
  installLoupe();        // the magnifier : a lens over drawings, boards, diagrams and 3D views — its buttons are beside the zoom of each view (core/view_bar.js)
  sayUpdated(APP_VERSION, (t) => setTimeout(() => toast(t, "success", 9000), 800));      // after an update : said once
  installUpdateCheck({ running: APP_VERSION, save: () => (store.saveState === "dirty" ? store.saveNow() : Promise.resolve()) });      // a page kept open says when a newer version is published, and offers to load it
  store.on("error", (e) => toast(e.message, "error", 8000));
  await store.init();
  const last = store.lastId();
  if (last) { try { await store.open(last); } catch (e) { /* the project is gone: stay on the home page */ } }
  if (!store.project) { try { const list = await store.list(); if (list.length) await store.open(list[0].id); } catch (e) { /* no project yet */ } }   // reopen the most recent one
  window.addEventListener("hashchange", route); store.on("change", refreshGuide); store.on("project", refreshGuide);
  window.addEventListener("dw:units", () => { if (!["physics", "fea", "creepage", "media"].includes(app.current)) route(); });      // the units chosen are read as a screen is drawn
  document.addEventListener("keydown", (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName);
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === "k") { e.preventDefault(); app.openPalette && app.openPalette(); }
    else if (mod && !typing && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); const l = store.undo(); toast(l ? `Annulé : ${l}` : "Rien à annuler."); }
    else if (mod && !typing && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) { e.preventDefault(); const l = store.redo(); toast(l ? `Rétabli : ${l}` : "Rien à rétablir."); }
    else if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); store.saveNow().then(() => toast("Projet enregistré.", "success")); }
    else if (e.key === "Escape") { const open = document.querySelector(".topbar .menu"); if (open) { const b = open.parentElement && open.parentElement.querySelector("button"); open.remove(); if (b) { if (b.hasAttribute("aria-expanded")) b.setAttribute("aria-expanded", "false"); b.focus(); } } }      // Escape closes a menu of the top bar — the guide too — and gives the focus back to its button
  });
  document.addEventListener("click", (e) => { if (!e.target.closest(".menu-wrap")) { document.querySelectorAll(".menu").forEach((m) => m.remove()); document.querySelectorAll('.nav-group[aria-expanded="true"]').forEach((x) => x.setAttribute("aria-expanded", "false")); } });      // a click elsewhere closes what was open — and a group says it is closed
  window.addEventListener("beforeunload", () => { if (store.saveState === "dirty") store.saveNow(); });
  if (!location.hash) location.hash = "#/home";
  route();
}

/** Re-render the current screen (after an undo, an import...). */
export function refresh() { route(); }
export { modal, confirmBox };
