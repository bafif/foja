"""The fonts the Word export embeds (packages/template/word-fonts/): Word embeds only TrueType, so XCharter, which comes
in OpenType CFF (packages/template/fonts), is turned into TrueType outlines with fontTools; its licence lets it be
modified and redistributed. Noto Sans is TrueType already. In both, the three sets of vertical metrics are made one
(the Windows ascent and descent, no line gap): Word takes a line's height from one set and LibreOffice from another,
and the export's line spacing is a share of that height (docx.ts, `SINGLE`).

    python3 scripts/word-fonts.py        (fontTools 4.x)
"""

import sys
from pathlib import Path

from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont, newTable

ROOT = Path(__file__).resolve().parent.parent
FONTS = ROOT / "packages/template/fonts"
OUT = ROOT / "packages/template/word-fonts"
FACES = {"Roman": "Regular", "Bold": "Bold", "Italic": "Italic", "BoldItalic": "BoldItalic"}


def to_truetype(font: TTFont) -> None:
    """CFF outlines to quadratic ones, within a thousandth of an em; the metrics stay as they are."""
    order = font.getGlyphOrder()
    glyphs = font.getGlyphSet()
    glyf = newTable("glyf")
    glyf.glyphOrder = order
    glyf.glyphs = {}
    for name in order:
        pen = TTGlyphPen(glyphs)
        glyphs[name].draw(Cu2QuPen(pen, max_err=font["head"].unitsPerEm / 1000, reverse_direction=True))
        glyf.glyphs[name] = pen.glyph()
    font["loca"] = newTable("loca")
    font["glyf"] = glyf
    del font["CFF "]
    glyf.compile(font)
    for name in order:  # the left side bearing is the outline's own
        width, _ = font["hmtx"][name]
        g = glyf[name]
        font["hmtx"][name] = (width, g.xMin if g.numberOfContours else 0)
    maxp = font["maxp"] = newTable("maxp")
    maxp.tableVersion = 0x00010000
    for field in ("maxZones", "maxTwilightPoints", "maxStorage", "maxFunctionDefs", "maxInstructionDefs",
                  "maxStackElements", "maxSizeOfInstructions", "maxComponentElements"):
        setattr(maxp, field, 0)
    maxp.maxZones = 1
    maxp.recalc(font)
    post = font["post"]
    post.formatType = 2.0
    post.extraNames = []
    post.mapping = {}
    post.glyphOrder = order
    font.sfntVersion = "\x00\x01\x00\x00"


def one_line_height(font: TTFont) -> None:
    os2, hhea = font["OS/2"], font["hhea"]
    ascent, descent = os2.usWinAscent, os2.usWinDescent
    hhea.ascent, hhea.descent, hhea.lineGap = ascent, -descent, 0
    os2.sTypoAscender, os2.sTypoDescender, os2.sTypoLineGap = ascent, -descent, 0


def main() -> None:
    OUT.mkdir(exist_ok=True)
    for face, word in FACES.items():
        font = TTFont(FONTS / f"XCharter-{face}.otf")
        to_truetype(font)
        # Installable embedding: Word refuses a font whose embedding is restricted.
        font["OS/2"].fsType = 0
        one_line_height(font)
        font.save(OUT / f"XCharter-{word}.ttf")
        noto = TTFont(FONTS / f"NotoSans-{word}.ttf")
        one_line_height(noto)
        noto.save(OUT / f"NotoSans-{word}.ttf")
    note = "For Foja's Word export: {}one set of vertical metrics (scripts/word-fonts.py).\n\n"
    for licence, change in (("XCharter-LICENSE.txt", "turned into TrueType outlines, with "), ("NotoSans-LICENSE.txt", "")):
        (OUT / licence).write_text(note.format(change or "") + (FONTS / licence).read_text())
    print(f"{OUT.relative_to(ROOT)}: {', '.join(sorted(p.name for p in OUT.glob('*.ttf')))}", file=sys.stderr)


if __name__ == "__main__":
    main()
