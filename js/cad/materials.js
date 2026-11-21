/* DesignWizard.ai — materials and processes (one source for the studios, the DFx rules, the BOM and the isolation analysis).
   Values are TYPICAL values of each family: the data sheet of the grade actually bought prevails.
   rho g/cm3 · cti = comparative tracking index (V, IEC 60112) for insulators · k W/m.K · E GPa. */

export const MATERIALS = [
  { id: "AL6061-T6", name: "Aluminium 6061-T6", cls: "metal", rho: 2.70, conductive: true, color: "#b9c6ce", k: 167, E: 69, processes: ["cnc_milling", "cnc_turning", "laser_cut"] },
  { id: "AL6063-T5", name: "Aluminium 6063-T5 (extrusion)", cls: "metal", rho: 2.70, conductive: true, color: "#c4ced4", k: 209, E: 69, processes: ["extrusion_al", "cnc_milling"] },
  { id: "AL5052-H32", name: "Aluminium 5052-H32 (sheet)", cls: "metal", rho: 2.68, conductive: true, color: "#b4c0c8", k: 138, E: 70, rMinT: 1.0, processes: ["sheet_metal", "laser_cut"] },
  { id: "CU-C110", name: "Copper C110 (ETP)", cls: "metal", rho: 8.89, conductive: true, color: "#c8763f", k: 388, E: 117, rMinT: 1.0, rhoE: 1.724e-8, processes: ["sheet_metal", "laser_cut", "cnc_milling"] },
  { id: "BRASS-360", name: "Brass C360", cls: "metal", rho: 8.50, conductive: true, color: "#c9a94f", k: 115, E: 97, processes: ["cnc_turning", "cnc_milling"] },
  { id: "SS-304", name: "Stainless steel 304", cls: "metal", rho: 8.00, conductive: true, color: "#9aa3aa", k: 16, E: 193, rMinT: 1.0, processes: ["sheet_metal", "cnc_milling", "cnc_turning", "laser_cut"] },
  { id: "STEEL-1018", name: "Steel 1018 (zinc plated)", cls: "metal", rho: 7.87, conductive: true, color: "#8d949a", k: 52, E: 205, rMinT: 1.0, processes: ["sheet_metal", "cnc_milling", "cnc_turning", "laser_cut"] },
  { id: "SS-316L", name: "Stainless steel 316L", fr: "Inox 316L", cls: "metal", rho: 7.98, conductive: true, color: "#a3abb1", k: 15, E: 193, rMinT: 1.0, processes: ["lpbf", "cnc_milling", "cnc_turning", "sheet_metal", "laser_cut"] },
  { id: "SS-17-4PH", name: "Stainless steel 17-4 PH (precipitation hardened)", fr: "Inox 17-4 PH (durci par précipitation)", cls: "metal", rho: 7.80, conductive: true, color: "#8f989f", k: 18, E: 197, processes: ["lpbf", "cnc_milling", "cnc_turning"] },
  { id: "ALSI10MG", name: "Aluminium AlSi10Mg (metal 3D printing)", fr: "Aluminium AlSi10Mg (impression 3D métal)", cls: "metal", rho: 2.67, conductive: true, color: "#aab4ba", k: 130, E: 70, processes: ["lpbf"] },
  { id: "TI-6AL-4V", name: "Titanium Ti-6Al-4V (grade 5; ELI: grade 23)", fr: "Titane Ti-6Al-4V (grade 5 ; ELI : grade 23)", cls: "metal", rho: 4.43, conductive: true, color: "#8e8f96", k: 6.7, E: 114, processes: ["lpbf", "cnc_milling", "cnc_turning", "laser_cut"] },
  { id: "IN718", name: "Nickel alloy 718 (Inconel 718)", fr: "Alliage de nickel 718 (Inconel 718)", cls: "metal", rho: 8.19, conductive: true, color: "#7f8689", k: 11.4, E: 200, processes: ["lpbf", "cnc_milling", "cnc_turning"] },
  { id: "IN625", name: "Nickel alloy 625 (Inconel 625)", fr: "Alliage de nickel 625 (Inconel 625)", cls: "metal", rho: 8.44, conductive: true, color: "#868c8e", k: 9.8, E: 207, processes: ["lpbf", "cnc_milling", "cnc_turning"] },
  { id: "AL-A380", name: "Aluminium A380 (die casting)", cls: "metal", rho: 2.71, conductive: true, color: "#aeb6bb", k: 96, E: 71, wall: [1.5, 4.5], processes: ["die_casting"] },
  { id: "ZAMAK-3", name: "Zamak 3 (zinc, die casting)", cls: "metal", rho: 6.60, conductive: true, color: "#a3a9ad", k: 113, E: 86, wall: [0.8, 3.5], processes: ["die_casting"] },
  { id: "AL-A356-T6", name: "Aluminium A356-T6 (casting)", cls: "metal", rho: 2.68, conductive: true, color: "#b3bbc0", k: 151, E: 72, wall: [4.0, 12.0], processes: ["sand_casting", "permanent_mold", "lp_die_casting", "cnc_milling"] },
  { id: "PA66-GF30", name: "PA66-GF30", cls: "plastic", rho: 1.36, conductive: false, cti: 400, color: "#3a3d42", wall: [0.75, 3.0], ul94: "HB (V-0 grades exist)", processes: ["injection_molding"] },
  { id: "PC", name: "Polycarbonate", cls: "plastic", rho: 1.20, conductive: false, cti: 250, color: "#cfe4f2", wall: [1.0, 3.8], ul94: "V-2 / V-0 by grade", opacity: 0.55, processes: ["injection_molding", "cnc_milling", "extrusion_plastic", "fdm"] },
  { id: "PC-ABS", name: "PC/ABS", cls: "plastic", rho: 1.15, conductive: false, cti: 250, color: "#5d6670", wall: [1.2, 3.5], ul94: "V-0 by grade", processes: ["injection_molding"] },
  { id: "ABS", name: "ABS", cls: "plastic", rho: 1.05, conductive: false, cti: 600, color: "#e8e3d8", wall: [1.2, 3.5], ul94: "HB", processes: ["injection_molding", "fdm", "extrusion_plastic"] },
  { id: "PBT-GF30", name: "PBT-GF30", cls: "plastic", rho: 1.53, conductive: false, cti: 250, color: "#2f3338", wall: [0.8, 3.0], ul94: "V-0 by grade", processes: ["injection_molding"] },
  { id: "PPS-GF40", name: "PPS-GF40", cls: "plastic", rho: 1.65, conductive: false, cti: 175, color: "#4a4038", wall: [0.6, 3.0], ul94: "V-0", processes: ["injection_molding"] },
  { id: "POM", name: "POM (acetal)", cls: "plastic", rho: 1.41, conductive: false, cti: 600, color: "#f1f1ec", wall: [0.8, 3.0], ul94: "HB", processes: ["cnc_milling", "cnc_turning", "injection_molding", "laser_cut"] },
  { id: "PEEK", name: "PEEK", cls: "plastic", rho: 1.30, conductive: false, cti: 150, color: "#c9b48a", wall: [1.0, 4.0], ul94: "V-0", processes: ["cnc_milling", "injection_molding"] },
  { id: "PEI-9085", name: "PEI ULTEM 9085 (FDM)", cls: "plastic", rho: 1.34, conductive: false, cti: 150, color: "#c8a26b", ul94: "V-0 at 1.5 mm", processes: ["fdm"] },
  { id: "PEKK", name: "PEKK (high-temperature FDM)", fr: "PEKK (FDM haute température)", cls: "plastic", rho: 1.28, conductive: false, cti: 150, color: "#b89a62", ul94: "V-0", processes: ["fdm"] },
  { id: "PA12", name: "PA12 (MJF / SLS)", cls: "plastic", rho: 1.01, conductive: false, cti: 600, color: "#6b7078", ul94: "HB", processes: ["mjf"] },
  { id: "PA11", name: "PA11 (MJF / SLS)", cls: "plastic", rho: 1.04, conductive: false, cti: 600, color: "#7a7f86", ul94: "HB", processes: ["mjf"] },
  { id: "RESIN-SLA", name: "Rigid photopolymer resin (SLA)", fr: "Résine photopolymère rigide (SLA)", cls: "plastic", rho: 1.18, conductive: false, cti: 175, color: "#d7dde2", ul94: "HB", opacity: 0.8, processes: ["sla"] },
  { id: "PMMA", name: "Acrylic (PMMA)", fr: "Acrylique (PMMA)", cls: "plastic", rho: 1.19, conductive: false, cti: 600, color: "#e6f1f7", ul94: "HB", opacity: 0.45, processes: ["laser_cut", "cnc_milling"] },
  { id: "PVC-U", name: "PVC rigid (extrusion)", cls: "plastic", rho: 1.40, conductive: false, cti: 600, color: "#d9dcd6", ul94: "V-0", processes: ["extrusion_plastic"] },
  { id: "SILICONE", name: "Silicone rubber", cls: "elastomer", rho: 1.15, conductive: false, cti: 600, color: "#b5553c", processes: ["molded_rubber"] },
  { id: "FR4", name: "FR4 PCB (standard, CTI 175)", cls: "pcb", rho: 1.85, conductive: false, cti: 175, printedWiring: true, color: "#2f7d4f", processes: ["pcb", "laser_cut"] },
  { id: "FR4-CTI600", name: "FR4 PCB (high CTI 600)", cls: "pcb", rho: 1.85, conductive: false, cti: 600, printedWiring: true, color: "#2a6e7d", processes: ["pcb", "laser_cut"] },
  { id: "NOMEX-410", name: "Nomex 410 (aramid paper)", cls: "sheet", rho: 0.96, conductive: false, cti: 175, color: "#e8dcb0", dielectricKvMm: 27, processes: ["laser_cut"] },
  { id: "PET-FILM", name: "Polyester (PET) insulating film", fr: "Film polyester (PET) isolant", cls: "sheet", rho: 1.39, conductive: false, cti: 250, color: "#dfe9f2", opacity: 0.6, dielectricKvMm: 90, processes: ["laser_cut", "purchased"] },
  { id: "PI-FILM", name: "Polyimide (PI) insulating film", fr: "Film polyimide (PI) isolant", cls: "sheet", rho: 1.42, conductive: false, cti: 150, color: "#c98a2b", opacity: 0.7, dielectricKvMm: 150, processes: ["laser_cut", "purchased"] },
  { id: "THERMAL-PAD", name: "Filled silicone thermal pad", fr: "Pad thermique silicone chargé", cls: "elastomer", rho: 2.5, conductive: false, cti: 600, color: "#8fb8c9", k: 3, dielectricKvMm: 10, processes: ["purchased"] },
  { id: "GAP-FILLER", name: "Thermal gap filler (two-part)", fr: "Composé thermique de remplissage (deux composants)", cls: "elastomer", rho: 2.8, conductive: false, cti: 600, color: "#9aa7d1", k: 2.5, dielectricKvMm: 10, processes: ["purchased"] },
  { id: "EPOXY", name: "Epoxy potting / body", cls: "plastic", rho: 1.80, conductive: false, cti: 200, color: "#22262b", processes: ["purchased"] },
  { id: "LI-ION-CELL", name: "Cylindrical Li-ion cell (homogenized)", fr: "Cellule Li-ion cylindrique (homogénéisée)", cls: "component", rho: 2.65, conductive: true, color: "#3d6e8f", k: 3, processes: ["purchased"] },
  { id: "GENERIC-COMPONENT", name: "Electronic component (plastic body)", cls: "plastic", rho: 1.60, conductive: false, cti: 175, color: "#2b2f35", processes: ["purchased"] },
];

export const PROCESSES = {      // label : the term of the trade, in English — what every screen shows ; fr : its French gloss, for the glossary
  cnc_milling: { label: "CNC milling", fr: "Usinage CNC (fraisage)" },
  cnc_turning: { label: "CNC turning", fr: "Tournage CNC" },
  sheet_metal: { label: "Sheet metal (laser cutting + bending)", fr: "Tôlerie (découpe laser + pliage)" },
  laser_cut: { label: "Precision laser cutting (sheet, plate)", fr: "Découpe laser de précision (feuille, plaque)" },
  extrusion_al: { label: "Aluminium extrusion", fr: "Extrusion aluminium" },
  extrusion_plastic: { label: "Plastic extrusion", fr: "Extrusion plastique" },
  injection_molding: { label: "Injection molding", fr: "Moulage par injection" },
  die_casting: { label: "High pressure die casting (HPDC)", fr: "Fonderie sous pression (haute pression)" },
  lp_die_casting: { label: "Low pressure die casting (LPDC)", fr: "Fonderie basse pression (moule métallique rempli par le bas)" },
  permanent_mold: { label: "Permanent mold casting", fr: "Moulage en coquille par gravité (moule permanent)" },
  sand_casting: { label: "Sand casting", fr: "Moulage au sable" },
  fdm: { label: "FDM 3D printing", fr: "Impression 3D FDM" },
  mjf: { label: "MJF / SLS 3D printing", fr: "Impression 3D MJF / SLS" },
  sla: { label: "SLA resin 3D printing", fr: "Impression 3D résine (SLA)" },
  lpbf: { label: "Metal 3D printing (LPBF)", fr: "Impression 3D métal (fusion laser sur lit de poudre)" },
  pcb: { label: "PCB fabrication", fr: "Fabrication de PCB" },
  purchased: { label: "Purchased part", fr: "Pièce achetée" },
};
/** The name of a process as the trade says it, in English ("" when it is unknown). */
export const processName = (id) => (PROCESSES[id] ? PROCESSES[id].label : "");
/** The processes that fill a mold : the casting ones, and with injection the moulding ones. */
export const CAST_PROCESSES = ["die_casting", "lp_die_casting", "permanent_mold", "sand_casting"], MOLD_PROCESSES = ["injection_molding", ...CAST_PROCESSES];

const BY_ID = new Map(MATERIALS.map((m) => [m.id, m]));
export function material(id) { return BY_ID.get(id) || BY_ID.get(String(id || "").toUpperCase()) || null; }
export function materialOrDefault(id) { return material(id) || { id: id || "?", name: id || "Matériau non défini", cls: "unknown", rho: 1.0, conductive: false, cti: 100, color: "#a8b0b8", unknown: true, processes: [] }; }
/* ---------- a menu of materials : filed by name (the family, not the grade), each with its processes in parentheses ---------- */
const FAMILIES = [[/^alumin/i, "Aluminium"], [/^stainless/i, "Stainless steel"], [/^steel/i, "Steel"], [/^copper/i, "Copper"], [/^brass/i, "Brass"], [/^titan/i, "Titanium"], [/nickel|inconel/i, "Nickel"], [/^zamak/i, "Zinc"],
  [/^PA\d/, "Polyamide (PA)"], [/^(PC\b|polycarbonate)/i, "Polycarbonate (PC)"], [/^ABS/, "ABS"], [/^PBT/, "PBT"], [/^PPS/, "PPS"], [/^POM/, "POM"], [/^(PEEK|PEKK|PEI)/, "High performance (PEEK, PEKK, PEI)"], [/photopolymer/i, "Resin"], [/^(acryl|PMMA)/i, "Acrylic (PMMA)"], [/^PVC/, "PVC"],
  [/^(epoxy|electronic)/i, "Purchased components"], [/silicone|thermal pad|gap filler/i, "Elastomers and thermal"], [/^FR4/, "FR4"], [/nomex|aramid/i, "Aramid paper"], [/insulating film/i, "Insulating films"], [/li-ion cell/i, "Cells"]];
const PROC_WORD = { cnc_milling: "machining", cnc_turning: "machining", sheet_metal: "sheet metal", laser_cut: "laser", extrusion_al: "extrusion", extrusion_plastic: "extrusion", injection_molding: "injection molding", die_casting: "HPDC", lp_die_casting: "LPDC", permanent_mold: "permanent mold", sand_casting: "sand casting",
  fdm: "FDM", mjf: "MJF / SLS", sla: "SLA", lpbf: "LPBF", pcb: "PCB", molded_rubber: "molding", purchased: "purchased" };
/** The family a material is filed under in a menu : its name, not its grade. */
export function materialFamily(m) { const f = m && FAMILIES.find(([re]) => re.test(m.name)); return f ? f[1] : m ? m.name.split(/[\s(]/)[0] : ""; }
/** Its processes in a few words, for the parentheses of a menu : « machining, laser ». */
export function processWords(m) { return [...new Set(((m && m.processes) || []).map((k) => PROC_WORD[k] || processName(k) || k))].join(", "); }
/** Its name as one reads it in a list : a note in parentheses that names a process goes (the processes come after, from the
    library) ; any other note — a temper, a grade, a CTI — stays, after a dot. */
export const materialShort = (m) => (m ? m.name.replace(/\s*\(([^)]*)\)\s*$/, (all, note) => (/extrusion|sheet|MJF|SLS|FDM|SLA|casting|molding|3D printing/i.test(note) ? "" : ` · ${note}`)) : "");
/** The label of a material in a menu : « Aluminium 6061-T6 (usinage, laser) ». */
export const materialLabel = (m) => { const w = processWords(m); return `${materialShort(m)}${w ? ` (${w})` : ""}`; };
/** A menu of materials, filed by name : [{ family, list: [material] }], the families in alphabetical order and, in a family, the grades too.
    keep(m) : which materials the menu offers (all by default). */
export function materialMenu(keep = () => true) {
  const by = new Map(), fr = (a, b) => a.localeCompare(b, "fr", { numeric: true });
  for (const m of MATERIALS) if (keep(m)) { const f = materialFamily(m); if (!by.has(f)) by.set(f, []); by.get(f).push(m); }
  return [...by.entries()].sort((a, b) => fr(a[0], b[0])).map(([family, list]) => ({ family, list: list.sort((a, b) => fr(materialShort(a), materialShort(b))) }));
}
export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || "");
  return m ? [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255] : [0.66, 0.69, 0.72];
}
/** Colour of a net (isolation analysis and PCB zones), stable per name. */
export function netColor(name) {
  const fixed = { "HV+": "#e4572e", "HV-": "#2d7dd2", "CHASSIS": "#8d949a", "GND": "#5b6570", "PE": "#5fa052" };
  const k = String(name || "").toUpperCase();
  if (fixed[k]) return fixed[k];
  let h = 0; for (const ch of k) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 65% 50%)`;
}
