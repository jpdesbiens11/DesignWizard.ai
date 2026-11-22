/* DynamiteOrbit — tool paths of the demonstrations, for the fabrication shop (JP, 21 novembre 2026 : « simuler un parcours d'usinage avec
   les allers-retours IA pour les pièces d'intérêt pour animer l'usinage »). Written by an AI (Claude) as an answer to the request the shop
   prepares — the phase, its holes, the frame, the format — and read by the tool like any other answer (core/fab_path.js : the G-code
   subset, the checks against the part). Three parts of interest : a profile extruded then machined (drilled and tapped from below), a
   disc drilled and tapped through, a tube turned and bored on a lathe. An intention for the shop, not a machine program : no speeds, no
   feeds that count, no cutter compensation. Each path says what the shop should discuss. */

const BY = "Claude (IA) — exemple de démonstration";
const g = (...lines) => lines.join("\n");

export const DEMO_PATHS = {
  "DRV-HEATSINK": { "setup:-Z": [
    { tool: "center", d: 6, by: BY, note: "Pointage des 4 trous, 90°.", gcode: g("(DRV-HEATSINK, phase setup:-Z — repère de la pièce, mm ; l'outil vient par la face -Z, le dessous de la semelle)", "G21 G90", "G0 X10 Y10 Z-30", "G81 X10 Y10 Z1 R-2", "X70 Y10", "X70 Y76", "X10 Y76", "G80", "G0 Z-30") },
    { tool: "drill", d: 3.3, by: BY, note: "Avant-trous M4, borgnes : la pointe s'arrête à 6 mm, 1 mm sous le dos de la semelle (7 mm).", gcode: g("G21 G90", "G0 X10 Y10 Z-30", "G83 X10 Y10 Z6 R-2 Q2", "X70 Y10", "X70 Y76", "X10 Y76", "G80", "G0 Z-30") },
    { tool: "tap", d: 4, by: BY, note: "Taraudage M4 sur 4 mm utiles seulement : un taraud ne descend pas jusqu'au fond d'un trou borgne. Dans l'aluminium, l'usage courant demande plutôt 1,5 à 2 fois le diamètre de filet — à discuter avec l'atelier (filets rapportés, ou semelle plus épaisse sous les trous).", gcode: g("G21 G90", "G0 X10 Y10 Z-30", "G84 X10 Y10 Z4 R-3", "X70 Y10", "X70 Y76", "X10 Y76", "G80", "G0 Z-30") }] },
  "FUS-5010": { "setup:+Z": [
    { tool: "center", d: 6, by: BY, note: "Pointage des 3 trous.", gcode: g("(FUS-5010, phase setup:+Z — repère de la pièce, mm ; la face de dessus est à Z6)", "G21 G90", "G0 X-92.6 Y0 Z30", "G81 X-92.6 Y0 Z5.2 R8", "X-55", "X55", "G80", "G0 Z30") },
    { tool: "drill", d: 5, by: BY, note: "Passe-fil Ø5 débouchant : la pointe sort de 1,8 mm sous la pièce — une cale martyre dessous, ou les cales parallèles écartées de l'axe Y = 0.", gcode: g("G21 G90", "G0 X-92.6 Y0 Z30", "G83 X-92.6 Y0 Z-1.8 R8 Q2", "G80", "G0 Z30") },
    { tool: "drill", d: 3.3, by: BY, note: "Avant-trous M4 débouchants (la pièce fait 6 mm).", gcode: g("G21 G90", "G0 X-55 Y0 Z30", "G83 X-55 Y0 Z-1.5 R8 Q2", "X55", "G80", "G0 Z30") },
    { tool: "tap", d: 4, by: BY, note: "Taraudage M4 débouchant : 6 mm de filet, soit 1,5 fois le diamètre.", gcode: g("G21 G90", "G0 X-55 Y0 Z30", "G84 X-55 Y0 Z-1 R8", "X55", "G80", "G0 Z30") }] },
  "FUS-1030": { "setup:free": [
    { tool: "turning", d: 12, by: BY, note: "Dressage du bout libre, puis chariotage de finition du Ø203,2 jusqu'à 30 mm du mandrin. Tube à paroi de 3,2 mm : mors doux, serrage modéré — sinon le tube sort ovale.", gcode: g("(FUS-1030, tour — repère de la pièce : l'axe est Z ; le bout de l'outil sur le rayon, côté +Y)", "G21 G90", "G0 X0 Y110 Z195", "G0 Y104 Z187", "G1 Y97.4", "G0 Z192", "G0 Y101.6 Z190", "G1 Z30", "G0 Y110", "G0 Z195") },
    { tool: "boring", d: 10, by: BY, note: "Alésage de finition Ø196,8 sur la même longueur : la barre entre par le bout libre.", gcode: g("G21 G90", "G0 X0 Y95 Z195", "G0 Y98.4 Z190", "G1 Z30", "G0 Y95", "G0 Z195") }] },
};
/** The demo parts with their paths : plan.paths added, what the plan already holds kept. */
export function withPaths(parts) {
  for (const p of parts || []) if (DEMO_PATHS[p.id]) p.plan = { ...(p.plan || {}), paths: JSON.parse(JSON.stringify(DEMO_PATHS[p.id])) };
  return parts;
}
