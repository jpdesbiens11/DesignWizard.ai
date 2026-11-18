/* DesignWizard.ai — the teaser : half a minute cut from the film, for a post or the top of a page (kit de lancement, demande de JP).
   It is not drawn again : each of its shots is a span of a scene of the film (tools/film/script.mjs), so a new picture of the film
   gives a new teaser by the same cut (tools/film_teaser.mjs). Its narration is its own — the story of the film in seven breaths — and
   holds the same rules as the film's : it tells, it never reads out what the screen writes ; every sentence is something the tool
   does ; no time saved is given, nobody measured one. Pure : the tool and the tests read the same timeline. */

import { SCENES, LANGS, readsScreen } from "./script.mjs";

const L = (fr, en) => ({ fr, en });
/** The shots, in order : a scene of the film, `from` seconds after it begins, for `len` seconds. */
export const TEASER_CUTS = [
  { scene: "problem", from: 1.6, len: 3 },       // the sentence on paper : six tools around one part
  { scene: "shop", from: 1.8, len: 5 },          // the part is born from its intent
  { scene: "part", from: 1.2, len: 5 },          // a dimension climbs, the part follows
  { scene: "assembly", from: 5, len: 5 },        // the Rover opens
  { scene: "physics", from: 7.2, len: 4 },       // the simulation, cross-checked
  { scene: "drawings", from: 1.4, len: 3.6 },    // the drawing
  { scene: "end", from: 2.6, len: 6 },           // the name and its line
];
/** Each shot with its times : { scene, a, b (seconds of the film), at (seconds of the teaser), len }. */
export function teaserSpans() {
  let at = 0;
  return TEASER_CUTS.map((c) => { const s = SCENES.find((x) => x.id === c.scene); if (!s) throw new Error(`teaser : no scene « ${c.scene} » in the film`); const span = { scene: c.scene, a: Math.round((s.t0 + c.from) * 1000) / 1000, b: Math.round((s.t0 + c.from + c.len) * 1000) / 1000, at: Math.round(at * 1000) / 1000, len: c.len }; at += c.len; return span; });
}
export const TEASER_DURATION = Math.round(TEASER_CUTS.reduce((n, c) => n + c.len, 0) * 1000) / 1000;

/** What the voice tells, and when (seconds of the teaser). One line, one breath ; a line stays inside its shot. */
export const TEASER_LINES = [
  { t0: 0.3, t1: 2.9, ...L("Une pièce commence par une question.", "Every part begins with a question.") },
  { t0: 3.3, t1: 7.8, ...L("À quoi sert-elle ? Dites-le une seule fois : l'outil s'en souvient.", "What is it for? Say it once: the tool remembers.") },
  { t0: 8.3, t1: 12.8, ...L("La forme suit. Et ce que l'atelier refuserait se voit tout de suite.", "The shape follows. And what the shop would refuse shows right away.") },
  { t0: 13.3, t1: 17.8, ...L("Les pièces trouvent leur place. Changez-en une : les autres suivent.", "Parts find their place. Change one, and the others follow.") },
  { t0: 18.3, t1: 21.8, ...L("Le calcul se recoupe, le plan se trace.", "The calculation is cross-checked, the drawing draws itself.") },
  { t0: 22.2, t1: 25.4, ...L("Jusqu'au dossier qui part chez le fabricant.", "Right down to the package that goes to the maker.") },
  { t0: 26, t1: 31.2, ...L("DesignWizard.ai. Libre, ouvert à tous. Essayez la démonstration.", "DesignWizard.ai. Free and open to all. Try the demonstration.") },
];
/** How long the voice may speak for line i : to a breath before the next one, or to the end of the teaser. */
export const teaserRoom = (i) => (i + 1 < TEASER_LINES.length ? TEASER_LINES[i + 1].t0 - 0.15 : TEASER_DURATION - 0.25) - TEASER_LINES[i].t0;
/** The on-screen texts of the film a line says word for word : none. */
export const teaserReads = (line, lang) => readsScreen(line, lang);
/** The shot on screen at t (seconds of the teaser). */
export const teaserShotAt = (t) => teaserSpans().find((s) => t >= s.at && t < s.at + s.len) || null;

const stamp = (t, sep) => { const ms = Math.round(t * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}${sep}${String(ms % 1000).padStart(3, "0")}`; };
/** The narration as subtitles : SubRip, the format the social networks take beside a film. */
export const teaserSrt = (lang) => `${TEASER_LINES.map((c, i) => `${i + 1}\n${stamp(c.t0, ",")} --> ${stamp(c.t1, ",")}\n${c[lang]}`).join("\n\n")}\n`;
/** The teaser as a script : what is shown, what is said, both languages. */
export function teaserScript() {
  const spans = teaserSpans(), out = ["# DesignWizard.ai — bande-annonce · teaser", "", `${TEASER_DURATION} s, coupées du film (tools/film/teaser.mjs). L'image montre, la voix raconte ; aucun chiffre de gain.`, "",
    "| Temps · time | Plan du film · shot | La voix raconte | The voice tells |", "|---|---|---|---|"];
  for (const c of TEASER_LINES) { const s = spans.find((x) => c.t0 >= x.at && c.t0 < x.at + x.len); out.push(`| ${stamp(c.t0, ".").slice(6, 10)} | ${s ? `${s.scene} (${s.a.toFixed(1)} → ${s.b.toFixed(1)} s)` : "—"} | ${c.fr} | ${c.en} |`); }
  return out.join("\n") + "\n";
}
export { LANGS };
