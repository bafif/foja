// What changes on phones and tablets: exports go through the system's share sheet, the project
// asks not to be evicted, and the app offers to be installed.

import { create } from "zustand";

/** A phone or a tablet: the main pointer is a finger. */
export const touch = () => matchMedia("(pointer: coarse)").matches;

/** Running as an installed app (home screen, app menu), not in a browser tab. */
export const installed = () => matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;

/** iPhone or iPad (iPadOS presents itself as a Mac with a touch screen). */
export const ios = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/** Whether exports can go to the share sheet here, before building any file. */
export const canShareFiles = () => touch() && typeof navigator.canShare === "function";

/**
 * The export as a file for the share sheet ("Save to Files", mail, messaging apps), or undefined
 * where this file cannot be shared and has to be downloaded. On an iPhone the share sheet is the
 * reliable way out: a download from an installed web app often does nothing.
 */
export function shareable(name: string, data: Uint8Array | string, mime: string): File | undefined {
  if (!canShareFiles()) return undefined;
  const file = new File([data as BlobPart], name, { type: mime });
  return navigator.canShare({ files: [file] }) ? file : undefined;
}

let askedToKeep = false;

/**
 * Asks the browser to keep the project when space runs low (Safari also clears the storage of a
 * site left unopened for a week, unless it is on the home screen). Only on touch devices and in
 * the installed app, where browsers decide without asking; Firefox on a desktop would show a
 * prompt the first time anything is saved.
 */
export function keepStorage() {
  if (askedToKeep || !(touch() || installed()) || !navigator.storage?.persist) return;
  askedToKeep = true;
  void navigator.storage
    .persisted()
    .then((kept) => kept || navigator.storage.persist())
    .catch(() => undefined);
}

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
}

/** Chrome's install prompt (Android, and Chrome or Edge on a desktop), kept for the Install button. */
export const useInstall = create<{ prompt?: InstallPrompt }>()(() => ({}));

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    useInstall.setState({ prompt: e as InstallPrompt });
  });
  window.addEventListener("appinstalled", () => useInstall.setState({ prompt: undefined }));
}

export async function install() {
  const prompt = useInstall.getState().prompt;
  if (!prompt) return;
  useInstall.setState({ prompt: undefined });
  await prompt.prompt();
}
