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
  { id: "STEEL-1018", name: "Steel 1018 (zinc plated)", cls: "metal", rho: 7.87, conductive: true, color: "#8d949a", k: 52, E: 205, rMinT: 1.0, processes: ["sheet_metal", "cnc_milling", "cnc_turning"] },
  { id: "AL-A380", name: "Aluminium A380 (fonderie sous pression)", cls: "metal", rho: 2.71, conductive: true, color: "#aeb6bb", k: 96, E: 71, wall: [1.5, 4.5], processes: ["die_casting"] },
  { id: "ZAMAK-3", name: "Zamak 3 (zinc, fonderie sous pression)", cls: "metal", rho: 6.60, conductive: true, color: "#a3a9ad", k: 113, E: 86, wall: [0.8, 3.5], processes: ["die_casting"] },
  { id: "AL-A356-T6", name: "Aluminium A356-T6 (fonderie par gravité)", cls: "metal", rho: 2.68, conductive: true, color: "#b3bbc0", k: 151, E: 72, wall: [4.0, 12.0], processes: ["sand_casting", "cnc_milling"] },
  { id: "PA66-GF30", name: "PA66-GF30", cls: "plastic", rho: 1.36, conductive: false, cti: 400, color: "#3a3d42", wall: [0.75, 3.0], ul94: "HB (V-0 grades exist)", processes: ["injection_molding"] },
  { id: "PC", name: "Polycarbonate", cls: "plastic", rho: 1.20, conductive: false, cti: 250, color: "#cfe4f2", wall: [1.0, 3.8], ul94: "V-2 / V-0 by grade", opacity: 0.55, processes: ["injection_molding", "cnc_milling", "extrusion_plastic"] },
  { id: "PC-ABS", name: "PC/ABS", cls: "plastic", rho: 1.15, conductive: false, cti: 250, color: "#5d6670", wall: [1.2, 3.5], ul94: "V-0 by grade", processes: ["injection_molding"] },
  { id: "ABS", name: "ABS", cls: "plastic", rho: 1.05, conductive: false, cti: 600, color: "#e8e3d8", wall: [1.2, 3.5], ul94: "HB", processes: ["injection_molding", "fdm", "extrusion_plastic"] },
  { id: "PBT-GF30", name: "PBT-GF30", cls: "plastic", rho: 1.53, conductive: false, cti: 250, color: "#2f3338", wall: [0.8, 3.0], ul94: "V-0 by grade", processes: ["injection_molding"] },
  { id: "PPS-GF40", name: "PPS-GF40", cls: "plastic", rho: 1.65, conductive: false, cti: 175, color: "#4a4038", wall: [0.6, 3.0], ul94: "V-0", processes: ["injection_molding"] },
  { id: "POM", name: "POM (acetal)", cls: "plastic", rho: 1.41, conductive: false, cti: 600, color: "#f1f1ec", wall: [0.8, 3.0], ul94: "HB", processes: ["cnc_milling", "cnc_turning", "injection_molding"] },
  { id: "PEEK", name: "PEEK", cls: "plastic", rho: 1.30, conductive: false, cti: 150, color: "#c9b48a", wall: [1.0, 4.0], ul94: "V-0", processes: ["cnc_milling", "injection_molding"] },
  { id: "PEI-9085", name: "PEI ULTEM 9085 (FDM)", cls: "plastic", rho: 1.34, conductive: false, cti: 150, color: "#c8a26b", ul94: "V-0 at 1.5 mm", processes: ["fdm"] },
  { id: "PA12", name: "PA12 (MJF / SLS)", cls: "plastic", rho: 1.01, conductive: false, cti: 600, color: "#6b7078", ul94: "HB", processes: ["mjf"] },
  { id: "PVC-U", name: "PVC rigid (extrusion)", cls: "plastic", rho: 1.40, conductive: false, cti: 600, color: "#d9dcd6", ul94: "V-0", processes: ["extrusion_plastic"] },
  { id: "SILICONE", name: "Silicone rubber", cls: "elastomer", rho: 1.15, conductive: false, cti: 600, color: "#b5553c", processes: ["molded_rubber"] },
  { id: "FR4", name: "FR4 PCB (standard, CTI 175)", cls: "pcb", rho: 1.85, conductive: false, cti: 175, printedWiring: true, color: "#2f7d4f", processes: ["pcb"] },
  { id: "FR4-CTI600", name: "FR4 PCB (high CTI 600)", cls: "pcb", rho: 1.85, conductive: false, cti: 600, printedWiring: true, color: "#2a6e7d", processes: ["pcb"] },
  { id: "NOMEX-410", name: "Nomex 410 (aramid paper)", cls: "sheet", rho: 0.96, conductive: false, cti: 175, color: "#e8dcb0", dielectricKvMm: 27, processes: ["laser_cut"] },
  { id: "EPOXY", name: "Epoxy potting / body", cls: "plastic", rho: 1.80, conductive: false, cti: 200, color: "#22262b", processes: ["purchased"] },
  { id: "LI-ION-CELL", name: "Cellule Li-ion cylindrique (homogénéisée)", cls: "component", rho: 2.65, conductive: true, color: "#3d6e8f", k: 3, processes: ["purchased"] },
  { id: "GENERIC-COMPONENT", name: "Electronic component (plastic body)", cls: "plastic", rho: 1.60, conductive: false, cti: 175, color: "#2b2f35", processes: ["purchased"] },
];

export const PROCESSES = {
  cnc_milling: { label: "CNC milling", fr: "Usinage CNC (fraisage)" },
  cnc_turning: { label: "CNC turning", fr: "Tournage CNC" },
  sheet_metal: { label: "Sheet metal", fr: "Tôlerie (découpe laser + pliage)" },
  laser_cut: { label: "Laser / waterjet cut plate", fr: "Plaque découpée (laser / jet d'eau)" },
  extrusion_al: { label: "Aluminium extrusion", fr: "Extrusion aluminium" },
  extrusion_plastic: { label: "Plastic extrusion", fr: "Extrusion plastique" },
  injection_molding: { label: "Injection moulding", fr: "Moulage par injection" },
  die_casting: { label: "High-pressure die casting", fr: "Fonderie sous pression" },
  sand_casting: { label: "Gravity casting (sand or permanent mould)", fr: "Fonderie par gravité (sable ou coquille)" },
  fdm: { label: "FDM 3D printing", fr: "Impression 3D FDM" },
  mjf: { label: "MJF / SLS 3D printing", fr: "Impression 3D MJF / SLS" },
  pcb: { label: "PCB fabrication", fr: "Fabrication de PCB" },
  purchased: { label: "Purchased part", fr: "Pièce achetée" },
};

const BY_ID = new Map(MATERIALS.map((m) => [m.id, m]));
export function material(id) { return BY_ID.get(id) || BY_ID.get(String(id || "").toUpperCase()) || null; }
export function materialOrDefault(id) { return material(id) || { id: id || "?", name: id || "Matériau non défini", cls: "unknown", rho: 1.0, conductive: false, cti: 100, color: "#a8b0b8", unknown: true, processes: [] }; }
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
