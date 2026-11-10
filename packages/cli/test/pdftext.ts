// The text of a PDF that Typst wrote, run by run in the order of the page's content stream (the
// order in which a parser such as an applicant tracking system reads it), each run with its
// position. Only what Typst writes is handled: plain objects, Flate streams, Type0 fonts with
// two-byte codes and a ToUnicode map. A test helper, not a PDF reader.

import { inflateSync } from "node:zlib";

export interface TextRun {
  page: number;
  /** Points from the left edge. */
  x: number;
  /** Points from the top edge, at the baseline. */
  y: number;
  text: string;
}

interface PdfObject {
  dict: string;
  stream?: Buffer;
}

function readObjects(src: string): Map<number, PdfObject> {
  const out = new Map<number, PdfObject>();
  const header = /(\d+) 0 obj\s*/g;
  let m: RegExpExecArray | null;
  while ((m = header.exec(src))) {
    const start = header.lastIndex;
    const end = src.indexOf("endobj", start);
    const body = src.slice(start, end);
    const stream = /\bstream\r?\n/.exec(body);
    const length = stream && /\/Length (\d+)/.exec(body.slice(0, stream.index));
    if (stream && length) {
      const at = start + stream.index + stream[0].length;
      const raw = Buffer.from(src.slice(at, at + Number(length[1])), "latin1");
      const dict = body.slice(0, stream.index);
      out.set(Number(m[1]), { dict, stream: /\/FlateDecode/.test(dict) ? inflateSync(raw) : raw });
      header.lastIndex = at + Number(length[1]);
    } else out.set(Number(m[1]), { dict: body });
  }
  return out;
}

const utf16 = (hex: string) => String.fromCharCode(...(hex.match(/.{4}/g) ?? []).map((h) => parseInt(h, 16)));

/** Code → text of a ToUnicode CMap. */
function toUnicode(cmap: string): Map<number, string> {
  const map = new Map<number, string>();
  for (const [, block] of cmap.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const [, code, text] of block.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) map.set(parseInt(code, 16), utf16(text));
  }
  for (const [, block] of cmap.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const [, lo, hi, text] of block.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) {
      const first = utf16(text);
      for (let code = parseInt(lo, 16); code <= parseInt(hi, 16); code++) {
        const step = code - parseInt(lo, 16);
        map.set(code, first.slice(0, -1) + String.fromCharCode(first.charCodeAt(first.length - 1) + step));
      }
    }
  }
  return map;
}

type Token = { kind: "num"; value: number } | { kind: "name"; value: string } | { kind: "str"; value: number[] } | { kind: "op"; value: string };

const ESCAPES: Record<string, number> = { n: 10, r: 13, t: 9, b: 8, f: 12 };

function* tokens(s: string): Generator<Token> {
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) i++;
    else if (c === "%") while (i < s.length && s[i] !== "\n") i++;
    else if (c === "(") {
      const bytes: number[] = [];
      let depth = 1;
      i++;
      while (i < s.length) {
        const ch = s[i++];
        if (ch === "\\") {
          const next = s[i++];
          if (/[0-7]/.test(next)) {
            let octal = next;
            while (octal.length < 3 && /[0-7]/.test(s[i])) octal += s[i++];
            bytes.push(parseInt(octal, 8));
          } else if (next !== "\n") bytes.push(ESCAPES[next] ?? next.charCodeAt(0));
          continue;
        }
        if (ch === "(") depth++;
        if (ch === ")" && --depth === 0) break;
        bytes.push(ch.charCodeAt(0));
      }
      yield { kind: "str", value: bytes };
    } else if (s.startsWith("<<", i) || s.startsWith(">>", i)) {
      yield { kind: "op", value: s.slice(i, i + 2) };
      i += 2;
    } else if (c === "<") {
      const end = s.indexOf(">", i);
      const hex = s.slice(i + 1, end).replace(/\s/g, "");
      yield { kind: "str", value: (hex.match(/.{1,2}/g) ?? []).map((h) => parseInt(h.padEnd(2, "0"), 16)) };
      i = end + 1;
    } else if (c === "[" || c === "]") {
      yield { kind: "op", value: c };
      i++;
    } else {
      let j = i + 1;
      while (j < s.length && !/[\s()<>[\]/%]/.test(s[j])) j++;
      const word = s.slice(i, j);
      i = j;
      if (c === "/") yield { kind: "name", value: word.slice(1) };
      else if (/^[-+.\d]/.test(word)) yield { kind: "num", value: Number(word) };
      else yield { kind: "op", value: word };
    }
  }
}

type Matrix = [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
/** `m` then `n`, as PDF concatenates matrices. */
const times = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[1] * n[2],
  m[0] * n[1] + m[1] * n[3],
  m[2] * n[0] + m[3] * n[2],
  m[2] * n[1] + m[3] * n[3],
  m[4] * n[0] + m[5] * n[2] + n[4],
  m[4] * n[1] + m[5] * n[3] + n[5],
];

export function pdfText(pdf: Uint8Array): TextRun[] {
  const objects = readObjects(Buffer.from(pdf).toString("latin1"));
  const ref = (dict: string, key: string) => Number(new RegExp(`/${key} (\\d+) 0 R`).exec(dict)?.[1]);
  const tree = [...objects.values()].find((o) => /\/Type \/Pages\b/.test(o.dict))!;
  const kids = [.../\/Kids \[([^\]]*)\]/.exec(tree.dict)![1].matchAll(/(\d+) 0 R/g)].map((k) => Number(k[1]));
  const runs: TextRun[] = [];
  kids.forEach((id, index) => {
    const page = objects.get(id)!.dict;
    const height = Number(/\/MediaBox \[\S+ \S+ \S+ (\S+)\]/.exec(page)![1]);
    const fonts = new Map<string, Map<number, string>>();
    for (const [, name, font] of (/\/Font <<([^>]*)>>/.exec(page)?.[1] ?? "").matchAll(/\/(\S+) (\d+) 0 R/g)) {
      const cmap = objects.get(ref(objects.get(Number(font))!.dict, "ToUnicode"))?.stream;
      fonts.set(name, cmap ? toUnicode(cmap.toString("latin1")) : new Map());
    }
    const content = objects.get(ref(page, "Contents"))!.stream!.toString("latin1");
    let ctm = IDENTITY;
    let tm = IDENTITY;
    const saved: Matrix[] = [];
    let font = new Map<number, string>();
    let operands: Token[] = [];
    let array: Token[] | undefined;
    let dictDepth = 0;
    const decode = (bytes: number[]) => {
      let text = "";
      for (let i = 0; i + 1 < bytes.length; i += 2) text += font.get((bytes[i] << 8) | bytes[i + 1]) ?? "";
      return text;
    };
    const show = (text: string) => {
      const [, , , , x, y] = times(tm, ctm);
      if (text) runs.push({ page: index + 1, x, y: height - y, text });
    };
    for (const t of tokens(content)) {
      if (t.kind === "op" && t.value === "<<") dictDepth++;
      else if (t.kind === "op" && t.value === ">>") dictDepth--;
      else if (dictDepth > 0) continue;
      else if (t.kind === "op" && t.value === "[") array = [];
      else if (t.kind === "op" && t.value === "]") {
        operands.push({ kind: "op", value: "array" }, ...array!);
        array = undefined;
      } else if (array) array.push(t);
      else if (t.kind !== "op") operands.push(t);
      else {
        const nums = operands.filter((o) => o.kind === "num").map((o) => o.value as number);
        switch (t.value) {
          case "q":
            saved.push(ctm);
            break;
          case "Q":
            ctm = saved.pop() ?? IDENTITY;
            break;
          case "cm":
            ctm = times(nums as Matrix, ctm);
            break;
          case "BT":
            tm = IDENTITY;
            break;
          case "Tm":
            tm = nums as Matrix;
            break;
          case "Td":
            tm = times([1, 0, 0, 1, nums[0], nums[1]], tm);
            break;
          case "Tf":
            font = fonts.get(operands.find((o) => o.kind === "name")!.value as string) ?? new Map();
            break;
          case "Tj":
            show(decode(operands.find((o) => o.kind === "str")!.value as number[]));
            break;
          case "TJ":
            show(operands.filter((o) => o.kind === "str").map((o) => decode(o.value as number[])).join(""));
            break;
        }
        operands = [];
      }
    }
  });
  return runs;
}

/** Runs out of reading order: a run above the one before it, or to its left on the same line
 * (baselines within `tolerance` points). */
export function outOfOrder(runs: TextRun[], tolerance = 1.5): [TextRun, TextRun][] {
  const bad: [TextRun, TextRun][] = [];
  for (let i = 1; i < runs.length; i++) {
    const [a, b] = [runs[i - 1], runs[i]];
    if (b.page > a.page) continue;
    const sameLine = Math.abs(b.y - a.y) <= tolerance;
    if (b.page < a.page || (!sameLine && b.y < a.y) || (sameLine && b.x < a.x - tolerance)) bad.push([a, b]);
  }
  return bad;
}
