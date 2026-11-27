/* DynamiteOrbit.ai — Logiciel, step 5 of the lean path : the FINDINGS — every mission played on the virtual bench, each requirement judged on each
   (JP, 27 novembre 2026 : « tests logiciels embarqués HIL virtuels… valider les profils de missions et les différences specs, limites, corner
   cases, performances et safety… itérer rapidement »). « Jouer la campagne » plays them all, in slices, under the veil of a long operation —
   its progress, « Annuler » ; then one row per limit of a requirement, one column per mission, each cell its verdict in colour, and the overall
   one. The findings leave as CSV and as Markdown, marked (sw/sw_campaign.js). Virtual : the module is TYPICAL — the screen and the files say so.
   A requirement the machine cannot read is listed, never judged. What it follows : a test campaign report — a traceability matrix of
   requirements against scenarios, coloured by verdict. Route : #/swfind. */

import { el, icon, btn, clear, download, toast } from "../core/dom.js";
import { registerModule, setGuide, go } from "../core/app.js";
import { store } from "../core/store.js";
import { busyVeil } from "../core/busy.js";
import { leanOf } from "../sw/sw_lean.js";
import { profilesOf } from "../sw/sw_story.js";
import { campaignRun, findingsCsv, findingsMd } from "../sw/sw_campaign.js";
import { verdictWord } from "../core/req_oracle.js";
import { swShell } from "./sw_vband.js";
import { leanHead, leanDesign, lastCampaign, rememberCampaign } from "./sw_lean_ui.js";
import { loopSection } from "./sw_loop_ui.js";

const V = { pass: { c: "#16a34a", s: "✓" }, fail: { c: "#dc2626", s: "✗" }, none: { c: "#94a3b8", s: "–" }, uncovered: { c: "#d97706", s: "◌" }, covered: { c: "#0891b2", s: "●" } };
const WHY = { offbench: "prouvée autrement que par essai", tbd: "une valeur TBD", unread: "aucune grandeur que le banc relève", need: "un besoin", person: "« ne pas juger au banc »" };

function render(main) {
  const { page, head, left, view, right } = swShell(main, "swf2-view"), veil = busyVeil(view);
  let running = null;
  function play(d) {
    if (running) return; const g = campaignRun(store.project, d, { slice: 25000 }), P = profilesOf(d), t0 = Date.now(); let stop = false;
    running = { cancel: () => { stop = true; } };
    const pump = () => {
      if (stop) { running = null; veil.set(""); toast("Campagne annulée : aucun constat n'a été gardé.", "info"); return; }
      const until = Date.now() + 120; let r = g.next(); while (!r.done && Date.now() < until) r = g.next();
      if (r.done) { running = null; veil.set(""); rememberCampaign(r.value); draw(); toast(`Campagne jouée en ${Math.round((Date.now() - t0) / 100) / 10} s : ${r.value.counts.fail} échouée(s), ${r.value.counts.pass} tenue(s).`, r.value.counts.fail ? "warn" : "success", 6000); return; }
      const x = r.value, frac = (x.mission + x.done / x.total) / x.missions;
      veil.set(`Campagne : mission ${x.mission + 1} sur ${x.missions} — ${x.name}`, { done: Math.round(frac * 1000), total: 1000, cancel: running.cancel }); setTimeout(pump, 0);
    };
    veil.set(`Campagne : ${P.length} mission${P.length > 1 ? "s" : ""} à jouer`, { done: 0, total: 1000, cancel: running.cancel }); setTimeout(pump, 30);
  }
  const save = (C, kind) => { const name = `constat_${(C.design || "logiciel").toLowerCase()}_${C.when.slice(0, 10)}.${kind}`; if (kind === "csv") download(name, findingsCsv(C), "text/csv"); else download(name, findingsMd(C), "text/markdown"); };
  function draw() {
    const d = leanDesign(); head.replaceChildren(leanHead("findings", d));
    if (!d) { view.replaceChildren(el("div", { class: "empty" }, el("h2", null, "Les constats"), el("p", null, "Le projet n'a pas encore de logiciel."))); setGuide([]); return; }
    const C = lastCampaign(d), P = profilesOf(d), L = leanOf("findings");
    clear(left); left.append(el("div", { class: "side-head" }, el("h2", null, "Constats")),
      el("div", { class: "side-actions" }, (() => { const b = btn(C ? "Rejouer la campagne" : "Jouer la campagne", () => play(d), { primary: true, icon: "play", tip: `Les ${P.length} missions sur le banc virtuel, chaque exigence jugée sur chacune` }); b.dataset.swCampaign = ""; return b; })()),
      el("div", { class: "side-scroll" }, el("div", { class: "side-section", "data-fold-note": C ? `${C.rows.length} limites` : "à jouer" }, el("h3", null, "Ce que l'écran montre"), el("p", { class: "small" }, L.says),
        el("p", { class: "small muted" }, "Banc VIRTUEL : le logiciel tourne contre un module simulé aux valeurs typiques ; un verdict dit ce que le modèle fait, pas ce que le produit fera. Le jugement se fait sur une ligne du banc par seconde.")),
        C ? el("div", { class: "side-section", "data-fold-note": "le bilan" }, el("h3", null, "Le bilan"), ["fail", "pass", "uncovered", "none"].map((k) => el("p", { class: "swf2-count", style: `--v:${V[k].c}` }, el("b", null, String(C.counts[k] || 0)), ` ${verdictWord(k)}`)),
          el("p", { class: "swf2-count", style: "--v:#475569" }, el("b", null, String(C.unread.length)), " non lues par la machine")) : null,
        C ? el("div", { class: "side-section" }, el("h3", null, "Le fichier de constat"), btn("Constat (.csv)", () => save(C, "csv"), { small: true, icon: "download", tip: "Une ligne par limite, une colonne par mission — CSV" }), btn("Constat (.md)", () => save(C, "md"), { small: true, icon: "download", tip: "Le bilan, ce qui échoue, la table entière — Markdown" })) : null));
    if (!C) view.replaceChildren(el("div", { class: "empty", "data-sw-findings": "none" }, el("h2", null, "La campagne n'a pas encore été jouée"), el("p", null, `${P.length} mission${P.length > 1 ? "s" : ""} à jouer sur le banc virtuel : chaque exigence lue par la machine y sera jugée.`)), veil.node);
    else view.replaceChildren(el("div", { class: "swf2-wrap" }, el("table", { class: "swf2-table", "data-sw-findings": "matrix" },
      el("thead", null, el("tr", null, el("th", null, "Exigence"), el("th", null, "Limite"), C.profiles.map((p) => el("th", null, p.name, el("small", null, ` ${Math.round(p.seconds / 60)} min`))), el("th", null, "Bilan"))),
      el("tbody", null, C.rows.map((r) => el("tr", { class: `swf2-${r.overall}`, "data-sw-finding": r.key },
        el("td", null, el("a", { href: "#/lreq", "data-tip": r.req.title || r.req.statement || "" }, r.key)), el("td", null, r.text, r.sure ? null : el("small", { class: "muted" }, " (à confirmer)")),
        C.profiles.map((p) => { const v = r.by[p.id] || "none"; return el("td", { class: "swf2-cell", style: `--v:${V[v].c}`, "data-tip": verdictWord(v) }, V[v].s); }),
        el("td", { class: "swf2-cell all", style: `--v:${V[r.overall].c}` }, `${V[r.overall].s} ${verdictWord(r.overall)}`))))),
      C.unread.length ? el("details", { class: "swf2-unread" }, el("summary", null, `${C.unread.length} exigences non jugées au banc`), el("ul", { class: "small" }, C.unread.map((u) => el("li", null, `${u.key} — ${WHY[u.why] || u.why}`)))) : null), veil.node);
    clear(right); const fails = C ? C.rows.filter((r) => r.overall === "fail") : [];
    right.append(el("div", { class: "side-head" }, el("h2", null, "Ce qui échoue")), el("div", { class: "side-scroll" },
      el("div", { class: "side-section", "data-fold-note": C ? `${fails.length}` : "—" }, el("h3", null, "À corriger"), !C ? el("p", { class: "small muted" }, "Jouez la campagne.") : fails.length ? fails.map((r) => el("p", { class: "small" }, icon("warning"), ` ${r.key} — ${r.text} — échoue sur ${C.profiles.filter((p) => r.by[p.id] === "fail").map((p) => p.name).join(", ")}`)) : el("p", { class: "small muted" }, "Aucune exigence échouée.")),
      loopSection(d, C),      // the AI loop (JP, 27 novembre 2026, par menu : « Boucle IA ») : the package, the new version, the gate
      el("div", { class: "side-section" }, el("h3", null, "Ensuite"), el("p", { class: "small" }, "Quand aucune exigence n'échoue, le paquet C part vers le microcontrôleur."),
        btn("Export", () => go("#/swrel"), { small: true, icon: "download", tip: "Le paquet C, quand les constats sont verts" }))));
    setGuide(C ? fails.map((r) => ({ level: "error", text: `${r.key} échoue : ${r.text}.` })) : [{ level: "todo", text: "La campagne n'a pas encore été jouée : « Jouer la campagne »." }]);
  }
  const off = store.on("change", () => { if (!running) draw(); }); draw();
  return () => { off(); if (running) running.cancel(); veil.dispose(); setGuide([]); };
}
registerModule({ key: "swfind", label: "Constats", icon: "check", tip: "5. Toutes les missions jouées sur le banc virtuel : chaque exigence tenue, échouée ou non exercée", render });
