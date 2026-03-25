const { test, expect } = require("@playwright/test");

test.describe("Smoke tests — all pages load", () => {

  test("index.html loads with title, navbar, and form", async ({ page }) => {
    await page.goto("/index.html");

    await expect(page).toHaveTitle(/Factibilidad/);
    await expect(page.locator(".navbar")).toBeVisible();
    await expect(page.locator("#CalcForm")).toBeVisible();
    await expect(page.locator("#VerResultado")).toBeVisible();
  });

  test("resultado.html shows score and factibilidad", async ({ page }) => {
    await page.goto("/html/resultado.html?total=72");

    // Wait for counter animation
    await page.waitForTimeout(2000);

    const resultado = page.locator("#Resultado");
    await expect(resultado).toBeVisible();
    const text = await resultado.textContent();
    expect(text).toBe("72%");

    const fact = page.locator("#TextoFactibilidad");
    await expect(fact).toContainText("CORTO PLAZO");
  });

  test("resultado.html shows correct factibilidad for mediano plazo", async ({ page }) => {
    await page.goto("/html/resultado.html?total=45");
    await page.waitForTimeout(2000);

    await expect(page.locator("#TextoFactibilidad")).toContainText("MEDIANO PLAZO");
  });

  test("resultado.html shows correct factibilidad for largo plazo", async ({ page }) => {
    await page.goto("/html/resultado.html?total=15");
    await page.waitForTimeout(2000);

    await expect(page.locator("#TextoFactibilidad")).toContainText("LARGO PLAZO");
  });

  test("mapa.html loads with Leaflet map", async ({ page }) => {
    await page.goto("/html/mapa.html");

    await expect(page.locator("#mapa")).toBeVisible();
    // Leaflet creates a container with class leaflet-container
    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 10000 });
    // Filter panel should exist
    await expect(page.locator("#filtros-panel")).toBeVisible();
  });

  test("analytics.html loads with KPI cards", async ({ page }) => {
    await page.goto("/html/analytics.html");

    await expect(page.locator("#kpi-total")).toBeVisible();
    await expect(page.locator("#kpi-promedio")).toBeVisible();
    await expect(page.locator("#kpi-corto")).toBeVisible();
    await expect(page.locator("#kpi-ciudades")).toBeVisible();
  });
});
