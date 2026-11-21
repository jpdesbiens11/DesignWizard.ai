/* DesignWizard.ai — the special processes of the Shop : what a precision laser cut asks of each SHEET material, and what
   3D printing asks of each MATERIAL. One source for the Shop, the DFx rule book, the routing sheet and the words handed to
   an AI. (Moulding and extrusion, the two other special processes, keep their own rules : shop_mold.js, shop_extrusion.js.)
   Figures are TYPICAL values of published design guides, machine makers and standards — see SOURCES, and `basis` on each
   entry : it says what was read and what is only workshop practice. They shape a part, they do not qualify it : the
   machine of the supplier actually used and the data sheet of the material prevail.
   Lengths in mm, angles in degrees from the horizontal (the build plate). */

import { SHEET_GAUGES } from "./standards.js";
import { material } from "./materials.js";

/* ---------------------------------------------------------------- precision laser cutting, by family of sheet material
   t : [thinnest, thickest] sheet usually cut · kerf : width of the cut · hole / slot / web : smallest hole, smallest slot
   and smallest bridge of material — the larger of k × thickness and an absolute minimum · corner : inside radius advised
   (0 = none) · keepOut : copper kept back from the cut · verdict : ok | caution (it cuts, badly) | forbidden */
const METAL = { kerf: [0.2, 0.4], hole: { k: 0.5, min: 0.5 }, slot: { k: 1, min: 1 }, web: { k: 1, min: 1.6 }, corner: 0, tol: 0.25, verdict: "ok" };
export const LASER_FAMILIES = {
  steel: { ...METAL, label: "Steel and stainless steel", fr: "Acier et inox", short: "acier", source: "laser à fibre", gas: "azote pour un bord sans bavure ni oxyde (inox, pièce à peindre ou à souder) ; oxygène pour l'acier doux, bord oxydé", t: [0.5, 20],
    cut: "Découper le contour au laser à fibre (sous azote : bord sans oxyde)", edge: "Bord net, finement strié. Coupé à l'oxygène, il porte une couche d'oxyde.",
    watch: ["Sur un bord coupé à l'oxygène, la peinture en poudre s'écaille : demander l'azote, ou décaper le bord avant de peindre.", "Une petite pièce bascule entre les lattes de la table : prévoir des micro-attaches."],
    basis: "Épaisseur (machine de 6 kW), trait de coupe, gaz, plus petits détails et ponts : lus chez un fabricant de machines, un gazier et dans un guide de conception. Micro-attaches : pratique d'atelier." },
  aluminium: { ...METAL, label: "Aluminium", fr: "Aluminium", short: "aluminium", source: "laser à fibre", gas: "azote", t: [0.5, 15],
    cut: "Découper le contour au laser à fibre, sous azote", edge: "Bord strié, une fine bavure au dos. Métal réfléchissant : seul un laser à fibre le coupe sans risque pour la machine.",
    watch: ["Bavure au dos : ébavurer avant anodisation ou collage.", "Une nuance trempée (6061-T6) se plie mal après découpe : pour une pièce pliée, prendre une nuance de tôlerie (5052)."],
    basis: "Épaisseur, trait de coupe, gaz : lus. Pliage des nuances trempées : pratique d'atelier." },
  copper: { ...METAL, label: "Copper and brass", fr: "Cuivre et laiton", short: "cuivre et laiton", source: "laser à fibre (un laser CO2 est renvoyé par le métal)", gas: "azote", t: [0.3, 10],
    cut: "Découper le contour au laser à fibre, ébavurer le dos", edge: "Bord net, une bavure fine au dos. Métal très réfléchissant : laser à fibre, coupe lente.",
    watch: ["Conducteur à isoler ou à laminer : une bavure perce l'isolant — ébavurer et arrondir les arêtes avant d'isoler.", "Une plage de contact ou de soudure se nettoie après la coupe."],
    basis: "Épaisseur (machine de 6 kW), laser à fibre pour les métaux réfléchissants : lus. Ébavurage avant isolation : pratique des fabricants de busbars, non vérifiée ici." },
  titanium: { ...METAL, label: "Titanium", fr: "Titane", short: "titane", source: "laser à fibre", gas: "argon, gaz neutre : à chaud le titane absorbe l'oxygène et l'azote", t: [0.5, 6],
    cut: "Découper le contour au laser à fibre, sous argon", edge: "Coupé sous gaz neutre, le bord reste clair. Un bord coloré dit que l'air est entré : couche durcie et fragile.",
    watch: ["Pièce en fatigue : la couche fragilisée du bord s'enlève à l'usinage ou par décapage — prévoir la matière.", "Épaisseur maximale à confirmer avec l'atelier."],
    basis: "Coupe sous gaz neutre sans oxyde : lu chez un fabricant de machines. Épaisseur maximale et couche fragilisée du titane : connaissance métallurgique, non vérifiée ici." },
  laminate: { label: "Glass-epoxy laminate (FR-4, board)", fr: "Stratifié verre-époxy (FR-4, carte)", short: "FR-4", source: "laser UV ; un laser CO2 coupe plus épais mais carbonise le bord", gas: "aspiration des fumées", t: [0.1, 1.6],
    kerf: [0.02, 0.05], hole: { k: 0, min: 0.3 }, slot: { k: 0, min: 0.3 }, web: { k: 0, min: 0.5 }, corner: 0.5, tol: 0.05, keepOut: 0.2, verdict: "ok",
    cut: "Découper le contour au laser UV (aucun effort sur la carte)", edge: "Aucun effort sur la carte ni sur ses soudures, un trait de coupe très fin. Mal réglé, même un laser UV carbonise le bord.",
    watch: ["Un bord carbonisé abaisse la résistance de surface et la tenue en tension du chant : tenir pistes et composants en retrait du trait de coupe, ou placer une piste de garde.", "Aucune distance normalisée : des essais publiés ont tenu la tension dès 0,2 mm entre le trait de coupe et le cuivre — la convenir avec l'atelier et la contrôler.", "Carte assemblée : le laser détache sans plier ni presser, contrairement à la fraise (trait de 3 mm environ)."],
    basis: "Épaisseur, absence d'effort, carbonisation et son effet, essais de tenue en tension : lus dans les publications d'un fabricant de machines de découpe de cartes. Plus petit trou, pont et rayon : ordre de grandeur d'atelier, non vérifié." },
  aramid: { label: "Aramid paper", fr: "Papier aramide", short: "papier aramide", source: "laser CO2", gas: "aspiration des fumées", t: [0.05, 0.76],
    kerf: [0.1, 0.2], hole: { k: 0, min: 0.5 }, slot: { k: 0, min: 0.5 }, web: { k: 0, min: 1.5 }, corner: 0.5, tol: 0.1, verdict: "ok",
    cut: "Découper le contour au laser CO2, feuille à plat sur table aspirante", edge: "Le papier ne fond pas : son bord brunit. Aucune bavure, aucun effort sur la feuille.",
    watch: ["L'effet d'un bord bruni sur la tenue diélectrique du papier n'est pas publié : par prudence, garder le débord d'isolant au-delà du conducteur, ne pas compter le chant coupé dans la ligne de fuite, et le vérifier par un essai diélectrique.", "Feuille mince : un pont étroit se déchire à la manipulation — élargir les ponts, arrondir les angles rentrants.", "Stocker à plat et à sec ; découper puis laminer sans attendre."],
    basis: "Laser CO2 et bord peu décoloré : résumés d'un fabricant de machines, pages non lues. Trait de coupe, plus petits détails, ponts : ordre de grandeur d'atelier, non vérifié." },
  film: { label: "Insulating film (polyimide, polyester)", fr: "Film isolant (polyimide, polyester)", short: "film isolant", source: "laser UV pour un bord net ; laser CO2, plus rapide, bord plus marqué", gas: "aspiration des fumées", t: [0.025, 0.5],
    kerf: [0.03, 0.12], hole: { k: 0, min: 0.3 }, slot: { k: 0, min: 0.3 }, web: { k: 0, min: 1 }, corner: 0.3, tol: 0.05, verdict: "ok",
    cut: "Découper le contour au laser, film à plat sur table aspirante", edge: "Polyimide : il ne fond pas, son bord noircit — bien moins au laser UV qu'au CO2. Polyester : le bord fond.",
    watch: ["Trop de puissance carbonise ou décolore le bord : même prudence que pour le papier, il ne compte pas dans la ligne de fuite.", "Angle rentrant vif : amorce de déchirure — toujours un rayon."],
    basis: "Polyimide : trait de coupe mesuré (0,03 mm au laser UV, 0,12 mm au CO2 dans un film de 0,125 mm), carbonisation moindre au laser UV : lus. Polyester, plus petits détails et ponts : ordre de grandeur d'atelier, non vérifié." },
  acrylic: { label: "Acrylic (PMMA)", fr: "Acrylique (PMMA)", short: "acrylique", source: "laser CO2", gas: "air", t: [1, 20],
    kerf: [0.1, 0.3], hole: { k: 0.5, min: 1 }, slot: { k: 1, min: 1 }, web: { k: 1, min: 2 }, corner: 0.5, tol: 0.2, verdict: "ok",
    cut: "Découper le contour au laser CO2", edge: "Le plastique qui se découpe le mieux au laser : bord lisse et brillant.",
    watch: ["Le bord garde des contraintes : un solvant ou une colle le fait craqueler — coller avec une colle prévue pour, ou recuire.", "Angle rentrant vif : la plaque casse là — toujours un rayon."],
    basis: "Matière donnée pour découpable au laser CO2 par un fabricant de machines : lu. Épaisseur, état du bord, craquelures : connaissance d'atelier, non vérifiée ici." },
  plastic: { label: "Engineering plastics (POM, polyester, polyamide, ABS)", fr: "Plastiques techniques (POM, polyester, polyamide, ABS)", short: "plastique", source: "laser CO2", gas: "air, aspiration des fumées", t: [0.5, 10],
    kerf: [0.15, 0.4], hole: { k: 1, min: 1 }, slot: { k: 1, min: 1 }, web: { k: 1, min: 2 }, corner: 0.5, tol: 0.2, verdict: "ok",
    cut: "Découper le contour au laser CO2, sous aspiration", edge: "Bord fondu, coupe conique dans les fortes épaisseurs. Les fumées s'aspirent.",
    watch: ["Précision moindre que dans l'acrylique : pour un ajustement, reprendre à l'outil ou usiner.", "Matière chargée de fibres de verre : bord rugueux, fibres à nu."],
    basis: "Matières données pour découpables au laser CO2 par un fabricant de machines : lu. Épaisseur, état du bord : connaissance d'atelier, non vérifiée ici." },
  caution: { label: "Polycarbonate", fr: "Polycarbonate", short: "polycarbonate", source: "laser CO2 — à éviter", gas: "aspiration", t: [0.1, 1],
    kerf: [0.2, 0.5], hole: { k: 1, min: 1.5 }, slot: { k: 1, min: 1.5 }, web: { k: 1, min: 2 }, corner: 0.5, tol: 0.2, verdict: "caution",
    cut: "Découper le contour (laser déconseillé : usinage ou jet d'eau)", why: "le polycarbonate se découpe en feuille mince seulement, et il se décolore sous le faisceau : bord jaune à brun, qualité de coupe faible",
    instead: "usiner (fraisage) ou découper au jet d'eau ; pour une pièce transparente découpée au laser, prendre de l'acrylique", edge: "Bord jauni ou bruni.", watch: [],
    basis: "Décoloration et coupe en feuille mince seulement : lu chez un fabricant de machines." },
  forbidden: { label: "PVC, PTFE and chlorinated or fluorinated materials", fr: "PVC, PTFE et matières chlorées ou fluorées", short: "PVC", source: "jamais au laser", gas: "—", t: [0, 0],
    kerf: [0, 0], hole: { k: 0, min: 0 }, slot: { k: 0, min: 0 }, web: { k: 0, min: 0 }, corner: 0, tol: 0, verdict: "forbidden",
    cut: "Découper le contour à l'outil ou au jet d'eau (jamais au laser)", why: "sous le faisceau, le PVC dégage du chlorure d'hydrogène et du chlorure de vinyle — toxiques pour l'opérateur, corrosifs pour l'optique et l'électronique de la machine ; le PTFE dégage lui aussi des gaz toxiques",
    instead: "usiner (fraisage, détourage à la fraise) ou découper au couteau ou au jet d'eau", edge: "—", watch: [],
    basis: "Interdiction du PVC et du PTFE, gaz dégagés par le PVC : lus chez deux fabricants de machines." },
};
const LASER_OF = { "SS-304": "steel", "SS-316L": "steel", "SS-17-4PH": "steel", "STEEL-1018": "steel", "AL6061-T6": "aluminium", "AL5052-H32": "aluminium", "AL6063-T5": "aluminium", "CU-C110": "copper", "CUBE-C17200": "copper", "BRASS-360": "copper",
  "TI-6AL-4V": "titanium", FR4: "laminate", "FR4-CTI600": "laminate", "NOMEX-410": "aramid", "PET-FILM": "film", "PI-FILM": "film", PMMA: "acrylic", POM: "plastic", PA12: "plastic", PA11: "plastic", ABS: "plastic", PC: "caution", "PC-ABS": "caution", "PVC-U": "forbidden" };

/** How a material behaves under the laser : { key, ...family } — null when the library does not know it. */
export function laserProfile(materialId) {
  const id = String(materialId || ""), key = LASER_OF[id] || LASER_OF[id.toUpperCase()] || (/PVC|PTFE|FEP|PVDF/i.test(id) ? "forbidden" : null);
  return key ? { key, ...LASER_FAMILIES[key] } : null;
}
/** Smallest hole, slot and bridge of material a laser leaves in a sheet of thickness t, for a family. */
export const laserLimits = (P, t) => ({ hole: Math.max(P.hole.k * t, P.hole.min), slot: Math.max(P.slot.k * t, P.slot.min), web: Math.max(P.web.k * t, P.web.min) });

/* Thicknesses a sheet material is sold in (mm) ; a metal sheet follows the gauges of the Shop. Usual series of the
   distributors — to confirm with the supplier actually used. */
const SERIES = {
  "NOMEX-410": [0.05, 0.08, 0.13, 0.18, 0.25, 0.3, 0.38, 0.51, 0.76], "PI-FILM": [0.025, 0.05, 0.075, 0.125], "PET-FILM": [0.05, 0.075, 0.1, 0.125, 0.19, 0.25, 0.35],
  FR4: [0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.6, 2.0, 2.4, 3.2], "FR4-CTI600": [0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.6, 2.0, 2.4, 3.2], PMMA: [2, 3, 4, 5, 6, 8, 10],
};
const PLASTIC_SHEET = [1, 1.5, 2, 3, 4, 5, 6, 8, 10];
/** Commercial thicknesses of a material sold as a sheet, thinnest first. */
export function sheetSeries(materialId) {
  const m = material(materialId);
  return SERIES[m ? m.id : materialId] || (m && m.cls !== "metal" ? PLASTIC_SHEET : SHEET_GAUGES);
}
/** The word for a flat stock of this material : a metal comes as a « tôle », a paper or a film as a « feuille », the rest as a « plaque ». */
export function sheetWord(materialId) { const m = material(materialId); return !m || m.cls === "metal" ? "Tôle" : m.cls === "sheet" ? "Feuille" : "Plaque"; }
/** Thickness a sheet takes when nothing asks for more : the usual one of the material (null : the interfaces decide). */
export function sheetDefault(materialId) { const m = material(materialId), s = sheetSeries(materialId); return !m || m.cls === "metal" ? null : m.cls === "pcb" ? 1.6 : m.cls === "sheet" ? s[Math.min(4, s.length - 1)] : null; }

/* ---------------------------------------------------------------------------------------- 3D printing, by process
   wall : thinnest wall that prints · wallRec : advised · hole : smallest hole · fillet : smallest radius that prints round ·
   gap : clearance per side between two printed parts · overhang : smallest self-supporting angle · bridge : longest
   unsupported span · hHole : largest horizontal hole printed round without support · escape : opening that lets powder or
   resin out of a cavity (escapes : how many) · ra : as-built roughness (µm) · build : build volume of a usual machine */
export const AM_PROCESSES = {
  fdm: { label: "Fused deposition modeling (FDM)", fr: "Dépôt de fil fondu (FDM)", short: "FDM", kind: "polymer", raw: "filament", wall: 1.0, wallRec: 1.5, hole: 1.5, fillet: 1.0, gap: 0.3, overhang: 45, bridge: 5, hHole: 6, escape: 0, escapes: 0, machined: false, ra: null, tol: "± 0,13 mm ou ± 0,15 % (machine industrielle)", build: [914, 610, 914],
    supports: true, powder: false, make: "Imprimer en FDM (orienter la plus grande face sur le plateau)", clean: "Retirer les supports",
    watch: ["La pièce est plus faible entre les couches (axe Z) : orienter pour que l'effort reste dans le plan des couches.", "Surplomb sous 45° ou pont de plus de 5 mm : supports, ou forme en goutte d'eau."],
    basis: "Surplomb, pont, tolérance, paroi porteuse (1,2 à 1,5 mm), trou rond au-dessus de 1 mm : lus dans deux guides de conception. Paroi, trou et jeu retenus ici : livre de règles de l'utilisateur, plus prudent. Volume : grande machine industrielle." },
  mjf: { label: "Polymer powder bed fusion (MJF / SLS)", fr: "Lit de poudre polymère (MJF / SLS)", short: "MJF", kind: "polymer", raw: "poudre", wall: 0.9, wallRec: 1.5, hole: 1.0, fillet: 0.5, gap: 0.2, overhang: 0, bridge: 0, hHole: 0, escape: 5, escapes: 2, machined: false, ra: null, tol: "± 0,3 % (± 0,3 mm au moins)", build: [380, 284, 380],
    supports: false, powder: true, make: "Imprimer en MJF / SLS", clean: "Dépoudrer et microbiller",
    watch: ["Une cavité se vide par deux ouvertures de 5 mm au moins, sur des faces opposées.", "Section massive : chaleur, retrait et coût de poudre — évider au-delà de 10 mm, paroi de 2 mm au moins."],
    basis: "Paroi (0,5 mm au minimum, 1,5 mm conseillé en MJF ; 0,8 mm en SLS), deux ouvertures de 5 mm, paroi évidée de 2 mm, tolérance : lus dans trois guides de conception. Paroi de 0,9 mm et trou de 1 mm : livre de règles de l'utilisateur." },
  sla: { label: "Vat photopolymerization (SLA)", fr: "Résine photopolymère (SLA)", short: "SLA", kind: "polymer", raw: "résine liquide", wall: 0.6, wallRec: 1.0, hole: 0.5, fillet: 0.5, gap: 0.2, overhang: 19, bridge: 1, hHole: 0, escape: 3.5, escapes: 1, machined: false, ra: null, tol: "± 0,2 % (± 0,2 mm au moins)", build: [145, 145, 185],
    supports: true, powder: false, make: "Imprimer en stéréolithographie (pièce inclinée sur ses supports)", clean: "Laver, retirer les supports",
    watch: ["Le plus fin détail et la plus belle surface. En général une résine standard vieillit à la lumière et flue sous charge : pas une pièce de structure durable.", "Une pièce creuse laisse couler la résine : ouverture de 3,5 mm au moins."],
    basis: "Paroi (0,4 mm tenue, 0,6 mm libre), trou de 0,5 mm, ouverture de 3,5 mm, surplomb à 19°, tolérance : lus dans un guide de conception et chez un fabricant de machines. Vieillissement : connaissance générale. Volume : machine de bureau courante, non vérifié." },
  lpbf: { label: "Laser powder bed fusion, metal (LPBF)", fr: "Fusion laser sur lit de poudre métallique (LPBF)", short: "LPBF", kind: "metal", raw: "poudre métallique", wall: 0.4, wallRec: 1.0, hole: 1.0, fillet: 0.5, gap: 0.3, overhang: 45, bridge: 2, hHole: 8, escape: 3, escapes: 2, machined: true, ra: [5, 10], tol: "± 0,1 à 0,2 mm", build: [250, 250, 300],
    supports: true, powder: true, make: "Fusionner sur lit de poudre, pièce orientée et supportée sur son plateau", clean: "Séparer du plateau (fil ou scie), retirer les supports",
    watch: ["Les supports sont du métal soudé à la pièce : chaque surplomb sous 45° du plateau se paie en reprise — dessiner des formes qui se portent seules.", "Brut de fusion, la surface est rugueuse (Ra 5 à 10 µm) et la cote tient au dixième : toute portée, tout ajustement, tout plan de joint se reprend en usinage, avec de la matière laissée pour cela.", "Un filetage se taraude en reprise."],
    basis: "Paroi (0,4 mm possible, risque sous 1 mm), surplomb à 45° (55° pour l'inox 316L), pont de 2 mm, trou horizontal de 8 à 10 mm, plus petit trou (0,4 à 1,5 mm), ouverture de 2 à 5 mm, tolérance, rugosité, détente sur le plateau : lus dans cinq guides de fabricants et de services. Surépaisseur d'usinage : aucune valeur publiée trouvée. Volume : machine courante de taille moyenne, non vérifié." },
};
export const AM_ORDER = ["lpbf", "mjf", "sla", "fdm"];

/* By material : the process it prints in, what it is chosen for, the standard that names it, the stress relief it takes
   BEFORE it leaves its plate (`relief`, metals), what it asks after (`post`, steps of the routing sheet), what the designer
   must know. `critical` : the step asked of a part that works in fatigue. `overhang` : when the material asks more than its process. */
export const AM_MATERIALS = {
  ALSI10MG: { process: "lpbf", use: "Boîtiers, supports et échangeurs légers : l'alliage d'aluminium courant en fusion laser.", std: "ASTM F3318",
    relief: "Détendre sur le plateau", post: ["Sabler ou microbiller"], critical: "traitement thermique de l'alliage, selon ce que le dessin demande (résistance ou allongement)",
    watch: ["Les propriétés changent avec le traitement : les donner à l'état livré, pas brut de fusion."] },
  "SS-316L": { process: "lpbf", use: "Pièces de fluide, corps de capteurs, pièces exposées à la corrosion.", std: "ASTM F3184", overhang: 55,
    relief: "Détendre sur le plateau", post: ["Passiver si la tenue à la corrosion est demandée"], critical: "compaction isostatique à chaud (CIC / HIP), aussi pour une pièce étanche",
    watch: ["Surplomb porté seul à partir de 55° du plateau seulement, au lieu de 45°."] },
  "SS-17-4PH": { process: "lpbf", use: "Pièces mécaniques dures et résistantes : outillages, leviers.", std: "—",
    relief: "Détendre sur le plateau", post: ["Mise en solution puis vieillissement, à l'état demandé au dessin"], critical: "compaction isostatique à chaud (CIC / HIP)",
    watch: ["Aucune norme de pièce imprimée lue ici pour cette nuance : exiger l'état de livraison et des éprouvettes fabriquées avec la pièce."] },
  "TI-6AL-4V": { process: "lpbf", use: "Aéronautique et médical : résistance élevée pour sa masse, tenue à la corrosion.", std: "ASTM F2924 ; ASTM F3001 pour la nuance ELI, à très bas interstitiels — le titane « très pur » des pièces critiques ; SAE AMS7028 (état compacté à chaud)",
    relief: "Détendre sur le plateau, sous vide ou sous gaz neutre", post: [], critical: "compaction isostatique à chaud (CIC / HIP) puis usinage des surfaces : c'est ce qui est recommandé pour la fatigue",
    watch: ["Poudre réactive : exiger le certificat du lot de poudre et son nombre de réutilisations.", "Parois de 1 mm au moins, 2 mm pour une paroi qui porte."] },
  IN718: { process: "lpbf", use: "Pièces chaudes : turbines, échappements, propulsion.", std: "ASTM F3055 (UNS N07718)",
    relief: "Détendre sur le plateau", post: ["Mise en solution puis vieillissement : c'est le traitement qui donne la résistance"], critical: "compaction isostatique à chaud (CIC / HIP), prévue par la norme",
    watch: ["Très dur à usiner : laisser le moins de reprise possible.", "Les calculs se font à l'état traité, pas brut de fusion."] },
  IN625: { process: "lpbf", use: "Corrosion et chaleur : conduits, collecteurs, pièces marines et chimiques.", std: "ASTM F3056 (UNS N06625) ; SAE AMS7000 (détendu, compacté à chaud, recuit de mise en solution)",
    relief: "Détendre sur le plateau", post: ["Recuit de mise en solution"], critical: "compaction isostatique à chaud (CIC / HIP), avant le recuit — c'est l'état de la spécification aéronautique",
    watch: ["Pas de vieillissement à prévoir."] },
  "PEI-9085": { process: "fdm", use: "Intérieurs d'avion, conduits, supports : matière donnée conforme aux essais de feu, de fumée et de toxicité des cabines.", std: "FAR 25.853 ; UL 94 V-0 à 1,5 et 3 mm (éprouvettes imprimées, valeurs typiques du fabricant de la matière)",
    relief: null, post: [], critical: null, watch: ["La tenue au feu vaut pour l'épaisseur testée et reste une valeur typique de la matière : la pièce se qualifie avec un procédé et une machine certifiés.", "Filament à sécher, chambre chauffée : imprimante industrielle seulement."] },
  PEKK: { process: "fdm", use: "Pièces de structure légères, tenue chimique et thermique au-dessus du PEI.", std: "—",
    relief: null, post: ["Recuire si la tenue en température est demandée"], critical: null, watch: ["Chambre à haute température : peu de machines.", "Valeurs de la bibliothèque non vérifiées pour cette matière : fiche du fournisseur obligatoire."] },
  ABS: { process: "fdm", use: "Maquettes, gabarits, boîtiers de prototype.", std: "—", relief: null, post: [], critical: null, watch: ["UL94 HB seulement."] },
  PC: { process: "fdm", use: "Pièces rigides et tenaces, gabarits d'atelier.", std: "—", relief: null, post: [], critical: null, watch: ["Filament à sécher."] },
  PA12: { process: "mjf", use: "Pièces fonctionnelles de petite série : clips, conduits, boîtiers.", std: "ISO/ASTM 52911-2 (conception)",
    relief: null, post: ["Teindre ou étancher si la pièce voit un fluide"], critical: null, watch: ["Le polyamide reprend l'humidité : coter et mesurer après conditionnement."] },
  PA11: { process: "mjf", use: "Comme le PA12, plus souple : charnières, clips.", std: "ISO/ASTM 52911-2 (conception)",
    relief: null, post: [], critical: null, watch: ["Mêmes règles de conception que le PA12 dans les guides : aucune limite propre au PA11 n'a été trouvée."] },
  "RESIN-SLA": { process: "sla", use: "Maquettes d'aspect, pièces à détails fins, maîtres-modèles.", std: "—",
    relief: null, post: ["Post-cuire aux UV : la pièce n'a ses propriétés qu'après"], critical: null, watch: ["Tenue en température basse : fiche de la résine obligatoire."] },
};
/** The side of a part that looks UP in the machine, and how to say it. */
export const BUILD_DIRS = { "+Z": [0, 0, 1], "-Z": [0, 0, -1], "+X": [1, 0, 0], "-X": [-1, 0, 0], "+Y": [0, 1, 0], "-Y": [0, -1, 0] };
export const DIR_WORDS = { "+Z": "dessus vers le haut (+Z)", "-Z": "retournée, dessous vers le haut (−Z)", "+X": "debout, côté droit vers le haut (+X)", "-X": "debout, côté gauche vers le haut (−X)", "+Y": "debout, arrière vers le haut (+Y)", "-Y": "debout, avant vers le haut (−Y)" };
/** The direction a part is printed in : the one it declares (spec.print.dir), else +Z. */
export const buildDir = (spec) => (spec && spec.print && BUILD_DIRS[spec.print.dir] ? spec.print.dir : "+Z");
/** How a material prints : { id, ...entry, proc (its process, with what the material overrides) } — null when it does not print. */
export function amMaterial(materialId) {
  const m = material(materialId), id = m ? m.id : String(materialId || "").toUpperCase(), e = AM_MATERIALS[id];
  return e ? { id, ...e, proc: { ...AM_PROCESSES[e.process], ...(e.overhang ? { overhang: e.overhang } : {}) } } : null;
}
/** The limits of a printing process for a material (the material may ask more than its process). */
export function amLimits(process, materialId) { const e = amMaterial(materialId); return e && e.process === process ? e.proc : AM_PROCESSES[process] || null; }
/** The printing process a material goes to in the Shop (null when it does not print). */
export function printProcess(materialId) {
  const m = material(materialId), e = amMaterial(materialId);
  if (e && (!m || m.processes.includes(e.process))) return e.process;
  return m ? AM_ORDER.find((k) => m.processes.includes(k)) || null : null;
}
/** Steps of the routing sheet of a printed part : the print, the stress relief, the cleaning, then what the material asks. */
export function printSteps(process, materialId) {
  const P = AM_PROCESSES[process], e = amMaterial(materialId);
  if (!P) return [];
  const mine = e && e.process === process ? e : null;
  return [P.make, mine && mine.relief ? mine.relief : P.kind === "metal" ? "Détendre sur le plateau" : null, P.clean, ...(mine ? mine.post : []), mine && mine.critical ? `Pièce en fatigue : ${mine.critical}` : null,
    P.machined ? "Usiner les surfaces fonctionnelles (portées, plans de joint, alésages)" : null].filter(Boolean);
}
/** The cutting line of the routing sheet of a laser-cut part. */
export function cutStep(materialId) { const P = laserProfile(materialId); return P ? P.cut : "Découper le contour au laser / jet d'eau"; }

const n = (v) => String(Math.round(v * 1000) / 1000).replace(".", ","), low = (x) => x.charAt(0).toLowerCase() + x.slice(1);
/** What a process asks of a material, in plain lines : for the card of the Shop and for the prompt handed to an AI.
    t (optional) : the thickness of the sheet, to give the smallest details in millimetres. Empty when the process is not a special one. */
export function processSheet(process, materialId, t) {
  const m = material(materialId), name = m ? m.name : materialId || "matière à définir";
  if (process === "laser_cut") {
    const P = laserProfile(materialId);
    if (!P) return [`${name} : aucune fiche de découpe laser dans la bibliothèque — demander à l'atelier la source laser, l'épaisseur maximale et l'état du bord.`];
    if (P.verdict === "forbidden") return [`${name} : jamais au laser — ${P.why}.`, `À la place : ${P.instead}.`];
    const lim = t > 0 ? laserLimits(P, t) : null;
    return [`${name} : ${P.source}${P.verdict === "caution" ? "" : ` ; gaz : ${P.gas}`}.`, ...(P.verdict === "caution" ? [`À éviter : ${P.why}. À la place : ${P.instead}.`] : []),
      `Épaisseur découpée : ${n(P.t[0])} à ${n(P.t[1])} mm ; trait de coupe ${n(P.kerf[0])} à ${n(P.kerf[1])} mm ; tolérance courante ± ${n(P.tol)} mm.`,
      lim ? `Dans ${n(t)} mm : trou ≥ Ø${n(Math.max(lim.hole, P.hole.k < 1 && P.hole.k > 0 ? t : 0))}${P.hole.k > 0 && P.hole.k < 1 ? ` (Ø${n(lim.hole)} possible au laser)` : ""}, fente ≥ ${n(lim.slot)} mm, pont de matière ≥ ${n(Math.max(lim.web, P.hole.k > 0 ? 2 * t : 0))} mm${P.corner ? `, angles rentrants R ≥ ${n(P.corner)} mm` : ""}.`
        : `Plus petit trou : ${P.hole.k ? `${n(P.hole.k)} × l'épaisseur, ` : ""}${n(P.hole.min)} mm au moins ; pont de matière : ${P.web.k ? `${n(P.web.k)} × l'épaisseur, ` : ""}${n(P.web.min)} mm au moins${P.corner ? ` ; angles rentrants R ≥ ${n(P.corner)} mm` : ""}.`,
      `Bord : ${P.edge}`, ...P.watch];
  }
  const A = amLimits(process, materialId), M = amMaterial(materialId);
  if (!A) return [];
  const mine = M && M.process === process ? M : null;
  return [`${name} : ${low(A.label)}, à partir de ${A.raw}.${mine ? ` ${mine.use}` : ""}`,
    `Paroi ≥ ${n(A.wall)} mm (${n(A.wallRec)} mm conseillé) ; trou ≥ Ø${n(A.hole)} ; jeu entre pièces ≥ ${n(A.gap)} mm par côté ; tolérance brute ${A.tol}${A.ra ? ` ; rugosité brute Ra ${A.ra[0]} à ${A.ra[1]} µm` : ""}.`,
    A.supports ? `Supports sous ${A.overhang}° du plateau${A.bridge ? `, portée libre ≤ ${n(A.bridge)} mm` : ""}${A.hHole ? `, trou horizontal rond ≤ Ø${n(A.hHole)}` : ""}.` : "Aucun support : la poudre porte la pièce.",
    ...(A.escape ? [`Cavité : ${A.escapes > 1 ? `${A.escapes} ouvertures` : "une ouverture"} ≥ Ø${n(A.escape)} pour vider la ${A.powder ? "poudre" : "résine"} ; aucune cavité fermée.`] : []),
    `Volume d'une machine courante : ${A.build.join(" × ")} mm.`,
    ...(mine ? [[mine.relief, ...mine.post].filter(Boolean).length ? `Après l'impression : ${[mine.relief, ...mine.post].filter(Boolean).map(low).join(" ; ")}.` : null, mine.critical ? `Pièce en fatigue : ${mine.critical}.` : null, mine.std && mine.std !== "—" ? `Référence : ${mine.std}.` : null].filter(Boolean) : []),
    ...A.watch, ...(mine ? mine.watch : [])];
}

/** The sheet of a whole process, by material, with the instruction that goes with it : what is copied for an AI from the
    screen of the special processes. kind : "laser" | "impression". */
export function processBrief(kind, materials) {
  const list = materials || [], head = kind === "laser"
    ? ["Voici ce que la DÉCOUPE LASER DE PRÉCISION demande à chaque matière en feuille, tel que la plateforme DesignWizard.ai l'applique (règles LAS-01 à LAS-06).",
      "Quand tu proposes ou modifies une pièce découpée (process « laser_cut »), respecte ces limites : matière et laser, épaisseur dans la série du commerce, plus petits trous, fentes et ponts, angles rentrants, état du bord. Dis ce que tu n'as pas pu respecter."]
    : ["Voici ce que l'IMPRESSION 3D demande à chaque matière, tel que la plateforme DesignWizard.ai l'applique (règles HSG- et AM-10 à AM-17).",
      "Quand tu proposes ou modifies une pièce imprimée (process « fdm », « mjf », « sla » ou « lpbf »), respecte ces limites : procédé de la matière, parois, trous, surplombs et supports, cavités ouvertes, surfaces reprises en usinage, chaîne après impression. Dis ce que tu n'as pas pu respecter."];
  const out = [...head, "Valeurs typiques de guides publiés : le fournisseur et la fiche de la matière font foi.", ""];
  for (const m of list) {
    const proc = kind === "laser" ? (laserProfile(m.id) ? "laser_cut" : null) : (AM_MATERIALS[m.id] ? AM_MATERIALS[m.id].process : null);
    if (!proc) continue;
    out.push(`## ${m.id} — ${m.name}${kind === "laser" ? "" : ` (process « ${proc} »)`}`, ...processSheet(proc, m.id).map((x) => `- ${x}`), "");
  }
  return out.join("\n");
}

/** The parts of a project made by a laser cut or a 3D print, for the report : [process, material, how, what it asks, what to check]. */
export function specialRows(parts) {
  const rows = [];
  for (const p of parts || []) {
    if (p.folded) { const m = material(p.material), v = (x) => (typeof x === "number" ? x : p.params && p.params[x] !== undefined ? (p.params[x].value ?? p.params[x]) : x), k = (p.folded.flanges || []).length;
      rows.push([p.id, p.name || "", "Sheet metal bending", m ? m.name : p.material || "—", "Laser puis presse plieuse", `${k} pli${k > 1 ? "s" : ""} à 90° · tôle ${n(v(p.folded.t))} mm · rayon intérieur ${n(v(p.folded.r ?? p.folded.t))} mm`, "Développé indicatif (facteur k typique) : l'atelier corrige le flan ; angle et hauteur des bords à contrôler"]); }
    else if (p.process === "laser_cut") { const P = laserProfile(p.material), m = material(p.material); if (!P) continue;
      rows.push([p.id, p.name || "", "Precision laser cutting", m ? m.name : p.material, P.verdict === "forbidden" ? "Jamais au laser" : P.source, P.verdict === "ok" ? `Épaisseur ≤ ${n(P.t[1])} mm · trait ${n(P.kerf[0])} à ${n(P.kerf[1])} mm · ± ${n(P.tol)} mm` : P.why, P.verdict === "ok" ? P.edge : `À la place : ${P.instead}`]); }
    else if (AM_PROCESSES[p.process]) { const A = amLimits(p.process, p.material), M = amMaterial(p.material), mine = M && M.process === p.process ? M : null, m = material(p.material);
      rows.push([p.id, p.name || "", A.label, m ? m.name : p.material || "—", mine && mine.std !== "—" ? mine.std : "—", `Paroi ≥ ${n(A.wall)} mm · trou ≥ Ø${n(A.hole)} · ${A.supports ? `supports sous ${A.overhang}°` : "sans support"} · ${A.tol}`,
        mine ? [mine.relief, ...mine.post, mine.critical ? `pièce en fatigue : ${mine.critical}` : null].filter(Boolean).map(low).join(" ; ") || "—" : "Matière hors de la bibliothèque du procédé : à confirmer avec le fournisseur"]); }
  }
  return rows;
}

/** True when a part is an insulating sheet cut by laser whose edge may be charred (laminate, aramid paper, film) : the
    isolation analysis then walks its cut edge for free, unless the designer says the edge counts. */
export function charredEdge(spec) { const P = spec && spec.process === "laser_cut" ? laserProfile(spec.material) : null; return !!P && P.verdict === "ok" && ["laminate", "aramid", "film"].includes(P.key); }

/* Where the figures come from. how : "lu" (the document itself was read), "page" (the page was read through an extraction),
   "résumé" (only a search summary : to read before relying on it). No link is opened by the application. */
export const SOURCES = [
  { id: "52900", by: "ISO / ASTM", title: "ISO/ASTM 52900:2021 — Additive manufacturing — General principles — Fundamentals and vocabulary", how: "page", gives: "Vocabulaire des procédés" },
  { id: "52911-1", by: "ISO / ASTM", title: "ISO/ASTM 52911-1:2019 — Additive manufacturing — Design — Part 1: Laser-based powder bed fusion of metals", how: "page", gives: "Titre et objet ; le texte de la norme n'a pas été lu" },
  { id: "52911-2", by: "ISO / ASTM", title: "ISO/ASTM 52911-2:2019 — Additive manufacturing — Design — Part 2: Laser-based powder bed fusion of polymers", how: "page", gives: "Titre et objet ; le texte de la norme n'a pas été lu" },
  { id: "F2924", by: "ASTM", title: "ASTM F2924-14(2021) — Additive Manufacturing Titanium-6 Aluminum-4 Vanadium with Powder Bed Fusion", how: "page", gives: "Titre et objet" },
  { id: "F3001", by: "ASTM", title: "ASTM F3001-14(2021) — Additive Manufacturing Titanium-6 Aluminum-4 Vanadium ELI (Extra Low Interstitial) with Powder Bed Fusion", how: "page", gives: "Titre et objet" },
  { id: "F3055", by: "ASTM", title: "ASTM F3055-14a(2021) — Additive Manufacturing Nickel Alloy (UNS N07718) with Powder Bed Fusion", how: "page", gives: "Titre ; la compaction isostatique à chaud figure parmi ses exigences" },
  { id: "F3056", by: "ASTM", title: "ASTM F3056-14(2021) — Additive Manufacturing Nickel Alloy (UNS N06625) with Powder Bed Fusion", how: "page", gives: "Titre et objet" },
  { id: "F3184", by: "ASTM", title: "ASTM F3184-16(2023) — Additive Manufacturing Stainless Steel Alloy (UNS S31603) with Powder Bed Fusion", how: "page", gives: "Titre et objet" },
  { id: "F3318", by: "ASTM", title: "ASTM F3318-18 — Additive Manufacturing – Finished Part Properties – Specification for AlSi10Mg with Powder Bed Fusion – Laser Beam", how: "page", gives: "Titre et objet" },
  { id: "AMS7003", by: "SAE", title: "AMS7003A — Laser Powder Bed Fusion Process", how: "page", gives: "Maîtrise du procédé pour les pièces aéronautiques" },
  { id: "AMS7000", by: "SAE", title: "AMS7000A — Laser-Powder Bed Fusion (L-PBF) Produced Parts, Nickel Alloy 625, Stress Relieved, Hot Isostatic Pressed and Solution Annealed", how: "page", gives: "Chaîne après fusion de l'alliage 625" },
  { id: "AMS7028", by: "SAE", title: "AMS7028 — Titanium Alloy, Ti-6Al-4V, Hot Isostatically Pressed, Produced by Laser Powder Bed Fusion", how: "page", gives: "État compacté à chaud du Ti-6Al-4V" },
  { id: "metal-guides", by: "Renishaw, Protolabs, Hubs, Xometry, Materialise", title: "Guides de conception pour l'impression 3D métal", how: "lu", gives: "Paroi, surplomb, pont, trous, ouvertures, tolérance, rugosité, détente sur le plateau, compaction pour l'aéronautique" },
  { id: "pliage-guides", by: "Ateliers de tôlerie en ligne et presse professionnelle", title: "Guides de conception de tôlerie pliée", how: "résumé", gives: "Bord plié d'au moins 4 × t (ou lié au vé) ; trou à 2 × t + R, 2,5 × t + R ou 3 × t + R d'un pli selon le guide" },
  { id: "pliage-k", by: "Presse professionnelle, fabricants de presses plieuses", title: "Longueur développée d'un pli et facteur k", how: "résumé", gives: "Pli développé = angle × (R + k × t) ; k de 0,44 comme valeur de départ en pliage en l'air ; vé de 6 à 12 × t" },
  { id: "polymer-guides", by: "Hubs, Xometry, Protolabs, Formlabs", title: "Guides de conception FDM, SLS, MJF et SLA", how: "page", gives: "Paroi, trous, ouvertures, surplomb, tolérance" },
  { id: "pei", by: "SABIC", title: "Fiche technique du filament ULTEM AM9085F", how: "lu", gives: "FAR 25.853, OSU 65/65, UL 94 V-0 à 1,5 et 3 mm sur éprouvettes imprimées — valeurs typiques" },
  { id: "laser-metal", by: "TRUMPF, Linde, TWI, Xometry", title: "Découpe laser des métaux : épaisseurs d'une machine de 6 kW, gaz d'assistance, métaux réfléchissants, guide de conception des tôles découpées", how: "lu", gives: "Épaisseur maximale, trait de coupe, bord sans oxyde à l'azote, plus petits détails, ponts, tolérance" },
  { id: "laser-pcb", by: "LPKF (publications présentées à l'IPC)", title: "Découpe laser des cartes : effets sur le matériau, qualité de coupe, tenue en tension du chant", how: "lu", gives: "Épaisseur jusqu'à 1,6 mm, absence d'effort, carbonisation, essais de résistance de surface et de claquage, trait de coupe dans le polyimide" },
  { id: "laser-plastic", by: "Trotec, Epilog, Xometry", title: "Matières plastiques au laser CO2 : celles qui se découpent, celles qui sont interdites", how: "lu", gives: "PVC et PTFE interdits, gaz du PVC, polycarbonate décoloré, liste des plastiques découpables" },
  { id: "laser-aramid", by: "Universal Laser Systems", title: "Découpe laser de l'aramide et d'un complexe papier aramide – polyester", how: "résumé", gives: "Laser CO2, bord peu décoloré — pages non lues" },
];
