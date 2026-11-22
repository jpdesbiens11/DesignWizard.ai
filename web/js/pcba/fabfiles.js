/* DesignOrbit.ai — PCBA: the fabrication package of a board — what a board shop and an assembler need to quote and
   build a prototype : Gerber layers, drill files, pick-and-place, bill of materials, netlist, and the notes that say
   what the files do not (stack-up, finish, conformal coating). File extensions are the ones shops recognise. */

import { resolveBoard, boardBom, copperLayers, COATINGS, FAB } from "./model.js";
import { layerArt, coatingKeepouts, LAYER_NAMES } from "./art.js";
import { gerber } from "./gerber.js";
import { excellon, drillTable } from "./drill.js";
import { zip } from "../core/zip.js";
import { boardAssemblyPlan } from "./assembly_plan.js";
import { planText } from "../core/plan_doc.js";
import { stampText } from "../core/brand.js";

export const FAB_FILES = [
  { key: "top", ext: ".GTL", fn: (n) => "Copper,L1,Top" }, { key: "in1", ext: ".G1", fn: () => "Copper,L2,Inr" }, { key: "in2", ext: ".G2", fn: () => "Copper,L3,Inr" }, { key: "bottom", ext: ".GBL", fn: (n) => `Copper,L${n},Bot` },
  { key: "mask_top", ext: ".GTS", fn: () => "Soldermask,Top", polarity: "Negative" }, { key: "mask_bottom", ext: ".GBS", fn: () => "Soldermask,Bot", polarity: "Negative" },
  { key: "silk_top", ext: ".GTO", fn: () => "Legend,Top" }, { key: "silk_bottom", ext: ".GBO", fn: () => "Legend,Bot" }, { key: "paste_top", ext: ".GTP", fn: () => "Paste,Top" }, { key: "paste_bottom", ext: ".GBP", fn: () => "Paste,Bot" },
  { key: "outline", ext: ".GKO", fn: () => "Profile,NP" }, { key: "coat_top", ext: "-vernis-dessus.gbr", fn: () => "Other,Vernis de tropicalisation dessus" }, { key: "coat_bottom", ext: "-vernis-dessous.gbr", fn: () => "Other,Vernis de tropicalisation dessous" },
  { key: "fab_top", ext: "-assemblage-dessus.gbr", fn: () => "AssemblyDrawing,Top" }, { key: "fab_bottom", ext: "-assemblage-dessous.gbr", fn: () => "AssemblyDrawing,Bot" },
].map((f) => ({ ...f, label: LAYER_NAMES[f.key] }));

const fr = (v, d = 2) => String(Math.round(v * 10 ** d) / 10 ** d).replace(".", ",");
const csv = (rows) => `${rows.map((r) => r.map((v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))).join(",")).join("\r\n")}\r\n`;
const pad = (s, n) => String(s).slice(0, n).padEnd(n);

/** Stack-up of the bare board, top to bottom : [{ layer, material, thickness (mm) }]. Typical build of a prototype shop. */
export function stackup(board) {
  const b = board.board || {}, n = b.layers >= 4 ? 4 : 2, cu = (b.copper || 35) / 1000, t = b.t || 1.6, rows = [{ layer: "Vernis épargne dessus", material: `Vernis ${b.mask || "vert"}`, thickness: 0.02 }];
  const copper = (i, name) => rows.push({ layer: `L${i} — ${name}`, material: `Cuivre ${b.copper || 35} µm`, thickness: cu });
  if (n === 2) { copper(1, "dessus"); rows.push({ layer: "Âme", material: "FR-4 TG150", thickness: Math.max(0.1, t - 2 * cu) }); copper(2, "dessous"); }
  else { const pp = 0.2, core = Math.max(0.1, t - 2 * pp - 4 * cu); copper(1, "dessus"); rows.push({ layer: "Préimprégné", material: "FR-4 7628", thickness: pp }); copper(2, "interne 1"); rows.push({ layer: "Âme", material: "FR-4 TG150", thickness: core }); copper(3, "interne 2"); rows.push({ layer: "Préimprégné", material: "FR-4 7628", thickness: pp }); copper(4, "dessous"); }
  rows.push({ layer: "Vernis épargne dessous", material: `Vernis ${b.mask || "vert"}`, thickness: 0.02 });
  return rows;
}

/** IPC-D-356A bare-board test netlist (fixed columns, millimetres × 0.001). */
function ipc356(R, id) {
  const co = (v) => `${v < 0 ? "-" : "+"}${String(Math.round(Math.abs(v) * 1000)).padStart(6, "0")}`, d4 = (v) => String(Math.round(v * 1000)).padStart(4, "0"), out = [`C  IPC-D-356A — ${id}`, "P  JOB   " + id, "P  UNITS CUST 1"];
  const line = (net, ref, pin, p) => `${p.drill ? "317" : "327"}${pad(net || "N/C", 14)}   ${pad(ref, 6)}-${pad(pin, 4)} ${p.drill ? `D${d4(p.drill)}${p.plated ? "P" : "U"}` : "      "}A${p.drill ? "00" : p.side === "bottom" ? "02" : "01"}X${co(p.x)}Y${co(p.y)}X${d4(p.w)}Y${d4(p.h)}R000 S0`;
  for (const p of R.pads) out.push(line(p.net, p.ref, p.n, p));
  for (const v of R.vias) out.push(line(v.net, "VIA", "", { drill: v.drill, plated: true, x: v.x, y: v.y, w: v.d, h: v.d }));
  out.push("999");
  return `${out.join("\n")}\n`;
}

/** The fabrication package. → { files: [{ key, name, label, mime, text }], stats, notes } */
export function fabPackage(board, lib = {}, opts = {}) {
  const R = resolveBoard(board, lib), art = layerArt(R, board), date = opts.date || new Date(0), n = R.layers.length, base = `${board.id || "carte"}-rev${board.revision || "A"}`, b = board.board || {}, files = [], notes = [...art.notes];
  for (const f of FAB_FILES) {
    const prims = art.layers[f.key];
    if (!prims || (!prims.length && !copperLayers(n).includes(f.key) && !f.key.startsWith("mask"))) continue;
    files.push({ key: f.key, name: `${base}${f.ext}`, label: f.label, mime: "application/vnd.gerber", text: gerber(prims, { function: f.fn(n), polarity: f.polarity, project: board.id, revision: board.revision, date, nets: copperLayers(n).includes(f.key) }) });
  }
  for (const plated of [true, false]) if (art.drills.some((h) => !!h.plated === plated)) files.push({ key: plated ? "pth" : "npth", name: `${base}-${plated ? "PTH" : "NPTH"}.DRL`, label: plated ? "Perçage des trous métallisés" : "Perçage des trous non métallisés", mime: "text/plain", text: excellon(art.drills, { plated, layers: n, project: board.id, date }) });
  const fitted = R.parts.filter((p) => !p.dnp && p.kind !== "testpoint"), bom = boardBom(board, lib);
  files.push({ key: "pnp", name: `${base}-placement.csv`, label: "Placement des composants (pick-and-place)", mime: "text/csv", text: csv([["Designator", "Comment", "Layer", "Footprint", "Center-X(mm)", "Center-Y(mm)", "Rotation", "Description"],
    ...fitted.map((p) => [p.ref, p.value, p.side === "bottom" ? "BottomLayer" : "TopLayer", p.def.package || "", p.x.toFixed(3), p.y.toFixed(3), p.rot, p.def.name])]) });
  files.push({ key: "bom", name: `${base}-nomenclature.csv`, label: "Nomenclature (BOM)", mime: "text/csv", text: csv([["Item", "Qty", "Designators", "Value", "Description", "Package", "Manufacturer", "MPN", "DNP", "Unit price", "Total"],
    ...bom.map((l, i) => [i + 1, l.qty, l.refs.join(" "), l.value, l.name, l.package, l.maker, l.mpn, l.dnp ? "DNP" : "", l.price.toFixed(2), l.total.toFixed(2)])]) });
  files.push({ key: "netcsv", name: `${base}-netlist.csv`, label: "Liste des nets", mime: "text/csv", text: csv([["Net", "Class", "Designator", "Pin", "Pin name", "X", "Y", "Layer"], ...R.pads.filter((p) => p.net).map((p) => [p.net, R.rules.of(p.net).class, p.ref, p.n, p.name, p.x.toFixed(3), p.y.toFixed(3), p.layers.join("+")])]) });
  files.push({ key: "ipc", name: `${base}-netlist.ipc`, label: "Netlist d'essai de la carte nue (IPC-D-356A)", mime: "text/plain", text: ipc356(R, board.id || "carte") });

  const minTrack = R.tracks.length ? Math.min(...R.tracks.map((t) => t.w)) : null, table = drillTable(art.drills), minDrill = table.length ? Math.min(...table.map((t) => t.d)) : null, need = (minTrack !== null && minTrack < FAB.standard.track - 1e-9) || (minDrill !== null && minDrill < FAB.standard.drill - 1e-9) ? "fin" : "standard";
  const keep = coatingKeepouts(R, board), coat = b.coating && b.coating.type && b.coating.type !== "none" ? b.coating : null, smd = R.pads.filter((p) => !p.drill).length, tht = R.pads.length - smd;
  const stats = { layers: n, size: [R.w, R.h], thickness: R.t, minTrack, minDrill, drills: table, pads: R.pads.length, smd, tht, vias: R.vias.length, parts: fitted.length, sides: ["top", "bottom"].filter((s) => R.parts.some((p) => p.side === s)), fab: need, lines: bom.length, cost: bom.reduce((s, l) => s + l.total, 0) };
  files.push({ key: "gamme", name: `${base}-gamme-assemblage.txt`, label: "Gamme d'assemblage de la carte", mime: "text/plain", text: planText(boardAssemblyPlan(board, lib)) });
  const txt = [`DOSSIER DE FABRICATION — ${board.id || "carte"} « ${board.name || ""} », révision ${board.revision || "A"}`, `Date : ${date.toISOString().slice(0, 10)}${opts.quantity ? ` — Quantité : ${opts.quantity}` : ""}`, "",
    "CARTE NUE", `  Dimensions : ${fr(R.w)} × ${fr(R.h)} mm, épaisseur ${fr(R.t)} mm, ${n} couches de cuivre.`, `  Matériau : FR-4 TG150. Cuivre ${b.copper || 35} µm. Finition : ${b.finish || "ENIG"}.`,
    `  Vernis épargne ${b.mask || "vert"} sur les deux faces, vias recouverts. Sérigraphie ${b.silk || "blanc"}.`, `  Plus petite piste : ${minTrack === null ? "—" : `${fr(minTrack)} mm`}. Plus petit perçage : ${minDrill === null ? "—" : `${fr(minDrill)} mm`}. Classe requise : ${FAB[need].label}.`,
    "  Exécution : IPC-A-600 classe 2. Essai électrique de la carte nue à 100 % d'après la netlist IPC-D-356A.", "", "EMPILAGE (de dessus en dessous)", ...stackup(board).map((r) => `  ${pad(r.layer, 26)} ${pad(r.material, 18)} ${fr(r.thickness, 3)} mm`), "",
    "PERÇAGES", ...table.map((t) => `  ${t.plated ? "Métallisé    " : "Non métallisé"} Ø ${fr(t.d, 3)} mm × ${t.count}`), "",
    "ASSEMBLAGE", `  ${fitted.length} composants, ${bom.length} lignes de nomenclature ; ${smd} pastilles en surface, ${tht} traversantes ; face(s) équipée(s) : ${stats.sides.map((s) => (s === "top" ? "dessus" : "dessous")).join(" et ") || "aucune"}.`,
    "  Brasage sans plomb. Exécution : IPC-A-610 classe 2. Coordonnées de placement en millimètres depuis le coin inférieur gauche, rotation en degrés, sens antihoraire vu de dessus.", "",
    "VERNIS DE TROPICALISATION", ...(coat ? [`  ${COATINGS[coat.type] || coat.type}, ${coat.thickness || 50} µm, ${coat.sides === "top" ? "dessus seulement" : "deux faces"}. Qualification du vernis : IPC-CC-830 ; contrôle : IPC-A-610.`,
      "  Zones à épargner (voir les fichiers « vernis ») :", ...keep.map((k) => `    ${k.ref ? pad(k.ref, 6) : pad(`Trou ${k.hole}`, 6)} ${k.side === "top" ? "dessus " : "dessous"} — ${k.why}`), "  Essais électriques et programmation avant vernissage."] : ["  Aucun."]), "",
    "FICHIERS", ...files.map((f) => `  ${pad(f.name, 44)} ${f.label}`), ...(notes.length ? ["", "REMARQUES", ...notes.map((x) => `  ${x}`)] : []), ""].join("\n");
  files.push({ key: "notes", name: `${base}-fabrication.txt`, label: "Notes de fabrication", mime: "text/plain", text: txt });
  for (const f of files) f.text = stampText(f.name, f.text);      // every file of the package carries the note of the platform, written the way its format allows (core/brand.js)
  return { files, stats, notes, art };
}

/** The package as one archive. */
export function fabZip(board, lib = {}, opts = {}) {
  return zip(fabPackage(board, lib, opts).files.map((f) => ({ name: f.name, bytes: f.text })), opts.date || new Date(0));
}
