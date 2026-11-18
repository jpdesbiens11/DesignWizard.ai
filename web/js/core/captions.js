/* DesignWizard.ai — the subtitles of a film that speaks (demande de JP) : none while it is heard, shown as soon as its sound is off.
   A page cannot read the volume of the computer : it only knows the player's own sound — its mute button and its volume slider. Whoever
   has the speakers off turns the subtitles on with the player's own button ; that choice is left alone until the player's sound changes.
   A « no sound » box next to the player says the same thing in words : checked, the player is muted and its subtitles show.
   No import : the showcase page loads this file alone (web/js/vitrine.js), the application through core/film.js. */

/** True when the subtitles should show : the player is muted, or its volume is at zero. */
export const wantCaptions = (v) => !!v && (v.muted === true || !(Number(v.volume) > 0));

/** The mode a subtitle track takes for a player : "showing" with the sound off, "hidden" (loaded, not drawn) with the sound on. */
export const captionMode = (v) => (wantCaptions(v) ? "showing" : "hidden");

/** Keeps the subtitle tracks of a player in step with its sound. Returns the function that sets them now. */
export function followSound(video) {
  const set = () => { const list = video.textTracks || []; for (let i = 0; i < list.length; i++) if (list[i].kind === "subtitles" || list[i].kind === "captions") list[i].mode = captionMode(video); };
  video.addEventListener("volumechange", set); video.addEventListener("loadedmetadata", set); video.addEventListener("play", set);
  if (video.textTracks && video.textTracks.addEventListener) video.textTracks.addEventListener("addtrack", set);
  set(); return set;
}

/** A « no sound » box for a player : checked, the player is muted (so its subtitles show) ; it follows the player's own mute button too. */
export function muteBox(video, input) {
  const sync = () => { input.checked = video.muted === true; };
  input.addEventListener("change", () => { video.muted = input.checked; });
  video.addEventListener("volumechange", sync); sync(); return input;
}
