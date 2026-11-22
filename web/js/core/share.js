/* DesignOrbit.ai — « Partager » (point 17, JP, 20 novembre 2026 : « Partager sur chaque artéfact de la plateforme — un lien vers l'élément,
   ou une version numérique choisie au clic : STEP, Word, PDF, STL, Gerber, animation… »).
   What is shared is what the screen already knows how to make : every screen has its export buttons, each going out through download() with
   the mark of the platform. Sharing gathers them in one menu, grouped by nature, a pictogram and a short title each, and adds the link of the
   element and, where the screen shows a 3D view, an animation of it. This file is the pure part : what a file is, by its name or its label ;
   the groups ; the name of a recorded animation. The menu itself : core/share_ui.js. Pure : no page. */

/** The natures, in the order they are offered, each with its colour (the groups of a list wear a colour, CLAUDE.md). */
export const SHARE_GROUPS = [
  { key: "3d", label: "3D", fr: "Modèles 3D", color: "#2563eb" },
  { key: "doc", label: "Documents", fr: "Documents à lire", color: "#c2410c" },
  { key: "fab", label: "Manufacturing", fr: "Fichiers de fabrication", color: "#15803d" },
  { key: "data", label: "Data", fr: "Données et dossiers", color: "#7c3aed" },
  { key: "media", label: "Media", fr: "Vidéo et image", color: "#be123c" },
  { key: "other", label: "Other", fr: "Autres fichiers", color: "#475569" },
];
/** The formats the menu knows, most specific first : what is read in a label or a tip (« STEP », « (.docx) », « Excel »…). */
export const FORMATS = [
  { key: "step", label: "STEP", group: "3d", icon: "step", re: /\bstep\b|\.stp\b/i },
  { key: "stl", label: "STL", group: "3d", icon: "part", re: /\bstl\b/i },
  { key: "fs", label: "FeatureScript", group: "3d", icon: "onshape", re: /featurescript|onshape/i },
  { key: "gerber", label: "Gerber", group: "fab", icon: "pcb", re: /gerber/i },
  { key: "dxf", label: "DXF", group: "fab", icon: "layers", re: /\bdxf\b/i },
  { key: "drill", label: "Drill", group: "fab", icon: "pcb", re: /perçage|drill|excellon/i },
  { key: "csv", label: "CSV", group: "fab", icon: "report", re: /\bcsv\b/i },
  { key: "pdf", label: "PDF", group: "doc", icon: "pdf", re: /\bpdf\b/i },
  { key: "docx", label: "Word", group: "doc", icon: "report", re: /\bword\b|\.docx\b/i },
  { key: "pptx", label: "PowerPoint", group: "doc", icon: "report", re: /pptx|powerpoint|diaporama/i },
  { key: "html", label: "HTML", group: "doc", icon: "report", re: /\bhtml\b/i },
  { key: "xlsx", label: "Excel", group: "data", icon: "report", re: /excel|\.xlsx\b|classeur/i },
  { key: "dwiz", label: ".dwiz", group: "data", icon: "export", re: /\.dwiz\b|\bdwiz\b/i },
  { key: "zip", label: "ZIP", group: "data", icon: "folder", re: /\.zip\b|\bzip\b|dossier|archive|paquet/i },
  { key: "json", label: "JSON", group: "data", icon: "export", re: /\bjson\b/i },
  { key: "webm", label: "Video", group: "media", icon: "play", re: /\.webm\b|vidéo|video|\bfilm\b|animation/i },
  { key: "png", label: "Image", group: "media", icon: "camera", re: /\.png\b|\bimage\b|photo/i },
];
const OTHER = { key: "other", label: "File", group: "other", icon: "download" };

/** The format of an export, read in its label, then in its tip : the first that names one. → a FORMATS entry (or the « other » one). */
export function formatOf(label = "", tip = "") {
  for (const text of [label, tip]) { const f = FORMATS.find((x) => x.re.test(String(text || ""))); if (f) return f; }
  return OTHER;
}
/** The exports of a screen, grouped by nature in the order of SHARE_GROUPS ; inside a group, in the order of the screen ; the same label once.
    items : [{ label, tip, ref }] → [{ ...group, items: [{ label, tip, ref, format }] }] */
export function shareGroups(items) {
  const seen = new Set(), by = new Map(SHARE_GROUPS.map((g) => [g.key, []]));
  for (const it of items || []) {
    const label = String(it.label || "").trim(); if (!label || seen.has(label)) continue; seen.add(label);
    const format = formatOf(label, it.tip); by.get(format.group).push({ ...it, label, format });
  }
  return SHARE_GROUPS.map((g) => ({ ...g, items: by.get(g.key) })).filter((g) => g.items.length);
}
/** The name of what a screen shows, for a file : the last part of its address that names something (« #/assembly/BM-8S8P-ASM » → « BM-8S8P-ASM »). */
export function shareName(hash = "") {
  const parts = String(hash).replace(/^#\/?/, "").split("/").filter(Boolean).map((s) => { try { return decodeURIComponent(s); } catch (e) { return s; } });
  const last = parts.length > 1 ? parts[parts.length - 1] : parts[0] || "vue";
  return last.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 60) || "vue";
}
/** The file of a recorded animation : the element, then the date and time (« BM-8S8P-ASM_animation_2026-11-22_0412.webm »). */
export function animationFile(hash, when = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${shareName(hash)}_animation_${when.getFullYear()}-${p(when.getMonth() + 1)}-${p(when.getDate())}_${p(when.getHours())}${p(when.getMinutes())}.webm`;
}
/** How long one full turn takes at a speed (degrees per second) — what « one turn » records. */
export const turnSeconds = (deg) => (deg > 0 ? 360 / deg : 0);
/** The link of an element : the address of the page, as it is. Who opens it sees the element in the project they hold (theirs, or the mirror of the team). */
export const shareLink = (href) => String(href || "");
