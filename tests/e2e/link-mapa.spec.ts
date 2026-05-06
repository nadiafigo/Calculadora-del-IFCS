import { test, expect, Page } from "@playwright/test";

// Stubbed evaluation used by the mapa.html tests.
const SEED = {
  id: 424242,
  loc_y: "19.42",
  loc_x: "-99.13",
  loc_ciudad: "Ciudad de México",
  loc_vialidad: "Vialidad Demo",
  loc_referencia: "Plaza Demo",
  loc_pais: "México",
  factibilidad: "Corto plazo",
  total_ifcs: 80,
  pte_long_cami: "100 a 149 metros",
  via_dist_cruce: "10 metros o menos",
  pte_tipo_acc: "Escaleras",
  pte_obst_banq: "No",
  equip_tipo: "Educación",
  via_dist_semaf: "0 a 99 metros",
  fuente_org: "Test Org",
  created_at: "2026-01-01T00:00:00Z",
};

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

test.describe("Form ↔ Mapa deep-link", () => {

  test("submit del form deja last_evaluation_id en sessionStorage", async ({ page }) => {
    // Stub Supabase POST: form.js usa Prefer: return=minimal, así que la
    // respuesta es 201 con body vacío. last_evaluation_id queda como el
    // UUID fallback generado client-side por crypto.randomUUID().
    await page.route(/\/rest\/v1\/evaluaciones/, async (route) => {
      const req = route.request();
      if (req.method() === "POST") {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          headers: { "Access-Control-Allow-Origin": "*" },
          body: "",
        });
        return;
      }
      await route.continue();
    });

    await page.goto("/index.html");

    // ---- Section 1: Location ----
    await page.fill("#LocPais", "México");
    await page.fill("#LocCiudad", "Morelia");
    await page.fill("#LocVia", "Periférico Independencia");
    await page.fill("#LocColonia", "Camelinas");
    await page.fill("#LocRef", "Mercado de Abastos");
    await page.fill("#LocX", "-101.221780");
    await page.fill("#LocY", "19.676883");

    // ---- Section 2: Vialidad ----
    await page.selectOption("#ViaCarriles", { index: 1 });
    await page.selectOption("#ViaDistCruce", { index: 1 });
    await page.selectOption("#ViaDistSemaf", { index: 1 });
    await page.selectOption("#ViaBarreras", { index: 1 });
    await page.selectOption("#ViaCamellones", { index: 1 });
    await page.selectOption("#ViaRevo", { value: "0" });
    await page.selectOption("#ViaVelPermi", { index: 1 });
    await page.selectOption("#ViaVelOper", { index: 1 });

    // ---- Section 3: Equipamientos ----
    await page.selectOption("#EquipNum", { index: 1 });
    await page.selectOption("#EquipDist", { index: 1 });
    await page.selectOption("#EquipTipo", { index: 1 });

    // ---- Section 4: Puente ----
    await page.selectOption("#PteObstBanq", { index: 1 });
    await page.selectOption("#PteAnchoAcc", { index: 1 });
    await page.selectOption("#PteTipoAcc", { value: "4" });
    await page.selectOption("#PteNumEsc", { index: 1 });
    await page.selectOption("#PteAnchoPas", { index: 1 });
    await page.selectOption("#PteCubierta", { index: 1 });
    await page.selectOption("#PteIluminacion", { index: 1 });
    await page.selectOption("#PtePubli", { value: "0" });

    // ---- Section 5: Fuente ----
    await page.fill("#FuenteNombre", "Test User");
    await page.fill("#FuenteFecha", "2026-03-24");
    await page.fill("#FuenteOrg", "Test Org");
    await page.fill("#FuenteCorreo", "test@example.com");
    await page.check("#CalcForm input[type='checkbox']");

    await page.click("#VerResultado");
    await page.waitForURL(/resultado\.html\?total=/, { timeout: 10000 });

    const id = await page.evaluate(() => sessionStorage.getItem("last_evaluation_id"));
    // UUID v4 fallback (crypto.randomUUID) o local-* fallback si crypto no disponible.
    expect(id).toMatch(/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|local-\d+-[a-z0-9]+)$/);
  });

  test("mapa.html?id=<seed> abre popup del marker correspondiente", async ({ page }) => {
    await stubMapaList(page, [SEED]);

    await page.goto(`/html/mapa.html?id=${SEED.id}`);
    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 10000 });

    const popup = page.locator(".leaflet-popup-content");
    await expect(popup).toBeVisible({ timeout: 5000 });
    await expect(popup).toContainText("Vialidad Demo");
  });

  test("mapa.html?id=<inexistente> muestra toast informativo", async ({ page }) => {
    await stubMapaList(page, [SEED]);

    await page.goto("/html/mapa.html?id=ghost-id-no-existe");
    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 10000 });

    const toast = page.locator("#mapa-toast");
    await expect(toast).toBeVisible({ timeout: 5000 });
    await expect(toast).toHaveClass(/show/);
    await expect(toast).toContainText("Tu evaluación se guardó correctamente");
    await expect(toast).toContainText("Aparecerá en el mapa");
    await expect(toast).toContainText("Liga Peatonal");
  });

  test("toast del mapa: botón cerrar oculta el mensaje", async ({ page }) => {
    await stubMapaList(page, [SEED]);

    await page.goto("/html/mapa.html?id=ghost-id-no-existe");
    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 10000 });

    const toast = page.locator("#mapa-toast");
    await expect(toast).toHaveClass(/show/, { timeout: 5000 });

    await page.locator(".mapa-toast__close").click();
    await expect(toast).not.toHaveClass(/show/, { timeout: 1000 });
  });

  test("CTA 'Ver mi evaluación en el mapa' en resultado.html navega con el id", async ({ page }) => {
    await page.goto("/html/resultado.html?total=72");
    await page.evaluate(() => sessionStorage.setItem("last_evaluation_id", "12345"));

    const cta = page.locator("#cta-ver-mapa");
    await expect(cta).toBeVisible();

    // Stub mapa list so the navigation does not depend on real Supabase.
    await stubMapaList(page, []);

    await cta.click();
    await page.waitForURL(/mapa\.html\?id=12345/, { timeout: 10000 });
    expect(page.url()).toMatch(/mapa\.html\?id=12345$/);
  });

  test("link 'mapa' del checkbox de consentimiento abre mapa.html en nueva pestaña", async ({ page, context }) => {
    await page.goto("/index.html");

    const link = page.locator("#link-mapa-consent");
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "html/mapa.html");
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);

    // Stub map list so the new tab does not hang on real Supabase.
    await context.route(/\/rest\/v1\/evaluaciones\?select=\*/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: "[]",
      });
    });

    const checkbox = page.locator("#CalcForm input[type='checkbox']");
    const wasChecked = await checkbox.isChecked();

    const newPagePromise = context.waitForEvent("page", { timeout: 10000 });
    await link.click();
    const newPage = await newPagePromise;
    await newPage.waitForLoadState("domcontentloaded");
    expect(newPage.url()).toMatch(/\/html\/mapa\.html$/);

    // Click on the link must not toggle the checkbox in the original tab.
    expect(await checkbox.isChecked()).toBe(wasChecked);

    await newPage.close();
  });
});
