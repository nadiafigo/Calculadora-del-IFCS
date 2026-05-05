import { test, expect, Page } from "@playwright/test";

// Coords se eligen separadas para evitar clustering en el zoom inicial de
// Leaflet (México-wide, zoom 5). Tijuana / Cancún / Morelia están a cientos
// de km uno del otro y no caen dentro del maxClusterRadius por default.
const SEEDS = [
  {
    id: 1001,
    loc_y: "19.70",
    loc_x: "-101.20",
    loc_ciudad: "Morelia",
    loc_vialidad: "Av. Héroes de Nocupétaro",
    loc_referencia: "Cruce con Calzada La Huerta",
    factibilidad: "Corto plazo",
    total_ifcs: 80,
    fuente_org: "Bicivilízate",
    pte_long_cami: "100 a 149 metros",
    via_dist_cruce: "10 metros o menos",
    pte_tipo_acc: "Escaleras",
    pte_obst_banq: "No",
    equip_tipo: "Educación",
    via_dist_semaf: "0 a 99 metros",
    created_at: "2019-05-01T00:00:00Z",
    status_retiro: "Retirado",
    fecha_retiro: "Mayo, 2019",
  },
  {
    id: 1002,
    loc_y: "32.51",
    loc_x: "-117.04",
    loc_ciudad: "Tijuana",
    loc_vialidad: "Bulevar Agua Caliente",
    loc_referencia: "Cerca del aeropuerto",
    factibilidad: "Mediano plazo",
    total_ifcs: 45,
    fuente_org: "Bicivilízate",
    pte_long_cami: "150 a 199 metros",
    via_dist_cruce: "20 a 39 metros",
    pte_tipo_acc: "Rampa",
    pte_obst_banq: "Sí",
    equip_tipo: "Abasto",
    via_dist_semaf: "100 a 249 metros",
    created_at: "2024-01-15T00:00:00Z",
    status_retiro: "Pendiente",
    fecha_retiro: null,
  },
  {
    id: 1003,
    loc_y: "21.16",
    loc_x: "-86.85",
    loc_ciudad: "Cancún",
    loc_vialidad: "Av. Tulum",
    loc_referencia: "Cruce con Cobá",
    factibilidad: "Largo plazo",
    total_ifcs: 15,
    fuente_org: "Liga Peatonal",
    pte_long_cami: "200 o más",
    via_dist_cruce: "70 metros o más",
    pte_tipo_acc: "Escaleras",
    pte_obst_banq: "No hay banqueta",
    equip_tipo: "Salud",
    via_dist_semaf: "1000 metros o más",
    created_at: "2024-06-01T00:00:00Z",
    status_retiro: null,
    fecha_retiro: null,
  },
];

function stubMapaList(page: Page, rows: unknown[]) {
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

async function visibleMarkerCount(page: Page) {
  // Markers de Leaflet que están en el DOM (no en cluster colapsado).
  const standard = await page.locator(".leaflet-marker-icon:not(.marker-cluster):not(.marker-retirado)").count();
  const retirados = await page.locator(".marker-retirado").count();
  return standard + retirados;
}

test.describe("Status de retiro de puentes", () => {

  test("marker retirado: clase y aria-label correctos", async ({ page }) => {
    await stubMapaList(page, SEEDS);
    await page.goto("/html/mapa.html");
    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 10000 });

    const retiradoMarker = page.locator(".marker-retirado").first();
    await expect(retiradoMarker).toBeVisible();

    const inner = retiradoMarker.locator(".marker-retirado-inner");
    await expect(inner).toHaveAttribute("role", "img");
    await expect(inner).toHaveAttribute("aria-label", /sustituido/i);
    await expect(inner).toHaveAttribute("aria-label", /Mayo, 2019/);
  });

  test("popup del retirado: banner arriba + fecha de sustitución al fondo", async ({ page }) => {
    await stubMapaList(page, SEEDS);
    await page.goto("/html/mapa.html?id=1001");
    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 10000 });

    const popup = page.locator(".leaflet-popup-content");
    await expect(popup).toBeVisible({ timeout: 10000 });

    const banner = popup.locator(".popup-retirado-banner");
    await expect(banner).toBeVisible();
    await expect(banner).toHaveAttribute("role", "status");
    await expect(banner).toContainText("Puente sustituido");

    const fechaBlock = popup.locator(".popup-retirado-fecha");
    await expect(fechaBlock).toBeVisible();
    await expect(fechaBlock).toContainText("Fecha de sustitución");
    await expect(fechaBlock.locator(".popup-retirado-valor")).toHaveText("Mayo, 2019");

    // Banner debe estar antes del título en el orden visual
    const bannerTop = await banner.evaluate(el => el.getBoundingClientRect().top);
    const titleTop  = await popup.locator(".popup-title").evaluate(el => el.getBoundingClientRect().top);
    expect(bannerTop).toBeLessThan(titleTop);
  });

  test("filtro 'Sustituidos': solo muestra los retirados", async ({ page }) => {
    await stubMapaList(page, SEEDS);
    await page.goto("/html/mapa.html");
    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(300);

    await page.locator('input[name="filter-status"][value="retirado"]').check();
    await page.waitForTimeout(300);

    expect(await visibleMarkerCount(page)).toBe(1);
    await expect(page.locator(".marker-retirado")).toHaveCount(1);
  });

  test("filtro 'Pendientes': muestra los no-retirados (Pendiente + NULL)", async ({ page }) => {
    await stubMapaList(page, SEEDS);
    await page.goto("/html/mapa.html");
    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(300);

    await page.locator('input[name="filter-status"][value="pendiente"]').check();
    await page.waitForTimeout(300);

    // 2 pendientes (uno con status="Pendiente", otro con NULL).
    expect(await visibleMarkerCount(page)).toBe(2);
    await expect(page.locator(".marker-retirado")).toHaveCount(0);
  });

  test("filtro 'Todos': muestra los 3", async ({ page }) => {
    await stubMapaList(page, SEEDS);
    await page.goto("/html/mapa.html");
    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(300);

    expect(await visibleMarkerCount(page)).toBe(3);
  });

  test("KPI count: muestra el total de retirados (no se mueve con filtros)", async ({ page }) => {
    await stubMapaList(page, SEEDS);
    await page.goto("/html/mapa.html");
    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 10000 });

    const kpi = page.locator("#kpi-retirados-count");
    await expect(kpi).toBeVisible();
    await expect(kpi).toHaveText("1");

    // Cambiar filtros no afecta el KPI (es total absoluto, no mostrados).
    await page.locator('input[name="filter-status"][value="pendiente"]').check();
    await page.waitForTimeout(200);
    await expect(kpi).toHaveText("1");
  });

  test("accesibilidad: marker retirado es focusable y panel filtro está en fieldset", async ({ page }) => {
    await stubMapaList(page, SEEDS);
    await page.goto("/html/mapa.html");
    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(300);

    const inner = page.locator(".marker-retirado-inner").first();
    const tabindex = await inner.getAttribute("tabindex");
    expect(tabindex).toBe("0");

    // Filtro envuelto en fieldset semántico.
    const fieldset = page.locator("fieldset.filtro-status-retiro");
    await expect(fieldset).toBeVisible();
    await expect(fieldset.locator("legend")).toHaveText("Status de retiro");
    await expect(fieldset.locator('[role="radiogroup"]')).toBeVisible();
  });
});
