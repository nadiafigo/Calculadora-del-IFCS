/**
 * resultado.js — Lógica de la página de resultados
 *
 * Lee el total de la URL y los datos de localStorage
 * para generar el diagnóstico dinámico.
 */

document.addEventListener("DOMContentLoaded", () => {

  // ========================================
  // RESULTADO NUMÉRICO
  // ========================================

  const params = new URLSearchParams(window.location.search);
  const total = parseInt(params.get("total"), 10);

  const resultadoEl = document.getElementById("Resultado");
  const textoFactEl = document.getElementById("TextoFactibilidad");
  const textoFact2 = document.getElementById("TextoFact2");

  if (!resultadoEl || isNaN(total)) return;

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
  if (total <= 20) {
    mensajeFact = "FACTIBILIDAD A LARGO PLAZO";
    mensajeFact2 = "A LARGO PLAZO";
  } else if (total <= 65) {
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

  const datos = JSON.parse(localStorage.getItem("datosUbicacion"));
  if (datos) {
    setText("DxVialidad", datos.vialidad);
    setText("DxReferencia", datos.referencia);
    setText("DxCiudad", datos.ciudad);
  }

  // ========================================
  // HELPER: leer selección guardada
  // ========================================

  function getStoredId(campo) {
    return localStorage.getItem(`${campo}_id`) || "";
  }

  function getStoredTxt(campo) {
    return localStorage.getItem(`${campo}_txt`) || "";
  }

  function getStoredVal(campo) {
    return localStorage.getItem(`${campo}_val`) || "";
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
      setT("pdf-fuente-nombre", localStorage.getItem("fuente_nombre"));
      setT("pdf-fuente-fecha", localStorage.getItem("fuente_fecha"));
      setT("pdf-fuente-org", localStorage.getItem("fuente_org"));
      setT("pdf-fuente-correo", localStorage.getItem("fuente_correo"));

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
      });
    });
  }
});
