const { test, expect } = require("@playwright/test");

test.describe("Form submission", () => {
  test("fills all fields, submits, shows toast, redirects to results", async ({ page }) => {
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
    await page.selectOption("#ViaRevo", { value: "0" }); // No
    await page.selectOption("#ViaVelPermi", { index: 1 });
    await page.selectOption("#ViaVelOper", { index: 1 });

    // ---- Section 3: Equipamientos ----
    await page.selectOption("#EquipNum", { index: 1 });
    await page.selectOption("#EquipDist", { index: 1 });
    await page.selectOption("#EquipTipo", { index: 1 });

    // ---- Section 4: Puente ----
    await page.selectOption("#PteObstBanq", { index: 1 });
    await page.selectOption("#PteAnchoAcc", { index: 1 });
    await page.selectOption("#PteTipoAcc", { value: "4" }); // Escaleras
    // PteNumEsc should appear
    await page.selectOption("#PteNumEsc", { index: 1 });
    await page.selectOption("#PteAnchoPas", { index: 1 });
    await page.selectOption("#PteCubierta", { index: 1 });
    await page.selectOption("#PteIluminacion", { index: 1 });
    await page.selectOption("#PtePubli", { value: "0" }); // No

    // ---- Section 5: Fuente ----
    await page.fill("#FuenteNombre", "Test User");
    await page.fill("#FuenteFecha", "2026-03-24");
    await page.fill("#FuenteOrg", "Test Org");
    await page.fill("#FuenteCorreo", "test@example.com");
    await page.check("#CalcForm input[type='checkbox']");

    // ---- Submit ----
    await page.click("#VerResultado");

    // Toast should appear
    const toast = page.locator("#toast");
    await expect(toast).toHaveClass(/show/, { timeout: 5000 });

    // Should redirect to resultado.html
    await page.waitForURL(/resultado\.html\?total=/, { timeout: 10000 });

    // ---- Results page checks ----
    const resultado = page.locator("#Resultado");
    await expect(resultado).toBeVisible();
    // Wait for counter animation to finish
    await page.waitForTimeout(2000);
    const text = await resultado.textContent();
    expect(text).toMatch(/\d+%/);

    // Diagnostic text should exist
    const dxSection = page.locator(".dx-gral");
    await expect(dxSection).toBeVisible();
    const dxText = await dxSection.textContent();
    expect(dxText.length).toBeGreaterThan(50);

    // PDF button exists
    await expect(page.locator("#btn-descargar-pdf")).toBeVisible();
  });
});
