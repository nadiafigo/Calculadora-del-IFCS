import { test, expect } from '@playwright/test';

const BASE = 'https://adiospuentesantipeatonales.org';

// Etiqueta @prod: CI la excluye con --grep-invert @prod (corre contra producción, no contra el servidor local).
test.describe('Prod smoke (live) @prod', () => {
  test.skip(!process.env.SMOKE_PROD, 'Set SMOKE_PROD=1 para correr contra prod');

  test('homepage responde 200', async ({ request }) => {
    const r = await request.get(BASE);
    expect(r.status()).toBe(200);
  });

  test('http redirige a https', async ({ request }) => {
    const r = await request.get('http://adiospuentesantipeatonales.org', {
      maxRedirects: 0,
      failOnStatusCode: false,
    });
    expect([301, 302, 308]).toContain(r.status());
    expect(r.headers()['location'] || '').toMatch(/^https:/);
  });

  test('www resuelve a contenido válido', async ({ request }) => {
    const r = await request.get('https://www.adiospuentesantipeatonales.org');
    expect(r.status()).toBeLessThan(400);
  });

  test('6 páginas core cargan sin 4xx/5xx', async ({ page }) => {
    const paths = ['/', '/antecedentes.html', '/html/archivo.html', '/html/mapa.html', '/html/analytics.html', '/html/admin.html'];
    for (const p of paths) {
      const r = await page.goto(BASE + p);
      expect(r?.status(), `Failed: ${p}`).toBeLessThan(400);
    }
  });

  test('OG tags presentes y apuntan al dominio', async ({ page }) => {
    await page.goto(BASE);
    const ogUrl = await page.locator('meta[property="og:url"]').getAttribute('content');
    const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');
    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
    expect(ogUrl).toContain('adiospuentesantipeatonales.org');
    expect(ogImage).toBeTruthy();
    expect(ogTitle).toBeTruthy();
  });

  test('archivo pinta fichas reales que abren su reporte', async ({ page }) => {
    await page.goto(BASE + '/html/archivo.html');
    const fichas = page.locator('#fichas a.ficha');
    await expect(fichas.first()).toBeVisible({ timeout: 20000 });
    expect(await fichas.count()).toBeGreaterThan(10);
    await expect(fichas.first()).toHaveAttribute('href', /resultado\.html\?r=[0-9a-f-]{36}$/);
  });

  test('reporte por token (link permanente) se regenera', async ({ page }) => {
    const errores: string[] = [];
    page.on('pageerror', e => errores.push(e.message));
    const r = await page.goto(BASE + '/html/resultado.html?r=49aa9e1b-3d73-4f92-8af9-f6f949468149');
    expect(r?.status()).toBeLessThan(400);
    // El puntaje llega de Supabase (get_evaluacion_publica): debe pintarse un número.
    await expect(page.locator('#Resultado')).toHaveText(/^\d{1,3}%$/, { timeout: 20000 });
    await expect(page.locator('#permalink-error')).toBeHidden();
    expect(errores).toEqual([]);
  });

  test('robots.txt y sitemap.xml publicados', async ({ request }) => {
    const robots = await request.get(`${BASE}/robots.txt`);
    expect(robots.status()).toBe(200);
    expect(await robots.text()).toContain('sitemap.xml');
    const sitemap = await request.get(`${BASE}/sitemap.xml`);
    expect(sitemap.status()).toBe(200);
    expect(await sitemap.text()).toContain('/html/archivo.html');
  });

  test('js/config.js de Supabase accesible', async ({ request }) => {
    const r = await request.get(`${BASE}/js/config.js`);
    expect(r.status()).toBe(200);
    const body = await r.text();
    expect(body.toLowerCase()).toContain('supabase');
  });
});
