"""« Carnet d'ingénieur » visual assets of DesignWizard.ai: icons, module marks, brand mark, illustrations.

    python3 tools/make_sketch_assets.py

Writes (all local, no text inside the images, no external resource):
- web/img/icons.svg            sprite of functional icons (<symbol id="i-…" viewBox="0 0 24 24">, stroke = currentColor),
                               used as <svg class="sk-icon"><use href="img/icons.svg#i-NAME"/></svg>;
- web/img/marks/<key>.svg      coloured module marks (viewBox 0 0 160 124): a highlighter blob behind a pencil drawing;
- web/img/brand.svg            brand mark (64 × 64) and web/img/favicon.svg, its simplified version;
- web/img/sketch/<name>.svg    illustrations: hero.svg (home page), empty.svg (empty states).
Never edit these files by hand: add or change a shape in tools/sketch_icons.py (ICONS), tools/sketch_marks.py (ART, MARKS)
or tools/sketch_illus.py, then run this script again. The pencil (tools/sketch_rough.Pen) is seeded by the name of each
drawing, so two runs give byte-identical files.
"""
import sys
from pathlib import Path

sys.dont_write_bytecode = True  # a generator, not a package: leave no __pycache__ in tools/
sys.path.insert(0, str(Path(__file__).resolve().parent))
from sketch_icons import ICONS  # noqa: E402
from sketch_illus import empty_svg, hero_svg  # noqa: E402
from sketch_marks import ART, MARKS, brand_svg, mark_svg  # noqa: E402
from sketch_rough import Pen  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent / "web" / "img"


def icon_symbol(name, shapes):
    pen = Pen("icon-" + name, jitter=0.28, passes=2)
    body = ""
    for shape in shapes:
        dot = shape[0] == "ellipse" and shape[3] < 1.3  # tiny circles stay round
        body += pen.stroke(shape, width=1.75, factor=0.4 if dot else 1.0)
    return '<symbol id="i-{}" viewBox="0 0 24 24">{}</symbol>'.format(name, body)


def sprite_svg():
    lines = ['<svg xmlns="http://www.w3.org/2000/svg" style="display:none">']
    lines += [icon_symbol(name, shapes) for name, shapes in ICONS.items()]
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
    for key, accent in MARKS.items():
        write(ROOT / "marks" / (key + ".svg"), mark_svg(key, accent))
    write(ROOT / "brand.svg", brand_svg())
    write(ROOT / "favicon.svg", brand_svg(simple=True))
    write(ROOT / "sketch" / "hero.svg", hero_svg())
    write(ROOT / "sketch" / "empty.svg", empty_svg())
    print("{} icons, {} marks, brand + favicon, 2 illustrations -> {}".format(len(ICONS), len(MARKS), ROOT))


if __name__ == "__main__":
    main()
