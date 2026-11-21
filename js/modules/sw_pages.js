/* DesignWizard.ai — Logiciel : the pages of the centre that are read rather than drawn — the sheet of the CPU, the start-up and the memory,
   the code, and the loading into the CPU (demande de JP : « on ne voit pas le code final… l'important, c'est de voir le package final, puis de
   savoir comment il serait téléchargé dans le microprocesseur… tester la routine de démarrage, l'initialisation, la mémoire »).
   Each page is a column one reads from top to bottom : what it is in plain words, then the facts — a figure read in a document says its page,
   and the page is a link to that document. Nothing is decided here : sw/sw_start.js, sw/sw_load.js, sw/sw_c.js and sw/sw_cpu.js say it all. */

import { el, icon, badge } from "../core/dom.js";
import { CPU_SOURCES } from "../sw/sw_cpu.js";
import { pinCount } from "../sw/sw_design.js";
import { startSequence, memoryReport, startupTest } from "../sw/sw_start.js";
import { loadChain } from "../sw/sw_load.js";

const fr = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " "), page = (...kids) => el("div", { class: "sw-page" }, kids.flat().filter(Boolean));
const card = (title, ...kids) => el("section", { class: "sw-card" }, el("h3", null, title), kids.flat().filter(Boolean));
/* « p. 55 » → a link to that page of the document (a PDF opens at #page=N) */
const pageLink = (text, url) => { const m = /p\.\s*(\d+)/.exec(text || ""); return url && m ? el("a", { href: `${url}#page=${m[1]}`, target: "_blank", rel: "noopener", "data-tip": "Ouvrir la fiche technique à cette page" }, text) : el("span", null, text || ""); };
const bar = (n, of, label) => el("div", { class: "sw-meter" }, el("span", null, label), el("div", { class: "sw-meter-bar" }, el("i", { style: { width: `${Math.min(100, of ? 100 * n / of : 0)}%` }, class: of && n > of ? "over" : "" })), el("b", null, of ? `${fr(n)} / ${fr(of)}` : fr(n)));

/** The sheet of the CPU : its figures, where each was read, and what the design takes of it. */
export function cpuPage(d, cpu) {
  const src = CPU_SOURCES.find((s) => s.id === cpu.source), n = pinCount(d), kpi = (v, l) => el("div", { class: "sw-kpi" }, el("b", null, v), el("span", null, l));
  return page(el("h2", null, icon("chip"), ` ${cpu.name}`), cpu.family ? el("p", { class: "muted" }, cpu.family) : null,
    el("div", { class: "sw-kpis" }, cpu.clock ? kpi(`${cpu.clock} MHz`, "horloge au plus") : null, cpu.flash ? kpi(`${fr(cpu.flash)} Ko`, "flash : le programme") : null, cpu.ram ? kpi(`${cpu.ram} Ko`, "RAM : la mémoire de travail") : null, kpi(`${cpu.adc.channels}`, `voies de mesure, ${cpu.adc.bits} bits`), kpi(`${cpu.gio}`, "broches logiques au plus"), kpi(`${cpu.can} · ${cpu.uart}`, "CAN · UART")),
    card("Ce que ce logiciel lui prend", bar(n.ain, cpu.adc.channels, "Voies de mesure"), bar(n.din + n.dout, cpu.gio, "Broches logiques"), el("p", { class: "muted small" }, "Chaque tuile « voie du convertisseur », « entrée logique » ou « sortie logique » prend une broche du CPU. Le guide refuse un logiciel qui en demande plus que le CPU n'en a.")),
    cpu.facts.length ? card("Ce que dit sa fiche technique", el("p", { class: "muted small", "data-cpu-read": "" }, `Chaque ligne a été lue dans le document public du fabricant${src ? ` — ${src.doc}` : ""}. La colonne de droite dit À QUELLE PAGE : un clic ouvre le document à cet endroit.`),
      el("table", { class: "data sw-facts" }, el("thead", null, el("tr", null, el("th", null, "Quoi"), el("th", null, "Ce que la fiche dit"), el("th", null, "Page de la fiche"))), el("tbody", null, cpu.facts.map((f) => el("tr", null, el("td", null, el("b", null, f.what)), el("td", null, f.value), el("td", null, pageLink(f.page, src && src.url)))))))
      : card("Une fiche d'exemple", el("p", null, "Aucun document n'a été lu pour ce CPU : ses chiffres sont des exemples, à remplacer par ceux de la fiche technique du vôtre.")),
    el("p", { class: "lab-note", "data-cpu-says": "" }, icon("info"), " ", cpu.says), src ? el("p", { class: "muted small" }, `${src.maker} — ${src.title}. ${src.read} `, el("a", { href: src.url, target: "_blank", rel: "noopener" }, "Ouvrir le document ↗")) : null);
}

const WHO = { cpu: ["Le CPU, tout seul", "#b45309"], hal: ["Votre logiciel — couche matérielle", "#64748b"], app: ["Votre logiciel — mise à zéro", "#16a34a"], step: ["Votre logiciel — le pas, sans fin", "#0891b2"] };
/** Start-up : the sequence, the test, the memory. */
export function startPage(d, cpu) {
  const seq = startSequence(d, cpu), T = startupTest(d, cpu), M = memoryReport(d, cpu), src = CPU_SOURCES.find((s) => s.id === cpu.source), mark = (ok) => (ok === true ? ["check", "ok", "vérifié"] : ok === false ? ["warning", "bad", "à corriger"] : ["info", "note", "à savoir"]);
  return page(el("h2", null, icon("power"), " Du courant au premier pas"),
    card("Ce qui se passe, dans l'ordre", el("ol", { class: "sw-seq" }, seq.map((s) => el("li", { style: { "--who": WHO[s.who][1] }, "data-seq": s.who }, el("small", null, WHO[s.who][0]), el("b", null, s.title), el("p", null, s.text, s.page ? [" ", el("span", { class: "muted" }, "(", pageLink(s.page, src && src.url), ")")] : null),
      s.items && s.items.length ? el(s.who === "step" ? "ol" : "ul", { class: "sw-seq-items" }, s.items.map((t) => el("li", null, s.who === "step" ? t.replace(/^\d+\.\s*/, "") : t))) : null)))),
    card("L'essai de démarrage", el("p", { class: "muted small" }, `Le modèle est mis à zéro, puis fait ${T.steps} pas avec toutes ses entrées au repos — comme une carte que l'on vient d'alimenter, rien de branché, rien de demandé.`),
      el("ul", { class: "sw-checks", "data-start-test": T.ok ? "ok" : "bad" }, T.checks.map((c) => { const m = mark(c.ok); return el("li", { class: m[1], "data-check": c.id }, icon(m[0]), el("div", null, el("b", null, c.text), c.detail ? el("small", null, c.detail) : null), el("span", { class: "sw-check-tag" }, m[2])); })),
      el("p", { class: T.ok ? "lab-note" : "form-error" }, T.ok ? "Rien ne bouge tout seul au démarrage." : "Le démarrage n'est pas sûr : une ligne ci-dessus est à corriger.")),
    card("La mémoire du logiciel", el("p", { class: "muted small" }, "Chaque tuile garde quelques nombres d'un pas à l'autre (sa mémoire de travail, en RAM) et lit ses réglages dans une table qui ne change pas (en flash, avec le programme)."),
      M.cpuRam ? bar(M.ram, M.cpuRam, "RAM prise, en octets") : null,
      el("table", { class: "data sw-mem", "data-sw-mem": String(M.ram) }, el("thead", null, el("tr", null, el("th", null, "Tuile"), el("th", null, "Ce qu'elle retient"), el("th", null, "RAM (octets)"), el("th", null, "Réglages (octets)"))),
        el("tbody", null, M.objects.map((o) => el("tr", null, el("td", null, el("b", null, o.name)), el("td", { class: "muted" }, o.vars.map((v) => `${v.name}${v.n > 1 ? `[${v.n}]` : ""}`).join(", ")), el("td", null, String(o.ram)), el("td", null, o.rom ? String(o.rom) : "—"))),
          el("tr", null, el("td", null, el("b", null, "Tous les signaux")), el("td", { class: "muted" }, `${M.signals.fields.length} valeurs — ce que chaque tuile donne`), el("td", null, String(M.signals.size)), el("td", null, "—")),
          el("tr", { class: "total" }, el("td", null, el("b", null, "Total")), el("td", null, ""), el("td", null, el("b", null, fr(M.ram))), el("td", null, el("b", null, fr(M.rom)))))),
      el("p", { class: "muted small" }, M.note, M.cpuRam ? ` Le CPU choisi a ${fr(M.cpuRam)} octets de RAM et ${fr(M.cpuFlash)} de flash.` : " La mémoire de ce CPU n'est pas connue.")));
}

/** The code : one file, read at ease. files : [{ name, text }] ; cur : the file shown ; folders : { dir: [color, what] }. */
export function codePage(files, cur, folders) {
  const lines = (cur ? cur.text : "").replace(/\n$/, "").split("\n"), dir = cur ? (cur.name.split("/")[1] || "") : "", F = folders[dir], total = files.reduce((n, f) => n + f.text.split("\n").length, 0);
  return page(el("h2", null, icon("code"), ` ${cur ? cur.name.replace("bms/", "") : "Aucun fichier"}`),
    el("p", { class: "muted", "data-sw-pack": String(files.length) }, `Le paquet : ${files.length} fichiers, ${fr(total)} lignes. `, F ? el("span", { class: "sw-dir", style: { "--dom": F[0] } }, `${dir}/`) : null, F ? ` — ${F[1]}.` : " — ce que le paquet contient, et comment s'en servir."),
    cur ? el("div", { class: "sw-codebox", "data-sw-code": cur.name, tabindex: 0, role: "region", "aria-label": `Contenu de ${cur.name}` }, el("pre", { class: "sw-ln", "aria-hidden": "true" }, lines.map((_, i) => i + 1).join("\n")), el("pre", { class: "sw-src" }, lines.join("\n"))) : null,
    el("p", { class: "muted small" }, "C99 sobre : pas d'allocation, types à largeur fixe, aucun nombre à virgule. C'est un SQUELETTE : il n'a tourné sur aucun microcontrôleur, et ce qui touche les registres du CPU reste à écrire avec la bibliothèque de son fabricant. Aucune prétention de certification."));
}

/* the chain as a drawing, made by the tool : computer → probe → CPU. No product is drawn. */
function chainDrawing(kit) {
  const NS = "http://www.w3.org/2000/svg", S = (t, a = {}, ...k) => { const n = document.createElementNS(NS, t); for (const [q, v] of Object.entries(a)) n.setAttribute(q, v); for (const c of k) n.append(c); return n; };
  const box = (x, w, title, lines, c) => [S("rect", { x, y: 18, width: w, height: 92, rx: 10, fill: "none", stroke: c, "stroke-width": 2 }), S("rect", { x, y: 18, width: w, height: 24, rx: 10, fill: c }), S("text", { x: x + w / 2, y: 35, "text-anchor": "middle", fill: "#fff", "font-size": 12.5, "font-weight": 700 }, title), ...lines.map((t, i) => S("text", { x: x + w / 2, y: 62 + i * 17, "text-anchor": "middle", "font-size": 12, fill: "currentColor" }, t))];
  const arrow = (x1, x2, label) => [S("path", { d: `M ${x1} 64 L ${x2 - 8} 64`, stroke: "currentColor", "stroke-width": 2, fill: "none" }), S("path", { d: `M ${x2 - 9} 58 L ${x2} 64 L ${x2 - 9} 70 Z`, fill: "currentColor" }), S("text", { x: (x1 + x2) / 2, y: 54, "text-anchor": "middle", "font-size": 11, fill: "currentColor" }, label)];
  return S("svg", { viewBox: "0 0 860 128", class: "sw-chain", role: "img", "aria-label": "Du paquet au CPU : l'ordinateur compile, la sonde copie le programme dans la mémoire flash du CPU" },
    ...box(8, 150, "1 · Le paquet", ["fichiers C (.zip)", "écrits par l'outil"], "#475569"), ...arrow(158, 214, ""), ...box(214, 190, "2 à 4 · L'ordinateur", ["atelier logiciel + compilateur", "→ le fichier programme"], "#7c3aed"), ...arrow(404, 470, "USB"),
    ...box(470, 150, "5 · La sonde", [kit ? "sur la carte du kit" : "un petit boîtier", "ou externe"], "#b45309"), ...arrow(620, 690, "JTAG"), ...box(690, 162, "6 · Le CPU", ["mémoire flash :", "le programme y reste"], "#16a34a"));
}
/** From the files to the CPU : the chain, step by step, with what the maker publishes. */
export function loadPage(d, cpu) {
  const C = loadChain(cpu), src = (id) => C.sources.find((s) => s.id === id);
  return page(el("h2", null, icon("download"), " Du paquet au CPU"), el("p", { class: "muted" }, C.note), chainDrawing(C.kit),
    el("ol", { class: "sw-load", "data-sw-load": C.known ? "read" : "generic" }, C.steps.map((s) => el("li", { "data-load": s.key }, el("div", { class: "sw-load-head" }, el("span", { class: "sw-load-n" }, String(s.n)), icon(s.icon), el("b", null, s.title)),
      el("p", { class: "sw-plain" }, el("span", { class: "sw-tag" }, "En clair"), " ", s.plain), el("p", null, el("span", { class: "sw-tag do" }, "On fait"), " ", s.does),
      s.read.length ? el("div", { class: "sw-read" }, el("small", null, "Ce que le fabricant publie"), el("ul", null, s.read.map((r) => { const S0 = src(r.src); return el("li", null, r.text, " ", S0 ? el("a", { class: "sw-src-link", href: r.where && /p\.\s*\d+/.test(r.where) ? `${S0.url}#page=${/p\.\s*(\d+)/.exec(r.where)[1]}` : S0.url, target: "_blank", rel: "noopener", "data-tip": `${S0.title} — ${S0.read}` }, r.where ? `fiche technique, ${r.where} ↗` : "page du produit ↗") : null); }))) : null))),
    el("p", { class: "lab-note" }, icon("info"), " Rien de cette chaîne n'est fait par l'outil, et rien n'en a été essayé : l'outil n'appelle aucun autre logiciel, et les fichiers qu'il écrit n'ont tourné sur aucun microcontrôleur. La même suite est écrite dans le paquet : doc/LOADING.md."),
    C.sources.length ? card("Ce qui a été lu", el("ul", { class: "sw-sources" }, C.sources.map((s) => el("li", null, el("a", { href: s.url, target: "_blank", rel: "noopener" }, s.title), ` — ${s.read}`))), el("p", { class: "muted small" }, "Les noms d'outils et de kits sont ceux de leur fabricant, cités comme références de compatibilité.")) : null,
    badge(C.known ? "lu dans les documents du fabricant" : "chaîne générale : aucun document lu pour ce CPU", C.known ? "ok" : "neutral"));
}
