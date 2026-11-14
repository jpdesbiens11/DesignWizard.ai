/* DesignWizard.ai — applied before the first paint (classic script in <head>): the theme chosen by the user, so the
   page never flashes in another theme. Kept tiny and dependency-free. */
(function () {
  var t = "carnet";
  try { t = localStorage.getItem("dw.theme") || t; } catch (e) { /* private window */ }
  if (["carnet", "mecanique", "aero", "spatial"].indexOf(t) < 0) t = "carnet";
  document.documentElement.setAttribute("data-theme", t);
})();
