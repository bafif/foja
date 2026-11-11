// What a user uploads as a template: one `.typ`, or a `.zip` or `.tar.gz` of a template's files.
// The contents are data from someone else: they are only read, never run (Typst compiles them
// later, inside its own sandbox), with caps on size and on the number of files, and paths that
// are absolute or climb with `..` are refused. The decompression is the platform's own
// (DecompressionStream, in browsers and in Node), so no library is added.

/** Caps on what an upload may unpack to. */
export const UPLOAD_LIMITS = { files: 400, bytes: 20 * 1024 * 1024 };

export class UploadError extends Error {}

/** A relative path inside the template, or an error: no absolute paths, no `..`, no backslashes. */
export function safePath(raw: string): string {
  const path = raw.replace(/^\.\//, "");
  if (!path || path.startsWith("/") || /^[A-Za-z]:/.test(path) || path.includes("\\") || path.includes("\0")) throw new UploadError(`unsafe path "${raw}"`);
  const parts = path.split("/").filter((p, i, all) => p !== "" || i === all.length - 1);
  if (parts.some((p) => p === ".." || p === ".")) throw new UploadError(`unsafe path "${raw}"`);
  return parts.join("/");
}

/** Counts files and bytes against the caps as they come out. */
class Budget {
  private files = 0;
  private bytes = 0;
  file() {
    if (++this.files > UPLOAD_LIMITS.files) throw new UploadError(`more than ${UPLOAD_LIMITS.files} files`);
  }
  take(n: number) {
    this.bytes += n;
    if (this.bytes > UPLOAD_LIMITS.bytes) throw new UploadError(`more than ${UPLOAD_LIMITS.bytes / 1024 / 1024} MB unpacked`);
  }
}

/** Inflates `data` with the platform's decompressor, stopping as soon as the budget runs out. */
async function inflate(data: Uint8Array, format: "deflate-raw" | "gzip", budget: Budget): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream(format));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      budget.take(value.length);
      chunks.push(value);
      size += value.length;
    }
  } catch (e) {
    await reader.cancel().catch(() => undefined);
    throw e instanceof UploadError ? e : new UploadError("the archive is damaged");
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

const decoder = new TextDecoder();

async function readZip(data: Uint8Array, budget: Budget): Promise<Record<string, Uint8Array>> {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  // The end of central directory record, searched from the end (a comment may follow it).
  let end = -1;
  for (let i = data.length - 22; i >= Math.max(0, data.length - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new UploadError("not a zip archive");
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const files: Record<string, Uint8Array> = {};
  for (let n = 0; n < count; n++) {
    if (at + 46 > data.length || view.getUint32(at, true) !== 0x02014b50) throw new UploadError("the archive is damaged");
    const method = view.getUint16(at + 10, true);
    const compressed = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const extra = view.getUint16(at + 30, true);
    const comment = view.getUint16(at + 32, true);
    const local = view.getUint32(at + 42, true);
    const name = decoder.decode(data.subarray(at + 46, at + 46 + nameLength));
    at += 46 + nameLength + extra + comment;
    if (name.endsWith("/")) continue; // a directory
    budget.file();
    const path = safePath(name);
    if (local + 30 > data.length) throw new UploadError("the archive is damaged");
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const body = data.subarray(start, start + compressed);
    if (method === 0) {
      budget.take(body.length);
      files[path] = body.slice();
    } else if (method === 8) files[path] = await inflate(body, "deflate-raw", budget);
    else throw new UploadError(`"${name}" uses a compression this reader does not know`);
  }
  return files;
}

async function readTar(data: Uint8Array, budget: Budget): Promise<Record<string, Uint8Array>> {
  const files: Record<string, Uint8Array> = {};
  let longName: string | undefined;
  for (let at = 0; at + 512 <= data.length; ) {
    const header = data.subarray(at, at + 512);
    if (header.every((b) => b === 0)) break;
    const field = (from: number, length: number) => decoder.decode(header.subarray(from, from + length)).replace(/\0.*$/s, "");
    const size = parseInt(field(124, 12).trim() || "0", 8);
    const type = String.fromCharCode(header[156]);
    const prefix = field(345, 155);
    const name = longName ?? (prefix ? `${prefix}/${field(0, 100)}` : field(0, 100));
    longName = undefined;
    const body = data.subarray(at + 512, at + 512 + size);
    at += 512 + Math.ceil(size / 512) * 512;
    if (type === "L") longName = decoder.decode(body).replace(/\0.*$/s, ""); // GNU long name
    else if (type === "0" || type === "\0") {
      budget.file();
      budget.take(size);
      files[safePath(name)] = body.slice();
    } else if (type === "1" || type === "2") throw new UploadError(`"${name}" is a link, which is not accepted`);
    // Directories and extended headers (5, x, g) carry nothing to keep.
  }
  return files;
}

/** The files of an upload by path: a `.typ` alone, a `.zip` or a `.tar.gz` (also `.tgz`). */
export async function readUpload(name: string, data: Uint8Array): Promise<Record<string, Uint8Array>> {
  const lower = name.toLowerCase();
  const budget = new Budget();
  if (lower.endsWith(".typ")) {
    budget.file();
    budget.take(data.length);
    return { [safePath(name.split(/[\\/]/).pop()!)]: data };
  }
  if (lower.endsWith(".zip")) return readZip(data, budget);
  if (lower.endsWith(".tar.gz") || lower.endsWith(".tgz")) return readTar(await inflate(data, "gzip", budget), new Budget());
  throw new UploadError("upload a .typ, a .zip or a .tar.gz");
}
