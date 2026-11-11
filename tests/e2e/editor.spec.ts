import { readFileSync } from "node:fs";
import { expect, previewMarkup, startExample, startFictional, test } from "./fixtures";

test("the example is my CV, with its three profiles, each on one page", async ({ page, errors }) => {
  await startExample(page);
  await expect(page.getByLabel("Subtítulo")).toHaveValue("Programador");
  await expect(page.getByTestId("page-badge")).toContainText("1 página");
  const profile = page.getByRole("combobox", { name: "Perfil" });
  await expect(profile.locator("option")).toHaveText(["Programador", "Docente", "Técnico electrónico"]);
  for (const [id, subtitle] of [["docente", "Docente de matemática, física y electrónica"], ["tecnico-electronico", "Técnico electrónico"]]) {
    await profile.selectOption(id);
    await expect(page.getByLabel("Subtítulo")).toHaveValue(subtitle);
    await expect(page.getByTestId("page-badge")).toContainText("1 página");
  }
  expect(errors).toEqual([]);
});

test("the fictional fixture renders on one page", async ({ page, errors }) => {
  await startFictional(page);
  await expect(page.getByTestId("page-badge")).toContainText("1 página");
  expect(errors).toEqual([]);
});

test("editing updates the preview, saves and survives a reload", async ({ page }) => {
  await startFictional(page);
  const before = await previewMarkup(page);
  const subtitle = page.getByLabel("Subtítulo");
  await subtitle.fill("Ingeniera de software");
  await expect.poll(() => previewMarkup(page)).not.toBe(before);
  await expect(page.getByTestId("save-state")).toHaveText("Guardado");
  await page.reload();
  await expect(page.getByLabel("Subtítulo")).toHaveValue("Ingeniera de software");
});

test("undo and redo", async ({ page }) => {
  await startFictional(page);
  const subtitle = page.getByLabel("Subtítulo");
  await subtitle.fill("Otro puesto");
  await page.locator("body").click({ position: { x: 5, y: 300 } });
  await page.keyboard.press("Control+z");
  await expect(subtitle).toHaveValue("Desarrolladora full stack");
  await page.keyboard.press("Control+Shift+z");
  await expect(subtitle).toHaveValue("Otro puesto");
});

test("an entry edited once changes in every profile that uses it", async ({ page }) => {
  await startFictional(page);
  await page.getByRole("button", { name: "Banco de entradas" }).click();
  await page.getByRole("button", { name: /Desarrolladora full stack/ }).click();
  await expect(page.getByText(/La usan los perfiles: Desarrolladora, Docente/)).toBeVisible();
  await page.getByLabel("Título", { exact: true }).fill("Desarrolladora sénior");
  await page.getByLabel("Perfil", { exact: true }).selectOption("docente");
  await page.getByRole("button", { name: /Experiencia profesional/ }).click();
  await expect(page.getByRole("button", { name: "Desarrolladora sénior" })).toBeVisible();
});

test("layout options reach the preview", async ({ page }) => {
  await startFictional(page);
  const before = await previewMarkup(page);
  await page.getByRole("button", { name: "Diseño" }).click();
  await page.getByLabel("Columnas").selectOption("1");
  await expect.poll(() => previewMarkup(page)).not.toBe(before);
  await expect(page.getByTestId("page-badge")).toBeVisible();
});

for (const [label, ext, magic] of [
  ["PDF", ".pdf", "%PDF-"],
  ["Word (.docx)", ".docx", "PK"],
  ["Todos los formatos (.zip)", ".zip", "PK"],
  ["Markdown", ".md", "# Inés Ejemplo"],
  ["JPG (una imagen por página)", ".jpg", "\xff\xd8"],
] as const) {
  test(`export ${label}`, async ({ page, errors }) => {
    await startFictional(page);
    await page.getByRole("button", { name: "Exportar" }).click();
    await page.getByLabel(label).check();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Descargar" }).click()]);
    expect(download.suggestedFilename()).toBe(`ines-ejemplo-desarrolladora${ext}`);
    const data = readFileSync((await download.path())!);
    const expected = Buffer.from(magic, ext === ".md" ? "utf8" : "latin1");
    expect(data.subarray(0, expected.length).equals(expected)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test("a JSON Resume comes in through the same button as a project", async ({ page, errors }) => {
  await page.goto("/editor");
  const resume = readFileSync("packages/core/test/fixtures/resume.json");
  await page.getByText("Importar JSON").locator("input").setInputFiles({ name: "resume.json", mimeType: "application/json", buffer: resume });
  await expect(page.locator(".foja-page svg")).toBeAttached();
  await page.getByRole("button", { name: "Banco de entradas" }).click();
  await expect(page.getByRole("button", { name: /Fictional Data Co\./ })).toBeVisible();
  expect(errors).toEqual([]);
});

test("export as JSON Resume, saying what it has no place for", async ({ page, errors }) => {
  // The fictional fixture has a section JSON Resume has no place for: the dialog says so and stays open.
  await startFictional(page);
  await page.getByRole("button", { name: "Exportar" }).click();
  await page.getByLabel(/^JSON Resume/).check();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Descargar" }).click()]);
  expect(download.suggestedFilename()).toBe("ines-ejemplo-desarrolladora.resume.json");
  expect(JSON.parse(readFileSync((await download.path())!, "utf8")).basics.name).toBe("Inés Ejemplo");
  await expect(page.getByTestId("export-left")).toContainText("Fortalezas");
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(errors).toEqual([]);
});

test("Open in Overleaf posts the LaTeX export to overleaf.com in a new tab", async ({ page, context, errors }) => {
  // Overleaf itself is not reached: the post is caught and answered here.
  let sent: URLSearchParams | undefined;
  await context.route("https://www.overleaf.com/docs", async (route) => {
    sent = new URLSearchParams(route.request().postData() ?? "");
    await route.fulfill({ contentType: "text/html", body: "<p>Overleaf</p>" });
  });
  await startFictional(page);
  await page.getByRole("button", { name: "Exportar" }).click();
  await expect(page.getByRole("button", { name: "Abrir en Overleaf" })).toHaveCount(0);
  await page.getByLabel("LaTeX (.zip)").check();
  await expect(page.getByTestId("overleaf-note")).toContainText("overleaf.com");
  const [popup] = await Promise.all([page.waitForEvent("popup"), page.getByRole("button", { name: "Abrir en Overleaf" }).click()]);
  await popup.waitForLoadState();
  expect(sent?.get("engine")).toBe("pdflatex");
  expect(sent?.get("main_document")).toBe("cv.tex");
  expect(sent?.get("snip_uri")).toMatch(/^data:application\/zip;base64,UEsDB/);
  expect(errors).toEqual([]);
});

test("importing something that is not a project explains why", async ({ page }) => {
  await page.goto("/editor");
  await page.getByText("Importar JSON").locator("input").setInputFiles({ name: "x.json", mimeType: "application/json", buffer: Buffer.from('{"format":"foja/2"}') });
  await expect(page.getByRole("alert")).toContainText('missing "person"');
});

test("markup in the text never reaches the page as HTML", async ({ page }) => {
  await startFictional(page);
  const before = await previewMarkup(page);
  await page.getByLabel("Subtítulo").fill('<img src=x onerror="window.__xss=1"><b>hola</b>');
  await expect.poll(() => previewMarkup(page)).not.toBe(before);
  expect(await page.locator(".foja-page img, .foja-page b, .foja-page foreignObject").count()).toBe(0);
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
});
