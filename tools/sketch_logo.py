"""Logo of DesignOrbit.ai (see tools/make_sketch_assets.py and docs/BRAND.md): constructed, not hand-drawn.

The mark is a draughtsman's compass and the rocket that leaves it, on a 64-unit grid (module 8):
  pivot P = (32, 15); the two legs go to (12, 51) and (52, 51); the orbit is the arc the compass traces, a circle centred
  on P whose radius is the leg length, swept 14° beyond each leg; the rocket (the figure of web/js/core/brand.js turned
  40°) leaves the pivot on a dotted trajectory, seven dots 6 apart along the curve M5 38 Q9 14 38 12.
The numbers are the ones of LOGO in web/js/core/brand.js: a test holds web/img/logo/mark.svg equal to logoSvg().
The words are drawn with a single-stroke technical lettering (cap height 10, x-height 7, bowls of radius 3.5), so the
images contain no <text> and look the same on every machine. No randomness here: the output is deterministic.
"""
import math

INK, BLUE, YELLOW, PAPER, MUTED = "#26323f", "#0c66e4", "#ffd23f", "#fcfbf7", "#5e6c84"
P, TIP = (32, 15), (12, 51)
RADIUS = math.hypot(TIP[0] - P[0], TIP[1] - P[1])
LEG_ANGLE = math.degrees(math.atan2(TIP[0] - P[0], TIP[1] - P[1]))  # from the vertical, negative = left leg
OVERHANG = 14


def f(v):
    return ("%.2f" % v).rstrip("0").rstrip(".")


def _on_circle(deg_from_vertical, r=RADIUS):
    a = math.radians(deg_from_vertical)
    return (P[0] + r * math.sin(a), P[1] + r * math.cos(a))


ORANGE = "#ff8f4a"
LEGS = [(26.6, 24.72, 12, 51), (37.4, 24.72, 52, 51)]
ARC_D = "M60.12 45.09A41.18 41.18 0 0 1 3.88 45.09"
DOTS, DOT_R = [(5, 38), (6.45, 32.17), (8.93, 26.73), (12.54, 21.96), (17.14, 18.14), (22.44, 15.35), (28.15, 13.49)], 1.5
FLAME = [(39.99, 16.81), (37.72, 23.26), (43.67, 19.9)]
FINS = [[(43.19, 9.58), (37.39, 10.58), (34.49, 14.03), (39.33, 14.17)], [(50.24, 15.49), (50.26, 21.38), (47.36, 24.83), (46.38, 20.09)]]
ROCKET = [(55.71, 1.81), (55.46, 6.16), (53.79, 10.64), (51.52, 13.96), (46.38, 20.09), (39.33, 14.17), (44.48, 8.04), (47.35, 5.24), (51.47, 2.82)]


def mark_body(leg=INK, arc=BLUE, body=YELLOW, edge=INK, fin=None, flame=ORANGE):
    """SVG fragment of the mark on its 64 × 64 grid. Colours may be 'currentColor' or 'var(--acc, …)'; edge=None: no outline."""
    fin = fin or edge or leg
    pts = lambda p: "L".join("{} {}".format(f(x), f(y)) for x, y in p)  # noqa: E731
    out = ['<path d="M{}" fill="none" stroke="{}" stroke-width="6" stroke-linecap="round"/>'.format(pts([(x1, y1), (x2, y2)]), leg)
           for x1, y1, x2, y2 in LEGS]
    out.append('<path d="{}" fill="none" stroke="{}" stroke-width="6" stroke-linecap="round"/>'.format(ARC_D, arc))
    out += ['<circle cx="{}" cy="{}" r="{}" fill="{}"/>'.format(f(x), f(y), f(DOT_R), arc) for x, y in DOTS]
    line = ' stroke="{}" stroke-width="2" stroke-linejoin="round"'.format(edge) if edge else ""
    for shape, fill in [(FLAME, flame)] + [(fn, fin) for fn in FINS] + [(ROCKET, body)]:
        out.append('<path d="M{}Z" fill="{}"{}/>'.format(pts(shape), fill, line))
    return "".join(out)


# ---------------------------------------------------------------- single-stroke lettering: glyph → (advance, path)
BOWL = "M7 -3.5A3.5 3.5 0 1 0 0 -3.5A3.5 3.5 0 1 0 7 -3.5"
GLYPHS = {
    "D": (7.5, "M0 -10V0H2.5A5 5 0 0 0 2.5 -10H0"), "O": (8.6, "M4.3 -10A4.3 5 0 1 0 4.3 0A4.3 5 0 1 0 4.3 -10"), "W": (12, "M0 -10L3 0L6 -8.2L9 0L12 -10"), "A": (8.4, "M0 0L4.2 -10L8.4 0M1.5 -3.4H6.9"),
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
    """« DesignOrbit.ai » with « by DynamiteAgile™ » under it, starting at x; y = baseline of the name."""
    sub = scale * 0.46
    name_w = text_width("DesignOrbit") * scale
    out = lettering("DesignOrbit", x, y, scale, ink) + lettering(".ai", x + name_w + TRACK * scale, y, scale, accent)
    by_w = text_width("by DynamiteAgile") * sub
    sx = x + (text_width("DesignOrbit.ai") * scale - by_w - 9 * sub) / 2 if center else x
    sy = y + 3.8 * scale + 10 * sub
    return out + lettering("by DynamiteAgile", sx, sy, sub, muted, 1.5) + lettering("™", sx + by_w + 1.6 * sub, sy, sub, muted, 1.1)


def svg(w, h, body, extra=""):
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {} {}" role="img" aria-label="DesignOrbit.ai"{}>{}</svg>'
            .format(w, h, extra, body))


def mark_svg():
    return svg(64, 64, mark_body())


def mark_mono_svg():
    return svg(64, 64, mark_body("currentColor", "currentColor", "currentColor", None, "currentColor", "currentColor"))


def favicon_svg():
    """The mark, reversed on a graphite tile: stays legible on light and dark browser tabs down to 16 px."""
    tile = '<rect x="1" y="1" width="62" height="62" rx="14" fill="{}"/>'.format(INK)
    return svg(64, 64, tile + '<g transform="translate(7 7.5) scale(.78)">{}</g>'.format(mark_body(PAPER, PAPER, YELLOW, None, PAPER)))


def logo_symbol():
    """<symbol id="i-logo"> of the sprite: follows the theme (currentColor) and the module accent (--acc)."""
    return '<symbol id="i-logo" viewBox="0 0 64 64">{}</symbol>'.format(
        mark_body("currentColor", "currentColor", "var(--acc, {})".format(YELLOW), "currentColor", "currentColor", "var(--acc, {})".format(ORANGE)))


def wordmark_svg():
    scale = 2.6
    width = 64 + 16 + text_width("DesignOrbit.ai") * scale + 8
    return svg(f(width), 64, mark_body() + words(80, 33, scale))


def stacked_svg():
    scale = 2.3
    w = text_width("DesignOrbit.ai") * scale + 16
    body = '<g transform="translate({} 0) scale(1.25)">{}</g>'.format(f(w / 2 - 40), mark_body()) + words(8, 116, scale, center=True)
    return svg(f(w), 150, body)


def construction_svg():
    """The construction of the mark for docs/BRAND.md: module grid, orbit circle, trajectory, leg and overhang angles, clear space."""
    g = ['<rect x="-16" y="-16" width="96" height="96" fill="{}"/>'.format(PAPER)]
    for k in range(0, 65, 8):
        g.append('<path d="M{0} 0V64M0 {0}H64" stroke="{1}" stroke-opacity=".28" stroke-width=".35"/>'.format(k, BLUE))
    g.append('<rect x="0" y="0" width="64" height="64" fill="none" stroke="{}" stroke-width=".5"/>'.format(BLUE))
    g.append('<rect x="-8" y="-8" width="80" height="80" fill="none" stroke="{}" stroke-width=".4" stroke-dasharray="2 2"/>'.format(MUTED))
    g.append('<circle cx="{}" cy="{}" r="{}" fill="none" stroke="{}" stroke-width=".4" stroke-dasharray="1.5 1.5"/>'.format(P[0], P[1], f(RADIUS), INK))
    g.append('<path d="M5 38Q9 14 38 12L47 7" fill="none" stroke="{}" stroke-width=".4" stroke-dasharray="1.5 1.5"/>'.format(INK))
    for deg in (abs(LEG_ANGLE) + OVERHANG, -abs(LEG_ANGLE) - OVERHANG, 0):
        x, y = _on_circle(deg, RADIUS + 5)
        g.append('<path d="M{} {}L{} {}" stroke="{}" stroke-width=".4" stroke-dasharray="3 1 .6 1"/>'.format(P[0], P[1], f(x), f(y), INK))
    g.append('<g opacity=".82">{}</g>'.format(mark_body()))
    g.append('<circle cx="{}" cy="{}" r="1" fill="{}"/>'.format(P[0], P[1], INK))
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
