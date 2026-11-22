/* DesignOrbit.ai — the wand's small language: turns a short sentence (French or English) into an edit of the current part.
   No AI call: a set of patterns on the vocabulary of a workshop ("4 trous M4 aux coins à 8 mm", "congé 3", "longueur 150",
   "coque 2 ouverte dessus", "matériau PA66"). Each interpretation says what it will do before it is applied. */

import { MATERIALS, PROCESSES } from "../cad/materials.js";
import { THREADS, clearanceHole } from "../cad/standards.js";

const norm = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
const N = (s) => parseFloat(String(s).replace(",", "."));
const NUM = "(-?\\d+(?:[.,]\\d+)?)";
const f2 = (v) => (Math.round(v * 100) / 100).toLocaleString("fr-CA");

function faceFrom(t, dflt = "+Z") {
  if (/(dessous|bottom|bas\b|inferieur)/.test(t)) return "-Z";
  if (/(dessus|top|haut\b|superieur)/.test(t)) return "+Z";
  if (/(avant|front|devant)/.test(t)) return "-Y";
  if (/(arriere|back|derriere)/.test(t)) return "+Y";
  if (/(droite|right)/.test(t)) return "+X";
  if (/(gauche|left)/.test(t)) return "-X";
  return dflt;
}
const planeBox = (bb, face) => (face[1] === "Z" ? [bb[0], bb[1], bb[3], bb[4]] : face[1] === "Y" ? [bb[0], bb[2], bb[3], bb[5]] : [bb[1], bb[2], bb[4], bb[5]]);
function holeSize(t) {
  const m = /\bm(\d+(?:[.,]5)?)\b/.exec(t), d = new RegExp(`(?:o|ø|diam(?:etre)?|d)\\s*${NUM}`).exec(t);
  const screw = m ? `M${m[1].replace(",", ".")}` : null;
  if (screw && !THREADS[screw]) return { error: `Vis ${screw} inconnue (${Object.keys(THREADS).join(", ")}).` };
  const tapped = /(taraud|filet|thread|tapped)/.test(t);
  if (screw) return tapped ? { thread: screw, text: `${screw} taraudé` } : { d: clearanceHole(screw), text: `de passage ${screw} (Ø${f2(clearanceHole(screw))})` };
  if (d) return { d: N(d[1]), text: `Ø${f2(N(d[1]))}` };
  return null;
}
const nextId = (spec, prefix) => { let i = (spec.features || []).length + 1, id; do { id = `${prefix}${i++}`; } while ((spec.features || []).some((f) => f.id === id)); return id; };
const push = (spec, f) => { spec.features = spec.features || []; spec.features.push(f); };

/** Interpret `text` for the part {spec, built}. Returns [{label, apply(spec)}] (best first), or [] when not understood. */
export function interpret(text, ctx = {}) {
  const t = norm(text), out = [], spec = ctx.spec, built = ctx.built;
  if (!t || !spec) return out;
  const bb = built ? built.bbox : null;
  let m;

  // 1. parameter = value  ("longueur 150", "L=150", "wall 3,5 mm")
  if ((m = new RegExp(`^(.+?)\\s*(?:=|:|a|to)?\\s*${NUM}\\s*(?:mm|deg|°)?$`).exec(t))) {
    const key = m[1].trim(), val = N(m[2]);
    const defs = Object.entries(spec.params || {});
    const hit = defs.find(([n]) => n.toLowerCase() === key) || defs.find(([, d]) => d && typeof d === "object" && d.label && norm(d.label) === key)
      || defs.find(([, d]) => d && typeof d === "object" && d.label && norm(d.label).startsWith(key));
    if (hit && !(hit[1] && typeof hit[1] === "object" && hit[1].expr !== undefined)) {
      const [name, def] = hit, lab = def && typeof def === "object" && def.label ? `${def.label} (${name})` : name;
      out.push({ label: `Régler ${lab} à ${f2(val)}`, apply: (s) => { if (s.params[name] && typeof s.params[name] === "object") s.params[name].value = val; else s.params[name] = val; } });
    }
  }
  // 2. holes at the corners / at the centre
  if (/(trous?|holes?|percage)/.test(t)) {
    const size = holeSize(t), face = faceFrom(t);
    if (size && size.error) out.push({ label: size.error, apply: null });
    else if (size && bb) {
      const [a0, b0, a1, b1] = planeBox(bb, face);
      const depthM = new RegExp(`profond(?:eur)?\\s*${NUM}|depth\\s*${NUM}`).exec(t), depth = depthM ? N(depthM[1] || depthM[2]) : "through";
      const base = { op: "hole", face, depth, ...(size.thread ? { thread: size.thread } : { d: size.d }) };
      if (/(coins?|corners?|angles?)/.test(t)) {
        const im = new RegExp(`(?:a|at|de|retrait|inset)\\s*${NUM}\\s*(?:mm)?\\s*(?:des? bords?|from|du bord)?`).exec(t.replace(/m\d+/, ""));
        const inset = im ? N(im[1]) : Math.max(4, Math.min(a1 - a0, b1 - b0) * 0.1);
        out.push({ label: `Ajouter 4 trous ${size.text} aux coins de la face ${face}, à ${f2(inset)} mm des bords`,
          apply: (s) => push(s, { ...base, id: nextId(s, "h"), name: "Trous aux coins", at: { grid: { origin: [a0 + inset, b0 + inset], nx: 2, ny: 2, dx: a1 - a0 - 2 * inset, dy: b1 - b0 - 2 * inset } } }) });
      } else if (/(centre|center|milieu)/.test(t)) {
        out.push({ label: `Ajouter un trou ${size.text} au centre de la face ${face}`, apply: (s) => push(s, { ...base, id: nextId(s, "h"), name: "Trou central", at: [(a0 + a1) / 2, (b0 + b1) / 2] }) });
      } else if ((m = new RegExp(`(?:en|at|a)\\s*${NUM}\\s*[,; x]\\s*${NUM}`).exec(t))) {
        out.push({ label: `Ajouter un trou ${size.text} en (${f2(N(m[1]))} ; ${f2(N(m[2]))}) sur la face ${face}`, apply: (s) => push(s, { ...base, id: nextId(s, "h"), at: [N(m[1]), N(m[2])] }) });
      }
    }
  }
  // 3. fillet / chamfer
  if ((m = new RegExp(`(?:conges?|arrondi[rs]?|fillets?|rayons?)\\D*?${NUM}`).exec(t))) {
    const r = N(m[1]), edges = /(tout|toutes|all)/.test(t) ? "all" : /(dessus|top|dessous|bottom)/.test(t) ? { face: faceFrom(t) } : "vertical";
    out.push({ label: `Ajouter un congé R${f2(r)} sur ${edges === "all" ? "toutes les arêtes" : edges === "vertical" ? "les arêtes verticales" : `le contour de la face ${edges.face}`}`,
      apply: (s) => push(s, { op: "fillet", id: nextId(s, "r"), r, edges }) });
  }
  if ((m = new RegExp(`(?:chanfreins?|chamfers?)\\D*?${NUM}`).exec(t))) {
    const d = N(m[1]), edges = /(tout|toutes|all)/.test(t) ? "all" : /(vertical)/.test(t) ? "vertical" : { face: faceFrom(t) };
    out.push({ label: `Ajouter un chanfrein de ${f2(d)} sur ${edges === "all" ? "toutes les arêtes" : edges === "vertical" ? "les arêtes verticales" : `le contour de la face ${edges.face}`}`,
      apply: (s) => push(s, { op: "chamfer", id: nextId(s, "c"), d, edges }) });
  }
  // 4. shell
  if ((m = new RegExp(`(?:coque|shell|creuse[rz]?|evide[rz]?)\\D*?${NUM}`).exec(t))) {
    const th = N(m[1]), open = faceFrom(t);
    out.push({ label: `Creuser la pièce en coque de ${f2(th)} mm, ouverte sur la face ${open}`, apply: (s) => push(s, { op: "shell", id: nextId(s, "s"), t: th, open: [open] }) });
  }
  // 5. pocket "poche 40x20 profondeur 5"
  if ((m = new RegExp(`(?:poche|pocket)\\D*?${NUM}\\s*[x×]\\s*${NUM}(?:.*?(?:profond(?:eur)?|depth)\\s*${NUM})?`).exec(t)) && bb) {
    const w = N(m[1]), h = N(m[2]), depth = m[3] ? N(m[3]) : 3, face = faceFrom(t), [a0, b0, a1, b1] = planeBox(bb, face);
    const rm = new RegExp(`(?:rayon|r)\\s*${NUM}`).exec(t), r = rm ? N(rm[1]) : Math.max(1.5, depth / 3);
    out.push({ label: `Ajouter une poche ${f2(w)} × ${f2(h)}, profondeur ${f2(depth)}, rayons ${f2(r)}, centrée sur la face ${face}`,
      apply: (s) => push(s, { op: "pocket", id: nextId(s, "p"), face, rect: [(a0 + a1 - w) / 2, (b0 + b1 - h) / 2, w, h], r, depth }) });
  }
  // 6. material / process
  if ((m = /(?:materiau|material|matiere)\s+(.+)/.exec(t))) {
    const q = m[1].replace(/\s+/g, ""), mat = MATERIALS.find((x) => norm(x.id).replace(/[^a-z0-9]/g, "") === q.replace(/[^a-z0-9]/g, "")) || MATERIALS.find((x) => norm(x.id + x.name).replace(/\s+/g, "").includes(q));
    if (mat) out.push({ label: `Changer le matériau pour ${mat.name}`, apply: (s) => { s.material = mat.id; } });
  }
  if ((m = /(?:procede|process|fabrication)\s+(.+)/.exec(t))) {
    const q = m[1], hit = Object.entries(PROCESSES).find(([k, p]) => norm(k).includes(q.replace(/\s+/g, "_")) || norm(p.fr).includes(q) || norm(p.label).includes(q));
    if (hit) out.push({ label: `Changer le procédé pour ${hit[1].fr}`, apply: (s) => { s.process = hit[0]; } });
  }
  // 7. features: delete / suppress / restore
  if ((m = /(?:supprime[rz]?|delete|efface[rz]?|retire[rz]?|enleve[rz]?)\s+(\S+)/.exec(t))) {
    const i = featureIndex(spec, m[1]);
    if (i >= 0) out.push({ label: `Supprimer la feature ${spec.features[i].id || `f${i + 1}`} (${spec.features[i].op})`, apply: (s) => s.features.splice(i, 1) });
  }
  if ((m = /(?:masque[rz]?|suppress|desactive[rz]?|cache[rz]?)\s+(\S+)/.exec(t))) {
    const i = featureIndex(spec, m[1]);
    if (i >= 0) out.push({ label: `Désactiver la feature ${spec.features[i].id || `f${i + 1}`} (${spec.features[i].op})`, apply: (s) => { s.features[i].suppressed = true; } });
  }
  if ((m = /(?:reactive[rz]?|restore|unsuppress|montre[rz]?)\s+(\S+)/.exec(t))) {
    const i = featureIndex(spec, m[1]);
    if (i >= 0) out.push({ label: `Réactiver la feature ${spec.features[i].id || `f${i + 1}`}`, apply: (s) => { delete s.features[i].suppressed; } });
  }
  // 8. rename
  if ((m = /^(?:renomme[rz]?|rename|nom)\s+(?:en\s+|to\s+)?(.+)$/.exec(String(text).trim().replace(/\s+/g, " ")))) {
    const name = m[1].trim();
    out.push({ label: `Renommer la pièce « ${name} »`, apply: (s) => { s.name = name; } });
  }
  return out;
}
function featureIndex(spec, token) {
  const k = token.toLowerCase();
  return (spec.features || []).findIndex((f, i) => String(f.id || `f${i + 1}`).toLowerCase() === k);
}

export const NL_EXAMPLES = ["longueur 150", "4 trous M4 aux coins à 8 mm", "trou M6 taraudé au centre", "congé 3 vertical", "chanfrein 0,5 dessus",
  "coque 2 ouverte dessus", "poche 40x20 profondeur 5", "matériau PA66-GF30", "procédé usinage", "supprimer f3"];
