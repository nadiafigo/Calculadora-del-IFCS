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
      `${SUPABASE_URL}/rest/v1/evaluaciones?select=*&aprobado_mapa=eq.true&order=created_at.desc`,
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
  // MARKER ICONS
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

  function markerIconRetirado(e) {
    const fechaTxt = e.fecha_retiro ? `Puente sustituido en ${e.fecha_retiro}` : "Puente sustituido";
    return L.divIcon({
      className: "marker-retirado",
      html: `<div class="marker-retirado-inner" tabindex="0" role="img" aria-label="${escapeHtml(fechaTxt)}">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"
                fill="white" stroke="white" stroke-width="0.5"/>
        </svg>
      </div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
  }

  function escapeHtml(s) {
    if (s === null || s === undefined) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
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

    const isRetirado = e.status_retiro === "Retirado";
    const banner = isRetirado
      ? `<div class="popup-retirado-banner" role="status">
           <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
             <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor"/>
           </svg>
           <strong>Puente sustituido</strong>
         </div>`
      : "";
    const fechaRetiroBlock = (isRetirado && e.fecha_retiro)
      ? `<div class="popup-retirado-fecha">
           <span class="popup-retirado-label">Fecha de sustitución:</span>
           <span class="popup-retirado-valor">${escapeHtml(e.fecha_retiro)}</span>
         </div>`
      : "";

    return `
      <div>
        ${banner}
        <div class="popup-title">${escapeHtml(e.loc_vialidad || "Sin vialidad")}</div>
        <div class="popup-row">${escapeHtml(e.loc_ciudad || "")}</div>
        <div class="popup-row">Ref: ${escapeHtml(e.loc_referencia || "—")}</div>
        <div class="popup-row">Total IFCS: <strong>${e.total_ifcs ?? "—"}%</strong></div>
        <div class="popup-badge popup-badge--${badgeClass}">${escapeHtml(e.factibilidad || "—")}</div>
        ${ratioRow}
        <div class="popup-row" style="margin-top:.35rem;">Fecha: ${escapeHtml(fecha)}</div>
        <div class="popup-row">Org: ${escapeHtml(e.fuente_org || "—")}</div>
        ${fechaRetiroBlock}
      </div>
    `;
  }

  // ========================================
  // CREATE MARKERS
  // ========================================

  const allMarkers = conCoords.map(e => {
    const lat = parseFloat(e.loc_y);
    const lng = parseFloat(e.loc_x);
    const isRetirado = e.status_retiro === "Retirado";
    const icon = isRetirado ? markerIconRetirado(e) : markerIcon(e.factibilidad);
    const marker = L.marker([lat, lng], {
      icon,
      keyboard: true,
      title: isRetirado
        ? `Puente sustituido${e.fecha_retiro ? " en " + e.fecha_retiro : ""}`
        : (e.loc_vialidad || "Puente antipeatonal")
    });
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
  const statusRetiroRadios = document.querySelectorAll('input[name="filter-status"]');
  const kpiCountEl = document.getElementById("kpi-retirados-count");

  // Total absoluto de retirados visibles (no depende de filtros — es la
  // narrativa "X puentes ya sustituidos en México").
  const totalRetirados = conCoords.filter(e => e.status_retiro === "Retirado").length;
  if (kpiCountEl) kpiCountEl.textContent = String(totalRetirados);

  function getStatusFilter() {
    const checked = document.querySelector('input[name="filter-status"]:checked');
    return checked ? checked.value : "todos";
  }

  function applyFilters() {
    const activeFact = new Set();
    factCheckboxes.forEach(cb => { if (cb.checked) activeFact.add(cb.value); });
    const ciudadFilter    = ciudadSelect.value;
    const tipoAccFilter   = tipoAccSelect.value;
    const obstBanqFilter  = obstBanqSelect.value;
    const equipTipoFilter = equipTipoSelect.value;
    const distSemafFilter = distSemafSelect.value;
    const baFilter        = baSelect.value;
    const statusFilter    = getStatusFilter();

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

      let matchStatus = true;
      if (statusFilter === "retirado") matchStatus = e.status_retiro === "Retirado";
      else if (statusFilter === "pendiente") matchStatus = e.status_retiro !== "Retirado";

      if (matchFact && matchCiudad && matchTipoAcc && matchObstBanq
          && matchEquipTipo && matchDistSemaf && matchBA && matchStatus) {
        clusterGroup.addLayer(m);
        shown++;
      }
    });

    counterEl.innerHTML = `Mostrando <strong>${shown}</strong> de <strong>${conCoords.length}</strong> evaluaciones`;
  }

  factCheckboxes.forEach(cb => cb.addEventListener("change", applyFilters));
  [ciudadSelect, tipoAccSelect, obstBanqSelect, equipTipoSelect, distSemafSelect, baSelect]
    .forEach(sel => sel.addEventListener("change", applyFilters));
  statusRetiroRadios.forEach(r => r.addEventListener("change", applyFilters));

  // Initial render
  applyFilters();

  // If no data, show message
  if (conCoords.length === 0) {
    counterEl.innerHTML = "<em>Aún no hay evaluaciones con coordenadas</em>";
  }

  // ========================================
  // DEEP-LINK: ?id=<id> | ?lat=<n>&lng=<n>
  // ========================================

  let mapaToastTimer = null;
  function showMapaToast(message) {
    let toast = document.getElementById("mapa-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "mapa-toast";
      toast.className = "mapa-toast";

      const msgSpan = document.createElement("span");
      msgSpan.className = "mapa-toast__msg";
      toast.appendChild(msgSpan);

      const closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "mapa-toast__close";
      closeBtn.setAttribute("aria-label", "Cerrar mensaje");
      closeBtn.textContent = "×";
      closeBtn.addEventListener("click", () => {
        toast.classList.remove("show");
        if (mapaToastTimer) {
          clearTimeout(mapaToastTimer);
          mapaToastTimer = null;
        }
      });
      toast.appendChild(closeBtn);

      document.body.appendChild(toast);
    }
    toast.querySelector(".mapa-toast__msg").textContent = message;
    toast.classList.add("show");
    if (mapaToastTimer) clearTimeout(mapaToastTimer);
    mapaToastTimer = setTimeout(() => {
      toast.classList.remove("show");
      mapaToastTimer = null;
    }, 12000);
  }

  const params = new URLSearchParams(window.location.search);
  const wantedId = params.get("id");
  const wantedLat = parseFloat(params.get("lat"));
  const wantedLng = parseFloat(params.get("lng"));

  if (wantedId) {
    const targetMarker = allMarkers.find(m => String(m._evalData.id) === String(wantedId));
    if (targetMarker) {
      const latlng = targetMarker.getLatLng();
      // Forzar visibilidad del marker aunque los filtros no coincidan.
      if (!clusterGroup.hasLayer(targetMarker)) {
        clusterGroup.addLayer(targetMarker);
      }
      map.flyTo(latlng, 17, { duration: 1.0 });
      setTimeout(() => {
        targetMarker.openPopup();
      }, 1100);
    } else {
      showMapaToast(
        "Tu evaluación se guardó correctamente. Aparecerá en el mapa una vez que el equipo de Liga Peatonal la revise. Mientras, puedes explorar los registros ya aprobados."
      );
    }
  } else if (!isNaN(wantedLat) && !isNaN(wantedLng)) {
    map.flyTo([wantedLat, wantedLng], 17, { duration: 1.0 });
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
