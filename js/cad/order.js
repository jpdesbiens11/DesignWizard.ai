/* DynamiteOrbit.ai — ordering a prototype part: is it ready to be made, how soon can it be on the lab bench, and
   what does the shop need to quote it? The platform exists to close the design loop fast: design from the intent,
   check the manufacturability (DFx) and the physics, ORDER the part, test it — before any production is launched.
   Lead times are TYPICAL figures of express prototype shops (working days, door to door excluded); they rank the
   options and show what slows a part down. The shop's own quote prevails. */

import { PROCESSES, materialOrDefault, processName } from "./materials.js";

/* process -> [fastest, usual] working days for a simple part in 1 to 10 pieces, and what kind of route it is */
export const LEAD = {
  laser_cut: { days: [1, 3], proto: true, shop: "découpe laser de précision" },
  fdm: { days: [1, 2], proto: true, shop: "impression 3D FDM" },
  mjf: { days: [2, 4], proto: true, shop: "impression 3D MJF / SLS" },
  sla: { days: [1, 3], proto: true, shop: "impression 3D résine (SLA)" },
  lpbf: { days: [7, 15], proto: true, shop: "impression 3D métal, traitement et reprise d'usinage compris" },
  cnc_milling: { days: [3, 6], proto: true, shop: "usinage CNC" },
  cnc_turning: { days: [3, 5], proto: true, shop: "tournage CNC" },
  sheet_metal: { days: [3, 6], proto: true, shop: "tôlerie fine" },
  pcb: { days: [2, 5], proto: true, shop: "circuit imprimé prototype" },
  purchased: { days: [2, 10], proto: true, shop: "fournisseur" },
  extrusion_al: { days: [20, 40], proto: false, shop: "extrusion (filière dédiée)", instead: "usinez le prototype dans une barre ou une plaque (3 à 6 jours), gardez la filière pour la série" },
  extrusion_plastic: { days: [20, 40], proto: false, shop: "extrusion plastique (filière dédiée)", instead: "imprimez le prototype (1 à 4 jours), gardez la filière pour la série" },
  die_casting: { days: [30, 60], proto: false, shop: "high pressure die casting (moule dédié)", instead: "usinez le prototype dans la masse (3 à 6 jours) pour valider la physique, gardez le moule pour la série" },
  lp_die_casting: { days: [30, 60], proto: false, shop: "low pressure die casting (moule métallique dédié)", instead: "usinez le prototype dans la masse (3 à 6 jours) pour valider la physique, gardez le moule pour la série" },
  permanent_mold: { days: [25, 50], proto: false, shop: "permanent mold casting (moule métallique dédié)", instead: "usinez le prototype dans la masse (3 à 6 jours), ou coulez-le en sand casting, gardez le moule permanent pour la série" },
  sand_casting: { days: [15, 30], proto: false, shop: "sand casting (pattern et moule en sable)", instead: "usinez le prototype dans la masse (3 à 6 jours), ou faites imprimer le modèle de fonderie" },
  injection_molding: { days: [25, 50], proto: false, shop: "injection (moule dédié)", instead: "imprimez le prototype en MJF PA12 ou usinez-le (2 à 6 jours) pour valider la physique, gardez le moule pour la série" },
};
const SLOW_FINISH = /anodis|peint|paint|chrom|nickel|zingu|zinc|galvan|passiv|poudre|powder|plating|trait/i;

/** Readiness and lead time of a part. dfx = result of runDfx (or null), route = routing(spec, built), order = spec.order. */
export function orderCheck(spec, built, dfx, route, order = spec.order || {}) {
  const blockers = [], cautions = [], drivers = [], L = LEAD[spec.process] || null, qty = Math.max(1, Math.round(order.quantity || (spec.intent && spec.intent.quantity) || 1));
  const errs = built ? built.log.filter((l) => l.level === "error").length : 1;
  if (!built || !built.bodies.length || errs) blockers.push("La pièce ne se construit pas : corrigez les erreurs de construction.");
  if (!spec.material) blockers.push("Matériau non défini.");
  if (!spec.process) blockers.push("Procédé non défini.");
  if (dfx && dfx.summary && dfx.summary.errors) blockers.push(`${dfx.summary.errors} règle(s) DFx à corriger : la pièce n'est pas fabricable telle quelle.`);
  if (dfx && dfx.summary && dfx.summary.warnings) cautions.push(`${dfx.summary.warnings} remarque(s) DFx à vérifier avec l'atelier.`);
  if (!dfx || dfx.unavailable) cautions.push("Règles DFx non évaluées.");
  let [lo, hi] = L ? L.days : [5, 15];
  if (L) drivers.push(`${processName(spec.process)} : ${lo} à ${hi} jours ouvrables pour une pièce simple.`);
  if (L && !L.proto) cautions.push(`Ce procédé demande un outillage : ce n'est pas une voie de prototype. Pour tester vite, ${L.instead}.`);
  const st = route && route.stock;
  if (st && !st.additive && !st.standard) { lo += 2; hi += 5; drivers.push("Brut hors série : approvisionnement spécial (+2 à +5 j)."); }
  else if (st && !st.additive && !st.exact) { hi += 1; drivers.push("Brut à surfacer : un posage de plus (+1 j)."); }
  if (!st && L && L.proto && ["cnc_milling", "cnc_turning", "laser_cut", "sheet_metal"].includes(spec.process)) cautions.push("Matière première non déclarée : l'atelier devra la choisir (onglet Gamme).");
  const setups = route ? route.setups.length : 0;
  if (setups > 2 && ["cnc_milling", "cnc_turning"].includes(spec.process)) { lo += 1; hi += setups - 2; drivers.push(`${setups} posages (+${setups - 2} j).`); }
  if (route && route.tools.length > 8) { hi += 1; drivers.push(`${route.tools.length} outils différents (+1 j).`); }
  if (spec.finish && SLOW_FINISH.test(spec.finish)) { lo += 2; hi += 5; drivers.push(`Finition « ${spec.finish} » : sous-traitance (+2 à +5 j). Pour un essai de physique, commandez brut.`); }
  if (qty > 10) { const more = Math.ceil(Math.log10(qty / 10) * 4) + 1; hi += more; drivers.push(`${qty} pièces : au-delà du lot prototype (+${more} j).`); }
  const tight = (spec.interfaces || []).some((i) => i.type === "fit" || i.type === "pins");
  if (tight && ["cnc_milling", "cnc_turning"].includes(spec.process)) { hi += 1; drivers.push("Ajustements serrés à contrôler (+1 j)."); }
  const ready = !blockers.length;
  return { ready, express: ready && !!L && L.proto && hi <= 5, blockers, cautions, drivers, days: [lo, hi], quantity: qty, process: L ? L.shop : "à définir",
    label: !ready ? "À corriger avant de commander" : L && !L.proto ? "Fabricable, mais pas en délai de prototype" : `Prête à commander — ${lo} à ${hi} jours ouvrables` };
}

/** What the order of a part still asks for, for the guide. check : orderCheck(…) ; order : what the part keeps of its order (spec.order).
    A quantity that nobody gave is the tool's own (1) : it is to confirm. → [{ level, text, field }] */
export function orderGuide(spec, check, order = (spec && spec.order) || {}) {
  const out = [], s = spec || {}, id = s.id || "Pièce", say = (level, text, field) => out.push({ level, text: `${id} — commande : ${text}`, field });
  if (!check) return out;
  for (const t of check.blockers || []) say("error", t, "blockers");
  if (!(order.quantity > 0) && !(s.intent && s.intent.quantity > 0)) say("todo", "quantité à confirmer — 1 par défaut : entrez la vôtre, ou gardez-la (Entrée).", "quantity");
  for (const t of check.cautions || []) say("warn", t, "cautions");
  if (check.ready && !order.need_by) say("tip", "aucune date de livraison souhaitée : la demande de prix dira « au plus tôt ».", "need_by");
  return out;
}

/** Request for quotation, in French, ready to send to a shop with the order package. */
export function rfqText(spec, built, route, check, order = spec.order || {}, files = [], variant = null) {
  const mat = materialOrDefault(spec.material), bb = built.bbox, n = (x) => (Math.round(x * 10) / 10).toLocaleString("fr-CA");
  const lines = [`DEMANDE DE PRIX — PROTOTYPE`, ``, `Pièce : ${spec.id} — ${spec.name || ""}${spec.revision ? ` (rév. ${spec.revision})` : ""}`, variant ? `Variante : ${variant} — les fichiers joints sont ceux de cette variante` : null, `Quantité : ${check.quantity}`,
    order.need_by ? `Livraison souhaitée : ${order.need_by}` : `Livraison souhaitée : au plus tôt (délai visé : ${check.days[0]} à ${check.days[1]} jours ouvrables)`,
    ``, `Matériau : ${mat.name}`, `Procédé : ${PROCESSES[spec.process] ? processName(spec.process) : "à convenir"}`, route && route.stock ? `Matière première : ${route.stock.label}` : null,
    `Enveloppe : ${n(bb[3] - bb[0])} × ${n(bb[4] - bb[1])} × ${n(bb[5] - bb[2])} mm — masse ${n(built.mass)} g`, `Finition : ${spec.finish || "brut d'usinage, ébavuré"}`,
    `Tolérances : selon le dessin joint ; générales ISO 2768-mK sauf indication.`, ``, `Usage : prototype d'essai en laboratoire. Le délai compte plus que l'aspect ; signalez toute cote qui allonge le délai, nous l'adapterons.`];
  if (route && route.steps.length) lines.push(``, `Gamme envisagée (indicative, l'atelier reste maître de sa méthode) :`, ...route.steps.filter((s) => s.kind !== "check").map((s) => `  ${String(s.n).padStart(3)}  ${s.text}`));
  if (order.note) lines.push(``, `Remarques : ${order.note}`);
  if (files.length) lines.push(``, `Fichiers joints :`, ...files.map((f) => `  - ${f}`));
  lines.push(``, `Merci de répondre avec : prix unitaire, délai ferme, et toute remarque de fabricabilité.`, ``, `Dossier généré par DynamiteOrbit.ai — règles DFx : ${check.blockers.length ? "à corriger" : check.cautions.length ? "fabricable, avec remarques" : "aucune remarque"}.`);
  return lines.filter((l) => l !== null).join("\n");
}
