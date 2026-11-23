"""The QR code of the marketing material: web/img/qr/home.svg points to the welcome page of the platform (videos and
marketing), the address LINKS.home of tools/launch/content.mjs. Printed bottom right of the one-page sheet and on the last
picture of the film and of the teasers, like the poster of DynamiteAgile.

    python3 tools/make_qr.py <address>

Not part of the application: it needs `segno` (pip install segno), a QR encoder; the SVG it writes is committed, so the
pages and the tests need nothing. When the platform moves to its own domain, change LINKS.home, run this again with the new
address, then remake the sheet, the film and the teasers. A test holds that the address written in the SVG is LINKS.home.
Error correction M (15 %), a quiet zone of 4 modules, dark modules in the ink of the brand on white.
"""
import sys
from pathlib import Path

import segno

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "web" / "img" / "qr" / "home.svg"


def main():
    if len(sys.argv) != 2:
        raise SystemExit("usage: python3 tools/make_qr.py <address>")
    url = sys.argv[1]
    qr = segno.make(url, error="m", micro=False)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    qr.save(str(OUT), kind="svg", scale=1, border=4, dark="#26323f", light="#ffffff", xmldecl=False,
            svgns=True, title="QR", desc=url, nl=False)
    n = qr.symbol_size(scale=1, border=4)[0]  # a viewBox, so that the code scales to the box it is put in
    OUT.write_text(OUT.read_text().replace(f'width="{n}" height="{n}"', f'viewBox="0 0 {n} {n}" shape-rendering="crispEdges"', 1))
    print(f"{OUT.relative_to(ROOT)} : version {qr.version}, {qr.symbol_size(scale=1, border=4)[0]} modules, {url}")


if __name__ == "__main__":
    main()
