/* DynamiteOrbit.ai — Logiciel, Constats : THE AI LOOP on the screen (JP, 27 novembre 2026, par menu : « Boucle IA »). Three moves, as a test
   bench does them : 1. the PACKAGE leaves (.zip : the instruction, the findings, the requirements, the software) ; 2. the ANSWER comes back,
   pasted or as a file — what it changes, what the loop put back (the hardware interfaces, the bench, the missions), what does not run ;
   3. the GATE — the whole campaign played on the new version, under the veil of a long operation, then compared limit by limit and mission
   by mission : « Accepter » only when nothing regressed ; it is ONE undoable step, written in the journal of the answers (core/ai_door.js),
   which poses a point « Après l'IA » in the history. The tool calls no assistant. What it follows : a regression gate of a CI pipeline. */

import { el, btn, field, toast, modal, download, copyText, icon } from "../core/dom.js";
import { store } from "../core/store.js";
import { busyVeil } from "../core/busy.js";
import { zip } from "../core/zip.js";
import { snapshotLists, journalChange } from "../core/ai_door.js";
import { verdictWord } from "../core/req_oracle.js";
import { campaignRun } from "../sw/sw_campaign.js";
import { loopFiles, loopPrompt, readCandidate, compareCampaigns, compareMd } from "../sw/sw_loop.js";
import { rememberCampaign, missionsOf } from "./sw_lean_ui.js";
import { missionSig } from "../sw/sw_req_missions.js";

const CH = { regressed: { fr: "RÉGRESSION", c: "#dc2626" }, fixed: { fr: "corrigée", c: "#16a34a" }, same: { fr: "inchangée", c: "#94a3b8" }, moved: { fr: "a bougé", c: "#d97706" } };
const stamp = (C) => `${(C.design || "logiciel").toLowerCase()}_${new Date().toISOString().slice(0, 10)}`;

/** The section of the right pane : the loop, its three moves. d : the software ; C : its last campaign (or null). */
export function loopSection(d, C0) {
  /* the gate compares a version with the campaign it replays : missions changed since (the requirements, their readings) — play it again first */
  const stale = !!C0 && C0.sig !== missionSig(missionsOf(d)), C = stale ? null : C0;
  const pack = btn("Paquet pour l'IA (.zip)", () => { download(`boucle_ia_${stamp(C)}.zip`, zip(loopFiles(store.project, d, C)), "application/zip"); toast("Paquet écrit : PROMPT.md, constat, exigences, software.json. Donnez-le à votre assistant ; collez sa réponse ici.", "success", 7000); }, { small: true, primary: true, icon: "download", disabled: !C, tip: "La consigne, le constat, les exigences et le logiciel — ce qui échoue est à corriger, les interfaces HW, le banc et les missions ne changent pas" });
  pack.dataset.swLoopPack = "";
  const copy = btn("Copier la consigne", async () => toast((await copyText(loopPrompt(store.project, d, C))) ? "Consigne copiée." : "Copie impossible.", "info"), { small: true, icon: "copy", disabled: !C });
  const read = btn("Lire la nouvelle version…", () => openLoop(d, C), { small: true, icon: "upload", disabled: !C, tip: "La réponse de l'assistant : la campagne entière est rejouée sur elle, et elle n'est acceptée que sans régression" });
  read.dataset.swLoopRead = "";
  return el("div", { class: "side-section", "data-fold-note": C ? "3 gestes" : "après la campagne", "data-sw-loop": "" }, el("h3", null, "Boucle IA"),
    el("p", { class: "small" }, "1. Le paquet part à l'IA. 2. Sa nouvelle version revient. 3. Toute la campagne la rejoue : acceptée seulement sans régression."),
    el("div", { class: "swl2-acts" }, pack, copy, read), C ? el("p", { class: "small muted" }, icon("lock"), " Le lot de réserve ne part pas : il est rejoué à la porte.") : el("p", { class: "small muted", "data-sw-loop-stale": stale ? "" : null }, stale ? "Les missions ont changé depuis la campagne (les exigences ou leur lecture) : rejouez-la, la boucle part de son constat." : "Jouez d'abord la campagne : la boucle part de son constat."));
}

/** The answer read back, the campaign played on it, the gate. */
export function openLoop(d, C) {
  const area = el("textarea", { rows: 7, placeholder: "Collez la réponse de l'assistant : ses explications, puis le logiciel dans un bloc ```json.", "data-sw-loop-answer": "" });
  const pick = el("input", { type: "file", accept: ".json,.md,.txt", onChange: async (e) => { const f = e.target.files[0]; if (f) { area.value = await f.text(); area.dispatchEvent(new Event("input")); } e.target.value = ""; } });
  const out = el("div", { class: "swl2-out" }), body = el("div", { class: "swl2-body" }, field("Réponse de l'assistant", area), el("label", { class: "small" }, "ou un fichier : ", pick), out), veil = busyVeil(body);
  let cand = null, after = null, cmp = null, running = null;
  const play = btn("Rejouer la campagne sur cette version", () => run(), { primary: true, icon: "play", disabled: true }); play.dataset.swLoopPlay = "";
  const accept = btn("Accepter la nouvelle version", () => take(), { primary: true, icon: "check", disabled: true, tip: "Une seule étape annulable, écrite au journal des réponses d'IA" }); accept.dataset.swLoopAccept = "";
  const saveCmp = btn("Comparaison (.md)", () => download(`comparaison_${stamp(C)}.md`, compareMd(cmp), "text/markdown"), { small: true, icon: "download", disabled: true });
  area.addEventListener("input", () => { cand = readCandidate(area.value, d); after = null; cmp = null; accept.disabled = true; saveCmp.disabled = true; play.disabled = !cand.ok; show(); });
  function show() {
    out.replaceChildren();
    if (!cand || !area.value.trim()) return;
    if (cand.errors.length) out.append(el("div", { class: "swl2-box bad" }, icon("warning"), el("b", null, " Ne peut pas être jouée"), el("ul", { class: "small" }, cand.errors.map((t) => el("li", null, t)))));
    if (cand.lines.length) out.append(el("div", { class: "swl2-box" }, el("b", null, `${cand.lines.length} changement(s)`), el("ul", { class: "small" }, cand.lines.slice(0, 30).map((t) => el("li", null, t)))));
    if (cand.kept.length) out.append(el("div", { class: "swl2-box keep" }, el("b", null, "Remis par la boucle"), el("ul", { class: "small" }, cand.kept.map((t) => el("li", null, t)))));
    if (cmp) out.append(el("div", { class: `swl2-box ${cmp.accept ? "ok" : "bad"}`, "data-sw-loop-verdict": cmp.accept ? "accept" : "refuse" },
      el("b", null, cmp.accept ? `Aucune régression : ${cmp.fixed} exigence(s) corrigée(s).` : `${cmp.regressed} régression(s) : la version est refusée.`),
      el("table", { class: "swf2-table" }, el("thead", null, el("tr", null, ["Exigence", "Limite", "Avant", "Après", ""].map((h) => el("th", null, h)))),
        el("tbody", null, cmp.rows.filter((r) => r.change !== "same").map((r) => el("tr", { "data-sw-loop-row": r.change }, el("td", null, r.key), el("td", null, r.text), el("td", null, verdictWord(r.was)), el("td", null, verdictWord(r.now)),
          el("td", { class: "swf2-cell", style: `--v:${CH[r.change].c}` }, CH[r.change].fr))))),
      cmp.rows.every((r) => r.change === "same") ? el("p", { class: "small muted" }, "Aucun verdict n'a bougé.") : null));
  }
  function run() {
    /* the missions of the version in hand : the yardstick does not move */
    if (!cand || !cand.ok || running) return; const g = campaignRun(store.project, cand.doc, { profiles: missionsOf(d), slice: 25000 }); let stop = false; running = true; play.disabled = true;
    const cancel = () => { stop = true; };
    const pump = () => {
      if (stop) { running = false; veil.set(""); play.disabled = false; toast("Campagne annulée.", "info"); return; }
      const until = Date.now() + 120; let r = g.next(); while (!r.done && Date.now() < until) r = g.next();
      if (r.done) { running = false; veil.set(""); after = r.value; cmp = compareCampaigns(C, after); accept.disabled = !cmp.accept; saveCmp.disabled = false; play.disabled = false; show(); return; }
      const x = r.value; veil.set(`Nouvelle version : mission ${x.mission + 1} sur ${x.missions} — ${x.name}`, { done: Math.round(((x.mission + x.done / x.total) / x.missions) * 1000), total: 1000, cancel }); setTimeout(pump, 0);
    };
    veil.set("Campagne sur la nouvelle version", { done: 0, total: 1000, cancel }); setTimeout(pump, 30);
  }
  function take() {
    if (!cmp || !cmp.accept || !cand) return; const doc = JSON.parse(JSON.stringify(cand.doc));
    rememberCampaign(after);      // before the step : the screen drawn again by it shows the campaign of the version it now holds
    store.commit(`Logiciel : nouvelle version de l'IA — ${cmp.fixed} corrigée(s), aucune régression`, (p) => { const before = snapshotLists(p), i = (p.software || []).findIndex((x) => x.id === d.id); if (i < 0) return; p.software[i] = doc;
      journalChange(before, p, { ask: `Boucle IA : ${cmp.fixed} exigence(s) corrigée(s), aucune régression sur ${after.profiles.length} missions` }); });
    m.close(); toast("Nouvelle version appliquée — au journal des réponses d'IA, un point d'historique posé. Ctrl + Z pour revenir.", "success", 7000);
  }
  const m = modal("Boucle IA — la nouvelle version", [body, el("div", { class: "form-actions" }, saveCmp, el("span", { class: "grow" }), btn("Fermer", () => { if (running) return; m.close(); }), play, accept)], { wide: true });
  return m;
}
