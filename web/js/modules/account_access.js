/* DesignWizard.ai — Compte : the access to the hosted demo, said clearly to who administers it (demande de JP : « voir les infos clairement
   pour les comptes ajoutés et leur permission ici en mode admin, c'est trop cryptique »). One line per account : a NAME one gives it — kept
   in this browser only, the public file holds fingerprints and nothing else —, its role in words and what the role allows, and whether the
   line is PUBLISHED or still waits to be. What was added here is kept between two visits until it is published ; what remains to be done
   is said step by step : publish the file, and the test users of Google, which the tool cannot see.
   What it follows : a list of members with a role menu per line, as account and sharing screens of the web have them. */

import { el, clear, icon, btn, badge, field, toast, copyText, download } from "../core/dom.js";
import { session, accessHash, approve, revoke, accessFileText, isHash, shortHash, loadAccess, ROLES, accessRows, pendingAccess, setRole, editUrl, readNames, readDraft } from "../core/access.js";

const NAMES = "dw.access.names", DRAFT = "dw.access.draft";
const keep = { get: (k) => { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } }, set: (k, v) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* a private window keeps nothing */ } } };
const STATE = { online: ["Publié", "ok", "Ce compte est dans la liste publiée : son accès est en vigueur."], new: ["À publier", "warn", "Ajouté ici, pas encore dans la liste publiée : ce compte n'a pas encore accès."],
  changed: ["Rôle à publier", "warn", "Son rôle a changé ici ; la liste publiée porte encore l'ancien."], removed: ["Retrait à publier", "danger", "Retiré ici ; il garde son accès tant que la liste n'est pas publiée."] };

/** Draws the card. host : its section ; → nothing (the card redraws itself). */
export async function accessCard(host) {
  const st = { published: null, draft: null, names: readNames(keep.get(NAMES)) };
  const save = () => { keep.set(DRAFT, pendingAccess(st.draft, st.published) ? JSON.stringify({ salt: st.draft.salt, mode: st.draft.mode, admins: st.draft.admins, approved: st.draft.approved }) : null); draw(); };
  const name = (h, v) => { const n = { ...st.names }; if (v && v.trim()) n[h] = v.trim().slice(0, 80); else delete n[h]; st.names = n; keep.set(NAMES, Object.keys(n).length ? JSON.stringify(n) : null); };

  function draw() {
    clear(host); host.append(el("h2", null, "Accès à la démo en ligne"));
    const a = session.account, canEdit = !session.hosted || (a && a.admin);
    if (!canEdit) {
      host.append(...[el("p", null, "La démo en ligne est ouverte aux comptes Google approuvés par l'administrateur."), a && a.approved ? el("p", null, badge(ROLES.user.label, "ok"), ` Vous pouvez ${ROLES.user.can.join(", ")}.`) : null, a && a.hash ? el("p", { class: "muted small" }, `Votre empreinte d'accès : ${a.hash}`) : null].filter(Boolean));
      return;
    }
    const rows = accessRows(st.draft, st.published, a && a.hash, st.names), live = rows.filter((r) => r.state !== "removed"), pending = pendingAccess(st.draft, st.published), n = (k) => live.filter((r) => r.role === k).length;
    host.append(el("p", { class: "access-sum", "data-access-sum": "" }, el("b", null, `${live.length} compte${live.length > 1 ? "s" : ""}`), ` — ${n("admin")} administrateur${n("admin") > 1 ? "s" : ""}, ${n("user")} utilisateur${n("user") > 1 ? "s" : ""} approuvé${n("user") > 1 ? "s" : ""} `, pending ? badge(`${pending} changement${pending > 1 ? "s" : ""} à publier`, "warn") : badge("liste publiée à jour", "ok")));
    /* what each role allows : said once, in two cards of their colour */
    host.append(el("div", { class: "access-roles" }, ["user", "admin"].map((k) => el("div", { class: "access-role", style: { "--role": ROLES[k].color } }, el("b", null, icon(ROLES[k].icon), ROLES[k].label), el("ul", null, ROLES[k].can.map((c) => el("li", null, c)))))));
    /* the accounts : a name of one's own, the role, the state */
    const list = el("div", { class: "access-list", role: "list", "aria-label": "Comptes de la liste d'accès" });
    for (const r of rows) {
      const S = STATE[r.state], R = ROLES[r.role], gone = r.state === "removed";
      const label = el("input", { type: "text", class: "access-name", value: r.name, placeholder: r.you ? "Vous" : "Nom pour vous (ex. : Testeur)", "aria-label": `Nom donné au compte ${shortHash(r.hash)}`, "data-tip": "Un nom pour vous y retrouver : gardé dans ce navigateur seulement, jamais dans le fichier publié", maxlength: 80, onChange: (e) => { name(r.hash, e.target.value); draw(); } });
      const role = el("select", { "aria-label": `Rôle du compte ${r.name || shortHash(r.hash)}`, disabled: gone, onChange: (e) => { st.draft = setRole(st.draft, r.hash, e.target.value === "admin"); save(); } }, ["user", "admin"].map((k) => el("option", { value: k, selected: r.role === k }, ROLES[k].short)));
      list.append(el("div", { class: `access-row${gone ? " gone" : ""}`, role: "listitem", "data-access-row": r.state, style: { "--role": R.color } },
        el("span", { class: "access-ico", "aria-hidden": "true" }, icon(R.icon)),
        el("div", { class: "access-who" }, label, el("small", { class: "muted", "data-tip": `Empreinte complète : ${r.hash}` }, `empreinte ${shortHash(r.hash)}… `, r.you ? badge("vous", "info") : null), el("small", { class: "access-can" }, gone ? "N'aura plus accès une fois la liste publiée." : R.line)),
        el("div", { class: "access-ctl" }, role, el("span", { class: `badge badge-${S[1]}`, "data-tip": S[2] }, S[0]),
          gone ? btn("Remettre", () => { st.draft = setRole(st.draft, r.hash, r.was === "admin"); save(); }, { small: true, tip: "Annuler ce retrait" })
            : el("button", { class: "icon-btn", type: "button", "aria-label": `Retirer le compte ${r.name || shortHash(r.hash)}`, "data-tip": r.you ? "C'est votre compte : le retirer vous ferme cette liste" : "Retirer ce compte de la liste", onClick: () => { st.draft = revoke(st.draft, r.hash); save(); } }, "×"))));
    }
    if (!rows.length) list.append(el("p", { class: "muted" }, "Aucun compte dans la liste."));
    host.append(list);
    /* add one : an address (hashed here, never sent) or a fingerprint received with a request */
    const input = el("input", { type: "text", placeholder: "adresse@gmail.com — ou l'empreinte reçue d'une demande d'accès", spellcheck: false, "aria-label": "Adresse ou empreinte du compte à approuver" }), as = el("select", { "aria-label": "Rôle du nouveau compte" }, ["user", "admin"].map((k) => el("option", { value: k }, ROLES[k].short)));
    const add = async () => {
      const v = input.value.trim(); if (!v) return;
      if (!st.draft.salt) { toast("Le fichier d'accès n'a pas de sel : régénérez web/acces.json (voir docs/GOOGLE.md).", "error"); return; }
      try { const h = isHash(v) ? v.toLowerCase() : await accessHash(v, st.draft.salt, st.draft.iterations); st.draft = setRole(st.draft, h, as.value === "admin"); if (!isHash(v) && !st.names[h]) name(h, v); toast("Compte ajouté — il aura accès une fois la liste publiée (étapes ci-dessous).", "success"); save(); }
      catch (e) { toast(e.message, "error"); }
    };
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") add(); });
    host.append(el("div", { class: "access-add" }, field("Approuver un compte", input, "L'adresse n'est ni envoyée ni publiée : son empreinte est calculée dans ce navigateur. Elle reste ici, comme nom de la ligne."), as, btn("Ajouter", add, { icon: "plus" })),
      field("Ouverture de la démo", el("select", { onChange: (e) => { st.draft = { ...st.draft, mode: e.target.value }; save(); } }, [["approved", "Sur approbation — seuls les comptes de la liste entrent"], ["open", "Ouverte — tout compte Google connecté entre"]].map(([k, l]) => el("option", { value: k, selected: k === (st.draft.mode || "approved") }, l)))));
    /* what remains to be done, step by step */
    const text = () => accessFileText(st.draft), todo = el("div", { class: `access-todo${pending ? " due" : ""}`, "data-access-todo": pending ? "due" : "done" }, el("h3", null, pending ? "Ce qu'il reste à faire pour que ce soit en vigueur" : "Pour qu'un compte approuvé puisse travailler"));
    todo.append(el("ol", null,
      el("li", null, el("b", null, pending ? "Publier la liste. " : "La liste est publiée. "), pending ? "Les changements faits ici sont gardés dans ce navigateur, pas encore en ligne : " : "Rien à publier. ", pending ? el("span", { class: "access-acts" },
        btn("1. Copier le fichier", async () => toast((await copyText(text())) ? "Fichier copié : collez-le dans GitHub." : "Copie impossible : téléchargez le fichier.", "info"), { small: true, icon: "copy" }),
        el("a", { class: "btn btn-small", href: editUrl(), target: "_blank", rel: "noopener", "data-tip": "Ouvre web/acces.json dans l'éditeur de GitHub : sélectionnez tout, collez, puis « Commit changes ». La démo se republie seule en quelques minutes." }, "2. Ouvrir le fichier dans GitHub ↗"),
        btn("ou télécharger", () => download("acces.json", text(), "application/json"), { small: true, icon: "download", tip: "Pour le déposer vous-même dans le dépôt, à la place de web/acces.json" })) : null),
      el("li", null, el("b", null, "Utilisateurs test de Google. "), "Si l'écran de consentement de Google est en mode « Test », seules les adresses de sa liste d'utilisateurs test peuvent se connecter : ajoutez-y l'adresse du compte. L'outil ne peut pas voir cette liste. ",
        el("a", { href: "https://console.cloud.google.com/apis/credentials/consent", target: "_blank", rel: "noopener" }, "Ouvrir l'écran de consentement ↗")),
      el("li", null, el("b", null, "Le compte se connecte. "), "Sur la page de la démo, « Se connecter avec Google » ; Google lui demande d'autoriser l'application à gérer les fichiers qu'elle crée. Ses projets vont dans SON Google Drive, dossier « DesignWizard.ai » — vous ne les voyez pas, sauf s'il vous les partage.")));
    host.append(todo, el("p", { class: "muted small" }, "La liste publiée ne contient aucune adresse : chaque compte y est une empreinte. Elle vit dans le fichier public ", el("code", null, "web/acces.json"), "."));
  }

  host.append(el("h2", null, "Accès à la démo en ligne"), el("p", { class: "muted" }, "Lecture de la liste…"));
  st.published = await loadAccess();      // the file as it is served : what is in force
  st.draft = readDraft(keep.get(DRAFT), st.published) || st.published;
  draw();
}
