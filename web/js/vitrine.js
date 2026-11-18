/* DesignWizard.ai — the only script of the showcase page (vitrine.html), loaded once the film speaks : the subtitles of each player
   follow its sound — none while the film is heard, shown when the player is muted or its volume is at zero — and the « no sound » box
   written under each player mutes it. Nothing else : no request, nothing stored, nothing measured. */
import { followSound, muteBox } from "./core/captions.js";

for (const video of document.querySelectorAll("video")) {
  followSound(video);
  const label = video.nextElementSibling;      // the box is in the page, hidden : it shows only when this script is there to make it work
  if (label && label.matches("label.mute")) { muteBox(video, label.querySelector("input")); label.hidden = false; }
}
