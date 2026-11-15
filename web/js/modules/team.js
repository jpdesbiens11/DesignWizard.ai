/* DesignWizard.ai — Équipe : working on one project from several accounts, in mirrors. Each member keeps the whole project
   in their own storage and hands their mirror to the others ; merging a mirror takes what its owner changed, keeps what
   I changed, and sets aside — for a person to decide — what we both changed. Messages are written on an artefact or on
   the project, call a member with « @name », and travel in the mirror. Route : #/team (and #/team/<artefact> for its thread). */

import { el, btn, badge, field, toast, modal, icon, download, table, promptBox } from "../core/dom.js";
import { registerModule, go } from "../core/app.js";
import { store } from "../core/store.js";
import { toDwiz, fromDwiz } from "../core/dwiz.js";
import { session, accessHash } from "../core/access.js";
import { aiDiff } from "../core/ai_loop.js";
import { safeName } from "../google/drive_fs.js";
import { teamOf, newTeamId, joinTeam, forkMirror, stampLocal, mergeMirror, resolveConflict, post, setDone, inbox, threads, artefacts, labelOf, cleanHandle, HANDLE } from "../core/team.js";

const KEY = "dw.handle";
const remembered = () => { try { return localStorage.getItem(KEY) || ""; } catch (e) { return ""; } };
const remember = (h) => { try { localStorage.setItem(KEY, h); } catch (e) { /* a private window : the name is asked again */ } };
const day = (s) => String(s || "").slice(0, 16).replace("T", " "), act = (label, fn) => { try { store.commit(label, fn); return true; } catch (e) { toast(e.message, "error", 7000); return false; } };
/* a member is known by a fingerprint of their account, never by its address ; salted with the team : it says nothing outside it */
const hashOf = async (teamId) => { const mail = session.account && session.account.email; try { return mail ? await accessHash(mail, `team/${teamId}`, 20000) : null; } catch (e) { return null; } };
const readMirror = async (file) => { const d = fromDwiz(await file.text()); return Array.isArray(d) ? d[0] : d; };
const pickFile = (then) => { const i = el("input", { type: "file", accept: ".dwiz,.txt" }); i.addEventListener("change", () => { if (i.files[0]) then(i.files[0]); }); i.click(); };
const suggest = () => remembered() || cleanHandle(String((session.account && session.account.email) || "").split("@")[0]) || "";

/** Someone invited starts from the mirror they were given : a project of their own, on which both agree on everything. */
export async function joinFromFile(file) {
  let theirs; try { theirs = await readMirror(file); if (!theirs || !theirs.team || !theirs.team.owner) throw new Error("Ce fichier n'est pas le miroir d'un membre : demandez-lui « Télécharger mon miroir »."); } catch (e) { toast(e.message, "error", 7000); return; }
  const name = await promptBox(`Rejoindre « ${theirs.name || "le projet"} » de @${theirs.team.owner}`, "Votre nom dans l'équipe", suggest(), "2 à 24 caractères : lettres sans accent, chiffres, point, tiret. C'est par lui qu'on vous appelle : @nom."); if (!name) return;
  try { const mine = forkMirror(theirs, { handle: name, hash: await hashOf(theirs.team.id) }, new Date()); remember(mine.team.owner); await store.create(theirs.name || "Projet partagé", mine); toast(`Vous avez votre miroir de « ${theirs.name} ». Renvoyez-le à @${theirs.team.owner} pour qu'il vous voie dans l'équipe.`, "success", 8000); go("#/team"); }
  catch (e) { toast(e.message, "error", 7000); }
}

function render(main, args) {
  const page = el("div", { class: "page" }), body = el("div"), focus = args[0] ? decodeURIComponent(args.join("/")) : "";
  main.append(page); page.append(body);
  const st = { on: focus || "project" };
  const me = () => (store.project.team && store.project.team.owner) || "";
  /* my mirror, as the file the others read : stamped with what I changed since the last time */
  const myMirror = () => { act("Miroir mis à jour", (p) => { stampLocal(p, me(), new Date()); }); return toDwiz(store.project); };
  async function merge(file) {
    let theirs, rep; const dry = JSON.parse(JSON.stringify(store.project));
    try { theirs = await readMirror(file); rep = mergeMirror(dry, theirs, me(), new Date()); } catch (e) { toast(e.message, "error", 7000); return; }
    const L = (k) => labelOf(dry, k), sec = (title, keys, cls) => (keys.length ? el("div", null, el("h3", null, `${title} (${keys.length})`), el("ul", { class: "decisions" }, keys.map((k) => el("li", { class: cls || null }, L(k))))) : null);
    const m = modal(`Miroir de @${rep.from}`, [rep.nothing ? el("p", { class: "atelier-hint" }, icon("check"), ` Rien de nouveau : votre miroir et celui de @${rep.from} disent la même chose.`) : el("p", null, `Ce que @${rep.from} a changé arrive chez vous ; ce que vous avez changé reste, et partira avec votre miroir.`),
      sec(`Repris de @${rep.from}`, rep.taken), sec("Ajoutés", rep.added), sec("Retirés", rep.removed), sec("Gardés : les vôtres sont plus récents", rep.kept), sec("Conflits : modifiés des deux côtés — le vôtre reste, le sien attend votre décision", rep.conflicts, "form-error"),
      rep.messages || rep.members.length ? el("p", { class: "muted" }, [rep.messages ? `${rep.messages} nouveau(x) message(s)` : null, rep.members.length ? `nouveau(x) dans l'équipe : ${rep.members.map((h) => `@${h}`).join(", ")}` : null].filter(Boolean).join(" · ")) : null,
      el("div", { class: "form-actions" }, btn("Annuler", () => m.close()), btn(rep.nothing ? "Noter la lecture" : "Fusionner", () => { if (act(`Miroir de @${rep.from} fusionné`, (p) => { mergeMirror(p, theirs, me(), new Date()); })) { m.close(); toast(`Miroir de @${rep.from} fusionné${rep.conflicts.length ? ` — ${rep.conflicts.length} conflit(s) à trancher` : ""}.`, rep.conflicts.length ? "warn" : "success", 6000); } }, { primary: true, icon: "check" }))], { wide: true });
  }
  async function shareInDrive() {
    if (!session.account || !session.fs) { toast("Connectez-vous à Google (menu Compte) : le partage passe par votre Drive.", "info", 6000); return; }
    const mail = await promptBox("Partager mon miroir dans Drive", "Adresse Google de la personne", "", "Elle reçoit de Google un lien vers le fichier du projet, en lecture. L'adresse n'est envoyée qu'à Google et n'est pas gardée dans le projet."); if (!mail) return;
    try { const text = myMirror(), r = await session.fs.saveProject(store.project); await session.drive.share(r.file.id, mail.trim());
      act("Mon miroir est dans Drive", (p) => { const x = teamOf(p).members.find((q) => q.handle === me()); if (x) x.mirror = r.file.id; });
      toast(`Partagé : la personne trouve « ${r.file.name} » dans son Drive (${Math.round(text.length / 1024)} ko). Elle le télécharge et choisit « Rejoindre un projet partagé ».`, "success", 9000);
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
          btn("Rejoindre un projet partagé…", () => pickFile(joinFromFile), { icon: "download", tip: "Vous avez reçu le miroir de quelqu'un : il devient votre propre copie du projet" }))),
        el("p", { class: "muted small" }, "Rien ne quitte votre poste ou votre Drive tant que vous ne donnez pas votre miroir à quelqu'un.")));
      return;
    }
    const mine = me(), T = teamOf(p), box = inbox(p, mine), th = threads(p), keys = [...artefacts(p).keys()].filter((k) => !k.startsWith("project:"));
    const team = el("section", { class: "card taped" }, el("h2", null, `@${mine} `, el("small", { class: "muted" }, `— ${T.members.length} membre(s)`)),
      table(["Membre", "Dans l'équipe depuis", "Son miroir, lu le", "Messages"], T.members.map((m) => [el("span", null, el("b", null, `@${m.handle}`), m.handle === mine ? badge("moi", "info") : null), day(m.since).slice(0, 10), m.handle === mine ? "—" : (T.pulled || {})[m.handle] ? day(T.pulled[m.handle]) : el("span", { class: "form-error" }, "jamais"), String((p.talk || []).filter((x) => x.by === m.handle).length)])),
      el("div", { class: "form-actions", style: { justifyContent: "flex-start", flexWrap: "wrap" } },
        btn("Télécharger mon miroir", () => download(`${safeName(p.name || p.id)}.miroir-${mine}.dwiz`, myMirror(), "text/plain;charset=utf-8"), { icon: "download", primary: true, tip: "Le projet entier, tel qu'il est chez vous : à donner aux autres membres, par le canal de votre choix" }),
        btn("Fusionner le miroir d'un membre…", () => pickFile(merge), { icon: "upload", tip: "Aperçu de ce qui arrive, puis une seule étape annulable" }),
        btn("Partager mon miroir dans Drive…", shareInDrive, { icon: "link", tip: "Donne à une personne le droit de lire le fichier du projet dans votre Drive" })),
      el("p", { class: "muted small" }, "Inviter quelqu'un : donnez-lui votre miroir ; il choisit « Rejoindre un projet partagé », puis vous renvoie le sien. Chaque miroir est complet : c'est aussi une sauvegarde chez chaque membre."));
    const sections = [head, team];
    if (T.conflicts.length) sections.push(el("section", { class: "card" }, el("h2", null, `À trancher (${T.conflicts.length})`), el("p", { class: "muted small" }, "Modifié chez vous et chez l'autre, chacun de son côté. Le vôtre est en place ; le sien est gardé ici, entier. Votre choix vaut pour toute l'équipe : il part avec votre miroir."),
      T.conflicts.map((c) => { const cur = artefacts(p).get(c.key), diff = c.doc && cur ? aiDiff(cur, c.doc).slice(0, 6) : [];
        return el("div", { class: "card", style: { padding: ".55rem .7rem", marginBottom: ".5rem" }, "data-conflict": c.key }, el("div", { style: { display: "flex", gap: ".5rem", alignItems: "center", flexWrap: "wrap" } }, el("b", { class: "grow" }, labelOf(p, c.key)), badge(`@${c.by} · ${day(c.at)}`, "warn"),
          btn("Garder le mien", () => act(`Conflit sur ${c.key} : le mien gardé`, (x) => { resolveConflict(x, c.key, c.by, "mine", mine, new Date()); }), { small: true }), btn(c.doc ? `Prendre celui de @${c.by}` : `Le retirer, comme @${c.by}`, () => act(`Conflit sur ${c.key} : celui de @${c.by} pris`, (x) => { resolveConflict(x, c.key, c.by, "theirs", mine, new Date()); }), { small: true, primary: true })),
          c.doc ? el("ul", { class: "decisions", style: { fontSize: ".8rem" } }, diff.map((d) => el("li", null, d.text))) : el("p", { class: "small" }, `@${c.by} l'a retiré.`)); })));
    /* messages : what calls me first, then a place to write, then every thread */
    const text = el("input", { type: "text", placeholder: "Écrire à l'équipe… @nom appelle un membre", "aria-label": "Message" });
    const send = () => { if (!text.value.trim()) return; const v = text.value; if (act("Message envoyé", (x) => { post(x, { by: mine, on: st.on, text: v, date: new Date() }); })) text.value = ""; };
    text.addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
    const subject = el("select", { "aria-label": "Sujet du message", onChange: (e) => { st.on = e.target.value; } }, el("option", { value: "project", selected: st.on === "project" }, "Le projet"), keys.map((k) => el("option", { value: k, selected: k === st.on }, labelOf(p, k))));
    const line = (m) => el("div", { class: "param", style: { gridTemplateColumns: "minmax(0,1fr) auto", alignItems: "start", opacity: m.done ? 0.55 : 1 }, "data-msg": m.id }, el("div", null, el("b", null, `@${m.by}`), el("small", { class: "muted" }, ` ${day(m.at)}`), el("div", { style: m.done ? { textDecoration: "line-through" } : null }, m.text), m.done ? el("small", { class: "muted" }, `fait — @${m.done.by}`) : null),
      el("label", { class: "check small", "data-tip": "Coché : la demande est traitée, pour tout le monde" }, el("input", { type: "checkbox", checked: !!m.done, onChange: (e) => act(e.target.checked ? "Message traité" : "Message rouvert", (x) => { setDone(x, m.id, mine, e.target.checked, new Date()); }) }), "fait"));
    sections.push(el("section", { class: "card" }, el("h2", null, "Messages ", box.length ? badge(`${box.length} pour moi`, "danger") : badge("rien ne m'attend", "ok")),
      box.length ? el("div", null, el("h3", null, "Pour moi"), box.map((m) => el("div", null, el("a", { class: "muted small", href: `#/team/${encodeURIComponent(m.on)}` }, labelOf(p, m.on)), line(m)))) : null,
      el("div", { class: "form-row", style: { alignItems: "flex-end" } }, field("Sujet", subject), el("div", { class: "grow", style: { flex: 3 } }, field("Message", text)), el("div", { class: "form-actions" }, btn("Envoyer", send, { primary: true, icon: "check" }))),
      el("div", { class: "atelier-chips" }, T.members.filter((m) => m.handle !== mine).map((m) => el("button", { class: "chip", type: "button", "data-tip": "Appeler ce membre dans le message", onClick: () => { text.value = `${text.value}${text.value && !/\s$/.test(text.value) ? " " : ""}@${m.handle} `; text.focus(); } }, `@${m.handle}`))),
      th.map((x) => el("div", { class: "side-section", "data-thread": x.on }, el("h3", null, el("span", { class: "grow" }, x.label), x.open ? badge(`${x.open} ouvert(s)`, "warn") : badge("tout est traité", "ok"), btn("", () => { st.on = x.on; draw(); }, { small: true, icon: "edit", tip: "Écrire sur ce sujet" })), x.items.map(line))),
      th.length ? null : el("p", { class: "muted" }, "Aucun message encore. Un message s'écrit sur le projet ou sur un artéfact : il suit sa conception, et part dans votre miroir.")));
    body.replaceChildren(...sections);
    if (focus) { const n = body.querySelector(`[data-thread="${CSS.escape(focus)}"]`); if (n && n.scrollIntoView) n.scrollIntoView({ block: "center" }); }
  }
  const off = store.on("change", () => { if (store.project) draw(); });
  draw();
  return () => off();
}

registerModule({ key: "team", label: "Équipe", icon: "link", tip: "Travailler à plusieurs en miroir : chacun sa copie du projet, fusion par artéfact, messages @membre", render });
