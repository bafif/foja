"""Writes xetexfontlist.txt (usage: fontlist.py <folder> <path prefix>), the font list SwiftLaTeX's XeTeX reads instead of fontconfig
(xetex.wasm/xetexdir/XeTeXFontMgr_FC.cpp, searchForHostPlatformFonts): one record per font."""
import math
import sys
from pathlib import Path

from fontTools.ttLib import TTFont


def names(font, *ids):
    out = []
    for rec in font["name"].names:
        if rec.nameID in ids:
            try:
                text = rec.toUnicode().strip()
            except UnicodeDecodeError:
                continue
            if text and text not in out:
                out.append(text)
    return out


def opsize(font):
    """Design size and range from the GPOS 'size' feature, in points; 10 pt and no range without one."""
    if "GPOS" in font:
        for rec in font["GPOS"].table.FeatureList.FeatureRecord if font["GPOS"].table.FeatureList else []:
            if rec.FeatureTag == "size" and rec.Feature.FeatureParams is not None:
                p = rec.Feature.FeatureParams
                return p.DesignSize / 10, p.RangeStart / 10, p.RangeEnd / 10, p.SubfamilyID
    return 10.0, 0.0, 0.0, 0


def record(fid, path, prefix):
    font = TTFont(path, fontNumber=0, lazy=True)
    os2 = font["OS/2"]
    sel = os2.fsSelection
    angle = font["post"].italicAngle if "post" in font else 0
    design, low, high, sub = opsize(font)
    lines = [str(fid), prefix + path.name, "0"]
    for group in (names(font, 16, 1), names(font, 17, 2), names(font, 4)):
        lines += [str(len(group)), *group]
    lines += [
        (names(font, 6) or [path.stem])[0],
        (names(font, 2) or ["Regular"])[0],
        str(os2.usWeightClass),
        str(os2.usWidthClass),
        str(int(1000 * math.tan(-angle * math.pi / 180))),
        str(int(bool(sel & (1 << 6)))),
        str(int(bool(sel & (1 << 5)))),
        str(int(bool(sel & 1))),
        f"{design:g}",
        f"{low:g}",
        f"{high:g}",
        str(sub),
        str(sub),
    ]
    return lines


folder, prefix = Path(sys.argv[1]), sys.argv[2]
fonts = sorted(p for p in folder.iterdir() if p.suffix.lower() in (".otf", ".ttf"))
out = []
for i, path in enumerate(fonts):
    out += record(i, path, prefix)
(folder / "xetexfontlist.txt").write_text("\n".join(out) + "\n", encoding="utf-8")
print(len(fonts), "fonts in xetexfontlist.txt")
