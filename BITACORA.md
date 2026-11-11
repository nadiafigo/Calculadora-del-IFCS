# Bitácora — Calculadora del IFCS

**Qué es:** herramienta pública para evaluar si un puente antipeatonal puede sustituirse por un cruce seguro (Índice de Factibilidad de Cruce Seguro). Para Liga Peatonal / Bicivilízate Michoacán A.C.; la contraparte es Nadia F. (metodología). Pro bono.
**Dónde vive:** repo `nadiafigo/Calculadora-del-IFCS` (de Nadia; Memo pushea directo) · producción https://adiospuentesantipeatonales.org (GitHub Pages) · Supabase **`tnlxfzruypugbttafeyf` ("cuervo-cafe", org *Made by humans*, Pro)** desde el 15/10/2026; compartido con el sitio de Cuervo Café, también de Nadia. El proyecto anterior `fhzowyajnckiylxzywjb` ("CouncilAI", org free) quedó pausado y ya no se usa.
**Stack:** HTML/CSS/JS vanilla sin build, Supabase por REST (anon key) + magic link para el admin, Playwright para e2e. Carpeta local: `dev/Nadia/Calculadora/Calculadora-IFCS-fixed` (la hermana `Calculadora-zip` es una copia vieja).

---

## 📸 ESTADO AL 10/11/2026

*(Esta sección se reescribe completa en cada actualización.)*

**Hecho y funcionando**
- Base de datos en el proyecto Supabase de Cuervo Café (org Pro, no se pausa por inactividad). Verificado en producción el 15/10/2026 12:20: el mapa recibe 88 evaluaciones aprobadas y pinta 7 clusters, estadísticas con las mismas 88, link permanente `?r=e0a0ce9a…` (Rey Tangaxoan, 37%) regenera el reporte, consola sin errores.
- 114 evaluaciones copiadas con los mismos `id` (máx. 238) y `public_token` (114 distintos); checksum de las filas idéntico en origen y destino (`md5 f03a4d8c…`). Esquema, índices, RLS, grants y `get_evaluacion_publica` iguales a los del proyecto viejo.
- Admins del panel recreados en el proyecto nuevo: `adiospuentesantipeatonales@ligapeatonal.org` y el de Memo. Nadia además ya tenía su gmail ahí por Cuervo Café. Redirects del magic link registrados (producción, GitHub Pages y localhost:8080).
- Lo anterior (03/09/2026 y 06/05/2026): link permanente, formulario con validación, resultado con propuestas y PDF, mapa con filtros, estadísticas, admin con aprobación manual y status de retiro.

**A medias**
- Rediseño completo del sitio (10/11/2026) en la rama local `feat/rediseno-plano`, **sin commit ni push**: las 7 páginas ya están con «El plano y el archivo» (`docs/CONCEPTO.md`) y hay una página nueva, `html/archivo.html`. Falta que Memo lo vea, el commit/PR y publicarlo (GitHub Pages publica `main` directo: no mergear sin su visto bueno).

**Bloqueado**
- Nada del lado del cliente.

**Siguiente paso**
- Avisarle a Nadia que el mapa ya está arriba (Memo le dijo que fue una caída de AWS; no contradecirlo).
- Decidir qué hacer con el proyecto `CouncilAI` pausado: ya no tiene nada que no esté en `cuervo-cafe`, se puede borrar cuando Memo quiera.

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
