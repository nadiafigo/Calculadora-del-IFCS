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

  let evaluaciones = [];

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/evaluaciones?select=*&order=created_at.desc`,
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

  // ========================================
  // EMPTY STATE
  // ========================================

  if (evaluaciones.length === 0) {
    dashboard.innerHTML = `
      <h1 class="dashboard-title">Dashboard de Evaluaciones</h1>
      <div class="empty-state">Aún no hay evaluaciones registradas.</div>
    `;
    return;
  }

  // ========================================
  // KPIs
  // ========================================

  const total = evaluaciones.length;
  const promedio = Math.round(evaluaciones.reduce((s, e) => s + (e.total_ifcs || 0), 0) / total);
  const corto = evaluaciones.filter(e => e.factibilidad === "Corto plazo").length;
  const pctCorto = Math.round((corto / total) * 100);
  const ciudadesSet = new Set(evaluaciones.map(e => e.loc_ciudad).filter(Boolean));

  document.getElementById("kpi-total").textContent = total;
  document.getElementById("kpi-promedio").textContent = promedio + "%";
  document.getElementById("kpi-corto").textContent = pctCorto + "%";
  document.getElementById("kpi-ciudades").textContent = ciudadesSet.size;

  // ========================================
  // CHART COLORS
  // ========================================

  const colCorto = "#2e7d32";
  const colMedio = "#f9a825";
  const colLargo = "#c62828";
  const colBlue = "hsl(209, 74%, 27%)";

  // ========================================
  // DONUT: Distribución por factibilidad
  // ========================================

  const countCorto = evaluaciones.filter(e => e.factibilidad === "Corto plazo").length;
  const countMedio = evaluaciones.filter(e => e.factibilidad === "Mediano plazo").length;
  const countLargo = evaluaciones.filter(e => e.factibilidad === "Largo plazo").length;

  new Chart(document.getElementById("chart-donut"), {
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
      plugins: {
        legend: { position: "bottom" }
      }
    }
  });

  // ========================================
  // BAR: Top 10 ciudades
  // ========================================

  const ciudadCount = {};
  evaluaciones.forEach(e => {
    const c = e.loc_ciudad || "Sin ciudad";
    ciudadCount[c] = (ciudadCount[c] || 0) + 1;
  });
  const top10 = Object.entries(ciudadCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  new Chart(document.getElementById("chart-ciudades"), {
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
      scales: {
        x: { beginAtZero: true, ticks: { precision: 0 } }
      }
    }
  });

  // ========================================
  // BAR: Distribución de puntaje IFCS
  // ========================================

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

  new Chart(document.getElementById("chart-rangos"), {
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
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 } }
      }
    }
  });

  // ========================================
  // LINE/BAR: Evaluaciones por mes
  // ========================================

  const monthCount = {};
  evaluaciones.forEach(e => {
    if (!e.created_at) return;
    const d = new Date(e.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthCount[key] = (monthCount[key] || 0) + 1;
  });

  const sortedMonths = Object.keys(monthCount).sort();
  const monthLabels = sortedMonths.map(m => {
    const [y, mo] = m.split("-");
    const names = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
    return `${names[parseInt(mo) - 1]} ${y}`;
  });

  new Chart(document.getElementById("chart-timeline"), {
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
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 } }
      }
    }
  });

  // ========================================
  // TABLE: Últimas 20 evaluaciones
  // ========================================

  const tbody = document.getElementById("tabla-body");
  const ultimas = evaluaciones.slice(0, 20);

  if (ultimas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:1rem;">Sin datos</td></tr>';
  } else {
    ultimas.forEach(e => {
      const fecha = e.created_at ? new Date(e.created_at).toLocaleDateString("es-MX") : "—";
      const badgeClass = e.factibilidad === "Corto plazo" ? "corto"
        : e.factibilidad === "Mediano plazo" ? "medio" : "largo";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${fecha}</td>
        <td>${e.loc_ciudad || "—"}</td>
        <td>${e.loc_vialidad || "—"}</td>
        <td>${e.loc_referencia || "—"}</td>
        <td><strong>${e.total_ifcs ?? "—"}%</strong></td>
        <td><span class="badge badge--${badgeClass}">${e.factibilidad || "—"}</span></td>
        <td>${e.fuente_org || "—"}</td>
      `;
      tbody.appendChild(tr);
    });
  }
});
