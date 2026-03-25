/**
 * mapa.js — Mapa interactivo de evaluaciones IFCS
 *
 * Usa Leaflet + MarkerCluster, lee datos de Supabase REST API.
 * Credenciales cargadas desde config.js.
 */

document.addEventListener("DOMContentLoaded", async () => {

  // ========================================
  // FETCH DATA
  // ========================================

  let evaluaciones = [];

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/evaluaciones?select=*&order=created_at.desc`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`
        }
      }
    );
    if (res.ok) evaluaciones = await res.json();
  } catch (err) {
    console.warn("Error cargando datos:", err);
  }

  // Filter out entries without valid coordinates
  const conCoords = evaluaciones.filter(
    e => e.loc_y && e.loc_x && !isNaN(parseFloat(e.loc_y)) && !isNaN(parseFloat(e.loc_x))
  );

  // ========================================
  // INIT MAP
  // ========================================

  const map = L.map("mapa").setView([23.6345, -102.5528], 5);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  const clusterGroup = L.markerClusterGroup();
  map.addLayer(clusterGroup);

  // ========================================
  // MARKER COLORS
  // ========================================

  function markerIcon(factibilidad) {
    let color;
    if (factibilidad === "Corto plazo") color = "#2e7d32";
    else if (factibilidad === "Mediano plazo") color = "#f9a825";
    else color = "#c62828";

    return L.divIcon({
      className: "",
      html: `<div style="
        width:14px; height:14px; border-radius:50%;
        background:${color}; border:2px solid #fff;
        box-shadow:0 1px 4px rgba(0,0,0,.4);
      "></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });
  }

  // ========================================
  // POPUP
  // ========================================

  function buildPopup(e) {
    const fecha = e.created_at ? new Date(e.created_at).toLocaleDateString("es-MX") : "—";
    const badgeClass = e.factibilidad === "Corto plazo" ? "corto"
      : e.factibilidad === "Mediano plazo" ? "medio" : "largo";

    return `
      <div>
        <div class="popup-title">${e.loc_vialidad || "Sin vialidad"}</div>
        <div class="popup-row">${e.loc_ciudad || ""}</div>
        <div class="popup-row">Ref: ${e.loc_referencia || "—"}</div>
        <div class="popup-row">Total IFCS: <strong>${e.total_ifcs ?? "—"}%</strong></div>
        <div class="popup-badge popup-badge--${badgeClass}">${e.factibilidad || "—"}</div>
        <div class="popup-row" style="margin-top:.35rem;">Fecha: ${fecha}</div>
        <div class="popup-row">Org: ${e.fuente_org || "—"}</div>
      </div>
    `;
  }

  // ========================================
  // CREATE MARKERS
  // ========================================

  const allMarkers = conCoords.map(e => {
    const lat = parseFloat(e.loc_y);
    const lng = parseFloat(e.loc_x);
    const marker = L.marker([lat, lng], { icon: markerIcon(e.factibilidad) });
    marker.bindPopup(buildPopup(e));
    marker._evalData = e;
    return marker;
  });

  // ========================================
  // POPULATE CITY FILTER
  // ========================================

  const ciudadSelect = document.getElementById("filtro-ciudad");
  const ciudades = [...new Set(evaluaciones.map(e => e.loc_ciudad).filter(Boolean))].sort();
  ciudades.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    ciudadSelect.appendChild(opt);
  });

  // ========================================
  // FILTER LOGIC
  // ========================================

  const counterEl = document.getElementById("filtros-counter");
  const factCheckboxes = document.querySelectorAll(".filtro-check input[type='checkbox']");

  function applyFilters() {
    const activeFact = new Set();
    factCheckboxes.forEach(cb => { if (cb.checked) activeFact.add(cb.value); });
    const ciudadFilter = ciudadSelect.value;

    clusterGroup.clearLayers();
    let shown = 0;

    allMarkers.forEach(m => {
      const e = m._evalData;
      const matchFact = activeFact.has(e.factibilidad);
      const matchCiudad = !ciudadFilter || e.loc_ciudad === ciudadFilter;
      if (matchFact && matchCiudad) {
        clusterGroup.addLayer(m);
        shown++;
      }
    });

    counterEl.innerHTML = `Mostrando <strong>${shown}</strong> de <strong>${conCoords.length}</strong> evaluaciones`;
  }

  factCheckboxes.forEach(cb => cb.addEventListener("change", applyFilters));
  ciudadSelect.addEventListener("change", applyFilters);

  // Initial render
  applyFilters();

  // If no data, show message
  if (conCoords.length === 0) {
    counterEl.innerHTML = "<em>Aún no hay evaluaciones con coordenadas</em>";
  }

  // ========================================
  // MOBILE TOGGLE
  // ========================================

  const toggleBtn = document.getElementById("filtros-toggle");
  const panel = document.getElementById("filtros-panel");

  if (toggleBtn && panel) {
    toggleBtn.addEventListener("click", () => {
      panel.classList.toggle("open");
      toggleBtn.textContent = panel.classList.contains("open") ? "Cerrar" : "Filtros";
    });
  }

  // Fix map size when container is resized
  setTimeout(() => map.invalidateSize(), 200);
});
