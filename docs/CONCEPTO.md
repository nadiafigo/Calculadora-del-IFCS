# Rediseño 2026 — El plano y el archivo

Tablero de direcciones (10 nov 2026): https://claude.ai/artifact/5aZmPgWFZQ6uC3t6MnzLqE · copia local en
`dev/_propuestas-diseno/2026-11-10-liga-peatonal/`. Memo eligió la **mezcla 1 + 4**.

## §0 El concepto (no se relitiga)

**El sitio es la lámina de un proyecto urbano y su archivo de casos.** Cada página es una lámina de plano: retícula
de columnas a la vista, cajetín con escala, norte y número de lámina, y Morelia dibujada como plano con los
puentes evaluados marcados. Debajo de la lámina vive el archivo: cada puente evaluado es una ficha (`P-012 ·
Av. Camelinas · Morelia · IFCS 62 · Mediano plazo`) que se filtra y abre su reporte con el link permanente.
La calculadora se presenta como «suma un puente al archivo».

- Referencias (sólo gramática, nunca su arte ni textos): **MobilityLab** (Awwwards HM, 21 ago 2026) para la
  retícula de plano, el mapa del territorio y el bento de herramientas; **Obama Presidency Oral History**
  (Awwwards HM, 25 jun 2026) para el archivo de fichas con cifra de entrada y temas filtrables.
- **Qué lo hace distinto de los sitios anteriores:** no hay tipografía gigante que se salga del encuadre, ni
  capas ligadas al scroll (LANT, El Cuervo, Comprovet); no es zine (Rocketlab), ni visor/consola oscura (Igor),
  ni pliego a dos tintas (Arcana). Suelo claro de papel de plano, scroll normal, material = mapa + datos +
  fichas, movimiento casi quieto (sólo microinteracción en fichas, filtros y mapa).
- **Vara de Memo:** «ONG moderna, no aburrida ni outdated, pero que no se vea tan loco».

## Sistema

| Pieza | Decisión |
|---|---|
| Suelo | papel de plano frío (no crema), tinta grafito |
| Acento | **verde de la Liga** `#139146` (del logo; no usado en ningún sitio anterior). Amarillo de la Liga sólo en dosis de señal |
| Semántica de plazo | corto = verde · mediano = ámbar · largo = ladrillo (estados, no acento) |
| Tipografía | Schibsted Grotesk (títulos y texto) · Azeret Mono (cotas, cajetín, folios de ficha) |
| Retícula | 12 columnas con filetes finos visibles en las láminas; cajetín en el pie de cada lámina |
| Movimiento | quieto; hover/focus en fichas y bento; el mapa es lo único vivo |

## Materiales como clases reutilizables

- `.lamina` — sección con retícula a la vista y `.cajetin` (escala · norte · lámina N/M · fecha de datos).
- `.plano` — el mapa (Leaflet, teselas claras sin etiquetas, puntos por plazo).
- `.bento` — las cuatro herramientas: Evalúa un puente · Mapa · Estadísticas · Descargables.
- `.ficha` — un puente del archivo (folio, ciudad, vía, IFCS, plazo, acceso) → abre `resultado.html?r=<token>`.
- `.cota` — dato con línea de cota (cifras: 88 evaluaciones, 16 ciudades, 2 sustituidos).

## Lo que no se toca

Toda la lógica: `form.js`, `resultado.js`, `mapa.js`, `analytics.js`, `admin.js`, Supabase, link permanente,
PDF. El rediseño cambia HTML de presentación y CSS; los `id`/`name` del formulario y los ganchos de JS se
conservan para que la suite de Playwright siga pasando.
