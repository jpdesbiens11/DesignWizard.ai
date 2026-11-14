/* DesignWizard.ai — PCBA: a small reader for the Gerber and Excellon files this application writes — enough to check
   a fabrication file before it leaves : units, format, apertures, what is flashed, drawn and filled, and where.
   It is not a general viewer : arcs, macros and step-and-repeat are refused with a clear message. */

/** → { units, digits, apertures: Map(code → { shape, w, h }), flashes, strokes, regions, attributes, polarities, bbox } */
export function readGerber(text) {
  const out = { units: null, digits: null, apertures: new Map(), flashes: [], strokes: [], regions: [], attributes: {}, clear: 0, bbox: [Infinity, Infinity, -Infinity, -Infinity] };
  let scale = null, cur = null, pos = [0, 0], dark = true, region = null, stroke = null, ended = false;
  const grow = (x, y, r) => { out.bbox = [Math.min(out.bbox[0], x - r), Math.min(out.bbox[1], y - r), Math.max(out.bbox[2], x + r), Math.max(out.bbox[3], y + r)]; };
  const endStroke = () => { if (stroke && stroke.pts.length > 1) out.strokes.push(stroke); stroke = null; };
  for (const raw of String(text).split(/\*%?\s*|%\s*/)) {
    const c = raw.trim();
    if (!c) continue;
    if (ended) throw new Error("Gerber : du contenu suit la fin de fichier M02.");
    let m;
    if ((m = /^FSLAX(\d)(\d)Y(\d)(\d)$/.exec(c))) { out.digits = [+m[1], +m[2]]; scale = 10 ** -m[2]; }
    else if (c === "MOMM") out.units = "mm"; else if (c === "MOIN") out.units = "inch";
    else if ((m = /^ADD(\d+)([CRO]),([\d.]+)(?:X([\d.]+))?$/.exec(c))) out.apertures.set(+m[1], { shape: m[2], w: +m[3], h: m[4] === undefined ? +m[3] : +m[4] });
    else if ((m = /^TF\.(\w+),(.*)$/.exec(c))) out.attributes[m[1]] = m[2];
    else if (/^T[OA]\.|^TD/.test(c)) continue;
    else if (c === "LPD") { endStroke(); dark = true; } else if (c === "LPC") { endStroke(); dark = false; out.clear++; }
    else if (c === "G01") continue;
    else if (c === "G36") { endStroke(); region = { pts: [], dark }; } else if (c === "G37") { if (!region || region.pts.length < 3) throw new Error("Gerber : région vide."); out.regions.push(region); region = null; }
    else if ((m = /^D(\d+)$/.exec(c)) && +m[1] >= 10) { endStroke(); if (!out.apertures.has(+m[1])) throw new Error(`Gerber : ouverture D${m[1]} non définie.`); cur = +m[1]; }
    else if ((m = /^(?:X(-?\d+))?(?:Y(-?\d+))?D0([123])$/.exec(c))) {
      if (scale === null || !out.units) throw new Error("Gerber : coordonnée avant la déclaration du format et des unités.");
      const p = [m[1] === undefined ? pos[0] : +m[1] * scale, m[2] === undefined ? pos[1] : +m[2] * scale], op = +m[3];
      if (region) { if (op === 3) throw new Error("Gerber : flash dans une région."); region.pts.push(p); grow(p[0], p[1], 0); }
      else {
        const a = out.apertures.get(cur);
        if (op !== 2 && !a) throw new Error("Gerber : tracé sans ouverture choisie.");
        if (op === 3) { endStroke(); out.flashes.push({ x: p[0], y: p[1], aperture: cur, dark }); grow(p[0], p[1], Math.max(a.w, a.h) / 2); }
        else if (op === 2) { endStroke(); stroke = { pts: [p], aperture: cur, dark }; }
        else { if (!stroke) stroke = { pts: [pos], aperture: cur, dark }; stroke.pts.push(p); grow(pos[0], pos[1], a.w / 2); grow(p[0], p[1], a.w / 2); }
      }
      pos = p;
    } else if (c === "M02") { endStroke(); ended = true; }
    else if (/^G0[23]|^G7[45]|^AM|^SR|^AB/.test(c)) throw new Error(`Gerber : construction non prise en charge (${c.slice(0, 12)}).`);
    else throw new Error(`Gerber : commande inconnue « ${c.slice(0, 24)} ».`);
  }
  if (!ended) throw new Error("Gerber : fin de fichier M02 manquante.");
  if (!out.units || !out.digits) throw new Error("Gerber : unités ou format manquants.");
  return out;
}

/** → { units, tools: Map(n → diameter), hits: [{ x, y, d }], plated } */
export function readExcellon(text) {
  const out = { units: null, tools: new Map(), hits: [], plated: null };
  let head = true, tool = null, ended = false;
  for (const raw of String(text).split(/\r?\n/)) {
    const c = raw.trim();
    if (!c) continue;
    let m;
    if (c[0] === ";") { if ((m = /TF\.FileFunction,(Plated|NonPlated)/.exec(c))) out.plated = m[1] === "Plated"; continue; }
    if (c === "M48" || c === "FMAT,2" || c === "G90" || c === "G05") continue;
    if (/^METRIC/.test(c)) out.units = "mm"; else if (/^INCH/.test(c)) out.units = "inch";
    else if (c === "%") head = false;
    else if (head && (m = /^T(\d+)C([\d.]+)$/.exec(c))) out.tools.set(+m[1], +m[2]);
    else if (!head && (m = /^T(\d+)$/.exec(c))) { if (+m[1] !== 0 && !out.tools.has(+m[1])) throw new Error(`Perçage : outil T${m[1]} non défini.`); tool = +m[1]; }
    else if (!head && (m = /^X(-?[\d.]+)Y(-?[\d.]+)$/.exec(c))) { if (!tool) throw new Error("Perçage : trou sans outil choisi."); out.hits.push({ x: +m[1], y: +m[2], d: out.tools.get(tool) }); }
    else if (c === "M30") ended = true;
    else throw new Error(`Perçage : ligne inconnue « ${c.slice(0, 24)} ».`);
  }
  if (!ended) throw new Error("Perçage : fin de fichier M30 manquante.");
  if (!out.units) throw new Error("Perçage : unités manquantes.");
  return out;
}
