import { test, expect, Page } from "@playwright/test";

// ----- Helpers -----------------------------------------------------------------

/**
 * Seed localStorage with field IDs and the same shape that form.js produces
 * (`${field}_id`), then reload the page so resultado.js picks them up.
 * Pass `null` for fields you want to leave unset.
 */
async function seedFormData(page: Page, fields: Record<string, string | null>) {
  await page.evaluate((data) => {
    localStorage.clear();
    Object.entries(data).forEach(([k, v]) => {
      if (v != null) localStorage.setItem(`${k}_id`, v);
    });
    // Minimal location data so PDF export does not break.
    localStorage.setItem("datosUbicacion", JSON.stringify({
      pais: "México", ciudad: "Morelia", vialidad: "Av. Test",
      colonia: "Col Test", referencia: "Ref Test",
      x: "-101.2", y: "19.7"
    }));
    localStorage.setItem("fuente_nombre", "Test User");
    localStorage.setItem("fuente_fecha", "2026-05-04");
    localStorage.setItem("fuente_org", "Test Org");
    localStorage.setItem("fuente_correo", "test@example.com");
  }, fields);
}

// Set of fields where "everything is good" (no rules should trigger).
// Note: ViaCamellones is intentionally omitted — rules 9 and 10 cover
// "no camellones" vs "con camellones" exhaustively (siempre hay una recomendación
// pertinente cuando ese dato existe), así que para el caso "no se dispara nada"
// dejamos el campo vacío.
const ALL_GOOD: Record<string, string> = {
  ViaCarriles: "ViaCarriles_1a2",
  ViaDistCruce: "ViaDistCruce_10menos",
  ViaDistSemaf: "ViaDistSemaf_100a249",
  ViaBarreras: "ViaBarreras_1",       // No hay
  ViaRevo: "ViaRevo_si",
  ViaRevoTipo: "ViaRevoTipo_meseta",
  ViaVelPermi: "ViaVelPermi_30",
  ViaVelOper: "ViaVelOper_21a30",
  EquipNum: "EquipNum_1a5",
  EquipDist: "EquipDist_100a249",
  EquipTipo: "EquipTipo_abasto",
  PteObstBanq: "PteObstBanq_no",
  PteAnchoAcc: "PteAnchoAcc_mayor",
  PteTipoAcc: "PteTipoAcc_elev",
  PteAnchoPas: "PteAnchoPas_1,5mas",
  PteCubierta: "PteCubierta_si",
  PteIluminacion: "PteIluminacion_si",
  PtePubli: "PtePubli_no",
};

test.describe("Propuestas de rediseño", () => {

  test("regla velocidad permitida >30 km/h: aparece propuesta correspondiente", async ({ page }) => {
    await page.goto("/html/resultado.html?total=55");
    await seedFormData(page, { ...ALL_GOOD, ViaVelPermi: "ViaVelPermi_50" });
    await page.reload();

    const card = page.locator('.propuesta-card[data-id="vel-permi-alta"]');
    await expect(card).toBeVisible();
    await expect(card.locator(".propuesta-titulo")).toContainText("Velocidad permitida");
    // Primera card abierta por default
    await expect(card).toHaveAttribute("open", "");
  });

  test("múltiples reglas: todas aparecen, primera abierta, resto cerradas", async ({ page }) => {
    await page.goto("/html/resultado.html?total=20");
    await seedFormData(page, {
      ...ALL_GOOD,
      ViaVelPermi: "ViaVelPermi_60",
      ViaVelOper: "ViaVelOper_80mas",
      ViaDistSemaf: "ViaDistSemaf_1000mas",
      ViaRevo: "ViaRevo_no",
      PteIluminacion: "PteIluminacion_no",
      PteTipoAcc: "PteTipoAcc_esc",
      PteObstBanq: "PteObstBanq_si",
    });
    await page.reload();

    const cards = page.locator(".propuesta-card");
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(5);

    // First card has the open attribute, rest do not.
    await expect(cards.nth(0)).toHaveAttribute("open", "");
    for (let i = 1; i < count; i++) {
      const isOpen = await cards.nth(i).evaluate((el: HTMLDetailsElement) => el.open);
      expect(isOpen).toBe(false);
    }
  });

  test("evaluación sin condiciones disparadas: muestra mensaje vacío", async ({ page }) => {
    await page.goto("/html/resultado.html?total=80");
    await seedFormData(page, ALL_GOOD);
    await page.reload();

    await expect(page.locator(".propuestas-empty")).toBeVisible();
    await expect(page.locator(".propuestas-empty")).toContainText("No se generaron propuestas");
    await expect(page.locator(".propuesta-card")).toHaveCount(0);
    // La sección de normas referenciadas se oculta cuando no hay propuestas.
    await expect(page.locator("#normas-referencia")).toBeHidden();
  });

  test("chips de normas: href correcto, target=_blank, rel=noopener", async ({ page }) => {
    await page.goto("/html/resultado.html?total=40");
    await seedFormData(page, { ...ALL_GOOD, PteIluminacion: "PteIluminacion_no" });
    await page.reload();

    const chip = page.locator(".propuesta-card .propuesta-chip").first();
    await expect(chip).toBeVisible();

    const href = await chip.getAttribute("href");
    expect(href).toMatch(/^https?:\/\//);
    await expect(chip).toHaveAttribute("target", "_blank");
    await expect(chip).toHaveAttribute("rel", /noopener/);
  });

  test("acordeón: click en summary expande/colapsa la card", async ({ page }) => {
    await page.goto("/html/resultado.html?total=30");
    await seedFormData(page, {
      ...ALL_GOOD,
      ViaVelPermi: "ViaVelPermi_60",
      PteIluminacion: "PteIluminacion_no",
      PteTipoAcc: "PteTipoAcc_esc",
    });
    await page.reload();

    const cards = page.locator(".propuesta-card");
    expect(await cards.count()).toBeGreaterThanOrEqual(2);

    const second = cards.nth(1);
    expect(await second.evaluate((el: HTMLDetailsElement) => el.open)).toBe(false);

    await second.locator("summary").click();
    expect(await second.evaluate((el: HTMLDetailsElement) => el.open)).toBe(true);

    await second.locator("summary").click();
    expect(await second.evaluate((el: HTMLDetailsElement) => el.open)).toBe(false);
  });

  test("subtítulo dice 'generales' y disclaimer final visible", async ({ page }) => {
    await page.goto("/html/resultado.html?total=50");
    await seedFormData(page, ALL_GOOD);
    await page.reload();

    const subtitle = page.locator("#propuestas-rediseno .subtitle");
    await expect(subtitle).toContainText("generales");
    await expect(subtitle).not.toContainText("específicas");

    const disclaimer = page.locator(".propuestas-disclaimer");
    await expect(disclaimer).toBeVisible();
    await expect(disclaimer).toContainText("carácter general");
  });

  test("descargar PDF produce archivo > 0 bytes con propuestas", async ({ page }) => {
    await page.goto("/html/resultado.html?total=35");
    await seedFormData(page, {
      ...ALL_GOOD,
      ViaVelPermi: "ViaVelPermi_50",
      PteIluminacion: "PteIluminacion_no",
    });
    await page.reload();
    await page.waitForTimeout(500);

    // Capture console errors during PDF generation.
    const errors: string[] = [];
    page.on("console", msg => { if (msg.type() === "error") errors.push(msg.text()); });

    const downloadPromise = page.waitForEvent("download", { timeout: 20000 });
    await page.click("#btn-descargar-pdf");
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^IFCS_.*\.pdf$/);

    const path = await download.path();
    if (path) {
      const fs = await import("fs");
      const stats = fs.statSync(path);
      expect(stats.size).toBeGreaterThan(0);
    }

    expect(errors).toEqual([]);
  });

  test("PDF de propuestas: agrupación por categoría + normas en <strong>", async ({ page }) => {
    // Stub html2pdf para que el click no descargue, solo renderice.
    await page.addInitScript(() => {
      window.html2pdf = function () {
        return {
          set: function () { return this; },
          from: function () { return this; },
          save: function () { return Promise.resolve(); }
        };
      };
    });

    await page.goto("/html/resultado.html?total=50");
    // Datos que disparan al menos 2 reglas de categorías DIFERENTES y cuyas
    // sugerencias contienen el nombre canónico de la norma para validar <strong>:
    // - sin-semaforo-cercano (categoría velocidad-semaforos): cita "NOM-004-SEDATU-2023"
    // - sin-reductores (categoría reductores): cita "Manual de Calles SEDATU-BID 2019"
    await seedFormData(page, {
      ...ALL_GOOD,
      ViaDistSemaf: "ViaDistSemaf_250a999",   // dispara sin-semaforo-cercano
      ViaRevo: "ViaRevo_no"                   // dispara sin-reductores
    });
    await page.reload();

    const btn = page.locator("#btn-descargar-pdf");
    await expect(btn).toBeVisible();
    await btn.click();

    // El handler hace display:block del #reporte-pdf antes de invocar html2pdf.
    // Con el stub, save() resuelve inmediato y restoreDetails se ejecuta, pero
    // el contenido de #pdf-propuestas ya quedó populated.
    const pdfPropuestas = page.locator("#pdf-propuestas");

    // Al menos 2 grupos de categorías
    const grupos = pdfPropuestas.locator(".pdf-propuestas-grupo");
    await expect(grupos).toHaveCount(2, { timeout: 5000 });

    // Cada grupo tiene su <h3> con clase pdf-categoria-titulo
    const titulos = pdfPropuestas.locator("h3.pdf-categoria-titulo");
    await expect(titulos).toHaveCount(2);

    // Las propuestas son <ol> ordenadas
    const listas = pdfPropuestas.locator("ol.pdf-propuesta-list");
    await expect(listas).toHaveCount(2);

    // Al menos un <strong> dentro de las sugerencias (norma resaltada)
    const strongsEnSugerencias = pdfPropuestas.locator(".pdf-propuesta-sugerencia strong");
    expect(await strongsEnSugerencias.count()).toBeGreaterThan(0);

    // El texto del strong debe ser un nombre de norma reconocible
    const primerStrong = await strongsEnSugerencias.first().textContent();
    expect(primerStrong).toMatch(/LGMSV|NOM-|Manual de Calles|Manual de Señalización/);

    // Las normas referenciadas aparecen como <ul> con bullets
    const normasLists = pdfPropuestas.locator("ul.pdf-propuesta-normas-list");
    expect(await normasLists.count()).toBeGreaterThan(0);

    // Confirmación textual: el encabezado "Normas referenciadas:" aparece.
    // (#reporte-pdf es display:none en estado normal — se hace block sólo durante
    // la generación del PDF, así que validamos presencia en DOM, no visibility.)
    await expect(pdfPropuestas.getByText("Normas referenciadas:").first()).toBeAttached();
  });
});
