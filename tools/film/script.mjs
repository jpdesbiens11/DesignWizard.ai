/* DynamiteOrbit.ai — the film : what is shown and what is said, second by second, in French and in English. Pure : the page that draws the
   film (film.js), the tool that renders it (tools/film_render.mjs) and the tests read the same timeline.
   Under three minutes, between a quick demonstration and a marketing film : the problem, the name, then the path of a design — intent,
   part, its family of variants, assembly by modules, board, physics, drawings, AI — and the name again. The pictures are the real screens
   (web/img/tour) and three clips filmed on the running application (tools/film_shots.mjs).
   The narration is a STORY told over the pictures (demande de JP, 18 novembre 2026) : the voice never reads out what the screen already
   says — titles, chips and slogans are for the eye, the voice tells why (shownTexts and readsScreen, and a test, keep the two apart).
   Its thread : a part begins with a question — what is it for ? — and the tool is the one that remembers the answer, from the first
   need to the order. Each cue is one breath, and the cues are the subtitles. Nothing here claims more than the guided presentation
   does, every sentence is something the tool does on the screen shown, and no time saved is given : nobody measured one. */

export const FPS = 24, W = 1600, H = 900;
export const LANGS = ["fr", "en"];
/** The two lines the film opens and closes on. */
export const SLOGANS = {
  open: { fr: "On construit la fusée en volant.", en: "We build the rocket in flight." },
  close: { fr: "On construit la fusée en volant.", en: "We build the rocket in flight." },
};
const L = (fr, en) => ({ fr, en });
/* a picture or a clip inside a scene : what is framed at its start and at its end — [centre x, centre y (0…1 of the picture), zoom (1 = whole picture)] */
const still = (img, t0, t1, from, to) => ({ img, t0, t1, from, to });
const clip = (name, t0, t1, from, to) => ({ clip: name, t0, t1, from, to });

/** The scenes, in order. kind : "words" (a sentence on paper), "logo" (the name and its slogan), "shot" (a screen of the platform, framed),
    "end" (the last card). Times in seconds from the start of the film ; a chip appears `at` seconds after its scene begins. */
export const SCENES = [
  { id: "problem", kind: "words", t0: 0, t1: 9, big: L("Six logiciels autour d'une pièce.", "Six tools around one part."), small: L("Et aucun ne sait pourquoi elle existe.", "And none of them knows why it exists.") },
  { id: "loop", kind: "words", t0: 9, t1: 15, big: L("Chaque tour de boucle coûte des jours.", "Every loop costs days."), small: L("Exporter, réimporter, redessiner, revérifier.", "Export, re-import, redraw, re-check.") },
  { id: "name", kind: "logo", t0: 15, t1: 23, slogan: SLOGANS.open, small: L("De l'intention à la pièce, de la pièce au système.", "From intent to part, from part to system.") },
  { id: "shop", kind: "shot", t0: 23, t1: 39, station: L("Atelier", "Shop"), title: L("La pièce naît de son intention", "The part is born from its intent"),
    chips: [{ at: 2.5, ...L("ce qu'elle relie", "what it connects") }, { at: 5.5, ...L("sa matière, son procédé", "its material, its process") }, { at: 9, ...L("sans esquisse", "no sketch") }],
    media: [still("atelier", 0, 16, [0.5, 0.5, 1], [0.42, 0.52, 1.45])] },
  { id: "part", kind: "shot", t0: 39, t1: 56, station: L("Pièce", "Part"), title: L("Un studio qui parle le langage de l'atelier", "A studio that speaks the language of the shop floor"),
    chips: [{ at: 2.5, ...L("paramètres vivants", "live parameters") }, { at: 6.5, ...L("règles de fabrication en direct", "manufacturing rules, live") }, { at: 11, ...L("correctif en un clic", "one-click fix") }],
    media: [clip("stepper", 0, 9, [0.72, 0.42, 1.35], [0.8, 0.36, 1.6]), still("piece", 9, 17, [0.5, 0.5, 1.05], [0.42, 0.55, 1.35])] },
  { id: "family", kind: "shot", t0: 56, t1: 68, station: L("Variantes", "Variants"), title: L("Une famille tient dans une seule pièce", "A whole family lives in one part"),
    chips: [{ at: 2.5, ...L("ses cousines, chacune sous son nom", "its cousins, each under a name") }, { at: 6.5, ...L("un clic passe de l'une à l'autre", "one click goes from one to the other") }, { at: 9.5, ...L("ce qui sort dit laquelle", "what comes out says which one") }],
    media: [clip("variants", 0, 12, [0.3, 0.42, 1.28], [0.33, 0.4, 1.42])] },
  { id: "assembly", kind: "shot", t0: 68, t1: 90, station: L("Assemblage", "Assembly"), title: L("Les pièces se matent d'elles-mêmes", "Parts mate themselves"),
    chips: [{ at: 2.5, ...L("par leurs interfaces", "through their interfaces") }, { at: 7, ...L("une pièce change, l'assemblage suit", "change a part, the assembly follows") }, { at: 11.5, ...L("interférences vérifiées", "interferences checked") }, { at: 17, ...L("des modules dans l'assemblage", "modules inside the assembly") }],
    media: [clip("rover", 0, 22, [0.47, 0.5, 1.2], [0.47, 0.5, 1.36])] },
  { id: "board", kind: "shot", t0: 90, t1: 104, station: L("Carte électronique", "Circuit board"), title: L("La carte : des fonctions aux fichiers de fabrication", "The board: from functions to fabrication files"),
    chips: [{ at: 2.5, ...L("même projet, mêmes interfaces", "same project, same interfaces") }, { at: 7, ...L("Gerber, perçage, placement", "Gerber, drill, placement") }],
    media: [still("pcba", 0, 7.5, [0.5, 0.5, 1], [0.5, 0.58, 1.4]), still("unites", 7.5, 14, [0.5, 0.55, 1.3], [0.45, 0.5, 1.5])] },
  { id: "physics", kind: "shot", t0: 104, t1: 123, station: L("Physique et isolation", "Physics and isolation"), title: L("Le calcul à la main et la simulation, côte à côte", "Hand calculation and simulation, side by side"),
    chips: [{ at: 2.5, ...L("21 modèles simples", "21 simple models") }, { at: 7.5, ...L("simulation recoupée", "simulation cross-checked") }, { at: 13, ...L("lignes de fuite, distances dans l'air", "creepage and clearance") }],
    media: [still("calcul", 0, 6.5, [0.5, 0.5, 1.05], [0.6, 0.5, 1.4]), still("simulation", 6.5, 12.5, [0.5, 0.52, 1.1], [0.5, 0.55, 1.45]), still("isolation", 12.5, 19, [0.5, 0.5, 1.1], [0.5, 0.56, 1.45])] },
  { id: "drawings", kind: "shot", t0: 123, t1: 141, station: L("Dessins, revue, commande", "Drawings, review, order"), title: L("Le dessin se fait seul — et reste à jour", "The drawing makes itself — and stays up to date"),
    chips: [{ at: 2.5, ...L("cotes, tolérances, cartouche", "dimensions, tolerances, title block") }, { at: 8, ...L("la revue dans l'outil", "the review, in the tool") }, { at: 13, ...L("dossier de commande", "order package") }],
    media: [still("dessin", 0, 7, [0.5, 0.5, 1.05], [0.46, 0.42, 1.55]), still("revue", 7, 12.5, [0.5, 0.5, 1.05], [0.5, 0.45, 1.3]), still("commande", 12.5, 18, [0.6, 0.5, 1.1], [0.8, 0.4, 1.5])] },
  { id: "ai", kind: "shot", t0: 141, t1: 154, station: L("Avec l'IA", "With AI"), title: L("On relit avant d'accepter", "You review before you accept"),
    chips: [{ at: 2.5, ...L("une tâche, comme à un technicien", "a task, as to a technician") }, { at: 7, ...L("aperçu des changements", "preview of the changes") }],
    media: [still("idee", 0, 13, [0.5, 0.5, 1.05], [0.5, 0.45, 1.3])] },
  { id: "open", kind: "words", t0: 154, t1: 161, big: L("Logiciel libre. Licence MIT.", "Open source. MIT licence."), small: L("Vos fichiers restent les vôtres.", "Your files stay yours.") },
  { id: "end", kind: "end", t0: 161, t1: 170, slogan: SLOGANS.close, small: L("Ouvrez la démo.", "Open the demo.") },
];
export const DURATION = SCENES[SCENES.length - 1].t1;

/** The narration : what the voice tells, and when. One cue, one breath ; a cue stays inside its scene.
    take : the number a line was first recorded under, when lines were added before it since — its recording is kept (tools/film_voice.mjs). */
export const CUES = [
  { t0: 0.5, t1: 3.9, ...L("Avant le premier trait, il y a toujours une question.", "Before the first sketch, there is always a question.") },
  { t0: 4.1, t1: 8.8, ...L("À quoi cette pièce doit-elle servir ? Vous, vous le savez.", "What is this part for? You already know.") },
  { t0: 9.2, t1: 14.8, ...L("Mais il faut le redire. Au modeleur, au calcul, au dessin. Encore et encore.", "But you must repeat it. To the modeller, the solver, the drawing. Every time.") },
  { t0: 15.3, t1: 18.4, ...L("Et si on ne le disait qu'une fois ?", "What if you only had to say it once?") },
  { t0: 18.6, t1: 22.9, ...L("DynamiteOrbit.ai : l'outil qui retient le pourquoi.", "DynamiteOrbit.ai: the tool that remembers why.") },
  { t0: 23.4, t1: 27.7, ...L("Ici, on ne dessine pas d'abord. On laisse parler la pièce.", "Here, you do not start by drawing. You let the part speak.") },
  { t0: 28.2, t1: 33, ...L("Je me visse ici. Je reçois un arbre. Je laisse passer un câble.", "I bolt on here. I take a shaft. I let a cable through.") },
  { t0: 33.4, t1: 38.7, ...L("Et l'outil propose une forme, un brut, et les étapes pour la fabriquer.", "And the tool proposes a shape, a stock size, and the steps to make it.") },
  { t0: 39.5, t1: 45.2, ...L("Ensuite, on règle. Une cote grimpe, et le boîtier s'étire sous vos yeux.", "Then you tune it. A dimension climbs, and the housing stretches as you watch.") },
  { t0: 45.8, t1: 50.8, ...L("Une paroi trop mince ? Un perçage hors des forets standard ?", "A wall too thin? A hole no standard drill can make?") },
  { t0: 51.2, t1: 55.7, ...L("L'outil le voit avant l'atelier, et propose la correction.", "The tool sees it before the shop does, and offers the fix.") },
  { t0: 56.5, t1: 61.4, ...L("Et quand il en faut plusieurs ? Une plus longue. Une autre, sans fenêtre.", "And when you need several? A longer one. Another, without its window.") },
  { t0: 62, t1: 67.6, ...L("C'est la même pièce, sous un autre nom. Ses plans, ses fichiers, sa commande la suivent.", "The same part, under another name. Its drawings, files and order follow.") },
  { t0: 68.5, t1: 73.6, take: 12, ...L("Aucune pièce ne vit seule. Chacune sait déjà où elle s'attache.", "No part lives alone. Each one already knows where it attaches.") },
  { t0: 74, t1: 79.2, take: 13, ...L("Mettez-les ensemble : elles trouvent leur place, sans qu'on la leur montre.", "Bring them together: they find their place, with no one showing them.") },
  { t0: 79.6, t1: 84.7, take: 14, ...L("Changez-en une, les autres suivent. Et si deux se gênent, vous le savez.", "Change one, and the others follow. If two collide, you are told.") },
  { t0: 85.2, t1: 89.7, ...L("Un produit se monte par modules : chacun se pose d'un seul bloc.", "A product goes together by modules: each sets in as one block.") },
  { t0: 90.5, t1: 97.2, take: 15, ...L("L'électronique ne vit pas ailleurs. La carte se conçoit dans le même projet que son boîtier.", "Electronics do not live elsewhere. The board is designed in the same project as its housing.") },
  { t0: 97.8, t1: 103.2, take: 16, ...L("Et le jour où elle part en fabrication, ses fichiers sont prêts.", "And the day it goes to fabrication, its files are ready.") },
  { t0: 104.5, t1: 110.5, take: 17, ...L("Chauffera-t-elle ? Tiendra-t-elle ? D'abord, un calcul qu'on refait au crayon.", "Will it run hot? Will it hold? First, a calculation you can redo in pencil.") },
  { t0: 110.9, t1: 116.4, take: 18, ...L("Puis la simulation. Et quand les deux réponses divergent, l'outil vous le dit.", "Then the simulation. When the two answers disagree, the tool says so.") },
  { t0: 116.8, t1: 122.6, take: 19, ...L("Entre deux conducteurs sous tension, il mesure le plus court chemin. Partout.", "Between two live conductors, it measures the shortest path. Everywhere.") },
  { t0: 123.5, t1: 129.6, take: 20, ...L("Pendant ce temps, le plan s'est tracé tout seul. La pièce change ? Lui aussi.", "Meanwhile, the drawing has drawn itself. The part changes? So does the drawing.") },
  { t0: 130, t1: 135, take: 21, ...L("À la revue, tout le monde regarde la même pièce, au même endroit.", "At the review, everyone looks at the same part, in the same place.") },
  { t0: 135.5, t1: 140.6, take: 22, ...L("Et le jour de commander, tout tient dans un seul dossier.", "And on ordering day, everything fits in a single package.") },
  { t0: 141.5, t1: 147.6, take: 23, ...L("Et l'intelligence artificielle ? Confiez-lui le dossier, comme à une recrue brillante.", "And artificial intelligence? Hand it the file, as you would a brilliant new hire.") },
  { t0: 148, t1: 153.6, take: 24, ...L("Elle propose. Vous relisez. Et rien ne change sans votre accord.", "It proposes. You read. And nothing changes without your say-so.") },
  { t0: 154.5, t1: 160.4, take: 25, ...L("Le code est ouvert à tous. Et votre travail ne reste prisonnier de personne.", "The code is open to all. And your work is never locked in.") },
  { t0: 161.4, t1: 164.2, take: 26, ...L("Une pièce commence par une question.", "A part begins with a question.") },
  { t0: 164.5, t1: 169.7, take: 27, ...L("Voici l'outil qui se souvient de la réponse : DynamiteOrbit.ai.", "Here is the tool that remembers the answer: DynamiteOrbit.ai.") },
];

/** Everything the film writes on screen in a language : what the voice does not read out. */
export const shownTexts = (lang) => [...new Set(SCENES.flatMap((s) => [s.big, s.small, s.slogan, s.station, s.title, ...(s.chips || [])].filter(Boolean).map((x) => x[lang])))];
/** A text as it is compared : lower case, punctuation gone. */
export const plain = (text) => text.toLowerCase().replace(/[^\p{L}\p{N}']+/gu, " ").trim();
/** The on-screen texts (two words or more) that a cue says word for word : none, in a narration that tells instead of reading. */
export const readsScreen = (cue, lang) => shownTexts(lang).filter((x) => plain(x).includes(" ") && ` ${plain(cue[lang])} `.includes(` ${plain(x)} `));

/** How long the voice may speak for cue i : from its start to a breath before the next cue, or to the end of the film. */
export const roomOf = (i) => (i + 1 < CUES.length ? CUES[i + 1].t0 - 0.15 : DURATION - 0.3) - CUES[i].t0;
/** A recorded line may be sped up by this much before it sounds hurried ; beyond, the line is rewritten or the timeline moved. */
export const MAX_TEMPO = 1.12;
/** How a recorded line of `seconds` fits a room : { tempo (1 : as recorded), ok, over (seconds it still runs past its room) }. */
export function fitLine(seconds, room) { const need = seconds > room ? seconds / room : 1, tempo = Math.min(need, MAX_TEMPO); return { tempo: Math.round(tempo * 1000) / 1000, ok: need <= MAX_TEMPO + 1e-9, over: Math.max(0, Math.round((seconds / tempo - room) * 100) / 100) }; }

/** The scene on screen at t. */
export const sceneAt = (t) => SCENES.find((s) => t >= s.t0 && t < s.t1) || (t >= DURATION ? SCENES[SCENES.length - 1] : SCENES[0]);
/** The cue said at t, or null. */
export const cueAt = (t) => CUES.find((c) => t >= c.t0 && t < c.t1) || null;
/** Words a voice reads per second in a cue : a narration that can be said without running. */
export const pace = (cue, lang) => cue[lang].trim().split(/\s+/).length / (cue.t1 - cue.t0);
const stamp = (t, sep = ".") => { const ms = Math.round(t * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}${sep}${String(ms % 1000).padStart(3, "0")}`; };
/** The narration as WebVTT subtitles. */
export const toVtt = (lang) => `WEBVTT\n\n${CUES.map((c, i) => `${i + 1}\n${stamp(c.t0)} --> ${stamp(c.t1)}\n${c[lang]}`).join("\n\n")}\n`;
/** The cues said during a scene, and the name a scene goes by in a script. */
const cuesOf = (s) => CUES.filter((c) => c.t0 >= s.t0 - 0.01 && c.t0 < s.t1);
const sceneName = (s, lang) => (s.station ? s.station[lang] : s.kind === "end" ? (lang === "fr" ? "Fin" : "End") : s.kind === "logo" ? "DynamiteOrbit.ai" : s.id === "open" ? (lang === "fr" ? "Logiciel libre" : "Open source") : s.id === "loop" ? (lang === "fr" ? "Le détour" : "The detour") : lang === "fr" ? "Ouverture" : "Opening");
/** The narration as a script to record : scene by scene, with the time of each line. */
export function toScript(lang) {
  const out = [lang === "fr" ? "# DynamiteOrbit.ai — narration de la vidéo" : "# DynamiteOrbit.ai — video narration", "",
    lang === "fr" ? `Durée : ${Math.floor(DURATION / 60)} min ${String(DURATION % 60).padStart(2, "0")} s. Une ligne, un souffle : chaque ligne se dit entre ses deux temps. Ton : chaleureux, assuré, sans emphase.`
      : `Length: ${Math.floor(DURATION / 60)} min ${String(DURATION % 60).padStart(2, "0")} s. One line, one breath: each line is said between its two times. Tone: warm, confident, unforced.`, ""];
  for (const s of SCENES) {
    const mine = cuesOf(s); if (!mine.length) continue;
    out.push(`## ${stamp(s.t0).slice(3, 8)} — ${sceneName(s, lang)}`, "");
    for (const c of mine) out.push(`- **${stamp(c.t0).slice(3, 10)} → ${stamp(c.t1).slice(3, 10)}** ${c[lang]}`);
    out.push("");
  }
  return out.join("\n");
}
/** The storyline : scene by scene, what the screen shows and what the voice tells over it, French and English side by side. */
export function toStoryline() {
  const len = `${Math.floor(DURATION / 60)} min ${String(DURATION % 60).padStart(2, "0")} s`, shown = (s, l) => [s.big, s.slogan, s.title, s.small, ...(s.chips || [])].filter(Boolean).map((x) => x[l]).join(" · ");
  const out = ["# DynamiteOrbit.ai — storyline du film · film storyline", "",
    `${len}. L'image montre, la voix raconte : elle ne lit jamais ce qui est écrit à l'écran. Fil de l'histoire : une pièce commence par une question — à quoi sert-elle ? — et l'outil est celui qui retient la réponse, du premier besoin à la commande.`, "",
    `${len}. The picture shows, the voice tells: it never reads out what is written on screen. The thread: a part begins with a question — what is it for? — and the tool is the one that remembers the answer, from the first need to the order.`, ""];
  for (const s of SCENES) {
    out.push(`## ${stamp(s.t0).slice(3, 8)} → ${stamp(s.t1).slice(3, 8)} — ${[...new Set(LANGS.map((l) => sceneName(s, l)))].join(" · ")}`, "");
    out.push(`- **À l'écran** : ${shown(s, "fr")}`, `- **On screen**: ${shown(s, "en")}`);
    if (s.media) out.push(`- **Image** : ${s.media.map((m) => (m.img ? `écran « ${m.img} »` : `plan filmé « ${m.clip} »`)).join(", puis ")}`);
    out.push("", "| Temps · time | La voix raconte | The voice tells |", "|---|---|---|");
    for (const c of cuesOf(s)) out.push(`| ${stamp(c.t0).slice(3, 10)} | ${c.fr} | ${c.en} |`);
    out.push("");
  }
  return out.join("\n");
}
