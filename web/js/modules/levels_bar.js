/* DesignWizard.ai — the breadcrumb and the work tabs, under the top bar of every screen of the Shop, of the part studios and of
   the Assembly (demande de JP : « être capable de faire le lien… monter à ma partie atelier pour aller voir les autres pièces,
   pouvoir les sélectionner ou les faire apparaître dans de nouveaux onglets »).
   The breadcrumb says where one stands — 1 the Shop, 2 a nature of part, 3 one part — and takes one elsewhere : a click on a
   level goes up to it, its chevron lists what is beside it (the other natures ; the sisters of the part, then every other part,
   and choosing a busbar from a profile opens the studio of the busbars), « Monter » and Alt + ↑ go one level up (the step of
   core/stairs.js, the same as at the head of the left panel).
   The work tabs keep several parts and assemblies at hand (core/work_tabs.js).
   The usages it follows : the address bar of a file explorer ; the tabs of an editor. Where one stands : core/shop_levels.js. */

import { el, icon, btn, toast, debounce } from "../core/dom.js";
import { app, go } from "../core/app.js";
import { store } from "../core/store.js";
import { levelsOf, partChoices, natureChoices, natureHash, partHash, asmHash } from "../core/shop_levels.js";
import { pickMenu } from "../core/pick_list.js";
import { pinTab, closeTab, isPinned, tabRow, tabFace, keepTabs, loadTabs, saveTabs } from "../core/work_tabs.js";
import { stairOf } from "../core/stairs.js";
import { stairButton } from "../core/stairs_ui.js";

let host = null, tabs = [], pid = null, last = null, lv = null;
const project = () => store.project;
function sync() { const id = project() ? project().id : null; if (id !== pid) { pid = id; tabs = id ? loadTabs(id) : []; } if (project()) tabs = keepTabs(tabs, project()); }
const keep = () => { if (pid) saveTabs(pid, tabs); };
const here = () => (lv && lv.part ? { kind: "part", id: lv.part.id } : lv && lv.assembly ? { kind: "asm", id: lv.assembly.id } : null);

/** Keep a part or an assembly as a work tab — without leaving the screen, as Ctrl + click on a link opens a tab behind. */
export function openInTab(kind, id) {
  sync(); if (isPinned(tabs, { kind, id })) { toast("Déjà gardé en onglet.", "info", 2200); return; }
  tabs = pinTab(tabs, { kind, id }); keep(); redraw();
  const f = tabFace({ kind, id }, project()); if (f) toast(`« ${f.title} » gardé en onglet — sous le fil d'Ariane.`, "success", 3200);
}
/** The small control of a line that keeps its part as a tab ; the line itself opens the part. */
export const tabButton = (kind, id, title) => el("button", { class: "icon-btn tab-add", type: "button", "aria-label": `Garder « ${title} » en onglet`, "data-tip": "Garder en onglet de travail (Ctrl + clic sur la ligne fait de même)", onClick: (e) => { e.preventDefault(); e.stopPropagation(); openInTab(kind, id); } }, icon("external"));
/** What a click on a link to a part does when Ctrl or ⌘ is held : it keeps the part as a tab, and the page stays. → true when it took the click */
export function tabClick(e, kind, id) { if (!(e.ctrlKey || e.metaKey)) return false; e.preventDefault(); openInTab(kind, id); return true; }

function dropOf(c) {
  const parts = project().parts || [], b = el("button", { class: "crumb-drop", type: "button", "aria-label": c.drop === "natures" ? "Les autres natures de pièce" : c.drop === "parts" ? "Les autres pièces" : "Les autres assemblages", "data-tip": c.drop === "natures" ? "Les autres natures de pièce du produit" : c.drop === "parts" ? "Ses sœurs d'abord, puis toutes les autres pièces, par nature — choisir une pièce ouvre son studio" : "Les autres assemblages" }, icon("chevron-down"));
  if (c.drop === "natures") return pickMenu(b, { label: "Nature de pièce", value: lv.nature ? lv.nature.key : null, groups: natureChoices(parts), width: 320, onPick: (k) => go(natureHash(k)) });
  if (c.drop === "parts") return pickMenu(b, { label: "Pièce", value: lv.part.id, width: 400, groups: partChoices(parts, lv.part).map((g) => ({ ...g, items: g.items.map((it) => ({ ...it, sub: `${it.sub} · ${g.fr}` })) })),
    onPick: (id, e) => { const p = store.part(id); if (!p) return; if (e && (e.ctrlKey || e.metaKey)) openInTab("part", id); else go(partHash(p)); },
    extra: (it) => (it.id === lv.part.id ? null : tabButton("part", it.id, it.title)),
    foot: (close) => [btn("Voir tout l'Atelier", () => { close(false); go("#/shop"); }, { small: true, icon: "atelier", tip: "Niveau 1 : toutes les pièces du produit, et les portes pour en créer" }), el("small", { class: "muted" }, "Ctrl + clic : garder en onglet")] });
  return pickMenu(b, { label: "Assemblage", value: lv.assembly.id, width: 340, groups: [{ label: "Assemblages", color: "#475569", items: (project().assemblies || []).map((a) => ({ id: a.id, title: a.name || a.id, sub: a.id, icon: "assembly" })) }],
    onPick: (id, e) => { const a = store.assembly(id); if (!a) return; if (e && (e.ctrlKey || e.metaKey)) openInTab("asm", id); else go(asmHash(a)); } });
}
function crumbEl(c) {
  const face = [c.level ? el("i", { class: "crumb-lv", "aria-hidden": "true" }, String(c.level)) : null, icon(c.icon || "part"), el("span", { class: "crumb-name" }, c.label), c.sub && c.level === 3 ? el("small", null, c.sub) : null];
  const say = c.level ? `Niveau ${c.level} — ${c.label}` : c.label;
  const main = c.hash ? el("a", { class: "crumb-go", href: c.hash, "aria-label": say, "data-tip": c.level === 1 ? "Niveau 1 — l'Atelier : toutes les pièces du produit, et les portes pour en créer" : c.level === 2 ? `Niveau 2 — ${c.label} (${c.sub}) : les pièces de cette nature, les règles de son procédé` : null }, face)
    : el("span", { class: "crumb-go", "aria-current": "page", "aria-label": say }, face);
  return el("span", { class: "crumb" + (c.on ? " on" : ""), "data-level": c.level || null, style: c.color ? { "--g": c.color } : null }, main, c.drop ? dropOf(c) : null);
}
function crumbsRow() {
  const step = stairOf(last.key, last.args, project()), up = step ? stairButton(step, { label: "Monter", keys: true }) : null;      // the same step as at the head of the left panel (core/stairs.js)
  if (up) { up.classList.add("levels-up"); up.append(el("kbd", null, "Alt ↑")); }
  const h = here(), ai = btn("IA", () => (h && app.aiLoop ? app.aiLoop(`${h.kind === "asm" ? "assembly" : "part"}:${h.id}`) : go("#/interfaces")), { small: true, primary: true, icon: "sparkle", tip: h ? "Confier ce que montre l'écran à l'IA : l'exporter avec une demande, réimporter la réponse, voir les changements avant de les appliquer" : "Créer avec l'IA : la pièce décrite en mots, la consigne proposée, la réponse rapportée" });
  return el("div", { class: "levels-row" }, el("nav", { class: "levels-crumbs", "aria-label": "Fil d'Ariane" }, el("span", { class: "crumb root", "data-tip": "Le projet ouvert" }, icon("folder"), el("span", { class: "crumb-name" }, project().name || "Projet")),
    lv.crumbs.flatMap((c) => [el("span", { class: "crumb-sep", "aria-hidden": "true" }, icon("chevron-right")), crumbEl(c)])), el("span", { class: "grow" }), up, ai);
}
function shut(t) {
  const h = here(), r = closeTab(tabs, t); tabs = r.tabs; keep();
  if (h && h.kind === t.kind && h.id === t.id) { const f = r.next && tabFace(r.next, project()); go(f ? f.hash : "#/shop"); } else redraw();
}
function tabsRow() {
  const h = here(), row = tabRow(tabs, h, project()), floor = last && last.key === "shop" && !last.args.length;
  return el("nav", { class: "levels-tabs", "aria-label": "Onglets de travail" }, el("a", { class: "wtab fixed" + (floor ? " on" : ""), href: "#/shop", "aria-current": floor ? "page" : null, "data-tip": "L'Atelier : toutes les pièces du produit" }, icon("atelier"), el("span", null, "Atelier")),
    row.map((t) => el("span", { class: "wtab" + (t.on ? " on" : "") + (t.passing ? " passing" : ""), style: { "--g": t.color }, "data-tab": t.key, onAuxclick: (e) => { if (e.button === 1 && !t.passing) { e.preventDefault(); shut(t); } } },
      el("a", { class: "wtab-go", href: t.hash, "aria-current": t.on ? "page" : null, "data-tip": t.passing ? `${t.title} — ${t.sub}. Onglet de passage : un double clic le garde.` : `${t.title} — ${t.sub}`, onDblclick: () => { if (t.passing) openInTab(t.kind, t.id); } }, icon(t.icon), el("span", null, t.title)),
      t.passing ? el("button", { class: "wtab-x", type: "button", "aria-label": `Garder l'onglet « ${t.title} »`, "data-tip": "Garder cet onglet : il reste jusqu'à ce qu'on le ferme", onClick: () => openInTab(t.kind, t.id) }, icon("plus"))
        : el("button", { class: "wtab-x", type: "button", "aria-label": `Fermer l'onglet « ${t.title} »`, "data-tip": "Fermer l'onglet (ou clic du milieu)", onClick: () => shut(t) }, icon("close")))),
    row.some((t) => !t.passing) ? null : el("small", { class: "muted levels-hint" }, "Onglets de travail : Ctrl + clic sur une pièce, ou son ", icon("external"), ", la garde ici."));
}
function redraw() {
  if (!host || !last) return;
  sync(); lv = project() ? levelsOf(last.key, last.args, project()) : null;
  host.replaceChildren(...(lv ? [crumbsRow(), tabsRow()] : [])); host.hidden = !lv;
  document.documentElement.style.setProperty("--levels-h", `${lv ? host.offsetHeight : 0}px`);
}
/** Called by the shell at every change of screen, BEFORE the screen is drawn : a studio then measures the room it really has. */
function show(key, args) {
  if (!host) { host = document.getElementById("levels"); if (!host) return;
    const later = debounce(redraw, 120); store.on("change", later); store.on("project", later); window.addEventListener("resize", later); }
  last = { key, args: args || [] }; redraw();
}
app.levels = show;
