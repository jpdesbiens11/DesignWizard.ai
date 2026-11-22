/* DesignOrbit.ai — the stage of the photo studio : the product in a set (core/photo_sets.js), under lamps one places
   (core/photo_lights.js), in perspective, with the finish of each part and its labels. The mouse turns around it (drag),
   comes closer (wheel), slides (right drag or Shift + drag) ; a click says which part is under the pointer ; a lamp of the
   view is taken and pulled around the product. While something moves, one frame is drawn ; as soon as nothing does, the
   picture refines itself (core/photo_accum.js) : soft shadows, clean edges, dark hollows. A picture is taken at the size
   asked for, refined the same way, with the mark of the platform in its corner. Z is up. */

import * as THREE from "../../vendor/three/three.module.min.js";
import { patternPixels, boxUv, cameraFor } from "./render_looks.js";
import { LOGO, MARK, drawLogoCanvas } from "./brand.js";
import { PATTERNS } from "./look_patterns.js";
import { patternTexture as lookTexture } from "./look_paint.js";
import { SETS, validSet } from "./photo_sets.js";
import { buildSet, skyCanvas, skyDome } from "./photo_set_build.js";
import { LightRig } from "./photo_rig.js";
import { Accum } from "./photo_accum.js";

const FOV = 28, rad = (d) => d * Math.PI / 180, frac = (x) => x - Math.floor(x);
const patterns = new Map();
/** The tile of a pattern as a texture that repeats. */
function patternTexture(name) {
  if (Object.hasOwn(PATTERNS, name)) return lookTexture(name);      // a pattern of the look of a part (a camouflage) : in its colours
  if (patterns.has(name)) return patterns.get(name);
  const n = 128, px = patternPixels(name, n), c = document.createElement("canvas"); c.width = n; c.height = n; const g = c.getContext("2d"), img = g.createImageData(n, n);
  for (let k = 0; k < n * n; k++) { img.data[4 * k] = img.data[4 * k + 1] = img.data[4 * k + 2] = px[k]; img.data[4 * k + 3] = 255; } g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; patterns.set(name, t); return t;
}
const tick = () => new Promise((ok) => { let done = false; const go = () => { if (!done) { done = true; ok(); } }; requestAnimationFrame(go); setTimeout(go, 90); });      // a page in the background has no frames : the clock answers for them

export class RenderStage {
  /** o : { onPick(id, data), onView({ az, el, dist }), onLight(id, { az, el } | null, "take" | "move" | "done"), onRefine(done, total) } */
  constructor(host, o = {}) {
    this.host = host; this.o = o; this.alive = true; this.dirty = true; this.items = new Map(); this.bbox = [0, 0, 0, 100, 100, 100]; this.radius = 100; this.samples = 48; this.refined = 0; this.scale = 1; this.busy = false; this.stamp = 0;
    this.renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); this.renderer.toneMapping = THREE.NeutralToneMapping; this.renderer.toneMappingExposure = 1; this.renderer.outputColorSpace = THREE.SRGBColorSpace;      // the neutral curve keeps the colour of a paint
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; this.renderer.setClearColor(0x000000, 1);
    this.canvas = this.renderer.domElement; this.canvas.className = "dw-view-canvas rd-canvas"; this.canvas.tabIndex = 0; host.append(this.canvas);
    this.scene = new THREE.Scene(); this.root = new THREE.Group(); this.scene.add(this.root);
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 1, 1e6); this.camera.up.set(0, 0, 1);
    this.rig = new LightRig(this.scene); this.accum = new Accum(this.renderer); this.dome = skyDome(null, 1); this.scene.add(this.dome);
    this.view = { az: -35, el: 18, dist: 1000, target: new THREE.Vector3() }; this.raycaster = new THREE.Raycaster();
    this._bind(); this.obs = new ResizeObserver(() => this.resize()); this.obs.observe(host); this.resize(); this.setScene("studio");
    const loop = () => { if (!this.alive) return; if (!this.busy) this._tick(); requestAnimationFrame(loop); }; requestAnimationFrame(loop);
  }
  dispose() { this.alive = false; this.obs.disconnect(); this.clear(); if (this.set) { this.scene.remove(this.set.group); this.set.dispose(); } if (this.env) this.env.dispose(); if (this.skyTex) this.skyTex.dispose(); this.dome.geometry.dispose(); this.dome.material.dispose(); this.rig.dispose(); this.accum.dispose(); this.renderer.dispose(); this.canvas.remove(); }
  resize() { const w = Math.max(2, this.host.clientWidth), h = Math.max(2, this.host.clientHeight), pr = this.renderer.getPixelRatio(); this.w = w; this.h = h; this.renderer.setSize(w, h, false); this.accum.size(Math.round(w * pr), Math.round(h * pr), true); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.dirty = true; }
  clear() { for (const it of this.items.values()) { it.mesh.geometry.dispose(); if (it.mesh.material.map && it.own) it.mesh.material.map.dispose(); it.mesh.material.dispose(); this.root.remove(it.mesh); } this.items.clear(); this.dirty = true; }
  /** The set : its ground, its sky, what stands around. ground : false leaves the product alone in the sky ; scale : how large the product looks in the set. */
  setScene(id, ground = true, scale = 1) {
    id = validSet(id) || "studio"; scale = Math.max(0.3, Math.min(3, Number(scale) || 1));
    if (this.set && this.sceneId === id && this.hasGround === !!ground && this.scale === scale) return;
    if (this.set) { this.scene.remove(this.set.group); this.set.dispose(); }
    this.sceneId = id; this.hasGround = !!ground; this.scale = scale; this.set = buildSet(id, { pad: 1.25 * scale, ground: !!ground }); this.scene.add(this.set.group);
    this.scene.fog = new THREE.Fog(this.set.horizon, 1, 2); this.skyStale = true; this._fit(); this.dirty = true;
  }
  /* the set under the product : one unit of the set is the radius of the product, divided by the scale */
  _fit() {
    if (!this.set) return; const b = this.bbox, r = this.radius, u = r / this.scale, c = [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2], g = this.set.group;
    g.position.set(c[0], c[1], b[2] - r * 2e-4); g.scale.setScalar(u); this.scene.fog.near = this.set.fog[0] * u; this.scene.fog.far = this.set.fog[1] * u; this.reach = this.set.far * u;
    g.traverse((n) => { for (const m of n.material ? [n.material].flat() : []) if (m.bumpMap) m.bumpScale = (m.userData.bump || (m.userData.bump = m.bumpScale)) * u * 0.009; });
    this.dome.position.set(c[0], c[1], b[2]); this.dome.scale.setScalar(this.reach * 0.985); this.rig.frame(c, r);
  }
  /** The lights : the list of core/photo_lights.js, the light from everywhere, the light in hand. */
  setLights(lights, ambient, sel = null) { const S = SETS[this.sceneId], out = !!S.sky.sun; this.rig.set(lights, ambient, { sky: out ? new THREE.Color(S.sky.top).lerp(new THREE.Color("#ffffff"), 0.62) : "#ffffff", bounce: new THREE.Color(S.ground.color).multiplyScalar(0.42), sel }); this.skyStale = true; this.dirty = true; }
  showLamps(on) { if (this.rig.shown === !!on) return; this.rig.show(on); this.dirty = true; }
  selectLight(id) { this.rig.select(id); this.dirty = true; }
  /** A light moved while it is being dragged : the stage only — what is kept is written when the hand lets go. */
  moveLight(id, a) { this.rig.set(this.rig.lights.map((l) => (l.id === id ? { ...l, ...a } : l)), this.rig.ambient); this.skyStale = true; this.dirty = true; }
  setExposure(ev = 0) { this.renderer.toneMappingExposure = Math.pow(2, Math.max(-3, Math.min(3, Number(ev) || 0))); this.dirty = true; }
  setSamples(n) { this.samples = Math.max(1, Math.round(n) || 1); this.dirty = true; }
  /* the sky of the set with the sun where its light stands, and the surroundings the reflections show : the sky, and a bright patch where each lamp is */
  _sky(fast = false) {
    const S = SETS[this.sceneId], sun = this.rig.sun(), tex = new THREE.CanvasTexture(skyCanvas(this.sceneId, sun, fast ? 256 : 1024)); tex.colorSpace = THREE.SRGBColorSpace;
    if (this.skyTex) this.skyTex.dispose(); this.skyTex = tex; this.dome.material.map = tex; this.dome.material.needsUpdate = true; if (fast) return;
    const room = new THREE.Scene(), dome = skyDome(tex, 60); room.add(dome);
    const patch = (dir, angle, color) => { const m = new THREE.Mesh(new THREE.CircleGeometry(45 * Math.tan(rad(Math.min(40, angle))), 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(...color), side: THREE.DoubleSide })); m.position.set(dir[0] * 45, dir[1] * 45, dir[2] * 45); m.lookAt(0, 0, 0); room.add(m); };
    for (const p of this.rig.panels()) patch(p.dir, p.angle, p.color);
    if (S.room) patch([0, 0, 1], 38, [1, 1, 1].map((c) => c * (0.6 + 2 * this.rig.ambient)));                    // the ceiling of a studio : a wide soft light
    const pm = new THREE.PMREMGenerator(this.renderer), env = pm.fromScene(room, 0.03).texture; pm.dispose(); if (this.env) this.env.dispose(); this.env = env;
    room.traverse((n) => { if (n !== dome && n.geometry) { n.geometry.dispose(); n.material.dispose(); } }); dome.geometry.dispose(); dome.material.dispose();
    /* each surface takes of it what suits it : the product its reflections, the ground almost nothing — what is left in a shadow is the light of the sky, which the product hides */
    this.scene.traverse((n) => { for (const m of n.isMesh ? [n.material].flat() : []) if (m.isMeshStandardMaterial) { if (!m.envMap) m.needsUpdate = true; m.envMap = env; if (n.userData.id === undefined) m.envMapIntensity = m.isMeshPhysicalMaterial ? 1.5 : 0.12; } });
    this.skyStale = false;
  }
  /** What stands on the stage. items : [{ id, mesh: { pos, nrm, idx, uv }, matrix, look: { color, opacity, metal, rough, coat, pattern, period }, map (a canvas : a label), data }] ; bbox of the whole. */
  setContent(items, bbox) {
    this.clear(); this.bbox = bbox;
    for (const it of items) {
      const g = new THREE.BufferGeometry(), L = it.look || {}; g.setAttribute("position", new THREE.BufferAttribute(it.mesh.pos, 3)); g.setAttribute("normal", new THREE.BufferAttribute(it.mesh.nrm, 3)); g.setIndex(new THREE.BufferAttribute(it.mesh.idx, 1));
      let map = null, own = false;
      if (it.map && it.mesh.uv) { g.setAttribute("uv", new THREE.BufferAttribute(it.mesh.uv, 2)); map = new THREE.CanvasTexture(it.map); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8; own = true; }
      else if (L.pattern) { g.setAttribute("uv", new THREE.BufferAttribute(boxUv(it.mesh.pos, it.mesh.nrm, L.period || 20), 2)); map = patternTexture(L.pattern); }
      const clear = (L.opacity ?? 1) < 1, mat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(it.map ? "#ffffff" : L.color || "#a8b0b8"), map, metalness: it.map ? 0 : L.metal ?? 0.1, roughness: it.map ? 0.55 : L.rough ?? 0.6, clearcoat: it.map ? 0 : L.coat ?? 0, clearcoatRoughness: 0.08,
        envMap: this.env || null, envMapIntensity: 0.8, side: THREE.DoubleSide, transparent: clear || !!it.map, opacity: L.opacity ?? 1, depthWrite: !clear, polygonOffset: !!it.map, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
      const mesh = new THREE.Mesh(g, mat); mesh.matrixAutoUpdate = false; if (it.matrix) mesh.matrix.fromArray(it.matrix); mesh.castShadow = !clear && !it.map; mesh.receiveShadow = !it.map; mesh.userData = { id: it.id, data: it.data || null };
      this.root.add(mesh); this.items.set(it.id, { mesh, own });
    }
    this.radius = Math.max(1, Math.hypot(bbox[3] - bbox[0], bbox[4] - bbox[1], bbox[5] - bbox[2]) / 2); this._fit(); this.dirty = true;
  }
  /** Stands the camera at a point of view of core/render_looks.js (or at a kept view { az, el, dist }), for the picture as it is on the screen. */
  setShot(shot, aspect = this.w / this.h) { const c = cameraFor(this.bbox, shot, aspect, FOV); this.view.az = c.az; this.view.el = c.el; this.view.dist = c.dist; this.view.target.set(...c.target); this.dirty = true; }
  viewNow() { return { az: Math.round(this.view.az * 10) / 10, el: Math.round(this.view.el * 10) / 10, dist: Math.round(this.view.dist) }; }
  /** Rings the parts chosen : a light of their own, so that they stand out while one works. ids : the ids of the items. */
  highlight(ids = []) { const on = new Set(ids); for (const [id, it] of this.items) { it.mesh.material.emissive.set(on.has(id) ? "#ff8a3d" : "#000000"); it.mesh.material.emissiveIntensity = on.has(id) ? 0.35 : 0; } this.dirty = true; }
  _cam() { const v = this.view, az = rad(v.az), el = rad(v.el), floor = this.hasGround ? this.bbox[2] + this.radius * 0.06 : -Infinity; this.camera.position.set(v.target.x + Math.cos(el) * Math.cos(az) * v.dist, v.target.y + Math.cos(el) * Math.sin(az) * v.dist, Math.max(floor, v.target.z + Math.sin(el) * v.dist));      // a camera does not go under the ground
    this.camera.near = Math.max(1, v.dist / 200); this.camera.far = v.dist * 4 + (this.reach || this.radius * 40) * 2.2; this.camera.lookAt(v.target); this.camera.updateProjectionMatrix(); }
  /* one frame : the lamps of sample i of n, the camera moved by a fraction of a pixel, the scene drawn into the average */
  _frame(i, n, w = this.accum.w, h = this.accum.h) {
    this.rig.sample(i, n); if (n > 1) this.camera.setViewOffset(w, h, frac(0.5 + i * 0.7548776662466927) - 0.5, frac(0.5 + i * 0.5698402909980532) - 0.5, w, h); else this.camera.clearViewOffset();
    this._cam(); this.accum.add(this.scene, this.camera); this.camera.clearViewOffset();
  }
  _tick() {
    const now = performance.now();
    if (this.dirty) { this.dirty = false; const sun = this.rig.sun(), key = `${this.sceneId}|${sun ? `${sun.az}|${sun.el}|${sun.kelvin}` : ""}`; if (key !== this.skyKey) { this.skyKey = key; this._sky(true); this.skyStale = true; } this.accum.reset(); this._frame(0, 1); this.accum.present(); this.accum.reset(); this.refined = 0; this.stamp = now; this._tell(); return; }
    if (this.refined >= this.samples || this.samples < 2 || this.drag || now - this.stamp < 260) return;
    if (this.skyStale) { this._sky(false); return; }
    this._frame(this.refined, this.samples); this.refined++; if (this.refined >= Math.min(6, this.samples)) this.accum.present(); this._tell();
  }
  _tell() { if (this.o.onRefine) this.o.onRefine(this.refined, this.samples); }
  _ray(e) { const r = this.canvas.getBoundingClientRect(), p = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); this._cam(); this.camera.updateMatrixWorld(); this.raycaster.setFromCamera(p, this.camera); return this.raycaster; }
  _bind() {
    const c = this.canvas; let moved = 0; this.drag = null;
    c.addEventListener("contextmenu", (e) => e.preventDefault());
    c.addEventListener("pointerdown", (e) => { c.setPointerCapture(e.pointerId); const lamp = e.button === 0 && !e.shiftKey ? this.rig.pick(this._ray(e)) : null; this.drag = { x: e.clientX, y: e.clientY, pan: e.button === 2 || e.shiftKey, lamp }; moved = 0; if (lamp) { this.rig.select(lamp); this.dirty = true; if (this.o.onLight) this.o.onLight(lamp, null, "take"); } });
    c.addEventListener("pointermove", (e) => {
      if (!this.drag) { c.style.cursor = this.rig.pick(this._ray(e)) ? "grab" : ""; return; }
      const d = this.drag, dx = e.clientX - d.x, dy = e.clientY - d.y, v = this.view; d.x = e.clientX; d.y = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
      if (d.lamp) { const a = moved > 3 ? this.rig.drag(this._ray(e).ray, d.lamp) : null; if (a) { d.at = a; this.moveLight(d.lamp, a); if (this.o.onLight) this.o.onLight(d.lamp, a, "move"); } }
      else if (d.pan) { const k = v.dist * Math.tan(rad(FOV / 2)) * 2 / this.h, right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1); v.target.addScaledVector(right, -dx * k).addScaledVector(up, dy * k); }
      else { v.az -= dx * 0.4; v.el = Math.max(-85, Math.min(85, v.el + dy * 0.3)); } this.dirty = true; });
    c.addEventListener("pointerup", (e) => { const was = this.drag; this.drag = null; this.stamp = performance.now(); if (!was) return;
      if (was.lamp) { if (this.o.onLight) this.o.onLight(was.lamp, was.at || null, "done"); return; }
      if (moved < 4) { const hit = this.pick(e); if (this.o.onPick) this.o.onPick(hit ? hit.id : null, hit ? hit.data : null); } else if (this.o.onView) this.o.onView(this.viewNow()); });
    c.addEventListener("wheel", (e) => { e.preventDefault(); this.view.dist = Math.max(this.radius * 0.3, this.view.dist * Math.exp(e.deltaY * 0.0012)); this.dirty = true; if (this.o.onView) this.o.onView(this.viewNow()); }, { passive: false });
  }
  /** What is under the pointer : { id, data } of the nearest opaque item, or null. */
  pick(e) { const hit = this._ray(e).intersectObjects([...this.items.values()].map((i) => i.mesh), false)[0]; return hit ? { id: hit.object.userData.id, data: hit.object.userData.data } : null; }
  /** The picture, at w × h pixels : the stage drawn at that size and refined over `samples` frames, then the mark of the platform in the bottom
      left corner. o : { shot, samples, onStep(done, total), stop() → true to give up }. → a 2D canvas, or null when it was given up */
  async shoot(w, h, o = {}) {
    const pr = this.renderer.getPixelRatio(), keep = { ...this.view, target: this.view.target.clone() }, glow = [...this.items.values()].map((i) => i.mesh.material.emissiveIntensity), lamps = this.rig.shown, n = Math.max(1, o.samples || this.samples);
    this.busy = true; let out = null;
    try {
      for (const i of this.items.values()) i.mesh.material.emissiveIntensity = 0; this.rig.show(false); if (this.skyStale) this._sky(false);
      this.renderer.setPixelRatio(1); this.renderer.setSize(w, h, false); this.accum.size(w, h, n < 8); this.camera.aspect = w / h; if (o.shot) this.setShot(o.shot, w / h);
      let done = 0; for (; done < n; done++) { this._frame(done, n, w, h); if (done % 3 === 2 || done === n - 1) { if (o.onStep) o.onStep(done + 1, n); await tick(); if (!this.alive || (o.stop && o.stop())) break; } }
      if (done >= n && this.alive) {
        this.accum.present(); out = document.createElement("canvas"); out.width = w; out.height = h; const g = out.getContext("2d"); g.drawImage(this.canvas, 0, 0, w, h);
        const s = Math.max(22, Math.round(Math.min(w, h) * 0.042)), x = Math.round(s * 0.7), y = h - Math.round(s * 1.7);
        const under = g.getImageData(x, y, Math.min(w - x, s * 7), s).data; let lum = 0; for (let i = 0; i < under.length; i += 4) lum += 0.2126 * under[i] + 0.7152 * under[i + 1] + 0.0722 * under[i + 2]; lum /= (under.length / 4) * 255;
        const inkc = lum < 0.5 ? "#f2f4f6" : LOGO.ink;                                    // the mark is written light on a dark ground, dark on a light one
        drawLogoCanvas(g, x, y, s, inkc);
        g.fillStyle = inkc; g.globalAlpha = 0.86; g.font = `600 ${Math.round(s * 0.4)}px Helvetica, Arial, sans-serif`; g.textBaseline = "middle"; g.fillText(MARK, x + s * 1.2, y + s * 0.5); g.globalAlpha = 1;
      }
    } finally {
      if (this.alive) { this.renderer.setPixelRatio(pr); this.rig.show(lamps); Object.assign(this.view, { az: keep.az, el: keep.el, dist: keep.dist }); this.view.target.copy(keep.target); [...this.items.values()].forEach((i, k) => { i.mesh.material.emissiveIntensity = glow[k]; }); this.resize(); }
      this.busy = false;
    }
    return out;
  }
}
