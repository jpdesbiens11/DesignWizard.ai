/* DesignWizard.ai — Atelier, the door « Avec l'IA » (`#/shop/ai`) : one sentence, the instruction the tool proposes, the answer
   brought back as a file — and, before anything enters the project, what would be created, what would be changed, what is
   set aside, and where each thing goes (core/ai_door.js). One click applies the plan as ONE undoable step ; the journal goes
   back to before an answer. The tool calls no AI : the person carries the instruction, and brings the answer back. */

import { el, icon, btn, toast, copyText, download, onOff } from "../core/dom.js";
import { store } from "../core/store.js";
import { setGuide } from "../core/app.js";
import { toDwiz } from "../core/dwiz.js";
import { zip } from "../core/zip.js";
import { unzipTexts } from "../core/unzip.js";
import { stampText } from "../core/brand.js";
import { dwizFileName } from "../core/dwiz_names.js";
import { SCOPES, doorPrompt, readAnswer, planAnswer, planWords, planApplies, applyPlan } from "../core/ai_door.js";
import { journalBox } from "./ai_journal.js";
import { planDisturbs, acceptRows } from "../core/ai_disturb.js";
import { disturbBox } from "./ai_disturb_ui.js";
import { partHash, asmHash } from "../core/shop_levels.js";
import { withoutHistory } from "../core/history.js";

const st = { ask: "", scope: "assembly", context: true, questions: true, pasted: "", files: [], rows: null, errors: [], skipped: [], done: null };
const MARK = { create: "+", modify: "~", same: "=", skip: "!" }, COLOR = { create: null, modify: "#0f766e", same: "#64748b", skip: "#b91c1c" };
/** What the page lacks, for the guide. Pure. */
export function doorIssues(s) {
  const out = [];
  if (!String(s.ask || "").trim()) out.push({ level: "todo", text: "Dites en une phrase ce que vous voulez : la consigne se construit autour.", field: "ask" });
  if (s.rows && s.rows.some((r) => r.off)) out.push({ level: "tip", text: `${s.rows.filter((r) => r.off).length} artéfact(s) refusé(s) : ${s.rows.some((r) => r.offBy) ? "ce qui en dépend l'est aussi, et c'est dit sur sa ligne ; " : ""}le reste sera appliqué.`, field: "plan" });
  if (s.rows && s.dist && [...s.dist.entries()].some(([k, L]) => L.some((x) => x.level === "break") && s.rows.some((r) => `${r.kind}:${r.id}` === k && !r.off))) out.push({ level: "warn", text: "Une modification acceptée rompt quelque chose ailleurs dans le produit : c'est dit sous sa ligne — refusez-la, ou appliquez-la et réparez ensuite.", field: "plan" });
  if (s.rows && s.rows.some((r) => r.action === "skip")) out.push({ level: "check", text: "Une partie de la réponse est écartée : la raison est dite sur sa ligne. Le reste peut être appliqué.", field: "plan" });
  if (s.errors && s.errors.length) out.push({ level: "error", text: `Réponse illisible — ${s.errors.map((e) => `${e.from} : ${e.message}`).join(" ; ")}`, field: "answer" });
  if (!s.rows && !(s.errors || []).length) out.push({ level: "tip", text: "Rapportez la réponse de l'IA — un fichier .dwiz, .json ou .zip, ou le texte collé : rien n'entre dans le projet avant votre accord.", field: "answer" });
  return out;
}

export function aiDoor(main) {
  const p = store.project, page = el("div", { class: "page ai-door" });
  main.append(page);
  page.append(el("div", { class: "page-head" }, el("div", { class: "grow" }, el("h1", null, "Créer avec l'IA"),
    el("p", { class: "muted" }, "Vous dites ce que vous voulez ; l'outil écrit la consigne ; l'IA pose ses questions puis rend un fichier ; vous voyez ce qui sera créé, et où, avant d'accepter. L'outil n'appelle aucune IA : c'est vous qui portez la consigne, et qui rapportez la réponse."))));
  const c1 = el("section", { class: "card" }), c2 = el("section", { class: "card" }), c3 = el("section", { class: "card" }), log = journalBox(), drawLog = () => log.draw();
  page.append(el("div", { class: "ai-grid" }, c1, c2, c3), log, el("p", { class: "muted small" }, "Une seule pièce, interface par interface, avec ses voisines cochées ? ", el("a", { href: "#/interfaces" }, "L'entrevue d'une pièce"), " reste là. Une pièce déjà dans le projet se confie à l'IA par le bouton « IA » de son écran."));
  const prompt = () => doorPrompt(store.project, st), advise = () => setGuide(doorIssues(st).map((x) => ({ ...x, go: () => { const n = page.querySelector(`[data-door="${x.field}"]`); if (n) n.scrollIntoView({ block: "center", behavior: "smooth" }); } })));

  /* 1 — one sentence */
  function draw1() {
    const ta = el("textarea", { rows: 4, class: "ai-ask" + (st.ask.trim() ? "" : " need"), "data-door": "ask", "aria-label": "Ce que vous voulez, en une phrase", placeholder: "Ex. : un boîtier moulé pour l'onduleur, monté par une bride sur le moteur, avec un couvercle en tôle et ses busbars.", onInput: (e) => { st.ask = e.target.value; e.target.classList.toggle("need", !st.ask.trim()); draw2(); advise(); } }); ta.value = st.ask;
    const check = (key, label, tip) => el("label", { class: "check", "data-tip": tip }, el("input", { type: "checkbox", checked: st[key], onChange: (e) => { st[key] = e.target.checked; draw2(); } }), label);
    c1.replaceChildren(el("h2", null, el("span", { class: "step-no" }, "1"), "Dites-le en une phrase"), ta,
      el("p", { class: "ai-label" }, "Ce que l'IA doit rendre"), el("div", { class: "seg ai-seg", role: "group", "aria-label": "Ce que l'IA doit rendre" }, SCOPES.map((s) => el("button", { type: "button", class: st.scope === s.key ? "on" : "", "aria-pressed": st.scope === s.key ? "true" : "false", onClick: () => { st.scope = s.key; draw1(); draw2(); } }, s.label))),
      el("p", { class: "ai-label" }, "Ce qu'elle reçoit"), check("context", `Les ${p.parts.length} pièce${p.parts.length > 1 ? "s" : ""} du projet et leurs interfaces libres`, "Pour que ce qui naît se raccorde à ce qui existe : même type, même clé, mêmes cotes d'interface"),
      check("questions", "« Pose-moi tes questions d'abord »", "L'IA mène l'entrevue, une question à la fois, avant de rendre quoi que ce soit"));
  }
  /* 2 — the instruction proposed */
  function draw2() {
    const text = prompt(), lines = text.split("\n"), cut = lines.findIndex((l) => l.startsWith("LANGAGE D'UNE PIÈCE")), head = (cut > 0 ? lines.slice(0, cut) : lines.slice(0, 24)).join("\n").trim();
    const folder = () => { const files = [{ name: "consigne.md", bytes: stampText("consigne.md", text) }, { name: dwizFileName(p), bytes: stampText(dwizFileName(p), toDwiz(withoutHistory(p))) }];
      download(`${(p.name || "projet").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "projet"}_pour_IA.zip`, new Blob([zip(files)], { type: "application/zip" }), "application/zip"); toast("Dossier téléchargé : la consigne et le projet (.dwiz). Donnez les deux à l'IA.", "success", 5000); };
    c2.replaceChildren(el("h2", null, el("span", { class: "step-no" }, "2"), "La consigne proposée", el("small", { class: "floor-sub" }, "à donner à votre assistant")),
      el("pre", { class: "ai-prompt", tabindex: "0", "aria-label": "La consigne proposée" }, head, el("span", { class: "muted" }, `\n\n… puis le langage d'une pièce (${lines.length - (cut > 0 ? cut : 24)} lignes), joint à la consigne.`)),
      el("div", { class: "form-actions", style: { justifyContent: "flex-start", flexWrap: "wrap" } },
        btn("Copier la consigne", async () => toast((await copyText(text)) ? "Consigne copiée : collez-la dans votre assistant, puis répondez à ses questions." : "Copie impossible : sélectionnez le texte à la main.", "success", 5000), { primary: true, icon: "copy", disabled: !st.ask.trim(), tip: st.ask.trim() ? "Toute la consigne, le langage d'une pièce compris" : "Dites d'abord ce que vous voulez, à gauche" }),
        btn("Le dossier (.zip)", folder, { icon: "download", disabled: !st.ask.trim(), tip: "La consigne et le projet entier (.dwiz), pour un assistant à qui l'on donne des fichiers" })));
  }
  /* 3 — the answer, and what it would do */
  const take = (texts, skipped = []) => { const r = readAnswer(texts); st.done = null; st.errors = r.errors; st.skipped = skipped; st.rows = r.docs.length ? planAnswer(store.project, r.docs) : null; st.dist = st.rows ? planDisturbs(store.project, st.rows) : null; draw3(); advise(); };      // what each modified artefact disturbs elsewhere (core/ai_disturb.js)
  /* accepted artefact by artefact : a refusal takes with it what needs the refused creation ; taking one back gives back what it had taken */
  const accept = (r, on) => { st.rows = acceptRows(st.rows.map((x) => (x === r ? { ...x, off: !on, offBy: undefined } : x.offBy ? { ...x, off: false, offBy: undefined } : x))); draw3(); advise(); };
  async function read(files) {
    const texts = [], skipped = [];
    for (const f of files) {
      try { if (/\.zip$/i.test(f.name)) { const z = await unzipTexts(new Uint8Array(await f.arrayBuffer())); texts.push(...z.texts); skipped.push(...z.skipped); } else texts.push({ name: f.name, text: await f.text() }); }
      catch (e) { skipped.push({ name: f.name, why: e.message }); }
    }
    st.files = [...files].map((f) => f.name); take(texts, skipped);
  }
  function apply() {
    const rows = st.rows.filter((r) => !r.off), n = rows.filter((r) => r.action === "create" || r.action === "modify").length; let entry = null;      // only what is accepted is applied
    store.commit(`Réponse d'IA appliquée : ${planWords(rows)}`, (x) => { entry = applyPlan(x, rows, { ask: st.ask }); });
    toast(`${n} artéfact${n > 1 ? "s" : ""} appliqué${n > 1 ? "s" : ""} — une seule étape : Ctrl + Z, ou le journal ci-dessous, revient à avant.`, "success", 6000);
    /* one stays here : opening a new assembly mates it at once, which would put steps between the answer and its undo */
    st.done = [...entry.created.map((c) => ({ ...c, what: "créé" })), ...entry.modified.map((m) => ({ kind: m.kind, id: m.id, what: "modifié" }))];
    st.rows = null; st.files = []; st.pasted = ""; st.errors = []; st.skipped = []; draw3(); drawLog(); advise();
  }
  const doneBox = () => el("div", { class: "ai-done", "data-door": "done" }, el("b", null, icon("check"), `Appliqué — ${st.done.length} artéfact${st.done.length > 1 ? "s" : ""}. Ouvrez-les pour les relire :`),
    st.done.map((d) => { if (d.kind === "sheet") return el("a", { class: "ai-open", href: "#/drawings" }, icon("drawing"), "Cartouche des dessins", el("small", null, `projet · ${d.what}`));
      if (d.kind === "board") { const b = store.board(d.id); return b ? el("a", { class: "ai-open", href: `#/pcba/${encodeURIComponent(b.id)}` }, icon("chip"), b.name || b.id, el("small", null, `${d.id} · ${d.what}`)) : null; }
      const doc = d.kind === "assembly" ? store.assembly(d.id) : store.part(d.id); return doc ? el("a", { class: "ai-open", href: d.kind === "assembly" ? asmHash(doc) : partHash(doc) }, icon(d.kind === "assembly" ? "assembly" : "part"), doc.name || doc.id, el("small", null, `${d.id} · ${d.what}`)) : null; }),
    el("small", { class: "muted" }, "Ctrl + Z défait toute la réponse tant que rien d'autre n'a changé ; le journal, plus bas, y revient même après."));
  function draw3() {
    const input = el("input", { type: "file", multiple: true, accept: ".dwiz,.json,.zip,.txt,.md", hidden: true, onChange: (e) => { if (e.target.files.length) read(e.target.files); } });
    const drop = el("button", { class: "ai-drop", type: "button", "data-door": "answer", onClick: () => input.click(),
      onDragover: (e) => { e.preventDefault(); drop.classList.add("over"); }, onDragleave: () => drop.classList.remove("over"), onDrop: (e) => { e.preventDefault(); e.stopPropagation(); drop.classList.remove("over"); if (e.dataTransfer.files.length) read(e.dataTransfer.files); } },
      icon("upload"), st.files.length ? el("b", null, st.files.join(", ")) : el("b", null, "Déposez la réponse ici, ou cliquez pour la choisir"), el("small", null, ".dwiz · .json · .zip — plusieurs fichiers à la fois"));
    const paste = el("textarea", { rows: 3, class: "ai-paste", "aria-label": "Ou collez la réponse de l'IA", placeholder: "… ou collez ici la réponse de l'IA, puis « Lire »." }); paste.value = st.pasted; paste.addEventListener("input", () => { st.pasted = paste.value; });
    const kids = [el("h2", null, el("span", { class: "step-no" }, "3"), "Rapportez la réponse", el("small", { class: "floor-sub" }, "rien n'entre avant votre accord")), input, drop,
      el("div", { class: "ai-paste-row" }, paste, btn("Lire", () => { st.files = []; take([{ name: "texte collé", text: st.pasted }]); }, { small: true, icon: "play", tip: "Lire le texte collé : l'aperçu de ce qui serait créé apparaît dessous" }))];
    if (st.done && !st.rows) kids.push(doneBox());
    for (const e of st.errors) kids.push(el("p", { class: "form-error" }, `${e.from} : ${e.message}`));
    for (const s of st.skipped) kids.push(el("p", { class: "muted small" }, `Laissé de côté — ${s.name} : ${s.why}.`));
    if (st.rows) {
      const kept = st.rows.filter((r) => !r.off), nOff = st.rows.length - kept.length, can = (r) => r.action === "create" || r.action === "modify";
      kids.push(el("p", { class: "ai-label", "data-door": "plan" }, `Ce que la réponse ferait — ${planWords(kept)}${nOff ? ` · ${nOff} refusé${nOff > 1 ? "s" : ""}` : ""}`),
        ...st.rows.map((r) => { const D = st.dist ? st.dist.get(`${r.kind}:${r.id}`) || [] : [];
          return el("div", { class: `ai-art ${r.action}${r.off ? " off" : ""}`, style: { "--g": COLOR[r.action] || (r.nature ? r.nature.color : "#475569") }, "data-art": r.id },
            can(r) ? onOff(!r.off, (on) => accept(r, on), r.name, r.off ? (r.offBy ? `Refusé avec ${r.offBy}, dont il dépend — remettez ${r.offBy} pour le reprendre` : "Refusé : il ne sera pas appliqué — cliquer pour l'accepter") : "Accepté : il sera appliqué — cliquer pour le refuser") : el("span", { class: "s", "aria-hidden": "true" }, MARK[r.action]),
            el("span", { class: "n" }, icon(r.kind === "assembly" ? "assembly" : r.kind === "board" ? "chip" : r.kind === "drawing" ? "drawing" : r.nature ? r.nature.icon : "part"), r.name, el("small", null, r.id)), el("span", { class: "w" }, r.where),
            el("small", { class: "d" }, r.action === "skip" ? `Écarté${r.kind === "assembly" ? "" : "e"} — ${r.why}` : r.off ? (r.offBy ? `Refusé avec ${r.offBy}, dont il dépend.` : "Refusé : le projet garde ce qu'il a.") : r.detail),
            r.action === "modify" && !r.off ? disturbBox(D, { compact: true, links: true, project: store.project }) : null); }),
        el("div", { class: "form-actions ai-apply" }, btn("Tout refuser", () => { st.rows = null; st.dist = null; st.files = []; st.errors = []; st.skipped = []; draw3(); advise(); }, { tip: "Ne rien appliquer : le projet reste tel qu'il est" }),
          el("span", { class: "grow" }), btn("Appliquer — une étape annulable", apply, { primary: true, icon: "check", disabled: !planApplies(kept), tip: planApplies(kept) ? "Créer et modifier ce que l'aperçu accepte, d'un seul coup" : "Rien d'accepté à appliquer" })));
    }
    c3.replaceChildren(...kids);
  }
  draw1(); draw2(); draw3(); drawLog(); advise();
  const off = store.on("change", (c) => { if (!document.body.contains(page)) return; if (c && c.undo && st.done) { st.done = null; draw3(); } drawLog(); });      // an undo takes the answer back : its summary goes too
  return () => off();
}
