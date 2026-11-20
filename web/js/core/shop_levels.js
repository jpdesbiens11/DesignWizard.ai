/* DesignWizard.ai — the levels of the Shop (demande de JP : « à quel niveau tu les fais, ce que tu peux faire, comment tu passes d'un
   niveau à l'autre »). Three levels, and one path between them :
     1 — the Shop : every part of the product, by nature ; where a part is created ;
     2 — a nature of part (machined, molded, extruded profile, busbar, flex…) : its sisters, the rules of its process ;
     3 — one part, in the studio of its nature.
   This file says what the nature of a part is, which studio opens it, and where a screen stands on the path — the breadcrumb of
   every screen of the Shop is drawn from it (modules/levels_bar.js), and so is the floor (modules/shop_floor.js).
   The usage it follows : the breadcrumb of a file explorer — a click on a level goes up to it, the chevron of a level lists its
   siblings. Pure : no page. */

/** The natures of part : a trade name (English, as the trade says it), its French gloss, a pictogram, a colour, the screen that
    opens such a part (`studio`), and the sheet of the rules of its process in « Procédés spéciaux » (`rules`). */
export const NATURES = [
  { key: "machined", label: "Machined", fr: "usinées", icon: "mill", color: "#2563eb", studio: "parts", rules: null },
  { key: "molded", label: "Molded", fr: "moulées", icon: "cast", color: "#d97706", studio: "parts", rules: "moulage" },
  { key: "extrusion", label: "Extrusion", fr: "profilés extrudés", icon: "extrusion", color: "#16a34a", studio: "extrusion", rules: "extrusion" },
  { key: "sheet", label: "Sheet metal", fr: "tôle pliée", icon: "bend", color: "#7c3aed", studio: "parts", rules: "pliage" },
  { key: "laser", label: "Laser cutting", fr: "découpées au laser", icon: "laser", color: "#0891b2", studio: "parts", rules: "laser" },
  { key: "printed", label: "3D printing", fr: "imprimées", icon: "print3d", color: "#be185d", studio: "parts", rules: "impression" },
  { key: "busbar", label: "Busbars", fr: "conducteurs pliés", icon: "power", color: "#dc2626", studio: "busbar", rules: null },
  { key: "flex", label: "Flex PCB", fr: "circuits flexibles", icon: "chip", color: "#0d9488", studio: "flex", rules: null },
  { key: "pcb", label: "PCB", fr: "cartes", icon: "pcb", color: "#15803d", studio: "pcb", rules: null },
  { key: "bought", label: "Off the shelf", fr: "du commerce", icon: "library", color: "#64748b", studio: "parts", rules: null },
  { key: "imported", label: "Imported (STEP)", fr: "importées", icon: "step", color: "#475569", studio: "parts", rules: null },
  { key: "other", label: "To be defined", fr: "procédé à définir", icon: "part", color: "#78716c", studio: "parts", rules: null },
];
const BY = new Map(NATURES.map((n) => [n.key, n]));
const MOLD = new Set(["injection_molding", "die_casting", "lp_die_casting", "permanent_mold", "sand_casting"]), AM = new Set(["fdm", "mjf", "sla", "lpbf"]), BOUGHT = new Set(["purchased", "connector", "cell"]);
export const nature = (key) => BY.get(key) || BY.get("other");

/** The nature of a part : what it is before how it is made — a busbar, a flex circuit, a board, a profile — then its process. */
export function natureKey(p) {
  if (!p) return "other";
  const proc = p.process || "";
  if (p.busbar || p.family === "busbar") return "busbar";
  if (p.flex || p.family === "flex") return "flex";
  if (p.family === "pcb" || proc === "pcb") return "pcb";
  if (p.family === "extrusion" || proc.startsWith("extrusion")) return "extrusion";
  if (p.step) return "imported";
  if (proc === "purchased" || BOUGHT.has(p.family)) return "bought";
  if (MOLD.has(proc)) return "molded";
  if (proc === "sheet_metal" || p.folded) return "sheet";
  if (proc === "laser_cut") return "laser";
  if (AM.has(proc)) return "printed";
  if (proc.startsWith("cnc")) return "machined";
  return "other";
}
export const natureOf = (p) => nature(natureKey(p));
/** The screen that opens a part : its own studio when it has one (a busbar with its legs, a flex circuit, a profile, a board), the part studio otherwise. */
export const studioOf = (p) => (p && p.busbar ? "busbar" : p && p.flex ? "flex" : p && p.family === "pcb" ? "pcb" : p && p.family === "extrusion" ? "extrusion" : "parts");
const enc = encodeURIComponent;
export const partHash = (p) => `#/${studioOf(p)}/${enc(p.id)}`;
export const natureHash = (key) => `#/shop/n/${enc(key)}`;
export const asmHash = (a) => `#/assembly/${enc(a.id)}`;

/** The parts of a project by nature, in the order of NATURES, the natures that have none left out.
    → [{ key, label, fr, icon, color, items: [{ id, title, sub, icon, hash }] }] */
export function natureGroups(parts) {
  const by = new Map();
  for (const p of parts || []) { const k = natureKey(p); if (!by.has(k)) by.set(k, []); by.get(k).push(p); }
  return NATURES.filter((n) => by.has(n.key)).map((n) => ({ key: n.key, label: n.label, fr: n.fr, icon: n.icon, color: n.color, items: by.get(n.key).map((p) => ({ id: p.id, title: p.name || p.id, sub: p.id, icon: n.icon, hash: partHash(p) })) }));
}
/** The same parts by the assembly that uses them (a part of several assemblies is in each), then those no assembly uses. */
export function assemblyGroups(project) {
  const parts = (project && project.parts) || [], used = new Set(), row = (p) => { const n = natureOf(p); return { id: p.id, title: p.name || p.id, sub: p.id, icon: n.icon, hash: partHash(p), color: n.color }; }, out = [];
  for (const a of (project && project.assemblies) || []) {
    const ids = [...new Set((a.instances || []).map((i) => i.part).filter(Boolean))], items = ids.map((id) => parts.find((p) => p.id === id)).filter(Boolean);
    for (const p of items) used.add(p.id);
    out.push({ key: `asm:${a.id}`, label: a.name || a.id, fr: a.id, icon: "assembly", color: "#475569", hash: asmHash(a), items: items.map(row) });
  }
  const free = parts.filter((p) => !used.has(p.id));
  if (free.length) out.push({ key: "~free", label: "Dans aucun assemblage", fr: "", icon: "part", color: "#78716c", items: free.map(row) });
  return out;
}

const SHELVES = { registre: ["Registre des interfaces", "interfaces"], process: ["Procédés spéciaux", "cast"], library: ["Bibliothèque électrique", "library"] };
const STUDIO_NATURE = { extrusion: "extrusion", busbar: "busbar", flex: "flex", pcb: "pcb" };
const STUDIOS = new Set(["parts", "pcb", "extrusion", "busbar", "flex"]);
/* the part a studio shows for this address : the one named when it exists (and is of the studio, for a busbar or a flex circuit), its first one otherwise — as the studios themselves choose */
function shownPart(key, args, parts) {
  const mine = key === "busbar" ? (p) => !!p.busbar : key === "flex" ? (p) => !!p.flex : key === "pcb" ? (p) => p.family === "pcb" : key === "extrusion" ? (p) => p.family === "extrusion" : () => true;
  const named = args[0] ? parts.find((p) => p.id === args[0]) : null;
  if (named && (key === "busbar" || key === "flex" ? mine(named) : true)) return named;
  return parts.find(mine) || null;
}
/** Where a screen stands. key, args : the address (`#/key/args…`) ; project.
    → null when the screen is not on the path of the Shop, or
      { crumbs: [{ level (1 | 2 | 3 | 0 for a place beside the levels), label, sub, icon, color, hash (where a click goes ; null on the last), drop ("natures" | "parts" | "assemblies" | null), on }],
        up (the address one level up, or null), part, nature, assembly } */
export function levelsOf(key, args, project) {
  if (!project) return null;
  const parts = project.parts || [], a = args || [], shop = { level: 1, label: "Atelier", icon: "atelier", hash: "#/shop", drop: null };
  const place = (label, icon) => ({ crumbs: [shop, { level: 0, label, icon, hash: null, drop: null, on: true }], up: "#/shop", part: null, nature: null, assembly: null });
  const natureCrumb = (n, on) => ({ level: 2, label: n.label, sub: n.fr, icon: n.icon, color: n.color, hash: on ? null : natureHash(n.key), drop: "natures", on });
  if (key === "shop") {
    if (a[0] === "new") return place("Nouvelle pièce · pas à pas", "intent");
    if (a[0] === "ai") return place("Nouvelles pièces · avec l'IA", "sparkle");
    if (a[0] === "n" && BY.has(a[1])) { const n = nature(a[1]); return { crumbs: [shop, natureCrumb(n, true)], up: "#/shop", part: null, nature: n, assembly: null }; }
    return { crumbs: [{ ...shop, hash: null, on: true }], up: null, part: null, nature: null, assembly: null };
  }
  if (key === "interfaces") return a[0] === "registre" ? place(...SHELVES.registre) : place("Nouvelle pièce · avec l'IA", "sparkle");
  if (key === "process") return place(...SHELVES.process);
  if (key === "library") return place(...SHELVES.library);
  if (STUDIOS.has(key)) {
    if (key === "extrusion" && a[0] === "claude") { const n = nature("extrusion"); return { crumbs: [shop, natureCrumb(n, false), { level: 0, label: "Nouveau profilé", icon: "plus", hash: null, drop: null, on: true }], up: natureHash(n.key), part: null, nature: n, assembly: null }; }
    const p = shownPart(key, a, parts);
    if (!p) { if (!STUDIO_NATURE[key]) return { crumbs: [shop, { level: 0, label: "Pièces", icon: "part", hash: null, drop: null, on: true }], up: "#/shop", part: null, nature: null, assembly: null };
      const n = nature(STUDIO_NATURE[key]); return { crumbs: [shop, natureCrumb(n, true)], up: "#/shop", part: null, nature: n, assembly: null }; }
    const n = natureOf(p);
    return { crumbs: [shop, natureCrumb(n, false), { level: 3, label: p.name || p.id, sub: p.id, icon: n.icon, color: n.color, hash: null, drop: "parts", on: true }], up: natureHash(n.key), part: p, nature: n, assembly: null };
  }
  if (key === "assembly") {
    const list = project.assemblies || [], asm = (a[0] && list.find((x) => x.id === a[0])) || list[0] || null;
    return { crumbs: [{ level: 0, label: "Assemblage", icon: "assembly", hash: null, drop: null, on: !asm }, ...(asm ? [{ level: 0, label: asm.name || asm.id, sub: asm.id, icon: "assembly", hash: null, drop: list.length > 1 ? "assemblies" : null, on: true }] : [])], up: null, part: null, nature: null, assembly: asm };
  }
  return null;
}
/** The parts one may go to from a part : its sisters first (the same nature), then the others, nature by nature. */
export function partChoices(parts, current) {
  const groups = natureGroups(parts), k = current ? natureKey(current) : null, mine = groups.filter((g) => g.key === k), rest = groups.filter((g) => g.key !== k);
  return [...mine.map((g) => ({ ...g, label: `${g.label} — dans ce studio` })), ...rest];
}
/** The natures one may go to : every nature that has parts, with how many — and where a click leads. */
export const natureChoices = (parts) => [{ key: "natures", label: "Natures de pièce", color: "#475569", items: natureGroups(parts).map((g) => ({ id: g.key, title: g.label, sub: `${g.fr} · ${g.items.length} pièce${g.items.length > 1 ? "s" : ""}`, icon: g.icon, dot: g.color })) }];
