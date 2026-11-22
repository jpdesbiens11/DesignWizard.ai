"""Logo of DynamiteOrbit (see tools/make_sketch_assets.py and docs/BRAND.md): constructed, not hand-drawn.

The mark is « the bolt put in orbit » (identity board v1, 22 November 2026, track C): the yellow tile and the lightning bolt of the
DynamiteAgile family, smaller, at the centre of a 64-unit grid; an orbit (an ellipse rx 29, ry 12, tilted -28°) passes behind the
tile and in front of it, and carries an orange spark. The words are drawn with a single-stroke technical lettering (cap height 10,
x-height 7, bowls of radius 3.5), so the images contain no <text> and look the same on every machine. Deterministic.
"""
import math

INK, BLUE, YELLOW, PAPER, MUTED, ORANGE = "#26323f", "#0c66e4", "#ffd23f", "#fcfbf7", "#5e6c84", "#e0602f"
C, RX, RY, ROT = (32, 32), 29, 12, -28          # the orbit
TILE = (15, 15, 34, 34, 6)                      # x, y, w, h, corner radius
BOLT = [(34.48, 19.6), (25.8, 33.24), (32, 33.24), (29.52, 44.4), (39.44, 29.52), (33.24, 29.52)]
WIDTH, SPARK_AT, SPARK_R = 4, 30, 6.4


def f(v):
    return ("%.2f" % v).rstrip("0").rstrip(".")


def ring_pt(theta):
    """Point of the orbit at parameter theta (degrees); 0..180 is the half in front of the tile."""
    t, r = math.radians(theta), math.radians(ROT)
    return (C[0] + RX * math.cos(t) * math.cos(r) - RY * math.sin(t) * math.sin(r),
            C[1] + RX * math.cos(t) * math.sin(r) + RY * math.sin(t) * math.cos(r))


def star_d(cx, cy, r, waist=0.3):
    pts = []
    for i in range(8):
        a, k = math.pi * i / 4 - math.pi / 2, (r if i % 2 == 0 else r * waist)
        pts.append("{} {}".format(f(cx + k * math.cos(a)), f(cy + k * math.sin(a))))
    return "M" + "L".join(pts) + "Z"


def mark_body(leg=INK, arc=BLUE, star=YELLOW, star_edge=INK, spark=ORANGE):
    """SVG fragment of the mark on its 64 × 64 grid: leg = ink of the bolt and of the tile's edge, arc = the orbit, star = the tile.
    Colours may be 'currentColor' or 'var(--acc, …)'; star_edge None draws the tile without an edge."""
    (ax, ay), (bx, by) = ring_pt(0), ring_pt(180)
    ring = 'fill="none" stroke="{}" stroke-width="{}" stroke-linecap="round"'.format(arc, WIDTH)
    x, y, w, h, rr = TILE
    edge = ' stroke="{}" stroke-width="{}"'.format(star_edge, WIDTH) if star_edge else ""
    sx, sy = ring_pt(SPARK_AT)
    return "".join([
        '<ellipse cx="{}" cy="{}" rx="{}" ry="{}" transform="rotate({} {} {})" {}/>'.format(C[0], C[1], RX, RY, ROT, C[0], C[1], ring),
        '<rect x="{}" y="{}" width="{}" height="{}" rx="{}" fill="{}"{}/>'.format(x, y, w, h, rr, star, edge),
        '<path d="M{}Z" fill="none" stroke="{}" stroke-width="3.6" stroke-linejoin="round"/>'.format("L".join("{} {}".format(f(a), f(b)) for a, b in BOLT), leg),
        '<path d="M{} {}A{} {} {} 0 1 {} {}" {}/>'.format(f(ax), f(ay), RX, RY, ROT, f(bx), f(by), ring),
        '<path d="{}" fill="{}" stroke="{}" stroke-width="1.4" stroke-linejoin="round"/>'.format(star_d(sx, sy, SPARK_R), spark, leg),
    ])


# ---------------------------------------------------------------- single-stroke lettering: glyph → (advance, path)
BOWL = "M7 -3.5A3.5 3.5 0 1 0 0 -3.5A3.5 3.5 0 1 0 7 -3.5"
GLYPHS = {
    "O": (9, "M4.5 -10A4.5 5 0 1 0 4.5 0A4.5 5 0 1 0 4.5 -10"), "D": (7.5, "M0 -10V0H2.5A5 5 0 0 0 2.5 -10H0"), "W": (12, "M0 -10L3 0L6 -8.2L9 0L12 -10"), "A": (8.4, "M0 0L4.2 -10L8.4 0M1.5 -3.4H6.9"),
    "a": (7, BOWL + "M7 -7V0"), "b": (7, "M0 -10V0" + BOWL), "d": (7, BOWL + "M7 -10V0"),
    "e": (7, "M0 -3.5H7A3.5 3.5 0 1 0 5.97 -1.03"), "g": (7, BOWL + "M7 -7V0A3.5 3.5 0 0 1 .47 1.75"),
    "i": (0, "M0 -7V0M0 -9.8V-9.7"), "l": (0, "M0 -10V0"), "m": (10, "M0 -7V0M0 -4.5A2.5 2.5 0 0 1 5 -4.5V0M5 -4.5A2.5 2.5 0 0 1 10 -4.5V0"),
    "n": (7, "M0 -7V0M0 -3.5A3.5 3.5 0 0 1 7 -3.5V0"), "r": (4.4, "M0 -7V0M0 -4A3 3 0 0 1 4.4 -6.65"),
    "s": (5, "M4.8 -5.9A1.75 1.75 0 0 0 3.2 -7H2.25A1.75 1.75 0 0 0 2.25 -3.5H2.75A1.75 1.75 0 0 1 2.75 0H1.8A1.75 1.75 0 0 1 .2 -1.1"),
    "t": (4.4, "M1.8 -9.6V-1.6A1.6 1.6 0 0 0 3.4 0H4.4M0 -7H4.4"), "y": (6.4, "M0 -7L3.44 -.4M6.4 -7L2.1 2.6"),
    "z": (5.6, "M.2 -7H5.4L.2 0H5.6"), ".": (0, "M0 -.1V0"), " ": (2.6, ""),
    "™": (7.4, "M0 -10H3M1.5 -10V-6.2M4.4 -6.2V-10L5.9 -7.8L7.4 -10V-6.2"),
}
TRACK = 2.6


def text_width(text):
    return sum(GLYPHS[c][0] for c in text) + TRACK * (len(text) - 1)


def lettering(text, x, y, scale, color, weight=1.7):
    """One <path> per run: text drawn from (x, baseline y), 1 glyph unit = scale."""
    d, cx = [], 0.0
    for c in text:
        adv, path = GLYPHS[c]
        if path:
            d.append('<path transform="translate({} {}) scale({})" d="{}"/>'.format(f(x + cx * scale), f(y), f(scale), path))
        cx += adv + TRACK
    return ('<g fill="none" stroke="{}" stroke-width="{}" stroke-linecap="round" stroke-linejoin="round">{}</g>'
            .format(color, f(weight), "".join(d)))


def words(x, y, scale, ink=INK, accent=BLUE, muted=MUTED, center=False):
    """« DynamiteOrbit » with « by DynamiteAgile™ » under it, starting at x; y = baseline of the name."""
    sub = scale * 0.46
    name_w = text_width("Dynamite") * scale
    out = lettering("Dynamite", x, y, scale, ORANGE) + lettering("Orbit", x + name_w + TRACK * scale, y, scale, accent)
    by_w = text_width("by DynamiteAgile") * sub
    sx = x + (text_width("DynamiteOrbit") * scale - by_w - 9 * sub) / 2 if center else x
    sy = y + 3.8 * scale + 10 * sub
    return out + lettering("by DynamiteAgile", sx, sy, sub, muted, 1.5) + lettering("™", sx + by_w + 1.6 * sub, sy, sub, muted, 1.1)


def svg(w, h, body, extra=""):
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {} {}" role="img" aria-label="DynamiteOrbit"{}>{}</svg>'
            .format(w, h, extra, body))


def mark_svg():
    return svg(64, 64, mark_body())


def mark_mono_svg():
    return svg(64, 64, mark_body("currentColor", "currentColor", "none", "currentColor", "currentColor"))


def favicon_svg():
    """The mark, reversed on a graphite tile: stays legible on light and dark browser tabs down to 16 px."""
    tile = '<rect x="1" y="1" width="62" height="62" rx="14" fill="{}"/>'.format(INK)
    return svg(64, 64, tile + '<g transform="translate(7 7.5) scale(.78)">{}</g>'.format(mark_body(INK, PAPER, YELLOW, None, ORANGE)))


def logo_symbol():
    """<symbol id="i-logo"> of the sprite: follows the theme (currentColor) and the module accent (--acc)."""
    return '<symbol id="i-logo" viewBox="0 0 64 64">{}</symbol>'.format(
        mark_body("currentColor", "currentColor", "var(--acc, {})".format(YELLOW), "currentColor"))


def wordmark_svg():
    scale = 2.6
    width = 64 + 16 + text_width("DynamiteOrbit") * scale + 8
    return svg(f(width), 64, mark_body() + words(80, 33, scale))


def stacked_svg():
    scale = 2.3
    w = text_width("DynamiteOrbit") * scale + 16
    body = '<g transform="translate({} 0) scale(1.25)">{}</g>'.format(f(w / 2 - 40), mark_body()) + words(8, 116, scale, center=True)
    return svg(f(w), 150, body)


def construction_svg():
    """The construction of the mark for docs/BRAND.md: module grid, the orbit's axes, the tile, clear space."""
    g = ['<rect x="-16" y="-16" width="96" height="96" fill="{}"/>'.format(PAPER)]
    for k in range(0, 65, 8):
        g.append('<path d="M{0} 0V64M0 {0}H64" stroke="{1}" stroke-opacity=".28" stroke-width=".35"/>'.format(k, BLUE))
    g.append('<rect x="0" y="0" width="64" height="64" fill="none" stroke="{}" stroke-width=".5"/>'.format(BLUE))
    g.append('<rect x="-8" y="-8" width="80" height="80" fill="none" stroke="{}" stroke-width=".4" stroke-dasharray="2 2"/>'.format(MUTED))
    for t in (0, 90):
        (x1, y1), (x2, y2) = ring_pt(t), ring_pt(t + 180)
        g.append('<path d="M{} {}L{} {}" stroke="{}" stroke-width=".4" stroke-dasharray="3 1 .6 1"/>'.format(f(x1), f(y1), f(x2), f(y2), INK))
    g.append('<g opacity=".82">{}</g>'.format(mark_body()))
    g.append('<circle cx="{}" cy="{}" r="1" fill="{}"/>'.format(C[0], C[1], INK))
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="-16 -16 96 96" role="img" aria-label="Construction">{}</svg>'
            .format("".join(g)))


def og_svg(emblems):
    """Social card 1200 × 630: paper grid, the mark, the constructed wordmark, the ten brick emblems. emblems: SVG fragments."""
    g = ['<defs><pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M30 0H0V30" fill="none" stroke="{}" '
         'stroke-opacity=".09"/></pattern></defs><rect width="1200" height="630" fill="{}"/><rect width="1200" height="630" fill="url(#grid)"/>'
         .format(BLUE, PAPER)]
    g.append('<path d="M96 388H1104" stroke="{}" stroke-width="2" stroke-dasharray="2 10" stroke-linecap="round"/>'.format(INK))
    g.append('<g transform="translate(96 96) scale(3.9)">{}</g>'.format(mark_body()))
    g.append(words(400, 232, 6.2))
    colors = ("#ffd23f", "#9b7bff", "#2ec4b6", "#4d8dff", "#3ec6e0", "#5fd08a", "#ff8a3d", "#ff5a4f", "#ff6f91", "#4d8dff")
    for i, emblem in enumerate(emblems):
        x = 96 + i * 102.4
        g.append('<rect x="{}" y="446" width="86" height="100" rx="12" fill="{}" fill-opacity=".38"/>'.format(f(x), colors[i]))
        g.append('<g transform="translate({} 452) scale(1.34)" color="{}">{}</g>'.format(f(x), INK, emblem))
    return svg(1200, 630, "".join(g))
