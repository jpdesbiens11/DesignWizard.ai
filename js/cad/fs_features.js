/* DesignWizard.ai — FeatureScript export (see featurescript.js), features: one emitter per operation of the part language
   (box, cylinder, extrude, revolve, hole, pocket, pad, slot, boss, shell, fillet, chamfer). The hole / pocket / pad / boss
   emitters are also used by the interfaces. An operation that cannot be converted throws Skip. */

import { FACES, PLANES, faceKey } from "./vec.js";
import { THREADS } from "./standards.js";
import { Skip, P_MUL, wrap, K, V, neg, add, sub, mul, div, tand, mm, vecMm, dirFs, created, pos } from "./fs_expr.js";
import { onFace, apply, levelSym, throughDepth, emitPos, loopHead, toolInLoop, drawProfile, sketchExtrude, axisOf } from "./fs_gen.js";

const EMIT = {
  box(G, f) {
    const N = G.next(), s = f.size || [f.x, f.y, f.z];
    const size = [0, 1, 2].map((i) => pos(G.S(s[i], `box size[${i}]`), `box size[${i}]`));
    const min = f.center ? [0, 1, 2].map((i) => sub(G.S(f.center[i], "box center"), div(size[i], K(2)))) : [0, 1, 2].map((i) => G.S((f.at || [0, 0, 0])[i] ?? 0, "box at"));
    G.call("fCuboid", `id + "box${N}"`, [["corner1", vecMm(min)], ["corner2", vecMm(min.map((m, i) => add(m, size[i])))]]);
    apply(G, f, created(`id + "box${N}"`), N);
  },
  cylinder(G, f) {
    const N = G.next(), a = axisOf(G, f.axis), base = [0, 1, 2].map((i) => G.S((f.at || [0, 0, 0])[i] ?? 0, "cylinder at"));
    const h = pos(G.S(f.h ?? f.length, "cylinder h"), "cylinder h"), d = pos(G.S(f.d, "cylinder d"), "cylinder d");
    const centered = f.centered ? G.frozen(f.centered, "« centered »") : 0;
    const bottom = base.map((b, i) => (centered ? sub(b, mul(K(a[i] / 2), h)) : b)), top = bottom.map((b, i) => add(b, mul(K(a[i]), h)));
    G.call("fCylinder", `id + "cylinder${N}"`, [["bottomCenter", vecMm(bottom)], ["topCenter", vecMm(top)], ["radius", mm(div(d, K(2)))]]);
    apply(G, f, created(`id + "cylinder${N}"`), N);
  },
  extrude(G, f) {
    const N = G.next(), P = PLANES[String(f.plane || "XY").toUpperCase()];
    if (!P) throw new Skip(`plan inconnu « ${f.plane} » (XY, XZ ou YZ)`);
    const len = G.S(f.length ?? f.h, "extrude length");
    if (!(Math.abs(len.v) > 1e-6)) throw new Skip("extrude : longueur nulle");
    let at = G.S(f.at ?? 0, "extrude at");
    if (f.symmetric && G.frozen(f.symmetric, "« symmetric »")) at = sub(at, div(len, K(2)));
    const back = len.v < 0;
    if (back && !len.c) G.warn(`extrude « ${f.id} » : la longueur est négative aujourd'hui ; le sens d'extrusion est figé à la génération.`);
    const q = sketchExtrude(G, N, P.axis, at, f.profile, back ? P.n.map((c) => -c) : P.n, back ? neg(len) : len, `extrude « ${f.id} »`);
    apply(G, f, q, N);
  },
  revolve(G, f) {
    const N = G.next(), P = PLANES[String(f.plane || "XZ").toUpperCase()];
    if (!P) throw new Skip(`plan inconnu « ${f.plane} »`);
    const a = axisOf(G, f.axis || "Z"), o = [0, 1, 2].map((i) => G.S((f.axis_at || [0, 0, 0])[i] ?? 0, "axis_at")), angle = G.S(f.angle ?? 360, "revolve angle");
    if (!(Math.abs(angle.v) > 1e-6)) throw new Skip("revolve : angle nul");
    const back = angle.v < 0, sk = G.sketch(N, P.axis, K(0));
    drawProfile(G, sk.v, f.profile, `revolve « ${f.id} »`);
    G.call("opRevolve", `id + "revolve${N}"`, [["entities", `qSketchRegion(${sk.id}, true)`], ["axis", `line(${vecMm(o)}, ${dirFs(back ? a.map((c) => -c) : a)})`], ["angleForward", `${wrap(back ? neg(angle) : angle, P_MUL)} * degree`]]);
    if (!(angle.c && Math.abs(Math.abs(angle.v) - 360) < 1e-9)) G.warn(`revolve « ${f.id} » : révolution partielle, sens de rotation à vérifier dans Onshape.`);
    apply(G, f, created(`id + "revolve${N}"`), N);
  },
  hole(G, f) { emitHole(G, f, null, G.next()); },
  pocket(G, f) { emitPocket(G, f, G.next()); },
  pad(G, f) { emitPad(G, f, G.next()); },
  slot(G, f) {
    const a = f.from, b = f.to;
    if (!a || !b) throw new Skip("slot : « from » et « to » requis");
    emitPocket(G, { ...f, slot: [a[0], a[1], b[0], b[1], f.w], profile: undefined, rect: undefined, circle: undefined }, G.next());
  },
  boss(G, f) { emitBoss(G, f, null, G.next()); },
  coil(G, f) { throw new Skip("serpentin (coil) : à faire dans Onshape — une hélice sur un cylindre ou un cône, puis un balayage du tube le long d'elle"); },
  arch(G, f) { throw new Skip("lame en pont (arch) : à former dans Onshape — une esquisse en arc sur le chant, extrudée sur la largeur de la lame"); },
  shell(G, f) {
    const N = G.next(), body = G.bodyQ(f.body), t = pos(G.S(f.t, "shell t"), "shell t");
    const faces = [].concat(f.open || ["+Z"]).map((k) => `dwPlanarFaces(context, ${body}, ${dirFs(FACES[faceKey(k)].n)})`);
    G.use("faces");
    G.call("opShell", `id + "shell${N}"`, [["entities", faces.length === 1 ? faces[0] : `qUnion([${faces.join(", ")}])`], ["thickness", mm(neg(t))]]);
  },
  /* the moulded tub, written straight : a box, its radii, a shell. Its draft is left to Onshape (Draft on the side faces). */
  tub(G, f) {
    EMIT.box(G, { id: f.id, body: f.body, size: f.size });
    if (f.rc) dressUp(G, { id: f.id, body: f.body, r: f.rc, edges: "vertical" }, "fillet");
    if (f.rf) dressUp(G, { id: f.id, body: f.body, r: f.rf, edges: { face: "-Z" } }, "fillet");
    EMIT.shell(G, { id: f.id, body: f.body, t: f.wall ?? f.t, open: ["+Z"] });
    if (f.draft) G.emit(`// dépouille de ${typeof f.draft === "string" ? f.draft : `${f.draft}°`} : à appliquer dans Onshape (Draft, plan neutre au bord supérieur)`);
  },
  draft(G, f) { throw new Skip("dépouille : à appliquer dans Onshape (fonction Draft)"); },
  fillet(G, f) { dressUp(G, f, "fillet"); },
  chamfer(G, f) { dressUp(G, f, "chamfer"); },
};

function emitHole(G, f, pts, N) {
  const F = FACES[faceKey(f.face || "+Z")], s = F.n[F.axis], body = G.bodyQ(f.body);
  let d;
  if (f.d !== undefined && f.d !== null) d = G.S(f.d, "hole d");
  else if (f.thread) {
    const th = THREADS[String(f.thread).toUpperCase()];
    if (!th) throw new Skip(`filetage inconnu « ${f.thread} »`);
    d = K(th.tap);
  } else throw new Skip("hole : diamètre « d » manquant");
  pos(d, "hole d");
  const level = levelSym(G, N, f.start, F, f.body);
  const through = f.depth === undefined || f.depth === "through" || f.depth === "traversant";
  const depth = through ? throughDepth(G, N, F, body) : pos(G.S(f.depth, "hole depth"), "hole depth");
  const cb = f.cbore ? { d: pos(G.S(f.cbore.d, "cbore d"), "cbore d"), depth: pos(G.S(f.cbore.depth, "cbore depth"), "cbore depth") } : null;
  let cs = null;
  if (f.csink) {
    const D = pos(G.S(f.csink.d, "csink d"), "csink d"), t = tand(div(G.S(G.truthy(f.csink.angle) ? f.csink.angle : 90, "csink angle"), K(2))), hc = div(div(sub(D, d), K(2)), t);
    if (hc.v > 1e-3) cs = { hc, rTop: add(div(D, K(2)), mul(K(0.2), t)) };
  }
  const list = pts || emitPos(G, N, f.at), tools = `dwTools${N}`, u = V(`dwU${N}`), v = V(`dwV${N}`), top = onFace(F, u, v, add(level, K(0.2 * s)));
  G.emit(`var ${tools} = [];`);
  loopHead(G, N, list);
  toolInLoop(G, N, "fCylinder", "hole", tools, [["topCenter", vecMm(top)], ["bottomCenter", vecMm(onFace(F, u, v, sub(level, mul(K(s), depth))))], ["radius", mm(div(d, K(2)))]]);
  if (cb) toolInLoop(G, N, "fCylinder", "cbore", tools, [["topCenter", vecMm(top)], ["bottomCenter", vecMm(onFace(F, u, v, sub(level, mul(K(s), cb.depth))))], ["radius", mm(div(cb.d, K(2)))]]);
  if (cs) toolInLoop(G, N, "fCone", "csink", tools, [["topCenter", vecMm(top)], ["bottomCenter", vecMm(onFace(F, u, v, sub(level, mul(K(s), cs.hc))))], ["topRadius", mm(cs.rTop)], ["bottomRadius", mm(div(d, K(2)))]]);
  G.close();
  apply(G, f, `qUnion(${tools})`, N, "cut", tools);
}

function faceProfile(f, kinds) {
  if (f.profile) return f.profile;
  if (f.rect && kinds.includes("rect")) return { rect: f.rect, r: f.r };
  if (f.circle && kinds.includes("circle")) return { circle: f.circle };
  if (f.slot && kinds.includes("slot")) return { slot: f.slot };
  return null;
}

function emitPocket(G, f, N) {
  const F = FACES[faceKey(f.face || "+Z")], s = F.n[F.axis], body = G.bodyQ(f.body), def = faceProfile(f, ["rect", "circle", "slot"]);
  if (!def) throw new Skip("pocket : « profile », « rect », « circle » ou « slot » requis");
  const level = levelSym(G, N, f.start, F, f.body), through = f.depth === "through" || f.depth === "traversant";
  const depth = through ? throughDepth(G, N, F, body) : pos(G.S(f.depth, "pocket depth"), "pocket depth");
  const q = sketchExtrude(G, N, F.axis, add(level, K(0.2 * s)), def, F.n.map((c) => -c), add(depth, K(0.2)), `${f.op || "pocket"} « ${f.id} »`);
  apply(G, f, q, N, "cut");
}

function emitPad(G, f, N) {
  const F = FACES[faceKey(f.face || "+Z")], s = F.n[F.axis], def = faceProfile(f, ["rect", "circle"]);
  if (!def) throw new Skip("pad : « profile », « rect » ou « circle » requis");
  const h = pos(G.S(f.h, "pad h"), "pad h"), level = levelSym(G, N, f.start, F, f.body);
  const q = sketchExtrude(G, N, F.axis, sub(level, K(0.05 * s)), def, F.n, add(h, K(0.05)), `pad « ${f.id} »`);
  apply(G, f, q, N, "add");
}

function emitBoss(G, f, pts, N) {
  const F = FACES[faceKey(f.face || "+Z")], s = F.n[F.axis];
  const d = pos(G.S(f.d, "boss d"), "boss d"), h = pos(G.S(f.h, "boss h"), "boss h"), level = levelSym(G, N, f.start, F, f.body);
  let hole = null;
  if (f.hole) {
    const th = f.hole.thread ? THREADS[String(f.hole.thread).toUpperCase()] : null;
    const hd = f.hole.d !== undefined && f.hole.d !== null ? pos(G.S(f.hole.d, "boss hole d"), "boss hole d") : (th ? K(th.tap) : null);
    if (!hd) throw new Skip("boss : « hole.d » ou « hole.thread » requis");
    const through = f.hole.depth === "through";
    hole = { d: hd, depth: through ? add(h, K(50)) : pos(G.S(f.hole.depth ?? h, "boss hole depth"), "boss hole depth") };
  }
  const list = pts || emitPos(G, N, f.at), tools = `dwTools${N}`, u = V(`dwU${N}`), v = V(`dwV${N}`);
  G.emit(`var ${tools} = [];`);
  loopHead(G, N, list);
  const tip = f.tip === undefined || f.tip === null ? null : pos(G.S(f.tip, "boss tip"), "boss tip");      // a pointed boss : a cone from d at the foot to « tip » at the top
  if (tip) toolInLoop(G, N, "fCone", "boss", tools, [["bottomCenter", vecMm(onFace(F, u, v, level))], ["topCenter", vecMm(onFace(F, u, v, add(level, mul(K(s), h))))], ["bottomRadius", mm(div(d, K(2)))], ["topRadius", mm(div(tip, K(2)))]]);
  else toolInLoop(G, N, "fCylinder", "boss", tools, [["bottomCenter", vecMm(onFace(F, u, v, sub(level, K(0.05 * s))))], ["topCenter", vecMm(onFace(F, u, v, add(level, mul(K(s), h))))], ["radius", mm(div(d, K(2)))]]);
  G.close();
  apply(G, f, `qUnion(${tools})`, N, "add", tools);
  if (hole) {
    const cuts = `dwCuts${N}`;
    G.emit(`var ${cuts} = [];`);
    loopHead(G, N, list, "M");
    toolInLoop(G, N, "fCylinder", "bossHole", cuts, [["topCenter", vecMm(onFace(F, u, v, add(level, mul(K(s), add(h, K(0.2))))))], ["bottomCenter", vecMm(onFace(F, u, v, add(level, mul(K(s), sub(h, hole.depth)))))], ["radius", mm(div(hole.d, K(2)))]], "M");
    G.close();
    apply(G, f, `qUnion(${cuts})`, N, "cut", cuts);
  }
}

/** Edge selector of the part language -> FeatureScript query (or Skip when it has no translation). */
function edgeQuery(G, f, body) {
  let sel = f.edges;
  if (typeof sel === "string") {
    const k = sel.toLowerCase();
    if (k === "all") sel = null;
    else if (k === "vertical" || k === "verticales") sel = { dir: "Z" };
    else if (["top", "bottom", "front", "back", "left", "right", "+z", "-z", "+x", "-x", "+y", "-y"].includes(k)) sel = { face: sel };
    else throw new Skip(`sélection d'arêtes « ${sel} » sans traduction FeatureScript`);
  }
  if (sel === undefined || sel === null || (typeof sel === "object" && !Object.keys(sel).length)) {
    G.warn(`${f.op} « ${f.id} » : toutes les arêtes du corps sont sélectionnées ; Onshape peut refuser l'opération si certaines sont déjà tangentes (congés existants) ou trop courtes.`);
    return `qOwnedByBody(${body}, EntityType.EDGE)`;
  }
  if (typeof sel !== "object") throw new Skip("sélection d'arêtes non comprise");
  const unknown = Object.keys(sel).filter((k) => !["dir", "face", "level", "box", "near", "tol"].includes(k));
  if (unknown.length) throw new Skip(`sélection d'arêtes sans traduction FeatureScript (critère${unknown.length > 1 ? "s" : ""} ${unknown.join(", ")})`);
  const F = sel.face ? FACES[faceKey(sel.face)] : null, byLevel = !!F && sel.level !== undefined && sel.level !== null;
  const box = sel.box ? sel.box.map((x, i) => G.S(x, `box[${i}]`).fs) : ["0", "0", "0", "0", "0", "0"];
  const near = sel.near ? sel.near.map((x, i) => G.S(x, `near[${i}]`).fs) : ["0", "0", "0"];
  if (sel.box && box.length !== 6) throw new Skip("sélection d'arêtes : box = [x0, y0, z0, x1, y1, z1]");
  if (sel.near && near.length !== 3) throw new Skip("sélection d'arêtes : near = [x, y, z]");
  G.use("edges");
  return `dwSelectEdges(context, ${body}, { "byDir" : ${!!sel.dir}, "dir" : ${dirFs(sel.dir ? axisOf(G, sel.dir) : [0, 0, 1])}, `
    + `"byFace" : ${!!F}, "axis" : ${F ? F.axis : 2}, "positive" : ${F ? F.n[F.axis] > 0 : true}, "byLevel" : ${byLevel}, "level" : ${byLevel ? G.S(sel.level, "level").fs : "0"}, `
    + `"byBox" : ${!!sel.box}, "box" : [${box.join(", ")}], "byNear" : ${!!sel.near}, "near" : [${near.join(", ")}], "tol" : ${G.S(sel.tol ?? 1, "tol").fs} })`;
}

function dressUp(G, f, kind) {
  const N = G.next(), body = G.bodyQ(f.body);
  const size = kind === "fillet" ? pos(G.S(f.r, "fillet r"), "fillet r") : pos(G.S(f.d ?? f.c, "chamfer d"), "chamfer d");
  G.emit(`const dwEdges${N} = ${edgeQuery(G, f, body)};`);
  G.emit(`if (size(evaluateQuery(context, dwEdges${N})) > 0)`);
  G.open();
  if (kind === "fillet") G.call("opFillet", `id + "fillet${N}"`, [["entities", `dwEdges${N}`], ["radius", mm(size)]]);
  else G.call("opChamfer", `id + "chamfer${N}"`, [["entities", `dwEdges${N}`], ["chamferType", "ChamferType.EQUAL_OFFSETS"], ["width", mm(size)]]);
  G.close();
}

export { EMIT, emitHole, emitPocket, emitPad, emitBoss };
