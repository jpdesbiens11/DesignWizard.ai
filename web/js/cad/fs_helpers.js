/* DesignWizard.ai — FeatureScript export (see featurescript.js), FeatureScript side: reserved names, text escaping, and
   the source of the helper functions written at the end of a generated script (only those the script uses). They compute
   in Onshape what the part language decides from the built geometry: level of a face when "start" is not given, depth of
   a through hole, faces opened by a shell, edges of a fillet; and they draw the profiles whose shape depends on the
   parameters (polygon with per-vertex fillets, obround) or that are fixed lists of segments. */

const FS_KEYWORDS = new Set(["annotation", "as", "assert", "break", "builtin", "case", "catch", "const", "continue", "default", "do", "else", "enum", "export",
  "false", "for", "function", "if", "import", "in", "inf", "is", "new", "operator", "precondition", "predicate", "return", "returns", "switch", "throw", "true", "try",
  "type", "typecheck", "typeconvert", "undefined", "var", "while"]);
/* Identifiers the generated feature body uses: a parameter with one of these names is renamed (suffix "_"). */
const FS_USED = new Set(["context", "id", "definition", "millimeter", "meter", "degree", "radian", "unitless", "PI", "vector", "plane", "line", "size", "append", "dot",
  "min", "max", "abs", "sqrt", "floor", "ceil", "round", "sin", "cos", "tan", "asin", "acos", "atan", "atan2",
  "newSketchOnPlane", "skRectangle", "skCircle", "skLineSegment", "skArc", "skSolve", "opExtrude", "opRevolve", "opBoolean", "opFillet", "opChamfer", "opShell",
  "opDeleteBodies", "fCuboid", "fCylinder", "fCone", "qCreatedBy", "qSketchRegion", "qUnion", "qOwnedByBody", "qGeometry", "evBox3d", "evPlane", "evLine",
  "evEdgeTangentLine", "evaluateQuery", "EntityType", "BoundingType", "BooleanOperationType", "ChamferType", "GeometryType", "defineFeature",
  "isLength", "isAngle", "isInteger", "isReal", "LengthBoundSpec", "AngleBoundSpec", "IntegerBoundSpec", "RealBoundSpec", "Context", "Id", "Query", "Sketch", "Vector"]);

const fsString = (s) => `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n\t]+/g, " ")}"`;
/* Free text going into a comment of the generated code: one line, and none of the words the checks look for. */
const clean = (s) => String(s).replace(/[\r\n]+/g, " ").replace(/undefined/g, "indéfini").replace(/NaN/g, "non numérique").replace(/\[object/g, "[objet");

const HELPERS = {
  box: `/* Niveau extérieur d'un corps le long d'un axe (0 = X, 1 = Y, 2 = Z), en millimètres. */
function dwLevel(context is Context, body is Query, axis is number, positive is boolean) returns number
{
    const bodyBox = evBox3d(context, { "topology" : body, "tight" : true });
    if (positive)
    {
        return bodyBox.maxCorner[axis] / millimeter;
    }
    return bodyBox.minCorner[axis] / millimeter;
}

/* Encombrement d'un corps le long d'un axe, en millimètres (profondeur des perçages et poches débouchants). */
function dwSpan(context is Context, body is Query, axis is number) returns number
{
    const bodyBox = evBox3d(context, { "topology" : body, "tight" : true });
    return (bodyBox.maxCorner[axis] - bodyBox.minCorner[axis]) / millimeter;
}`,
  polygon: `/* Polygone fermé avec un congé par sommet : vertices = [[x, y, r], ...] en millimètres (r = 0 : sommet vif). */
function dwPolygon(sk is Sketch, name is string, vertices is array)
{
    var pts = [];
    const count = size(vertices);
    for (var i = 0; i < count; i += 1)
    {
        const here = vertices[i];
        const after = vertices[(i + 1) % count];
        if (sqrt((here[0] - after[0]) * (here[0] - after[0]) + (here[1] - after[1]) * (here[1] - after[1])) > 0.0000001)
        {
            pts = append(pts, here);
        }
    }
    const n = size(pts);
    var starts = [];
    var ends = [];
    for (var i = 0; i < n; i += 1)
    {
        const p = pts[i];
        const a = pts[(i + n - 1) % n];
        const b = pts[(i + 1) % n];
        const la = sqrt((a[0] - p[0]) * (a[0] - p[0]) + (a[1] - p[1]) * (a[1] - p[1]));
        const lb = sqrt((b[0] - p[0]) * (b[0] - p[0]) + (b[1] - p[1]) * (b[1] - p[1]));
        const ux = (a[0] - p[0]) / la;
        const uy = (a[1] - p[1]) / la;
        const vx = (b[0] - p[0]) / lb;
        const vy = (b[1] - p[1]) / lb;
        const cosT = ux * vx + uy * vy;
        var r = p[2];
        var rounded = false;
        if (r > 0.0000001 && abs(cosT) < 0.9999995)
        {
            const tanHalf = sqrt((1 - cosT) / (1 + cosT));
            const sinHalf = sqrt((1 - cosT) / 2);
            var t = r / tanHalf;
            const tMax = 0.5 * min(la, lb) - 0.000001;
            if (t > tMax)
            {
                t = max(0, tMax);
                r = t * tanHalf;
            }
            if (r > 0.0001)
            {
                const bl = sqrt((ux + vx) * (ux + vx) + (uy + vy) * (uy + vy));
                const bx = (ux + vx) / bl;
                const by = (uy + vy) / bl;
                const cx = p[0] + bx * r / sinHalf;
                const cy = p[1] + by * r / sinHalf;
                const p1 = [p[0] + ux * t, p[1] + uy * t];
                const p2 = [p[0] + vx * t, p[1] + vy * t];
                skArc(sk, name ~ "a" ~ i, {
                        "start" : vector(p1[0], p1[1]) * millimeter,
                        "mid" : vector(cx - bx * r, cy - by * r) * millimeter,
                        "end" : vector(p2[0], p2[1]) * millimeter
                });
                starts = append(starts, p1);
                ends = append(ends, p2);
                rounded = true;
            }
        }
        if (!rounded)
        {
            starts = append(starts, [p[0], p[1]]);
            ends = append(ends, [p[0], p[1]]);
        }
    }
    for (var i = 0; i < n; i += 1)
    {
        const p1 = ends[i];
        const p2 = starts[(i + 1) % n];
        if (sqrt((p1[0] - p2[0]) * (p1[0] - p2[0]) + (p1[1] - p2[1]) * (p1[1] - p2[1])) > 0.0000001)
        {
            skLineSegment(sk, name ~ "l" ~ i, {
                    "start" : vector(p1[0], p1[1]) * millimeter,
                    "end" : vector(p2[0], p2[1]) * millimeter
            });
        }
    }
}`,
  slot: `/* Oblong (rainure) entre deux centres, de largeur w, en millimètres. */
function dwSlot(sk is Sketch, name is string, x1 is number, y1 is number, x2 is number, y2 is number, w is number)
{
    const r = w / 2;
    const span = sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
    if (span < 0.0000001)
    {
        skCircle(sk, name ~ "c", { "center" : vector(x1, y1) * millimeter, "radius" : r * millimeter });
        return;
    }
    const dx = (x2 - x1) / span;
    const dy = (y2 - y1) / span;
    const nx = 0 - dy;
    const ny = dx;
    skLineSegment(sk, name ~ "l1", { "start" : vector(x1 - nx * r, y1 - ny * r) * millimeter, "end" : vector(x2 - nx * r, y2 - ny * r) * millimeter });
    skArc(sk, name ~ "a1", { "start" : vector(x2 - nx * r, y2 - ny * r) * millimeter, "mid" : vector(x2 + dx * r, y2 + dy * r) * millimeter, "end" : vector(x2 + nx * r, y2 + ny * r) * millimeter });
    skLineSegment(sk, name ~ "l2", { "start" : vector(x2 + nx * r, y2 + ny * r) * millimeter, "end" : vector(x1 + nx * r, y1 + ny * r) * millimeter });
    skArc(sk, name ~ "a2", { "start" : vector(x1 + nx * r, y1 + ny * r) * millimeter, "mid" : vector(x1 - dx * r, y1 - dy * r) * millimeter, "end" : vector(x1 - nx * r, y1 - ny * r) * millimeter });
}`,
  path: `/* Contour donné par ses segments, en millimètres : [x1, y1, x2, y2] = droite, [x1, y1, xm, ym, x2, y2] = arc passant par un point milieu. */
function dwPath(sk is Sketch, name is string, segments is array)
{
    for (var i = 0; i < size(segments); i += 1)
    {
        const s = segments[i];
        if (size(s) == 4)
        {
            skLineSegment(sk, name ~ "l" ~ i, { "start" : vector(s[0], s[1]) * millimeter, "end" : vector(s[2], s[3]) * millimeter });
        }
        else
        {
            skArc(sk, name ~ "a" ~ i, { "start" : vector(s[0], s[1]) * millimeter, "mid" : vector(s[2], s[3]) * millimeter, "end" : vector(s[4], s[5]) * millimeter });
        }
    }
}`,
  faces: `/* Faces planes d'un corps perpendiculaires à une direction, au niveau le plus extérieur le long de cette direction (faces ouvertes d'une coque). */
function dwPlanarFaces(context is Context, body is Query, direction is Vector) returns Query
{
    var faces = [];
    var levels = [];
    var top = 0;
    for (var face in evaluateQuery(context, qGeometry(qOwnedByBody(body, EntityType.FACE), GeometryType.PLANE)))
    {
        const facePlane = evPlane(context, { "face" : face });
        if (abs(dot(facePlane.normal, direction)) > 0.999)
        {
            const level = dot(facePlane.origin, direction) / millimeter;
            if (size(faces) == 0 || level > top)
            {
                top = level;
            }
            faces = append(faces, face);
            levels = append(levels, level);
        }
    }
    var result = [];
    for (var i = 0; i < size(faces); i += 1)
    {
        if (levels[i] > top - 0.001)
        {
            result = append(result, faces[i]);
        }
    }
    return qUnion(result);
}`,
  edges: `/* Arêtes d'un corps selon les critères de DesignWizard.ai (ils se combinent) :
   byDir : arêtes droites parallèles à sel.dir ; byFace : arêtes dans le plan extérieur du corps le long de sel.axis
   (ou au niveau sel.level si byLevel) ; byBox : milieu dans la boîte sel.box ; byNear : milieu à moins de sel.tol de sel.near. */
function dwSelectEdges(context is Context, body is Query, sel is map) returns Query
{
    const bodyBox = evBox3d(context, { "topology" : body, "tight" : true });
    var result = [];
    for (var edge in evaluateQuery(context, qOwnedByBody(body, EntityType.EDGE)))
    {
        var keep = true;
        if (sel.byDir)
        {
            keep = false;
            if (size(evaluateQuery(context, qGeometry(edge, GeometryType.LINE))) > 0)
            {
                const edgeLine = evLine(context, { "edge" : edge });
                keep = abs(dot(edgeLine.direction, sel.dir)) > 0.9999;
            }
        }
        if (keep && sel.byFace)
        {
            var level = sel.level;
            if (!sel.byLevel)
            {
                if (sel.positive)
                {
                    level = bodyBox.maxCorner[sel.axis] / millimeter;
                }
                else
                {
                    level = bodyBox.minCorner[sel.axis] / millimeter;
                }
            }
            const edgeBox = evBox3d(context, { "topology" : edge, "tight" : true });
            keep = abs(edgeBox.minCorner[sel.axis] / millimeter - level) < 0.001 && abs(edgeBox.maxCorner[sel.axis] / millimeter - level) < 0.001;
        }
        if (keep && (sel.byBox || sel.byNear))
        {
            const mid = evEdgeTangentLine(context, { "edge" : edge, "parameter" : 0.5 }).origin / millimeter;
            if (sel.byBox)
            {
                for (var i = 0; i < 3; i += 1)
                {
                    if (mid[i] < sel.box[i] - 0.000001 || mid[i] > sel.box[i + 3] + 0.000001)
                    {
                        keep = false;
                    }
                }
            }
            if (keep && sel.byNear)
            {
                const dx = mid[0] - sel.near[0];
                const dy = mid[1] - sel.near[1];
                const dz = mid[2] - sel.near[2];
                keep = sqrt(dx * dx + dy * dy + dz * dz) <= sel.tol;
            }
        }
        if (keep)
        {
            result = append(result, edge);
        }
    }
    return qUnion(result);
}`,
};

export { FS_KEYWORDS, FS_USED, fsString, clean, HELPERS };
