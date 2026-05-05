/**
 * Mapa modal para seleccionar coordenadas con reverse geocoding via Nominatim.
 * Llena: LocPais, LocCiudad, LocVia, LocColonia, LocX, LocY.
 * Graceful: si Nominatim falla/timeout, igual setea coords y deja el resto.
 */
(function () {
  const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";
  const TIMEOUT_MS = 5000;
  const MORELIA_CENTER = [19.7008, -101.1844];
  const ZOOM_INICIAL = 13;

  let mapa = null;
  let marker = null;
  let coordsSeleccionadas = null;

  function $(id) { return document.getElementById(id); }

  function abrirModal() {
    const modal = $("mapa-modal");
    modal.classList.remove("hidden");
    if (!mapa) {
      mapa = L.map("mapa-selector").setView(MORELIA_CENTER, ZOOM_INICIAL);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(mapa);
      mapa.on("click", onMapClick);
    } else {
      // Forzar resize cuando se reabre el modal
      setTimeout(() => mapa.invalidateSize(), 100);
    }
    $("btn-confirmar-mapa").disabled = true;
    $("mapa-status").textContent = "";
  }

  function cerrarModal() {
    $("mapa-modal").classList.add("hidden");
  }

  async function onMapClick(e) {
    const { lat, lng } = e.latlng;
    coordsSeleccionadas = { lat, lng, datos: null };

    // Marker
    if (marker) marker.remove();
    marker = L.marker([lat, lng]).addTo(mapa);

    $("mapa-status").textContent = "Buscando dirección…";
    $("btn-confirmar-mapa").disabled = false;

    // Reverse geocoding con timeout
    try {
      const datos = await reverseGeocode(lat, lng);
      coordsSeleccionadas.datos = datos;
      $("mapa-status").textContent = datos
        ? `Ubicación encontrada: ${datos.via || datos.colonia || "sin nombre de calle"}`
        : "Coordenadas listas. Llena los datos de ubicación a mano.";
    } catch (err) {
      console.warn("Reverse geocode falló:", err);
      $("mapa-status").textContent = "Coordenadas listas. Llena los datos de ubicación a mano.";
    }
  }

  function reverseGeocode(lat, lng) {
    return new Promise((resolve, reject) => {
      const ctrl = new AbortController();
      const timeoutId = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      const url = `${NOMINATIM_URL}?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=es`;
      fetch(url, { signal: ctrl.signal, headers: { "Accept-Language": "es" } })
        .then(res => {
          clearTimeout(timeoutId);
          if (!res.ok) throw new Error("Nominatim error " + res.status);
          return res.json();
        })
        .then(json => {
          const a = json.address || {};
          resolve({
            pais: a.country || null,
            ciudad: a.city || a.town || a.village || a.municipality || null,
            via: a.road || a.pedestrian || a.footway || null,
            colonia: a.suburb || a.neighbourhood || a.quarter || null,
          });
        })
        .catch(err => {
          clearTimeout(timeoutId);
          reject(err);
        });
    });
  }

  function confirmar() {
    if (!coordsSeleccionadas) return;
    const { lat, lng, datos } = coordsSeleccionadas;

    const setIfEmpty = (id, val) => {
      const el = $(id);
      if (el && val && !el.value) el.value = val;
    };

    // Coords siempre se setean (sobreescribiendo)
    if ($("LocX")) $("LocX").value = lng.toFixed(6);
    if ($("LocY")) $("LocY").value = lat.toFixed(6);

    // Datos de geocoding solo si están vacíos
    if (datos) {
      setIfEmpty("LocPais", datos.pais);
      setIfEmpty("LocCiudad", datos.ciudad);
      setIfEmpty("LocVia", datos.via);
      setIfEmpty("LocColonia", datos.colonia);
    }

    cerrarModal();
  }

  // Event listeners
  document.addEventListener("DOMContentLoaded", () => {
    const btnAbrir = $("btn-abrir-mapa");
    const btnCerrar = $("btn-cerrar-mapa");
    const btnConfirmar = $("btn-confirmar-mapa");
    if (btnAbrir) btnAbrir.addEventListener("click", abrirModal);
    if (btnCerrar) btnCerrar.addEventListener("click", cerrarModal);
    if (btnConfirmar) btnConfirmar.addEventListener("click", confirmar);

    // Cerrar con ESC
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !$("mapa-modal").classList.contains("hidden")) {
        cerrarModal();
      }
    });
  });
})();
