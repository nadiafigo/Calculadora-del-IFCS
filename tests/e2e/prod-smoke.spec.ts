import { test, expect } from '@playwright/test';

const BASE = 'https://adiospuentesantipeatonales.org';

test.describe('Prod smoke (live)', () => {
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

  test('5 páginas core cargan sin 4xx/5xx', async ({ page }) => {
    const paths = ['/', '/antecedentes.html', '/html/mapa.html', '/html/analytics.html', '/html/admin.html'];
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

  test('js/config.js de Supabase accesible', async ({ request }) => {
    const r = await request.get(`${BASE}/js/config.js`);
    expect(r.status()).toBe(200);
    const body = await r.text();
    expect(body.toLowerCase()).toContain('supabase');
  });
});
