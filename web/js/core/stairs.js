/* DesignWizard.ai — the stairs between the levels of the tool (demande de JP : « cette icône-là, qui permet de naviguer vers la
   carte… pour remonter de niveau, vers le niveau qui est lié directement à ce qu'on regarde… en escalier, d'une échelle à
   l'autre. Si on veut en skipper plusieurs niveaux, on peut aller dans les menus »).
   Every screen that shows something MADE FROM something else — the tests of a board, the simulation of a part, the drawing of an
   assembly, the photo of a product — has ONE step up : the thing it is made from. This file says which, for every screen ; the
   step is then drawn at the same place everywhere, the head of the left panel, as the pictogram of where it leads
   (core/stairs_ui.js). The way up of the Shop (part → nature → Shop) is the same step, read from core/shop_levels.js.
   One step at a time is a choice of this tool, said here ; several levels at once is what the menus and the breadcrumb are for.
   Pure : no page. */

import { levelsOf, natureOf, partHash, asmHash } from "./shop_levels.js";

const enc = encodeURIComponent;
/** The step up from a screen. key, args : its address (`#/key/args…`) ; project.
    → null when the screen hangs from nothing, or { hash, icon, color, label (where it leads), tip (what the step does, in a sentence) } */
export function stairOf(key, args, project) {
  if (!project) return null;
  const a = args || [], parts = project.parts || [], asms = project.assemblies || [], boards = project.boards || [];
  const part = (id) => (id ? parts.find((p) => p.id === id) : null) || null, asm = (id) => (id ? asms.find((x) => x.id === id) : null) || null;
  const toPart = (p, what) => { if (!p) return null; const n = natureOf(p), name = p.name || p.id; return { hash: partHash(p), icon: n.icon, color: n.color, label: name, tip: `${what} : ouvrir « ${name} » dans son studio` }; };
  const toAsm = (x, what) => (x ? { hash: asmHash(x), icon: "assembly", color: "#475569", label: x.name || x.id, tip: `${what} : ouvrir « ${x.name || x.id} » dans l'Assemblage` } : null);
  const lv = levelsOf(key, a, project);
  if (lv && lv.up) return lv.up.startsWith("#/shop/n/") && lv.nature ? { hash: lv.up, icon: lv.nature.icon, color: lv.nature.color, label: lv.nature.label, tip: `Monter d'un niveau : ${lv.nature.label} (${lv.nature.fr}) — les pièces de cette nature` }
    : { hash: lv.up, icon: "atelier", color: null, label: "Atelier", tip: "Monter d'un niveau : l'Atelier — toutes les pièces du produit" };
  switch (key) {
    case "assembly": { const me = asm(a[0]) || asms[0] || null, parent = me ? asms.find((x) => x.id !== me.id && (x.instances || []).some((i) => i.asm === me.id)) : null; return parent ? toAsm(parent, "Ce sous-assemblage est monté dans un autre") : null; }
    case "elab": { const b = boards.find((x) => x.id === a[0]) || boards[0] || null; return b ? { hash: `#/pcba/${enc(b.id)}`, icon: "chip", color: "#16a34a", label: b.name || b.id, tip: "Ouvrir la carte dans le PCBA" } : null; }
    case "fea": { const p = part(a[0]), x = p ? null : asm(a[0]); return p ? toPart(p, "La pièce simulée") : x ? toAsm(x, "L'assemblage simulé") : toPart(parts[0], "La pièce simulée") || toAsm(asms[0], "L'assemblage simulé"); }
    case "physics": return toPart(part(a[1]), "La pièce de ce calcul");
    case "media": return { hash: "#/physics", icon: "physics", color: null, label: "Physique", tip: "Revenir aux modèles analytiques, qui lisent cette base" };
    case "drawings": return a[0] === "asm" ? toAsm(asm(a[1]), "L'assemblage dessiné") : toPart(part(a[0]) || parts.find((p) => !p.step), "La pièce dessinée");
    case "dfx": return a[0] === "points" ? toPart(part(a[1]), "La pièce vérifiée") : null;
    case "creepage": return toAsm(asm(a[0]) || asms[0], "L'assemblage analysé");
    case "render": return toAsm(asm(a[0]) || asms[0], "Le produit photographié");
    case "labels": return toAsm(asm(a[0]) || asms[0], "Le produit étiqueté");
    case "mvp": case "team": case "plm": return { hash: "#/review", icon: "check", color: null, label: "Revue", tip: "Monter d'un niveau : la revue du produit" };
    default: return null;
  }
}
/** The address of the page, read as the shell reads it. → { key, args } */
export function addressOf(hash) { const p = String(hash || "").replace(/^#\/?/, "").split("/").filter(Boolean).map((x) => { try { return decodeURIComponent(x); } catch { return x; } }); return { key: p[0] || "home", args: p.slice(1) }; }
