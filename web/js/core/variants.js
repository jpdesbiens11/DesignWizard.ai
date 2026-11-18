/* DesignWizard.ai — a part and its close cousins (demande de JP). A family of parts that differ a little is kept in ONE part :
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
