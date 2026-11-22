/* DynamiteOrbit — the AI round trip : hand any artefact of a project to an AI the way a task is handed to a
   technician or a trainee, get the artefact back, see what changed, and let the human decide.
   aiBrief() writes the request with the artefact in .dwiz ; aiRead() finds the artefact in the answer ; aiDiff()
   lists the differences in plain words. Nothing here touches the project : applying is the caller's one undoable step. */

import { toDwiz, fromDwiz, findDwiz } from "./dwiz.js";
import { KINDS, kindOfDoc } from "./dwiz_names.js";

/** The text to give to the AI. help = extra lines about what may be used (library, block templates…) ; context = what
    the tool computes from the artefact, given for reference (a routing sheet…). */
export function aiBrief(doc, request, help = [], context = "") {
  const kind = kindOfDoc(doc), K = KINDS[kind] || { fr: "Document" };
  return [`Tu assistes un bureau d'études. Voici un artéfact DynamiteOrbit — ${K.fr.toLowerCase()} « ${doc.id || ""} » — au format .dwiz : une instruction par ligne, les lignes en retrait précisent la ligne du dessus, « # » commente.`,
    "", `DEMANDE : ${String(request || "").trim() || "(décrire la modification, comme à un technicien)"}`, "",
    "RÈGLES :", "- Ne change que ce que la demande exige ; garde les numéros, les repères et les noms existants.", "- Garde le format .dwiz, la première ligne « dwiz … » comprise.",
    "- Réponds par l'artéfact COMPLET modifié, dans un seul bloc de code, puis par la liste courte de ce que tu as changé et de ce qui reste à vérifier par un humain.", ...help.map((h) => `- ${h}`),
    "", "ARTÉFACT :", "```dwiz", toDwiz(doc).trimEnd(), "```", "",
    ...(context ? ["POUR RÉFÉRENCE — calculé par l'outil à partir de l'artéfact, à ne pas renvoyer :", "```", String(context).trimEnd(), "```", ""] : [])].join("\n");
}

/** The artefact found in an answer (.dwiz in or out of a code block, or JSON). Throws a French message when there is none. */
export function aiRead(text) {
  const src = findDwiz(text);
  if (src) { const d = fromDwiz(src); return Array.isArray(d) ? d[0] : d; }
  const m = /```(?:json)?\s*([\s\S]*?)```/.exec(String(text || "")), raw = m ? m[1] : String(text || "");
  try { const o = JSON.parse(raw); if (o && typeof o === "object") return o; } catch (e) { /* not JSON */ }
  throw new Error("Aucun artéfact trouvé dans la réponse : elle doit contenir le document complet, commençant par « dwiz … ».");
}

const sorted = (v) => (Array.isArray(v) ? v.map(sorted) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted(v[k])])) : v);
const keyOf = (x) => (x && typeof x === "object" ? x.id ?? x.ref ?? x.name ?? x.key ?? null : null);
const show = (v) => { const s = typeof v === "string" ? v : JSON.stringify(v); return s.length > 70 ? `${s.slice(0, 67)}…` : s; };
/** Differences between two versions of an artefact. → [{ kind: "added" | "removed" | "changed", path, text }] */
export function aiDiff(before, after, path = "", out = [], depth = 0) {
  if (JSON.stringify(sorted(before)) === JSON.stringify(sorted(after))) return out;                 // the order of the keys is not a change
  const isObj = (v) => v !== null && typeof v === "object";
  if (Array.isArray(before) && Array.isArray(after)) {
    const keyed = [...before, ...after].every((x) => keyOf(x) !== null) && before.length + after.length > 0;
    if (keyed) {
      const A = new Map(before.map((x) => [String(keyOf(x)), x])), B = new Map(after.map((x) => [String(keyOf(x)), x]));
      for (const [k, x] of B) { if (!A.has(k)) out.push({ kind: "added", path: `${path} ${k}`.trim(), text: `${path} ${k} ajouté : ${show(x)}` }); else aiDiff(A.get(k), x, `${path} ${k}`.trim(), out, depth + 1); }
      for (const k of A.keys()) if (!B.has(k)) out.push({ kind: "removed", path: `${path} ${k}`.trim(), text: `${path} ${k} retiré` });
      return out;
    }
    out.push({ kind: "changed", path, text: `${path} : ${before.length} → ${after.length} élément(s)${before.length === after.length ? " modifiés" : ""}` }); return out;
  }
  if (isObj(before) && isObj(after) && !Array.isArray(before) && !Array.isArray(after) && depth < 6) {
    for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
      const p = path ? `${path}.${k}` : k;
      if (!(k in before)) out.push({ kind: "added", path: p, text: `${p} ajouté : ${show(after[k])}` });
      else if (!(k in after)) out.push({ kind: "removed", path: p, text: `${p} retiré` });
      else aiDiff(before[k], after[k], p, out, depth + 1);
    }
    return out;
  }
  out.push({ kind: "changed", path, text: `${path} : ${show(before)} → ${show(after)}` });
  return out;
}
