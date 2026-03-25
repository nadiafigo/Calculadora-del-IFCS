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
    let factibilidad;
    if (total <= 20) {
      factibilidad = "Largo plazo";
    } else if (total <= 65) {
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

    // Guardar IDs y textos de cada select para diagnósticos
    [...camposObligatorios, ...camposOpcionales].forEach(id => {
      const el = document.getElementById(id);
      if (el && el.tagName === "SELECT") {
        const option = el.options[el.selectedIndex];
        localStorage.setItem(`${id}_id`, option?.id || "");
        localStorage.setItem(`${id}_txt`, option?.textContent.trim() || "");
        localStorage.setItem(`${id}_val`, el.value || "");
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
      factibilidad: factibilidad
    };

    // ---- Enviar a Supabase ----
    let supabaseOk = false;

    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      try {
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
          console.error("Supabase error:", res.status, errorBody);
          showToast("Error al guardar datos. Redirigiendo...", "error");
        } else {
          console.log("Datos guardados en Supabase");
          supabaseOk = true;
          showToast("Datos guardados correctamente", "success");
        }
      } catch (err) {
        console.warn("No se pudieron enviar datos a Supabase:", err);
        showToast("Sin conexión. Redirigiendo...", "error");
      }
    }

    // ---- Redirigir a resultado con delay para ver el toast ----
    setTimeout(() => {
      window.location.href = "html/resultado.html?total=" + total;
    }, supabaseOk ? 1500 : 1000);
  });
});
