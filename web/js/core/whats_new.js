/* DesignWizard.ai — what is new on the screens, from one version to the next (demande de JP : « tague-moi ce qui est nouveau
   dans l'interface entre les versions pour faciliter la revue humaine… quand on passe à une nouvelle revue seulement cache
   les tags, sinon laisse-les actifs, pour la traçabilité et faciliter les checks croisés »).
   The tool changes fast ; the person who reviews it must find what changed without hunting for it. Every version that
   changes a screen declares its lines here : what is new, in a sentence, on which screen, and on WHICH ELEMENT of that screen.
   The element then carries a mark (core/whats_new_ui.js, installed once), and a panel lists the lines with « Montrer ».
   A REVIEW is what was published since its base version. Its marks STAY for as long as the review is open — a line can be
   ticked « vu », the mark remains, in another colour : the trace of what was checked. Only « Passer à une nouvelle revue »
   hides them : the base becomes the running version, and the next version brings its own marks. The review before is kept,
   and can be opened again.
   Pure, except for the review kept in the browser. A test holds that the running version has its lines. */

import { parseVersion, newer } from "./update_check.js";

/** The lines, newest first. sel : a CSS selector of the element that is new (the first one found on the screen is marked) ;
    where : the address of a screen that shows it (absent : it is in a menu, said in `how`). */
export const NEWS = [
  { id: "view-bar", v: "0.125.0", title: "Une barre de zoom sur chaque vue, avec la loupe", text: "En haut à droite des tuiles du logiciel, d'une carte (PCBA, Labo) et d'un dessin : − et +, le pourcentage (taille réelle), « Ajuster » (tout se voit) et la loupe. Les tuiles se zooment à la molette et se déplacent en glissant le fond. La loupe a quitté la barre du haut.", where: "#/sw", sel: "[data-view-bar]", how: "Électronique › Logiciel, ou une carte, ou un dessin." },
  { id: "bottom-pane", v: "0.125.0", title: "Le panneau du bas se grandit et se replie", text: "Sous la simulation du Logiciel et sous les oscilloscopes du Labo : glissez la bordure du haut pour le grandir, son bouton ▾ le replie. La hauteur est gardée pour chaque écran.", where: "#/sw/live", sel: ".hsplit", how: "Logiciel, étape 5 « Simulation » ; ou le Labo d'une carte." },
  { id: "sw-steps", v: "0.124.0", title: "Logiciel : sept étapes, dites pour quelqu'un qui apprend", text: "En tête du volet de gauche : CPU, objets, valeurs, démarrage, simulation, code, chargement. Chaque étape dit en clair ce qu'elle est et ce que l'on fait, si elle est faite, et déplie ses mots du métier ; le guide est sous elle. Chaque tuile dit ses ENTRÉES et ses SORTIES.", where: "#/sw", sel: "[data-sw-step-btn]", how: "Électronique › Logiciel, puis « Partir de l'exemple »." },
  { id: "sw-live", v: "0.124.0", title: "Une simulation en direct, en pause ou en marche", text: "À l'étape 5, le logiciel tourne devant vous : vous tenez le banc — la tension d'une cellule, la demande de fermeture, un contact coincé ou soudé — et les tuiles réagissent. Pause, un pas, marche, vitesse ; un chronogramme et le journal de ce qui a basculé.", where: "#/sw/live", sel: "[data-sw-bench]", how: "Logiciel, étape 5 « Simulation »." },
  { id: "sw-load", v: "0.124.0", title: "Le code se lit à l'écran, et l'on sait comment le charger", text: "À l'étape 6, chaque fichier du paquet s'ouvre au centre, avec ses numéros de ligne. À l'étape 7, les sept gestes du paquet au CPU, avec ce que le fabricant publie et la page où cela a été lu ; l'étape 4 essaie le démarrage et compte la mémoire.", where: "#/sw/load", sel: "[data-sw-load]", how: "Logiciel, étapes 4, 6 et 7." },
  { id: "panes-all", v: "0.123.0", title: "Marges à cacher et à redimensionner, sur toutes les pages", text: "Le PCBA n'avait aucune bordure à glisser, le Logiciel aucune à droite : toute page qui a un volet de gauche ou de droite en a maintenant. Glisser la bordure élargit le volet, son bouton le cache ; la largeur est la même d'un écran à l'autre.", where: "#/pcba", sel: ".split", how: "La bordure entre un volet et le centre ; Ctrl + B pour le volet de gauche." },
  { id: "access-clear", v: "0.123.0", title: "Accès à la démo : les comptes et leurs droits, en clair", text: "Une ligne par compte : un nom que vous lui donnez (gardé dans ce navigateur seulement), son rôle et ce qu'il permet, et s'il est publié ou encore à publier. Ce qu'il reste à faire est dit pas à pas ; ce que vous ajoutez est gardé d'une visite à l'autre.", where: "#/account", sel: "[data-access-row]", how: "Menu du compte › Compte, Drive et accès — pour l'administrateur." },
  { id: "iso-board", v: "0.122.0", title: "Isolation : une carte seule, ou un assemblage", text: "Le menu « Ce que l'on analyse » offre les cartes (PCBA) à côté des assemblages. Une carte s'analyse seule, sur son cuivre réel — pastilles, pistes, vias —, ses nets regroupés par tension ; chaque paire nomme ses deux nets les plus proches.", where: "#/creepage", sel: "[data-iso-subject]", how: "Électronique › Isolation, ou la marche « Isolation » en tête du volet du PCBA." },
  { id: "sw-objects", v: "0.121.0", title: "Logiciel : des objets reliés, dont l'outil écrit le C", text: "Un nouvel écran : le logiciel embarqué d'un BMS se dessine en tuiles reliées par des fils — mesurer, décider, commander. L'outil en écrit le C (bibliothèque, modules, structure de fichiers) pour le CPU choisi, avec l'essai qui le compare au dessin.", where: "#/sw", sel: "[data-sw-zip]", how: "Électronique › Logiciel, puis « Partir de l'exemple »." },
  { id: "variant-live", v: "0.120.0", title: "L'arbre dit de quelle variante il est", text: "La variante en cours est vivante : une opération mise à On ou à Off, un paramètre changé lui appartient, sans bouton à presser. Son nom est sur le titre de l'arbre et des paramètres ; le premier « + » garde aussi la pièce d'avant, sous « Origine ».", where: "#/parts", sel: "[data-variant-on]", how: "Visible sur une pièce qui a au moins une variante (le « + » du groupe « Variantes »)." },
  { id: "lab-plain", v: "0.119.0", title: "Chaque étape du banc, dite en clair", text: "Sous son titre, chaque étape de « Manipulation en labo » dit en une ou deux phrases ce que l'on fait, avec l'image de l'eau quand elle aide ; les mots du banc qu'elle emploie se déplient dessous, et chaque point dit ce qu'est son signal.", where: "#/elab", sel: "[data-manip-plain]", how: "Labo, bouton « Manipulation en labo »." },
  { id: "lab-bench", v: "0.119.0", title: "L'écran et le vrai banc : ce qui change, et pourquoi", text: "Sous les courbes, le Labo dit comment l'essai se fait au vrai banc. Un essai au multimètre relève maintenant la fin de chaque courbe (l'anneau blanc) ; un temps demande un oscilloscope et n'est plus dû. La fiche a son groupe « L'écran et le vrai banc ».", where: "#/elab", sel: "[data-bench-note]" },
  { id: "rev-freeze", v: "0.118.0", title: "Geler la révision — et voir son état d'un coup d'œil", text: "« Libérer… » se dit maintenant « Geler la révision » : le contenu est figé sous son numéro, et l'on nomme son auteur. Chaque ligne porte le nom de la révision et son état — en travail, gelée, libérée, refusée.", where: "#/plm", sel: "[data-rev-freeze]" },
  { id: "rev-review", v: "0.118.0", title: "La revue de conception qui libère une révision gelée", text: "Une liste courte : ce que l'outil vérifie lui-même sur le contenu gelé, puis ce que l'approbateur — quelqu'un d'autre que l'auteur — confirme. Il écrit la décision et les points ouverts ; la fiche de revue sort en PDF.", where: "#/plm", sel: "[data-rev-review]", how: "Visible sur une révision gelée, en attente de sa revue." },
  { id: "lab-manip-pdf", v: "0.117.0", title: "La manipulation sur papier, une image par étape", text: "Dans « Manipulation en labo » : « PDF » sort la procédure de l'essai avec une image de la carte à chaque étape qui la touche, une case par relevé et des lignes de notes ; remplie de ce qui est déjà coché, relevé et noté, c'est le compte rendu. « Tout le plan » fait le même cahier pour tous les essais.", where: "#/elab", sel: "[data-manip-pdf]", how: "Labo, bouton « Manipulation en labo », en haut de l'écran qui s'ouvre." },
  { id: "battery-words", v: "0.116.0", title: "Le vocabulaire des batteries, tel que publié", text: "Chaque terme d'un système de batterie avec la norme ou le texte d'autorité qui le porte, et comment il a été lu ; les mots de maison — CMB, BMU, BM, EFC — avec ce qui a été trouvé ; ce que les documents publics disent des bus.", where: "#/help/batteries", sel: ".battery-card" },
  { id: "rs485-example", v: "0.116.0", title: "Un exemple complet : le nœud RS-485", text: "Une carte d'exemple où toute la liaison est posée — bornier, écrêteur et résistances série, terminaison, polarisation, transceiver, trois broches du microcontrôleur — avec ses pistes, ses essais du Labo (niveaux, bus au repos, une trame) et son pilote.", where: "#/pcba", sel: '[data-example="rs485"]' },
  { id: "hwsw-sheet", v: "0.116.0", title: "L'interface matériel / logiciel d'une liaison", text: "Lue des nets de la carte : quelle broche du microcontrôleur porte quel signal, sous quel nom le logiciel le connaît, les temps à tenir. La fiche sort en Word ou en PDF, et le pilote C — écrit à partir du même modèle — en .zip.", where: "#/pcba", sel: "[data-hwsw]", how: "PCBA d'une carte qui porte un bloc RS-485, étape « Revue »." },
  { id: "lab-manip", v: "0.115.0", title: "Manipulation en labo : l'essai fait au vrai banc", text: "L'essai choisi, une étape par écran, en plein écran : chaque branchement est pointé sur la carte, l'appareil est dessiné avec son réglage, une étape s'ouvre quand celles d'avant sont faites, un relevé hors plage arrête l'essai. Relevés et notes restent dans le carnet de la carte.", where: "#/elab", sel: "[data-manip]" },
  { id: "news-marks", v: "0.114.0", title: "Ce qui est nouveau est marqué à l'écran", text: "Chaque nouveauté d'une version porte une marque sur l'élément lui-même. Ce bouton en ouvre la liste : « Montrer » y mène, « vu » la coche — la marque reste, pour la trace — et « Passer à une nouvelle revue » les range.", sel: "#news-btn", how: "Barre du haut, le bouton à l'étoile." },
  { id: "sim-chip", v: "0.113.0", title: "Simuler la géométrie d'un calcul à la main", text: "Sous le schéma d'un modèle analytique : ouvre la Simulation sur un modèle simplifié fait du calcul — mêmes dimensions, même matière, mêmes appuis, même charge.", where: "#/physics/beam_cantilever_point", sel: ".sim-chip" },
  { id: "study-up", v: "0.113.0", title: "Du modèle simplifié, remonter au calcul", text: "Dans la Simulation d'un modèle simplifié, la marche vers le haut ramène au modèle analytique, avec ses valeurs. L'Atelier range ces modèles en dernier, sous « Simplified models ».", where: "#/shop", sel: '[data-part^="MS-"]', how: "Visible une fois qu'un modèle a été simulé." },
  { id: "stair-down", v: "0.112.0", title: "Descendre d'un niveau", text: "À côté de la marche vers le haut : les pictogrammes de ce qui est fait à partir de ce que l'écran montre — la carte mène à son PCBA, le PCBA à son Labo, une pièce à son dessin et à sa simulation. Alt + ↓.", where: "#/parts", sel: ".stair-downs" },
  { id: "twin-note", v: "0.112.0", title: "La carte dit de quel PCBA elle vient", text: "Le jumeau mécanique naît au premier composant placé et suit le PCBA à chaque changement ; la carte y mène d'un clic.", where: "#/pcb", sel: "[data-twin-of]", how: "Visible sur une carte qui porte un PCBA." },
  { id: "board-names", v: "0.112.0", title: "Noms du métier : PCB · PCBA, PWB · CCA, ou vos mots", text: "Tout l'écran et les documents Word et PDF suivent ; les identifiants et les fichiers ne changent pas.", sel: ".board-names", how: "Menu du compte (le bonhomme, en haut à droite)." },
  { id: "val-chip", v: "0.111.0", title: "Un calcul rejoué contre un exemple publié", text: "Sous le schéma d'un modèle : combien d'exemples publiés il retrouve. Un clic ouvre le groupe « Validation » — la source, ce qu'elle imprime, ce que l'outil trouve, l'écart.", where: "#/physics/beam_cantilever_point", sel: ".val-chip" },
  { id: "val-fea", v: "0.111.0", title: "La validation du solveur de la Simulation", text: "Dans le volet de droite : les exemples publiés que le solveur rejoue, dans la page, sur un maillage dit.", where: "#/fea", sel: ".side.right .val-section" },
  { id: "val-help", v: "0.111.0", title: "Le tableau d'ensemble de la validation", text: "Chaque modèle et chaque famille de la simulation, avec ses cas — ou la phrase qui dit qu'il n'en a pas.", where: "#/help/validation", sel: ".val-card" },
  { id: "head-ai", v: "0.110.0", title: "Le bouton « IA » de chaque studio", text: "En tête du volet de gauche : confie à un assistant ce que l'écran montre ; toute réponse appliquée entre au journal.", where: "#/parts", sel: ".head-ai" },
];
/** How many versions back a first review reaches, when nobody opened one yet. */
export const FIRST_SPAN = 4;
const minor = (v) => parseVersion(v)[1] || 0;
/** The base of a first review : a few versions back. « 0.114.0 » → « 0.110.0 ». */
export const firstBase = (running) => { const p = parseVersion(running); return `${p[0] || 0}.${Math.max(0, (p[1] || 0) - FIRST_SPAN)}.0`; };
/** The review in force, tidied. → { base, seen: { id: date }, before: { base, seen, closed } | null } */
export function tidyReview(raw, running) {
  const ok = (v) => typeof v === "string" && /^\d+\.\d+\.\d+$/.test(v), r = raw && typeof raw === "object" ? raw : {};
  const base = ok(r.base) && !newer(r.base, running) ? r.base : firstBase(running), seen = {};
  for (const [k, d] of Object.entries(r.seen && typeof r.seen === "object" ? r.seen : {})) if (NEWS.some((n) => n.id === k)) seen[k] = String(d);
  const b = r.before && ok(r.before.base) ? { base: r.before.base, seen: { ...(r.before.seen || {}) }, closed: String(r.before.closed || "") } : null;
  return { base, seen, before: b };
}
/** The lines of a review : what was published after its base, up to the running version. → [{ ...line, seen (date or "") }] newest first */
export function reviewLines(review, running) {
  return NEWS.filter((n) => newer(n.v, review.base) && !newer(n.v, running)).map((n) => ({ ...n, seen: review.seen[n.id] || "" }));
}
/** The lines by version : → [{ v, lines }] */
export function byVersion(lines) { const out = []; for (const n of lines) { let g = out.find((x) => x.v === n.v); if (!g) out.push(g = { v: n.v, lines: [] }); g.lines.push(n); } return out.sort((a, b) => minor(b.v) - minor(a.v)); }
/** Where a review stands : → { total, seen, left, text } */
export function reviewCount(lines) { const seen = lines.filter((n) => n.seen).length; return { total: lines.length, seen, left: lines.length - seen, text: !lines.length ? "Aucune nouveauté à revoir" : `${seen} vue${seen > 1 ? "s" : ""} sur ${lines.length}` }; }
/** A line ticked, or unticked : → the review */
export function markSeen(review, id, on = true, when = new Date().toISOString()) { const seen = { ...review.seen }; if (on) seen[id] = seen[id] || when; else delete seen[id]; return { ...review, seen }; }
/** A new review : the marks of this one are put away — kept as the review before — and the base becomes the running version. */
export function nextReview(review, running, when = new Date().toISOString()) { return { base: running, seen: {}, before: { base: review.base, seen: { ...review.seen }, closed: when } }; }
/** Back to the review before : its base and its ticks return. */
export function previousReview(review) { return review.before ? { base: review.before.base, seen: { ...review.before.seen }, before: null } : review; }
/** A line is whole : → [problems] */
export function lineProblems(n) {
  const out = [];
  if (!n.id || !/^[a-z0-9-]+$/.test(n.id)) out.push("identifiant absent ou mal formé");
  if (!/^\d+\.\d+\.\d+$/.test(n.v || "")) out.push("version absente");
  if (!n.title || n.title.length > 70) out.push("titre absent ou trop long"); if (!n.text || n.text.length < 30) out.push("la phrase qui dit ce qui est nouveau manque");
  if (!n.sel) out.push("l'élément de l'écran n'est pas désigné"); if (!n.where && !n.how) out.push("ni écran, ni façon d'y arriver");
  return out;
}

/* ---------- the review, kept in this browser ---------- */
const KEY = "dw.news.review";
let memo = null, memoFor = null;
export function getReview(running) {
  if (memo && memoFor === running) return memo;
  let p = null;
  try { p = typeof localStorage !== "undefined" ? JSON.parse(localStorage.getItem(KEY) || "null") : null; } catch (e) { p = null; }
  memo = tidyReview(p, running); memoFor = running; return memo;
}
export function setReview(review, running) {
  memo = tidyReview(review, running); memoFor = running;
  try { if (typeof localStorage !== "undefined") localStorage.setItem(KEY, JSON.stringify(memo)); } catch (e) { /* private window : the review lasts for this page only */ }
  if (typeof window !== "undefined" && typeof CustomEvent !== "undefined") window.dispatchEvent(new CustomEvent("dw:news", { detail: memo }));
  return memo;
}
