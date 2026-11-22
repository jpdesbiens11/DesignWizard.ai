/* DesignOrbit.ai — the work tabs (demande de JP : « pouvoir les sélectionner ou les faire apparaître dans de nouveaux onglets ») :
   the parts and the assemblies one keeps at hand, in a row under the breadcrumb. A tab is KEPT on purpose — Ctrl + click on a
   part, its « open in a tab » button, a double click on the tab of the moment — and stays until it is closed ; what one merely
   looks at shows as a passing tab, in italics, which the next thing looked at replaces.
   The usage it follows : the tabs of an editor or of a modeller — a preview tab that a click replaces, a kept tab that stays —
   and the middle click that closes. One project in memory : the tabs are addresses, never copies.
   Pure, but for the two lines that keep the list of a project in the browser. */

import { partHash, asmHash, natureOf } from "./shop_levels.js";

export const MAX_TABS = 9;
export const tabKey = (kind, id) => `${kind}:${id}`;
const same = (a, b) => a.kind === b.kind && a.id === b.id;
/** Keep a tab. tabs : [{ kind ("part" | "asm"), id }] → the new list — the tab keeps its place when it is there already ;
    beyond `max`, the oldest goes. */
export function pinTab(tabs, t, max = MAX_TABS) {
  const list = (tabs || []).filter((x) => x && x.kind && x.id);
  if (!t || !t.kind || !t.id || list.some((x) => same(x, t))) return list;
  const out = [...list, { kind: t.kind, id: t.id }];
  return out.length > max ? out.slice(out.length - max) : out;
}
/** Close a tab. → { tabs, next } : next is the tab to show when the one closed was the one looked at (its right neighbour, else its left one, else null — the Shop). */
export function closeTab(tabs, t) {
  const list = tabs || [], i = list.findIndex((x) => same(x, t));
  if (i < 0) return { tabs: list, next: null };
  const out = list.filter((_, k) => k !== i);
  return { tabs: out, next: out[i] || out[i - 1] || null };
}
export const isPinned = (tabs, t) => !!t && (tabs || []).some((x) => same(x, t));
/** The tabs whose part or assembly still exists. */
export function keepTabs(tabs, project) {
  const parts = new Set(((project && project.parts) || []).map((p) => p.id)), asms = new Set(((project && project.assemblies) || []).map((a) => a.id));
  return (tabs || []).filter((t) => t && (t.kind === "part" ? parts.has(t.id) : t.kind === "asm" ? asms.has(t.id) : false));
}
/** What a tab shows and where it leads. → { key, title, sub, icon, color, hash } or null when its artefact is gone */
export function tabFace(t, project) {
  if (t.kind === "part") { const p = ((project && project.parts) || []).find((x) => x.id === t.id); if (!p) return null; const n = natureOf(p); return { key: tabKey("part", p.id), title: p.name || p.id, sub: `${p.id} · ${n.label}`, icon: n.icon, color: n.color, hash: partHash(p) }; }
  if (t.kind === "asm") { const a = ((project && project.assemblies) || []).find((x) => x.id === t.id); if (!a) return null; return { key: tabKey("asm", a.id), title: a.name || a.id, sub: `${a.id} · assemblage`, icon: "assembly", color: "#475569", hash: asmHash(a) }; }
  return null;
}
/** The row to draw : the kept tabs, then — when what is looked at is not kept — a passing tab at the end.
    here : { kind, id } of what the screen shows, or null. → [{ ...face, kind, id, on, passing }] */
export function tabRow(tabs, here, project) {
  const row = keepTabs(tabs, project).map((t) => ({ ...tabFace(t, project), kind: t.kind, id: t.id, on: !!here && same(t, here), passing: false }));
  if (here && !row.some((r) => r.on)) { const f = tabFace(here, project); if (f) row.push({ ...f, kind: here.kind, id: here.id, on: true, passing: true }); }
  return row;
}

const slot = (pid) => `dwiz.tabs.${pid || "none"}`;
export function loadTabs(pid, storage = globalThis.localStorage) { try { const v = JSON.parse((storage && storage.getItem(slot(pid))) || "[]"); return Array.isArray(v) ? v.filter((t) => t && typeof t.kind === "string" && typeof t.id === "string").slice(0, MAX_TABS) : []; } catch { return []; } }
export function saveTabs(pid, tabs, storage = globalThis.localStorage) { try { if (storage) storage.setItem(slot(pid), JSON.stringify(tabs || [])); } catch { /* a private window : the tabs live for the session only */ } }
