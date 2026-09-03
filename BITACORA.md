# Bitácora — Calculadora del IFCS

**Qué es:** herramienta pública para evaluar si un puente antipeatonal puede sustituirse por un cruce seguro (Índice de Factibilidad de Cruce Seguro). Para Liga Peatonal / Bicivilízate Michoacán A.C.; la contraparte es Nadia F. (metodología). Pro bono.
**Dónde vive:** repo `nadiafigo/Calculadora-del-IFCS` (de Nadia; Memo pushea directo) · producción https://adiospuentesantipeatonales.org (GitHub Pages) · Supabase `fhzowyajnckiylxzywjb`, que en el dashboard se llama **"CouncilAI"** (nombre engañoso, no borrar ni pausar).
**Stack:** HTML/CSS/JS vanilla sin build, Supabase por REST (anon key) + magic link para el admin, Playwright para e2e. Carpeta local: `dev/Nadia/Calculadora/Calculadora-IFCS-fixed` (la hermana `Calculadora-zip` es una copia vieja).

---

## 📸 ESTADO AL 03/09/2026

*(Esta sección se reescribe completa en cada actualización.)*

**Hecho y funcionando**
- Producción con el link permanente del reporte (PR #1 mergeado el 03/09/2026, GitHub Pages publicó en ~1 min). Verificado en vivo con una evaluación de mayo (`?r=e0a0ce9a…`, Rey Tangaxoan, 37%): diagnóstico, propuestas y caja del enlace correctos aunque la fila no tiene `respuestas`.
- Migración 009 aplicada en Supabase: 114 evaluaciones, 114 tokens; anon sigue sin poder listar filas no aprobadas.
- Lo anterior (06/05/2026): formulario con validación, resultado con propuestas y PDF, mapa con filtros, estadísticas, admin con aprobación manual y status de retiro.

**A medias**
- Nada.

**Bloqueado**
- Nada del lado del cliente.

**Siguiente paso**
- Avisarle a Nadia que cada evaluación nueva muestra su enlace al terminar (y en el PDF), y que desde el admin puede abrir o mandar el de cualquiera con "Ver reporte ↗".

---

## 03/09/2026 — Link permanente en producción

**Qué cambió**
- PR #1 mergeado a `main`; Pages lo publicó. Prueba en vivo con una evaluación histórica: OK.

**Por qué**
- Memo dio luz verde ("podemos ir haciendo lo de la calculadora") una vez que la suite local pasó 15/15 y la migración estaba aplicada.

**Decisiones y descartes**
- Se probó primero con una fila **sin** `respuestas` a propósito: es el caso más frágil (reconstrucción de ids leyendo `index.html`) y el que cubre a las 114 evaluaciones existentes.

---

## 02/09/2026 — Nadia pidió que el reporte "quede en la nube"; se hizo con link permanente, no con PDFs guardados

**Qué cambió**
- Migración 009: `public_token` (UUID único, con default para las filas existentes), `respuestas` (JSONB con id/texto/valor de cada opción elegida) y función `get_evaluacion_publica(token)` SECURITY DEFINER.
- `form.js` genera el token antes del INSERT y redirige con `&r=` solo si la fila quedó guardada. `resultado.js` acepta dos fuentes (localStorage o Supabase) y reconstruye el mismo reporte; caja "Guarda este enlace", link en el PDF, "Ver reporte ↗" en el admin. Seis casos e2e nuevos.
- Migración 009 aplicada al proyecto linkeado el 03/09/2026 con `npx supabase db query --linked -f ...` (sin password de la base): 114 filas, 114 tokens distintos, función creada. Se aplicó antes de mergear el frontend porque es aditiva y el código viejo la ignora.

**Por qué**
- Nota de voz de Nadia (01/09/2026): "me preguntan que si no habría posibilidad de que el reporte que se genera quedara siempre disponible en la nube, o más bien que se pudiera volver a generar con los datos guardados". Varias personas se lo han pedido.

**Decisiones y descartes**
- Regenerar desde los datos en vez de guardar PDFs en Storage: cero costo de almacenamiento, el reporte siempre sale con la metodología vigente (los rangos ya cambiaron una vez, 06/05/2026) y no hay archivos huérfanos si se borra una evaluación.
- El token lo genera el navegador, no la base: el INSERT va con `return=minimal` porque RLS impide al anon leer filas sin aprobar (fix del 05/05/2026), así que no hay forma de recibir un id generado en el servidor.
- Función SECURITY DEFINER en vez de abrir el SELECT de anon: anon sigue sin poder listar evaluaciones pendientes; solo resuelve un token exacto (UUID v4, no enumerable). El `id` secuencial no sirve como entrada.
- Columna `respuestas` + reconstrucción por texto: el diagnóstico decide por el **id** de la opción y la base solo guardaba el **texto**. Las filas nuevas llevan los ids; las viejas se resuelven leyendo las opciones de `index.html` en tiempo de ejecución. Así las 50+ evaluaciones históricas también tienen link desde el admin.
- Tests: el puerto 8080 de esta máquina lo tiene Docker Desktop (`localhost:8080` da 404 aunque levantes http-server); se corrieron en 8089 con un config temporal. No había `node_modules`: hubo que `npm ci` + `npx playwright install chromium`.
- Recién enviado el formulario, `resultado.html` NO pide la fila a Supabase aunque la URL traiga el token: usa el localStorage que acaba de escribir `form.js`. La primera versión sí la pedía y el test viejo del formulario falló por latencia de red en esta máquina; además así el reporte del evaluador no depende de la base para verse. La consulta remota queda solo para links abiertos en otro navegador.
