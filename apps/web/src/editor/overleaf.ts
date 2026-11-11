// "Open in Overleaf": the one export that leaves the device, and only when asked. The LaTeX export
// goes to overleaf.com/docs as a data URL in a form posted to a new tab, which is how Overleaf
// takes a project from another site; nothing passes through any server of Foja's.

import { toBase64 } from "@foja/core";

export const OVERLEAF = "https://www.overleaf.com/docs";

/** Posts the project to Overleaf. Has to run inside the click, or the new tab is blocked. */
export function openInOverleaf({ zip, main, engine }: { zip: Uint8Array; main: string; engine: string }) {
  const form = document.createElement("form");
  form.method = "post";
  form.action = OVERLEAF;
  form.target = "_blank";
  form.rel = "noopener";
  form.hidden = true;
  const fields = { snip_uri: `data:application/zip;base64,${toBase64(zip)}`, main_document: main, engine };
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.append(input);
  }
  document.body.append(form);
  form.submit();
  form.remove();
}
