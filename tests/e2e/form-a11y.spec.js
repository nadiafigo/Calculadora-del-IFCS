const { test, expect } = require("@playwright/test");

// Validación y accesibilidad del formulario. Todos los POST se interceptan (no se insertan filas).

const RE_EVAL = /\/rest\/v1\/evaluaciones(\?|$)/;
const CIUDADES = [{ loc_ciudad: "MORELIA" }, { loc_ciudad: "Morelia" }, { loc_ciudad: "Morelia" }, { loc_ciudad: "Mérida" }, { loc_ciudad: "merida" }];

/** POST → `alPost`; GET de ciudades → lista fija; el resto de GET → []. */
async function stubSupabase(page, alPost) {
  await page.route(RE_EVAL, async (route, request) => {
    if (request.method() === "POST") return alPost(route, request);
    const body = /select=loc_ciudad&/.test(request.url()) ? CIUDADES : [];
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
}
const ok201 = route => route.fulfill({ status: 201, contentType: "application/json", body: "" });

async function llenarTodo(page, v = {}) {
  await page.fill("#LocPais", v.pais ?? "México");
  await page.fill("#LocCiudad", v.ciudad ?? "Morelia");
  await page.fill("#LocVia", v.via ?? "Periférico Independencia");
  await page.fill("#LocColonia", v.colonia ?? "Camelinas");
  await page.fill("#LocRef", "Mercado de Abastos");
  await page.fill("#LocX", v.x ?? "-101.221780");
  await page.fill("#LocY", v.y ?? "19.676883");
  for (const id of ["ViaCarriles", "ViaDistCruce", "ViaDistSemaf", "ViaBarreras", "ViaCamellones", "ViaVelPermi",
    "EquipNum", "EquipDist", "EquipTipo", "PteObstBanq", "PteAnchoAcc", "PteAnchoPas", "PteCubierta", "PteIluminacion"]) {
    await page.selectOption(`#${id}`, { index: 1 });
  }
  await page.selectOption("#ViaRevo", { value: "0" });
  await page.selectOption("#PteTipoAcc", { value: v.tipoAcc ?? "4" });
  if ((v.tipoAcc ?? "4") === "4") await page.selectOption("#PteNumEsc", { index: 1 });
  await page.selectOption("#PtePubli", { value: "0" });
  await page.fill("#FuenteNombre", "Test User");
  await page.fill("#FuenteFecha", "2026-03-24");
  await page.fill("#FuenteOrg", "Test Org");
  await page.fill("#FuenteCorreo", v.correo ?? "test@example.com");
  await page.check("#Consentimiento");
}

test.describe("Formulario: etiquetas", () => {
  test("los 11 campos de los pasos 1 y 5 y el consentimiento tienen <label for>", async ({ page }) => {
    await stubSupabase(page, ok201);
    await page.goto("/index.html");
    const ids = ["LocPais", "LocCiudad", "LocVia", "LocColonia", "LocRef", "LocX", "LocY",
      "FuenteNombre", "FuenteFecha", "FuenteOrg", "FuenteCorreo", "Consentimiento"];
    for (const id of ids) {
      const n = await page.$eval(`#${id}`, el => (el.labels ? el.labels.length : 0));
      expect(n, `#${id} sin label`).toBe(1);
    }
    await expect(page.locator("#CalcForm p.input-desc")).toHaveCount(0);
    await expect(page.getByLabel("País:")).toHaveAttribute("id", "LocPais");
    await expect(page.getByLabel("Correo electrónico:")).toHaveAttribute("id", "FuenteCorreo");
  });

  test("el hint del correo dice la verdad", async ({ page }) => {
    await stubSupabase(page, ok201);
    await page.goto("/index.html");
    const hint = page.locator("#hint-correo");
    await expect(hint).toContainText("Tu correo no se publica: sólo lo ve el equipo de la Liga.");
    await expect(page.locator("#CalcForm")).not.toContainText("Solo tú los ves");
    await expect(page.locator("#FuenteCorreo")).toHaveAttribute("aria-describedby", "hint-correo");
  });
});

test.describe("Formulario: errores accesibles", () => {
  test("al enviar vacío: foco en el primer campo, aria-invalid, aria-describedby y «Faltan N campos»", async ({ page }) => {
    await stubSupabase(page, ok201);
    await page.goto("/index.html");
    await page.click("#VerResultado");

    await expect(page.locator("#LocPais")).toBeFocused();
    await expect(page.locator("#LocPais")).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("#LocPais")).toHaveAttribute("aria-describedby", "err-LocPais");
    await expect(page.locator("#err-LocPais")).toHaveText("Este campo es obligatorio");
    // 7 + 7 + 3 + 7 + 5 obligatorios visibles con el formulario vacío
    await expect(page.locator("#form-resumen")).toHaveText("Faltan 29 campos.");
    await expect(page.locator("#form-resumen")).toHaveAttribute("aria-live", "assertive");
    // El correo conserva su hint en aria-describedby junto al error
    await expect(page.locator("#FuenteCorreo")).toHaveAttribute("aria-describedby", "hint-correo err-FuenteCorreo");

    await page.fill("#LocPais", "México");
    await expect(page.locator("#LocPais")).not.toHaveAttribute("aria-invalid", /.*/);
    await expect(page.locator("#LocPais")).not.toHaveAttribute("aria-describedby", /.*/);
  });

  test("correo con formato inválido no se envía", async ({ page }) => {
    let posts = 0;
    await stubSupabase(page, route => { posts++; return ok201(route); });
    await page.goto("/index.html");
    await llenarTodo(page, { correo: "test@example" });
    await page.click("#VerResultado");
    await expect(page.locator("#FuenteCorreo")).toBeFocused();
    await expect(page.locator("#err-FuenteCorreo")).toContainText("correo");
    await expect(page.locator("#form-resumen")).toHaveText("Hay 1 campo por corregir.");
    await page.waitForTimeout(500);
    expect(posts).toBe(0);
    await expect(page).toHaveURL(/index\.html/);
  });

  test("coordenadas: número y rango; fuera de México sólo avisa", async ({ page }) => {
    await stubSupabase(page, ok201);
    await page.goto("/index.html");
    await llenarTodo(page, { x: "abc", y: "190" });
    await page.click("#VerResultado");
    await expect(page.locator("#err-LocX")).toContainText("Escribe sólo el número");
    await expect(page.locator("#err-LocY")).toContainText("La latitud (Y) va de −90 a 90");
    await expect(page.locator("#form-resumen")).toHaveText("Hay 2 campos por corregir.");

    // Madrid: válidas pero fuera de México → aviso que no bloquea
    await page.fill("#LocX", "-3.7038");
    await page.fill("#LocY", "40.4168");
    await page.locator("#LocY").blur();
    await expect(page.locator("#aviso-coords")).toBeVisible();
    await expect(page.locator("#aviso-coords")).toContainText("fuera de México");
    await expect(page.locator("#LocY")).toHaveAttribute("aria-describedby", /aviso-coords/);
    await page.click("#VerResultado");
    await page.waitForURL(/resultado\.html\?total=/, { timeout: 10000 });
  });

  test("coordenadas fuera de México con país distinto no avisan", async ({ page }) => {
    await stubSupabase(page, ok201);
    await page.goto("/index.html");
    await page.fill("#LocPais", "España");
    await page.fill("#LocX", "-3.7038");
    await page.fill("#LocY", "40.4168");
    await page.locator("#LocY").blur();
    await expect(page.locator("#aviso-coords")).toHaveCount(0);
  });

  test("los condicionales visibles son obligatorios; los ocultos no", async ({ page }) => {
    let posts = 0;
    await stubSupabase(page, route => { posts++; return ok201(route); });
    await page.goto("/index.html");
    await llenarTodo(page, { tipoAcc: "2" }); // Rampa: abre pendiente, descansos y longitud
    await page.click("#VerResultado");
    for (const id of ["PteLongCami", "PtePendiente", "PteDistDesc"]) {
      await expect(page.locator(`#${id}`)).toHaveAttribute("aria-invalid", "true");
    }
    // Ocultos (ViaRevo = No, PtePubli = No, sin escaleras) no se marcan
    for (const id of ["ViaRevoTipo", "PteNumEsc", "PtePubliVisib"]) {
      await expect(page.locator(`#${id}`)).not.toHaveAttribute("aria-invalid", /.*/);
    }
    await expect(page.locator("#form-resumen")).toHaveText("Faltan 3 campos.");
    expect(posts).toBe(0);

    // Al cambiar a Escaleras se ocultan y sus errores desaparecen
    await page.selectOption("#PteTipoAcc", { value: "4" });
    await expect(page.locator("#err-PtePendiente")).toHaveCount(0);
  });
});

test.describe("Formulario: limpieza al guardar y ciudades", () => {
  test("trim, mayúscula inicial y ciudad unificada con el archivo", async ({ page }) => {
    let body = null;
    await stubSupabase(page, (route, request) => { body = request.postDataJSON(); return ok201(route); });
    await page.goto("/index.html");

    // datalist: Morelia y Mérida una sola vez cada una
    await expect(page.locator("#ciudades-lista option")).toHaveCount(2);
    const opciones = await page.$$eval("#ciudades-lista option", os => os.map(o => o.value));
    expect(opciones).toEqual(["Mérida", "Morelia"]);

    await llenarTodo(page, { ciudad: "  merida ", colonia: "camelinas", via: "  periférico   independencia  ", correo: " test@example.com " });
    await page.fill("#FuenteNombre", "  Test   User ");
    await page.click("#VerResultado");
    await page.waitForURL(/resultado\.html\?total=/, { timeout: 10000 });
    expect(body).toMatchObject({
      loc_ciudad: "Mérida",
      loc_colonia: "Camelinas",
      loc_vialidad: "Periférico independencia",
      fuente_nombre: "Test User",
      fuente_correo: "test@example.com"
    });
    expect(body.public_token).toMatch(/^[0-9a-f-]{36}$/);
  });
});

test.describe("Formulario: avance por paso", () => {
  test("cuenta los obligatorios de cada paso, incluidos los condicionales visibles", async ({ page }) => {
    await stubSupabase(page, ok201);
    await page.goto("/index.html");
    const cuenta = n => page.locator(`#progreso a[data-paso="${n}"] .progreso-cuenta`);
    await expect(cuenta(1)).toHaveText("0/7");
    await expect(cuenta(4)).toHaveText("0/7");
    await expect(page.locator("#progreso-total")).toHaveText("0 de 29");

    await page.fill("#LocPais", "México");
    await expect(cuenta(1)).toHaveText("1/7");
    await page.selectOption("#PteTipoAcc", { value: "2" });
    await expect(cuenta(4)).toHaveText("1/10");
    await page.selectOption("#PteTipoAcc", { value: "4" });
    await expect(cuenta(4)).toHaveText("1/8");

    await page.fill("#FuenteNombre", "A");
    await page.fill("#FuenteFecha", "2026-03-24");
    await page.fill("#FuenteOrg", "B");
    await page.fill("#FuenteCorreo", "a@b.mx");
    await page.check("#Consentimiento");
    await expect(cuenta(5)).toHaveText("5/5");
    await expect(page.locator('#progreso a[data-paso="5"]')).toHaveAttribute("data-estado", "completo");
    await expect(page.locator('#progreso a[data-paso="5"] .progreso-sr')).toHaveText(": 5 de 5 obligatorios");
  });

  test("en 390 px el avance cabe, es sticky y no hay scroll horizontal", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await stubSupabase(page, ok201);
    await page.goto("/index.html");
    await page.locator("#paso-3").scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const caja = await page.locator("#progreso").boundingBox();
    expect(caja.height).toBeLessThanOrEqual(56);
    expect(caja.y).toBeGreaterThanOrEqual(60);
    expect(caja.y).toBeLessThanOrEqual(80);
    const anchos = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    expect(anchos[0]).toBeLessThanOrEqual(anchos[1]);
  });
});
