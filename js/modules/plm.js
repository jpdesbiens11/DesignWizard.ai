/* DynamiteOrbit.ai — Révisions : FREEZING a part, an assembly or a board, then releasing it. Each receives its number ; freezing
   fixes a revision that never changes again, and a lean design review — an approver who is not the author — releases it or
   refuses it (modules/plm_review.js). The name and the state of each revision are shown on its line. The screen says, for every item, what releasing it now would do — the next revision
   when form, fit and function hold, a new number when they do not — and why ; an assembly shows the revision of each part
   it was released with, and what moved since. Every released revision can be looked at, compared, downloaded, taken back,
   and filed in its own folder in Drive. Route : #/plm. The rule is in core/plm.js. */

import { el, btn, badge, toast, modal, icon, download, table, confirmBox, field } from "../core/dom.js";
import { registerModule } from "../core/app.js";
import { store } from "../core/store.js";
import { kernel } from "../cad/client.js";
import { buildAssembly } from "../core/asm_scene.js";
import { toDwiz } from "../core/dwiz.js";
import { session } from "../core/access.js";
import { aiDiff } from "../core/ai_loop.js";
import { REVIEW_KINDS } from "../core/review.js";
import { planRelease, release, releases, compatibility, restore, releaseFiles, releaseName, f3Text, REF_TYPES } from "../core/plm.js";
import { REV_STATES, revisionOf, stateOf } from "../core/plm_review.js";
import { revisionChip, openReview } from "./plm_review.js";
import { TREE } from "../google/drive_fs.js";
import { connect } from "./account.js";

const LISTS = { part: "parts", assembly: "assemblies", board: "boards" }, day = (s) => String(s || "").slice(0, 10);
const VERDICT = { first: ["À geler", "neutral"], none: ["À jour", "ok"], revision: ["Révision suivante à geler", "info"], number: ["Nouveau numéro", "danger"] };

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
  const sentence = (d, plan) => (plan.action === "first" ? `Premier gel : un numéro lui est attribué, révision ${plan.rev}.`
    : plan.action === "none" ? `${d.pn} rév. ${plan.rev} : rien n'a changé depuis son gel.`
      : plan.action === "revision" ? `Forme, ajustement et fonction conservés : révision ${plan.rev} du numéro ${d.pn}.${plan.moved && plan.moved.length ? ` Ce qui a avancé depuis : ${plan.moved.join(", ")}.` : ""}`
        : `Forme, ajustement ou fonction rompus — ${f3Text(plan.f3)}. Un NOUVEAU numéro lui est attribué, révision A ; il garde la trace de ${plan.from.pn} rév. ${plan.from.rev}, dont il dérive.`);
  function ask(key) {
    const p = store.project, kind = key.split(":")[0], art = (p[LISTS[kind]] || []).find((x) => `${kind}:${x.id}` === key), plan = planOf(key); if (!art || !plan) return;
    const who = el("input", { type: "text", "data-freeze-by": "", value: (p.team && p.team.owner) || "", placeholder: "Votre nom", autocomplete: "off" });
    const m = modal(`Geler la révision de ${art.id}`, [el("p", null, sentence(art, plan)),
      plan.f3 && !plan.f3.judged.form ? el("p", { class: "muted small" }, "La forme (enveloppe, masse) n'a pas pu être comparée : seuls l'ajustement et la fonction ont été jugés.") : null,
      plan.blockers.length ? el("div", null, el("h3", null, "À faire d'abord"), el("ul", { class: "decisions" }, plan.blockers.map((b) => el("li", { class: "form-error" }, b)))) : null,
      field("Auteur de la révision — l'approbateur sera quelqu'un d'autre", who),
      el("p", { class: "muted small" }, "Une révision gelée ne change plus jamais : tout changement ouvrira la révision suivante. Elle n'est pas encore libérée — sa revue de conception, par quelqu'un d'autre que son auteur, la libère ou la refuse."),
      el("div", { class: "form-actions" }, btn("Annuler", () => m.close()), btn(plan.action === "number" ? "Geler sous un nouveau numéro" : "Geler la révision", () => {
        if (!who.value.trim()) { who.focus(); toast("Nommez l'auteur de la révision : la revue demandera un approbateur qui n'est pas lui.", "info", 6000); return; }
        try { let rec = null; store.commit(`${art.id} : révision gelée`, (x) => { rec = release(x, key, { date: new Date(), by: who.value.trim(), form: forms.get(key) }); }); m.close(); open = key; if (rec && rec.done) toast(`${rec.pn} rév. ${rec.rev} gelée. Sa revue de conception la libérera.`, "success", 7000); }
        catch (e) { toast(e.message, "error", 8000); } }, { primary: true, icon: "lock", disabled: plan.action === "none" || plan.blockers.length > 0 }))], { wide: true });
  }
  /* one released revision : what differs from the item of today, its file, and the way back */
  function look(rec) {
    const p = store.project, kind = rec.key.split(":")[0], now = (p[LISTS[kind]] || []).find((x) => `${kind}:${x.id}` === rec.key), diff = now ? aiDiff(rec.doc, now).slice(0, 14) : [], name = releaseName(rec.pn, rec.rev, rec.name);
    const m = modal(name, [el("p", null, revisionChip({ name: `${rec.pn} rév. ${rec.rev}`, state: stateOf(rec) }), rec.review ? ` ${rec.review.decision === "released" ? "Libérée" : "Refusée"} le ${day(rec.review.at)} par ${rec.review.by}.` : " En attente de sa revue de conception."), el("p", { class: "muted" }, `Gelée le ${day(rec.at)}${rec.by ? ` par ${rec.by}` : ""}${rec.from ? ` — dérive de ${rec.from.pn} rév. ${rec.from.rev}` : ""}${rec.f3 ? ` — ${rec.f3.ok ? "3F conservé" : `3F rompu : ${rec.f3.text}`}` : ""}.`),
      rec.uses ? el("div", null, el("h3", null, "Gelée avec"), el("ul", { class: "decisions" }, [...Object.entries(rec.subs || {}).map(([id, u]) => el("li", null, icon("assembly"), ` ${id} — ${u.pn} rév. ${u.rev} (sous-assemblage)`)), ...Object.entries(rec.uses).map(([id, u]) => el("li", null, `${id} — ${u.pn} rév. ${u.rev}`))])) : null,
      el("h3", null, now ? (diff.length ? "Ce qui a changé depuis, dans le projet" : "Le projet est encore à cette révision") : "L'artéfact n'est plus dans le projet"), diff.length ? el("ul", { class: "decisions", style: { fontSize: ".82rem" } }, diff.map((x) => el("li", null, x.text))) : null,
      el("div", { class: "form-actions" }, btn("Fermer", () => m.close()), btn("Télécharger le .dwiz", () => download(`${name}.dwiz`, toDwiz(rec.doc), "text/plain;charset=utf-8"), { icon: "download" }),
        now && diff.length ? btn("Reprendre cette révision", async () => { if (!(await confirmBox("Reprendre cette révision", `Le ${REVIEW_KINDS[kind].toLowerCase()} ${now.id} du projet redevient ${rec.pn} rév. ${rec.rev}. Ce qui a été fait depuis reste annulable (Ctrl + Z) ; les révisions gelées ne bougent pas.`, "Reprendre"))) return;
          store.commit(`${now.id} : retour à ${rec.id}`, (x) => { restore(x, rec.id); }); m.close(); toast(`${now.id} est revenu à ${rec.pn} rév. ${rec.rev}.`, "success"); }, { icon: "undo" }) : null)], { wide: true });
  }
  async function toDrive() {
    if (!session.account && !(await connect())) return;
    const files = releaseFiles(store.project, toDwiz, TREE.revisions); if (!files.length) { toast("Aucune révision gelée à ranger.", "info"); return; }
    try { await session.fs.saveProject(store.project); const r = await session.fs.publish(store.project, files); toast(`${r.files.length} révision(s) rangée(s) dans Drive, un dossier chacune (06_Revisions).`, "success", 7000); } catch (e) { toast(`Drive : ${e.message}`, "error", 8000); }
  }
  function draw() {
    const p = store.project, all = releases(p), head = el("div", { class: "page-head" }, el("div", { class: "grow" }, el("h1", null, "Révisions"),
      el("p", { class: "muted" }, "Geler une pièce, un assemblage ou une carte lui donne son numéro et fige sa révision : elle ne change plus. Sa revue de conception — par quelqu'un d'autre que son auteur — la libère ensuite, ou la refuse. La règle forme · ajustement · fonction décide de la suite : ce qui reste interchangeable prend la révision suivante ; ce qui ne l'est plus reçoit un nouveau numéro, qui garde la trace de celui dont il dérive."),
        el("p", { class: "rev-legend" }, Object.entries(REV_STATES).map(([k, S]) => el("span", { class: `rev-chip ${k}`, style: `--dom:${S.color}`, "data-tip": S.text }, icon(S.icon), el("b", null, S.label), el("small", null, S.en))))),
      el("div", { class: "subtabs", style: { width: "100%" } }, el("a", { class: "subtab", href: "#/review" }, "Artéfacts"), el("a", { class: "subtab", href: "#/mvp" }, "Itérations MVP"), el("a", { class: "subtab", href: "#/team" }, "Équipe"), el("a", { class: "subtab active", href: "#/plm" }, "Révisions")));
    const sections = [head];
    for (const kind of Object.keys(REF_TYPES)) { const list = p[LISTS[kind]] || []; if (!list.length) continue;
      sections.push(el("section", { class: "card", "data-kind": kind }, el("h2", null, `${REVIEW_KINDS[kind]}s`), list.map((d) => { const key = `${kind}:${d.id}`, plan = planOf(key), mine = all.filter((r) => r.key === key), V = VERDICT[plan.action], info = revisionOf(p, key, d), comp = kind === "assembly" && mine.length ? compatibility(p, key).filter((c) => !c.ok) : [];
        return el("div", { class: "side-section", "data-item": key }, el("div", { style: { display: "flex", gap: ".5rem", alignItems: "center", flexWrap: "wrap" } }, el("b", null, d.id), el("span", { class: "grow" }, d.name || ""),
            revisionChip(info), plan.action !== "none" ? badge(V[0], V[1]) : null,
            info.rec && info.state === "frozen" ? (() => { const b = btn("Revue de conception…", () => openReview(info.rec), { small: true, primary: plan.action === "none", icon: "check", tip: "La revue qui libère cette révision gelée, ou la refuse : un approbateur autre que son auteur" }); b.dataset.revReview = ""; return b; })() : null,
            (() => { const b = btn(mine.length ? "Geler la révision suivante…" : "Geler la révision…", () => ask(key), { small: true, primary: plan.action !== "none" && !(info.rec && info.state === "frozen"), icon: "lock", disabled: plan.action === "none", tip: sentence(d, plan) }); b.dataset.revFreeze = ""; return b; })(),
            mine.length ? btn("", () => { open = open === key ? null : key; draw(); }, { small: true, icon: open === key ? "chevron-down" : "chevron-right", tip: `${mine.length} révision(s) au dossier` }) : null),
          plan.action === "number" ? el("p", { class: "form-error small", style: { margin: ".25rem 0 0" } }, f3Text(plan.f3)) : null,
          plan.blockers.length ? el("p", { class: "muted small", style: { margin: ".25rem 0 0" } }, `À geler d'abord : ${plan.blockers.map((b) => b.split(" : ")[0]).join(", ")}.`) : null,
          comp.length ? el("ul", { class: "decisions", style: { fontSize: ".82rem" } }, comp.map((c) => el("li", null, `${c.part} : ${c.pinned ? `gelé avec ${c.pinned.pn} rév. ${c.pinned.rev}` : c.kind === "assembly" ? "absent du gel" : "absente du gel"}${c.now ? ` — aujourd'hui ${c.now.pn || "sans numéro"} rév. ${c.now.rev}` : ""} — ${c.text}`))) : null,
          open === key ? table(["Révision", "Gelée le", "Revue", "Dérive de", "Forme · ajustement · fonction", ""], [...mine].reverse().map((r) => [revisionChip({ name: `${r.pn} rév. ${r.rev}`, state: stateOf(r) }), el("span", { class: "nowrap" }, `${day(r.at)}${r.by ? ` · ${r.by}` : ""}`), r.review ? `${day(r.review.at)} · ${r.review.by}` : "à faire", r.from ? `${r.from.pn} rév. ${r.from.rev}` : "—", r.f3 ? (r.f3.ok ? "conservés" : r.f3.text) : "première révision", el("span", { class: "nowrap" }, btn("Ouvrir", () => look(r), { small: true }), " ", btn(stateOf(r) === "frozen" ? "Revue…" : "Sa revue", () => openReview(r), { small: true, icon: "check" }))])) : null); })));
    }
    sections.push(el("section", { class: "card" }, el("h2", null, `Révisions au dossier `, el("small", { class: "muted" }, `— ${all.length} : ${all.filter((r) => stateOf(r) === "released").length} libérée(s), ${all.filter((r) => stateOf(r) === "frozen").length} gelée(s) en attente de revue`)),
      el("p", { class: "muted small" }, "Le projet ouvre toujours l'état le plus récent ; chaque révision gelée reste entière, à ouvrir, comparer ou reprendre. Dans Drive, chacune a son dossier : « numéro_révision nom »."),
      el("div", { class: "form-actions", style: { justifyContent: "flex-start" } }, btn("Ranger les révisions dans Drive", toDrive, { icon: "cloud", disabled: !all.length, tip: "Un dossier par révision gelée, dans 06_Revisions, avec son fichier .dwiz figé" })),
      all.length ? null : el("p", { class: "atelier-hint" }, icon("info"), " Rien n'est encore gelé. Commencez par les pièces, puis les sous-assemblages : un assemblage se gèle avec la révision de chacun, et ne se libère qu'une fois chacun libéré.")));
    body.replaceChildren(...sections);
  }
  const off = store.on("change", () => { if (store.project && alive) { draw(); measure(); } });
  draw(); measure();
  return () => { alive = false; off(); };
}

registerModule({ key: "plm", label: "Révisions", icon: "lock", hidden: true, tip: "Geler une révision, puis la libérer par une revue de conception : numéro, révisions figées, règle forme · ajustement · fonction", render });
