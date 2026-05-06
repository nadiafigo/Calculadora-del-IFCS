const { test, expect } = require("@playwright/test");

test.describe("Form submission", () => {
  test("fills all fields, submits, persists to Supabase, redirects to results", async ({ page }) => {
    // Interceptar el INSERT para verificar que se manda con return=minimal y body válido
    let insertRequest = null;
    let insertResponseStatus = null;

    await page.route(/\/rest\/v1\/evaluaciones(\?|$)/, async (route, request) => {
      if (request.method() === "POST") {
        insertRequest = {
          url: request.url(),
          headers: request.headers(),
          body: request.postDataJSON()
        };
        // Simular respuesta exitosa de Supabase con return=minimal (status 201, body vacío)
        insertResponseStatus = 201;
        await route.fulfill({ status: 201, contentType: "application/json", body: "" });
      } else {
        await route.continue();
      }
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

    // ---- Submit ----
    await page.click("#VerResultado");

    // Toast should appear
    const toast = page.locator("#toast");
    await expect(toast).toHaveClass(/show/, { timeout: 5000 });

    // Should redirect to resultado.html
    await page.waitForURL(/resultado\.html\?total=/, { timeout: 10000 });

    // ---- VALIDACIONES DEL INSERT (regression de #3) ----
    expect(insertRequest, "INSERT a Supabase no se realizó").not.toBeNull();
    expect(insertResponseStatus).toBe(201);
    // El URL no debe llevar ?select= (eso disparaba el RETURNING que choca con RLS)
    expect(insertRequest.url).not.toMatch(/\?select=/);
    // El header Prefer debe ser return=minimal, no return=representation
    expect(insertRequest.headers["prefer"]).toBe("return=minimal");
    // El body debe tener los campos clave
    expect(insertRequest.body).toMatchObject({
      loc_pais: "México",
      loc_ciudad: "Morelia",
      loc_vialidad: "Periférico Independencia",
      fuente_nombre: "Test User",
      fuente_correo: "test@example.com"
    });
    expect(typeof insertRequest.body.total_ifcs).toBe("number");
    expect(typeof insertRequest.body.factibilidad).toBe("string");

    // ---- Results page checks ----
    const resultado = page.locator("#Resultado");
    await expect(resultado).toBeVisible();
    await page.waitForTimeout(2000);
    const text = await resultado.textContent();
    expect(text).toMatch(/\d+%/);

    const dxSection = page.locator(".dx-gral");
    await expect(dxSection).toBeVisible();
    const dxText = await dxSection.textContent();
    expect(dxText.length).toBeGreaterThan(50);

    await expect(page.locator("#btn-descargar-pdf")).toBeVisible();
  });

  test("submit shows error toast when Supabase returns 4xx", async ({ page }) => {
    await page.route(/\/rest\/v1\/evaluaciones(\?|$)/, async (route, request) => {
      if (request.method() === "POST") {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ message: "RLS violation simulated" })
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/index.html");
    // Llenado mínimo válido
    await page.fill("#LocPais", "México");
    await page.fill("#LocCiudad", "Morelia");
    await page.fill("#LocVia", "Test");
    await page.fill("#LocColonia", "Test");
    await page.fill("#LocRef", "Test");
    await page.fill("#LocX", "-101.2");
    await page.fill("#LocY", "19.7");
    await page.selectOption("#ViaCarriles", { index: 1 });
    await page.selectOption("#ViaDistCruce", { index: 1 });
    await page.selectOption("#ViaDistSemaf", { index: 1 });
    await page.selectOption("#ViaBarreras", { index: 1 });
    await page.selectOption("#ViaCamellones", { index: 1 });
    await page.selectOption("#ViaRevo", { value: "0" });
    await page.selectOption("#ViaVelPermi", { index: 1 });
    await page.selectOption("#ViaVelOper", { index: 1 });
    await page.selectOption("#EquipNum", { index: 1 });
    await page.selectOption("#EquipDist", { index: 1 });
    await page.selectOption("#EquipTipo", { index: 1 });
    await page.selectOption("#PteObstBanq", { index: 1 });
    await page.selectOption("#PteAnchoAcc", { index: 1 });
    await page.selectOption("#PteTipoAcc", { value: "4" });
    await page.selectOption("#PteNumEsc", { index: 1 });
    await page.selectOption("#PteAnchoPas", { index: 1 });
    await page.selectOption("#PteCubierta", { index: 1 });
    await page.selectOption("#PteIluminacion", { index: 1 });
    await page.selectOption("#PtePubli", { value: "0" });
    await page.fill("#FuenteNombre", "Test");
    await page.fill("#FuenteFecha", "2026-03-24");
    await page.fill("#FuenteOrg", "Test");
    await page.fill("#FuenteCorreo", "test@example.com");
    await page.check("#CalcForm input[type='checkbox']");

    await page.click("#VerResultado");

    const toast = page.locator("#toast");
    await expect(toast).toHaveClass(/show/, { timeout: 5000 });
    await expect(toast).toContainText(/error/i);

    // Aún redirige (comportamiento actual: usuario no pierde lo que llenó)
    await page.waitForURL(/resultado\.html\?total=/, { timeout: 10000 });
  });
});
