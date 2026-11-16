// DesignWizard.ai - push an assembly (STEP + drawings + metadata) to an Onshape document.
// Orchestrates web/js/onshape/api.js. Every step is failure-tolerant: problems are collected in
// `warnings` (French, with « Correctif : … ») and the push goes on with what can still be done.
//
// What is sent, per the Onshape API reference (docs/ONSHAPE.md):
//   * the STEP goes to POST /blobelements (translate=true): Onshape creates Part Studio / Assembly tabs
//     "as needed, named according to the names in the imported file". Which ids come back in
//     resultElementIds for an assembly is UNCONFIRMED -> the tabs are found by diffing the element list
//     before / after, and parts are matched by name inside every new Part Studio (works for one studio
//     per part as well as one studio holding all parts);
//   * native drawings: POST /drawings/.../create (4 standard views), then ONE modify request with
//     Onshape::Note annotations (the only annotation sent by default: its payload is confirmed by the docs).
//     GD&T is written as text lines in the notes block; native GD&T frames are opt-in
//     (options.nativeGdt) because the position of the datum fields in the frame string is UNCONFIRMED.

import * as api from './api.js';
import { FOOT_NOTE, stampText } from '../core/brand.js';

const SYMBOL_FONT = 'Drawing Symbols Sans';
const GDT = {
  position: '⌖', concentricity: '◎', coaxiality: '◎', symmetry: '⌯', parallelism: '∥', perpendicularity: '⟂',
  angularity: '∠', flatness: '⏥', straightness: '⏤', circularity: '○', roundness: '○', cylindricity: '⌭',
  profile_line: '⌒', profile_surface: '⌓', runout: '↗', circular_runout: '↗', total_runout: '⌰',
};

/** Same normalisation as the STEP writer: characters outside [A-Za-z0-9_\-. ] become "_". */
export function normName(s) {
  return String(s ?? '').replace(/[^A-Za-z0-9_\-. ]/g, '_');
}

const key = (s) => normName(String(s ?? '').replace(/\s*(<\d+>|\(\d+\))\s*$/, '')).trim().toLowerCase();
const clean = (s) => String(s ?? '').replace(/[\\{}]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 240);
const hasPdf = (p) => !!(p && p.pdfBytes && p.pdfBytes.length);

function settings(job) {
  return { nativeDrawings: true, attachPdf: true, setMetadata: true, nativeGdt: false, renameParts: false,
    flattenAssemblies: false, yAxisIsUp: false, createComposite: false, sheetUnits: 'mm', ...(job && job.options) };
}

const stepFileName = (job) => `${normName(job.assemblyName || 'assembly').trim() || 'assembly'}.step`;
const pdfTabName = (part) => `${normName(part.id)} – drawing.pdf`;
const drawingName = (part) => `${normName(part.id)} – ${clean((part.drawing && part.drawing.title) || part.name || 'drawing')}`.slice(0, 200);

/** Text of the steps, for the confirmation dialog shown BEFORE anything is sent. Returns string[]. */
export function planPush(job) {
  const o = settings(job);
  const parts = Array.isArray(job && job.parts) ? job.parts : [];
  const nPdf = o.attachPdf ? parts.filter(hasPdf).length : 0;
  const nDraw = o.nativeDrawings ? parts.length : 0;
  const nMeta = o.setMetadata ? parts.length : 0;
  const calls = 2 + 5 + (o.flattenAssemblies ? 1 : parts.length) + nPdf + nDraw * 4 + nMeta * 2;
  const lines = [
    `Document Onshape cible : ${job.documentName || job.did} (workspace ${job.workspaceName || job.wid}).`,
    `1. Envoi du fichier « ${stepFileName(job)} » (STEP AP214, ${parts.length} pièce(s)) puis conversion par Onshape `
      + `en ${o.flattenAssemblies ? 'un Part Studio unique' : 'onglets Part Studio + Assembly natifs'}.`,
  ];
  if (nPdf) lines.push(`2. Ajout de ${nPdf} plan(s) PDF en onglets : ${parts.filter(hasPdf).map(pdfTabName).join(', ')}.`);
  if (nDraw) {
    lines.push(`${nPdf ? 3 : 2}. Création de ${nDraw} dessin(s) natif(s) Onshape (4 vues standard, associatifs à la pièce 3D) `
      + `avec le bloc de notes${o.nativeGdt ? ' et les cadres GD&T (expérimental)' : ' (GD&T en texte ; cotes et cadres GD&T dans le PDF)'}.`);
  }
  if (nMeta) lines.push(`${1 + (nPdf ? 1 : 0) + (nDraw ? 1 : 0) + 1}. Renseignement des propriétés des pièces : part number, description, révision, matériau (si modifiables).`);
  lines.push(`Environ ${calls} appels API Onshape (quota annuel : 2 500 appels sur les plans Free / Standard).`);
  lines.push('Attention : avec un plan Onshape Free, le document est PUBLIC — tout ce qui est envoyé devient visible de tous.');
  lines.push('Chaque envoi crée de NOUVEAUX onglets 3D et dessins (les PDF de même nom sont mis à jour) : '
    + 'pour une nouvelle révision, préférez un nouveau document ou créez une version Onshape avant l\'envoi.');
  return lines;
}

function candidates(part) {
  const id = part.id ?? '';
  const name = part.name ?? '';
  return [...new Set([key(name), key(id), key(`${id} ${name}`), key(`${id}_${name}`), key(`${id}-${name}`),
    key(`${id} - ${name}`)].filter(Boolean))];
}

/** Match each app part to {eid, partId?} among the imported part studios. Returns Map(part -> target). */
function matchParts(parts, studios) {
  const targets = [];
  for (const s of studios) {
    const list = s.parts.length ? s.parts : [{ partId: undefined, name: s.name }];
    for (const p of list) {
      const keys = [key(p.name)];
      if (s.parts.length <= 1) keys.push(key(s.name));
      targets.push({ eid: s.id, partId: p.partId, name: p.name, keys, used: false });
    }
  }
  const out = new Map();
  const tests = [
    (k, c) => k === c,
    (k, c) => k.length >= 3 && c.length >= 3 && (k.startsWith(c) || c.startsWith(k)),
  ];
  for (const test of tests) {
    for (const part of parts) {
      if (out.has(part)) continue;
      const cands = candidates(part);
      const t = targets.find((x) => !x.used && x.keys.some((k) => cands.some((c) => test(k, c))));
      if (t) { t.used = true; out.set(part, t); }
    }
  }
  return out;
}

function point(x, y) {
  return { type: 'Onshape::Reference::Point', coordinate: [x, y, 0] };
}

function gdtSymbol(symbol) {
  const s = String(symbol ?? '').trim();
  return GDT[s.toLowerCase().replace(/[\s-]+/g, '_')] || clean(s);
}

function gdtFrame(g) {
  const font = (ch) => `{\\f${SYMBOL_FONT};${ch}}`;
  const tol = clean(g.tolerance).replace(/[∅⌀ⓂⓁⓈⓅⒻⓉⓊ]/g, (ch) => font(ch === '⌀' ? '∅' : ch));
  const d = (Array.isArray(g.datums) ? g.datums : []).map(clean);
  // symbol %%v tolerance %%v (2nd tolerance) %%v datum1 %%v datum2 %%v datum3 %%v  -- datum slots UNCONFIRMED
  return `${font(gdtSymbol(g.symbol))}%%v${tol}%%v%%v${d[0] || ''}%%v${d[1] || ''}%%v${d[2] || ''}%%v\n`;
}

/** Annotations of one drawing: a block of single-line notes (+ optional native GD&T frames). */
function buildAnnotations(part, o) {
  const d = part.drawing || {};
  const gdt = (Array.isArray(d.gdt) ? d.gdt : []).filter((g) => g && g.symbol);
  const lines = [];
  const notes = (Array.isArray(d.notes) ? d.notes : []).map(clean).filter(Boolean);
  if (notes.length) {
    lines.push('NOTES :');
    notes.forEach((n, i) => lines.push(`${i + 1}. ${n}`));
  }
  if (gdt.length && !o.nativeGdt) {
    lines.push('TOLÉRANCES GÉOMÉTRIQUES (voir le plan PDF pour leur position) :');
    for (const g of gdt) {
      const datums = (Array.isArray(g.datums) ? g.datums : []).map(clean).filter(Boolean);
      lines.push(`${gdtSymbol(g.symbol)} ${clean(g.tolerance)}${datums.length ? ` | ${datums.join(' | ')}` : ''}`);
    }
  }
  lines.push(FOOT_NOTE);                                       // the note of the platform closes the block of notes of the native drawing
  // Sheet space, drawing units, origin assumed bottom-left (created with units=MILLIMETER).
  const k = o.sheetUnits === 'inch' ? 1 / 25.4 : 1;
  const lay = { x: 15 * k, y: 20 * k, textHeight: 3.5 * k, lineStep: 6 * k, ...(o.notes || {}) };
  const annotations = lines.map((text, i) => ({
    type: 'Onshape::Note',
    note: { position: point(lay.x, lay.y + (lines.length - 1 - i) * lay.lineStep), contents: text, textHeight: lay.textHeight },
  }));
  if (o.nativeGdt) {
    gdt.forEach((g, i) => annotations.push({
      type: 'Onshape::GeometricTolerance',
      geometricTolerance: { frames: [gdtFrame(g)], position: point(lay.x + 150 * k, lay.y + i * 2 * lay.lineStep) },
    }));
  }
  return annotations;
}

/**
 * pushToOnshape(job, onProgress) -> { ok, documentUrl, elements:{assembly?, partStudios, drawings, pdfs}, warnings }
 * `ok` is true when the STEP was converted by Onshape; read `warnings` for everything that was skipped.
 * `deps` (optional) replaces the api module in tests.
 */
export async function pushToOnshape(job, onProgress, deps) {
  const A = deps || api;
  if (!job || !job.did || !job.wid) {
    throw new Error('Envoi Onshape impossible : aucun document cible. Correctif : choisissez un document et un workspace Onshape.');
  }
  const { did, wid } = job;
  const o = settings(job);
  const parts = Array.isArray(job.parts) ? job.parts : [];
  const warnings = [];
  const result = { ok: false, documentUrl: null, elements: { assembly: null, partStudios: [], drawings: [], pdfs: [] }, warnings };
  const nPdf = o.attachPdf ? parts.filter(hasPdf).length : 0;
  const nDraw = o.nativeDrawings ? parts.length : 0;
  const nMeta = o.setMetadata ? parts.length : 0;
  const total = 3 + nPdf + nDraw + nMeta;
  let done = 0;
  const tick = (step, label, detail = '', inc = 0) => {
    done = Math.min(total, done + inc);
    try { if (onProgress) onProgress({ step, label, done, total, detail }); } catch (e) { /* UI errors never stop the push */ }
  };
  const warn = (prefix, e) => warnings.push(`${prefix} : ${e && e.message ? e.message : e}`);
  const fatal = (e) => e && (e.status === 401 || e.status === 402);
  const finish = () => { done = total; tick(6, 'Envoi vers Onshape terminé', `${warnings.length} avertissement(s)`); return result; };
  const wait = { timeoutMs: o.timeoutMs, intervalMs: o.pollMs };
  Object.keys(wait).forEach((k) => wait[k] === undefined && delete wait[k]);

  let base = 'https://cad.onshape.com';
  try { base = (await A.status()).baseUrl || base; } catch (e) { /* default URL */ }
  result.documentUrl = `${base}/documents/${did}/w/${wid}`;
  const url = (eid) => `${result.documentUrl}/e/${eid}`;

  // ---- 1. upload + translate the STEP ----
  tick(1, 'Envoi du STEP vers Onshape', stepFileName(job));
  let before = null;
  try { before = await A.listElements(did, wid); } catch (e) {
    warn('Lecture des onglets du document impossible', e);
    if (fatal(e)) return finish();
  }
  let upload = null;
  if (!job.stepText) {
    warnings.push('Aucun STEP à envoyer : la géométrie 3D est absente. Correctif : générez l\'assemblage avant l\'envoi.');
  } else {
    try {
      upload = await A.importFile({ did, wid, filename: stepFileName(job), text: stampText('modele.step', job.stepText), kind: 'step',
        options: { flattenAssemblies: !!o.flattenAssemblies, yAxisIsUp: !!o.yAxisIsUp, createComposite: !!o.createComposite } });
    } catch (e) {
      warn('STEP non envoyé', e);
      if (fatal(e)) return finish();
    }
  }
  tick(1, 'Envoi du STEP vers Onshape', stepFileName(job), 1);

  // ---- 2. wait for the translation ----
  let translated = null;
  if (upload) {
    tick(2, 'Conversion du STEP par Onshape', 'en cours…');
    try {
      translated = await A.waitTranslation(upload.translationId, { ...wait,
        onTick: (s) => tick(2, 'Conversion du STEP par Onshape', `${Math.round(s.elapsedMs / 1000)} s`) });
    } catch (e) { warn('Conversion du STEP', e); }
  }
  tick(2, 'Conversion du STEP par Onshape', translated ? 'terminée' : 'non effectuée', 1);
  result.ok = !!translated;

  // ---- 3. find the new tabs, match the parts by name ----
  let matches = new Map();
  if (translated) {
    tick(3, 'Repérage des pièces importées', '');
    let created = [];
    try {
      const after = await A.listElements(did, wid);
      const known = new Set((before || []).map((e) => e.id));
      const listed = new Set(translated.resultElementIds || []);
      created = after.filter((e) => (before ? !known.has(e.id) : listed.has(e.id)));
    } catch (e) { warn('Lecture des onglets importés impossible', e); }
    const studios = created.filter((e) => e.elementType === 'PARTSTUDIO').map((e) => ({ id: e.id, name: e.name, url: url(e.id), parts: [] }));
    for (const s of studios) {
      try { s.parts = (await A.partsOf(did, wid, s.id)).map((p) => ({ partId: p.partId, name: p.name })); } catch (e) {
        warn(`Liste des pièces de « ${s.name} » impossible`, e);
      }
    }
    const assemblies = created.filter((e) => e.elementType === 'ASSEMBLY');
    const asm = assemblies.find((e) => key(e.name) === key(job.assemblyName)) || assemblies[0];
    if (asm) result.elements.assembly = { id: asm.id, name: asm.name, url: url(asm.id) };
    result.elements.partStudios = studios;
    if (!studios.length) {
      warnings.push('Onshape n\'a créé aucun onglet Part Studio à partir du STEP. Correctif : ouvrez le document dans Onshape '
        + 'pour vérifier l\'import, puis relancez l\'envoi.');
    }
    matches = matchParts(parts, studios);
    const names = studios.flatMap((s) => (s.parts.length ? s.parts.map((p) => p.name) : [s.name]));
    for (const part of parts) {
      if (!matches.has(part)) {
        warnings.push(`Pièce « ${part.id} » (${part.name || ''}) introuvable parmi les pièces importées [${names.join(', ')}]. `
          + 'Correctif : vérifiez que le composant porte ce nom dans le STEP ; son dessin natif et ses propriétés ne sont pas créés.');
      }
    }
  }
  tick(3, 'Repérage des pièces importées', `${matches.size}/${parts.length} pièce(s) reconnue(s)`, 1);

  // ---- 4. PDF drawings as blob tabs ----
  for (const part of parts.filter((p) => o.attachPdf && hasPdf(p))) {
    const name = pdfTabName(part);
    tick(4, 'Envoi des plans PDF', name);
    const same = (n) => n === name || n === name.replace(/\.pdf$/, '');
    const existing = (before || []).find((e) => e.elementType === 'BLOB' && (same(e.name) || same(e.filename)));
    try {
      const r = await A.importFile({ did, wid, filename: name, bytes: part.pdfBytes, kind: 'pdf', elementId: existing ? existing.id : undefined });
      result.elements.pdfs.push({ part: part.id, elementId: r.elementId, name, url: url(r.elementId), updated: !!existing });
    } catch (e) { warn(`PDF de « ${part.id} » non envoyé`, e); }
    tick(4, 'Envoi des plans PDF', name, 1);
  }

  // ---- 5. native drawings: create them all first, then annotate (lets Onshape finish generating views) ----
  const toAnnotate = [];
  for (const part of (o.nativeDrawings ? parts : [])) {
    const target = matches.get(part);
    const name = drawingName(part);
    tick(5, 'Création des dessins natifs Onshape', name);
    if (target) {
      try {
        const dr = await A.createDrawing({ did, wid, name, elementId: target.eid, partId: target.partId,
          size: (part.drawing && part.drawing.size) || 'A3', template: o.template });
        (dr.warnings || []).forEach((w) => warnings.push(`Dessin de « ${part.id} » : ${w}`));
        const entry = { part: part.id, elementId: dr.elementId, name, url: url(dr.elementId), annotations: 'none' };
        result.elements.drawings.push(entry);
        toAnnotate.push({ part, entry });
      } catch (e) { warn(`Dessin natif de « ${part.id} » non créé`, e); }
    }
    tick(5, 'Création des dessins natifs Onshape', name, 1);
  }
  for (const { part, entry } of toAnnotate) {
    const annotations = buildAnnotations(part, o);
    if (!annotations.length) continue;
    tick(5, 'Ajout des notes sur les dessins', entry.name);
    try {
      const rq = await A.modifyDrawing(did, wid, entry.elementId, { description: 'DesignWizard notes',
        jsonRequests: [{ messageName: 'onshapeCreateAnnotations', formatVersion: '2021-01-01', annotations }] });
      const st = await A.waitModify(did, wid, entry.elementId, rq.requestId, wait);
      const results = (st.output && Array.isArray(st.output.results)) ? st.output.results : [];
      const failed = results.map((r, i) => ({ r, i })).filter(({ r }) => r && r.status !== 'OK');
      if (st.state !== 'DONE') {
        entry.annotations = 'failed';
        warnings.push(`Notes du dessin de « ${part.id} » refusées par Onshape (${st.failureReason || (st.output && st.output.errorDescription) || st.state}). `
          + 'Correctif : ajoutez les notes à la main dans le dessin Onshape ; le plan PDF joint reste la référence.');
      } else if (failed.length) {
        entry.annotations = failed.length === annotations.length ? 'failed' : 'partial';
        warnings.push(`Dessin de « ${part.id} » : ${failed.length}/${annotations.length} annotation(s) refusée(s) par Onshape `
          + `(${failed[0].r.errorDescription || 'sans détail'}). Correctif : complétez le dessin dans Onshape ; le plan PDF joint reste la référence.`);
      } else {
        entry.annotations = 'ok';
      }
    } catch (e) {
      entry.annotations = 'failed';
      warn(`Notes du dessin de « ${part.id} » non ajoutées`, e);
    }
  }

  // ---- 6. part metadata ----
  for (const part of (o.setMetadata ? parts : [])) {
    const target = matches.get(part);
    tick(6, 'Renseignement des propriétés des pièces', String(part.id));
    if (target && target.partId) {
      try {
        const properties = { partNumber: part.id, description: part.description || part.name, revision: part.revision, material: part.material };
        if (o.renameParts) properties.name = part.name;
        const r = await A.setMetadata({ did, wid, eid: target.eid, partId: target.partId, properties });
        (r.skipped || []).forEach((s) => warnings.push(`Pièce « ${part.id} » : propriété « ${s.property} » non renseignée (${s.reason}). `
          + 'Correctif : renseignez-la dans Onshape (clic droit sur la pièce > Properties).'));
      } catch (e) { warn(`Propriétés de « ${part.id} » non renseignées`, e); }
    } else if (target) {
      warnings.push(`Pièce « ${part.id} » : partId Onshape inconnu, propriétés non renseignées. Correctif : renseignez-les dans Onshape.`);
    }
    tick(6, 'Renseignement des propriétés des pièces', String(part.id), 1);
  }
  return finish();
}
