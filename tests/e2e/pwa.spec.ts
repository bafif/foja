import { expect, test } from "./fixtures";

const url = process.env.PWA_URL;

test.describe("production build", () => {
  test.skip(!url, "run through scripts/e2e-pwa.sh");

  test("the landing page links to the editor under the base path", async ({ page, errors }) => {
    await page.goto(url!);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tu CV en Typst, sin escribir código");
    await page.getByRole("link", { name: "Abrir el editor" }).click();
    await expect(page).toHaveURL(`${url}editor/`);
    await page.getByRole("button", { name: "Empezar con el ejemplo" }).click();
    await expect(page.locator(".foja-page svg")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("a LaTeX template compiles under the Content Security Policy, from the site alone", async ({ page, errors }) => {
    test.setTimeout(240_000);
    const violations: string[] = [];
    const elsewhere: string[] = [];
    page.on("console", (m) => /Content.Security.Policy|Refused to/i.test(m.text()) && violations.push(m.text()));
    page.on("request", (r) => !r.url().startsWith(url!) && !r.url().startsWith("data:") && !r.url().startsWith("blob:") && elsewhere.push(r.url()));
    await page.goto(`${url}editor/`);
    await page.getByRole("button", { name: "Empezar con el ejemplo" }).click();
    await page.getByRole("button", { name: "Estilo y diseño" }).click();
    await page.getByRole("button", { name: "Importar una plantilla Typst o LaTeX" }).click();
    await page.getByLabel("Archivo de la plantilla").setInputFiles("packages/core/test/fixtures/latex/resume.tex");
    await page.getByRole("button", { name: "Importar", exact: true }).click();
    await expect(page.locator(".foja-page image")).toHaveCount(1, { timeout: 180_000 });
    await expect(page.getByTestId("page-badge")).toContainText("1 página");
    // LaTeX is not precached: only the editor that uses it downloads it.
    const precached = await page.evaluate(async (base) => (await (await fetch(`${base}sw.js`)).text()).includes("latex/"), url!);
    expect(precached).toBe(false);
    expect(violations).toEqual([]);
    expect(elsewhere).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("Open in Overleaf gets through the Content Security Policy, to Overleaf alone", async ({ page, context, errors }) => {
    const violations: string[] = [];
    page.on("console", (m) => /Content.Security.Policy|Refused to/i.test(m.text()) && violations.push(m.text()));
    // Overleaf itself is not reached: the post is caught and answered here.
    let sent = false;
    await context.route("https://www.overleaf.com/docs", (route) => {
      sent = true;
      return route.fulfill({ contentType: "text/html", body: "<p>Overleaf</p>" });
    });
    await page.goto(`${url}editor/`);
    await page.getByRole("button", { name: "Empezar con el ejemplo" }).click();
    await expect(page.getByTestId("page-badge")).toContainText("1 página");
    await page.getByRole("button", { name: "Exportar", exact: true }).click();
    await page.getByLabel("LaTeX (.zip)").check();
    await Promise.all([page.waitForEvent("popup"), page.getByRole("button", { name: "Abrir en Overleaf" }).click()]);
    await expect.poll(() => sent).toBe(true);
    expect(violations).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("under the Content Security Policy the editor compiles and exports", async ({ page, errors }) => {
    const violations: string[] = [];
    page.on("console", (m) => /Content.Security.Policy|Refused to/i.test(m.text()) && violations.push(m.text()));
    await page.goto(`${url}editor/`);
    expect(await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content")).toContain("connect-src 'self' data:");
    await page.getByRole("button", { name: "Empezar con el ejemplo" }).click();
    await expect(page.getByTestId("page-badge")).toContainText("1 página");
    for (const label of ["PDF", "JPG (una imagen por página)", "Todos los formatos (.zip)"]) {
      await page.getByRole("button", { name: "Exportar", exact: true }).click();
      await page.getByLabel(label).check();
      const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Descargar" }).click()]);
      expect(download.suggestedFilename()).toMatch(/^bautista-damian-fiori-programador\./);
    }
    expect(violations).toEqual([]);
    expect(errors).toEqual([]);
  });

  test.describe("in English", () => {
    test.use({ locale: "en-US" });

    test("the landing page sends an English browser to its English twin, under the policy", async ({ page, errors }) => {
      const violations: string[] = [];
      page.on("console", (m) => /Content.Security.Policy|Refused to/i.test(m.text()) && violations.push(m.text()));
      await page.goto(url!);
      await expect(page).toHaveURL(`${url}en/`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your CV in Typst, without writing code");
      await page.getByRole("link", { name: "Open the editor" }).click();
      await expect(page).toHaveURL(`${url}editor/`);
      await expect(page.getByRole("button", { name: "Start with the example" })).toBeVisible();
      expect(await page.locator('link[rel="manifest"]').getAttribute("href")).toBe(`${new URL(url!).pathname}manifest.en.webmanifest`);
      expect(violations).toEqual([]);
      expect(errors).toEqual([]);
    });
  });

  test("the manifest is installable, in both languages", async ({ page }) => {
    for (const file of ["manifest.webmanifest", "manifest.en.webmanifest"]) {
      const response = await page.request.get(`${url}${file}`);
      const manifest = await response.json();
      expect(manifest.start_url).toBe("./editor/");
      for (const icon of manifest.icons) expect((await page.request.get(new URL(icon.src, `${url}${file}`).href)).ok()).toBe(true);
    }
  });

  test("after the first visit the editor works offline", async ({ page, context }) => {
    await page.goto(`${url}editor/`);
    // Wait for the service worker to install (it precaches the whole site, compiler included).
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
    await expect.poll(() => page.evaluate(async () => (await caches.keys()).some((k) => k.startsWith("foja-")))).toBe(true);
    await expect
      .poll(async () => page.evaluate(async () => (await (await caches.open((await caches.keys()).find((k) => k.startsWith("foja-"))!)).keys()).length), { timeout: 60_000 })
      .toBeGreaterThan(20);
    await context.setOffline(true);
    await page.reload();
    await page.getByRole("button", { name: "Empezar con el ejemplo" }).click();
    await expect(page.locator(".foja-page svg")).toBeVisible();
    await expect(page.getByTestId("page-badge")).toContainText("1 página");
    await context.setOffline(false);
  });
});
