const { test, expect } = require("@playwright/test");

test.describe("Conditional fields", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/index.html");
  });

  test("ViaRevoTipo hidden by default, shows on Sí, hides on No", async ({ page }) => {
    const box = page.locator("#Box_ViaRevoTipo");

    // Hidden by default
    await expect(box).toHaveClass(/hidden/);

    // Select "Sí" (value="6")
    await page.selectOption("#ViaRevo", { value: "6" });
    await expect(box).not.toHaveClass(/hidden/);

    // Select "No" (value="0")
    await page.selectOption("#ViaRevo", { value: "0" });
    await expect(box).toHaveClass(/hidden/);
  });

  test("Rampa fields appear when PteTipoAcc = Rampa", async ({ page }) => {
    const boxPendiente = page.locator("#Box_PtePendiente");
    const boxDistDesc = page.locator("#Box_PteDistDesc");
    const boxLongCami = page.locator("#Box_PteLongCami");
    const boxNumEsc = page.locator("#Box_PteNumEsc");

    // All hidden initially
    await expect(boxPendiente).toHaveClass(/hidden/);
    await expect(boxDistDesc).toHaveClass(/hidden/);
    await expect(boxLongCami).toHaveClass(/hidden/);
    await expect(boxNumEsc).toHaveClass(/hidden/);

    // Select "Rampa" (value="2")
    await page.selectOption("#PteTipoAcc", { value: "2" });

    // Rampa fields should show
    await expect(boxPendiente).not.toHaveClass(/hidden/);
    await expect(boxDistDesc).not.toHaveClass(/hidden/);
    await expect(boxLongCami).not.toHaveClass(/hidden/);

    // Escaleras field should stay hidden
    await expect(boxNumEsc).toHaveClass(/hidden/);
  });

  test("Escaleras field appears, rampa fields hide on PteTipoAcc = Escaleras", async ({ page }) => {
    // First show rampa fields
    await page.selectOption("#PteTipoAcc", { value: "2" });
    await expect(page.locator("#Box_PtePendiente")).not.toHaveClass(/hidden/);

    // Switch to escaleras (value="4")
    await page.selectOption("#PteTipoAcc", { value: "4" });

    // Escaleras field should show
    await expect(page.locator("#Box_PteNumEsc")).not.toHaveClass(/hidden/);

    // Rampa fields should hide
    await expect(page.locator("#Box_PtePendiente")).toHaveClass(/hidden/);
    await expect(page.locator("#Box_PteDistDesc")).toHaveClass(/hidden/);
    await expect(page.locator("#Box_PteLongCami")).toHaveClass(/hidden/);
  });

  test("Publicidad visibility field toggles", async ({ page }) => {
    const box = page.locator("#Box_Visibilidad");
    await expect(box).toHaveClass(/hidden/);

    // Select "Sí" (value="1")
    await page.selectOption("#PtePubli", { value: "1" });
    await expect(box).not.toHaveClass(/hidden/);

    // Select "No" (value="0")
    await page.selectOption("#PtePubli", { value: "0" });
    await expect(box).toHaveClass(/hidden/);
  });
});
