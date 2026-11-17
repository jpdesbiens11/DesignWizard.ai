/* DesignWizard.ai — the only script of the showcase page (vitrine.html), loaded once the film speaks : the subtitles of each player
   follow its sound — none while the film is heard, shown when the player is muted or its volume is at zero. Nothing else : no request,
   nothing stored, nothing measured. */
import { followSound } from "./core/captions.js";

for (const video of document.querySelectorAll("video")) followSound(video);
