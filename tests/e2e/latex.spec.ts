import { expect, previewMarkup, startFictional, test } from "./fixtures";

test("a LaTeX template is imported, compiled with LaTeX in the browser and shown in the preview", async ({ page, errors }) => {
  test.setTimeout(240_000);
  await startFictional(page);
  await page.getByRole("button", { name: "Estilo y diseño" }).click();
  await page.getByRole("button", { name: "Importar una plantilla Typst o LaTeX" }).click();
  await page.getByLabel("Archivo de la plantilla").setInputFiles("packages/core/test/fixtures/latex/resume.tex");

  await expect(page.getByText("Es una plantilla LaTeX")).toBeVisible();
  const header = page.getByRole("region", { name: "Encabezado · cvheader" });
  await expect(header.getByRole("row", { name: /#1/ }).getByRole("combobox")).toHaveValue("name");
  await expect(header.getByRole("row", { name: /#3/ }).getByRole("combobox")).toHaveValue("email");
  const entries = page.getByRole("region", { name: "Macro cventry (3 llamadas)" });
  await expect(entries.getByRole("row", { name: /#3/ }).getByRole("combobox")).toHaveValue("period");
  await expect(page.getByRole("region", { name: "Lo que va a entrar" })).toContainText("Backend developer · Example Co.");

  await page.getByRole("button", { name: "Importar", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Perfil" })).toHaveValue("resume");
  // LaTeX's PDF, as an image on the preview's page: the first time it also downloads the engine.
  await expect(page.locator(".foja-page image")).toHaveCount(1, { timeout: 180_000 });
  await expect(page.getByTestId("page-badge")).toContainText("1 página");
  await expect(page.getByRole("alert")).toHaveCount(0);

  // An edit compiles again, now in well under the first time.
  await page.getByRole("button", { name: "Texto del perfil" }).click();
  const before = await previewMarkup(page);
  await page.getByLabel("Resumen", { exact: true }).fill("I build and run backend services.");
  await expect.poll(() => previewMarkup(page), { timeout: 20_000 }).not.toBe(before);
  expect(errors).toEqual([]);
});

test("a XeLaTeX template names fonts Foja lacks: it says which, and compiles once they are uploaded", async ({ page, errors }) => {
  test.setTimeout(240_000);
  await startFictional(page);
  await page.getByRole("button", { name: "Estilo y diseño" }).click();
  await page.getByRole("button", { name: "Importar una plantilla Typst o LaTeX" }).click();
  await page.getByLabel("Archivo de la plantilla").setInputFiles("packages/core/test/fixtures/latex/modern.tex");
  await expect(page.getByText("Es una plantilla XeLaTeX")).toBeVisible();
  await expect(page.getByRole("region", { name: "Lo que va a entrar" })).toContainText("Data engineer · Example Labs");
  await page.getByRole("button", { name: "Importar", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Perfil" })).toHaveValue("modern");

  // Noto Sans and XCharter are not among Foja's LaTeX fonts: the style panel names what is missing.
  await page.getByRole("button", { name: "Estilo y diseño" }).click();
  const fonts = page.getByRole("region", { name: "Fuentes de la plantilla" });
  await expect(fonts.getByRole("status")).toContainText("«Noto Sans»", { timeout: 180_000 });
  const dir = "packages/template/fonts/";
  await fonts.getByLabel("Subir fuentes (.otf, .ttf)").setInputFiles(
    ["NotoSans-Regular.ttf", "NotoSans-Bold.ttf", "NotoSans-Italic.ttf", "NotoSans-BoldItalic.ttf", "XCharter-Roman.otf", "XCharter-Bold.otf"].map((f) => dir + f),
  );
  await expect(fonts.getByRole("listitem")).toHaveCount(6);
  await expect(page.locator(".foja-page image")).toHaveCount(1, { timeout: 60_000 });
  await expect(fonts.getByRole("status")).toHaveCount(0);
  await expect(page.getByTestId("page-badge")).toContainText("1 página");
  expect(errors).toEqual([]);
});
