/* DesignWizard.ai — applied before the first paint (classic script in <head>): the theme chosen by the user, so the
   page never flashes in another theme. Kept tiny and dependency-free. */
(function () {
  var t = "carnet";
  try { t = localStorage.getItem("dw.theme") || t; } catch (e) { /* private window */ }
  if (["carnet", "mecanique", "aero", "spatial"].indexOf(t) < 0) t = "carnet";
  document.documentElement.setAttribute("data-theme", t);
  var z = 100;                                                   // the size of what is shown, in percent (core/theme.js)
  try { z = parseInt(localStorage.getItem("dw.scale") || "100", 10) || 100; } catch (e) { /* private window */ }
  if ([90, 100, 115, 130, 150].indexOf(z) < 0) z = 100;
  document.documentElement.style.setProperty("--ui-scale", String(z / 100));
  try { performance.setResourceTimingBufferSize(3000); } catch (e) { /* an old browser */ }      // every file the page loads is remembered : an update fetches them anew (core/update_check.js)
})();
