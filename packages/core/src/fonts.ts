// What XeTeX needs to find an OpenType or TrueType font by name, read from the font itself: its
// names, weight, width, slant and style bits (the `name`, `OS/2` and `post` tables). The bytes come
// from a file someone uploaded: every read is bounds-checked, and a font that does not read gives
// undefined. Nothing here runs the font; XeTeX, in its WebAssembly worker, lays it out.

export const FONT_FILE = /\.(otf|ttf)$/i;

export interface FontInfo {
  /** Family names (typographic first), as fontspec asks for them: `Noto Sans`. */
  families: string[];
  styles: string[];
  fullNames: string[];
  psName: string;
  subFamily: string;
  weight: number;
  width: number;
  /** 1000 × the tangent of the italic angle, as XeTeX keeps it. */
  slant: number;
  regular: boolean;
  bold: boolean;
  italic: boolean;
}

const SFNT = new Set([0x00010000, 0x4f54544f /* OTTO */, 0x74727565 /* true */]);
const utf16 = new TextDecoder("utf-16be");
const latin1 = new TextDecoder("latin1");

/** The font's names and style, or undefined when it is not a font this can read. */
export function readFont(data: Uint8Array): FontInfo | undefined {
  const v = new DataView(data.buffer, data.byteOffset, data.byteLength);
  try {
    if (!SFNT.has(v.getUint32(0))) return undefined;
    const tables: Record<string, number> = {};
    for (let i = 0, n = v.getUint16(4); i < n; i++) {
      const at = 12 + 16 * i;
      tables[String.fromCharCode(...data.subarray(at, at + 4))] = v.getUint32(at + 8);
    }
    if (tables.name === undefined || tables["OS/2"] === undefined) return undefined;

    const byId = new Map<number, string[]>();
    const name = tables.name;
    const strings = name + v.getUint16(name + 4);
    for (let i = 0, n = v.getUint16(name + 2); i < n; i++) {
      const at = name + 6 + 12 * i;
      const [platform, encoding, language, id, length, offset] = [0, 2, 4, 6, 8, 10].map((o) => v.getUint16(at + o));
      const unicode = platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10));
      const roman = platform === 1 && encoding === 0 && language === 0;
      if (!unicode && !roman) continue;
      if (platform === 3 && (language & 0xff) !== 0x09) continue; // English names, as fontconfig lists them
      const bytes = data.subarray(strings + offset, strings + offset + length);
      if (bytes.length !== length) return undefined;
      const text = (unicode ? utf16 : latin1).decode(bytes).trim();
      const list = byId.get(id) ?? [];
      if (text && !list.includes(text)) list.push(text);
      byId.set(id, list);
    }
    const names = (...ids: number[]) => [...new Set(ids.flatMap((id) => byId.get(id) ?? []))];
    const os2 = tables["OS/2"];
    const selection = v.getUint16(os2 + 62);
    const angle = tables.post === undefined ? 0 : v.getInt32(tables.post + 4) / 65536;
    const families = names(16, 1);
    if (!families.length) return undefined;
    return {
      families,
      styles: names(17, 2),
      fullNames: names(4),
      psName: names(6)[0] ?? families[0].replace(/\s+/g, ""),
      subFamily: names(2)[0] ?? "Regular",
      weight: v.getUint16(os2 + 4),
      width: v.getUint16(os2 + 6),
      slant: Math.trunc(1000 * Math.tan((-angle * Math.PI) / 180)),
      regular: (selection & (1 << 6)) !== 0,
      bold: (selection & (1 << 5)) !== 0,
      italic: (selection & 1) !== 0,
    };
  } catch {
    return undefined;
  }
}
