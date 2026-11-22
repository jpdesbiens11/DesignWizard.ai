/* DesignOrbit.ai — what leaves, for a chosen variant (demande de JP : On / Off et copies — « la gamme, le rapport et la commande
   suivent une variante choisie »). A part or an assembly keeps its cousins under a name ; a file, a routing, an order or a send is
   made for ONE of them. Two rules, held here for every reader :
     1. what leaves SAYS which variant it is — in its name (« DRV-BASE_Longue.step ») and in its heading (« Variante : Longue ») —
        whether the variant was asked for or is simply the one the document is in ;
     2. what leaves can be made for a variant the document is NOT in, from a copy : the document is not changed.
   The convention is the « configuration » of mechanical modellers (an export, a drawing or a bill of materials is that of one
   configuration, and says which). Pure : core/variants.js (a part) and core/asm_live.js (an assembly) hold the models. */

import { applyVariant, isVariant, variantNow, variantDiff } from "./variants.js";
import { asVariant, isAsmVariant, asmVariantNow, asmVariantDiff } from "./asm_live.js";

/** The variant of a document kept under this name, or null. */
export const namedVariant = (doc, name) => (name && ((doc && doc.variants) || []).find((v) => v.name === name)) || null;

/** A part as it leaves. name : the variant asked for (nothing, or a name that is gone : the part as it is).
    → { doc — the part as that variant, a copy when it is not the one the part is in ;
        variant — the name to write on what leaves : the one asked, else the one the part is in, else null ;
        copy — true when the document itself is in another state (what leaves is not what the screens show) } */
export function partOut(part, name) {
  const v = namedVariant(part, name);
  if (!v) return { doc: part, variant: variantNow(part), copy: false };
  const same = isVariant(part, v);
  return { doc: same ? part : { ...part, ...applyVariant(part, v) }, variant: v.name, copy: !same };
}
/** The same for an assembly : the parts the variant puts aside are off in the copy. */
export function asmOut(asm, name) {
  const v = namedVariant(asm, name);
  if (!v) return { doc: asm, variant: asmVariantNow(asm), copy: false };
  const same = isAsmVariant(asm, v);
  return { doc: same ? asm : asVariant(asm, v), variant: v.name, copy: !same };
}

/** What the name of a file carries : « _Longue » — letters, digits, dash and underscore kept, the rest a dash ; nothing without a variant. */
export const variantTag = (name) => (name ? `_${String(name).trim().replace(/[^\p{L}\p{N}_-]+/gu, "-")}` : "");
/** The line of a routing sheet or of a heading. */
export const variantFacts = (name) => (name ? [["Variante", name]] : []);
/** The words after a reference, in a sentence : « , variante « Longue » ». */
export const variantWords = (name) => (name ? `, variante « ${name} »` : "");

/** The choices of the menu « Variante qui sort » : the document as it is first, then each cousin. isAsm : an assembly. */
export function outChoices(doc, isAsm = false) {
  const now = isAsm ? asmVariantNow(doc) : variantNow(doc);
  return [{ value: "", label: `${isAsm ? "L'assemblage tel qu'il est" : "La pièce telle qu'elle est"}${now ? ` (${now})` : " (état sans nom)"}` }, ...((doc && doc.variants) || []).map((v) => ({ value: v.name, label: v.name }))];
}

/** What the guide says about what is about to leave : another cousin than the one on the screen, or a state nobody named.
    → entries { level, text, field: "out" } */
export function outGuide(doc, name, isAsm = false) {
  const list = (doc && doc.variants) || [], id = (doc && doc.id) || (isAsm ? "Assemblage" : "Pièce"), the = isAsm ? "l'assemblage" : "la pièce";
  if (!list.length) return [];
  const o = isAsm ? asmOut(doc, name) : partOut(doc, name), now = isAsm ? asmVariantNow(doc) : variantNow(doc);
  if (o.copy) return [{ level: "warn", field: "out", text: `${id} — ce qui sort est la variante « ${o.variant} » ; ${the} est ${now ? `dans « ${now} »` : "dans un état sans nom"} à l'écran. Vérifiez que c'est bien la cousine voulue.` }];
  if (!o.variant) return [{ level: "tip", field: "out", text: `${id} — ${the} garde ${list.length} variante${list.length > 1 ? "s" : ""}, mais son état en ce moment n'a pas de nom : ce qui sort n'en portera aucun. Gardez cet état sous un nom, ou choisissez la variante qui sort.` }];
  return [];
}

/** The documents of a project that keep variants, for the report :
    [{ kind: "part" | "assembly", id, name, now (the variant shown, or null), variants: [{ name, on, diff: [words] }] }] */
export function variantRows(project) {
  const out = [], p = project || {}, parts = new Map((p.parts || []).map((s) => [s.id, s]));
  for (const s of p.parts || []) {
    if (!(s.variants || []).length) continue;
    const labels = Object.fromEntries(Object.entries(s.params || {}).map(([k, raw]) => [k, (raw && typeof raw === "object" && raw.label) || k]));
    out.push({ kind: "part", id: s.id, name: s.name || "", now: variantNow(s), variants: s.variants.map((v) => { const on = isVariant(s, v); return { name: v.name, on, diff: on ? [] : variantDiff(s, v, labels) }; }) });
  }
  for (const a of p.assemblies || []) {
    if (!(a.variants || []).length) continue;
    const names = Object.fromEntries((a.instances || []).map((i) => [i.id, i.asm ? i.asm : `${i.part}${parts.get(i.part) && parts.get(i.part).name ? ` ${parts.get(i.part).name}` : ""}`]));
    out.push({ kind: "assembly", id: a.id, name: a.name || "", now: asmVariantNow(a), variants: a.variants.map((v) => { const on = isAsmVariant(a, v); return { name: v.name, on, diff: on ? [] : asmVariantDiff(a, v, names) }; }) });
  }
  return out;
}
