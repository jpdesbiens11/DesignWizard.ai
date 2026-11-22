/* DesignOrbit.ai — a part and its close cousins (demande de JP). A family of parts that differ a little is kept in ONE part :
   an operation of the construction tree is put aside (off — « suppressed » in the part language) or copied, the copy born off ;
   a parameter keeps other values beside the one that counts, and one of them is turned on in its place. Nothing is lost when
   one goes from one cousin to the next. Pure : the Part Studio draws the switches, the store keeps each change as one step. */

/** Is an operation put aside ? */
export const featureOff = (f) => !!(f && f.suppressed);
/** An operation turned off, or on again (a new object). */
export function withFeatureOff(f, off) { const next = { ...f }; if (off) next.suppressed = true; else delete next.suppressed; return next; }
/** The features of a part with a copy of the i-th right after it, put aside, under the id given. → a new list */
export function copyFeature(features, i, id) {
  const list = (features || []).slice(), f = list[i]; if (!f) return list;
  const c = JSON.parse(JSON.stringify(f)); c.id = id; c.suppressed = true; if (f.name) c.name = `${f.name} (copie)`;
  list.splice(i + 1, 0, c); return list;
}

/* ---------- a parameter and the values kept beside it ---------- */
const def = (raw) => (raw !== null && typeof raw === "object" ? raw : { value: raw });
/** The values kept beside a parameter (off) : [value]. */
export const paramAlts = (raw) => { const a = def(raw).alts; return Array.isArray(a) ? a : []; };
/** Can a parameter keep other values ? Not a calculated one : it has no value of its own. */
export const canKeepAlts = (raw) => def(raw).expr === undefined;
/** The parameter with one more value kept beside it : a copy of the one that counts (or `value`). → a new definition */
export function addAlt(raw, value) { const d = { ...def(raw) }; d.alts = [...paramAlts(raw), value === undefined ? d.value : value]; return d; }
/** The k-th value kept turned on : it takes the place of the one that counts, which is kept in its stead. → a new definition */
export function swapAlt(raw, k) { const d = { ...def(raw) }, a = paramAlts(raw).slice(); if (k < 0 || k >= a.length) return raw; [d.value, a[k]] = [a[k], d.value]; d.alts = a; return d; }
/** The k-th value kept, changed. */
export function setAlt(raw, k, value) { const d = { ...def(raw) }, a = paramAlts(raw).slice(); if (k < 0 || k >= a.length) return raw; a[k] = value; d.alts = a; return d; }
/** The k-th value kept, removed ; a parameter with none left goes back to what it was (a plain number stays an object only if it has more to say). */
export function dropAlt(raw, k) {
  const d = { ...def(raw) }, a = paramAlts(raw).filter((_, j) => j !== k);
  if (a.length) d.alts = a; else delete d.alts;
  return Object.keys(d).length === 1 && "value" in d ? d.value : d;
}
/** What a part keeps aside, to say it : { features (operations off), values (values kept beside the parameters) }. */
export function keptAside(spec) {
  return { features: ((spec && spec.features) || []).filter(featureOff).length, values: Object.values((spec && spec.params) || {}).reduce((n, raw) => n + paramAlts(raw).length, 0) };
}

/* ---------- named variants : a whole cousin of the part, kept under a name and brought back in one step ----------
   A variant remembers what tells one cousin from the other : the operations put aside and the values of the parameters. It does
   not copy the part : an operation or a parameter added later belongs to every variant, as it is. */
const fid = (f, i) => (f && f.id) || `f${i + 1}`;
const own = (raw) => def(raw).expr === undefined;      // a calculated parameter follows the others : nothing of its own to remember
/** What the part is now, as a variant would remember it : { off: [ids of the operations put aside], params: { name: value } }. */
export function variantOf(spec) {
  return { off: ((spec && spec.features) || []).map((f, i) => (featureOff(f) ? fid(f, i) : null)).filter(Boolean),
    params: Object.fromEntries(Object.entries((spec && spec.params) || {}).filter(([, raw]) => own(raw)).map(([name, raw]) => [name, def(raw).value])) };
}
/** Is the part, now, the variant given ? Only what both know is compared : a parameter added since does not make another cousin. */
export function isVariant(spec, v) {
  const now = variantOf(spec), ids = new Set(((spec && spec.features) || []).map(fid)), off = new Set(now.off), want = new Set(((v && v.off) || []).filter((id) => ids.has(id)));
  if (off.size !== want.size || [...off].some((id) => !want.has(id))) return false;
  return Object.entries((v && v.params) || {}).every(([name, value]) => !(name in now.params) || now.params[name] === value);
}
/** The name of the variant the part is in now, or null : it is then a cousin that has no name yet. The one in use (`variantOn`) first : two
    variants that are the same — a copy just made — are told apart by it. */
export const variantNow = (spec) => { const list = (spec && spec.variants) || [], on = list.find((x) => x.name === spec.variantOn), v = on && isVariant(spec, on) ? on : list.find((x) => isVariant(spec, x)); return v ? v.name : null; };

/* ---------- the variant in use : ALIVE (demande de JP : « où sont les features modifiables d'une variante… comment les voir comme la pièce originale ? ») ----------
   What mechanical modelers do with their configurations, and what the cases of the Simulation do here : ONE variant is in use, and it is alive — an
   operation put on or off, a parameter changed belongs to it, in the step that changes it. The others stay as one left them. The tree and the
   parameters one sees ARE those of the variant in use. The first variant one makes also keeps the part as it was, under « Origine » : there is
   always an original to come back to. What does not differ from one variant to the next : the fields of an operation — a dimension that must
   differ is a parameter, or an operation copied (born off) with one on in each variant. */
export const ORIGIN = "Origine";
const clean = (name) => String(name || "").replace(/\s+/g, " ").trim();
/** A new variant : a copy of the part as it is now, under `name` ; it becomes the one in use. The first also keeps the original. → { variants, variantOn }, or null without a name */
export function newVariant(spec, name) {
  const n = clean(name); if (!n) return null; const list = ((spec && spec.variants) || []).slice();
  if (!list.length && n !== ORIGIN) list.push({ name: ORIGIN, ...variantOf(spec) });
  return { variants: keepVariant({ ...spec, variants: list }, n), variantOn: n };
}
/** The part brought to a variant, which becomes the one in use. → { features, params, variantOn } (new) */
export const useVariant = (spec, v) => ({ ...applyVariant(spec, v), variantOn: v.name });
/** The variant in use follows the part : called after every change, and when a project is opened (a part kept before variants were alive takes the
    variant its state is). The part given is changed. → true when something was written */
export function followVariant(spec) {
  const list = spec && spec.variants; if (!Array.isArray(list) || !list.length) { if (spec && spec.variantOn !== undefined) { delete spec.variantOn; return true; } return false; }
  const at = list.findIndex((v) => v.name === spec.variantOn);
  if (at < 0) { const now = (list.find((x) => isVariant(spec, x)) || {}).name; if (now) { spec.variantOn = now; return true; } if (spec.variantOn !== undefined) { delete spec.variantOn; return true; } return false; }
  const next = { name: list[at].name, ...variantOf(spec) }; if (JSON.stringify(next) === JSON.stringify(list[at])) return false; list[at] = next; return true;
}
/** The part brought to a variant : its operations on or off as the variant says, its parameters at the values it says. What the
    variant does not know stays as it is ; the other values a parameter keeps beside stay too. → { features, params } (new) */
export function applyVariant(spec, v) {
  const off = new Set((v && v.off) || []), vals = (v && v.params) || {};
  const features = ((spec && spec.features) || []).map((f, i) => (f && f.op !== "interfaces" ? withFeatureOff(f, off.has(fid(f, i))) : f));
  const params = Object.fromEntries(Object.entries((spec && spec.params) || {}).map(([name, raw]) => [name, name in vals && own(raw) ? (raw !== null && typeof raw === "object" ? { ...raw, value: vals[name] } : vals[name]) : raw]));
  return { features, params };
}
/** The variants of the part with its present state kept under `name` (a name already there is replaced, at its place). → a new list */
export function keepVariant(spec, name) {
  const n = String(name || "").replace(/\s+/g, " ").trim(), list = ((spec && spec.variants) || []).slice(); if (!n) return list;
  const v = { name: n, ...variantOf(spec) }, at = list.findIndex((x) => x.name === n);
  if (at >= 0) list[at] = v; else list.push(v);
  return list;
}
export const dropVariant = (spec, name) => ((spec && spec.variants) || []).filter((x) => x.name !== name);
/** What a variant changes from the part as it is now, in a few words : « 2 opérations basculent · L 160 → 200 ». labels : name → its label. */
export function variantDiff(spec, v, labels = {}) {
  const now = variantOf(spec), ids = new Set(((spec && spec.features) || []).map(fid)), a = new Set(now.off), b = new Set(((v && v.off) || []).filter((id) => ids.has(id)));
  const flips = [...ids].filter((id) => a.has(id) !== b.has(id)).length, out = [];
  if (flips) out.push(`${flips} opération${flips > 1 ? "s basculent" : " bascule"}`);
  for (const [name, value] of Object.entries((v && v.params) || {})) if (name in now.params && now.params[name] !== value) out.push(`${labels[name] || name} ${String(now.params[name]).replace(".", ",")} → ${String(value).replace(".", ",")}`);
  return out;
}
