# Bitácora — Calculadora del IFCS

**Qué es:** herramienta pública para evaluar si un puente antipeatonal puede sustituirse por un cruce seguro (Índice de Factibilidad de Cruce Seguro). Para Liga Peatonal / Bicivilízate Michoacán A.C.; la contraparte es Nadia F. (metodología). Pro bono.
**Dónde vive:** repo `nadiafigo/Calculadora-del-IFCS` (de Nadia; Memo pushea directo) · producción https://adiospuentesantipeatonales.org (GitHub Pages) · Supabase **`tnlxfzruypugbttafeyf` ("cuervo-cafe", org *Made by humans*, Pro)** desde el 15/10/2026; compartido con el sitio de Cuervo Café, también de Nadia. El proyecto anterior `fhzowyajnckiylxzywjb` ("CouncilAI", org free) quedó pausado y ya no se usa.
**Stack:** HTML/CSS/JS vanilla sin build, Supabase por REST (anon key) + magic link para el admin, Playwright para e2e. Carpeta local: `dev/Nadia/Calculadora/Calculadora-IFCS-fixed` (la hermana `Calculadora-zip` es una copia vieja).

---

## 📸 ESTADO AL 11/11/2026

*(Esta sección se reescribe completa en cada actualización.)*

**Hecho y funcionando**
- Sitio rediseñado («El plano y el archivo») y auditoría del 10/11 en producción, con migraciones 001→012 aplicadas en `cuervo-cafe`. Verificado en vivo el 11/11/2026 ~22:45 UTC: archivo con 88 fichas (las 88 con «Datos de <mes año>»), mapa, estadísticas con 88 filas, formulario con «No pude medirla», consola sin errores, `test:prod-smoke` 9/9.
- Reemplazo de evaluaciones: columna `reemplazada_por`, control «Reemplaza a» en la pestaña Aprobadas del panel, y páginas públicas que sólo piden las vigentes. Hoy ninguna evaluación está reemplazada.
- Panel: sólo los 3 correos de `ifcs_admins`; anon no lee `fuente_correo` ni puede insertar filas aprobadas, retiradas o con reemplazo.

**A medias**
- El control «Reemplaza a» está probado con sesión simulada (spec `reemplazo`), no con una sesión real de admin: falta que Nadia o Memo lo usen una vez en el panel de verdad.

**Bloqueado (depende de Nadia, desde el 11/11/2026)**
- Corte mediano/corto de 60 a 55: lo confirma con su compañera; falta saber si se reclasifican las ya guardadas (56 a 60) y el texto de la nota en la página.
- Tabla de ponderación: «Características del puente: 15» pero sus renglones suman 23.
- Oficio modelo para autoridades (dijo «deja te paso el oficio»), fotos de los 2 puentes sustituidos, y ~28 evaluaciones pendientes de aprobar en su panel.

**Siguiente paso**
- Cuando Nadia confirme el 55: cambiar el corte en `js/form.js` (≈línea 791), la marca de la barra del reporte, metodología y, si lo pide, reclasificar `factibilidad` en la base.

**De Memo, sin prisa**
- Borrar el proyecto `CouncilAI` pausado; decidir si se reescribe el historial por el correo en el commit `0fd8ad1`.

---

## 11/11/2026 — Nadia vio el rediseño y pidió reemplazo de evaluaciones, fecha en la ficha y «No pude medirla»

**Qué pasó**
- Nadia: «Wooooow, está increíble», «si es un cambiazo», «Se ve más geek 🤓 me gusta». En nota de voz planteó dos cosas: bajar el corte mediano/corto a 55 «así como estaba antes» (los de 56-57 le parecen factibles a corto plazo) y que algunos puentes de Morelia ya tienen abajo un puente vehicular que no existía cuando se levantaron los datos.
- Se le propuso fecha visible + que la evaluación nueva reemplace a la anterior; contestó «Me late lo del reemplazo». Sobre los condicionales: siguen obligatorios («al menos con Google Earth se puede medir») y sólo la pendiente de la rampa lleva «no pude medirlo», con 0 puntos, por las rampas circulares.

**Qué cambió** (PR #4, merge `66eb486`; suite 132/132)
- `012_reemplazo_de_evaluaciones.sql`, **aplicada el 11/11/2026 antes del deploy**: `reemplazada_por` (FK a la misma tabla, `ON DELETE SET NULL`), GRANT de esa columna a anon, `insert_pendiente` exige que venga nula, y `get_evaluacion_publica` agrega `reemplazo_token` (token de la vigente, sólo si está aprobada).
- `ARCHIVO_FILTRO_VIGENTES` (`aprobado_mapa=eq.true&reemplazada_por=is.null`) en archivo, portada, mapa y estadísticas. El reporte de una reemplazada sigue abriendo y muestra `#aviso-reemplazo` con enlace a la vigente.
- Ficha y popup del mapa muestran `fuente_fecha` (fecha de levantamiento), no `created_at`: 86 de las 88 se capturaron en mayo de 2026 pero 57 son datos de 2019.
- `PtePendiente_nomedida` (valor 0); el reporte la redacta como «no se registró su pendiente».

**Decisiones y descartes**
- El reemplazo lo marca el admin a mano, no se detecta por coordenadas: las capturadas a mano no coinciden exactas. Se marca desde la tarjeta de la evaluación NUEVA y sólo ofrece aprobadas de la misma ciudad; por eso el control vive sólo en la pestaña Aprobadas (si la nueva estuviera pendiente, el puente desaparecería del sitio).
- La columna va en la fila vieja para que el filtro público sea un `is.null` sin joins.
- Orden obligado: migración primero. Con los privilegios por columna de la 011, filtrar por una columna sin GRANT da 401 y el sitio se queda vacío.
- La lista de ciudades sugeridas del formulario (`form.js`, `select=loc_ciudad`) no lleva el filtro de vigentes, a propósito.

**Datos raros vistos, sin tocar**
- P-205 dice datos de mayo de 1996 y P-212 trae `fuente_fecha` 2026-08-01, posterior a su captura (02/07/2026). Son de antes de la validación de fecha; avisarle a Nadia si se quiere corregir.

---

## 10/11/2026 (noche) — Auditoría de Fable arreglada: seguridad, reporte, formulario, SEO y pruebas

**Qué pasó**
- Memo pidió una segunda opinión; Fable auditó (15 puntos con evidencia) y Memo dijo «arreglados todos con opus 5.5, pídele el visto bueno a fable». Se hizo en 4 lotes paralelos con dueño exclusivo de archivos (base · reporte/mapa/estadísticas · formulario · SEO/a11y/CI), integración con la suite completa (122/122) y revisión final de Fable: «aprobado con cambios menores», que se arreglaron antes de publicar (duplicado de la cola, fórmulas en lat/long del CSV, correo personal en `docs/PRESENTATION-CHECKLIST.md`, correo del pie partido).

**Base de datos**
- `010_permisos_admin_y_aprobacion.sql` **aplicada el 11/11/2026 03:15 UTC**: el INSERT anónimo sólo crea filas pendientes (`insert_pendiente`); anon sin UPDATE/DELETE/TRUNCATE (antes podía TRUNCATE); el panel sólo para `public.ifcs_admins` vía `es_admin_ifcs()` (el usuario de Cuervo Café ya no ve ni edita evaluaciones); el RPC `get_evaluacion_publica` ya no devuelve `fuente_correo`. Rollback en el reporte del lote (estado previo en el scratchpad de la sesión).
- `ifcs_admins` tiene 3 correos: el institucional (en la migración) y los gmails de Memo y Nadia, **dados de alta a mano** porque el repo es público. Un admin nuevo necesita el usuario en Auth **y** su fila en `ifcs_admins`.
- `011_ocultar_correo_a_anon.sql` **aplicada el 11/11/2026 ~06:30 UTC**, ~10 min después del deploy (caché de Pages): anon recibe 401 al pedir `fuente_correo` o `select=*`; las columnas públicas siguen dando 88. Se aplicó con `npx supabase db query --remote --yes -f …` (la CLI 3.x pide `--yes` para escribir en producción). Deshacer: `GRANT SELECT ON TABLE public.evaluaciones TO anon;`.
- Publicado con PR #3 (`7cb25f5`). Verificado en vivo: 7 páginas 200 en 1440/390, datos reales, 404 propio, `npm run test:prod-smoke` 9/9.
- CI: `ubuntu-latest` ya es 26.04 y Playwright 1.58 no lo soporta, y `playwright install` se colgaba descargando Chromium: el workflow usa el contenedor `mcr.microsoft.com/playwright:v1.58.2-noble` (al subir `@playwright/test`, subir la etiqueta) y `npx http-server` en vez de python. Pasa en ~2.5 min.

**Frontend**
- Inyección cerrada: todo dato de base/URL/localStorage va escapado o por `textContent` (spec `reporte-seguridad`, probado por mutación).
- Reporte: frases correctas con condicionales vacíos, folio/fecha/colectivo, título dinámico, marcas 30/60, WhatsApp, estado vacío, aviso `pendiente=1`. Fotos en 800/1200 webp+jpg: 6.3 MB → ~0.5 MB.
- Formulario: borrador, cola con reintento (reusa el token si se vuelve a enviar), avance por paso, validación (correo, coordenadas, fecha, condicionales visibles), datalist de ciudades, labels reales y foco al primer error; el texto del correo ya no dice «solo tú los ves».
- Mapa con «Ver reporte», CSV en estadísticas, og 1200×630, canonical, robots, sitemap, 404 propio, «Saltar al contenido», SRI en todas las librerías, CI de Playwright en `.github/workflows/e2e.yml`.

**Pendiente de Nadia (no se tocó sin ella)**
- La tabla de ponderación: «Características del puente: 15» pero sus renglones suman 23 (máximo posible 103).
- Si los condicionales deben ser obligatorios con opción «no pude medirlo» (hoy se exigen mientras se ven).
- 29 evaluaciones pendientes de aprobar en el panel.
- Texto modelo de un oficio para autoridades; fotos de los 2 puentes sustituidos.
- El correo personal sigue en el historial de git de `docs/PRESENTATION-CHECKLIST.md` (commit `0fd8ad1`); se quitó del archivo, no se reescribió historia.

---

## 10/11/2026 — Rediseño: se eligió «El plano y el archivo» y hay maqueta de portada

**Qué pasó**
- Memo pidió un revamp de TODO el sitio («ONG moderna, no aburrida ni outdated, pero que no se vea tan loco»). Con `sitio-direcciones` se capturaron 50 referencias (lotes en `dev/Nadia/Calculadora/_referencias/a` y `b`), se armó un tablero con 10 direcciones + 3 suplentes (https://claude.ai/artifact/5aZmPgWFZQ6uC3t6MnzLqE; copia en `dev/_propuestas-diseno/2026-11-10-liga-peatonal/`) y Memo eligió la mezcla 1 + 4: MobilityLab (lámina de plano con retícula, mapa, bento) + Obama Oral History (archivo de fichas).
- Maqueta medida en 1440/1024/820/390: sin desborde, h1 68→38 px, CTA dentro del primer pantallazo en 1440×900, 88 marcadores, cifras calculadas de los datos.

**Decisiones y descartes**
- Acento: verde del logo `#139146` (texto/botones en `#0B6A33` para AA); amarillo Liga sólo como señal. Schibsted Grotesk + Azeret Mono. Ver `docs/CONCEPTO.md`.
- Base del mapa: CARTO ahora devuelve teselas con «API KEY REQUIRED»; se usa Esri World Light Gray (sin llave). La escala del cajetín se calcula del mapa, no es decorativa.
- La maqueta no se publica como Artifact: el CSP de Artifacts bloquea teselas y la hoja de estilos de Leaflet. Se revisa abriendo el archivo local.

**Rediseño aplicado al sitio (misma fecha, tras «muy bien modifica la pagina web»)**
- `css/gral.css` reescrito: tokens nuevos + alias de los viejos (`--darkBlue`, `--yellow`…) para no romper hojas de página; cabecera y pie nuevos. La cabecera y el pie de las 7 páginas los escribe `docs/unificar_cabecera_pie.py` (no hay build: si cambia un link del menú, se cambia ahí y se vuelve a correr). Admin conserva su cabecera sin menú.
- Portada (`index.html` + `home.css`): plano de Morelia, cotas, bento, últimas 8 fichas, por qué, y la calculadora como lámina 03 con cada sección como paso (ids, names y clases que lee `form.js` intactos). JS nuevo: `js/archivo.js` (carga sólo columnas públicas, nunca nombre/correo; normaliza ciudades) y `js/portada.js`.
- Página nueva `html/archivo.html`: las fichas con filtros por plazo, sustituidos, ciudad y búsqueda; cada ficha abre `resultado.html?r=<token>`.
- Interiores en paralelo con dos agentes de dueño exclusivo: metodología (índice lateral fijo, tabla técnica) y estadísticas (cotas, Chart.js en paleta nueva); mapa (panel lámina, base Esri gris, marcadores por plazo, cajetín), reporte (puntaje con barra y marca del 50, fichas, propuestas plegables) y admin.
- Mapa y estadísticas unifican ciudades con `archivoUnificarCiudades` (ya no cuentan «MERIDA» y «Merida» por separado: 15, no 16).
- Pruebas: los specs `mapa-selector` y `local-storage-evaluador` tienen `localhost:8080` escrito a mano y ese puerto es de Docker en esta máquina; se corrieron con copias temporales apuntando a 8089.

**Hallazgos para Memo**
- La lectura pública (anon) de `evaluaciones` aprobadas devuelve `fuente_nombre` y `fuente_correo` de quien evaluó: cualquiera con la anon key ve correos personales. No se tocó; pendiente decidir si se restringen columnas (vista pública o `GRANT` por columna).
- Las ciudades vienen escritas de varias formas («MERIDA»/«Merida», «irapuato»): normalizadas son 15, el dashboard actual dice 16.

---

## 15/10/2026 — El mapa se quedó sin datos: Supabase pausado; la base se mudó al proyecto de Cuervo Café

**Qué pasó**
- Nadia avisó que el mapa no servía. El proyecto `CouncilAI` (org free "Liga Peatona") estaba `INACTIVE`: Supabase lo pausó y desmontó el subdominio, así que `fetch` fallaba en silencio y el mapa, las estadísticas, el formulario y los links permanentes se quedaban vacíos. El sitio (GitHub Pages) seguía respondiendo 200.
- Memo había movido el proyecto de la org Pro a la free el 01/10/2026 pensando que ya no se usaba (el `linked-project.json` del 05/05 todavía lo tenía en *Made by humans*).

**Qué cambió**
- `js/config.js` apunta a `https://tnlxfzruypugbttafeyf.supabase.co` con la anon key de ese proyecto (commit `b9b0cc3` en `main`; Pages lo sirvió en ~2 min).
- En `cuervo-cafe` se aplicaron las migraciones 001→009 tal cual (vía Management API `POST /v1/projects/{ref}/database/query`), se quitó la policy `allow_anon_insert` que la 004 crea y el proyecto viejo ya no tenía (duplicada de `public_insert`), y se copiaron las 114 filas con `json_populate_recordset` + `OVERRIDING SYSTEM VALUE` + `setval` de la secuencia.
- Auth de `cuervo-cafe`: `uri_allow_list` con las tres URLs del panel admin; dos usuarios creados con `email_confirm`. `disable_signup` sigue en `true`, así que solo entran correos ya dados de alta.
- README: sección nueva "Base de datos (Supabase)". `supabase/.temp` relinkeado al proyecto nuevo (está en `.gitignore`).

**Por qué así**
- Memo pidió no revivir el viejo sino "ponerlo en una que se use mucho y que se sepa que no caerá". `cuervo-cafe` es de la misma clienta (no se mezclan datos de clientes distintos), vive en la org Pro y tiene keep-alive y tráfico diario.
- Se preservaron `id` y `public_token` para que los links permanentes ya repartidos sigan sirviendo.

**Lo que costó**
- Para copiar los datos había que encender el viejo, y el plan free solo permite 2 proyectos activos por dueño: los ocupaban **Arcana** y **amanti-store** (la org amantisocialmedia también es free). Pausé `legalstock-dev` creyendo que contaba y no liberó nada; Memo decidió pausar `amanti-store` ("de hecho apaga amanti"). Con el lugar libre: restore de CouncilAI (~5 min), copia, pausa de CouncilAI y restore de `legalstock-dev`. Estado final: `amanti-store` y `CouncilAI` pausados, `legalstock-dev` y `Arcana` activos.
- La Management API no tiene endpoint para transferir un proyecto de org (`/transfer` → "Cannot POST"); eso solo se hace desde el dashboard. La extensión de Chrome no tiene permiso para supabase.com.
- El token de la CLI de Supabase vive en el Credential Manager de Windows, target `Supabase CLI:supabase` (se leyó con `CredRead` desde PowerShell).
- Esta máquina tardaba 30-60 s en arrancar cada comando de shell; todo lo largo se corrió en segundo plano con log + monitor.

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
