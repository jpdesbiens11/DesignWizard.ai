/* DesignWizard.ai — Labo, « Manipulation en labo » : a test done at the real bench, one step per screen (demande de JP : « un
   étudiant de 1re année… chaque étape pointée sur la carte directement au lieu de numéros de broches… un mode "Manipulation
   en labo", avec mode plein écran, des étapes à faire et des notes / mesures devant être notées »).
   Left, the board : the pads the step touches carry a ring and the lead that goes there, the pin written small. Right, the
   step : what to do, the instrument as one sets it, why, then ONE action — « C'est fait », or the reading to type — and a
   note one can dictate (a plain text field : the dictation of the system types in it ; the tool calls no service).
   The guards are those of pcba/lab_manip.js : a step opens when the ones before it are done ; a reading out of its band
   stops the test and says what to do ; a supervisor may let it pass, by name — written in the notebook of the board.
   What it follows : a step-by-step procedure (one step, one action, « Précédent » / « Suivant »), a modal dialog (focus kept
   inside, Échap closes), the browser's own full screen (a button, and F). Every tick, reading and note is one step of the
   store : Ctrl + Z takes it back. Nothing is decided here : the steps and their state come from pcba/lab_manip.js.
   SAID PLAINLY (demande de JP : « expliquer comme à un enfant de 16 ans ») : under its title each step says, in one or two sentences,
   what one is doing (« En clair ») ; the words of the bench it uses unfold below ; each point says what its signal is ; and
   « Écran et banc » shows how what the Labo drew maps to what one does here, and why the two differ (pcba/lab_plain.js). */

import { el, icon, btn, badge } from "../core/dom.js";
import { store } from "../core/store.js";
import { resolveBoard } from "../pcba/model.js";
import { LIBRARY } from "../pcba/library.js";
import { eng } from "../pcba/lab_bench.js";
import { labOf, setReading, setTick, setPass, setNote, expectedText } from "../pcba/lab_plan.js";
import { manipSteps, manipState, lockReason, placedPoints, readingSays, readUnit } from "../pcba/lab_manip.js";
import { plainStep, plainReading, signalSays, wordsIn } from "../pcba/lab_plain.js";
import { labBoard } from "./elab_view.js";
import { benchTable, whyList, wordList } from "./elab_plain.js";
import { gearPic } from "./elab_gear.js";

const KIND = { safety: ["Sécurité", "#b45309"], set: ["Régler l'appareil", "#2563eb"], connect: ["Brancher sur la carte", "#7c3aed"], guard: ["Vérifier avant d'alimenter", "#b45309"], power: ["Mise sous tension", "#dc2626"], do: ["Geste à la main", "#0d9488"], read: ["Relever", "#0891b2"], off: ["Couper", "#475569"] };
const hour = (iso) => { const d = iso ? new Date(iso) : null; return d && !Number.isNaN(d.getTime()) ? d.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" }) : ""; };
const typing = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName || "");

/** Opens the bench mode on a test. o : { boardId, key (testKey of the test), sheet (its sheet, simulated), pdf(all) (writes the procedure on paper), onClose } → { close() } */
export function openManip(o) {
  const id = o.boardId, key = o.key, sheet = o.sheet, steps = manipSteps(sheet), board = () => store.board(id), opener = document.activeElement, R = resolveBoard(board(), LIBRARY);
  const dots = el("div", { class: "manip-dots", role: "list", "aria-label": "Les étapes de l'essai" }), count = el("small", { "data-manip-count": "" }), boardHost = el("div", { class: "manip-board" }), legend = el("div", { class: "manip-legend", "aria-live": "polite" }), card = el("div", { class: "manip-card" });
  const why = btn("Écran et banc", () => { explain = !explain; draw(true); }, { small: true, icon: "info", tip: "Ce que l'écran du Labo a montré, ce que vous faites ici, et pourquoi les deux diffèrent — avec les mots du banc expliqués" }); why.dataset.manipWhy = "";
  const full = btn("Plein écran", () => toggleFull(), { small: true, icon: "fit", tip: "Plein écran (F) — Échap en sort" }), whole = btn("Toute la carte", () => { wide = !wide; draw(); }, { small: true, icon: "eye", tip: "Voir toute la carte, ou revenir au point de l'étape" });
  const root = el("div", { class: "manip", role: "dialog", "aria-modal": "true", "aria-label": `Manipulation en labo — ${sheet.title}`, "data-manip-screen": key },
    el("div", { class: "manip-head" }, icon("sensor"), el("div", { class: "grow" }, el("h2", null, `${sheet.id ? `${sheet.id} — ` : ""}${sheet.title}`), el("small", null, `${sheet.block} · ${sheet.gear.map((g) => g.label).join(", ")} · `, count)), dots, why, whole, (() => { const b = btn("PDF", () => o.pdf && o.pdf(false), { small: true, icon: "pdf", tip: "La procédure de cet essai sur papier : une image de la carte par étape, une case par relevé — remplie de ce qui est déjà coché et noté, c'est le compte rendu" }); b.dataset.manipPdf = "one"; return b; })(), (() => { const b = btn("Tout le plan", () => o.pdf && o.pdf(true), { small: true, icon: "pdf", tip: "Le même cahier pour TOUS les essais de la carte (long : chaque essai est simulé d'abord)" }); b.dataset.manipPdf = "all"; return b; })(), full, btn("Fermer", () => close(), { small: true, icon: "close", tip: "Fermer (Échap) : ce qui est coché et relevé reste dans le carnet de la carte" })),
    el("div", { class: "manip-body" }, el("div", { class: "manip-left" }, boardHost, legend), card));
  document.body.append(root);
  const pcb = labBoard(boardHost); let shown = -1, state = null, passOpen = false, bilan = false, wide = false, alive = true, silent = false, down = false, pending = false, explain = false, wordsOpen = false;
  const now = () => new Date().toISOString(), write = (label, fn, quiet = false) => { silent = quiet; try { store.updateBoard(id, (b) => { b.lab = fn(b); }, label); } finally { silent = false; } };
  const goTo = (i) => { shown = Math.max(0, Math.min(steps.length - 1, i)); passOpen = false; bilan = false; wide = false; explain = false; draw(true); card.scrollTop = 0; };
  const toggleFull = () => { try { if (document.fullscreenElement) document.exitFullscreen(); else if (root.requestFullscreen) root.requestFullscreen().catch(() => {}); } catch (e) { /* the window stays as it is : the screen already covers the page */ } };

  function action(s, row) {
    if (s.state === "locked") return el("div", { class: "manip-act locked", "data-act": "locked" }, icon("lock"), el("span", { class: "grow" }, lockReason(state, shown)), btn("Aller à l'étape à faire", () => goTo(state.at), { small: true, icon: "chevron-right" }));
    if (s.needs !== "reading") { const t = (labOf(board()).ticks || []).find((x) => x.test === key && x.step === s.id);
      return s.state === "done" ? el("div", { class: "manip-act ok", "data-act": "done" }, badge(`Fait${t && t.when ? ` à ${hour(t.when)}` : ""}`, "ok"), el("span", { class: "grow" }), btn("Décocher", () => write(`Labo : étape reprise — ${s.title}`, (b) => setTick(b, key, s.id, false)), { small: true, icon: "undo", tip: "Refaire cette étape : celles d'après se referment" }))
        : el("div", { class: "manip-act", "data-act": "tick" }, btn("C'est fait", () => { write(`Labo : étape faite — ${s.title}`, (b) => setTick(b, key, s.id, true, now())); goTo(shown + 1); }, { primary: true, cls: "big", icon: "check", tip: "Entrée" }), s.danger ? el("span", { class: "manip-stop" }, "Gardez la main près du bouton de sortie de l'alimentation.") : null); }
    const U = readUnit(row.ceiling ? row.band.high : row.expected, row.unit), says = readingSays(row, s.value ?? null), box = el("div", { class: `manip-act ${says.v}`, "data-act": "read" });
    const input = el("input", { type: "number", step: "any", value: s.value !== undefined ? String(+(s.value * U.k).toPrecision(6)) : "", "data-manip-read": row.label, "aria-label": `Valeur mesurée, en ${U.label || "unités"}`, onChange: (e) => { const raw = e.target.value.trim(), val = raw === "" ? null : Number(raw.replace(",", ".")) / U.k; write(`Relevé : ${row.label}`, (b) => setReading(b, key, row.label, val)); } });
    box.append(el("label", { class: "manip-read" }, "Mesuré", input, el("b", null, U.label || "")), ...[el("span", null, row.ceiling ? "Simulé " : "Attendu ", el("strong", null, expectedText(row)), ` · accepté : ${row.band.text}`), says.v === "ok" ? badge("conforme", "ok") : says.v === "out" ? badge("hors plage", "bad") : null].filter(Boolean));
    if (says.v === "out") box.append(el("p", { class: "manip-stop", role: "alert" }, icon("warning"), ` ${says.text} ${says.action}`));
    if (row.optional && s.state !== "done") box.append(btn("Passer : l'appareil manque", () => { write(`Labo : relevé facultatif passé — ${row.label}`, (b) => setTick(b, key, s.id, true, now())); goTo(shown + 1); }, { small: true, tip: `Ce relevé demande ${row.needs}` }));
    if (s.pass) box.append(el("p", { class: "manip-text", "data-pass": s.id, style: "flex:1 1 100%;font-size:1rem" }, icon("user"), ` Laissé passer par ${s.pass.by}${s.pass.when ? ` à ${hour(s.pass.when)}` : ""}${s.pass.why ? ` — ${s.pass.why}` : ""}. `, btn("Retirer", () => write("Labo : passage retiré", (b) => setPass(b, key, s.id, "")), { small: true })));
    else if (s.state !== "done" && (says.v === "out" || passOpen)) {
      if (!passOpen) box.append(btn("Un superviseur laisse passer…", () => { passOpen = true; draw(); const f = card.querySelector("[data-pass-by]"); if (f) f.focus(); }, { small: true, icon: "user", tip: "Son nom et sa raison sont notés dans le carnet de la carte et vont au compte rendu" }));
      else { const by = el("input", { type: "text", "data-pass-by": "", placeholder: "Nom du superviseur", autocomplete: "off" }), why = el("input", { type: "text", "data-pass-why": "", placeholder: "Pourquoi l'essai peut continuer" });
        box.append(el("div", { class: "manip-pass", style: "flex:1 1 100%" }, el("b", null, "Un superviseur laisse passer cette étape"), by, why, el("div", { class: "form-actions", style: { justifyContent: "flex-start" } }, btn("Laisser passer", () => { if (!by.value.trim() || !why.value.trim()) { (by.value.trim() ? why : by).focus(); return; } passOpen = false; write(`Labo : passage par ${by.value.trim()} — ${row.label}`, (b) => setPass(b, key, s.id, by.value, why.value, now())); }, { primary: true, small: true }), btn("Annuler", () => { passOpen = false; draw(); }, { small: true })))); } }
    return box;
  }
  function summary() {
    const L = labOf(board()), mine = (list) => list.filter((x) => x.test === key), notes = mine(L.notes).filter((n) => n.step), passes = mine(L.passes);
    return [el("span", { class: "manip-kind", style: "--dom:#16a34a" }, "Essai terminé"), el("h3", { tabindex: -1 }, "Le bilan de l'essai"),
      el("div", { class: "manip-done" }, el("table", { class: "data" }, el("thead", null, el("tr", null, el("th", null, "Relevé"), el("th", null, "Attendu"), el("th", null, "Mesuré"), el("th", null, ""))),
        el("tbody", null, sheet.rows.map((r) => { const x = mine(L.readings).find((q) => q.what === r.label), v = readingSays(r, x ? x.value : null).v; return el("tr", null, el("td", null, r.label), el("td", null, `${expectedText(r)} (${r.band.text})`), el("td", null, x ? eng(x.value, r.unit) : "—"), el("td", null, v === "ok" ? badge("conforme", "ok") : v === "out" ? badge("hors plage", "bad") : badge("non relevé", "neutral"))); })))),
      passes.length ? el("ul", { class: "manip-list" }, passes.map((p) => el("li", null, `Laissé passer par ${p.by} : ${(steps.find((s) => s.id === p.step) || {}).title || p.step}${p.why ? ` — ${p.why}` : ""}`))) : null,
      notes.length ? el("ul", { class: "manip-list" }, notes.map((n) => el("li", null, el("b", null, `${(steps.find((s) => s.id === n.step) || {}).title || n.step} : `), n.text))) : el("p", { class: "manip-why" }, "Aucune note prise pendant l'essai."),
      el("p", { class: "manip-why" }, el("b", null, "À retenir. "), sheet.learn || ""),
      el("div", { class: "manip-nav" }, btn("Revoir les étapes", () => goTo(steps.length - 1), { icon: "undo" }), el("span", { class: "grow" }), btn("Fermer", () => close(), { primary: true, icon: "check" }))];
  }
  function draw(focus = false) {
    if (!alive) return; state = manipState(sheet, steps, labOf(board()), key); if (shown < 0) shown = state.at;
    const s = state.steps[shown], row = s.needs === "reading" ? sheet.rows[s.row] : null, pp = placedPoints(R, s), on = pp.points.filter((p) => p.at);
    count.textContent = `étape ${shown + 1} sur ${steps.length} — ${state.done} faite${state.done > 1 ? "s" : ""}${state.stopped ? " — ESSAI ARRÊTÉ" : ""}`;
    dots.replaceChildren(...state.steps.map((x, i) => el("button", { class: `manip-dot ${x.state}${state.stopped === x.id ? " stop" : ""}${i === shown ? " cur" : ""}`, type: "button", role: "listitem", "data-dot": x.id, "aria-current": i === shown ? "step" : null, "aria-label": `Étape ${i + 1} : ${x.title} — ${x.state === "done" ? "faite" : x.state === "now" ? "à faire" : "verrouillée"}`, "data-tip": `${i + 1}. ${x.title}`, onClick: () => goTo(i) }, x.state === "done" ? "✓" : String(i + 1))));
    pcb.show(R, on.length ? { focus: new Set(on.map((p) => p.ref)) } : {}); pcb.mark(pp.points, wide ? null : pp.box); whole.hidden = !on.length; whole.lastChild.textContent = wide ? "Revenir au point" : "Toute la carte";
    legend.replaceChildren(...(pp.points.length ? pp.points.map((p) => el("span", { class: "lead", "data-lead": p.lead }, el("i", { style: `background:${p.color}` }, p.label), el("span", null, `${p.word} → ${p.signal}`), el("em", null, signalSays(p.signal)), el("small", null, p.at ? `${p.ref}, broche ${p.pin}` : "ce point n'est pas sur la carte : suivez le signal sur le schéma"))) : [el("span", null, icon("info"), " Cette étape se fait sur l'appareil : rien à toucher sur la carte.")]));
    if (bilan && state.finished) { legend.replaceChildren(el("span", null, icon("check"), " Essai terminé : la carte est hors tension, décâblée.")); pcb.mark([], null); card.replaceChildren(...summary().filter(Boolean)); if (focus) card.querySelector("h3").focus(); return; }
    if (explain) { card.replaceChildren(el("span", { class: "manip-kind", style: "--dom:#0f766e" }, "Comprendre"), el("h3", { tabindex: -1 }, "L'écran du Labo et le vrai banc"),
      el("p", { class: "manip-plain" }, "L'écran est une simulation : il connaît chaque fil, à chaque instant. Le banc est une vraie carte, que l'on lit avec un appareil à la fois. Voici, pour cet essai, comment passer de l'un à l'autre."),
      benchTable(sheet), el("h4", null, "Pourquoi ce n'est pas pareil"), whyList(sheet), el("h4", null, "Les mots du banc"), wordList(),
      el("div", { class: "manip-nav" }, el("span", { class: "grow" }), btn("Revenir à l'étape", () => { explain = false; draw(true); }, { primary: true, icon: "undo" }))); card.scrollTop = 0; if (focus) card.querySelector("h3").focus(); return; }
    const K = KIND[s.kind] || KIND.set, words = wordsIn([s.title, s.text, ...(s.list || []), s.why].join(" ")), lex = words.length ? el("details", { class: "manip-words", "data-manip-words": String(words.length) }, el("summary", null, `Les mots de cette étape (${words.length})`), wordList(words)) : null, note = (labOf(board()).notes || []).find((n) => n.test === key && n.step === s.id), area = el("textarea", { "data-manip-note": s.id, placeholder: "Ce que vous observez, ce qui surprend, ce qui a été changé…", onChange: (e) => write(`Labo : note — ${s.title}`, (b) => setNote(b, key, s.id, e.target.value), true) });      // a note changes nothing else on the screen : it is kept without redrawing area.value = note ? note.text : "";
    const last = shown === steps.length - 1, next = last ? btn("Voir le bilan", () => { bilan = true; draw(true); }, { primary: state.finished, icon: "check", disabled: !state.finished, tip: state.finished ? "" : "Le bilan s'ouvre quand toutes les étapes sont faites" }) : btn("Suivant", () => goTo(shown + 1), { primary: s.state === "done", icon: "chevron-right", tip: "Flèche droite — lire la suite est permis ; la faire attend son tour" });
    next.dataset.manipNext = "";
    if (lex) { lex.open = wordsOpen; lex.addEventListener("toggle", () => { wordsOpen = lex.open; }); }
    card.replaceChildren(...[el("span", { class: "manip-kind", style: `--dom:${K[1]}` }, `${shown + 1}. ${K[0]}`), el("h3", { tabindex: -1 }, s.title),
      el("p", { class: "manip-plain", "data-manip-plain": s.id }, el("b", null, "En clair. "), `${plainStep(s)}${row ? ` ${plainReading(row)}` : ""}`),
      s.instrument ? el("div", { class: "manip-gear" }, gearPic(s.gear, s.instrument), el("span", null, el("small", null, "Appareil"), el("b", null, s.instrument))) : null,
      el("p", { class: "manip-text" }, s.text), s.list ? el("ul", { class: "manip-list" }, s.list.map((t) => el("li", null, t))) : null, s.why ? el("p", { class: "manip-why" }, el("b", null, "Pourquoi. "), s.why) : null, lex,
      shown === 0 ? (() => { const b = btn("L'écran et le banc : ce qui change", () => { explain = true; draw(true); }, { small: true, icon: "info", tip: "À lire une fois avant de commencer : comment ce que l'écran du Labo a tracé devient ce que vous faites ici" }); b.dataset.manipWhyFirst = ""; return el("div", null, b); })() : null,
      action(s, row), el("label", { class: "manip-note" }, "Notes de cette étape — elles se dictent aussi (dictée du système)", area),
      el("div", { class: "manip-nav" }, btn("Précédent", () => goTo(shown - 1), { icon: "undo", disabled: shown === 0, tip: "Flèche gauche" }), el("span", { class: "grow" }), next)].filter(Boolean));
    if (focus) { const f = card.querySelector('[data-act="tick"] .btn, [data-manip-read]'), read = card.querySelector("[data-manip-read]"); (s.state === "done" ? next : read && !read.value ? read : f || next).focus(); }
  }
  function onKey(e) {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); if (explain) { explain = false; draw(true); } else if (passOpen) { passOpen = false; draw(true); } else close(); return; }
    if (e.key === "Tab") { const f = [...root.querySelectorAll("button, input, textarea, select, [tabindex]")].filter((n) => !n.disabled && !n.hidden && n.tabIndex >= 0); if (!f.length) return; const a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } return; }
    if (typing(e) || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "ArrowRight") { e.preventDefault(); e.stopPropagation(); if (shown < steps.length - 1) goTo(shown + 1); } else if (e.key === "ArrowLeft") { e.preventDefault(); e.stopPropagation(); goTo(shown - 1); } else if (e.key === "f" || e.key === "F") { e.preventDefault(); toggleFull(); }
  }
  const onFull = () => { full.lastChild.textContent = document.fullscreenElement === root ? "Quitter le plein écran" : "Plein écran"; };
  /* a value typed and left by a click on a button : the screen is redrawn AFTER the click, or the button would be gone under the pointer */
  const later = () => setTimeout(() => { if (alive && document.activeElement && !/^TEXTAREA$/.test(document.activeElement.tagName)) draw(true); else draw(); }, 0);
  const off = store.on("change", () => { if (!store.board(id)) { close(); return; } if (silent) return; if (down) pending = true; else later(); });
  const onDown = () => { down = true; }, onUp = () => { down = false; if (pending) { pending = false; later(); } };
  function close() { if (!alive) return; alive = false; off(); root.removeEventListener("keydown", onKey, true); root.removeEventListener("pointerdown", onDown, true); window.removeEventListener("pointerup", onUp, true); window.removeEventListener("pointercancel", onUp, true); document.removeEventListener("fullscreenchange", onFull); try { if (document.fullscreenElement === root) document.exitFullscreen(); } catch (e) { /* already out */ } pcb.destroy(); root.remove(); if (opener && opener.isConnected && opener.focus) opener.focus(); if (o.onClose) o.onClose(); }
  root.addEventListener("keydown", onKey, true); root.addEventListener("pointerdown", onDown, true); window.addEventListener("pointerup", onUp, true); window.addEventListener("pointercancel", onUp, true); document.addEventListener("fullscreenchange", onFull);
  draw(true);
  return { close, root };
}
