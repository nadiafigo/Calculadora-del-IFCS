const { test, expect } = require('@playwright/test');

test.describe('Mapa selector de ubicación', () => {
  test('botón abre y cierra el modal', async ({ page }) => {
    await page.goto('http://localhost:8080/');
    await page.click('#btn-abrir-mapa');
    await expect(page.locator('#mapa-modal')).not.toHaveClass(/hidden/);
    await page.click('#btn-cerrar-mapa');
    await expect(page.locator('#mapa-modal')).toHaveClass(/hidden/);
  });

  test('botón confirmar arranca disabled', async ({ page }) => {
    await page.goto('http://localhost:8080/');
    await page.click('#btn-abrir-mapa');
    await expect(page.locator('#btn-confirmar-mapa')).toBeDisabled();
  });

  test('ESC cierra el modal', async ({ page }) => {
    await page.goto('http://localhost:8080/');
    await page.click('#btn-abrir-mapa');
    await page.keyboard.press('Escape');
    await expect(page.locator('#mapa-modal')).toHaveClass(/hidden/);
  });

  test('llenar coords manualmente sigue funcionando (no rompe el form)', async ({ page }) => {
    await page.goto('http://localhost:8080/');
    await page.fill('#LocX', '-101.1844');
    await page.fill('#LocY', '19.7008');
    expect(await page.inputValue('#LocX')).toBe('-101.1844');
    expect(await page.inputValue('#LocY')).toBe('19.7008');
  });
});
