/* DynamiteOrbit — the wand (Ctrl+K): one field to go anywhere, run a command, or edit the current part in plain words. */

import { el, clear, icon, modal, toast } from "./dom.js";
import { app, go } from "./app.js";
import { store } from "./store.js";
import { interpret, NL_EXAMPLES } from "./nl.js";
import { importAny } from "./importer.js";

const norm = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function baseCommands() {
  const cmds = [];
  for (const m of app.modules.values()) if (!m.hidden) cmds.push({ label: `Aller à ${m.label}`, hint: "navigation", icon: m.icon, keys: `${m.label} ${m.key} aller go`, run: () => go(`#/${m.key}`) });
  cmds.push({ label: "Onshape : connexion et envoi", hint: "navigation", icon: "onshape", keys: "onshape cloud envoyer push", run: () => go("#/onshape") });
  cmds.push({ label: "Aide et raccourcis", hint: "navigation", icon: "help", keys: "aide help raccourcis shortcuts", run: () => go("#/help") });
  for (const p of store.parts) cmds.push({ label: `Ouvrir la pièce ${p.id} — ${p.name || ""}`, hint: "pièce", icon: "part", keys: `${p.id} ${p.name} piece part ouvrir open`,
    run: () => go(`#/${p.family === "pcb" ? "pcb" : p.family === "extrusion" ? "extrusion" : "parts"}/${encodeURIComponent(p.id)}`) });
  for (const a of store.assemblies) cmds.push({ label: `Ouvrir l'assemblage ${a.id} — ${a.name || ""}`, hint: "assemblage", icon: "assembly", keys: `${a.id} ${a.name} assemblage assembly`, run: () => go(`#/assembly/${encodeURIComponent(a.id)}`) });
  cmds.push({ label: "Annuler la dernière action", hint: "Ctrl+Z", icon: "undo", keys: "annuler undo", run: () => { const l = store.undo(); toast(l ? `Annulé : ${l}` : "Rien à annuler."); } });
  cmds.push({ label: "Rétablir", hint: "Ctrl+Y", icon: "redo", keys: "retablir redo", run: () => { const l = store.redo(); toast(l ? `Rétabli : ${l}` : "Rien à rétablir."); } });
  cmds.push({ label: "Coller une réponse d'entrevue (JSON) ou un STEP", hint: "import", icon: "paste", keys: "coller paste importer import json step entrevue",
    run: async () => { try { const t = await navigator.clipboard.readText(); const r = await importAny(t); if (r && app.onImported) app.onImported(r); } catch (e) { toast("Presse-papiers inaccessible : collez directement dans la page avec Ctrl+V.", "warn"); } } });
  return cmds.concat(app.commands || []);
}

export function openPalette() {
  if (document.querySelector(".palette")) return;
  const input = el("input", { type: "text", placeholder: "Ex. : 4 trous M4 aux coins à 8 mm · longueur 150 · aller à Assemblage", "aria-label": "Commande" });
  const list = el("div", { class: "palette-list", role: "listbox" });
  const hint = el("p", { class: "muted", style: { margin: ".5rem 0 0", fontSize: ".8rem" } });
  const m = modal("La baguette", [input, list, hint], { wide: true });
  m.box.classList.add("palette");
  const ctx = app.context || {};
  hint.textContent = ctx.spec ? `Sur la pièce ${ctx.spec.id}, essayez : ${NL_EXAMPLES.slice(0, 5).join(" · ")}` : "Ouvrez une pièce pour la modifier en langage courant ; sinon, tapez le nom d'un outil ou d'une pièce.";
  let items = [], sel = 0;
  const render = () => {
    const q = input.value.trim(), nq = norm(q);
    items = [];
    if (q && ctx.spec) for (const it of interpret(q, ctx)) items.push({ label: it.label, hint: it.apply ? "modifier la pièce ↵" : "à corriger", icon: "wizard", nl: it });
    const words = nq.split(/\s+/).filter(Boolean);
    for (const c of baseCommands()) { const k = norm(`${c.label} ${c.keys || ""}`); if (!words.length || words.every((w) => k.includes(w))) items.push(c); }
    items = items.slice(0, 40);
    sel = Math.min(sel, Math.max(0, items.length - 1));
    clear(list);
    items.forEach((it, i) => list.append(el("div", { class: "palette-item" + (i === sel ? " sel" : ""), role: "option", onClick: () => run(i) }, icon(it.icon || "sparkle"), el("span", null, it.label), el("small", null, it.hint || ""))));
    if (!items.length) list.append(el("p", { class: "muted" }, "Rien ne correspond. Essayez un autre mot, ou une phrase comme « congé 3 vertical »."));
  };
  const run = (i) => {
    const it = items[i];
    if (!it) return;
    if (it.nl) {
      if (!it.nl.apply) return;
      store.updatePart(ctx.spec.id, (s) => { it.nl.apply(s); }, `Baguette : ${it.label}`);
      toast(it.label, "success");
      m.close();
      return;
    }
    m.close();
    it.run();
  };
  input.addEventListener("input", () => { sel = 0; render(); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { sel = Math.min(items.length - 1, sel + 1); render(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { sel = Math.max(0, sel - 1); render(); e.preventDefault(); }
    else if (e.key === "Enter") { run(sel); e.preventDefault(); }
  });
  render();
}
