/**
 * portada.js — Plano, cotas, mini histograma y fichas recientes de la portada.
 * Requiere Leaflet, config.js y archivo.js antes.
 */

document.addEventListener("DOMContentLoaded", async () => {
  const set = (k, html) => document.querySelectorAll(`[data-dato="${k}"]`).forEach(el => { el.innerHTML = html; });
  const lista = document.getElementById("fichas-recientes");

  let fichas = [];
  try {
    fichas = await archivoCargar();
  } catch (err) {
    console.warn("No se pudo cargar el archivo:", err);
    if (lista) lista.innerHTML = '<li class="fichas-vacio">No pudimos cargar el archivo en este momento. Intenta de nuevo en unos minutos.</li>';
    return;
  }

  // Cifras
  const c = archivoCifras(fichas);
  set("total", c.total);
  set("ciudades", c.ciudades.length);
  set("promedio", `${c.promedio}<small>/100</small>`);
  set("sustituidos", c.sustituidos);
  set("frase-total", `Ya van <b>${c.total} puentes</b> evaluados en <b>${c.ciudades.length} ciudades</b>.`);
  if (c.total) {
    set("pct-escaleras", `${c.pctEscaleras}%`);
    const dato = document.getElementById("dato-escaleras");
    if (dato) dato.hidden = false;
  }
  const hoy = new Date();
  const fecha = document.getElementById("cajetin-fecha");
  if (fecha) fecha.textContent = `Datos al ${String(hoy.getDate()).padStart(2, "0")}.${String(hoy.getMonth() + 1).padStart(2, "0")}.${hoy.getFullYear()}`;

  // Mini histograma del IFCS en 10 tramos (colores por plazo aproximados al rango del tramo)
  const barras = document.getElementById("mini-barras");
  if (barras) {
    const tramos = Array.from({ length: 10 }, () => 0);
    fichas.forEach(f => { if (f.ifcs !== null) tramos[Math.min(9, Math.floor(f.ifcs / 10))]++; });
    const max = Math.max(1, ...tramos);
    barras.innerHTML = tramos.map((n, i) => `<i class="${i >= 7 ? "c" : i >= 4 ? "m" : "l"}" style="height:${Math.round(100 * n / max)}%"></i>`).join("");
  }

  // Fichas recientes
  if (lista) {
    lista.innerHTML = fichas.slice(0, 8).map(f => archivoFicha(f, "./")).join("")
      || '<li class="fichas-vacio">Todavía no hay evaluaciones aprobadas.</li>';
  }
  const ver = document.getElementById("ver-archivo");
  if (ver && c.total) ver.textContent = `Ver las ${c.total} fichas del archivo`;

  // Plano de Morelia
  const contenedor = document.getElementById("plano");
  if (contenedor && window.L) {
    const mapa = L.map(contenedor, { scrollWheelZoom: false }).setView([19.705, -101.195], 12);
    archivoBase(mapa);
    const morelia = archivoPuntos(mapa, fichas, "Morelia");
    const encuadre = () => {
      mapa.invalidateSize();
      if (morelia.length) mapa.fitBounds(morelia, { padding: [24, 24], maxZoom: 15 });
    };
    encuadre();
    if (document.fonts) document.fonts.ready.then(encuadre);
    const escala = document.getElementById("escala-txt");
    if (escala) archivoEscala(mapa, escala);
  }
});
