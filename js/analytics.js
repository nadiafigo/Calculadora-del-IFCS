/**
 * analytics.js — Dashboard de estadísticas IFCS
 *
 * Usa Chart.js, lee datos de Supabase REST API.
 * Credenciales cargadas desde config.js.
 */

document.addEventListener("DOMContentLoaded", async () => {

  const dashboard = document.getElementById("dashboard");

  // ========================================
  // FETCH DATA
  // ========================================

  let allData = [];

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
    if (res.ok) allData = await res.json();
  } catch (err) {
    console.warn("Error cargando datos:", err);
  }

  // ========================================
  // EMPTY STATE
  // ========================================

  if (allData.length === 0) {
    dashboard.innerHTML = `
      <h1 class="dashboard-title">Dashboard de Evaluaciones</h1>
      <div class="empty-state">Aún no hay evaluaciones registradas.</div>
    `;
    return;
  }

  // ========================================
  // GLOBAL CITY FILTER
  // ========================================

  const ciudadesAll = [...new Set(allData.map(e => e.loc_ciudad).filter(Boolean))].sort();
  const selectCiudad = document.getElementById("filtro-global-ciudad");
  ciudadesAll.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    selectCiudad.appendChild(opt);
  });

  // Chart instances to destroy on re-render
  let charts = [];

  function getFiltered() {
    const ciudad = selectCiudad.value;
    return ciudad ? allData.filter(e => e.loc_ciudad === ciudad) : allData;
  }

  selectCiudad.addEventListener("change", () => renderDashboard());

  // ========================================
  // COLORS
  // ========================================

  const colCorto = "#2e7d32";
  const colMedio = "#f9a825";
  const colLargo = "#c62828";
  const colBlue  = "hsl(209, 74%, 27%)";

  // ========================================
  // RENDER FUNCTION
  // ========================================

  function renderDashboard() {
    // Destroy previous charts
    charts.forEach(c => c.destroy());
    charts = [];

    const evaluaciones = getFiltered();

    // --- KPIs ---
    const total = evaluaciones.length;
    const promedio = total ? Math.round(evaluaciones.reduce((s, e) => s + (e.total_ifcs || 0), 0) / total) : 0;
    const corto = evaluaciones.filter(e => e.factibilidad === "Corto plazo").length;
    const pctCorto = total ? Math.round((corto / total) * 100) : 0;
    const ciudadesSet = new Set(evaluaciones.map(e => e.loc_ciudad).filter(Boolean));
    const inmediata = corto; // Factibilidad inmediata = corto plazo count
    const escaleras = evaluaciones.filter(e => e.pte_tipo_acc === "Escaleras").length;
    const pctEscaleras = total ? Math.round((escaleras / total) * 100) : 0;

    document.getElementById("kpi-total").textContent = total;
    document.getElementById("kpi-promedio").textContent = promedio + "%";
    document.getElementById("kpi-corto").textContent = pctCorto + "%";
    document.getElementById("kpi-ciudades").textContent = ciudadesSet.size;
    document.getElementById("kpi-inmediata").textContent = inmediata;
    document.getElementById("kpi-escaleras").textContent = pctEscaleras + "%";

    // --- DONUT: Factibilidad ---
    const countCorto = corto;
    const countMedio = evaluaciones.filter(e => e.factibilidad === "Mediano plazo").length;
    const countLargo = evaluaciones.filter(e => e.factibilidad === "Largo plazo").length;

    charts.push(new Chart(document.getElementById("chart-donut"), {
      type: "doughnut",
      data: {
        labels: ["Corto plazo", "Mediano plazo", "Largo plazo"],
        datasets: [{
          data: [countCorto, countMedio, countLargo],
          backgroundColor: [colCorto, colMedio, colLargo],
          borderWidth: 2,
          borderColor: "#fff"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } }
      }
    }));

    // --- BAR: Top 10 ciudades ---
    const ciudadCount = {};
    evaluaciones.forEach(e => {
      const c = e.loc_ciudad || "Sin ciudad";
      ciudadCount[c] = (ciudadCount[c] || 0) + 1;
    });
    const top10 = Object.entries(ciudadCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    charts.push(new Chart(document.getElementById("chart-ciudades"), {
      type: "bar",
      data: {
        labels: top10.map(([c]) => c),
        datasets: [{
          label: "Evaluaciones",
          data: top10.map(([, n]) => n),
          backgroundColor: colBlue,
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    }));

    // --- BAR: Distribución de puntaje ---
    const rangos = [
      { label: "0–20", min: 0, max: 20 },
      { label: "21–40", min: 21, max: 40 },
      { label: "41–60", min: 41, max: 60 },
      { label: "61–80", min: 61, max: 80 },
      { label: "81–100", min: 81, max: 100 }
    ];
    const rangoData = rangos.map(r =>
      evaluaciones.filter(e => e.total_ifcs >= r.min && e.total_ifcs <= r.max).length
    );

    charts.push(new Chart(document.getElementById("chart-rangos"), {
      type: "bar",
      data: {
        labels: rangos.map(r => r.label),
        datasets: [{
          label: "Evaluaciones",
          data: rangoData,
          backgroundColor: ["#c62828", "#e65100", colMedio, "#558b2f", colCorto],
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    }));

    // --- BAR: Evaluaciones por mes ---
    const monthCount = {};
    evaluaciones.forEach(e => {
      if (!e.created_at) return;
      const d = new Date(e.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthCount[key] = (monthCount[key] || 0) + 1;
    });
    const sortedMonths = Object.keys(monthCount).sort();
    const monthNames = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
    const monthLabels = sortedMonths.map(m => {
      const [y, mo] = m.split("-");
      return `${monthNames[parseInt(mo) - 1]} ${y}`;
    });

    charts.push(new Chart(document.getElementById("chart-timeline"), {
      type: "bar",
      data: {
        labels: monthLabels,
        datasets: [{
          label: "Evaluaciones",
          data: sortedMonths.map(m => monthCount[m]),
          backgroundColor: "hsl(188, 100%, 33%)",
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    }));

    // --- BAR: Principales problemas detectados ---
    const problemas = [
      { label: "Sin iluminación",         count: evaluaciones.filter(e => e.pte_iluminacion === "No hay").length },
      { label: "Publicidad obstruye",     count: evaluaciones.filter(e => e.pte_publi === "Sí" && e.pte_publi_visib === "Sí es visible").length },
      { label: "Obstaculiza banquetas",   count: evaluaciones.filter(e => e.pte_obst_banq === "Sí").length },
      { label: "Solo escaleras",          count: evaluaciones.filter(e => e.pte_tipo_acc === "Escaleras").length },
      { label: "Ancho acceso < 1.5m",     count: evaluaciones.filter(e => e.pte_ancho_acc === "Menor a 1.5 metros").length },
      { label: "Ancho paso < 1.5m",       count: evaluaciones.filter(e => e.pte_ancho_pas === "Menor a 1.5 metros").length },
      { label: "Sin cubierta",            count: evaluaciones.filter(e => e.pte_cubierta === "No").length },
      { label: "Con barreras viales",     count: evaluaciones.filter(e => e.via_barreras && e.via_barreras !== "No hay").length }
    ].sort((a, b) => b.count - a.count);

    charts.push(new Chart(document.getElementById("chart-problemas"), {
      type: "bar",
      data: {
        labels: problemas.map(p => p.label),
        datasets: [{
          label: "Puentes afectados",
          data: problemas.map(p => p.count),
          backgroundColor: "#d84315",
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    }));

    // --- TABLE ---
    renderTable(evaluaciones);
  }

  // ========================================
  // SORTABLE TABLE
  // ========================================

  let sortKey = "fecha";
  let sortAsc = false; // desc by default

  function renderTable(evaluaciones) {
    const tbody = document.getElementById("tabla-body");
    tbody.innerHTML = "";

    // Sort data
    const sorted = [...evaluaciones].sort((a, b) => {
      let va, vb;
      switch (sortKey) {
        case "fecha":
          va = a.created_at || ""; vb = b.created_at || ""; break;
        case "ciudad":
          va = (a.loc_ciudad || "").toLowerCase(); vb = (b.loc_ciudad || "").toLowerCase(); break;
        case "vialidad":
          va = (a.loc_vialidad || "").toLowerCase(); vb = (b.loc_vialidad || "").toLowerCase(); break;
        case "ifcs":
          va = a.total_ifcs || 0; vb = b.total_ifcs || 0; break;
        case "factibilidad":
          const order = { "Corto plazo": 1, "Mediano plazo": 2, "Largo plazo": 3 };
          va = order[a.factibilidad] || 9; vb = order[b.factibilidad] || 9; break;
        case "acceso":
          va = (a.pte_tipo_acc || "").toLowerCase(); vb = (b.pte_tipo_acc || "").toLowerCase(); break;
        case "barreras":
          va = (a.via_barreras || "").toLowerCase(); vb = (b.via_barreras || "").toLowerCase(); break;
        case "org":
          va = (a.fuente_org || "").toLowerCase(); vb = (b.fuente_org || "").toLowerCase(); break;
        default:
          va = ""; vb = "";
      }
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });

    // Update sort icons
    document.querySelectorAll(".data-table th[data-sort]").forEach(th => {
      const icon = th.querySelector(".sort-icon");
      if (!icon) return;
      if (th.dataset.sort === sortKey) {
        icon.textContent = sortAsc ? " ▲" : " ▼";
      } else {
        icon.textContent = "";
      }
    });

    if (sorted.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:1rem;">Sin datos</td></tr>';
      return;
    }

    sorted.forEach(e => {
      const fecha = e.created_at ? new Date(e.created_at).toLocaleDateString("es-MX") : "—";
      const badgeClass = e.factibilidad === "Corto plazo" ? "corto"
        : e.factibilidad === "Mediano plazo" ? "medio" : "largo";

      const barreras = e.via_barreras && e.via_barreras !== "No hay"
        ? e.via_barreras : "No hay";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${fecha}</td>
        <td>${e.loc_ciudad || "—"}</td>
        <td>${e.loc_vialidad || "—"}</td>
        <td>${e.loc_referencia || "—"}</td>
        <td><strong>${e.total_ifcs ?? "—"}%</strong></td>
        <td><span class="badge badge--${badgeClass}">${e.factibilidad || "—"}</span></td>
        <td>${e.pte_tipo_acc || "—"}</td>
        <td>${barreras}</td>
        <td>${e.fuente_org || "—"}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Sortable headers
  document.querySelectorAll(".data-table th[data-sort]").forEach(th => {
    th.style.cursor = "pointer";
    th.addEventListener("click", () => {
      const key = th.dataset.sort;
      if (sortKey === key) {
        sortAsc = !sortAsc;
      } else {
        sortKey = key;
        sortAsc = true;
      }
      renderTable(getFiltered());
    });
  });

  // ========================================
  // INITIAL RENDER
  // ========================================

  renderDashboard();
});
