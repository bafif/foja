// The desktop app (apps/desktop): its two versions agree, and only its build opens the page to Tauri's calls.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { policy } from "../apps/web/integrations/csp.mjs";

const app = join(import.meta.dirname, "../apps/desktop");

test("Cargo.toml has the version of apps/desktop/package.json, which the installers carry", () => {
  const npm = JSON.parse(readFileSync(join(app, "package.json"), "utf8")).version;
  const cargo = readFileSync(join(app, "src-tauri/Cargo.toml"), "utf8").match(/^version = "(.+)"$/m)?.[1];
  expect(cargo).toBe(npm);
  const conf = JSON.parse(readFileSync(join(app, "src-tauri/tauri.conf.json"), "utf8"));
  expect(conf.version).toBe("../package.json");
});

test("the CSP lets only the desktop build call the app", () => {
  const connect = (desktop: boolean) => (policy([], { desktop }) as string).split("; ").find((d) => d.startsWith("connect-src"));
  expect(connect(false)).toBe("connect-src 'self' data:");
  expect(connect(true)).toBe("connect-src 'self' data: ipc: http://ipc.localhost");
});
