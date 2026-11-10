// The landing page's picture of the editor (apps/web/public/screenshot.jpg): the example, my own CV, with one of its
// entries open. Run through scripts/screenshot.sh whenever the example or the editor's look changes.
//   node scripts/screenshot.mjs [out.jpg]
import { chromium } from "@playwright/test";

const [out = ".out/screenshot.jpg"] = process.argv.slice(2);
const base = process.env.BASE_URL ?? "http://127.0.0.1";

const browser = await chromium.connectOverCDP(process.env.CDP_URL ?? "http://127.0.0.1:9223");
try {
  const context = await browser.newContext({ viewport: { width: 1200, height: 720 }, locale: "es-AR", colorScheme: "light" });
  const page = await context.newPage();
  await page.goto(`${base}/editor`);
  await page.getByRole("button", { name: "Empezar con el ejemplo" }).click();
  await page.locator(".foja-page svg").waitFor({ state: "attached" });
  await page.getByRole("button", { name: "Banco de entradas" }).click();
  await page.getByRole("button", { name: /Desarrollador de software/ }).first().click();
  await page.getByLabel("Título", { exact: true }).waitFor();
  await page.waitForTimeout(1500); // the preview settles after the click
  await page.screenshot({ path: out, type: "jpeg", quality: 85 });
  console.log(`Wrote ${out}`);
} finally {
  await browser.close();
}
