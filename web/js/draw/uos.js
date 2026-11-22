/* DynamiteOrbit — the tolerance block of a drawing, « UNLESS OTHERWISE SPECIFIED » (JP, 21 novembre 2026 : « tolérances générales par
   défaut = bloc du cartouche ASME »). Beside the title block, as North American drawings carry it : the unit of the dimensions, the
   tolerance of a dimension by the number of its decimals, the tolerance of an angle, the standard the symbols are read in. The values are
   the project's — one block for all its drawings. The tool proposes EXAMPLE values : they are said as such on the sheet and in the guide
   until the project enters its own or confirms them. ISO 2768 stays a choice of the project (a general class instead of decimals). Pure. */

export const UOS_BASES = {
  asme: { label: "ASME : par nombre de décimales", hint: "L'usage nord-américain : la tolérance d'une cote dépend du nombre de décimales écrites." },
  iso2768: { label: "ISO 2768 : classe générale", hint: "Une classe pour toutes les cotes sans tolérance (f, m, c, v ; H, K, L pour la géométrie)." },
};
/** The values the tool proposes — examples, to enter or to confirm. mm : X, X.X, X.XX ; inch : X.XX, X.XXX ; angle in degrees. */
export const UOS_EXAMPLE = Object.freeze({ basis: "asme", mm: [0.5, 0.2, 0.05], inch: [0.01, 0.005], angle: 0.5, iso: "mK" });
export const UOS_STD = "ASME Y14.5-2018";
const ISO_CLASS = /^[fmcv][HKL]?$/;

/** The block of the project : its values over the examples, and whether they are its own (`sure`). */
export function uosOf(d) {
  const u = (d && d.uos) || {}, num = (a, b) => (Array.isArray(a) && a.length === b.length && a.every((x) => Number.isFinite(+x) && +x > 0) ? a.map(Number) : [...b]);
  return { basis: UOS_BASES[u.basis] ? u.basis : UOS_EXAMPLE.basis, mm: num(u.mm, UOS_EXAMPLE.mm), inch: num(u.inch, UOS_EXAMPLE.inch),
    angle: Number.isFinite(+u.angle) && +u.angle > 0 ? +u.angle : UOS_EXAMPLE.angle, iso: ISO_CLASS.test(u.iso || "") ? u.iso : UOS_EXAMPLE.iso, sure: u.sure === true };
}
const mmText = (v) => String(Math.round(v * 1000) / 1000);
const inText = (v) => String(Math.round(v * 10000) / 10000).replace(/^0\./, ".");
/** The lines of the block, in English, as the sheet writes them. inch : the drawing is in inches. */
export function uosLines(u, inch = false) {
  const head = ["UNLESS OTHERWISE SPECIFIED:", `DIMENSIONS ARE IN ${inch ? "INCHES" : "MILLIMETERS"}`];
  if (u.basis === "iso2768") return [...head, `GENERAL TOLERANCES ISO 2768-${u.iso}${inch ? " (MM MODEL)" : ""}`, `ANGLES ±${mmText(u.angle)}°`, `INTERPRET GD&T PER ${UOS_STD}`];
  const lin = inch ? [`X.XX ±${inText(u.inch[0])}`, `X.XXX ±${inText(u.inch[1])}`] : [`X ±${mmText(u.mm[0])}`, `X.X ±${mmText(u.mm[1])}`, `X.XX ±${mmText(u.mm[2])}`];
  return [...head, "TOLERANCES:", ...lin, `ANGLES ±${mmText(u.angle)}°`, `INTERPRET GD&T PER ${UOS_STD}`];
}
/** What the block says, in one line of the first note of a sheet. */
export function uosNote(u, inch = false) {
  return `Dimensioning and tolerancing per ${UOS_STD}; dimensions in ${inch ? "inches, converted from the millimetre model (1 in = 25.4 mm)" : "millimetres"}; untoleranced dimensions: see the tolerance block (UNLESS OTHERWISE SPECIFIED)${u.basis === "iso2768" ? `, ISO 2768-${u.iso}` : ""}.`;
}
/** The block in a few French words, for a screen. */
export function uosSummary(u, inch = false) {
  if (u.basis === "iso2768") return `ISO 2768-${u.iso}, angles ±${mmText(u.angle)}°`;
  return `${uosLines(u, inch).filter((l) => /^X/.test(l)).join(" · ")} · angles ±${mmText(u.angle)}°`;
}
/** For the guide : example values left on a drawing ; a drawing issued with them. d : project.drawing. */
export function uosIssues(d, o = {}) {
  const u = uosOf(d), id = o.id || "Dessin", issued = /^(?:émis|emis|issued|released|approuvé|approuve|approved|libéré|libere)/i.test(String((d && d.status) || "").trim());
  if (u.sure) return [];
  return [{ level: issued ? "error" : "todo", field: "uos", text: `${id} — dessin : les tolérances générales du bloc « UNLESS OTHERWISE SPECIFIED » sont des valeurs d'exemple${issued ? ", et le statut dit le dessin émis" : ""} — entrez celles du projet ou confirmez-les (la feuille les dit « EXAMPLE » jusque-là).` }];
}
/** What is wrong with a block an answer brings back (core/ai_more.js). → [text] */
export function uosCheck(x) {
  if (x == null) return [];
  if (typeof x !== "object" || Array.isArray(x)) return ["« uos » doit être un objet (basis, mm, inch, angle, iso, sure)."];
  const out = [], pos = (a, n, k) => { if (a !== undefined && !(Array.isArray(a) && a.length === n && a.every((v) => Number.isFinite(+v) && +v > 0 && +v < 10))) out.push(`« uos.${k} » : ${n} tolérances positives (en ${k === "inch" ? "pouces" : "millimètres"}).`); };
  if (x.basis !== undefined && !UOS_BASES[x.basis]) out.push(`« uos.basis » : ${Object.keys(UOS_BASES).join(" ou ")}.`);
  pos(x.mm, 3, "mm"); pos(x.inch, 2, "inch");
  if (x.angle !== undefined && !(Number.isFinite(+x.angle) && +x.angle > 0 && +x.angle <= 10)) out.push("« uos.angle » : une tolérance d'angle positive, en degrés.");
  if (x.iso !== undefined && !ISO_CLASS.test(String(x.iso))) out.push("« uos.iso » : une classe ISO 2768 (f, m, c ou v, puis H, K ou L) — par exemple « mK ».");
  if (x.sure !== undefined && typeof x.sure !== "boolean") out.push("« uos.sure » : vrai ou faux.");
  return out;
}
