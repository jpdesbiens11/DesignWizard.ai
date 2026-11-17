/* DesignWizard.ai — the English of a drawing. A sheet is written in English ; what the PROJECT writes on it — the name of
   the part, of its interfaces, the labels of its parameters, its finish, its notes, the name of the project — stays as it
   was typed, often in French. The project keeps, once, the English of these texts : project.drawing.words { text : English }.
   The drawing then writes the English where there is one, the text itself otherwise ; screens keep the text as typed.
   Pure : which texts a sheet writes, which have no English yet, the brief to hand to an AI and the reading of its reply. */

const uniq = (list) => [...new Set(list.filter((t) => typeof t === "string" && t.trim()).map((t) => t.trim()))];
const numbers = (v) => (v !== null && typeof v === "object" ? v : {});
/** The texts of the project a PART drawing writes, in the order of the sheet : title, finish, interfaces, parameters, notes, project. */
export function partTexts(spec, project) {
  const s = spec || {};
  return uniq([s.name, s.finish, ...(s.interfaces || []).map((it) => it.name), ...Object.values(s.params || {}).map((p) => numbers(p).label), ...(s.notes || []), project && project.name]);
}
/** The texts of the project an ASSEMBLY drawing writes : title, the names of the bill of materials, notes, project. rows : the lines of the bill of materials. */
export function asmTexts(asm, rows, project) {
  const a = asm || {};
  return uniq([a.name, ...(rows || []).filter((r) => r.kind === "part").map((r) => r.name), ...(a.notes || []), project && project.name]);
}
/** The texts of a drawing of the project : « part:ID » or « assembly:ID ». */
export function drawingTexts(project, key, rows) {
  const [kind, id] = String(key || "").split(/:(.*)/), p = project || {};
  if (kind === "assembly") { const a = (p.assemblies || []).find((x) => x.id === id); return a ? asmTexts(a, rows || (a.instances || []).map((i) => ({ kind: "part", name: ((p.parts || []).find((x) => x.id === i.part) || {}).name })), p) : []; }
  const s = (p.parts || []).find((x) => x.id === id); return s ? partTexts(s, p) : [];
}
/** Clean words from anything : { text : English }, texts and English trimmed, nothing empty. */
export function tidyWords(words) {
  const out = {};
  for (const [k, v] of Object.entries(numbers(words))) if (typeof v === "string" && v.trim() && k.trim()) out[k.trim()] = v.trim();
  return out;
}
/** How a drawing says a text : its English when the project gave one, the text itself otherwise. */
export const sayWith = (words) => { const w = tidyWords(words); return (text) => (typeof text === "string" && Object.prototype.hasOwnProperty.call(w, text.trim()) ? w[text.trim()] : text); };
/** The texts that have no English yet. */
export const wordsLeft = (words, texts) => { const w = tidyWords(words); return (texts || []).filter((t) => !Object.prototype.hasOwnProperty.call(w, t)); };
/** The words of a project that no drawing of it writes any more (a name that changed) : they can go. */
export function wordsUnused(project) {
  const p = project || {}, used = new Set([...(p.parts || []).flatMap((s) => partTexts(s, p)), ...(p.assemblies || []).flatMap((a) => drawingTexts(p, `assembly:${a.id}`))]);
  return Object.keys(tidyWords(p.drawing && p.drawing.words)).filter((k) => !used.has(k));
}
/** What the guide says of a drawing : nothing when every text has its English. */
export function wordsIssues(words, texts) {
  const left = wordsLeft(words, texts);
  return left.length ? [{ level: "tip", field: "words", text: `${left.length} texte${left.length > 1 ? "s" : ""} du projet ${left.length > 1 ? "sont écrits tels quels" : "est écrit tel quel"} sur ce dessin en anglais (${left.slice(0, 3).map((t) => `« ${t.length > 32 ? `${t.slice(0, 30)}…` : t} »`).join(", ")}${left.length > 3 ? "…" : ""}) : donnez-${left.length > 1 ? "leur leur" : "lui son"} anglais dans « Anglais du dessin ».` }] : [];
}
/** The task to hand to an AI, as one would to a technician : the texts, the form of the answer. */
export function wordsBrief(texts, words) {
  const w = tidyWords(words), map = Object.fromEntries((texts || []).map((t) => [t, w[t] || ""]));
  return ["Voici les textes qu'un projet de conception mécatronique écrit sur ses dessins techniques, qui sont rédigés en anglais.",
    "Donne pour chacun son anglais de dessin technique : court, au vocabulaire d'atelier (ASME Y14.5), sans changer les références, les nombres ni les unités.",
    "Réponds par le même objet JSON, chaque valeur remplie, sans rien ajouter d'autre.", "", JSON.stringify(map, null, 2)].join("\n");
}
/** The reply of an AI, read : { words (the texts of the list that got an English), unknown (keys that are not texts of the list), empty (texts left without) }. Throws when no object is found. */
export function readWords(reply, texts) {
  const m = /\{[\s\S]*\}/.exec(String(reply || "")); if (!m) throw new Error("Aucun objet JSON dans la réponse.");
  let obj; try { obj = JSON.parse(m[0]); } catch (e) { throw new Error(`La réponse n'est pas un JSON lisible : ${e.message}`); }
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) throw new Error("La réponse doit être un objet { texte : anglais }.");
  const list = new Set(texts || []), got = tidyWords(obj), words = Object.fromEntries(Object.entries(got).filter(([k]) => list.has(k)));
  return { words, unknown: Object.keys(got).filter((k) => !list.has(k)), empty: [...list].filter((t) => !words[t]) };
}
