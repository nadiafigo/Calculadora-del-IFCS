const dropdowns = document.querySelectorAll('.menu-option');

dropdowns.forEach(dropdown => {
    const select = dropdown.querySelector('.selected-option');
    const icon = dropdown.querySelector('.item-icon');
    const submenu = dropdown.querySelector('.submenu');
    const options = dropdown.querySelectorAll('.submenu li');
    const selected = dropdown.querySelector('.menu__item');


    select.addEventListener('click', () => {
        select.classList.toggle('select-clicked');
        icon.classList.toggle('item-icon__rotate');
        submenu.classList.toggle('menu-open');
    });

    options.forEach(option => {
        option.addEventListener('click', () => {
            select.classList.remove('select-clicked');
            icon.classList.remove('item-icon__rotate');
            submenu.classList.remove('menu-open');

            options.forEach(option => {
                option.classList.remove('active');
            });
            option.classList.add('active');
        });
    });
});