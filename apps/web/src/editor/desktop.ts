// The desktop app (apps/desktop) runs this same editor in the system's webview, with Tauri's API on
// window.__TAURI__. A webview has no downloads and no tabs, so there exports are saved through the system's save
// dialog and links to other sites open in the browser, both by the app's own commands (apps/desktop/src-tauri).

interface Tauri {
  core: { invoke<T>(cmd: string, args?: unknown, options?: { headers?: Record<string, string> }): Promise<T> };
}

const tauri = () => (typeof window === "undefined" ? undefined : (window as { __TAURI__?: Tauri }).__TAURI__);

/** Running inside the desktop app. */
export const desktop = () => tauri() !== undefined;

/** Asks where to save a file and saves it there; false if the user cancelled. */
export function saveFile(name: string, data: Uint8Array | string): Promise<boolean> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  return tauri()!.core.invoke<boolean>("save", bytes, { headers: { "foja-name": encodeURIComponent(name) } });
}

/** In the desktop app, links that would open a new tab open in the browser instead. */
export function openLinksOutside() {
  if (!desktop()) return;
  document.addEventListener("click", (e) => {
    const a = (e.target as Element | null)?.closest?.("a[href]");
    if (!(a instanceof HTMLAnchorElement) || !/^https:/.test(a.href) || a.origin === location.origin) return;
    e.preventDefault();
    void tauri()!.core.invoke("open", { url: a.href });
  });
}
