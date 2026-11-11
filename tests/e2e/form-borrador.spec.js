const { test, expect } = require("@playwright/test");

// Ningún test de este archivo inserta filas reales: todos los POST a Supabase se interceptan.

const RE_EVAL = /\/rest\/v1\/evaluaciones(\?|$)/;

/** Intercepta los POST con `alPost(route, request)`; los GET siguen a la red. */
async function interceptarPost(page, alPost) {
  await page.route(RE_EVAL, async (route, request) => {
    if (request.method() === "POST") return alPost(route, request);
    return route.continue();
  });
}

async function llenarTodo(page) {
  await page.fill("#LocPais", "México");
  await page.fill("#LocCiudad", "Morelia");
  await page.fill("#LocVia", "Periférico Independencia");
  await page.fill("#LocColonia", "Camelinas");
  await page.fill("#LocRef", "Mercado de Abastos");
  await page.fill("#LocX", "-101.221780");
  await page.fill("#LocY", "19.676883");
  for (const id of ["ViaCarriles", "ViaDistCruce", "ViaDistSemaf", "ViaBarreras", "ViaCamellones", "ViaVelPermi", "ViaVelOper",
    "EquipNum", "EquipDist", "EquipTipo", "PteObstBanq", "PteAnchoAcc", "PteAnchoPas", "PteCubierta", "PteIluminacion"]) {
    await page.selectOption(`#${id}`, { index: 1 });
  }
  await page.selectOption("#ViaRevo", { value: "0" });
  await page.selectOption("#PteTipoAcc", { value: "4" });
  await page.selectOption("#PteNumEsc", { index: 1 });
  await page.selectOption("#PtePubli", { value: "0" });
  await page.fill("#FuenteNombre", "Test User");
  await page.fill("#FuenteFecha", "2026-03-24");
  await page.fill("#FuenteOrg", "Test Org");
  await page.fill("#FuenteCorreo", "test@example.com");
  await page.check("#Consentimiento");
}

const leer = (page, k) => page.evaluate(key => localStorage.getItem(key), k);

test.describe("Borrador del formulario", () => {
  test("guarda cada cambio y lo restaura al recargar, con los condicionales abiertos", async ({ page }) => {
    await interceptarPost(page, route => route.abort());
    await page.goto("/index.html");
    await expect(page.locator("#borrador-aviso")).toBeHidden();

    await page.fill("#LocPais", "México");
    await page.fill("#LocCiudad", "Morelia");
    // Canaleta (índice 4) comparte value="7" con Guarnición alta (índice 3): debe volver la opción exacta.
    await page.selectOption("#ViaBarreras", { index: 4 });
    await page.selectOption("#ViaRevo", { value: "6" });
    await page.selectOption("#ViaRevoTipo", { index: 3 });
    await page.selectOption("#PteTipoAcc", { value: "2" });
    await page.selectOption("#PtePendiente", { index: 2 });
    await page.selectOption("#PteDistDesc", { index: 1 });
    await page.selectOption("#PteLongCami", { index: 4 });
    await page.selectOption("#PtePubli", { value: "1" });
    await page.selectOption("#PtePubliVisib", { index: 1 });
    await page.check("#Consentimiento");

    await expect.poll(() => leer(page, "ifcs_borrador_v1")).not.toBeNull();
    await page.reload();

    await expect(page.locator("#borrador-aviso")).toBeVisible();
    await expect(page.locator("#borrador-aviso")).toContainText("Recuperamos tu evaluación en curso");
    await expect(page.locator("#LocPais")).toHaveValue("México");
    await expect(page.locator("#LocCiudad")).toHaveValue("Morelia");
    expect(await page.$eval("#ViaBarreras", el => el.selectedIndex)).toBe(4);
    await expect(page.locator("#Box_ViaRevoTipo")).not.toHaveClass(/hidden/);
    expect(await page.$eval("#ViaRevoTipo", el => el.selectedIndex)).toBe(3);
    for (const box of ["Box_PtePendiente", "Box_PteDistDesc", "Box_PteLongCami", "Box_Visibilidad"]) {
      await expect(page.locator(`#${box}`)).not.toHaveClass(/hidden/);
    }
    await expect(page.locator("#Box_PteNumEsc")).toHaveClass(/hidden/);
    expect(await page.$eval("#PtePendiente", el => el.selectedIndex)).toBe(2);
    expect(await page.$eval("#PteLongCami", el => el.selectedIndex)).toBe(4);
    expect(await page.$eval("#PtePubliVisib", el => el.selectedIndex)).toBe(1);
    await expect(page.locator("#Consentimiento")).toBeChecked();
  });

  test("«Empezar de cero» limpia el borrador y conserva lo recordado del evaluador", async ({ page }) => {
    await interceptarPost(page, route => route.abort());
    await page.goto("/index.html");
    await page.evaluate(() => localStorage.setItem("ifcs_evaluador_v1", JSON.stringify({ FuenteNombre: "Ana Pérez" })));
    await page.fill("#LocColonia", "Centro");
    await page.selectOption("#PtePubli", { value: "1" });
    await expect.poll(() => leer(page, "ifcs_borrador_v1")).not.toBeNull();

    await page.reload();
    await expect(page.locator("#borrador-aviso")).toBeVisible();
    await expect(page.locator("#LocColonia")).toHaveValue("Centro");
    await expect(page.locator("#FuenteNombre")).toHaveValue("Ana Pérez");

    await page.click("#btn-empezar-de-cero");
    await expect(page.locator("#borrador-aviso")).toBeHidden();
    await expect(page.locator("#LocColonia")).toHaveValue("");
    await expect(page.locator("#PtePubli")).toHaveValue("");
    await expect(page.locator("#Box_Visibilidad")).toHaveClass(/hidden/);
    await expect(page.locator("#FuenteNombre")).toHaveValue("Ana Pérez");
    expect(await leer(page, "ifcs_borrador_v1")).toBeNull();

    await page.reload();
    await expect(page.locator("#borrador-aviso")).toBeHidden();
    await expect(page.locator("#LocColonia")).toHaveValue("");
  });

  test("sólo nombre/colectivo/correo no muestra el aviso de borrador", async ({ page }) => {
    await interceptarPost(page, route => route.abort());
    await page.goto("/index.html");
    await page.fill("#FuenteNombre", "Solo Nombre");
    await expect.poll(() => leer(page, "ifcs_borrador_v1")).not.toBeNull();
    await page.reload();
    await expect(page.locator("#FuenteNombre")).toHaveValue("Solo Nombre");
    await expect(page.locator("#borrador-aviso")).toBeHidden();
  });

  test("se borra al enviar con éxito", async ({ page }) => {
    await interceptarPost(page, route => route.fulfill({ status: 201, contentType: "application/json", body: "" }));
    await page.goto("/index.html");
    await llenarTodo(page);
    await expect.poll(() => leer(page, "ifcs_borrador_v1")).not.toBeNull();
    await page.click("#VerResultado");
    await page.waitForURL(/resultado\.html\?total=\d+&r=/, { timeout: 10000 });
    expect(await leer(page, "ifcs_borrador_v1")).toBeNull();
    expect(await leer(page, "ifcs_cola_v1")).toBeNull();
  });
});

test.describe("Envío sin señal", () => {
  test("si el POST falla, no redirige: encola, avisa, y «Reintentar ahora» publica con el mismo token", async ({ page }) => {
    let modo = "abortar";
    const recibidos = [];
    await interceptarPost(page, async (route, request) => {
      if (modo === "abortar") return route.abort("internetdisconnected");
      recibidos.push(request.postDataJSON());
      return route.fulfill({ status: 201, contentType: "application/json", body: "" });
    });

    await page.goto("/index.html");
    await llenarTodo(page);
    await page.click("#VerResultado");

    const dock = page.locator("#envio-dock");
    await expect(dock).toBeVisible({ timeout: 10000 });
    await expect(dock).toContainText("No pudimos enviar tu evaluación. La guardamos en este dispositivo y la enviaremos cuando haya conexión");
    await expect(page.locator("#btn-reintentar")).toBeVisible();
    await expect(page.locator("#link-reporte-local")).toBeVisible();
    await expect(page.locator("#link-reporte-local")).toHaveAttribute("href", /resultado\.html\?total=\d+&pendiente=1/);
    await page.waitForTimeout(1500);
    await expect(page).toHaveURL(/index\.html/);
    await expect(page.locator("#VerResultado")).toBeEnabled();

    const cola = JSON.parse(await leer(page, "ifcs_cola_v1"));
    expect(cola).toHaveLength(1);
    const token = cola[0].payload.public_token;
    expect(token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(cola[0].payload.loc_ciudad).toBe("Morelia");
    expect(await leer(page, "ifcs_borrador_v1")).toBeNull();

    // Enviar otra vez lo mismo sin señal no duplica la evaluación en la cola.
    await page.click("#VerResultado");
    await expect(page.locator("#VerResultado")).toBeEnabled();
    expect(JSON.parse(await leer(page, "ifcs_cola_v1"))).toHaveLength(1);

    modo = "ok";
    await page.click("#btn-reintentar");
    await expect(dock).toContainText("tu evaluación ya se envió", { timeout: 10000 });
    const link = dock.locator(".envio-dock__enlaces a").first();
    await expect(link).toHaveAttribute("href", new RegExp(`/html/resultado\\.html\\?r=${token}$`));
    await expect(page.locator("#btn-reintentar")).toBeHidden();
    expect(recibidos).toHaveLength(1);
    expect(recibidos[0].public_token).toBe(token);
    expect(await leer(page, "ifcs_cola_v1")).toBeNull();
    expect(await leer(page, "last_public_token")).toBe(token);
  });

  test("la cola se reintenta sola al cargar la portada", async ({ page }) => {
    const recibidos = [];
    await interceptarPost(page, async (route, request) => {
      recibidos.push(request.postDataJSON());
      return route.fulfill({ status: 201, contentType: "application/json", body: "" });
    });
    await page.addInitScript(() => {
      if (sessionStorage.getItem("sembrado")) return;
      sessionStorage.setItem("sembrado", "1");
      localStorage.setItem("ifcs_cola_v1", JSON.stringify([{
        token: "11111111-2222-4333-8444-555555555555",
        payload: { loc_ciudad: "Morelia", loc_vialidad: "Av. Prueba", total_ifcs: 50, public_token: "11111111-2222-4333-8444-555555555555" },
        total: 50, creado: "2026-11-10T10:00:00Z", intentos: 1
      }]));
    });
    await page.goto("/index.html");

    const dock = page.locator("#envio-dock");
    await expect(dock).toContainText("tu evaluación ya se envió", { timeout: 10000 });
    await expect(dock.locator(".envio-dock__enlaces a")).toHaveText("Av. Prueba, Morelia");
    expect(recibidos.map(r => r.public_token)).toEqual(["11111111-2222-4333-8444-555555555555"]);
    expect(await leer(page, "ifcs_cola_v1")).toBeNull();
  });

  test("con la cola pendiente, el evento online la vuelve a intentar", async ({ page }) => {
    let modo = "abortar";
    await interceptarPost(page, async route => {
      if (modo === "abortar") return route.abort("internetdisconnected");
      return route.fulfill({ status: 201, contentType: "application/json", body: "" });
    });
    await page.goto("/index.html");
    await llenarTodo(page);
    await page.click("#VerResultado");
    await expect(page.locator("#envio-dock")).toContainText("No pudimos enviar", { timeout: 10000 });

    modo = "ok";
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(page.locator("#envio-dock")).toContainText("ya se envió", { timeout: 10000 });
    expect(await leer(page, "ifcs_cola_v1")).toBeNull();
  });

  test("un 409 (el token ya existe) cuenta como enviado", async ({ page }) => {
    await interceptarPost(page, route => route.fulfill({ status: 409, contentType: "application/json", body: '{"code":"23505"}' }));
    await page.addInitScript(() => {
      if (sessionStorage.getItem("sembrado")) return;
      sessionStorage.setItem("sembrado", "1");
      localStorage.setItem("ifcs_cola_v1", JSON.stringify([{
        token: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
        payload: { loc_ciudad: "León", total_ifcs: 20, public_token: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" },
        total: 20, creado: "2026-11-10T10:00:00Z", intentos: 1
      }]));
    });
    await page.goto("/index.html");
    await expect(page.locator("#envio-dock")).toContainText("ya se envió", { timeout: 10000 });
    expect(await leer(page, "ifcs_cola_v1")).toBeNull();
  });
});
