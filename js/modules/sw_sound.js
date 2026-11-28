/* DynamiteOrbit.ai — Logiciel : the BUZZER heard in the speakers of the computer (demande de JP, 24 novembre 2026 : « si on tombe à rouge, un son
   de buzzer dans le canal de son du PC, quelque chose de pas trop agressant qui signale un problème »).
   While a buzzer the software commands is on, the computer plays a soft two-note chime — a descending fifth, sine waves, quiet, a slow attack
   and a long fade, once every two seconds — the way a hospital monitor or a car says « look at me » without shouting. Nothing is recorded or
   fetched : the tone is made by the browser (Web Audio). It can be turned off, and the choice is kept by the browser (`dw.sw.sound`).
   A browser lets a page make sound only after a click on it : « Marche » or « Jouer le profil » are that click. */

const KEY = "dw.sw.sound";
export const soundOn = () => { try { return localStorage.getItem(KEY) !== "off"; } catch (e) { return true; } };
export const setSoundOn = (on) => { try { localStorage.setItem(KEY, on ? "on" : "off"); } catch (e) { /* the choice holds until the page is left */ } };

/** → { update(on), chime(), dispose() } */
export function alarmSound() {
  let ctx = null, timer = 0, ringing = false;
  const audio = () => { if (!ctx) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; ctx = new A(); } if (ctx.state === "suspended") ctx.resume().catch(() => {}); return ctx; };
  /* one chime : 660 Hz then 440 Hz, each with its own soft envelope */
  function chime() { const a = audio(); if (!a) return; const t0 = a.currentTime + 0.02;
    for (const [f, at] of [[660, 0], [440, 0.32]]) { const o = a.createOscillator(), g = a.createGain(); o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + at); g.gain.exponentialRampToValueAtTime(0.06, t0 + at + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.6);
      o.connect(g).connect(a.destination); o.start(t0 + at); o.stop(t0 + at + 0.65); } }
  const stop = () => { ringing = false; if (timer) clearInterval(timer); timer = 0; };
  return {
    chime,
    get ringing() { return ringing; },
    update(on) { const want = !!on && soundOn(); if (want === ringing) return; if (!want) { stop(); return; } ringing = true; chime(); timer = setInterval(() => { if (soundOn()) chime(); }, 2000); },
    dispose() { stop(); if (ctx) { ctx.close().catch(() => {}); ctx = null; } },
  };
}
