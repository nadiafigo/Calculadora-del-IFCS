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

## Créditos

Metodología, Diseño y Desarrollo Web: Nadia Figueroa para Bicivilízate, Michoacán A.C.
