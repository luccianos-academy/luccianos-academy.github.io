/* ============================
   Lucciano's Academy
   data/productosHeladeria.js — Catálogo de sabores de Heladería

   Datos de presentación (no de negocio, no hay hoja "Sabores" en el
   backend) — mismo criterio que productosChocolateria.js. Fotos,
   nombres y descripciones extraídos del manual institucional 2026
   (páginas 9-15) y del cartel "Hey! Choose your Gelato" (más actual
   — de ahí sale Pretzel, que no estaba en el manual).

   Categorías tipo "página oficial": Chocolates / Dulce de Leche /
   Cremas / Frutales-Vegan, más Gluten Free y Batidos como secciones
   propias (no como "presentación" anidada de otro sabor). Un
   producto puede pertenecer a más de una categoría (ej. Sorbete
   Dark 72% es Chocolates Y Frutales/Vegan) — por eso "categorias"
   es un array, no un string.

   Kosher: "parve" (vegano/sin lácteos) o "dairy" (con lácteos), solo
   cuando el cartel oficial lo marca explícitamente — no se inventa
   para los sabores que el cartel no certifica.
=============================*/

const BASE = "assets/img/heladeria/";

function producto({ categorias, nombre, foto, descripcion, kosher }) {
    return { categorias, nombre, foto: BASE + foto, descripcion, kosher };
}

export const PRODUCTOS_HELADERIA = [
    // ===== Chocolates =====
    producto({ categorias: ["Chocolates"], nombre: "Chocolate Lucciano's", foto: "chocolate_lucciano.png", descripcion: "El chocolate de la casa: Chocolate amargo de origen belga al 72%.", kosher: "dairy" }),
    producto({ categorias: ["Chocolates"], nombre: "Chocolate Platino", foto: "chocolate_platino.png", descripcion: "Elaborado a base de chocolate con leche al 39% y chocolate semiamargo al 56%, ambos de origen belga, con mousse de chocolate.", kosher: "dairy" }),
    producto({ categorias: ["Chocolates"], nombre: "Chocolate Lucciano's c/ Bombón de Avellanas", foto: "chocolate_lucciano_bombon_avellanas.png", descripcion: "Chocolate Lucciano's con relleno de chocolate y avellanas, desarrollado exclusivamente en Italia para Lucciano's." }),
    producto({ categorias: ["Chocolates"], nombre: "Chocolate Dubai", foto: "chocolate_dubai.png", descripcion: "Helado de chocolate belga con layers de variegato que emula la combinación de pistacchio y Kadayif, inspirado en el famoso Chocolate Dubai." }),

    // ===== Dulce de Leche =====
    producto({ categorias: ["Dulce de Leche"], nombre: "Alfajor Lucciano's", foto: "alfajor_lucciano.png", descripcion: "Disfrutá del clásico sabor marplatense con este helado de alfajor relleno de dulce de leche y cubierto con chocolate semiamargo de origen belga." }),
    producto({ categorias: ["Dulce de Leche"], nombre: "Alfajor Lucciano's Blanco & Nuez", foto: "alfajor_blanco_nuez.png", descripcion: "Helado de dulce de leche, combinado con auténtico alfajor, granizado con chocolate blanco belga y veteado con dulce de leche y trozos de nuestro exquisito alfajor de chocolate blanco con nuez." }),
    producto({ categorias: ["Dulce de Leche"], nombre: "Chocotorta", foto: "chocotorta.png", descripcion: "Inspirado en el clásico postre argentino: helado de dulce de leche con vetas de dulce de leche Premium, queso crema y galletas bañadas en chocolate semiamargo." }),
    producto({ categorias: ["Dulce de Leche"], nombre: "Dulce de Leche c/ Bombón de Avellanas", foto: "dulce_de_leche_bombon_avellanas.png", descripcion: "Helado de dulce de leche con pasta del tradicional bombón y agregándole nuestro exclusivo veteado de chocolate y avellanas." }),
    producto({ categorias: ["Dulce de Leche"], nombre: "Dulce de Leche c/ Brownie", foto: "dulce_de_leche_brownie.png", descripcion: "Helado de crema a base de dulce de leche Premium Argentino, veteado con trozos de brownie exclusivo de Lucciano's." }),
    producto({ categorias: ["Dulce de Leche"], nombre: "Dulce de Leche", foto: "dulce_de_leche.png", descripcion: "Helado de crema a base de dulce de leche Premium Argentino." }),
    producto({ categorias: ["Dulce de Leche"], nombre: "Dulce de Leche c/ Dulce de Leche", foto: "dulce_de_leche_dulce_de_leche.png", descripcion: "Helado de crema a base de dulce de leche Premium Argentino, veteado con dulce de leche exclusivo de Lucciano's." }),
    producto({ categorias: ["Dulce de Leche"], nombre: "Dulce de Leche Granizado", foto: "dulce_de_leche_granizado.png", descripcion: "Helado de crema a base de dulce de leche Premium granizado con Stracciatella Italiana semiamarga." }),

    // ===== Frutales/Vegan =====
    producto({ categorias: ["Frutales/Vegan"], nombre: "Frutilla", foto: "frutilla.png", descripcion: "Helado elaborado con frutillas frescas de nuestra región.", kosher: "parve" }),
    producto({ categorias: ["Frutales/Vegan"], nombre: "Mango Alphonso", foto: "mango_alphonso.png", descripcion: "Elaborado con auténtico Mango Alphonso, conocido como la joya de los mangos por su suavidad y aroma intenso. Un helado fresco y natural, con un sabor equilibrado y lleno de carácter.", kosher: "parve" }),
    producto({ categorias: ["Frutales/Vegan"], nombre: "Frutilla & Naranja", foto: "frutilla_naranja.png", descripcion: "A las frutillas frescas de nuestra región le agregamos unas deliciosas naranjas exprimidas.", kosher: "parve" }),
    producto({ categorias: ["Frutales/Vegan"], nombre: "Limón", foto: "limon.png", descripcion: "Helado a base de jugo de limones naturales exprimidos en el momento de la elaboración.", kosher: "parve" }),
    producto({ categorias: ["Frutales/Vegan"], nombre: "Mandarina", foto: "mandarina.png", descripcion: "Helado elaborado con mandarinas naturales, exprimidas en nuestra fábrica.", kosher: "parve" }),
    producto({ categorias: ["Frutales/Vegan"], nombre: "Patagonia (Sorbete de Frutos Rojos)", foto: "patagonia_sorbete_frutos_rojos.png", descripcion: "Sorbete de frutos rojos. Mix de frutillas, arándanos, frambuesas y moras de la Patagonia.", kosher: "parve" }),
    producto({ categorias: ["Frutales/Vegan"], nombre: "Pomelo Rosado", foto: "pomelo.png", descripcion: "Helado refrescante de pomelos del norte argentino combinados con una receta con el toque justo de acidez.", kosher: "parve" }),
    producto({ categorias: ["Frutales/Vegan"], nombre: "Vasubeda", foto: "vasubeda.png", descripcion: "Sabor fresco y liviano con base de helado de limón natural, albahaca fresca y jugo de naranjas naturales.", kosher: "parve" }),
    // Estos dos no son frutales — se agrupan juntos, separados del resto, porque comparten la etiqueta "vegano" sin ser sabores de fruta.
    producto({ categorias: ["Frutales/Vegan"], nombre: "Pistacchio Vegan", foto: "pistacchio_vegan.png", descripcion: "Sorbete elaborado con auténticos pistacchios de primera calidad.", kosher: "parve" }),
    producto({ categorias: ["Chocolates", "Frutales/Vegan"], nombre: "Sorbete Dark 72%", foto: "sorbete_dark_72.png", descripcion: "Sorbete vegano de chocolate intenso, de origen belga.", kosher: "parve" }),

    // ===== Cremas (resto de sabores) =====
    producto({ categorias: ["Cremas"], nombre: "Chantilly", foto: "chantilly.png", descripcion: "Helado cremoso sabor a Chantilly.", kosher: "dairy" }),
    producto({ categorias: ["Cremas"], nombre: "Coco Rock", foto: "coco_rock.png", descripcion: "Inigualable helado a base de coco de Malasia, veteado con chocolate blanco, obleas crujientes y coco rallado." }),
    producto({ categorias: ["Cremas"], nombre: "Cookies & Cream", foto: "cookies_cream.png", descripcion: "Helado a base de crema chantilly sembrado con un veteado de cookies desarrollado en Italia por Lucciano's.", kosher: undefined }),
    producto({ categorias: ["Cremas"], nombre: "Frutilla a la Crema", foto: "frutilla_crema.png", descripcion: "Helado de crema de frutillas, elaborado con frutillas frescas de la región." }),
    producto({ categorias: ["Cremas"], nombre: "Frambuesas a la Crema con Avella Bianca", foto: "frambuesa_crema_avella_bianca.png", descripcion: "Helado de frambuesas frescas a la crema con veteado de Avella Bianca.", kosher: "dairy" }),
    producto({ categorias: ["Cremas"], nombre: "Chocolate Blanco + Avella Latte", foto: "chocolate_blanco_avella_latte.png", descripcion: "Helado cremoso de chocolate blanco con veteado de Avella Latte.", kosher: "dairy" }),
    producto({ categorias: ["Cremas"], nombre: "King Bianco", foto: "king_bianco.png", descripcion: "Helado a base de avellanas con un veteado de avellanas y chocolate con leche, desarrollado exclusivamente en Italia para Lucciano's." }),
    producto({ categorias: ["Cremas"], nombre: "King Nero", foto: "king_nero.png", descripcion: "Helado a base de avellanas con veteado de avellanas y chocolate semiamargo, con obleas desarrolladas exclusivamente en Italia para Lucciano's." }),
    producto({ categorias: ["Cremas"], nombre: "Mascarpone c/ Frutos del Bosque", foto: "mascarpone_frutos_del_bosque.png", descripcion: "Receta exclusiva elaborada en Italia para Lucciano's, con queso mascarpone combinado con un veteado de frutos del bosque de la Patagonia Argentina.", kosher: "dairy" }),
    producto({ categorias: ["Cremas"], nombre: "Menta Granizada", foto: "menta_granizada.png", descripcion: "Receta original elaborada en Italia para Lucciano's en base a menta fresca cosechada en Europa y trozos de chocolate semiamargo.", kosher: "dairy" }),
    producto({ categorias: ["Cremas"], nombre: "Mousse de Maracuyá", foto: "mousse_maracuya.png", descripcion: "Helado inspirado en la receta de la mousse francesa liviana y aireada con maracuyá natural amazónica." }),
    producto({ categorias: ["Cremas"], nombre: "Peanut & Caramel", foto: "peanut_caramel.png", descripcion: "Helado de crema de maní, con veteado de chocolate stracciatella, dulce de leche y trozos de maní salado.", kosher: "dairy" }),
    producto({ categorias: ["Cremas"], nombre: "Super Sambayón", foto: "super_sambayon.png", descripcion: "Crema helada elaborada con yema de huevo, azúcar y vino." }),
    producto({ categorias: ["Cremas"], nombre: "Banana Split", foto: "banana_split.png", descripcion: "Elaborado con banana fresca veteado con chocolate Italiano y dulce de leche.", kosher: "dairy" }),
    producto({ categorias: ["Cremas"], nombre: "Tiramisú", foto: "tiramisu.png", descripcion: "Inspirado en el clásico postre Italiano con queso mascarpone de textura super cremosa. Contiene cacao en polvo italiano y deliciosos trozos de bizcocho de vainilla bañados en almíbar de licor de café y café colombiano." }),
    producto({ categorias: ["Cremas"], nombre: "Vainilla", foto: "vainilla.png", descripcion: "Helado cremoso sabor vainilla." }),
    producto({ categorias: ["Cremas"], nombre: "Tramontana", foto: "tramontana.png", descripcion: "Uno de los clásicos sabores llevado a los más altos estándares de calidad. Con base de Chantilly, con dulce de leche, caramelo y microgalletitas bañadas en chocolate." }),
    producto({ categorias: ["Cremas"], nombre: "Lemon Pie", foto: "lemon_pie.png", descripcion: "Transformamos la famosa receta en un increíble helado en su homenaje." }),
    producto({ categorias: ["Cremas"], nombre: "Súper Gianduiotto", foto: "super_gianduiotto.png", descripcion: "Disfrutá de un pedacito del Piamonte Italiano. Inspirado en la clásica gianduia italiana, este delicado helado fusiona la riqueza del chocolate con irresistibles avellanas enteras.", kosher: "dairy" }),
    producto({ categorias: ["Cremas"], nombre: "Pistacchio", foto: "pistacchio.png", descripcion: "Nuestro best-seller: helado cremoso elaborado con auténticos pistacchios de primera calidad.", kosher: "dairy" }),
    producto({ categorias: ["Cremas"], nombre: "Cheesecake al Pistacchio", foto: "cheesecake_pistacchio.png", descripcion: "Un irresistible helado de Cheesecake con un delicioso veteado de Avella Pistacchio y un toque crocante de Crumble de Pistacchio.", kosher: "dairy" }),
    producto({ categorias: ["Cremas"], nombre: "Alfajor Pistacchio", foto: "alfajor_pistacchio.png", descripcion: "Inspirado en el alfajor más exitoso del año, llega un nuevo helado a base de alfajor de pistacchio, con un delicioso veteado de dulce de leche y Avella Pistacchio, y trozos de nuestro exclusivo alfajor pistacchio." }),
    producto({ categorias: ["Cremas"], nombre: "Chocolate Blanco & Pistacchio Crock", foto: "chocolate_blanco_pistacchio_crock.png", descripcion: "Helado de chocolate blanco con veteado de avella pistacchio con garapiñada de pistacchios caramelizados.", kosher: "dairy" }),
    producto({ categorias: ["Cremas"], nombre: "Pretzel", foto: "pretzel.png", descripcion: "El clásico pretzel alemán, ahora en versión helado: una base cremosa con notas de caramelo, trozos crocantes de pretzel y un toque de sal que lo hace único. El balance perfecto entre lo dulce y lo salado." }),
    producto({ categorias: ["Cremas"], nombre: "Tiramisú al Pistacchio", foto: "tiramisu_pistacho.png", descripcion: "Helado inspirado en el clásico tiramisú italiano, con cacao, vainillas embebidas en almíbar de café y licor de café, combinado con capas de Avella Pistacchio que aportan un giro al sabor tradicional." }),

    // ===== Gluten Free (presentación en pote individual 190g, sección propia) =====
    producto({ categorias: ["Gluten Free"], nombre: "Chocolate Lucciano's (Gluten Free)", foto: "gf_chocolate_lucciano.png", descripcion: "Pote individual de 190g, apto para celíacos.", kosher: "dairy" }),
    producto({ categorias: ["Gluten Free"], nombre: "Cookies & Cream (Gluten Free)", foto: "gf_cookies_cream.png", descripcion: "Pote individual de 190g, apto para celíacos." }),
    producto({ categorias: ["Gluten Free"], nombre: "Dulce de Leche c/ Dulce de Leche (Gluten Free)", foto: "gf_dulce_de_leche.png", descripcion: "Pote individual de 190g, apto para celíacos." }),
    producto({ categorias: ["Gluten Free"], nombre: "Chocolate Blanco + Avella Latte (Gluten Free)", foto: "gf_chocolate_blanco_avella_latte.png", descripcion: "Pote individual de 190g, apto para celíacos.", kosher: "dairy" }),
    producto({ categorias: ["Gluten Free"], nombre: "Mascarpone c/ Frutos del Bosque (Gluten Free)", foto: "gf_mascarpone_frutos_del_bosque.png", descripcion: "Pote individual de 190g, apto para celíacos.", kosher: "dairy" }),
    producto({ categorias: ["Gluten Free"], nombre: "Sorbete Frutos Rojos (Gluten Free)", foto: "gf_sorbete_frutos_rojos.png", descripcion: "Pote individual de 190g, apto para celíacos.", kosher: "parve" }),
    producto({ categorias: ["Gluten Free"], nombre: "Sorbete Dark 72% (Gluten Free)", foto: "gf_sorbete_dark_72.png", descripcion: "Pote individual de 190g, apto para celíacos.", kosher: "parve" }),
    producto({ categorias: ["Gluten Free"], nombre: "Pistacchio (Gluten Free)", foto: "gf_pistacchio.png", descripcion: "Pote individual de 190g, apto para celíacos.", kosher: "dairy" }),

    // ===== Batidos (preparaciones, sección propia) =====
    producto({ categorias: ["Batidos"], nombre: "Smoothie", foto: "smoothie.png", descripcion: "2 bochas de helados frutales a elección del cliente (160g) + 200ml de soda fría. Licuar hasta lograr un smoothie suave. Servir con tapa y sorbete." }),
    producto({ categorias: ["Batidos"], nombre: "Milk Shake", foto: "milkshake.png", descripcion: "2 bochas de helado a elección (160g) + 200ml de leche fría. Decorar el interior del vaso con salsa antes de servir, licuar y volcar suavemente. Terminar con círculos de crema, cacao en polvo o salsa. Tapa y sorbete." }),
    producto({ categorias: ["Batidos"], nombre: "Gelato Shake Cookies & Cream", foto: "gelatoshake_cookies_cream.png", descripcion: "2 bochas de helado de Cookies & Cream (160g) + 100ml de leche fría + 1 espresso (cápsula Ristretto). Licuar y servir en vaso de Nespresso con collarín. Crema y decoración de cookies, con sorbete." }),
    producto({ categorias: ["Batidos"], nombre: "Gelato Shake Dulce de Leche", foto: "gelatoshake_dulce_de_leche.png", descripcion: "2 bochas de helado Dulce de Leche c/ Dulce de Leche (160g) + 100ml de leche fría + 1 espresso (cápsula Ristretto). Licuar y servir en vaso de Nespresso con collarín. Crema y decoración de salsa de dulce de leche, con sorbete." }),
    producto({ categorias: ["Batidos"], nombre: "Gelato Shake Tiramisú", foto: "gelatoshake_tiramisu.png", descripcion: "2 bochas de helado de Tiramisú (160g) + 100ml de leche fría + 1 ristretto de café. Licuar y servir en vaso de Nespresso con collarín. Crema y decoración con cacao en polvo, con sorbete." }),
];

export const CATEGORIAS_HELADERIA = ["Chocolates", "Dulce de Leche", "Cremas", "Frutales/Vegan", "Gluten Free", "Batidos"];
