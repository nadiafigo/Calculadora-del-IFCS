/**
 * propuestas-rediseno.js — 19 reglas condicionales de rediseño
 *
 * Catálogo de normas vigentes y motor de evaluación de reglas que producen
 * propuestas de rediseño a partir de los IDs de opción guardados por
 * form.js en localStorage (`${SelectId}_id`, p.ej. "ViaVelPermi_50").
 *
 * Expone globales:
 *   - window.NORMAS
 *   - window.evaluarReglas(formData) -> array de propuestas que aplican
 *
 * Sin transpiler, sin ESM: cargado vía <script> tradicional.
 */

(function () {
  "use strict";

  // ============================================================
  // NORMAS
  // ============================================================

  const NORMAS = {
    LGMSV_49: {
      nombre: "LGMSV, Artículo 49",
      titulo: "Ley General de Movilidad y Seguridad Vial",
      año: 2022,
      url: "https://www.diputados.gob.mx/LeyesBiblio/ref/lgmsv.htm"
    },
    NOM_004: {
      nombre: "NOM-004-SEDATU-2023",
      titulo: "Estructura y diseño para vías urbanas. Especificaciones y aplicación",
      año: 2023,
      url: "https://www.dof.gob.mx/nota_detalle.php?codigo=5723137&fecha=12/04/2024"
    },
    NOM_001: {
      nombre: "NOM-001-SEDATU-2021",
      titulo: "Espacios públicos en los asentamientos humanos",
      año: 2021,
      url: "https://www.dof.gob.mx/nota_detalle.php?codigo=5643417&fecha=22/02/2022"
    },
    NOM_034: {
      nombre: "NOM-034-SCT2/SEDATU-2022",
      titulo: "Señalización y dispositivos viales para calles y carreteras",
      año: 2022,
      url: "https://www.dof.gob.mx/nota_detalle.php?codigo=5702233&fecha=19/09/2023"
    },
    NOM_013: {
      nombre: "NOM-013-ENER-2013",
      titulo: "Eficiencia energética para sistemas de alumbrado en vialidades",
      año: 2013,
      url: "https://www.dof.gob.mx/nota_detalle.php?codigo=5302568&fecha=14/06/2013"
    },
    MANUAL_CALLES: {
      nombre: "Manual de Calles SEDATU-BID 2019",
      titulo: "Manual de Calles: Diseño vial para ciudades mexicanas",
      año: 2019,
      url: "https://www.gob.mx/sedatu/documentos/manual-de-calles-diseno-vial-para-ciudades-mexicanas"
    },
    MANUAL_SENALIZACION: {
      nombre: "Manual de Señalización SCT-SEDATU 2023",
      titulo: "Manual de Señalización y Dispositivos para el Control del Tránsito en Calles y Carreteras",
      año: 2023,
      url: "https://www.gob.mx/sedatu/documentos/manual-de-senalizacion-y-dispositivos-para-el-control-del-transito-en-calles-y-carreteras"
    }
  };

  // Mapa de IDs de opción a km/h (para comparación numérica vel oper vs permi).
  const VEL_KMH = {
    ViaVelPermi_20menos: 20,
    ViaVelPermi_30: 30,
    ViaVelPermi_50: 50,
    ViaVelPermi_60: 60,
    ViaVelPermi_80mas: 80,
    ViaVelOper_20menos: 20,
    ViaVelOper_21a30: 30,
    ViaVelOper_31a50: 50,
    ViaVelOper_51a60: 60,
    ViaVelOper_61a79: 79,
    ViaVelOper_80mas: 80
  };

  // ============================================================
  // 19 REGLAS
  // ============================================================

  const REGLAS = [
    // -- Velocidad y semáforos -----------------------------------------------
    {
      id: "vel-permi-alta",
      categoria: "velocidad-semaforos",
      titulo: "Velocidad permitida >30 km/h",
      condicion: d => ["ViaVelPermi_50", "ViaVelPermi_60", "ViaVelPermi_80mas"].indexOf(d.ViaVelPermi) >= 0,
      sugerencia: "Implementar una zona de velocidad reducida a máximo 30 km/h conforme al Art. 49 de la Ley General de Movilidad y Seguridad Vial (LGMSV). En caso de existir equipamientos educativos o de salud en el entorno, la velocidad máxima debe ser de 20 km/h.",
      normas: ["LGMSV_49"]
    },
    {
      id: "vel-oper-mayor-permi",
      categoria: "velocidad-semaforos",
      titulo: "Velocidad de operación > velocidad permitida",
      condicion: d => {
        const op = VEL_KMH[d.ViaVelOper];
        const pe = VEL_KMH[d.ViaVelPermi];
        return op != null && pe != null && op > pe;
      },
      sugerencia: "La velocidad de operación registrada excede la velocidad permitida, lo que evidencia la necesidad de implementar medidas de pacificación del tránsito (traffic calming) como las descritas en el Manual de Calles SEDATU-BID 2019, Capítulo 4.",
      normas: ["MANUAL_CALLES"]
    },
    {
      id: "sin-semaforo-cercano",
      categoria: "velocidad-semaforos",
      titulo: "Sin semáforo cercano (≥250m)",
      condicion: d => ["ViaDistSemaf_250a999", "ViaDistSemaf_1000mas"].indexOf(d.ViaDistSemaf) >= 0,
      sugerencia: "Gestionar la instalación de un semáforo con fase peatonal en el punto de cruce, conforme a la NOM-004-SEDATU-2023 y al Manual de Señalización Vial SCT-SEDATU 2023.",
      normas: ["NOM_004", "MANUAL_SENALIZACION"]
    },
    {
      id: "semaforo-muy-cercano",
      categoria: "velocidad-semaforos",
      titulo: "Semáforo cercano (<100m)",
      condicion: d => d.ViaDistSemaf === "ViaDistSemaf_99menos",
      sugerencia: "Incorporar el cruce peatonal seguro al ciclo semafórico existente, incluyendo fase peatonal exclusiva conforme al Manual de Calles SEDATU-BID 2019, Sección 4.6.",
      normas: ["MANUAL_CALLES"]
    },

    // -- Reductores de velocidad ---------------------------------------------
    {
      id: "sin-reductores",
      categoria: "reductores",
      titulo: "Sin reductores de velocidad",
      condicion: d => d.ViaRevo === "ViaRevo_no",
      sugerencia: "Implementar dispositivos de reducción de velocidad tales como mesetas peatonales, chicanas o estrechamientos de carril conforme al Manual de Calles SEDATU-BID 2019, Sección 4.5. Se recomienda preferir mesetas peatonales sobre topes convencionales.",
      normas: ["MANUAL_CALLES"]
    },
    {
      id: "reductores-tope-o-lineas",
      categoria: "reductores",
      titulo: "Reductores tipo tope o líneas logarítmicas",
      condicion: d => d.ViaRevo === "ViaRevo_si" && (d.ViaRevoTipo === "ViaRevoTipo_tope" || d.ViaRevoTipo === "ViaRevoTipo_lineas"),
      sugerencia: "Considerar la sustitución o complementación de los reductores existentes por mesetas peatonales o plataformas de cruce a nivel de banqueta, que ofrecen mayor accesibilidad universal y efectividad.",
      normas: ["MANUAL_CALLES"]
    },

    // -- Barreras ------------------------------------------------------------
    {
      id: "barreras-menores",
      categoria: "barreras",
      titulo: "Barreras menores",
      // Guarnición (camellón / alta), canaleta, contención u otro: opciones 2-6
      condicion: d => ["ViaBarreras_2", "ViaBarreras_3", "ViaBarreras_4", "ViaBarreras_5", "ViaBarreras_6"].indexOf(d.ViaBarreras) >= 0,
      sugerencia: "Rediseñar las barreras existentes para incorporar rampas peatonales accesibles con pendiente máxima del 8% y ancho mínimo de 1.50m. Las guarniciones en puntos de cruce deben rebajarse a nivel de arroyo vehicular.",
      normas: ["NOM_004", "MANUAL_CALLES"]
    },
    {
      id: "barreras-mayores",
      categoria: "barreras",
      titulo: "Barreras mayores",
      // Valla/barda, cambio de nivel, puente vehicular, túnel: opciones 7-10
      condicion: d => ["ViaBarreras_7", "ViaBarreras_8", "ViaBarreras_9", "ViaBarreras_10"].indexOf(d.ViaBarreras) >= 0,
      sugerencia: "Las barreras existentes requieren un proyecto integral de rediseño vial que contemple la eliminación o modificación de estas barreras para garantizar un cruce peatonal accesible a nivel de calle.",
      normas: ["NOM_004"]
    },

    // -- Camellones ----------------------------------------------------------
    {
      id: "sin-camellones",
      categoria: "camellones",
      titulo: "Sin camellones",
      condicion: d => d.ViaCamellones === "ViaCamellones_0",
      sugerencia: "Para vialidades de 3 o más carriles, implementar islas de refugio peatonal con un ancho mínimo de 1.80m que permitan el cruce en dos tiempos.",
      normas: ["MANUAL_CALLES"]
    },
    {
      id: "con-camellones",
      categoria: "camellones",
      titulo: "Con camellones",
      condicion: d => ["ViaCamellones_1", "ViaCamellones_2a3", "ViaCamellones_4mas"].indexOf(d.ViaCamellones) >= 0,
      sugerencia: "Aprovechar los camellones existentes como islas de refugio peatonal, verificando que cuenten con un ancho mínimo de 1.80m, rampas accesibles y señalización horizontal.",
      normas: ["MANUAL_CALLES"]
    },

    // -- Equipamientos -------------------------------------------------------
    {
      id: "equip-edu-salud",
      categoria: "equipamientos",
      titulo: "Equipamiento educativo o de salud",
      condicion: d => d.EquipTipo === "EquipTipo_edu" || d.EquipTipo === "EquipTipo_salud",
      sugerencia: "La presencia de un equipamiento de educación/salud próximo al cruce justifica la implementación obligatoria de una zona de velocidad máxima de 20 km/h, señalización horizontal y vertical, y cruce peatonal protegido.",
      normas: ["LGMSV_49", "NOM_034"]
    },
    {
      id: "equip-muy-cercano",
      categoria: "equipamientos",
      titulo: "Equipamiento de alta afluencia muy cercano",
      condicion: d => d.EquipDist === "EquipDist_0a99",
      sugerencia: "La cercanía del equipamiento requiere un tratamiento integral: ensanchamiento de banquetas, señalización preventiva e informativa, iluminación peatonal y diseño de intersección segura.",
      normas: ["MANUAL_CALLES"]
    },

    // -- Accesibilidad -------------------------------------------------------
    {
      id: "acceso-escaleras",
      categoria: "accesibilidad",
      titulo: "Acceso por escaleras",
      condicion: d => d.PteTipoAcc === "PteTipoAcc_esc",
      sugerencia: "El acceso exclusivo por escaleras excluye a personas con discapacidad motriz, adultos mayores, personas con carriola y otros grupos vulnerados. El cruce sustituto debe garantizar accesibilidad universal con rampas de pendiente máxima 6%, descansos cada 9 metros y ancho libre mínimo de 1.50m.",
      normas: ["NOM_004", "NOM_001"]
    },
    {
      id: "rampa-pendiente-alta",
      categoria: "accesibilidad",
      titulo: "Rampa con pendiente >6%",
      condicion: d => d.PteTipoAcc === "PteTipoAcc_ramp" && (d.PtePendiente === "PtePendiente_6,1a8" || d.PtePendiente === "PtePendiente_8,1mas"),
      sugerencia: "La pendiente de la rampa excede el máximo recomendado de 6% para accesibilidad universal. El cruce sustituto debe diseñarse a nivel de calle.",
      normas: ["NOM_004"]
    },
    {
      id: "ancho-insuficiente",
      categoria: "accesibilidad",
      titulo: "Ancho insuficiente (<1.5m)",
      condicion: d => d.PteAnchoAcc === "PteAnchoAcc_menor" || d.PteAnchoPas === "PteAnchoPas_menor1,5",
      sugerencia: "El ancho actual no cumple con el mínimo de 1.50m requerido. El cruce sustituto debe contemplar un ancho mínimo de 2.50m.",
      normas: ["NOM_004"]
    },

    // -- Seguridad -----------------------------------------------------------
    {
      id: "sin-iluminacion",
      categoria: "seguridad",
      titulo: "Sin iluminación",
      condicion: d => d.PteIluminacion === "PteIluminacion_no",
      sugerencia: "Implementar iluminación peatonal en el cruce sustituto con niveles mínimos de 20 lux en el área de cruce y 10 lux en zonas de aproximación, priorizando luminarias tipo LED.",
      normas: ["NOM_013"]
    },
    {
      id: "publi-obstruye",
      categoria: "seguridad",
      titulo: "Publicidad que obstruye visibilidad",
      condicion: d => d.PtePubli === "PtePubli_si" && d.PtePubliVisib === "PtePubliVisib_si",
      sugerencia: "Eliminar todo elemento publicitario que obstruya la visibilidad. El diseño del cruce sustituto debe garantizar triángulos de visibilidad despejados.",
      normas: ["MANUAL_CALLES"]
    },
    {
      id: "obstaculiza-banquetas",
      categoria: "seguridad",
      titulo: "Obstaculiza banquetas",
      condicion: d => d.PteObstBanq === "PteObstBanq_si" || d.PteObstBanq === "PteObstBanq_NoHayBanqueta",
      sugerencia: "El retiro del puente debe acompañarse de la restitución o construcción de banquetas accesibles con un ancho libre mínimo de 1.50m (óptimo 2.00m), superficie antiderrapante y libre de obstáculos.",
      normas: ["NOM_004", "NOM_001"]
    },

    // -- Distancia de cruce --------------------------------------------------
    {
      id: "cruce-largo",
      categoria: "distancia",
      titulo: "Distancia de cruce ≥20m",
      condicion: d => ["ViaDistCruce_20a39", "ViaDistCruce_40a69", "ViaDistCruce_70mas"].indexOf(d.ViaDistCruce) >= 0,
      sugerencia: "Para distancias de cruce mayores a 20 metros, implementar el cruce en dos o más fases utilizando islas de refugio peatonal, con tiempos semafóricos para cruce seguro de personas con movilidad reducida (velocidad de diseño: 0.8 m/s).",
      normas: ["MANUAL_CALLES"]
    }
  ];

  // ============================================================
  // CATEGORÍAS — orden y label de display
  // ============================================================

  const CATEGORIAS = {
    "velocidad-semaforos": "Velocidad y semáforos",
    "reductores":          "Reductores de velocidad",
    "barreras":            "Barreras peatonales",
    "camellones":          "Camellones e islas de refugio",
    "equipamientos":       "Equipamientos próximos",
    "accesibilidad":       "Accesibilidad universal",
    "seguridad":           "Seguridad y visibilidad",
    "distancia":           "Distancia de cruce"
  };

  // ============================================================
  // EVALUADOR
  // ============================================================

  function evaluarReglas(formData) {
    const data = formData || {};
    const out = [];
    for (let i = 0; i < REGLAS.length; i++) {
      const r = REGLAS[i];
      let aplica = false;
      try {
        aplica = !!r.condicion(data);
      } catch (err) {
        aplica = false;
      }
      if (!aplica) continue;
      out.push({
        id: r.id,
        categoria: r.categoria,
        categoriaLabel: CATEGORIAS[r.categoria] || r.categoria,
        titulo: r.titulo,
        sugerencia: r.sugerencia,
        normas: r.normas.map(k => Object.assign({ key: k }, NORMAS[k])).filter(n => n.nombre)
      });
    }
    return out;
  }

  // Exportar globales
  window.NORMAS = NORMAS;
  window.CATEGORIAS_PROPUESTAS = CATEGORIAS;
  window.evaluarReglas = evaluarReglas;
})();
