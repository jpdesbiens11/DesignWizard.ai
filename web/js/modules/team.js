/* DesignWizard.ai — Équipe : working on one project from several accounts, in mirrors. Each member keeps the whole project
   in their own storage and hands their mirror to the others ; merging a mirror takes what its owner changed, keeps what
   I changed, and sets aside — for a person to decide — what we both changed. Messages are written on an artefact or on
   the project, call a member with « @name », and travel in the mirror. Route : #/team (and #/team/<artefact> for its thread). */

import { el, btn, badge, field, toast, modal, icon, download, table, promptBox } from "../core/dom.js";
import { registerModule, go } from "../core/app.js";
import { store } from "../core/store.js";
import { toDwiz } from "../core/dwiz.js";
import { session, accessHash } from "../core/access.js";
import { CONFIG } from "../config.js";
import { aiDiff } from "../core/ai_loop.js";
import { safeName } from "../google/drive_fs.js";
import { authMessage } from "../google/auth.js";
import { loadPicker, pickFile, appIdOf, pickerMessage } from "../google/picker.js";
import { connect } from "./account.js";
import { teamOf, newTeamId, joinTeam, forkMirror, stampLocal, mergeMirror, resolveConflict, post, setDone, inbox, threads, artefacts, labelOf, cleanHandle, HANDLE } from "../core/team.js";
import { parseMirror, linksOf, linkMirror, readMirrors, applyMirrors, bringsSomething } from "../core/team_sync.js";

const KEY = "dw.handle";
const remembered = () => { try { return localStorage.getItem(KEY) || ""; } catch (e) { return ""; } };
const remember = (h) => { try { localStorage.setItem(KEY, h); } catch (e) { /* a private window : the name is asked again */ } };
const day = (s) => String(s || "").slice(0, 16).replace("T", " "), act = (label, fn) => { try { store.commit(label, fn); return true; } catch (e) { toast(e.message, "error", 7000); return false; } };
/* a member is known by a fingerprint of their account, never by its address ; salted with the team : it says nothing outside it */
const hashOf = async (teamId) => { const mail = session.account && session.account.email; try { return mail ? await accessHash(mail, `team/${teamId}`, 20000) : null; } catch (e) { return null; } };
const pickLocal = (then) => { const i = el("input", { type: "file", accept: ".dwiz,.txt" }); i.addEventListener("change", () => { if (i.files[0]) then(i.files[0]); }); i.click(); };
const suggest = () => remembered() || cleanHandle(String((session.account && session.account.email) || "").split("@")[0]) || "";
const sayGoogle = (e) => toast(e && e.status ? `Google Drive : ${e.message}` : /selecteur|sans-projet/.test(String(e && e.message)) ? pickerMessage(e) : authMessage(e), "error", 8000);
const signedIn = async () => !!(session.account || (await connect()));
/* the person points at a file in their Drive — the one a member shared with them. Pointing once is what lets the application read it again, alone. */
async function pickInDrive(o) {
  const P = await loadPicker();
  return pickFile({ picker: P, token: await session.auth.token(), appId: appIdOf(CONFIG.clientId), key: CONFIG.pickerKey, mine: false, ...o });
}

/** The name under which the person writes in this project. Asked once, when the project has no team yet : the person becomes its first member. → the handle, or null. */
export async function memberName() {
  const p = store.project; if (!p) return null; if (p.team && p.team.owner) return p.team.owner;
  const name = await promptBox("Votre nom pour les messages", "Votre nom dans l'équipe", suggest(), "2 à 24 caractères : lettres sans accent, chiffres, point, tiret. C'est par lui qu'on vous appelle : @nom."); if (!name) return null;
  const h = cleanHandle(name); if (!HANDLE.test(h)) { toast("Un nom d'équipe a 2 à 24 caractères : lettres sans accent, chiffres, point, tiret.", "warn"); return null; }
  const id = (p.team && p.team.id) || newTeamId(), hash = await hashOf(id);
  if (!act("Nom d'équipe choisi", (x) => { x.team = { ...(x.team || {}), id }; joinTeam(x, { handle: h, hash }, new Date()); stampLocal(x, h, new Date()); })) return null;
  remember(h); return h;
}
const SCREEN = { part: "#/parts/", assembly: "#/assembly/" };
/* where a pinned message shows : the 3D screen of its artefact */
const pinLink = (m) => { const i = m.on.indexOf(":"), base = SCREEN[m.on.slice(0, i)]; return base ? el("a", { class: "chip", style: { marginLeft: ".4rem" }, href: `${base}${encodeURIComponent(m.on.slice(i + 1))}`, "data-tip": "Ce message est épinglé sur la pièce : le voir dans la vue 3D" }, "épinglé sur le 3D") : null; };

/** Someone invited starts from the mirror they were given : a project of their own, lineage included. `link` : where that mirror is, in Drive. */
async function joinFromText(text, link) {
  let theirs; try { theirs = parseMirror(text); } catch (e) { toast(e.message, "error", 7000); return; }
  const name = await promptBox(`Rejoindre « ${theirs.name || "le projet"} » de @${theirs.team.owner}`, "Votre nom dans l'équipe", suggest(), "2 à 24 caractères : lettres sans accent, chiffres, point, tiret. C'est par lui qu'on vous appelle : @nom."); if (!name) return;
  try { const mine = forkMirror(theirs, { handle: name, hash: await hashOf(theirs.team.id) }, new Date()); if (link) linkMirror(mine, theirs.team.owner, link);
    remember(mine.team.owner); await store.create(theirs.name || "Projet partagé", mine);
    toast(`Vous avez votre miroir de « ${theirs.name} ». ${link ? `Partagez-le à @${theirs.team.owner} (« Partager mon miroir dans Drive… »)` : `Renvoyez-le à @${theirs.team.owner}`} pour qu'il vous voie dans l'équipe.`, "success", 9000); go("#/team"); }
  catch (e) { toast(e.message, "error", 7000); }
}
export const joinFromFile = async (file) => joinFromText(await file.text(), null);
export async function joinFromDrive() {
  if (!(await signedIn())) return;
  try { const got = await pickInDrive({ title: "Le miroir que l'on vous a partagé" }); if (got) await joinFromText(await session.drive.text(got.id), got.id); } catch (e) { sayGoogle(e); }
}

function render(main, args) {
  const page = el("div", { class: "page" }), body = el("div"), focus = args[0] ? decodeURIComponent(args.join("/")) : "";
  main.append(page); page.append(body);
  const st = { on: focus || "project", drive: null, busy: false, looked: false };
  const me = () => (store.project.team && store.project.team.owner) || "";
  /* my mirror, as the file the others read : stamped with what I changed since the last time */
  const myMirror = () => { act("Miroir mis à jour", (p) => { stampLocal(p, me(), new Date()); }); return toDwiz(store.project); };
  /* … and where the others read it, when it is in my Drive : saved there, and my entry says which file it is */
  async function pushMine() {
    myMirror();
    let r = await session.fs.saveProject(store.project); const mine = ((store.project.team || {}).members || []).find((q) => q.handle === me());
    if (mine && mine.mirror !== r.file.id) { act("Mon miroir est dans Drive", (p) => { linkMirror(p, me(), r.file.id); }); r = await session.fs.saveProject(store.project); }
    return r.file;
  }
  /* what was read from Drive no longer describes the project once a merge or a decision is applied : look again */
  const relook = () => { st.drive = null; st.looked = false; };
  /* what the mirrors read would bring : one block per member, nothing applied before the person says so */
  function preview(results, dry, link, after) {
    const ok = results.filter((r) => r.state === "ok"), bad = results.filter((r) => r.state !== "ok"), nothing = !bringsSomething(results), L = (k) => labelOf(dry, k);
    const conflicts = ok.reduce((n, r) => n + r.report.conflicts.length, 0), who = ok.map((r) => `@${r.handle}`).join(", ");
    const sec = (title, keys, cls) => (keys.length ? el("div", null, el("h3", null, `${title} (${keys.length})`), el("ul", { class: "decisions" }, keys.map((k) => el("li", { class: cls || null }, L(k))))) : null);
    const block = (r) => { const rep = r.report; return el("div", { class: ok.length > 1 ? "side-section" : null, "data-mirror": r.handle }, ok.length > 1 ? el("h3", null, el("span", { class: "grow" }, `@${rep.from}`), rep.nothing ? badge("rien de nouveau", "ok") : null) : null,
      sec(`Repris de @${rep.from}`, rep.taken), sec("Ajoutés", rep.added), sec("Retirés", rep.removed), sec("Gardés : les vôtres sont plus récents", rep.kept), sec("Conflits : modifiés des deux côtés — le vôtre reste, le sien attend votre décision", rep.conflicts, "form-error"),
      rep.messages || rep.members.length ? el("p", { class: "muted" }, [rep.messages ? `${rep.messages} nouveau(x) message(s)` : null, rep.members.length ? `nouveau(x) dans l'équipe : ${rep.members.map((h) => `@${h}`).join(", ")}` : null].filter(Boolean).join(" · ")) : null); };
    const m = modal(ok.length === 1 ? `Miroir de @${ok[0].handle}` : "Miroirs de l'équipe", [
      !ok.length ? el("p", { class: "atelier-hint" }, icon("info"), " Aucun miroir n'a pu être lu.") : nothing ? el("p", { class: "atelier-hint" }, icon("check"), ` Rien de nouveau : votre miroir et ${ok.length > 1 ? "ceux" : "celui"} de ${who} disent la même chose.`) : el("p", null, `Ce que ${who} ${ok.length > 1 ? "ont" : "a"} changé arrive chez vous ; ce que vous avez changé reste, et partira avec votre miroir.`),
      ok.map(block), bad.length ? el("div", null, el("h3", null, `Pas lus (${bad.length})`), el("ul", { class: "decisions" }, bad.map((r) => el("li", { class: "form-error" }, `@${r.handle} — ${r.state === "denied" ? "ce compte n'a pas encore le droit de lire son fichier : « Désigner… » dans le tableau des membres" : r.error}`)))) : null,
      el("div", { class: "form-actions" }, btn(ok.length ? "Annuler" : "Fermer", () => m.close()), ok.length ? btn(nothing ? "Noter la lecture" : "Fusionner", () => { relook(); if (act(ok.length === 1 ? `Miroir de @${ok[0].handle} fusionné` : "Miroirs de l'équipe fusionnés", (p) => { applyMirrors(p, results, me(), new Date()); if (link) linkMirror(p, link.handle, link.id); })) {
        m.close(); toast(`${ok.length === 1 ? `Miroir de @${ok[0].handle} fusionné` : "Miroirs fusionnés"}${conflicts ? ` — ${conflicts} conflit(s) à trancher` : ""}.`, conflicts ? "warn" : "success", 6000); if (after) after(); } }, { primary: true, icon: "check" }) : null)], { wide: true });
  }
  /* one mirror, from a file or from Drive : read on a copy, shown, then applied */
  function mergeOne(theirs, link) {
    const dry = JSON.parse(JSON.stringify(store.project)); let report;
    try { report = mergeMirror(dry, theirs, me(), new Date()); } catch (e) { toast(e.message, "error", 7000); return; }
    preview([{ handle: report.from, state: "ok", theirs, report }], dry, link, link && session.account ? () => pushMine().catch(sayGoogle) : null);
  }
  async function mergeFile(file) { try { mergeOne(parseMirror(await file.text()), null); } catch (e) { toast(e.message, "error", 7000); } }
  /* a member's mirror, pointed at in Drive : `m` when the file must be theirs */
  async function mergeFromDrive(m) {
    if (!(await signedIn())) return;
    try {
      const got = await pickInDrive({ fileIds: m && m.mirror ? [m.mirror] : null, title: m ? `Le miroir de @${m.handle}` : "Le miroir qu'un membre vous a partagé" });
      if (!got) { if (m && m.mirror) toast(`Si la liste était vide : @${m.handle} ne vous a pas encore partagé son miroir (« Partager mon miroir dans Drive… », avec votre adresse).`, "info", 9000); return; }
      const theirs = parseMirror(await session.drive.text(got.id));
      if (m && theirs.team.owner !== m.handle) { toast(`Ce fichier est le miroir de @${theirs.team.owner}, pas celui de @${m.handle}.`, "warn", 7000); return; }
      mergeOne(theirs, { handle: theirs.team.owner, id: got.id });
    } catch (e) { sayGoogle(e); }
  }
  /* every mirror I know where to find : mine is saved first, theirs are read, the whole is shown, then applied in one step.
     quiet : only look (when the screen opens), say nothing and change nothing. */
  async function syncDrive(quiet) {
    if (st.busy || (!quiet && !(await signedIn()))) return;
    st.busy = true; if (!quiet) draw();
    try {
      if (!quiet) await pushMine();
      const { results, dry } = await readMirrors(store.project, me(), (id) => session.drive.text(id), new Date());
      st.drive = results;
      if (!quiet && results.length && results.every((r) => r.state === "ok" && r.report.nothing)) toast(`Rien de nouveau chez ${results.map((r) => `@${r.handle}`).join(", ")} : vos miroirs disent la même chose.`, "success", 5000);
      else if (!quiet) { if (!results.length) toast("Aucun miroir n'est encore lié. « Lire un miroir dans Drive… » : désignez une fois le fichier qu'un membre vous a partagé.", "info", 9000); else preview(results, dry, null, () => pushMine().catch(sayGoogle)); }
    } catch (e) { if (!quiet) sayGoogle(e); } finally { st.busy = false; draw(); }
  }
  async function shareInDrive() {
    if (!(await signedIn())) return;
    const mail = await promptBox("Partager mon miroir dans Drive", "Adresse Google de la personne", "", "Elle reçoit de Google un lien vers le fichier du projet, en lecture. L'adresse n'est envoyée qu'à Google et n'est pas gardée dans le projet."); if (!mail) return;
    try { const f = await pushMine(); await session.drive.share(f.id, mail.trim());
      toast(`Partagé : « ${f.name} » est dans ses « Partagés avec moi ». Dans DesignWizard, elle choisit « Rejoindre depuis Drive… » — ou « Lire un miroir dans Drive… » si elle est déjà dans l'équipe.`, "success", 11000);
    } catch (e) { toast(`Partage impossible : ${e.message}`, "error", 8000); }
  }
  function draw() {
    const p = store.project, t = p.team, head = el("div", { class: "page-head" }, el("div", { class: "grow" }, el("h1", null, "Équipe"),
      el("p", { class: "muted" }, "Un projet commun sans copie centrale : chacun garde le projet entier chez lui — son miroir — et le donne à lire aux autres. Fusionner un miroir reprend ce que l'autre a changé, garde ce que vous avez changé, et met de côté ce que vous avez changé tous les deux.")),
      el("div", { class: "subtabs", style: { width: "100%" } }, el("a", { class: "subtab", href: "#/review" }, "Artéfacts"), el("a", { class: "subtab", href: "#/mvp" }, "Itérations MVP"), el("a", { class: "subtab active", href: "#/team" }, "Équipe")));
    if (!t || !t.owner) {
      const name = el("input", { type: "text", value: suggest(), placeholder: "ex. : jp" });
      body.replaceChildren(head, el("section", { class: "card taped" }, el("h2", null, "Ce projet n'est pas encore partagé"), el("div", { class: "form-row" }, field("Votre nom dans l'équipe", name, "C'est par lui qu'on vous appelle dans un message : @nom"),
        el("div", { class: "form-actions", style: { alignItems: "flex-end" } }, btn("Partager ce projet", () => { const h = cleanHandle(name.value); if (!HANDLE.test(h)) { toast("Un nom d'équipe a 2 à 24 caractères : lettres sans accent, chiffres, point, tiret.", "warn"); return; } const id = (p.team && p.team.id) || newTeamId(); hashOf(id).then((hash) => { if (act("Projet partagé", (x) => { x.team = { ...(x.team || {}), id }; joinTeam(x, { handle: h, hash }, new Date()); stampLocal(x, h, new Date()); })) remember(h); }); }, { primary: true, icon: "link" }),
          btn("Rejoindre depuis Drive…", joinFromDrive, { icon: "cloud", tip: "On vous a partagé un miroir dans Drive : désignez-le, il devient votre propre copie du projet" }),
          btn("Rejoindre depuis un fichier…", () => pickLocal(joinFromFile), { icon: "download", tip: "Vous avez reçu le fichier du miroir de quelqu'un" }))),
        el("p", { class: "muted small" }, "Rien ne quitte votre poste ou votre Drive tant que vous ne donnez pas votre miroir à quelqu'un.")));
      return;
    }
    const mine = me(), T = teamOf(p), box = inbox(p, mine), th = threads(p), keys = [...artefacts(p).keys()].filter((k) => !k.startsWith("project:"));
    const news = (r) => r.report.taken.length + r.report.added.length + r.report.removed.length + r.report.messages + r.report.members.length > 0;
    const read = new Map((st.drive || []).map((r) => [r.handle, r])), point = (m) => btn(m.mirror ? "Désigner…" : "Lier…", () => mergeFromDrive(m), { small: true, icon: "cloud", tip: `Désignez une fois, dans votre Drive, le miroir que @${m.handle} vous a partagé : l'application pourra ensuite le relire seule` });
    const inDrive = (m) => { const r = read.get(m.handle);
      if (m.handle === mine) return m.mirror ? badge("dans mon Drive", "ok") : el("span", { class: "muted" }, "—");
      if (!m.mirror) return point(m);
      if (!r) return el("span", { class: "muted" }, st.busy ? "lecture…" : session.account ? "lié" : "lié — connectez-vous pour le lire");
      if (r.state === "ok") return r.report.nothing ? badge("à jour", "ok") : news(r) ? badge("du nouveau", "warn") : badge("conflit à trancher", "warn");
      if (r.state === "denied") return el("span", null, badge("à désigner", "warn"), " ", point(m));
      return el("span", { class: "form-error", "data-tip": r.error }, "illisible"); };
    const fresh = (st.drive || []).filter((r) => r.state === "ok" && news(r)).map((r) => `@${r.handle}`);
    const team = el("section", { class: "card taped" }, el("h2", null, `@${mine} `, el("small", { class: "muted" }, `— ${T.members.length} membre(s)`)),
      table(["Membre", "Dans l'équipe depuis", "Son miroir, lu le", "Dans Drive", "Messages"], T.members.map((m) => [el("span", null, el("b", null, `@${m.handle}`), m.handle === mine ? badge("moi", "info") : null), day(m.since).slice(0, 10), m.handle === mine ? "—" : (T.pulled || {})[m.handle] ? day(T.pulled[m.handle]) : el("span", { class: "form-error" }, "jamais"), inDrive(m), String((p.talk || []).filter((x) => x.by === m.handle).length)])),
      fresh.length ? el("p", { class: "atelier-hint" }, icon("info"), ` Du nouveau chez ${fresh.join(", ")} : « Synchroniser » montre ce qui arrive avant de l'appliquer.`) : null,
      el("div", { class: "form-actions", style: { justifyContent: "flex-start", flexWrap: "wrap" } },
        btn(st.busy ? "Lecture des miroirs…" : "Synchroniser", () => syncDrive(false), { icon: "refresh", primary: true, disabled: st.busy, tip: "Enregistre votre miroir dans votre Drive, relit ceux des membres liés, montre ce qui arrive, puis fusionne en une étape annulable" }),
        btn("Lire un miroir dans Drive…", () => mergeFromDrive(null), { icon: "cloud", tip: "Un membre vous a partagé son miroir : désignez-le une fois, il sera relu à chaque synchronisation" }),
        btn("Partager mon miroir dans Drive…", shareInDrive, { icon: "link", tip: "Donne à une personne le droit de lire le fichier du projet dans votre Drive" })),
      el("div", { class: "form-actions", style: { justifyContent: "flex-start", flexWrap: "wrap" } }, el("span", { class: "muted small" }, "Sans Drive, par fichier :"),
        btn("Télécharger mon miroir", () => download(`${safeName(p.name || p.id)}.miroir-${mine}.dwiz`, myMirror(), "text/plain;charset=utf-8"), { icon: "download", small: true, tip: "Le projet entier, tel qu'il est chez vous : à donner aux autres membres, par le canal de votre choix" }),
        btn("Fusionner un fichier…", () => pickLocal(mergeFile), { icon: "upload", small: true, tip: "Le miroir d'un membre, reçu en fichier : aperçu de ce qui arrive, puis une seule étape annulable" })),
      el("p", { class: "muted small" }, "Inviter quelqu'un : partagez-lui votre miroir ; il choisit « Rejoindre depuis Drive… », puis vous partage le sien, que vous désignez une fois. Chaque miroir est complet : c'est aussi une sauvegarde chez chaque membre."));
    const sections = [head, team];
    if (T.conflicts.length) sections.push(el("section", { class: "card" }, el("h2", null, `À trancher (${T.conflicts.length})`), el("p", { class: "muted small" }, "Modifié chez vous et chez l'autre, chacun de son côté. Le vôtre est en place ; le sien est gardé ici, entier. Votre choix vaut pour toute l'équipe : il part avec votre miroir."),
      T.conflicts.map((c) => { const cur = artefacts(p).get(c.key), diff = c.doc && cur ? aiDiff(cur, c.doc).slice(0, 6) : [];
        return el("div", { class: "card", style: { padding: ".55rem .7rem", marginBottom: ".5rem" }, "data-conflict": c.key }, el("div", { style: { display: "flex", gap: ".5rem", alignItems: "center", flexWrap: "wrap" } }, el("b", { class: "grow" }, labelOf(p, c.key)), badge(`@${c.by} · ${day(c.at)}`, "warn"),
          btn("Garder le mien", () => { relook(); act(`Conflit sur ${c.key} : le mien gardé`, (x) => { resolveConflict(x, c.key, c.by, "mine", mine, new Date()); }); }, { small: true }), btn(c.doc ? `Prendre celui de @${c.by}` : `Le retirer, comme @${c.by}`, () => { relook(); act(`Conflit sur ${c.key} : celui de @${c.by} pris`, (x) => { resolveConflict(x, c.key, c.by, "theirs", mine, new Date()); }); }, { small: true, primary: true })),
          c.doc ? el("ul", { class: "decisions", style: { fontSize: ".8rem" } }, diff.map((d) => el("li", null, d.text))) : el("p", { class: "small" }, `@${c.by} l'a retiré.`)); })));
    /* messages : what calls me first, then a place to write, then every thread */
    const text = el("input", { type: "text", placeholder: "Écrire à l'équipe… @nom appelle un membre", "aria-label": "Message" });
    const send = () => { if (!text.value.trim()) return; const v = text.value; if (act("Message envoyé", (x) => { post(x, { by: mine, on: st.on, text: v, date: new Date() }); })) text.value = ""; };
    text.addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
    const subject = el("select", { "aria-label": "Sujet du message", onChange: (e) => { st.on = e.target.value; } }, el("option", { value: "project", selected: st.on === "project" }, "Le projet"), keys.map((k) => el("option", { value: k, selected: k === st.on }, labelOf(p, k))));
    const line = (m) => el("div", { class: "param", style: { gridTemplateColumns: "minmax(0,1fr) auto", alignItems: "start", opacity: m.done ? 0.55 : 1 }, "data-msg": m.id }, el("div", { style: m.re ? { paddingLeft: "1.1rem" } : null }, el("b", null, `${m.re ? "↳ " : ""}@${m.by}`), el("small", { class: "muted" }, ` ${day(m.at)}`), m.pin ? pinLink(m) : null, el("div", { style: m.done ? { textDecoration: "line-through" } : null }, m.text), m.done ? el("small", { class: "muted" }, `fait — @${m.done.by}`) : null),
      el("label", { class: "check small", "data-tip": "Coché : la demande est traitée, pour tout le monde" }, el("input", { type: "checkbox", checked: !!m.done, onChange: (e) => act(e.target.checked ? "Message traité" : "Message rouvert", (x) => { setDone(x, m.id, mine, e.target.checked, new Date()); }) }), "fait"));
    sections.push(el("section", { class: "card" }, el("h2", null, "Messages ", box.length ? badge(`${box.length} pour moi`, "danger") : badge("rien ne m'attend", "ok")),
      box.length ? el("div", null, el("h3", null, "Pour moi"), box.map((m) => el("div", null, el("a", { class: "muted small", href: `#/team/${encodeURIComponent(m.on)}` }, labelOf(p, m.on)), line(m)))) : null,
      el("div", { class: "form-row", style: { alignItems: "flex-end" } }, field("Sujet", subject), el("div", { class: "grow", style: { flex: 3 } }, field("Message", text)), el("div", { class: "form-actions" }, btn("Envoyer", send, { primary: true, icon: "check" }))),
      el("div", { class: "atelier-chips" }, T.members.filter((m) => m.handle !== mine).map((m) => el("button", { class: "chip", type: "button", "data-tip": "Appeler ce membre dans le message", onClick: () => { text.value = `${text.value}${text.value && !/\s$/.test(text.value) ? " " : ""}@${m.handle} `; text.focus(); } }, `@${m.handle}`))),
      th.map((x) => el("div", { class: "side-section", "data-thread": x.on }, el("h3", null, el("span", { class: "grow" }, x.label), x.open ? badge(`${x.open} ouvert(s)`, "warn") : badge("tout est traité", "ok"), btn("", () => { st.on = x.on; draw(); }, { small: true, icon: "edit", tip: "Écrire sur ce sujet" })), x.items.map(line))),
      th.length ? null : el("p", { class: "muted" }, "Aucun message encore. Un message s'écrit sur le projet ou sur un artéfact : il suit sa conception, et part dans votre miroir.")));
    body.replaceChildren(...sections);
    if (!st.looked && session.account && session.drive && linksOf(p, mine).length) { st.looked = true; syncDrive(true); }
    if (focus) { const n = body.querySelector(`[data-thread="${CSS.escape(focus)}"]`); if (n && n.scrollIntoView) n.scrollIntoView({ block: "center" }); }
  }
  const off = store.on("change", () => { if (store.project) draw(); });
  draw();
  return () => off();
}

registerModule({ key: "team", label: "Équipe", icon: "link", tip: "Travailler à plusieurs en miroir : chacun sa copie du projet, fusion par artéfact, messages @membre", render });
