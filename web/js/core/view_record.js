/* DesignWizard.ai — an animation of a 3D view, recorded (point 17, JP, 20 novembre 2026 : « une animation s'enregistre et se télécharge, pour
   une revue de conception »). What the view shows is copied, frame by frame, onto a canvas of its own, the mark of the platform burnt in at
   the top and what is shown at the bottom ; the browser records it (MediaRecorder, WebM) ; when it stops, the file goes out through
   download(). The view keeps its drawing buffer (core/viewer.js : preserveDrawingBuffer), so the copy is what the screen shows. Used by the
   automatic rotation (core/view_orbit.js : « Enregistrer », « Un tour ») and by « Partager » (core/share_ui.js). */

import { download, toast } from "./dom.js";
import { BRAND_LINE } from "./brand.js";
import { animationFile } from "./share.js";

/** Can this browser record a view ? */
export const canRecord = () => typeof MediaRecorder !== "undefined" && typeof HTMLCanvasElement !== "undefined" && !!HTMLCanvasElement.prototype.captureStream;

/** Records the canvas of a view until stop() is called. o : { caption (what the film says at the bottom), name (the address of the element) }
    → { stop() → Promise (the file is downloaded), live() } or null when the browser cannot record. */
export function recordView(src, o = {}) {
  if (!canRecord()) { toast("Ce navigateur n'enregistre pas de vidéo : faites une capture (bouton appareil photo de la vue).", "warn", 6000); return null; }
  const w = src.width, h = src.height, can = document.createElement("canvas"); can.width = w; can.height = h;
  const g = can.getContext("2d"), stream = can.captureStream(30), type = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((t) => MediaRecorder.isTypeSupported(t)) || "video/webm";
  const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 5e6 }), chunks = [], t0 = performance.now();
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  const done = new Promise((ok) => { rec.onstop = ok; });
  let on = true;
  const frame = () => {
    if (!on) return;
    g.fillStyle = "#ffffff"; g.fillRect(0, 0, w, h); g.drawImage(src, 0, 0);
    const bh = Math.max(30, h * 0.06);
    g.fillStyle = "rgba(255,255,255,.86)"; g.fillRect(0, 0, w, bh * 0.8); g.fillStyle = "#1f2937"; g.font = `600 ${Math.round(bh * 0.36)}px system-ui, sans-serif`; g.fillText(BRAND_LINE, 12, bh * 0.52, w - 24);
    if (o.caption) { g.fillStyle = "rgba(17,24,39,.78)"; g.fillRect(0, h - bh, w, bh); g.fillStyle = "#ffffff"; g.font = `${Math.round(bh * 0.4)}px system-ui, sans-serif`; g.fillText(o.caption, 12, h - bh * 0.34, w - 24); }
    requestAnimationFrame(frame);
  };
  rec.start(250); requestAnimationFrame(frame);
  return {
    live: () => on,
    seconds: () => (performance.now() - t0) / 1000,
    async stop() {
      if (!on) return done; on = false; rec.stop(); await done;
      download(animationFile(o.name || location.hash), new Blob(chunks, { type: "video/webm" }), "video/webm");
      toast(`Animation enregistrée : ${Math.round((performance.now() - t0) / 100) / 10} s, au format WebM.`, "success");
      return null;
    },
  };
}
