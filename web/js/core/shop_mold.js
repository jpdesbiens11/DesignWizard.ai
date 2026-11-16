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
import { moldArch, moldedCover, moldedPlate, clipPlan } from "./shop_mold_more.js";

export const r1 = (x) => Math.round(x * 10) / 10, half = (x) => Math.ceil(x * 2 - 1e-9) / 2, fr = (x) => String(r1(x)).replace(".", ",");
export const P = (value, min, max, label, group = "Enveloppe", step = 0.5) => ({ value, min: r1(min), max: r1(max), step, unit: "mm", label, group });

/** The moulder's figures, by process. wall = [min, max] when the material gives none ; flow = flow length over wall ;
    inner = inside radius over wall ; rib = rib thickness over wall ; ribH = rib height over wall ; boss = boss
    diameter over its hole ; draft = degrees outside / inside ; skim = stock left on machined faces. */
export const MOLD_RULES = {
  injection_molding: { label: "Injection molding", fr: "moulage par injection", wall: [1.0, 4.0], nominal: 2.5, flow: 150, inner: 0.5, rib: 0.55, ribH: 3, boss: 2.0, draft: [1, 1], skim: 0, thread: "insert",
    notes: ["Draft 1° sur toutes les parois parallèles au pull (2° sur une face grainée)", "Tolérances générales des pièces plastiques moulées ISO 20457", "Gate et ejector pins hors des faces d'aspect ; parting line au bord supérieur"] },
  die_casting: { label: "High pressure die casting", fr: "fonderie sous pression", wall: [1.5, 4.5], nominal: 2.5, flow: 110, inner: 0.6, rib: 0.8, ribH: 4, boss: 2.5, draft: [1, 2], skim: 0.5, thread: "tapped",
    notes: ["Draft 1° à l'extérieur, 2° sur les cores", "Taraudages, alésages et plans d'appui repris en usinage (surépaisseur 0,5 mm)", "Tolérances générales des pièces de fonderie ISO 8062-3 ; porosité à contrôler dans les zones taraudées"] },
  lp_die_casting: { label: "Low pressure die casting", fr: "fonderie basse pression", wall: [3.0, 10.0], ownWall: true, nominal: 4, flow: 80, inner: 0.6, rib: 0.8, ribH: 4, boss: 2.5, draft: [2, 3], skim: 1.5, thread: "tapped",
    basis: "Paroi d'environ 3 mm au minimum : vue en extrait dans des guides de fournisseurs. Draft, surépaisseur et longueur d'écoulement : pris entre le die casting et la gravité, sans lecture — à fixer avec la fonderie.",
    notes: ["Draft 2° à l'extérieur, 3° sur les cores", "Rempli par le bas (riser tube), sous faible pression : gate au point bas, risers en haut sur les masses isolées", "Taraudages, alésages et plans d'appui repris en usinage (surépaisseur 1,5 mm)", "Tolérances générales des pièces de fonderie ISO 8062-3"] },
  permanent_mold: { label: "Permanent mold casting", fr: "moulage en coquille par gravité", wall: [4.0, 12.0], nominal: 5, flow: 70, inner: 0.75, rib: 0.8, ribH: 4, boss: 2.5, draft: [2, 3], skim: 1.5, thread: "tapped",
    basis: "Paroi : un guide de fonderie lu en extrait demande environ 4,6 mm, d'autres 3 à 4,5 mm. Draft 2° à 3° selon la hauteur, d'après le même guide. Surépaisseur et longueur d'écoulement : sans lecture — à fixer avec la fonderie.",
    notes: ["Draft 2° à l'extérieur, 3° sur les cores", "Moule métallique rempli par gravité : gate au parting line, risers en haut sur les masses", "Taraudages, alésages et plans d'appui repris en usinage (surépaisseur 1,5 mm)", "Tolérances générales des pièces de fonderie ISO 8062-3"] },
  sand_casting: { label: "Sand casting", fr: "moulage au sable", wall: [4.0, 12.0], nominal: 5, flow: 60, inner: 0.75, rib: 0.8, ribH: 4, boss: 2.5, draft: [2, 3], skim: 2.5, thread: "tapped",
    notes: ["Draft 2° à l'extérieur, 3° sur les cores", "Taraudages, alésages et plans d'appui repris en usinage (surépaisseur 2,5 mm)", "Tolérances générales des pièces de fonderie ISO 8062-3"] },
};
/** The moulding processes a material goes to, in its own order ; and the one it goes to first. */
export function moldProcesses(matId) { const m = material(matId); return m ? m.processes.filter((p) => MOLD_RULES[p]) : []; }
export function moldProcess(matId) {
  const m = material(matId), own = moldProcesses(matId)[0];
  return own || (m && m.cls === "metal" ? "die_casting" : "injection_molding");
}

/** Writes the moulded part. items = prepared interfaces (shop_intent.prepare) with fp, where, inside. → the core of a spec. */
export function molded(brief, items, log) {
  const arch = moldArch(brief, items);                          // a shell that holds, a cover that closes, a ribbed plate that carries
  if (arch === "cover") return moldedCover(brief, items, log);
  if (arch === "plate") return moldedPlate(brief, items, log);
  const proc = brief.process && MOLD_RULES[brief.process] ? brief.process : moldProcess(brief.material), R = MOLD_RULES[proc], mat = material(brief.material) || { name: brief.material }, lim = R.ownWall ? R.wall : mat.wall || R.wall, env = brief.envelope || {}, metal = R.thread === "tapped";
  const inside = items.filter((it) => it.inside), rim = items.filter((it) => !it.inside && it.where === "+Z"), under = items.filter((it) => !it.inside && it.where === "-Z"), sides = items.filter((it) => !it.inside && it.where[1] !== "Z");
  const boards = inside.filter((it) => it.type === "bolt_pattern"), so = boards.length ? r1(brief.standoff || 6) : 0;
  /* the cavity : what the designer asks to contain, and at least what the inside interfaces span */
  const span = (list, k) => Math.max(0, ...list.map((it) => it.fp[k] + 2 * Math.max(it.fp.edge, 4)));
  /* a bonded joint of the rim needs matter under it : the open top of a shell has none, so each land stands on a block against a long wall */
  const lands = rim.filter((it) => it.type === "bond"), landRow = lands.reduce((s, it) => s + it.fp.w, 0) + 6 * Math.max(0, lands.length - 1), landDeep = Math.max(0, ...lands.map((it) => it.fp.h));
  const Lin = Math.max(env.L || 0, span(inside, "w"), span(under, "w"), lands.length ? landRow + 36 : 0, 30), Win = Math.max(env.W || 0, span(inside, "h"), span(under, "h"), 20) + landDeep, Hin = Math.max(env.H || 0, so + (boards.length ? 12 : 0), ...sides.map((it) => it.fp.h + 2 * 4 + so), 10);
  /* one nominal wall : the usual figure for the material, thicker when the melt has far to go, inside the range of the material */
  const flow = (Lin + Win) / 2 + Hin, usual = Math.min(R.nominal, half((lim[0] + lim[1]) / 2)), wall = Math.min(lim[1], Math.max(lim[0], half(Math.max(usual, flow / R.flow))));
  log.push(`Procédé : ${R.label} — ${mat.name} se moule entre ${fr(lim[0])} et ${fr(lim[1])} mm de paroi.`);
  log.push(`Paroi nominale ${fr(wall)} mm, la même partout : ${flow / R.flow > usual ? `la matière parcourt environ ${fr(flow)} mm depuis le gate, soit ${Math.round(flow / wall)} fois la paroi (limite ${R.flow})` : `valeur usuelle pour cette matière ; longueur d'écoulement ${fr(flow)} mm, soit ${Math.round(flow / wall)} fois la paroi (limite ${R.flow})`}.`);
  /* the draft is real : walls, bosses, gussets and ribs lean in the model. One wall everywhere means one angle for the outside and
     the cores : the larger of the two the process asks for. The floor is narrower than the rim, so the volume is counted at the floor. */
  const dp = brief.draft === false ? 0 : Math.max(R.draft[0], R.draft[1]), lean = Math.tan(dp * Math.PI / 180);
  const L = half(Lin + 2 * wall + 2 * Hin * lean), W = half(Win + 2 * wall + 2 * Hin * lean), H = half(Hin + wall), rc = half(Math.max((1 + R.inner) * wall, 3)), rf = half((1 + R.inner) * wall);
  log.push(`Volume à contenir ${fr(Lin)} × ${fr(Win)} × ${fr(Hin)} mm → extérieur ${fr(L)} × ${fr(W)} × ${fr(H)} mm, ouvert sur le dessus (pull +Z, parting line au bord).`);
  log.push(`Rayons : ${fr(rc)} mm aux angles verticaux et ${fr(rf)} mm au fond à l'extérieur — il reste ${fr(rc - wall)} et ${fr(rf - wall)} mm à l'intérieur (règle : rayon intérieur ≥ ${fr(R.inner)} × paroi), et la paroi garde son épaisseur dans les angles.`);
  const features = [{ op: "tub", id: "coque", name: "Coque", size: ["L", "W", "H"], wall: "wall", rc: "rc", rf: "rf", ...(dp ? { draft: "dp" } : {}) }], out = [], params = { L: P(L, 20, Math.max(400, 2 * L), "Longueur extérieure", "Enveloppe", 1), W: P(W, 15, Math.max(300, 2 * W), "Largeur extérieure", "Enveloppe", 1), H: P(H, 8, Math.max(200, 2 * H), "Hauteur extérieure", "Enveloppe", 1),
    wall: P(wall, lim[0], lim[1], "Paroi nominale", "Moulage", 0.1), rc: P(rc, r1((1 + R.inner) * lim[0]), 25, "Rayon des angles verticaux", "Moulage"), rf: P(rf, r1((1 + R.inner) * lim[0]), 25, "Rayon du fond", "Moulage"), ...(dp ? { dp: { value: dp, min: 0.5, max: 5, step: 0.5, unit: "°", label: "Draft", group: "Moulage" } } : {}) };
  const leaning = dp ? { draft: "dp" } : {};
  const ifo = (it, face, at, extra = {}) => { const o = { id: it.id, type: it.type, name: it.name, key: it.key, partner: it.partner, side: it.side, external: it.external, face, at, params: it.params, opts: it.opts, ...extra }; for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k]; return o; };
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
  let cover = rim.find((it) => it.type === "bolt_pattern"), clips = null;
  const slug = String(brief.name || "piece").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_");
  if (brief.closure === "clips" && !cover && brief.cover !== false) {
    const plan = clipPlan(brief.material, wall, H - wall - so, Math.max(L, W) - 2 * wall);
    if (metal) log.push("Clips demandés sur une pièce de métal coulé : un métal ne fléchit pas assez pour s'encliqueter — la fermeture reste vissée.");
    else if (!plan.fits) log.push(`Clips demandés, mais la lame doit faire ${fr(plan.lb)} mm pour ne pas dépasser ${fr(100 * plan.eps)} % de déformation et le boîtier n'offre que ${fr(H - wall - so)} mm : la fermeture reste vissée.`);
    else clips = plan;
  }
  if (clips) {
    const alongL = L >= W, faces = alongL ? ["-Y", "+Y"] : ["-X", "+X"], at = clips.n === 3 ? [0.2, 0.5, 0.8] : [0.25, 0.75], ww = r1(clips.wb + 1), wh = r1(clips.hh + 0.8), zb = `H - ${r1(clips.lb + clips.hh + 0.8)}`;
    for (const face of faces) at.forEach((k, i) => features.push({ op: "pocket", id: `clip${face[0] === "-" ? "a" : "b"}${i + 1}`, name: "Fenêtre de clip", face, rect: [`${alongL ? "L" : "W"} * ${k} - ${r1(ww / 2)}`, zb, ww, wh], depth: `wall + ${r1(0.5 + H * lean)}` }));
    out.push({ id: `IF${items.length + 1}`, type: "planar", name: "Plan de joint", key: `${slug}_couvercle_joint`, side: "B", face: "+Z", at: ["L/2", "W/2"], params: { w: "L", h: "W" } });
    log.push(`Fermeture par clips : ${2 * clips.n} fenêtres de ${fr(ww)} × ${fr(wh)} mm dans les grands côtés, à ${fr(clips.lb)} mm sous le bord. La lame du couvercle (${fr(clips.t)} mm d'épaisseur, ${fr(clips.lb)} mm de long) fléchit de ${fr(clips.y)} mm : déformation ${fr(100 * clips.strain)} % pour ${fr(100 * clips.eps)} % admis (règle : ε = 1,5 × épaisseur × flèche / longueur²).`);
    log.push("Chaque rangée de fenêtres demande un slide dans le mold du boîtier, et chaque crochet un lifter dans celui du couvercle : c'est le prix de l'absence de vis.");
  }
  if (!cover && !clips && brief.cover !== false) { cover = { id: `IF${items.length + 1}`, type: "bolt_pattern", name: "Fixation du couvercle", key: `${slug}_couvercle`, side: "B", where: "+Z", params: { ...INTERFACE_TYPES.bolt_pattern.params, screw: "M3" }, auto: true };
    log.push("Aucune fermeture déclarée : quatre vis M3 aux coins et un plan de joint sont proposés pour un couvercle (retirez-les s'il n'y en a pas)."); }
  if (cover) {
    const th = thread(cover.params.screw), slim = bossOf(cover.params.screw), d = Math.max(slim, half((H - wall) / 3)), gap = r1(Math.max(wall, 1.5) + 2 * (H - wall) * lean), c = r1(wall + gap + d / 2), rib = r1(Math.max(0.8, R.rib * wall)), gh = "(H - wall) * 0.7";
    /* in the corners — unless a column of the inside already stands there : then the bosses slide along the long walls */
    const alongL = L >= W, clash = (bx, by) => keep.some((k) => [[bx, by], [L - bx, by], [bx, W - by], [L - bx, W - by]].some(([x, y]) => Math.hypot(k.x - x, k.y - y) < k.r + d / 2 + gap));
    let bx = c, by = c;
    while (clash(bx, by) && (alongL ? bx < L / 2 - d : by < W / 2 - d)) { if (alongL) bx = r1(bx + 0.5); else by = r1(by + 0.5); }
    if (clash(bx, by)) { bx = by = c; log.push("Attention : les colonnettes de l'intérieur touchent les bossages de fermeture — agrandir le volume à contenir ou resserrer le motif de fixation."); }
    else if (bx !== c || by !== c) log.push(`Bossages de fermeture glissés à ${fr(alongL ? bx : by)} mm des coins, le long des grands côtés : une colonnette de l'intérieur occupe déjà le coin, et deux fûts qui se touchent font une masse et une lame d'acier trop mince dans le moule.`);
    params.bd = P(d, r1(R.boss * 2), 20, "Diamètre des bossages de fermeture", "Moulage");
    const grid = { origin: [bx, by], nx: 2, ny: 2, dx: `L - ${r1(2 * bx)}`, dy: `W - ${r1(2 * by)}` };
    cover.params.pattern = { type: "rect", nx: 2, ny: 2, dx: grid.dx, dy: grid.dy };
    features.push({ op: "boss", id: "bossages", name: "Bossages de fermeture", face: "+Z", start: "wall", d: "bd", h: "H - wall", ...leaning, at: { grid } });
    for (let k = 0; k < 4; k++) { const right = k % 2, top = k > 1;                                      // a gusset to each wall the boss stands near
      if (by === c) features.push({ op: "pad", id: `gy${k + 1}`, name: "Gousset", face: "+Z", start: "wall", rect: [right ? `L - ${r1(bx + rib / 2)}` : r1(bx - rib / 2), top ? `W - ${by}` : "wall", rib, r1(by - wall)], h: gh, ...leaning });
      if (bx === c) features.push({ op: "pad", id: `gx${k + 1}`, name: "Gousset", face: "+Z", start: "wall", rect: [right ? `L - ${bx}` : "wall", top ? `W - ${r1(by + rib / 2)}` : r1(by - rib / 2), r1(bx - wall), rib], h: gh, ...leaning }); }
    for (const [x, y] of [[bx, by], [L - bx, by], [bx, W - by], [L - bx, W - by]]) keep.push({ x, y, r: d / 2 });
    /* no mass in a boss : its hole goes as deep as a core pin can (3 × Ø), and a second pin cores it from underneath */
    const top = metal ? th.tap : th.insert[0], dt = metal ? r1(Math.max(2 * th.d, 6)) : r1(Math.max(th.insert[1] + 1.5, Math.min(3 * top, H - wall))), pin = Math.floor((d - 2 * 0.8 * wall) * 2) / 2, db = pin >= (proc === "sand_casting" ? 6 : 3) ? r1(Math.min(3 * pin, H - dt - wall)) : 0, left = r1(H - wall - dt - db);
    if (db >= 2) features.push({ op: "hole", id: "evid", name: "Évidement sous les bossages", face: "-Z", d: pin, depth: db, at: { grid } });
    out.push(ifo(cover, "+Z", ["L/2", "W/2"], { side: "B", opts: { ...(cover.opts || {}), ...(metal ? { depth: dt } : { thread: "insert", depth: dt }) } }));
    if (d > slim) log.push(`Bossages de fermeture portés de Ø ${fr(slim)} à Ø ${fr(d)} mm : hauts de ${fr(H - wall)} mm, ils ne doivent pas dépasser 3 fois leur diamètre.`);
    log.push(`Fermeture : 4 bossages Ø ${fr(d)} mm détachés des parois de ${fr(gap)} mm et reliés par des goussets de ${fr(rib)} mm — un bossage noyé dans l'angle ferait une masse, donc un sink mark (retassure).`);
    log.push(db >= 2 ? `Bossages noyautés des deux côtés : ${metal ? `le taraudage ${cover.params.screw} descend de ${fr(dt)} mm` : `le trou d'insert descend de ${fr(dt)} mm (3 × Ø au plus pour un core pin)`}, et un évidement Ø ${fr(pin)} × ${fr(db)} mm monte du dessous${left > 0.05 ? ` ; il reste ${fr(left + wall)} mm pleins entre les deux` : ` ; il ne reste qu'un voile de ${fr(wall)} mm`}. Les évidements se voient sous le fond.`
      : `Bossages pleins sous leur trou (${fr(H - wall - dt)} mm) : trop minces pour être évidés par dessous — une masse locale, à accepter ou à porter sur le couvercle.`);
    if (!rim.some((it) => it.type === "planar")) out.push({ id: `IF${items.length + (cover.auto ? 2 : 1)}`, type: "planar", name: "Plan de joint", key: `${cover.key}_joint`, side: "B", face: "+Z", at: ["L/2", "W/2"], params: { w: "L", h: "W" } });
  }
  const plus = (base, d) => (Math.abs(d) < 1e-6 ? base : d > 0 ? `${base} + ${r1(d)}` : `${base} - ${r1(-d)}`);
  let lx = -landRow / 2;
  lands.forEach((it, k) => {
    const pw = it.fp.w, ph = it.fp.h, x0 = lx; lx += pw + 6;
    const cw = r1(pw - 2 * wall), cd = r1(ph - wall - (H - wall) * lean), cored = cw >= 3 && cd >= 3;      // cored from underneath, like the bosses : no mass under the land
    features.push({ op: "pad", id: `massif${k + 1}`, name: "Massif de collage", face: "+Z", start: "wall", rect: [plus("L/2", x0), "wall / 2", r1(pw), `wall / 2 + ${r1(ph)}`], h: "H - wall", ...leaning });
    if (cored) features.push({ op: "pocket", id: `evm${k + 1}`, name: "Évidement sous le massif de collage", face: "-Z", rect: [plus("L/2", x0 + wall), `wall + ${r1((H - wall) * lean)}`, cw, cd], depth: "H - wall" });
    keep.push({ x: L / 2 + x0 + pw / 2, y: wall + ph / 2, r: Math.hypot(pw, ph) / 2 });
    out.push(ifo(it, "+Z", [plus("L/2", x0 + pw / 2), `wall + ${r1(ph / 2)}`]));
    log.push(`« ${it.name} » : le dessus d'une coque est ouvert — la plage de collage monte sur un massif de ${fr(pw)} × ${fr(ph)} mm adossé au grand côté avant, jusqu'au plan de joint${cored ? `, évidé par dessous (${fr(cw)} × ${fr(cd)} mm) pour ne pas faire de masse` : ", plein : trop étroit pour être évidé"}.`);
  });
  for (const it of rim) if (it !== cover && !lands.includes(it)) out.push(ifo(it, "+Z", ["L/2", "W/2"], it.type === "planar" ? { params: { ...it.params, w: "L", h: "W" } } : {}));
  /* a wide floor is stiffened by low ribs rather than by a thicker wall */
  const wide = Math.max(Lin, Win), nRib = wide > 100 ? Math.min(4, Math.ceil(wide / 80) - 1) : 0, rt = r1(Math.max(0.8, R.rib * wall)), rh = r1(Math.min(R.ribH * wall, so ? so - 1.5 : R.ribH * wall));
  if (nRib && rh >= 1.5) { const alongX = Lin >= Win, span = alongX ? L : W, free = (q) => !keep.some((k) => Math.abs((alongX ? k.x : k.y) - q) < k.r + rt / 2 + 1); let made = 0;
    for (let k = 1; k <= nRib; k++) { const frac = r1(k / (nRib + 1)), room = span / (nRib + 1) / 2 - 1; let off = null;                 // a rib steps aside for a column or a hole, or is left out
      for (let u = 0; u <= room && off === null; u++) off = free(span * frac + u) ? u : free(span * frac - u) ? -u : null;
      if (off === null) continue; made++;
      const pos = `${alongX ? "L" : "W"} * ${frac}${off ? ` ${off > 0 ? "+" : "-"} ${Math.abs(off)}` : ""} - ${r1(rt / 2)}`; features.push({ op: "pad", id: `n${k}`, name: "Nervure du fond", face: "+Z", start: "wall", rect: alongX ? [pos, "wall", rt, "W - 2*wall"] : ["wall", pos, "L - 2*wall", rt], h: rh, ...leaning }); }
    if (made) log.push(`Fond de ${fr(wide)} mm : ${made} nervure(s) de ${fr(rt)} mm (${Math.round(100 * rt / wall)} % de la paroi) hautes de ${fr(rh)} mm le raidissent sans l'épaissir${made < nRib ? " ; une nervure qui aurait croisé une colonnette est laissée de côté" : ""}.`); }
  /* outside : fixings under the floor, openings and fixings in the side walls */
  for (const it of under) out.push(ifo(it, "-Z", ["L/2", "W/2"], it.type === "bolt_pattern" ? { opts: { ...(it.opts || {}), ...(it.side === "B" ? hold(it.params.screw) : { depth: "wall + 0.5" }) } } : {}));
  const zc = so ? `wall + so + 1.6 + ${r1(4)}` : "H/2";
  let slides = clips ? 2 : 0;
  for (const face of ["-Y", "+Y", "-X", "+X"]) { const on = sides.filter((it) => it.where === face), tot = on.reduce((s, it) => s + it.fp.w, 0) + 8 * (on.length - 1); let u = -tot / 2;
    for (const it of on) { const du = r1(u + it.fp.w / 2); u += it.fp.w + 8; slides++;
      out.push(ifo(it, face, [du ? `${face[1] === "Y" ? "L" : "W"}/2 ${du > 0 ? "+" : "-"} ${Math.abs(du)}` : `${face[1] === "Y" ? "L" : "W"}/2`, it.type === "cutout" ? `wall + ${so ? "so + 1.6 + " : ""}${r1((it.params.h || it.params.d || 8) / 2 + (so ? 0 : 4))}` : zc], it.type === "cutout" ? { opts: { ...(it.opts || {}), depth: `wall + ${r1(0.5 + H * lean)}` } } : {})); } }       // a leaning wall is further in at its foot : the opening goes that much deeper
  if (slides) log.push(`${slides} ouverture(s) ou fixation(s) dans les parois latérales : chacune demande un slide dans le mold. L'ouvrir jusqu'au parting line, ou la porter par le couvercle, le supprime.`);
  features.push({ op: "interfaces" });
  log.push(dp ? `Draft de ${fr(dp)}° modélisé : parois, bossages, goussets et nervures penchent réellement (${R.draft[0] === R.draft[1] ? "extérieur et cores" : `le procédé demande ${fr(R.draft[0])}° dehors et ${fr(R.draft[1])}° sur les cores : une seule paroi impose le plus grand des deux`}). Sur ${fr(H)} mm de haut, le fond est plus étroit de ${fr(H * lean)} mm par côté : le volume à contenir est compté au fond.`
    : `Draft ${fr(R.draft[0])}° à l'extérieur et ${fr(R.draft[1])}° à l'intérieur, déclaré pour le mouliste (modèle droit, à votre demande) : sur ${fr(H)} mm de haut, ${fr(H * Math.tan(R.draft[1] * Math.PI / 180))} mm par face.`);
  if (metal) log.push(`Métal coulé : aucun filetage ne vient de fonderie — taraudages et plans d'appui sont repris en usinage, avec ${fr(R.skim)} mm de surépaisseur.`);
  return { family: "enclosure", process: proc, params, stock: { form: "molded" }, features, interfaces: out, notes: R.notes,
    mold: { process: proc, pull: "+Z", parting: "bord supérieur", wall, draft: dp || R.draft[0], draft_inside: dp || R.draft[1], modelled: dp > 0, arch: "shell", L, W, H, rc, ...(cover ? { closure: "screws", gap: r1(Math.max(wall, 1.5) + 2 * (H - wall) * lean) } : clips ? { closure: "clips", clips: { walls: L >= W ? "Y" : "X", at: clips.n === 3 ? [0.2, 0.5, 0.8] : [0.25, 0.75], lb: clips.lb, t: clips.t, y: clips.y, hh: clips.hh, wb: clips.wb, j: 0.25, strain: r1(1000 * clips.strain) / 1000, limit: clips.eps } } : {}), slides, machined: metal ? R.skim : 0, gate: metal ? "gate sur un petit côté, vents à l'opposé" : "gate au centre du fond", ejection: "ejector pins sur les bossages, les nervures et le pourtour du fond" } };
}
