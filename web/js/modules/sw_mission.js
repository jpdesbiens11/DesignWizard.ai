/* DynamiteOrbit.ai — Logiciel, « Essayer » : the MISSION view (JP, 26 novembre 2026, sur une capture du banc : « replace the central part of the
   simulation with an overlay that shows the duty cycle of the component vs. time, we can export/import actual profile, when we meet a limit,
   user must restart the profile by clicking on "continue" if fault is manageable »).
   It takes the place of the pieces while a module is on the bench (design.plant) — « Voir les pièces » brings them back. One chart over the WHOLE
   profile, as a test-bench recorder draws it : the voltages of the highest and the lowest CORE, the current, the hottest temperature, each with the
   thresholds of the software ; then the state of the module as a coloured band, and one lane per output of the software — contactor, LEDs, buzzer,
   pump — and the balancing, filled where it is on, with its DUTY CYCLE (time on / time run) ; the events of the profile, numbered ; the cursor of
   now. A limit that stops the module stops the profile : a banner says which, and « Continuer » goes on (sw_story_ui.js cont). The profile goes out
   and comes in as text (sw/sw_profiles.js), the record of the run goes out as CSV, one line a second, branded.
   Read from the bench record (sw/sw_live.js L.rec) : nothing is computed here. What it follows : the multi-channel chart recorder of a test bench. */

import { el, btn, icon, download } from "../core/dom.js";
import { stampText } from "../core/brand.js";
import { recordCsv } from "../sw/sw_live.js";
import { packLimits } from "../sw/sw_pack.js";
import { profileTxt } from "../sw/sw_profiles.js";
import { profilesOf } from "../sw/sw_story.js";
import { STATE_NAMES } from "../sw/sw_units.js";
import { openBank } from "./sw_profile_bank.js";

const STATE_COL = ["#16a34a", "#eab308", "#f97316", "#dc2626"], fr = (x, n = 1) => String(+x.toFixed(n)).replace(".", ",");
const hms = (ms) => { const s = Math.round(ms / 1000); return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")}`; };
/** The duty cycle of each lane of a record : the share of the time it was on. Pure. → { ref: 0..1 } */
export function dutyOf(rec, refs) { const n = rec.length || 1, out = {}; refs.forEach((r, k) => { out[r] = rec.reduce((s, x) => s + (x.out[k] ? 1 : 0), 0) / n; }); out.bleed = rec.reduce((s, x) => s + (x.bleed ? 1 : 0), 0) / n; return out; }

/** bench ; design() ; story (modules/sw_story_ui.js) ; change(label, fn) ; showPieces(on). → { node, refresh(), halted(h), dispose() } */
export function swMission(bench, design, story, change, showPieces) {
  const canvas = el("canvas", { class: "swmi-chart", role: "img", "aria-label": "La mission : tensions, courant, température, état du module et taux de marche de chaque composant dans le temps" });
  const title = el("b"), clock = el("small", { class: "swmi-clock" }), halt = el("div", { class: "swmi-halt", hidden: true, role: "alert", "data-sw-halt": "" });
  const names = () => { const d = design(), o = {}; for (const x of (d && d.objects) || []) o[`${x.id}.level`] = x.name; return o; };
  const cur = () => { const d = design(), all = profilesOf(d); return all.find((p) => p.id === story.profileId) || all[0] || null; };
  const exp = btn("Exporter le profil (.txt)", () => { const d = design(), p = cur(); if (!p) return; download(`profil_${p.id}.txt`, stampText(`profil_${p.id}.txt`, profileTxt(p, d)), "text/plain"); }, { small: true, icon: "download", tip: "Le profil joué, en texte : ce qui mène le module, les entrées, les seuils visés — à modifier, puis à réimporter" });
  const imp = btn("Importer un profil…", () => openBank({ design, change, current: story.profileId, choose: (id) => { bench.pause(); story.load(id); bench.reset(); draw(); } }), { small: true, icon: "upload", tip: "La banque : importer un .txt, en choisir un, ou demander à une IA d'en écrire un" });
  const rec = btn("Exporter l'enregistrement (.csv)", () => { const L = bench.L; if (!L || !L.rec) return; const d = design(), name = `mission_${(cur() || {}).id || "profil"}.csv`; download(name, stampText(name, recordCsv(L, names())), "text/csv"); }, { small: true, icon: "download", tip: "Ce qui s'est passé, une ligne par seconde : tensions, courant, température, état, chaque sortie" });
  const back = btn("Voir les pièces", () => showPieces(true), { small: true, icon: "eye", tip: "Revenir aux pièces du logiciel ; « Mission » y ramène" });
  /* FULL SCREEN (JP, 26 novembre 2026 : « allow a full screen mode for the central area with a lot of data during the profile runs, with a normal
     screen button to get back ») : the mission over the whole window, with what one needs while it runs — Marche / Pause, the banner of a limit
     and its « Continuer » ; « Écran normal » or Esc brings the page back. What it follows : the full-screen view of a recorder or a video player. */
  const st = { full: false };
  const go = btn("Pause", () => (bench.running ? bench.pause() : bench.play()), { small: true, primary: true, icon: "play", tip: "Laisser courir le profil, ou l'arrêter" }); go.hidden = true; go.dataset.swmiRun = "";
  const full = btn("Plein écran", () => setFull(!st.full), { small: true, icon: "fit", tip: "La mission sur tout l'écran ; « Écran normal » ou Échap y revient" }); full.dataset.swmiFull = "";
  const onKey = (e) => { if (e.key === "Escape" && st.full) { e.preventDefault(); setFull(false); } };
  function setFull(on) {
    st.full = on; node.classList.toggle("swmi-full", on); full.lastChild.textContent = on ? "Écran normal" : "Plein écran"; full.dataset.swmiFull = on ? "on" : ""; go.hidden = !on;
    if (on) { st.home = halt.parentNode; node.insertBefore(halt, node.querySelector(".swmi-body")); document.addEventListener("keydown", onKey); }
    else { if (st.home && st.home.isConnected) st.home.insertBefore(halt, st.home.querySelector("[data-sw-bubble]") || null); document.removeEventListener("keydown", onKey); }
    draw();
  }
  const node = el("div", { class: "swmi", "data-sw-mission": "" }, el("header", { class: "swmi-head" }, icon("report"), title, clock, el("span", { class: "swmi-gap" }), go, full, exp, imp, rec, back), el("div", { class: "swmi-body" }, canvas),
    el("p", { class: "swmi-note muted small" }, "Une ligne par seconde du module simulé (valeurs TYPIQUES). Les traits pointillés sont les seuils du logiciel ; une bande pleine, un composant en marche, avec son taux de marche à gauche. Un chiffre en haut : un événement du profil."));
  /* the banner of a limit met */
  function halted(h) {
    halt.hidden = !h; if (!h) { halt.replaceChildren(); return; } const ok = story.canClear();
    halt.replaceChildren(icon("warning"), el("div", null, el("b", null, `Limite atteinte à ${hms(h.t)} — le module est en ${STATE_NAMES[h.state] || h.state}`), el("p", null, `${h.why.length ? `Ce qui a déclenché : ${h.why.join(", ")}. ` : ""}${h.event ? `Pendant « ${h.event} ». ` : ""}${ok ? "La cause est retombée : « Continuer » acquitte le défaut et reprend le profil." : "La cause est encore là : « Continuer » reprend le profil, le temps la fera retomber ; le profil acquittera ensuite."}`)),
      (() => { const b = btn(ok ? "Acquitter et continuer" : "Continuer", () => story.cont(), { primary: true, icon: "play", tip: "Reprendre le profil là où il s'est arrêté" }); b.dataset.swContinue = ""; return b; })());
    if (st.full) draw();      // the banner takes room : the chart shares what is left
  }
  function draw() {
    const L = bench.L, d = design(); if (!L || !L.rec || !d) return; const p = cur(); title.textContent = `Mission — ${p ? p.name : "profil"}`; clock.textContent = `${hms(L.t)} sur ${hms(story.total)}`;
    const w = Math.max(320, ((canvas.parentNode && canvas.parentNode.clientWidth) || 900) - 4), refs = L.recRefs, nm = names(), lanes = [...refs.map((r, k) => ({ k, label: nm[r] || r })), { k: -1, label: "Équilibrage (au moins un CORE)" }];
    /* the left column narrows with the pane ; each panel has its title ABOVE it, across the width, and its scale at the right of the column */
    /* full screen : the three panels share what the window leaves, so that the lanes and the time axis stay in sight */
    const fixedH = 34 + 30 * 3 + 22 + (refs.length + 1) * 17 + 34 + 10, canvasTop = st.full ? canvas.getBoundingClientRect().top : 0, k = st.full ? Math.max(1, (window.innerHeight - canvasTop - fixedH) / 244) : 1;
    const LBL = Math.round(Math.min(190, Math.max(96, w * 0.22))), X0 = LBL + 8, X1 = w - 10, top = 34, H = [104, 70, 70].map((x) => Math.round(x * k)), gap = 30, laneH = 17, h = top + H[0] + H[1] + H[2] + gap * 3 + 22 + lanes.length * laneH + 34, dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    const g = canvas.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = "#0b1220"; g.fillRect(0, 0, w, h); g.font = "11px system-ui, sans-serif"; g.textBaseline = "middle";
    const T = Math.max(story.total, L.t, 1000), X = (t) => X0 + (X1 - X0) * Math.min(1, t / T), R = L.rec, lims = packLimits(d), cut = (t, n) => (t.length > n ? `${t.slice(0, n - 1)}…` : t), chars = Math.max(10, Math.floor((LBL - 40) / 6));
    /* the time axis : a tick and its minute under the chart, a light line through every panel */
    const stepMin = [1, 2, 5, 10, 15, 20, 30, 60].find((m) => (X1 - X0) / (T / 60000 / m) >= 56) || 60, yEnd = h - 24;
    g.strokeStyle = "#16213a"; for (let m = 0; m * 60000 <= T; m += stepMin) { const x = X(m * 60000); g.beginPath(); g.moveTo(x, top - 14); g.lineTo(x, yEnd); g.stroke(); g.fillStyle = "#94a3b8"; g.textAlign = m ? "center" : "left"; g.fillText(`${m} min`, x, h - 12); }
    g.textAlign = "right"; g.fillStyle = "#64748b"; g.fillText("temps", X0 - 6, h - 12); g.textAlign = "left";
    /* the events of the profile, numbered */
    let n = 0; g.strokeStyle = "#334155"; g.setLineDash([2, 4]); for (const e of story.events) { if (e.hidden) continue; n++; const x = X(e.t); g.beginPath(); g.moveTo(x, top - 14); g.lineTo(x, yEnd); g.stroke(); g.fillStyle = "#a78bfa"; g.textAlign = "center"; g.fillText(String(n), x, 9); } g.setLineDash([]); g.textAlign = "left";
    /* three analog panels : the CORE voltages, the current, the temperature — each with its title above, its scale (ticks and grid) and the thresholds of the software */
    const panel = (y0, hh, lo, hi, step, label, series, what, unit) => {
      const Y = (v) => y0 + hh - (hh * (Math.max(lo, Math.min(hi, v)) - lo)) / (hi - lo);
      g.fillStyle = "#e2e8f0"; g.font = "600 12px system-ui, sans-serif"; g.fillText(`${label} — ${unit}`, 6, y0 - 12); g.font = "11px system-ui, sans-serif";
      for (let v = lo; v <= hi + 1e-9; v += step) { const yy = Y(v); g.strokeStyle = "#16213a"; g.beginPath(); g.moveTo(X0, yy); g.lineTo(X1, yy); g.stroke(); g.fillStyle = "#94a3b8"; g.textAlign = "right"; g.fillText(`${fr(v, step < 1 ? 1 : 0)} ${unit}`, X0 - 6, yy); g.textAlign = "left"; }
      g.strokeStyle = "#334155"; g.strokeRect(X0, y0, X1 - X0, hh);
      const taken = []; for (const l of lims.filter((x) => what.includes(x.what)).sort((a, b) => b.trip - a.trip)) { const v = l.what === "temp" ? l.trip / 10 : l.trip / 1000; if (v < lo || v > hi) continue; g.strokeStyle = l.latch ? "#ef4444" : "#eab308"; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(X0, Y(v)); g.lineTo(X1, Y(v)); g.stroke(); g.setLineDash([]);
        let ly = Y(v) - 7; while (taken.some((t) => Math.abs(t - ly) < 12)) ly += 12; taken.push(ly);      /* two thresholds close together : their labels one under the other */
        g.fillStyle = g.strokeStyle; g.textAlign = "right"; g.fillText(cut(l.name, 30), X1 - 4, ly); g.textAlign = "left"; }
      for (const [col, f] of series) { g.strokeStyle = col; g.lineWidth = 1.6; g.beginPath(); R.forEach((x, j) => { const yy = Y(f(x)); if (!j) g.moveTo(X(x.t), yy); else g.lineTo(X(x.t), yy); }); g.stroke(); g.lineWidth = 1; }
    };
    let y = top; panel(y, H[0], 2.6, 4.4, 0.6, "Tension des CORE (haut, bas)", [["#60a5fa", (x) => x.vmax / 1000], ["#22d3ee", (x) => x.vmin / 1000]], ["vmax", "vmin"], "V"); y += H[0] + gap;
    panel(y, H[1], -120, 120, 60, "Courant (+ décharge, − charge)", [["#fbbf24", (x) => x.current / 1000]], ["current"], "A"); y += H[1] + gap;
    panel(y, H[2], 15, 85, 20, "Température du CORE le plus chaud", [["#fb7185", (x) => x.temp / 10]], ["temp"], "°C"); y += H[2] + gap;
    /* the state of the module, as a band ; then one lane per component, filled where it is on, with its duty cycle */
    g.fillStyle = "#e2e8f0"; g.font = "600 12px system-ui, sans-serif"; g.fillText("État du module", 6, y - 12); g.font = "11px system-ui, sans-serif";
    STATE_NAMES.forEach((s0, k) => { g.fillStyle = STATE_COL[k]; g.fillRect(X0 + k * 78, y - 17, 9, 9); g.fillStyle = "#94a3b8"; g.fillText(s0, X0 + k * 78 + 13, y - 12); });
    R.forEach((x, j) => { const nx = R[j + 1] ? R[j + 1].t : x.t + 1000; g.fillStyle = STATE_COL[x.state] || "#64748b"; g.fillRect(X(x.t), y, Math.max(1, X(nx) - X(x.t)), 14); }); y += 22;
    const duty = dutyOf(R, refs);
    lanes.forEach((ln, r) => { const y0 = y + r * laneH, on = (x) => (ln.k < 0 ? x.bleed > 0 : !!x.out[ln.k]), dc = ln.k < 0 ? duty.bleed : duty[refs[ln.k]];
      g.fillStyle = "#94a3b8"; g.fillText(cut(ln.label, chars), 6, y0 + 7); g.fillStyle = "#e2e8f0"; g.textAlign = "right"; g.fillText(`${Math.round(dc * 100)} %`, X0 - 6, y0 + 7); g.textAlign = "left";
      g.fillStyle = "#111c33"; g.fillRect(X0, y0 + 2, X1 - X0, laneH - 5); g.fillStyle = ln.k < 0 || /led_g/.test(refs[ln.k] || "") ? "#22c55e" : /led_r|buzz/.test(refs[ln.k] || "") ? "#ef4444" : /led_y/.test(refs[ln.k] || "") ? "#eab308" : "#38bdf8";
      R.forEach((x, j) => { if (!on(x)) return; const nx = R[j + 1] ? R[j + 1].t : x.t + 1000; g.fillRect(X(x.t), y0 + 2, Math.max(1, X(nx) - X(x.t)), laneH - 5); }); });
    g.fillStyle = "#64748b"; g.textAlign = "right"; g.fillText("taux de marche", X0 - 6, y - 8); g.textAlign = "left";
    /* now */
    g.strokeStyle = "#f8fafc"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(X(L.t), top - 14); g.lineTo(X(L.t), yEnd); g.stroke(); g.lineWidth = 1;
  }
  let at = 0; const refresh = () => { go.lastChild.textContent = bench.running ? "Pause" : "Marche"; const now = performance.now(); if (now - at < 250) return; at = now; draw(); };
  return { node, halt, refresh, draw, halted, get full() { return st.full; }, dispose() { if (st.full) setFull(false); node.remove(); halt.remove(); } };      // the banner of a limit goes under the line of the profile (modules/sw.js)
}
