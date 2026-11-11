# Calculadora del IFCS — Índice de Factibilidad de Cruce Seguro

Herramienta web para evaluar si un puente antipeatonal puede sustituirse por un cruce peatonal seguro a nivel de calle. Desarrollada para Liga Peatonal / Bicivilízate Michoacán A.C.

Producción: **https://adiospuentesantipeatonales.org** (GitHub Pages desde `main`, dominio en `CNAME`).

## Stack

- **HTML + CSS + JavaScript vanilla**, sin build step ni framework: lo que está en el repo es lo que se publica.
- **Supabase** como base de datos (tabla `evaluaciones`), consultada por REST con la anon key de `js/config.js`. El panel admin entra con magic link (`@supabase/supabase-js` fijado a una versión exacta con SRI).
- **GitHub Pages** sirve el sitio desde la rama `main`. Cada push a `main` se publica en un par de minutos.
- **Leaflet** para los mapas (base Esri World Light Gray, sin llave) y **Chart.js** para las estadísticas, ambos desde CDN.
- **Playwright** para las pruebas e2e; GitHub Actions las corre en cada PR y en cada push a `main` (`.github/workflows/e2e.yml`).

Sistema visual «El plano y el archivo»: ver `docs/CONCEPTO.md`. Tokens (colores, tipografías Schibsted Grotesk + Azeret Mono) en `css/gral.css`.

## Estructura del proyecto

```
├── index.html                ← Portada: plano de Morelia, últimas fichas y la calculadora (formulario)
├── antecedentes.html         ← Antecedentes y metodología (tabla de ponderación, descargables)
├── 404.html                  ← Página de error (rutas absolutas: Pages la sirve en cualquier ruta)
├── home.css                  ← Estilos de la portada y del formulario
├── html/
│   ├── archivo.html          ← Archivo de puentes evaluados (fichas con filtros)
│   ├── mapa.html             ← Mapa de resultados
│   ├── analytics.html        ← Estadísticas
│   ├── resultado.html        ← Reporte del puente (?r=<token> = link permanente)
│   └── admin.html            ← Panel de aprobación (noindex, no enlazado)
├── js/
│   ├── config.js             ← URL y anon key de Supabase
│   ├── form.js               ← Formulario, cálculo del IFCS e INSERT en Supabase
│   ├── resultado.js          ← Diagnóstico, propuestas y PDF del reporte
│   ├── archivo.js            ← Carga pública de evaluaciones aprobadas, fichas y plano
│   ├── portada.js            ← Plano y cifras de la portada
│   ├── mapa.js / mapa-selector.js / analytics.js / admin.js
│   ├── propuestas-rediseno.js
│   └── navbar.js             ← Menú móvil y desplegable «Descargables» (aria-expanded, Escape)
├── css/                      ← gral.css (tokens, cabecera, pie) + una hoja por página
├── img/                      ← Logos e imagen para compartir (og-ifcs.jpg, 1200×630)
├── pdf/                      ← Manual, formato de llenado y archivos de la metodología
├── supabase/migrations/      ← Esquema, RLS y get_evaluacion_publica
├── docs/                     ← Concepto del diseño y unificar_cabecera_pie.py
├── tests/e2e/                ← Specs de Playwright
├── robots.txt / sitemap.xml  ← SEO (admin excluido)
└── CNAME                     ← adiospuentesantipeatonales.org
```

## Cómo funciona

1. El usuario llena el formulario de la portada con los datos de un puente antipeatonal.
2. `form.js` suma los valores de cada campo (IFCS de 0 a 100) y guarda la evaluación en Supabase con `aprobado_mapa = false` y un `public_token`.
3. El usuario ve su reporte en `html/resultado.html`, con un enlace permanente `?r=<token>`.
4. Un admin aprueba la evaluación en `html/admin.html`; desde ese momento aparece en el archivo, el mapa y las estadísticas.

Factibilidad: 0–30 = largo plazo, 31–60 = mediano plazo, 61–100 = corto plazo.

## Cabecera y pie compartidos

No hay build, así que la cabecera y el pie de todas las páginas los escribe un script:

```bash
python docs/unificar_cabecera_pie.py
```

Si cambia un link del menú o del pie, se cambia en el script y se vuelve a correr. El script también pone el enlace «Saltar al contenido» y el `id="contenido"` del primer `<main>` de cada página. Una página nueva se agrega a `PAGINAS` con su prefijo hacia la raíz (`./`, `../` o `/` para `404.html`) y puede traer sólo los marcadores `<header class="header"></header>` y `<footer class="footer"><div class="creditos"></div></footer>`.

## Correr en local

Cualquier servidor estático sirve. En la máquina de Memo el puerto 8080 lo ocupa Docker, así que se usa el **8089**:

```bash
python -m http.server 8089 --bind 127.0.0.1
# abrir http://127.0.0.1:8089/
```

El sitio local lee la misma base de producción (Supabase); el formulario local también inserta ahí.

## Pruebas

```bash
npm ci
npx playwright install chromium

# con el servidor de arriba corriendo
BASE_URL=http://127.0.0.1:8089 npx playwright test --grep-invert @prod

# un solo spec
BASE_URL=http://127.0.0.1:8089 npx playwright test tests/e2e/archivo.spec.js

# humo contra producción (después de un deploy)
npm run test:prod-smoke
```

- `BASE_URL` es opcional (por defecto `http://localhost:8080`). Con `CI` definido, Playwright levanta solo el servidor estático (`webServer` en `playwright.config.js`).
- `prod-smoke.spec.ts` está etiquetado `@prod` y sólo corre con `SMOKE_PROD=1`; CI lo excluye.
- `archivo.spec.js` y `reporte-permalink.spec.ts` interceptan Supabase con `page.route`, no dependen de la base real.

## Base de datos (Supabase)

Desde el **15 de octubre de 2026** la tabla `evaluaciones`, sus políticas RLS y
la función `get_evaluacion_publica` viven en el proyecto Supabase
**`cuervo-cafe`** (ref `tnlxfzruypugbttafeyf`, org *Made by humans*, plan Pro).
Es el mismo proyecto que usa el sitio de Cuervo Café, también de Nadia: está en
una org de pago y tiene tráfico diario, así que no se pausa por inactividad.

Antes vivía en el proyecto `CouncilAI` (ref `fhzowyajnckiylxzywjb`, org free),
que se pausó por inactividad y dejó el mapa, las estadísticas y el formulario
sin datos. Ese proyecto quedó pausado; los datos ya están copiados (mismos
`id`, mismos `public_token`, así que los links permanentes siguen sirviendo).

Las credenciales públicas (URL + anon key) están en `js/config.js`. Para correr
SQL sin password de la base:

```bash
npx supabase db query --linked -f archivo.sql   # linkeado a tnlxfzruypugbttafeyf
```

Ojo: el proyecto se comparte con Cuervo Café. Las tablas de la calculadora
(`evaluaciones`) y las del café (`games`, `reservations`, `site_settings`,
`admins`) son independientes, pero los usuarios de Auth son los mismos: un
admin del café que entre por magic link al panel de la calculadora también
podrá aprobar evaluaciones (las políticas de `evaluaciones` solo piden
`authenticated`). Al revés no: las tablas del café exigen estar en `admins`
(`es_admin()`), así que un admin de la calculadora no puede tocar el menú.

## Link permanente del reporte

Cada evaluación guardada tiene un enlace del tipo
`/html/resultado.html?r=<token>` que **vuelve a generar** el diagnóstico, las
propuestas de rediseño y el PDF a partir de los datos en Supabase. No se
guardan PDFs: el reporte siempre sale con la metodología vigente y no cuesta
storage.

- El token es un UUID v4 que genera `js/form.js` antes del INSERT (el INSERT va
  con `return=minimal`, así que no se puede leer la fila de vuelta). Se guarda
  en la columna `public_token` junto con `respuestas` (`{campo: {id, txt, val}}`),
  que es lo que permite regenerar el diagnóstico sin depender del texto.
- `resultado.html` muestra la caja "Guarda este enlace" con botón de copiar solo
  cuando el INSERT tuvo éxito, y el PDF incluye el enlace al final.
- La fila se lee con la función `get_evaluacion_publica(token)` (SECURITY
  DEFINER, migración `009_reporte_permalink.sql`): anon no puede listar filas
  no aprobadas, pero sí resolver un token exacto. Sin token no hay forma de
  enumerar reportes (el `id` secuencial no sirve de entrada).
- Evaluaciones anteriores a la migración: reciben token al aplicarla (el
  DEFAULT se evalúa fila por fila) pero no tienen `respuestas`; `resultado.js`
  reconstruye los ids de las opciones a partir del texto leyendo `index.html`.
- En el panel admin cada tarjeta tiene "Ver reporte ↗", para abrirlo o
  mandárselo a quien lo pidió.

Para aplicar la migración en el proyecto linkeado sin password de la base:

```bash
npx supabase db query --linked -f supabase/migrations/009_reporte_permalink.sql
```

## Panel de aprobación (admin)

Las evaluaciones que envía el público **no aparecen automáticamente** en el mapa ni en las estadísticas. Quedan en la base de datos con `aprobado_mapa = false` hasta que un admin las apruebe desde el panel.

**URL del panel:** `/html/admin.html` (no enlazada desde la navbar pública por diseño).

### Flujo

1. Alguien llena el formulario público → insert en Supabase con `aprobado_mapa = false`.
2. Admin abre `/html/admin.html`, pide enlace mágico con su correo autorizado.
3. Recibe el email con un link → regresa autenticado al panel.
4. Ve la lista de pendientes y presiona **Aprobar** (se vuelve visible) o **Rechazar** (se borra).

### Provisionar un admin nuevo

1. Dashboard de Supabase → **Authentication → Users → Add user**.
2. Email del admin (el de Nadia, por ejemplo). Marcar **Auto-confirm user** para evitar el correo de confirmación inicial.
3. Click *Create user*. A partir de aquí ese correo puede pedir magic-link desde `/html/admin.html`.

### Redirect URLs

El magic link redirige al mismo origen+path desde donde se solicitó. Hay que registrar esas URLs como permitidas en Supabase:

1. Dashboard → **Authentication → URL Configuration → Redirect URLs**.
2. Añadir:
   - `https://adiospuentesantipeatonales.org/html/admin.html` (producción)
   - `https://nadiafigo.github.io/Calculadora-del-IFCS/html/admin.html` (URL de GitHub Pages)
   - `http://localhost:8080/html/admin.html` (trabajo local; agrega la de tu puerto si usas otro, p. ej. 8089)

Sin esta configuración, el usuario recibe el correo pero al hacer click cae en un error de Supabase.

### Row Level Security

La tabla `evaluaciones` tiene RLS habilitado (migración `007_validacion_manual.sql`):

- **anon** (frontend público): puede `INSERT` (formulario) y `SELECT` solo de filas con `aprobado_mapa = true`.
- **authenticated** (admin con sesión): `SELECT` / `UPDATE` / `DELETE` sin restricción.

La migración es idempotente, así que es seguro re-aplicarla.

### Si el magic link cae en spam

Es un síntoma típico del remitente genérico de Supabase. Plan futuro: configurar SMTP custom (Resend, Postmark) en Dashboard → Authentication → SMTP. Mientras tanto, pídele a Nadia que revise la carpeta de spam y marque el remitente como "no spam".

## Créditos

Metodología, Diseño y Desarrollo Web: Nadia Figueroa para Bicivilízate, Michoacán A.C.
