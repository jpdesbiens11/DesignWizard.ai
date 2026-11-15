/* DesignWizard.ai — the Shop companion for a MOULDED part. The designer says what the part holds (the volume to
   contain, the things fixed inside), what it meets outside (cover, fixings, openings) and the material ; the part
   then draws itself with the moulder's rules of thumb : one nominal wall chosen for the material and the flow
   length, radii that keep it uniform round the corners, bosses detached from the walls and tied by gussets, low
   ribs under a wide floor, inserts in plastic and threads cut after casting in metal, the draft and the parting
   line declared for the toolmaker. Plastic goes to injection moulding, metal to die or gravity casting — each
   with its own figures. Every decision is written down. The toolmaker's advice prevails. */

import { INTERFACE_TYPES, patternPoints } from "../cad/interfaces.js";
import { thread } from "../cad/standards.js";
import { material } from "../cad/materials.js";

const r1 = (x) => Math.round(x * 10) / 10, half = (x) => Math.ceil(x * 2 - 1e-9) / 2, fr = (x) => String(r1(x)).replace(".", ",");
const P = (value, min, max, label, group = "Enveloppe", step = 0.5) => ({ value, min: r1(min), max: r1(max), step, unit: "mm", label, group });

/** The moulder's figures, by process. wall = [min, max] when the material gives none ; flow = flow length over wall ;
    inner = inside radius over wall ; rib = rib thickness over wall ; ribH = rib height over wall ; boss = boss
    diameter over its hole ; draft = degrees outside / inside ; skim = stock left on machined faces. */
export const MOLD_RULES = {
  injection_molding: { fr: "moulage par injection", wall: [1.0, 4.0], nominal: 2.5, flow: 150, inner: 0.5, rib: 0.55, ribH: 3, boss: 2.0, draft: [1, 1], skim: 0, thread: "insert",
    notes: ["Dépouille 1° sur toutes les parois parallèles au démoulage (2° sur une face grainée)", "Tolérances générales des pièces plastiques moulées ISO 20457", "Seuil d'injection et éjecteurs hors des faces d'aspect ; plan de joint au bord supérieur"] },
  die_casting: { fr: "fonderie sous pression", wall: [1.5, 4.5], nominal: 2.5, flow: 110, inner: 0.6, rib: 0.8, ribH: 4, boss: 2.5, draft: [1, 2], skim: 0.5, thread: "tapped",
    notes: ["Dépouille 1° à l'extérieur, 2° sur les noyaux", "Taraudages, alésages et plans d'appui repris en usinage (surépaisseur 0,5 mm)", "Tolérances générales des pièces de fonderie ISO 8062-3 ; porosité à contrôler dans les zones taraudées"] },
  sand_casting: { fr: "fonderie par gravité", wall: [4.0, 12.0], nominal: 5, flow: 60, inner: 0.75, rib: 0.8, ribH: 4, boss: 2.5, draft: [2, 3], skim: 2.5, thread: "tapped",
    notes: ["Dépouille 2° à l'extérieur, 3° sur les noyaux", "Taraudages, alésages et plans d'appui repris en usinage (surépaisseur 2,5 mm)", "Tolérances générales des pièces de fonderie ISO 8062-3"] },
};
/** The moulding process a material goes to. */
export function moldProcess(matId) {
  const m = material(matId), own = m ? ["injection_molding", "die_casting", "sand_casting"].find((p) => m.processes.includes(p)) : null;
  return own || (m && m.cls === "metal" ? "die_casting" : "injection_molding");
}

/** Writes the moulded part. items = prepared interfaces (shop_intent.prepare) with fp, where, inside. → the core of a spec. */
export function molded(brief, items, log) {
  const proc = brief.process && MOLD_RULES[brief.process] ? brief.process : moldProcess(brief.material), R = MOLD_RULES[proc], mat = material(brief.material) || { name: brief.material }, lim = mat.wall || R.wall, env = brief.envelope || {}, metal = R.thread === "tapped";
  const inside = items.filter((it) => it.inside), rim = items.filter((it) => !it.inside && it.where === "+Z"), under = items.filter((it) => !it.inside && it.where === "-Z"), sides = items.filter((it) => !it.inside && it.where[1] !== "Z");
  const boards = inside.filter((it) => it.type === "bolt_pattern"), so = boards.length ? r1(brief.standoff || 6) : 0;
  /* the cavity : what the designer asks to contain, and at least what the inside interfaces span */
  const span = (list, k) => Math.max(0, ...list.map((it) => it.fp[k] + 2 * Math.max(it.fp.edge, 4)));
  const Lin = Math.max(env.L || 0, span(inside, "w"), span(under, "w"), 30), Win = Math.max(env.W || 0, span(inside, "h"), span(under, "h"), 20), Hin = Math.max(env.H || 0, so + (boards.length ? 12 : 0), ...sides.map((it) => it.fp.h + 2 * 4 + so), 10);
  /* one nominal wall : the usual figure for the material, thicker when the melt has far to go, inside the range of the material */
  const flow = (Lin + Win) / 2 + Hin, usual = Math.min(R.nominal, half((lim[0] + lim[1]) / 2)), wall = Math.min(lim[1], Math.max(lim[0], half(Math.max(usual, flow / R.flow))));
  log.push(`Procédé : ${R.fr} — ${mat.name} se moule entre ${fr(lim[0])} et ${fr(lim[1])} mm de paroi.`);
  log.push(`Paroi nominale ${fr(wall)} mm, la même partout : ${flow / R.flow > usual ? `la matière parcourt environ ${fr(flow)} mm depuis le seuil, soit ${Math.round(flow / wall)} fois la paroi (limite ${R.flow})` : `valeur usuelle pour cette matière ; longueur d'écoulement ${fr(flow)} mm, soit ${Math.round(flow / wall)} fois la paroi (limite ${R.flow})`}.`);
  const L = half(Lin + 2 * wall), W = half(Win + 2 * wall), H = half(Hin + wall), rc = half(Math.max((1 + R.inner) * wall, 3)), rf = half((1 + R.inner) * wall);
  log.push(`Volume à contenir ${fr(Lin)} × ${fr(Win)} × ${fr(Hin)} mm → extérieur ${fr(L)} × ${fr(W)} × ${fr(H)} mm, ouvert sur le dessus (sens de démoulage +Z, plan de joint au bord).`);
  log.push(`Rayons : ${fr(rc)} mm aux angles verticaux et ${fr(rf)} mm au fond, faits avant d'évider — il reste ${fr(rc - wall)} et ${fr(rf - wall)} mm à l'intérieur (règle : rayon intérieur ≥ ${fr(R.inner)} × paroi), et la paroi garde son épaisseur dans les angles.`);
  const features = [{ op: "box", id: "corps", name: "Volume extérieur", size: ["L", "W", "H"] }, { op: "fillet", id: "angles", name: "Rayons des angles", r: "rc", edges: "vertical" }, { op: "fillet", id: "fond", name: "Rayon du fond", r: "rf", edges: { face: "-Z" } },
    { op: "shell", id: "coque", name: "Coque", t: "wall", open: ["+Z"] }], out = [], params = { L: P(L, 20, Math.max(400, 2 * L), "Longueur extérieure", "Enveloppe", 1), W: P(W, 15, Math.max(300, 2 * W), "Largeur extérieure", "Enveloppe", 1), H: P(H, 8, Math.max(200, 2 * H), "Hauteur extérieure", "Enveloppe", 1),
    wall: P(wall, lim[0], lim[1], "Paroi nominale", "Moulage", 0.1), rc: P(rc, r1((1 + R.inner) * lim[0]), 25, "Rayon des angles verticaux", "Moulage"), rf: P(rf, r1((1 + R.inner) * lim[0]), 25, "Rayon du fond", "Moulage") };
  const ifo = (it, face, at, extra = {}) => { const o = { id: it.id, type: it.type, name: it.name, key: it.key, partner: it.partner, side: it.side, face, at, params: it.params, opts: it.opts, ...extra }; for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k]; return o; };
  const bossOf = (screw) => { const th = thread(screw), hole = metal ? th.tap : th.insert[0]; return half(metal ? R.boss * hole : Math.max(R.boss * hole, hole + 2 * 0.8 * wall)); };
  const keep = [];                                             // what already stands on the floor : { x, y, r } — nothing else may land there
  const hold = (screw) => (metal ? { depth: r1(Math.max(2 * thread(screw).d, 6)) } : { thread: "insert" });
  /* what is fixed inside : on columns rising from the floor, an insert (plastic) or a thread cut after casting (metal) in each */
  if (boards.length) params.so = P(so, 3, 25, "Hauteur des colonnettes", "Moulage");
  let x = -(boards.reduce((s, it) => s + it.fp.w, 0) + 6 * (boards.length - 1)) / 2;
  for (const it of inside) {
    const board = it.type === "bolt_pattern", du = board && boards.length > 1 ? r1(x + it.fp.w / 2) : 0; if (board) x += it.fp.w + 6;
    const d = board ? bossOf(it.params.screw) : 0, at = [du ? `L/2 ${du > 0 ? "+" : "-"} ${Math.abs(du)}` : "L/2", "W/2"];
    if (board) for (const [px, py] of patternPoints(it.params.pattern)) keep.push({ x: L / 2 + du + px, y: W / 2 + py, r: d / 2 });
    out.push(ifo(it, "+Z", at, board ? { side: "B", level: "wall + so", opts: { ...(it.opts || {}), ...hold(it.params.screw), standoff: { h: "so", d } } } : { level: "wall" }));
    if (board) log.push(`« ${it.name} » : ${patternPoints(it.params.pattern).length} colonnettes Ø ${fr(d)} mm, hautes de ${fr(so)} mm, ${metal ? `taraudées ${it.params.screw} après coulée` : `avec insert ${it.params.screw}`} (règle : bossage ≥ ${fr(R.boss)} × son trou).`);
  }
  for (const it of under) if (it.type === "bolt_pattern") for (const [px, py] of patternPoints(it.params.pattern)) for (const sx of [1, -1]) keep.push({ x: L / 2 + sx * px, y: W / 2 + py, r: thread(it.params.screw).d / 2 + 0.5 });
  /* what closes it : screws in bosses standing clear of the walls and tied to them by gussets, and the joint plane on the rim */
  let cover = rim.find((it) => it.type === "bolt_pattern");
  if (!cover && brief.cover !== false) { cover = { id: `IF${items.length + 1}`, type: "bolt_pattern", name: "Fixation du couvercle", key: `${String(brief.name || "piece").toLowerCase().replace(/[^a-z0-9]+/g, "_")}_couvercle`, side: "B", where: "+Z", params: { ...INTERFACE_TYPES.bolt_pattern.params, screw: "M3" }, auto: true };
    log.push("Aucune fermeture déclarée : quatre vis M3 aux coins et un plan de joint sont proposés pour un couvercle (retirez-les s'il n'y en a pas)."); }
  if (cover) {
    const th = thread(cover.params.screw), slim = bossOf(cover.params.screw), d = Math.max(slim, half((H - wall) / 3)), gap = Math.max(wall, 1.5), c = r1(wall + gap + d / 2), rib = r1(Math.max(0.8, R.rib * wall)), gh = "(H - wall) * 0.7";
    /* in the corners — unless a column of the inside already stands there : then the bosses slide along the long walls */
    const alongL = L >= W, clash = (bx, by) => keep.some((k) => [[bx, by], [L - bx, by], [bx, W - by], [L - bx, W - by]].some(([x, y]) => Math.hypot(k.x - x, k.y - y) < k.r + d / 2 + gap));
    let bx = c, by = c;
    while (clash(bx, by) && (alongL ? bx < L / 2 - d : by < W / 2 - d)) { if (alongL) bx = r1(bx + 0.5); else by = r1(by + 0.5); }
    if (clash(bx, by)) { bx = by = c; log.push("Attention : les colonnettes de l'intérieur touchent les bossages de fermeture — agrandir le volume à contenir ou resserrer le motif de fixation."); }
    else if (bx !== c || by !== c) log.push(`Bossages de fermeture glissés à ${fr(alongL ? bx : by)} mm des coins, le long des grands côtés : une colonnette de l'intérieur occupe déjà le coin, et deux fûts qui se touchent font une masse et une lame d'acier trop mince dans le moule.`);
    params.bd = P(d, r1(R.boss * 2), 20, "Diamètre des bossages de fermeture", "Moulage");
    const grid = { origin: [bx, by], nx: 2, ny: 2, dx: `L - ${r1(2 * bx)}`, dy: `W - ${r1(2 * by)}` };
    cover.params.pattern = { type: "rect", nx: 2, ny: 2, dx: grid.dx, dy: grid.dy };
    features.push({ op: "boss", id: "bossages", name: "Bossages de fermeture", face: "+Z", start: "wall", d: "bd", h: "H - wall", at: { grid } });
    for (let k = 0; k < 4; k++) { const right = k % 2, top = k > 1;                                      // a gusset to each wall the boss stands near
      if (by === c) features.push({ op: "pad", id: `gy${k + 1}`, name: "Gousset", face: "+Z", start: "wall", rect: [right ? `L - ${r1(bx + rib / 2)}` : r1(bx - rib / 2), top ? `W - ${by}` : "wall", rib, r1(by - wall)], h: gh });
      if (bx === c) features.push({ op: "pad", id: `gx${k + 1}`, name: "Gousset", face: "+Z", start: "wall", rect: [right ? `L - ${bx}` : "wall", top ? `W - ${r1(by + rib / 2)}` : r1(by - rib / 2), r1(bx - wall), rib], h: gh }); }
    for (const [x, y] of [[bx, by], [L - bx, by], [bx, W - by], [L - bx, W - by]]) keep.push({ x, y, r: d / 2 });
    /* no mass in a boss : its hole goes as deep as a core pin can (3 × Ø), and a second pin cores it from underneath */
    const top = metal ? th.tap : th.insert[0], dt = metal ? r1(Math.max(2 * th.d, 6)) : r1(Math.max(th.insert[1] + 1.5, Math.min(3 * top, H - wall))), pin = Math.floor((d - 2 * 0.8 * wall) * 2) / 2, db = pin >= (proc === "sand_casting" ? 6 : 3) ? r1(Math.min(3 * pin, H - dt - wall)) : 0, left = r1(H - wall - dt - db);
    if (db >= 2) features.push({ op: "hole", id: "evid", name: "Évidement sous les bossages", face: "-Z", d: pin, depth: db, at: { grid } });
    out.push(ifo(cover, "+Z", ["L/2", "W/2"], { side: "B", opts: { ...(cover.opts || {}), ...(metal ? { depth: dt } : { thread: "insert", depth: dt }) } }));
    if (d > slim) log.push(`Bossages de fermeture portés de Ø ${fr(slim)} à Ø ${fr(d)} mm : hauts de ${fr(H - wall)} mm, ils ne doivent pas dépasser 3 fois leur diamètre.`);
    log.push(`Fermeture : 4 bossages Ø ${fr(d)} mm détachés des parois de ${fr(gap)} mm et reliés par des goussets de ${fr(rib)} mm — un bossage noyé dans l'angle ferait une masse, donc une retassure.`);
    log.push(db >= 2 ? `Bossages noyautés des deux côtés : ${metal ? `le taraudage ${cover.params.screw} descend de ${fr(dt)} mm` : `le trou d'insert descend de ${fr(dt)} mm (3 × Ø au plus pour une broche)`}, et un évidement Ø ${fr(pin)} × ${fr(db)} mm monte du dessous${left > 0.05 ? ` ; il reste ${fr(left + wall)} mm pleins entre les deux` : ` ; il ne reste qu'un voile de ${fr(wall)} mm`}. Les évidements se voient sous le fond.`
      : `Bossages pleins sous leur trou (${fr(H - wall - dt)} mm) : trop minces pour être évidés par dessous — une masse locale, à accepter ou à porter sur le couvercle.`);
    if (!rim.some((it) => it.type === "planar")) out.push({ id: `IF${items.length + (cover.auto ? 2 : 1)}`, type: "planar", name: "Plan de joint", key: `${cover.key}_joint`, side: "B", face: "+Z", at: ["L/2", "W/2"], params: { w: "L", h: "W" } });
  }
  for (const it of rim) if (it !== cover) out.push(ifo(it, "+Z", ["L/2", "W/2"], it.type === "planar" ? { params: { ...it.params, w: "L", h: "W" } } : {}));
  /* a wide floor is stiffened by low ribs rather than by a thicker wall */
  const wide = Math.max(Lin, Win), nRib = wide > 100 ? Math.min(4, Math.ceil(wide / 80) - 1) : 0, rt = r1(Math.max(0.8, R.rib * wall)), rh = r1(Math.min(R.ribH * wall, so ? so - 1.5 : R.ribH * wall));
  if (nRib && rh >= 1.5) { const alongX = Lin >= Win, span = alongX ? L : W, free = (q) => !keep.some((k) => Math.abs((alongX ? k.x : k.y) - q) < k.r + rt / 2 + 1); let made = 0;
    for (let k = 1; k <= nRib; k++) { const frac = r1(k / (nRib + 1)), room = span / (nRib + 1) / 2 - 1; let off = null;                 // a rib steps aside for a column or a hole, or is left out
      for (let u = 0; u <= room && off === null; u++) off = free(span * frac + u) ? u : free(span * frac - u) ? -u : null;
      if (off === null) continue; made++;
      const pos = `${alongX ? "L" : "W"} * ${frac}${off ? ` ${off > 0 ? "+" : "-"} ${Math.abs(off)}` : ""} - ${r1(rt / 2)}`; features.push({ op: "pad", id: `n${k}`, name: "Nervure du fond", face: "+Z", start: "wall", rect: alongX ? [pos, "wall", rt, "W - 2*wall"] : ["wall", pos, "L - 2*wall", rt], h: rh }); }
    if (made) log.push(`Fond de ${fr(wide)} mm : ${made} nervure(s) de ${fr(rt)} mm (${Math.round(100 * rt / wall)} % de la paroi) hautes de ${fr(rh)} mm le raidissent sans l'épaissir${made < nRib ? " ; une nervure qui aurait croisé une colonnette est laissée de côté" : ""}.`); }
  /* outside : fixings under the floor, openings and fixings in the side walls */
  for (const it of under) out.push(ifo(it, "-Z", ["L/2", "W/2"], it.type === "bolt_pattern" ? { opts: { ...(it.opts || {}), ...(it.side === "B" ? hold(it.params.screw) : { depth: "wall + 0.5" }) } } : {}));
  const zc = so ? `wall + so + 1.6 + ${r1(4)}` : "H/2";
  let slides = 0;
  for (const face of ["-Y", "+Y", "-X", "+X"]) { const on = sides.filter((it) => it.where === face), tot = on.reduce((s, it) => s + it.fp.w, 0) + 8 * (on.length - 1); let u = -tot / 2;
    for (const it of on) { const du = r1(u + it.fp.w / 2); u += it.fp.w + 8; slides++;
      out.push(ifo(it, face, [du ? `${face[1] === "Y" ? "L" : "W"}/2 ${du > 0 ? "+" : "-"} ${Math.abs(du)}` : `${face[1] === "Y" ? "L" : "W"}/2`, it.type === "cutout" ? `wall + ${so ? "so + 1.6 + " : ""}${r1((it.params.h || it.params.d || 8) / 2 + (so ? 0 : 4))}` : zc], it.type === "cutout" ? { opts: { ...(it.opts || {}), depth: "wall + 0.5" } } : {})); } }
  if (slides) log.push(`${slides} ouverture(s) ou fixation(s) dans les parois latérales : chacune demande un tiroir dans le moule. L'ouvrir jusqu'au plan de joint, ou la porter par le couvercle, le supprime.`);
  features.push({ op: "interfaces" });
  log.push(`Dépouille ${fr(R.draft[0])}° à l'extérieur et ${fr(R.draft[1])}° à l'intérieur, déclarée pour le mouliste (le modèle reste droit) : sur ${fr(H)} mm de haut, ${fr(H * Math.tan(R.draft[1] * Math.PI / 180))} mm par face.`);
  if (metal) log.push(`Métal coulé : aucun filetage ne vient de fonderie — taraudages et plans d'appui sont repris en usinage, avec ${fr(R.skim)} mm de surépaisseur.`);
  return { family: "enclosure", process: proc, params, stock: { form: "molded" }, features, interfaces: out, notes: R.notes,
    mold: { process: proc, pull: "+Z", parting: "bord supérieur", wall, draft: R.draft[0], draft_inside: R.draft[1], slides, machined: metal ? R.skim : 0, gate: metal ? "attaque de coulée sur un petit côté, évents à l'opposé" : "seuil au centre du fond, côté intérieur", ejection: "éjecteurs sur les bossages, les nervures et le pourtour du fond" } };
}
