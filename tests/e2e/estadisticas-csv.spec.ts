import { test, expect, Page } from "@playwright/test";
import * as fs from "fs";

// Estadísticas (analytics.html): columnas explícitas en la consulta, tabla
// sin inyección de HTML y botón «Descargar datos (CSV)» con sólo columnas
// públicas de las filas filtradas (nunca nombre ni correo de quien evaluó).

const PAYLOAD = "<img src=x onerror=window.__xss=1>";

const ENCABEZADOS = [
  "id", "folio", "ciudad", "vialidad", "colonia", "referencia", "latitud", "longitud",
  "ifcs", "plazo", "status_retiro", "fecha_retiro", "tipo_acceso", "fecha_evaluacion",
];

// El stub incluye nombre y correo a propósito: aunque llegaran, no deben salir.
const FILAS = [
  {
    id: 12, created_at: "2026-03-02T10:00:00Z",
    loc_ciudad: "Morelia", loc_vialidad: "Av. Camelinas", loc_colonia: "Félix Ireta",
    loc_referencia: "Glorieta, \"la del reloj\"", loc_x: "-101.18", loc_y: "19.68",
    total_ifcs: 64, factibilidad: "Corto plazo", status_retiro: "Retirado", fecha_retiro: "Mayo, 2019",
    fuente_org: "Liga Peatonal", pte_tipo_acc: "Escaleras",
    fuente_nombre: "Persona Privada", fuente_correo: "privado@example.com",
  },
  {
    id: 238, created_at: "2026-10-15T10:00:00Z",
    loc_ciudad: "Saltillo", loc_vialidad: PAYLOAD, loc_colonia: "=HYPERLINK(\"http://x\")",
    loc_referencia: PAYLOAD, loc_x: "-101.0", loc_y: "25.42",
    total_ifcs: 49, factibilidad: "Mediano plazo", status_retiro: null, fecha_retiro: null,
    fuente_org: PAYLOAD, pte_tipo_acc: "Rampa",
    fuente_nombre: "Otra Persona", fuente_correo: "otra@example.com",
  },
  {
    id: 5, created_at: "2025-12-01T10:00:00Z",
    loc_ciudad: "Morelia", loc_vialidad: "Periférico", loc_colonia: null,
    loc_referencia: null, loc_x: null, loc_y: null,
    total_ifcs: 18, factibilidad: "Largo plazo", status_retiro: "Pendiente", fecha_retiro: null,
    fuente_org: null, pte_tipo_acc: "Escaleras",
    fuente_nombre: "Tercera", fuente_correo: "tercera@example.com",
  },
];

async function stubEvaluaciones(page: Page) {
  const urls: string[] = [];
  await page.route(/\/rest\/v1\/evaluaciones\?select=/, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    urls.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(FILAS),
    });
  });
  return urls;
}

async function descargarCsv(page: Page) {
  const descarga = page.waitForEvent("download");
  await page.locator("#descargar-csv").click();
  const d = await descarga;
  const ruta = await d.path();
  return { nombre: d.suggestedFilename(), texto: fs.readFileSync(ruta!, "utf-8") };
}

test.describe("Estadísticas: consulta, tabla y CSV", () => {

  test("pide columnas explícitas, sin select=* ni correo", async ({ page }) => {
    const urls = await stubEvaluaciones(page);
    await page.goto("/html/analytics.html");
    await expect(page.locator("#kpi-total")).toHaveText("3", { timeout: 10000 });

    const select = new URL(urls[0]).searchParams.get("select") || "";
    const cols = select.split(",");
    expect(select).not.toBe("*");
    expect(cols).not.toContain("*");
    expect(cols).not.toContain("fuente_correo");
    expect(cols).not.toContain("fuente_nombre");
    expect(cols).toEqual(expect.arrayContaining(["id", "loc_colonia", "loc_x", "loc_y", "status_retiro", "pte_tipo_acc"]));
  });

  test("la tabla pinta los textos literales", async ({ page }) => {
    await stubEvaluaciones(page);
    await page.goto("/html/analytics.html");
    await expect(page.locator("#tabla-body tr")).toHaveCount(3, { timeout: 10000 });
    await expect(page.locator("#tabla-body td", { hasText: "onerror" }).first()).toHaveText(PAYLOAD);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
    expect(await page.locator('#tabla-body img').count()).toBe(0);
  });

  test("descarga un CSV con columnas públicas y sin datos de quien evaluó", async ({ page }) => {
    await stubEvaluaciones(page);
    await page.goto("/html/analytics.html");
    await expect(page.locator("#kpi-total")).toHaveText("3", { timeout: 10000 });
    await expect(page.locator("#descargar-csv")).toBeVisible();

    const { nombre, texto } = await descargarCsv(page);
    expect(nombre).toMatch(/^ifcs-evaluaciones-todas-\d{4}-\d{2}-\d{2}\.csv$/);

    const limpio = texto.replace(/^﻿/, "");
    const lineas = limpio.trim().split(/\r\n/);
    expect(lineas[0]).toBe(ENCABEZADOS.join(","));
    expect(lineas).toHaveLength(1 + FILAS.length);

    // Sin columnas ni valores personales
    expect(lineas[0]).not.toMatch(/correo|nombre|email/i);
    expect(limpio).not.toContain("@example.com");
    expect(limpio).not.toContain("Persona Privada");

    // Fila de Morelia: comillas escapadas, coordenadas numéricas, folio
    const morelia = lineas.find(l => l.startsWith("12,"))!;
    expect(morelia).toBe('12,P-012,Morelia,Av. Camelinas,Félix Ireta,"Glorieta, ""la del reloj""",19.68,-101.18,64,Corto plazo,Retirado,"Mayo, 2019",Escaleras,2026-03-02');

    // Fórmula neutralizada y payload como texto
    const saltillo = lineas.find(l => l.startsWith("238,"))!;
    expect(saltillo).toContain(`"'=HYPERLINK(""http://x"")"`);
    expect(saltillo).toContain(PAYLOAD);
    expect(saltillo).toContain(",Pendiente,");
  });

  test("el CSV respeta el filtro de ciudad", async ({ page }) => {
    await stubEvaluaciones(page);
    await page.goto("/html/analytics.html");
    await expect(page.locator("#kpi-total")).toHaveText("3", { timeout: 10000 });
    await page.selectOption("#filtro-global-ciudad", "Morelia");
    await expect(page.locator("#kpi-total")).toHaveText("2");

    const { nombre, texto } = await descargarCsv(page);
    expect(nombre).toMatch(/^ifcs-evaluaciones-morelia-/);
    const lineas = texto.replace(/^﻿/, "").trim().split(/\r\n/);
    expect(lineas).toHaveLength(3);
    expect(lineas.slice(1).every(l => l.split(",")[2] === "Morelia")).toBe(true);
  });
});
