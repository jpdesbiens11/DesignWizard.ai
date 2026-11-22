/* DynamiteOrbit — diagrams as draw.io files (the open mxGraph XML, uncompressed) : boxes and arrows that stay
   editable in diagrams.net, one page per diagram.
   page = { name, nodes: [{ id, x, y, w, h, text, style }], edges: [{ from, to, text, style }] } ; text may hold line breaks. */

const xml = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const label = (s) => xml(String(s ?? "").split("\n").map((l) => l.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")).join("<br>"));      // HTML label, then XML attribute
export const BOX = "rounded=1;whiteSpace=wrap;html=1;fontSize=11;";
export const LINK = "edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;fontSize=9;endArrow=block;endFill=1;";

/** The file. → text (.drawio) */
export function drawio(pages) {
  const out = ['<?xml version="1.0" encoding="UTF-8"?>', '<mxfile host="DynamiteOrbit" type="device">'];
  pages.forEach((p, k) => {
    const ids = new Set(p.nodes.map((n) => String(n.id))), w = Math.max(827, ...p.nodes.map((n) => n.x + n.w + 40)), h = Math.max(583, ...p.nodes.map((n) => n.y + n.h + 40));
    out.push(`  <diagram id="p${k + 1}" name="${xml(p.name)}">`, `    <mxGraphModel dx="${Math.round(w)}" dy="${Math.round(h)}" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" page="1" pageWidth="${Math.round(w)}" pageHeight="${Math.round(h)}">`, "      <root>", '        <mxCell id="0"/>', '        <mxCell id="1" parent="0"/>');
    for (const n of p.nodes) out.push(`        <mxCell id="${xml(n.id)}" value="${label(n.text)}" style="${xml(n.style || BOX)}" vertex="1" parent="1"><mxGeometry x="${Math.round(n.x)}" y="${Math.round(n.y)}" width="${Math.round(n.w)}" height="${Math.round(n.h)}" as="geometry"/></mxCell>`);
    p.edges.forEach((e, i) => { if (ids.has(String(e.from)) && ids.has(String(e.to))) out.push(`        <mxCell id="e${k + 1}_${i + 1}" value="${label(e.text || "")}" style="${xml(e.style || LINK)}" edge="1" parent="1" source="${xml(e.from)}" target="${xml(e.to)}"><mxGeometry relative="1" as="geometry"/></mxCell>`); });
    out.push("      </root>", "    </mxGraphModel>", "  </diagram>");
  });
  out.push("</mxfile>", "");
  return out.join("\n");
}
