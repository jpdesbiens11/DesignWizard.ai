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
  const SW = (k, icon, label, tip) => ((project.software || []).length ? { hash: `#/${k}`, icon, color: "#0891b2", label, tip: `Monter d'un niveau : ${tip}` } : null);
  const lv = levelsOf(key, a, project);
  if (lv && lv.up) return lv.up.startsWith("#/shop/n/") && lv.nature ? { hash: lv.up, icon: lv.nature.icon, color: lv.nature.color, label: lv.nature.label, tip: `Monter d'un niveau : ${lv.nature.label} (${lv.nature.fr}) — les pièces de cette nature` }
    : { hash: lv.up, icon: "atelier", color: null, label: "Atelier", tip: "Monter d'un niveau : l'Atelier — toutes les pièces du produit" };
  switch (key) {
    case "assembly": { const me = asm(a[0]) || asms[0] || null, parent = me ? asms.find((x) => x.id !== me.id && (x.instances || []).some((i) => i.asm === me.id)) : null; return parent ? toAsm(parent, "Ce sous-assemblage est monté dans un autre") : null; }
    case "elab": { const b = boards.find((x) => x.id === a[0]) || boards[0] || null; return b ? { hash: `#/pcba/${enc(b.id)}`, icon: "chip", color: "#16a34a", label: b.name || b.id, tip: "Ouvrir la carte dans le PCBA" } : null; }
    case "swreq": { const b = boards[0] || null; return b ? { hash: `#/pcba/${enc(b.id)}`, icon: "chip", color: "#16a34a", label: b.name || b.id, tip: "Le logiciel tourne sur le CPU d'une carte : ouvrir la carte dans le PCBA" } : null; }
    case "swarch": case "swtest": return SW("swreq", "report", "Exigences", key === "swtest" ? "Ce que la vérification prouve : les exigences" : "L'architecture répond aux exigences");      // the V : each step hangs from the one it answers
    case "sw": return SW("swarch", "chip", "Architecture", "La conception se fait dans l'architecture choisie : référence, CPU, cadence");
    case "swsim": case "swcode": return SW("sw", "part", "Conception", key === "swsim" ? "Ce que la simulation fait tourner : la conception" : "Ce que le code traduit : la conception");
    case "swrel": return SW("swtest", "check", "Vérification", "On livre ce qui est prouvé : la vérification");
    case "pcba": { const b = boards.find((x) => x.id === a[0]) || boards[0] || null; return b ? toPart(part(b.part), "La carte (PCB) que ce PCBA équipe") : null; }      // the assembled board hangs from its bare board, when it has one
    case "fea": { const p = part(a[0]), x = p ? null : asm(a[0]);
      if (p && p.study && p.study.model) return { hash: `#/physics/${enc(p.study.model)}/${enc(p.id)}`, icon: "physics", color: "#a16207", label: "Modèle analytique", tip: `Ce modèle simplifié est fait à partir d'un modèle analytique : y revenir, avec ses valeurs` }; return p ? toPart(p, "La pièce simulée") : x ? toAsm(x, "L'assemblage simulé") : toPart(parts[0], "La pièce simulée") || toAsm(asms[0], "L'assemblage simulé"); }
    case "physics": return toPart(part(a[1]), "La pièce de ce calcul");
    case "media": return { hash: "#/physics", icon: "physics", color: null, label: "Physique", tip: "Revenir aux modèles analytiques, qui lisent cette base" };
    case "drawings": return a[0] === "asm" ? toAsm(asm(a[1]), "L'assemblage dessiné") : toPart(part(a[0]) || parts.find((p) => !p.step), "La pièce dessinée");
    case "dfx": return a[0] === "points" ? toPart(part(a[1]), "La pièce vérifiée") : null;
    case "fab": return toPart(part(a[0]) || parts.find((p) => !p.step && !p.purchased), "La pièce que l'atelier fabrique");
    case "creepage": { const b = a[0] === "board" ? boards.find((x) => x.id === a[1]) : null; return b ? { hash: `#/pcba/${enc(b.id)}`, icon: "chip", color: "#16a34a", label: b.name || b.id, tip: "La carte analysée : l'ouvrir dans le PCBA" } : toAsm(asm(a[0]) || asms[0], "L'assemblage analysé"); }      // a board analysed alone hangs from its PCBA
    case "render": return toAsm(asm(a[0]) || asms[0], "Le produit photographié");
    case "labels": return toAsm(asm(a[0]) || asms[0], "Le produit étiqueté");
    case "mvp": case "team": case "plm": case "history": case "eco": return { hash: "#/review", icon: "check", color: null, label: "Revue", tip: "Monter d'un niveau : la revue du produit" };
    default: return null;
  }
}
/* the V, going down : what each step of the software leads to (the reverse of its step up) */
const DOWN_SW = { swreq: [["swarch", "chip", "Architecture"], ["swtest", "check", "Vérification"]], swarch: [["sw", "part", "Conception"]], sw: [["swsim", "play", "Simulation"], ["swcode", "code", "Code"]], swtest: [["swrel", "download", "Livraison"]] };
/** The steps DOWN from a screen (demande de JP : « monter d'un niveau… descendre d'un niveau, plus profond dans la définition ») : what is made FROM what
    the screen shows — the exact reverse of the step up. A board (PCB) leads down to the PCBA mounted on it, a PCBA to its Labo ; a part to its
    simulation and its drawing ; an assembly to its sub-assemblies, its isolation and its drawing. What defines the product comes first ; at most
    four, the rest is in the menus. → [{ hash, icon, color, label, tip }] */
export function downOf(key, args, project) {
  if (!project) return [];
  const a = args || [], parts = project.parts || [], asms = project.assemblies || [], boards = project.boards || [], out = [], lv = levelsOf(key, a, project);
  const B = (b, why) => out.push({ hash: `#/pcba/${enc(b.id)}`, icon: "chip", color: "#16a34a", label: b.name || b.id, tip: `Descendre d'un niveau : ${why} — « ${b.name || b.id} »` });
  if (lv && lv.part) { const p = lv.part;
    for (const b of boards.filter((x) => x.part === p.id)) B(b, "le PCBA monté sur cette carte");
    if (!p.step) out.push({ hash: `#/drawings/${enc(p.id)}`, icon: "drawing", color: null, label: "Dessin", tip: `Descendre d'un niveau : le dessin de « ${p.name || p.id} »` });
    out.push({ hash: `#/fea/${enc(p.id)}`, icon: "physics", color: null, label: "Simulation", tip: `Descendre d'un niveau : la simulation de « ${p.name || p.id} »` });
    if (!p.step && out.length < 4) out.push({ hash: `#/fab/${enc(p.id)}`, icon: "mill", color: null, label: "Atelier de fab", tip: `Descendre d'un niveau : la gamme de « ${p.name || p.id} » jouée à l'atelier` });
  } else if (lv && lv.assembly) { const x = lv.assembly, name = x.name || x.id;
    for (const s of [...new Set((x.instances || []).map((i) => i.asm).filter(Boolean))].map((id) => asms.find((y) => y.id === id)).filter(Boolean)) out.push({ hash: asmHash(s), icon: "assembly", color: "#475569", label: s.name || s.id, tip: `Descendre d'un niveau : le sous-assemblage « ${s.name || s.id} »` });
    out.push({ hash: `#/creepage/${enc(x.id)}`, icon: "creepage", color: null, label: "Isolation", tip: `Descendre d'un niveau : l'isolation de « ${name} »` }, { hash: `#/drawings/asm/${enc(x.id)}`, icon: "drawing", color: null, label: "Dessin", tip: `Descendre d'un niveau : le dessin d'ensemble de « ${name} »` });
  } else if (DOWN_SW[key] && (project.software || []).length) { for (const [k, icon, label] of DOWN_SW[key]) out.push({ hash: `#/${k}`, icon, color: "#0891b2", label, tip: `Descendre d'un niveau : ${label}` });
  } else if (key === "pcba") { const b = boards.find((x) => x.id === a[0]) || boards[0] || null; if (b) out.push({ hash: `#/elab/${enc(b.id)}`, icon: "sensor", color: "#16a34a", label: "Labo", tip: `Descendre d'un niveau : le Labo de « ${b.name || b.id} » — chaque bloc sur le banc simulé` }, { hash: `#/creepage/board/${enc(b.id)}`, icon: "creepage", color: null, label: "Isolation", tip: `Descendre d'un niveau : l'isolation de « ${b.name || b.id} », la carte seule` }); if (b && b === boards[0]) out.push({ hash: "#/swreq", icon: "code", color: "#16a34a", label: "Logiciel", tip: "Descendre d'un niveau : le logiciel qui tourne sur le CPU de la carte — son cycle en V, des exigences au paquet livré" }); }      // the exact reverse of the step up of « swreq », which leads to the first board
  return out.slice(0, 4);
}
/** What a screen hands to an AI (demande de JP : « un aller-retour avec l'IA sur toutes les pages, sur l'artéfact de la page ») : the artefact the screen
    shows — a board, a part, an assembly — or the whole project when it shows none. The keys are those of the common loop (modules/ai_loop.js).
    → { key ("part:ID" | "assembly:ID" | "board:ID" | "project"), label (what is handed over, in words) } or null without a project */
export function aiTargetOf(key, args, project) {
  if (!project) return null;
  const a = args || [], parts = project.parts || [], asms = project.assemblies || [], boards = project.boards || [];
  const P = (p) => (p ? { key: `part:${p.id}`, label: `la pièce « ${p.name || p.id} »` } : null), A = (x) => (x ? { key: `assembly:${x.id}`, label: `l'assemblage « ${x.name || x.id} »` } : null), B = (b) => (b ? { key: `board:${b.id}`, label: `la carte « ${b.name || b.id} »` } : null);
  const part = (id) => (id ? parts.find((p) => p.id === id) : null) || null, asm = (id) => (id ? asms.find((x) => x.id === id) : null) || null, all = { key: "project", label: `tout le projet « ${project.name || "sans nom"} »` };
  /* the Dessins, Simulation and Isolation screens hand over what they show — the sheet, the load case, the isolation settings — not the part behind (core/ai_more.js) */
  const nm = (x) => `« ${x.name || x.id} »`, D = (of, x) => (x ? { key: `drawing:${of}:${x.id}`, label: `la feuille de dessin de ${nm(x)}` } : null),
    C = (x) => (x ? { key: `case:${x.id}`, label: `le cas de charge de ${nm(x)}` } : null), I = (of, x) => (x ? { key: `iso:${of}:${x.id}`, label: `l'isolation de ${nm(x)}` } : null);
  const lv = levelsOf(key, a, project);
  if (lv && lv.part) return P(lv.part);
  if (lv && lv.assembly) return A(lv.assembly);
  switch (key) {
    case "pcba": case "elab": return B(boards.find((b) => b.id === a[0]) || boards[0]) || all;
    case "fea": return C(part(a[0]) || asm(a[0]) || parts[0]) || all;
    case "drawings": return (a[0] === "asm" ? D("assembly", asm(a[1])) : D("part", part(a[0]) || parts.find((p) => !p.step))) || all;
    case "physics": return P(part(a[1])) || all;
    case "fab": return P(part(a[0]) || parts.find((p) => !p.step && !p.purchased)) || all;
    case "dfx": return (a[0] === "points" ? P(part(a[1])) : null) || all;
    case "creepage": return (a[0] === "board" ? I("board", boards.find((b) => b.id === a[1])) : I("assembly", asm(a[0]) || asms[0])) || all;
    case "render": case "labels": return A(asm(a[0]) || asms[0]) || all;
    default: return all;
  }
}
/** The address of the page, read as the shell reads it. → { key, args } */
export function addressOf(hash) { const p = String(hash || "").replace(/^#\/?/, "").split("/").filter(Boolean).map((x) => { try { return decodeURIComponent(x); } catch { return x; } }); return { key: p[0] || "home", args: p.slice(1) }; }
