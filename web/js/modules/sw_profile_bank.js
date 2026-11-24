/* DynamiteOrbit.ai — Logiciel : the BANK OF MISSION PROFILES of a software (demande de JP, 24 novembre 2026 : « choisir parmi une banque de profils
   de mission en .txt qui peuvent venir de l'IA selon les cas, avec les bonnes variables changeantes le long du profil »).
   A dialog : the profiles the design keeps, each to play, to export (.txt) or to set aside ; « Demander à une IA » — the prompt of the format with
   the variables of THIS bench, and what one wants in one sentence ; « Importer » — a .txt chosen or pasted, read line by line : what it cannot
   say is listed with its line, and nothing enters until « Ajouter à la banque » — one undoable step. The format : sw/sw_profiles.js.
   What it follows : the import dialog of the other screens (preview, then accept) and the round trip to an AI of the whole platform. */

import { el, btn, icon, modal, toast, download, copyText } from "../core/dom.js";
import { profilesOf } from "../sw/sw_story.js";
import { profileTxt, parseProfileTxt, profilePrompt } from "../sw/sw_profiles.js";

const KIND = { charge: "Charge", discharge: "Décharge", mission: "Mission", test: "Essai" };

/** o : { design(), change(label, fn), current : the id of the profile played, choose(id) } */
export function openBank(o) {
  const d = o.design(), all = profilesOf(d), body = el("div", { class: "swpb", "data-sw-bank": "" });
  let m = null;
  const list = el("div", { class: "swpb-list" }, all.length ? all.map((p) => el("div", { class: `swpb-row${p.id === o.current ? " on" : ""}`, "data-bank-profile": p.id },
    icon(p.kind === "charge" ? "bolt" : p.kind === "discharge" ? "power" : "flow"), el("b", null, p.name), el("small", null, `${KIND[p.kind] || "Mission"} · ${(p.events || []).length} événements`),
    btn("Jouer", () => { m.close(); o.choose(p.id); }, { small: true, primary: p.id !== o.current, icon: "play" }),
    btn(".txt", () => download(`${d.id || "logiciel"}-${p.id}.txt`, profileTxt(p, d), "text/plain"), { small: true, icon: "download", tip: "Ce profil en texte : à garder, à corriger, à donner à une IA" }),
    p.id === "own" ? null : btn("Retirer", () => { m.close(); o.change(`Logiciel : profil « ${p.name} » retiré`, (x) => { x.profiles = (x.profiles || []).filter((q) => q.id !== p.id); }); }, { small: true, tip: "Retirer ce profil de la banque (une étape annulable)" })))
    : el("p", { class: "muted" }, "Ce logiciel n'a pas encore de profil à lui : l'outil en écrit un (au repos, puis chaque entrée passée au-delà de son seuil). Un produit avec un ESS reçoit un profil de charge et un de décharge ; tout autre produit en importe ici."));
  /* ask an AI */
  const ask = el("textarea", { rows: 2, class: "swpb-ask", placeholder: "Ex. : une charge rapide en hiver, à −10 °C, avec une perte de la communication au milieu", "aria-label": "Ce que doit raconter le profil" });
  const askBox = el("section", null, el("h3", null, icon("sparkle"), " Demander un profil à une IA"), el("p", { class: "muted small" }, "Le prompt dit le format et les variables du banc de ce logiciel, avec leurs unités et leurs plages : l'IA ne peut nommer que ce qui existe. Collez sa réponse ci-dessous."),
    ask, btn("Copier le prompt", async () => toast((await copyText(profilePrompt(d, ask.value.trim()))) ? "Prompt copié : collez-le dans votre assistant, puis sa réponse ci-dessous." : "Copie impossible.", "success", 5000), { small: true, primary: true, icon: "sparkle" }));
  /* import a .txt */
  const text = el("textarea", { rows: 7, class: "swpb-txt", placeholder: "Collez ici le profil (.txt) — ou choisissez un fichier", "aria-label": "Le profil en texte", spellcheck: "false" }), out = el("div", { class: "swpb-out", "aria-live": "polite" });
  const file = el("input", { type: "file", accept: ".txt,text/plain", hidden: true, onChange: async () => { const f = file.files && file.files[0]; if (f) { text.value = await f.text(); read(); } } });
  let got = null;
  function read() {
    const r = parseProfileTxt(text.value, d); got = r.errors.length ? null : r.profile;
    out.replaceChildren(...(r.profile ? [el("p", null, el("b", null, r.profile.name), ` — ${KIND[r.profile.kind] || "Mission"}, ${r.profile.events.length} événements, ${String((r.profile.events[r.profile.events.length - 1].t / 1000)).replace(".", ",")} s`)] : []),
      ...(r.errors.length ? [el("ul", { class: "form-error" }, r.errors.slice(0, 12).map((e) => el("li", null, e.line ? `Ligne ${e.line} : ${e.text}` : e.text)))] : [el("p", { class: "ok" }, "Tout se lit : chaque variable existe sur le banc, chaque valeur est dans sa plage.")]));
    add.disabled = !got;
  }
  text.addEventListener("input", () => read());
  const add = btn("Ajouter à la banque et jouer", () => { if (!got) return; let id = got.id; const ids = new Set(all.map((p) => p.id)); for (let n = 2; ids.has(id); n++) id = `${got.id}-${n}`;
    try { localStorage.setItem(`dw.sw.profile.${d.id || "sw"}`, id); } catch (e) { /* the choice holds until the page is left */ }      // before the step : the screen drawn again plays it
    m.close(); o.change(`Logiciel : profil « ${got.name} » ajouté`, (x) => { x.profiles = [...profilesOf(x).filter((p) => p.id !== "own"), ...(x.profile && x.profile.length && !(x.profiles || []).length ? [{ id: "own", name: "Profil du projet", events: x.profile }] : []), { ...got, id }]; });
    toast(`Profil « ${got.name} » ajouté : il se joue dans « Essayer ».`, "success", 4500); }, { primary: true, icon: "upload", disabled: true });
  add.dataset.swBankAdd = "";
  const imp = el("section", null, el("h3", null, icon("upload"), " Importer un profil (.txt)"), el("div", { class: "form-actions" }, btn("Choisir un fichier…", () => file.click(), { small: true, icon: "folder" })), file, text, out, el("div", { class: "form-actions" }, add));
  body.append(el("section", null, el("h3", null, icon("flow"), " Les profils de ce logiciel"), list), askBox, imp);
  m = modal("Banque de profils de mission", body, { wide: true });
}
