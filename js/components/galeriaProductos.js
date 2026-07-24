/* ============================
   FARO v4
   galeriaProductos.js — Galería de productos con pills de categoría

   Inspirada en la web pública de Lucciano's (luccianos.net/productos):
   pills de filtro arriba + grilla de fotos abajo. Se usa como forma
   más linda de navegar dentro de un curso (ej. Chocolatería,
   Heladería) — no reemplaza el contenido de las lecciones, solo
   ayuda a saltar a la que corresponde. Colores propios de FARO, no
   los del sitio público.

   Un producto puede pertenecer a más de una categoría (ej. Sorbete
   Dark 72% es Chocolates Y Frutales/Vegan) — por eso se acepta tanto
   "categoria" (string, usado por Chocolatería) como "categorias"
   (array, usado por Heladería); ver categoriasDe().

   Productos con varias presentaciones (ej. Alfajores: Unidad/x6/x10/
   Lata x5/Surtido) no suman una tarjeta por combinación sabor+tamaño
   — al tocar la tarjeta se abre un modal con selector de presentación,
   la misma foto/tarjeta cambia de imagen según lo que se toque.
=============================*/

import { abrirModal, cerrarModal } from "./modal.js";

// Se completa en cada llamada a GaleriaProductos() — bindGaleriaProductos()
// lo usa para resolver qué producto corresponde a cada tarjeta clickeada.
let productosActuales = [];

function categoriasDe(producto) {
    return producto.categorias || [producto.categoria];
}

function badgeKosher(producto) {
    if (producto.kosher === "parve") return `<span class="badge-kosher badge-kosher-parve" title="Parve — vegano, sin lácteos">Parve</span>`;
    if (producto.kosher === "dairy") return `<span class="badge-kosher badge-kosher-dairy" title="Dairy — con lácteos">Dairy</span>`;
    return "";
}

// Animación real "Meet Our Friends" en vez de foto fija — solo para
// estos 3 personajes propios de Lucciano's (línea Luxury de Icepops)
// que tienen ese material. El resto del catálogo sigue con foto.
const VIDEO_POR_PRODUCTO = {
    "Tonio (Cookies & Cream)": "assets/video/producto-tonio.mp4",
    "Enzo Dulce de Leche con Gianduia": "assets/video/producto-enzo.mp4",
    "Minion": "assets/video/producto-minion.mp4",
};

function tarjetaProducto(producto, indice) {
    const video = VIDEO_POR_PRODUCTO[producto.nombre];
    const primeraFoto = producto.presentaciones ? producto.presentaciones[0].foto : producto.foto;
    const foto = video
        ? `<video src="${video}" autoplay muted loop playsinline></video>`
        : primeraFoto
            ? `<img src="${primeraFoto}" alt="${producto.nombre}">`
            : `<div class="producto-sin-foto">${producto.nombre.slice(0, 2).toUpperCase()}</div>`;

    return `
        <div class="producto-card" data-categoria="${categoriasDe(producto).join(",")}" data-indice="${indice}">
            <div class="producto-foto">${foto}${badgeKosher(producto)}</div>
            <div class="producto-nombre">${producto.nombre}</div>
        </div>
    `;
}

/**
 * @param {Array} productos - lista completa (todas las categorías)
 * @param {Array} categorias - orden de las pills de filtro
 */
export function GaleriaProductos(productos, categorias) {
    productosActuales = productos;

    const pills = [
        `<button class="pill-categoria activa" data-categoria-pill="todos">Todos</button>`,
        ...categorias.map((c) => `<button class="pill-categoria" data-categoria-pill="${c}">${c}</button>`),
    ].join("");

    const tarjetas = productos.map((p, i) => tarjetaProducto(p, i)).join("");

    return `
        <div class="galeria-productos">
            <div class="galeria-pills">${pills}</div>
            <div class="galeria-grid">${tarjetas}</div>
        </div>
    `;
}

/** Productos de la misma categoría "principal" (la primera de su
 *  lista) que `producto`, en el orden en que aparecen en la galería
 *  — define el circuito que recorren las flechas prev/next dentro
 *  del modal (ej. las 6 variedades de Alfajores), sin necesidad de
 *  cerrar y volver a abrir. Un producto con varias categorías (ej.
 *  Sorbete Dark 72%) navega dentro de la primera nada más, para que
 *  el circuito sea siempre el mismo recorrido predecible. */
function productosDeLaMismaCategoria(producto) {
    const principal = categoriasDe(producto)[0];
    return productosActuales.filter((p) => categoriasDe(p)[0] === principal);
}

function contenidoModalProducto(producto) {
    const presentaciones = producto.presentaciones;
    const fotoInicial = presentaciones ? presentaciones[0].foto : producto.foto;

    const fotoHtml = fotoInicial
        ? `<img src="${fotoInicial}" alt="${producto.nombre}" id="producto-modal-img">`
        : `<div class="producto-sin-foto" style="font-size:40px">${producto.nombre.slice(0, 2).toUpperCase()}</div>`;

    const hermanos = productosDeLaMismaCategoria(producto);
    const hayNav = hermanos.length > 1;
    const navHtml = hayNav
        ? `
            <button class="producto-modal-nav producto-modal-nav-prev" data-nav-producto="prev" aria-label="Variedad anterior">‹</button>
            <button class="producto-modal-nav producto-modal-nav-next" data-nav-producto="next" aria-label="Variedad siguiente">›</button>
        `
        : "";

    const pillsHtml = presentaciones && presentaciones.length > 1
        ? `
            <div class="galeria-pills" style="margin-top:14px">
                ${presentaciones.map((p, i) => `<button class="pill-categoria${i === 0 ? " activa" : ""}" data-presentacion-idx="${i}" data-presentacion-foto="${p.foto}">${p.label}</button>`).join("")}
            </div>
        `
        : "";

    // Descripción visible: la de la presentación seleccionada si tiene
    // una propia (ej. la composición de una caja surtida), si no la
    // general del producto. Cambia junto con la foto al tocar una pill.
    const descripcionInicial = (presentaciones && presentaciones[0].descripcion) || producto.descripcion || "";

    // El botón "Ver lección de X" solo tiene sentido si existe una
    // lección cuyo título coincide — con categorías tipo "Cremas" o
    // "Frutales/Vegan" (Heladería) eso ya no siempre es así, así que
    // se chequea antes de ofrecer un botón que no llevaría a ningún
    // lado.
    const categoriaPrincipal = categoriasDe(producto)[0];
    const hayLeccionRelacionada = Array.from(document.querySelectorAll(".leccion-item"))
        .some((l) => l.querySelector("h3")?.textContent.toLowerCase().includes(categoriaPrincipal.toLowerCase()));

    return `
        <div class="producto-modal-foto-wrap">
            ${navHtml}
            <div class="producto-modal-foto">${fotoHtml}</div>
        </div>
        ${hayNav ? `<p class="text-xs text-muted" style="text-align:center;margin-top:8px">${hermanos.indexOf(producto) + 1} / ${hermanos.length} · ${categoriaPrincipal}</p>` : ""}
        <p class="text-sm" id="producto-modal-desc" style="margin-top:14px;color:var(--text)${descripcionInicial ? "" : ";display:none"}">${descripcionInicial}</p>
        ${pillsHtml}
        ${hayLeccionRelacionada ? `<button class="btn btn-secondary" style="margin-top:16px;width:100%" data-ir-a-leccion>Ver lección de ${categoriaPrincipal}</button>` : ""}
    `;
}

/** Pinta el modal para `producto` (título + cuerpo) y conecta sus
 *  eventos — se llama tanto al abrir el modal como al navegar entre
 *  variedades con prev/next, así siempre queda todo recableado a la
 *  tarjeta que se está mostrando en ese momento. */
function renderModalProducto(modalId, producto) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    const titulo = modal.querySelector(".modal-header h2");
    if (titulo) titulo.textContent = producto.nombre;

    const body = modal.querySelector(".modal-body");
    body.innerHTML = contenidoModalProducto(producto);

    body.querySelectorAll("[data-presentacion-foto]").forEach((btn) => {
        btn.addEventListener("click", () => {
            body.querySelectorAll("[data-presentacion-foto]").forEach((b) => b.classList.remove("activa"));
            btn.classList.add("activa");
            const img = body.querySelector("#producto-modal-img");
            if (img) img.src = btn.dataset.presentacionFoto;

            // La descripción acompaña a la presentación elegida: una caja
            // surtida muestra su composición exacta, una del mismo sabor
            // vuelve a la descripción general del producto.
            const seleccionada = producto.presentaciones?.[Number(btn.dataset.presentacionIdx)];
            const desc = body.querySelector("#producto-modal-desc");
            if (desc) {
                const texto = (seleccionada && seleccionada.descripcion) || producto.descripcion || "";
                desc.textContent = texto;
                desc.style.display = texto ? "" : "none";
            }
        });
    });

    body.querySelector("[data-ir-a-leccion]")?.addEventListener("click", () => {
        cerrarModal(modalId);
        const categoria = categoriasDe(producto)[0].toLowerCase();
        const lecciones = Array.from(document.querySelectorAll(".leccion-item"));
        const destino = lecciones.find((l) => l.querySelector("h3")?.textContent.toLowerCase().includes(categoria));
        destino?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    body.querySelectorAll("[data-nav-producto]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const hermanos = productosDeLaMismaCategoria(producto);
            const posActual = hermanos.indexOf(producto);
            const delta = btn.dataset.navProducto === "next" ? 1 : -1;
            const posNueva = (posActual + delta + hermanos.length) % hermanos.length;
            renderModalProducto(modalId, hermanos[posNueva]);
        });
    });
}

function abrirModalProducto(producto) {
    const modalId = "modal-producto";

    const html = `
        <div class="modal-overlay" id="${modalId}">
            <div class="modal">
                <div class="modal-header">
                    <h2></h2>
                    <button class="modal-close" data-close="${modalId}">✕</button>
                </div>
                <div class="modal-body"></div>
            </div>
        </div>
    `;

    abrirModal(html, modalId);
    renderModalProducto(modalId, producto);
}

/** Conecta pills de filtro + click en tarjeta. Llamar después de insertar el HTML en el DOM. */
export function bindGaleriaProductos() {
    const pills = document.querySelectorAll(".galeria-pills > [data-categoria-pill]");
    const tarjetas = document.querySelectorAll(".producto-card");

    pills.forEach((pill) => {
        pill.addEventListener("click", () => {
            pills.forEach((p) => p.classList.remove("activa"));
            pill.classList.add("activa");

            const categoria = pill.dataset.categoriaPill;
            tarjetas.forEach((t) => {
                const propias = t.dataset.categoria.split(",");
                t.style.display = categoria === "todos" || propias.includes(categoria) ? "" : "none";
            });
        });
    });

    tarjetas.forEach((card) => {
        card.addEventListener("click", () => {
            const producto = productosActuales[Number(card.dataset.indice)];
            if (producto) abrirModalProducto(producto);
        });
    });
}
