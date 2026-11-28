/* DynamiteOrbit.ai — Labo, the TABLE : several boards on one bench (point 6, JP, 20 novembre 2026). Two views at a switch : « Table » — the
   boards laid side by side as they are (their outline, their connectors where they are), the cables between them, the lab supply drawn above
   and corded to the board it feeds ; « Schéma des liaisons » — one column per board, its connector pins in rows, the cables between them.
   In both, a click on a pin, then on a pin of another board, lays a cable — checked first : the tool refuses the incompatible and says why
   (pcba/lab_table.js). Two boards whose connectors match are linked at once when the second is put on the table. Each cable is On / Off, or
   goes ; every change is one undoable step. Nothing is simulated together : the table says how the boards are wired, the guide what does
   not hold — and the screen says it. Route : #/elab/table. The usage followed : a wiring diagram, pins in columns, a wire drawn from pin to pin. */

import { el, svg, icon, btn, toast, onOff } from "../core/dom.js";
import { go, setGuide } from "../core/app.js";
import { store } from "../core/store.js";
import { resolveBoard } from "../pcba/model.js";
import { LIBRARY } from "../pcba/library.js";
import { PORT_KINDS, portsOf, portOf, linkCheck, tableOf, tableLinks, tableIssues, putBoard, takeBoard, addLink, removeLink, setLinkOn, benchFeeds, autoLinks } from "../pcba/lab_table.js";
import { roleOf, BOARD_ROLES } from "../pcba/board_role.js";
import { svgView } from "./svg_view.js";
import { gearPic } from "./elab_gear.js";
import { rs485Board } from "../demo/demo_rs485.js";
import { demoBoard } from "../demo/demo_pcba.js";
import { systemRun } from "./elab_system.js";

const fr = (v) => String(+(+v).toPrecision(3)).replace(".", ",");
const MODES = [["table", "Table", "pcb"], ["schema", "Schéma des liaisons", "branch"], ["run", "En marche", "play"]];      // « En marche » : JP, 27 novembre 2026

export function tableScreen(main) {
  const st = { mode: "table", pick: null, open: false }, left = el("aside", { class: "side" }), right = el("aside", { class: "side right" }), host = el("div", { class: "lab-table-host" });
  const centre = el("div", { class: "lab-table-centre" }), root = el("div", { class: "studio" }, left, centre, right); main.append(root);
  const bar = el("div", { class: "lab-table-bar" }); centre.append(bar, host);
  const V = svgView(host, { label: "La table du labo : les cartes et leurs câbles", cls: "lab-table-svg", data: "data-lab-table", grab: "[data-port], [data-cable]", maxFit: 3 });
  const P = () => store.project, T = () => tableOf(P()), boards = () => T().boards.map((id) => store.board(id)).filter(Boolean);
  /* a click on a pin : the first one is held, the second lays the cable — or says why not */
  function pickPort(key) {
    if (!st.open) { const q = portOf(P(), key); if (q) toast(`${q.board} · ${q.pin} — ${q.net} (${PORT_KINDS[q.kind].fr.toLowerCase()}${q.volts ? `, ${fr(q.volts)} V` : ""}). Montage verrouillé : « Déverrouiller » pour changer un câble.`, "info", 5000); return; }
    if (!st.pick) { st.pick = key; draw(); return; }
    if (st.pick === key) { st.pick = null; draw(); return; }
    const a = st.pick; st.pick = null; const c = linkCheck(portOf(P(), a), portOf(P(), key));      // checked before anything is written : a refusal is said, nothing changes
    if (!c.ok) { toast(c.why, "warn", 7000); draw(); return; }
    let res = null; store.commit(`Table du labo : câble ${a} ↔ ${key}`, (p) => { res = addLink(p, a, key); });
    if (res && !res.ok) toast(res.why, "warn", 7000); else if (res) toast(`Câble ${res.link.id} posé.`, "success");
  }
  const portDot = (p, x, y, r, label) => svg("g", { class: `lab-port${st.pick === p.key ? " picked" : ""}${p.debug ? " debug" : ""}`, "data-port": p.key, role: "button", tabindex: "0", "aria-label": `${p.board} ${p.pin} — ${p.net}` },
    svg("circle", { cx: x, cy: y, r, fill: PORT_KINDS[p.kind].color, stroke: "#fff", "stroke-width": r * 0.3 }), label ? svg("text", { x: x + r * 1.6, y: y + r * 0.45, "font-size": r * 1.3, class: "lab-port-label" }, label) : null);
  const cable = (l, a, b, sag) => { const off = l.on === false, mid = Math.max(a[1], b[1]) + sag, d = `M${a[0]},${a[1]} C${a[0]},${mid} ${b[0]},${mid} ${b[0]},${b[1]}`;
    return svg("g", { class: `lab-cable${off ? " off" : ""}${l.ok ? "" : " bad"}`, "data-cable": l.id }, svg("path", { d, class: "halo" }), svg("path", { d, stroke: l.ok ? PORT_KINDS[l.kind].color : "#dc2626" })); };
  let drag = null;
  V.svg.addEventListener("pointerdown", (e) => { const n = e.target.closest && e.target.closest("[data-port]"); drag = n && st.open ? n.dataset.port : null; });
  V.svg.addEventListener("pointerup", (e) => { const n = e.target.closest && e.target.closest("[data-port]"); if (drag && n && n.dataset.port !== drag) { st.pick = drag; pickPort(n.dataset.port); } drag = null; });      // a drag from a pin to another : a cable
  V.svg.addEventListener("click", (e) => { if (st.mode === "run") { RUN().click(e.target); return; } const port = e.target.closest && e.target.closest("[data-port]"), c = e.target.closest && e.target.closest("[data-cable]"); if (port) pickPort(port.dataset.port); else if (c) selectLink(c.dataset.cable); });
  V.svg.addEventListener("keydown", (e) => { const port = e.target.closest && e.target.closest("[data-port]"); if (port && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); pickPort(port.dataset.port); } });
  let chosen = null; const selectLink = (id) => { chosen = id; drawRight(); const row = right.querySelector(`[data-cable-row="${CSS.escape(id)}"]`); if (row) row.scrollIntoView({ block: "nearest" }); };

  /* the table : each board as it is, its pins where its connectors are ; the lab supply above, corded to what it feeds */
  function drawTable(g) {
    const k = 3, gap = 40, at = new Map(); let x = 0, H = 0;
    for (const b of boards()) { const R = resolveBoard(b, LIBRARY), bb = R.bbox, w = (bb[2] - bb[0]) * k, h = (bb[3] - bb[1]) * k, y0 = 90, role = BOARD_ROLES[roleOf(b)];
      g.append(svg("rect", { x, y: y0, width: w, height: h, rx: 6, class: "lab-table-board", stroke: role.color }), svg("text", { x, y: y0 - 8, class: "lab-table-name" }, svg("title", null, b.name || b.id), b.id), svg("text", { x, y: y0 + h + 16, class: "lab-table-role", fill: role.color }, role.fr));
      for (const p of portsOf(b)) { const [ref, n] = p.pin.split("."), pad = (R.pads || []).find((q) => q.ref === ref && String(q.n) === n); const px = pad ? x + (pad.x - bb[0]) * k : x + w / 2, py = pad ? y0 + (bb[3] - pad.y) * k : y0 + h / 2; at.set(p.key, [px, py]); g.append(portDot(p, px, py, 3.2, null)); }
      x += w + gap; H = Math.max(H, y0 + h + 30); }
    for (const l of tableLinks(P())) { const a = at.get(l.a), b = at.get(l.b); if (a && b) g.prepend(cable(l, a, b, 60)); }
    benchFeeds(P()).forEach((f, i) => { const pic = gearPic({ kind: "supply", v: f.volts, ilim: null, on: true }, `Alimentation de laboratoire — ${f.port.net}`), px = i * 210, py = -80; for (const [k2, v] of Object.entries({ x: px, y: py, width: 190, height: 104 })) pic.setAttribute(k2, v); g.append(pic);
      const plus = at.get(f.port.key), minus = f.ground ? at.get(f.ground.key) : null, jack = (jx, jy) => [px + jx, py + jy];
      if (plus) g.append(cable({ id: `feed-${i}`, ok: true, kind: "power" }, jack(164, 78), plus, 30)); if (minus) g.append(cable({ id: `feed-${i}g`, ok: true, kind: "ground" }, jack(132, 78), minus, 30)); });
    return { w: Math.max(x - gap, 200), h: H + 90, y: -90 };
  }
  /* the schema : one column per board, its connector pins in rows, the cables between columns */
  function drawSchema(g) {
    const colW = 300, rowH = 20, at = new Map(); let H = 0;
    boards().forEach((b, i) => { const x = i * colW, ports = portsOf(b), role = BOARD_ROLES[roleOf(b)]; g.append(svg("text", { x, y: 0, class: "lab-table-name" }, `${b.id}`), svg("text", { x, y: 14, class: "lab-table-role", fill: role.color }, role.fr));
      let y = 34, last = null; for (const p of ports) { if (p.ref !== last) { g.append(svg("text", { x, y: y + 4, class: "lab-table-conn" }, p.debug ? `${p.ref} — programmation (${ports.filter((q) => q.ref === p.ref).length} broches, à la sonde de débogage)` : p.ref)); y += rowH; last = p.ref; }
        if (p.debug) continue;      // a programming header goes to the debug probe, never to another board : one line says it, its pins are not drawn
        const px = i % 2 ? x + 8 : x + 150; at.set(p.key, [px, y]); g.append(portDot(p, px, y, 5, `${p.pin.split(".")[1]} · ${p.net}${p.volts ? ` (${fr(p.volts)} V)` : ""}`)); y += rowH; }
      H = Math.max(H, y); });
    for (const l of tableLinks(P())) { const a = at.get(l.a), b = at.get(l.b); if (a && b) g.prepend(svg("g", { class: `lab-cable${l.on === false ? " off" : ""}${l.ok ? "" : " bad"}`, "data-cable": l.id }, svg("path", { d: `M${a[0]},${a[1]} C${(a[0] + b[0]) / 2},${a[1]} ${(a[0] + b[0]) / 2},${b[1]} ${b[0]},${b[1]}`, class: "halo" }), svg("path", { d: `M${a[0]},${a[1]} C${(a[0] + b[0]) / 2},${a[1]} ${(a[0] + b[0]) / 2},${b[1]} ${b[0]},${b[1]}`, stroke: l.ok ? PORT_KINDS[l.kind].color : "#dc2626" }))); }
    return { w: Math.max(boards().length * colW, 300), h: H + 20, y: -20 };
  }
  /* « En marche » : the two kinds of boards at work (modules/elab_system.js) — each frame redraws the drawing and the right pane only */
  let run = null; const RUN = () => (run = run || systemRun({ project: P, redraw: () => { if (st.mode === "run") paint(); }, refresh: () => draw() }));
  function paint() {
    V.svg.replaceChildren(); const g = svg("g"); V.svg.append(g);
    if (!boards().length) { V.setBox(400, 100); g.append(svg("text", { x: 0, y: 40, class: "lab-table-name" }, "La table est vide : posez une carte, à gauche.")); }
    else { const box = st.mode === "table" ? drawTable(g) : st.mode === "schema" ? drawSchema(g) : RUN().draw(g); g.setAttribute("transform", `translate(0 ${-box.y})`); V.setBox(box.w, box.h); }
    if (st.mode === "run") RUN().right(right);
  }
  function draw() {
    const lock = btn(st.open ? "Montage déverrouillé" : "Montage verrouillé", () => { st.open = !st.open; st.pick = null; draw(); }, { small: true, primary: st.open, icon: st.open ? "edit" : "lock", tip: st.open ? "Les câbles se changent à la souris : un clic sur une broche puis sur une autre, ou un glisser de l'une à l'autre ; chaque câble est vérifié. Cliquer pour verrouiller." : "Le montage est tenu : les câbles viennent des cartes et de l'IA. Déverrouiller pour les changer à la souris, en connaissance de cause.", cls: "lab-lock" }); lock.setAttribute("aria-pressed", st.open ? "true" : "false");
    bar.replaceChildren(lock, el("div", { class: "role-switch", role: "radiogroup", "aria-label": "Vue de la table" }, MODES.map(([k, l, ic]) => el("button", { type: "button", role: "radio", "aria-checked": st.mode === k ? "true" : "false", class: st.mode === k ? "on" : "", style: { "--g": "#0f766e" }, "data-mode": k, onClick: () => { st.mode = k; draw(); } }, icon(ic), el("span", null, l)))),
      ...(st.mode === "run" ? [...RUN().bar(), el("span", { class: "grow" }), el("span", { class: "chip", "data-tip": "La carte principale et les CORE boards tournent ensemble : l'alimentation de chacune lue de ses blocs, le round-robin et ses frames, le logiciel de la carte principale contre le module simulé. Ce qui ne l'est pas est dit dans la marge de droite." }, icon("info"), " Frames et fonctions HW simulées")] : [
      el("span", { class: "muted small grow" }, !st.open ? " Montage verrouillé : un clic sur une broche dit ce qu'elle porte." : st.pick ? ` Câble depuis ${st.pick} : cliquez la broche d'arrivée, sur une autre carte (Échap annule).` : " Un clic sur une broche, puis sur une broche d'une autre carte — ou un glisser de l'une à l'autre : un câble, vérifié avant d'être posé."),
      el("span", { class: "chip", "data-tip": "Dans les vues Table et Schéma, les cartes ne sont pas simulées ensemble : la table dit comment elles sont câblées, et le guide ce qui ne tient pas. « En marche » les fait tourner ensemble." }, icon("info"), " Câblage, pas simulation")]));
    if (st.mode !== "run" && run) run.stop();
    paint(); drawLeft(); if (st.mode !== "run") drawRight(); setGuide(tableIssues(P()).map((x) => ({ ...x, go: x.link ? () => selectLink(x.link) : null })));
  }
  function drawLeft() {
    const t = T(), others = store.boards.filter((b) => !t.boards.includes(b.id));
    left.replaceChildren(el("div", { class: "side-head" }, el("h2", null, "La table du labo")),
      el("div", { class: "side-actions" }, btn("Une carte", () => go("#/elab"), { small: true, icon: "chip", tip: "Revenir au Labo d'une carte : ses essais, ses appareils, ses oscilloscopes" }),
        btn("Exemple : trois cartes", example, { small: true, icon: "cloud", tip: "Deux nœuds RS-485 et la carte de contrôle du variateur : ils se relient d'office par leurs connecteurs" }), btn("Relier d'office", relinkAll, { small: true, icon: "link", tip: "Relier les cartes de la table dont les connecteurs portent les mêmes nets — ce qui est déjà posé reste" })));
    const sc = el("div", { class: "side-scroll" }); left.append(sc);
    sc.append(el("div", { class: "side-section", "data-fold-note": `${t.boards.length} carte(s)` }, el("h3", null, "Sur la table"),
      t.boards.length ? t.boards.map((id) => { const b = store.board(id), role = BOARD_ROLES[roleOf(b)]; return el("div", { class: "lab-table-row", style: { "--g": role.color } }, icon(role.icon), el("span", { class: "grow" }, el("b", null, id), el("small", null, ` ${b.name || ""}`)), btn("", () => store.commit(`Table du labo : ${id} retirée`, (p) => takeBoard(p, id)), { small: true, icon: "trash", tip: `Retirer ${id} de la table, avec ses câbles` })); }) : el("p", { class: "muted small" }, "Aucune carte."),
      others.length ? el("label", { class: "field" }, el("span", { class: "field-label" }, "Poser une carte"), el("select", { "data-put": "", onChange: (e) => { const id = e.target.value; if (!id) return; let added = []; store.commit(`Table du labo : ${id} posée`, (p) => { added = putBoard(p, id); }); toast(added.length ? `${id} posée : ${added.length} câble(s) posé(s) d'office — ses connecteurs portent les mêmes nets.` : `${id} posée : aucun connecteur ne correspond, câblez-la à la main.`, "success", 6000); } },
        el("option", { value: "" }, "Choisir…"), others.map((b) => el("option", { value: b.id }, `${b.id} — ${b.name || ""}`)))) : null));
    sc.append(el("div", { class: "side-section" }, el("h3", null, "Les couleurs"), Object.entries(PORT_KINDS).map(([k, K]) => el("p", { class: "lab-table-key small", style: { "--g": K.color } }, el("i"), ` ${K.fr}`))));
  }
  function drawRight() {
    const L = tableLinks(P()); right.replaceChildren(el("div", { class: "side-head" }, el("h2", null, `Les câbles (${L.length})`)));
    const sc = el("div", { class: "side-scroll" }); right.append(sc);
    for (const [kind, K] of Object.entries(PORT_KINDS)) { const mine = L.filter((l) => l.kind === kind); if (!mine.length) continue;
      sc.append(el("div", { class: "side-section", "data-fold-note": String(mine.length) }, el("h3", { style: { color: K.color } }, K.fr), mine.map((l) => el("div", { class: `lab-cable-row${l.id === chosen ? " sel" : ""}${l.ok ? "" : " bad"}${l.on === false ? " off" : ""}`, "data-cable-row": l.id, style: { "--g": K.color } },
        (() => { const sw = onOff(l.on !== false, (on) => { if (!st.open) { toast("Montage verrouillé : « Déverrouiller » pour changer un câble.", "info"); return; } store.commit(`Câble ${l.id} ${on ? "On" : "Off"}`, (p) => setLinkOn(p, l.id, on)); }, `Le câble ${l.id}`); sw.disabled = !st.open; return sw; })(),
        el("span", { class: "grow" }, el("b", null, `${l.id} `), `${l.a.replace(":", " ")} → ${l.b.replace(":", " ")}`, el("small", null, ` ${(l.A || {}).net || "?"} ↔ ${(l.B || {}).net || "?"}${l.auto ? " · posé d'office" : ""}`), l.ok ? null : el("small", { class: "bad" }, ` ${l.why}`)),
        btn("", () => store.commit(`Câble ${l.id} retiré`, (p) => removeLink(p, l.id)), { small: true, icon: "trash", tip: `Retirer le câble ${l.id}`, disabled: !st.open }))))); }
    if (!L.length) sc.append(el("p", { class: "muted small", style: { padding: "0 .8rem" } }, "Aucun câble : posez deux cartes dont les connecteurs s'accordent, ou câblez à la main."));
  }
  function example() {
    const want = [rs485Board(), { ...rs485Board(), id: "NODE-485-B", name: "Nœud de mesure RS-485 (deuxième)" }, demoBoard()];
    store.commit("Table du labo : exemple de trois cartes", (p) => { p.boards = p.boards || []; for (const b of want) { if (!p.boards.some((x) => x.id === b.id)) p.boards.push(b); putBoard(p, b.id); } });
    toast("Trois cartes posées et reliées d'office : les deux nœuds par leur bus RS-485 et leur 5 V, la carte de contrôle par son 5 V.", "success", 7000);
  }
  function relinkAll() { let n = 0; store.commit("Table du labo : reliées d'office", (p) => { const t = (p.labTable = tableOf(p)); for (let i = 0; i < t.boards.length; i++) for (let j = i + 1; j < t.boards.length; j++) for (const l of autoLinks(store.board(t.boards[i]), store.board(t.boards[j]))) if (!t.links.some((x) => (x.a === l.a && x.b === l.b) || (x.a === l.b && x.b === l.a))) { let c = t.links.length + 1; while (t.links.some((x) => x.id === `C${c}`)) c++; t.links.push({ id: `C${c}`, ...l }); n++; } }); toast(n ? `${n} câble(s) posé(s) d'office.` : "Rien de plus à relier d'office.", "info"); }
  const key = (e) => { if (e.key === "Escape" && st.pick) { st.pick = null; draw(); } };
  document.addEventListener("keydown", key);
  const off = store.on("change", () => draw());
  draw();
  return () => { off(); if (run) run.stop(); document.removeEventListener("keydown", key); V.destroy(); setGuide([]); };
}
