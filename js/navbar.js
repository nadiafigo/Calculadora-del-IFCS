/**
 * navbar.js — Lógica del menú de navegación (dropdowns)
 */

document.addEventListener("DOMContentLoaded", () => {
  const dropdowns = document.querySelectorAll(".menu-option");

  dropdowns.forEach(dropdown => {
    const select = dropdown.querySelector(".selected-option");
    const icon = dropdown.querySelector(".item-icon");
    const submenu = dropdown.querySelector(".submenu");
    const options = dropdown.querySelectorAll(".submenu li");

    if (!select || !submenu) return;

    select.addEventListener("click", () => {
      select.classList.toggle("select-clicked");
      if (icon) icon.classList.toggle("item-icon__rotate");
      submenu.classList.toggle("menu-open");
    });

    options.forEach(option => {
      option.addEventListener("click", () => {
        select.classList.remove("select-clicked");
        if (icon) icon.classList.remove("item-icon__rotate");
        submenu.classList.remove("menu-open");
        options.forEach(o => o.classList.remove("active"));
        option.classList.add("active");
      });
    });
  });
});
