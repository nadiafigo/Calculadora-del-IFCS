/**
 * admin.js — Panel de aprobación manual
 *
 * Flujo: magic-link (signInWithOtp) → authenticated → listar pendientes →
 * aprobar o rechazar (UPDATE/DELETE). Credenciales desde config.js.
 *
 * El usuario debe existir en Authentication → Users del dashboard de
 * Supabase para poder recibir el magic link.
 */

if (typeof SUPABASE_URL === "undefined" || typeof SUPABASE_ANON_KEY === "undefined") {
  document.body.innerHTML = '<p style="padding:2rem;text-align:center;color:#c62828">Error: configuración no cargada. Contacta al administrador.</p>';
  throw new Error("config.js no cargado");
}

const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const els = {
  loginView:     document.getElementById("login-view"),
  loginForm:     document.getElementById("login-form"),
  loginEmail:    document.getElementById("login-email"),
  loginSubmit:   document.getElementById("login-submit"),
  loginMsg:      document.getElementById("login-msg"),
  adminView:     document.getElementById("admin-view"),
  adminEmail:    document.getElementById("admin-email"),
  logoutBtn:     document.getElementById("logout-btn"),
  refreshBtn:    document.getElementById("refresh-btn"),
  pendingList:   document.getElementById("pending-list"),
  pendingCount:  document.getElementById("pending-count"),
  adminMsg:      document.getElementById("admin-msg"),
};

function showMsg(el, text, type) {
  el.textContent = text;
  el.className = "admin-msg admin-msg--" + (type || "info");
  el.hidden = false;
  if (type === "success") setTimeout(() => hideMsg(el), 3000);
}

function hideMsg(el) {
  el.hidden = true;
  el.textContent = "";
}

function escapeHtml(s) {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderView(session) {
  if (session && session.user) {
    els.loginView.hidden = true;
    els.adminView.hidden = false;
    els.adminEmail.textContent = session.user.email || "";
    loadPending();
  } else {
    els.adminView.hidden = true;
    els.loginView.hidden = false;
    els.pendingList.innerHTML = "";
    els.pendingCount.textContent = "";
  }
}

async function loadPending() {
  hideMsg(els.adminMsg);
  els.pendingList.innerHTML = '<p class="admin-loading">Cargando…</p>';

  const { data, error } = await client
    .from("evaluaciones")
    .select("id, created_at, loc_pais, loc_ciudad, loc_vialidad, loc_colonia, loc_referencia, loc_x, loc_y, total_ifcs, factibilidad, fuente_nombre, fuente_org, fuente_correo")
    .eq("aprobado_mapa", false)
    .order("created_at", { ascending: false });

  if (error) {
    showMsg(els.adminMsg, "Error cargando pendientes: " + error.message, "error");
    els.pendingList.innerHTML = "";
    return;
  }

  els.pendingCount.textContent = data.length + (data.length === 1 ? " pendiente" : " pendientes");

  if (data.length === 0) {
    els.pendingList.innerHTML = '<p class="admin-empty">No hay evaluaciones pendientes.</p>';
    return;
  }

  els.pendingList.innerHTML = data.map(renderCard).join("");

  els.pendingList.querySelectorAll("[data-action=approve]").forEach(btn => {
    btn.addEventListener("click", () => approve(parseInt(btn.dataset.id, 10), btn));
  });
  els.pendingList.querySelectorAll("[data-action=reject]").forEach(btn => {
    btn.addEventListener("click", () => reject(parseInt(btn.dataset.id, 10), btn));
  });
}

function renderCard(e) {
  const fecha = e.created_at ? new Date(e.created_at).toLocaleString("es-MX") : "—";
  const coordsHtml = (e.loc_x && e.loc_y)
    ? `<a href="https://www.openstreetmap.org/?mlat=${encodeURIComponent(e.loc_y)}&mlon=${encodeURIComponent(e.loc_x)}&zoom=18" target="_blank" rel="noopener">${escapeHtml(e.loc_y + ", " + e.loc_x)} ↗</a>`
    : "—";
  return `
    <article class="pending-card" data-id="${e.id}">
      <header class="pending-card-head">
        <div>
          <h3>${escapeHtml(e.loc_vialidad || "Sin vialidad")}</h3>
          <p class="pending-sub">${escapeHtml(e.loc_ciudad || "—")}${e.loc_pais ? ", " + escapeHtml(e.loc_pais) : ""}</p>
        </div>
        <div class="pending-score">
          <span class="score-num">${e.total_ifcs != null ? e.total_ifcs + "%" : "—"}</span>
          <span class="score-tag">${escapeHtml(e.factibilidad || "—")}</span>
        </div>
      </header>
      <dl class="pending-fields">
        <div><dt>Colonia</dt><dd>${escapeHtml(e.loc_colonia || "—")}</dd></div>
        <div><dt>Referencia</dt><dd>${escapeHtml(e.loc_referencia || "—")}</dd></div>
        <div><dt>Coords (lat, lng)</dt><dd>${coordsHtml}</dd></div>
        <div><dt>Fuente</dt><dd>${escapeHtml(e.fuente_nombre || "—")} (${escapeHtml(e.fuente_org || "—")})</dd></div>
        <div><dt>Correo</dt><dd>${escapeHtml(e.fuente_correo || "—")}</dd></div>
        <div><dt>Enviado</dt><dd>${escapeHtml(fecha)}</dd></div>
      </dl>
      <footer class="pending-actions">
        <button class="btn-primary" data-action="approve" data-id="${e.id}">Aprobar</button>
        <button class="btn-danger"  data-action="reject"  data-id="${e.id}">Rechazar (eliminar)</button>
      </footer>
    </article>
  `;
}

async function approve(id, btn) {
  const { data: { session } } = await client.auth.getSession();
  const approver = session && session.user ? session.user.email : "admin";

  btn.disabled = true;
  btn.textContent = "Aprobando…";

  const { error } = await client
    .from("evaluaciones")
    .update({
      aprobado_mapa: true,
      aprobado_at: new Date().toISOString(),
      aprobado_por: approver,
    })
    .eq("id", id);

  if (error) {
    showMsg(els.adminMsg, "Error aprobando #" + id + ": " + error.message, "error");
    btn.disabled = false;
    btn.textContent = "Aprobar";
    return;
  }

  showMsg(els.adminMsg, "Evaluación #" + id + " aprobada.", "success");
  removeCard(id);
}

async function reject(id, btn) {
  if (!confirm("¿Eliminar definitivamente la evaluación #" + id + "? Esta acción no se puede deshacer.")) return;

  btn.disabled = true;
  btn.textContent = "Eliminando…";

  const { error } = await client.from("evaluaciones").delete().eq("id", id);

  if (error) {
    showMsg(els.adminMsg, "Error rechazando #" + id + ": " + error.message, "error");
    btn.disabled = false;
    btn.textContent = "Rechazar (eliminar)";
    return;
  }

  showMsg(els.adminMsg, "Evaluación #" + id + " eliminada.", "success");
  removeCard(id);
}

function removeCard(id) {
  const card = els.pendingList.querySelector('[data-id="' + id + '"]');
  if (card) card.remove();
  const remaining = els.pendingList.querySelectorAll(".pending-card").length;
  els.pendingCount.textContent = remaining + (remaining === 1 ? " pendiente" : " pendientes");
  if (remaining === 0) {
    els.pendingList.innerHTML = '<p class="admin-empty">No hay evaluaciones pendientes.</p>';
  }
}

// --- login form ---
els.loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideMsg(els.loginMsg);
  const email = els.loginEmail.value.trim();
  if (!email) return;

  els.loginSubmit.disabled = true;
  els.loginSubmit.textContent = "Enviando…";

  const { error } = await client.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin + window.location.pathname },
  });

  els.loginSubmit.disabled = false;
  els.loginSubmit.textContent = "Enviar enlace mágico";

  if (error) {
    showMsg(els.loginMsg, "No se pudo enviar el enlace: " + error.message, "error");
    return;
  }
  showMsg(els.loginMsg, "Listo, revisa tu correo. El enlace expira en ~1 hora.", "success");
});

// --- logout ---
els.logoutBtn.addEventListener("click", async () => {
  els.pendingList.innerHTML = "";
  await client.auth.signOut();
});

// --- refresh ---
els.refreshBtn.addEventListener("click", loadPending);

// --- initial + auth state sync ---
client.auth.getSession().then(({ data }) => renderView(data.session));
client.auth.onAuthStateChange((_event, session) => renderView(session));
