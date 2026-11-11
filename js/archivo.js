/**
 * archivo.js — El archivo de puentes evaluados (portada y html/archivo.html).
 *
 * Lee sólo las columnas públicas que hacen falta para fichas, cifras y plano
 * (nunca nombre ni correo de quien evaluó). Requiere config.js antes.
 */

const ARCHIVO_CAMPOS = [
  "id", "created_at", "loc_ciudad", "loc_vialidad", "loc_colonia", "loc_x", "loc_y",
  "total_ifcs", "factibilidad", "status_retiro", "fecha_retiro",
  "pte_tipo_acc", "pte_num_esc", "public_token"
].join(",");

const ARCHIVO_COLOR = {
  "Corto plazo": "var(--corto)",
  "Mediano plazo": "var(--mediano)",
  "Largo plazo": "var(--largo)"
};
const ARCHIVO_HEX = { "Corto plazo": "#1E8A4C", "Mediano plazo": "#C98B12", "Largo plazo": "#B4472D" };

function archivoEsc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// "MERIDA", "Mérida" y "merida" son la misma ciudad: se agrupan sin acentos ni mayúsculas
// y se muestra la forma más usada (con mayúscula inicial si vino toda en mayúsculas o minúsculas).
function archivoClaveCiudad(s) {
  return String(s || "").trim().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function archivoCanonCiudades(filas) {
  const formas = {};
  filas.forEach(e => {
    const k = archivoClaveCiudad(e.loc_ciudad);
    const v = String(e.loc_ciudad || "").trim();
    formas[k] = formas[k] || {};
    formas[k][v] = (formas[k][v] || 0) + 1;
  });
  const canon = {};
  Object.entries(formas).forEach(([k, cuenta]) => {
    let v = Object.entries(cuenta).sort((a, b) => b[1] - a[1])[0][0];
    if (v === v.toUpperCase() || v === v.toLowerCase()) {
      v = v.toLowerCase().replace(/(^|\s)\S/g, m => m.toUpperCase());
    }
    canon[k] = v;
  });
  return canon;
}

/** Deja una sola forma por ciudad en `loc_ciudad` (lo usan mapa y estadísticas). */
function archivoUnificarCiudades(filas) {
  const canon = archivoCanonCiudades(filas);
  filas.forEach(e => { if (e.loc_ciudad) e.loc_ciudad = canon[archivoClaveCiudad(e.loc_ciudad)]; });
  return filas;
}

function archivoNormalizar(filas) {
  const canon = archivoCanonCiudades(filas);
  return filas.map(e => {
    const x = parseFloat(e.loc_x), y = parseFloat(e.loc_y);
    const ifcs = parseFloat(e.total_ifcs);
    const limpio = v => (v && v !== "None" ? String(v).trim() : "");
    return {
      id: e.id,
      ciudad: canon[archivoClaveCiudad(e.loc_ciudad)] || "Sin ciudad",
      via: limpio(e.loc_vialidad),
      colonia: limpio(e.loc_colonia),
      x: isNaN(x) ? null : x,
      y: isNaN(y) ? null : y,
      ifcs: isNaN(ifcs) ? null : Math.round(ifcs),
      plazo: e.factibilidad || "",
      sustituido: e.status_retiro === "Retirado",
      fechaRetiro: limpio(e.fecha_retiro),
      acceso: limpio(e.pte_tipo_acc),
      escalones: limpio(e.pte_num_esc),
      token: e.public_token || ""
    };
  });
}

async function archivoCargar() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/evaluaciones?select=${ARCHIVO_CAMPOS}&aprobado_mapa=eq.true&order=created_at.desc`,
    { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return archivoNormalizar(await res.json());
}

function archivoCifras(fichas) {
  const ciudades = [...new Set(fichas.map(f => f.ciudad))].sort((a, b) => a.localeCompare(b, "es"));
  const con = fichas.filter(f => f.ifcs !== null);
  return {
    total: fichas.length,
    ciudades,
    promedio: con.length ? Math.round(con.reduce((s, f) => s + f.ifcs, 0) / con.length) : 0,
    sustituidos: fichas.filter(f => f.sustituido).length,
    pctEscaleras: fichas.length ? Math.round(100 * fichas.filter(f => /^escaleras$/i.test(f.acceso)).length / fichas.length) : 0
  };
}

/** Folio de la ficha, ya escapado (el id viene de la base, pero no se confía en él). */
function archivoFolio(f) {
  return archivoEsc("P-" + String(f.id ?? "").padStart(3, "0"));
}

/** HTML de una ficha. `raiz` es el prefijo hacia la raíz del sitio ("./" o "../"). */
function archivoFicha(f, raiz) {
  const color = ARCHIVO_COLOR[f.plazo] || "var(--tinta-2)";
  const url = f.token ? `${raiz}html/resultado.html?r=${encodeURIComponent(f.token)}` : null;
  const acceso = [f.acceso, f.escalones].filter(Boolean).join(" · ");
  const estado = f.sustituido
    ? `<span class="plazo plazo--sustituido">Sustituido${f.fechaRetiro ? " · " + archivoEsc(f.fechaRetiro) : ""}</span>`
    : `<span class="plazo"><i class="punto" style="background:${color}"></i>${archivoEsc(f.plazo.replace(" plazo", ""))}</span>`;
  const etiqueta = url ? "a" : "div";
  const destino = url ? ` href="${url}"` : "";
  return `<li><${etiqueta} class="ficha${f.sustituido ? " ficha--sustituido" : ""}"${destino}>
    <span class="ficha-top"><span>${archivoFolio(f)}</span><span>${archivoEsc(f.ciudad)}</span></span>
    <h3>${archivoEsc(f.via || "Vialidad sin nombre")}</h3>
    <p class="ficha-lugar">${archivoEsc(f.colonia)}</p>
    <div class="medidor">
      <div class="medidor-fila"><b>${f.ifcs ?? "—"}<small>IFCS</small></b>${estado}</div>
      <div class="barra" aria-hidden="true"><i style="width:${f.ifcs ?? 0}%;background:${color}"></i></div>
      ${acceso ? `<p class="ficha-acceso">${archivoEsc(acceso)}</p>` : ""}
    </div>
  </${etiqueta}></li>`;
}

/** Puntos del plano (Leaflet). Devuelve los puntos de la ciudad pedida para encuadrar. */
function archivoPuntos(mapa, fichas, ciudadEncuadre) {
  const encuadre = [];
  fichas.forEach(f => {
    if (f.x === null || f.y === null) return;
    const m = L.circleMarker([f.y, f.x], {
      radius: f.sustituido ? 8 : 6.5, weight: 2, color: "#FFFFFF",
      fillColor: f.sustituido ? "#17201B" : (ARCHIVO_HEX[f.plazo] || "#4F5B55"), fillOpacity: 1
    }).addTo(mapa);
    m.bindPopup(`<span class="pop-folio">${archivoFolio(f)} · ${archivoEsc(f.ciudad)}</span>`
      + `<span class="pop-via">${archivoEsc(f.via)}</span>`
      + (f.sustituido ? "Sustituido por un cruce seguro" : `IFCS ${f.ifcs ?? "—"} · ${archivoEsc(f.plazo)}`));
    if (!ciudadEncuadre || archivoClaveCiudad(f.ciudad) === archivoClaveCiudad(ciudadEncuadre)) encuadre.push([f.y, f.x]);
  });
  return encuadre;
}

/** Base gris clara del plano (Esri, sin llave). */
function archivoBase(mapa) {
  L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 16,
    attribution: "Esri, HERE, Garmin, &copy; OpenStreetMap"
  }).addTo(mapa);
}

/** Escala gráfica del cajetín: cuánto mide en el terreno una barra de 56 px. */
function archivoEscala(mapa, el) {
  const pintar = () => {
    const c = mapa.getSize().divideBy(2);
    const m = mapa.distance(mapa.containerPointToLatLng(c), mapa.containerPointToLatLng(c.add([56, 0])));
    el.textContent = m >= 1000 ? `${(m / 1000).toFixed(m >= 10000 ? 0 : 1)} km` : `${Math.round(m / 10) * 10} m`;
  };
  mapa.on("zoomend moveend", pintar);
  pintar();
}
