/* DynamiteOrbit.ai — the subtitles of a film that speaks (demande de JP, 18 novembre 2026) : they stay on while the voice is heard, and
   every player carries both languages. One listens in a language and reads in it — what the film opens with —, in the other one, in
   both at once, or reads nothing : a choice next to the player (ordinary radio buttons), kept in step with the player's own subtitle
   menu. Before that day the subtitles showed only once the sound was off ; the voice now tells a story and the subtitles are its text.
   Pure half first (what a choice means), then the half that touches a player.
   No import : the showcase page loads this file alone (web/js/vitrine.js), the application through core/film.js. */

/** The choices a player with these subtitle languages offers : each language, both at once (when there are two), none. */
export const subChoices = (langs) => [...langs, ...(langs.length > 1 ? ["both"] : []), "off"];
/** The choice a film in a language opens with : its own language — what is said is what is read. */
export const subDefault = (lang, langs) => (langs.includes(lang) ? lang : langs[0] || "off");
/** The mode of each track for a choice : { fr: "showing", en: "disabled" }. A track that is not asked for is not loaded. */
export const subModes = (choice, langs) => Object.fromEntries(langs.map((l) => [l, choice === "both" || choice === l ? "showing" : "disabled"]));
/** The choice the tracks of a player show now, from their modes — the viewer may have used the player's own menu. */
export function subChoice(modes, langs) {
  const on = langs.filter((l) => modes[l] === "showing");
  return !on.length ? "off" : on.length > 1 && on.length === langs.length ? "both" : on[0];
}

/** The subtitle tracks of a player, by language. */
export function subTracks(video) {
  const out = {}, list = video.textTracks || [];
  for (let i = 0; i < list.length; i++) if (list[i].kind === "subtitles" || list[i].kind === "captions") out[list[i].language] = list[i];
  return out;
}
/** Ties a group of radio buttons (the value of each : a choice) to the subtitles of a player. The buttons set the tracks ; a change made
    from the player's own menu comes back to the buttons. Returns { set(choice), now() }. */
export function subsBox(video, radios, first) {
  let want = first;
  const show = () => { for (const r of radios) r.checked = r.value === want; };
  const apply = () => { const t = subTracks(video), modes = subModes(want, Object.keys(t)); for (const l in t) if (t[l].mode !== modes[l]) t[l].mode = modes[l]; show(); };
  const read = () => { const t = subTracks(video), langs = Object.keys(t); if (!langs.length) return; const now = subChoice(Object.fromEntries(langs.map((l) => [l, t[l].mode])), langs); if (now !== want) { want = now; show(); } };
  for (const r of radios) r.addEventListener("change", () => { if (r.checked) { want = r.value; apply(); } });
  video.addEventListener("loadedmetadata", apply);
  if (video.textTracks && video.textTracks.addEventListener) { video.textTracks.addEventListener("addtrack", apply); video.textTracks.addEventListener("change", read); }
  apply();
  return { set: (choice) => { want = choice; apply(); }, now: () => want };
}
