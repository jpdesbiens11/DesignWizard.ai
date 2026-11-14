/* DesignWizard.ai — 3D view (three.js): the CAD habits a designer expects — orbit / pan / zoom to cursor, standard
   views, fit, section plane, exploded view, x-ray, face and edge picking, measure — plus overlays for the
   platform's own tools (interface frames, DFx markers, isolation paths). Renders only when something changed. */

import * as THREE from "../../vendor/three/three.module.min.js";

const GRAPHITE = 0x26323f;
/** Colour of a design token (themes.css), read on the element so each theme draws its own edges. */
const token = (el, name, fallback) => { try { return getComputedStyle(el).getPropertyValue(name).trim() || fallback; } catch (e) { return fallback; } };
const VIEWS = { iso: [-0.62, -0.72, 0.5], front: [0, -1, 0], back: [0, 1, 0], left: [-1, 0, 0], right: [1, 0, 0], top: [0, 0, 1], bottom: [0, 0, -1] };

export class Viewer {
  constructor(container, opts = {}) {
    this.el = container;
    this.opts = opts;
    this.objects = new Map();          // id -> {group, mesh, edges, def}
    this.overlays = new THREE.Group();
    this.labels = [];
    this.scene = new THREE.Scene();
    this.root = new THREE.Group();
    this.scene.add(this.root, this.overlays);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.localClippingEnabled = true;
    this.canvas = this.renderer.domElement;
    this.canvas.className = "dw-view-canvas";
    this.canvas.tabIndex = 0;
    this.labelLayer = document.createElement("div");
    this.labelLayer.className = "dw-view-labels";
    container.append(this.canvas, this.labelLayer);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1e5, 1e5);
    this.camera.up.set(0, 0, 1);
    this.target = new THREE.Vector3();
    this.dir = new THREE.Vector3(...VIEWS.iso).normalize();     // from target to eye
    this.span = 200;                                            // world height shown
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    this.key = new THREE.DirectionalLight(0xffffff, 1.5);
    this.fill = new THREE.DirectionalLight(0xffffff, 0.55);
    this.scene.add(this.key, this.fill);
    this.clip = null; this.explode = 0; this.xray = false; this.mode = "select"; this.measure = [];
    this.raycaster = new THREE.Raycaster();
    this.edgeColor = new THREE.Color(token(container, "--view-edge", "#26323f"));
    this._theme = () => { this.edgeColor.set(token(container, "--view-edge", "#26323f")); for (const o of this.objects.values()) if (o.edges) o.edges.material.color.copy(this.edgeColor); this.dirty = true; };
    window.addEventListener("dw:theme", this._theme);
    this.dirty = true; this.alive = true;
    this._bind();
    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(container);
    this.resize();
    const loop = () => { if (!this.alive) return; if (this.dirty) this._render(); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }

  dispose() {
    this.alive = false;
    window.removeEventListener("dw:theme", this._theme);
    this.resizeObs.disconnect();
    this.clear();
    this.renderer.dispose();
    this.canvas.remove(); this.labelLayer.remove();
  }
  invalidate() { this.dirty = true; }

  /* ---------- content ---------- */
  clear() {
    for (const id of [...this.objects.keys()]) this.remove(id);
    this.clearOverlays();
  }
  remove(id) {
    const o = this.objects.get(id);
    if (!o) return;
    o.group.traverse((n) => { if (n.geometry) n.geometry.dispose(); if (n.material) n.material.dispose(); });
    this.root.remove(o.group);
    this.objects.delete(id);
    this.dirty = true;
  }
  /** def = {id, name, mesh:{pos,nrm,idx,epos,faceOf,faces,edges,edgeOf}, color:"#rrggbb", opacity, matrix (column-major 16), data, pickable} */
  add(def) {
    this.remove(def.id);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(def.mesh.pos, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(def.mesh.nrm, 3));
    g.setIndex(new THREE.BufferAttribute(def.mesh.idx, 1));
    g.computeBoundingBox(); g.computeBoundingSphere();
    const opacity = def.opacity ?? 1;
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(def.color || token(this.el, "--view-part", "#a8b0b8")), metalness: 0.08, roughness: 0.62, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
    const mesh = new THREE.Mesh(g, mat);
    const eg = new THREE.BufferGeometry();
    eg.setAttribute("position", new THREE.BufferAttribute(def.mesh.epos, 3));
    const edges = new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: this.edgeColor.clone(), transparent: true, opacity: 0.85 }));
    const group = new THREE.Group();
    group.add(mesh, edges);
    group.matrixAutoUpdate = false;
    if (def.matrix) group.matrix.fromArray(def.matrix);
    mesh.userData = { id: def.id };
    this.root.add(group);
    this.objects.set(def.id, { group, mesh, edges, def, base: def.matrix ? def.matrix.slice() : null, opacity });
    this._applyState(this.objects.get(def.id));
    this.dirty = true;
  }
  setMatrix(id, m) { const o = this.objects.get(id); if (o) { o.base = m.slice(); this._place(o); this.dirty = true; } }
  setVisible(id, on) { const o = this.objects.get(id); if (o) { o.group.visible = on; this.dirty = true; } }
  setColor(id, color) { const o = this.objects.get(id); if (o) { o.mesh.material.color.set(color); this.dirty = true; } }
  /** A coloured result field (simulation): f = {pos, idx, col (r, g, b per vertex, 0..1), epos}. Unlit, so a colour reads exactly as the legend. */
  addField(id, f) {
    this.remove(id);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(f.pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(f.col, 3));
    g.setIndex(new THREE.BufferAttribute(f.idx, 1));
    g.computeBoundingBox(); g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
    const eg = new THREE.BufferGeometry();
    eg.setAttribute("position", new THREE.BufferAttribute(f.epos || new Float32Array(0), 3));
    const edges = new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: this.edgeColor.clone(), transparent: true, opacity: 0.3 }));
    const group = new THREE.Group();
    group.add(mesh, edges);
    group.matrixAutoUpdate = false;
    mesh.userData = { id };
    this.root.add(group);
    this.objects.set(id, { group, mesh, edges, def: { id, mesh: f, pickable: false }, base: null, opacity: 1 });
    this.dirty = true;
  }
  setOpacity(id, op) { const o = this.objects.get(id); if (o) { o.opacity = op; this._applyState(o); this.dirty = true; } }
  highlight(ids, color = "#ffd23f") {
    const set = new Set([].concat(ids || []));
    for (const [id, o] of this.objects) o.mesh.material.emissive.set(set.has(id) ? color : "#000000").multiplyScalar(set.has(id) ? 0.45 : 1);
    this.dirty = true;
  }
  _applyState(o) {
    const m = o.mesh.material, op = this.xray ? Math.min(o.opacity, 0.28) : o.opacity;
    m.transparent = op < 1; m.opacity = op; m.depthWrite = op >= 1;
    m.clippingPlanes = this.clip ? [this.clip] : null;
    o.edges.material.clippingPlanes = m.clippingPlanes;
    m.needsUpdate = true;
    this._place(o);
  }
  _place(o) {
    const m = new THREE.Matrix4();
    if (o.base) m.fromArray(o.base);
    if (this.explode > 0 && o.def.explodeDir) {
      const d = o.def.explodeDir, k = this.explode;
      m.premultiply(new THREE.Matrix4().makeTranslation(d[0] * k, d[1] * k, d[2] * k));
    }
    o.group.matrix.copy(m);
    o.group.matrixWorldNeedsUpdate = true;
  }
  setExplode(k) { this.explode = k; for (const o of this.objects.values()) this._place(o); this._layoutLabels(); this.dirty = true; }
  setXray(on) { this.xray = on; for (const o of this.objects.values()) this._applyState(o); this.dirty = true; }
  /** Section plane: axis "x"|"y"|"z"|null and a position 0..1 across the model box. */
  setSection(axis, t = 0.5, flip = false) {
    if (!axis) this.clip = null;
    else {
      const bb = this.bbox(), i = "xyz".indexOf(axis), n = [0, 0, 0];
      n[i] = flip ? 1 : -1;
      const pos = bb.min.getComponent(i) + (bb.max.getComponent(i) - bb.min.getComponent(i)) * t;
      this.clip = new THREE.Plane(new THREE.Vector3(...n), flip ? -pos : pos);
    }
    for (const o of this.objects.values()) this._applyState(o);
    this.dirty = true;
  }
  bbox() {
    const bb = new THREE.Box3();
    this.root.updateMatrixWorld(true);
    for (const o of this.objects.values()) if (o.group.visible) bb.union(new THREE.Box3().copy(o.mesh.geometry.boundingBox).applyMatrix4(o.group.matrixWorld));
    if (bb.isEmpty()) bb.set(new THREE.Vector3(-50, -50, -50), new THREE.Vector3(50, 50, 50));
    return bb;
  }

  /* ---------- camera ---------- */
  resize() {
    const w = Math.max(50, this.el.clientWidth), h = Math.max(50, this.el.clientHeight);
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = w + "px"; this.canvas.style.height = h + "px";
    this.w = w; this.h = h; this.dirty = true;
  }
  view(name) { this.dir.set(...(VIEWS[name] || VIEWS.iso)).normalize(); this.camera.up.set(0, name === "top" ? 1 : name === "bottom" ? -1 : 0, name === "top" || name === "bottom" ? 0 : 1); this.fit(); }
  fit(margin = 1.25) {
    const bb = this.bbox(), c = bb.getCenter(new THREE.Vector3()), s = bb.getSize(new THREE.Vector3());
    this.target.copy(c);
    this.span = Math.max(10, s.length() * margin * 0.88 / Math.min(1, this.w / this.h));       // the box diagonal fits in both directions
    this.dirty = true;
  }
  _cam() {
    const a = this.w / this.h, hh = this.span / 2;
    this.camera.left = -hh * a; this.camera.right = hh * a; this.camera.top = hh; this.camera.bottom = -hh;
    this.camera.position.copy(this.target).addScaledVector(this.dir, 5000);
    this.camera.lookAt(this.target);
    this.camera.updateProjectionMatrix(); this.camera.updateMatrixWorld();
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
    this.key.position.copy(this.dir).addScaledVector(right, -0.6).addScaledVector(up, 0.8);
    this.fill.position.copy(this.dir).addScaledVector(right, 0.9).addScaledVector(up, -0.3);
  }
  _render() {
    this.dirty = false;
    this._cam();
    this.renderer.render(this.scene, this.camera);
    this._layoutLabels();
  }
  _bind() {
    const c = this.canvas;
    let drag = null;
    c.addEventListener("contextmenu", (e) => e.preventDefault());
    c.addEventListener("pointerdown", (e) => {
      c.setPointerCapture(e.pointerId); c.focus();
      drag = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, pan: e.button !== 0 || e.shiftKey, moved: false };
    });
    c.addEventListener("pointermove", (e) => {
      if (!drag) { this._hover(e); return; }
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.x = e.clientX; drag.y = e.clientY;
      if (Math.abs(e.clientX - drag.x0) + Math.abs(e.clientY - drag.y0) > 4) drag.moved = true;
      if (!drag.moved) return;
      this._cam();
      const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
      if (drag.pan) {
        const k = this.span / this.h;
        this.target.addScaledVector(right, -dx * k).addScaledVector(up, dy * k);
      } else {
        // turntable: yaw about world Z, pitch about the screen's horizontal axis
        this.camera.up.set(0, 0, 1);
        const yaw = -dx * 0.0085, pitch = -dy * 0.0085;
        this.dir.applyAxisAngle(new THREE.Vector3(0, 0, 1), yaw);
        const axis = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 0, 1), this.dir).normalize();
        const next = this.dir.clone().applyAxisAngle(axis, -pitch);
        if (Math.abs(next.z) < 0.995) this.dir.copy(next);
        this.dir.normalize();
      }
      this.dirty = true;
    });
    c.addEventListener("pointerup", (e) => { const d = drag; drag = null; if (d && !d.moved) this._click(e); });
    c.addEventListener("wheel", (e) => {
      e.preventDefault();
      const f = Math.exp(Math.sign(e.deltaY) * 0.14), r = c.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5, ny = 0.5 - (e.clientY - r.top) / r.height;
      this._cam();
      const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
      const a = this.w / this.h, shift = this.span * (1 - f);                    // keep the point under the cursor fixed
      this.target.addScaledVector(right, nx * a * shift).addScaledVector(up, ny * shift);
      this.span = Math.max(0.5, Math.min(1e5, this.span * f));
      this.dirty = true;
    }, { passive: false });
    c.addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      const map = { f: () => this.fit(), 0: () => this.view("iso"), 1: () => this.view("front"), 2: () => this.view("back"), 3: () => this.view("left"), 4: () => this.view("right"), 5: () => this.view("top"), 6: () => this.view("bottom") };
      if (map[k] && !e.ctrlKey && !e.metaKey) { map[k](); e.preventDefault(); }
      else if (this.opts.onKey) this.opts.onKey(e);
    });
  }
  _pick(e) {
    const r = this.canvas.getBoundingClientRect();
    const p = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this._cam();
    this.raycaster.setFromCamera(p, this.camera);
    const meshes = [...this.objects.values()].filter((o) => o.group.visible && o.def.pickable !== false).map((o) => o.mesh);
    for (const hit of this.raycaster.intersectObjects(meshes, false)) {
      if (this.clip && this.clip.distanceToPoint(hit.point) < 0) continue;
      const o = this.objects.get(hit.object.userData.id), tri = hit.faceIndex;
      const faceId = o.def.mesh.faceOf ? o.def.mesh.faceOf[tri] : -1, face = faceId >= 0 && o.def.mesh.faces ? o.def.mesh.faces[faceId] : null;
      const local = hit.point.clone().applyMatrix4(new THREE.Matrix4().copy(o.group.matrixWorld).invert());
      return { id: o.def.id, def: o.def, point: hit.point.toArray(), local: local.toArray(), faceId, face, normal: hit.face ? hit.face.normal.clone().transformDirection(o.group.matrixWorld).toArray() : null };
    }
    return null;
  }
  _hover(e) {
    if (!this.opts.onHover && this.mode !== "measure") return;
    if (this._hoverRaf) return;
    this._hoverRaf = requestAnimationFrame(() => { this._hoverRaf = 0; const hit = this._pick(e); if (this.opts.onHover) this.opts.onHover(hit, e); });
  }
  _click(e) {
    const hit = this._pick(e);
    if (this.mode === "measure") { this._measure(hit); return; }
    if (this.opts.onPick) this.opts.onPick(hit, e);
  }

  /* ---------- measure ---------- */
  setMode(mode) { this.mode = mode; this.measure = []; this.clearOverlays("measure"); this.canvas.style.cursor = mode === "measure" ? "crosshair" : ""; }
  _measure(hit) {
    if (!hit) return;
    if (this.measure.length >= 2) { this.measure = []; this.clearOverlays("measure"); }
    this.measure.push(hit);
    this.addMarker(hit.point, "#0c66e4", "measure");
    if (hit.face && hit.face.type === "cylinder" && this.measure.length === 1) this.addLabel(hit.point, `Ø ${fmt(hit.face.r * 2)}`, "measure");
    if (this.measure.length === 2) {
      const [a, b] = this.measure, pa = new THREE.Vector3(...a.point), pb = new THREE.Vector3(...b.point);
      let d = pa.distanceTo(pb), text = `${fmt(d)} mm`;
      if (a.normal && b.normal && a.face && b.face && a.face.type === "plane" && b.face.type === "plane") {
        const na = new THREE.Vector3(...a.normal), nb = new THREE.Vector3(...b.normal);
        if (Math.abs(Math.abs(na.dot(nb)) - 1) < 1e-3) { d = Math.abs(pb.clone().sub(pa).dot(na)); text = `${fmt(d)} mm entre faces ∥`; }
      }
      const dv = pb.clone().sub(pa);
      this.addPath([a.point, b.point], "#0c66e4", "measure", 0.5);
      this.addLabel(pa.clone().add(pb).multiplyScalar(0.5).toArray(), `${text}  (ΔX ${fmt(Math.abs(dv.x))} · ΔY ${fmt(Math.abs(dv.y))} · ΔZ ${fmt(Math.abs(dv.z))})`, "measure");
      if (this.opts.onMeasure) this.opts.onMeasure({ d, a, b });
    }
    this.dirty = true;
  }

  /* ---------- overlays ---------- */
  clearOverlays(tag) {
    for (const ch of [...this.overlays.children]) if (!tag || ch.userData.tag === tag) { this.overlays.remove(ch); ch.traverse((n) => { if (n.geometry) n.geometry.dispose(); if (n.material) n.material.dispose(); }); }
    this.labels = this.labels.filter((l) => { if (!tag || l.tag === tag) { l.el.remove(); return false; } return true; });
    this.dirty = true;
  }
  _size() { return this.bbox().getSize(new THREE.Vector3()).length() || 100; }
  addMarker(p, color = "#ff5a4f", tag = "marker", scale = 1) {
    const r = this._size() * 0.008 * scale;
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.95 }));
    m.position.set(...p); m.renderOrder = 10; m.userData.tag = tag;
    this.overlays.add(m); this.dirty = true;
    return m;
  }
  /** Thick polyline (tubes), e.g. a creepage or clearance path. */
  addPath(points, color = "#ff3b30", tag = "path", scale = 1, dashed = false) {
    const r = this._size() * 0.0035 * scale, g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.95 });
    for (let i = 0; i + 1 < points.length; i++) {
      const a = new THREE.Vector3(...points[i]), b = new THREE.Vector3(...points[i + 1]), len = a.distanceTo(b);
      if (len < 1e-6) continue;
      const pieces = dashed ? Math.max(1, Math.round(len / (r * 10))) : 1;
      for (let k = 0; k < pieces; k++) {
        const t0 = k / pieces, t1 = dashed ? (k + 0.55) / pieces : 1;
        const p0 = a.clone().lerp(b, t0), p1 = a.clone().lerp(b, t1);
        const cyl = new THREE.Mesh(new THREE.CylinderGeometry(r, r, p0.distanceTo(p1), 8), mat);
        cyl.position.copy(p0).add(p1).multiplyScalar(0.5);
        cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p1.clone().sub(p0).normalize());
        cyl.renderOrder = 9; g.add(cyl);
      }
    }
    g.userData.tag = tag; this.overlays.add(g); this.dirty = true;
    return g;
  }
  /** Interface frame glyph: a small disc on the mating plane with its normal arrow. */
  addFrame(frame, color = "#9b7bff", tag = "frame", matrix = null) {
    const s = this._size() * 0.03, g = new THREE.Group();
    const o = new THREE.Vector3(...frame.o), n = new THREE.Vector3(...frame.n), u = new THREE.Vector3(...frame.u);
    const mat = new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
    const disc = new THREE.Mesh(new THREE.RingGeometry(s * 0.55, s * 0.8, 24), mat);
    disc.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n); disc.position.copy(o);
    const arrow = new THREE.ArrowHelper(n, o, s * 1.6, color, s * 0.5, s * 0.35);
    const ax = new THREE.ArrowHelper(u, o, s * 1.1, this.edgeColor.getHex(), s * 0.3, s * 0.2);
    [arrow, ax].forEach((a) => a.traverse((x) => { if (x.material) { x.material.depthTest = false; x.material.transparent = true; } }));
    g.add(disc, arrow, ax);
    g.traverse((x) => { x.renderOrder = 8; });
    if (matrix) { g.matrixAutoUpdate = false; g.matrix.fromArray(matrix); }
    g.userData.tag = tag; this.overlays.add(g); this.dirty = true;
    return g;
  }
  addLabel(p, text, tag = "label", cls = "", onClick = null) {
    const el = document.createElement(onClick ? "button" : "div");
    el.className = "dw-view-label " + cls; el.textContent = text;
    if (onClick) el.addEventListener("click", onClick);
    this.labelLayer.append(el);
    this.labels.push({ p: new THREE.Vector3(...p), el, tag });
    this.dirty = true;
    return el;
  }
  _layoutLabels() {
    for (const l of this.labels) {
      const v = l.p.clone().project(this.camera);
      l.el.style.left = ((v.x + 1) / 2 * this.w) + "px"; l.el.style.top = ((1 - v.y) / 2 * this.h) + "px";
    }
  }
  /** PNG data URL of the current view (for the design-review report). */
  snapshot() { return this._onPaper(() => this.canvas.toDataURL("image/png")); }
  /** JPEG data URL on a white background (for PDF embedding). */
  snapshotJpeg(quality = 0.9) {
    return this._onPaper(() => {
      const c = document.createElement("canvas"); c.width = this.canvas.width; c.height = this.canvas.height;
      const g = c.getContext("2d"); g.fillStyle = "#ffffff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(this.canvas, 0, 0);
      return c.toDataURL("image/jpeg", quality);
    });
  }
  /** Images for documents are always drawn with graphite edges, as on white paper, whatever the screen theme. */
  _onPaper(take) {
    const set = (c) => { for (const o of this.objects.values()) if (o.edges) o.edges.material.color.set(c); };
    set(GRAPHITE); this._render();
    try { return take(); } finally { set(this.edgeColor); this.dirty = true; }
  }
}
const fmt = (v) => (Math.round(v * 100) / 100).toLocaleString("fr-CA");
export { VIEWS };
