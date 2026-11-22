/* DynamiteOrbit — Écosystème : the whole product packed for an AI, with the request framed by the screen one comes from (point 9 b of the
   plan agreed with JP). Route : #/eco[/<artefact key>[/<screen>]] — the « IA » dialogue of every screen leads here with what it shows.
   The same three places as every studio. Left, what one gives : the artefact handed over (a list one can search), the interview — what one
   wants, what must not move, how one will know it worked, all fields the system's dictation can type in —, the kinds of link shown, what the
   package holds (each file opens to be read), the guide. Centre, what one looks at : the map of what depends on what (modules/eco_map.js).
   Right, what frames the work : the rules of the project — On / Off, a copy born Off, each change one undoable step — and the rules the tool
   checks, each with how far it was verified. The tool calls no AI : the package is a .zip one carries to an assistant ; the answer comes back
   by the « IA » button of a screen or the door « Avec l'IA » of the Shop. Every rule is in core/eco.js. */

import { el, clear, btn, toast, download, copyText, modal, field, onOff, badge } from "../core/dom.js";
import { store } from "../core/store.js";
import { registerModule, setGuide, app } from "../core/app.js";
import { guideBox } from "../core/guide.js";
import { toDwiz } from "../core/dwiz.js";
import { zip } from "../core/zip.js";
import { stampText } from "../core/brand.js";
import { pickList } from "../core/pick_list.js";
import { natureOf, NATURES } from "../core/shop_levels.js";
import { ecoMap, ecoImpact, ecoFiles, ecoFrame, ecoGuide, rulesOf, addRule, copyRule, setRule, removeRule, EDGE_KINDS, NODE_KINDS } from "../core/eco.js";
import { ecoMapView } from "./eco_map.js";

const memo = { ask: "", keep: "", done: "", questions: true, show: {} };      // the interview stays while one goes and comes back, for the visit
const HOW = { own: "choix de l'outil", typed: "saisie, à vérifier", read: "lue", project: "écrite par le projet", page: "page lue", usual: "usage" };
const kb = (n) => (n < 1024 ? `${n} o` : `${(n / 1024).toFixed(n < 10240 ? 1 : 0).replace(".", ",")} ko`);
const fileName = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "projet";

/** The artefacts one can hand over, grouped by kind — the parts by the way they are made. */
function targetGroups(p) {
  const g = [{ label: "Le projet", color: "#7c3aed", items: [{ id: "project", title: "Tout le projet", sub: p.name || "", icon: "report" }] }];
  if ((p.assemblies || []).length) g.push({ label: "Assemblages", color: NODE_KINDS.assembly.color, items: p.assemblies.map((a) => ({ id: `assembly:${a.id}`, title: a.id, sub: a.name || "", icon: "assembly" })) });
  for (const n of NATURES) { const l = (p.parts || []).filter((x) => natureOf(x).key === n.key); if (l.length) g.push({ label: `Pièces — ${n.label}`, color: n.color, items: l.map((x) => ({ id: `part:${x.id}`, title: x.id, sub: x.name || "", icon: n.icon })) }); }
  if ((p.boards || []).length) g.push({ label: "Cartes (PCBA)", color: NODE_KINDS.board.color, items: p.boards.map((b) => ({ id: `board:${b.id}`, title: b.id, sub: b.name || "", icon: "chip" })) });
  return g;
}
const labelOf = (p, key) => { const [k, ...r] = key.split(":"), id = r.join(":"); if (key === "project") return `tout le projet « ${p.name || "sans nom"} »`;
  const d = ((p[{ part: "parts", assembly: "assemblies", board: "boards" }[k]]) || []).find((x) => x.id === id); return `${{ part: "la pièce", assembly: "l'assemblage", board: "la carte" }[k] || k} « ${d ? d.name || d.id : id} »`; };

function render(main, args) {
  clear(main);
  const left = el("aside", { class: "side" }), view = el("div", { class: "viewport eco-view" }), right = el("aside", { class: "side right" });
  main.append(el("div", { class: "studio" }, left, view, right));
  const host = el("div", { class: "eco-host" }); view.append(host);
  const valid = (k) => { const p = store.project; if (!p || k === "project") return "project"; const [kind, ...r] = String(k || "").split(":"), L = { part: "parts", assembly: "assemblies", board: "boards" }[kind]; return L && (p[L] || []).some((x) => x.id === r.join(":")) ? k : "project"; };
  const st = { target: valid(args[0]), from: args[1] || "", rulebook: [], language: "" };
  const mapView = ecoMapView(host, { onPick: (key) => { if (/^(part|assembly|board):/.test(key)) choose(key); } });
  const choose = (key) => { st.target = valid(key); try { history.replaceState(null, "", `#/eco/${encodeURIComponent(st.target)}${st.from ? `/${encodeURIComponent(st.from)}` : ""}`); } catch (e) { /* a page without history */ } draw(); };
  const screen = () => { const m = st.from && app.modules.get(st.from); return m ? m.label : { part: "Pièces", assembly: "Assemblage", board: "PCBA", project: "Projet" }[st.target.split(":")[0]] || "Projet"; };
  const files = () => ecoFiles(store.project, { target: { key: st.target, label: labelOf(store.project, st.target) }, screen: screen(), ask: memo.ask, keep: memo.keep, done: memo.done, questions: memo.questions, rulebook: st.rulebook, language: st.language, toDwiz });
  function pack() {
    const p = store.project, f = files();
    download(`${fileName(p.name || p.id)}_ecosysteme_pour_IA.zip`, new Blob([zip(f.map((x) => ({ name: x.name, bytes: stampText(x.name, x.text) })))], { type: "application/zip" }), "application/zip");
    toast(`Paquet téléchargé : ${f.length} fichiers. Donnez-le à votre assistant avec la consigne ; rapportez sa réponse par le bouton « IA » de l'écran ou la porte « Avec l'IA » de l'Atelier.`, "success", 8000);
  }
  const rule = (label, fn) => store.commit(`Cadre : ${label}`, fn);

  function drawLeft(p, map) {
    clear(left);
    left.append(el("div", { class: "side-head" }, el("h2", null, "Écosystème")),
      el("div", { class: "side-actions" }, el("div", { class: "side-actions-row" }, btn("Paquet pour l'IA (.zip)", pack, { primary: true, icon: "download", tip: "Tout le produit, ce qui dépend de quoi, les vérifications, le cadre et la consigne" }),
        btn("Consigne", async () => toast((await copyText(files()[0].text)) ? "Consigne copiée : collez-la dans votre assistant, avec le paquet." : "Copie impossible : ouvrez consigne.md dans la liste du paquet.", "success", 5000), { icon: "copy", tip: "Copier la consigne seule" }))));
    const body = el("div", { class: "side-scroll" }); left.append(body);
    const impact = st.target === "project" ? [] : ecoImpact(map, st.target);
    body.append(el("div", { class: "side-section", "data-fold-note": st.target }, el("h3", null, "Ce que l'on confie"),
      pickList({ label: "L'artéfact confié à l'IA", value: st.target, groups: targetGroups(p), onPick: (id) => choose(id) }),
      el("p", { class: "small" }, `Demande faite depuis l'écran « ${screen()} ». `, impact.length ? `${impact.length} artéfact${impact.length > 1 ? "s dépendent" : " dépend"} de ce qui est confié : la carte les entoure, la consigne les nomme.` : "Rien n'en dépend, ou c'est tout le projet.")));
    const area = (key, label, ph) => field(label, el("textarea", { rows: "2", placeholder: ph, [`data-eco-${key}`]: "", onInput: (e) => { memo[key] = e.target.value; } }, memo[key]));
    body.append(el("div", { class: "side-section", "data-fold-note": memo.ask.trim() ? "écrite" : "à écrire" }, el("h3", null, "L'entrevue"),
      el("p", { class: "muted small" }, "Comme on confierait une tâche à un technicien. La dictée du système tape dans ces champs ; l'outil n'appelle aucune IA."),
      area("ask", "Ce que je veux", "« alléger la base de 10 % », « passer la carte à 2 A »…"), area("keep", "Ce qui ne doit pas bouger", "« les quatre trous de fixation », « le connecteur J2 »…"),
      area("done", "Comment je saurai que c'est réussi", "« la masse baisse, le DFx reste vert, les accouplements tiennent »…"),
      el("label", { class: "check" }, el("input", { type: "checkbox", checked: memo.questions, "data-eco-questions": "", onChange: (e) => { memo.questions = e.target.checked; } }), " « Pose-moi tes questions d'abord, une à la fois »")));
    body.append(el("div", { class: "side-section", "data-fold-note": `${map.edges.length} liens` }, el("h3", null, "Les liens"),
      el("ul", { class: "eco-legend" }, Object.entries(EDGE_KINDS).map(([k, e]) => { const n = map.edges.filter((x) => x.kind === k).length; return n ? el("li", null, onOff(memo.show[k] !== false, (on) => { memo.show[k] = on; draw(); }, `Liens « ${e.fr} »`), el("i", { style: `background:${e.color}` }), el("b", null, e.fr), ` ${n} — `, el("span", { class: "muted" }, e.why)) : null; }))));
    const F = files(), total = F.reduce((s, f) => s + f.text.length, 0);
    body.append(el("div", { class: "side-section", "data-fold-note": `${F.length} fichiers · ${kb(total)}` }, el("h3", null, "Ce que contient le paquet"),
      el("ul", { class: "eco-files" }, F.map((f) => el("li", null, el("button", { type: "button", class: "linklike", "data-eco-file": f.name, onClick: () => modal(f.name, el("pre", { class: "eco-pre" }, f.text), { wide: true }) }, f.name), el("span", { class: "muted small" }, ` ${kb(f.text.length)}`)))),
      el("p", { class: "muted small" }, "Sans l'historique ; une pièce importée en STEP part avec une marque à la place de sa géométrie. Chaque fichier porte la note de la plateforme.")));
    const g = ecoGuide(p, { key: st.target }); body.append(el("div", { class: "side-section", "data-fold-note": g.length ? `${g.length}` : "rien" }, el("h3", null, "À régler — le guide"), guideBox(g)));
  }
  function drawRight(p) {
    clear(right);
    right.append(el("div", { class: "side-head" }, el("h2", null, "Le cadre")));
    const body = el("div", { class: "side-scroll" }); right.append(body);
    const R = rulesOf(p), input = el("input", { type: "text", placeholder: "Une règle du projet, en une phrase", "data-eco-new": "", maxlength: "400", onKeydown: (e) => { if (e.key === "Enter" && e.target.value.trim()) { const t = e.target.value; rule("règle ajoutée", (x) => addRule(x, t)); } } });
    body.append(el("div", { class: "side-section", "data-fold-note": `${R.filter((r) => r.on !== false).length} sur ${R.length}` }, el("h3", null, "Règles du projet"),
      el("p", { class: "muted small" }, "Ce que le projet impose, et que l'outil ne sait pas vérifier. Une règle à Off est gardée mais ne part pas ; une copie naît à Off, pour comparer."),
      el("ul", { class: "eco-rules" }, R.map((r) => el("li", { class: r.on === false ? "off" : "" }, onOff(r.on !== false, (on) => rule(`${r.id} ${on ? "On" : "Off"}`, (x) => setRule(x, r.id, { on })), r.id),
        el("input", { type: "text", value: r.text, "data-eco-rule": r.id, maxlength: "400", "aria-label": `Règle ${r.id}`, onChange: (e) => rule(`${r.id} réécrite`, (x) => setRule(x, r.id, { text: e.target.value })) }),
        btn("", () => rule(`${r.id} copiée`, (x) => copyRule(x, r.id)), { small: true, icon: "copy", tip: "Copier — la copie naît à Off" }), btn("", () => rule(`${r.id} retirée`, (x) => removeRule(x, r.id)), { small: true, icon: "trash", tip: "Retirer la règle" })))),
      el("div", { class: "eco-add" }, input, btn("Ajouter", () => { if (input.value.trim()) { const t = input.value; rule("règle ajoutée", (x) => addRule(x, t)); } }, { small: true, icon: "plus" }))));
    const frame = ecoFrame(p, st.rulebook).filter((s) => s.id !== "project");
    body.append(el("div", { class: "side-section", "data-fold-note": `${frame.length} groupes` }, el("h3", null, "Ce que l'outil vérifie"),
      el("p", { class: "muted small" }, "Les règles qui partent dans cadre.md : le DFx des procédés que le produit emploie, les interfaces, l'isolation, les unités, les jalons MVP — chacune avec son niveau de vérification."),
      ...frame.map((s) => el("details", { class: "eco-frame" }, el("summary", null, el("b", null, s.title), " ", badge(HOW[s.how] || s.how || "—", s.how === "read" ? "ok" : s.how === "typed" ? "warn" : "neutral"), el("span", { class: "muted small" }, ` ${s.lines.length}`)),
        el("ul", null, s.lines.map((l) => el("li", null, l)))))));
  }
  function draw() {
    const p = store.project; if (!p) return;
    const map = ecoMap(p);
    mapView.draw(map, st.target, memo.show); drawLeft(p, map); drawRight(p);
    setGuide(ecoGuide(p, { key: st.target }));
  }
  const off = store.on("change", (e) => { if (!e || !e.history) draw(); });
  draw();
  /* the rules of the tool and the language of a part are loaded once, then the package carries them */
  Promise.all([import("../analysis/dfx_api.js").then((m) => m.rulebook()).catch(() => []), import("../cad/language_doc.js").then((m) => m.LANGUAGE_REFERENCE).catch(() => "")])
    .then(([book, lang]) => { st.rulebook = book || []; st.language = lang || ""; if (main.isConnected) draw(); });
  return () => { off(); mapView.destroy(); };
}

registerModule({ key: "eco", label: "Écosystème", icon: "branch", tip: "Tout le produit pour une IA : ce qui dépend de quoi, les vérifications, le cadre, la demande", render });
