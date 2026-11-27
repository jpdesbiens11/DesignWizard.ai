/* DynamiteOrbit.ai — 1 Exigences of each discipline : Mécanique (#/mreq), Électronique (#/ereq) and Logiciel (#/lreq) (demande de JP, 25 novembre
   2026 : « le même genre de page Exigences 1. dans Mécanique et Électronique… faire concevoir l'IA basé sur les requis de DynamiteAgile » ; 27 novembre :
   « une section requis à chacune des branches, mécanique, hardware puis logiciel… la même base des trois métiers, qui vient directement de la
   structure de DynamiteAgile… je vais loader en mode brouillon au début ; après, des itérations dans DynamiteAgile ; une fois terminés, on les
   exporte, on les ramène pour vraiment faire la structure du produit »).
   ONE list for the product (core/reqs.js), read from the export of DynamiteAgile, seen by each discipline : what a page changes, the two others see.
   Centre, on top : where the list stands — 1 the draft here, 2 its iterations in DynamiteAgile, 3 the final version on which the product is built —,
   then the needs (the why) and the requirements of this discipline grouped by category — key, criticality, statement, proof, status (dashed while a
   draft), TBD, the disciplines that carry it (M · E · L). Left : the examples (the ESS, a draft ; the Rover), « Concevoir avec l'IA » (« Ébauche »
   while a draft), the whole list back to DynamiteAgile, its export read again (a preview of what it changes, then one undoable step : modules/
   reqs_merge_ui.js), the trail of the readings, the categories, the guide ; for the software, the requirements of the product taken into the V
   (modules/sw_lib_ui.js openImport, a preview again). Right : the requirement chosen, every column of DynamiteAgile, the needs it derives from.
   What it follows : a requirements register (ISO/IEC/IEEE 29148 : a « shall » sentence, a verification method, a trace to the need) ; the
   allocation of requirements to subsystems of systems engineering ; the Requirement Workflow of Goldmine (DynamiteAgile) for the maturity. */

import { el, clear, btn, toast, icon, download, copyText } from "../core/dom.js";
import { store } from "../core/store.js";
import { registerModule, setGuide, go } from "../core/app.js";
import { guideBox } from "../core/guide.js";
import { DISCIPLINES, categoryOf, VERIFY, CRIT, COLUMN_FR, STAGES, readAgile, makeReqs, mergeReqs, forDiscipline, parentsOf, keyOf, isNeed, toAgileCsv, reqsGuide, designPrompt, allocText, stageOf, maturityOf, hasTbd } from "../core/reqs.js";
import { essList, ESS_FILE } from "../demo/demo_ess_reqs.js";
import { openMerge } from "./reqs_merge_ui.js";
import { openImport } from "./sw_lib_ui.js";
import { oracleLine, oracleSection } from "./reqs_oracle_ui.js";
import { oracleGuide } from "../core/req_oracle.js";
import { leanHead } from "./sw_lean_ui.js";

const ROVER = "examples/exemple_exigences_rover.csv";
const slug = (s) => String(s || "produit").normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "").toLowerCase() || "produit";
const day = (iso) => (iso ? new Date(iso).toLocaleDateString("fr-CA", { day: "numeric", month: "short" }) : "");
/* the three moves of a list, as a strip : where the list is lights up */
const PATH = [
  { k: "draft", n: 1, icon: "edit", t: "Brouillon ici", s: "La liste se lit, chaque métier y voit les siennes ; on l'éprouve, avec l'IA s'il le faut." },
  { k: "agile", n: 2, icon: "refresh", t: "Itérations dans DynamiteAgile", s: "« Vers DynamiteAgile », Goldmine → Importer ; revue avec le client, jusqu'à « Accepted »." },
  { k: "final", n: 3, icon: "check", t: "Version finale", s: "Exportée de Goldmine, relue ici : la structure du produit se bâtit sur elle." },
];
const swDesign = () => (store.project && (store.project.software || [])[0]) || null;

function page(disc) {
  const D = DISCIPLINES.find((x) => x.id === disc);
  return function render(main) {
    clear(main);
    const left = el("aside", { class: "side" }), view = el("div", { class: "viewport rq-view" }), right = el("aside", { class: "side right" });
    main.append(el("div", { class: "studio rq-studio", style: `--disc:${D.color}` }, left, view, right));
    const st = { sel: null, cat: null }, R = () => (store.project && store.project.reqs) || null, now = () => new Date().toISOString();
    const said = (L) => `${L.rows.filter(isNeed).length} besoins, ${L.rows.filter((x) => !isNeed(x)).length} exigences — ${STAGES[stageOf(L).stage].fr.toLowerCase()}`;
    /* a first list is taken as it is ; a list read again goes through the preview of what it changes */
    const take = (list, file) => {
      if (!store.project) { toast("Ouvrez d'abord un projet.", "info"); return; }
      const old = R();
      if (!old) { store.commit(`Exigences : ${file || "liste"} lue`, (p) => { p.reqs = makeReqs(list, file, now()); }); toast(`Liste lue, au format de DynamiteAgile : ${said(R())}.`, "success", 5000); return; }
      openMerge(old, list, file, () => { store.commit(`Exigences : ${file || "liste"} relue (lecture ${(old.loads || []).length + 1})`, (p) => { p.reqs = mergeReqs(p.reqs, list, file, now()).R; }); toast(`Relu : ${said(R())}.`, "success", 5000); });
    };
    const readText = (text, file) => { const r = readAgile(text); if (!r.ok) { toast(r.errors.join(" "), "error", 6000); return; } take(r.list, file); };
    const pick = el("input", { type: "file", accept: ".csv,text/csv", hidden: true, onChange: async (e) => { const f = e.target.files[0]; if (f) readText(await f.text(), f.name); e.target.value = ""; } });
    const setAlloc = (k, fn, label) => store.commit(`Exigences : ${label}`, (p) => { const a = p.reqs.alloc[k] || (p.reqs.alloc[k] = {}); fn(a); a.sure = true; });
    const ess = () => take(essList(), ESS_FILE);
    const rover = async () => { try { readText(await (await fetch(ROVER)).text(), "exemple_exigences_rover.csv"); } catch (e) { toast("L'exemple n'a pas pu être lu.", "error"); } };

    function card(r, L) {
      const k = keyOf(r), a = L.alloc[k] || {}, C = categoryOf(r.category), V = VERIFY[r.verification_method], need = isNeed(r), M = maturityOf(r);
      const chips = need ? null : el("div", { class: `rq-alloc${a.sure ? "" : " guess"}`, "data-rq-alloc": k, title: a.sure ? "Les disciplines qui portent l'exigence" : "Proposé par l'outil d'après les mots : à confirmer" },
        DISCIPLINES.map((d) => el("button", { type: "button", class: `rq-chip${a[d.id] ? " on" : ""}`, style: `--c:${d.color}`, "aria-pressed": a[d.id] ? "true" : "false", "data-rq-disc": d.id, title: `${d.fr} (${d.label})`,
          onClick: (e) => { e.stopPropagation(); setAlloc(k, (x) => { x[d.id] = !x[d.id]; }, `${k} : allocation ${d.short} (${d.fr}) ${a[d.id] ? "retirée" : "ajoutée"}`); } }, d.short)),
        a.sure ? null : btn("Confirmer", () => setAlloc(k, () => {}, `${k} : allocation confirmée`), { small: true, tip: "L'allocation proposée est la bonne" }));
      return el("article", { class: `rq-card${need ? " need" : ""}${st.sel === k ? " sel" : ""}`, style: `--cat:${C.color}`, "data-rq": k, tabindex: 0, role: "button", onClick: () => { st.sel = k; draw(); }, onKeydown: (e) => { if (e.key === "Enter") { st.sel = k; draw(); } } },
        el("header", null, el("b", { class: "rq-key" }, k), r.external_id && r.external_id !== k ? el("small", null, r.external_id) : null, r.criticality ? el("span", { class: "rq-crit", style: `--c:${CRIT[r.criticality] || "#64748b"}`, title: "Criticité (A la plus haute)" }, r.criticality) : null,
          V ? el("span", { class: "rq-ver", title: `Preuve : ${V.fr}` }, `${r.verification_method} · ${V.label}`) : null, hasTbd(r) ? el("span", { class: "rq-tbd", title: "Une valeur est à définir : à fixer dans DynamiteAgile" }, "TBD") : null,
          r.status ? el("span", { class: `rq-status ${M}`, "data-rq-status": M, title: M === "draft" ? "Brouillon : avant « Accepted » dans DynamiteAgile" : M === "out" ? "Écartée : rejetée ou obsolète" : "Acceptée dans DynamiteAgile" }, r.status) : null),
        el("p", null, r.statement || r.title), r.acceptance_criteria ? el("small", { class: "rq-ac" }, icon("check"), " ", r.acceptance_criteria) : null, disc === "sw" && !need ? oracleLine(L, r) : null, chips);
    }
    /* where the list stands : the three moves, the one we are at lit, what to do now */
    function stageBand(L) {
      const S = stageOf(L), at = S.stage === "final" ? "final" : (L.loads || []).length > 1 || L.rows.some((r) => r.key) ? "agile" : "draft", G = STAGES[S.stage];
      return el("section", { class: `rq-stage ${S.stage}`, "data-rq-stage": S.stage, style: `--c:${G.color}` },
        el("div", { class: "rq-path" }, PATH.map((x) => el("div", { class: `rq-step${x.k === at ? " on" : ""}${PATH.findIndex((y) => y.k === at) > PATH.indexOf(x) ? " done" : ""}` }, el("span", { class: "rq-n" }, String(x.n)), icon(x.icon), el("div", null, el("b", null, x.t), el("small", null, x.s))))),
        el("p", { class: "small" }, el("span", { class: "rq-schip", style: `--c:${G.color}` }, icon(G.icon), G.fr), " ", S.stage === "draft"
          ? `${S.draft} ligne${S.draft > 1 ? "s" : ""} avant « Accepted »${S.tbd ? `, ${S.tbd} valeur${S.tbd > 1 ? "s" : ""} TBD` : ""}. On l'éprouve ici, on l'itère dans DynamiteAgile ; la structure du produit attend la version finale.`
          : `${S.firm} lignes acceptées dans DynamiteAgile${S.tbd ? ` — mais ${S.tbd} valeur${S.tbd > 1 ? "s" : ""} TBD` : ""}. La structure du produit se bâtit sur elles.`, S.out ? ` ${S.out} ligne${S.out > 1 ? "s" : ""} rejetée${S.out > 1 ? "s" : ""} ou obsolète${S.out > 1 ? "s" : ""}, écartée${S.out > 1 ? "s" : ""}.` : ""));
    }
    function draw() {
      const L = R(); clear(left); clear(view); clear(right);
      left.append(el("div", { class: "side-head" }, el("h2", null, `Exigences · ${D.fr}`)), pick);
      if (!L) {
        left.append(el("div", { class: "side-actions" }, (() => { const b = btn("Exemple : l'ESS (brouillon)", ess, { primary: true, small: true, icon: "power", tip: "Un ESS à modules 8s8p échangeables : 10 besoins et 52 exigences au format de DynamiteAgile, en brouillon" }); b.dataset.rqEss = ""; return b; })(),
          btn("Exemple : le Rover", rover, { small: true, icon: "play", tip: "Les besoins et les exigences du Rover, projet DEMO de DynamiteAgile (acceptées)" }),
          btn("Importer le .csv de DynamiteAgile", () => pick.click(), { small: true, icon: "upload", tip: "Goldmine → Exporter (.csv) : la liste se lit telle quelle, toutes ses colonnes gardées" })));
        view.append(el("div", { class: "page" }, el("div", { class: "empty" }, el("h2", null, `Les exigences allouées ${D.to}`), el("p", null, "Une seule liste pour tout le produit, celle de DynamiteAgile : la mécanique, l'électronique et le logiciel y voient chacun les exigences qui leur sont allouées — une exigence peut l'être à plusieurs. On la charge en brouillon, on l'itère dans DynamiteAgile, on relit la version finale ici."),
          el("div", { class: "rq-path" }, PATH.map((x) => el("div", { class: "rq-step" }, el("span", { class: "rq-n" }, String(x.n)), icon(x.icon), el("div", null, el("b", null, x.t), el("small", null, x.s))))))));
        right.append(el("div", { class: "side-head" }, el("h2", null, "Le format")), el("p", { class: "small" }, "Les colonnes de l'export de DynamiteAgile (Goldmine), gardées telles quelles ; l'outil ne remplit que « allocation ». Une ligne sans « key » est créée par l'import de Goldmine, puis retrouvée par son « external_id »."));
        setGuide(reqsGuide(null, disc)); return;
      }
      const { needs, reqs } = forDiscipline(L, disc), G = [...reqsGuide(L, disc), ...(disc === "sw" ? oracleGuide(L, reqs) : [])], guess = reqs.filter((r) => !(L.alloc[keyOf(r)] || {}).sure), S = stageOf(L), draft = S.stage === "draft";
      const ai = btn(draft ? "Ébauche avec l'IA" : "Concevoir avec l'IA", async () => toast((await copyText(designPrompt(L, disc, store.project))) ? `Consigne copiée : ${reqs.length} exigences et ${needs.length} besoins${draft ? ", en brouillon" : ""}. Collez-la dans votre assistant ; rapportez sa réponse par ${disc === "sw" ? "« Coller la réponse… », ici ou au bouton « IA » du Logiciel" : `la porte « Avec l'IA »${disc === "mech" ? " de l'Atelier" : ""}`}.` : "Copie impossible.", "success", 8000),
        { primary: true, small: true, icon: "sparkle", tip: draft ? "La consigne qui demande à un assistant d'éprouver le brouillon : ce qui manque, ce qui se contredit, une valeur pour chaque TBD" : "La consigne qui demande à un assistant de concevoir cette discipline à partir de ses exigences" });
      const toAgile = btn("Vers DynamiteAgile (.csv)", () => download(`exigences_${slug(store.project.name)}.csv`, toAgileCsv(L), "text/csv"), { small: true, icon: "download", tip: "Toute la liste, les mêmes colonnes, l'allocation remplie : Goldmine → Importer (une ligne sans clé y est créée)" }); toAgile.dataset.rqToAgile = "";
      const again = btn("Relire l'export de DynamiteAgile…", () => pick.click(), { small: true, icon: "upload", tip: "Goldmine → Exporter (.csv) : ce qu'il change est montré avant d'appliquer" }); again.dataset.rqAgain = "";
      left.append(el("div", { class: "side-actions" }, ai,
        disc === "sw" ? btn("Coller la réponse…", () => openImport({ design: swDesign }), { small: true, icon: "paste", tip: "La réponse de l'assistant, au format du Logiciel : l'aperçu des blocs, puis une étape annulable" }) : null,
        disc === "sw" ? (() => { const b = btn("Vers les exigences du logiciel (V)", () => openImport({ design: swDesign, text: toAgileCsv(L, { needs, reqs }) }), { small: true, icon: "code", tip: "Les exigences du produit allouées au logiciel deviennent celles de l'étape 1 du V, sous leurs clés : l'aperçu, puis une étape annulable" }); b.dataset.rqToV = ""; return b; })() : null,
        toAgile, again,
        guess.length ? btn(`Confirmer les ${guess.length} propositions`, () => store.commit(`Exigences : ${guess.length} allocations confirmées`, (p) => { for (const r of guess) p.reqs.alloc[keyOf(r)].sure = true; }), { small: true, icon: "check" }) : null));
      const cats = [...new Set(reqs.map((r) => r.category || ""))], loads = L.loads || [];
      left.append(el("div", { class: "side-section", "data-fold-note": `${loads.length} lecture${loads.length > 1 ? "s" : ""}` }, el("h3", null, "Les lectures de la liste"),
          el("ol", { class: "rq-loads small" }, loads.map((x) => el("li", { class: x.stage }, el("span", { class: "rq-schip", style: `--c:${STAGES[x.stage].color}` }, STAGES[x.stage].fr), ` ${x.file || "liste"}${x.when ? ` · ${day(x.when)}` : ""} — ${x.rows} lignes${x.draft ? `, ${x.draft} en brouillon` : ""}${x.tbd ? `, ${x.tbd} TBD` : ""}`))),
          btn(`Seulement ${D.the} (.csv)`, () => download(`exigences_${D.label.toLowerCase()}.csv`, toAgileCsv(L, { needs, reqs }), "text/csv"), { small: true, icon: "download", tip: "Les exigences de cette discipline et leurs besoins, pour DynamiteAgile" })),
        el("div", { class: "side-section" }, el("h3", null, "Par catégorie"), el("nav", { class: "rq-cats" }, [null, ...cats].map((c) => { const C = c === null ? { fr: "Toutes", color: D.color, icon: D.icon } : categoryOf(c);
          return el("button", { type: "button", class: `rq-cat${st.cat === c ? " on" : ""}`, style: `--c:${C.color}`, "aria-pressed": st.cat === c ? "true" : "false", onClick: () => { st.cat = c; draw(); } }, icon(C.icon), el("span", null, C.fr), el("small", null, String(c === null ? reqs.length : reqs.filter((r) => (r.category || "") === c).length))); }))),
        el("div", { class: "side-section" }, el("h3", null, "Le guide"), guideBox(G, { go: (x) => { if (x.key || (x.keys && x.keys[0])) { st.sel = x.key || x.keys[0]; draw(); } } })));
      const pg = el("div", { class: "page rq-page" });
      if (disc === "sw") pg.append(leanHead("reqs"));      // the first step of the lean path of the software (modules/sw_lean_ui.js)
      pg.append(stageBand(L), el("p", { class: "muted small" }, `${L.file || "Liste de DynamiteAgile"} — ${reqs.length} exigence${reqs.length > 1 ? "s" : ""} allouée${reqs.length > 1 ? "s" : ""} ${D.to} sur ${L.rows.filter((r) => !isNeed(r) && maturityOf(r) !== "out").length}. M · E · L : les disciplines qui la portent — en pointillé, une proposition de l'outil. La même liste se voit dans les trois branches : ce qui change ici change partout.`));
      if (needs.length) pg.append(el("h3", { class: "rq-h need" }, icon("user"), "Les besoins — le pourquoi"), el("div", { class: "rq-grid" }, needs.map((r) => card(r, L))));
      for (const c of cats.filter((x) => st.cat === null || x === st.cat)) { const C = categoryOf(c); pg.append(el("h3", { class: "rq-h", style: `--cat:${C.color}` }, icon(C.icon), C.fr), el("div", { class: "rq-grid" }, reqs.filter((r) => (r.category || "") === c).map((r) => card(r, L)))); }
      view.append(pg);
      const r = st.sel && L.rows.find((x) => keyOf(x) === st.sel);
      right.append(el("div", { class: "side-head" }, el("h2", null, r ? keyOf(r) : "Une exigence")));
      if (!r) right.append(el("p", { class: "muted small" }, "Cliquez une exigence : toutes ses colonnes de DynamiteAgile, et les besoins d'où elle vient."));
      else { const P = isNeed(r) ? [] : parentsOf(L, r), a = L.alloc[keyOf(r)], M = maturityOf(r);
        right.append(el("div", { class: "side-section" }, el("h3", null, "D'où elle vient"), P.length ? el("ul", { class: "small" }, P.map((n) => el("li", null, el("a", { href: "#", onClick: (e) => { e.preventDefault(); st.sel = keyOf(n); draw(); } }, keyOf(n)), ` — ${n.statement}`))) : el("p", { class: "small muted" }, isNeed(r) ? "C'est un besoin : le pourquoi d'autres exigences." : "Aucun besoin nommé dans « derived_from »."),
          a ? el("p", { class: "small" }, `Allocation : ${allocText(a) || "aucune"}${a.sure ? "" : " (proposée)"}`) : null,
          el("p", { class: "small" }, el("span", { class: "rq-schip", style: `--c:${M === "firm" ? STAGES.final.color : M === "out" ? "#64748b" : STAGES.draft.color}` }, M === "firm" ? "Acceptée" : M === "out" ? "Écartée" : "Brouillon"), ` ${r.status || "aucun statut : pas encore dans DynamiteAgile"}`),
          disc !== "sw" && reqs.includes(r) && L.alloc[keyOf(r)] && L.alloc[keyOf(r)].sw ? el("p", { class: "small" }, el("a", { href: "#/lreq", onClick: (e) => { e.preventDefault(); go("#/lreq"); } }, "La voir dans le Logiciel")) : null),
          isNeed(r) ? null : oracleSection(L, r, (label, fn) => store.commit(`Exigences : ${label}`, (p) => fn(p.reqs))),
          el("div", { class: "side-section" }, el("h3", null, "Les colonnes de DynamiteAgile"), el("dl", { class: "rq-dl" }, L.head.filter((h) => r[h]).flatMap((h) => [el("dt", null, COLUMN_FR[h] || h), el("dd", null, r[h])])))); }
      setGuide(G.map((x) => ({ ...x, go: x.key || (x.keys && x.keys[0]) ? () => { st.sel = x.key || x.keys[0]; draw(); } : null })));
      if (st.sel) setTimeout(() => { const c = view.querySelector(`[data-rq="${CSS.escape(st.sel)}"]`); if (c && c.scrollIntoView) c.scrollIntoView({ block: "nearest" }); }, 0);
    }
    const off = store.on("change", () => draw()); draw();
    return () => { off(); setGuide([]); };
  };
}
registerModule({ key: "mreq", label: "Exigences", icon: "report", tip: "Les exigences du produit allouées à la mécanique, lues de DynamiteAgile — et la consigne pour la concevoir avec une IA", render: page("mech") });
registerModule({ key: "ereq", label: "Exigences", icon: "report", tip: "Les exigences du produit allouées à l'électronique, lues de DynamiteAgile — et la consigne pour la concevoir avec une IA", render: page("elec") });
registerModule({ key: "lreq", label: "Exigences", icon: "report", tip: "Les exigences du produit allouées au logiciel, lues de DynamiteAgile — d'où partent les exigences du V", render: page("sw") });
