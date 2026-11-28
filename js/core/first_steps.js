/* DynamiteOrbit.ai — first steps : the journey of a newcomer, from an empty project to a released revision, in eight steps
   that tick themselves. Nothing is declared by hand : a step is done when the PROJECT shows it — a part exists, an
   assembly holds, a calculation was kept, the guide has nothing left to correct. Each step says what one does on its
   screen and how (the help of that screen, in a few lines) ; the guide of the top bar repeats it there until it is done.
   Pure : the screen « Premiers pas » draws it, the home page shows where one stands. */

import { projectIssues } from "./guide_checks.js";

export const STEP_GROUPS = [
  { id: "start", label: "Commencer", hint: "un projet sous les yeux", icon: "home", color: "#64748b" },
  { id: "design", label: "Concevoir", hint: "de l'intention à l'assemblage", icon: "atelier", color: "#2563eb" },
  { id: "check", label: "Vérifier", hint: "la physique et les règles", icon: "physics", color: "#ea580c" },
  { id: "deliver", label: "Livrer", hint: "revue, révision, dossier", icon: "report", color: "#16a34a" },
];
const blocking = (p) => projectIssues(p).filter((x) => x.level === "error" || x.level === "todo").length;
/** The steps, in order. screen : the key of the screen where the step is done ; done(project) : does the project show it ? */
export const FIRST_STEPS = [
  { id: "project", group: "start", screen: "home", icon: "home", title: "Ouvrir un projet", what: "Chargez la démonstration, ou créez votre projet.",
    how: ["« Charger la démonstration » ouvre un variateur complet : boîtier moulé, deux cartes, dissipateur, déjà reliés par leurs interfaces.", "« Nouveau projet » part d'une page blanche ; « Premier design avec une IA » d'une entrevue menée par l'assistant de votre choix."], done: (p) => !!p },
  { id: "part", group: "design", screen: "shop", icon: "atelier", title: "Une première pièce, par son intention", what: "Dans l'Atelier (Shop), dites à quoi sert la pièce : elle se construit sans esquisse.",
    how: ["Choisissez la matière première et le procédé : les matières que le procédé ne travaille pas sont grisées.", "Ajoutez ses interfaces — ce qui la tient, la positionne, la relie.", "Un champ qui clignote porte une valeur d'exemple : tapez la vôtre ou confirmez-la."], done: (p) => !!p && (p.parts || []).length > 0 },
  { id: "iface", group: "design", screen: "interfaces", icon: "interfaces", title: "Des interfaces qui portent une clé", what: "Une interface a deux côtés, A et B, et une clé : deux pièces qui portent la même clé s'assemblent seules.",
    how: ["Décrivez la pièce et cochez ses voisines : chaque interface reçoit sa clé.", "La pièce voisine créée ensuite dans l'Atelier reprend la clé, côté B."], done: (p) => !!p && (p.parts || []).some((x) => (x.interfaces || []).some((i) => i && i.key)) },
  { id: "asm", group: "design", screen: "assembly", icon: "assembly", title: "Un assemblage qui se monte seul", what: "Posez les pièces : les interfaces de même clé se matent seules et restent liées.",
    how: ["« Mates », à droite, propose les accouplements que les clés permettent.", "L'arbre de gauche range les accouplements par état : rompus, à vérifier, sains.", "Changez un côté d'une interface liée : l'autre suit."], done: (p) => !!p && (p.assemblies || []).some((a) => (a.instances || []).length > 1 && (a.mates || []).length > 0) },
  { id: "physics", group: "check", screen: "physics", icon: "physics", title: "La physique, par un modèle simple", what: "Une poutre, une vis, un tube, une ailette : le calcul dit si cela tient, et se garde au nom de la pièce.",
    how: ["Choisissez un média — matière ou fluide — : ses propriétés suivent, vous ne les tapez pas.", "« Garder ce calcul » le range avec la pièce ; il part en Word, en PDF ou en classeur Excel."], done: (p) => !!p && (p.physics || []).length > 0 },
  { id: "rules", group: "check", screen: "dfx", icon: "dfx", title: "Plus rien à corriger", what: "Le guide et le DFx disent ce qui manque ou cloche ; un correctif s'applique en un clic.",
    how: ["Le bouton « Guide » de la barre du haut liste ce qui reste, écran par écran : à corriger, à entrer, à vérifier, conseil.", "DFx : les règles par procédé, chacune avec sa source. Isolation : clearance et creepage mesurés sur l'assemblage complet."], done: (p) => !!p && (p.parts || []).length > 0 && blocking(p) === 0 },
  { id: "review", group: "deliver", screen: "review", icon: "check", title: "Passer en revue", what: "Chaque pièce, assemblage, carte et analyse a son état de revue et vos notes.",
    how: ["Marquez « Revu » ce que vous avez relu ; ce qui change ensuite repasse « Modifié depuis la revue ».", "Ce qu'une IA a écrit arrive en « Brouillon IA » : rien n'est validé sans vous."], done: (p) => !!p && Object.values((p.review && p.review.items) || {}).some((x) => x && x.state === "ok") },
  { id: "release", group: "deliver", screen: "plm", icon: "lock", title: "Geler une révision", what: "Une révision gelée est figée sous son numéro ; sa revue de conception, par quelqu'un d'autre que son auteur, la libère : son dossier — dessin PDF, STEP, .dwiz — part alors chez le fournisseur.",
    how: ["Dessins : vues, cotes à bulles, cartouche et notes, en PDF.", "Révisions : « Geler la révision », puis « Revue de conception » ; la règle 3F dit s'il faut une nouvelle révision ou un nouveau numéro."], done: (p) => !!p && (p.releases || []).length > 0 },
];
const hashOf = (s) => `#/${s.screen}`;

/** Where a project stands. → { steps [{ ...step, n, done, next, hash, color, groupLabel }], groups [{ ...group, steps }], done, total, next (the first step not done, or null) } */
export function firstSteps(project) {
  const steps = FIRST_STEPS.map((s, i) => { const g = STEP_GROUPS.find((x) => x.id === s.group); return { ...s, n: i + 1, done: !!s.done(project), hash: hashOf(s), color: g.color, groupLabel: g.label }; });
  const next = steps.find((s) => !s.done) || null; for (const s of steps) s.next = s === next;
  return { steps, groups: STEP_GROUPS.map((g) => ({ ...g, steps: steps.filter((s) => s.group === g.id) })), done: steps.filter((s) => s.done).length, total: steps.length, next };
}
/** The first steps as an entry of the guide, on the screen of a step that is not done yet : what one does here, and how. null otherwise. */
export function firstStepHere(project, screen) {
  const F = firstSteps(project), s = F.steps.find((x) => x.screen === screen && !x.done);
  return s ? { level: "tip", text: `Premiers pas (${s.n}/${F.total}) — ${s.title}. ${s.what} ${s.how[0]}`, screen, ref: null, hash: "#/start", step: s.id } : null;
}
/** A line that says where one stands : « 3 étapes sur 8 — ensuite : … ». */
export const firstStepsLine = (F) => (F.next ? `${F.done} étape${F.done > 1 ? "s" : ""} sur ${F.total} — ensuite : ${F.next.title.charAt(0).toLowerCase()}${F.next.title.slice(1)}` : `Les ${F.total} étapes sont faites`);
