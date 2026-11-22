/* DynamiteOrbit — reading a .zip (the folder an assistant hands back : several .dwiz or JSON files in one archive).
   The counterpart of core/zip.js, which writes one. No dependency : the central directory is read by hand, and a compressed
   entry is inflated by the browser itself (DecompressionStream, « deflate-raw »). Only what the door of the Shop needs :
   entries stored or deflated, no encryption, no ZIP64 ; an entry too large, or of another kind, is reported and left. */

const u16 = (b, o) => b[o] | (b[o + 1] << 8), u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
const dec = new TextDecoder("utf-8");
async function inflate(data) { const s = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw")); return new Uint8Array(await new Response(s).arrayBuffer()); }

/** bytes : Uint8Array of a .zip. o : { maxFiles (60), maxBytes (per entry, uncompressed : 8 MB) }
    → { files: [{ name, bytes }], skipped: [{ name, why }] } ; throws a French message when it is not a .zip one can read. */
export async function unzip(bytes, o = {}) {
  const maxFiles = o.maxFiles || 60, maxBytes = o.maxBytes || 8 * 1024 * 1024, b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let end = -1; for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (u32(b, i) === 0x06054b50) { end = i; break; }
  if (end < 0) throw new Error("Ce n'est pas une archive .zip lisible (fin d'archive introuvable).");
  const count = u16(b, end + 10), files = [], skipped = []; let at = u32(b, end + 16);
  for (let n = 0; n < count; n++) {
    if (at + 46 > b.length || u32(b, at) !== 0x02014b50) throw new Error("Archive .zip abîmée (répertoire illisible).");
    const flags = u16(b, at + 8), method = u16(b, at + 10), comp = u32(b, at + 20), size = u32(b, at + 24), nameLen = u16(b, at + 28), extra = u16(b, at + 30), note = u16(b, at + 32), local = u32(b, at + 42);
    const name = dec.decode(b.subarray(at + 46, at + 46 + nameLen)); at += 46 + nameLen + extra + note;
    if (name.endsWith("/") || /^__MACOSX\//.test(name) || /(^|\/)\./.test(name)) continue;      // a folder, or what a system adds beside the files
    if (files.length >= maxFiles) { skipped.push({ name, why: `plus de ${maxFiles} fichiers` }); continue; }
    if (flags & 1) { skipped.push({ name, why: "fichier chiffré" }); continue; }
    if (size > maxBytes || comp === 0xffffffff) { skipped.push({ name, why: "fichier trop gros" }); continue; }
    if (u32(b, local) !== 0x04034b50) { skipped.push({ name, why: "en-tête illisible" }); continue; }
    const start = local + 30 + u16(b, local + 26) + u16(b, local + 28), data = b.subarray(start, start + comp);
    if (method === 0) files.push({ name, bytes: data.slice() });
    else if (method === 8) { try { const out = await inflate(data); if (out.length > maxBytes) skipped.push({ name, why: "fichier trop gros" }); else files.push({ name, bytes: out }); } catch { skipped.push({ name, why: "décompression impossible" }); } }
    else skipped.push({ name, why: "compression non prise en charge" });
  }
  return { files, skipped };
}
/** The text files of an archive one can read as an answer : .dwiz, .json, .txt, .md. → { texts: [{ name, text }], skipped } */
export async function unzipTexts(bytes, o = {}) {
  const r = await unzip(bytes, o), texts = [], skipped = r.skipped.slice();
  for (const f of r.files) { if (/\.(dwiz|json|txt|md)$/i.test(f.name)) texts.push({ name: f.name, text: dec.decode(f.bytes) }); else skipped.push({ name: f.name, why: "ni .dwiz, ni .json, ni texte" }); }
  return { texts, skipped };
}
