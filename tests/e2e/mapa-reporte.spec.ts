import { test, expect, Page } from "@playwright/test";

// Mapa (mapa.html): pide sólo columnas explícitas (nunca select=* ni el
// nombre/correo de quien evaluó), el popup enlaza al reporte permanente y los
// textos de la base no se interpretan como HTML.

const PAYLOAD = "<img src=x onerror=window.__xss=1>";
const TOKEN = "0d9c8b7a-6f5e-4d3c-9b2a-1f0e9d8c7b6a";

const FILAS = [
  {
    id: 7001,
    loc_y: "19.70",
    loc_x: "-101.20",
    loc_ciudad: "Morelia",
    loc_vialidad: "Av. Camelinas",
    loc_referencia: "Plaza Las Américas",
    factibilidad: "Mediano plazo",
    total_ifcs: 52,
    fuente_org: "Liga Peatonal",
    pte_long_cami: "100 a 149 metros",
    via_dist_cruce: "20 a 39 metros",
    pte_tipo_acc: "Escaleras",
    pte_obst_banq: "No",
    equip_tipo: "Educación",
    via_dist_semaf: "100 a 249 metros",
    created_at: "2026-05-01T00:00:00Z",
    status_retiro: null,
    fecha_retiro: null,
    public_token: TOKEN,
  },
  {
    id: 7002,
    loc_y: "32.51",
    loc_x: "-117.04",
    loc_ciudad: PAYLOAD,
    loc_vialidad: PAYLOAD,
    loc_referencia: PAYLOAD,
    factibilidad: "Largo plazo",
    total_ifcs: 20,
    fuente_org: PAYLOAD,
    pte_long_cami: null,
    via_dist_cruce: null,
    pte_tipo_acc: "Rampa",
    pte_obst_banq: "Sí",
    equip_tipo: "Salud",
    via_dist_semaf: "1000 metros o más",
    created_at: "2026-06-01T00:00:00Z",
    status_retiro: "Retirado",
    fecha_retiro: PAYLOAD,
    public_token: null,
  },
];

async function stubMapa(page: Page) {
  const urls: string[] = [];
  await page.route(/\/rest\/v1\/evaluaciones\?select=/, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    urls.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(FILAS),
    });
  });
  return urls;
}

test.describe("Mapa → reporte permanente", () => {

  test("pide columnas explícitas, sin select=* ni datos personales", async ({ page }) => {
    const urls = await stubMapa(page);
    await page.goto("/html/mapa.html");
    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 10000 });
    await expect.poll(() => urls.length).toBeGreaterThan(0);

    const select = new URL(urls[0]).searchParams.get("select") || "";
    expect(select).not.toBe("*");
    const cols = select.split(",");
    expect(cols).toContain("public_token");
    expect(cols).toContain("loc_x");
    expect(cols).toContain("status_retiro");
    expect(cols).not.toContain("fuente_correo");
    expect(cols).not.toContain("fuente_nombre");
    expect(cols).not.toContain("*");
  });

  test("el popup lleva «Ver reporte →» a resultado.html?r=<public_token>", async ({ page }) => {
    await stubMapa(page);
    await page.goto("/html/mapa.html?id=7001");
    const popup = page.locator(".leaflet-popup-content");
    await expect(popup).toBeVisible({ timeout: 10000 });

    const link = popup.locator("a.popup-reporte");
    await expect(link).toBeVisible();
    await expect(link).toContainText("Ver reporte");
    await expect(link).toHaveAttribute("href", `./resultado.html?r=${TOKEN}`);

    await link.click();
    await expect(page).toHaveURL(new RegExp(`/html/resultado\\.html\\?r=${TOKEN}$`));
  });

  test("sin public_token no hay link y los textos se ven literales", async ({ page }) => {
    await stubMapa(page);
    await page.goto("/html/mapa.html?id=7002");
    const popup = page.locator(".leaflet-popup-content");
    await expect(popup).toBeVisible({ timeout: 10000 });

    await expect(popup.locator("a.popup-reporte")).toHaveCount(0);
    await expect(popup.locator(".popup-title")).toHaveText(PAYLOAD);
    await expect(popup.locator(".popup-retirado-valor")).toHaveText(PAYLOAD);
    await expect(popup).toContainText(`Org: ${PAYLOAD}`);

    await page.waitForTimeout(300);
    expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
    expect(await page.locator('img[src="x"]').count()).toBe(0);

    // El filtro de ciudad muestra la opción como texto (archivo.js le cambia
    // mayúsculas al unificar ciudades, por eso se busca sin distinguirlas)
    await expect(page.locator("#filtro-ciudad option", { hasText: "onerror" })).toHaveCount(1);
  });
});
