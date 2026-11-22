/* DynamiteOrbit — the picture that refines itself. One frame of a 3D view draws each light from one point, and each pixel
   through its centre : a shadow is then either on or off, and an edge is a staircase. A photograph is the sum of the light
   from every point of each source : so the stage draws the scene again and again — each time the lamps moved a little inside
   their own size, the sky seen from another side, the camera moved by a fraction of a pixel — and this module keeps the
   AVERAGE of those frames. Shadows melt as a real source makes them, edges come out clean, and what the sky cannot reach
   goes dark. It is the usual way of real-time viewers (frames accumulated while nothing moves), not a path tracer.
   The frames are averaged in linear light, at more than 8 bits, and the curve of the screen is applied once, at the end. */

import * as THREE from "../../vendor/three/three.module.min.js";

const VERT = "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";
const FRAG = "uniform sampler2D a; uniform sampler2D b; uniform float k; varying vec2 vUv; void main() { gl_FragColor = mix(texture2D(a, vUv), texture2D(b, vUv), k); }";

export class Accum {
  constructor(renderer) {
    this.r = renderer; this.n = 0; this.w = 0; this.h = 0; this.frame = null; this.sum = [null, null]; this.at = 0;
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); this.scene = new THREE.Scene();
    this.blend = new THREE.ShaderMaterial({ uniforms: { a: { value: null }, b: { value: null }, k: { value: 1 } }, vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false, toneMapped: false });
    this.show = new THREE.MeshBasicMaterial({ depthTest: false, depthWrite: false });                     // drawn on the screen : the curve of the screen is applied here, once
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.blend); this.quad.frustumCulled = false; this.scene.add(this.quad);
  }
  /** The size of the frames, in pixels ; smooth : the edges of a single frame are smoothed (worth it on the screen, not for a picture of many frames). */
  size(w, h, smooth = true) {
    if (w === this.w && h === this.h && smooth === this.smooth && this.frame) { this.n = 0; return; }
    this.free(); this.w = w; this.h = h; this.smooth = smooth; const o = { type: THREE.HalfFloatType, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter };
    this.frame = new THREE.WebGLRenderTarget(w, h, { ...o, samples: smooth ? 4 : 0 }); this.sum = [0, 1].map(() => new THREE.WebGLRenderTarget(w, h, { ...o, depthBuffer: false })); this.n = 0;
  }
  reset() { this.n = 0; }
  /** One frame more in the average : the scene drawn once, then mixed into what is kept, each frame weighing as much as another. */
  add(scene, camera) {
    const r = this.r; r.setRenderTarget(this.frame); r.clear(); r.render(scene, camera);
    const to = this.sum[1 - this.at], from = this.sum[this.at]; this.quad.material = this.blend; this.blend.uniforms.a.value = from.texture; this.blend.uniforms.b.value = this.frame.texture; this.blend.uniforms.k.value = 1 / (this.n + 1);
    r.setRenderTarget(to); r.render(this.scene, this.cam); r.setRenderTarget(null); this.at = 1 - this.at; this.n++;
  }
  /** The average, on the screen (or in the canvas of the renderer). */
  present() { if (!this.n) return; this.quad.material = this.show; this.show.map = this.sum[this.at].texture; this.r.setRenderTarget(null); this.r.render(this.scene, this.cam); }
  free() { if (this.frame) this.frame.dispose(); for (const t of this.sum) if (t) t.dispose(); this.frame = null; this.sum = [null, null]; this.w = this.h = 0; }
  dispose() { this.free(); this.quad.geometry.dispose(); this.blend.dispose(); this.show.dispose(); }
}
