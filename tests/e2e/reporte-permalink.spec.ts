import { test, expect, Page } from "@playwright/test";

// Link permanente del reporte (migración 009): resultado.html?r=<token>
// reconstruye el diagnóstico desde la fila guardada en Supabase, sin
// depender del localStorage del navegador que llenó el formulario.

const TOKEN = "3f2b5a1c-7d4e-4c8a-9b6f-1e2d3c4b5a69";

// Fila como la regresa get_evaluacion_publica (to_jsonb de la tabla).
const FILA_BASE = {
  id: 501,
  created_at: "2026-09-01T18:00:00Z",
  loc_pais: "México",
  loc_ciudad: "Morelia",
  loc_vialidad: "Periférico Independencia",
  loc_colonia: "Camelinas",
  loc_referencia: "Mercado de Abastos",
  loc_x: "-101.221780",
  loc_y: "19.676883",
  via_carriles: "3 a 5 carriles",
  via_dist_cruce: "10 metros o menos",
  via_dist_semaf: "100 a 249 metros",
  via_barreras: "No hay",
  via_camellones: "1 camellón",
  via_revo: "No",
  via_revo_tipo: null,
  via_vel_permi: "50 km/hr",
  via_vel_oper: "31 a 50 km/hr",
  equip_num: "6 a 10",
  equip_dist: "0 a 99 metros",
  equip_tipo: "Educación",
  pte_obst_banq: "Sí",
  pte_ancho_acc: "Menor a 1.5 metros",
  pte_tipo_acc: "Escaleras",
  pte_num_esc: "25 a 49 escalones",
  pte_long_cami: null,
  pte_pendiente: null,
  pte_dist_desc: null,
  pte_ancho_pas: "Menor a 1.5 metros",
  pte_cubierta: "No",
  pte_iluminacion: "No hay",
  pte_publi: "No",
  pte_publi_visib: null,
  fuente_nombre: "Evaluadora de prueba",
  fuente_fecha: "2026-09-01",
  fuente_org: "Liga Peatonal",
  fuente_correo: "prueba@example.com",
  total_ifcs: 58,
  factibilidad: "Mediano plazo",
  aprobado_mapa: false,
  public_token: TOKEN,
  respuestas: null as null | Record<string, { id: string; txt: string; val: string }>,
};

const RESPUESTAS = {
  ViaCarriles:    { id: "ViaCarriles_3a5",      txt: "3 a 5 carriles",      val: "0" },
  ViaDistCruce:   { id: "ViaDistCruce_10menos", txt: "10 metros o menos",   val: "10" },
  ViaDistSemaf:   { id: "ViaDistSemaf_100a249", txt: "100 a 249 metros",    val: "5" },
  ViaBarreras:    { id: "ViaBarreras_1",        txt: "No hay",              val: "8" },
  ViaCamellones:  { id: "ViaCamellones_1",      txt: "1 camellón",          val: "8" },
  ViaRevo:        { id: "ViaRevo_no",           txt: "No",                  val: "0" },
  ViaVelPermi:    { id: "ViaVelPermi_50",       txt: "50 km/hr",            val: "4" },
  ViaVelOper:     { id: "ViaVelOper_31a50",     txt: "31 a 50 km/hr",       val: "4" },
  EquipNum:       { id: "EquipNum_6a10",        txt: "6 a 10",              val: "6" },
  EquipDist:      { id: "EquipDist_0a99",       txt: "0 a 99 metros",       val: "10" },
  EquipTipo:      { id: "EquipTipo_edu",        txt: "Educación",           val: "5" },
  PteObstBanq:    { id: "PteObstBanq_si",       txt: "Sí",                  val: "3" },
  PteAnchoAcc:    { id: "PteAnchoAcc_menor",    txt: "Menor a 1.5 metros",  val: "1" },
  PteTipoAcc:     { id: "PteTipoAcc_esc",       txt: "Escaleras",           val: "4" },
  PteNumEsc:      { id: "PteNumEsc_25a49",      txt: "25 a 49 escalones",   val: "4" },
  PteAnchoPas:    { id: "PteAnchoPas_menor1,5", txt: "Menor a 1.5 metros",  val: "1" },
  PteCubierta:    { id: "PteCubierta_no",       txt: "No",                  val: "1" },
  PteIluminacion: { id: "PteIluminacion_no",    txt: "No hay",              val: "1" },
  PtePubli:       { id: "PtePubli_no",          txt: "No",                  val: "0" },
};

const RPC_RE = /\/rest\/v1\/rpc\/get_evaluacion_publica/;

async function mockRpc(page: Page, fila: object | null, status = 200) {
  const llamadas: { body: any }[] = [];
  await page.route(RPC_RE, async (route, request) => {
    llamadas.push({ body: request.postDataJSON() });
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(fila),
    });
  });
  return llamadas;
}

test.describe("Reporte con link permanente", () => {
  test("abre el reporte desde ?r=<token> en un navegador limpio (con respuestas)", async ({ page }) => {
    const llamadas = await mockRpc(page, { ...FILA_BASE, respuestas: RESPUESTAS });
    const errores: string[] = [];
    page.on("console", msg => { if (msg.type() === "error") errores.push(msg.text()); });

    await page.goto(`/html/resultado.html?r=${TOKEN}`);

    // Se pidió la fila con el token exacto
    await expect.poll(() => llamadas.length).toBe(1);
    expect(llamadas[0].body).toEqual({ token: TOKEN });

    // Total y factibilidad salen de la base, no de la URL
    await expect(page.locator("#Resultado")).toHaveText("58%", { timeout: 5000 });
    await expect(page.locator("#TextoFactibilidad")).toHaveText("FACTIBILIDAD A MEDIANO PLAZO");

    // Ubicación y diagnóstico reconstruidos
    await expect(page.locator("#DxCiudad")).toHaveText("Morelia");
    await expect(page.locator("#DxVialidad")).toHaveText("Periférico Independencia");
    await expect(page.locator("#DxSemaforo")).toContainText("entre 100 y 249 metros");
    await expect(page.locator("#DxCarrilesCamellones")).toContainText("3 a 5 carriles");
    await expect(page.locator("#DxPteTipoAcc")).toContainText("escaleras");
    await expect(page.locator("#DxIlumPubli")).toBeVisible();

    // Propuestas de rediseño también se generan
    await expect(page.locator("#propuestas-container details").first()).toBeVisible();

    // Caja del link con la URL limpia (solo ?r=)
    const box = page.locator("#permalink-box");
    await expect(box).toBeVisible();
    const url = await page.locator("#permalink-url").inputValue();
    expect(url).toMatch(new RegExp(`/html/resultado\\.html\\?r=${TOKEN}$`));
    await expect(page.locator("#permalink-error")).toBeHidden();

    expect(errores).toEqual([]);
  });

  test("fila anterior a la migración (sin respuestas): reconstruye los ids desde el texto", async ({ page }) => {
    await mockRpc(page, { ...FILA_BASE, respuestas: null });

    await page.goto(`/html/resultado.html?r=${TOKEN}`);

    await expect(page.locator("#Resultado")).toHaveText("58%", { timeout: 5000 });
    // Textos del diagnóstico que dependen del ID de la opción, no del texto
    await expect(page.locator("#DxSemaforo")).toContainText("entre 100 y 249 metros");
    await expect(page.locator("#DxBarreras")).toContainText("No hay barreras peatonales");
    await expect(page.locator("#DxPteObst")).toBeVisible();
    await expect(page.locator("#DxPteAnchoAcc")).toBeVisible();
    await expect(page.locator("#DxPteTipoAcc")).toContainText("25 a 49 escalones");
    await expect(page.locator("#DxEquip")).toContainText("Educación");
  });

  test("token que no existe: aviso claro, sin link", async ({ page }) => {
    await mockRpc(page, null);

    await page.goto(`/html/resultado.html?r=${TOKEN}`);

    await expect(page.locator("#permalink-error")).toBeVisible();
    await expect(page.locator("#permalink-box")).toBeHidden();
    await expect(page.locator("#Resultado")).toHaveText("");
  });

  test("flujo normal (?total= sin token) sigue igual y no llama a Supabase", async ({ page }) => {
    const llamadas = await mockRpc(page, null);

    await page.goto("/html/resultado.html?total=55");
    await page.evaluate(() => {
      localStorage.setItem("datosUbicacion", JSON.stringify({
        pais: "México", ciudad: "Morelia", vialidad: "Av. Madero", colonia: "Centro",
        referencia: "Catedral", x: "-101.19", y: "19.70"
      }));
      localStorage.setItem("ViaDistSemaf_id", "ViaDistSemaf_99menos");
      localStorage.setItem("ViaCarriles_txt", "3 a 5 carriles");
      localStorage.setItem("ViaCamellones_id", "ViaCamellones_0");
      localStorage.setItem("ViaBarreras_id", "ViaBarreras_1");
      localStorage.setItem("PteTipoAcc_id", "PteTipoAcc_esc");
    });
    await page.reload();

    await expect(page.locator("#Resultado")).toHaveText("55%", { timeout: 5000 });
    await expect(page.locator("#DxCiudad")).toHaveText("Morelia");
    await expect(page.locator("#DxSemaforo")).toContainText("menos de 100 metros");
    await expect(page.locator("#permalink-box")).toBeHidden();
    expect(llamadas.length).toBe(0);
  });

  test("el formulario manda public_token + respuestas y redirige con ?r=", async ({ page }) => {
    let insertBody: any = null;
    await page.route(/\/rest\/v1\/evaluaciones(\?|$)/, async (route, request) => {
      if (request.method() === "POST") {
        insertBody = request.postDataJSON();
        await route.fulfill({ status: 201, contentType: "application/json", body: "" });
      } else {
        await route.continue();
      }
    });
    // resultado.html va a pedir la fila con el token: la devolvemos como si existiera
    await page.route(RPC_RE, async (route, request) => {
      const { token } = request.postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...FILA_BASE, public_token: token, respuestas: insertBody?.respuestas ?? null }),
      });
    });

    await page.goto("/index.html");
    await page.fill("#LocPais", "México");
    await page.fill("#LocCiudad", "Morelia");
    await page.fill("#LocVia", "Periférico Independencia");
    await page.fill("#LocColonia", "Camelinas");
    await page.fill("#LocRef", "Mercado de Abastos");
    await page.fill("#LocX", "-101.221780");
    await page.fill("#LocY", "19.676883");
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
    await page.fill("#FuenteNombre", "Test User");
    await page.fill("#FuenteFecha", "2026-09-01");
    await page.fill("#FuenteOrg", "Test Org");
    await page.fill("#FuenteCorreo", "test@example.com");
    await page.check("#CalcForm input[type='checkbox']");

    await page.click("#VerResultado");
    await page.waitForURL(/resultado\.html\?total=\d+&r=[0-9a-f-]{36}$/, { timeout: 10000 });

    expect(insertBody).not.toBeNull();
    expect(insertBody.public_token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    // Solo opciones elegidas y visibles; los condicionales ocultos no van
    expect(insertBody.respuestas.ViaRevo).toEqual({ id: "ViaRevo_no", txt: "No", val: "0" });
    expect(insertBody.respuestas.PteTipoAcc.id).toBe("PteTipoAcc_esc");
    expect(insertBody.respuestas.PteNumEsc).toBeDefined();
    expect(insertBody.respuestas.ViaRevoTipo).toBeUndefined();
    expect(insertBody.respuestas.PtePendiente).toBeUndefined();

    // La URL de la caja es la misma con la que se mandó el INSERT
    const url = await page.locator("#permalink-url").inputValue();
    expect(url.endsWith(`?r=${insertBody.public_token}`)).toBe(true);
  });

  test("si el INSERT falla, no se ofrece link (no hay fila que consultar)", async ({ page }) => {
    await page.route(/\/rest\/v1\/evaluaciones(\?|$)/, async (route, request) => {
      if (request.method() === "POST") {
        await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "RLS" }) });
      } else {
        await route.continue();
      }
    });

    await page.goto("/index.html");
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
    await page.fill("#FuenteFecha", "2026-09-01");
    await page.fill("#FuenteOrg", "Test");
    await page.fill("#FuenteCorreo", "test@example.com");
    await page.check("#CalcForm input[type='checkbox']");

    await page.click("#VerResultado");
    await page.waitForURL(/resultado\.html\?total=\d+$/, { timeout: 10000 });
    await expect(page.locator("#permalink-box")).toBeHidden();
  });
});
