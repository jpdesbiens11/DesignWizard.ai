/* DynamiteOrbit.ai — the film, drawn from the time alone. window.filmSeek(t) puts every scene, picture, chip and caption where it stands at
   t seconds, and resolves when the picture of that instant is decoded : the renderer (tools/film_render.mjs) then takes the frame.
   ?lang=fr|en chooses the words ; ?clips=<url> the folder of the clips filmed on the platform ; ?captions=0 leaves the subtitles out (for
   the day a voice says them) ; ?scale= fits the stage of 1600 × 900 into the window. */
import { SCENES, CUES, DURATION, FPS, W, H, cueAt } from "./script.mjs";
import { MARK } from "/web/js/core/brand.js";

const q = new URLSearchParams(location.search), lang = q.get("lang") === "en" ? "en" : "fr", clipsAt = q.get("clips") || "/clips", captions = q.get("captions") !== "0";
const stage = document.getElementById("stage"), scale = Number(q.get("scale")) || 1; stage.style.transform = `scale(${scale})`; document.documentElement.lang = lang;
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v)), smooth = (x) => { const v = clamp(x); return v * v * (3 - 2 * v); }, mix = (a, b, k) => a + (b - a) * k;
/* « On construit la fusée en volant. » : the last words of a slogan are the ones under the highlighter */
const marked = (text) => { const p = el("span"), cut = text.lastIndexOf(",") > 0 ? text.lastIndexOf(",") + 1 : text.indexOf(". ") > 0 ? text.indexOf(". ") + 1 : text.split(" ").length > 3 ? text.lastIndexOf(" ", text.lastIndexOf(" ") - 1) + 1 : 0; p.append(text.slice(0, cut), el("mark", null, text.slice(cut).trim())); if (cut) p.insertBefore(document.createTextNode(" "), p.lastChild); return p; };
const FW = 1136, FH = 710, clips = await fetch(`${clipsAt}/clips.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
const brand = () => { const b = el("div", "fm-brand"), i = el("img"); i.src = "/web/img/logo/mark.svg"; i.alt = ""; const n = el("span"); n.append("DynamiteOrbit", el("i", null, ".ai")); b.append(i, n); return b; };

const built = SCENES.map((s) => {
  const node = el("section", `scene ${s.kind === "shot" ? "shot" : s.kind === "words" ? "words" : "logo-card"}`), parts = { node, pics: [], chips: [] };
  if (s.kind === "words") { const big = el("p", "big"); big.append(marked(s.big[lang])); node.append(big, el("p", "small", s.small[lang])); }
  else if (s.kind === "logo" || s.kind === "end") {
    const m = el("img", "mark"); m.src = "/web/img/logo/mark.svg"; m.alt = ""; const name = el("p", "name"); name.append("DynamiteOrbit", el("i", null, ".ai"));
    const slogan = el("p", "slogan"); slogan.append(marked(s.slogan[lang]));
    const rocket = el("img", "rocket"); rocket.src = "/web/img/marketing/fusee.png"; rocket.alt = "";      // the example rocket climbing in from the corner (tools/marketing_rocket.mjs)
    node.append(rocket, m, name, el("p", "by", "by DynamiteAgile™"), slogan, el("p", "small", s.small[lang]));
    if (s.kind === "end") { const qr = el("div", "qr"), code = el("img"); code.src = "/web/img/qr/home.svg"; code.alt = ""; qr.append(code, el("span", null, lang === "fr" ? "Scannez : vidéos et démo" : "Scan: videos and demo")); node.append(el("p", "legal", `${MARK} · ${lang === "fr" ? "logiciel libre, licence MIT" : "open source, MIT licence"}`), qr); }   // the QR code of the welcome page, bottom right, as on the sheet (web/img/qr/home.svg)
  } else {
    const frame = el("div", "frame"), side = el("div", "fm-side");
    for (const m of s.media) { const pic = el("div", "pic"), img = el("img"); img.alt = ""; if (m.img) img.src = `/web/img/tour/${m.img}.jpg`; pic.append(img); frame.append(pic); parts.pics.push({ m, pic, img, shown: m.img ? img.src : "" }); }
    side.append(el("p", "station", s.station[lang]), el("p", "title", s.title[lang]));
    for (const c of s.chips || []) { const chip = el("div", "fm-chip", c[lang]); side.append(chip); parts.chips.push({ c, chip }); }
    node.append(brand(), frame, side);
  }
  stage.append(node); return { s, ...parts };
});
const caption = el("div", "caption"), said = el("span"); caption.append(said); const progress = el("div", "progress"); stage.append(caption, progress);

/* a picture framed : [centre x, centre y, zoom] → where its top-left corner goes, kept inside the frame */
const place = (pic, [cx, cy, z]) => { const x = clamp(FW / 2 - cx * FW * z, FW - FW * z, 0), y = clamp(FH / 2 - cy * FH * z, FH - FH * z, 0); pic.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${z.toFixed(4)})`; };
const frameOf = (name, k) => { const c = clips[name]; if (!c || !c.n) return null; const i = Math.min(c.n - 1, Math.max(0, Math.round(k * (c.n - 1)))); return `${clipsAt}/${name}/${String(i + 1).padStart(4, "0")}.jpg`; };
const FADE = 0.45;
/* a picture is shown whole for a moment, moves to what the voice speaks of, then stands still : a screen is read when it holds, and a film of
   still pictures weighs a fraction of one that never stops moving. A clip filmed on the platform moves by itself : its framing takes its whole time. */
const HOLD = 0.08, MOVE = 0.42, glide = (m, k) => smooth(m.clip ? k : (k - HOLD) / MOVE);
async function seek(t) {
  const waits = [];
  for (const b of built) {
    const { s } = b, a = Math.min(smooth((t - s.t0) / FADE), smooth((s.t1 - t) / FADE)), on = t >= s.t0 - 0.01 && t <= s.t1 + 0.01;
    b.node.style.opacity = on ? (s.t0 === 0 ? smooth((s.t1 - t) / FADE) : s.t1 >= DURATION ? smooth((t - s.t0) / FADE) : a).toFixed(3) : "0";      // the film opens on its first scene and stays on its last
    if (!on) continue;
    const local = t - s.t0;
    for (const { m, pic, img, shown } of b.pics) {
      const k = clamp((local - m.t0) / (m.t1 - m.t0)), first = m === s.media[0], last = m === s.media[s.media.length - 1];
      pic.style.opacity = (Math.min(first ? 1 : smooth((local - m.t0) / FADE + 0.5), last ? 1 : smooth((m.t1 - local) / FADE + 0.5))).toFixed(3);
      { const g = glide(m, k); place(pic, m.from.map((v, i) => mix(v, m.to[i], g))); }
      if (m.clip) { const url = frameOf(m.clip, k); if (url && img.dataset.at !== url) { img.dataset.at = url; img.src = url; waits.push(img.decode().catch(() => {})); } }
      else if (!img.complete) waits.push(img.decode().catch(() => {}));
      void shown;
    }
    for (const { c, chip } of b.chips) { const k = smooth((local - c.at) / 0.5); chip.style.opacity = k.toFixed(3); chip.style.transform = `translateY(${((1 - k) * 14).toFixed(2)}px)`; }
  }
  const cue = captions ? cueAt(t) : null;
  if (cue) { said.textContent = cue[lang]; caption.style.opacity = Math.min(smooth((t - cue.t0) / 0.18), smooth((cue.t1 - t) / 0.18)).toFixed(3); } else caption.style.opacity = "0";
  progress.style.width = `${(clamp(t / DURATION) * W).toFixed(1)}px`;
  await Promise.all(waits);
}
window.filmInfo = { duration: DURATION, fps: FPS, width: W, height: H, lang, cues: CUES.length, clips: Object.keys(clips) };
window.filmSeek = seek;
await Promise.all([...document.images].map((i) => (i.src ? i.decode().catch(() => {}) : null))); await seek(Number(q.get("t")) || 0);
window.filmReady = true;
if (q.get("play") === "1") { const t0 = performance.now() - (Number(q.get("t")) || 0) * 1000; const tick = async () => { const t = (performance.now() - t0) / 1000; await seek(Math.min(t, DURATION)); if (t < DURATION) requestAnimationFrame(tick); }; requestAnimationFrame(tick); }      // to watch it in a browser, as it will be
