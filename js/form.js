/**
 * form.js — Lógica del formulario de la Calculadora IFCS (sólo index.html)
 *
 * Maneja:
 * - Campos condicionales (show/hide). Los condicionales visibles son obligatorios.
 * - Borrador en localStorage: cada cambio se guarda y se restaura al recargar.
 * - Indicador de avance por paso (obligatorios llenos / obligatorios visibles).
 * - Validación: vacíos, correo, coordenadas en rango, aviso si caen fuera de México.
 *   Errores accesibles: aria-invalid, aria-describedby, foco al primero, aviso «Faltan N campos».
 * - Limpieza al guardar: trim, mayúscula inicial en ciudad/colonia/vialidad, ciudad unificada
 *   con las del archivo (datalist leído de Supabase).
 * - Envío a Supabase (return=minimal, public_token generado aquí).
 * - Envío sin señal: la evaluación se guarda en una cola local y se reintenta al cargar la
 *   portada, en el evento `online` y con «Reintentar ahora».
 * - Recordar nombre/colectivo/correo entre sesiones (ifcs_evaluador_v1).
 */

// Credenciales Supabase cargadas desde config.js (SUPABASE_URL, SUPABASE_ANON_KEY)

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("CalcForm");
  if (!form) return;
  const $ = id => document.getElementById(id);

  const EVALUADOR_KEY = "ifcs_evaluador_v1";
  const BORRADOR_KEY = "ifcs_borrador_v1";
  const COLA_KEY = "ifcs_cola_v1";
  const CAMPOS_EVALUADOR = ["FuenteNombre", "FuenteOrg", "FuenteCorreo"];
  const CORREO_LIGA = "adiospuentesantipeatonales@ligapeatonal.org";
  const hayBase = typeof SUPABASE_URL !== "undefined" && SUPABASE_URL
    && typeof SUPABASE_ANON_KEY !== "undefined" && SUPABASE_ANON_KEY;

  // localStorage puede no existir o lanzar (incógnito estricto, cuota llena): nunca rompe el form.
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* noop */ } },
    json(k, fallback) {
      try { const raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : fallback; } catch (e) { return fallback; }
    }
  };

  // Clave de comparación sin acentos ni mayúsculas (la misma que usa archivo.js).
  const clave = s => (typeof archivoClaveCiudad === "function")
    ? archivoClaveCiudad(s)
    : String(s || "").trim().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const movimiento = () => (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) ? "auto" : "smooth";

  function uuid() {
    if (window.crypto && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    if (window.crypto && typeof crypto.getRandomValues === "function") {
      const b = crypto.getRandomValues(new Uint8Array(16));
      b[6] = (b[6] & 0x0f) | 0x40;
      b[8] = (b[8] & 0x3f) | 0x80;
      const h = Array.from(b, x => x.toString(16).padStart(2, "0")).join("");
      return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
    }
    return null;
  }

  function hoyISO() {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  // ========================================
  // RECORDAR AL EVALUADOR (nombre, colectivo, correo)
  // ========================================

  function restaurarEvaluador() {
    const data = ls.json(EVALUADOR_KEY, null);
    if (!data || typeof data !== "object") return;
    CAMPOS_EVALUADOR.forEach(id => {
      const el = $(id);
      if (el && data[id] && !el.value) el.value = data[id];
    });
  }

  function guardarEvaluador() {
    const data = {};
    CAMPOS_EVALUADOR.forEach(id => {
      const el = $(id);
      if (el && el.value) data[id] = el.value;
    });
    if (Object.keys(data).length > 0) ls.set(EVALUADOR_KEY, JSON.stringify(data));
  }

  // ========================================
  // CAMPOS CONDICIONALES
  // ========================================

  const viaRevo = $("ViaRevo");
  const boxViaRevoTipo = $("Box_ViaRevoTipo");
  if (viaRevo && boxViaRevoTipo) {
    viaRevo.addEventListener("change", () => {
      boxViaRevoTipo.classList.toggle("hidden", viaRevo.value !== "6");
      if (viaRevo.value !== "6") {
        const sel = $("ViaRevoTipo");
        if (sel) { sel.selectedIndex = 0; clearFieldError(sel); }
      }
    });
  }

  const pteTipoAcc = $("PteTipoAcc");
  if (pteTipoAcc) {
    pteTipoAcc.addEventListener("change", () => {
      const val = pteTipoAcc.value;
      const isRampa = val === "2";
      const isEscalera = val === "4";

      $("Box_PtePendiente")?.classList.toggle("hidden", !isRampa);
      $("Box_PteDistDesc")?.classList.toggle("hidden", !isRampa);
      $("Box_PteLongCami")?.classList.toggle("hidden", !isRampa);
      $("Box_PteNumEsc")?.classList.toggle("hidden", !isEscalera);

      if (!isRampa) {
        ["PtePendiente", "PteDistDesc", "PteLongCami"].forEach(id => {
          const sel = $(id);
          if (sel) { sel.selectedIndex = 0; clearFieldError(sel); }
        });
      }
      if (!isEscalera) {
        const sel = $("PteNumEsc");
        if (sel) { sel.selectedIndex = 0; clearFieldError(sel); }
      }
    });
  }

  const ptePubli = $("PtePubli");
  if (ptePubli) {
    ptePubli.addEventListener("change", () => {
      $("Box_Visibilidad")?.classList.toggle("hidden", ptePubli.value !== "1");
      if (ptePubli.value !== "1") {
        const sel = $("PtePubliVisib");
        if (sel) { sel.selectedIndex = 0; clearFieldError(sel); }
      }
    });
  }

  const CONTROLES_CONDICIONALES = ["ViaRevo", "PteTipoAcc", "PtePubli"];

  // ========================================
  // TOAST
  // ========================================

  const toastContainer = document.createElement("div");
  toastContainer.className = "toast-container";
  toastContainer.innerHTML = '<div class="toast" id="toast" role="status"></div>';
  document.body.appendChild(toastContainer);

  function showToast(message, type) {
    const toast = $("toast");
    toast.textContent = message;
    toast.className = "toast";
    if (type) toast.classList.add("toast--" + type);
    void toast.offsetWidth;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 3000);
  }

  // ========================================
  // ERRORES ACCESIBLES
  // ========================================

  const resumen = $("form-resumen");

  // aria-describedby original (p. ej. el hint del correo) para no perderlo al poner/quitar errores.
  form.querySelectorAll("[aria-describedby]").forEach(el => { el.dataset.descBase = el.getAttribute("aria-describedby"); });

  const errorId = el => "err-" + (el.id || el.name);

  function actualizarDescribedBy(el) {
    const ids = [];
    if (el.dataset.descBase) ids.push(el.dataset.descBase);
    if ($(errorId(el))) ids.push(errorId(el));
    if (el.dataset.aviso && $(el.dataset.aviso)) ids.push(el.dataset.aviso);
    if (ids.length) el.setAttribute("aria-describedby", ids.join(" "));
    else el.removeAttribute("aria-describedby");
  }

  function clearFieldError(el) {
    if (!el) return;
    el.classList.remove("field-error", "shake");
    el.removeAttribute("aria-invalid");
    const msg = $(errorId(el)) || el.parentElement.querySelector(".error-msg");
    if (msg) msg.remove();
    actualizarDescribedBy(el);
    if (resumen && !form.querySelector(".field-error")) resumen.textContent = "";
  }

  function setFieldError(el, message) {
    el.classList.add("field-error");
    el.setAttribute("aria-invalid", "true");
    let span = $(errorId(el));
    if (!span) {
      span = document.createElement("span");
      span.className = "error-msg";
      span.id = errorId(el);
      el.parentElement.appendChild(span);
    }
    span.textContent = message;
    actualizarDescribedBy(el);
  }

  // Al corregir un campo se quita su error.
  form.querySelectorAll("input, select").forEach(el => {
    const evt = (el.tagName === "SELECT" || el.type === "checkbox" || el.type === "date") ? "change" : "input";
    el.addEventListener(evt, () => clearFieldError(el));
    if (evt === "change" && el.type === "date") el.addEventListener("input", () => clearFieldError(el));
  });

  // ========================================
  // VALIDACIÓN
  // ========================================

  const RE_CORREO = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[^\s@.]{2,}$/;

  /** "−101,22" → -101.22; NaN si no es un número decimal simple. */
  function numero(v) {
    const s = String(v ?? "").trim().replace(/−/g, "-").replace(",", ".");
    if (!/^[-+]?\d+(\.\d+)?$/.test(s)) return NaN;
    return parseFloat(s);
  }

  const estaVacio = el => (el.type === "checkbox" ? !el.checked : el.value.trim() === "");

  /** Mensaje si el valor (ya lleno) tiene un formato que no sirve; "" si está bien. */
  function errorFormato(el) {
    const v = el.value.trim();
    if (!v) return "";
    if (el.id === "FuenteCorreo" && !RE_CORREO.test(v)) return "Revisa el correo; debe verse como nombre@dominio.com";
    if (el.id === "LocX" || el.id === "LocY") {
      const n = numero(v);
      if (isNaN(n)) return `Escribe sólo el número, por ejemplo ${el.id === "LocX" ? "-101.221780" : "19.676883"}`;
      if (el.id === "LocX" && (n < -180 || n > 180)) return "La longitud (X) va de −180 a 180";
      if (el.id === "LocY" && (n < -90 || n > 90)) return "La latitud (Y) va de −90 a 90. ¿Quedaron al revés X y Y?";
    }
    if (el.id === "FuenteFecha" && v > hoyISO()) return "La fecha no puede ser posterior a hoy";
    return "";
  }

  // Aviso (no bloquea) si las coordenadas caen fuera de México y el país es México o está vacío.
  const AVISO_COORDS = "aviso-coords";
  ["LocX", "LocY"].forEach(id => { const el = $(id); if (el) el.dataset.aviso = AVISO_COORDS; });

  function revisarCoordsMexico() {
    const x = numero($("LocX")?.value), y = numero($("LocY")?.value);
    const pais = clave($("LocPais")?.value);
    const aplica = !pais || pais === "mexico" || pais === "mx";
    let msg = "";
    if (aplica && !isNaN(x) && !isNaN(y) && Math.abs(x) <= 180 && Math.abs(y) <= 90) {
      const enMexico = y >= 14.3 && y <= 32.8 && x >= -118.6 && x <= -86.5;
      if (!enMexico) msg = "Estas coordenadas caen fuera de México. Revisa que X sea la longitud (negativa, como -101.22) y Y la latitud.";
    }
    let aviso = $(AVISO_COORDS);
    if (msg) {
      if (!aviso) {
        aviso = document.createElement("span");
        aviso.className = "aviso-msg";
        aviso.id = AVISO_COORDS;
        $("LocY").parentElement.appendChild(aviso);
      }
      aviso.textContent = msg;
    } else if (aviso) {
      aviso.remove();
    }
    ["LocX", "LocY"].forEach(id => { const el = $(id); if (el) actualizarDescribedBy(el); });
  }

  // Un mensaje que aparece al salir de un campo mueve lo de abajo. Si se salió con un clic
  // (p. ej. en la casilla de consentimiento), el mensaje espera a que termine ese clic: si
  // no, el botón se mueve entre mousedown y mouseup y el clic se pierde.
  let punteroAbajo = false;
  document.addEventListener("pointerdown", () => { punteroAbajo = true; }, true);
  document.addEventListener("pointerup", () => { punteroAbajo = false; }, true);
  document.addEventListener("pointercancel", () => { punteroAbajo = false; }, true);
  function despuesDelClic(fn) {
    if (!punteroAbajo) return fn();
    let hecho = false;
    const correr = () => {
      if (hecho) return;
      hecho = true;
      punteroAbajo = false;
      document.removeEventListener("click", correr);
      setTimeout(fn, 0);
    };
    document.addEventListener("click", correr);
    setTimeout(correr, 700); // por si el puntero se soltó fuera y no hubo clic
  }

  // Los errores de formato se señalan al salir del campo, no mientras se escribe.
  ["FuenteCorreo", "LocX", "LocY", "FuenteFecha"].forEach(id => {
    const el = $(id);
    if (!el) return;
    el.addEventListener("change", () => despuesDelClic(() => {
      const msg = errorFormato(el);
      if (msg) setFieldError(el, msg);
    }));
  });
  ["LocX", "LocY", "LocPais"].forEach(id => $(id)?.addEventListener("change", () => despuesDelClic(revisarCoordsMexico)));
  if ($("FuenteFecha")) $("FuenteFecha").max = hoyISO();

  const obligatoriosVisibles = raiz => [...raiz.querySelectorAll("[required]")].filter(el => !el.closest(".hidden"));

  function anunciar(faltan, corregir) {
    if (!resumen) return;
    const n = (k, uno, varios) => (k === 1 ? `1 ${uno}` : `${k} ${varios}`);
    let texto = "";
    if (faltan) texto = `${faltan === 1 ? "Falta" : "Faltan"} ${n(faltan, "campo", "campos")}`;
    if (corregir) texto += (texto ? " y " : "Hay ") + `${n(corregir, "campo", "campos")} por corregir`;
    resumen.textContent = "";
    // Vaciar y volver a escribir hace que el lector de pantalla lo repita aunque el texto sea igual.
    setTimeout(() => { resumen.textContent = texto ? texto + "." : ""; }, 60);
  }

  function validateForm() {
    form.querySelectorAll(".field-error").forEach(el => clearFieldError(el));

    let firstError = null, faltan = 0, corregir = 0;
    obligatoriosVisibles(form).forEach(el => {
      let msg = "";
      if (estaVacio(el)) {
        msg = el.type === "checkbox" ? "Marca la casilla para poder enviar" : "Este campo es obligatorio";
        faltan++;
      } else {
        msg = errorFormato(el);
        if (msg) corregir++;
      }
      if (msg) {
        setFieldError(el, msg);
        if (!firstError) firstError = el;
      }
    });

    anunciar(faltan, corregir);

    if (firstError) {
      firstError.classList.add("shake");
      firstError.addEventListener("animationend", () => firstError.classList.remove("shake"), { once: true });
      firstError.focus({ preventScroll: true });
      firstError.scrollIntoView({ behavior: movimiento(), block: "center" });
    }
    return !firstError;
  }

  // ========================================
  // LIMPIEZA AL GUARDAR
  // ========================================

  const ciudadesCanon = {}; // clave sin acentos → forma usada en el archivo

  const capInicial = s => (s ? s.charAt(0).toLocaleUpperCase("es") + s.slice(1) : s);

  function normalizarTextos() {
    form.querySelectorAll('input[type="text"], input[type="email"]').forEach(el => {
      const limpio = el.value.replace(/\s+/g, " ").trim();
      if (limpio !== el.value) el.value = limpio;
    });
    ["LocCiudad", "LocColonia", "LocVia"].forEach(id => {
      const el = $(id);
      if (el) el.value = capInicial(el.value);
    });
    const ciudad = $("LocCiudad");
    if (ciudad && ciudadesCanon[clave(ciudad.value)]) ciudad.value = ciudadesCanon[clave(ciudad.value)];
    ["LocX", "LocY"].forEach(id => {
      const el = $(id);
      const n = el ? numero(el.value) : NaN;
      if (!isNaN(n)) el.value = el.value.trim().replace(/−/g, "-").replace(",", ".");
    });
  }

  // Ciudades ya evaluadas (aprobadas) para el datalist, unificadas sin acentos ni mayúsculas.
  async function cargarCiudades() {
    const lista = $("ciudades-lista");
    if (!lista || !hayBase) return;
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/evaluaciones?select=loc_ciudad&aprobado_mapa=eq.true`, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
      });
      if (!res.ok) return;
      const filas = (await res.json()).filter(f => f && f.loc_ciudad && String(f.loc_ciudad).trim() && f.loc_ciudad !== "None");
      let canon;
      if (typeof archivoCanonCiudades === "function") {
        canon = archivoCanonCiudades(filas);
      } else {
        canon = {};
        filas.forEach(f => { const k = clave(f.loc_ciudad); if (!canon[k]) canon[k] = String(f.loc_ciudad).trim(); });
      }
      Object.assign(ciudadesCanon, canon);
      const nombres = [...new Set(Object.values(canon))].filter(Boolean).sort((a, b) => a.localeCompare(b, "es"));
      lista.innerHTML = nombres.map(n => `<option value="${esc(n)}"></option>`).join("");
    } catch (e) {
      // Sin red: el campo sigue funcionando sin sugerencias.
    }
  }

  // ========================================
  // INDICADOR DE AVANCE
  // ========================================

  const pasos = [...form.querySelectorAll(".form-section-cont[data-paso]")];
  const progreso = $("progreso");

  function actualizarProgreso() {
    if (!progreso) return;
    let hechos = 0, total = 0;
    pasos.forEach(sec => {
      const campos = obligatoriosVisibles(sec);
      const listos = campos.filter(el => !estaVacio(el)).length;
      hechos += listos;
      total += campos.length;
      const link = progreso.querySelector(`a[data-paso="${sec.dataset.paso}"]`);
      if (!link) return;
      link.querySelector(".progreso-cuenta").textContent = `${listos}/${campos.length}`;
      link.querySelector(".progreso-sr").textContent = `: ${listos} de ${campos.length} obligatorios`;
      link.dataset.estado = listos === campos.length ? "completo" : listos ? "parcial" : "vacio";
      link.style.setProperty("--avance", campos.length ? (listos / campos.length).toFixed(3) : "0");
    });
    const t = $("progreso-total");
    if (t) t.textContent = `${hechos} de ${total}`;
  }

  // Paso en pantalla → aria-current="step".
  if (progreso && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(entradas => {
      entradas.forEach(en => {
        if (!en.isIntersecting) return;
        progreso.querySelectorAll("a[data-paso]").forEach(a => {
          if (a.dataset.paso === en.target.dataset.paso) a.setAttribute("aria-current", "step");
          else a.removeAttribute("aria-current");
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    pasos.forEach(sec => io.observe(sec));
  }

  // ========================================
  // BORRADOR (se guarda cada cambio; se restaura al recargar)
  // ========================================

  const avisoBorrador = $("borrador-aviso");
  let restaurando = false;
  let borradorCerrado = false; // tras enviar o encolar ya no se guarda borrador en esta visita
  let timerBorrador = null;

  const camposBorrador = () => [...form.elements].filter(el =>
    el.id && (el.tagName === "SELECT" || (el.tagName === "INPUT" && !["submit", "button", "reset", "file"].includes(el.type))));

  function guardarBorrador() {
    timerBorrador = null;
    if (restaurando || borradorCerrado) return;
    const campos = {};
    let alguno = false;
    camposBorrador().forEach(el => {
      let v;
      if (el.type === "checkbox") v = el.checked;
      // Varias opciones comparten value: se guarda el id de la opción elegida.
      else if (el.tagName === "SELECT") v = el.selectedIndex > 0 ? { op: el.options[el.selectedIndex].id, i: el.selectedIndex } : null;
      else v = el.value;
      campos[el.id] = v;
      if (v) alguno = true;
    });
    if (!alguno) { ls.del(BORRADOR_KEY); return; }
    ls.set(BORRADOR_KEY, JSON.stringify({ v: 1, guardado: new Date().toISOString(), campos }));
  }

  function programarBorrador() {
    if (restaurando || borradorCerrado) return;
    clearTimeout(timerBorrador);
    timerBorrador = setTimeout(guardarBorrador, 250);
  }

  function cerrarBorrador() {
    borradorCerrado = true;
    clearTimeout(timerBorrador);
    timerBorrador = null;
    ls.del(BORRADOR_KEY);
  }

  /** Devuelve true si se recuperó algo más que los datos recordados del evaluador. */
  function restaurarBorrador() {
    const data = ls.json(BORRADOR_KEY, null);
    if (!data || typeof data.campos !== "object" || !data.campos) return false;
    let recuperado = false;
    restaurando = true;
    try {
      // En orden del documento: el control de un condicional va antes que su caja, así el
      // `change` muestra la caja antes de que se llene su campo.
      camposBorrador().forEach(el => {
        if (!(el.id in data.campos)) return;
        const v = data.campos[el.id];
        let puesto = false;
        if (el.type === "checkbox") {
          el.checked = v === true;
          puesto = el.checked;
          el.dispatchEvent(new Event("change", { bubbles: true }));
        } else if (el.tagName === "SELECT") {
          if (!v) return;
          const op = v.op ? document.getElementById(v.op) : null;
          const idx = op && el.contains(op) ? op.index : (Number.isInteger(v.i) ? v.i : 0);
          if (idx > 0 && idx < el.options.length) {
            el.selectedIndex = idx;
            el.dispatchEvent(new Event("change", { bubbles: true }));
            puesto = true;
          }
        } else if (typeof v === "string" && v) {
          el.value = v;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          puesto = true;
        }
        if (puesto && !CAMPOS_EVALUADOR.includes(el.id)) recuperado = true;
      });
    } finally {
      restaurando = false;
    }
    return recuperado;
  }

  function empezarDeCero() {
    clearTimeout(timerBorrador);
    timerBorrador = null;
    ls.del(BORRADOR_KEY);
    restaurando = true;
    try {
      form.reset();
      CONTROLES_CONDICIONALES.forEach(id => $(id)?.dispatchEvent(new Event("change", { bubbles: true })));
      form.querySelectorAll(".field-error").forEach(el => clearFieldError(el));
      restaurarEvaluador();
    } finally {
      restaurando = false;
    }
    revisarCoordsMexico();
    actualizarProgreso();
    if (avisoBorrador) avisoBorrador.hidden = true;
    $("LocPais")?.focus({ preventScroll: true });
    $("paso-1")?.scrollIntoView({ behavior: movimiento(), block: "start" });
  }

  form.addEventListener("input", () => { programarBorrador(); actualizarProgreso(); });
  form.addEventListener("change", () => { programarBorrador(); actualizarProgreso(); });
  // Si se recarga antes de que corra el temporizador, se guarda igual.
  window.addEventListener("pagehide", () => { if (timerBorrador) { clearTimeout(timerBorrador); guardarBorrador(); } });
  $("btn-empezar-de-cero")?.addEventListener("click", empezarDeCero);

  // Al cargar: primero el borrador, luego lo recordado del evaluador (sólo llena vacíos).
  const hayBorrador = restaurarBorrador();
  restaurarEvaluador();
  if (hayBorrador && avisoBorrador) avisoBorrador.hidden = false;
  revisarCoordsMexico();
  actualizarProgreso();
  cargarCiudades();

  // ========================================
  // ENVÍO A SUPABASE Y COLA SIN SEÑAL
  // ========================================

  const ENDPOINT = hayBase ? `${SUPABASE_URL}/rest/v1/evaluaciones` : "";
  const permalink = token => new URL(`html/resultado.html?r=${encodeURIComponent(token)}`, location.href).href;

  /** { ok } si la fila quedó en la base; { red: true } si el fallo es de conexión o del servidor. */
  async function postEvaluacion(payload) {
    if (navigator.onLine === false) return { ok: false, red: true, status: 0 };
    const ctrl = typeof AbortController === "function" ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), 20000) : null;
    try {
      // return=minimal: PostgREST no hace RETURNING, así RLS del SELECT
      // (anon_select_approved_only) no bloquea el INSERT.
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          "Prefer": "return=minimal"
        },
        body: JSON.stringify(payload),
        signal: ctrl ? ctrl.signal : undefined
      });
      // 409 = el public_token ya existe: un intento anterior sí llegó aunque no vimos la respuesta.
      if (res.ok || res.status === 409) return { ok: true, status: res.status };
      const cuerpo = await res.text().catch(() => "");
      return { ok: false, status: res.status, cuerpo, red: res.status >= 500 || res.status === 408 || res.status === 429 };
    } catch (err) {
      return { ok: false, status: 0, red: true, err };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  const leerCola = () => { const c = ls.json(COLA_KEY, []); return Array.isArray(c) ? c.filter(it => it && it.payload) : []; };
  const escribirCola = cola => (cola.length ? ls.set(COLA_KEY, JSON.stringify(cola)) : (ls.del(COLA_KEY), true));
  const firma = p => { const { public_token, ...resto } = p; return JSON.stringify(resto); };

  /** Guarda la evaluación en la cola (sin duplicar si se vuelve a enviar la misma). */
  function encolar(payload, total) {
    const cola = leerCola();
    let item = cola.find(it => firma(it.payload) === firma(payload));
    if (!item) {
      item = { token: payload.public_token || null, payload, total, creado: new Date().toISOString(), intentos: 1 };
      cola.push(item);
    }
    return { item, guardado: escribirCola(cola) };
  }

  // ---- Aviso fijo de evaluaciones sin enviar ----
  const dock = $("envio-dock");
  const dockEtiqueta = $("envio-dock-etiqueta");
  const dockTexto = $("envio-dock-texto");
  const dockEnlaces = $("envio-dock-enlaces");
  const btnReintentar = $("btn-reintentar");
  const linkLocal = $("link-reporte-local");
  const anuncioEnvio = $("envio-anuncio");

  function pintarDock(estado, op = {}) {
    if (!dock) return;
    const pendientes = leerCola().length;
    dock.hidden = false;
    dock.dataset.estado = estado;
    dockEnlaces.hidden = true;
    dockEnlaces.innerHTML = "";
    btnReintentar.hidden = false;
    btnReintentar.disabled = false;
    btnReintentar.textContent = "Reintentar ahora";
    if (linkLocal) linkLocal.hidden = op.total === undefined;
    if (linkLocal && op.total !== undefined) linkLocal.href = `./html/resultado.html?total=${op.total}&pendiente=1`;

    let texto = "";
    if (estado === "enviando") {
      dockEtiqueta.textContent = "Enviando";
      texto = pendientes > 1 ? `Enviando ${pendientes} evaluaciones guardadas…` : "Enviando tu evaluación guardada…";
      btnReintentar.disabled = true;
      btnReintentar.textContent = "Enviando…";
    } else if (estado === "enviado") {
      dockEtiqueta.textContent = "Enviada";
      const n = op.enviados.length;
      texto = n > 1
        ? `Listo: ya se enviaron tus ${n} evaluaciones. Estos son sus enlaces permanentes:`
        : "Listo: tu evaluación ya se envió. Este es su enlace permanente:";
      if (pendientes) texto += ` Queda${pendientes > 1 ? "n" : ""} ${pendientes} por enviar.`;
      dockEnlaces.innerHTML = op.enviados.filter(it => it.token).map(it => {
        const url = permalink(it.token);
        const sitio = [it.payload.loc_vialidad, it.payload.loc_ciudad].filter(Boolean).join(", ") || "Reporte";
        return `<li><a href="${esc(url)}">${esc(sitio)}</a><button type="button" class="envio-dock__copiar" data-url="${esc(url)}">Copiar enlace</button></li>`;
      }).join("");
      dockEnlaces.hidden = !dockEnlaces.innerHTML;
      btnReintentar.hidden = !pendientes;
      if (linkLocal) linkLocal.hidden = true;
    } else if (estado === "sin-guardar") {
      dockEtiqueta.textContent = "Sin enviar";
      texto = "No pudimos enviar tu evaluación y este navegador no nos deja guardarla. No cierres esta página e intenta de nuevo cuando tengas señal.";
      btnReintentar.hidden = true;
    } else if (estado === "rechazada") {
      dockEtiqueta.textContent = "Sin enviar";
      texto = `La base de datos no aceptó la evaluación guardada${op.status ? ` (error ${op.status})` : ""}. Sigue en este dispositivo; si vuelve a pasar, escríbenos a ${CORREO_LIGA}.`;
    } else {
      dockEtiqueta.textContent = "Sin enviar";
      if (op.reintento) {
        texto = "Todavía no hay conexión. Tu evaluación sigue guardada en este dispositivo y la enviaremos en cuanto vuelva la señal.";
      } else if (pendientes > 1) {
        texto = `Tienes ${pendientes} evaluaciones guardadas en este dispositivo que no se han enviado. Las enviaremos cuando haya conexión.`;
      } else {
        texto = "No pudimos enviar tu evaluación. La guardamos en este dispositivo y la enviaremos cuando haya conexión.";
      }
    }
    dockTexto.textContent = texto;
    if (anuncioEnvio) {
      anuncioEnvio.textContent = "";
      setTimeout(() => { anuncioEnvio.textContent = texto; }, 60);
    }
  }

  let enviandoCola = false;

  async function enviarCola(op = {}) {
    if (enviandoCola || !hayBase) return;
    const cola = leerCola();
    if (!cola.length) return;
    enviandoCola = true;
    pintarDock("enviando");
    const enviados = [];
    let fallo = null;
    for (const item of cola) {
      const r = await postEvaluacion(item.payload);
      if (r.ok) { enviados.push(item); continue; }
      item.intentos = (item.intentos || 0) + 1;
      item.ultimoError = r.status;
      fallo = r;
      if (r.red) break; // sin señal: no tiene caso seguir con las demás
    }
    const enviadosTokens = new Set(enviados.map(it => firma(it.payload)));
    escribirCola(cola.filter(it => !enviadosTokens.has(firma(it.payload))));
    enviandoCola = false;

    if (enviados.length) {
      const ultimo = enviados[enviados.length - 1];
      if (ultimo.token) ls.set("last_public_token", ultimo.token);
      delete dock.dataset.total;
      pintarDock("enviado", { enviados });
      showToast(enviados.length > 1 ? "Tus evaluaciones ya se enviaron" : "Tu evaluación ya se envió", "success");
    } else if (fallo && !fallo.red) {
      pintarDock("rechazada", { status: fallo.status, total: op.total });
    } else {
      pintarDock("pendiente", { reintento: true, total: op.total });
    }
  }

  // dock.dataset.total sólo existe si la evaluación se encoló en esta visita: entonces el
  // reporte local (localStorage) es el de esa evaluación y se puede seguir ofreciendo.
  btnReintentar?.addEventListener("click", () => enviarCola({ total: dock.dataset.total }));
  $("btn-cerrar-dock")?.addEventListener("click", () => { dock.hidden = true; });
  dockEnlaces?.addEventListener("click", async e => {
    const b = e.target.closest(".envio-dock__copiar");
    if (!b) return;
    try { await navigator.clipboard.writeText(b.dataset.url); b.textContent = "Copiado"; }
    catch (err) { window.prompt("Copia el enlace:", b.dataset.url); }
  });
  window.addEventListener("online", () => enviarCola({ total: dock ? dock.dataset.total : undefined }));

  // Al cargar la portada: si quedó algo sin enviar, se avisa y se intenta de una vez.
  if (leerCola().length) {
    pintarDock("pendiente");
    if (navigator.onLine !== false) enviarCola();
  }

  // ========================================
  // SUBMIT DEL FORMULARIO
  // ========================================

  let enviandoForm = false;

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    if (enviandoForm) return;

    // ---- Limpiar y validar ----
    normalizarTextos();
    revisarCoordsMexico();
    actualizarProgreso();
    if (!validateForm()) return;

    const btnCalcular = $("VerResultado");
    const htmlOriginal = btnCalcular ? btnCalcular.innerHTML : "";
    const restaurarBoton = () => {
      enviandoForm = false;
      if (btnCalcular) { btnCalcular.disabled = false; btnCalcular.innerHTML = htmlOriginal; }
    };
    enviandoForm = true;
    if (btnCalcular) {
      btnCalcular.disabled = true;
      btnCalcular.textContent = "Enviando...";
    }

    // ---- Campos de puntaje ----
    const camposObligatorios = [
      "ViaCarriles", "ViaDistCruce", "ViaDistSemaf", "ViaBarreras",
      "ViaCamellones", "ViaRevo", "ViaVelPermi", "ViaVelOper",
      "EquipNum", "EquipDist", "EquipTipo",
      "PteObstBanq", "PteAnchoAcc", "PteTipoAcc", "PteAnchoPas",
      "PteCubierta", "PteIluminacion", "PtePubli"
    ];

    const camposOpcionales = [
      "ViaRevoTipo", "PteNumEsc", "PteLongCami",
      "PtePendiente", "PteDistDesc", "PtePubliVisib"
    ];

    // ---- Calcular total ----
    let total = 0;

    camposObligatorios.forEach(id => {
      const el = $(id);
      const valor = parseInt(el?.value || "0", 10);
      total += isNaN(valor) ? 0 : valor;
    });

    // Solo sumar condicionales que estén visibles (no dentro de un .hidden)
    camposOpcionales.forEach(id => {
      const el = $(id);
      if (el && el.closest(".hidden") === null && el.value !== "") {
        const valor = parseInt(el.value || "0", 10);
        total += isNaN(valor) ? 0 : valor;
      }
    });

    // ---- Determinar factibilidad ----
    // Rangos: Largo 0-30, Mediano 31-60, Corto >60
    let factibilidad;
    if (total <= 30) {
      factibilidad = "Largo plazo";
    } else if (total <= 60) {
      factibilidad = "Mediano plazo";
    } else {
      factibilidad = "Corto plazo";
    }

    // ---- Guardar en localStorage para resultado.html ----
    const ubicacion = {
      pais: $("LocPais")?.value || "",
      ciudad: $("LocCiudad")?.value || "",
      vialidad: $("LocVia")?.value || "",
      colonia: $("LocColonia")?.value || "",
      referencia: $("LocRef")?.value || "",
      x: $("LocX")?.value || "",
      y: $("LocY")?.value || ""
    };
    ls.set("datosUbicacion", JSON.stringify(ubicacion));

    // Guardar IDs y textos de cada select para diagnósticos.
    // `respuestas` va también a Supabase: es lo que permite regenerar el
    // reporte desde el link permanente sin depender de este localStorage.
    const respuestas = {};
    [...camposObligatorios, ...camposOpcionales].forEach(id => {
      const el = $(id);
      if (el && el.tagName === "SELECT") {
        const option = el.options[el.selectedIndex];
        const optId = option?.id || "";
        const optTxt = option?.textContent.trim() || "";
        ls.set(`${id}_id`, optId);
        ls.set(`${id}_txt`, optTxt);
        ls.set(`${id}_val`, el.value || "");
        // Solo opciones visibles y elegidas (los condicionales ocultos ya
        // vienen reseteados a índice 0 por los handlers de arriba).
        if (optId && el.value !== "" && el.closest(".hidden") === null) {
          respuestas[id] = { id: optId, txt: optTxt, val: el.value };
        }
      }
    });

    // Guardar campos de texto de fuente para PDF
    ls.set("fuente_nombre", $("FuenteNombre")?.value || "");
    ls.set("fuente_fecha", $("FuenteFecha")?.value || "");
    ls.set("fuente_org", $("FuenteOrg")?.value || "");
    ls.set("fuente_correo", $("FuenteCorreo")?.value || "");

    // ---- Helper: obtener texto del select ----
    function getSelectText(id) {
      const el = $(id);
      if (el && el.tagName === "SELECT" && el.selectedIndex > 0) {
        return el.options[el.selectedIndex].textContent.trim();
      }
      return null;
    }

    // ---- Construir payload para Supabase ----
    const payload = {
      loc_pais: ubicacion.pais || null,
      loc_ciudad: ubicacion.ciudad || null,
      loc_vialidad: ubicacion.vialidad || null,
      loc_colonia: ubicacion.colonia || null,
      loc_referencia: ubicacion.referencia || null,
      loc_x: ubicacion.x || null,
      loc_y: ubicacion.y || null,

      via_carriles: getSelectText("ViaCarriles"),
      via_dist_cruce: getSelectText("ViaDistCruce"),
      via_dist_semaf: getSelectText("ViaDistSemaf"),
      via_barreras: getSelectText("ViaBarreras"),
      via_camellones: getSelectText("ViaCamellones"),
      via_revo: getSelectText("ViaRevo"),
      via_revo_tipo: getSelectText("ViaRevoTipo"),
      via_vel_permi: getSelectText("ViaVelPermi"),
      via_vel_oper: getSelectText("ViaVelOper"),

      equip_num: getSelectText("EquipNum"),
      equip_dist: getSelectText("EquipDist"),
      equip_tipo: getSelectText("EquipTipo"),

      pte_obst_banq: getSelectText("PteObstBanq"),
      pte_ancho_acc: getSelectText("PteAnchoAcc"),
      pte_tipo_acc: getSelectText("PteTipoAcc"),
      pte_num_esc: getSelectText("PteNumEsc"),
      pte_long_cami: getSelectText("PteLongCami"),
      pte_pendiente: getSelectText("PtePendiente"),
      pte_dist_desc: getSelectText("PteDistDesc"),
      pte_ancho_pas: getSelectText("PteAnchoPas"),
      pte_cubierta: getSelectText("PteCubierta"),
      pte_iluminacion: getSelectText("PteIluminacion"),
      pte_publi: getSelectText("PtePubli"),
      pte_publi_visib: getSelectText("PtePubliVisib"),

      fuente_nombre: $("FuenteNombre")?.value || null,
      fuente_fecha: $("FuenteFecha")?.value || null,
      fuente_org: $("FuenteOrg")?.value || null,
      fuente_correo: $("FuenteCorreo")?.value || null,

      total_ifcs: total,
      factibilidad: factibilidad,
      respuestas: respuestas
    };

    // ---- ID provisional para el deep-link del mapa ----
    const fallbackId = uuid() || `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    try { sessionStorage.setItem("last_evaluation_id", fallbackId); } catch (err) { /* noop */ }

    // ---- Token del link permanente ----
    // Lo generamos aquí (no en la base) porque el INSERT va con
    // return=minimal y no podemos leer la fila de vuelta. Un UUID v4 no se
    // puede adivinar, así que sirve como "llave" del reporte. Si el envío
    // falla, el token viaja en la cola y el link sirve cuando se envíe.
    const publicToken = uuid();
    if (publicToken) payload.public_token = publicToken;

    const irAResultado = (conToken, demora) => {
      const url = "html/resultado.html?total=" + total + (conToken && publicToken ? "&r=" + publicToken : "");
      setTimeout(() => { window.location.href = url; }, demora);
    };

    if (!hayBase) {
      irAResultado(false, 1000);
      return;
    }

    const r = await postEvaluacion(payload);

    if (r.ok) {
      guardarEvaluador();
      cerrarBorrador();
      if (publicToken) ls.set("last_public_token", publicToken);
      showToast("Datos guardados correctamente", "success");
      irAResultado(true, 1500);
      return;
    }

    if (r.red) {
      // Sin señal o servidor caído: NO se redirige como si nada. Se guarda en la cola.
      console.warn("No se pudo enviar la evaluación; queda en la cola local:", r.err || r.status);
      const { guardado } = encolar(payload, total);
      restaurarBoton();
      if (guardado) {
        guardarEvaluador();
        cerrarBorrador();
        if (dock) dock.dataset.total = String(total);
        pintarDock("pendiente", { total });
      } else {
        pintarDock("sin-guardar", { total });
      }
      return;
    }

    // La base rechazó el envío (4xx): no tiene caso reintentar en automático. Se muestra el
    // reporte local sin link permanente y el borrador se conserva para volver a intentarlo.
    console.error("Supabase INSERT failed:", r.status, r.cuerpo);
    showToast("Error al guardar: tu reporte no quedó publicado. Redirigiendo...", "error");
    irAResultado(false, 2000);
  });

  // Para pruebas y depuración.
  window.ifcsForm = { leerCola, enviarCola, actualizarProgreso, guardarEvaluador };
});
