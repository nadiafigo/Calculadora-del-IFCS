import { test, expect } from "@playwright/test";

const PAGES = [
  { name: "index", url: "/index.html" },
  { name: "antecedentes", url: "/antecedentes.html" },
  { name: "resultado", url: "/html/resultado.html?total=50" },
  { name: "mapa", url: "/html/mapa.html" },
  { name: "analytics", url: "/html/analytics.html" },
  { name: "admin", url: "/html/admin.html" }
];

test.describe("Footer presente en todas las páginas", () => {
  for (const p of PAGES) {
    test(`footer en ${p.name} con redes y créditos`, async ({ page }) => {
      await page.goto(p.url);

      const footer = page.locator(".footer").first();
      await expect(footer).toBeAttached();

      // Para mapa.html el footer queda fuera del viewport inicial; basta con que exista en DOM.
      // Hacemos scroll para que sea visible y luego asertamos.
      await footer.scrollIntoViewIfNeeded();
      await expect(footer).toBeVisible();

      // Redes sociales: 3 enlaces (FB, IG, mail)
      const fb = footer.locator('a[href*="facebook.com/LigaPeatonal"]');
      const ig = footer.locator('a[href*="instagram.com/ligapeatonal"]');
      const mail = footer.locator('a[href^="mailto:adiospuentesantipeatonales"]').first();

      await expect(fb).toBeVisible();
      await expect(ig).toBeVisible();
      await expect(mail).toBeVisible();

      // Créditos: autoría + Izalith
      const creditos = footer.locator(".creditos");
      await expect(creditos).toContainText("Nadia");
      await expect(creditos).toContainText("Bicivil");
      await expect(creditos).toContainText("Liga Peatonal");

      const izalith = footer.locator("a.link-izalith");
      await expect(izalith).toBeVisible();
      await expect(izalith).toHaveAttribute("href", "https://www.izalith.net/");
    });
  }
});
