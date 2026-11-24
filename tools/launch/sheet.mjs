/* DynamiteOrbit.ai — the one-page sheet of the launch kit, as a page to print : Letter, portrait, the paper, the ink and the marks of
   the platform (the tokens of web/css/app.css, the icons of web/img/icons.svg, the logo of core/brand.js). The words come from
   tools/launch/content.mjs ; tools/launch_kit.mjs prints the page to a PDF. A choice in a list is never a bare line of text : three
   groups by nature, each its colour, each step its pictogram and a short title (CLAUDE.md, « Visuel, symbole, couleur »). Pure :
   sheetHtml(lang, { icons, logo, shot, date }) → the page. */

import { SHEET, LINKS, BRAND_FOOT } from "./content.mjs";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const short = (url) => url.replace(/^https:\/\//, "").replace(/\/$/, "");
/* the spaces a printed French text wants : none that breaks before a high punctuation mark, nor inside « sert-elle » */
const typo = (s, lang) => (lang !== "fr" ? s : s.replace(/ ([:;?!»])/g, "\u00a0$1").replace(/« /g, "«\u00a0").replace(/-(elle|il|on|t-il|t-elle)\b/g, "\u2011$1"));

const CSS = `
@page { size: Letter; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
:root { --paper: #fcfbf7; --surface: #ffffff; --ink: #172b4d; --ink-strong: #0b1b33; --muted: #5e6c84; --line: #dcdfe4; --grid: rgba(12, 102, 228, .06); --primary: #0c66e4; --yellow: #ffd23f; }
html, body { width: 8.5in; height: 11in; }
body { font-family: "Inter", "Segoe UI", system-ui, sans-serif; color: var(--ink); background: var(--paper); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { position: relative; width: 8.5in; height: 11in; padding: .42in .5in .34in; overflow: hidden; display: flex; flex-direction: column;
  background-image: linear-gradient(var(--grid) 1px, transparent 1px), linear-gradient(90deg, var(--grid) 1px, transparent 1px); background-size: .25in .25in; }
header { display: flex; align-items: center; gap: .14in; }
header .name { font-family: "Inter Display", "Inter", sans-serif; font-weight: 700; font-size: 19pt; letter-spacing: -.02em; color: var(--ink-strong); line-height: 1; }
header .name i { font-style: normal; color: var(--primary); }
header .by { font-size: 7.5pt; color: var(--muted); margin-top: 3px; }
header .kicker { margin-left: auto; font-size: 7.5pt; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--primary); border: 1.2px solid var(--primary); border-radius: 999px; padding: 4px 11px; background: var(--surface); }
.hero { display: grid; grid-template-columns: 1fr 1.3fr; gap: .3in; align-items: center; margin-top: .3in; }
h1 { font-family: "Inter Display", "Inter", sans-serif; font-weight: 800; font-size: 30pt; line-height: 1.05; letter-spacing: -.03em; color: var(--ink-strong); white-space: nowrap; }
h1 span { display: block; } h1 mark { background: linear-gradient(transparent 58%, var(--yellow) 58%, var(--yellow) 92%, transparent 92%); color: inherit; padding: 0 .06em; margin: 0 -.06em; }
.promise { margin-top: .13in; font-size: 11.5pt; font-weight: 600; color: var(--primary); text-wrap: balance; }
.story { margin-top: .17in; font-size: 10.2pt; line-height: 1.5; } .story p { text-wrap: balance; } .story p + p { margin-top: .06in; } .story p:last-child { font-weight: 700; color: var(--ink-strong); }
figure { position: relative; } figure img { display: block; width: 100%; border: 1.5px solid var(--ink); border-radius: 9px; box-shadow: 5px 6px 0 rgba(23, 43, 77, .13); background: var(--surface); }
figure::before, figure::after { content: ""; position: absolute; top: -13px; width: 58px; height: 18px; background: rgba(255, 210, 63, .82); border: 1px solid rgba(23, 43, 77, .18); z-index: 1; }
figure::before { left: -14px; transform: rotate(-32deg); } figure::after { right: -14px; transform: rotate(32deg); }
figure.cutout img { border: 0; border-radius: 0; box-shadow: none; background: none; aspect-ratio: 1.5; object-fit: cover; object-position: 30% 100%; } figure.cutout::before, figure.cutout::after { display: none; }
figcaption { margin-top: 7px; font-size: 7.3pt; color: var(--muted); text-align: right; }
.groups { display: grid; grid-template-columns: repeat(3, 1fr); gap: .17in; margin-top: .3in; flex: 1; }
.group { background: var(--surface); border: 1.3px solid var(--line); border-top: 5px solid var(--c); border-radius: 9px; padding: .13in .14in .12in; display: flex; flex-direction: column; }
.group h2 { font-family: "Inter Display", "Inter", sans-serif; font-size: 13pt; font-weight: 800; letter-spacing: -.01em; color: var(--c); text-transform: uppercase; }
.steps { flex: 1; display: flex; flex-direction: column; justify-content: space-around; margin-top: .04in; }
.step { display: grid; grid-template-columns: 34px 1fr; gap: 10px; align-items: start; }
.step .ic { width: 34px; height: 34px; border-radius: 9px; background: color-mix(in srgb, var(--c) 11%, white); color: var(--c); display: grid; place-items: center; }
.step .ic svg { width: 23px; height: 23px; }
.step b { display: block; font-size: 10.4pt; color: var(--ink-strong); line-height: 1.2; } .step span { display: block; font-size: 8.7pt; line-height: 1.38; color: var(--ink); margin-top: 2px; }
.foot { display: grid; grid-template-columns: .92fr 1.1fr 1.62fr; gap: .17in; margin-top: .17in; }
.box { border: 1.3px dashed #b9c0cc; border-radius: 9px; padding: .1in .12in; background: rgba(255, 255, 255, .72); }
.box h3 { font-size: 7.4pt; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; color: var(--muted); margin-bottom: 6px; }
.box p { font-size: 8pt; line-height: 1.4; }
.chips { display: flex; flex-wrap: wrap; gap: 5px; } .chips span { font-family: "JetBrains Mono", "DejaVu Sans Mono", monospace; font-size: 7.6pt; font-weight: 600; border: 1.2px solid var(--ink); border-radius: 6px; padding: 2px 7px; background: var(--surface); }
.call { background: var(--ink-strong); border: 0; color: #fff; } .call h3 { color: #ffd23f; }
.call { display: grid; grid-template-columns: 1fr auto; gap: 0 .12in; align-items: center; } .call h3 { grid-column: 1 / -1; }
.qr { display: grid; justify-items: center; gap: 3px; } .qr svg { width: .92in; height: .92in; border-radius: 5px; display: block; } .qr span { font-size: 6.4pt; font-weight: 700; color: #ffd23f; white-space: nowrap; }
.call dl { display: grid; gap: 5px; } .call dt { font-size: 7.6pt; font-weight: 700; } .call dd { font-family: "JetBrains Mono", "DejaVu Sans Mono", monospace; font-size: 6.5pt; color: #cfe0ff; white-space: nowrap; margin-top: 1px; }
footer { display: flex; justify-content: space-between; gap: .2in; margin-top: .13in; font-size: 6.7pt; color: var(--muted); }
`;

/** The page. o : { icons (the sprite of web/img/icons.svg, as text), logo (an inline SVG), shot (the address of the screenshot), date,
    qr (web/img/qr/home.svg as text : bottom right, in the box of the links) } */
export function sheetHtml(lang, o) {
  const S = SHEET, t = (x) => esc(typo(x[lang], lang)), [first, second] = S.slogan[lang];
  const group = (g) => `<section class="group" style="--c:${g.color}"><h2>${t(g.title)}</h2><div class="steps">${g.steps.map((s) => `<div class="step"><div class="ic"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-${s.icon}"/></svg></div><div><b>${t(s.title)}</b><span>${t(s.text)}</span></div></div>`).join("")}</div></section>`;
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>DynamiteOrbit.ai — ${esc(S.slogan[lang].join(" "))}</title><style>${CSS}</style></head><body>${o.icons}
<div class="page">
  <header>${o.logo}<div><div class="name">DynamiteOrbit<i>.ai</i></div><div class="by">by DynamiteAgile™</div></div><div class="kicker">${t(S.kicker)}</div></header>
  <div class="hero">
    <div><h1 style="font-size:${second.length > 17 ? 26 : 30}pt"><span>${esc(first)}</span><span><mark>${esc(second)}</mark></span></h1><p class="promise">${t(S.promise)}</p><div class="story">${S.story[lang].map((p) => `<p>${esc(typo(p, lang))}</p>`).join("")}</div></div>
    <figure${S.shot.cutout ? ' class="cutout"' : ""}><img src="${o.shot}" alt=""><figcaption>${t(S.shot.caption)}</figcaption></figure>
  </div>
  <div class="groups">${S.groups.map(group).join("")}</div>
  <div class="foot">
    <div class="box"><h3>${t(S.out.title)}</h3><div class="chips">${S.out.items.map((x) => `<span>${esc(x)}</span>`).join("")}</div></div>
    <div class="box"><h3>${t(S.status.title)}</h3><p>${t(S.status.text)}</p></div>
    <div class="box call"><h3>${t(S.call.title)}</h3><dl>${S.call.rows.map(([label, key]) => `<div><dt>${t(label)}</dt><dd>${esc(short(LINKS[key]))}</dd></div>`).join("")}</dl>${o.qr ? `<div class="qr">${o.qr}<span>${t(S.scan)}</span></div>` : ""}</div>
  </div>
  <footer><span>${t(BRAND_FOOT)}</span><span>${esc(o.date)}</span></footer>
</div></body></html>`;
}
