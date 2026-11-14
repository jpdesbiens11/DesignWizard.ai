"""Module marks and brand mark of DesignWizard.ai (see tools/make_sketch_assets.py).

ART maps a key to a drawing on the same 24-unit grid as the icons: a list of (shape, role). Roles:
  "s" graphite stroke · "t" thin graphite stroke · "d" thin dashed graphite stroke
  "f:<color>" highlighter fill + stroke · "ft:<color>" fill + thin stroke · "h:<color>" fill only
  "m:<color>" marker stroke in a highlighter colour.
The same drawings are reused, larger, by the home illustration (tools/sketch_illus.py).
"""
import math

from sketch_rough import Pen, arc_points, iso, rhombus, scaled, sparkle, star_points

INK = "#26323f"
HL = {"yellow": "#ffd23f", "orange": "#ff8a3d", "cyan": "#3ec6e0", "green": "#5fd08a", "pink": "#ff6f91",
      "violet": "#9b7bff", "blue": "#4d8dff", "teal": "#2ec4b6", "red": "#ff5a4f"}
PI = math.pi


def _bracket():
    """Machined L-bracket in isometric view: base plate with a hole, upright wall with a hole."""
    p = lambda x, y, z: iso(x, y, z, 10.6, 11.4, 1.32)  # noqa: E731
    a, b, c, d, e, f = p(0, 6, 0), p(9, 6, 0), p(9, 6, 1.6), p(1.6, 6, 1.6), p(1.6, 6, 6.6), p(0, 6, 6.6)
    b2, c2, d2, e2, f2 = p(9, 0, 0), p(9, 0, 1.6), p(1.6, 0, 1.6), p(1.6, 0, 6.6), p(0, 0, 6.6)
    ring = [k * PI / 5 for k in range(10)]
    hole_base = [p(5.6 + 1.4 * math.cos(t), 3 + 1.4 * math.sin(t), 1.6) for t in ring]
    hole_wall = [p(1.6, 3 + 1.25 * math.cos(t), 4.3 + 1.25 * math.sin(t)) for t in ring]
    return [(("poly", [d, c, c2, d2], True), "h:blue"), (("poly", [d, e, e2, d2], True), "h:cyan"),
            (("poly", [a, b, c, d, e, f], True), "s"), (("poly", [b, b2, c2, c], False), "s"),
            (("poly", [c2, d2, e2, f2, f], False), "s"), (("line", *d, *d2), "s"), (("line", *e, *e2), "s"),
            (("curve", hole_base, True), "t"), (("curve", hole_wall, True), "t")]


def _heatsink():
    """Heatsink profile (comb) extruded towards the back, with the extrusion arrow."""
    fins, top, floor, bottom, dx, dy = ((2, 4), (7, 9), (12, 14)), 8.5, 17.5, 20, 7, -4.5
    front = []
    for x1, x2 in fins:
        front += [(x1, floor), (x1, top), (x2, top), (x2, floor)]
    front = [(2, bottom)] + front[1:-1] + [(14, bottom)]
    art = [(("poly", front, True), "f:teal")]
    for i, (x1, x2) in enumerate(fins):
        art.append((("poly", [(x1, top), (x1 + dx, top + dy), (x2 + dx, top + dy), (x2, top)], False), "s"))
        if i < len(fins) - 1:  # the next fin hides the rest of this side
            gap = fins[i + 1][0] - x2
            art.append((("line", x2 + dx, top + dy, x2 + dx, top + dy * (1 - gap / dx) - 0.1), "s"))
            art.append((("line", x2, floor, x2 + gap, floor + dy * gap / dx), "t"))
    art.append((("poly", [(14 + dx, top + dy), (14 + dx, bottom + dy), (14, bottom)], False), "s"))
    art.append((("line", 15.6, 22.6, 22.2, 18.4), "m:orange"))
    art.append((("poly", [(19.2, 18.2), (22.4, 18.2), (21.6, 21.3)], False), "m:orange"))
    return art


def _stack():
    """Exploded view: cover, board and housing on the same axes."""
    cover, board, tray = rhombus(12, 4.9, 9, 2.7), rhombus(12, 11.3, 7.6, 2.3), rhombus(12, 17, 9, 2.7)
    return [(("poly", cover, True), "f:orange"), (("poly", [(3, 4.9), (3, 6), (12, 8.7), (21, 6), (21, 4.9)], False), "s"),
            (("line", 12, 7.6, 12, 8.7), "s"), (("poly", board, True), "f:green"),
            (("poly", [(4.4, 11.3), (4.4, 12), (12, 14.3), (19.6, 12), (19.6, 11.3)], False), "t"),
            (("poly", rhombus(10.2, 11, 2.3, 0.75), True), "ft:yellow"), (("poly", rhombus(14.6, 11.8, 1.3, 0.45), True), "t"),
            (("poly", [(3, 17), (12, 19.7), (12, 22.1), (3, 19.4)], True), "h:blue"),
            (("poly", tray, True), "s"), (("poly", rhombus(12, 17.2, 7.2, 2), True), "t"),
            (("poly", [(3, 17), (3, 19.4), (12, 22.1), (21, 19.4), (21, 17)], False), "s"), (("line", 12, 19.7, 12, 22.1), "s"),
            (("line", 3, 6.9, 3, 16.2), "d"), (("line", 21, 6.9, 21, 16.2), "d")]


CREEP = [(7.2, 15.2), (8.9, 15.2), (8.9, 7.5), (15.1, 7.5), (15.1, 15.2), (16.8, 15.2)]  # along the surface, over the rib
BOOK = [(("curve", [(2, 7.6), (7, 5.9), (12, 7.6)], False), "s"), (("line", 12, 7.6, 12, 20.4), "s"),
        (("curve", [(2, 19.4), (7, 17.8), (12, 20.4)], False), "s"), (("line", 2, 7.6, 2, 19.4), "s"),
        (("curve", [(12, 7.6), (17, 5.9), (22, 7.6)], False), "s"), (("line", 22, 7.6, 22, 19.4), "s"),
        (("curve", [(12, 20.4), (17, 17.8), (22, 19.4)], False), "s")]

ART = {
    # a notebook with a wand
    "home": [(("rect", 2.6, 7.4, 18.8, 11.6), "h:yellow")] + BOOK + [
        (("line", 4.3, 10.6, 9.6, 10.6), "t"), (("line", 4.3, 13.4, 9, 13.4), "t"), (("line", 4.3, 16.2, 7.6, 16.2), "t"),
        (("poly", [(13.6, 17.6), (18.6, 9.2), (20.2, 10.1), (15.2, 18.5)], True), "ft:blue"),
        (sparkle(20.4, 6.4, 3.2), "f:orange")],
    # two parts whose matching faces and holes line up
    "interfaces": [
        (("poly", [(1.5, 5.5), (9, 5.5)] + arc_points(9, 14, 2.7, 2.6, -PI / 2, PI) + [(9, 20), (1.5, 20)], True), "h:violet"),
        (("poly", [(9, 11.4), (9, 5.5), (1.5, 5.5), (1.5, 20), (9, 20), (9, 16.6)], False), "s"),
        (("arc", 9, 14, 2.7, 2.6, -PI / 2, PI), "s"),
        (("poly", [(14.2, 5.5), (22.5, 5.5), (22.5, 20), (14.2, 20)] + arc_points(14.2, 14, 2.9, 2.8, PI / 2, -PI), True),
         "h:cyan"),
        (("poly", [(14.2, 11.2), (14.2, 5.5), (22.5, 5.5), (22.5, 20), (14.2, 20), (14.2, 16.8)], False), "s"),
        (("arc", 14.2, 14, 2.9, 2.8, -PI / 2, PI), "s"),
        (("ellipse", 5.2, 8.6, 1.3, 1.3), "t"), (("ellipse", 18.6, 8.6, 1.3, 1.3), "t"), (("line", 0.2, 8.6, 23.8, 8.6), "d")],
    "parts": _bracket(),
    "extrusion": _heatsink(),
    # a board with chips and traces
    "pcb": [(("rect", 1.5, 4.5, 21, 15), "f:green"), (("rect", 5, 8.2, 6.5, 5.4), "f:yellow"),
            (("rect", 15.6, 13, 4.4, 3.8), "f:blue"), (("ellipse", 3.5, 6.5, 0.7, 0.7), "t"), (("ellipse", 20.5, 17.5, 0.7, 0.7), "t"),
            (("line", 6.4, 8.2, 6.4, 6.6), "t"), (("line", 8.25, 8.2, 8.25, 6.6), "t"), (("line", 10.1, 8.2, 10.1, 6.6), "t"),
            (("line", 6.4, 13.6, 6.4, 15.2), "t"), (("line", 8.25, 13.6, 8.25, 15.2), "t"), (("line", 10.1, 13.6, 10.1, 15.2), "t"),
            (("poly", [(11.5, 9.6), (14, 9.6), (16, 7.6), (18.6, 7.6)], False), "t"), (("ellipse", 19.6, 7.6, 0.9, 0.9), "t"),
            (("poly", [(11.5, 12), (13.4, 12), (15.6, 14.2)], False), "t"),
            (("poly", [(6.4, 15.2), (6.4, 17.2), (13, 17.2), (14, 16), (15.6, 16)], False), "t"),
            (("line", 3.6, 11, 5, 11), "t"), (("ellipse", 2.9, 11, 0.7, 0.7), "t")],
    "assembly": _stack(),
    # two busbars on an insulator with a rib; the creepage path follows the surface
    "creepage": [
        (("poly", [(1.5, 16.5), (10.7, 16.5), (10.7, 9), (13.3, 9), (13.3, 16.5), (22.5, 16.5), (22.5, 20), (1.5, 20)], True),
         "f:cyan"),
        (("rect", 2.5, 11.3, 4.5, 5.2), "f:yellow"), (("rect", 17, 11.3, 4.5, 5.2), "f:yellow"),
        (("poly", CREEP, False), "m:red"), (("poly", CREEP, False), "d")],
    # a caliper measuring a part, next to a checklist
    "dfx": [(("rect", 15.6, 4.4, 8.8, 15.4), "f:yellow"), (("rect", 17.9, 3.2, 4.2, 2.2), "s"),
            (("poly", [(16.9, 9.3), (17.9, 10.3), (19.5, 8.3)], False), "t"), (("line", 20.5, 9.5, 22.9, 9.5), "t"),
            (("poly", [(16.9, 12.9), (17.9, 13.9), (19.5, 11.9)], False), "t"), (("line", 20.5, 13.1, 22.9, 13.1), "t"),
            (("poly", [(16.9, 16.5), (17.9, 17.5), (19.5, 15.5)], False), "t"), (("line", 20.5, 16.7, 22.9, 16.7), "t"),
            (("ellipse", 4.2, 14.2, 2.8, 2.8), "f:blue"), (("rect", -1, 7.3, 14.6, 2.3), "s"),
            (("poly", [(-1, 9.6), (-1, 14.7), (1.3, 17.9), (1.3, 9.6)], False), "s"),
            (("poly", [(-0.4, 7.3), (-0.4, 5.1), (1.3, 3.7), (1.3, 7.3)], False), "s"),
            (("rect", 6.9, 6.3, 4.6, 4.2), "ft:orange"), (("poly", [(8.9, 6.3), (8.9, 5.1), (7.1, 3.7), (7.1, 6.3)], False), "s"),
            (("poly", [(9.4, 10.5), (9.4, 14.7), (7.1, 17.9), (7.1, 10.5)], False), "s"),
            (("line", 2.7, 7.3, 2.7, 8.6), "t"), (("line", 4.1, 7.3, 4.1, 8.6), "t"), (("line", 5.5, 7.3, 5.5, 8.6), "t")],
    # a drawing sheet with three views and a title block
    "drawings": [(("rect", 1, 3, 22, 18), "s"), (("rect", 3.6, 5.2, 7.6, 2.8), "f:pink"), (("rect", 3.6, 10.2, 7.6, 5.2), "f:pink"),
                 (("ellipse", 7.4, 12.8, 1.3, 1.3), "t"), (("rect", 14, 10.2, 3.8, 5.2), "f:yellow"),
                 (("line", 3.6, 17.6, 11.2, 17.6), "t"), (("line", 3.6, 16.6, 3.6, 18.6), "t"),
                 (("line", 11.2, 16.6, 11.2, 18.6), "t"), (("poly", [(14.4, 21), (14.4, 17.4), (23, 17.4)], False), "t"),
                 (("line", 14.4, 19.2, 23, 19.2), "t"), (("line", 18.8, 17.4, 18.8, 21), "t")],
    # a report page with a check seal
    "report": [(("rect", 4.5, 2.5, 13.5, 19), "h:yellow"),
               (("poly", [(18, 12.2), (18, 2.5), (4.5, 2.5), (4.5, 21.5), (17.6, 21.5)], False), "s"),
               (("line", 7, 6, 12.6, 6), "s"), (("line", 7, 9, 15.4, 9), "t"), (("line", 7, 11.4, 13.6, 11.4), "t"),
               (("rect", 6.6, 16, 1.7, 3), "ft:blue"), (("rect", 9.2, 14, 1.7, 5), "ft:blue"),
               (("rect", 11.8, 15, 1.7, 4), "ft:blue"),
               (("curve", star_points(18.4, 16.8, 4.5, 3.8, 9), True), "f:green"),
               (("poly", [(16.4, 16.9), (17.9, 18.4), (20.5, 15.1)], False), "s")],
    # a cloud receiving a cube
    "onshape": [(("curve", [(5.5, 13), (2.6, 12.2), (1.4, 9.6), (3, 7), (5.6, 6.3), (7, 3.6), (10.5, 2.2), (14, 3.2), (15.6, 5.6),
                            (18.8, 5.4), (21.8, 7.6), (22.4, 10.6), (20.6, 12.6), (18.5, 13)], False), "f:cyan"),
                (("line", 5.5, 13, 9.4, 13), "s"), (("line", 14.6, 13, 18.5, 13), "s"),
                (("line", 12, 15.2, 12, 7.8), "s"), (("poly", [(9.3, 10.4), (12, 7.5), (14.7, 10.4)], False), "s"),
                (("poly", rhombus(12, 18, 3.7, 1.6), True), "f:yellow"), (("line", 12, 19.6, 12, 22.4), "s"),
                (("poly", [(8.3, 18), (8.3, 20.8), (12, 22.4), (15.7, 20.8), (15.7, 18)], False), "s")],
    # a question mark
    "help": [(("ellipse", 12, 12, 9, 9), "f:yellow"),
             (("curve", [(9.2, 9.6), (10, 7.4), (12.2, 7.1), (14.6, 8.4), (14.3, 10.7), (12.1, 12.3), (12, 14.2)], False), "s"),
             (("ellipse", 12, 17, 0.6, 0.6), "s")],
}

# module mark → highlighter colour of its blob
MARKS = {"home": "yellow", "interfaces": "violet", "parts": "blue", "extrusion": "teal", "pcb": "green", "assembly": "orange",
         "creepage": "red", "dfx": "cyan", "drawings": "pink", "report": "yellow", "onshape": "blue", "help": "yellow"}


def draw_art(pen, art, s, dx, dy, width=3.1, alpha=0.62, off=(3, 2.5)):
    """SVG fragments of one ART drawing scaled by s and moved by (dx, dy)."""
    out = []
    thin = max(width * 0.62, 1.3)
    dash = ' stroke-dasharray="{} {}"'.format(pen.f(width * 1.5), pen.f(width * 1.7))
    for shape, role in art:
        big = scaled(shape, s, dx, dy)
        kind, _, color = role.partition(":")
        if kind in ("f", "ft", "h"):
            out.append(pen.fill(big, HL[color], alpha, *off))
        if kind in ("s", "f"):
            out.append(pen.stroke(big, color=INK, width=width))
        elif kind in ("t", "ft"):
            out.append(pen.stroke(big, color=INK, width=thin))
        elif kind == "d":
            out.append(pen.stroke(big, color=INK, width=thin, extra=dash))
        elif kind == "m":
            out.append(pen.stroke(big, color=HL[color], width=width * 1.25))
    return out


def cross(pen, x, y, r=4, width=1.6):
    """Small « + » doodle."""
    return (pen.stroke(("line", x - r, y, x + r, y), color=INK, width=width)
            + pen.stroke(("line", x, y - r, x, y + r), color=INK, width=width))


def mark_svg(key, accent):
    pen = Pen("mark-" + key, jitter=1.1, passes=2)
    parts = []
    # highlighter blob behind the drawing
    parts.append(pen.fill(("poly", pen.ellipse_pts(80, 62, 58, 44, 12), True), HL[accent], 0.42, 0, 0))
    for i in range(3):  # quick marker hatching
        y = 26 + i * 7 + pen.j(1)
        parts.append(pen.stroke(("line", 26 + pen.j(3), y + 60, 52 + pen.j(3), y + 52), color=HL[accent], width=3.2))
    s = 4.1
    parts += draw_art(pen, ART[key], s, 80 - 12 * s, 60 - 12 * s)
    # doodles: a sparkle and two crosses, the wizard's notebook signature
    star = sparkle(144, 19, 10, 0.36)
    parts.append(pen.fill(star, HL["yellow"], 0.9, 1.5, 1))
    parts.append(pen.stroke(star, color=INK, width=2))
    for x, y in ((24, 20), (30, 102)):
        parts.append(cross(pen, x, y))
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 124" role="img" aria-hidden="true">{}</svg>'
            .format("".join(parts)))


# ---------------------------------------------------------------- brand mark (64 × 64, no text)
HAT = [(21, 29), (24.5, 19), (29.5, 10.5), (39.5, 5), (36.5, 11.5), (38.5, 20), (43, 29)]
BASE = [(21, 29), (32, 32.5), (43, 29)]
BRIM = [(21, 29), (11.5, 29.5), (10, 33.5), (19, 37), (32, 38.5), (45, 37), (54, 33.5), (52.5, 29.5), (43, 29)]
CUBE = [(13, 37.5), (13, 52.5), (32, 60), (51, 52.5), (51, 37.5)]


def brand_svg(simple=False):
    """A wizard hat whose tip draws a sparkle, worn by a cube. simple=True: the favicon (bolder, on a yellow tile)."""
    pen = Pen("favicon" if simple else "brand", jitter=0.5 if simple else 0.8, passes=1 if simple else 2)
    w = 3.6 if simple else 2.9
    p = []
    if simple:
        p.append(pen.fill(("rect", 2.5, 2.5, 59, 59), HL["yellow"], 0.95, 0, 0))
    else:
        p.append(pen.fill(("poly", BRIM + BASE[1:2], True), HL["yellow"], 0.8, 1, 1.5))
        p.append(pen.fill(("poly", HAT + BASE[1:2], True), HL["yellow"], 0.8, 1.5, 1))
    p.append(pen.fill(("poly", [CUBE[0], (32, 45), CUBE[2], CUBE[1]], True), HL["blue"], 0.75, 1, 1))
    for shape in (("curve", HAT[:4], False), ("curve", HAT[3:], False), ("curve", BASE, False), ("curve", BRIM, False),
                  ("poly", CUBE, False), ("line", 32, 45, 32, 60), ("poly", [(14.5, 38.2), (32, 45), (49.5, 38.2)], False)):
        p.append(pen.stroke(shape, color=INK, width=w))
    star = sparkle(52, 10.5, 8.5, 0.36)
    if not simple:
        p.append(pen.fill(star, HL["yellow"], 0.9, 1, 1))
        p.append(cross(pen, 9, 15, 3, 1.8) + cross(pen, 58, 24, 2.4, 1.6))
    p.append(pen.stroke(star, color=INK, width=w * 0.7))
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-hidden="true">{}</svg>'.format("".join(p))
