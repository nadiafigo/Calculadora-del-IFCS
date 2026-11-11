const { test, expect } = require('@playwright/test');

// html/archivo.html con datos interceptados: no depende de la base real.
// Las filas imitan lo que regresa /rest/v1/evaluaciones con las columnas públicas de js/archivo.js.

const T = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const FILAS = [
  { id: 55, created_at: '2026-11-01T10:00:00Z', loc_ciudad: 'Querétaro',
    loc_vialidad: '<img src=x onerror="window.__xss=1">', loc_colonia: '<script>window.__xss2=1</script>',
    loc_x: '-100.39', loc_y: '20.59', total_ifcs: 50, factibilidad: 'Mediano plazo',
    status_retiro: null, fecha_retiro: null, pte_tipo_acc: 'Escaleras', pte_num_esc: '25 a 49 escalones', public_token: T(55) },
  { id: 41, created_at: '2026-10-20T10:00:00Z', loc_ciudad: 'Morelia', loc_vialidad: 'Av. Madero Poniente',
    loc_colonia: 'Centro', loc_x: '-101.19', loc_y: '19.70', total_ifcs: 68, factibilidad: 'Corto plazo',
    status_retiro: 'Retirado', fecha_retiro: '2025-03-01', pte_tipo_acc: 'Escaleras', pte_num_esc: null, public_token: T(41) },
  { id: 30, created_at: '2026-10-10T10:00:00Z', loc_ciudad: 'Mérida', loc_vialidad: 'Calle 60',
    loc_colonia: 'Centro', loc_x: '-89.62', loc_y: '20.97', total_ifcs: 20, factibilidad: 'Largo plazo',
    status_retiro: null, fecha_retiro: null, pte_tipo_acc: 'Rampa', pte_num_esc: null, public_token: T(30) },
  { id: 12, created_at: '2026-09-15T10:00:00Z', loc_ciudad: 'MORELIA', loc_vialidad: 'Periférico Paseo de la República',
    loc_colonia: 'Chapultepec Sur', loc_x: '-101.17', loc_y: '19.69', total_ifcs: 45, factibilidad: 'Mediano plazo',
    status_retiro: null, fecha_retiro: null, pte_tipo_acc: 'Escaleras', pte_num_esc: '50 o más', public_token: T(12) },
  { id: 7, created_at: '2026-09-01T10:00:00Z', loc_ciudad: 'Morelia', loc_vialidad: 'Av. Camelinas',
    loc_colonia: 'Félix Ireta', loc_x: '-101.18', loc_y: '19.68', total_ifcs: 72, factibilidad: 'Corto plazo',
    status_retiro: null, fecha_retiro: null, pte_tipo_acc: 'Escaleras', pte_num_esc: '25 a 49 escalones', public_token: T(7) },
];

async function abrir(page) {
  const consultas = [];
  await page.route('**/rest/v1/evaluaciones**', route => {
    consultas.push(route.request().url());
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FILAS) });
  });
  const errores = [];
  page.on('pageerror', e => errores.push(e.message));
  await page.goto('/html/archivo.html');
  await expect(page.locator('#fichas .ficha')).toHaveCount(5);
  return { consultas, errores };
}

const fichas = page => page.locator('#fichas .ficha');

test.describe('Archivo de puentes', () => {
  test('pinta las fichas y las cifras; sólo pide columnas públicas', async ({ page }) => {
    const { consultas, errores } = await abrir(page);
    await expect(page.locator('[data-dato="titulo"]')).toHaveText('5 puentes en 3 ciudades');
    await expect(page.locator('#cuenta')).toContainText('5 fichas');
    await expect(fichas(page).first().locator('.ficha-top')).toContainText('P-055');
    await expect(page.locator('.ficha--sustituido')).toHaveCount(1);
    expect(consultas.length).toBeGreaterThan(0);
    expect(consultas[0]).toContain('aprobado_mapa=eq.true');
    expect(consultas[0]).not.toMatch(/fuente_nombre|fuente_correo/);
    expect(errores).toEqual([]);
  });

  test('cada ficha enlaza a resultado.html?r=<token>', async ({ page }) => {
    await abrir(page);
    const hrefs = await fichas(page).evaluateAll(els => els.map(a => a.getAttribute('href')));
    expect(hrefs).toEqual(FILAS.map(f => `../html/resultado.html?r=${f.public_token}`));
  });

  test('chips de plazo y de sustituidos filtran', async ({ page }) => {
    await abrir(page);
    const chip = nombre => page.locator('.chip[data-plazo]', { hasText: nombre });

    await chip('Corto plazo').click();
    await expect(chip('Corto plazo')).toHaveAttribute('aria-pressed', 'true');
    await expect(chip('Todos')).toHaveAttribute('aria-pressed', 'false');
    await expect(fichas(page)).toHaveCount(2);

    await chip('Mediano plazo').click();
    await expect(fichas(page)).toHaveCount(2);

    await chip('Largo plazo').click();
    await expect(fichas(page)).toHaveCount(1);
    await expect(fichas(page).first()).toContainText('Calle 60');

    await chip('Sustituidos').click();
    await expect(fichas(page)).toHaveCount(1);
    await expect(fichas(page).first()).toContainText('Av. Madero Poniente');
    await expect(fichas(page).first()).toHaveClass(/ficha--sustituido/);

    await chip('Todos').click();
    await expect(fichas(page)).toHaveCount(5);
  });

  test('el select de ciudad unifica mayúsculas y filtra', async ({ page }) => {
    await abrir(page);
    const opciones = await page.locator('#f-ciudad option').allTextContents();
    expect(opciones).toEqual(['Todas', 'Mérida', 'Morelia', 'Querétaro']);

    await page.selectOption('#f-ciudad', 'Morelia');
    await expect(fichas(page)).toHaveCount(3);
    await expect(page.locator('#cuenta')).toContainText('3 fichas');

    // Se combina con el chip de plazo
    await page.locator('.chip[data-plazo="Corto plazo"]').click();
    await expect(fichas(page)).toHaveCount(2);

    await page.selectOption('#f-ciudad', 'Mérida');
    await expect(fichas(page)).toHaveCount(0);
    await expect(page.locator('#fichas .fichas-vacio')).toBeVisible();
  });

  test('la búsqueda filtra por vialidad o colonia, sin importar acentos', async ({ page }) => {
    await abrir(page);
    await page.fill('#f-buscar', 'camelinas');
    await expect(fichas(page)).toHaveCount(1);
    await expect(fichas(page).first()).toContainText('Av. Camelinas');

    await page.fill('#f-buscar', 'felix');
    await expect(fichas(page)).toHaveCount(1);

    await page.fill('#f-buscar', 'CENTRO');
    await expect(fichas(page)).toHaveCount(2);
    await expect(page.locator('#cuenta')).toContainText('2 fichas');

    await page.fill('#f-buscar', 'no existe esta calle');
    await expect(fichas(page)).toHaveCount(0);

    await page.fill('#f-buscar', '');
    await expect(fichas(page)).toHaveCount(5);
  });

  test('una vialidad con <img onerror> no ejecuta código', async ({ page }) => {
    const { errores } = await abrir(page);
    const ficha = fichas(page).first();
    await expect(ficha.locator('h3')).toHaveText('<img src=x onerror="window.__xss=1">');
    await expect(ficha.locator('.ficha-lugar')).toHaveText('<script>window.__xss2=1</script>');
    expect(await page.locator('#fichas img, #fichas script').count()).toBe(0);
    // Si el HTML se hubiera inyectado, el onerror ya habría corrido.
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => [window.__xss, window.__xss2])).toEqual([undefined, undefined]);
    expect(errores).toEqual([]);
  });

  test('si la base no responde, avisa sin romper la página', async ({ page }) => {
    await page.route('**/rest/v1/evaluaciones**', route => route.fulfill({ status: 503, body: 'caído' }));
    await page.goto('/html/archivo.html');
    await expect(page.locator('#fichas .fichas-vacio')).toContainText('No pudimos cargar el archivo');
  });
});
