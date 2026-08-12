/* ============================
   Lucciano's Academy
   pages/cursos.js

   Admin: catálogo simple (nombre/categoría/obligatorio) — la
   gestión de contenido en profundidad vive en pages/academia.js.

   Colaborador: "Mis cursos" (grid con progreso) y, al entrar a uno
   (#/cursos/:id), el detalle con sus lecciones reales. No hay un
   campo de "lección completada" en el esquema — el avance se
   deriva de asignacion.progreso (mismo criterio que ya usa
   inicioColaborador.js para calcular "en qué lección vas"): marcar
   una lección como vista avanza el progreso al siguiente umbral.
=============================*/

import { Header } from "../components/header.js";
import { Table } from "../components/table.js";
import { CourseCard } from "../components/courseCard.js";
import { EmptyState } from "../components/emptyState.js";
import { Icon } from "../components/icons.js";
import { GaleriaProductos, bindGaleriaProductos } from "../components/galeriaProductos.js";
import { renderProcedimiento } from "../components/procedimiento.js";
import { PRODUCTOS_CHOCOLATERIA, CATEGORIAS_CHOCOLATERIA } from "../data/productosChocolateria.js";
import { PRODUCTOS_HELADERIA, CATEGORIAS_HELADERIA } from "../data/productosHeladeria.js";
import { PRODUCTOS_ICEPOPS, CATEGORIAS_ICEPOPS } from "../data/productosIcepops.js";
import { PRODUCTOS_PASTELERIA, CATEGORIAS_PASTELERIA } from "../data/productosPasteleria.js";
import { getCursos } from "../data/cursos.js";
import { getLeccionesPorCurso } from "../data/lecciones.js";
import { getAsignacionesPorColaborador, crearAsignacion, actualizarAsignacion } from "../data/asignaciones.js";
import { getResultadosPorColaborador } from "../data/resultados.js";
import { registrarEvento } from "../data/auditoria.js";
import { getUsuarioActual, estaViendoComo } from "../services/auth.js";
import { navigate } from "../router.js";
import { aplicaAlUsuario, leccionesDeLaPersona } from "../services/alcance.js";

export async function Cursos(params = []) {

    const usuario = getUsuarioActual();
    const cursoId = params && params[0];

    // Con un cursoId, siempre es una vista previa del curso real (para
    // un admin, esto es "Vista previa" desde Academia — ver
    // pages/academia.js — así puede ver exactamente lo que ve un
    // colaborador sin tener que usar "Ver como" para ir y volver).
    if (cursoId) return renderDetalleCurso(usuario, cursoId);

    if (usuario.rol === "admin") {
        const cursos = await getCursos();
        const columnas = [
            { key: "nombre", label: "Curso" },
            { key: "categoria", label: "Categoría" },
            { key: "obligatorioLabel", label: "Obligatorio" },
        ];
        const filas = cursos.map((c) => ({ ...c, obligatorioLabel: c.obligatorio ? "Sí" : "No" }));

        return `
            ${Header("Cursos", "Catálogo de capacitación")}
            ${Table(columnas, filas)}
        `;
    }

    return renderListaCursos(usuario);
}

async function renderListaCursos(usuario) {

    const [todosLosCursos, asignaciones] = await Promise.all([
        getCursos(),
        getAsignacionesPorColaborador(usuario.id),
    ]);

    // Categoría "Gestión" (hoy solo "Encargados y Responsables") queda
    // reservada a colaboradores con encargado:true — un colaborador
    // raso no debería ver ni poder abrir contenido de gestión de local.
    // Supervisor entra sin esa restricción (ve todo el catálogo, solo
    // para repasar contenido — no le genera progreso propio).
    // El alcance por país/local (services/alcance.js) va aparte de la
    // regla de Gestión y no se puede delegar en cursosDeLaPersona():
    // esa función excluye Gestión para todo el que no sea encargado,
    // mientras que acá el Supervisor sí la ve.
    const cursos = todosLosCursos
        .filter((c) => c.categoria !== "Gestión" || usuario.encargado || usuario.rol === "supervisor")
        .filter((c) => aplicaAlUsuario(c, usuario));

    const tarjetas = cursos.map((curso) => {
        const asignacion = asignaciones.find((a) => String(a.cursoId) === String(curso.id));
        return CourseCard({
            nombre: curso.nombre,
            detalle: curso.categoria + (curso.obligatorio ? " · Obligatorio" : ""),
            progreso: asignacion ? asignacion.progreso : null,
            href: `#/cursos/${curso.id}`,
        });
    }).join("");

    return `
        ${Header("Mis cursos", "Tu formación en Lucciano's")}
        <div class="cards">${tarjetas}</div>
    `;
}

/** Una URL real (http/https) se puede mostrar como link (video/manual)
 *  sin más — ahí una ruta relativa no tiene sentido, tiene que ser un
 *  link externo real. */
function esUrlValida(valor) {
    return /^https?:\/\//i.test(valor || "");
}

/** Las imágenes de lección sí pueden ser locales (ej. "assets/img/
 *  recetas/cappuccino.png") además de links de Drive — ahora que el
 *  proyecto tiene sus propios assets, no hay motivo para descartar
 *  una ruta relativa como si fuera un ícono roto. */
function esImagenValida(valor) {
    return esUrlValida(valor) || /^assets\//i.test(valor || "");
}

// Texto de portada por curso — presentación pura (no hay campo
// "objetivo del curso" en la hoja "Cursos"), mismo criterio que
// GALERIAS_POR_CURSO más abajo: un mapa local por nombre, sin tocar
// el esquema del backend.
const INTRO_POR_CURSO = {
    "Cafetería": "Vas a aprender a preparar cada bebida de la carta con la receta exacta — cápsulas, salsas y syrups — y a reconocer los combos y promociones vigentes.",
    "Heladería": "Vas a aprender a armar, exhibir y conservar el helado según los estándares de Lucciano's: gramajes, temperaturas de vitrina, variegatos, líneas Kosher, Gluten Free y batidos.",
    "Icepops": "Vas a conocer en profundidad la carta de Icepops, Mini Icepops, Cannolis y Geladots: sabores, coberturas, rellenos y presentaciones de cada variedad.",
    "Pastelería": "Vas a reconocer las tortas, la pastelería fresca y los productos de cocción vigentes, junto con su presentación, vida útil y forma correcta de descongelado/horneado.",
    "Chocolatería": "Vas a dominar los alfajores, conitos, tabletas y Avella, además de las líneas nuevas de Squares y Latas: variedades, gramajes y vencimientos.",
    "Sistema y Caja": "Vas a aprender el manejo diario del sistema de punto de venta: apertura y cierre de caja, facturación, arqueos y procedimientos operativos del local.",
    "Atención al Cliente": "Vas a aprender a brindar una atención acorde a los estándares de Lucciano's, junto con las normas de higiene e inocuidad alimentaria que aplican a todo el personal.",
    "Encargados y Responsables": "Vas a conocer las herramientas de gestión de equipo y de local que le corresponden a un encargado o responsable de turno.",
};

// Cursos donde el examen se apoya en el catálogo de productos además
// de las lecciones (los sabores/variedades no están descriptos en un
// párrafo de lección, hay que recorrer las fichas del catálogo para
// conocerlos) — a diferencia de Pastelería, que sí tiene cada
// producto desarrollado dentro de sus propias lecciones de texto.
const CURSOS_CON_EXAMEN_MAS_ALLA_DE_LECCIONES = new Set(["Heladería", "Icepops", "Chocolatería"]);

/** Cinta de nombres reales del catálogo del curso — se corta a 8 para
 *  que la animación no quede eterna, y se duplica una vez para que el
 *  loop (traslación al -50%) no muestre un corte. */
function renderMarqueeIntro(productos) {
    if (!productos || !productos.length) return "";
    const nombres = productos.slice(0, 8).map((p) => p.nombre.toUpperCase());
    const spans = [...nombres, ...nombres].map((n) => `<span>${n}<span></span></span>`).join("");
    return `
        <div class="curso-intro-marquee">
            <div class="curso-intro-marquee-track">${spans}</div>
        </div>
    `;
}

// Video de fondo real por módulo — solo los cursos con material de
// video propio de un local (recortes de Reels reales) lo tienen; el
// resto se queda con la tarjeta clara de siempre, sin forzar un clip
// que no corresponda temáticamente.
const VIDEO_POR_CURSO = {
    "Heladería": "assets/video/heladeria-produccion.mp4",
    "Icepops": "assets/video/icepops-hero.mp4",
    "Chocolatería": "assets/video/chocolateria-hero.mp4",
    // Sin Reel propio (es un módulo de sistema, no una línea de
    // producto) — zoom lento sobre la foto real del mostrador en vez
    // de forzar un clip que no existe.
    "Sistema y Caja": "assets/video/sistema-caja-hero.mp4",
};

// Portada estática tipo "tarjeta de marca" para módulos sin video
// propio — mismo lugar/tamaño que el banner de video, pero foto fija.
const IMAGEN_HERO_POR_CURSO = {
    "Cafetería": "assets/img/cursos/cafeteria-hero.jpg",
    "Pastelería": "assets/img/cursos/pasteleria-hero.jpg",
    "Atención al Cliente": "assets/img/cursos/atencion-cliente-hero.jpg",
};

// Título superpuesto por CSS — sin uso por ahora: las tarjetas de
// Cafetería/Pastelería ya vienen completas con su propia tipografía
// (ver TEMA_POR_CURSO / IMAGEN_HERO_POR_CURSO), no hace falta
// superponer nada. Se deja el mecanismo listo por si hace falta más
// adelante para algún módulo sin texto propio.
const TITULO_HERO_POR_CURSO = {};

// Tema de color por módulo (ver .tema-* en components.css) — la paleta
// real sacada del video de ese local. Todavía no todos los cursos con
// video tienen su tema armado; el resto usa el dorado de marca por
// defecto (--tema-accent ya apunta a --gold en variables.css).
const TEMA_POR_CURSO = {
    "Heladería": "tema-heladeria",
    "Icepops": "tema-icepops",
    "Cafetería": "tema-cafeteria",
    "Chocolatería": "tema-chocolateria",
};

function renderVideoBanner(curso) {
    const video = VIDEO_POR_CURSO[curso.nombre];
    if (video) {
        return `
            <div class="curso-video-banner">
                <video src="${video}" autoplay muted loop playsinline></video>
            </div>
        `;
    }
    const imagen = IMAGEN_HERO_POR_CURSO[curso.nombre];
    if (imagen) {
        const titulo = TITULO_HERO_POR_CURSO[curso.nombre];
        // Estas fotos ya traen su propio marco dorado con esquinas
        // redondeadas "quemado" en el archivo — el arco grande del
        // banner de video le tapaba las puntas y cortaba el marco.
        // Con -tarjeta se usa un radio parejo y chico, para que se
        // vea la tarjeta completa tal cual se generó.
        return `
            <div class="curso-video-banner curso-video-banner-tarjeta">
                <img src="${imagen}" alt="${curso.nombre}">
                ${titulo ? `<div class="curso-banner-overlay"><h2>${titulo}</h2></div>` : ""}
            </div>
        `;
    }
    return "";
}

function renderIntroCurso(curso, lecciones, productos) {
    const objetivo = INTRO_POR_CURSO[curso.nombre];
    if (!objetivo) return "";
    const duracionTotal = lecciones.reduce((s, l) => s + (Number(l.duracionMinutos) || 0), 0);
    const avisoExamen = CURSOS_CON_EXAMEN_MAS_ALLA_DE_LECCIONES.has(curso.nombre)
        ? `<p class="text-sm text-muted" style="margin-top:8px">El examen evalúa el módulo completo — eso incluye conocer bien los sabores y su contenido, no solo lo que está en estas lecciones. Recorré el catálogo de productos al final de la página antes de rendir.</p>`
        : "";
    return `
        ${renderVideoBanner(curso)}
        <div class="curso-intro">
            <h2>Antes de empezar</h2>
            <p class="text-sm">${objetivo}</p>
            ${avisoExamen}
            <div class="curso-intro-meta">
                <span>${Icon("academia", { size: 14 })} ${lecciones.length} lecciones</span>
                ${duracionTotal ? `<span>${Icon("dashboard", { size: 14 })} ~${duracionTotal} min</span>` : ""}
            </div>
            ${renderMarqueeIntro(productos)}
        </div>
    `;
}

function claveVideoVisto(leccionId) {
    return `faro_video_visto_${leccionId}`;
}

// renderProcedimiento (formateo de texto plano en lista/pasos numerados)
// vive en components/procedimiento.js — noticias.js la reusa para el
// detalle de una noticia con el mismo lenguaje visual.

// Clip real por lección puntual (no por curso entero) — reemplaza la
// imagen estática de la lección, no se muestran las dos. Reservado para
// lecciones de TÉCNICA/movimiento (armado, dipeado, etc.) — para
// pantallas de sistema con texto para leer, ver IMAGENES_POR_LECCION
// (con video no da tiempo a leer las instrucciones).
const VIDEO_POR_LECCION = {
    97: "assets/video/heladeria-peinado-frutal.mp4",
    62: "assets/video/avella-leccion.mp4",
    81: "assets/video/heladeria-armado-cucurucho.mp4",
    82: "assets/video/heladeria-armado-vaso.mp4",
    20: "assets/video/chocolateria-tabletas.mp4",
    21: "assets/video/chocolateria-latas.mp4",
    19: "assets/video/chocolateria-conitos.mp4",
    61: "assets/video/chocolateria-viennesi.mp4",
    73: "assets/video/icepops-dubai.mp4",
    63: "assets/video/chocolateria-squares.mp4",
    18: "assets/video/chocolateria-alfajores.mp4",
};

// Lecciones con MÁS de un clip real (a diferencia de VIDEO_POR_LECCION,
// que asume un solo video) — hoy solo Avella: el clip original no
// mostraba todas las variedades (faltaban Dubai y Gianduia Crock/Coco
// Rock), así que en vez de reemplazarlo se suman como un carrusel
// navegable (mismo criterio de "no perder contenido real" que ya usa
// IMAGENES_POR_LECCION para capturas). Toma prioridad sobre
// VIDEO_POR_LECCION/IMAGENES_POR_LECCION si una lección aparece acá.
const VIDEOS_MULTIPLES_POR_LECCION = {
    62: [
        { src: "assets/video/avella-leccion.mp4", poster: "assets/video/posters/avella-leccion-poster.jpg", caption: "Línea Avella" },
        { src: "assets/video/avella-dubai.mp4", poster: "assets/video/posters/avella-dubai-poster.jpg", caption: "Avella Dubai" },
        { src: "assets/video/avella-gianduia-crock-coco-rock.mp4", poster: "assets/video/posters/avella-gianduia-crock-coco-rock-poster.jpg", caption: "Avella Gianduia Crock & Avella Coco Rock" },
    ],
};

// Portada fija por lección (cuadro representativo, no el primer frame
// al azar) — el video no arranca solo: se ve la foto hasta que el
// colaborador elige reproducirlo (ver bindCursos).
const POSTER_POR_LECCION = {
    97: "assets/video/posters/heladeria-peinado-frutal-poster.jpg",
    62: "assets/video/posters/avella-leccion-poster.jpg",
    81: "assets/video/posters/heladeria-armado-cucurucho-poster.jpg",
    82: "assets/video/posters/heladeria-armado-vaso-poster.jpg",
    20: "assets/video/posters/chocolateria-tabletas-poster.jpg",
    21: "assets/video/posters/chocolateria-latas-poster.jpg",
    19: "assets/video/posters/chocolateria-conitos-poster.jpg",
    61: "assets/video/posters/chocolateria-viennesi-poster.jpg",
    73: "assets/video/posters/icepops-dubai-poster.jpg",
    63: "assets/video/posters/chocolateria-squares-poster.jpg",
    18: "assets/video/posters/chocolateria-alfajores-poster.jpg",
};

// Imagen fija ADICIONAL, no excluyente con video/carrusel — a
// diferencia de "imagen" (l.imagen), que solo se muestra si la
// lección no tiene video ni carrusel (ver renderCuerpoLeccion). Nace
// para "Las 5 Estrellas del Alfajor": Alfajores ya tiene su propio
// video de producto, pero esta pieza de marketing (por qué elegir
// Lucciano's) tiene que verse igual — no reemplaza al video, se suma.
const IMAGEN_EXTRA_POR_LECCION = {
    18: "assets/img/chocolateria/cinco_estrellas_alfajor.png",
};

// Secuencia de capturas de pantalla navegable a mano (botones
// anterior/siguiente, sin autoplay) — para lecciones de Sistema y
// Caja donde la pantalla trae texto/instrucciones que hay que poder
// leer con calma, algo que un video con transición automática no
// permite.
const IMAGENES_POR_LECCION = {
    7: [{ src: "assets/img/cursos/heladeria-pase-1.jpg", caption: "Comparar las dos mitades y elegir la de mejor apariencia" }, { src: "assets/img/cursos/heladeria-pase-2.jpg", caption: "Completar la vasqueta" }, { src: "assets/img/cursos/heladeria-pase-3.jpg", caption: "Formar los picos sobre la superficie" }, { src: "assets/img/cursos/heladeria-pase-4.jpg", caption: "Vasqueta terminada, con su cartel de sabor" }, { src: "assets/img/cursos/heladeria-pase-5.jpg", caption: "Cartel de sabor" }, { src: "assets/img/cursos/heladeria-pase-6.jpg", caption: "Colocar en el abatidor" }, { src: "assets/img/cursos/heladeria-pase-7.jpg", caption: "Exhibida en la vitrina" }],
    9: [{ src: "assets/img/cursos/heladeria-bano-chocolate-1.jpg", caption: "Cono antes del baño" }, { src: "assets/img/cursos/heladeria-bano-chocolate-2.jpg", caption: "Primer contacto con el chocolate" }, { src: "assets/img/cursos/heladeria-bano-chocolate-3.jpg", caption: "Girando para cubrir todo el cono" }, { src: "assets/img/cursos/heladeria-bano-chocolate-4.jpg", caption: "Retirando el exceso de chocolate" }, { src: "assets/img/cursos/heladeria-bano-chocolate-5.jpg", caption: "Cono terminado" }],
    5: [{ src: "assets/img/cursos/heladeria-gramajes.png", caption: "Vasos y conos — gramaje por presentación" }, { src: "assets/img/cursos/heladeria-gramajes-potes.jpg", caption: "Potes Take Away, Consumo Ahora e Icepop Take Away" }],
    8: [{ src: "assets/img/cursos/heladeria-vitrina-icepops.jpg", caption: "Vitrina de icepops y bombones exhibidos" }, { src: "assets/img/cursos/heladeria-vitrina-mostrador.jpg", caption: "Mostrador y exhibidor de gelato" }, { src: "assets/img/cursos/heladeria-vitrina-sabores.jpg", caption: "Vitrina con sabores etiquetados" }],
    23: [{ src: "assets/img/caja/caja-ingreso-personal-1.jpg", caption: "Vista principal del sistema" }, { src: "assets/img/caja/caja-ingreso-personal-2.jpg", caption: "Versión del sistema" }, { src: "assets/img/caja/caja-ingreso-personal-3.jpg", caption: "Fichaje de personal" }, { src: "assets/img/caja/caja-ingreso-personal-4.jpg", caption: "Inicio de caja diaria" }, { src: "assets/img/caja/caja-ingreso-personal-5.jpg", caption: "Inicio de caja: ingreso del cajero" }],
    24: [{ src: "assets/img/caja/caja-facturacion-1.jpg", caption: "Selección de productos" }, { src: "assets/img/caja/caja-facturacion-2.jpg", caption: "Sistema de facturación" }, { src: "assets/img/caja/caja-facturacion-3.jpg", caption: "Cierre de venta en efectivo" }, { src: "assets/img/caja/caja-facturacion-4.jpg", caption: "Consumo de bolsas" }, { src: "assets/img/caja/caja-facturacion-5.jpg", caption: "Formas de pago: efectivo y tarjeta" }],
    25: [{ src: "assets/img/caja/caja-mercadopago-1.jpg", caption: "Mercado Pago — paso 1" }, { src: "assets/img/caja/caja-mercadopago-2.jpg", caption: "Mercado Pago — pasos 2 a 4" }, { src: "assets/img/caja/caja-mercadopago-3.jpg", caption: "Mercado Pago — paso 5" }, { src: "assets/img/caja/caja-mercadopago-4.jpg", caption: "Mercado Pago — paso 6" }, { src: "assets/img/caja/caja-mercadopago-5.jpg", caption: "Mercado Pago — paso 7" }, { src: "assets/img/caja/caja-mercadopago-6.jpg", caption: "Mercado Pago — paso 8" }, { src: "assets/img/caja/caja-mercadopago-7.jpg", caption: "Contingencia: ingreso manual" }],
    83: [{ src: "assets/img/caja/caja-cierre-arqueo-1.jpg", caption: "Planilla de caja" }, { src: "assets/img/caja/caja-cierre-arqueo-2.jpg", caption: "Detallado de caja y nota de crédito" }, { src: "assets/img/caja/caja-cierre-arqueo-3.jpg", caption: "Arqueo de caja diaria" }, { src: "assets/img/caja/caja-cierre-arqueo-4.jpg", caption: "Cierre X y Z" }],
    84: [{ src: "assets/img/caja/caja-tipos-factura-1.jpg", caption: "Venta sin cargo y descuento de empleado" }, { src: "assets/img/caja/caja-tipos-factura-2.jpg", caption: "Registrar y buscar cliente (Factura A)" }],
    85: [{ src: "assets/img/caja/caja-fuerte-depositos-1.jpg", caption: "Movimientos de caja fuerte" }, { src: "assets/img/caja/caja-fuerte-depositos-2.jpg", caption: "Autorización de supervisor" }],
    86: [{ src: "assets/img/caja/caja-ingresos-egresos-1.jpg", caption: "Ingreso a caja" }, { src: "assets/img/caja/caja-ingresos-egresos-2.jpg", caption: "Egresos de caja" }],
    87: [{ src: "assets/img/caja/caja-giftcards-1.jpg", caption: "Canje de Gift Card" }, { src: "assets/img/caja/caja-giftcards-2.jpg", caption: "Reporte de Gift Cards" }],
    88: [{ src: "assets/img/caja/caja-delivery-1.jpg", caption: "Control de despacho" }, { src: "assets/img/caja/caja-delivery-2.jpg", caption: "Cobro de Pedidos Ya" }, { src: "assets/img/caja/caja-delivery-3.jpg", caption: "Reporte de cupones" }, { src: "assets/img/caja/caja-delivery-4.jpg", caption: "Recepción de pedidos" }, { src: "assets/img/caja/caja-delivery-5.jpg", caption: "Listado de Delivery" }],
    89: [{ src: "assets/img/caja/caja-posnet-1.jpg", caption: "Cobro con tarjeta" }, { src: "assets/img/caja/caja-posnet-2.jpg", caption: "Cierre del posnet" }, { src: "assets/img/caja/caja-posnet-3.jpg", caption: "Lotes de tarjetas" }],
    90: [{ src: "assets/img/caja/caja-fabrica-stock-1.jpg", caption: "Menú de Utilidades" }, { src: "assets/img/caja/caja-fabrica-stock-2.jpg", caption: "Pedido a fábrica" }, { src: "assets/img/caja/caja-fabrica-stock-3.jpg", caption: "Ingreso de mercadería" }, { src: "assets/img/caja/caja-fabrica-stock-4.jpg", caption: "Informe de stock" }],
    91: [{ src: "assets/img/caja/caja-reportes-utilidades-1.jpg", caption: "Ventas sin cargo" }, { src: "assets/img/caja/caja-reportes-utilidades-2.jpg", caption: "Venta por producto" }, { src: "assets/img/caja/caja-reportes-utilidades-3.jpg", caption: "Registro de fichadas" }, { src: "assets/img/caja/caja-reportes-utilidades-4.jpg", caption: "Devoluciones" }, { src: "assets/img/caja/caja-reportes-utilidades-5.jpg", caption: "Envío de vasquetas" }],
};

// Cada item es { src, caption } — la imagen es la página completa del
// manual (sin recortar), y el epígrafe debajo dice a qué sección de
// esa lección corresponde, mismo lenguaje visual que el contador de
// variedades en la galería de productos (ver galeriaProductos.js).
function renderCarrusel(items, titulo) {
    const datosAttr = encodeURIComponent(JSON.stringify(items));
    return `
        <div class="leccion-carrusel" data-carrusel data-carrusel-items="${datosAttr}" data-carrusel-titulo="${titulo}">
            <div class="leccion-carrusel-viewport">
                ${items.map((item, i) => `<img class="leccion-carrusel-img${i === 0 ? " activa" : ""}" src="${item.src}" alt="${titulo} — ${item.caption}" data-indice="${i}">`).join("")}
            </div>
            <button class="leccion-carrusel-btn leccion-carrusel-prev" type="button" data-carrusel-prev aria-label="Paso anterior" disabled>${Icon("flecha-izq", { size: 20 })}</button>
            <button class="leccion-carrusel-btn leccion-carrusel-next" type="button" data-carrusel-next aria-label="Paso siguiente" ${items.length < 2 ? "disabled" : ""}>${Icon("flecha-der", { size: 20 })}</button>
            <button class="leccion-carrusel-expandir" type="button" data-carrusel-expandir aria-label="Ver a pantalla completa">${Icon("expandir", { size: 16 })}</button>
            <div class="leccion-carrusel-contador"><span data-carrusel-contador>1 / ${items.length}</span></div>
        </div>
        <p class="leccion-carrusel-caption"><span data-carrusel-caption>${items[0].caption}</span></p>
    `;
}

// Cada item es { src, poster, caption } — a diferencia de renderCarrusel
// (varias imágenes, todas ya en el DOM), acá hay UN solo <video> que
// cambia de src al navegar — no tiene sentido precargar 3 clips de
// varios MB si el colaborador solo va a mirar uno. Reusa las mismas
// clases .leccion-carrusel-btn/-prev/-next/-contador/-caption que el
// carrusel de imágenes (mismo lenguaje visual, sin duplicar CSS) — el
// único elemento nuevo es el wrapper .leccion-video-carrusel.
function renderVideoCarrusel(videos, titulo) {
    const datosAttr = encodeURIComponent(JSON.stringify(videos));
    return `
        <div class="leccion-video-carrusel" data-video-carrusel data-video-carrusel-items="${datosAttr}">
            <div class="leccion-video-wrap">
                <video class="leccion-imagen" data-video-carrusel-el muted controls playsinline preload="none" poster="${videos[0].poster || ""}"></video>
                <button class="leccion-video-play" type="button" data-video-carrusel-play aria-label="Reproducir video">${Icon("play", { size: 22 })}</button>
            </div>
            <button class="leccion-carrusel-btn leccion-carrusel-prev" type="button" data-video-carrusel-prev aria-label="Video anterior" disabled>${Icon("flecha-izq", { size: 20 })}</button>
            <button class="leccion-carrusel-btn leccion-carrusel-next" type="button" data-video-carrusel-next aria-label="Video siguiente" ${videos.length < 2 ? "disabled" : ""}>${Icon("flecha-der", { size: 20 })}</button>
            <div class="leccion-carrusel-contador"><span data-video-carrusel-contador>1 / ${videos.length}</span></div>
        </div>
        <p class="leccion-carrusel-caption"><span data-video-carrusel-caption>${videos[0].caption}</span></p>
    `;
}

function renderCuerpoLeccion(l, esActual, i, puedeMarcarVista = true) {
    const tieneVideo = esUrlValida(l.video);
    // No hay forma de saber si el colaborador miró el video completo
    // (se abre en una pestaña externa de Drive, sin API de progreso) —
    // lo más honesto que se puede exigir es que lo haya abierto al
    // menos una vez antes de dejarlo marcar la lección como vista.
    const yaAbrioVideo = tieneVideo && localStorage.getItem(claveVideoVisto(l.id)) === "1";
    const bloqueadaPorVideo = esActual && tieneVideo && !yaAbrioVideo;

    return `
        ${l.objetivo ? `<p class="text-sm text-muted" style="margin-top:6px">${l.objetivo}</p>` : ""}
        ${VIDEOS_MULTIPLES_POR_LECCION[l.id]
            ? renderVideoCarrusel(VIDEOS_MULTIPLES_POR_LECCION[l.id], l.titulo)
            : IMAGENES_POR_LECCION[l.id]
            ? renderCarrusel(IMAGENES_POR_LECCION[l.id], l.titulo)
            : VIDEO_POR_LECCION[l.id]
            ? `<div class="leccion-video-wrap">
                <video class="leccion-imagen" data-src="${VIDEO_POR_LECCION[l.id]}" poster="${POSTER_POR_LECCION[l.id] || ""}" muted controls playsinline preload="none"></video>
                <button class="leccion-video-play" type="button" data-reproducir-video aria-label="Reproducir video">${Icon("play", { size: 22 })}</button>
               </div>`
            : (esImagenValida(l.imagen) ? `<img class="leccion-imagen" src="${l.imagen}" alt="${l.titulo}">` : "")}
        ${IMAGEN_EXTRA_POR_LECCION[l.id] ? `<img class="leccion-imagen" style="margin-top:12px" src="${IMAGEN_EXTRA_POR_LECCION[l.id]}" alt="${l.titulo}">` : ""}
        ${renderProcedimiento(l.procedimiento)}
        ${l.errores ? `<div class="leccion-callout leccion-callout-errores"><strong>Errores frecuentes</strong><p>${l.errores}</p></div>` : ""}
        ${l.buenasPracticas ? `<div class="leccion-callout"><strong>Buenas prácticas</strong><p>${l.buenasPracticas}</p></div>` : ""}
        ${l.consejo ? `<div class="leccion-callout leccion-callout-tip"><strong>Consejo</strong><p>${l.consejo}</p></div>` : ""}
        ${l.resumen ? `<p class="text-sm text-muted" style="margin-top:10px">${l.resumen}</p>` : ""}
        <div class="leccion-acciones">
            ${tieneVideo ? `<a class="btn btn-secondary" data-video-leccion="${l.id}" href="${l.video}">Ver video</a>` : ""}
            ${esImagenValida(l.manual) ? `<a class="btn btn-secondary" href="${l.manual}">${l.manualLabel || "Ver manual"}</a>` : (l.manual ? `<p class="text-xs text-muted">${l.manual}</p>` : "")}
        </div>
        ${!l.objetivo && !l.procedimiento && !l.errores && !l.buenasPracticas && !l.consejo ? `<p class="text-sm text-muted" style="margin-top:6px">Sin contenido cargado todavía.</p>` : ""}
        ${esActual && puedeMarcarVista ? `<button class="btn btn-primary" style="margin-top:14px" data-marcar-vista="${i}" ${bloqueadaPorVideo ? "disabled" : ""}>Marcar como vista</button>` : ""}
        ${bloqueadaPorVideo ? `<p class="text-xs text-muted aviso-ver-video" style="margin-top:6px">Abrí el video para poder marcar la lección como vista.</p>` : ""}
    `;
}

async function renderDetalleCurso(usuario, cursoId) {

    const [cursos, todasLasLecciones, asignaciones, resultados] = await Promise.all([
        getCursos(),
        getLeccionesPorCurso(cursoId),
        getAsignacionesPorColaborador(usuario.id),
        getResultadosPorColaborador(usuario.id),
    ]);

    // Un curso puede aplicar entero y tener adentro alguna lección que
    // no — ej. Cafetería sí en Uruguay, pero la lección de batidos no,
    // porque usan otra carta. Se filtra acá, antes de contar nada, para
    // que el total de lecciones del curso sea el de ESTA persona.
    const lecciones = leccionesDeLaPersona(todasLasLecciones, usuario);

    const curso = cursos.find((c) => String(c.id) === String(cursoId));
    const esSoloEncargados = curso && curso.categoria === "Gestión" && !usuario.encargado && usuario.rol !== "supervisor";
    // Sin esto, un curso acotado a otro país desaparecía del catálogo
    // pero seguía abriéndose pegando el link — se esconde y se bloquea,
    // no solo se esconde.
    const fueraDeAlcance = curso && !aplicaAlUsuario(curso, usuario);
    if (!curso || esSoloEncargados || fueraDeAlcance) {
        return EmptyState({
            titulo: "Curso no encontrado",
            detalle: "Puede que ya no exista o que el enlace esté mal.",
            accionLabel: "Volver a Mis cursos",
            accionHref: "#/cursos",
        });
    }

    const asignacion = asignaciones.find((a) => String(a.cursoId) === String(cursoId)) || null;
    const progreso = asignacion ? asignacion.progreso : 0;

    if (!lecciones.length) {
        return `
            <a class="btn btn-secondary" href="#/cursos">← Volver a Mis cursos</a>
            ${Header(curso.nombre, curso.categoria)}
            ${EmptyState({ titulo: "Todavía sin lecciones", detalle: "Este curso no tiene contenido cargado por ahora." })}
        `;
    }

    // Cuántas lecciones ya "vistas" según el progreso guardado — el
    // esquema no tiene un detalle por lección, así que se deriva del
    // % (mismo cálculo que usa el home para "en qué lección vas").
    const leccionesVistas = Math.min(lecciones.length, Math.round((progreso / 100) * lecciones.length));

    // Modo prueba: admin (viendo esta misma pantalla como vista previa
    // de Academia, o usando "Ver como"), o un Supervisor real —
    // desbloquea todas las lecciones para poder revisar cualquier
    // contenido sin tener que ir marcando una por una en orden. Para
    // un colaborador real el avance sigue siendo secuencial.
    const modoPrueba = estaViendoComo() || usuario.rol === "supervisor" || usuario.rol === "admin";
    // Supervisor/Admin entran solo a repasar contenido — no les
    // corresponde "Marcar como vista" (eso generaría una Asignación
    // real a su propio id, como si fueran un colaborador más).
    const puedeMarcarVista = usuario.rol !== "supervisor" && usuario.rol !== "admin";

    const filas = lecciones.map((l, i) => {
        const vista = i < leccionesVistas;
        const esActual = modoPrueba ? !vista : i === leccionesVistas;
        const bloqueada = modoPrueba ? false : i > leccionesVistas;

        const cuerpo = (vista || esActual) ? renderCuerpoLeccion(l, esActual, i, puedeMarcarVista) : `<p class="text-sm text-muted" style="margin-top:6px">Completá la lección anterior para desbloquearla.</p>`;

        return `
            <div class="leccion-item${vista ? " vista" : ""}${bloqueada ? " bloqueada" : ""}">
                <div class="leccion-item-header">
                    <span class="leccion-numero">${vista ? Icon("check", { size: 14 }) : l.orden}</span>
                    <h3>${l.titulo}</h3>
                    ${l.duracionMinutos ? `<span class="leccion-duracion">${l.duracionMinutos} min</span>` : ""}
                </div>
                ${cuerpo}
            </div>
        `;
    }).join("");

    const completado = leccionesVistas >= lecciones.length;

    const resultadosCurso = resultados.filter((r) => String(r.cursoId) === String(cursoId));
    const aprobado = resultadosCurso.find((r) => r.aprobado);
    const ultimoIntento = resultadosCurso[resultadosCurso.length - 1];

    let examenHtml = "";
    if (completado) {
        if (aprobado) {
            examenHtml = `
                <div class="examen-cta examen-cta-aprobado">
                    <span class="examen-cta-icono">${Icon("trofeo", { size: 22 })}</span>
                    <div><h3>Aprobaste el examen</h3><p class="text-sm text-muted">Nota: ${aprobado.nota}/10</p></div>
                    ${modoPrueba ? `<a class="btn btn-secondary" href="#/examen/${cursoId}">Rendir de nuevo (modo prueba)</a>` : ""}
                </div>
            `;
        } else if (ultimoIntento) {
            examenHtml = `
                <div class="examen-cta examen-cta-pendiente">
                    <span class="examen-cta-icono">${Icon("warning", { size: 22 })}</span>
                    <div><h3>No aprobaste tu último intento</h3><p class="text-sm text-muted">Nota: ${ultimoIntento.nota}/10</p></div>
                    <a class="btn btn-primary" href="#/examen/${cursoId}">Volver a intentar</a>
                </div>
            `;
        } else {
            examenHtml = `
                <div class="examen-cta">
                    <span class="examen-cta-icono">${Icon("evaluaciones", { size: 22 })}</span>
                    <div><h3>¡Completaste todas las lecciones!</h3><p class="text-sm text-muted">Ahora rendí el examen de ${curso.nombre}.</p></div>
                    <a class="btn btn-primary" href="#/examen/${cursoId}">Rendir examen</a>
                </div>
            `;
        }
    }

    // Galería tipo "página oficial" — solo los cursos con catálogo de
    // productos curado la muestran (ver data/productosChocolateria.js
    // y data/productosHeladeria.js). No reemplaza las lecciones, es
    // una forma más visual de saltar a la que corresponde antes de
    // leer el contenido completo.
    const GALERIAS_POR_CURSO = {
        "Chocolatería": [PRODUCTOS_CHOCOLATERIA, CATEGORIAS_CHOCOLATERIA],
        "Heladería": [PRODUCTOS_HELADERIA, CATEGORIAS_HELADERIA],
        "Icepops": [PRODUCTOS_ICEPOPS, CATEGORIAS_ICEPOPS],
        "Pastelería": [PRODUCTOS_PASTELERIA, CATEGORIAS_PASTELERIA],
    };
    const galeriaCurso = GALERIAS_POR_CURSO[curso.nombre];
    const galeriaHtml = galeriaCurso
        ? `<div class="section"><h2>Catálogo de productos</h2>${GaleriaProductos(...galeriaCurso)}</div>`
        : "";

    const tema = TEMA_POR_CURSO[curso.nombre];

    // Un admin llega acá desde "Vista previa" en Academia (ver
    // pages/academia.js) — no tiene progreso propio en este curso, así
    // que la barra de % no dice nada útil. Se reemplaza por un aviso
    // que además lo devuelve directo a editar este mismo curso, en vez
    // de mandarlo a la lista general.
    const esVistaPrevia = usuario.rol === "admin";
    const volverHref = esVistaPrevia ? "#/academia" : "#/cursos";
    const volverLabel = esVistaPrevia ? "← Volver a Academia" : "← Volver a Mis cursos";

    return `
        <a class="btn btn-secondary" href="${volverHref}">${volverLabel}</a>
        ${Header(curso.nombre, curso.categoria + (curso.obligatorio ? " · Obligatorio" : ""))}

        <div class="curso-detalle-cuerpo ${tema || ""}">
            <div class="section">${renderIntroCurso(curso, lecciones, galeriaCurso ? galeriaCurso[0] : null)}</div>

            ${esVistaPrevia ? `
                <div class="curso-progreso-sticky">
                    <p class="text-sm text-muted">👁 Vista previa — así ve este curso un colaborador. Todas las lecciones están desbloqueadas para que puedas revisarlas todas.</p>
                </div>
            ` : `
                <div class="curso-progreso-sticky">
                    <div class="stat-progress-bar wide"><i style="width:${progreso}%"></i></div>
                    <p class="text-sm text-muted" style="margin-top:8px">${progreso}% completado · ${leccionesVistas}/${lecciones.length} lecciones</p>
                </div>
            `}

            ${examenHtml ? `<div class="section">${examenHtml}</div>` : ""}

            <div class="section leccion-list">${filas}</div>

            ${galeriaHtml}
        </div>

        <div class="carrusel-lightbox" data-carrusel-lightbox hidden>
            <button class="carrusel-lightbox-cerrar" type="button" data-carrusel-lightbox-cerrar aria-label="Cerrar">${Icon("cerrar", { size: 22 })}</button>
            <button class="leccion-carrusel-btn leccion-carrusel-prev" type="button" data-carrusel-lightbox-prev aria-label="Paso anterior">${Icon("flecha-izq", { size: 24 })}</button>
            <img class="carrusel-lightbox-img" data-carrusel-lightbox-img src="" alt="">
            <button class="leccion-carrusel-btn leccion-carrusel-next" type="button" data-carrusel-lightbox-next aria-label="Paso siguiente">${Icon("flecha-der", { size: 24 })}</button>
            <div class="leccion-carrusel-contador"><span data-carrusel-lightbox-contador></span></div>
            <p class="carrusel-lightbox-caption" data-carrusel-lightbox-caption></p>
        </div>
    `;
}

export function bindCursos(params = []) {

    const cursoId = params && params[0];
    if (!cursoId) return;

    // Click en una tarjeta de la galería abre un modal: si el producto
    // tiene varias presentaciones (Alfajores), deja elegir Unidad/x6/
    // x10/etc. sin subir una foto por combinación; siempre tiene un
    // botón para saltar a la lección completa (ver galeriaProductos.js).
    bindGaleriaProductos();

    // Portada fija hasta que el colaborador elige reproducir (ver
    // POSTER_POR_LECCION) — recién ahí se carga el video real
    // (preload="none" en el <video>, nada de tráfico hasta el click).
    document.querySelectorAll("[data-reproducir-video]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const wrap = btn.closest(".leccion-video-wrap");
            const video = wrap?.querySelector("video");
            if (!video) return;
            video.src = video.dataset.src;
            wrap.classList.add("reproduciendo");
            video.play();
            // Antes tenía loop: quedaba dando vueltas para siempre sin
            // forma de pararlo. Ahora termina y vuelve a la portada
            // con el botón de play, como si no se hubiera abierto.
            video.addEventListener("ended", () => wrap.classList.remove("reproduciendo"));
        });
    });

    // Carrusel de video (varios clips reales por lección — ver
    // VIDEOS_MULTIPLES_POR_LECCION/renderVideoCarrusel): un solo
    // <video> que cambia de src/poster al navegar, en vez de precargar
    // todos los clips de una — mismo criterio de "nada de tráfico hasta
    // que el colaborador elige" que ya usa el video simple de arriba.
    document.querySelectorAll("[data-video-carrusel]").forEach((wrap) => {
        const items = JSON.parse(decodeURIComponent(wrap.dataset.videoCarruselItems));
        const videoWrap = wrap.querySelector(".leccion-video-wrap");
        const video = wrap.querySelector("[data-video-carrusel-el]");
        const btnPlay = wrap.querySelector("[data-video-carrusel-play]");
        const btnPrev = wrap.querySelector("[data-video-carrusel-prev]");
        const btnNext = wrap.querySelector("[data-video-carrusel-next]");
        const contador = wrap.querySelector("[data-video-carrusel-contador]");
        const caption = wrap.parentElement.querySelector("[data-video-carrusel-caption]");
        let indice = 0;

        function actualizar() {
            video.pause();
            video.removeAttribute("src");
            video.load();
            video.poster = items[indice].poster || "";
            videoWrap.classList.remove("reproduciendo");
            contador.textContent = `${indice + 1} / ${items.length}`;
            if (caption) caption.textContent = items[indice].caption;
            btnPrev.disabled = indice === 0;
            btnNext.disabled = indice === items.length - 1;
        }

        btnPrev.addEventListener("click", () => {
            if (indice > 0) { indice--; actualizar(); }
        });
        btnNext.addEventListener("click", () => {
            if (indice < items.length - 1) { indice++; actualizar(); }
        });
        btnPlay.addEventListener("click", () => {
            video.src = items[indice].src;
            videoWrap.classList.add("reproduciendo");
            video.play();
            video.addEventListener("ended", () => videoWrap.classList.remove("reproduciendo"), { once: true });
        });
    });

    // Carrusel de capturas navegable a mano — sin autoplay, para que
    // el colaborador pueda leer cada pantalla a su ritmo (ver
    // IMAGENES_POR_LECCION).
    const lightbox = document.querySelector("[data-carrusel-lightbox]");
    const lightboxImg = lightbox?.querySelector("[data-carrusel-lightbox-img]");
    const lightboxContador = lightbox?.querySelector("[data-carrusel-lightbox-contador]");
    const lightboxCaption = lightbox?.querySelector("[data-carrusel-lightbox-caption]");
    let lightboxItems = [];
    let lightboxIndice = 0;

    function actualizarLightbox() {
        if (!lightbox) return;
        const item = lightboxItems[lightboxIndice];
        lightboxImg.src = item.src;
        lightboxContador.textContent = `${lightboxIndice + 1} / ${lightboxItems.length}`;
        if (lightboxCaption) lightboxCaption.textContent = item.caption;
        lightbox.querySelector("[data-carrusel-lightbox-prev]").disabled = lightboxIndice === 0;
        lightbox.querySelector("[data-carrusel-lightbox-next]").disabled = lightboxIndice === lightboxItems.length - 1;
    }

    function abrirLightbox(items, indiceInicial) {
        if (!lightbox) return;
        lightboxItems = items;
        lightboxIndice = indiceInicial;
        lightbox.hidden = false;
        actualizarLightbox();
    }

    lightbox?.querySelector("[data-carrusel-lightbox-cerrar]").addEventListener("click", () => { lightbox.hidden = true; });
    lightbox?.addEventListener("click", (e) => { if (e.target === lightbox) lightbox.hidden = true; });
    lightbox?.querySelector("[data-carrusel-lightbox-prev]").addEventListener("click", () => {
        if (lightboxIndice > 0) { lightboxIndice--; actualizarLightbox(); }
    });
    lightbox?.querySelector("[data-carrusel-lightbox-next]").addEventListener("click", () => {
        if (lightboxIndice < lightboxItems.length - 1) { lightboxIndice++; actualizarLightbox(); }
    });

    document.querySelectorAll("[data-carrusel]").forEach((wrap) => {
        const imgs = Array.from(wrap.querySelectorAll(".leccion-carrusel-img"));
        const items = JSON.parse(decodeURIComponent(wrap.dataset.carruselItems));
        const btnPrev = wrap.querySelector("[data-carrusel-prev]");
        const btnNext = wrap.querySelector("[data-carrusel-next]");
        const btnExpandir = wrap.querySelector("[data-carrusel-expandir]");
        const contador = wrap.querySelector("[data-carrusel-contador]");
        const caption = wrap.parentElement.querySelector("[data-carrusel-caption]");
        let indice = 0;

        function actualizar() {
            imgs.forEach((img, i) => img.classList.toggle("activa", i === indice));
            contador.textContent = `${indice + 1} / ${imgs.length}`;
            if (caption) caption.textContent = items[indice].caption;
            btnPrev.disabled = indice === 0;
            btnNext.disabled = indice === imgs.length - 1;
        }

        btnPrev.addEventListener("click", () => {
            if (indice > 0) { indice--; actualizar(); }
        });
        btnNext.addEventListener("click", () => {
            if (indice < imgs.length - 1) { indice++; actualizar(); }
        });
        btnExpandir.addEventListener("click", () => abrirLightbox(items, indice));
        imgs.forEach((img) => img.addEventListener("click", () => abrirLightbox(items, indice)));
    });

    document.querySelectorAll("[data-video-leccion]").forEach((link) => {
        link.addEventListener("click", () => {
            localStorage.setItem(claveVideoVisto(link.dataset.videoLeccion), "1");
            const item = link.closest(".leccion-item");
            const btnMarcar = item?.querySelector("[data-marcar-vista]");
            if (btnMarcar) btnMarcar.disabled = false;
            item?.querySelector(".aviso-ver-video")?.remove();
        });
    });

    document.querySelectorAll("[data-marcar-vista]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const usuario = getUsuarioActual();
            const [lecciones, asignaciones] = await Promise.all([
                getLeccionesPorCurso(cursoId),
                getAsignacionesPorColaborador(usuario.id),
            ]);
            let asignacion = asignaciones.find((a) => String(a.cursoId) === String(cursoId)) || null;

            const idx = Number(btn.dataset.marcarVista);
            const nuevasVistas = idx + 1;
            const nuevoProgreso = Math.round((nuevasVistas / lecciones.length) * 100);
            const nuevoEstado = nuevoProgreso >= 100 ? "completado" : "en_progreso";

            if (asignacion) {
                await actualizarAsignacion(asignacion.id, { progreso: nuevoProgreso, estado: nuevoEstado });
            } else {
                await crearAsignacion({ colaboradorId: usuario.id, cursoId, estado: nuevoEstado, progreso: nuevoProgreso });
            }
            registrarEvento(usuario.id, "avanzar_leccion", `${usuario.nombre} avanzó en el curso ${cursoId}`);

            navigate(`cursos/${cursoId}`);
        });
    });
}
