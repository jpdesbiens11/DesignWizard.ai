/* DynamiteOrbit.ai — the interfaces of a part made ELSEWHERE (demande de JP, 28 novembre 2026 : « faire les pièces les plus complexes en 3D
   dans OnShape ou Inventor et les importer comme une nouvelle pièce en stp… et que l'interface soit reconnue pour le mating »).
   What the kernel read of the solid (cad/step_read.js : faces along the axes, cylinders) becomes interfaces of the types the platform
   already has, PROPOSED — an example until a person confirms it (rule « Guide partout ») :
     a pattern of holes of one size on one face      → bolt_pattern : side A when the diameter is a clearance hole of the table of the
                                                        platform (cad/standards.js), side B when it is a tap drill or the basic minor
                                                        diameter of the ISO metric thread (D1 = D − 1,0825 P, ISO 724) ;
     two plain holes of a dowel diameter              → pins ;
     one bore that no screw explains                  → fit, side B (bore) — the class of fit is an example ;
     a cylinder standing on a shoulder, ended by a disc → fit, side A (shaft) ;
     the largest flat face on the outside of the part → planar (off by default : it mates only with a flat face of the same size).
   A proposal says what was read (`why`). It carries `found` (the geometry is already in the solid : nothing is drilled, nothing added —
   cad/build.js) and `proposed` (not mated, not counted, until confirmed — core/assembly_logic.js freeInterfaces). A through hole can be
   met from either face : the proposal carries the other face as `alt`. When a free interface of the project has the same pattern
   turned by a quarter, a half or three quarters, the proposal takes its pattern and the turn (`rot`) : it will mate with it.
   What is not read is said (`unread`), never guessed. Pure : no kernel, no page. */

import { THREADS, FITS } from "../cad/standards.js";
import { FACES, v3 } from "../cad/vec.js";
import { patternPoints, interfaceSignature } from "../cad/interfaces.js";

/** The words of a part read from a file, as the trade says them, with their French — for the glossary of the Help (core/terms.js). */
export const STEP_WORDS = [
  { label: "STEP (AP203, AP214, AP242)", fr: "fichier STEP", note: "ISO 10303 : le format d'échange que les logiciels de CAO exportent ; le seul que le noyau de l'outil lit en solide" },
  { label: "Clearance hole", fr: "trou de passage", note: "la vis y passe sans y mordre" }, { label: "Tapped hole", fr: "trou taraudé", note: "la vis y fait son filet ; modélisé au foret de taraudage ou au diamètre intérieur" },
  { label: "Counterbore", fr: "lamage", note: "le logement de la tête de vis, au bout d'un trou de passage" }, { label: "Bore", fr: "alésage", note: "un trou précis qui reçoit un arbre" },
  { label: "Shaft", fr: "arbre", note: "le cylindre qui entre dans un alésage" }, { label: "Shoulder", fr: "épaulement", note: "la face plus large d'où part un arbre" }, { label: "Dowel hole", fr: "trou de goupille", note: "il reçoit une goupille de positionnement" },
  { label: "Snap (drag onto a feature)", fr: "emboîter en glissant", note: "glisser une pièce devant une interface compatible : l'accouplement se fait au relâchement" },
];

const TOL = 0.01, DIA = 0.05, FULL = 2 * Math.PI - 0.02, DOWELS = [1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12];
const r2 = (x) => Math.round(x * 100) / 100 + 0;
const near = (a, b, t = TOL) => Math.abs(a - b) <= t;
const fr = (x) => String(r2(x)).replace(".", ",");
const AX = ["X", "Y", "Z"], faceOf = (k, s) => `${s > 0 ? "+" : "-"}${AX[k]}`;
const planeAxes = (k) => FACES[faceOf(k, 1)].plane;
const clone = (x) => JSON.parse(JSON.stringify(x));

/** The ISO metric screws whose clearance hole, tap drill or basic minor diameter is this diameter — closest first.
    → [{ screw, kind: "clearance" | "tap", fit?, gap }] */
export function screwsFor(d) {
  const out = [];
  for (const [screw, t] of Object.entries(THREADS)) {
    t.clr.forEach((c, i) => { if (near(c, d, DIA)) out.push({ screw, kind: "clearance", fit: ["fine", "medium", "coarse"][i], gap: Math.abs(c - d) }); });
    const minor = t.d - 1.082532 * t.p;
    for (const m of [t.tap, minor]) if (near(m, d, DIA) && !out.some((o) => o.screw === screw && o.kind === "tap")) out.push({ screw, kind: "tap", gap: Math.abs(m - d) });
  }
  return out.sort((a, b) => a.gap - b.gap);
}

/* the pieces of one cylinder put back together : a face split in two halves (same range), or two full lengths end to end */
function mergeCyls(list) {
  const out = [];
  for (const c of list) {
    const same = (x) => x.axis === c.axis && near(x.r, c.r) && near(x.c[0], c.c[0]) && near(x.c[1], c.c[1]);
    const half = out.find((x) => same(x) && near(x.lo, c.lo) && near(x.hi, c.hi) && x.sweep + c.sweep <= 2 * Math.PI + 0.02);
    if (half) { half.sweep += c.sweep; half.area += c.area; continue; }
    const end = out.find((x) => same(x) && x.sweep >= FULL && c.sweep >= FULL && c.lo <= x.hi + TOL && c.hi >= x.lo - TOL);
    if (end) { end.lo = Math.min(end.lo, c.lo); end.hi = Math.max(end.hi, c.hi); continue; }
    out.push({ ...c });
  }
  return out;
}
const inBox = (box, k, c, pad = TOL) => { const [p, q] = planeAxes(k); return box[p] - pad <= c[0] && c[0] <= box[3 + p] + pad && box[q] - pad <= c[1] && c[1] <= box[3 + q] + pad; };
const planeAt = (found, k, s, level, c) => (found.planes || []).filter((p) => p.axis === k && p.sign === s && near(p.level, level) && inBox(p.box, k, c));

/** The holes : full hole walls on one axis, a counterbore kept with its hole, and the faces they open on.
    → [{ axis, c, d, lo, hi, entries: { lo, hi }, cbore: { d, depth, end } | null }] ; `partial` counts the walls that do not go round */
export function holesOf(found) {
  const walls = mergeCyls((found.cyls || []).filter((c) => c.inner)), full = walls.filter((c) => c.sweep >= FULL), out = [];
  const lines = [];
  for (const c of full) { const l = lines.find((x) => x.axis === c.axis && near(x.c[0], c.c[0]) && near(x.c[1], c.c[1])); if (l) l.list.push(c); else lines.push({ axis: c.axis, c: c.c, list: [c] }); }
  for (const l of lines) {
    const chains = [];      // the walls of one line that follow one another make one hole ; a gap starts another
    for (const c of l.list.sort((a, b) => a.lo - b.lo)) { const last = chains[chains.length - 1]; if (last && c.lo <= last.hi + TOL) { last.list.push(c); last.hi = Math.max(last.hi, c.hi); } else chains.push({ lo: c.lo, hi: c.hi, list: [c] }); }
    for (const ch of chains) {
      const bore = ch.list.reduce((a, b) => (b.r < a.r ? b : a)), big = ch.list.filter((c) => c.r > bore.r + TOL);
      const cb = big.find((c) => near(c.lo, ch.lo)) || big.find((c) => near(c.hi, ch.hi)) || null;
      out.push({ axis: l.axis, c: l.c, d: r2(2 * bore.r), lo: ch.lo, hi: ch.hi, entries: { lo: planeAt(found, l.axis, -1, ch.lo, l.c).length > 0, hi: planeAt(found, l.axis, 1, ch.hi, l.c).length > 0 },
        cbore: cb ? { d: r2(2 * cb.r), depth: r2(cb.hi - cb.lo), end: near(cb.lo, ch.lo) ? "lo" : "hi" } : null });
    }
  }
  out.partial = walls.length - full.length;
  return out;
}

/** The shafts : a full outer cylinder ended by a disc no wider than itself, standing on a wider face (a shoulder).
    → [{ axis, sign (the way it points), c, d, base (level of the shoulder), length }] */
export function shaftsOf(found) {
  const out = [];
  for (const c of mergeCyls((found.cyls || []).filter((x) => !x.inner)).filter((x) => x.sweep >= FULL)) {
    const [p, q] = planeAxes(c.axis), disc = (pl) => pl.box[3 + p] - pl.box[p] <= 2 * c.r + TOL && pl.box[3 + q] - pl.box[q] <= 2 * c.r + TOL, wide = (pl) => !disc(pl);
    for (const s of [1, -1]) {
      const tip = s > 0 ? c.hi : c.lo, base = s > 0 ? c.lo : c.hi;
      if (planeAt(found, c.axis, s, tip, c.c).some(disc) && planeAt(found, c.axis, s, base, c.c).some(wide)) { out.push({ axis: c.axis, sign: s, c: c.c, d: r2(2 * c.r), base, length: r2(Math.abs(tip - base)) }); break; }
    }
  }
  return out;
}

/** A set of points of a face (frame coordinates) as a pattern of the platform, about their middle. → { pattern, centre: [u, v] } */
export function patternOf(pts) {
  const n = pts.length, cu = pts.reduce((s, p) => s + p[0], 0) / n, cv = pts.reduce((s, p) => s + p[1], 0) / n, rel = pts.map(([u, v]) => [r2(u - cu), r2(v - cv)]);
  if (n === 1) return { pattern: { type: "single" }, centre: [cu, cv] };
  const uniq = (xs) => xs.sort((a, b) => a - b).filter((x, i, a) => i === 0 || !near(x, a[i - 1], 0.02)), even = (xs) => xs.every((x, i) => i < 2 || near(x - xs[i - 1], xs[1] - xs[0], 0.02));
  const U = uniq(rel.map((p) => p[0])), V = uniq(rel.map((p) => p[1]));
  if (U.length * V.length === n && even(U) && even(V) && U.every((u) => V.every((v) => rel.some((p) => near(p[0], u, 0.02) && near(p[1], v, 0.02)))))
    return { pattern: { type: "rect", nx: U.length, ny: V.length, dx: U.length > 1 ? r2(U[1] - U[0]) : 0, dy: V.length > 1 ? r2(V[1] - V[0]) : 0 }, centre: [cu, cv] };
  if (n >= 3) {
    const R = Math.hypot(...rel[0]), ang = rel.map(([u, v]) => ((Math.atan2(v, u) * 180 / Math.PI) + 360) % 360).sort((a, b) => a - b);
    if (R > 0.5 && rel.every((p) => near(Math.hypot(...p), R, 0.02)) && ang.every((a, i) => i === 0 || near(a - ang[i - 1], 360 / n, 0.05))) return { pattern: { type: "circle", n, pcd: r2(2 * R), start: r2(ang[0]) }, centre: [cu, cv] };
  }
  return { pattern: { type: "points", pts: rel }, centre: [cu, cv] };
}
/** A point met at (lu, lv) of the frame of a face (not turned), as the pattern of an interface turned by `rot` writes it — side B mirrors v. */
export function toPattern([lu, lv], rot = 0, side = "A") {
  const a = rot * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), qv = -lu * s + lv * c;
  return [r2(lu * c + lv * s), r2(side === "B" ? -qv : qv)];
}
const sameSet = (P, Q) => P.length === Q.length && P.every((p) => Q.some((q) => near(p[0], q[0], 0.02) && near(p[1], q[1], 0.02)));

/* where a point of a face lies, in the frame of that face (u, v) and back : the 3D point is at `level` along the axis */
const local = (F, k, c, level) => { const P = [0, 0, 0], [p, q] = planeAxes(k); P[p] = c[0]; P[q] = c[1]; P[k] = level; return [v3.dot(P, F.u), v3.dot(P, F.v)]; };
const atOf = (F, k, uv, level) => { const P = v3.add(v3.add(v3.mul(F.u, uv[0]), v3.mul(F.v, uv[1])), v3.mul(F.n, level * F.n[k])); return [r2(P[F.plane[0]]), r2(P[F.plane[1]])]; };

/* one interface of a pattern of points on a face ; others : free interfaces of the project to line up with */
function onFace(type, side, k, s, level, centres, params, opts, others) {
  const face = faceOf(k, s), F = FACES[face], L = centres.map((c) => local(F, k, c, level)), { pattern, centre } = patternOf(L.map(([u, v]) => [u, side === "B" ? -v : v]));
  const C = [centre[0], side === "B" ? -centre[1] : centre[1]], rel = L.map(([u, v]) => [u - C[0], v - C[1]]);
  const it = { type, side, face, at: atOf(F, k, C, level), level: r2(level), params: { ...params, ...(type === "bolt_pattern" ? { pattern } : {}) }, opts };
  if (type === "pins" && L.length === 2) { it.rot = r2(((Math.atan2(rel[1][1] - rel[0][1], rel[1][0] - rel[0][0]) * 180 / Math.PI) + 360) % 180); if (!it.rot) delete it.rot; }
  if (type !== "bolt_pattern") return it;
  for (const o of others) {      // the pattern of a neighbour, turned : take it as it is written there
    if (o.type !== type || (o.side === "B") === (side === "B") || String((o.params || {}).screw).toUpperCase() !== String(params.screw).toUpperCase()) continue;
    let T; try { T = patternPoints((o.params || {}).pattern); } catch (e) { continue; }
    const g = [T.reduce((a, p) => a + p[0], 0) / T.length, T.reduce((a, p) => a + p[1], 0) / T.length], Tc = T.map(([u, v]) => [u - g[0], v - g[1]]);
    for (const rot of [0, 90, 180, 270]) {
      if (!sameSet(rel.map((p) => toPattern(p, rot, side)), Tc)) continue;
      const a = rot * Math.PI / 180, uR = v3.add(v3.mul(F.u, Math.cos(a)), v3.mul(F.v, Math.sin(a))), vR = v3.add(v3.mul(F.u, -Math.sin(a)), v3.mul(F.v, Math.cos(a)));
      const shift = v3.add(v3.mul(uR, g[0]), v3.mul(vR, side === "B" ? -g[1] : g[1])), Cw = v3.add(v3.mul(F.u, C[0]), v3.mul(F.v, C[1]));      // the origin of the neighbour's pattern, on this face
      const O = v3.sub(Cw, shift);
      return { ...it, at: atOf(F, k, [v3.dot(O, F.u), v3.dot(O, F.v)], level), ...(rot ? { rot } : {}), params: { ...it.params, pattern: clone(o.params.pattern) }, like: `${o.part || "?"} · ${o.id || o.name || ""}`.trim() };
    }
  }
  return it;
}

/** What the tool proposes for a part read from a file. found : what readFeatures gave ; o : { have (the interfaces the part has), others
    (free interfaces of the project : { part, id, type, side, params }), dropped (signatures a person set aside) }.
    → { proposals: [interface spec + { name, why, found, proposed, on, alt? }], unread: [text], counts } */
export function proposeInterfaces(found, o = {}) {
  const have = o.have || [], others = o.others || [], dropped = new Set(o.dropped || []), proposals = [], unread = [], used = new Set(have.map((i) => i.id));
  const holes = holesOf(found), shafts = shaftsOf(found);
  const groups = [];
  for (const h of holes) {
    if (!h.entries.lo && !h.entries.hi) { unread.push(`Un trou Ø${fr(h.d)} (axe ${AX[h.axis]}) n'ouvre sur aucune face plane : non proposé.`); continue; }
    const key = [h.axis, h.d, h.entries.lo ? r2(h.lo) : "", h.entries.hi ? r2(h.hi) : "", h.cbore ? `${h.cbore.d}@${h.cbore.end}` : ""].join("|");
    const g = groups.find((x) => x.key === key); if (g) g.list.push(h); else groups.push({ key, h, list: [h] });
  }
  const make = (g, type, side, params, opts, why) => {
    const h = g.h, ends = [h.entries.lo && "lo", h.entries.hi && "hi"].filter(Boolean), through = ends.length === 2;
    const first = h.cbore && through ? (h.cbore.end === "lo" ? "hi" : "lo") : side === "B" && !through ? ends[0] : "lo";      // the head sits in the counterbore : the part meets its neighbour on the other face
    const one = (end) => ({ ...onFace(type, side, h.axis, end === "lo" ? -1 : 1, end === "lo" ? h.lo : h.hi, g.list.map((x) => x.c), params, typeof opts === "function" ? opts(end) : opts, others), found: true, proposed: true });
    const p = one(ends.includes(first) ? first : ends[0]);
    if (through && !h.cbore) p.alt = one(p.face[0] === "-" ? "hi" : "lo");
    p.why = why; return p;
  };
  for (const g of groups) {
    const h = g.h, n = g.list.length, through = h.entries.lo && h.entries.hi, depth = r2(h.hi - h.lo), S = screwsFor(h.d), s = through ? S[0] : S.find((x) => x.kind === "tap"), where = `${n} trou${n > 1 ? "s" : ""} Ø${fr(h.d)}${through ? " traversant" + (n > 1 ? "s" : "") : ` borgne${n > 1 ? "s" : ""} de ${fr(depth)} mm`}${h.cbore ? `, lamé${n > 1 ? "s" : ""} Ø${fr(h.cbore.d)}` : ""}`;
    if (s) {      // a blind hole is threaded, never a clearance
      const A = s.kind === "clearance";
      proposals.push(make(g, "bolt_pattern", A ? "A" : "B", { screw: s.screw }, A ? { fit: s.fit, head: h.cbore ? "cbore" : "none", depth: "through" } : { thread: "tapped", depth: through ? "through" : depth },
        `${where} : ${A ? `passage ${s.fit} d'une vis ${s.screw} (table de l'outil)` : `perçage de taraudage ${s.screw} (foret ${fr(THREADS[s.screw].tap)}, ou diamètre intérieur ISO ${fr(THREADS[s.screw].d - 1.082532 * THREADS[s.screw].p)})`}.`));
      proposals[proposals.length - 1].name = `${n} × ${s.screw} ${A ? "clearance" : "tapped"}`;
    } else if (n === 2 && DOWELS.some((x) => near(x, h.d, 0.03))) {
      const pitch = r2(Math.hypot(g.list[0].c[0] - g.list[1].c[0], g.list[0].c[1] - g.list[1].c[1])), side = through ? "A" : "B";
      proposals.push({ ...make(g, "pins", side, { d: h.d, pitch, n: 2, length: r2(Math.max(6, 2 * depth)) }, { depth: through ? "through" : depth }, `${where}, à ${fr(pitch)} mm l'un de l'autre : des goupilles Ø${fr(h.d)} (${through ? "trous glissants" : "trous où elles sont chassées"}) — la longueur de goupille est un exemple.`), name: `Dowel holes 2 × Ø${fr(h.d)}` });
    } else if (n === 1 && h.d >= 3) {
      proposals.push({ ...make(g, "fit", "B", { d: h.d, length: through ? depth : r2(Math.max(0.5, depth - 0.5)), fit: "H7/g6" }, { depth: through ? "through" : depth }, `${where} qu'aucune vis de la table n'explique : un alésage — l'ajustement H7/g6 est un exemple.`), name: `Bore Ø${fr(h.d)}` });
    } else unread.push(`${where} : ni vis, ni goupille de la table n'a ce diamètre — non proposé${n > 1 ? "s" : ""}.`);
  }
  for (const sh of shafts) {
    const p = { ...onFace("fit", "A", sh.axis, sh.sign, sh.base, [sh.c], { d: sh.d, length: sh.length, fit: "H7/g6" }, {}, others), found: true, proposed: true, name: `Shaft Ø${fr(sh.d)}`,
      why: `Un cylindre Ø${fr(sh.d)} de ${fr(sh.length)} mm, sur un épaulement, fini par un disque : un arbre — l'ajustement H7/g6 est un exemple.` };
    proposals.push(p);
  }
  /* the largest flat face of the outside of the part */
  const bb = found.bbox || [0, 0, 0, 0, 0, 0], outer = (found.planes || []).filter((p) => near(p.level, p.sign > 0 ? bb[3 + p.axis] : bb[p.axis])).sort((a, b) => b.area - a.area)[0];
  if (outer) {
    const [p, q] = planeAxes(outer.axis), side = (bb[3 + p] - bb[p]) * (bb[3 + q] - bb[q]);
    if (side > 0 && outer.area >= 0.25 * side) {
      const face = faceOf(outer.axis, outer.sign), F = FACES[face], c = [(outer.box[p] + outer.box[3 + p]) / 2, (outer.box[q] + outer.box[3 + q]) / 2];
      const span = (d) => r2(Math.abs(d[0]) * (outer.box[3] - outer.box[0]) + Math.abs(d[1]) * (outer.box[4] - outer.box[1]) + Math.abs(d[2]) * (outer.box[5] - outer.box[2]));
      proposals.push({ type: "planar", side: "A", face, at: [r2(c[0]), r2(c[1])], level: r2(outer.level), params: { w: span(F.u), h: span(F.v) }, opts: {}, found: true, proposed: true, on: false, name: `Flat face ${face}`,
        why: `La plus grande face plane du dehors (${fr(span(F.u))} × ${fr(span(F.v))} mm, face ${face}) : un appui plan — il ne s'accouple qu'à un appui plan des mêmes dimensions, d'où Off d'office.` });
    }
  }
  if (holes.partial) unread.push(`${holes.partial} paroi${holes.partial > 1 ? "s" : ""} de trou qui ne fai${holes.partial > 1 ? "ont" : "t"} pas le tour (un trou coupé par un autre, une rainure) : non proposée${holes.partial > 1 ? "s" : ""}.`);
  if (found.slanted) unread.push(`${found.slanted} face${found.slanted > 1 ? "s" : ""} plane${found.slanted > 1 ? "s" : ""} ou cylindrique${found.slanted > 1 ? "s" : ""} hors des axes de la pièce : l'outil ne pose une interface que sur une face qui regarde le long d'un axe.`);
  /* what the part already has, or what a person set aside, is not proposed again */
  const sig = (it) => proposalKey(it), seen = new Set(have.map(sig));
  const out = proposals.filter((p) => !seen.has(sig(p)) && !dropped.has(sig(p)) && !(p.alt && (seen.has(sig(p.alt)) || dropped.has(sig(p.alt)))));
  let n = 0; for (const p of out) { do { n++; } while (used.has(`IF${n}`)); p.id = `IF${n}`; if (p.alt) p.alt.id = p.id; if (p.on === undefined) p.on = true; }
  return { proposals: out, unread, counts: { faces: found.faces || 0, planes: (found.planes || []).length, cyls: (found.cyls || []).length, holes: holes.length, shafts: shafts.length } };
}
/** A proposal said in one key : its type, face, place and shared parameters — what is not proposed twice. */
export function proposalKey(it) { let s = ""; try { s = interfaceSignature(it); } catch (e) { s = JSON.stringify(it.params || {}); } return [it.type, it.side || "A", it.face, (it.at || []).map(r2).join(","), r2(it.level || 0), s].join("|"); }

/** The proposals chosen, written into the part (in place) : what is On is confirmed, what is Off stays a proposal to confirm later.
    picks : [{ p (a proposal), on, flip (take its other face) }] ; read : what the kernel read, kept as a summary. → the interfaces added */
export function applyProposals(spec, picks, read = null) {
  spec.interfaces = spec.interfaces || []; const added = [];
  for (const k of picks) {
    const src = k.flip && k.p.alt ? { ...k.p.alt, name: k.p.name, why: k.p.why } : k.p, it = clone(src);
    delete it.alt; delete it.on; delete it.like;
    if (k.on) delete it.proposed; else it.proposed = true;
    spec.interfaces.push(it); added.push(it);
  }
  if (read) spec.imported = { ...(spec.imported || {}), read };
  return added;
}
/** A proposal confirmed by a person : it now mates and counts. */
export function confirmInterface(spec, id) { const it = (spec.interfaces || []).find((i) => i.id === id); if (it) delete it.proposed; return !!it; }
/** A proposal set aside : removed, and not proposed again by the next reading. */
export function dropProposal(spec, id) {
  const it = (spec.interfaces || []).find((i) => i.id === id); if (!it) return false;
  spec.interfaces = spec.interfaces.filter((i) => i !== it); spec.imported = { ...(spec.imported || {}), dropped: [...new Set([...((spec.imported || {}).dropped || []), proposalKey(it)])] };
  return true;
}
/** What was read, in a few numbers, as the part keeps it (spec.imported.read). */
export const readSummary = (found, r, at) => ({ at, faces: found.faces || 0, holes: r.counts.holes, shafts: r.counts.shafts, proposed: r.proposals.length, unread: r.unread.slice(0, 8) });
/** The free interfaces of a project another part could line up with : { part, id, type, side, params }. */
export const projectInterfaces = (parts, except) => (parts || []).filter((p) => p && p.id !== except).flatMap((p) => (p.interfaces || []).filter((i) => i && !i.proposed).map((i) => ({ part: p.id, id: i.id, type: i.type, side: i.side || "A", params: i.params || {} })));
