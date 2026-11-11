/**
 * navbar.js — Menú de navegación: botón del menú móvil y desplegable «Descargables».
 *
 * La cabecera la escribe docs/unificar_cabecera_pie.py. Aquí sólo se maneja el estado:
 * - .nav__toggle (botón) abre/cierra .navbar-content y actualiza aria-expanded.
 * - Cada .menu-option con .submenu: su botón actualiza aria-expanded y la clase .menu-open.
 * - Escape cierra lo que esté abierto y devuelve el foco al botón que lo abrió.
 * Las páginas que aún tengan la versión con checkbox siguen funcionando (sólo CSS).
 */

document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.querySelector(".nav__toggle[aria-expanded]");
  const panel = document.querySelector(".navbar-content");
  const desplegables = [];

  function abrirMenu(abrir) {
    if (!toggle) return;
    toggle.setAttribute("aria-expanded", String(abrir));
  }

  if (toggle && panel) {
    toggle.addEventListener("click", () => {
      abrirMenu(toggle.getAttribute("aria-expanded") !== "true");
    });
  }

  document.querySelectorAll(".menu-option").forEach(opcion => {
    const fila = opcion.querySelector(".selected-option");
    const boton = opcion.querySelector(".selected-option button");
    const icono = opcion.querySelector(".item-icon");
    const submenu = opcion.querySelector(".submenu");
    if (!fila || !submenu) return;

    if (boton) {
      if (!submenu.id) submenu.id = "submenu-" + (desplegables.length + 1);
      boton.setAttribute("aria-controls", submenu.id);
      boton.setAttribute("aria-expanded", "false");
    }

    const estado = abierto => {
      submenu.classList.toggle("menu-open", abierto);
      fila.classList.toggle("select-clicked", abierto);
      if (icono) icono.classList.toggle("item-icon__rotate", abierto);
      if (boton) boton.setAttribute("aria-expanded", String(abierto));
    };
    const d = { opcion, boton, submenu, estado, abierto: () => submenu.classList.contains("menu-open") };
    desplegables.push(d);

    // Toda la fila (texto + flecha) abre y cierra; el botón es lo que recibe el foco.
    fila.addEventListener("click", () => estado(!d.abierto()));

    // Al elegir un descargable se cierra.
    submenu.querySelectorAll("a").forEach(a => a.addEventListener("click", () => estado(false)));

    // Si el foco sale del desplegable (Tab hacia fuera), se cierra.
    opcion.addEventListener("focusout", e => {
      if (!opcion.contains(e.relatedTarget)) estado(false);
    });
  });

  // Clic fuera: cierra los desplegables abiertos.
  document.addEventListener("click", e => {
    desplegables.forEach(d => { if (d.abierto() && !d.opcion.contains(e.target)) d.estado(false); });
  });

  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    const abierto = desplegables.find(d => d.abierto());
    if (abierto) {
      abierto.estado(false);
      if (abierto.boton && abierto.opcion.contains(document.activeElement)) abierto.boton.focus();
      return;
    }
    if (toggle && toggle.getAttribute("aria-expanded") === "true") {
      abrirMenu(false);
      if (panel && panel.contains(document.activeElement)) toggle.focus();
    }
  });
});
