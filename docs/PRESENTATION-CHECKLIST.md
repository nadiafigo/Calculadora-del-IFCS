# Pre-flight checklist — Presentación IFCS

Ejecutar en orden. Cada bloque marca un riesgo distinto.

## A. Walk-through como visitante (5 min)

- [ ] Abrir `https://adiospuentesantipeatonales.org` en ventana nueva (idealmente incognito).
- [ ] Click en navegación → recorrer Inicio, Antecedentes, Mapa, Analytics. Verificar que cargan sin pantalla en blanco.
- [ ] Volver a Inicio → llenar formulario con datos válidos de prueba.
- [ ] Verificar validación: dejar un campo requerido vacío, confirmar shake animation + toast.
- [ ] Submit completo → verificar toast de éxito + redirect a resultado.
- [ ] En resultado: ver índice IFCS, sección "Propuestas de rediseño" (acordeón) con normas linkeadas.
- [ ] Descargar PDF → abrirlo → verificar que propuestas aparecen como lista plana embebida.
- [ ] Click "Ver mapa" desde el checkbox de consentimiento.
- [ ] En mapa: probar los 8 filtros, verificar que markers cambian. La evaluación recién creada NO debe aparecer (pendiente de aprobación).

## B. Smoke admin (5 min)

- [ ] Abrir `https://adiospuentesantipeatonales.org/html/admin.html`.
- [ ] Pedir magic link a `guillermo.sanchezy@gmail.com`. Confirmar que llega.
- [ ] Click el link → verificar acceso al panel.
- [ ] Ver lista de evaluaciones. Pickar 1 seed cualquiera.
- [ ] Cambiar `status_retiro` a "Retirado", agregar `fecha_retiro` (ej: "Test 2026-05-05"). Guardar.
- [ ] Abrir `/html/mapa.html` en otra pestaña → verificar marker del seed ahora es verde.
- [ ] Aplicar filtro "Status retiro" → "Retirado": confirmar que solo aparece el seed editado.
- [ ] Abrir `/html/analytics.html` → verificar KPI "Sustituidos" subió +1.
- [ ] Volver al admin → revertir el seed (`status_retiro` → NULL/vacío, limpiar fecha). Guardar.
- [ ] Verificar rollback: marker vuelve a color original, KPI vuelve a estado previo.

## C. Sanity técnica (2 min)

- [ ] Correr `npm run test:e2e` con server local levantado (`npx http-server -p 8080 -s` en otra terminal). Esperar 38/38 verde.
- [ ] Correr `npm run test:prod-smoke` (no requiere server local). Esperar 6/6 verde.
- [ ] Abrir DevTools en homepage de prod → tab Console. Recargar. Verificar que no hay errores en rojo (warnings amarillos OK).
- [ ] Verificar OG card: pegar `https://adiospuentesantipeatonales.org` en el composer de FB o WhatsApp, ver que la preview se ve bien.

## D. Backup pre-import (3 min, antes de meter los 56)

- [ ] Login a Supabase dashboard del proyecto IFCS.
- [ ] Tabla `evaluaciones` → exportar CSV (todas las rows).
- [ ] Guardar archivo localmente como `backup-evaluaciones-YYYYMMDD-pre-import.csv`.

---
Si cualquier paso falla, parar y triagear antes de presentar.
