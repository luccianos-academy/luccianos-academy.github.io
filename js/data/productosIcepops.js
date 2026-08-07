/* ============================
   Lucciano's Academy
   data/productosIcepops.js — Catálogo de Icepops

   Datos de presentación (no de negocio, no hay hoja "Icepops" en el
   backend) — mismo criterio que productosChocolateria.js y
   productosHeladeria.js. Fotos, nombres y descripciones extraídos de
   la carta oficial "Hey! Choose your Icepop" (ES, jul-2026) — el
   manual institucional también tiene contenido de Icepops, pero esta
   carta es la versión más actual (incluye Pretzel-equivalentes y los
   2 sabores NEW que el manual no tiene).

   8 categorías: Fruta, Luxury, Cannoli, Dubai (presentación especial
   con lata), Crema, Bañados, Geladot (con presentaciones x18/x32) y
   Mini Icepops (cajas x4).

   Kosher: "parve" (vegano/sin lácteos) o "dairy" (con lácteos), solo
   cuando la carta lo marca explícitamente con el sello AK — no se
   inventa para los que no lo tienen marcado.
=============================*/

const BASE = "assets/img/icepops/";

// Cache-buster: los archivos conservan su nombre entre re-procesados
// de imagen (recortes/normalizado), así que el navegador puede seguir
// sirviendo la versión vieja desde caché. Subir este número cuando se
// regeneren fotos fuerza a todos los clientes a bajar las nuevas.
const V = "?v=2";

function producto({ categorias, nombre, foto, descripcion, kosher, presentaciones }) {
    return { categorias, nombre, foto: foto ? BASE + foto + V : undefined, descripcion, kosher, presentaciones };
}

/** Las 3 presentaciones de Geladot muestran fotos reales: el bombón
 *  suelto, y los 2 potes (Medium/polipapel 360 y Large/polipapel
 *  500) — no la misma foto repetida tres veces. */
function presentacionesGeladot(fotoSabor) {
    return [
        { label: "Unidad", foto: BASE + fotoSabor + V },
        { label: "Medium x18", foto: BASE + "geladot_pote_medium.png" + V },
        { label: "Large x32", foto: BASE + "geladot_pote_large.png" + V },
    ];
}

export const PRODUCTOS_ICEPOPS = [
    // ===== Fruta =====
    producto({ categorias: ["Fruta"], nombre: "Multifruta", foto: "multifruta.png", descripcion: "Icepop elaborado con jugo de limones naturales y decorado con mandarina, frutilla y kiwi.", kosher: "parve" }),
    producto({ categorias: ["Fruta"], nombre: "Frutilla", foto: "frutilla_icepop.png", descripcion: "Icepop elaborado con frutillas frescas de nuestra región.", kosher: "parve" }),
    producto({ categorias: ["Fruta"], nombre: "Mandarina", foto: "mandarina_icepop.png", descripcion: "Icepop refrescante elaborado con mandarinas naturales exprimidas.", kosher: "parve" }),
    producto({ categorias: ["Fruta"], nombre: "Limón", foto: "limon_icepop.png", descripcion: "Icepop elaborado con jugo de limones naturales exprimidos en el momento de la elaboración.", kosher: "parve" }),

    // ===== Luxury =====
    producto({ categorias: ["Luxury"], nombre: "0% Azúcar Agregada Chocolate con Leche", foto: "azucar0_chocolate_leche.png", descripcion: "Icepop sabor de chocolate con leche, con baño de chocolate con leche sin azúcar agregada.", kosher: "dairy" }),
    producto({ categorias: ["Luxury"], nombre: "Jameson Icepop", foto: "jameson_icepop.png", descripcion: "Icepop a base de chocolate Lucciano's relleno de ganache a base de chocolate blanco y el sabor del whisky Jameson. Bañado con una cobertura de chocolate belga al 72%." }),
    producto({ categorias: ["Luxury"], nombre: "Double Chocolate & King", foto: "double_chocolate_king.png", descripcion: "Chocolate blanco veteado con chocolate con leche y avellanas, con doble baño de chocolate blanco y chocolate con leche belga.", kosher: "dairy" }),
    producto({ categorias: ["Luxury"], nombre: "Double Chocolate & Chocolate", foto: "double_chocolate_chocolate.png", descripcion: "Helado de chocolate Lucciano's con doble baño (chocolate blanco y chocolate semiamargo de origen belga).", kosher: "dairy" }),
    producto({ categorias: ["Luxury"], nombre: "Vegan 72%", foto: "vegan_72.png", descripcion: "Sorbete de chocolate al 72% de cacao, con cobertura del mismo chocolate.", kosher: "parve" }),
    producto({ categorias: ["Luxury"], nombre: "Pistacchio", foto: "pistacchio_icepop.png", descripcion: "Icepop elaborado con auténticos pistacchios de primera calidad, bañado con chocolate blanco sabor a pistacchio.", kosher: "dairy" }),
    producto({ categorias: ["Luxury"], nombre: "Cheesecake de Maracuyá", foto: "cheesecake_maracuya.png", descripcion: "Helado de crema de yogurt y mascarpone con maracuyá cubierto de chocolate blanco.", kosher: "dairy" }),
    producto({ categorias: ["Luxury"], nombre: "Enzo Dulce de Leche con Gianduia", foto: "enzo_ddl_gianduia.png", descripcion: "Icepop bañado con chocolate blanco de origen belga, relleno de dulce de leche con corazón de chocolate gianduia. Contiene avellanas." }),
    producto({ categorias: ["Luxury"], nombre: "Tonio (Cookies & Cream)", foto: "tonio_cookies_cream.png", descripcion: "Icepop de chantilly con veteado de cookies y avellanas, con ganache de chocolate, bañado en chocolate blanco. Toda la decoración es elaborada a mano." }),
    producto({ categorias: ["Luxury"], nombre: "Minion", foto: "minion_icepop.png", descripcion: "Icepop sabor king con avellana, bañado con chocolate blanco de origen belga al cuál se le da el clásico color azul y amarillo, decorado artesanalmente." }),
    producto({ categorias: ["Luxury"], nombre: "Icepop Chocotorta", foto: "icepop_chocotorta.png", descripcion: "Helado de dulce de leche con vetas de dulce de leche premium y queso crema, una galletita entera, y bañado en chocolate blanco." }),
    producto({ categorias: ["Luxury"], nombre: "Icepop Flan con DDL & Caramelo", foto: "icepop_flan_ddl_caramelo.png", descripcion: "Flan casero argentino con dulce de leche premium y un irresistible corazón de caramelo, bañado en chocolate blanco.", kosher: "dairy" }),

    // ===== Cannoli =====
    producto({ categorias: ["Cannoli"], nombre: "Pistacchio", foto: "cannoli_pistacchio.png", descripcion: "Oblea rellena de helado de pistacchio, bañada en chocolate blanco sabor pistacchio y trozos de pistacchio." }),
    producto({ categorias: ["Cannoli"], nombre: "Dulce de Leche", foto: "cannoli_dulce_de_leche.png", descripcion: "Oblea rellena de helado de dulce de leche, bañada en chocolate con leche y trozos de maní." }),
    producto({ categorias: ["Cannoli"], nombre: "Dulce de Leche Repostero", foto: "cannoli_dulce_de_leche_repostero.png", descripcion: "Oblea rellena de dulce de leche repostero, bañada en chocolate blanco con coco." }),
    producto({ categorias: ["Cannoli"], nombre: "Gianduia", foto: "cannoli_gianduia.png", descripcion: "Oblea rellena de avella gianduia, bañada en chocolate semiamargo y trozos de avellana." }),
    producto({ categorias: ["Cannoli"], nombre: "Alfajor", foto: "cannoli_alfajor.png", descripcion: "Oblea rellena de helado de alfajor, bañada en chocolate semiamargo." }),
    producto({ categorias: ["Cannoli"], nombre: "Yogurt de Frutilla", foto: "cannoli_yogurt_frutilla.png", descripcion: "Oblea rellena de helado yogurt de frutilla, bañada en chocolate con leche." }),

    // ===== Dubai (presentación especial) =====
    producto({ categorias: ["Dubai"], nombre: "Icepop Dubai", foto: "icepop_dubai.png", descripcion: "Icepop de chocolate belga, relleno de Avella Dubai, con un crocante delicado que emula el Kadyif, y bañado en chocolate semimargo. Presentación Icepop + lata." }),

    // ===== Crema =====
    producto({ categorias: ["Crema"], nombre: "Mascarpone", foto: "mascarpone_icepop.png", descripcion: "Icepop sabor mascarpone italiano, veteado con frutos del bosque de la Patagonia Argentina.", kosher: "dairy" }),
    producto({ categorias: ["Crema"], nombre: "Menta con Chocolate", foto: "menta_chocolate.png", descripcion: "Icepop con sabor a menta italiana, veteado con stracciatella.", kosher: "dairy" }),
    producto({ categorias: ["Crema"], nombre: "Chocolate Lucciano's con Bombón de Avellanas", foto: "chocolate_lucciano_bombon_avellanas_icepop.png", descripcion: "Chocolate belga de la casa, extra amargo, veteado con una crema de chocolate, avellanas crujientes y trozos de obleas." }),
    producto({ categorias: ["Crema"], nombre: "Frutilla con Chantilly", foto: "frutilla_chantilly.png", descripcion: "Icepop sabor frutilla y chantilly, una combinación perfecta de textura y sabor.", kosher: "dairy" }),

    // ===== Bañados =====
    producto({ categorias: ["Bañados"], nombre: "King Bianco", foto: "king_bianco_icepop.png", descripcion: "Icepop sabor avellanas con veteado de avellanas y chocolate blanco, desarrollado en Italia para Lucciano's." }),
    producto({ categorias: ["Bañados"], nombre: "Crema Chantilly", foto: "crema_chantilly.png", descripcion: "Icepop de chantilly, bañado en chocolate semiamargo belga con pequeños trozos de maní caramelizado.", kosher: "dairy" }),
    producto({ categorias: ["Bañados"], nombre: "Dulce de Leche & Crocante", foto: "dulce_leche_crocante.png", descripcion: "Icepop sabor dulce de leche, bañado con chocolate blanco belga y pequeños trozos de maní caramelizado." }),
    producto({ categorias: ["Bañados"], nombre: "Chocolate & Crocante", foto: "chocolate_crocante.png", descripcion: "Icepop de chocolate Lucciano's, bañado en chocolate semiamargo belga con trozos de maní caramelizado.", kosher: "dairy" }),
    producto({ categorias: ["Bañados"], nombre: "Sorbete Patagonia", foto: "sorbete_patagonia_icepop.png", descripcion: "Sorbete de frutos rojos. Mix de arándanos, frutillas, frambuesas y moras de la Patagonia. Bañado con chocolate blanco." }),
    producto({ categorias: ["Bañados"], nombre: "Chocolate Lucciano's con Dulce de Leche", foto: "chocolate_lucciano_dulce_leche.png", descripcion: "Icepop de Chocolate Lucciano's con dulce de leche, coado con chocolate semiamargo.", kosher: "dairy" }),
    producto({ categorias: ["Bañados"], nombre: "Peanut Caramel", foto: "peanut_caramel_icepop.png", descripcion: "Icepop de crema de maní, con veteado de chocolate stracciatella, dulce de leche y trozos de maní salado.", kosher: "dairy" }),
    producto({ categorias: ["Bañados"], nombre: "Dulce de Leche & Cookies", foto: "dulce_leche_cookies.png", descripcion: "Icepop de dulce de leche veteado con dulce de leche, bañado en chocolate con leche y galletitas de chocolate." }),
    producto({ categorias: ["Bañados"], nombre: "Cookies & Cream", foto: "cookies_cream_r4.png", descripcion: "Icepop de chantilly veteado con avella black, bañado en chocolate blanco y galletitas de chocolate." }),
    producto({ categorias: ["Bañados"], nombre: "Oli Chocolate Platino", foto: "oli_chocolate_platino.png", descripcion: "Icepop a base de chocolate semiamargo belga y chocolate con leche, bañado con chocolate con leche, con huellas decoradas con maní caramelizado.", kosher: "dairy" }),
    producto({ categorias: ["Bañados"], nombre: "Oli Dolca", foto: "oli_dolca.png", descripcion: "Icepop sabor bananita dolca, bañado en chocolate semiamargo belga, con las huellas bañadas con chocolate blanco.", kosher: "dairy" }),
    producto({ categorias: ["Bañados"], nombre: "Oli King", foto: "oli_king.png", descripcion: "Icepop sabor king con avellana, bañado en chocolate blanco de origen belga, con las huellas bañadas con stracciatella.", kosher: "dairy" }),
    producto({ categorias: ["Bañados"], nombre: "Vito Crema del Cielo", foto: "vito_crema_cielo.png", descripcion: "Icepop de crema del cielo, bañado en chocolate blanco de origen belga, con detalles de granas multicolores y ojos de chocolate blanco." }),
    producto({ categorias: ["Bañados"], nombre: "Fiore Frutilla a la Crema", foto: "fiore_frutilla_crema.png", descripcion: "Icepop de frutilla a la crema, bañado en chocolate blanco de origen belga, con detalles de granas multicolores y ojos de chocolate blanco." }),
    producto({ categorias: ["Bañados"], nombre: "Chocolate Blanco & Pistacchio Crock", foto: "chocolate_blanco_pistacchio_crock_icepop.png", descripcion: "NUEVO — Icepop de chocolate blanco con un irresistible veteado de Avella Pistacchio, cubierto con chocolate blanco y crocante de pistacchio.", kosher: "dairy" }),

    // ===== Geladot (con presentaciones x18 Medium y x32 Large) =====
    producto({ categorias: ["Geladot"], nombre: "Frutilla", foto: "geladot_frutilla.png", descripcion: "Relleno de helado de sorbete de frutilla, bañado en chocolate con leche.", presentaciones: presentacionesGeladot("geladot_frutilla.png") }),
    producto({ categorias: ["Geladot"], nombre: "King Bianco", foto: "geladot_king_bianco.png", descripcion: "Relleno de helado de crema sabor king bianco, bañado en chocolate blanco.", presentaciones: presentacionesGeladot("geladot_king_bianco.png") }),
    producto({ categorias: ["Geladot"], nombre: "Frambuesa", foto: "geladot_frambuesa.png", descripcion: "Relleno de helado de sorbete de frambuesas, bañado en chocolate con leche.", presentaciones: presentacionesGeladot("geladot_frambuesa.png") }),
    producto({ categorias: ["Geladot"], nombre: "Chocolate Dark 72%", foto: "geladot_dark_72.png", descripcion: "Relleno de helado de sorbete de chocolate dark 72%, bañado en chocolate dark.", presentaciones: presentacionesGeladot("geladot_dark_72.png"), kosher: "parve" }),
    producto({ categorias: ["Geladot"], nombre: "Pistacchio", foto: "geladot_pistacchio.png", descripcion: "Relleno de helado de pistacchio, bañado en chocolate blanco con sabor a pistacchio.", presentaciones: presentacionesGeladot("geladot_pistacchio.png"), kosher: "dairy" }),
    producto({ categorias: ["Geladot"], nombre: "Sambayón", foto: "geladot_sambayon.png", descripcion: "Relleno de helado de sambayón, bañado en chocolate semiamargo.", presentaciones: presentacionesGeladot("geladot_sambayon.png") }),
    producto({ categorias: ["Geladot"], nombre: "Dulce de Leche", foto: "geladot_dulce_de_leche.png", descripcion: "Relleno de helado de dulce de leche, bañado en chocolate con leche.", presentaciones: presentacionesGeladot("geladot_dulce_de_leche.png") }),
    producto({ categorias: ["Geladot"], nombre: "Gianduia", foto: "geladot_gianduia.png", descripcion: "Relleno de helado sabor gianduia, bañado en chocolate semiamargo.", presentaciones: presentacionesGeladot("geladot_gianduia.png"), kosher: "dairy" }),

    // ===== Mini Icepops (caja x4) =====
    producto({ categorias: ["Mini Icepops"], nombre: "Mini Avellanas & Chocolate", foto: "mini_avellanas_chocolate.png", descripcion: "Mini icepops de avellana cubiertos con chocolate con leche y crocante de avellanas.", kosher: "dairy" }),
    producto({ categorias: ["Mini Icepops"], nombre: "Mini Chocolate", foto: "mini_chocolate.png", descripcion: "Mini icepops de chocolate, bañados en chocolate semiamargo y crocante de maní.", kosher: "dairy" }),
    producto({ categorias: ["Mini Icepops"], nombre: "Mini Dulce de Leche", foto: "mini_dulce_de_leche.png", descripcion: "Mini icepops de dulce de leche cubiertos con chocolate blanco y crocante de maní." }),
    producto({ categorias: ["Mini Icepops"], nombre: "Mini Dulce de Leche & Cookies", foto: "mini_dulce_de_leche_cookies.png", descripcion: "Mini icepops de dulce de leche veteado con dulce de leche, bañados con chocolate con leche y galletitas de chocolate." }),
    producto({ categorias: ["Mini Icepops"], nombre: "Mini Cookies & Cream", foto: "mini_cookies_cream.png", descripcion: "Mini icepops de chantilly veteado con avella black, bañados en chocolate blanco y galletitas de chocolate." }),
    producto({ categorias: ["Mini Icepops"], nombre: "Mini Pistacchio", foto: "mini_pistacchio.png", descripcion: "Mini icepops de pistacchio bañados en chocolate blanco sabor pistacchio y crocante de pistacchio.", kosher: "dairy" }),
    producto({ categorias: ["Mini Icepops"], nombre: "Mini Chocolate Blanco & Pistacchio Crock", foto: "mini_chocolate_blanco_pistacchio_crock.png", descripcion: "NUEVO — Mini icepop de chocolate blanco con un irresistible veteado de Avella Pistacchio, cubierto con chocolate blanco y crocante de pistacchio.", kosher: "dairy" }),
];

export const CATEGORIAS_ICEPOPS = ["Fruta", "Crema", "Bañados", "Luxury", "Dubai", "Mini Icepops", "Cannoli", "Geladot"];
