/* DesignOrbit.ai — Logiciel : the sheet of what is chosen on the page — an object, a wire, or the software as a whole — in the right panel.
   An object says first WHAT ENTERS AND WHAT LEAVES (demande de JP : « ce n'est pas clair quels sont les entrées et les sorties des blocs ») :
   one line per input and per output — its name, its unit and range, where it comes from or where it goes, what it is worth now. Then its
   values : one the tool proposed blinks until it is typed or confirmed. Then the sentence of what it must do, written from its values.
   Every change is one step of the store. The AI round trip of the software is here too : a text one copies, an answer one pastes, a preview. */

import { el, icon, btn, field, onOff, toast, confirmBox, modal } from "../core/dom.js";
import { needField } from "../core/guide.js";
import { KINDS, NATURES, cfgOf, paramUnit } from "../sw/sw_objects.js";
import { problems, unsure, wireCheck, split } from "../sw/sw_design.js";
import { requirement } from "../sw/sw_c.js";
import { cpuOf } from "../sw/sw_cpu.js";
import { ioRows } from "../sw/sw_steps.js";

const fr = (n) => (n === null || n === undefined ? "—" : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ").replace("-", "−"));
/** The inputs and outputs of an object, as two small tables. values : { ref: value } or null. */
export function ioTable(d, o, values) {
  const R = ioRows(d, o, values), row = (p, where, cls) => el("tr", { class: cls, "data-io": p.key }, el("td", null, el("b", null, p.label), el("small", null, ` ${p.unit}`)), el("td", { class: "muted" }, `${fr(p.min)} à ${fr(p.max)}`), el("td", null, where), el("td", { class: "sw-io-val", "data-ref": `${o.id}.${p.key}` }, p.value === null ? "" : fr(p.value)));
  const table = (title, rows, empty) => el("div", { class: "sw-io" }, el("p", { class: "sw-io-title" }, title), rows.length ? el("table", { class: "data" }, el("thead", null, el("tr", null, el("th", null, "Nom"), el("th", null, "Plage"), el("th", null, title.startsWith("Ce qui entre") ? "Vient de" : "Va vers"), el("th", null, "Vaut"))), el("tbody", null, rows)) : el("p", { class: "muted small" }, empty));
  return el("div", { "data-sw-io": o.id },
    table("Ce qui entre (à gauche de la tuile)", R.in.map((p) => row(p, p.from ? `${p.from}${p.delay ? " — valeur du pas d'avant" : ""}` : p.free ? "rien (facultatif)" : el("span", { class: "form-error" }, "rien : à relier"), p.from || p.free ? "" : "bad")), "Rien n'entre par un fil : cette tuile lit une broche du CPU."),
    table("Ce qui sort (à droite de la tuile)", R.out.map((p) => row(p, p.to.length ? p.to.join(" ; ") : "rien pour l'instant", "")), "Rien ne sort par un fil : cette tuile écrit une broche du CPU."));
}
/** The sheet. body : where it is written ; c : { d, sel, change(label, fn), values, onGone() (what was chosen is no more), live (the step is the live simulation) } */
export function sheet(body, c) {
  const d = c.d, o = c.sel && c.sel.obj ? d.objects.find((x) => x.id === c.sel.obj) : null, w = c.sel && c.sel.wire ? d.wires.find((x) => x.from === c.sel.wire.from && x.to === c.sel.wire.to) : null, change = c.change;
  const sec = (title, note, ...kids) => { const x = el("div", { class: "side-section", "data-fold-note": note }, el("h3", null, title), ...kids.flat().filter(Boolean)); body.append(x); return x; };
  if (o) { const K = KINDS[o.kind], N = NATURES.find((n) => n.id === K.nature), cf = cfgOf(o), mine = (o.sure || []), left0 = K.params.filter((p) => !mine.includes(p.key));
    body.append(el("p", { class: "lab-nature", style: `--dom:${N.color}` }, icon(K.icon), el("span", null, el("b", null, `${K.label} — ${K.fr}`), el("small", null, `${N.fr} · ${K.text}`))));
    sec("Ses entrées et ses sorties", "", ioTable(d, o, c.values));
    if (c.live) return;
    sec("L'objet", o.off ? "à Off" : "à On", field("Nom", el("input", { type: "text", value: o.name, "data-sw-name": "", onChange: (e) => change(`Logiciel : ${o.id} renommé`, (x) => { x.objects.find((q) => q.id === o.id).name = e.target.value.trim() || o.id; }) })),
      el("div", { class: "form-actions", style: { justifyContent: "flex-start" } }, onOff(!o.off, (on) => change(`Logiciel : ${o.name} ${on ? "à On" : "à Off"}`, (x) => { const q = x.objects.find((z) => z.id === o.id); if (on) delete q.off; else q.off = true; }), o.name, o.off ? "Cet objet est de côté : il n'est ni simulé ni écrit — cliquer pour le remettre" : "Mettre cet objet de côté sans le perdre"),
        btn("Dupliquer", () => change(`Logiciel : ${o.name} dupliqué (copie à Off)`, (x) => { let n = 2; while (x.objects.some((z) => z.id === `${o.id}_${n}`)) n++; x.objects.push({ ...JSON.parse(JSON.stringify(o)), id: `${o.id}_${n}`, name: `${o.name} (copie)`, off: true, x: (o.x || 0) + 20, y: (o.y || 0) + 30 }); }), { small: true, icon: "copy", tip: "La copie naît à Off, sans fils" }),
        btn("Supprimer", () => { change(`Logiciel : ${o.name} supprimé`, (x) => { x.objects = x.objects.filter((z) => z.id !== o.id); x.wires = x.wires.filter((q) => split(q.from)[0] !== o.id && split(q.to)[0] !== o.id); }); c.onGone(); }, { small: true, icon: "trash", danger: true })));
    if (K.params.length) sec("Ses valeurs", left0.length ? `${left0.length} à confirmer` : "confirmées", K.params.map((p) => { const U = paramUnit(o, p), set = (v) => change(`Logiciel : ${o.name} — ${p.label}`, (x) => { const q = x.objects.find((z) => z.id === o.id); q.params = q.params || {}; q.params[p.key] = v; q.sure = [...new Set([...(q.sure || []), p.key])]; });
      const input = p.choices ? el("select", { "data-sw-param": p.key, onChange: (e) => set(typeof p.value === "number" ? Number(e.target.value) : e.target.value) }, p.choices.map((v) => el("option", { value: v, selected: v === cf[p.key] }, String(v)))) : el("input", { type: "number", step: "1", value: String(cf[p.key]), min: p.min, max: p.max, "data-sw-param": p.key, onChange: (e) => { const v = Math.round(Number(e.target.value)); if (Number.isFinite(v)) set(v); } });
      if (!mine.includes(p.key)) needField(input, { hint: "Une valeur d'exemple proposée par l'outil : tapez la vôtre, ou confirmez-la." }); return field(`${p.label}${U ? ` (${U})` : ""}`, input, p.text || null); }),
      left0.length ? (() => { const b = btn(`Confirmer ${left0.length > 1 ? `ces ${left0.length} valeurs` : "cette valeur"}`, () => change(`Logiciel : valeurs de ${o.name} confirmées`, (x) => { x.objects.find((z) => z.id === o.id).sure = K.params.map((p) => p.key); }), { small: true, icon: "check", tip: "Vous avez relu ces valeurs : elles ne sont plus des exemples" }); b.dataset.swSure = ""; return b; })() : null);
    sec("Ce qu'il doit faire", "", el("p", { class: "lab-why", "data-sw-req": "" }, requirement(d, o)), el("p", { class: "muted small" }, "Cette phrase est écrite d'après les valeurs et les fils : elle va dans doc/TRACE.md, à côté des fichiers de l'objet."));
  } else if (w) { const ck = wireCheck(d, w.from, w.to);
    sec("Le fil", w.delay ? "valeur du pas d'avant" : "", el("p", { class: "lab-why" }, `${w.from} → ${w.to}`), ck.text ? el("p", { class: ck.ok ? "lab-note" : "form-error" }, ck.text) : null,
      el("div", { class: "form-actions", style: { justifyContent: "flex-start" } }, onOff(!!w.delay, (on) => change(`Logiciel : fil ${w.from} → ${w.to}`, (x) => { const q = x.wires.find((z) => z.from === w.from && z.to === w.to); if (on) q.delay = true; else delete q.delay; }), "valeur du pas d'avant", "Ce fil porte la valeur du pas d'avant : ce qui ouvre une boucle, comme dans un schéma-bloc"), el("span", null, "Valeur du pas d'avant"),
        btn("Retirer le fil", () => { change(`Logiciel : fil ${w.from} → ${w.to} retiré`, (x) => { x.wires = x.wires.filter((z) => !(z.from === w.from && z.to === w.to)); }); c.onGone(); }, { small: true, icon: "trash", danger: true })));
  } else { const n = unsure(d).length;
    sec("Le logiciel", `${d.objects.length} objets`, el("p", { class: "lab-why" }, "Un clic sur une tuile ouvre sa fiche : ce qui entre, ce qui sort, ses valeurs. Sa tête se glisse pour la déplacer. Un clic sur une sortie, puis sur une entrée, tire un fil — l'outil le refuse quand les unités ne s'accordent pas."),
      field("Période du pas (ms)", el("input", { type: "number", min: 1, max: 1000, step: 1, value: String(d.period || 10), "data-sw-period": "", onChange: (e) => { const v = Math.round(Number(e.target.value)); if (v >= 1) change("Logiciel : période du pas", (x) => { x.period = v; }); } }), "Tous les combien le logiciel refait son pas : les délais se comptent en pas."),
      n ? (() => { const b = btn(`Confirmer les ${n} valeurs d'exemple…`, async () => { if (await confirmBox("Confirmer toutes les valeurs", `Les ${n} valeurs proposées par l'outil — seuils, délais, échelles, numéros de broches — seront tenues pour relues. Faites-le seulement si vous les avez lues.`, "Je les ai relues")) change("Logiciel : toutes les valeurs confirmées", (x) => { for (const q of x.objects) if (KINDS[q.kind]) q.sure = KINDS[q.kind].params.map((p) => p.key); }); }, { small: true, icon: "check" }); b.dataset.swSureAll = ""; return b; })() : null); }
}

/** The software as a text for an assistant : its objects, its wires, the CPU, and the task. */
export const aiText = (d) => ["Tu es l'assistant de conception de DesignOrbit.ai. Voici le logiciel embarqué d'un BMS, décrit comme des OBJETS reliés par des fils : chaque objet a un genre (kind), des paramètres, et des ports ; un fil va d'une sortie « objet.port » à une entrée « objet.port ».",
  `GENRES DISPONIBLES — ${Object.entries(KINDS).map(([k, K]) => `${k} (${K.label} : entrées ${K.ports.in.map((p) => p.key).join(", ") || "aucune"} ; sorties ${K.ports.out.map((p) => p.key).join(", ") || "aucune"} ; paramètres ${K.params.map((p) => p.key).join(", ") || "aucun"})`).join(" · ")}.`,
  `CPU CHOISI — ${cpuOf(d).name} : ${cpuOf(d).adc.channels} voies analogiques de ${cpuOf(d).adc.bits} bits, ${cpuOf(d).gio} broches logiques.`,
  "TA TÂCHE — relis ce logiciel comme un ingénieur de logiciel embarqué : un objet qui manque, un seuil ou un délai qui te paraît faux, une entrée non reliée. Dis-le en quelques lignes, puis attends mon accord.",
  "RÉPONSE ATTENDUE — un seul bloc ```json avec le logiciel entier, même forme. Toute valeur que tu changes ou ajoutes reste un EXEMPLE : ne l'inscris pas dans « sure ». N'invente pas de genre d'objet.", "", "```json", JSON.stringify(d, null, 1), "```"].join("\n");
/** The answer of an assistant, pasted : a preview of what changes, then ONE undoable step. design() → the design now ; change(label, fn). */
export function reimport(design, change) {
  const area = el("textarea", { rows: 9, placeholder: "Collez la réponse de l'assistant : elle contient le logiciel dans un bloc ```json." }), out = el("div"); let next = null;
  const ok = btn("Appliquer ces changements", () => { if (!next) return; change("Logiciel : réponse de l'IA", (d) => { for (const k of Object.keys(d)) delete d[k]; Object.assign(d, next); }); m.close(); toast("Logiciel mis à jour. Ctrl + Z pour revenir.", "success"); }, { primary: true, icon: "check", disabled: true });
  area.addEventListener("input", () => { next = null; ok.disabled = true; out.replaceChildren(); if (!area.value.trim()) return;
    try { const m2 = area.value.match(/```json\s*([\s\S]*?)```/), doc = JSON.parse(m2 ? m2[1] : area.value), now = design(); if (!doc || !Array.isArray(doc.objects) || !Array.isArray(doc.wires)) throw new Error("La réponse ne contient pas un logiciel (objects, wires)."); const bad = doc.objects.filter((o) => !KINDS[o.kind]); if (bad.length) throw new Error(`Genre d'objet inconnu : ${bad.map((o) => o.kind).join(", ")}.`);
      const was = new Map(now.objects.map((o) => [o.id, JSON.stringify({ ...o, x: 0, y: 0 })])), lines = []; for (const o of doc.objects) { const w = was.get(o.id); if (w === undefined) lines.push(`+ ${o.name || o.id} (${KINDS[o.kind].label}) — créé`); else if (w !== JSON.stringify({ ...o, x: 0, y: 0 })) lines.push(`~ ${o.name || o.id} — modifié`); was.delete(o.id); }
      for (const id of was.keys()) lines.push(`− ${id} — retiré`); const wn = JSON.stringify(now.wires) !== JSON.stringify(doc.wires); if (wn) lines.push(`~ les fils : ${now.wires.length} → ${doc.wires.length}`);
      /* a value an answer changed or brought is an example : it is not taken for confirmed */
      const old = new Map(now.objects.map((o) => [o.id, o])); doc.objects = doc.objects.map((o) => { const p = old.get(o.id), c0 = p ? cfgOf(p) : {}, c1 = cfgOf(o); return { ...o, sure: (p ? p.sure || [] : []).filter((k) => c0[k] === c1[k]) }; });
      const ps = problems(doc, cpuOf(doc)).filter((p) => p.level === "error"); out.append(el("p", null, lines.length ? `${lines.length} changement(s) :` : "Aucun changement."), el("ul", { class: "decisions" }, lines.slice(0, 30).map((t) => el("li", null, t))), ...(ps.length ? [el("p", { class: "form-error" }, `Ce que cela dérange : ${ps.map((p) => p.text).join(" ")}`)] : []));
      if (lines.length) { next = doc; ok.disabled = false; } } catch (e) { out.append(el("p", { class: "form-error" }, e.message)); } });
  const m = modal("Réimporter le logiciel depuis une IA", [field("Réponse de l'assistant", area), out, el("div", { class: "form-actions" }, btn("Annuler", () => m.close()), ok)], { wide: true });
}
