import { test, expect, Page } from "@playwright/test";

function stubAnalyticsList(page: Page, rows: unknown[]) {
  return page.route(/\/rest\/v1\/evaluaciones\?select=\*/, async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify(rows),
      });
    } else {
      await route.continue();
    }
  });
}

const baseRow = {
  id: 1,
  loc_pais: "México",
  loc_ciudad: "Morelia",
  loc_vialidad: "Test Vía",
  loc_x: "-101.2",
  loc_y: "19.7",
  total_ifcs: 50,
  factibilidad: "Mediano plazo",
  fuente_nombre: "Test",
  fuente_org: "Test",
  created_at: "2026-01-01T00:00:00Z",
  aprobado_mapa: true,
  pte_pendiente: null,
  pte_dist_desc: null,
  pte_tipo_acc: null
};

test.describe("KPI 'Puentes con rampas inaccesibles'", () => {

  test("label y id correctos en analytics.html", async ({ page }) => {
    // analytics.js muestra empty-state cuando no hay filas (sin KPIs);
    // seedeamos 1 fila para que el dashboard se renderice.
    await stubAnalyticsList(page, [{ ...baseRow }]);
    await page.goto("/html/analytics.html");

    const kpi = page.locator("#kpi-inaccesibles");
    await expect(kpi).toBeAttached();

    const card = kpi.locator("xpath=ancestor::div[contains(@class,'kpi-card')]");
    await expect(card.locator(".kpi-label")).toHaveText("Puentes con rampas inaccesibles");
  });

  test("count = 0 cuando ningún puente cae en rangos malos", async ({ page }) => {
    await stubAnalyticsList(page, [
      { ...baseRow, id: 1, pte_pendiente: "6% o menos", pte_dist_desc: "6 metros o menos" },
      { ...baseRow, id: 2, pte_pendiente: "6% o menos", pte_dist_desc: "6 metros o menos" },
    ]);
    await page.goto("/html/analytics.html");
    await expect(page.locator("#kpi-inaccesibles")).toHaveText("0", { timeout: 5000 });
  });

  test("cuenta puentes con pendiente >6% (OR)", async ({ page }) => {
    await stubAnalyticsList(page, [
      { ...baseRow, id: 1, pte_pendiente: "6% o menos",  pte_dist_desc: "6 metros o menos" },   // OK
      { ...baseRow, id: 2, pte_pendiente: "6.1% a 8%",   pte_dist_desc: "6 metros o menos" },   // mala pendiente
      { ...baseRow, id: 3, pte_pendiente: "8.1% o más",  pte_dist_desc: "6 metros o menos" },   // mala pendiente
    ]);
    await page.goto("/html/analytics.html");
    await expect(page.locator("#kpi-inaccesibles")).toHaveText("2", { timeout: 5000 });
  });

  test("cuenta puentes con descansos >6m (OR)", async ({ page }) => {
    await stubAnalyticsList(page, [
      { ...baseRow, id: 1, pte_pendiente: "6% o menos", pte_dist_desc: "6 metros o menos" },    // OK
      { ...baseRow, id: 2, pte_pendiente: "6% o menos", pte_dist_desc: "7 a 14 metros" },       // mal descanso
      { ...baseRow, id: 3, pte_pendiente: "6% o menos", pte_dist_desc: "15 metros o más" },     // mal descanso
    ]);
    await page.goto("/html/analytics.html");
    await expect(page.locator("#kpi-inaccesibles")).toHaveText("2", { timeout: 5000 });
  });

  test("NULL en ambos campos → no cuenta", async ({ page }) => {
    await stubAnalyticsList(page, [
      { ...baseRow, id: 1, pte_pendiente: null,         pte_dist_desc: null },                  // sin data → no cuenta
      { ...baseRow, id: 2, pte_pendiente: "6% o menos", pte_dist_desc: null },                  // un OK + un null → no cuenta
      { ...baseRow, id: 3, pte_pendiente: null,         pte_dist_desc: "6 metros o menos" },    // un null + un OK → no cuenta
      { ...baseRow, id: 4, pte_pendiente: null,         pte_dist_desc: "7 a 14 metros" },       // un null + uno malo → SÍ cuenta
      { ...baseRow, id: 5, pte_pendiente: "8.1% o más", pte_dist_desc: null },                  // uno malo + un null → SÍ cuenta
    ]);
    await page.goto("/html/analytics.html");
    await expect(page.locator("#kpi-inaccesibles")).toHaveText("2", { timeout: 5000 });
  });

  test("OR — un puente con ambos campos malos solo cuenta una vez", async ({ page }) => {
    await stubAnalyticsList(page, [
      { ...baseRow, id: 1, pte_pendiente: "8.1% o más", pte_dist_desc: "15 metros o más" },     // ambos malos → cuenta 1 vez
      { ...baseRow, id: 2, pte_pendiente: "6.1% a 8%",  pte_dist_desc: "6 metros o menos" },    // solo pendiente → cuenta 1 vez
    ]);
    await page.goto("/html/analytics.html");
    await expect(page.locator("#kpi-inaccesibles")).toHaveText("2", { timeout: 5000 });
  });

  test("cuenta strings legacy de la BD histórica", async ({ page }) => {
    await stubAnalyticsList(page, [
      { ...baseRow, id: 1, pte_pendiente: "Del 6% al 8%",      pte_dist_desc: null },                   // legacy mala pendiente
      { ...baseRow, id: 2, pte_pendiente: "Mayor al 8%",       pte_dist_desc: null },                   // legacy peor pendiente
      { ...baseRow, id: 3, pte_pendiente: null,                pte_dist_desc: "25 metros o más" },      // legacy mal descanso
      { ...baseRow, id: 4, pte_pendiente: null,                pte_dist_desc: "Menor a 25 metros" },    // legacy AMBIGUO → no cuenta
      { ...baseRow, id: 5, pte_pendiente: "Del 6% al 8%",      pte_dist_desc: "Menor a 25 metros" },    // pendiente mala + descanso ambiguo → cuenta por pendiente
    ]);
    await page.goto("/html/analytics.html");
    await expect(page.locator("#kpi-inaccesibles")).toHaveText("4", { timeout: 5000 });
  });

});
