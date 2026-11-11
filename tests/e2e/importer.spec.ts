import { expect, startFictional, test } from "./fixtures";

test("a Typst template is read, reviewed and imported, its data and its look", async ({ page, errors }) => {
  await startFictional(page);
  await page.getByRole("button", { name: "Estilo y diseño" }).click();
  await page.getByRole("button", { name: "Importar una plantilla Typst" }).click();
  await page.getByLabel("Archivo de la plantilla").setInputFiles("packages/core/test/fixtures/single.typ");

  // The proposal, to be corrected: company is the place, dates the period.
  const work = page.getByRole("region", { name: "Macro work (2 llamadas)" });
  await expect(work.getByRole("row", { name: /company/ }).getByRole("combobox")).toHaveValue("place");
  await expect(work.getByRole("row", { name: /dates/ }).getByRole("combobox")).toHaveValue("period");
  const preview = page.getByRole("region", { name: "Lo que va a entrar" });
  await expect(preview).toContainText("Software Engineer · Acme");
  // A correction shows at once in the preview.
  await work.getByRole("row", { name: /company/ }).getByRole("combobox").selectOption("omit");
  await expect(preview).not.toContainText("Software Engineer · Acme");
  await work.getByRole("row", { name: /company/ }).getByRole("combobox").selectOption("place");

  await page.getByRole("button", { name: "Importar", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Perfil" })).toHaveValue("single");
  await expect(page.getByLabel("Subtítulo")).toHaveValue("single");
  await expect(page.getByTestId("page-badge")).toContainText("página");
  await expect(page.getByRole("alert")).toHaveCount(0);
  // The new profile uses the template's look, as a style of one's own.
  await page.getByRole("button", { name: "Estilo y diseño" }).click();
  await expect(page.locator('[data-style="single"]')).toHaveAttribute("aria-pressed", "true");
  expect(errors).toEqual([]);
});
