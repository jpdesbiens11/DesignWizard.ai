/* DesignOrbit.ai — the only script of the showcase page (vitrine.html), loaded once the film speaks : under each player, the choice of
   subtitles — the film's own language (shown from the start, with the voice), the other one, both, none. The choice is written in the
   page, hidden : it shows only when this script is there to make it work ; without it, the subtitles of the film's language still show
   (their track is the default one). Nothing else : no request, nothing stored, nothing measured. */
import { subsBox } from "./core/captions.js";

for (const video of document.querySelectorAll("video")) {
  const box = video.nextElementSibling;
  if (!box || !box.matches(".subs")) continue;
  const radios = [...box.querySelectorAll("input[type=radio]")];
  subsBox(video, radios, (radios.find((r) => r.checked) || { value: "off" }).value);
  box.hidden = false;
}
