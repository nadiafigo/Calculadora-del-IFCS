/**
 * mapa.js — Mapa interactivo de evaluaciones IFCS
 *
 * Usa Leaflet + MarkerCluster, lee datos de Supabase REST API.
 * Credenciales cargadas desde config.js.
 */

// Midpoints for the b/a derived index. Keys match the label text stored in DB.
function parseA(text) {
  switch (text) {
    case "0 a 99 metros":   return 50;
    case "100 a 149 metros": return 125;
    case "150 a 199 metros": return 175;
    case "200 o más":        return 225;
    default: return null;
  }
}

function parseB(text) {
  switch (text) {
    case "10 metros o menos": return 5;
    case "11 a 19 metros":    return 15;
    case "20 a 39 metros":    return 30;
    case "40 a 69 metros":    return 55;
    case "70 metros o más":   return 85;
    default: return null;
  }
}

function computeRatio(e) {
  const a = parseA(e.pte_long_cami);
  const b = parseB(e.via_dist_cruce);
  return (a && b) ? b / a : null;
}

function baBucketMatch(ratio, bucket) {
  if (!bucket) return true;
  if (ratio === null || ratio === undefined) return false;
  switch (bucket) {
    case "lt0_5":   return ratio < 0.5;
    case "0_5to1":  return ratio >= 0.5 && ratio < 1;
    case "1to1_5":  return ratio >= 1 && ratio < 1.5;
    case "gte1_5":  return ratio >= 1.5;
    default: return true;
  }
}

function populateSelect(selectEl, values) {
  values.forEach(v => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    selectEl.appendChild(opt);
  });
}

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
    const ratio = computeRatio(e);
    const ratioRow = ratio !== null
      ? `<div class="popup-row">Índice b/a: <strong>${ratio.toFixed(2)}</strong></div>`
      : "";

    return `
      <div>
        <div class="popup-title">${e.loc_vialidad || "Sin vialidad"}</div>
        <div class="popup-row">${e.loc_ciudad || ""}</div>
        <div class="popup-row">Ref: ${e.loc_referencia || "—"}</div>
        <div class="popup-row">Total IFCS: <strong>${e.total_ifcs ?? "—"}%</strong></div>
        <div class="popup-badge popup-badge--${badgeClass}">${e.factibilidad || "—"}</div>
        ${ratioRow}
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
  // POPULATE FILTERS (dinámicos)
  // ========================================

  const ciudadSelect   = document.getElementById("filtro-ciudad");
  const tipoAccSelect  = document.getElementById("filtro-tipoacc-select");
  const obstBanqSelect = document.getElementById("filtro-obstbanq-select");
  const equipTipoSelect = document.getElementById("filtro-equiptipo-select");
  const distSemafSelect = document.getElementById("filtro-distsemaf-select");
  const baSelect       = document.getElementById("filtro-ba-select");

  const uniqSorted = (key) => [...new Set(evaluaciones.map(e => e[key]).filter(Boolean))].sort();

  populateSelect(ciudadSelect, uniqSorted("loc_ciudad"));
  populateSelect(tipoAccSelect, uniqSorted("pte_tipo_acc"));
  populateSelect(obstBanqSelect, uniqSorted("pte_obst_banq"));
  populateSelect(equipTipoSelect, uniqSorted("equip_tipo"));
  populateSelect(distSemafSelect, uniqSorted("via_dist_semaf"));

  // ========================================
  // FILTER LOGIC
  // ========================================

  const counterEl = document.getElementById("filtros-counter");
  const factCheckboxes = document.querySelectorAll(".filtro-check input[type='checkbox']");

  function applyFilters() {
    const activeFact = new Set();
    factCheckboxes.forEach(cb => { if (cb.checked) activeFact.add(cb.value); });
    const ciudadFilter    = ciudadSelect.value;
    const tipoAccFilter   = tipoAccSelect.value;
    const obstBanqFilter  = obstBanqSelect.value;
    const equipTipoFilter = equipTipoSelect.value;
    const distSemafFilter = distSemafSelect.value;
    const baFilter        = baSelect.value;

    clusterGroup.clearLayers();
    let shown = 0;

    allMarkers.forEach(m => {
      const e = m._evalData;
      const matchFact      = activeFact.has(e.factibilidad);
      const matchCiudad    = !ciudadFilter    || e.loc_ciudad     === ciudadFilter;
      const matchTipoAcc   = !tipoAccFilter   || e.pte_tipo_acc   === tipoAccFilter;
      const matchObstBanq  = !obstBanqFilter  || e.pte_obst_banq  === obstBanqFilter;
      const matchEquipTipo = !equipTipoFilter || e.equip_tipo     === equipTipoFilter;
      const matchDistSemaf = !distSemafFilter || e.via_dist_semaf === distSemafFilter;
      const matchBA        = baBucketMatch(computeRatio(e), baFilter);

      if (matchFact && matchCiudad && matchTipoAcc && matchObstBanq
          && matchEquipTipo && matchDistSemaf && matchBA) {
        clusterGroup.addLayer(m);
        shown++;
      }
    });

    counterEl.innerHTML = `Mostrando <strong>${shown}</strong> de <strong>${conCoords.length}</strong> evaluaciones`;
  }

  factCheckboxes.forEach(cb => cb.addEventListener("change", applyFilters));
  [ciudadSelect, tipoAccSelect, obstBanqSelect, equipTipoSelect, distSemafSelect, baSelect]
    .forEach(sel => sel.addEventListener("change", applyFilters));

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
