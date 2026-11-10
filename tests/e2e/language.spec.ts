import { expect, test } from "./fixtures";

// The first visit follows the browser's languages: Spanish when any of them is Spanish, English
// otherwise. What the person picks in a selector is remembered and wins over that.

test.describe("an English browser", () => {
  test.use({ locale: "en-US" });

  test("gets the English landing page and editor", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/en\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your CV in Typst, without writing code");
    expect(await page.evaluate(() => document.documentElement.lang)).toBe("en");
    await page.getByRole("link", { name: "Open the editor" }).click();
    await expect(page.getByRole("button", { name: "Start with the example" })).toBeVisible();
  });

  test("keeps Spanish once it is picked, on the landing page and in the editor", async ({ page }) => {
    await page.goto("/en/");
    await page.getByRole("link", { name: "Español" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("link", { name: "Abrir el editor" })).toBeVisible();
    await page.goto("/en/");
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/editor/");
    await expect(page.getByRole("button", { name: "Empezar con el ejemplo" })).toBeVisible();
  });
});

test.describe("a browser that lists Spanish second", () => {
  test.use({ locale: "fr-FR", extraHTTPHeaders: { "Accept-Language": "fr-FR,es;q=0.8" } });

  test("still gets Spanish", async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, "languages", { get: () => ["fr-FR", "es"] }));
    await page.goto("/en/");
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/editor/");
    await expect(page.getByRole("button", { name: "Empezar con el ejemplo" })).toBeVisible();
  });
});

test("a Spanish browser stays on the Spanish page and can switch to English", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tu CV en Typst, sin escribir código");
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute("href", /\/en\/$/);
  await page.getByRole("link", { name: "English" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your CV in Typst, without writing code");
  await page.goto("/editor/");
  await expect(page.getByRole("button", { name: "Start with the example" })).toBeVisible();
  await page.getByLabel("Interface language").selectOption("es");
  await expect(page.getByRole("button", { name: "Empezar con el ejemplo" })).toBeVisible();
  await page.goto("/en/");
  await expect(page).toHaveURL(/\/$/);
});

test("a new project starts in the interface's language", async ({ page }) => {
  await page.goto("/editor/");
  await page.getByLabel("Idioma de la interfaz").selectOption("en");
  await page.getByRole("button", { name: "Empty project" }).click();
  await expect(page.locator(".foja-page svg")).toBeAttached();
  await page.getByRole("button", { name: "Profile text" }).click();
  await expect(page.getByLabel("Subtitle")).toHaveValue("The job you are after");
});
