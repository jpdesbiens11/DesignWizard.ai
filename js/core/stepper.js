/* DesignWizard.ai — the arrows of a number field, the way a player fast-forwards a show. Everywhere in the application, an arrow adds or
   takes away 1 ; hold it, or click quickly, and the change speeds up — ×2, ×5, ×10 — while a small gauge beside the field says the
   speed in force. Typing stays free : any decimal can be written in any field.
   Two halves. The first is pure and tested : the speed for a hold or for a streak of quick clicks, the value after a step. The second
   installs ONE pair of arrows for the whole application : it comes to the number field under the pointer or under the caret, so no
   screen has anything to declare, and a field drawn again while its arrow is held is found again where it stood.
   As the arrows of a browser do, a step says « input » and the release says « change » : the screens hear what they always heard. */

/** The speeds, in order. */
export const SPEEDS = [1, 2, 5, 10];
/** How long an arrow is held before each speed, in milliseconds. */
export const HOLD_AT = [0, 1000, 2200, 3600];
/** Two clicks closer than this, in milliseconds, are quick clicks : they lengthen the streak. */
export const QUICK = 350;
/** While an arrow is held : the wait before it repeats, then the time between two steps, in milliseconds. */
export const REPEAT = { wait: 380, every: 110 };

/** The speed after a hold of `ms`. */
export const speedByHold = (ms) => SPEEDS[HOLD_AT.reduce((k, t, i) => (ms >= t ? i : k), 0)];
/** The speed of the n-th click of a streak of quick clicks : two clicks at each speed. */
export const speedByStreak = (n) => SPEEDS[Math.min(SPEEDS.length - 1, Math.max(0, Math.floor(((n || 1) - 1) / 2)))];
/** The speed in force : the faster of what the hold and the streak give. */
export const stepSpeed = ({ heldMs = 0, streak = 1 } = {}) => Math.max(speedByHold(heldMs), speedByStreak(streak));
/** The streak after a new click. last : { at, dir, key } of the click before (or null) ; a pause, another direction or another field starts again at 1. */
export const nextStreak = (last, now, dir, key, streak) => (last && last.dir === dir && last.key === key && now - last.at < QUICK ? streak + 1 : 1);

/** What one arrow is worth at speed ×1 : 1 — a tenth when the whole range of the field is 2 or less (an emissivity from 0 to 1). */
export const baseStep = ({ min, max } = {}) => (Number.isFinite(min) && Number.isFinite(max) && max - min <= 2 ? 0.1 : 1);
const decimals = (v) => { const s = String(v), e = /e-(\d+)$/.exec(s), i = s.indexOf("."); return e ? Number(e[1]) : i < 0 ? 0 : s.length - i - 1; };
/** The value after one step. value : what the field holds (NaN when it is empty) ; dir : +1 or -1 ; speed : 1, 2, 5 or 10 ; o : { min, max, base }.
    The decimals typed are kept (12.5 becomes 13.5), without the dust of the floating point ; the value stays within min and max. */
export function stepValue(value, dir, speed = 1, o = {}) {
  const base = o.base || baseStep(o), from = Number.isFinite(value) ? value : Number.isFinite(o.min) && o.min > 0 ? o.min : 0, d = Math.min(8, Math.max(decimals(from), decimals(base)));
  let v = Number((from + (dir < 0 ? -1 : 1) * base * speed).toFixed(d));
  if (Number.isFinite(o.min) && v < o.min) v = o.min;
  if (Number.isFinite(o.max) && v > o.max) v = o.max;
  return v;
}

/* ---------- the arrows, once for the whole application ---------- */
const FIELD = 'input[type="number"]:not([disabled]):not([readonly]):not([data-no-stepper])';
const limit = (t) => (t === "" || t === null || t === undefined ? NaN : Number(t));

/** Installs the arrows and their gauge. Safe to call twice. */
export function installStepper(doc = document) {
  if (!doc || !doc.body || doc.getElementById("num-stepper")) return;
  const win = doc.defaultView, make = (tag, cls, text) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; };
  const up = make("button", "ns-up", "▲"), down = make("button", "ns-down", "▼"), host = make("div", "num-stepper"), gauge = make("div", "num-speed"), pips = make("span", "ns-pips"), word = make("b");
  for (const b of [up, down]) { b.type = "button"; b.tabIndex = -1; }
  up.setAttribute("aria-label", "Augmenter — maintenir pour accélérer"); down.setAttribute("aria-label", "Diminuer — maintenir pour accélérer");
  host.id = "num-stepper"; host.hidden = true; host.append(up, down); gauge.hidden = true; gauge.setAttribute("aria-hidden", "true");
  for (let i = 0; i < SPEEDS.length; i++) pips.append(make("i")); gauge.append(pips, word); doc.body.append(host, gauge);

  let field = null, at = null, over = false, run = null, last = null, streak = 1, fade = 0, keyDown = null;
  const place = () => {
    if (!field || !field.isConnected) { host.hidden = true; return; }
    const r = field.getBoundingClientRect(); if (!r.width || !r.height) { host.hidden = true; return; }
    at = [r.left + r.width / 2, r.top + r.height / 2];
    host.style.left = `${Math.round(r.right - 17)}px`; host.style.top = `${Math.round(r.top + 1)}px`; host.style.height = `${Math.round(r.height - 2)}px`; host.hidden = false;
    const w = 58, right = r.right + 6 + w <= win.innerWidth;      // the gauge sits beside the field : on its right, or on its left when the window ends there
    gauge.style.left = `${Math.round(right ? r.right + 6 : Math.max(2, r.left - 6 - w))}px`; gauge.style.top = `${Math.round(r.top + r.height / 2 - 11)}px`;
  };
  /* a field taken : the browser no longer calls a decimal « invalid » because the field once declared a step — any value may be typed anywhere */
  const take = (input) => { if (input.step !== "any") input.step = "any"; if (input === field) return; field = input; place(); };
  const drop = () => { if (run || keyDown) return; field = null; host.hidden = true; };
  /* a field drawn again while its arrow is held, or between two quick clicks, is the number field that now stands at the same place */
  const again = () => { if (field && field.isConnected) return field; const hit = at ? doc.elementsFromPoint(at[0], at[1]).find((n) => n.matches && n.matches(FIELD)) : null; field = hit || null; if (field) place(); return field; };
  const show = (speed) => { const k = SPEEDS.indexOf(speed); [...pips.children].forEach((p, i) => p.classList.toggle("on", i <= k)); word.textContent = `×${speed}`; gauge.dataset.speed = String(speed); gauge.hidden = false; win.clearTimeout(fade); };
  const rest = () => { win.clearTimeout(fade); fade = win.setTimeout(() => { gauge.hidden = true; }, 900); };
  const say = (input, type) => input.dispatchEvent(new win.Event(type, { bubbles: true }));
  const step = (dir, speed) => {
    const input = again(); if (!input) return false; if (input.step !== "any") input.step = "any";
    const now = input.value === "" ? NaN : Number(input.value), next = stepValue(now, dir, speed, { min: limit(input.min), max: limit(input.max) });
    show(speed); if (next !== now) { input.value = String(next); say(input, "input"); }
    place(); return true;      // a screen may move the field as its value changes (a warning appears above it) : the arrows and the gauge follow it
  };
  const key = () => (field ? field.id || field.name || field.getAttribute("data-field") || `${Math.round(at[0])}:${Math.round(at[1])}` : "");

  /* the mouse, the finger : one step at once, then the repeat, faster and faster */
  const start = (dir, e) => {
    e.preventDefault(); if (!again()) return;
    const t0 = win.performance.now(), was = field.value; streak = nextStreak(last, t0, dir, key(), streak);
    if (doc.activeElement !== field) field.focus({ preventScroll: true });
    step(dir, stepSpeed({ streak }));
    const tick = () => { if (!run) return; if (!step(dir, stepSpeed({ heldMs: win.performance.now() - t0, streak }))) { stop(); return; } run.timer = win.setTimeout(tick, REPEAT.every); };
    run = { dir, was, timer: win.setTimeout(tick, REPEAT.wait) };
  };
  const stop = () => {
    if (!run) return; win.clearTimeout(run.timer); const { dir, was } = run; run = null;
    last = { at: win.performance.now(), dir, key: key() }; rest();
    if (field && field.isConnected && field.value !== was) say(field, "change");      // the release commits, as the arrows of a browser do
    if (!over && field && doc.activeElement !== field) drop(); else { place(); win.setTimeout(place, 350); }      // …and the screen may settle a moment later
  };
  for (const [b, dir] of [[up, 1], [down, -1]]) { b.addEventListener("pointerdown", (e) => { if (e.button === 0 || e.pointerType !== "mouse") start(dir, e); }); b.addEventListener("click", (e) => e.preventDefault()); }
  for (const type of ["pointerup", "pointercancel"]) win.addEventListener(type, stop);
  win.addEventListener("blur", stop);
  host.addEventListener("pointerleave", () => { over = false; });      // an arrow held goes on until it is released, wherever the field has moved
  host.addEventListener("pointerenter", () => { over = true; });

  /* where the arrows stand : on the number field under the pointer, or under the caret */
  doc.addEventListener("pointerover", (e) => {
    const t = e.target; if (!t || !t.closest) return;
    if (t.closest("#num-stepper")) { over = true; return; }
    over = false; const input = t.closest(FIELD);
    if (input) take(input); else if (field && doc.activeElement !== field) drop();
  }, true);
  doc.addEventListener("focusin", (e) => { const t = e.target; if (t && t.matches && t.matches(FIELD)) take(t); }, true);
  doc.addEventListener("focusout", (e) => { if (e.target === field && !over) drop(); }, true);
  doc.addEventListener("scroll", () => { if (field) place(); }, true);
  win.addEventListener("resize", () => { if (field) place(); });

  /* the keyboard : ↑ and ↓ in a number field do the same, a key held speeds up as an arrow held does */
  doc.addEventListener("keydown", (e) => {
    const t = e.target; if ((e.key !== "ArrowUp" && e.key !== "ArrowDown") || e.ctrlKey || e.metaKey || e.altKey || !t || !t.matches || !t.matches(FIELD)) return;
    e.preventDefault(); take(t); const dir = e.key === "ArrowUp" ? 1 : -1, now = win.performance.now();
    if (!e.repeat || !keyDown || keyDown.dir !== dir) { streak = nextStreak(last, now, dir, key(), streak); keyDown = { dir, t0: now, was: t.value }; }
    step(dir, stepSpeed({ heldMs: now - keyDown.t0, streak }));
  }, true);
  doc.addEventListener("keyup", (e) => {
    if (!keyDown || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
    const { dir, was } = keyDown; keyDown = null; last = { at: win.performance.now(), dir, key: key() }; rest();
    if (field && field.isConnected && field.value !== was) say(field, "change");
    place(); win.setTimeout(place, 350);
  }, true);
}
