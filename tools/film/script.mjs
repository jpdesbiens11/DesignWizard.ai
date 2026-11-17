/* DesignWizard.ai — the film : what is shown and what is said, second by second, in French and in English. Pure : the page that draws the
   film (film.js), the tool that renders it (tools/film_render.mjs) and the tests read the same timeline.
   Two and a half minutes, between a quick demonstration and a marketing film : the problem, the name, then the path of a design — intent,
   part, assembly, board, physics, drawings, AI — and the name again. The pictures are the real screens (web/img/tour) and two clips filmed
   on the running application (tools/film_shots.mjs). The narration is written to be SPOKEN : each cue is one breath. Until a voice is
   recorded, the cues are the subtitles.
   Nothing here claims more than the guided presentation does : the film takes its sentences from it. */

export const FPS = 24, W = 1600, H = 900;
export const LANGS = ["fr", "en"];
/** The two lines the film opens and closes on. */
export const SLOGANS = {
  open: { fr: "La conception, sans les détours.", en: "Design, without the detours." },
  close: { fr: "Moins de clics. Plus de conception.", en: "Fewer clicks. More engineering." },
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
  { id: "assembly", kind: "shot", t0: 56, t1: 73, station: L("Assemblage", "Assembly"), title: L("Les pièces se matent d'elles-mêmes", "Parts mate themselves"),
    chips: [{ at: 2.5, ...L("par leurs interfaces", "through their interfaces") }, { at: 7, ...L("une pièce change, l'assemblage suit", "change a part, the assembly follows") }, { at: 11.5, ...L("interférences vérifiées", "interferences checked") }],
    media: [clip("rover", 0, 17, [0.47, 0.5, 1.2], [0.47, 0.5, 1.36])] },
  { id: "board", kind: "shot", t0: 73, t1: 87, station: L("Carte électronique", "Circuit board"), title: L("La carte : des fonctions aux fichiers de fabrication", "The board: from functions to fabrication files"),
    chips: [{ at: 2.5, ...L("même projet, mêmes interfaces", "same project, same interfaces") }, { at: 7, ...L("Gerber, perçage, placement", "Gerber, drill, placement") }],
    media: [still("pcba", 0, 7.5, [0.5, 0.5, 1], [0.5, 0.58, 1.4]), still("unites", 7.5, 14, [0.5, 0.55, 1.3], [0.45, 0.5, 1.5])] },
  { id: "physics", kind: "shot", t0: 87, t1: 106, station: L("Physique et isolation", "Physics and isolation"), title: L("Le calcul à la main et la simulation, côte à côte", "Hand calculation and simulation, side by side"),
    chips: [{ at: 2.5, ...L("21 modèles simples", "21 simple models") }, { at: 7.5, ...L("simulation recoupée", "simulation cross-checked") }, { at: 13, ...L("lignes de fuite, distances dans l'air", "creepage and clearance") }],
    media: [still("calcul", 0, 6.5, [0.5, 0.5, 1.05], [0.6, 0.5, 1.4]), still("simulation", 6.5, 12.5, [0.5, 0.52, 1.1], [0.5, 0.55, 1.45]), still("isolation", 12.5, 19, [0.5, 0.5, 1.1], [0.5, 0.56, 1.45])] },
  { id: "drawings", kind: "shot", t0: 106, t1: 124, station: L("Dessins, revue, commande", "Drawings, review, order"), title: L("Le dessin se fait seul — et reste à jour", "The drawing makes itself — and stays up to date"),
    chips: [{ at: 2.5, ...L("cotes, tolérances, cartouche", "dimensions, tolerances, title block") }, { at: 8, ...L("la revue dans l'outil", "the review, in the tool") }, { at: 13, ...L("dossier de commande", "order package") }],
    media: [still("dessin", 0, 7, [0.5, 0.5, 1.05], [0.46, 0.42, 1.55]), still("revue", 7, 12.5, [0.5, 0.5, 1.05], [0.5, 0.45, 1.3]), still("commande", 12.5, 18, [0.6, 0.5, 1.1], [0.8, 0.4, 1.5])] },
  { id: "ai", kind: "shot", t0: 124, t1: 137, station: L("Avec l'IA", "With AI"), title: L("On relit avant d'accepter", "You review before you accept"),
    chips: [{ at: 2.5, ...L("une tâche, comme à un technicien", "a task, as to a technician") }, { at: 7, ...L("aperçu des changements", "preview of the changes") }],
    media: [still("idee", 0, 13, [0.5, 0.5, 1.05], [0.5, 0.45, 1.3])] },
  { id: "open", kind: "words", t0: 137, t1: 144, big: L("Logiciel libre. Licence MIT.", "Open source. MIT licence."), small: L("Vos fichiers restent les vôtres.", "Your files stay yours.") },
  { id: "end", kind: "end", t0: 144, t1: 153, slogan: SLOGANS.close, small: L("Ouvrez la démo.", "Open the demo.") },
];
export const DURATION = SCENES[SCENES.length - 1].t1;

/** The narration : what the voice says, and when. One cue, one breath ; a cue never crosses the end of its scene by much. */
export const CUES = [
  { t0: 0.6, t1: 5.2, ...L("Concevoir un produit, aujourd'hui, c'est six logiciels autour d'une même pièce.", "Designing a product today means six tools around a single part.") },
  { t0: 5.4, t1: 8.8, ...L("Et aucun ne sait pourquoi elle existe.", "And none of them knows why it exists.") },
  { t0: 9.3, t1: 14.6, ...L("Exporter, réimporter, redessiner : chaque tour de boucle coûte des jours.", "Export, re-import, redraw: every loop costs days.") },
  { t0: 15.6, t1: 18.4, ...L("Voici DesignWizard.ai.", "Meet DesignWizard.ai.") },
  { t0: 18.8, t1: 22.6, ...L("La conception, sans les détours.", "Design, without the detours.") },
  { t0: 23.6, t1: 29.6, ...L("Tout part de l'intention : ce que la pièce relie, sa matière, son procédé.", "It all starts from intent: what the part connects, its material, its process.") },
  { t0: 30.2, t1: 38.4, ...L("La pièce naît de ses interfaces, comme chez un artisan à son établi. Sans esquisse.", "The part is born from its interfaces, like a craftsman at the bench. No sketch.") },
  { t0: 39.6, t1: 46.2, ...L("Un studio qui parle le langage de l'atelier. Un paramètre bouge, la pièce suit.", "A studio that speaks the language of the shop floor. Move a parameter, the part follows.") },
  { t0: 47, t1: 55.4, ...L("Les règles de fabrication tournent en direct, avec un correctif en un clic.", "Manufacturing rules run live, with a one-click fix.") },
  { t0: 56.6, t1: 62.6, ...L("Dans l'assemblage, les pièces se matent d'elles-mêmes, par leurs interfaces.", "In the assembly, parts mate themselves, through their interfaces.") },
  { t0: 63.4, t1: 72.2, ...L("Une pièce change : l'assemblage suit, et les interférences sont vérifiées.", "Change a part: the assembly follows, and interferences are checked.") },
  { t0: 73.6, t1: 79.6, ...L("La carte électronique vit dans le même projet, avec les mêmes interfaces.", "The circuit board lives in the same project, with the same interfaces.") },
  { t0: 80.2, t1: 86.4, ...L("Des fonctions jusqu'aux fichiers de fabrication.", "From functions all the way to fabrication files.") },
  { t0: 87.6, t1: 93, ...L("La physique, d'abord par des modèles simples, que l'on peut refaire à la main.", "Physics first, through simple models you can redo by hand.") },
  { t0: 93.6, t1: 99, ...L("Puis la simulation, recoupée par le calcul.", "Then simulation, cross-checked by the calculation.") },
  { t0: 99.6, t1: 105.4, ...L("Et les distances d'isolement, mesurées sur tout l'assemblage.", "And isolation distances, measured across the whole assembly.") },
  { t0: 106.6, t1: 112.4, ...L("Le dessin se fait seul, et reste à jour.", "The drawing makes itself, and stays up to date.") },
  { t0: 113, t1: 118.2, ...L("La revue de conception se tient dans l'outil.", "The design review happens in the tool.") },
  { t0: 118.6, t1: 123.4, ...L("Et la pièce part en commande, avec son dossier.", "And the part goes out to order, with its package.") },
  { t0: 124.6, t1: 130.4, ...L("L'intelligence artificielle ? On lui confie une tâche, comme à un technicien.", "Artificial intelligence? You hand it a task, as you would a technician.") },
  { t0: 131, t1: 136.4, ...L("Et l'on relit avant d'accepter.", "And you review before you accept.") },
  { t0: 137.6, t1: 143.4, ...L("Un logiciel libre, sous licence MIT. Vos fichiers restent les vôtres.", "Open source, under the MIT licence. Your files stay yours.") },
  { t0: 144.8, t1: 149, ...L("Moins de clics. Plus de conception.", "Fewer clicks. More engineering.") },
  { t0: 149.4, t1: 152.4, ...L("DesignWizard.ai. Ouvrez la démo.", "DesignWizard.ai. Open the demo.") },
];

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
/** The narration as a script to record : scene by scene, with the time of each line. */
export function toScript(lang) {
  const out = [lang === "fr" ? "# DesignWizard.ai — narration de la vidéo" : "# DesignWizard.ai — video narration", "",
    lang === "fr" ? `Durée : ${Math.floor(DURATION / 60)} min ${String(DURATION % 60).padStart(2, "0")} s. Une ligne, un souffle : chaque ligne se dit entre ses deux temps. Ton : chaleureux, assuré, sans emphase.`
      : `Length: ${Math.floor(DURATION / 60)} min ${String(DURATION % 60).padStart(2, "0")} s. One line, one breath: each line is said between its two times. Tone: warm, confident, unforced.`, ""];
  for (const s of SCENES) {
    const mine = CUES.filter((c) => c.t0 >= s.t0 - 0.01 && c.t0 < s.t1); if (!mine.length) continue;
    out.push(`## ${stamp(s.t0).slice(3, 8)} — ${s.station ? s.station[lang] : s.kind === "end" ? (lang === "fr" ? "Fin" : "End") : s.kind === "logo" ? "DesignWizard.ai" : lang === "fr" ? "Ouverture" : "Opening"}`, "");
    for (const c of mine) out.push(`- **${stamp(c.t0).slice(3, 10)} → ${stamp(c.t1).slice(3, 10)}** ${c[lang]}`);
    out.push("");
  }
  return out.join("\n");
}
