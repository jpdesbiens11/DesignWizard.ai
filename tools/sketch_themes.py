"""Brick emblems and the per-theme home illustrations of DynamiteOrbit.ai (see tools/make_sketch_assets.py). No text.

Brick emblems: the pictogram of a brick of the product ladder (B0 … B9) over a row of ten cells, the first N+1 filled —
« brick by brick ». Stroke and fill are currentColor, so an inlined emblem (or <use href="img/icons.svg#i-bN">) follows the theme.
Themed heroes: the same scene — raw stock, the part being made in the vice of a bench, the finished part with its
interfaces called out — drawn for the drafting board (mecanique), the hangar (aero) and the orbit (spatial).
"""
import math

from sketch_icons import BRICKS, ICONS
from sketch_marks import ART, HL, draw_art
from sketch_rough import Pen, scaled

PI = math.pi

STOCK = [(("rect", 2.5, 16, 19, 4.6), "f:teal"), (("poly", [(6, 5.7), (18.4, 5.7), (20.3, 9), (18.4, 12.3), (6, 12.3), (4.1, 9)], True), "h:cyan"),
         (("ellipse", 6, 9, 1.9, 3.3), "s"), (("line", 6, 5.7, 18.4, 5.7), "s"), (("line", 6, 12.3, 18.4, 12.3), "s"),
         (("arc", 18.4, 9, 1.9, 3.3, -PI / 2, PI), "s")]
SPACE = dict(HL, yellow="#ffb84a", orange="#ff8f4a", cyan="#4fd8ea", green="#5fe09a", violet="#a996ff", blue="#6aa8ff", teal="#3fd4c0")
THEMES = {  # ink, accent, highlighters, pencil jitter, passes, stroke width, fill opacity
    "mecanique": ("#0f2f57", "#0057a8", HL, 0, 1, 2.0, 0.42),
    "aero": ("#2b3743", "#ff7a1a", HL, 0.5, 1, 2.3, 0.5),
    "spatial": ("#c9d7e8", "#4fd8ea", SPACE, 0, 1, 1.8, 0.34),
}


def brick_body(i):
    pen = Pen("brick-{}".format(i), jitter=0.6, passes=2)
    out = "".join(pen.stroke(scaled(shape, 2.1, 6.8, 0.6), width=3.3, factor=0.4 if shape[0] == "ellipse" and shape[3] < 1.3 else 1)
                  for shape in ICONS[BRICKS[i]])
    for k in range(10):  # the ladder: ten cells, bricks 0 … i laid
        x = 4.7 + k * 5.6
        out += ('<rect x="{}" y="55.6" width="4.2" height="5" rx="1" fill="{}" stroke="currentColor" stroke-width="1.1"{}/>'
                .format(pen.f(x), "currentColor" if k <= i else "none", "" if k <= i else ' stroke-opacity=".5"'))
    return out


def brick_svg(i):
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-hidden="true"><g id="b">{}</g></svg>'.format(brick_body(i))


def themed_hero_svg(theme):
    ink, accent, hl, jitter, passes, w, alpha = THEMES[theme]
    pen = Pen("hero-" + theme, jitter=jitter, passes=passes)
    p = []

    def line(shape, width=1.2, color=ink, extra=""):
        p.append(pen.stroke(shape, color=color, width=width, extra=extra))

    # ---- backdrop
    if theme == "mecanique":  # drawing sheet: frame, title block, centre line
        line(("rect", 10, 10, 700, 340), 1.4)
        line(("rect", 532, 304, 178, 46), 1)
        for shape in (("line", 532, 327, 710, 327), ("line", 620, 304, 620, 350), ("line", 556, 315, 600, 315), ("line", 636, 338, 690, 338)):
            line(shape, 0.9)
        line(("line", 352, 40, 352, 310), 0.8, accent, ' stroke-dasharray="14 4 2 4"')
    elif theme == "aero":  # hangar: roof arches with their truss, floor, safety stripe, rivet line
        outer = [(16, 170), (110, 86), (230, 38), (360, 22), (490, 38), (610, 86), (704, 170)]
        inner = [(40, 170), (126, 100), (238, 56), (360, 42), (482, 56), (594, 100), (680, 170)]
        line(("curve", outer, False), 1.6)
        line(("curve", inner, False), 1.1)
        for (x1, y1), (x2, y2) in zip(outer[1:-1], inner[1:-1]):
            line(("line", x1, y1, x2, y2), 1)
        line(("line", 16, 316, 704, 316), 1.6)
        line(("line", 16, 324, 704, 324), 4, accent, ' stroke-dasharray="18 14"')
        for x in range(28, 704, 24):
            p.append('<circle cx="{}" cy="340" r="1.7" fill="{}" fill-opacity=".55"/>'.format(x, ink))
    else:  # orbit: two orbits, the limb of a planet, a few stars
        line(("arc", 360, 150, 338, 120, 1.02 * PI, 0.96 * PI), 1, hl["cyan"], ' stroke-dasharray="2 7"')
        line(("arc", 380, 176, 300, 150, 1.1 * PI, 0.8 * PI), 0.8, hl["violet"], ' stroke-dasharray="1 9"')
        limb = [(0, 350), (180, 326), (360, 318), (540, 326), (720, 350)]
        line(("curve", limb, False), 1.6, hl["yellow"])
        line(("curve", [(x, y + 6) for x, y in limb], False), 5, hl["yellow"], ' stroke-opacity=".18"')
        for x, y, r in ((40, 40, 1.6), (150, 22, 1.1), (236, 70, 1.4), (322, 30, 1), (470, 52, 1.5), (560, 24, 1.1), (668, 60, 1.6),
                        (700, 150, 1), (24, 150, 1.2), (446, 100, 0.9), (204, 120, 0.9), (610, 110, 1.2)):
            p.append('<circle cx="{}" cy="{}" r="{}" fill="{}"/>'.format(x, y, r, ink))
    # ---- raw stock → the part being made on the bench → the finished part
    for art, s, cx, cy in ((STOCK, 6.2, 96, 222), (ART["atelier"], 8.6, 352, 206), (ART["parts"], 6.6, 590, 190)):
        p += draw_art(pen, art, s, cx - 12 * s, cy - 12 * s, width=w, alpha=alpha, off=(2, 2) if jitter else (0, 0), INK=ink, HL=hl)
    for x1, x2 in ((184, 232), (474, 512)):
        line(("line", x1, 222, x2, 222), 2.6, hl["orange"])
        line(("poly", [(x2 - 10, 212), (x2 + 1, 222), (x2 - 10, 232)], False), 2.6, hl["orange"])
    # ---- interfaces called out: a leader and a balloon per interface (A = violet, B = teal), counted with ticks
    for n, (fx, fy, bx, by, color) in enumerate(((570, 168, 520, 104, "violet"), (600, 210, 676, 132, "teal"), (626, 232, 684, 268, "violet"))):
        line(("line", fx, fy, bx, by), 1.1)
        p.append('<circle cx="{}" cy="{}" r="2.6" fill="{}"/>'.format(fx, fy, ink))
        p.append(pen.fill(("ellipse", bx, by, 13, 13), hl[color], 0.85 if theme != "spatial" else 0.5, 0, 0))
        line(("ellipse", bx, by, 13, 13), 1.6)
        for k in range(n + 1):
            x = bx + (k - n / 2) * 5
            line(("line", x, by - 5, x, by + 5), 1.8)
    if theme == "mecanique":  # dimension line under the bench
        for x in (265, 439):
            line(("line", x, 300, x, 334), 0.9)
        line(("line", 265, 328, 439, 328), 0.9)
        line(("poly", [(274, 324), (265, 328), (274, 332)], False), 0.9)
        line(("poly", [(430, 324), (439, 328), (430, 332)], False), 0.9)
    body = "".join('<g class="{}">{}</g>'.format("dash" if "stroke-dasharray" in x else "draw", x) for x in p)
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 360" role="img" aria-hidden="true">{}</svg>'.format(body)
