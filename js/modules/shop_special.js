/* DesignWizard.ai — the special processes of the Shop : moulding, extrusion, precision laser cutting, 3D printing. One screen
   (#/process/<kind>) says what each process asks of each material and where the figures come from, starts a part of that
   process in the Shop, and copies the sheet for an AI. The same sheet shows as a card under the raw stock of the Shop
   (specialCard), where the designer picks the thickness of the sheet. */

import { el, btn, badge, field, table, icon, toast, copyText } from "../core/dom.js";
import { getUnits, shownUnit, fromShown, fieldValue, converts } from "../core/units.js";
import { registerModule, go, app } from "../core/app.js";
import { MATERIALS, PROCESSES, material, processName } from "../cad/materials.js";
import { LASER_FAMILIES, laserProfile, AM_PROCESSES, AM_MATERIALS, printProcess, processSheet, processBrief, sheetSeries, sheetDefault, sheetWord, SOURCES } from "../cad/special_processes.js";
import { MOLD_RULES } from "../core/shop_mold.js";
import { MOLDS } from "../core/mold_plan.js";
import { EXTRUSION_RULES } from "../core/shop_extrusion.js";
import { canFold, foldSides, FOLD_RULES, foldBrief, FOLD_T } from "../core/shop_folded.js";
import { FOLD_SIDES } from "../cad/family_folded.js";

const n = (v) => String(Math.round(v * 1000) / 1000).replace(".", ","), range = (a) => `${n(a[0])} à ${n(a[1])}`;
const chip = (text, tip) => el("span", { class: "chip", "data-tip": tip, style: { maxWidth: "none", whiteSpace: "normal" } }, text);      // a figure is read whole : no ellipsis here
const design = (materialId, form, label, process) => btn(label, () => { app.shopPreset = { material: materialId, form, ...(process ? { process } : {}) }; go("#/shop/new"); }, { small: true, icon: "wizard", tip: "Ouvre « Pas à pas » avec cette matière et ce procédé : la pièce se dessine autour de ses interfaces" });
const bullets = (lines) => el("ul", { class: "decisions" }, lines.map((x) => el("li", null, x)));
const basis = (text) => el("p", { class: "muted small", style: { margin: ".3rem 0 0" } }, el("b", null, "D'où viennent ces valeurs : "), text);

/* a metal sheet folds : the designer ticks the sides of the base that rise ; a side that carries an interface is folded anyway */
function foldRow(brief, again) {
  if (!canFold(brief.material)) return null;
  const on = foldSides(brief), forced = new Set((brief.interfaces || []).map((i) => i.where)), F = brief.folds || {};
  const set = (patch) => { brief.folds = { ...(brief.folds || {}), ...patch }; again(); };
  const tick = (side, yes) => { const s = new Set(F.sides || []); if (yes) s.add(side); else s.delete(side); set({ sides: [...s] }); };
  return el("div", { class: "atelier-hint", style: { marginTop: ".6rem" } }, icon("sheet"), el("div", null, el("b", null, on.length ? `Tôle pliée — ${on.length} bord${on.length > 1 ? "s" : ""} à la presse plieuse` : "Bords pliés"),
    el("p", { class: "small", style: { margin: ".2rem 0" } }, "Cochez les côtés de la base à relever, ou placez une interface sur un côté : il devient un bord plié qui la porte. Un seul rayon, des bords d'au moins 4 × l'épaisseur, des trous loin des plis, des dégagements aux angles — valeurs typiques de guides publiés ; la table de pliage de l'atelier fait foi."),
    el("div", { class: "form-actions", style: { justifyContent: "flex-start", flexWrap: "wrap", margin: ".2rem 0" } }, Object.entries(FOLD_SIDES).map(([side, S]) => el("label", { class: "check small", "data-tip": forced.has(side) ? "Ce côté porte une interface : il est plié" : `Relever le côté ${S.fr} de la base` },
      el("input", { type: "checkbox", checked: on.includes(side), disabled: forced.has(side), onChange: (e) => tick(side, e.target.checked) }), S.fr))),
    on.length ? el("div", { class: "form-row tight" }, field(converts("mm", getUnits()) ? `Hauteur des bords (${shownUnit("mm", getUnits())})` : "Hauteur des bords (mm)", el("input", { type: "number", min: 0, step: converts("mm", getUnits()) ? "any" : 1, value: F.h === undefined || F.h === null ? "" : fieldValue(F.h, "mm", getUnits()), placeholder: "au plus juste", "data-tip": "Vide : la plus petite hauteur que la presse plieuse tient et qui porte les interfaces", onChange: (e) => { const v = fromShown(parseFloat(e.target.value), "mm", getUnits()); set({ h: v > 0 ? v : undefined }); } })),
      field("Sens des plis", el("select", { onChange: (e) => set({ dir: e.target.value }) }, [["up", "Vers le haut"], ["down", "Vers le bas"]].map(([k, l]) => el("option", { value: k, selected: (F.dir || "up") === k }, l))))) : null));
}

/** The card of the special process under the raw stock of the Shop. form : "sheet" | "print" ; `again` rebuilds the proposal. → element or null */
export function specialCard(brief, form, again) {
  const mat = material(brief.material), name = mat ? mat.name : brief.material;
  if (form === "sheet") {
    const P = laserProfile(brief.material), series = sheetSeries(brief.material), usual = sheetDefault(brief.material), t = Number(brief.t) > 0 ? Number(brief.t) : usual;
    const pick = el("select", { "aria-label": "Épaisseur de la feuille", "data-tip": "Les épaisseurs dans lesquelles cette matière se vend ; « selon les interfaces » laisse le compagnon choisir", onChange: (e) => { brief.t = e.target.value ? parseFloat(e.target.value) : undefined; again(); } },
      [el("option", { value: "" }, usual ? `Courante (${n(usual)} mm)` : foldSides(brief).length ? `Courante en tôlerie pliée (${n(FOLD_T)} mm)` : "Selon les interfaces"), ...series.map((v) => el("option", { value: v, selected: Number(brief.t) === v }, `${n(v)} mm`))]);
    return el("div", null, el("div", { class: "atelier-hint" + (P && P.verdict !== "ok" ? " warn" : ""), style: { marginTop: ".6rem" } }, icon(P && P.verdict !== "ok" ? "warning" : "sheet"),
      el("div", null, el("b", null, `Découpe laser de précision — ${P ? P.short : name}`), bullets(processSheet("laser_cut", brief.material, t).slice(0, P && P.verdict === "ok" ? 5 : 3)),
        el("a", { class: "small", href: "#/process/laser" }, "Toutes les matières en feuille et leurs règles →"))),
      P && P.verdict === "forbidden" ? null : el("div", { class: "form-row tight" }, field(`Épaisseur de la ${sheetWord(brief.material).toLowerCase()}`, pick)), foldRow(brief, again));
  }
  if (form === "print") {
    const proc = printProcess(brief.material);
    if (!proc) return el("div", { class: "atelier-hint warn", style: { marginTop: ".6rem" } }, icon("warning"), el("div", null, el("b", null, `${name} ne s'imprime pas`),
      el("p", { class: "small", style: { margin: ".2rem 0" } }, "Choisissez une matière d'impression : un polyamide (lit de poudre), un PEI ou un PEKK (dépôt de fil), une résine, ou un métal — aluminium AlSi10Mg, inox 316L, titane Ti-6Al-4V, alliages de nickel 718 et 625."),
      el("a", { class: "small", href: "#/process/impression" }, "Les matières d'impression et ce qu'elles demandent →")));
    return el("div", { class: "atelier-hint", style: { marginTop: ".6rem" } }, icon("print3d"), el("div", null, el("b", null, `${processName(proc)} — ${name}`), bullets(processSheet(proc, brief.material).slice(0, 7)),
      el("a", { class: "small", href: "#/process/impression" }, "Tous les procédés d'impression et leurs matières →")));
  }
  return null;
}

const KINDS = [
  ["moulage", "cast", "Moulage", "Injection d'un plastique, fonderie d'un métal : la pièce se dessine autour de ce qu'elle contient."],
  ["extrusion", "extrusion", "Extrusion", "Un profilé d'aluminium ou de plastique, dessiné autour de ce qui glisse dedans."],
  ["laser", "sheet", "Découpe laser de précision", "Tôle, carte, papier aramide, film, plastique : chaque matière a son laser, son bord et ses plus petits détails."],
  ["pliage", "sheet", "Tôlerie pliée", "Une base et des bords pliés à la presse plieuse : un rayon, des bords assez hauts, des trous loin des plis, le développé à plat et son DXF."],
  ["impression", "print3d", "Impression 3D", "Polymères et métaux, jusqu'au titane et aux alliages de nickel : chaque matière a son procédé et sa suite après impression."],
];
const WIDE = { gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" };      // cards wide enough for their chips
const HOW = { lu: "document lu", page: "page lue", "résumé": "résumé seulement — à lire avant de s'y fier" };
const sources = (keep) => el("section", { class: "card" }, el("h2", null, "Sources"), el("p", { class: "muted small" }, "Valeurs typiques de guides publiés et titres de normes : elles donnent sa forme à une pièce, elles ne la qualifient pas. Le fournisseur et la fiche de la matière font foi. Les liens sont dans docs/PROCEDES.md."),
  table(["Source", "De qui", "Ce qu'elle donne", "Comment elle a été lue"], SOURCES.filter(keep).map((s) => [s.title, s.by, s.gives, HOW[s.how] || s.how])));

function laser(page) {
  const used = (key) => MATERIALS.filter((m) => { const P = laserProfile(m.id); return P && P.key === key; });
  page.append(el("div", { class: "grid", style: WIDE }, Object.entries(LASER_FAMILIES).map(([key, f]) => el("section", { class: "card", "data-family": key },
    el("h2", null, f.label, " ", f.verdict === "forbidden" ? badge("Jamais au laser", "danger") : f.verdict === "caution" ? badge("À éviter", "warn") : null),
    el("p", { class: "small", style: { margin: "0 0 .4rem" } }, el("b", null, f.source.charAt(0).toUpperCase() + f.source.slice(1)), f.verdict === "ok" ? ` · gaz : ${f.gas}` : ""),
    f.verdict === "forbidden" ? el("p", null, `${f.why.charAt(0).toUpperCase()}${f.why.slice(1)}. À la place : ${f.instead}.`)
      : el("div", { class: "atelier-chips" }, chip(`Épaisseur ${range(f.t)} mm`), chip(`Trait de coupe ${range(f.kerf)} mm`), chip(`Trou ≥ ${f.hole.k ? `${n(f.hole.k)} × t, ` : ""}${n(f.hole.min)} mm`, "t : l'épaisseur de la feuille"),
        chip(`Fente ≥ ${f.slot.k ? `${n(f.slot.k)} × t, ` : ""}${n(f.slot.min)} mm`), chip(`Pont ≥ ${f.web.k ? `${n(f.web.k)} × t, ` : ""}${n(f.web.min)} mm`, "La matière laissée entre deux découpes, ou jusqu'au bord"), ...[f.corner ? chip(`Angle rentrant R ≥ ${n(f.corner)} mm`) : null].filter(Boolean), chip(`± ${n(f.tol)} mm`, "Tolérance courante, à convenir avec l'atelier")),
    f.verdict === "caution" ? el("p", null, `${f.why.charAt(0).toUpperCase()}${f.why.slice(1)}. À la place : ${f.instead}.`) : null,
    f.verdict === "ok" ? el("p", { style: { margin: ".4rem 0 .2rem" } }, f.edge) : null, f.watch.length ? bullets(f.watch) : null, basis(f.basis),
    f.verdict === "ok" && used(key).length ? el("div", { class: "form-actions", style: { justifyContent: "flex-start", flexWrap: "wrap" } }, used(key).map((m) => design(m.id, "sheet", m.name))) : null))),
    sources((s) => s.id.startsWith("laser")));
}
function printing(page) {
  page.append(el("div", { class: "grid", style: WIDE }, Object.entries(AM_PROCESSES).map(([key, P]) => el("section", { class: "card", "data-process": key }, el("h2", null, P.label), el("p", { class: "small muted", style: { margin: "0 0 .4rem" } }, `À partir de ${P.raw} · ${P.kind === "metal" ? "métaux" : "polymères"}`),
    el("div", { class: "atelier-chips" }, ...[chip(`Paroi ≥ ${n(P.wall)} mm (${n(P.wallRec)} conseillé)`), chip(`Trou ≥ Ø${n(P.hole)}`), chip(`Jeu ≥ ${n(P.gap)} mm par côté`), P.supports ? chip(`Supports sous ${P.overhang}°`, "Angle mesuré depuis le plateau") : chip("Sans support"),
      P.bridge ? chip(`Portée libre ≤ ${n(P.bridge)} mm`) : null, P.hHole ? chip(`Trou horizontal rond ≤ Ø${n(P.hHole)}`) : null, P.escape ? chip(`${P.escapes > 1 ? `${P.escapes} ouvertures` : "Ouverture"} ≥ Ø${n(P.escape)}`, "Pour vider une cavité de sa poudre ou de sa résine") : null,
      chip(P.tol, "Tolérance brute d'impression"), P.ra ? chip(`Ra ${P.ra[0]} à ${P.ra[1]} µm`, "Rugosité brute de fusion") : null, chip(`Volume ${P.build.join(" × ")} mm`, "Une machine courante — à confirmer avec l'atelier")].filter(Boolean)),
    bullets(P.watch), basis(P.basis)))),
    el("section", { class: "card" }, el("h2", null, "Par matière"), el("p", { class: "muted small" }, "Le procédé de chaque matière, ce pour quoi on la choisit, la norme qui la nomme, et ce qu'elle demande une fois imprimée — la suite se commande et se contrôle, elle figure dans la gamme de la pièce."),
      table(["Matière", "Procédé", "Pour quoi", "Référence", "Après l'impression", "À savoir", ""], Object.entries(AM_MATERIALS).map(([id, e]) => { const m = material(id) || { name: id };
        return [el("b", null, m.name), AM_PROCESSES[e.process].short, e.use, e.std, [e.relief, ...e.post, e.critical ? `Pièce en fatigue : ${e.critical}` : null].filter(Boolean).join(" ; ") || "—", e.watch.join(" "), design(id, "print", "Concevoir")]; }))),
    sources((s) => !s.id.startsWith("laser") && !s.id.startsWith("pliage")));
}
function folding(page) {
  const mats = MATERIALS.filter((m) => canFold(m.id));
  page.append(el("div", { class: "grid", style: WIDE }, el("section", { class: "card" }, el("h2", null, FOLD_RULES.label), el("div", { class: "atelier-chips" }, FOLD_RULES.chips.map(([text, tip]) => chip(text, tip))), bullets(FOLD_RULES.notes), basis(FOLD_RULES.basis)),
    el("section", { class: "card" }, el("h2", null, "Ce que la plateforme en fait"), bullets(["Dans « Pas à pas », cochez les côtés de la base à relever, ou placez une interface sur un côté : la pièce s'écrit seule, avec son bloc « folded ».",
      "Le noyau construit la base, les plis avec leur vrai rayon et les bords ; les trous et les interfaces se posent sur la base ou sur un bord.", "Le DFx mesure le rayon, la hauteur de chaque bord, la distance de chaque trou au pli et au bord libre, le dégagement des angles — avec un correctif en un clic.",
      "L'onglet « Développé » de la pièce montre le flan à plat et ses lignes de pliage ; le DXF les met sur des calques séparés (CUT, BEND, NOTES).", "La gamme enchaîne la découpe du flan, les plis un à un et l'ébavurage ; le flan développé est le brut à commander."]),
      el("p", { class: "small muted", style: { margin: ".5rem 0 .2rem" } }, "Matières qui se plient :"), el("div", { class: "form-actions", style: { justifyContent: "flex-start", flexWrap: "wrap" } }, mats.map((m) => btn(m.name, () => { app.shopPreset = { material: m.id, form: "sheet", folds: { sides: ["-X", "+X"] } }; go("#/shop/new"); }, { small: true, icon: "wizard", tip: "Ouvre « Pas à pas » avec cette tôle et deux bords pliés" }))))),
    sources((s) => s.id.startsWith("pliage")), el("p", { class: "muted" }, "Format du bloc « folded », développé et limites : docs/TOLERIE.md."));
}
function moulding(page) {
  const SAMPLE = { injection_molding: "PC-ABS", die_casting: "AL-A380", lp_die_casting: "AL-A356-T6", permanent_mold: "AL-A356-T6", sand_casting: "AL-A356-T6" };
  page.append(el("div", { class: "grid", style: WIDE }, Object.entries(MOLD_RULES).map(([key, R]) => el("section", { class: "card" }, el("h2", null, processName(key)),
    el("div", { class: "atelier-chips" }, chip(`Paroi ${range(R.wall)} mm`, "La plage de chaque matière prime : elle est dans sa fiche"), chip(`Nominale ${n(R.nominal)} mm`), chip(`Draft ${R.draft[0]}° dehors, ${R.draft[1]}° sur les cores`), chip(`Nervure ${Math.round(R.rib * 100)} % de la paroi`),
      chip(`Bossage ${n(R.boss)} × le trou`), chip(`Rayon intérieur ${n(R.inner)} × la paroi`), chip(R.thread === "insert" ? "Filets : inserts" : "Filets : taraudés après coulée"), chip(MOLDS[key].risers ? "Risers" : MOLDS[key].overflows ? "Overflows, vents" : "Ejector pins")), el("p", { class: "small", style: { margin: ".4rem 0 .2rem" } }, MOLDS[key].how), bullets(R.notes), ...(R.basis ? [basis(R.basis)] : []),
    el("div", { class: "form-actions", style: { justifyContent: "flex-start" } }, design(SAMPLE[key], "molded", `Concevoir en ${material(SAMPLE[key]).name}`, key))))),
    el("p", { class: "muted" }, "La pièce moulée se dessine seule dans « Pas à pas » : coque, couvercle assorti ou platine nervurée, avec son draft réel. Son onglet « Mold » montre ensuite le gate, le parting line, les slides, les risers et ce qu'ils laissent sur la pièce. Règles et sources : docs/MOULAGE.md."));
}
function extrusion(page) {
  const SAMPLE = { extrusion_al: "AL6063-T5", extrusion_plastic: "PVC-U" };
  page.append(el("div", { class: "grid", style: WIDE }, Object.entries(EXTRUSION_RULES).map(([key, R]) => el("section", { class: "card" }, el("h2", null, processName(key)),
    el("div", { class: "atelier-chips" }, chip(`Paroi ${n(R.wall(80))} à ${n(R.wall(200))} mm selon la taille`, "Elle grandit avec le cercle circonscrit de la section"), chip(`Rainure ≥ ${n(R.groove)} mm de fond`), chip(`Jeu de glissière ${n(R.side)} mm par côté`), chip(`Canaux de vis M3 à M5`, "Ouverts en C dans les angles : les flasques s'y vissent sans taraudage")), bullets(R.notes),
    el("div", { class: "form-actions", style: { justifyContent: "flex-start" } }, design(SAMPLE[key], "profile", `Concevoir en ${material(SAMPLE[key]).name}`))))),
    el("div", { class: "form-actions", style: { justifyContent: "flex-start" } }, el("a", { class: "btn btn-primary", href: "#/extrusion" }, icon("extrusion"), "Ouvrir le studio des profilés")),
    el("p", { class: "muted" }, "Le profilé se dessine seul dans « Pas à pas » autour de ce qu'il contient ; le studio des profilés montre la section, ses mesures et les règles de filière. Règles et sources : docs/EXTRUSION.md."));
}

function render(main, args) {
  const kind = KINDS.some(([k]) => k === args[0]) ? args[0] : "laser", page = el("div", { class: "page" });
  main.append(page);
  const ai = kind === "laser" || kind === "impression" || kind === "pliage";
  page.append(el("div", { class: "page-head" }, el("div", { class: "grow" }, el("h1", null, "Procédés spéciaux"),
    el("p", { class: "muted" }, "Cinq procédés où la matière décide du dessin. Chacun dit ici ce qu'il demande, matière par matière ; l'Atelier l'applique quand la pièce naît, et le DFx le vérifie ensuite.")),
    ai ? btn("Copier la fiche pour une IA", async () => toast((await copyText(kind === "pliage" ? foldBrief() : processBrief(kind, MATERIALS))) ? "Fiche copiée : collez-la à l'IA avec la pièce (.dwiz) à faire ou à revoir ; sa réponse revient par la porte « Avec l'IA » de l'Atelier." : "Copie impossible.", "success", 6000), { icon: "copy", tip: "Les règles du procédé, matière par matière, avec la consigne : à confier à une IA comme à un technicien" }) : null), null,
    el("div", { class: "stock-grid", style: { marginBottom: "1rem" } }, KINDS.map(([k, ic, label, text]) => el("a", { class: "stock-card" + (k === kind ? " on" : ""), href: `#/process/${k}`, "aria-current": k === kind ? "page" : null, style: { textDecoration: "none" } }, icon(ic), el("b", null, label), el("small", null, text)))));
  ({ laser, pliage: folding, impression: printing, moulage: moulding, extrusion })[kind](page);
  return null;
}

registerModule({ key: "process", label: "Procédés spéciaux", icon: "cast", tip: "Moulage, extrusion, découpe laser de précision, tôlerie pliée, impression 3D : ce que chaque matière demande au dessin", render });
