/* DesignOrbit.ai — a new part, step by step (demande de JP : « on devrait plus procéder sous forme d'une entrevue d'intention de
   conception… aspect par aspect », mise en page choisie sur maquette : « une question à la fois »). The fields are those of the
   intent — nothing is added, nothing is lost : they are asked one question at a time, six of them, and a card keeps what has
   been said so far, each line a way back to its question.
   The usage it follows : the wizard, or stepper, of the web — a rail that says where one is, Back and Next, a step one may
   skip, a summary before the end. This file is the questions and the memo ; the screen is modules/shop_steps.js. Pure. */

/** The six questions. fields : the keys of the brief a question fills (what the guide names in its issues). */
export const STEPS = [
  { key: "role", title: "Son rôle", ask: "Comment s'appelle-t-elle, et à quoi sert-elle ?", hint: "Un nom que l'on retrouvera dans l'arbre, sur le dessin et dans la commande ; une phrase sur ce qu'elle fait.", fields: ["name", "fn"] },
  { key: "limits", title: "Ses contraintes", ask: "Que doit-elle supporter, et combien en faut-il ?", hint: "Les efforts, le milieu, la quantité, et ce qui compte le plus : le compagnon s'en sert pour choisir la matière première et le procédé. Rien n'est obligatoire ici.", fields: ["loads", "environment", "quantity", "priority"] },
  { key: "neighbours", title: "Ses voisines", ask: "À quelles pièces du produit se raccorde-t-elle ?", hint: "Cochez ses voisines : leurs interfaces libres deviennent les siennes. Aucune ? Passez : cette pièce définira les premières interfaces.", fields: ["neighbours"] },
  { key: "interfaces", title: "Ses interfaces", ask: "Comment tient-elle à ce qui l'entoure ?", hint: "Choisissez par ce que la pièce FAIT — se visser, s'appuyer, laisser passer — pas par une opération de CAO. Plusieurs réponses possibles ; la face se choisit aussi d'un clic sur la pièce, à droite.", fields: ["interfaces", "proposed"] },
  { key: "material", title: "Sa matière", ask: "Dans quoi est-elle faite, et que prend-on sur l'étagère ?", hint: "Le matériau, puis la matière première du commerce : le compagnon en propose une, à garder ou à changer.", fields: ["material", "form"] },
  { key: "part", title: "La pièce proposée", ask: "Est-ce la pièce que vous vouliez ?", hint: "Regardez-la à droite, lisez sa gamme et ce que le compagnon a décidé. Un clic sur une ligne ci-dessous revient à sa question ; « Créer la pièce » la met dans le projet.", fields: [] },
];
export const stepOf = (field) => { const i = STEPS.findIndex((s) => s.fields.includes(field)); return i < 0 ? null : i; };
/** One step further or back, inside the six. */
export const moveStep = (i, by) => Math.max(0, Math.min(STEPS.length - 1, (Number.isFinite(i) ? i : 0) + by));

const PRIORITY = { cost: "le coût d'abord", mass: "la masse d'abord", stiffness: "la rigidité d'abord", lead_time: "le délai d'abord" };
const cut = (s, n = 70) => { const t = String(s || "").replace(/\s+/g, " ").trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
/** What has been said so far : one line per question.
    brief : the intent ; o : { parts (of the project : to name the neighbours), material (the name of the material), stock (the words of the raw stock proposed),
    issues (what the guide says : [{ level, field }]), built (a proposal is on screen) }
    → [{ step, label, value, state }] — state : "done" (answered), "todo" (still to say : the guide waits for it), "eg" (an example the tool gave, to confirm), "skip" (nothing said, and nothing asked) */
export function stepMemo(brief, o = {}) {
  const b = brief || {}, issues = o.issues || [], waits = (f) => issues.some((x) => x.field === f && (x.level === "todo" || x.level === "error")), eg = (f) => issues.some((x) => x.field === f && x.level === "check");
  const names = (b.neighbours || []).map((id) => { const p = (o.parts || []).find((x) => x.id === id); return p ? p.name || p.id : id; });
  const limits = [b.loads, b.environment, b.quantity ? `${b.quantity} pièce${b.quantity > 1 ? "s" : ""}` : "", PRIORITY[b.priority] || ""].map((x) => cut(x, 32)).filter(Boolean);
  const nI = (b.interfaces || []).length;
  return [
    { step: 0, label: "Nom", value: cut(b.name) || "à donner", state: b.name ? "done" : "todo" },
    { step: 0, label: "Sert à", value: cut(b.fn) || "à dire en une phrase", state: b.fn ? "done" : waits("fn") ? "todo" : "skip" },
    { step: 1, label: "Contraintes", value: limits.join(" · ") || "rien de dit", state: b.loads || b.environment ? "done" : "skip" },
    { step: 2, label: "Voisines", value: names.length ? cut(names.join(", ")) : "aucune", state: names.length ? "done" : "skip" },
    { step: 3, label: "Interfaces", value: nI ? `${nI} interface${nI > 1 ? "s" : ""}` : "aucune : une enveloppe par défaut", state: waits("interfaces") ? "todo" : nI ? "done" : "skip" },
    { step: 4, label: "Matière", value: [o.material || b.material || "à choisir", o.stock || ""].filter(Boolean).join(" — "), state: waits("material") ? "todo" : eg("material") || eg("form") ? "eg" : b.material ? "done" : "todo" },
    { step: 5, label: "Pièce", value: o.built ? "proposée, à droite" : "en attente des réponses", state: o.built ? "done" : "skip" },
  ];
}
/** How a question stands, for its dot on the rail : "done", "todo" or "open" (nothing said, nothing asked). */
export function stepState(i, memo) { const lines = (memo || []).filter((m) => m.step === i); return lines.some((m) => m.state === "todo") ? "todo" : lines.some((m) => m.state === "done" || m.state === "eg") ? "done" : "open"; }
/** What the guide says that belongs to a question. */
export const stepIssues = (issues, i) => (issues || []).filter((x) => stepOf(x.field) === i);
