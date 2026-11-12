import type { Page } from "@playwright/test";
import { expect, startFictional, test } from "./fixtures";

async function openVersions(page: Page) {
  await page.getByRole("button", { name: "Proyecto ▾" }).click();
  await page.getByRole("button", { name: "Versiones", exact: true }).click();
}

test("versions: off until turned on; a named version is compared, previewed and restored, and the restore undone", async ({ page, errors }) => {
  await startFictional(page);
  await openVersions(page);
  await page.getByRole("button", { name: "Activar versiones" }).click();
  await expect(page.getByTestId("version")).toHaveCount(1);

  await page.getByLabel("Nombre de la versión").fill("Enviado a Acme");
  await page.getByRole("button", { name: "Guardar versión" }).click();
  await expect(page.getByTestId("version").first()).toContainText("Enviado a Acme");

  await page.getByRole("button", { name: "Texto del perfil" }).click();
  await page.getByLabel("Subtítulo").fill("Otro subtítulo");
  await expect(page.getByTestId("save-state")).toHaveText("Guardado");

  await openVersions(page);
  const acme = page.getByTestId("version").filter({ hasText: "Enviado a Acme" });
  await acme.getByRole("button", { name: "Ver", exact: true }).click();
  await expect(acme.getByTestId("version-changes")).toContainText("Otro subtítulo");
  await expect(acme.getByTestId("version-preview").locator("svg").first()).toBeAttached();

  await acme.getByRole("button", { name: "Restaurar" }).click();
  await expect(page.getByText("Versión restaurada")).toBeVisible();
  await expect(page.getByTestId("version").filter({ hasText: "Antes de restaurar «Enviado a Acme»" })).toHaveCount(1);
  await page.getByRole("button", { name: "Texto del perfil" }).click();
  await expect(page.getByLabel("Subtítulo")).not.toHaveValue("Otro subtítulo");
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(page.getByLabel("Subtítulo")).toHaveValue("Otro subtítulo");

  // Saved with the project.
  await expect(page.getByTestId("save-state")).toHaveText("Guardado");
  await page.reload();
  await openVersions(page);
  await expect(page.getByTestId("version").filter({ hasText: "Enviado a Acme" })).toHaveCount(2);
  expect(errors).toEqual([]);
});
