/* DesignWizard.ai — "paste or drop anything": recognises what the user brings (an interview result from Claude, a part,
   an extrusion profile, a whole project, a STEP file) and puts it in the right place. */

import { store } from "./store.js";
import { toast } from "./dom.js";
import { validateSpec } from "../cad/build.js";

/** Find the JSON object in a text that may contain prose and ```json fences (an assistant's answer). */
export function extractJson(text) {
  if (typeof text !== "string") return null;
  const tryParse = (s) => { try { const v = JSON.parse(s); return v && typeof v === "object" ? v : null; } catch (e) { return null; } };
  const fences = [...text.matchAll(/```(?:json|JSON)?\s*([\s\S]*?)```/g)].map((m) => m[1]);
  for (const f of fences.sort((a, b) => b.length - a.length)) { const v = tryParse(f.trim()); if (v) return v; }
  const direct = tryParse(text.trim());
  if (direct) return direct;
  // widest balanced {...} block
  let best = null;
  for (let i = text.indexOf("{"); i >= 0 && i < text.length; i = text.indexOf("{", i + 1)) {
    let depth = 0, inStr = false, esc = false;
    for (let j = i; j < text.length; j++) {
      const ch = text[j];
      if (inStr) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') inStr = false; continue; }
      if (ch === '"') inStr = true; else if (ch === "{") depth++; else if (ch === "}") { depth--; if (depth === 0) { const v = tryParse(text.slice(i, j + 1)); if (v && (!best || j - i > best.len)) best = { v, len: j - i }; break; } }
    }
    if (best && best.len > text.length / 3) break;
  }
  return best ? best.v : null;
}

export function kindOf(obj) {
  if (!obj || typeof obj !== "object") return null;
  if (Array.isArray(obj)) return obj.every((x) => kindOf(x) === "part") && obj.length ? "parts" : null;
  const dw = String(obj.dw || "");
  if (dw.startsWith("project/") || (Array.isArray(obj.parts) && Array.isArray(obj.assemblies))) return "project";
  if (dw.startsWith("assembly/") || (Array.isArray(obj.instances) && !obj.features)) return "assembly";
  if (dw.startsWith("part/") || obj.features || obj.extrusion || obj.pcb) return "part";
  if (obj.outer || obj.poly || obj.path || obj.rect || obj.circle) return "profile";
  if (Array.isArray(obj.parts) && obj.parts.every((x) => kindOf(x) === "part")) return "parts";
  return null;
}

/** Import a part spec into the open project. Returns {id, replaced, errors, warnings}. */
export function importPart(spec, opts = {}) {
  const v = validateSpec(spec);
  if (v.errors.length) return { errors: v.errors, warnings: v.warnings };
  const s = JSON.parse(JSON.stringify(spec));
  s.dw = "part/1";
  if (!s.id) s.id = store.nextPartId();
  s.id = String(s.id).replace(/[^A-Za-z0-9_\-]/g, "-").slice(0, 40);
  const exists = store.part(s.id);
  if (exists && opts.replace !== false) {
    store.updatePart(s.id, () => s, `Pièce mise à jour depuis l'entrevue : ${s.id}`);
    return { id: s.id, replaced: true, errors: [], warnings: v.warnings };
  }
  const id = store.addPart(s, `Pièce importée : ${s.id} ${s.name || ""}`);
  return { id, replaced: false, errors: [], warnings: v.warnings };
}

export function importStep(text, filename = "import.step") {
  const base = filename.replace(/\.(step|stp)$/i, "").replace(/[^A-Za-z0-9_\-]/g, "-").slice(0, 32) || "IMPORT";
  const spec = { dw: "part/1", id: store.uniqueId(base.toUpperCase()), name: base, family: "purchased", process: "purchased", material: "", function: `Pièce importée du fichier ${filename}.`, step: { text, file: filename }, features: [] };
  return store.addPart(spec, `STEP importé : ${filename}`);
}

/** Import any text (pasted or read from a dropped file). Returns {kind, id} or null; shows what happened. */
export async function importAny(text, filename = "") {
  if (/^\s*ISO-10303-21/.test(text)) {
    if (!store.project) await store.create("Projet importé");
    const id = importStep(text, filename || "import.step");
    toast(`STEP importé comme pièce achetée « ${id} ».`, "success");
    return { kind: "step", id };
  }
  const obj = extractJson(text), kind = kindOf(obj);
  if (!kind) { toast("Texte non reconnu : ni pièce, ni profil, ni projet DesignWizard, ni STEP. Correctif : collez la réponse JSON complète de l'entrevue.", "error", 7000); return null; }
  if (kind === "project") {
    const p = await store.create(obj.name || "Projet importé", obj);
    toast(`Projet « ${p.name} » importé (${p.parts.length} pièce(s)).`, "success");
    return { kind, id: p.id };
  }
  if (!store.project) await store.create("Mon produit");
  if (kind === "part" || kind === "parts") {
    const list = kind === "part" ? [obj] : (Array.isArray(obj) ? obj : obj.parts);
    let last = null; const problems = [];
    for (const s of list) { const r = importPart(s); if (r.errors.length) problems.push(`${s.id || s.name || "?"} : ${r.errors.join(" ")}`); else last = r; }
    if (problems.length) toast(`Import refusé — ${problems.join(" | ")}`, "error", 9000);
    if (last) toast(`${list.length - problems.length} pièce(s) ${last.replaced ? "mise(s) à jour" : "créée(s)"} depuis le texte collé.`, "success");
    return last ? { kind: "part", id: last.id } : null;
  }
  if (kind === "assembly") {
    const a = JSON.parse(JSON.stringify(obj));
    a.id = store.uniqueId(a.id || "ASM-001"); a.mates = a.mates || [];
    store.commit(`Assemblage importé : ${a.id}`, (p) => p.assemblies.push(a));
    toast(`Assemblage « ${a.id} » importé.`, "success");
    return { kind, id: a.id };
  }
  if (kind === "profile") return { kind, profile: obj };
  return null;
}

/** Wire the global paste and drag-and-drop handlers. `onImported(result)` navigates to the right screen. */
export function installImport(onImported) {
  document.addEventListener("paste", async (e) => {
    const t = document.activeElement;
    if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    const text = (e.clipboardData || window.clipboardData).getData("text");
    if (!text || text.length < 20 || !/[{]|ISO-10303/.test(text)) return;
    e.preventDefault();
    const r = await importAny(text);
    if (r) onImported(r);
  });
  document.addEventListener("dragover", (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes("Files")) e.preventDefault(); });
  document.addEventListener("drop", async (e) => {
    const files = e.dataTransfer && e.dataTransfer.files;
    if (!files || !files.length) return;
    e.preventDefault();
    for (const f of files) { const r = await importAny(await f.text(), f.name); if (r) onImported(r); }
  });
}
export function pickFile(onImported) {
  const input = document.createElement("input");
  input.type = "file"; input.accept = ".json,.step,.stp,.txt,.md"; input.multiple = true;
  input.addEventListener("change", async () => { for (const f of input.files) { const r = await importAny(await f.text(), f.name); if (r) onImported(r); } });
  input.click();
}
