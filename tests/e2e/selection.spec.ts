import { expect, previewMarkup, startExample, startFictional, test } from "./fixtures";
import type { Page } from "@playwright/test";

const lengthRadio = (page: Page, name: string) => page.getByRole("radiogroup", { name: "Largo" }).getByRole("radio", { name });

test("priorities in the bank, the length and the exceptions in the profile", async ({ page, errors }) => {
  await startFictional(page);
  // The fictional bank marks nothing: an ATS style keeps the normal length, not one with no entries.
  await page.getByRole("button", { name: "Estilo y diseño" }).click();
  await page.locator('[data-style="recto"]').click();
  await page.getByRole("navigation").getByRole("button", { name: "Texto del perfil" }).click();
  await expect(lengthRadio(page, "Normal")).toHaveAttribute("aria-checked", "true");

  // In the bank: the first job essential, one of its items extra.
  await page.getByRole("button", { name: "Banco de entradas" }).click();
  await page.getByRole("button", { name: /Desarrolladora full stack/ }).click();
  await page.getByRole("radiogroup", { name: "Prioridad de Desarrolladora full stack" }).getByRole("radio", { name: "Imprescindible" }).click();
  await page.getByRole("radiogroup", { name: "Prioridad de Calidad" }).getByRole("radio", { name: "Extra" }).click();

  // In the profile: the extra item is out at the normal length; ticking it is an exception.
  await page.getByRole("navigation").getByRole("button", { name: "Texto del perfil" }).click();
  const checks = page.getByRole("region", { name: "Casillas" });
  const quality = checks.getByRole("checkbox", { name: /Calidad/ });
  await expect(quality).not.toBeChecked();
  const before = await previewMarkup(page);
  await quality.check();
  await expect(checks.getByText("excepción", { exact: true })).toBeVisible();
  await expect.poll(() => previewMarkup(page)).not.toBe(before);

  // Short: only the essential, and the exception stays.
  await lengthRadio(page, "Corto").click();
  await expect(checks.getByRole("checkbox", { name: /Pasante de desarrollo/ })).not.toBeChecked();
  await expect(checks.getByRole("checkbox", { name: /Desarrolladora full stack/ })).toBeChecked();
  await expect(quality).toBeChecked();

  // Each profile is a configuration of its own: a copy carries it.
  await page.getByRole("button", { name: "Duplicar", exact: true }).click();
  await expect(lengthRadio(page, "Corto")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("region", { name: "Casillas" }).getByRole("checkbox", { name: /Calidad/ })).toBeChecked();
  expect(errors).toEqual([]);
});

test("fitting to one page steps down the length and can be undone", async ({ page, errors }) => {
  await startExample(page);
  // My bank marks what is essential: Claustro brings the short length, and the CV keeps entries.
  await page.getByRole("button", { name: "Estilo y diseño" }).click();
  await page.locator('[data-style="claustro"]').click();
  await page.getByRole("navigation").getByRole("button", { name: "Texto del perfil" }).click();
  await expect(lengthRadio(page, "Corto")).toHaveAttribute("aria-checked", "true");

  await lengthRadio(page, "Completo").click();
  await expect(page.getByTestId("page-badge")).toContainText("2 páginas");
  await page.getByRole("button", { name: "Ajustar a una página" }).click();
  await expect(page.getByTestId("fit-result")).toContainText("Entra en una página: largo normal, largo corto.");
  await expect(lengthRadio(page, "Corto")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("page-badge")).toContainText("1 página");

  await page.getByRole("button", { name: "Deshacer el ajuste" }).click();
  await expect(lengthRadio(page, "Completo")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("page-badge")).toContainText("2 páginas");
  expect(errors).toEqual([]);
});
