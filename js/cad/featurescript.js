/* DesignWizard.ai — export of a part to Onshape FeatureScript: ONE Feature Studio source defining a custom feature that
   rebuilds the part natively in Onshape, with the parameters of the part as inputs of the feature.

   EXPERIMENTAL: nothing here can be run against Onshape from this project, so the generator sticks to the oldest and
   best-known FeatureScript (sketches, opExtrude, opRevolve, opBoolean, opFillet, opChamfer, opShell, opDeleteBodies, the
   fCuboid / fCylinder / fCone primitives, evBox3d / evPlane / evLine evaluations) and says so in the generated header.

   How it works. The part language is NOT evaluated to numbers: every dimension is carried as a small symbolic value
   {fs, prec, v, c} = FeatureScript text + its operator precedence + the numeric value today (to take the decisions the
   builder takes: signs, pattern kinds) + "is a constant". Inside the generated feature every parameter is a plain number
   in millimetres (degrees for angles) and the unit is applied at the last moment (`expr * millimeter`), so the part-language
   expressions translate one to one. What the language decides from the built geometry (level of a face when "start" is
   not given, depth of a through hole, faces opened by a shell, edges of a fillet) is computed in Onshape by a few helper
   functions emitted at the end of the script (only those used).
   What cannot be converted is listed in `skipped` and left as a `// NON CONVERTI : …` comment at its place.

   Modules, each importing only from those listed before it (no cycle): fs_expr.js (expressions, symbolic values),
   fs_helpers.js (reserved names, emitted helper source), fs_gen.js (generator state, shared emitters), fs_features.js
   (operations), fs_interfaces.js (extrusion and pcb blocks, interfaces), then this file: parameters, assembly of the
   script, and the public entry point (toFeatureScript, exprToFeatureScript, FS_VERSION, FS_NOTICE). */

import { resolveParams, identifiers, ExprError } from "./expr.js";
import { Skip, fnum, parseExpr, printAst, created } from "./fs_expr.js";
import { FS_KEYWORDS, FS_USED, fsString, clean, HELPERS } from "./fs_helpers.js";
import { makeGen } from "./fs_gen.js";
import { EMIT } from "./fs_features.js";
import { emitExtrusionBlock, emitPcbBlock, emitInterface } from "./fs_interfaces.js";
import { expandSpec } from "./shop.js";
import { compileFolded } from "./family_folded.js";
import { evalDeep } from "./expr.js";

export { exprToFeatureScript } from "./fs_expr.js";
export const FS_VERSION = "2014";

function paramKind(d) {
  const unit = d.unit === undefined || d.unit === null ? "mm" : String(d.unit).trim().toLowerCase();
  if (/^(°|deg|degre|degré|degres|degrés|degree|degrees)$/.test(unit)) return "angle";
  if (unit === "mm") return "length";
  if (unit === "" && Number.isInteger(d.resolved) && (d.step === undefined || d.step === null || Number.isInteger(d.step))) return "integer";
  return "real";
}

function boundSpec(d, kind) {
  let v = d.resolved, lo = typeof d.min === "number" ? d.min : (kind === "angle" ? -360 : kind === "real" ? -1e6 : v < 0 ? -1e5 : 0);
  let hi = typeof d.max === "number" ? d.max : (kind === "angle" ? 360 : kind === "real" ? 1e6 : 1e5);
  lo = Math.min(lo, v); hi = Math.max(hi, v);
  if (kind === "integer") { v = Math.round(v); lo = Math.floor(lo); hi = Math.ceil(hi); }
  const unit = kind === "length" ? "millimeter" : kind === "angle" ? "degree" : "unitless";
  const spec = kind === "length" ? "LengthBoundSpec" : kind === "angle" ? "AngleBoundSpec" : kind === "integer" ? "IntegerBoundSpec" : "RealBoundSpec";
  return `{ (${unit}) : [${fnum(lo)}, ${fnum(v)}, ${fnum(hi)}] } as ${spec}`;
}

/**
 * Onshape FeatureScript of a part: one Feature Studio source defining a custom feature that rebuilds the part, with the
 * editable parameters of the part as inputs of the feature (derived parameters are computed in the feature).
 * EXPERIMENTAL — the output cannot be tested against Onshape from this project.
 * @param spec part spec (part language, see language_doc.js)
 * @param opts {overrides: {param: value} current values used as defaults, identifier: name of the exported feature constant}
 * @returns {code, warnings: string[] (French), converted, skipped: [{feature, why}], total, identifier}
 *          `converted + skipped.length === total` = features (without the {op:"interfaces"} marker) + interfaces
 *          (+ the base and the folded edges of a « folded » block)
 *          + 1 for an "extrusion" block + 1 for a "pcb" block.
 * Throws (ExprError) when the parameters of the spec do not resolve.
 */
export function toFeatureScript(spec, opts = {}) {
  spec = expandSpec(spec);                                       // a part born in the Shop : its raw stock and its Shop verbs become plain operations first
  spec = spec || {};
  const { defs, scope } = resolveParams(spec.params || {}, opts.overrides || {});
  // FeatureScript names: fields of `definition` keep the parameter name (unless it is a keyword), locals avoid what the body uses
  const local = {}, field = {}, taken = new Set(), names = Object.keys(defs);
  for (const name of names) {
    let l = name;
    while (FS_KEYWORDS.has(l) || FS_USED.has(l) || /^dw/.test(l) || taken.has(l) || (l !== name && names.includes(l))) l += "_";
    taken.add(l); local[name] = l;
    let fl = name;
    while (FS_KEYWORDS.has(fl) || (fl !== name && names.includes(fl))) fl += "_";
    field[name] = fl;
  }
  const rename = (name) => { if (!(name in local)) throw new ExprError(`Paramètre inconnu « ${name} ». Correctif : ajoutez-le dans "params".`); return local[name]; };
  const G = makeGen(scope, rename);
  const skipped = [];
  let converted = 0;

  // ---- parameters: inputs of the feature, then derived values ----
  const pre = [], head = [];
  const editable = names.filter((n) => defs[n].expr === undefined && typeof defs[n].value === "number"), derived = names.filter((n) => !editable.includes(n));
  for (const name of editable) {
    const d = defs[name], kind = paramKind(d), check = kind === "length" ? "isLength" : kind === "angle" ? "isAngle" : kind === "integer" ? "isInteger" : "isReal";
    pre.push(`        annotation { "Name" : ${fsString(d.label || name)} }`);
    pre.push(`        ${check}(definition.${field[name]}, ${boundSpec(d, kind)});`);
    head.push(`        const ${local[name]} = definition.${field[name]}${kind === "length" ? " / millimeter" : kind === "angle" ? " / degree" : ""};`);
    if (kind === "real" && d.unit) G.warn(`Paramètre « ${name} » : l'unité « ${d.unit} » n'a pas d'équivalent ; il est saisi comme un nombre sans unité.`);
  }
  if (derived.length) {
    head.push("        // paramètres dérivés (calculés, non modifiables)");
    const done = new Set(editable), pending = derived.slice();
    while (pending.length) {
      const src = (n) => (defs[n].expr !== undefined ? defs[n].expr : defs[n].value);
      const i = pending.findIndex((n) => identifiers(String(src(n))).every((x) => done.has(x)));
      const name = pending.splice(i < 0 ? 0 : i, 1)[0], s = src(name);
      const r = typeof s === "number" ? { fs: fnum(s) } : printAst(parseExpr(String(s)), rename);
      head.push(`        const ${local[name]} = ${r.bool ? `${r.fs} ? 1 : 0` : r.fs};`);
      done.add(name);
    }
  }

  // ---- geometry, in the order of build.js: family blocks, features, interfaces (at the marker, else at the end) ----
  const item = (label, title, run) => {
    const snap = G.snapshot();
    G.emit("");
    G.emit(`// ${clean(title)}`);
    try { run(); converted++; }
    catch (e) {
      G.restore(snap);
      const why = clean(e && e.message ? e.message : String(e)).replace(/\.$/, "");
      skipped.push({ feature: label, why });
      G.emit("");
      G.emit(`// NON CONVERTI : ${clean(title)} — ${why}`);
    }
  };
  if (spec.step) G.warn("La géométrie importée (STEP) de cette pièce ne peut pas être reconstruite par un script : seules les fonctions ajoutées dans DesignWizard.ai sont converties.");
  if (spec.pcb) G.main = "board";
  if (spec.extrusion) item("extrusion", "extrusion — section extrudée", () => emitExtrusionBlock(G, spec.extrusion));
  if (spec.pcb) item("pcb", "pcb — carte et composants", () => emitPcbBlock(G, spec.pcb));
  let folded = [];                                             // a folded sheet : its base and its folded edges, with the sizes of today
  if (spec.folded) { try { folded = compileFolded(evalDeep(spec.folded, scope)).features; G.warn("Tôle pliée : la base et les bords pliés sont écrits avec leurs dimensions du jour ; un paramètre changé dans Onshape ne les déplace pas."); } catch (e) { skipped.push({ feature: "folded", why: clean(e.message) }); } }
  const feats = [...folded, ...(Array.isArray(spec.features) ? spec.features : [])].map((f, i) => ({ ...(f || {}), id: (f && f.id) || `f${i + 1}` }));
  const marker = feats.findIndex((f) => f.op === "interfaces");
  const runFeature = (f) => item(f.id, `${f.id} — ${f.op}${f.name ? " : " + f.name : ""}`, () => {
    if (f.suppressed) throw new Skip("fonction désactivée dans la pièce (suppressed)");
    if (f.when !== undefined && !G.frozen(f.when, `condition « when » de « ${f.id} »`)) throw new Skip("condition « when » fausse à la génération");
    const op = EMIT[f.op];
    if (!op) throw new Skip(`opération « ${f.op} » sans conversion FeatureScript`);
    op(G, f);
  });
  const runInterfaces = () => (Array.isArray(spec.interfaces) ? spec.interfaces : []).forEach((raw, k) => {
    const iface = { ...(raw || {}), id: (raw && raw.id) || `IF${k + 1}` };
    item(iface.id, `${iface.id} — interface ${iface.type}${iface.name ? " : " + iface.name : ""} (côté ${iface.side === "B" ? "B" : "A"}, face ${iface.face || "+Z"})`, () => emitInterface(G, iface));
  });
  feats.forEach((f, i) => { if (f.op === "interfaces") { if (i === marker) runInterfaces(); } else runFeature(f); });
  if (marker < 0) runInterfaces();
  if (G.sketches.length) {
    G.emit("");
    G.emit("// les esquisses ne servent plus");
    G.call("opDeleteBodies", 'id + "deleteSketches"', [["entities", `qUnion([${G.sketches.map((s) => created(s)).join(", ")}])`]]);
  }
  const total = converted + skipped.length;
  if (skipped.length) G.warn(`${skipped.length} élément(s) sur ${total} non converti(s) : ${skipped.map((s) => s.feature).join(", ")}. Ils sont repérés « NON CONVERTI » dans le script.`);

  // ---- script ----
  const title = `${spec.id || ""} ${spec.name || ""}`.trim() || "Pièce DesignWizard.ai";
  const identifier = opts.identifier && /^[A-Za-z_][A-Za-z0-9_]*$/.test(opts.identifier) && !FS_KEYWORDS.has(opts.identifier) ? opts.identifier
    : `dw_${String(spec.id || spec.name || "part").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "part"}`;
  const out = [`FeatureScript ${FS_VERSION};`, `import(path : "onshape/std/geometry.fs", version : "${FS_VERSION}.0");`, "",
    ...headerComment(title, converted, skipped, G.warnings), "",
    `annotation { "Feature Type Name" : ${fsString(title)} }`,
    `export const ${identifier} = defineFeature(function(context is Context, id is Id, definition is map)`,
    "    precondition", "    {", ...pre, "    }", "    {",
    "        // paramètres : nombres en millimètres (degrés pour les angles)", ...head, ...G.lines, "    });"];
  for (const h of Object.keys(HELPERS)) if (G.helpers.has(h)) out.push("", HELPERS[h]);
  return { code: out.join("\n") + "\n", warnings: G.warnings, converted, skipped, total, identifier };
}

/** The notice written at the top of every generated script (French: it is read by the user in Onshape). */
export const FS_NOTICE = [
  "EXPÉRIMENTAL — NON TESTÉ DANS ONSHAPE : ce script est généré automatiquement par DesignWizard.ai et n'a pas pu",
  "être vérifié dans Onshape. Il peut demander des retouches. Contrôlez toujours la géométrie obtenue (cotes,",
  "perçages, congés) avant de vous en servir ; la référence reste la pièce DesignWizard.ai et son export STEP.",
];

function headerComment(title, converted, skipped, warnings) {
  const bar = "// " + "-".repeat(110), L = (s = "") => (s ? `// ${s}` : "//");
  const lines = [bar,
    L(`Généré par DesignWizard.ai — export FeatureScript (Onshape) de la pièce « ${clean(title)} ».`), L(),
    ...FS_NOTICE.map(L), L(),
    L("Mode d'emploi :"),
    L("  1. Dans un document Onshape, créez un Feature Studio (bouton « + » en bas à gauche, « Create Feature Studio »)."),
    L("  2. Remplacez tout son contenu par ce texte (coller) : l'onglet ne doit signaler aucune erreur."),
    L(`  3. Dans un Part Studio, ajoutez la fonction personnalisée « ${clean(title)} » à la barre d'outils`),
    L("     (« Add custom features »), puis insérez-la : les paramètres de la pièce sont ses champs de saisie."),
    L(`  Le script vise la bibliothèque standard ${FS_VERSION} ; Onshape peut proposer de la mettre à jour : acceptez.`), L(),
    L("Conventions : dans la fonction, tous les nombres sont des millimètres (des degrés pour les angles) ; l'unité est"),
    L("appliquée au dernier moment (« x * millimeter »). Axes : X vers la droite, Y vers l'arrière, Z vers le haut."), L(),
    L(`Éléments convertis : ${converted} — non convertis : ${skipped.length}${skipped.length ? " (repérés « NON CONVERTI » dans le code)" : ""}.`)];
  if (warnings.length) { lines.push(L("Points à vérifier :")); for (const w of warnings) lines.push(L(`  - ${clean(w)}`)); }
  lines.push(bar);
  return lines;
}
