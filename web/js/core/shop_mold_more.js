/* DesignOrbit.ai — the other moulded parts of the Shop companion, beside the shell that holds things :
   - the COVER that matches its housing : the same outline and corner radii, a locating lip that drops inside the rim,
     clearance holes on the housing's bosses — or hooks that snap into its windows ;
   - the CLIPS : a cantilever blade sized by its strain, ε = 1.5 × thickness × deflection / length² ;
   - the solid RIBBED PLATE that carries : one wall, a rim and crossed ribs underneath instead of thickness, bosses
     under its threads.
   A cover reads what its housing recorded in « mold » (brief.hosts[part id]) : the two are drawn from the same numbers. */

import { patternPoints } from "../cad/interfaces.js";
import { thread } from "../cad/standards.js";
import { material } from "../cad/materials.js";
import { MOLD_RULES, moldProcess, r1, half, fr, P } from "./shop_mold.js";

/** Which moulded part the brief describes : "shell" (it holds), "cover" (it closes a neighbour), "plate" (it carries). */
export function moldArch(brief, items = []) {
  if (["shell", "cover", "plate"].includes(brief.arch)) return brief.arch;
  return items.some((it) => it.from && it.type === "planar") && !items.some((it) => it.inside) ? "cover" : "shell";        // it takes the joint plane of a neighbour : it closes it
}

/** A snap-fit blade for this material. depth = free height inside the housing ; long = inner length of its long wall.
    → { n (per wall), t, y, lb, hh, wb, eps (allowed strain), strain, fits } */
export function clipPlan(matId, wall, depth, long) {
  const eps = /GF\d|-GF|CF\d/i.test(String(matId)) ? 0.01 : 0.02, t = r1(Math.max(1.2, 0.6 * wall)), y = r1(Math.max(1, 0.4 * wall)), lb = half(Math.sqrt(1.5 * t * y / eps)), hh = r1(1.5 * y);
  return { n: long > 160 ? 3 : 2, t, y, lb, hh, wb: r1(Math.max(5, 2.5 * wall)), eps, strain: 1.5 * t * y / (lb * lb), fits: lb + hh + 2 <= depth };
}

const head = (brief) => { const proc = brief.process && MOLD_RULES[brief.process] ? brief.process : moldProcess(brief.material), R = MOLD_RULES[proc], mat = material(brief.material) || { name: brief.material }; return { proc, R, mat, lim: R.ownWall ? R.wall : mat.wall || R.wall, metal: R.thread === "tapped" }; };
const nominal = (R, lim, flow) => Math.min(lim[1], Math.max(lim[0], half(Math.max(Math.min(R.nominal, half((lim[0] + lim[1]) / 2)), flow / R.flow))));
const ifo = (it, face, at, extra = {}) => { const o = { id: it.id, type: it.type, name: it.name, key: it.key, partner: it.partner, side: it.side, external: it.external, face, at, params: it.params, opts: it.opts, ...extra }; for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k]; return o; };
const r2 = (x) => Math.round(x * 100) / 100;                    // clearances are counted in hundredths
const angle = (dp) => ({ value: dp, min: 0.5, max: 5, step: 0.5, unit: "°", label: "Draft", group: "Moulage" });

/** The cover of a moulded housing. items : the interfaces it takes from the housing (joint plane, screws) and its own. */
export function moldedCover(brief, items, log) {
  const { proc, R, mat, lim, metal } = head(brief), joint = items.find((it) => it.type === "planar"), screws = items.find((it) => it.type === "bolt_pattern"), env = brief.envelope || {};
  const host = (brief.hosts && ((joint && joint.from && brief.hosts[joint.from.part]) || Object.values(brief.hosts)[0])) || null, hm = (host && host.mold) || {};
  const L = half((host && host.L) || (joint && Number(joint.params.w)) || env.L || 100), W = half((host && host.W) || (joint && Number(joint.params.h)) || env.W || 60), wall = nominal(R, lim, (L + W) / 2);
  const hw = (host && host.wall) || wall, rc = (host && host.rc) || half(Math.max((1 + R.inner) * wall, 3)), dp = brief.draft === false ? 0 : (host && host.dp) || Math.max(R.draft[0], R.draft[1]), j = 0.25, lt = r1(Math.max(0.8, R.rib * wall)), o = r2(hw + j);
  const lipH = r1(Math.min(2 * wall, host ? 0.3 * (host.H - hw) - 0.5 : 2 * wall)), lip = lipH >= 1.5 && L - 2 * (o + lt) > 6 && W - 2 * (o + lt) > 6, leaning = dp ? { draft: "dp" } : {};
  log.push(`Procédé : ${R.label} — ${mat.name}. Couvercle${host ? ` assorti à ${host.id}` : ""} : même contour (${fr(L)} × ${fr(W)} mm), mêmes rayons d'angle (${fr(rc)} mm), une paroi de ${fr(wall)} mm.`);
  const params = { L: P(L, 20, Math.max(400, 2 * L), "Longueur", "Enveloppe", 1), W: P(W, 15, Math.max(300, 2 * W), "Largeur", "Enveloppe", 1), wall: P(wall, lim[0], lim[1], "Paroi nominale", "Moulage", 0.1), rc: P(rc, 0.5, 25, "Rayon des angles", "Moulage"), ...(dp ? { dp: angle(dp) } : {}) };
  const features = [{ op: "box", id: "plaque", name: "Plaque du couvercle", size: ["L", "W", "wall"] }, { op: "fillet", id: "angles", name: "Rayons des angles", r: "rc", edges: "vertical" }], out = [];
  if (lip) {
    features.push({ op: "pad", id: "levre", name: "Lèvre de centrage", face: "-Z", start: 0, rect: [o, o, `L - ${r2(2 * o)}`, `W - ${r2(2 * o)}`], r: r2(Math.max(0.3, rc - o)), h: lipH, ...leaning },
      { op: "pocket", id: "levre_int", name: "Intérieur de la lèvre", face: "-Z", start: -lipH, rect: [r2(o + lt), r2(o + lt), `L - ${r2(2 * (o + lt))}`, `W - ${r2(2 * (o + lt))}`], r: r2(Math.max(0.2, rc - o - lt)), depth: lipH });
    log.push(`Lèvre de centrage : ${fr(lt)} mm d'épaisseur (${Math.round(100 * lt / wall)} % de la paroi, pour ne pas marquer le dessus), ${fr(lipH)} mm de haut, à ${String(j).replace(".", ",")} mm de la paroi du boîtier${host ? " — elle passe entre la paroi et les bossages, au-dessus des goussets" : ""}.`);
  } else log.push(host ? "Pas de lèvre de centrage : le boîtier est trop peu profond pour qu'elle passe au-dessus de ses goussets ; les vis centrent le couvercle." : "Pas de lèvre de centrage : couvercle trop petit.");
  const wide = Math.max(L, W), nRib = lip && wide > 120 ? Math.min(3, Math.ceil(wide / 90) - 1) : 0;
  for (let k = 1; k <= nRib; k++) { const along = L >= W, q = `${along ? "L" : "W"} * ${r1(k / (nRib + 1))} - ${r1(lt / 2)}`, a = r2(o + lt - 0.2), span = `${along ? "W" : "L"} - ${r2(2 * (o + lt) - 0.4)}`;
    features.push({ op: "pad", id: `n${k}`, name: "Nervure du couvercle", face: "-Z", start: 0, rect: along ? [q, a, lt, span] : [a, q, span, lt], h: lipH, ...leaning }); }
  if (nRib) log.push(`Couvercle de ${fr(wide)} mm : ${nRib} nervure(s) de ${fr(lt)} mm, de la hauteur de la lèvre, le raidissent sans l'épaissir.`);
  /* hooks, when the housing closes with clips : the blade and its hook come from the numbers the housing recorded */
  const c = hm.closure === "clips" ? hm.clips : null;
  if (c && !metal) {
    const X = c.walls === "Y", len = X ? "L" : "W", far = X ? "W" : "L"; let n = 0;
    for (const side of [0, 1]) for (const k of c.at) { n++; const u = `${len} * ${k} - ${r1(c.wb / 2)}`, b0 = side ? `${far} - ${r2(hw + c.j + c.t)}` : r2(hw + c.j), h0 = side ? `${far} - ${r2(hw + c.j + 0.3)}` : r2(hw + c.j - c.y);
      features.push({ op: "pad", id: `lame${n}`, name: "Lame de clip", face: "-Z", start: 0, rect: X ? [u, b0, c.wb, c.t] : [b0, u, c.t, c.wb], h: r1(c.lb + c.hh) },
        { op: "box", id: `croc${n}`, name: "Crochet de clip", at: X ? [u, h0, -r1(c.lb + c.hh)] : [h0, u, -r1(c.lb + c.hh)], size: X ? [c.wb, r1(c.y + 0.3), c.hh] : [r1(c.y + 0.3), c.wb, c.hh] }); }
    log.push(`Fermeture par clips : ${n} lames de ${fr(c.t)} × ${fr(c.wb)} mm, longues de ${fr(c.lb)} mm, crochet de ${fr(c.y)} mm — les cotes du boîtier ${host.id}. Déformation à l'encliquetage ${fr(100 * c.strain)} % pour ${fr(100 * c.limit)} % admis. Chaque crochet demande un lifter.`);
  } else if (c) log.push("Le boîtier attend des clips, mais ce couvercle est en métal coulé : il ne fléchit pas — revoir la fermeture du boîtier (vis).");
  for (const it of items) {
    if (it === joint) out.push(ifo(it, "-Z", ["L/2", "W/2"], { level: 0, params: { ...it.params, w: "L", h: "W" } }));
    else if (it === screws) out.push(ifo(it, "-Z", ["L/2", "W/2"], { level: 0 }));
    else out.push(ifo(it, it.where === "-Z" ? "-Z" : "+Z", ["L/2", "W/2"], it.where === "-Z" ? { level: 0 } : {}));
  }
  if (screws) log.push(`Vis ${screws.params.screw} : trous de passage au droit des bossages du boîtier ; les têtes restent en saillie sur ${fr(wall)} mm de paroi (pour les noyer, épaissir localement).`);
  features.push({ op: "interfaces" });
  log.push(dp ? `Draft de ${fr(dp)}° modélisé sur la lèvre et les nervures ; la tranche du couvercle (${fr(wall)} mm) reste droite.` : "Modèle droit, à votre demande : draft à porter au mold.");
  return { family: "plate", process: proc, params, stock: { form: "molded" }, features, interfaces: out, notes: R.notes,
    mold: { process: proc, arch: "cover", pull: "-Z", parting: "face supérieure", wall, draft: dp || R.draft[0], draft_inside: dp || R.draft[1], modelled: dp > 0, slides: 0, lifters: c && !metal ? 2 * c.at.length : 0, machined: metal ? R.skim : 0,
      gate: metal ? "gate sur un petit côté" : "gate sous le couvercle, au centre", ejection: "ejector pins sur la lèvre et les nervures", ...(host ? { host: host.id } : {}) } };
}

/** A solid part that carries : a flat wall, a rim and crossed ribs underneath, bosses under its threads. */
export function moldedPlate(brief, items, log) {
  const { proc, R, mat, lim, metal } = head(brief), env = brief.envelope || {}, span = (k) => Math.max(0, ...items.map((it) => it.fp[k] + 2 * Math.max(it.fp.edge, 5)));
  const L = half(Math.max(env.L || 0, span("w"), 40)), W = half(Math.max(env.W || 0, span("h"), 30)), wall = nominal(R, lim, (L + W) / 2), dp = brief.draft === false ? 0 : Math.max(R.draft[0], R.draft[1]), leaning = dp ? { draft: "dp" } : {};
  const rc = half(Math.max(1.5 * wall, 3)), rt = r1(Math.max(0.8, R.rib * wall)), rh = r1(R.ribH * wall), keep = [], out = [];
  log.push(`Procédé : ${R.label} — ${mat.name}. Pièce pleine nervurée : une plaque de ${fr(L)} × ${fr(W)} mm à la paroi nominale de ${fr(wall)} mm ; la raideur vient des nervures, pas de l'épaisseur.`);
  const params = { L: P(L, 20, Math.max(400, 2 * L), "Longueur", "Enveloppe", 1), W: P(W, 15, Math.max(300, 2 * W), "Largeur", "Enveloppe", 1), wall: P(wall, lim[0], lim[1], "Paroi nominale", "Moulage", 0.1), rc: P(rc, 0.5, 25, "Rayon des angles", "Moulage"), rh: P(rh, r1(wall), r1(2 * R.ribH * wall), "Hauteur des nervures", "Moulage"), ...(dp ? { dp: angle(dp) } : {}) };
  const features = [{ op: "box", id: "plaque", name: "Plaque", size: ["L", "W", "wall"] }, { op: "fillet", id: "angles", name: "Rayons des angles", r: "rc", edges: "vertical" },
    { op: "pad", id: "ceinture", name: "Ceinture", face: "-Z", start: 0, rect: [0, 0, "L", "W"], r: "rc", h: "rh" }, { op: "pocket", id: "ceinture_int", name: "Intérieur de la ceinture", face: "-Z", start: "0 - rh", rect: [rt, rt, `L - ${r1(2 * rt)}`, `W - ${r1(2 * rt)}`], r: r1(Math.max(0.3, rc - rt)), depth: "rh" }];
  /* what bolts on : a thread wants a boss underneath, a clearance hole wants nothing — and no rib may cross either */
  for (const it of items) {
    const pts = it.type === "bolt_pattern" ? patternPoints(it.params.pattern).map(([x, y]) => [r1(L / 2 + x), r1(W / 2 + y)]) : [];
    if (it.type === "bolt_pattern" && it.side === "B") {
      const th = thread(it.params.screw), hole = metal ? th.tap : th.insert[0], depth = r1(metal ? Math.max(2 * th.d, 6) : th.insert[1] + 1.5), d = half(metal ? R.boss * hole : Math.max(R.boss * hole, hole + 1.6 * wall)), bh = r1(Math.max(1, depth - wall + 0.8 * wall));
      features.push({ op: "boss", id: `b_${it.id.toLowerCase()}`, name: `Bossages ${it.params.screw}`, face: "-Z", start: 0, d, h: bh, ...leaning, at: pts });
      for (const q of pts) keep.push({ x: q[0], y: q[1], r: d / 2 + bh * Math.tan(dp * Math.PI / 180) });
      out.push(ifo(it, "+Z", ["L/2", "W/2"], { opts: { ...(it.opts || {}), ...(metal ? { depth } : { thread: "insert", depth }) } }));
      log.push(`« ${it.name} » : ${pts.length} bossage(s) Ø ${fr(d)} mm sous la plaque, ${metal ? `taraudés ${it.params.screw} après coulée` : `avec insert ${it.params.screw}`} — le filet ne tient pas dans ${fr(wall)} mm de paroi.`);
    } else { for (const q of pts) keep.push({ x: q[0], y: q[1], r: thread(it.params.screw).d / 2 + 1 }); out.push(ifo(it, it.where === "-Z" ? "-Z" : "+Z", ["L/2", "W/2"], it.where === "-Z" ? { level: 0 } : {})); }
  }
  let made = 0;
  for (const [along, size, cross] of [[true, L, W], [false, W, L]]) { const n = Math.max(0, Math.ceil(size / 45) - 1), free = (q) => !keep.some((k) => Math.abs((along ? k.x : k.y) - q) < k.r + rt / 2 + 1);
    for (let k = 1; k <= n; k++) { const frac = r1(k / (n + 1)), room = size / (n + 1) / 2 - 1; let off = null;
      for (let u = 0; u <= room && off === null; u++) off = free(size * frac + u) ? u : free(size * frac - u) ? -u : null;
      if (off === null) continue; made++;
      const q = `${along ? "L" : "W"} * ${frac}${off ? ` ${off > 0 ? "+" : "-"} ${Math.abs(off)}` : ""} - ${r1(rt / 2)}`, span2 = `${along ? "W" : "L"} - ${r1(2 * rt - 0.4)}`;
      features.push({ op: "pad", id: `${along ? "nx" : "ny"}${k}`, name: "Nervure", face: "-Z", start: 0, rect: along ? [q, r1(rt - 0.2), rt, span2] : [r1(rt - 0.2), q, span2, rt], h: "rh", ...leaning }); } void cross; }
  log.push(`Dessous : une ceinture et ${made} nervure(s) croisée(s) de ${fr(rt)} mm (${Math.round(100 * rt / wall)} % de la paroi), hautes de ${fr(rh)} mm (${R.ribH} fois la paroi), au pas de 45 mm environ ; une nervure s'écarte d'un trou ou d'un bossage.`);
  features.push({ op: "interfaces" });
  log.push(dp ? `Draft de ${fr(dp)}° modélisé sur les nervures et les bossages.` : "Modèle droit, à votre demande : draft à porter au mold.");
  if (metal) log.push(`Métal coulé : taraudages et plans d'appui repris en usinage, avec ${fr(R.skim)} mm de surépaisseur.`);
  return { family: "plate", process: proc, params, stock: { form: "molded" }, features, interfaces: out, notes: R.notes,
    mold: { process: proc, arch: "plate", pull: "-Z", parting: "face supérieure", wall, draft: dp || R.draft[0], draft_inside: dp || R.draft[1], modelled: dp > 0, slides: 0, machined: metal ? R.skim : 0, gate: metal ? "gate sur un petit côté" : "gate au centre de la plaque, côté nervures", ejection: "ejector pins sur les nervures et les bossages" } };
}

/** What a cover needs to know of its housing, read from the housing's file : sizes, wall, radii, draft, and how it closes. */
export function hostOf(spec) {
  if (!spec || !spec.mold || spec.mold.arch !== "shell") return null;
  const v = (k) => (spec.params && spec.params[k] ? Number(spec.params[k].value) : undefined);
  return { id: spec.id, L: v("L"), W: v("W"), H: v("H"), wall: v("wall"), rc: v("rc"), dp: v("dp") || 0, mold: spec.mold };
}
