"""Illustrations of DynamiteOrbit (see tools/make_sketch_assets.py): home page journey and empty state. No text."""
from sketch_marks import ART, BASE, BRIM, HAT, HL, INK, cross, draw_art
from sketch_rough import Pen, scaled, sparkle, star_points

# the product-development journey, left to right: (drawing, scale, centre x, centre y, highlighter)
JOURNEY = (("interfaces", 5.4, 92, 206, "violet"), ("parts", 6.4, 268, 206, "blue"), ("assembly", 7.0, 446, 200, "orange"),
           ("drawings", 6.2, 626, 204, "pink"))


def arrow(pen, x1, x2, y, color):
    """Hand-drawn arrow from x1 to x2, slightly wavy."""
    third = (x2 - x1) / 3
    body = ("curve", [(x1, y + 4), (x1 + third, y - 4), (x1 + 2 * third, y + 3), (x2, y - 1)], False)
    tip = ("poly", [(x2 - 10, y - 10), (x2 + 1, y - 1), (x2 - 9, y + 9)], False)
    return [pen.stroke(body, color=color, width=3.2), pen.stroke(tip, color=color, width=3.2)]


def hero_svg():
    """Home page: interfaces → part → exploded assembly with its board → drawing sheet, under the wizard's trail."""
    pen = Pen("hero", jitter=1.4, passes=2)
    p = []
    for key, s, cx, cy, color in JOURNEY:  # marker strokes under each step, then the drawing itself
        for i in range(2):
            y = 292 + i * 9 + pen.j(1.5)
            p.append(pen.stroke(("line", cx - 46 + pen.j(4), y + 5, cx + 30 + pen.j(4), y - 3), color=HL[color], width=4.2))
        p += draw_art(pen, ART[key], s, cx - 12 * s, cy - 12 * s, width=2.7, alpha=0.5, off=(4, 3))
    for x1, x2 in ((168, 206), (338, 374), (518, 552)):
        p += arrow(pen, x1, x2, 206, HL["orange"])
    # the drawing is released: a green check seal on the corner of the sheet
    seal = ("curve", star_points(686, 262, 27, 23, 10), True)
    p.append(pen.fill(seal, HL["green"], 0.9, 2, 2))
    p.append(pen.stroke(seal, color=INK, width=2.6))
    p.append(pen.stroke(("poly", [(673, 262), (683, 272), (700, 250)], False), color=INK, width=3.6))
    # the wizard's hat, top left, and the dashed trail of its wand over the whole journey
    hat = lambda pts: [(x * 1.3 + 10, y * 1.3 + 32) for x, y in pts]  # noqa: E731
    p.append(pen.fill(("poly", hat(BRIM + BASE[1:2]), True), HL["yellow"], 0.75, 2, 2))
    p.append(pen.fill(("poly", hat(HAT + BASE[1:2]), True), HL["yellow"], 0.75, 2, 2))
    for shape in (("curve", hat(HAT[:4]), False), ("curve", hat(HAT[3:]), False), ("curve", hat(BRIM), False),
                  ("curve", hat(BASE), False)):
        p.append(pen.stroke(shape, color=INK, width=2.7))
    trail = [(70, 36), (130, 22), (215, 30), (320, 46), (430, 36), (540, 34), (630, 62), (676, 112)]
    p.append(pen.stroke(("curve", trail, False), color=INK, width=1.8, extra=' stroke-dasharray="3 8"'))
    for x, y, r, color in ((216, 30, 13, "yellow"), (432, 36, 16, "yellow"), (632, 62, 12, "cyan")):
        star = sparkle(x, y, r, 0.3)
        p.append(pen.fill(star, HL[color], 0.9, 1.5, 1))
        p.append(pen.stroke(star, color=INK, width=2.2))
    for x, y in ((150, 84), (352, 104), (544, 96), (26, 326), (704, 328), (356, 318)):
        p.append(cross(pen, x, y, 6, 2))
    # one group per pencil gesture: "draw" can be animated (stroke-dashoffset) when the SVG is inlined, "dash" must not be
    body = "".join('<g class="{}">{}</g>'.format("dash" if "stroke-dasharray" in x else "draw", x) for x in p)
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 360" role="img" aria-hidden="true">{}</svg>'.format(body)


def empty_svg(ink=INK, paper=0.25):
    """Empty state: an open notebook with a pencil and a sparkle waiting in a dashed frame (ink: light on dark themes)."""
    pen = Pen("empty", jitter=1.1, passes=2)
    p = []
    book = [("curve", [(20, 40), (70, 26), (120, 40)], False), ("line", 120, 40, 120, 130),
            ("curve", [(20, 126), (70, 114), (120, 130)], False), ("line", 20, 40, 20, 126),
            ("curve", [(120, 40), (170, 26), (220, 40)], False), ("line", 220, 40, 220, 126),
            ("curve", [(120, 130), (170, 114), (220, 126)], False)]
    p.append(pen.fill(("rect", 26, 40, 188, 84), HL["yellow"], paper, 3, 3))
    for shape in book:
        p.append(pen.stroke(shape, color=ink, width=2.4))
    for y in (62, 78, 94):
        p.append(pen.stroke(("line", 36, y, 102 + pen.j(8), y), color=ink, width=1.4))
    p.append(pen.stroke(("rect", 140, 60, 60, 44), color=ink, width=1.6, extra=' stroke-dasharray="4 5"'))
    star = scaled(sparkle(12, 12, 6.2, 0.3), 2.4, 141, 53)
    p.append(pen.fill(star, HL["orange"], 0.85, 1, 1))
    p.append(pen.stroke(star, color=ink, width=2))
    p.append(pen.stroke(("poly", [(196, 150), (236, 104), (244, 111), (204, 157), (192, 160)], True), color=ink, width=2.2))
    p.append(pen.fill(("poly", [(203, 144), (236, 106), (243, 112), (210, 150)], True), HL["pink"], 0.6, 1, 1))
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 170" role="img" aria-hidden="true">{}</svg>'.format("".join(p))
