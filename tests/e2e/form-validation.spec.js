const { test, expect } = require("@playwright/test");

test.describe("Form validation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/index.html");
  });

  test("shows error messages when submitting empty form", async ({ page }) => {
    await page.click("#VerResultado");

    // Should NOT navigate away
    await expect(page).toHaveURL(/index\.html/);

    // Error messages should appear
    const errors = page.locator(".error-msg");
    const count = await errors.count();
    expect(count).toBeGreaterThan(0);

    // First error should have red border
    const firstError = page.locator(".field-error").first();
    await expect(firstError).toBeVisible();
  });

  test("scrolls to first field with error", async ({ page }) => {
    // Scroll to the bottom first
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);

    await page.click("#VerResultado");
    await page.waitForTimeout(500);

    // The page should have scrolled up toward the first required field
    const scrollY = await page.evaluate(() => window.scrollY);
    const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
    // Should not be at the very bottom anymore
    expect(scrollY).toBeLessThan(bodyHeight - 500);
  });

  test("clears error when user fills the field", async ({ page }) => {
    await page.click("#VerResultado");

    // LocPais should have an error
    const locPais = page.locator("#LocPais");
    await expect(locPais).toHaveClass(/field-error/);

    // Type something
    await locPais.fill("México");

    // Error should be gone
    await expect(locPais).not.toHaveClass(/field-error/);
    const errorMsg = locPais.locator(".. >> .error-msg");
    await expect(errorMsg).toHaveCount(0);
  });

  test("clears error on select change", async ({ page }) => {
    await page.click("#VerResultado");

    const viaCarriles = page.locator("#ViaCarriles");
    await expect(viaCarriles).toHaveClass(/field-error/);

    await viaCarriles.selectOption({ index: 1 });

    await expect(viaCarriles).not.toHaveClass(/field-error/);
  });
});
