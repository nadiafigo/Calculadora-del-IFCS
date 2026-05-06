import { test, expect } from "@playwright/test";

test.describe("Rangos de factibilidad nuevos (0-30 / 31-60 / >60)", () => {

  test("antecedentes.html muestra los rangos nuevos en las tarjetas", async ({ page }) => {
    await page.goto("/antecedentes.html");
    const corto = page.locator(".factibilidad-card.factibilidad-corto .factibilidad-rango");
    const mediano = page.locator(".factibilidad-card.factibilidad-mediano .factibilidad-rango");
    const largo = page.locator(".factibilidad-card.factibilidad-largo .factibilidad-rango");
    await expect(corto).toHaveText("61 – 100");
    await expect(mediano).toHaveText("31 – 60");
    await expect(largo).toHaveText("0 – 30");
  });

  test("resultado.html con total=30 muestra LARGO PLAZO", async ({ page }) => {
    await page.goto("/html/resultado.html?total=30");
    await expect(page.locator("#TextoFactibilidad")).toContainText("LARGO PLAZO", { timeout: 5000 });
  });

  test("resultado.html con total=31 muestra MEDIANO PLAZO", async ({ page }) => {
    await page.goto("/html/resultado.html?total=31");
    await expect(page.locator("#TextoFactibilidad")).toContainText("MEDIANO PLAZO", { timeout: 5000 });
  });

  test("resultado.html con total=60 muestra MEDIANO PLAZO", async ({ page }) => {
    await page.goto("/html/resultado.html?total=60");
    await expect(page.locator("#TextoFactibilidad")).toContainText("MEDIANO PLAZO", { timeout: 5000 });
  });

  test("resultado.html con total=61 muestra CORTO PLAZO", async ({ page }) => {
    await page.goto("/html/resultado.html?total=61");
    await expect(page.locator("#TextoFactibilidad")).toContainText("CORTO PLAZO", { timeout: 5000 });
  });

  test("resultado.html con total=64 (Mujica/CU caso real) muestra CORTO PLAZO", async ({ page }) => {
    await page.goto("/html/resultado.html?total=64");
    await expect(page.locator("#TextoFactibilidad")).toContainText("CORTO PLAZO", { timeout: 5000 });
  });

});
