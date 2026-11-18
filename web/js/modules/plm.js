/* DesignWizard.ai — Révisions : releasing a part, an assembly or a board. Each receives its number ; each release freezes a
   revision that never changes again. The screen says, for every item, what releasing it now would do — the next revision
   when form, fit and function hold, a new number when they do not — and why ; an assembly shows the revision of each part
   it was released with, and what moved since. Every released revision can be looked at, compared, downloaded, taken back,
   and filed in its own folder in Drive. Route : #/plm. The rule is in core/plm.js. */

import { el, btn, badge, toast, modal, icon, download, table, confirmBox } from "../core/dom.js";
import { registerModule } from "../core/app.js";
import { store } from "../core/store.js";
import { kernel } from "../cad/client.js";
import { buildAssembly } from "../core/asm_scene.js";
import { toDwiz } from "../core/dwiz.js";
import { session } from "../core/access.js";
import { aiDiff } from "../core/ai_loop.js";
import { REVIEW_KINDS } from "../core/review.js";
import { planRelease, release, releases, compatibility, restore, releaseFiles, releaseName, f3Text, REF_TYPES } from "../core/plm.js";
import { TREE } from "../google/drive_fs.js";
import { connect } from "./account.js";

const LISTS = { part: "parts", assembly: "assemblies", board: "boards" }, day = (s) => String(s || "").slice(0, 10);
const VERDICT = { first: ["À libérer", "neutral"], none: ["Libérée, à jour", "ok"], revision: ["Révision suivante", "info"], number: ["Nouveau numéro", "danger"] };

function render(main) {
  const page = el("div", { class: "page" }), body = el("div"); main.append(page); page.append(body);
  const forms = new Map(); let alive = true, open = null;                   // forms : key → { size, mass } as the kernel measures the item of today
  /* the form of each item is measured by the kernel, one after the other ; the verdicts sharpen as the measures arrive */
  async function measure() {
    const p = store.project;
    for (const d of p.parts || []) { if (!alive) return; try { const b = await kernel.build(d); forms.set(`part:${d.id}`, { size: [b.bbox[3] - b.bbox[0], b.bbox[4] - b.bbox[1], b.bbox[5] - b.bbox[2]], mass: b.mass || 0 }); } catch (e) { forms.delete(`part:${d.id}`); } }
    for (const a of p.assemblies || []) { if (!alive) return; try { const c = await buildAssembly(a); forms.set(`assembly:${a.id}`, { size: [c.bbox[3] - c.bbox[0], c.bbox[4] - c.bbox[1], c.bbox[5] - c.bbox[2]], mass: (c.mass && c.mass.mass) || 0 }); } catch (e) { forms.delete(`assembly:${a.id}`); } }
    if (alive) draw();
  }
  const planOf = (key) => planRelease(store.project, key, { form: forms.get(key) });
  const sentence = (d, plan) => (plan.action === "first" ? `Première libération : un numéro lui est attribué, révision ${plan.rev}.`
    : plan.action === "none" ? `${d.pn} rév. ${plan.rev} : rien n'a changé depuis sa libération.`
      : plan.action === "revision" ? `Forme, ajustement et fonction conservés : révision ${plan.rev} du numéro ${d.pn}.${plan.moved && plan.moved.length ? ` Ce qui a avancé depuis : ${plan.moved.join(", ")}.` : ""}`
        : `Forme, ajustement ou fonction rompus — ${f3Text(plan.f3)}. Un NOUVEAU numéro lui est attribué, révision A ; il garde la trace de ${plan.from.pn} rév. ${plan.from.rev}, dont il dérive.`);
  function ask(key) {
    const p = store.project, kind = key.split(":")[0], art = (p[LISTS[kind]] || []).find((x) => `${kind}:${x.id}` === key), plan = planOf(key); if (!art || !plan) return;
    const m = modal(`Libérer ${art.id}`, [el("p", null, sentence(art, plan)),
      plan.f3 && !plan.f3.judged.form ? el("p", { class: "muted small" }, "La forme (enveloppe, masse) n'a pas pu être comparée : seuls l'ajustement et la fonction ont été jugés.") : null,
      plan.blockers.length ? el("div", null, el("h3", null, "À faire d'abord"), el("ul", { class: "decisions" }, plan.blockers.map((b) => el("li", { class: "form-error" }, b)))) : null,
      el("p", { class: "muted small" }, "Une révision libérée ne change plus jamais. Le travail continue dans le projet ; la libération suivante reposera la question."),
      el("div", { class: "form-actions" }, btn("Annuler", () => m.close()), btn(plan.action === "number" ? "Libérer sous un nouveau numéro" : "Libérer", () => {
        try { let rec = null; store.commit(`${art.id} libéré`, (x) => { rec = release(x, key, { date: new Date(), by: (x.team && x.team.owner) || "", form: forms.get(key) }); }); m.close(); open = key; if (rec && rec.done) toast(`${rec.pn} rév. ${rec.rev} libérée.`, "success", 6000); }
        catch (e) { toast(e.message, "error", 8000); } }, { primary: true, icon: "lock", disabled: plan.action === "none" || plan.blockers.length > 0 }))], { wide: true });
  }
  /* one released revision : what differs from the item of today, its file, and the way back */
  function look(rec) {
    const p = store.project, kind = rec.key.split(":")[0], now = (p[LISTS[kind]] || []).find((x) => `${kind}:${x.id}` === rec.key), diff = now ? aiDiff(rec.doc, now).slice(0, 14) : [], name = releaseName(rec.pn, rec.rev, rec.name);
    const m = modal(name, [el("p", { class: "muted" }, `Libérée le ${day(rec.at)}${rec.by ? ` par @${rec.by}` : ""}${rec.from ? ` — dérive de ${rec.from.pn} rév. ${rec.from.rev}` : ""}${rec.f3 ? ` — ${rec.f3.ok ? "3F conservé" : `3F rompu : ${rec.f3.text}`}` : ""}.`),
      rec.uses ? el("div", null, el("h3", null, "Libérée avec"), el("ul", { class: "decisions" }, [...Object.entries(rec.subs || {}).map(([id, u]) => el("li", null, icon("assembly"), ` ${id} — ${u.pn} rév. ${u.rev} (sous-assemblage)`)), ...Object.entries(rec.uses).map(([id, u]) => el("li", null, `${id} — ${u.pn} rév. ${u.rev}`))])) : null,
      el("h3", null, now ? (diff.length ? "Ce qui a changé depuis, dans le projet" : "Le projet est encore à cette révision") : "L'artéfact n'est plus dans le projet"), diff.length ? el("ul", { class: "decisions", style: { fontSize: ".82rem" } }, diff.map((x) => el("li", null, x.text))) : null,
      el("div", { class: "form-actions" }, btn("Fermer", () => m.close()), btn("Télécharger le .dwiz", () => download(`${name}.dwiz`, toDwiz(rec.doc), "text/plain;charset=utf-8"), { icon: "download" }),
        now && diff.length ? btn("Reprendre cette révision", async () => { if (!(await confirmBox("Reprendre cette révision", `Le ${REVIEW_KINDS[kind].toLowerCase()} ${now.id} du projet redevient ${rec.pn} rév. ${rec.rev}. Ce qui a été fait depuis reste annulable (Ctrl + Z) ; les révisions libérées ne bougent pas.`, "Reprendre"))) return;
          store.commit(`${now.id} : retour à ${rec.id}`, (x) => { restore(x, rec.id); }); m.close(); toast(`${now.id} est revenu à ${rec.pn} rév. ${rec.rev}.`, "success"); }, { icon: "undo" }) : null)], { wide: true });
  }
  async function toDrive() {
    if (!session.account && !(await connect())) return;
    const files = releaseFiles(store.project, toDwiz, TREE.revisions); if (!files.length) { toast("Aucune révision libérée à ranger.", "info"); return; }
    try { await session.fs.saveProject(store.project); const r = await session.fs.publish(store.project, files); toast(`${r.files.length} révision(s) rangée(s) dans Drive, un dossier chacune (06_Revisions).`, "success", 7000); } catch (e) { toast(`Drive : ${e.message}`, "error", 8000); }
  }
  function draw() {
    const p = store.project, all = releases(p), head = el("div", { class: "page-head" }, el("div", { class: "grow" }, el("h1", null, "Révisions"),
      el("p", { class: "muted" }, "Libérer une pièce, un assemblage ou une carte lui donne son numéro et fige sa révision. Ensuite, la règle forme · ajustement · fonction décide : ce qui reste interchangeable prend la révision suivante ; ce qui ne l'est plus reçoit un nouveau numéro, qui garde la trace de celui dont il dérive.")),
      el("div", { class: "subtabs", style: { width: "100%" } }, el("a", { class: "subtab", href: "#/review" }, "Artéfacts"), el("a", { class: "subtab", href: "#/mvp" }, "Itérations MVP"), el("a", { class: "subtab", href: "#/team" }, "Équipe"), el("a", { class: "subtab active", href: "#/plm" }, "Révisions")));
    const sections = [head];
    for (const kind of Object.keys(REF_TYPES)) { const list = p[LISTS[kind]] || []; if (!list.length) continue;
      sections.push(el("section", { class: "card", "data-kind": kind }, el("h2", null, `${REVIEW_KINDS[kind]}s`), list.map((d) => { const key = `${kind}:${d.id}`, plan = planOf(key), mine = all.filter((r) => r.key === key), V = VERDICT[plan.action], comp = kind === "assembly" && mine.length ? compatibility(p, key).filter((c) => !c.ok) : [];
        return el("div", { class: "side-section", "data-item": key }, el("div", { style: { display: "flex", gap: ".5rem", alignItems: "center", flexWrap: "wrap" } }, el("b", null, d.id), el("span", { class: "grow" }, d.name || ""),
            d.pn ? el("code", { "data-tip": d.derivedFrom ? `Dérive de ${d.derivedFrom.pn} rév. ${d.derivedFrom.rev} — ${d.derivedFrom.why}` : "Son numéro" }, `${d.pn} · rév. ${d.revision || "A"}`) : el("span", { class: "muted small" }, "pas encore de numéro"), badge(V[0], V[1]),
            btn(mine.length ? "Libérer la suite…" : "Libérer…", () => ask(key), { small: true, primary: plan.action !== "none", icon: "lock", disabled: plan.action === "none", tip: sentence(d, plan) }),
            mine.length ? btn("", () => { open = open === key ? null : key; draw(); }, { small: true, icon: open === key ? "chevron-down" : "chevron-right", tip: `${mine.length} révision(s) libérée(s)` }) : null),
          plan.action === "number" ? el("p", { class: "form-error small", style: { margin: ".25rem 0 0" } }, f3Text(plan.f3)) : null,
          plan.blockers.length ? el("p", { class: "muted small", style: { margin: ".25rem 0 0" } }, `À libérer d'abord : ${plan.blockers.map((b) => b.split(" : ")[0]).join(", ")}.`) : null,
          comp.length ? el("ul", { class: "decisions", style: { fontSize: ".82rem" } }, comp.map((c) => el("li", null, `${c.part} : ${c.pinned ? `libéré avec ${c.pinned.pn} rév. ${c.pinned.rev}` : c.kind === "assembly" ? "absent de la libération" : "absente de la libération"}${c.now ? ` — aujourd'hui ${c.now.pn || "sans numéro"} rév. ${c.now.rev}` : ""} — ${c.text}`))) : null,
          open === key ? table(["Révision", "Libérée le", "Dérive de", "Forme · ajustement · fonction", ""], [...mine].reverse().map((r) => [el("code", { class: "nowrap" }, `${r.pn} · ${r.rev}`), el("span", { class: "nowrap" }, day(r.at)), r.from ? `${r.from.pn} rév. ${r.from.rev}` : "—", r.f3 ? (r.f3.ok ? "conservés" : r.f3.text) : "première libération", btn("Ouvrir", () => look(r), { small: true })])) : null); })));
    }
    sections.push(el("section", { class: "card" }, el("h2", null, `Révisions libérées `, el("small", { class: "muted" }, `— ${all.length}`)),
      el("p", { class: "muted small" }, "Le projet ouvre toujours l'état le plus récent ; chaque révision libérée reste entière, à ouvrir, comparer ou reprendre. Dans Drive, chacune a son dossier : « numéro_révision nom »."),
      el("div", { class: "form-actions", style: { justifyContent: "flex-start" } }, btn("Ranger les révisions dans Drive", toDrive, { icon: "cloud", disabled: !all.length, tip: "Un dossier par révision libérée, dans 06_Revisions, avec son fichier .dwiz figé" })),
      all.length ? null : el("p", { class: "atelier-hint" }, icon("info"), " Rien n'est encore libéré. Commencez par les pièces, puis les sous-assemblages : un assemblage se libère avec la révision de chacun.")));
    body.replaceChildren(...sections);
  }
  const off = store.on("change", () => { if (store.project && alive) { draw(); measure(); } });
  draw(); measure();
  return () => { alive = false; off(); };
}

registerModule({ key: "plm", label: "Révisions", icon: "lock", hidden: true, tip: "Libérer : numéro, révisions figées, règle forme · ajustement · fonction", render });
