/* DynamiteOrbit — two TEACHING EXAMPLES of moulded parts (point 14 of the plan agreed with JP : « une pièce plastique moulée par injection
   complexe — ribs, parting line, points d'injection (gates), dépouilles — et une pièce die cast haute pression… on doit voir le flux complet de
   la pièce : conception, gamme animée, puis le dessin 2D et les artéfacts destinés au fournisseur »).
   Each part is made to SHOW the rules of its process, by their principles — no model, drawing or brand copied :
   - the injection-moulded shell : one wall everywhere (2 mm), real draft on the walls (1°), ribs thinner than the wall (60 %) and drafted,
     screw bosses cored and drafted, standing off the walls, an edge gate on the parting line at the top rim, the visible face declared ;
   - the high-pressure die-cast bracket : walls of 4 mm, ribs and bosses drafted, holes cored by the die, an ingate on the parting line with
     its overflows opposite — then reworked : the seating face skimmed and the bosses tapped, as a die-cast part usually is.
   The numbers are examples of usual practice (registry : « dfx-mold », read as usage) ; the mould maker and the foundry have the last word.
   Pure : data only. */

const pad = (id, name, rect, h, start, draft) => ({ op: "pad", id, name, face: "+Z", rect, h, start, ...(draft ? { draft } : {}) });

export function moldedShell() {
  const L = 120, W = 60, H = 22, wall = 2, rib = 1.2;
  return { dw: "part/1", id: "EDU-IM-SHELL", name: "Coque injectée (exemple éducatif)", family: "enclosure", process: "injection_molding", material: "PC-ABS", revision: "A",
    function: "Montrer les règles de l'injection plastique : paroi unique, dépouilles, nervures, bossages, point d'injection, plan de joint.",
    finish: "Grain fin, côté visible dessous", elec: { kind: "insulator" },
    mold: { pull: "+Z", parting: "bord supérieur", wall, draft: 1, modelled: true, gating: { kind: "edge", side: "-Y" }, cosmetic: ["-Z"] },
    params: {}, interfaces: [],
    features: [
      { op: "tub", id: "coque", name: "Coque à paroi unique", size: [L, W, H], wall, rc: 6, rf: 3, draft: 1 },
      pad("nervure_long", "Nervure longitudinale", [20, W / 2 - rib / 2, 80, rib], 10, wall, 0.5),
      ...[40, 80].map((x, k) => pad(`nervure_trans_${k + 1}`, "Nervure transversale", [x - rib / 2, 8, rib, W - 16], 10, wall, 0.5)),
      { op: "boss", id: "bossages", name: "Bossages de vis", face: "+Z", at: [[12, 12], [L - 12, 12], [12, W - 12], [L - 12, W - 12]], d: 6, h: 14, start: wall, draft: 0.5, hole: { d: 2.2, depth: 6 } },
    ],
    notes: ["Paroi 2 mm partout ; nervures 1,2 mm (60 % de la paroi), dépouille 0,5° par face.", "Dépouille 1° sur les parois ; plan de joint au bord supérieur.", "Point d'injection en bord (edge gate) côté -Y, au plan de joint ; vestige coupé et ébavuré.", "Bossages pour vis autotaraudeuses pour plastique : trou noyé Ø 2,2 sur 6 mm (au plus 3 fois son diamètre), dépouille 0,5° ; rayon intérieur du fond 1 mm (la moitié de la paroi)."] };
}

export function dieCastBracket() {
  const t = 4;
  return { dw: "part/1", id: "EDU-HPDC-BRACKET", name: "Équerre injectée sous pression (exemple éducatif)", family: "prismatic", process: "die_casting", material: "AL-A380", revision: "A",
    function: "Montrer les règles de la fonderie sous pression : parois de 4 mm, nervures et bossages dépouillés, trous venus de fonderie, ingate et overflows, reprise d'usinage.",
    finish: "Brut de fonderie, plan d'appui surfacé", elec: { kind: "chassis" },
    mold: { pull: "+Z", parting: "plan du dessous", parting_level: 0, wall: t, draft: 1, modelled: true, gating: { kind: "ingate", side: "+X" }, cosmetic: [], machined: 1 },
    params: {}, interfaces: [],
    features: [
      { op: "box", id: "semelle", name: "Semelle", at: [0, 0, 0], size: [100, 70, t] },
      { op: "box", id: "flasque", name: "Flasque", at: [0, 0, 0], size: [t, 70, 50] },
      pad("nervure_1", "Nervure de renfort", [t, 12, 40, 3], 22, t, 1), pad("nervure_2", "Nervure de renfort", [t, 55, 40, 3], 22, t, 1),
      { op: "boss", id: "bossages", name: "Bossages de fixation", face: "+Z", at: [[75, 18], [75, 52]], d: 16, h: 12, start: t, draft: 1, hole: { d: 6.6, depth: 12 } },
      { op: "hole", id: "trous_flasque", name: "Trous venus de fonderie", face: "-X", at: [[20, 32], [50, 32]], d: 8.5, depth: t + 1, start: 0 },
      { op: "face", id: "surfacage", name: "Surfaçage du plan d'appui", face: "-Z", to: 0.5 },
      { op: "tap", id: "taraudages", name: "Taraudage des bossages", face: "+Z", at: [[75, 18], [75, 52]], thread: "M8", depth: 12, start: t + 12 },
    ],
    plan: { paths: JSON.parse(JSON.stringify(BRACKET_PATHS)) },
    notes: ["Parois 4 mm ; nervures et bossages dépouillés à 1°.", "Ingate au plan de joint côté +X, overflows du côté opposé ; détourés à la presse.", "Plan d'appui surfacé de 0,5 mm après fonderie ; bossages taraudés M8 sur 12 mm (1,5 fois le diamètre dans l'aluminium).", "Trous du flasque venus de fonderie, brut : perpendiculaires au démoulage, ils demandent un tiroir (slide)."] };
}

/* The tool paths of the two reworks of the bracket, as an AI wrote them for the shop (core/fab_path.js reads and checks them) : an intention, not
   a machine program. The frame is the part's, in mm ; the as-cast seating face is at Z 0, skimmed to Z 0.5. */
const BY = "Claude (IA) — exemple de démonstration", g = (...l) => l.join("\n");
export const BRACKET_PATHS = {
  "setup:-Z": [{ tool: "facemill", d: 50, by: BY, note: "Surfaçage du plan d'appui en deux passes de 0,5 mm, recouvrement de 15 mm : il emporte aussi la ligne du plan de joint et sa bavure. La pièce tenue sur ses faces brutes, loin des traces d'éjection.",
    gcode: g("(EDU-HPDC-BRACKET, phase setup:-Z — repère de la pièce, mm ; l'outil vient par le dessous)", "G21 G90", "G0 X-35 Y17.5 Z-20", "G0 Z0.5", "G1 X135", "G0 Z-20", "G0 X-35 Y52.5", "G0 Z0.5", "G1 X135", "G0 Z-20") }],
  "setup:+Z": [
    { tool: "drill", d: 6.8, by: BY, note: "Avant-trous M8 dans les trous venus de fonderie (Ø6,6) : la pointe s'arrête à Z 3,5, 3 mm au-dessus du plan surfacé. Plan de retrait à Z 52, au-dessus du flasque : l'atelier le baissera à Z 18, 2 mm au-dessus des bossages, loin du flasque.",
      gcode: g("(EDU-HPDC-BRACKET, phase setup:+Z — appui sur le plan surfacé)", "G21 G90", "G0 X75 Y18 Z55", "G83 X75 Y18 Z3.5 R52 Q3", "Y52", "G80", "G0 Z55") },
    { tool: "tap", d: 8, by: BY, note: "Taraudage M8 sur 12 mm utiles (1,5 fois le diamètre dans l'aluminium) : la porosité de fonderie sous les bossages est la question à poser au fondeur.",
      gcode: g("G21 G90", "G0 X75 Y18 Z55", "G84 X75 Y18 Z4 R52", "Y52", "G80", "G0 Z55") }],
};

export const WORDS_MOLDED = {
  "Coque injectée (exemple éducatif)": "Injection-moulded shell (teaching example)", "Équerre injectée sous pression (exemple éducatif)": "High-pressure die-cast bracket (teaching example)",
  "Grain fin, côté visible dessous": "Fine texture, visible side underneath", "Brut de fonderie, plan d'appui surfacé": "As cast, seating face skimmed",
  "Paroi 2 mm partout ; nervures 1,2 mm (60 % de la paroi), dépouille 0,5° par face.": "Wall 2 mm throughout; ribs 1.2 mm (60 % of the wall), 0.5° draft per side.",
  "Dépouille 1° sur les parois ; plan de joint au bord supérieur.": "1° draft on the walls; parting line at the top rim.",
  "Point d'injection en bord (edge gate) côté -Y, au plan de joint ; vestige coupé et ébavuré.": "Edge gate on the -Y side, at the parting line; vestige cut and deburred.",
  "Bossages pour vis autotaraudeuses pour plastique : trou noyé Ø 2,2 sur 6 mm (au plus 3 fois son diamètre), dépouille 0,5° ; rayon intérieur du fond 1 mm (la moitié de la paroi).": "Bosses for thread-forming screws for plastics: cored hole Ø 2.2 over 6 mm (at most 3 times its diameter), 0.5° draft; inside floor radius 1 mm (half the wall).",
  "Parois 4 mm ; nervures et bossages dépouillés à 1°.": "Walls 4 mm; ribs and bosses drafted at 1°.", "Ingate au plan de joint côté +X, overflows du côté opposé ; détourés à la presse.": "Ingate at the parting line on the +X side, overflows opposite; trimmed in the press.",
  "Plan d'appui surfacé de 0,5 mm après fonderie ; bossages taraudés M8 sur 12 mm (1,5 fois le diamètre dans l'aluminium).": "Seating face skimmed 0.5 mm after casting; bosses tapped M8 over 12 mm (1.5 times the diameter in aluminium).", "Trous du flasque venus de fonderie, brut : perpendiculaires au démoulage, ils demandent un tiroir (slide).": "Flange holes cored by the die, as cast: across the pull, they need a slide.",
  "Pièces moulées — deux exemples": "Moulded parts — two examples",
};
/** The project : the two parts, the English of their drawings. */
export function moldedProject() {
  return { dw: "project/1", id: "EDU-MOLDED", name: "Pièces moulées — deux exemples", description: "Deux exemples éducatifs : une coque injectée en plastique et une équerre en aluminium injecté sous pression, chacune faite pour montrer les règles de son procédé — puis sa gamme jouée dans l'atelier, son dessin et ce qui part au fournisseur.",
    parts: [moldedShell(), dieCastBracket()], assemblies: [], boards: [], drawing: { words: WORDS_MOLDED }, log: [] };
}
