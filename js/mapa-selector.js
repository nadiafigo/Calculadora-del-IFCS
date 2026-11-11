/**
 * Mapa modal para seleccionar coordenadas con reverse geocoding via Nominatim.
 * Llena: LocPais, LocCiudad, LocVia, LocColonia, LocX, LocY.
 * Graceful: si Nominatim falla/timeout, igual setea coords y deja el resto.
 * Los campos que llena disparan `input`/`change` para que form.js guarde el borrador,
 * actualice el avance y quite los errores, igual que si se hubieran escrito a mano.
 */
(function () {
  const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";
  const TIMEOUT_MS = 5000;
  const MORELIA_CENTER = [19.7008, -101.1844];
  const ZOOM_INICIAL = 13;

  let mapa = null;
  let marker = null;
  let coordsSeleccionadas = null;
  let abiertoDesde = null;

  function $(id) { return document.getElementById(id); }

  function abrirModal() {
    const hint = $("hint-mapa");
    if (!window.L) {
      // Sin red el script de Leaflet no carga: se avisa junto al botón en lugar de abrir un modal vacío.
      if (hint) hint.textContent = "El mapa no cargó (¿sin conexión?). Escribe las coordenadas a mano.";
      return;
    }
    const modal = $("mapa-modal");
    abiertoDesde = document.activeElement;
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
    $("btn-cerrar-mapa")?.focus();
  }

  function cerrarModal() {
    $("mapa-modal").classList.add("hidden");
    if (abiertoDesde && typeof abiertoDesde.focus === "function") abiertoDesde.focus();
    abiertoDesde = null;
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

  function poner(id, val, sobrescribir) {
    const el = $(id);
    if (!el || !val || (!sobrescribir && el.value)) return;
    el.value = val;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function confirmar() {
    if (!coordsSeleccionadas) return;
    const { lat, lng, datos } = coordsSeleccionadas;

    // Datos de geocoding solo si están vacíos (el país va antes que las coordenadas
    // para que el aviso de «fuera de México» se calcule con el país ya puesto).
    if (datos) {
      poner("LocPais", datos.pais, false);
      poner("LocCiudad", datos.ciudad, false);
      poner("LocVia", datos.via, false);
      poner("LocColonia", datos.colonia, false);
    }

    // Coords siempre se setean (sobreescribiendo)
    poner("LocX", lng.toFixed(6), true);
    poner("LocY", lat.toFixed(6), true);

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
