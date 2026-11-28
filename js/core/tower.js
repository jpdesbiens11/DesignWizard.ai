/* DynamiteOrbit.ai — the launch tower (JP, 23 novembre, par menu : « La tour de lancement ») : where the screen stands in the product,
   drawn as a tower read from the pad up — the project at the foot, then the top assembly, its sub-assemblies, the part (or the board,
   or the software), and at the top the screen one is on, where the rocket is. Each floor is a link ; each says what the guide finds
   on it (its worst level). Pure : core/where_ui.js draws it in the flap under the « where am I » lines.
   The usage it follows : the « where-used » chain of a PDM tool, and the breadcrumb read vertically. */

import { aiTargetOf } from "./stairs.js";
import { partHash } from "./shop_levels.js";
import { liveAsm } from "./asm_live.js";

const enc = encodeURIComponent;
const SW = new Set(["sw", "swreq", "swarch", "swsim", "swcode", "swtest", "swrel", "swref"]);
const RANK = { error: 4, todo: 3, warn: 2, tip: 1 };

/** The assemblies from the top one down to the one that holds `want` ({ part } or { asm }) directly. → [asm, …] or null. */
export function usedPath(project, want) {
  const asms = project.assemblies || [], byId = new Map(asms.map((a) => [a.id, a]));
  const subs = new Set(asms.flatMap((a) => (a.instances || []).map((i) => i.asm).filter(Boolean)));
  const holds = (a) => ((liveAsm(a) || a).instances || []).some((i) => (want.part && i.part === want.part && !i.asm) || (want.asm && i.asm === want.asm));
  function down(a, trail) {
    if (trail.includes(a.id)) return null; const here = [...trail, a.id];
    if (holds(a)) return [a];
    for (const i of (liveAsm(a) || a).instances || []) { const s = i.asm && byId.get(i.asm); const r = s && down(s, here); if (r) return [a, ...r]; }
    return null;
  }
  const tops = asms.filter((a) => !subs.has(a.id) && a.id !== want.asm);
  for (const a of [...tops, ...asms.filter((x) => !tops.includes(x) && x.id !== want.asm)]) { const r = down(a, []); if (r) return r; }
  return null;
}

/** The floors, from the pad (index 0) to the top. screen : the label of the screen one is on (its tool), hash : its address.
    issues : the guide's entries of the project (each with a ref), to light each floor. → null without a project. */
export function towerOf(key, args, project, o = {}) {
  if (!project || !key || ["home", "help", "account", "start"].includes(key)) return null;
  const issues = o.issues || [], light = (ref) => { let best = null; for (const x of issues) if (x && x.ref === ref && (!best || RANK[x.level] > RANK[best])) best = x.level; return best; };
  const count = (ref) => issues.filter((x) => x && x.ref === ref && (x.level === "error" || x.level === "todo" || x.level === "warn")).length;
  const floor = (kind, icon, label, id, hash) => ({ kind, icon, label, id: id || "", hash, light: id ? light(id) : null, count: id ? count(id) : 0 });
  const pad = { kind: "Projet", icon: "folder", label: project.name || "Projet sans nom", id: "", hash: "#/shop", light: null, count: 0, pad: true };
  const asmFloors = (path) => (path || []).map((a, i) => floor(i ? "Sous-assemblage" : "Assemblage", "assembly", a.name || a.id, a.id, `#/assembly/${enc(a.id)}`));
  let floors = [], own = false;
  if (SW.has(key)) {
    const sw = (project.software || [])[0];
    if (sw) floors.push(floor("Logiciel", "code", sw.name || sw.id, sw.id, "#/sw"));
    own = key === "sw";
  } else {
    const t = aiTargetOf(key, args, project), [kind, a, b] = t && t.key !== "project" ? t.key.split(":") : [];
    const id = b || a, part = (x) => (project.parts || []).find((p) => p.id === x), asm = (x) => (project.assemblies || []).find((y) => y.id === x), board = (x) => (project.boards || []).find((y) => y.id === x);
    const ofPart = (p) => { const tw = (project.boards || []).find((bd) => bd.part === p.id); return [...asmFloors(usedPath(project, { part: p.id })), floor(tw ? "Carte (PCB)" : "Pièce", tw ? "pcb" : "part", p.name || p.id, p.id, partHash(p))]; };
    const ofAsm = (x) => [...asmFloors(usedPath(project, { asm: x.id })), floor((usedPath(project, { asm: x.id }) || []).length ? "Sous-assemblage" : "Assemblage", "assembly", x.name || x.id, x.id, `#/assembly/${enc(x.id)}`)];
    const ofBoard = (x) => { const tw = x.part && part(x.part); return [...(tw ? ofPart(tw) : []), floor("Carte (PCBA)", "chip", x.name || x.id, x.id, `#/pcba/${enc(x.id)}`)]; };
    if ((kind === "part" || kind === "case" || (kind === "drawing" && a === "part")) && part(id)) { floors = ofPart(part(id)); own = kind === "part" && key !== "fab" && key !== "physics"; }
    else if ((kind === "assembly" || kind === "case" || (kind === "drawing" && a === "assembly") || (kind === "iso" && a === "assembly")) && asm(id)) { floors = ofAsm(asm(id)); own = kind === "assembly" && key === "assembly"; }
    else if ((kind === "board" || (kind === "iso" && a === "board")) && board(id)) { floors = ofBoard(board(id)); own = kind === "board" && key === "pcba"; }
  }
  if (!own && o.screen) floors.push({ kind: "Écran", icon: o.screenIcon || "eye", label: o.screen, id: "", hash: o.hash || "", light: null, count: 0, screen: true });
  if (floors.length) floors[floors.length - 1].here = true; else pad.here = true;
  return [pad, ...floors];
}
