import { test, expect } from "@playwright/test";

test.describe("Antecedentes y metodología", () => {

  test("h1 'Antecedentes y metodología' visible", async ({ page }) => {
    await page.goto("/antecedentes.html");
    const h1 = page.locator(".antecedentes-hero h1");
    await expect(h1).toBeVisible();
    await expect(h1).toHaveText("Antecedentes y metodología");
  });

  test("tabla de ponderación: total = 100 (suma de categoria-total)", async ({ page }) => {
    await page.goto("/antecedentes.html");

    // The three category subtotals should sum to 100.
    const totals = await page.locator(".ponderacion-table .categoria-total").allTextContents();
    expect(totals.length).toBe(3);
    const sum = totals.reduce((acc, t) => acc + parseInt(t.trim(), 10), 0);
    expect(sum).toBe(100);

    // The footer's total-final cell should also display 100.
    const totalFinal = page.locator(".ponderacion-table .total-final");
    await expect(totalFinal).toHaveText("100");

    // Smoke: at least 24 data rows + 3 categoria headers + 1 footer.
    const rowCount = await page.locator(".ponderacion-table tbody tr").count();
    expect(rowCount).toBeGreaterThanOrEqual(20);
  });

  test("descarga .pptx dispara download", async ({ page }) => {
    await page.goto("/antecedentes.html");
    const card = page.locator('.descarga-card[href$=".pptx"]');
    await expect(card).toBeVisible();

    const downloadPromise = page.waitForEvent("download", { timeout: 15000 });
    await card.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pptx$/i);
  });

  test("mobile (375x667): factibilidad cards en stack vertical", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/antecedentes.html");

    const cards = page.locator(".factibilidad-card");
    await expect(cards).toHaveCount(3);
    const boxes = await cards.evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { top: r.top, left: r.left };
      })
    );
    // Each subsequent card should sit below the previous one (stacked).
    expect(boxes[1].top).toBeGreaterThan(boxes[0].top);
    expect(boxes[2].top).toBeGreaterThan(boxes[1].top);
    // And share the same left edge (single column).
    expect(Math.abs(boxes[0].left - boxes[1].left)).toBeLessThan(2);
    expect(Math.abs(boxes[1].left - boxes[2].left)).toBeLessThan(2);
  });
});
