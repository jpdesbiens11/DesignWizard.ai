/* DesignWizard.ai — the lamps of the photo studio, on the stage : each light of the list (core/photo_lights.js) is a lamp far
   away that shines on the product, the strongest ones with a shadow ; the light from everywhere is a sky that shines from
   above and a ground that sends some of it back. For a picture that refines itself (core/photo_accum.js), sample(i, n) moves
   each lamp inside its own size and looks at the sky from another side : the average is a soft shadow and a dark hollow.
   The lamps can be SEEN in the view — a disc where each one stands, in the colour of its light — and taken with the mouse :
   they slide around the product, as on a stand one walks around a table. They are never in the picture. */

import * as THREE from "../../vendor/three/three.module.min.js";
import { LIGHT_KINDS, LIGHT_GROUPS, tidyLights, liveLights, shadowLights, lightDir, dirAngles, sampleDir, skyDir, softAngle, kelvinRgb, MAX_LIGHTS } from "./photo_lights.js";

const AT = 1.75;                                                // where a lamp is drawn : this many radii from the centre of the product
const groupColor = (kind) => (LIGHT_GROUPS.find((g) => g.id === LIGHT_KINDS[kind].group) || LIGHT_GROUPS[0]).color;

export class LightRig {
  constructor(scene) {
    this.scene = scene; this.c = new THREE.Vector3(); this.r = 100; this.lights = []; this.ambient = 0.35; this.lamps = []; this.shown = true; this.sel = null;
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x8a8f96, 0.35); this.sky = this._lamp(1024); this.sky.intensity = 0; this.gizmos = new THREE.Group(); scene.add(this.hemi, this.gizmos);
    /* every lamp the list may hold exists from the start, the unused ones dark : the number of lights of the scene never changes, and no material is compiled again */
    for (let i = 0; i < MAX_LIGHTS; i++) { const l = this._lamp(2048); l.intensity = 0; l.castShadow = i < 3; this.lamps.push(l); }
    this.skyTint = new THREE.Color(1, 1, 1); this.bounce = new THREE.Color(0.5, 0.5, 0.5);
  }
  _lamp(size) { const l = new THREE.DirectionalLight(0xffffff, 1); l.castShadow = true; l.shadow.mapSize.set(size, size); l.shadow.bias = -0.0004; l.shadow.needsUpdate = true; this.scene.add(l, l.target); return l; }      // its shadow is drawn once at least : a lamp that is dark must not read a picture that was never made
  /** The product : its centre and its radius (millimetres) — where the lamps aim, and how wide their shadows must reach. */
  frame(c, r) { this.c.set(...c); this.r = r; for (const l of [...this.lamps, this.sky]) { const s = l.shadow.camera; s.left = s.bottom = -r * 1.3; s.right = s.top = r * 1.3; s.near = r * 6.4; s.far = r * 60; s.updateProjectionMatrix(); l.shadow.normalBias = r * 0.004; l.target.position.copy(this.c); } this._place(); this._gizmos(); }
  /** The lights of the picture. lights : the list ; ambient : the light from everywhere ; o : { sky, bounce (colours), sel (the id of the light in hand) } */
  set(lights, ambient, o = {}) {
    this.lights = tidyLights(lights); this.ambient = Math.max(0, Math.min(1.5, Number(ambient) || 0)); if (o.sky) this.skyTint.set(o.sky); if (o.bounce) this.bounce.set(o.bounce); if (o.sel !== undefined) this.sel = o.sel;
    const live = liveLights(this.lights), cast = new Set(shadowLights(this.lights)), order = [...live.filter((l) => cast.has(l.id)), ...live.filter((l) => !cast.has(l.id))];      // the three lamps that can cast take those that do
    this.slots = order.map((l) => l.id);
    this.lamps.forEach((lamp, i) => { const l = order[i]; lamp.userData.light = l || null; lamp.intensity = l ? l.power : 0; if (l) lamp.color.setRGB(...kelvinRgb(l.kelvin)); lamp.userData.casts = !!(l && cast.has(l.id) && i < 3); });
    this.hemi.groundColor.copy(this.bounce); this.sample(0, 1); this._gizmos();
  }
  _place() { for (const lamp of [...this.lamps, this.sky]) { const d = lamp.userData.dir || [0.3, -0.3, 0.9]; lamp.position.set(this.c.x + d[0] * this.r * 8, this.c.y + d[1] * this.r * 8, this.c.z + d[2] * this.r * 8); } }
  /** Sets the lamps for frame i of n. n = 1 : each lamp at its centre, the sky as an even light without a shadow (what one sees while moving).
      n > 1 : each lamp somewhere inside its own size, and the sky as one lamp of its own, from one side of it — the average over n is the real thing. */
  sample(i, n) {
    for (const lamp of this.lamps) { const l = lamp.userData.light; if (!l) { lamp.shadow.autoUpdate = false; continue; } lamp.userData.dir = sampleDir(l, i, n); lamp.shadow.autoUpdate = lamp.userData.casts; lamp.shadow.intensity = lamp.userData.casts ? 1 : 0; lamp.shadow.needsUpdate = lamp.userData.casts; }
    const many = n > 1 && this.ambient > 0;
    this.hemi.color.copy(many ? this.skyTint.clone().multiplyScalar(0) : this.skyTint); this.hemi.intensity = this.ambient;
    this.sky.intensity = many ? 2 * this.ambient : 0; this.sky.color.copy(this.skyTint); this.sky.userData.dir = skyDir(i); this.sky.shadow.autoUpdate = many; this.sky.shadow.needsUpdate = many;
    this._place();
  }
  /* ---------- the lamps one sees and takes ---------- */
  show(on) { this.shown = !!on; this.gizmos.visible = this.shown; }
  select(id) { this.sel = id; this._gizmos(); }
  _gizmos() {
    for (const g of [...this.gizmos.children]) { g.traverse((n) => { if (n.geometry) n.geometry.dispose(); if (n.material) n.material.dispose(); }); this.gizmos.remove(g); }
    for (const l of this.lights) {
      const d = lightDir(l.az, l.el), p = new THREE.Vector3(this.c.x + d[0] * this.r * AT, this.c.y + d[1] * this.r * AT, this.c.z + d[2] * this.r * AT), on = !l.off && l.power > 0, size = this.r * (0.07 + 0.3 * Math.tan((softAngle(l.soft) * Math.PI) / 180)), g = new THREE.Group(), tint = new THREE.Color(...kelvinRgb(l.kelvin));
      const basic = (color, more = {}) => new THREE.MeshBasicMaterial({ color, toneMapped: false, fog: false, side: THREE.DoubleSide, transparent: true, opacity: on ? 1 : 0.35, ...more });
      const face = new THREE.Mesh(new THREE.CircleGeometry(size, 28), basic(on ? tint : new THREE.Color("#8a9098"))), ring = new THREE.Mesh(new THREE.RingGeometry(size * 1.08, size * (l.id === this.sel ? 1.5 : 1.28), 28), basic(l.id === this.sel ? "#ff7a1a" : groupColor(l.kind)));
      const beam = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, this.r * (AT - 1.02))]), new THREE.LineBasicMaterial({ color: groupColor(l.kind), transparent: true, opacity: on ? 0.55 : 0.2, toneMapped: false, fog: false }));
      g.add(face, ring, beam); g.position.copy(p); g.lookAt(this.c); g.userData.light = l.id; face.userData.light = ring.userData.light = l.id; this.gizmos.add(g);
    }
    this.gizmos.visible = this.shown;
  }
  /** The light whose lamp is under a ray, or null. raycaster : set from the camera. */
  pick(raycaster) { if (!this.shown) return null; const hit = raycaster.intersectObjects(this.gizmos.children, true).find((h) => h.object.userData.light); return hit ? hit.object.userData.light : null; }
  /** Where a lamp goes when the mouse pulls it : the point of the ball of the lamps that is under the ray, on the side where the lamp already is. → { az, el } */
  drag(ray, id) {
    const l = this.lights.find((x) => x.id === id); if (!l) return null; const R = this.r * AT, oc = ray.origin.clone().sub(this.c), b = oc.dot(ray.direction), q = oc.lengthSq() - R * R, disc = b * b - q, cur = new THREE.Vector3(...lightDir(l.az, l.el));
    let best = null;
    if (disc >= 0) { for (const t of [-b - Math.sqrt(disc), -b + Math.sqrt(disc)]) { if (t <= 0) continue; const v = ray.origin.clone().addScaledVector(ray.direction, t).sub(this.c).normalize(); if (!best || v.dot(cur) > best.dot(cur)) best = v; } }
    if (!best) best = ray.origin.clone().addScaledVector(ray.direction, Math.max(0, -b)).sub(this.c).normalize();          // past the edge of the ball : its nearest point
    const a = dirAngles([best.x, best.y, best.z]); return { az: Math.round(a.az), el: Math.round(Math.max(0, Math.min(90, a.el))) };
  }
  /** What the surroundings must show for the reflections : where each lamp stands, how large, how bright. → [{ dir, angle (degrees), color [r, g, b] }] */
  panels() { return liveLights(this.lights).map((l) => ({ dir: lightDir(l.az, l.el), angle: l.kind === "sun" ? 1.6 : softAngle(l.soft) + 3, color: kelvinRgb(l.kelvin).map((c) => c * l.power * (l.kind === "sun" ? 14 : 2.2)) })); }
  /** The light of kind « sun » that is on, or null : the sky draws its disc there. */
  sun() { return liveLights(this.lights).find((l) => l.kind === "sun") || null; }
  dispose() { for (const l of [...this.lamps, this.sky]) { this.scene.remove(l, l.target); l.shadow.dispose(); l.dispose(); } this.scene.remove(this.hemi, this.gizmos); this.lights = []; this._gizmos(); }
}
