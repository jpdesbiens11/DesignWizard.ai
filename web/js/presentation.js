/* DesignWizard.ai — the guided presentation (web/presentation.html) : slides scaled to the window, keyboard, touch, the
   rail « from the idea to the order » drawn on every slide, the notes of the presenter, a screenshot enlarged on a click.
   No dependency, no external resource. Keys : → Space PageDown = next · ← PageUp = previous · Home / End · F = full
   screen · N = notes · R = replay the animation of the slide · Esc = close. Printed (Ctrl + P), each slide is one page. */

/** The stations of the rail, in the order of a design : [key written in data-stage, label]. */
export const STAGES = [["idee", "Idée"], ["atelier", "Atelier"], ["piece", "Pièce"], ["procedes", "Procédés"], ["electrique", "Électrique"], ["assemblage", "Assemblage"],
  ["physique", "Physique"], ["isolation", "Isolation"], ["dfx", "DFx"], ["dessins", "Dessins"], ["revue", "Revue"], ["commande", "Commande"]];
export const STAGE_W = 1600, STAGE_H = 900;
/** Where a station sits on the rail, in percent (the stations keep a margin at both ends). */
export const stationAt = (i, n = STAGES.length) => Math.round((4 + (i * 92) / Math.max(1, n - 1)) * 100) / 100;
/** Where the marker stands for a slide : "debut" (or nothing) = before the first station, "fin" = after the last one. */
export function markerAt(stage) { const i = STAGES.findIndex(([k]) => k === stage); return stage === "fin" ? 100 : i < 0 ? 0 : stationAt(i); }
/** The slide to show after a move, kept inside the deck. */
export const clampSlide = (i, count) => Math.max(0, Math.min(count - 1, Number.isFinite(i) ? Math.round(i) : 0));
/** The scale that fits the stage in a window. */
export const fitScale = (w, h) => Math.min(w / STAGE_W, h / STAGE_H);

function start() {
  const deck = document.querySelector(".deck"), slides = [...deck.querySelectorAll(".slide")], panel = document.querySelector(".panel"), zoom = document.querySelector(".zoom");
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; };
  const main = slides.filter((s) => !s.hasAttribute("data-annex")).length;
  let at = 0, before = 0;
  /* every slide carries its own rail : the screen and the printed page are the same thing */
  slides.forEach((s, k) => {
    const stage = s.dataset.stage || "debut", idx = STAGES.findIndex(([key]) => key === stage), to = markerAt(stage), r = el("div", "rail");
    r.style.setProperty("--from", `${before}%`); r.style.setProperty("--to", `${to}%`); before = to;
    r.append(el("div", "line"), el("div", "done"));
    STAGES.forEach(([, label], i) => {
      const st = el("span", `st${stage === "fin" || idx > i ? " past" : idx === i ? " here" : ""}`), lb = el("span", `lb${idx === i ? " here" : ""}`, label);
      st.style.left = lb.style.left = `${stationAt(i)}%`; r.append(st, lb);
    });
    const mark = el("img", "mark"); mark.src = "img/logo/mark.svg"; mark.alt = ""; r.append(mark);
    const foot = el("div", "foot"); foot.append(el("span", null, "DesignWizard.ai by DynamiteAgile™ · pour les concepteurs, techniciens et ingénieurs en mécatronique"), el("span", null, s.hasAttribute("data-annex") ? `Annexe / ${main}` : `${k + 1} / ${main}`)); r.append(foot);
    s.append(r);
    s.querySelectorAll(".r").forEach((n, i) => n.style.setProperty("--i", String(i)));
  });
  const fit = () => { deck.style.transform = `scale(${fitScale(window.innerWidth, window.innerHeight)}) translate(-50%, -50%)`; };
  const notes = () => { const src = slides[at].querySelector(".notes"), h = el("h4", null, `Notes — ${at + 1} / ${slides.length}`); panel.replaceChildren(h, ...(src ? [...src.children].map((c) => c.cloneNode(true)) : [el("p", null, "Pas de notes pour cette page.")])); };
  function show(i, replay) {
    const next = clampSlide(i, slides.length);
    if (next === at && !replay && slides[at].classList.contains("on")) return;
    slides[at].classList.remove("on"); at = next;
    void slides[at].offsetWidth;                                   // restart the animations of the slide
    slides[at].classList.add("on");
    try { history.replaceState(null, "", `#${at + 1}`); } catch (e) { /* a file opened from the disk */ }
    document.title = `${at + 1} / ${slides.length} — DesignWizard.ai, de l'idée à la pièce commandée`;
    if (!panel.hidden) notes();
  }
  const open = (img) => { const big = el("img"); big.src = img.currentSrc || img.src; big.alt = img.alt; zoom.replaceChildren(big); zoom.hidden = false; };
  const close = () => { zoom.hidden = true; zoom.replaceChildren(); };
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (!zoom.hidden) { if (k === "Escape" || k === " " || k === "Enter") { close(); e.preventDefault(); } return; }
    if (k === "ArrowRight" || k === " " || k === "PageDown" || k === "Enter") show(at + 1);
    else if (k === "ArrowLeft" || k === "PageUp" || k === "Backspace") show(at - 1);
    else if (k === "Home") show(0); else if (k === "End") show(slides.length - 1);
    else if (k === "f" || k === "F") { if (document.fullscreenElement) document.exitFullscreen(); else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {}); }
    else if (k === "n" || k === "N") { panel.hidden = !panel.hidden; if (!panel.hidden) notes(); }
    else if (k === "r" || k === "R") show(at, true);
    else if (k === "Escape") panel.hidden = true;
    else return;
    e.preventDefault();
  });
  deck.addEventListener("click", (e) => {
    if (e.target.closest("a")) return;
    const img = e.target.closest(".shot img"); if (img) { open(img); return; }
    show(at + (e.clientX < window.innerWidth * 0.22 ? -1 : 1));    // the left edge goes back, the rest goes on
  });
  zoom.addEventListener("click", close);
  let x0 = null;
  deck.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  deck.addEventListener("touchend", (e) => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 60) { show(at + (dx < 0 ? 1 : -1)); e.preventDefault(); } });
  window.addEventListener("resize", fit); window.addEventListener("hashchange", () => show(parseInt(location.hash.slice(1), 10) - 1));
  fit(); at = clampSlide(parseInt(location.hash.slice(1), 10) - 1, slides.length); slides[at].classList.add("on"); show(at, true);
}
if (typeof document !== "undefined") { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start(); }
