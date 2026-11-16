/* DesignWizard.ai — the door of the hosted demo. On the user's own machine the application opens at once. On a
   hosted page it asks for a Google sign-in and lets in the accounts approved by the administrator (core/access.js).
   Nothing is sent anywhere but to Google; the e-mail address never leaves the browser — only its fingerprint is
   compared with the public list, or shown so the visitor can ask for access. */

import { el, clear, icon, btn, copyText, toast } from "./dom.js";
import { session, signIn, signOut, requestUrl, shortHash } from "./access.js";
import { authMessage } from "../google/auth.js";
import { CONFIG } from "../config.js";

/** Resolves when the visitor may use the application: {local: true} or the approved account. */
export function gate() {
  if (!session.hosted) return Promise.resolve({ local: true });
  return new Promise((resolve) => {
    const body = el("div", { class: "gate-body" });
    const box = el("div", { class: "gate", role: "dialog", "aria-modal": "true", "aria-label": "Accès à la démo" },
      el("div", { class: "gate-card" }, el("img", { class: "gate-logo", src: "img/brand.svg", alt: "" }),
        el("h1", null, "DesignWizard", el("i", null, ".ai")), el("p", { class: "gate-by" }, "by DynamiteAgile™ — démo sur invitation"), body,
        el("p", { class: "gate-foot" }, el("a", { class: "btn btn-small", href: "vitrine.html" }, "Découvrir le projet"), el("a", { class: "btn btn-small btn-primary gh", href: `https://github.com/${CONFIG.repo}`, target: "_blank", rel: "noopener noreferrer", "data-tip": "Le code source, sous licence MIT" }, "GitHub"))));
    document.body.append(box);
    const google = (label, choose) => btn(label, () => go(choose), { primary: !choose, icon: choose ? "refresh" : "lock" });

    function idle(message) {
      clear(body);
      if (!session.configured) {
        body.append(el("p", null, "La démo en ligne n'est pas encore ouverte : la connexion Google de ce site n'est pas configurée."),
          el("p", { class: "muted" }, "En attendant, l'application complète fonctionne sur votre poste, sans compte : clonez le dépôt et lancez « python designwizard.py »."));
        return;
      }
      body.append(...[el("p", null, "La démo est ouverte aux comptes Google approuvés. Connectez-vous pour entrer : vos fichiers restent dans votre propre Google Drive, dans un dossier « DesignWizard.ai »."),
        message ? el("p", { class: "form-error" }, message) : null, el("div", { class: "gate-actions" }, google("Se connecter avec Google", false)),
        el("p", { class: "muted small" }, "Permissions demandées : votre adresse (pour vérifier l'accès) et les seuls fichiers créés par cette application.")].filter(Boolean));       // append() would write a missing message as the word « null »
    }
    function denied(acc) {
      clear(body);
      const full = acc.hash || "";
      body.append(el("p", null, el("b", null, "Ce compte n'est pas encore approuvé."), " Envoyez votre empreinte d'accès à l'administrateur : elle identifie votre compte sans révéler votre adresse."),
        el("p", { class: "gate-hash", "data-tip": full }, shortHash(full), "…"),
        el("div", { class: "gate-actions" }, el("a", { class: "btn btn-primary", href: requestUrl(full), target: "_blank", rel: "noopener noreferrer" }, icon("external"), "Demander l'accès"),
          btn("Copier l'empreinte", async () => toast((await copyText(full)) ? "Empreinte copiée." : "Copie impossible.", "success"), { icon: "copy" }), google("Autre compte", true)),
        el("p", { class: "muted small" }, "« Demander l'accès » ouvre une demande sur GitHub avec l'empreinte seulement. Une fois approuvé, reconnectez-vous ici."));
    }
    async function go(choose) {
      clear(body); body.append(el("p", { class: "muted" }, "Connexion à Google…"));
      try {
        const acc = await signIn({ choose });
        if (acc.approved) { box.remove(); resolve(acc); return; }
        denied(acc);
      } catch (e) { signOut(); idle(authMessage(e)); }
    }
    idle();
  });
}
