/* DynamiteOrbit.ai — PCBA: the assembly routing of an electronic board, written for the discussion with the assembler :
   solder paste, placement, reflow, inspection, through-hole parts, cleaning, programming and test, conformal coating,
   final check — each phase with what the board itself asks (how many parts, which fine-pitch packages, which parts to
   solder by hand, which areas to mask). It proposes ; the assembler's own process prevails. */

import { resolveBoard, boardBom, COATINGS } from "./model.js";
import { coatingKeepouts } from "./art.js";
import { finishPlan } from "../core/plan_doc.js";

const FINE = /LQFP|QFN|LGA|TSSOP|MSOP|0402/;

/** The assembly routing of a board. */
export function boardAssemblyPlan(board, lib = {}) {
  const R = resolveBoard(board, lib), b = board.board || {}, bom = boardBom(board, lib), fitted = R.parts.filter((p) => !p.dnp), phases = [], q = [], ask = (topic, text) => q.push({ topic, text });
  const smd = (side) => fitted.filter((p) => p.side === side && p.pads.some((i) => !R.pads[i].drill) && !["fiducial", "testpoint"].includes(p.kind)), tht = fitted.filter((p) => p.pads.some((i) => R.pads[i].drill));
  const fid = (side) => R.parts.filter((p) => p.side === side && p.kind === "fiducial").length, fine = (list) => [...new Set(list.filter((p) => FINE.test(p.def.package || "")).map((p) => p.def.package))];
  const tps = R.parts.filter((p) => p.kind === "testpoint"), prog = R.parts.filter((p) => /programmation|SWD/i.test(p.def.name)), coat = b.coating && b.coating.type && b.coating.type !== "none" ? b.coating : null, keep = coat ? coatingKeepouts(R, board) : [];
  const phase = (key, title, station, ops, checks = [], extra = {}) => phases.push({ key, title, station, ops: ops.map((t) => (typeof t === "string" ? { text: t } : t)), checks, note: ((board.plan && board.plan.notes) || {})[key] || "", ...extra });
  phase("prep", "Préparation", "Magasin, étuve", [`Contrôler la carte nue à réception : ${R.layers.length} couches, ${String(R.t).replace(".", ",")} mm, finition ${b.finish || "ENIG"}`, `Préparer le kit : ${bom.filter((l) => !l.dnp).length} références, ${fitted.length} composants`, "Étuver les composants sensibles à l'humidité et la carte si elle a séjourné à l'air"],
    [`Nomenclature et fichier de placement à la révision ${board.revision || "A"}`]);
  for (const side of ["top", "bottom"]) {
    const list = smd(side), where = side === "top" ? "dessus" : "dessous"; if (!list.length) continue;
    phase(`paste_${side}`, `Sérigraphie de la pâte à braser — ${where}`, "Sérigraphieuse", [{ text: `Déposer la pâte sans plomb au pochoir (fichier « pâte à braser ${where} »)`, tools: ["Pochoir inox, 120 µm"], control: "Dépôts complets, sans pont" }]);
    phase(`place_${side}`, `Pose des composants montés en surface — ${where}`, "Machine de placement", [{ text: `Poser ${list.length} composants d'après le fichier de placement`, tools: [], control: fid(side) >= 3 ? `Recalage sur les ${fid(side)} mires` : "Recalage manuel : moins de trois mires" },
      ...(fine(list).length ? [{ text: `Boîtiers à pas fin : ${fine(list).join(", ")} — vérifier le centrage avant refusion`, tools: ["Loupe ou caméra"] }] : [])]);
    phase(`reflow_${side}`, `Refusion — ${where}`, "Four à refusion", [{ text: "Refondre selon le profil sans plomb de la pâte (pic 240 à 250 °C)", tools: [], control: "Profil relevé sur la première carte" }], ["Joints brillants et mouillés ; aucun pont, aucune bille, aucun composant redressé"]);
  }
  if (smd("top").length + smd("bottom").length) phase("inspect", "Inspection", "Contrôle optique", [{ text: "Inspecter chaque joint, à l'œil ou en optique automatique ; reprendre les défauts", tools: ["Loupe, fer à souder fin"], control: "IPC-A-610 classe 2" }]);
  if (tht.length) phase("tht", "Composants traversants", "Poste de brasage", [{ text: `Monter et braser ${tht.length} composant${tht.length > 1 ? "s" : ""} : ${tht.map((p) => p.ref).join(", ")}`, tools: ["Fer à souder ou brasage sélectif"], control: "Remontée de brasure visible côté composant" }], ["Connecteurs d'équerre et en butée sur la carte"]);
  phase("clean", "Nettoyage", "Poste de lavage", [coat ? "Laver les résidus de flux : obligatoire avant le vernis" : "Laver les résidus de flux si la pâte n'est pas « sans nettoyage »"], coat ? ["Carte sèche, sans résidu blanc"] : []);
  phase("test", "Programmation et essai", "Banc d'essai", [...(prog.length ? [`Programmer le microcontrôleur par ${prog.map((p) => p.ref).join(", ")}`] : []), tps.length ? `Mesurer aux points de test : ${tps.map((p) => `${p.ref} (${p.value || R.pads[p.pads[0]].net || "?"})`).join(", ")}` : "Mesurer les alimentations aux bornes des condensateurs de sortie", "Essai fonctionnel selon le plan d'essai"],
    ["Alimentations dans leurs tolérances avant de brancher la charge"]);
  if (coat) phase("coat", "Vernis de tropicalisation", "Cabine de vernissage", [{ text: `Masquer ${keep.length} zone${keep.length > 1 ? "s" : ""} : ${[...new Set(keep.map((k) => k.ref || "appuis de vis"))].join(", ")}`, tools: ["Ruban et capuchons de masquage"] },
    { text: `Appliquer le vernis ${COATINGS[coat.type] || coat.type}, ${coat.thickness || 50} µm, ${coat.sides === "top" ? "dessus" : "deux faces"} ; polymériser`, tools: [], control: "Épaisseur ; couverture sous lampe UV" }, "Retirer les masques"], ["Aucun vernis sur les contacts, les points de test et les appuis de vis"]);
  phase("final", "Contrôle final et emballage", "Expédition", [], [`Identifier : ${board.id}, révision ${board.revision || "A"}, numéro de série`, "Emballer en sachet antistatique"]);
  const all = [...smd("top"), ...smd("bottom")], sides = ["top", "bottom"].filter((s) => smd(s).length);
  ask("Délai et prix", `Prix et délai pour 5 cartes montées, puis 25 ? Fournissez-vous les composants ou les reçoit-on en kit ?`);
  if (fine(all).length) ask("Pas fin", `Boîtiers ${fine(all).join(", ")} : épaisseur de pochoir et réduction d'ouverture conseillées ? Contrôle aux rayons X pour les boîtiers sans pattes ?`);
  if (sides.length > 1) ask("Deux faces", "Composants montés en surface des deux côtés : seconde refusion ou collage ? Quels composants lourds éviter dessous ?");
  for (const s of sides) if (fid(s) < 3) ask("Mires", `Moins de trois mires ${s === "top" ? "dessus" : "dessous"} : la machine peut-elle se recaler autrement ?`);
  if (tht.length) ask("Traversants", `${tht.length} composant(s) traversant(s) : brasage manuel, sélectif ou à la vague ? Faut-il un cadre de maintien ?`);
  if (bom.some((l) => !l.mpn && !l.dnp)) ask("Composants", `${bom.filter((l) => !l.mpn && !l.dnp).length} ligne(s) sans référence choisie : acceptez-vous des équivalents génériques, lesquels faut-il figer ?`);
  if (bom.some((l) => l.dnp)) ask("Composants", `Non montés : ${bom.filter((l) => l.dnp).flatMap((l) => l.refs).join(", ")} — bien exclus du placement ?`);
  if (coat) ask("Vernis", "Le vernissage est-il fait chez vous ? Masquage au ruban ou par capuchons ? Contrôle de l'épaisseur ?");
  ask("Essai", "Faites-vous l'essai électrique et la programmation ? Avec quel moyen, et que fournit-on (micrologiciel, procédure) ?");
  ask("Panneau", "Les cartes sont-elles mises en panneau ? Faut-il des bords techniques, des languettes sécables, des trous d'outillage ?");
  return finishPlan({ kind: "carte", id: board.id, name: board.name || "", revision: board.revision || "A",
    facts: [["Carte", `${String(R.w).replace(".", ",")} × ${String(R.h).replace(".", ",")} mm, ${R.layers.length} couches`], ["Composants", `${fitted.length}, dont ${tht.length} traversant${tht.length > 1 ? "s" : ""}`], ["Faces équipées", sides.map((s) => (s === "top" ? "dessus" : "dessous")).join(" et ") || "aucune"], ["Références", String(bom.filter((l) => !l.dnp).length)], ["Vernis", coat ? COATINGS[coat.type] : "aucun"]],
    phases, questions: q, points: (board.plan && board.plan.points) || [] });
}
