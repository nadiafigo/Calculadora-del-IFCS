const { test, expect } = require('@playwright/test');

// Cambios del 11/11/2026 pedidos por Nadia:
//  - Fecha de levantamiento visible en cada ficha.
//  - Una evaluación nueva reemplaza a la anterior del mismo puente (migración 012):
//    las páginas públicas sólo piden las vigentes, el reporte viejo avisa y el
//    panel permite marcar el reemplazo.
//  - «No pude medirla» en la pendiente de la rampa, con 0 puntos.
// Todo con la red interceptada: no toca la base real.

const T = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const FICHAS = [
  { id: 90, created_at: '2026-11-01T10:00:00Z', fuente_fecha: '2026-10-28', loc_ciudad: 'Morelia',
    loc_vialidad: 'Av. Madero Poniente', loc_colonia: 'Centro', loc_x: '-101.19', loc_y: '19.70',
    total_ifcs: 40, factibilidad: 'Mediano plazo', status_retiro: null, fecha_retiro: null,
    pte_tipo_acc: 'Escaleras', pte_num_esc: null, public_token: T(90) },
  { id: 12, created_at: '2026-05-06T10:00:00Z', fuente_fecha: '2019-04-24', loc_ciudad: 'Morelia',
    loc_vialidad: 'Av. Camelinas', loc_colonia: 'Félix Ireta', loc_x: '-101.18', loc_y: '19.68',
    total_ifcs: 72, factibilidad: 'Corto plazo', status_retiro: null, fecha_retiro: null,
    pte_tipo_acc: 'Escaleras', pte_num_esc: null, public_token: T(12) },
  { id: 5, created_at: '2026-05-06T10:00:00Z', fuente_fecha: null, loc_ciudad: 'Mérida',
    loc_vialidad: 'Calle 60', loc_colonia: 'Centro', loc_x: '-89.62', loc_y: '20.97',
    total_ifcs: 20, factibilidad: 'Largo plazo', status_retiro: null, fecha_retiro: null,
    pte_tipo_acc: 'Rampa', pte_num_esc: null, public_token: T(5) },
];

test.describe('Fecha de los datos y evaluaciones vigentes', () => {
  for (const pagina of ['/html/archivo.html', '/html/mapa.html', '/html/analytics.html', '/']) {
    test(`${pagina} sólo pide evaluaciones no reemplazadas`, async ({ page }) => {
      const consultas = [];
      await page.route('**/rest/v1/evaluaciones**', route => {
        consultas.push(route.request().url());
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FICHAS) });
      });
      await page.goto(pagina);
      // La lista de ciudades sugeridas del formulario (select=loc_ciudad) no cuenta:
      // sólo interesan las consultas que traen evaluaciones para pintar.
      const deDatos = () => consultas.filter(u => u.includes('total_ifcs'));
      await expect.poll(() => deDatos().length).toBeGreaterThan(0);
      for (const url of deDatos()) {
        expect(url).toContain('aprobado_mapa=eq.true');
        expect(url).toContain('reemplazada_por=is.null');
        expect(url).not.toMatch(/fuente_nombre|fuente_correo/);
      }
    });
  }

  test('la ficha dice de cuándo son los datos; sin fecha no pinta el renglón', async ({ page }) => {
    await page.route('**/rest/v1/evaluaciones**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FICHAS) }));
    await page.goto('/html/archivo.html');
    const fichas = page.locator('#fichas .ficha');
    await expect(fichas).toHaveCount(3);
    await expect(fichas.nth(0).locator('.ficha-fecha')).toHaveText('Datos de oct 2026');
    await expect(fichas.nth(1).locator('.ficha-fecha')).toHaveText('Datos de abr 2019');
    await expect(fichas.nth(2).locator('.ficha-fecha')).toHaveCount(0);
  });
});

// ---------------------------------------------------------------- reporte --

const FILA = {
  id: 12, created_at: '2026-05-06T10:00:00Z', loc_pais: 'México', loc_ciudad: 'Morelia',
  loc_vialidad: 'Av. Camelinas', loc_colonia: 'Félix Ireta', loc_referencia: 'Plaza', loc_x: '-101.18', loc_y: '19.68',
  via_carriles: '3 a 5 carriles', via_dist_cruce: '10 metros o menos', via_dist_semaf: '100 a 249 metros',
  via_barreras: 'No hay', via_camellones: '1 camellón', via_revo: 'No', via_revo_tipo: null,
  via_vel_permi: '50 km/hr', via_vel_oper: '31 a 50 km/hr', equip_num: '6 a 10', equip_dist: '0 a 99 metros',
  equip_tipo: 'Educación', pte_obst_banq: 'Sí', pte_ancho_acc: 'Menor a 1.5 metros',
  pte_tipo_acc: 'Rampa (con o sin escaleras adicionales)', pte_num_esc: null,
  pte_long_cami: '100 a 149 metros', pte_pendiente: 'No pude medirla', pte_dist_desc: '7 a 14 metros',
  pte_ancho_pas: 'Menor a 1.5 metros', pte_cubierta: 'No', pte_iluminacion: 'No hay', pte_publi: 'No',
  pte_publi_visib: null, fuente_nombre: 'Evaluadora de prueba', fuente_fecha: '2019-04-24',
  fuente_org: 'Liga Peatonal', total_ifcs: 58, factibilidad: 'Mediano plazo', aprobado_mapa: true,
  public_token: T(12), respuestas: null, reemplazada_por: null, reemplazo_token: null,
};

async function abrirReporte(page, fila) {
  await page.route(/\/rest\/v1\/rpc\/get_evaluacion_publica/, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fila) }));
  await page.goto(`/html/resultado.html?r=${fila.public_token}`);
  await expect(page.locator('#Resultado')).toHaveText('58%');
}

test.describe('Reporte', () => {
  test('una evaluación reemplazada avisa y enlaza a la vigente', async ({ page }) => {
    await abrirReporte(page, { ...FILA, reemplazada_por: 90, reemplazo_token: T(90) });
    const aviso = page.locator('#aviso-reemplazo');
    await expect(aviso).toBeVisible();
    await expect(aviso.locator('a')).toHaveAttribute('href', new RegExp(`resultado\\.html\\?r=${T(90)}$`));
  });

  test('una evaluación vigente no muestra el aviso', async ({ page }) => {
    await abrirReporte(page, FILA);
    await expect(page.locator('#aviso-reemplazo')).toBeHidden();
  });

  test('«No pude medirla» no se redacta como una pendiente', async ({ page }) => {
    await abrirReporte(page, FILA);
    const li = page.locator('#DxPteTipoAcc');
    await expect(li).toBeVisible();
    await expect(li).toContainText('distancia entre descansos de 7 a 14 metros');
    await expect(li).toContainText('no se registró su pendiente');
    await expect(li).not.toContainText('No pude medirla');
  });
});

// ------------------------------------------------------------- formulario --

test('formulario: la pendiente de la rampa ofrece «No pude medirla» con 0 puntos', async ({ page }) => {
  await page.route('**/rest/v1/evaluaciones**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.goto('/');
  await page.selectOption('#PteTipoAcc', { label: 'Rampa (con o sin escaleras adicionales)' });
  await expect(page.locator('#Box_PtePendiente')).toBeVisible();
  const opcion = page.locator('#PtePendiente option', { hasText: 'No pude medirla' });
  await expect(opcion).toHaveCount(1);
  await expect(opcion).toHaveAttribute('value', '0');
  // Sólo la pendiente la lleva: los demás condicionales siguen exigiendo una medida.
  await expect(page.locator('#PteDistDesc option, #PteLongCami option, #PteNumEsc option', { hasText: /no pude/i })).toHaveCount(0);
});

// ------------------------------------------------------------------ panel --

const REF = 'tnlxfzruypugbttafeyf';

const APROBADAS = [
  { ...FICHAS[0], loc_pais: 'México', loc_referencia: '', fuente_nombre: 'A', fuente_org: 'Liga', fuente_correo: 'a@example.com', reemplazada_por: null },
  { ...FICHAS[1], loc_pais: 'México', loc_referencia: '', fuente_nombre: 'B', fuente_org: 'Liga', fuente_correo: 'b@example.com', reemplazada_por: null },
  { ...FICHAS[2], loc_pais: 'México', loc_referencia: '', fuente_nombre: 'C', fuente_org: 'Liga', fuente_correo: 'c@example.com', reemplazada_por: null },
];

test('panel: en la evaluación nueva se elige a cuál reemplaza y se guarda en la anterior', async ({ page }) => {
  // Sesión falsa de supabase-js en localStorage: el panel se abre sin magic link.
  await page.addInitScript(([ref]) => {
    const ahora = Math.floor(Date.now() / 1000);
    localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify({
      access_token: 'x.y.z', refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: ahora + 3600,
      user: { id: '00000000-0000-4000-8000-000000000001', email: 'admin@example.com', aud: 'authenticated', role: 'authenticated' },
    }));
  }, [REF]);
  await page.route('**/auth/v1/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));

  let filas = APROBADAS.map(f => ({ ...f }));
  const cambios = [];
  await page.route('**/rest/v1/evaluaciones**', route => {
    const req = route.request();
    const url = new URL(req.url());
    if (req.method() === 'PATCH') {
      const body = req.postDataJSON();
      cambios.push({ query: url.search, body });
      const porId = url.searchParams.get('id');
      const porReemplazo = url.searchParams.get('reemplazada_por');
      filas.forEach(f => {
        if (porId && `eq.${f.id}` === porId) Object.assign(f, body);
        if (porReemplazo && `eq.${f.reemplazada_por}` === porReemplazo) Object.assign(f, body);
      });
      return route.fulfill({ status: 204, body: '' });
    }
    const aprobadas = url.searchParams.get('aprobado_mapa') === 'eq.true';
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(aprobadas ? filas : []) });
  });

  await page.goto('/html/admin.html');
  await page.locator('#tab-aprobadas').click();
  const nueva = page.locator('.pending-card[data-id="90"]');
  await expect(nueva).toBeVisible();

  // Sólo ofrece evaluaciones de la misma ciudad, nunca a sí misma.
  const opciones = await nueva.locator('.admin-reemplazo option').allTextContents();
  expect(opciones.length).toBe(2);
  expect(opciones[1]).toContain('P-012');
  expect(opciones[1]).toContain('Av. Camelinas');

  await nueva.locator('.admin-reemplazo select').selectOption('12');
  await nueva.locator('.btn-guardar-reemplazo').click();

  await expect(page.locator('#admin-msg')).toContainText('P-090 ahora reemplaza a P-012');
  expect(cambios).toHaveLength(2);
  expect(cambios[0].query).toContain('reemplazada_por=eq.90');
  expect(cambios[0].body).toEqual({ reemplazada_por: null });
  expect(cambios[1].query).toContain('id=eq.12');
  expect(cambios[1].body).toEqual({ reemplazada_por: 90 });

  // La anterior queda señalada y la nueva conserva la selección.
  await expect(page.locator('.pending-card[data-id="12"] .admin-reemplazo-aviso')).toContainText('Reemplazada por P-090');
  await expect(page.locator('.pending-card[data-id="90"] .admin-reemplazo select')).toHaveValue('12');

  // Deshacer: «Ninguna» suelta el reemplazo.
  await page.locator('.pending-card[data-id="90"] .admin-reemplazo select').selectOption('');
  await page.locator('.pending-card[data-id="90"] .btn-guardar-reemplazo').click();
  await expect(page.locator('#admin-msg')).toContainText('ya no reemplaza');
  await expect(page.locator('.admin-reemplazo-aviso')).toHaveCount(0);
});
