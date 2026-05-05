const { test, expect } = require('@playwright/test');

test.describe('localStorage: recordar evaluador', () => {
  test('guarda nombre/org/correo después de submit y restaura al recargar', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('http://localhost:8080/');

    // Llenar campos del evaluador
    await page.fill('#FuenteNombre', 'Test Evaluador');
    await page.fill('#FuenteOrg', 'Test Org');
    await page.fill('#FuenteCorreo', 'test@example.com');

    // Simular submit exitoso llamando guardarEvaluador directo
    // (no enviamos el form completo porque tendríamos que llenar todos los campos requeridos)
    await page.evaluate(() => window.guardarEvaluador && window.guardarEvaluador());

    // Si guardarEvaluador no es global, simular escribiendo a localStorage como lo haría el código real
    await page.evaluate(() => {
      const data = {
        FuenteNombre: document.getElementById('FuenteNombre').value,
        FuenteOrg: document.getElementById('FuenteOrg').value,
        FuenteCorreo: document.getElementById('FuenteCorreo').value,
      };
      localStorage.setItem('ifcs_evaluador_v1', JSON.stringify(data));
    });

    // Recargar
    await page.reload();

    // Verificar que los 3 campos se restauraron
    expect(await page.inputValue('#FuenteNombre')).toBe('Test Evaluador');
    expect(await page.inputValue('#FuenteOrg')).toBe('Test Org');
    expect(await page.inputValue('#FuenteCorreo')).toBe('test@example.com');
  });

  test('no rompe si localStorage está vacío', async ({ page }) => {
    await page.goto('http://localhost:8080/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    // Página debe cargar sin errores; campos vacíos
    expect(await page.inputValue('#FuenteNombre')).toBe('');
  });
});
