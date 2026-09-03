/**
 * form.js — Lógica del formulario de la Calculadora IFCS
 *
 * Maneja:
 * - Campos condicionales (show/hide)
 * - Validación personalizada
 * - Cálculo del total IFCS
 * - Envío de datos a Supabase
 * - Toast de confirmación
 * - Guardado en localStorage para página de resultados
 * - Redirección a resultado.html
 */

// Credenciales Supabase cargadas desde config.js (SUPABASE_URL, SUPABASE_ANON_KEY)

document.addEventListener("DOMContentLoaded", () => {

  // ---- Recordar datos del evaluador entre sesiones (localStorage) ----
  const EVALUADOR_KEY = "ifcs_evaluador_v1";

  function restaurarEvaluador() {
    try {
      const raw = localStorage.getItem(EVALUADOR_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      const campos = ["FuenteNombre", "FuenteOrg", "FuenteCorreo"];
      campos.forEach(id => {
        const el = document.getElementById(id);
        if (el && data[id] && !el.value) {
          el.value = data[id];
        }
      });
    } catch (e) {
      // localStorage corrupted o no disponible: silently ignore
      console.warn("No se pudo restaurar datos del evaluador:", e);
    }
  }

  function guardarEvaluador() {
    try {
      const data = {};
      ["FuenteNombre", "FuenteOrg", "FuenteCorreo"].forEach(id => {
        const el = document.getElementById(id);
        if (el && el.value) data[id] = el.value;
      });
      if (Object.keys(data).length > 0) {
        localStorage.setItem(EVALUADOR_KEY, JSON.stringify(data));
      }
    } catch (e) {
      // localStorage no disponible (incógnito strict, quota): silently ignore
      console.warn("No se pudo guardar datos del evaluador:", e);
    }
  }

  // Restaurar al cargar
  restaurarEvaluador();

  // ========================================
  // CAMPOS CONDICIONALES
  // ========================================

  const viaRevo = document.getElementById("ViaRevo");
  const boxViaRevoTipo = document.getElementById("Box_ViaRevoTipo");
  if (viaRevo && boxViaRevoTipo) {
    viaRevo.addEventListener("change", () => {
      boxViaRevoTipo.classList.toggle("hidden", viaRevo.value !== "6");
      if (viaRevo.value !== "6") {
        const sel = document.getElementById("ViaRevoTipo");
        if (sel) sel.selectedIndex = 0;
      }
    });
  }

  const pteTipoAcc = document.getElementById("PteTipoAcc");
  if (pteTipoAcc) {
    pteTipoAcc.addEventListener("change", () => {
      const val = pteTipoAcc.value;
      const isRampa = val === "2";
      const isEscalera = val === "4";

      document.getElementById("Box_PtePendiente")?.classList.toggle("hidden", !isRampa);
      document.getElementById("Box_PteDistDesc")?.classList.toggle("hidden", !isRampa);
      document.getElementById("Box_PteLongCami")?.classList.toggle("hidden", !isRampa);
      document.getElementById("Box_PteNumEsc")?.classList.toggle("hidden", !isEscalera);

      if (!isRampa) {
        ["PtePendiente", "PteDistDesc", "PteLongCami"].forEach(id => {
          const sel = document.getElementById(id);
          if (sel) sel.selectedIndex = 0;
        });
      }
      if (!isEscalera) {
        const sel = document.getElementById("PteNumEsc");
        if (sel) sel.selectedIndex = 0;
      }
    });
  }

  const ptePubli = document.getElementById("PtePubli");
  if (ptePubli) {
    ptePubli.addEventListener("change", () => {
      document.getElementById("Box_Visibilidad")?.classList.toggle("hidden", ptePubli.value !== "1");
      if (ptePubli.value !== "1") {
        const sel = document.getElementById("PtePubliVisib");
        if (sel) sel.selectedIndex = 0;
      }
    });
  }

  // ========================================
  // TOAST
  // ========================================

  const toastContainer = document.createElement("div");
  toastContainer.className = "toast-container";
  toastContainer.innerHTML = '<div class="toast" id="toast"></div>';
  document.body.appendChild(toastContainer);

  function showToast(message, type) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.className = "toast";
    if (type) toast.classList.add("toast--" + type);
    // Force reflow then show
    void toast.offsetWidth;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 3000);
  }

  // ========================================
  // VALIDACIÓN PERSONALIZADA
  // ========================================

  function clearFieldError(el) {
    el.classList.remove("field-error", "shake");
    const msg = el.parentElement.querySelector(".error-msg");
    if (msg) msg.remove();
  }

  function setFieldError(el, message) {
    el.classList.add("field-error");
    if (!el.parentElement.querySelector(".error-msg")) {
      const span = document.createElement("span");
      span.className = "error-msg";
      span.textContent = message;
      el.parentElement.appendChild(span);
    }
  }

  // Clear errors on interaction
  document.querySelectorAll("#CalcForm input, #CalcForm select").forEach(el => {
    const events = el.tagName === "SELECT" ? ["change"] : ["input"];
    events.forEach(evt => {
      el.addEventListener(evt, () => clearFieldError(el));
    });
  });

  function validateForm() {
    // Remove all previous errors
    document.querySelectorAll(".field-error").forEach(el => clearFieldError(el));

    let firstError = null;

    // All required fields in the form
    const requiredFields = document.querySelectorAll("#CalcForm [required]");

    requiredFields.forEach(el => {
      // Skip if inside a .hidden container (conditional field not shown)
      if (el.closest(".hidden")) return;

      let isEmpty = false;

      if (el.type === "checkbox") {
        isEmpty = !el.checked;
      } else if (el.tagName === "SELECT") {
        isEmpty = el.value === "";
      } else {
        isEmpty = el.value.trim() === "";
      }

      if (isEmpty) {
        setFieldError(el, "Este campo es obligatorio");
        if (!firstError) firstError = el;
      }
    });

    if (firstError) {
      // Shake the first error element
      firstError.classList.add("shake");
      firstError.addEventListener("animationend", () => {
        firstError.classList.remove("shake");
      }, { once: true });

      // Scroll to first error
      firstError.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    return !firstError;
  }

  // ========================================
  // SUBMIT DEL FORMULARIO
  // ========================================

  const form = document.getElementById("CalcForm");
  if (!form) return;

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    // ---- Validar ----
    if (!validateForm()) return;

    const btnCalcular = document.getElementById("VerResultado");
    const textoOriginal = btnCalcular?.textContent;

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
      const el = document.getElementById(id);
      const valor = parseInt(el?.value || "0", 10);
      total += isNaN(valor) ? 0 : valor;
    });

    // Solo sumar opcionales que estén visibles (no dentro de un .hidden)
    camposOpcionales.forEach(id => {
      const el = document.getElementById(id);
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
      pais: document.getElementById("LocPais")?.value || "",
      ciudad: document.getElementById("LocCiudad")?.value || "",
      vialidad: document.getElementById("LocVia")?.value || "",
      colonia: document.getElementById("LocColonia")?.value || "",
      referencia: document.getElementById("LocRef")?.value || "",
      x: document.getElementById("LocX")?.value || "",
      y: document.getElementById("LocY")?.value || ""
    };
    localStorage.setItem("datosUbicacion", JSON.stringify(ubicacion));

    // Guardar IDs y textos de cada select para diagnósticos.
    // `respuestas` va también a Supabase: es lo que permite regenerar el
    // reporte desde el link permanente sin depender de este localStorage.
    const respuestas = {};
    [...camposObligatorios, ...camposOpcionales].forEach(id => {
      const el = document.getElementById(id);
      if (el && el.tagName === "SELECT") {
        const option = el.options[el.selectedIndex];
        const optId  = option?.id || "";
        const optTxt = option?.textContent.trim() || "";
        localStorage.setItem(`${id}_id`, optId);
        localStorage.setItem(`${id}_txt`, optTxt);
        localStorage.setItem(`${id}_val`, el.value || "");
        // Solo opciones visibles y elegidas (los condicionales ocultos ya
        // vienen reseteados a índice 0 por los handlers de arriba).
        if (optId && el.value !== "" && el.closest(".hidden") === null) {
          respuestas[id] = { id: optId, txt: optTxt, val: el.value };
        }
      }
    });

    // Guardar campos de texto de fuente para PDF
    localStorage.setItem("fuente_nombre", document.getElementById("FuenteNombre")?.value || "");
    localStorage.setItem("fuente_fecha", document.getElementById("FuenteFecha")?.value || "");
    localStorage.setItem("fuente_org", document.getElementById("FuenteOrg")?.value || "");
    localStorage.setItem("fuente_correo", document.getElementById("FuenteCorreo")?.value || "");

    // ---- Helper: obtener texto del select ----
    function getSelectText(id) {
      const el = document.getElementById(id);
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

      fuente_nombre: document.getElementById("FuenteNombre")?.value || null,
      fuente_fecha: document.getElementById("FuenteFecha")?.value || null,
      fuente_org: document.getElementById("FuenteOrg")?.value || null,
      fuente_correo: document.getElementById("FuenteCorreo")?.value || null,

      total_ifcs: total,
      factibilidad: factibilidad,
      respuestas: respuestas
    };

    // ---- ID provisional (sobrescrito si Supabase responde con el id real) ----
    const fallbackId = (window.crypto && typeof crypto.randomUUID === "function")
      ? crypto.randomUUID()
      : `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem("last_evaluation_id", fallbackId);

    // ---- Token del link permanente ----
    // Lo generamos aquí (no en la base) porque el INSERT va con
    // return=minimal y no podemos leer la fila de vuelta. Un UUID v4 no se
    // puede adivinar, así que sirve como "llave" del reporte.
    const publicToken = (window.crypto && typeof crypto.randomUUID === "function")
      ? crypto.randomUUID()
      : null;
    if (publicToken) payload.public_token = publicToken;

    // ---- Enviar a Supabase ----
    let supabaseOk = false;

    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      try {
        // return=minimal: PostgREST no hace RETURNING, así RLS del SELECT
        // (anon_select_approved_only) no bloquea el INSERT. La fila se
        // persiste; usamos el fallbackId UUID generado arriba como
        // last_evaluation_id (la fila no es visible al anon hasta que admin
        // la apruebe, así que el id real no nos sirve para deep-link).
        const res = await fetch(`${SUPABASE_URL}/rest/v1/evaluaciones`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
            "Prefer": "return=minimal"
          },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const errorBody = await res.text();
          console.error("Supabase INSERT failed:", res.status, errorBody);
          showToast("Error al guardar datos. Redirigiendo...", "error");
        } else {
          console.log("Datos guardados en Supabase (return=minimal)");
          supabaseOk = true;
          guardarEvaluador();
          showToast("Datos guardados correctamente", "success");
          // No leemos body — return=minimal no devuelve nada. El
          // fallbackId UUID generado arriba ya está en last_evaluation_id.
        }
      } catch (err) {
        console.warn("No se pudieron enviar datos a Supabase:", err);
        showToast("Sin conexión. Redirigiendo...", "error");
      }
    }

    // ---- Redirigir a resultado con delay para ver el toast ----
    // Solo llevamos el token si la fila quedó guardada: sin fila en la base
    // el link no resolvería nada.
    const resultadoUrl = "html/resultado.html?total=" + total
      + (supabaseOk && publicToken ? "&r=" + publicToken : "");
    if (supabaseOk && publicToken) {
      try { localStorage.setItem("last_public_token", publicToken); } catch (e) { /* noop */ }
    }
    setTimeout(() => {
      window.location.href = resultadoUrl;
    }, supabaseOk ? 1500 : 1000);
  });
});
