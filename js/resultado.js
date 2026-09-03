/**
 * resultado.js — Lógica de la página de resultados
 *
 * Dos fuentes de datos, una sola página:
 *  - Flujo normal: total en la URL + selecciones en localStorage (form.js).
 *  - Link permanente (?r=<token>): se piden los datos guardados a Supabase
 *    (RPC get_evaluacion_publica) y se reconstruye el mismo reporte. Si la
 *    base no responde, cae al localStorage.
 */

// Columna de Supabase que guarda el TEXTO de cada select del formulario.
// Sirve para (a) leer la fila remota y (b) reconstruir el id de la opción
// en evaluaciones guardadas antes de que existiera la columna `respuestas`.
const CAMPO_COLUMNA = {
  ViaCarriles: "via_carriles", ViaDistCruce: "via_dist_cruce", ViaDistSemaf: "via_dist_semaf",
  ViaBarreras: "via_barreras", ViaCamellones: "via_camellones", ViaRevo: "via_revo",
  ViaRevoTipo: "via_revo_tipo", ViaVelPermi: "via_vel_permi", ViaVelOper: "via_vel_oper",
  EquipNum: "equip_num", EquipDist: "equip_dist", EquipTipo: "equip_tipo",
  PteObstBanq: "pte_obst_banq", PteAnchoAcc: "pte_ancho_acc", PteTipoAcc: "pte_tipo_acc",
  PteNumEsc: "pte_num_esc", PteLongCami: "pte_long_cami", PtePendiente: "pte_pendiente",
  PteDistDesc: "pte_dist_desc", PteAnchoPas: "pte_ancho_pas", PteCubierta: "pte_cubierta",
  PteIluminacion: "pte_iluminacion", PtePubli: "pte_publi", PtePubliVisib: "pte_publi_visib"
};

/** Selecciones que dejó form.js en localStorage. null si no hay total en la URL. */
function cargarDesdeLocal(params) {
  const total = parseInt(params.get("total"), 10);
  if (isNaN(total)) return null;

  const ids = {}, txts = {}, vals = {};
  Object.keys(CAMPO_COLUMNA).forEach(campo => {
    ids[campo]  = localStorage.getItem(`${campo}_id`)  || "";
    txts[campo] = localStorage.getItem(`${campo}_txt`) || "";
    vals[campo] = localStorage.getItem(`${campo}_val`) || "";
  });

  let ubicacion = null;
  try { ubicacion = JSON.parse(localStorage.getItem("datosUbicacion")); } catch (e) { ubicacion = null; }

  return {
    origen: "local",
    total, ids, txts, vals, ubicacion,
    fuente: {
      nombre: localStorage.getItem("fuente_nombre"),
      fecha:  localStorage.getItem("fuente_fecha"),
      org:    localStorage.getItem("fuente_org"),
      correo: localStorage.getItem("fuente_correo")
    },
    // El link solo se muestra cuando viene en la URL: un token guardado en
    // localStorage podría ser de una evaluación anterior.
    token: null
  };
}

/**
 * Mapa texto → {id, val} por select, leído del formulario real (index.html).
 * Solo se usa para filas sin `respuestas` (anteriores a la migración 009).
 */
async function cargarMapaOpciones() {
  const res = await fetch("../index.html");
  if (!res.ok) throw new Error(`index.html ${res.status}`);
  const doc = new DOMParser().parseFromString(await res.text(), "text/html");
  const mapa = {};
  Object.keys(CAMPO_COLUMNA).forEach(campo => {
    const sel = doc.getElementById(campo);
    if (!sel) return;
    mapa[campo] = {};
    Array.from(sel.options).forEach(opt => {
      const txt = opt.textContent.trim();
      if (opt.id && txt) mapa[campo][txt] = { id: opt.id, val: opt.value };
    });
  });
  return mapa;
}

/** Evaluación guardada en Supabase, por token. null si el token no existe. */
async function cargarDesdeSupabase(token) {
  if (typeof SUPABASE_URL === "undefined" || typeof SUPABASE_ANON_KEY === "undefined") {
    throw new Error("config.js no cargado");
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_evaluacion_publica`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify({ token })
  });
  if (!res.ok) throw new Error(`RPC get_evaluacion_publica ${res.status}`);
  const row = await res.json();
  if (!row || typeof row !== "object") return null;

  const respuestas = (row.respuestas && typeof row.respuestas === "object") ? row.respuestas : null;
  let mapa = null;
  if (!respuestas) {
    try { mapa = await cargarMapaOpciones(); }
    catch (e) { console.warn("No se pudo leer index.html para reconstruir las opciones:", e); }
  }

  const ids = {}, txts = {}, vals = {};
  Object.keys(CAMPO_COLUMNA).forEach(campo => {
    const r = respuestas && respuestas[campo];
    if (r && r.id) {
      ids[campo] = r.id; txts[campo] = r.txt || ""; vals[campo] = r.val || "";
      return;
    }
    const txt = row[CAMPO_COLUMNA[campo]];
    txts[campo] = txt ? String(txt) : "";
    const m = (mapa && mapa[campo] && txt) ? mapa[campo][String(txt).trim()] : null;
    ids[campo]  = m ? m.id  : "";
    vals[campo] = m ? m.val : "";
  });

  return {
    origen: "supabase",
    total: parseInt(row.total_ifcs, 10),
    ids, txts, vals,
    ubicacion: {
      pais: row.loc_pais || "", ciudad: row.loc_ciudad || "", vialidad: row.loc_vialidad || "",
      colonia: row.loc_colonia || "", referencia: row.loc_referencia || "",
      x: row.loc_x || "", y: row.loc_y || ""
    },
    fuente: {
      nombre: row.fuente_nombre, fecha: row.fuente_fecha,
      org: row.fuente_org, correo: row.fuente_correo
    },
    token
  };
}

/**
 * Decide la fuente:
 *  - sin token → localStorage (flujo de siempre).
 *  - token + la evaluación recién enviada en localStorage (la URL trae &total=)
 *    → localStorage, sin pedir nada a la red; el token solo sirve para mostrar el link.
 *  - token sin datos locales (link abierto en otro navegador) → Supabase, con
 *    fallback a localStorage si la base no responde.
 */
async function cargarDatos(params) {
  const token = params.get("r");
  const local = cargarDesdeLocal(params);
  if (!token) return local;
  if (local && local.ubicacion) return Object.assign(local, { token });

  try {
    const remoto = await cargarDesdeSupabase(token);
    if (remoto && !isNaN(remoto.total)) return remoto;
    // El token no corresponde a ninguna fila: no mostramos el link.
    console.warn("Link permanente sin evaluación en la base; uso localStorage.");
    return cargarDesdeLocal(params);
  } catch (e) {
    // Sin red o base caída: el flujo normal sigue funcionando y el link
    // sigue siendo válido, así que lo conservamos.
    console.warn("No se pudo leer la evaluación desde Supabase:", e);
    const local = cargarDesdeLocal(params);
    return local ? Object.assign(local, { token }) : null;
  }
}

document.addEventListener("DOMContentLoaded", async () => {

  const params = new URLSearchParams(window.location.search);

  const resultadoEl = document.getElementById("Resultado");
  const textoFactEl = document.getElementById("TextoFactibilidad");
  const textoFact2 = document.getElementById("TextoFact2");

  if (!resultadoEl) return;

  let store = null;
  try { store = await cargarDatos(params); }
  catch (e) { console.warn("No se pudieron cargar los datos del reporte:", e); }

  if (!store || isNaN(store.total)) {
    // Link permanente roto o sin datos: avisar en vez de dejar la página vacía.
    const aviso = document.getElementById("permalink-error");
    if (aviso && params.get("r")) aviso.hidden = false;
    return;
  }

  const total = store.total;

  // ========================================
  // RESULTADO NUMÉRICO
  // ========================================

  // Animación del contador
  let current = 0;
  const duration = 1500;
  const interval = 20;
  const increment = total / (duration / interval);

  const counter = setInterval(() => {
    current += increment;
    if (current >= total) {
      current = total;
      clearInterval(counter);
    }
    resultadoEl.textContent = `${Math.round(current)}%`;
  }, interval);

  // Texto de factibilidad
  let mensajeFact = "";
  let mensajeFact2 = "";
  // Rangos: Largo 0-30, Mediano 31-60, Corto >60
  if (total <= 30) {
    mensajeFact = "FACTIBILIDAD A LARGO PLAZO";
    mensajeFact2 = "A LARGO PLAZO";
  } else if (total <= 60) {
    mensajeFact = "FACTIBILIDAD A MEDIANO PLAZO";
    mensajeFact2 = "A MEDIANO PLAZO";
  } else {
    mensajeFact = "FACTIBILIDAD A CORTO PLAZO";
    mensajeFact2 = "A CORTO PLAZO";
  }
  if (textoFactEl) textoFactEl.textContent = mensajeFact;
  if (textoFact2) textoFact2.textContent = mensajeFact2;

  // ========================================
  // DATOS DE UBICACIÓN
  // ========================================

  const datos = store.ubicacion;
  if (datos) {
    setText("DxVialidad", datos.vialidad);
    setText("DxReferencia", datos.referencia);
    setText("DxCiudad", datos.ciudad);
  }

  // ========================================
  // LINK PERMANENTE
  // ========================================

  const permalinkUrl = store.token
    ? `${window.location.origin}${window.location.pathname}?r=${encodeURIComponent(store.token)}`
    : "";

  const permalinkBox = document.getElementById("permalink-box");
  if (permalinkBox && permalinkUrl) {
    const input = document.getElementById("permalink-url");
    if (input) input.value = permalinkUrl;
    permalinkBox.hidden = false;

    const btnCopy = document.getElementById("permalink-copy");
    if (btnCopy) {
      const label = btnCopy.textContent;
      btnCopy.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(permalinkUrl);
          btnCopy.textContent = "¡Copiado!";
        } catch (e) {
          if (input) { input.focus(); input.select(); }
          btnCopy.textContent = "Selecciona y copia";
        }
        setTimeout(() => { btnCopy.textContent = label; }, 2500);
      });
    }
  }

  // ========================================
  // HELPER: leer selección guardada
  // ========================================

  function getStoredId(campo) {
    return store.ids[campo] || "";
  }

  function getStoredTxt(campo) {
    return store.txts[campo] || "";
  }

  function getStoredVal(campo) {
    return store.vals[campo] || "";
  }

  function setText(elId, text) {
    const el = document.getElementById(elId);
    if (el) el.textContent = text;
  }

  function showLi(elId, text) {
    const el = document.getElementById(elId);
    if (el) {
      el.textContent = text;
      el.style.display = "list-item";
    }
  }

  function hideLi(elId) {
    const el = document.getElementById(elId);
    if (el) el.style.display = "none";
  }

  // ========================================
  // DIAGNÓSTICO: SEMÁFORO
  // ========================================

  const textosSemaforo = {
    ViaDistSemaf_99menos: "Existe un semáforo a menos de 100 metros que facilita el alto de vehículos motorizados, dando paso a la posibilidad de incluir el cruce peatonal en el rediseño de la intersección.",
    ViaDistSemaf_100a249: "Existe un semáforo a una distancia de entre 100 y 249 metros que facilita el alto de vehículos motorizados, dando paso a la posibilidad de incluir un semáforo peatonal en el cruce peatonal a implementar en esta sección de la vialidad.",
    ViaDistSemaf_250a999: "Existe un semáforo a una distancia de entre 250 y 999 metros que facilita el alto de vehículos motorizados, dando paso a la posibilidad de gestionar la colocación de otro semáforo que contemple una fase peatonal en esta sección de la vialidad, así como las medidas de diseño necesarias para disminuir la velocidad vehicular.",
    ViaDistSemaf_1000mas: "No existen semáforos en una distancia de 1000 metros, lo cual requiere de la gestión e implementación de reductores de velocidad, así como de un semáforo que contemple una fase peatonal en esta sección de la vialidad."
  };

  const semafId = getStoredId("ViaDistSemaf");
  if (semafId && textosSemaforo[semafId]) {
    setText("DxSemaforo", textosSemaforo[semafId]);
  }

  // ========================================
  // DIAGNÓSTICO: CARRILES + CAMELLONES
  // ========================================

  const carrilesEl = document.getElementById("DxCarrilesCamellones");
  if (carrilesEl) {
    const carrilesTxt = getStoredTxt("ViaCarriles");
    const camellonesTxt = getStoredTxt("ViaCamellones");
    const camelId = getStoredId("ViaCamellones");

    if (camelId === "ViaCamellones_0") {
      carrilesEl.textContent = `La vialidad cuenta con ${carrilesTxt.toLowerCase()} y no tiene camellones, lo cual implica que las personas peatonas no cuentan con islas de refugio al cruzar.`;
    } else {
      carrilesEl.textContent = `La vialidad cuenta con ${carrilesTxt.toLowerCase()} y ${camellonesTxt.toLowerCase()} que pueden funcionar como islas de refugio peatonal.`;
    }
    carrilesEl.style.display = "list-item";
  }

  // ========================================
  // DIAGNÓSTICO: BARRERAS
  // ========================================

  const textosBarreras = {
    ViaBarreras_1: "No hay barreras peatonales a nivel de calle que dificulten o imposibiliten un cruce peatonal accesible.",
    ViaBarreras_2: "Las barreras peatonales que actualmente existen son menores, consistentes en guarniciones que requieren de intervenciones menores para asegurar accesibilidad universal en el cruce.",
    ViaBarreras_3: "Las barreras peatonales que actualmente existen son menores, consistentes en guarniciones altas (30cm o más) que requieren de intervenciones menores para asegurar accesibilidad universal en el cruce.",
    ViaBarreras_4: "Las barreras peatonales que actualmente existen son medianas, consistentes en canaletas que requieren de intervenciones de bajo a mediano costo para asegurar accesibilidad universal en el cruce.",
    ViaBarreras_5: "Las barreras peatonales que actualmente existen son medianas, consistentes en barreras de contención que requieren de intervenciones de bajo a mediano costo para asegurar accesibilidad universal en el cruce.",
    ViaBarreras_6: "Las barreras peatonales que actualmente existen son medianas y requieren de intervenciones de bajo a mediano costo para asegurar accesibilidad universal en el cruce.",
    ViaBarreras_7: "Las barreras peatonales que actualmente existen son medianas, consistentes en vallas o bardas que requieren de intervenciones de bajo a mediano costo para asegurar accesibilidad universal en el cruce.",
    ViaBarreras_8: "Las barreras peatonales que actualmente existen son considerables, consistentes en cambios pronunciados de nivel mayores a 1.5 metros, que requieren de un rediseño e intervenciones de mediano costo para asegurar accesibilidad universal en el cruce.",
    ViaBarreras_9: "Las barreras peatonales que actualmente existen son mayores, consistentes en un puente vehicular que requiere de un rediseño e intervenciones de alto costo para asegurar accesibilidad universal en el cruce.",
    ViaBarreras_10: "Las barreras peatonales que actualmente existen son mayores, consistentes en un túnel vehicular que requiere de un rediseño e intervenciones de alto costo para asegurar accesibilidad universal en el cruce."
  };

  const barrerasId = getStoredId("ViaBarreras");
  if (barrerasId && textosBarreras[barrerasId]) {
    setText("DxBarreras", textosBarreras[barrerasId]);
  }

  // ========================================
  // DIAGNÓSTICO: REDUCTORES DE VELOCIDAD
  // ========================================

  const revoId = getStoredId("ViaRevo");
  const dxRevo = document.getElementById("DxRevo");
  if (dxRevo) {
    dxRevo.style.display = revoId === "ViaRevo_si" ? "list-item" : "none";
  }

  // ========================================
  // DIAGNÓSTICO: EQUIPAMIENTOS - NÚMERO
  // ========================================

  const textosEquipNum = {
    EquipNum_0: "No existen equipamientos en un radio de 250 metros.",
    EquipNum_1a5: "Existen de 1 a 5 equipamientos en un radio de 250 metros.",
    EquipNum_6a10: "Existen de 6 a 10 equipamientos en un radio de 250 metros.",
    EquipNum_11a20: "Existen de 11 a 20 equipamientos en un radio de 250 metros.",
    EquipNum_21mas: "Existen 21 o más equipamientos en un radio de 250 metros."
  };

  const equipNumId = getStoredId("EquipNum");
  if (equipNumId && textosEquipNum[equipNumId]) {
    setText("DxEquipNum", textosEquipNum[equipNumId]);
  }

  // ========================================
  // DIAGNÓSTICO: EQUIPAMIENTOS - TIPO Y DISTANCIA
  // ========================================

  const spanTipo = document.getElementById("DxEquipTipo");
  const spanDist = document.getElementById("DxEquipDist");
  const liEquip = document.getElementById("DxEquip");

  if (spanTipo) spanTipo.textContent = getStoredTxt("EquipTipo");
  if (spanDist) spanDist.textContent = getStoredTxt("EquipDist");

  const idEquipTipo = getStoredId("EquipTipo");
  const idEquipDist = getStoredId("EquipDist");

  // Ocultar si no hay equipamientos o están muy lejos
  if (liEquip) {
    if (idEquipTipo === "EquipTipo_na" || idEquipDist === "EquipDist_1000mas") {
      liEquip.style.display = "none";
    } else {
      liEquip.style.display = "list-item";
    }
  }

  // ========================================
  // DIAGNÓSTICO: PUENTE - OBSTACULIZACIÓN
  // ========================================

  const idObst = getStoredId("PteObstBanq");
  const textosPteObst = {
    PteObstBanq_NoHayBanqueta: "Se encuentra en una zona donde no hay banquetas, lo cual aumenta la falta de accesibilidad a la zona de cruce, además de dar incoherencia al diseño urbano que puede construir un puente antipeatonal costoso antes que una banqueta digna y accesible, traduciéndose en un gasto público injustificado y una falta de planificación urbana integral.",
    PteObstBanq_si: "Su presencia obstaculiza la banqueta, poniendo en riesgo la integridad de las personas peatonas que transitan por la zona."
  };

  if (idObst === "PteObstBanq_no" || !idObst) {
    hideLi("DxPteObst");
  } else {
    showLi("DxPteObst", textosPteObst[idObst] || "");
  }

  // ========================================
  // DIAGNÓSTICO: PUENTE - ANCHO DE ACCESO
  // ========================================

  const idAnchoAcc = getStoredId("PteAnchoAcc");
  if (idAnchoAcc === "PteAnchoAcc_menor") {
    showLi("DxPteAnchoAcc", "Su ancho de acceso es menor a 1.5 metros, lo cual imposibilita el acceso cómodo y seguro para las personas peatonas en caso de encontrarse con otra persona que circule en el sentido contrario, especialmente para personas en silla de ruedas y otras personas de la población vulnerada.");
  } else {
    hideLi("DxPteAnchoAcc");
  }

  // ========================================
  // DIAGNÓSTICO: PUENTE - TIPO DE ACCESO
  // ========================================

  const tipoAccId = getStoredId("PteTipoAcc");
  const liAcceso = document.getElementById("DxPteTipoAcc");

  if (liAcceso) {
    if (!tipoAccId || tipoAccId === "PteTipoAcc_elev") {
      liAcceso.style.display = "none";
    } else if (tipoAccId === "PteTipoAcc_ramp") {
      const pendienteId = getStoredId("PtePendiente");
      if (pendienteId === "PtePendiente_6menos") {
        liAcceso.style.display = "none";
      } else {
        const pendienteTxt = getStoredTxt("PtePendiente");
        const distDescTxt = getStoredTxt("PteDistDesc");
        liAcceso.innerHTML = `Su tipo de acceso es de rampa, sin embargo su pendiente es de <strong>${pendienteTxt}</strong> y la distancia entre descansos es de <strong>${distDescTxt}</strong>, impidiendo su uso cómodo y seguro por parte de personas con discapacidad, personas mayores y otras personas con capacidades físicas diversas como mujeres embarazadas o personas con carriola o carrito de carga.`;
        liAcceso.style.display = "list-item";
      }
    } else if (tipoAccId === "PteTipoAcc_esc") {
      const numEscTxt = getStoredTxt("PteNumEsc");
      liAcceso.innerHTML = `Su tipo de acceso es de escaleras${numEscTxt ? ` (${numEscTxt.toLowerCase()})` : ""}, impidiendo su uso cómodo y seguro por parte de personas con discapacidad, personas mayores y otras personas con capacidades físicas diversas como mujeres embarazadas o personas con carriola o carrito de carga.`;
      liAcceso.style.display = "list-item";
    } else {
      liAcceso.style.display = "none";
    }
  }

  // ========================================
  // DIAGNÓSTICO: PUENTE - ILUMINACIÓN Y PUBLICIDAD
  // ========================================

  const liIlumPubli = document.getElementById("DxIlumPubli");
  if (liIlumPubli) {
    const ilumId = getStoredId("PteIluminacion");
    const publiId = getStoredId("PtePubli");
    const publiVisibId = getStoredId("PtePubliVisib");

    const sinIlum = ilumId === "PteIluminacion_no";
    const conPubli = publiId === "PtePubli_si";
    const publiObstruye = publiVisibId === "PtePubliVisib_si";

    let textoIlumPubli = "";

    if (sinIlum && conPubli && publiObstruye) {
      textoIlumPubli = "El puente no cuenta con iluminación, además alberga publicidad que obstaculiza la visibilidad al interior, convirtiéndolo en un espacio aislado y apto para hechos delictivos como asaltos o acoso sexual.";
    } else if (sinIlum && conPubli) {
      textoIlumPubli = "El puente no cuenta con iluminación y alberga publicidad en su estructura, lo cual lo convierte en un espacio poco seguro para las personas peatonas.";
    } else if (sinIlum) {
      textoIlumPubli = "El puente no cuenta con iluminación al interior, convirtiéndolo en un espacio inseguro, especialmente en horarios nocturnos.";
    } else if (conPubli && publiObstruye) {
      textoIlumPubli = "El puente alberga publicidad que obstaculiza la visibilidad al interior, lo cual disminuye la percepción de seguridad.";
    }

    if (textoIlumPubli) {
      liIlumPubli.textContent = textoIlumPubli;
      liIlumPubli.style.display = "list-item";
    } else {
      liIlumPubli.style.display = "none";
    }
  }

  // ========================================
  // PROPUESTAS DE REDISEÑO
  // ========================================

  const PROPUESTAS_FIELDS = Object.keys(CAMPO_COLUMNA);

  function buildPropuestasFormData() {
    const out = {};
    PROPUESTAS_FIELDS.forEach(f => {
      out[f] = getStoredId(f) || null;
    });
    return out;
  }

  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  /**
   * Toma un texto plano y un array de normas, regresa HTML safe donde cada
   * mención exacta del nombre canónico de una norma queda envuelto en <strong>.
   * El texto se escapa primero; el nombre se escapa para HTML y luego para
   * regex antes de hacer el replace global.
   */
  function boldifyNormasInText(text, normas) {
    let html = escapeHtml(text);
    if (!Array.isArray(normas) || normas.length === 0) return html;
    normas.forEach(n => {
      if (!n || !n.nombre) return;
      const escapedName = escapeHtml(n.nombre);
      const regexEscaped = escapedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      html = html.replace(new RegExp(regexEscaped, "g"), `<strong>${escapedName}</strong>`);
    });
    return html;
  }

  let propuestasAplicables = [];

  if (typeof window.evaluarReglas === "function") {
    const formData = buildPropuestasFormData();
    propuestasAplicables = window.evaluarReglas(formData);
  }

  const propuestasContainer = document.getElementById("propuestas-container");
  const normasList = document.getElementById("normas-list");
  const normasReferencia = document.getElementById("normas-referencia");

  if (propuestasContainer) {
    if (propuestasAplicables.length === 0) {
      propuestasContainer.innerHTML =
        '<div class="propuestas-empty">Tu evaluación cumple con la mayoría de los criterios. No se generaron propuestas adicionales.</div>';
      if (normasReferencia) normasReferencia.style.display = "none";
    } else {
      const html = propuestasAplicables.map((p, idx) => {
        const chips = p.normas.map(n =>
          `<a class="propuesta-chip" href="${escapeHtml(n.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(n.nombre)}</a>`
        ).join("");
        return (
          `<details class="propuesta-card" data-categoria="${escapeHtml(p.categoria)}" data-id="${escapeHtml(p.id)}"${idx === 0 ? " open" : ""}>` +
            `<summary>` +
              `<div class="propuesta-titulo-wrap">` +
                `<span class="propuesta-categoria">${escapeHtml(p.categoriaLabel)}</span>` +
                `<span class="propuesta-titulo">${escapeHtml(p.titulo)}</span>` +
              `</div>` +
            `</summary>` +
            `<div class="propuesta-body">` +
              `<p class="propuesta-sugerencia">${escapeHtml(p.sugerencia)}</p>` +
              (chips ? `<div class="propuesta-chips">${chips}</div>` : "") +
            `</div>` +
          `</details>`
        );
      }).join("");
      propuestasContainer.innerHTML = html;

      // Lista de normas únicas referenciadas
      if (normasList) {
        const normasUnicas = {};
        propuestasAplicables.forEach(p => {
          p.normas.forEach(n => { normasUnicas[n.key] = n; });
        });
        const keys = Object.keys(normasUnicas);
        normasList.innerHTML = keys.map(k => {
          const n = normasUnicas[k];
          return (
            `<li>` +
              `<a href="${escapeHtml(n.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(n.nombre)}</a>` +
              `<span class="norma-meta">— ${escapeHtml(n.titulo)} (${escapeHtml(String(n["año"] || ""))})</span>` +
            `</li>`
          );
        }).join("");
      }
    }
  }

  // ========================================
  // CTAs FINALES
  // ========================================

  const ctaVerMapa = document.getElementById("cta-ver-mapa");
  if (ctaVerMapa) {
    ctaVerMapa.addEventListener("click", () => {
      const id = sessionStorage.getItem("last_evaluation_id");
      const url = id ? `./mapa.html?id=${encodeURIComponent(id)}` : "./mapa.html";
      window.location.href = url;
    });
  }

  const ctaDescargarPdf = document.getElementById("cta-descargar-pdf");
  if (ctaDescargarPdf) {
    ctaDescargarPdf.addEventListener("click", () => {
      const btn = document.getElementById("btn-descargar-pdf");
      if (btn) btn.click();
    });
  }

  // ========================================
  // EXPORTAR PDF
  // ========================================

  const btnPdf = document.getElementById("btn-descargar-pdf");
  if (btnPdf) {
    btnPdf.addEventListener("click", () => {
      const reporteEl = document.getElementById("reporte-pdf");
      if (!reporteEl || typeof html2pdf === "undefined") return;

      // Populate PDF template
      const setT = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt || "—"; };

      setT("pdf-total", total);
      setT("pdf-factibilidad", mensajeFact);

      if (datos) {
        setT("pdf-pais", datos.pais);
        setT("pdf-ciudad", datos.ciudad);
        setT("pdf-vialidad", datos.vialidad);
        setT("pdf-colonia", datos.colonia);
        setT("pdf-referencia", datos.referencia);
        setT("pdf-coords", (datos.x && datos.y) ? `${datos.x}, ${datos.y}` : "—");
      }

      // Fuente
      setT("pdf-fuente-nombre", store.fuente.nombre);
      setT("pdf-fuente-fecha", store.fuente.fecha);
      setT("pdf-fuente-org", store.fuente.org);
      setT("pdf-fuente-correo", store.fuente.correo);

      // Link permanente: el PDF impreso lleva la forma de volver al reporte vivo
      const pdfPermalinkWrap = document.getElementById("pdf-permalink-wrap");
      const pdfPermalink = document.getElementById("pdf-permalink");
      if (pdfPermalinkWrap && pdfPermalink) {
        pdfPermalink.textContent = permalinkUrl;
        pdfPermalinkWrap.style.display = permalinkUrl ? "block" : "none";
      }

      // Diagnostic: copy visible <li> text from the page
      const dxDiv = document.getElementById("pdf-diagnostico");
      if (dxDiv) {
        const cards = document.querySelectorAll(".dx-gral .dx-card");
        let html = "";
        cards.forEach(card => {
          const title = card.querySelector("p");
          const items = card.querySelectorAll("li");
          const visibleItems = Array.from(items).filter(li => li.style.display !== "none");
          if (title && visibleItems.length > 0) {
            html += `<p style="font-weight:bold; margin:1rem 0 .3rem;">${title.textContent}</p><ul>`;
            visibleItems.forEach(li => {
              html += `<li style="margin-bottom:.4rem;">${li.textContent}</li>`;
            });
            html += "</ul>";
          }
        });
        dxDiv.innerHTML = html;
      }

      // Propuestas de rediseño en PDF (agrupadas por categoría, normas en <strong>)
      const pdfPropuestasDiv = document.getElementById("pdf-propuestas");
      if (pdfPropuestasDiv) {
        if (propuestasAplicables.length === 0) {
          pdfPropuestasDiv.innerHTML = '<p style="font-style:italic; color:#666;">Tu evaluación cumple con la mayoría de los criterios. No se generaron propuestas adicionales.</p>';
        } else {
          // Agrupar preservando orden de primera aparición
          const orden = [];
          const grupos = {};
          propuestasAplicables.forEach(p => {
            if (!grupos[p.categoria]) {
              grupos[p.categoria] = { label: p.categoriaLabel, items: [] };
              orden.push(p.categoria);
            }
            grupos[p.categoria].items.push(p);
          });

          let pdfHtml = "";
          orden.forEach(cat => {
            const grupo = grupos[cat];
            pdfHtml += '<div class="pdf-propuestas-grupo">';
            pdfHtml += `<h3 class="pdf-categoria-titulo">${escapeHtml(grupo.label)}</h3>`;
            pdfHtml += '<ol class="pdf-propuesta-list">';
            grupo.items.forEach(p => {
              pdfHtml += '<li class="pdf-propuesta-item">';
              pdfHtml += `<p class="pdf-propuesta-titulo">${escapeHtml(p.titulo)}</p>`;
              pdfHtml += `<p class="pdf-propuesta-sugerencia">${boldifyNormasInText(p.sugerencia, p.normas)}</p>`;
              if (p.normas && p.normas.length > 0) {
                pdfHtml += '<p class="pdf-propuesta-normas-titulo">Normas referenciadas:</p>';
                pdfHtml += '<ul class="pdf-propuesta-normas-list">';
                p.normas.forEach(n => {
                  pdfHtml += `<li>${escapeHtml(n.nombre)}</li>`;
                });
                pdfHtml += '</ul>';
              }
              pdfHtml += '</li>';
            });
            pdfHtml += '</ol>';
            pdfHtml += '</div>';
          });
          pdfPropuestasDiv.innerHTML = pdfHtml;
        }
      }

      // Forzar todos los <details> abiertos antes del export (en caso de que html2pdf
      // capture la sección live). Restauramos al estado inicial al terminar.
      const detailsEls = Array.from(document.querySelectorAll("#propuestas-container details"));
      const prevOpenState = detailsEls.map(d => d.open);
      detailsEls.forEach(d => { d.open = true; });

      const restoreDetails = () => {
        detailsEls.forEach((d, i) => {
          // Estado inicial canónico: la primera abierta, el resto cerradas.
          d.open = i === 0 ? true : false;
        });
        // Si el estado previo difería (ej. usuario expandió varias), respeta lo que
        // ya estaba abierto antes del export.
        const userHadDifferentState = prevOpenState.some((v, i) => v !== (i === 0));
        if (userHadDifferentState) {
          detailsEls.forEach((d, i) => { d.open = prevOpenState[i]; });
        }
      };

      // Show element for rendering
      reporteEl.style.display = "block";

      const ciudad = (datos?.ciudad || "").replace(/\s+/g, "_") || "Ciudad";
      const vialidad = (datos?.vialidad || "").replace(/\s+/g, "_") || "Vialidad";
      const fecha = new Date().toISOString().slice(0, 10);
      const filename = `IFCS_${ciudad}_${vialidad}_${fecha}.pdf`;

      html2pdf().set({
        margin: [10, 10, 10, 10],
        filename: filename,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: "mm", format: "letter", orientation: "portrait" }
      }).from(reporteEl.firstElementChild).save().then(() => {
        reporteEl.style.display = "none";
        restoreDetails();
      }).catch(() => {
        reporteEl.style.display = "none";
        restoreDetails();
      });
    });
  }
});
