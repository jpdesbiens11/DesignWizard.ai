/* DesignWizard.ai — the film of the platform : two and a half minutes, in French and in English. Its pictures are the real screens, drawn
   frame by frame by tools/film_render.mjs from one timeline (tools/film/script.mjs) ; the files live in web/video. The home screen opens
   the film in a dialog ; the showcase page (vitrine.html) shows it without a script.
   Two states, told by FILM.voice (docs/VIDEO.md) : a silent film whose narration is drawn in the picture, or a film that speaks, whose
   picture carries no subtitles — they are a track, shown only while the player's sound is off (core/captions.js).
   Pure half : the files of a language, the length said in words, the language to open in, what the screen says about the sound. */

import { el, btn, modal } from "./dom.js";
import { followSound } from "./captions.js";

/** The film : its length in seconds, its languages and their names, and what the screen says about its sound. */
export const FILM = {
  seconds: 153, langs: ["fr", "en"], names: { fr: "Français", en: "English" },
  voice: false,      // true once the published files speak : web/video/designwizard_<lang>.mp4 then carry a voice and no drawn subtitles
  silent: { fr: "Sans son : la narration se lit à l'écran.", en: "No sound: the narration reads on screen." },
  spoken: { fr: "Son coupé : les sous-titres apparaissent.", en: "Sound off: the subtitles appear." },
};
/** What the screen says about the sound of the film, in a language. */
export const filmNote = (lang, voice = FILM.voice) => (voice ? FILM.spoken : FILM.silent)[FILM.langs.includes(lang) ? lang : "fr"];
/** The language the film opens in : English for a browser set to English, French for all others. */
export const filmLang = (wanted) => (String(wanted || "").toLowerCase().startsWith("en") ? "en" : "fr");
/** The files of the film in a language : { lang, src, poster, vtt }. */
export function filmFiles(lang, base = "video/") {
  const l = FILM.langs.includes(lang) ? lang : "fr";
  return { lang: l, src: `${base}designwizard_${l}.mp4`, poster: `${base}designwizard_${l}.jpg`, vtt: `${base}designwizard_${l}.vtt` };
}
/** « 2 min 33 » */
export const filmLength = (s = FILM.seconds) => `${Math.floor(s / 60)} min ${String(Math.round(s % 60)).padStart(2, "0")}`;

/** Opens the film in a dialog and plays it. The language can be changed while it plays : the other version takes over at the same second. */
export function showFilm(lang) {
  let now = filmFiles(filmLang(lang || (typeof navigator !== "undefined" ? navigator.language : "")));
  const video = el("video", { class: "film-video", controls: true, playsInline: true, preload: "metadata", width: 1280, height: 720 });
  const note = el("span", { class: "muted grow" }), picks = FILM.langs.map((l) => btn(FILM.names[l], () => choose(l), { small: true }));
  const track = FILM.voice ? el("track", { kind: "subtitles" }) : null;      // a film that speaks : its subtitles are a track, drawn only while the sound is off
  if (track) { video.append(track); followSound(video); }
  const say = () => { picks.forEach((b, i) => { const on = FILM.langs[i] === now.lang; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); }); note.textContent = filmNote(now.lang); video.lang = now.lang; };
  const load = (at, playing) => {
    if (track) { track.src = now.vtt; track.srclang = now.lang; track.label = FILM.names[now.lang]; }
    video.poster = now.poster; video.src = now.src; say();
    video.addEventListener("loadedmetadata", () => { if (at > 0) video.currentTime = Math.min(at, video.duration || at); if (playing) video.play().catch(() => {}); }, { once: true });
  };
  video.addEventListener("error", () => { if (video.getAttribute("src")) note.textContent = now.lang === "en" ? "The video did not load: check the connection, then choose the language again." : "La vidéo ne s'est pas chargée : vérifiez la connexion, puis choisissez de nouveau la langue."; });
  function choose(l) { if (l === now.lang && !video.error) return; const at = video.currentTime || 0, playing = !video.paused && !video.ended; now = filmFiles(l); load(at, playing); }
  modal(`DesignWizard.ai en ${filmLength()}`, [video,
    el("div", { class: "film-bar" }, el("span", { class: "film-langs", role: "group", "aria-label": "Langue de la vidéo" }, picks), note,
      el("a", { class: "btn btn-small", href: "presentation.html", target: "_blank", rel: "noopener" }, "Présentation guidée"))],
  { xl: true, onClose: () => { video.pause(); video.removeAttribute("src"); video.load(); } });      // a film taken off the page would go on playing : it is stopped and let go
  load(0, true);      // the click that opened the dialog is the permission to play
  return video;
}
