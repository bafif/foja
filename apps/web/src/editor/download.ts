import { desktop, saveFile } from "./desktop";

/** Hands a file to the user: a download in a browser, the save dialog in the desktop app. */
export async function download(name: string, data: Uint8Array | string, mime: string): Promise<void> {
  if (desktop()) {
    await saveFile(name, data);
    return;
  }
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Reads a file the user picked. */
export function readFile(file: File): Promise<Uint8Array> {
  return file.arrayBuffer().then((b) => new Uint8Array(b));
}
