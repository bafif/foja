// Reading back what the Word export writes, for the tests.

const decoder = new TextDecoder();

/** The parts of a .docx, as text (docx deflates them; Node's zlib reads them back). */
export async function docxParts(data: Uint8Array): Promise<Record<string, string>> {
  const { inflateRawSync } = await import("node:zlib");
  const view = new DataView(data.buffer, data.byteOffset);
  const parts: Record<string, string> = {};
  let at = 0;
  while (view.getUint32(at, true) === 0x04034b50) {
    const method = view.getUint16(at + 8, true);
    const size = view.getUint32(at + 18, true);
    const nameLength = view.getUint16(at + 26, true);
    const extra = view.getUint16(at + 28, true);
    const name = decoder.decode(data.subarray(at + 30, at + 30 + nameLength));
    const body = data.subarray(at + 30 + nameLength + extra, at + 30 + nameLength + extra + size);
    parts[name] = decoder.decode(method === 8 ? inflateRawSync(body) : body);
    at += 30 + nameLength + extra + size;
  }
  return parts;
}
