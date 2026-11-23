/* DesignOrbit.ai — themes: « Le.Carnet » (the company theme, default) and three design worlds. A theme is only a
   set of design tokens (web/css/themes.css) selected by html[data-theme]; the 3D views listen to "dw:theme". */

export const THEMES = [
  { key: "carnet", label: "Le.Carnet", text: "Le carnet de l'ingénieur : papier quadrillé, graphite, surligneurs. Le thème de la maison." },
  { key: "mecanique", label: "Mécanique", text: "Le bureau d'études : calque, encre bleue, traits fins et cotes." },
  { key: "aero", label: "Aéronautique", text: "Le hangar : aluminium, lignes de rivets, orange de signalisation." },
  { key: "spatial", label: "Spatial", text: "La salle de contrôle, de nuit : fond profond, télémétrie ambre et cyan." },
];
const KEY = "dw.theme";
export function currentTheme() {
  const t = document.documentElement.dataset.theme;
  return THEMES.some((x) => x.key === t) ? t : "carnet";
}
export function applyTheme(key) {
  const t = THEMES.some((x) => x.key === key) ? key : "carnet";
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem(KEY, t); } catch (e) { /* private window: the theme lasts for this page only */ }
  window.dispatchEvent(new CustomEvent("dw:theme", { detail: t }));
  return t;
}

/* ---------- the size of what is shown : text, buttons, labels of the 3D views — for a small screen, tired eyes, the evening ---------- */
export const SCALES = [[90, "Petit"], [100, "Normal"], [115, "Grand"], [130, "Très grand"], [150, "Énorme"]];
const SCALE_KEY = "dw.scale";
export const scaleOf = (v) => { const n = parseInt(v, 10); return SCALES.some(([k]) => k === n) ? n : 100; };
export function currentScale() { return scaleOf(Math.round(parseFloat(document.documentElement.style.getPropertyValue("--ui-scale") || "1") * 100)); }
/** Sets the size (percent, one of SCALES) and keeps it ; the 3D views and the panels follow (they listen to the window). */
export function applyScale(pct) {
  const z = scaleOf(pct);
  document.documentElement.style.setProperty("--ui-scale", String(z / 100));
  try { localStorage.setItem(SCALE_KEY, String(z)); } catch (e) { /* private window : the size lasts for this page only */ }
  window.dispatchEvent(new Event("resize")); window.dispatchEvent(new CustomEvent("dw:scale", { detail: z }));
  return z;
}

/* ---------- the size of the icons at the top of the window (demande de JP, 23 novembre : « agrandir un petit peu (ratio 1.25,
   1.5) les icônes du haut de page pour faciliter la navigation… n'oublie pas les icônes de gauche et de droite en haut de la
   fenêtre ») : the top bar, the bar of the levels and of the work tabs, and the head of every side pane. A ratio, apart from
   the size of the text : only the icons grow, their layout follows (CSS `zoom`, web/css/nav.css). 1.25 by default. ---------- */
export const ICON_SCALES = [[100, "Normal", "× 1"], [125, "Grand", "× 1,25"], [150, "Très grand", "× 1,5"], [175, "Énorme", "× 1,75"]];
export const ICON_DEFAULT = 125;
const ICON_KEY = "dw.iconScale";
export const iconScaleOf = (v) => { const n = parseInt(v, 10); return ICON_SCALES.some(([k]) => k === n) ? n : ICON_DEFAULT; };
export function currentIconScale() { return iconScaleOf(Math.round(parseFloat(document.documentElement.style.getPropertyValue("--icon-scale") || String(ICON_DEFAULT / 100)) * 100)); }
/** Sets the ratio of the icons at the top of the window (percent, one of ICON_SCALES) and keeps it in this browser. */
export function applyIconScale(pct) {
  const z = iconScaleOf(pct);
  document.documentElement.style.setProperty("--icon-scale", String(z / 100)); document.documentElement.dataset.icons = String(z);      // the top bar gives way earlier (web/css/nav.css)
  try { localStorage.setItem(ICON_KEY, String(z)); } catch (e) { /* private window : the ratio lasts for this page only */ }
  window.dispatchEvent(new Event("resize")); window.dispatchEvent(new CustomEvent("dw:icon-scale", { detail: z }));
  return z;
}
