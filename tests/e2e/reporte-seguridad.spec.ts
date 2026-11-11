import { test, expect, Page } from "@playwright/test";

// Seguridad y redacción del reporte (resultado.html):
//  - Ningún texto de la base, de la URL o de localStorage se interpreta como
//    HTML: un payload `<img src=x onerror=…>` debe verse literal y no ejecutar.
//  - Con condicionales vacíos (pendiente, descansos, escalones…) las frases no
//    quedan rotas («su pendiente es de  y la distancia entre descansos es de ,»).
//  - Encabezado con folio/fecha/colectivo, título dinámico, compartir, cortes
//    de la barra en 30 y 60, y estado vacío sin parámetros.

const PAYLOAD = "<img src=x onerror=window.__xss=1>";
const TOKEN = "7c1e2d3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f";
const RPC_RE = /\/rest\/v1\/rpc\/get_evaluacion_publica/;

// Fila como la regresa get_evaluacion_publica (to_jsonb de la tabla)
const FILA = {
  id: 49,
  created_at: "2026-09-01T18:00:00Z",
  loc_pais: "México",
  loc_ciudad: "Saltillo",
  loc_vialidad: "Periférico Luis Echeverría",
  loc_colonia: "República",
  loc_referencia: "Plaza Patria",
  loc_x: "-101.0",
  loc_y: "25.4",
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
  fuente_org: "Colectivo Peatón Saltillo",
  fuente_correo: "prueba@example.com",
  total_ifcs: 49,
  factibilidad: "Mediano plazo",
  aprobado_mapa: true,
  public_token: TOKEN,
  respuestas: null as null | Record<string, { id: string; txt: string; val: string }>,
};

async function mockRpc(page: Page, fila: object | null) {
  await page.route(RPC_RE, route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(fila),
  }));
}

/** Ninguna etiqueta inyectada en el DOM y el handler nunca corrió. */
async function sinInyeccion(page: Page) {
  // Dar tiempo a que un <img src=x> fallido dispare onerror si existiera
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
  expect(await page.locator('img[src="x"]').count()).toBe(0);
}

test.describe("Reporte: textos de la base nunca se interpretan como HTML", () => {

  test("link permanente con payloads en ubicación, fuente y escalones", async ({ page }) => {
    await mockRpc(page, {
      ...FILA,
      loc_vialidad: PAYLOAD,
      loc_colonia: PAYLOAD,
      loc_referencia: PAYLOAD,
      loc_ciudad: PAYLOAD,
      fuente_nombre: PAYLOAD,
      fuente_org: PAYLOAD,
      pte_num_esc: PAYLOAD,
      equip_tipo: PAYLOAD,
      respuestas: {
        PteTipoAcc: { id: "PteTipoAcc_esc", txt: "Escaleras", val: "4" },
        PteNumEsc: { id: "PteNumEsc_25a49", txt: PAYLOAD, val: "4" },
        EquipTipo: { id: "EquipTipo_edu", txt: PAYLOAD, val: "5" },
        EquipDist: { id: "EquipDist_0a99", txt: "0 a 99 metros", val: "10" },
        ViaCarriles: { id: "ViaCarriles_3a5", txt: PAYLOAD, val: "0" },
        ViaCamellones: { id: "ViaCamellones_1", txt: "1 camellón", val: "8" },
      },
    });

    await page.goto(`/html/resultado.html?r=${TOKEN}`);
    await expect(page.locator("#Resultado")).toHaveText("49%", { timeout: 8000 });

    await expect(page.locator("#DxVialidad")).toHaveText(PAYLOAD);
    await expect(page.locator("#DxReferencia")).toHaveText(PAYLOAD);
    await expect(page.locator("#DxCiudad")).toHaveText(PAYLOAD);
    await expect(page.locator("#DxPteTipoAcc")).toContainText(PAYLOAD.toLowerCase());
    await expect(page.locator("#DxEquipTipo")).toHaveText(PAYLOAD);
    await expect(page.locator("#DxCarrilesCamellones")).toContainText(PAYLOAD.toLowerCase());
    await expect(page.locator("#meta-colectivo dd")).toHaveText(PAYLOAD);
    await sinInyeccion(page);

    // La plantilla del PDF copia los textos del diagnóstico: también literales
    await page.locator("#btn-descargar-pdf").click();
    await expect(page.locator("#reporte-pdf #pdf-vialidad")).toHaveText(PAYLOAD);
    await expect(page.locator("#reporte-pdf #pdf-colonia")).toHaveText(PAYLOAD);
    await expect(page.locator("#reporte-pdf #pdf-fuente-nombre")).toHaveText(PAYLOAD);
    await expect(page.locator("#reporte-pdf #pdf-fuente-org")).toHaveText(PAYLOAD);
    await expect(page.locator("#reporte-pdf #pdf-diagnostico")).toContainText(PAYLOAD.toLowerCase());
    expect(await page.locator("#reporte-pdf #pdf-diagnostico img").count()).toBe(0);
    await sinInyeccion(page);
  });

  test("rampa con payloads en pendiente y distancia entre descansos", async ({ page }) => {
    await mockRpc(page, {
      ...FILA,
      pte_tipo_acc: "Rampa",
      pte_num_esc: null,
      pte_pendiente: PAYLOAD,
      pte_dist_desc: PAYLOAD,
      respuestas: {
        PteTipoAcc: { id: "PteTipoAcc_ramp", txt: "Rampa", val: "2" },
        PtePendiente: { id: "PtePendiente_8,1mas", txt: PAYLOAD, val: "1" },
        PteDistDesc: { id: "PteDistDesc_15mas", txt: PAYLOAD, val: "1" },
      },
    });

    await page.goto(`/html/resultado.html?r=${TOKEN}`);
    await expect(page.locator("#Resultado")).toHaveText("49%", { timeout: 8000 });

    const strongs = page.locator("#DxPteTipoAcc strong");
    await expect(strongs).toHaveCount(2);
    await expect(strongs.nth(0)).toHaveText(PAYLOAD);
    await expect(strongs.nth(1)).toHaveText(PAYLOAD);
    await sinInyeccion(page);
  });

  test("flujo local (?total=) con payloads en localStorage", async ({ page }) => {
    await page.goto("/html/resultado.html?total=55");
    await page.evaluate((p) => {
      localStorage.setItem("datosUbicacion", JSON.stringify({
        pais: p, ciudad: p, vialidad: p, colonia: p, referencia: p, x: "-101.19", y: "19.70",
      }));
      localStorage.setItem("fuente_nombre", p);
      localStorage.setItem("fuente_org", p);
      localStorage.setItem("fuente_fecha", p);
      localStorage.setItem("PteTipoAcc_id", "PteTipoAcc_ramp");
      localStorage.setItem("PtePendiente_id", "PtePendiente_6,1a8");
      localStorage.setItem("PtePendiente_txt", p);
      localStorage.setItem("PteDistDesc_txt", p);
      localStorage.setItem("EquipTipo_id", "EquipTipo_salud");
      localStorage.setItem("EquipTipo_txt", p);
      localStorage.setItem("EquipDist_txt", p);
      localStorage.setItem("ViaCarriles_txt", p);
      localStorage.setItem("ViaCamellones_id", "ViaCamellones_0");
    }, PAYLOAD);
    await page.reload();

    await expect(page.locator("#Resultado")).toHaveText("55%", { timeout: 8000 });
    await expect(page.locator("#DxVialidad")).toHaveText(PAYLOAD);
    await expect(page.locator("#DxCiudad")).toHaveText(PAYLOAD);
    await expect(page.locator("#DxPteTipoAcc strong").first()).toHaveText(PAYLOAD);
    await expect(page.locator("#DxEquipDist")).toHaveText(PAYLOAD);
    await expect(page.locator("#meta-colectivo dd")).toHaveText(PAYLOAD);
    await expect(page.locator("#meta-fecha dd")).toHaveText(PAYLOAD);
    expect(await page.title()).toContain(PAYLOAD);
    await sinInyeccion(page);

    await page.locator("#btn-descargar-pdf").click();
    await expect(page.locator("#reporte-pdf #pdf-fuente-nombre")).toHaveText(PAYLOAD);
    await expect(page.locator("#reporte-pdf #pdf-diagnostico")).toContainText(PAYLOAD);
    await sinInyeccion(page);
  });
});

test.describe("Reporte: frases completas aunque falten datos condicionales", () => {

  // Huecos típicos de una frase mal armada: «es de  y», «es de ,», «de .»
  const HUECO = /(es de|de)\s*(,|\.|\by\b|$)|\(\s*\)|\s,/;

  test("rampa sin pendiente ni descansos (fila vieja, sin respuestas)", async ({ page }) => {
    await mockRpc(page, {
      ...FILA,
      // Texto exacto de la opción en index.html: así se reconstruye el id
      pte_tipo_acc: "Rampa (con o sin escaleras adicionales)",
      pte_num_esc: null,
      pte_pendiente: null,
      pte_dist_desc: null,
      respuestas: null,
    });
    await page.goto(`/html/resultado.html?r=${TOKEN}`);
    await expect(page.locator("#Resultado")).toHaveText("49%", { timeout: 8000 });

    const li = page.locator("#DxPteTipoAcc");
    await expect(li).toBeVisible();
    await expect(li).toContainText("rampa");
    await expect(li).toContainText("no se registraron su pendiente ni la distancia entre descansos");
    expect(await li.textContent()).not.toMatch(HUECO);
    await expect(li.locator("strong")).toHaveCount(0);
  });

  test("rampa con pendiente pero sin descansos: omite la cláusula", async ({ page }) => {
    await mockRpc(page, {
      ...FILA,
      pte_tipo_acc: "Rampa",
      respuestas: {
        PteTipoAcc: { id: "PteTipoAcc_ramp", txt: "Rampa", val: "2" },
        PtePendiente: { id: "PtePendiente_8,1mas", txt: "8.1% o más", val: "1" },
      },
    });
    await page.goto(`/html/resultado.html?r=${TOKEN}`);
    await expect(page.locator("#Resultado")).toHaveText("49%", { timeout: 8000 });

    const li = page.locator("#DxPteTipoAcc");
    await expect(li).toContainText("su pendiente es de 8.1% o más, impidiendo");
    await expect(li).not.toContainText("descansos");
    expect(await li.textContent()).not.toMatch(HUECO);
  });

  test("rampa con descansos pero sin pendiente: dice que no se registró", async ({ page }) => {
    await mockRpc(page, {
      ...FILA,
      pte_tipo_acc: "Rampa",
      respuestas: {
        PteTipoAcc: { id: "PteTipoAcc_ramp", txt: "Rampa", val: "2" },
        PteDistDesc: { id: "PteDistDesc_15mas", txt: "15 metros o más", val: "1" },
      },
    });
    await page.goto(`/html/resultado.html?r=${TOKEN}`);
    await expect(page.locator("#Resultado")).toHaveText("49%", { timeout: 8000 });

    const li = page.locator("#DxPteTipoAcc");
    await expect(li).toContainText("distancia entre descansos de 15 metros o más");
    await expect(li).toContainText("no se registró su pendiente");
    expect(await li.textContent()).not.toMatch(HUECO);
  });

  test("escaleras sin número, sin referencia, sin carriles ni distancia del equipamiento", async ({ page }) => {
    await mockRpc(page, {
      ...FILA,
      loc_referencia: null,
      via_carriles: null,
      pte_num_esc: null,
      equip_dist: null,
      respuestas: {
        PteTipoAcc: { id: "PteTipoAcc_esc", txt: "Escaleras", val: "4" },
        ViaCamellones: { id: "ViaCamellones_1", txt: "1 camellón", val: "8" },
        EquipTipo: { id: "EquipTipo_edu", txt: "Educación", val: "5" },
        ViaRevo: { id: "ViaRevo_si", txt: "Sí", val: "2" },
      },
    });
    await page.goto(`/html/resultado.html?r=${TOKEN}`);
    await expect(page.locator("#Resultado")).toHaveText("49%", { timeout: 8000 });

    await expect(page.locator("#DxPteTipoAcc")).toContainText("Su tipo de acceso es de escaleras, impidiendo");
    expect(await page.locator("#DxPteTipoAcc").textContent()).not.toMatch(HUECO);

    const dictamen = (await page.locator(".dx-dictamen").textContent()) || "";
    expect(dictamen).not.toContain("próximo a");
    expect(dictamen.replace(/\s+/g, " ")).toContain("en la vialidad de Periférico Luis Echeverría de la ciudad de Saltillo, es técnicamente factible");
    expect(dictamen).not.toMatch(HUECO);

    await expect(page.locator("#DxCarrilesCamellones")).toHaveText("La vialidad cuenta con 1 camellón que pueden funcionar como islas de refugio peatonal.");

    const equip = page.locator("#DxEquip");
    await expect(equip).toContainText("Existe un equipamiento de Educación (no se registró a qué distancia)");
    expect(await equip.textContent()).not.toMatch(HUECO);
  });
});

test.describe("Reporte: encabezado, compartir, cortes y estado vacío", () => {

  test("folio, fecha, colectivo, título y compartir por WhatsApp", async ({ page }) => {
    await mockRpc(page, { ...FILA, respuestas: null });
    await page.goto(`/html/resultado.html?r=${TOKEN}`);
    await expect(page.locator("#Resultado")).toHaveText("49%", { timeout: 8000 });

    await expect(page).toHaveTitle("IFCS 49 · Periférico Luis Echeverría, Saltillo — Reporte");
    await expect(page.locator("#expediente-meta")).toBeVisible();
    await expect(page.locator("#meta-folio dd")).toHaveText("P-049");
    await expect(page.locator("#meta-fecha dd")).toContainText("2026");
    await expect(page.locator("#meta-colectivo dd")).toHaveText("Colectivo Peatón Saltillo");

    const wa = page.locator("#permalink-whatsapp");
    await expect(wa).toBeVisible();
    const href = (await wa.getAttribute("href")) || "";
    expect(href.startsWith("https://wa.me/?text=")).toBe(true);
    const texto = decodeURIComponent(href.slice("https://wa.me/?text=".length));
    expect(texto).toContain("49/100");
    expect(texto).toContain(`resultado.html?r=${TOKEN}`);
    await expect(page.locator("#permalink-copy")).toBeVisible();

    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(canonical).toBe(`https://adiospuentesantipeatonales.org/html/resultado.html?r=${TOKEN}`);
  });

  test("sin id (flujo local) no hay folio y el encabezado no queda vacío", async ({ page }) => {
    await page.goto("/html/resultado.html?total=72");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(page.locator("#Resultado")).toHaveText("72%", { timeout: 8000 });
    await expect(page.locator("#expediente-meta")).toBeHidden();
    await expect(page).toHaveTitle("IFCS 72 — Reporte");
  });

  test("la barra marca los cortes reales de la metodología (30 y 60)", async ({ page }) => {
    await page.goto("/html/resultado.html?total=45");
    await expect(page.locator("#Resultado")).toHaveText("45%", { timeout: 8000 });
    const cortes = await page.locator(".dictamen-barra b").evaluateAll(els =>
      els.map(el => getComputedStyle(el).getPropertyValue("--corte").trim()));
    expect(cortes).toEqual(["30", "60"]);
    await expect(page.locator(".dictamen-escala")).toHaveText(/0\s*30\s*60\s*100/);
    await expect(page.locator(".dictamen")).toHaveAttribute("data-plazo", "mediano");
  });

  test("?pendiente=1 (evaluación en cola local): aviso y sin enlace ni compartir", async ({ page }) => {
    await page.goto(`/html/resultado.html?total=55&pendiente=1&r=${TOKEN}`);
    await page.evaluate(() => {
      localStorage.setItem("datosUbicacion", JSON.stringify({
        pais: "México", ciudad: "Morelia", vialidad: "Av. Madero", colonia: "Centro",
        referencia: "Catedral", x: "-101.19", y: "19.70",
      }));
    });
    await page.reload();
    await expect(page.locator("#Resultado")).toHaveText("55%", { timeout: 8000 });

    const aviso = page.locator("#aviso-pendiente");
    await expect(aviso).toBeVisible();
    await expect(aviso).toHaveText("Este reporte aún no está publicado: la evaluación se enviará cuando haya conexión.");
    await expect(page.locator("#permalink-box")).toBeHidden();
    await expect(page.locator("#permalink-whatsapp")).toBeHidden();
    await expect(page.locator("#permalink-share")).toBeHidden();
  });

  test("sin pendiente=1 el aviso no aparece", async ({ page }) => {
    await page.goto("/html/resultado.html?total=55");
    await expect(page.locator("#Resultado")).toHaveText("55%", { timeout: 8000 });
    await expect(page.locator("#aviso-pendiente")).toBeHidden();
  });

  test("sin parámetros: estado vacío con botones, sin frase rota", async ({ page }) => {
    const errores: string[] = [];
    page.on("console", msg => { if (msg.type() === "error") errores.push(msg.text()); });
    await page.goto("/html/resultado.html");

    const vacio = page.locator("#reporte-vacio");
    await expect(vacio).toBeVisible({ timeout: 8000 });
    await expect(vacio.locator('a[href="../index.html#CalcForm"]')).toBeVisible();
    await expect(vacio.locator('a[href="./archivo.html"]')).toBeVisible();
    await expect(page.locator(".expediente")).toBeHidden();
    await expect(page.locator(".dx-gral")).toBeHidden();
    await expect(page.locator("#permalink-error")).toBeHidden();
    await expect(page.getByText("de ser retirado")).toBeHidden();
    expect(errores).toEqual([]);
  });
});
