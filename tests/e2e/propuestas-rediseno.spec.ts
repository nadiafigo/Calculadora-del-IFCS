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
});
