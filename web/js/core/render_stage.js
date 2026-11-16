/* DesignWizard.ai — the stage of the marketing render : the product under studio light, in perspective, with the finish of
   each part, its labels, a ground that takes its shadow and a surrounding that its metals reflect. The mouse turns around
   it (drag), comes closer (wheel), slides (right drag or Shift + drag) ; a click says which part is under the pointer.
   A picture is taken at the size asked for, with the mark of the platform in its corner. What a finish, a scene or a
   point of view is : core/render_looks.js. Z is up. */

import * as THREE from "../../vendor/three/three.module.min.js";
import { SCENES, patternPixels, boxUv, cameraFor } from "./render_looks.js";
import { LOGO, MARK } from "./brand.js";

const FOV = 28, rad = (d) => d * Math.PI / 180;
const gradient = (top, bottom, h = 256) => { const c = document.createElement("canvas"); c.width = 4; c.height = h; const g = c.getContext("2d"), f = g.createLinearGradient(0, 0, 0, h); f.addColorStop(0, top); f.addColorStop(1, bottom); g.fillStyle = f; g.fillRect(0, 0, 4, h); return c; };
const patterns = new Map();
/** The tile of a pattern as a texture that repeats. */
function patternTexture(name) {
  if (patterns.has(name)) return patterns.get(name);
  const n = 128, px = patternPixels(name, n), c = document.createElement("canvas"); c.width = n; c.height = n; const g = c.getContext("2d"), img = g.createImageData(n, n);
  for (let k = 0; k < n * n; k++) { img.data[4 * k] = img.data[4 * k + 1] = img.data[4 * k + 2] = px[k]; img.data[4 * k + 3] = 255; } g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; patterns.set(name, t); return t;
}

export class RenderStage {
  /** o : { onPick(id, data), onView({ az, el, dist }) } */
  constructor(host, o = {}) {
    this.host = host; this.o = o; this.alive = true; this.dirty = true; this.items = new Map(); this.bbox = [0, 0, 0, 100, 100, 100];
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); this.renderer.toneMapping = THREE.NeutralToneMapping || THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = THREE.NeutralToneMapping ? 1 : 0.9;      // the neutral curve keeps the colour of a paint ; the older one, where it is missing, washes it a little this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.canvas = this.renderer.domElement; this.canvas.className = "dw-view-canvas rd-canvas"; this.canvas.tabIndex = 0; host.append(this.canvas);
    this.scene = new THREE.Scene(); this.root = new THREE.Group(); this.scene.add(this.root);
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 1, 1e6); this.camera.up.set(0, 0, 1);
    this.key = new THREE.DirectionalLight(0xffffff, 1.5); this.key.castShadow = true; this.key.shadow.mapSize.set(2048, 2048); this.fill = new THREE.HemisphereLight(0xffffff, 0x8a8f96, 0.5);
    this.scene.add(this.key, this.key.target, this.fill);
    this.ground = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.ShadowMaterial({ opacity: 0.3 })); this.ground.receiveShadow = true; this.scene.add(this.ground);
    this.view = { az: -35, el: 18, dist: 1000, target: new THREE.Vector3() }; this.raycaster = new THREE.Raycaster();
    this._bind(); this.obs = new ResizeObserver(() => this.resize()); this.obs.observe(host); this.resize(); this.setScene("studio");
    const loop = () => { if (!this.alive) return; if (this.dirty) this._render(); requestAnimationFrame(loop); }; requestAnimationFrame(loop);
  }
  dispose() { this.alive = false; this.obs.disconnect(); this.clear(); if (this.env) this.env.dispose(); if (this.back) this.back.dispose(); this.renderer.dispose(); this.canvas.remove(); }
  resize() { const w = Math.max(2, this.host.clientWidth), h = Math.max(2, this.host.clientHeight); this.w = w; this.h = h; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.dirty = true; }
  clear() { for (const it of this.items.values()) { it.mesh.geometry.dispose(); if (it.mesh.material.map && it.own) it.mesh.material.map.dispose(); it.mesh.material.dispose(); this.root.remove(it.mesh); } this.items.clear(); this.dirty = true; }
  /** The scene : its sky (the background, and what the metals reflect), its light, its ground. */
  setScene(id, ground = true) {
    const S = SCENES[id] || SCENES.studio; this.sceneId = id;
    if (this.back) this.back.dispose(); this.back = new THREE.CanvasTexture(gradient(S.sky[0], S.sky[1])); this.back.colorSpace = THREE.SRGBColorSpace; this.scene.background = this.back;
    /* the surrounding : a dome in the colours of the sky, a wide soft light above, two strips on the sides — what a polished part shows */
    const room = new THREE.Scene(), dome = new THREE.Mesh(new THREE.SphereGeometry(60, 32, 16), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(gradient(S.sky[0], S.sky[1])), side: THREE.BackSide }));
    dome.rotation.x = Math.PI / 2; room.add(dome);                                                             // the gradient runs along Z
    const lamp = (w, h, p, k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k), side: THREE.DoubleSide })); m.position.set(...p); m.lookAt(0, 0, 0); room.add(m); };
    lamp(50, 50, [0, 0, 45], 2.4 * S.room); lamp(18, 60, [45, 20, 10], 1.6 * S.room); lamp(18, 60, [-40, -30, 12], 1 * S.room);
    const pm = new THREE.PMREMGenerator(this.renderer); if (this.env) this.env.dispose(); this.env = pm.fromScene(room, 0.04).texture; pm.dispose(); room.traverse((n) => { if (n.geometry) n.geometry.dispose(); if (n.material) { if (n.material.map) n.material.map.dispose(); n.material.dispose(); } });
    this.scene.environment = this.env; this.key.intensity = S.key; this.fill.intensity = S.fill; this.ground.visible = !!ground; this.ground.material.opacity = id === "dark" ? 0.55 : 0.3; this.dirty = true;
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
        envMapIntensity: 1, side: THREE.DoubleSide, transparent: clear || !!it.map, opacity: L.opacity ?? 1, depthWrite: !clear, polygonOffset: !!it.map, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
      const mesh = new THREE.Mesh(g, mat); mesh.matrixAutoUpdate = false; if (it.matrix) mesh.matrix.fromArray(it.matrix); mesh.castShadow = !clear && !it.map; mesh.receiveShadow = !it.map; mesh.userData = { id: it.id, data: it.data || null };
      this.root.add(mesh); this.items.set(it.id, { mesh, own });
    }
    const r = Math.max(1, Math.hypot(bbox[3] - bbox[0], bbox[4] - bbox[1], bbox[5] - bbox[2]) / 2), c = [(bbox[0] + bbox[3]) / 2, (bbox[1] + bbox[4]) / 2, (bbox[2] + bbox[5]) / 2];
    this.radius = r; this.ground.scale.setScalar(r * 30); this.ground.position.set(c[0], c[1], bbox[2] - r * 1e-4);
    this.key.position.set(c[0] + r * 1.6, c[1] - r * 1.1, c[2] + r * 2.4); this.key.target.position.set(...c); const sc = this.key.shadow.camera; sc.left = sc.bottom = -r * 1.4; sc.right = sc.top = r * 1.4; sc.near = r * 0.1; sc.far = r * 8; sc.updateProjectionMatrix();
    this.key.shadow.normalBias = r * 0.004; this.key.shadow.bias = -0.0004; this.dirty = true;
  }
  /** Stands the camera at a point of view of core/render_looks.js (or at a kept view { az, el, dist }), for the picture as it is on the screen. */
  setShot(shot, aspect = this.w / this.h) { const c = cameraFor(this.bbox, shot, aspect, FOV); this.view.az = c.az; this.view.el = c.el; this.view.dist = c.dist; this.view.target.set(...c.target); this.dirty = true; }
  viewNow() { return { az: Math.round(this.view.az * 10) / 10, el: Math.round(this.view.el * 10) / 10, dist: Math.round(this.view.dist) }; }
  /** Rings the parts chosen : a light of their own, so that they stand out while one works. ids : the ids of the items. */
  highlight(ids = []) { const on = new Set(ids); for (const [id, it] of this.items) { it.mesh.material.emissive.set(on.has(id) ? "#ff8a3d" : "#000000"); it.mesh.material.emissiveIntensity = on.has(id) ? 0.35 : 0; } this.dirty = true; }
  _cam() { const v = this.view, az = rad(v.az), el = rad(v.el); this.camera.position.set(v.target.x + Math.cos(el) * Math.cos(az) * v.dist, v.target.y + Math.cos(el) * Math.sin(az) * v.dist, v.target.z + Math.sin(el) * v.dist);
    this.camera.near = Math.max(1, v.dist / 200); this.camera.far = v.dist * 40 + this.radius * 40; this.camera.lookAt(v.target); this.camera.updateProjectionMatrix(); }
  _render() { this.dirty = false; this._cam(); this.renderer.render(this.scene, this.camera); }
  _bind() {
    const c = this.canvas; let drag = null, moved = 0;
    c.addEventListener("contextmenu", (e) => e.preventDefault());
    c.addEventListener("pointerdown", (e) => { c.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY, pan: e.button === 2 || e.shiftKey }; moved = 0; });
    c.addEventListener("pointermove", (e) => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y, v = this.view; drag.x = e.clientX; drag.y = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
      if (drag.pan) { const k = v.dist * Math.tan(rad(FOV / 2)) * 2 / this.h, right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1); v.target.addScaledVector(right, -dx * k).addScaledVector(up, dy * k); }
      else { v.az -= dx * 0.4; v.el = Math.max(-85, Math.min(85, v.el + dy * 0.3)); } this.dirty = true; });
    c.addEventListener("pointerup", (e) => { const was = drag; drag = null; if (!was) return; if (moved < 4) { const hit = this.pick(e); if (this.o.onPick) this.o.onPick(hit ? hit.id : null, hit ? hit.data : null); } else if (this.o.onView) this.o.onView(this.viewNow()); });
    c.addEventListener("wheel", (e) => { e.preventDefault(); this.view.dist = Math.max(this.radius * 0.3, this.view.dist * Math.exp(e.deltaY * 0.0012)); this.dirty = true; if (this.o.onView) this.o.onView(this.viewNow()); }, { passive: false });
  }
  /** What is under the pointer : { id, data } of the nearest opaque item, or null. */
  pick(e) { const r = this.canvas.getBoundingClientRect(), p = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); this._cam(); this.camera.updateMatrixWorld(); this.raycaster.setFromCamera(p, this.camera);
    const hit = this.raycaster.intersectObjects([...this.items.values()].map((i) => i.mesh), false)[0]; return hit ? { id: hit.object.userData.id, data: hit.object.userData.data } : null; }
  /** The picture, at w × h pixels : the stage drawn at that size, then the mark of the platform in the bottom left corner. → a 2D canvas */
  snapshot(w, h, o = {}) {
    const pr = this.renderer.getPixelRatio(), keep = { ...this.view, target: this.view.target.clone() }, glow = [...this.items.values()].map((i) => i.mesh.material.emissiveIntensity);
    for (const i of this.items.values()) i.mesh.material.emissiveIntensity = 0;
    this.renderer.setPixelRatio(1); this.renderer.setSize(w, h, false); this.camera.aspect = w / h; if (o.shot) this.setShot(o.shot, w / h); this._cam(); this.renderer.render(this.scene, this.camera);
    const out = document.createElement("canvas"); out.width = w; out.height = h; const g = out.getContext("2d"); g.drawImage(this.canvas, 0, 0, w, h);
    const s = Math.max(22, Math.round(Math.min(w, h) * 0.042)), x = Math.round(s * 0.7), y = h - Math.round(s * 1.7), k = s / LOGO.size, dark = this.sceneId === "dark", inkc = dark ? "#f2f4f6" : LOGO.ink, P = (px, py) => [x + px * k, y + py * k];
    g.lineCap = "round"; g.lineJoin = "round"; g.strokeStyle = inkc; g.lineWidth = 6 * k; for (const [x1, y1, x2, y2] of LOGO.legs) { g.beginPath(); g.moveTo(...P(x1, y1)); g.lineTo(...P(x2, y2)); g.stroke(); }
    g.strokeStyle = LOGO.blue; g.beginPath(); g.arc(...P(...LOGO.arc.c), LOGO.arc.r * k, rad(LOGO.arc.a0), rad(LOGO.arc.a1)); g.stroke();
    g.fillStyle = LOGO.yellow; g.strokeStyle = inkc; g.lineWidth = 2 * k; g.beginPath(); LOGO.star.forEach(([px, py], i) => (i ? g.lineTo(...P(px, py)) : g.moveTo(...P(px, py)))); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = inkc; g.globalAlpha = 0.86; g.font = `600 ${Math.round(s * 0.4)}px Helvetica, Arial, sans-serif`; g.textBaseline = "middle"; g.fillText(MARK, x + s * 1.2, y + s * 0.5); g.globalAlpha = 1;
    this.renderer.setPixelRatio(pr); this.renderer.setSize(this.w, this.h, false); this.camera.aspect = this.w / this.h; Object.assign(this.view, { az: keep.az, el: keep.el, dist: keep.dist }); this.view.target.copy(keep.target);
    [...this.items.values()].forEach((i, n) => { i.mesh.material.emissiveIntensity = glow[n]; }); this.dirty = true; return out;
  }
}
