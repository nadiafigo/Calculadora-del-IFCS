const { test, expect } = require("@playwright/test");

// Portada: <head> (SEO/social), imagen optimizada de «Por qué», sin errores de JS y sin
// scroll horizontal. Supabase se intercepta: GET → [] y POST → 201 (nunca se inserta nada).

async function stubSupabase(page) {
  await page.route(/\/rest\/v1\//, async (route, request) => {
    if (request.method() === "POST") return route.fulfill({ status: 201, contentType: "application/json", body: "" });
    return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
}

test.describe("Portada", () => {
  test("head: canonical, Open Graph, Twitter y JSON-LD", async ({ page }) => {
    await stubSupabase(page);
    await page.goto("/index.html");
    const attr = (sel, a) => page.locator(sel).getAttribute(a);

    await expect(page).toHaveTitle(/Factibilidad de Cruce Seguro/);
    expect(await attr('link[rel="canonical"]', "href")).toBe("https://adiospuentesantipeatonales.org/");
    expect(await attr('meta[property="og:image"]', "content")).toBe("https://adiospuentesantipeatonales.org/img/og-ifcs.jpg");
    expect(await attr('meta[property="og:image:width"]', "content")).toBe("1200");
    expect(await attr('meta[property="og:image:height"]', "content")).toBe("630");
    expect(await attr('meta[property="og:url"]', "content")).toBe("https://adiospuentesantipeatonales.org/");
    expect(await attr('meta[name="twitter:card"]', "content")).toBe("summary_large_image");
    expect((await attr('meta[name="description"]', "content")).length).toBeGreaterThan(80);

    const ld = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
    const tipos = ld["@graph"].map(n => n["@type"]);
    expect(tipos).toEqual(expect.arrayContaining(["Organization", "WebSite"]));
    expect(ld["@graph"].find(n => n["@type"] === "Organization").name).toBe("Liga Peatonal");

    // Leaflet con versión fija y SRI
    expect(await attr('script[src*="leaflet"]', "src")).toContain("leaflet@1.9.4/");
    expect(await attr('script[src*="leaflet"]', "integrity")).toMatch(/^sha256-/);
    expect(await attr('link[href*="leaflet"]', "integrity")).toMatch(/^sha256-/);
  });

  test("«Por qué» usa la imagen de 1200 px con webp, jpg y dimensiones", async ({ page }) => {
    await stubSupabase(page);
    await page.goto("/index.html");
    const img = page.locator(".porque picture img");
    await expect(page.locator('.porque picture source[type="image/webp"]')).toHaveAttribute("srcset", /img2-1200\.webp 1200w/);
    await expect(img).toHaveAttribute("src", /img2-1200\.jpg$/);
    await expect(img).toHaveAttribute("width", "1200");
    await expect(img).toHaveAttribute("height", "802");
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate(el => el.complete && el.naturalWidth), { timeout: 10000 }).toBeGreaterThan(0);
  });

  for (const ancho of [1440, 390]) {
    test(`sin errores de JS ni scroll horizontal en ${ancho}`, async ({ page }) => {
      const errores = [];
      page.on("pageerror", e => errores.push(e.message));
      await page.setViewportSize({ width: ancho, height: 900 });
      await stubSupabase(page);
      await page.goto("/index.html");
      await page.waitForLoadState("load");
      await page.locator("#CalcForm").scrollIntoViewIfNeeded();
      const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
      expect(sw).toBeLessThanOrEqual(iw);
      expect(errores).toEqual([]);
    });
  }
});
