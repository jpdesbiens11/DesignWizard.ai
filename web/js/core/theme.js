/* DesignWizard.ai — themes: « Le.Carnet » (the company theme, default) and three design worlds. A theme is only a
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
