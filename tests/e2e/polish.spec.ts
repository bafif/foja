import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, previewMarkup, startFictional, test } from "./fixtures";

const example = JSON.parse(readFileSync("examples/fictional.project.json", "utf8"));

test("selecting a part highlights it, clicking the preview selects it", async ({ page }) => {
  await startFictional(page);
  await page.getByRole("button", { name: "Banco de entradas" }).click();
  await page.getByRole("button", { name: /Pasante de desarrollo/ }).click();
  const box = page.getByTestId("highlight-box").first();
  await expect(box).toBeVisible();
  const where = (await box.boundingBox())!;

  await page.getByRole("button", { name: "Diseño" }).click();
  await expect(page.getByTestId("highlight-box")).toHaveCount(0);
  await page.mouse.click(where.x + where.width / 2, where.y + where.height / 2);
  await expect(page.getByLabel("Título", { exact: true })).toHaveValue("Pasante de desarrollo");

  // The sidebar is its own column: a click there selects a sidebar part.
  const summary = page.getByRole("button", { name: "Texto del perfil" });
  await summary.click();
  await page.getByRole("button", { name: /Fortalezas/ }).click();
  const side = (await page.getByTestId("highlight-box").first().boundingBox())!;
  await page.getByRole("button", { name: "Contactos" }).click();
  await page.mouse.click(side.x + side.width / 2, side.y + 5);
  await expect(page.getByLabel("Título de la sección")).toHaveValue("Fortalezas");
});

test("a CV that does not fit says by how much and what overflows", async ({ page }) => {
  const long = structuredClone(example);
  const exp = long.profiles.desarrolladora.sections[0];
  exp.blocks = Array.from({ length: 6 }, () => exp.blocks).flat();
  await page.goto("/editor");
  await page.getByText("Importar JSON").locator("input").setInputFiles({ name: "long.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(long)) });
  await expect(page.getByTestId("page-badge")).toContainText(/2 páginas ⚠ se pasa ~\d+ líneas/);
  await expect(page.getByTestId("overflow-box").first()).toBeVisible();
  await expect(page.getByRole("navigation").getByTitle("se pasa de una página").first()).toBeVisible();
});

test("sections reorder by keyboard drag and drop", async ({ page }) => {
  await startFictional(page);
  const nav = page.getByRole("navigation");
  const titles = () => nav.locator("li button:not([aria-label])").allInnerTexts();
  const before = await titles();
  const handle = nav.getByRole("button", { name: "Arrastrar para reordenar" }).first();
  await handle.focus();
  // dnd-kit measures between animation frames: give it a moment between keys.
  for (const key of ["Space", "ArrowDown", "Space"]) {
    await page.keyboard.press(key);
    await page.waitForTimeout(250);
  }
  await expect.poll(titles).not.toEqual(before);
  const after = await titles();
  expect(after.indexOf("Experiencia")).toBeGreaterThan(after.indexOf("Formación"));
});

test("the command palette goes anywhere", async ({ page }) => {
  await startFictional(page);
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder(/Ir a/).fill("diseno");
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Columnas")).toBeVisible();
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder(/Ir a/).fill("entrada licenciatura");
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Título", { exact: true })).toHaveValue("Licenciatura en Ciencias de la Computación");
});

test("a photo is cropped and goes into the CV", async ({ page }) => {
  await startFictional(page);
  await page.getByRole("button", { name: "Personales" }).click();
  const before = await previewMarkup(page);
  // A 40×30 PNG made in the page.
  const png = await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 40;
    c.height = 30;
    const g = c.getContext("2d")!;
    g.fillStyle = "#336699";
    g.fillRect(0, 0, 40, 30);
    const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), "image/png"));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  await page.getByLabel("Foto").setInputFiles({ name: "me.png", mimeType: "image/png", buffer: Buffer.from(png) });
  await expect(page.getByTestId("crop-frame")).toBeVisible();
  await page.getByRole("button", { name: "Usar esta foto" }).click();
  await expect(page.getByRole("button", { name: "Quitar foto" })).toBeVisible();
  await expect.poll(() => previewMarkup(page)).not.toBe(before);
  expect(await previewMarkup(page)).toContain("data:image/jpeg");
});

test.describe("in dark mode", () => {
  test.use({ colorScheme: "dark" });

  test("the theme sets every colour the stylesheet declares", async ({ page }) => {
    await page.goto("/editor");
    await expect(page.locator("html")).toHaveAttribute("data-mode", "dark");
    // Anything global.css declares on :root and the theme leaves alone keeps its light value.
    const unset = await page.evaluate(() => {
      const names = new Set<string>();
      const walk = (rules: CSSRuleList) => {
        for (const rule of Array.from(rules)) {
          if (rule instanceof CSSStyleRule && rule.selectorText === ":root")
            for (const name of Array.from(rule.style)) if (name.startsWith("--foja-")) names.add(name);
          if ("cssRules" in rule) walk((rule as CSSGroupingRule).cssRules);
        }
      };
      for (const sheet of Array.from(document.styleSheets)) walk(sheet.cssRules);
      return { declared: names.size, unset: [...names].filter((name) => !document.documentElement.style.getPropertyValue(name)) };
    });
    expect(unset.declared).toBeGreaterThan(10);
    expect(unset.unset).toEqual([]);
  });
});

/** What sticks out of the screen sideways, outside the CV itself: the outermost offenders, by tag and text. */
const sticksOut = (page: Page) =>
  page.evaluate(() => {
    const out: string[] = [];
    for (const e of Array.from(document.querySelectorAll("body *"))) {
      const right = e.getBoundingClientRect().right;
      if (right <= innerWidth + 1 || e.closest(".foja-page")) continue;
      if (e.parentElement && e.parentElement.getBoundingClientRect().right > innerWidth + 1) continue;
      out.push(`${e.tagName.toLowerCase()} «${(e.textContent ?? "").trim().slice(0, 30)}»`);
    }
    return out;
  });

test.describe("on a phone", () => {
  // An iPhone SE, the smallest screen Safari still runs on.
  test.use({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true });

  test("one pane at a time, nothing wider than the screen", async ({ page }) => {
    await startFictional(page);
    const panes = page.getByRole("navigation", { name: "Paneles" });
    await expect(page.getByLabel("Subtítulo")).toBeVisible();
    expect(await sticksOut(page)).toEqual([]);
    await panes.getByRole("button", { name: "Vista previa" }).click();
    await expect(page.locator(".foja-page svg")).toBeVisible();
    await expect(page.getByLabel("Subtítulo")).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await panes.getByRole("button", { name: "Secciones" }).click();
    await page.getByRole("button", { name: "Banco de entradas" }).click();
    await expect(page.getByRole("button", { name: "Nueva entrada" })).toBeVisible();
    // Export is in the bar at the bottom, in reach of the thumb; the bar at the top keeps only the profile,
    // undo, redo and the menu.
    await expect(page.getByRole("button", { name: "Exportar", exact: true })).toHaveCount(1);
    expect((await page.getByRole("button", { name: "Exportar", exact: true }).boundingBox())!.y).toBeGreaterThan(600);
    await page.getByRole("button", { name: "Más acciones" }).click();
    await expect(page.getByRole("button", { name: "+ Nuevo perfil" })).toBeVisible();
  });

  test("the menu is a sheet from the bottom with controls a finger can hit", async ({ page }) => {
    await startFictional(page);
    await page.getByRole("button", { name: "Más acciones" }).click();
    const sheet = page.locator("#more-actions");
    const box = (await sheet.boundingBox())!;
    expect(box.x).toBe(0);
    expect(box.width).toBe(375);
    expect(Math.round(box.y + box.height)).toBe(667);
    for (const button of await sheet.getByRole("button").all()) expect((await button.boundingBox())!.height, await button.innerText()).toBeGreaterThanOrEqual(44);
    // Menus inside it open like an accordion: a touch elsewhere in the sheet leaves them open, so the sheet does
    // not shrink under the finger, and closing the sheet works with one open.
    await sheet.getByRole("button", { name: "Apariencia ▾" }).click();
    await sheet.getByRole("button", { name: "Proyecto ▾" }).click();
    await expect(sheet.getByRole("dialog", { name: "Apariencia" })).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Nuevo proyecto" })).toBeVisible();
    await sheet.getByRole("button", { name: "Cerrar" }).click();
    await expect(sheet).toBeHidden();
    // An action on the profile closes the sheet, so what it did is in sight.
    await page.getByRole("button", { name: "Más acciones" }).click();
    await sheet.getByRole("button", { name: "Duplicar" }).click();
    await expect(sheet).toBeHidden();
    await expect(page.getByLabel("Perfil", { exact: true })).toHaveValue(/.+/);
    expect(await page.getByLabel("Perfil", { exact: true }).locator("option").count()).toBe(Object.keys(example.profiles).length + 1);
  });

  test.describe("on the narrowest phones", () => {
    test.use({ viewport: { width: 320, height: 640 } });

    test("no panel sticks out of the screen", async ({ page }) => {
      await startFictional(page);
      const panes = page.getByRole("navigation", { name: "Paneles" });
      await panes.getByRole("button", { name: "Secciones" }).click();
      // Every part of the navigation but the handles for dragging sections.
      const items = page.getByRole("navigation", { name: "Secciones" }).locator("button:not([aria-label])");
      const names = await items.allInnerTexts();
      expect(names.length).toBeGreaterThan(6);
      for (let i = 0; i < names.length; i++) {
        await panes.getByRole("button", { name: "Secciones" }).click();
        await items.nth(i).click();
        expect(await sticksOut(page), names[i]).toEqual([]);
      }
      // An entry of the bank, with its items and their controls.
      await panes.getByRole("button", { name: "Secciones" }).click();
      await page.getByRole("button", { name: "Banco de entradas" }).click();
      await page.getByRole("main").getByRole("button").nth(1).click();
      await expect(page.getByLabel("Título", { exact: true })).toBeVisible();
      expect(await sticksOut(page)).toEqual([]);
    });
  });

  test("fields are big enough that Safari does not zoom into them", async ({ page }) => {
    await startFictional(page);
    expect(await page.getByLabel("Subtítulo").evaluate((e) => getComputedStyle(e).fontSize)).toBe("16px");
  });

  test("the export goes to the share sheet once the file is ready", async ({ page, errors }) => {
    // Chromium on Linux has no Web Share; this stands in for the one on Android and iOS.
    await page.addInitScript(() => {
      const shared: string[] = [];
      Object.assign(window, { shared });
      Object.defineProperty(navigator, "canShare", { value: () => true });
      Object.defineProperty(navigator, "share", { value: async (data: ShareData) => void shared.push(...(data.files ?? []).map((f) => f.name)) });
    });
    await startFictional(page);
    await page.getByRole("button", { name: "Exportar", exact: true }).click();
    await page.getByLabel("PDF").check();
    await page.getByRole("button", { name: "Preparar el archivo" }).click();
    await expect(page.getByRole("status")).toContainText(/Listo: .+\.pdf/);
    await page.getByRole("button", { name: "Compartir o guardar…" }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { shared: string[] }).shared)).toEqual([expect.stringMatching(/\.pdf$/)]);
    await expect(page.getByRole("dialog")).toBeHidden();
    expect(errors).toEqual([]);
  });

  test.describe("on an iPhone", () => {
    test.use({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1" });

    test("the welcome screen and the menu say how to add it to the Home Screen", async ({ page }) => {
      await page.goto("/editor");
      await expect(page.getByTestId("install-steps")).toBeHidden();
      await page.getByText("Cómo instalarla").click();
      await expect(page.getByTestId("install-steps")).toContainText("«Más»");
      await page.getByRole("button", { name: "Empezar con el ejemplo" }).click();
      await page.getByRole("button", { name: "Más acciones" }).click();
      await page.getByRole("button", { name: "Instalar como app" }).click();
      await expect(page.getByText("Tocá Compartir. En iOS 26 o más nuevo")).toBeVisible();
      await expect(page.getByText("tocá «Editar acciones…»")).toBeVisible();
    });
  });

  test.describe("in Chrome on an iPhone", () => {
    test.use({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/142.0.7444.46 Mobile/15E148 Safari/604.1" });

    test("the menu points at Chrome's share icon, and at Safari if the option is missing", async ({ page }) => {
      await page.goto("/editor");
      await page.getByRole("button", { name: "Empezar con el ejemplo" }).click();
      await page.getByRole("button", { name: "Más acciones" }).click();
      await page.getByRole("button", { name: "Instalar como app" }).click();
      await expect(page.getByText("Tocá el ícono de compartir")).toBeVisible();
      await expect(page.getByText("abrí Foja en Safari")).toBeVisible();
    });
  });
});
