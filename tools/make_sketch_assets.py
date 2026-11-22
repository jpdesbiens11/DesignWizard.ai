"""« Carnet d'ingénieur » visual assets of DynamiteOrbit: icons, module marks, brand mark, illustrations.

    python3 tools/make_sketch_assets.py

Writes (all local, no text inside the images, no external resource):
- web/img/icons.svg            sprite of functional icons (<symbol id="i-…" viewBox="0 0 24 24">, stroke = currentColor),
                               used as <svg class="sk-icon"><use href="img/icons.svg#i-NAME"/></svg>; plus i-logo (the mark,
                               currentColor + var(--acc)) and i-b0 … i-b9 (brick emblems); icons-crisp.svg = same ids, no wobble;
- web/img/marks/<key>.svg      coloured module marks (viewBox 0 0 160 124): a highlighter blob behind a pencil drawing;
- web/img/logo/*.svg           the logo: mark, mark-mono (currentColor), wordmark, stacked, construction; web/img/brand.svg
                               (= mark), web/img/favicon.svg (reversed on a tile), web/img/og.svg (1200 × 630 social card);
- web/img/bricks/b0 … b9.svg   emblems of the ten bricks of the product (64 × 64, currentColor);
- web/img/sketch/<name>.svg    illustrations: hero.svg = hero-carnet.svg (journey), hero-mecanique / -aero / -spatial.svg,
                               empty.svg and empty-spatial.svg (empty states).
Never edit these files by hand: add or change a shape in tools/sketch_icons.py (ICONS), tools/sketch_marks.py (ART, MARKS),
tools/sketch_logo.py, tools/sketch_themes.py or tools/sketch_illus.py, then run this script again. The pencil (tools/sketch_rough.Pen) is seeded by the name of each
drawing, so two runs give byte-identical files.
"""
import sys
from pathlib import Path

sys.dont_write_bytecode = True  # a generator, not a package: leave no __pycache__ in tools/
sys.path.insert(0, str(Path(__file__).resolve().parent))
import sketch_logo as logo  # noqa: E402
from sketch_icons import BRICKS, ICONS  # noqa: E402
from sketch_illus import empty_svg, hero_svg  # noqa: E402
from sketch_marks import ART, MARKS, mark_svg  # noqa: E402
from sketch_rough import Pen  # noqa: E402
from sketch_themes import THEMES, brick_body, brick_svg, themed_hero_svg  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent / "web" / "img"


def icon_symbol(name, shapes, crisp=False):
    pen = Pen("icon-" + name, jitter=0 if crisp else 0.28, passes=1 if crisp else 2)
    body = ""
    for shape in shapes:
        dot = shape[0] == "ellipse" and shape[3] < 1.3  # tiny circles stay round
        body += pen.stroke(shape, width=1.75, factor=0.4 if dot else 1.0)
    return '<symbol id="i-{}" viewBox="0 0 24 24">{}</symbol>'.format(name, body)


def sprite_svg(crisp=False):
    """crisp=True: the same ids drawn once, without jitter, for the « constructed » themes (mecanique, aero, spatial)."""
    lines = ['<svg xmlns="http://www.w3.org/2000/svg" style="display:none">']
    lines += [icon_symbol(name, shapes, crisp) for name, shapes in ICONS.items()]
    lines.append(logo.logo_symbol())
    lines += ['<symbol id="i-b{}" viewBox="0 0 64 64">{}</symbol>'.format(i, brick_body(i)) for i in range(len(BRICKS))]
    return "\n".join(lines + ["</svg>"])


def write(path, svg):
    if "<text" in svg or svg.count("http") != 1:
        raise SystemExit("{}: text or external resource in an image".format(path))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes((svg + "\n").encode("utf-8"))  # bytes: same file on every platform


def main():
    missing = sorted(set(MARKS) - set(ART))
    if missing:
        raise SystemExit("marks without a drawing: " + ", ".join(missing))
    write(ROOT / "icons.svg", sprite_svg())
    write(ROOT / "icons-crisp.svg", sprite_svg(crisp=True))
    for key, accent in MARKS.items():
        write(ROOT / "marks" / (key + ".svg"), mark_svg(key, accent))
    for name, svg in (("mark", logo.mark_svg()), ("mark-mono", logo.mark_mono_svg()), ("wordmark", logo.wordmark_svg()),
                      ("stacked", logo.stacked_svg()), ("construction", logo.construction_svg())):
        write(ROOT / "logo" / (name + ".svg"), svg)
    write(ROOT / "brand.svg", logo.mark_svg())
    write(ROOT / "favicon.svg", logo.favicon_svg())
    write(ROOT / "og.svg", logo.og_svg([brick_body(i) for i in range(len(BRICKS))]))
    for i in range(len(BRICKS)):
        write(ROOT / "bricks" / "b{}.svg".format(i), brick_svg(i))
    for name in ("hero", "hero-carnet"):
        write(ROOT / "sketch" / (name + ".svg"), hero_svg())
    for theme in THEMES:
        write(ROOT / "sketch" / "hero-{}.svg".format(theme), themed_hero_svg(theme))
    write(ROOT / "sketch" / "empty.svg", empty_svg())
    write(ROOT / "sketch" / "empty-spatial.svg", empty_svg(ink=THEMES["spatial"][0], paper=0.12))
    print("{} icons (+ logo, {} bricks), {} marks, logo set, {} heroes -> {}".format(len(ICONS), len(BRICKS), len(MARKS), len(THEMES) + 1, ROOT))


if __name__ == "__main__":
    main()
