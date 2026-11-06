import { readFileSync } from "node:fs";
import { test as base, chromium, expect, type Page } from "@playwright/test";

// The browser is the host's Chrome, reached over CDP (see scripts/e2e.sh). Every test gets a
// fresh context, so storage (IndexedDB) starts empty.
export const test = base.extend<{ errors: string[] }, {}>({
  browser: [
    async ({}, use) => {
      const browser = await chromium.connectOverCDP(process.env.CDP_URL ?? "http://127.0.0.1:9223");
      await use(browser);
      await browser.close();
    },
    { scope: "worker" },
  ],
  errors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await use(errors);
  },
});

export { expect };

/** Opens the editor on the example project (my own CV) and waits for the first render. */
export async function startExample(page: Page) {
  await page.goto("/editor");
  await page.getByRole("button", { name: "Empezar con el ejemplo" }).click();
  await expect(page.locator(".foja-page svg")).toBeAttached();
}

/** The fictional fixture, which the tests rely on; the example changes whenever my CV does. */
export const fictional = JSON.parse(readFileSync("examples/fictional.project.json", "utf8"));

/** Opens the editor on a project imported as JSON (the fictional fixture by default) and waits for the first render. */
export async function startFictional(page: Page, project: object = fictional) {
  await page.goto("/editor");
  await page.getByText("Importar JSON").locator("input").setInputFiles({ name: "project.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(project)) });
  await expect(page.locator(".foja-page svg")).toBeAttached();
}

export const previewMarkup = (page: Page) => page.locator(".foja-page").innerHTML();
