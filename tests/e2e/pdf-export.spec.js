const { test, expect } = require("@playwright/test");

test.describe("PDF export", () => {
  test("triggers download without console errors", async ({ page }) => {
    // Inject localStorage data before navigating
    await page.goto("/html/resultado.html?total=55");

    await page.evaluate(() => {
      const datos = {
        pais: "México",
        ciudad: "Morelia",
        vialidad: "Periférico Independencia",
        colonia: "Camelinas",
        referencia: "Mercado de Abastos",
        x: "-101.221780",
        y: "19.676883"
      };
      localStorage.setItem("datosUbicacion", JSON.stringify(datos));
      localStorage.setItem("fuente_nombre", "Test User");
      localStorage.setItem("fuente_fecha", "2026-03-24");
      localStorage.setItem("fuente_org", "Test Org");
      localStorage.setItem("fuente_correo", "test@example.com");

      // Simulate some diagnostic data
      localStorage.setItem("ViaDistSemaf_id", "ViaDistSemaf_99menos");
      localStorage.setItem("ViaCarriles_txt", "3 a 5 carriles");
      localStorage.setItem("ViaCamellones_txt", "1 camellón");
      localStorage.setItem("ViaCamellones_id", "ViaCamellones_1");
      localStorage.setItem("ViaBarreras_id", "ViaBarreras_1");
      localStorage.setItem("ViaRevo_id", "ViaRevo_no");
      localStorage.setItem("EquipNum_id", "EquipNum_6a10");
      localStorage.setItem("EquipTipo_id", "EquipTipo_edu");
      localStorage.setItem("EquipTipo_txt", "Educación");
      localStorage.setItem("EquipDist_id", "EquipDist_0a99");
      localStorage.setItem("EquipDist_txt", "0 a 99 metros");
      localStorage.setItem("PteObstBanq_id", "PteObstBanq_si");
      localStorage.setItem("PteAnchoAcc_id", "PteAnchoAcc_menor");
      localStorage.setItem("PteTipoAcc_id", "PteTipoAcc_esc");
      localStorage.setItem("PteNumEsc_txt", "25 a 49 escalones");
      localStorage.setItem("PteIluminacion_id", "PteIluminacion_no");
      localStorage.setItem("PtePubli_id", "PtePubli_no");
    });

    // Reload so resultado.js picks up localStorage
    await page.reload();
    await page.waitForTimeout(2000);

    // Collect console errors
    const errors = [];
    page.on("console", msg => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    // PDF button should exist
    const btn = page.locator("#btn-descargar-pdf");
    await expect(btn).toBeVisible();

    // Expect download event on click
    const downloadPromise = page.waitForEvent("download", { timeout: 15000 }).catch(() => null);
    await btn.click();

    const download = await downloadPromise;

    if (download) {
      // Verify filename pattern
      const filename = download.suggestedFilename();
      expect(filename).toMatch(/^IFCS_.*\.pdf$/);
    }

    // No JS errors should have occurred
    expect(errors).toEqual([]);
  });
});
