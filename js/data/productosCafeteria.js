/* ============================
   Lucciano's Academy
   data/productosCafeteria.js — Galería de productos de Cafetería

   Mismo criterio que productosChocolateria.js/productosHeladeria.js:
   contenido presentacional, curado a mano (fotos reales + nombres),
   no viene de Sheets — no hay una hoja "Productos" en el esquema.

   Arranca con Chocolate Caliente (lanzamiento agosto 2026, manual
   "Hot Chocolate — Chocolatera Ugolini") — primer producto de la
   categoría "Bebidas Calientes". Se va a ir sumando el resto de la
   carta (café, syrups, etc.) a medida que se cargue cada manual.
=============================*/

const BASE = "assets/img/cafeteria/";

function producto({ categorias, nombre, foto, descripcion, sku }) {
    return { categorias, nombre, foto: BASE + foto, descripcion, sku };
}

export const PRODUCTOS_CAFETERIA = [
    producto({
        // "Chocolate Caliente" primero: es lo que compara contra el
        // título de la lección para el botón "Ver lección de X" (ver
        // categoriaPrincipal en galeriaProductos.js) — por eso las dos
        // lecciones de este producto arrancan su título con ese mismo
        // texto. "Bebidas Calientes" es la categoría de filtro (pill).
        categorias: ["Chocolate Caliente", "Bebidas Calientes"],
        nombre: "Chocolate Caliente",
        foto: "hotchocolate-final-cup.jpg",
        descripcion: "Chocolate caliente cremoso, elaborado con leche entera y preparado IRCA Hot Chocolate, servido en vaso de polipapel de 12 oz y decorado con crema batida, polvo de cacao y líneas de Avella Gianduia.",
        sku: "123",
    }),
];

export const CATEGORIAS_CAFETERIA = ["Bebidas Calientes"];
