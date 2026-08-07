/* ============================
   Lucciano's Academy
   data/productosPasteleria.js — Catálogo de Pastelería

   Datos de presentación (no de negocio, no hay hoja "Pastelería" en
   el backend) — mismo criterio que productosChocolateria.js /
   productosHeladeria.js / productosIcepops.js. Fotos, nombres y
   descripciones extraídas de "Productos de Pastelería 2.6.26.pdf"
   (tortas y pastelería fresca vigentes) + el manual institucional
   (presentación de productos de cocción).

   3 categorías: Tortas (12 minitortas), Pastelería Fresca (4) y
   Cocción (6, medialunas/croissants/rolls/pains).
=============================*/

const BASE = "assets/img/pasteleria/";

function producto({ categoria, nombre, foto, descripcion }) {
    return { categoria, nombre, foto: BASE + foto, descripcion };
}

export const PRODUCTOS_PASTELERIA = [
    // ===== Tortas (mini tortas individuales) =====
    producto({ categoria: "Tortas", nombre: "Red Velvet", foto: "torta_red_velvet.png", descripcion: "Mini torta en capas, suave y húmeda, rellena con crema tipo cheese frosting y decorada con copos cremosos y migas rojas por encima." }),
    producto({ categoria: "Tortas", nombre: "Carrot Cake", foto: "torta_carrot_cake.png", descripcion: "Mini torta de zanahoria en capas, húmeda y suave, rellena con crema tipo cheese frosting y coronada con nuez crocante." }),
    producto({ categoria: "Tortas", nombre: "Mousse de Chocolate", foto: "torta_mousse_chocolate.png", descripcion: "Mini torta de mousse de chocolate, aireada y suave, con base húmeda y cobertura de ganache brillante que intensifica su sabor intenso a cacao." }),
    producto({ categoria: "Tortas", nombre: "Brownie con Dulce de Leche", foto: "torta_rogel.png", descripcion: "Brownie con dulce de leche, decorado con merengue italiano flambeado." }),
    producto({ categoria: "Tortas", nombre: "Rogel", foto: "torta_brownie_ddl.png", descripcion: "Postre con capas de masa crocante intercaladas con dulce de leche, con textura crujiente, decorado con merengue." }),
    producto({ categoria: "Tortas", nombre: "Crumble de Manzana", foto: "torta_crumble_manzana.png", descripcion: "Masa sablée rellena de manzanas con canela, cubierta de un crumble crocante de manteca y azúcar." }),
    producto({ categoria: "Tortas", nombre: "Chocotorta", foto: "torta_chocotorta.png", descripcion: "Crema de dulce de leche y queso crema, intercalada con galletitas embebidas en almíbar de café." }),
    producto({ categoria: "Tortas", nombre: "Oreo Cake", foto: "torta_oreo_cake.png", descripcion: "Base de galletitas molidas con manteca, crema de dulce de leche y queso crema, intercalada con galletitas embebidas en almíbar de café. Decorada con un baño de ganache blanca y galletitas partidas." }),
    producto({ categoria: "Tortas", nombre: "Lemon Pie", foto: "torta_lemon_pie.png", descripcion: "Masa sablée rellena de crema de limón y decorada con merengue italiano flambeado. Decorar con 3 hojas de menta fresca." }),
    producto({ categoria: "Tortas", nombre: "Tiramisú", foto: "torta_cheesecake_frutos_rojos.png", descripcion: "Biscuit embebido con almíbar de café, intercalado con crema queso y cacao amargo. Decorar con vainilla." }),
    producto({ categoria: "Tortas", nombre: "Cheesecake con Salsa de Frutos Rojos", foto: "torta_tiramisu.png", descripcion: "Base de masa sablée, crema de queso y decorada con salsa de frutos rojos. Decorar con 2/3 hojas de menta fresca." }),
    producto({ categoria: "Tortas", nombre: "Torta de Coco", foto: "torta_coco.png", descripcion: "Masa sablée rellena de dulce de leche, cubierta con un crumble de coco crocante. Decorar con coco rallado por encima." }),

    // ===== Pastelería Fresca =====
    producto({ categoria: "Pastelería Fresca", nombre: "Budín de Limón", foto: "budin_limon.png", descripcion: "Budín con semillas de amapola, decorado con un glaseado de jugo de limón." }),
    producto({ categoria: "Pastelería Fresca", nombre: "Budín Marmolado", foto: "budin_marmolado.png", descripcion: "Budín de vainilla y chocolate, decorado con un glaseado de chocolate." }),
    producto({ categoria: "Pastelería Fresca", nombre: "Brownie Húmedo con Nuez", foto: "brownie_humedo_nuez.png", descripcion: "Brownie húmedo con nuez." }),
    producto({ categoria: "Pastelería Fresca", nombre: "Tostadas de Pan Casero", foto: "tostadas_pan_casero.png", descripcion: "Dip de queso crema, mermelada o dulce de leche. 3 unidades (2 con promo)." }),

    // ===== Cocción =====
    producto({ categoria: "Cocción", nombre: "Croissant", foto: "coccion_croissant.png", descripcion: "Croissant clásico de manteca." }),
    producto({ categoria: "Cocción", nombre: "Medialunas", foto: "coccion_medialunas.png", descripcion: "Medialunas de manteca, presentación clásica x2." }),
    producto({ categoria: "Cocción", nombre: "Roll de Frambuesa", foto: "coccion_roll_frambuesa.png", descripcion: "Masa rellena de azúcar, frambuesa y mantequilla." }),
    producto({ categoria: "Cocción", nombre: "Roll de Canela", foto: "coccion_roll_canela.png", descripcion: "Masa rellena de azúcar, canela y mantequilla." }),
    producto({ categoria: "Cocción", nombre: "Pain de Manzana", foto: "coccion_pain_manzana.png", descripcion: "Masa de croissant dulce, con relleno de mermelada de manzana." }),
    producto({ categoria: "Cocción", nombre: "Pain de Chocolate", foto: "coccion_pain_chocolate.png", descripcion: "Masa de croissant dulce, rellena de chocolate en barra." }),
];

export const CATEGORIAS_PASTELERIA = ["Tortas", "Pastelería Fresca", "Cocción"];
