"""Pone la misma cabecera y el mismo pie en todas las páginas del sitio (no hay build step).

Uso: python docs/unificar_cabecera_pie.py
Reemplaza el bloque <header class="header">…</header> y el bloque class="footer"…(créditos) de cada página.
El panel de admin conserva su cabecera propia (sin navegación pública) y sólo recibe el pie.
Si se cambia un link del menú o del pie, se cambia aquí y se vuelve a correr.

Prefijo hacia la raíz: "./" o "../" según la carpeta, o "/" (absoluto) para 404.html, porque
GitHub Pages sirve esa página en cualquier ruta (/html/x/y) y los enlaces relativos se romperían.
Una página nueva puede traer sólo los marcadores <header class="header"></header> y
<footer class="footer"><div class="creditos"></div></footer>.

Accesibilidad: la cabecera empieza con el enlace «Saltar al contenido» (#contenido) y el script le
pone id="contenido" al primer <main> de cada página que no tenga id (no toca nada más del main).
"""
import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent

# página -> (prefijo hacia la raíz, clave de la sección actual)
PAGINAS = {
    "index.html": ("./", "calculadora"),
    "antecedentes.html": ("./", "metodologia"),
    "html/archivo.html": ("../", "archivo"),
    "html/mapa.html": ("../", "mapa"),
    "html/analytics.html": ("../", "estadisticas"),
    "html/resultado.html": ("../", ""),
    "html/admin.html": ("../", None),  # None = no tocar la cabecera
    "404.html": ("/", ""),             # absoluto: Pages la sirve en cualquier ruta
}
PREFIJOS = {"./", "../", "/"}

FB = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12c0 5 3.66 9.13 8.44 9.88v-6.99H7.9V12h2.54V9.8c0-2.51 1.49-3.89 3.78-3.89 1.09 0 2.23.19 2.23.19v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.77l-.44 2.89h-2.33v6.99C18.34 21.13 22 17 22 12c0-5.52-4.48-10-10-10z"/></svg>'
IG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.16c3.2 0 3.58.01 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.27.07 1.65.07 4.85 0 3.2-.01 3.58-.07 4.85-.15 3.23-1.66 4.77-4.92 4.92-1.27.06-1.64.07-4.85.07-3.2 0-3.58-.01-4.85-.07-3.26-.15-4.77-1.7-4.92-4.92-.06-1.27-.07-1.65-.07-4.85 0-3.2.01-3.58.07-4.85.15-3.23 1.66-4.77 4.92-4.92 1.27-.06 1.65-.07 4.85-.07zM12 0C8.74 0 8.33.01 7.05.07c-4.36.2-6.78 2.62-6.98 6.98C.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.2 4.36 2.62 6.78 6.98 6.98C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c4.35-.2 6.78-2.62 6.98-6.98.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.2-4.35-2.62-6.78-6.98-6.98C15.67.01 15.26 0 12 0zm0 5.84c-3.4 0-6.16 2.76-6.16 6.16s2.76 6.16 6.16 6.16 6.16-2.76 6.16-6.16S15.4 5.84 12 5.84zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm6.41-11.85c-.8 0-1.44.65-1.44 1.44 0 .8.65 1.44 1.44 1.44s1.44-.65 1.44-1.44c0-.79-.64-1.44-1.44-1.44z"/></svg>'
MAIL = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>'
CORREO = "adiospuentesantipeatonales@ligapeatonal.org"


def cabecera(p, actual):
    def item(clave, href, texto):
        cur = ' aria-current="page"' if clave == actual else ""
        return (f'                <li class="menu-option"><div class="selected-option">'
                f'<a class="menu__item" href="{href}"{cur}>{texto}</a></div></li>\n')

    return f'''<header class="header">
        <a class="saltar" href="#contenido">Saltar al contenido</a>
        <nav class="navbar" aria-label="Principal">
            <a class="marca" href="{p}index.html">
                <img src="{p}img/LP.png" alt="Liga Peatonal" class="navbar__logo" width="40" height="40">
                <span class="marca__nombre">Adiós puentes antipeatonales<small>Calculadora IFCS</small></span>
            </a>
            <button type="button" class="nav__toggle" aria-expanded="false" aria-controls="menu-principal"><span class="abrir">Menú</span><span class="cerrar">Cerrar</span></button>
            <div class="navbar-content" id="menu-principal">
              <ul class="menu">
{item("archivo", p + "html/archivo.html", "Archivo")}{item("mapa", p + "html/mapa.html", "Mapa")}{item("estadisticas", p + "html/analytics.html", "Estadísticas")}{item("metodologia", p + "antecedentes.html", "Metodología")}                <li class="menu-option">
                    <div class="selected-option"><button class="menu__item" type="button" aria-expanded="false" aria-controls="submenu-descargables">Descargables</button><span class="item-icon" aria-hidden="true"></span></div>
                    <div class="submenu" id="submenu-descargables">
                        <ul class="submenu_container">
                            <li><a class="submenu__item" href="{p}pdf/Tabla 5. Formato de llenado.pdf">Formato de llenado</a></li>
                            <li><a class="submenu__item" href="{p}pdf/MANUAL_IFCS.pdf">Manual del IFCS</a></li>
                            <li><a class="submenu__item" href="{p}pdf/Diagnostico_Puentes_Morelia.pdf">Diagnóstico de puentes de Morelia</a></li>
                        </ul>
                    </div>
                </li>
                <li class="menu-cta"><a class="btn btn--verde" href="{p}index.html#CalcForm">Evalúa un puente</a></li>
              </ul>
            </div>
        </nav>
    </header>'''


def pie(p):
    return f'''<footer class="footer">
        <div class="envoltura">
            <div class="pie-grid">
                <div class="pie-marca">
                    <div class="pie-logos">
                        <img class="pie-lp" src="{p}img/LP.png" alt="Liga Peatonal" width="56" height="56">
                        <div class="footer-logo"><img src="{p}img/logo_bicivilizate.svg" alt="Bicivilízate Michoacán A.C."></div>
                    </div>
                    <p>Una herramienta de Liga Peatonal y Bicivilízate Michoacán A.C. para impulsar cruces seguros a nivel de calle.</p>
                    <a class="correo" href="mailto:{CORREO}">{CORREO.replace("@", "@<wbr>")}</a>
                </div>
                <nav aria-label="Herramientas">
                    <h2>Herramientas</h2>
                    <ul class="footer-menu">
                        <li><a href="{p}index.html#CalcForm">Calculadora</a></li>
                        <li><a href="{p}html/archivo.html">Archivo de puentes</a></li>
                        <li><a href="{p}html/mapa.html">Mapa de resultados</a></li>
                        <li><a href="{p}html/analytics.html">Estadísticas</a></li>
                    </ul>
                </nav>
                <nav aria-label="Saber más">
                    <h2>Saber más</h2>
                    <ul class="footer-menu">
                        <li><a href="{p}antecedentes.html">Antecedentes y metodología</a></li>
                        <li><a href="{p}pdf/MANUAL_IFCS.pdf">Manual del IFCS</a></li>
                        <li><a href="{p}pdf/Tabla 5. Formato de llenado.pdf">Formato de llenado</a></li>
                        <li><a href="{p}antecedentes.html#descargas-meta">Todos los descargables</a></li>
                    </ul>
                </nav>
                <div>
                    <h2>Síguenos</h2>
                    <div class="footer-social" aria-label="Redes sociales de Liga Peatonal">
                        <a href="https://facebook.com/LigaPeatonal" target="_blank" rel="noopener" aria-label="Liga Peatonal en Facebook">{FB}</a>
                        <a href="https://instagram.com/ligapeatonal" target="_blank" rel="noopener" aria-label="Liga Peatonal en Instagram">{IG}</a>
                        <a href="mailto:{CORREO}" aria-label="Enviar correo a {CORREO}">{MAIL}</a>
                    </div>
                </div>
            </div>
            <div class="creditos">
                <p>Metodología y diseño del IFCS: Nadia F. para Bicivilízate Michoacán A.C. y Liga Peatonal A.C.</p>
                <p>Desarrollado por <a href="https://www.izalith.net/" class="link-izalith" target="_blank" rel="noopener">Izalith Consulting Corporation</a></p>
            </div>
        </div>
    </footer>'''


RE_HEADER = re.compile(r'<header class="header">.*?</header>', re.S)
RE_FOOTER = re.compile(r'<(section|footer) class="footer"[^>]*>.*?class="creditos".*?</div>\s*(?:</div>\s*)?</\1>', re.S)
RE_MAIN = re.compile(r'<main\b([^>]*)>')
RE_ID = re.compile(r'\bid\s*=')
RE_ID_CONTENIDO = re.compile(r'\bid\s*=\s*["\']contenido["\']')


def marcar_main(html, ruta):
    """id="contenido" en el primer <main> (destino de «Saltar al contenido»)."""
    m = RE_MAIN.search(html)
    if not m:
        print("SIN MAIN", ruta)
        return html
    attrs = m.group(1)
    if RE_ID.search(attrs):
        if not RE_ID_CONTENIDO.search(attrs):
            print("MAIN CON OTRO ID (el salto no funcionará)", ruta)
        return html
    return html[:m.start()] + f'<main id="contenido"{attrs}>' + html[m.end():]


def main():
    for ruta, (p, actual) in PAGINAS.items():
        assert p in PREFIJOS, f"prefijo raro en {ruta}: {p!r}"
        f = RAIZ / ruta
        if not f.exists():
            print("falta", ruta)
            continue
        html = f.read_text(encoding="utf-8")
        antes = html
        if actual is not None:
            html, n = RE_HEADER.subn(lambda _: cabecera(p, actual), html, count=1)
            if n != 1:
                print("SIN CABECERA", ruta)
        html, n = RE_FOOTER.subn(lambda _: pie(p), html, count=1)
        if n != 1:
            print("SIN PIE", ruta)
        html = marcar_main(html, ruta)
        if html != antes:
            f.write_text(html, encoding="utf-8")
        print("ok", ruta)


if __name__ == "__main__":
    main()
