# Calculadora del IFCS — Índice de Factibilidad de Cruce Seguro

Herramienta web para evaluar la factibilidad de sustituir puentes antipeatonales por cruces peatonales seguros. Desarrollada para Liga Peatonal / Bicivilízate Michoacán A.C.

## Estructura del proyecto

```
├── index.html                    ← Página principal con el formulario
├── html/resultado.html           ← Página de resultados y diagnóstico
├── js/
│   ├── form.js                   ← Lógica del formulario + envío a Google Sheets
│   ├── resultado.js              ← Generación del diagnóstico dinámico
│   └── navbar.js                 ← Menú de navegación
├── css/
│   ├── gral.css                  ← Estilos generales
│   ├── gral_result.css           ← Estilos de resultado
│   └── resultado.css             ← Estilos adicionales de resultado
├── home.css                      ← Estilos de la página principal
├── img/                          ← Imágenes y logos
├── pdf/                          ← Manual y formato de llenado
└── google-apps-script/
    └── Code.gs                   ← Script para Google Sheets (ver instrucciones abajo)
```

## Cómo funciona

1. El usuario llena el formulario con datos de un puente antipeatonal
2. Se calcula un puntaje total (IFCS) sumando los valores de cada campo
3. Los datos se envían automáticamente a una hoja de Google Sheets
4. El usuario ve la página de resultados con un diagnóstico detallado

## Configuración de Google Sheets (persistencia de datos)

### Paso 1: Crear la hoja de cálculo

1. Ve a [Google Sheets](https://sheets.google.com) y crea una nueva hoja
2. Ponle nombre: "Datos IFCS" (o el que prefieras)

### Paso 2: Configurar el Apps Script

1. En tu hoja de Google Sheets, ve a **Extensiones → Apps Script**
2. Borra el código que aparece por defecto
3. Copia y pega TODO el contenido del archivo `google-apps-script/Code.gs`
4. Guarda el proyecto (Ctrl+S)
5. Dale un nombre al proyecto, por ejemplo "IFCS Backend"

### Paso 3: Implementar como aplicación web

1. Click en **Implementar → Nueva implementación**
2. En el engrane ⚙️, selecciona **Aplicación web**
3. En **"Ejecutar como"**: selecciona tu cuenta de Google
4. En **"Quién tiene acceso"**: selecciona **"Cualquier persona"**
5. Click en **Implementar**
6. Te pedirá autorización — acepta los permisos
7. **Copia la URL** que te genera (algo como `https://script.google.com/macros/s/AKfy.../exec`)

### Paso 4: Conectar con el formulario

1. Abre el archivo `js/form.js`
2. En la línea que dice `const GOOGLE_SCRIPT_URL = "";`
3. Pega tu URL entre las comillas:
   ```javascript
   const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/TU_URL_AQUI/exec";
   ```
4. Guarda el archivo

¡Listo! Cada envío del formulario creará una nueva fila en tu Google Sheet.

## Hosting (independiente de WordPress)

Este sitio es completamente estático (HTML/CSS/JS) y se puede hospedar gratis en:

### Opción A: GitHub Pages (recomendado)

1. Sube el proyecto a un repositorio en GitHub
2. Ve a **Settings → Pages**
3. En Source, selecciona **Deploy from a branch → main**
4. Tu sitio estará en `https://tuusuario.github.io/nombre-del-repo`

Para usar un subdominio como `calculadora.ligapeatonal.org`:
1. En Settings → Pages → Custom domain, escribe `calculadora.ligapeatonal.org`
2. En el DNS de ligapeatonal.org, agrega un registro **CNAME**:
   - Nombre: `calculadora`
   - Valor: `tuusuario.github.io`

### Opción B: Netlify

1. Ve a [netlify.com](https://netlify.com) y crea una cuenta
2. Arrastra la carpeta del proyecto al dashboard
3. Para dominio personalizado: Settings → Domain management → Add custom domain

### Opción C: Vercel

1. Ve a [vercel.com](https://vercel.com), conecta tu GitHub
2. Importa el repositorio
3. Se despliega automáticamente

## Notas técnicas

- Los datos se pasan entre páginas usando `localStorage` + URL params
- El total IFCS se calcula como la suma de los valores numéricos de los `<select>`
- Los campos condicionales (rampa, escaleras, publicidad) se muestran/ocultan según las respuestas
- Factibilidad: ≤20% = largo plazo, 21-65% = mediano plazo, >65% = corto plazo

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
   - `http://localhost:8080/html/admin.html` (para trabajo local)
   - `https://nadiafigo.github.io/Calculadora-del-IFCS/html/admin.html` (producción GitHub Pages)
   - `https://<dominio-custom>/html/admin.html` (si ya hay un dominio personalizado apuntando al sitio)

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
