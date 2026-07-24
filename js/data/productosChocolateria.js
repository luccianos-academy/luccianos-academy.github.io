/* ============================
   FARO v4
   data/productosChocolateria.js — Galería de productos de Chocolatería

   Contenido presentacional, curado a mano (fotos reales + nombres) —
   no viene de Sheets, no hay una hoja "Productos" en el esquema. Es
   el mismo criterio que noticiasMock: datos de presentación, no de
   negocio, no vale la pena sumar infraestructura nueva para esto.

   Sirve para la galería estilo "página oficial" que se muestra arriba
   de las lecciones del curso Chocolatería (ver pages/cursos.js). La
   composición de cada producto/presentación (qué trae una caja
   surtida, una lata, un pack) vive ACÁ, junto al producto — así la
   lección de abajo queda solo para manipulación y conservación.

   Alfajores es la única categoría con varias fotos por sabor (una por
   presentación — Unidad/x6/x10/Lata x5/Surtido) — ahí "presentaciones"
   es una lista de { label, foto, descripcion? } para que la tarjeta
   sea un mini selector (tocás un tamaño y cambian la foto y la
   descripción). Si la presentación no tiene descripción propia (ej.
   caja del mismo sabor), se muestra la general del producto.
*/

// Composición de las presentaciones surtidas de Alfajores — es la
// misma para todos los sabores (la caja es fija), por eso viven acá
// una sola vez y se reusan en cada sabor.
const SURTIDO_X6 = "Caja surtida x6: 2 Semiamargo, 2 Blanco, 1 Dark y 1 Blanco & Nuez.";
const SURTIDO_X10 = "Caja surtida x10: 3 Semiamargo, 3 Blanco, 2 Dark y 2 Blanco & Nuez.";
const LATA_SURTIDA_X5 = "Lata surtida x5: 1 Semiamargo, 1 Blanco, 1 Dark, 1 Blanco & Nuez y 1 Pink.";
const MINI_SURTIDO_X12 = "12 mini alfajores de 40g c/u: 3 Semiamargo, 3 Blanco, 3 Dark y 3 Blanco & Nuez.";

export const PRODUCTOS_CHOCOLATERIA = [
    // Alfajores — selector de presentación (Unidad/x6/x10/Lata x5/Surtido) por sabor
    {
        categoria: "Alfajores", nombre: "Semiamargo",
        descripcion: "Alfajor de 80g relleno de dulce de leche, cubierto con chocolate semiamargo. Vida útil: 70 días.",
        presentaciones: [
            { label: "Unidad", foto: "assets/img/chocolateria/alfajor_semiamargo.png" },
            { label: "x6", foto: "https://lh3.googleusercontent.com/d/1KHtOyKN0ze-PJySjgj0GNuE2w5CE2E-F", descripcion: "Caja x6 del mismo sabor (6 Semiamargo)." },
            { label: "x10", foto: "https://lh3.googleusercontent.com/d/1gAPBybZ-hUlyYxgGZwwTloVh16fydDGV", descripcion: "Caja x10 del mismo sabor (10 Semiamargo)." },
            { label: "Lata x5", foto: "https://lh3.googleusercontent.com/d/1h_YsN1r2SJJzeWE2blIufAVSla4qZ-7P", descripcion: "Lata x5 del mismo sabor (5 Semiamargo)." },
            { label: "Lata Surtida x5", foto: "https://lh3.googleusercontent.com/d/1zfjLRdvNGdJSuU2wnaDw2yepz95Om2R_", descripcion: LATA_SURTIDA_X5 },
            { label: "Surtido x6", foto: "https://lh3.googleusercontent.com/d/1jjP6Rg_2esUcQUIAOMacbwiycWfvOMej", descripcion: SURTIDO_X6 },
            { label: "Surtido x10", foto: "https://lh3.googleusercontent.com/d/1KT-vTva2I7WYZKmEQBG-SllWx8MsibQS", descripcion: SURTIDO_X10 },
            { label: "Mini Surtido x12", foto: "https://lh3.googleusercontent.com/d/1XsJf_dOe6IAmnrN2pSXwqEium0SBBS9C", descripcion: MINI_SURTIDO_X12 },
        ],
    },
    {
        categoria: "Alfajores", nombre: "Blanco",
        descripcion: "Alfajor de 80g relleno de dulce de leche, cubierto con chocolate blanco. Vida útil: 70 días.",
        presentaciones: [
            { label: "Unidad", foto: "assets/img/chocolateria/alfajor_blanco.png" },
            { label: "x6", foto: "https://lh3.googleusercontent.com/d/11g9QBGNgetoiXdFvaeh_VWZ1fa7dhKcM", descripcion: "Caja x6 del mismo sabor (6 Blanco)." },
            { label: "x10", foto: "https://lh3.googleusercontent.com/d/1gadjDXaj_8UT5-r8_7xXv5gqZE_9msOB", descripcion: "Caja x10 del mismo sabor (10 Blanco)." },
            { label: "Lata x5", foto: "https://lh3.googleusercontent.com/d/1CXVQAkD6yBNkvUOMkUAjARxJGfeLScGX", descripcion: "Lata x5 del mismo sabor (5 Blanco)." },
            { label: "Lata Surtida x5", foto: "https://lh3.googleusercontent.com/d/1zfjLRdvNGdJSuU2wnaDw2yepz95Om2R_", descripcion: LATA_SURTIDA_X5 },
            { label: "Surtido x6", foto: "https://lh3.googleusercontent.com/d/1jjP6Rg_2esUcQUIAOMacbwiycWfvOMej", descripcion: SURTIDO_X6 },
            { label: "Surtido x10", foto: "https://lh3.googleusercontent.com/d/1KT-vTva2I7WYZKmEQBG-SllWx8MsibQS", descripcion: SURTIDO_X10 },
            { label: "Mini Surtido x12", foto: "https://lh3.googleusercontent.com/d/1XsJf_dOe6IAmnrN2pSXwqEium0SBBS9C", descripcion: MINI_SURTIDO_X12 },
        ],
    },
    {
        categoria: "Alfajores", nombre: "Dark",
        descripcion: "Alfajor de 80g relleno de dulce de leche, cubierto con chocolate amargo 70%. Vida útil: 70 días.",
        presentaciones: [
            { label: "Unidad", foto: "assets/img/chocolateria/alfajor_dark.png" },
            { label: "x6", foto: "https://lh3.googleusercontent.com/d/13MSWDVg4t9LOF0J5wlcE_2zUWjN5eg1S", descripcion: "Caja x6 del mismo sabor (6 Dark)." },
            { label: "x10", foto: "https://lh3.googleusercontent.com/d/1LyGzsW03a7Oda_AruWHh0B1YA2Ovdn9f", descripcion: "Caja x10 del mismo sabor (10 Dark)." },
            { label: "Lata x5", foto: "https://lh3.googleusercontent.com/d/1xDq945gFTvaXUbfeJPaalza_03BEG7BA", descripcion: "Lata x5 del mismo sabor (5 Dark)." },
            { label: "Lata Surtida x5", foto: "https://lh3.googleusercontent.com/d/1zfjLRdvNGdJSuU2wnaDw2yepz95Om2R_", descripcion: LATA_SURTIDA_X5 },
            { label: "Surtido x6", foto: "https://lh3.googleusercontent.com/d/1jjP6Rg_2esUcQUIAOMacbwiycWfvOMej", descripcion: SURTIDO_X6 },
            { label: "Surtido x10", foto: "https://lh3.googleusercontent.com/d/1KT-vTva2I7WYZKmEQBG-SllWx8MsibQS", descripcion: SURTIDO_X10 },
            { label: "Mini Surtido x12", foto: "https://lh3.googleusercontent.com/d/1XsJf_dOe6IAmnrN2pSXwqEium0SBBS9C", descripcion: MINI_SURTIDO_X12 },
        ],
    },
    {
        categoria: "Alfajores", nombre: "Blanco & Nuez",
        descripcion: "Alfajor de 80g relleno de dulce de leche y nueces, cubierto con chocolate blanco. Vida útil: 70 días.",
        presentaciones: [
            { label: "Unidad", foto: "assets/img/chocolateria/alfajor_blanco_y_nuez.png" },
            { label: "x6", foto: "https://lh3.googleusercontent.com/d/1UGtI5akHW-TaTYILN9lwUDg-Z33j9TKX", descripcion: "Caja x6 del mismo sabor (6 Blanco & Nuez)." },
            { label: "x10", foto: "https://lh3.googleusercontent.com/d/1jM3vh35-Oq1MQOSmZ4rfoNrOi_WqgwRj", descripcion: "Caja x10 del mismo sabor (10 Blanco & Nuez)." },
            { label: "Lata x5", foto: "https://lh3.googleusercontent.com/d/1TBOZgR0nRZcDvRJ486Sxcj6HrtjsF6A9", descripcion: "Lata x5 del mismo sabor (5 Blanco & Nuez)." },
            { label: "Lata Surtida x5", foto: "https://lh3.googleusercontent.com/d/1zfjLRdvNGdJSuU2wnaDw2yepz95Om2R_", descripcion: LATA_SURTIDA_X5 },
            { label: "Surtido x6", foto: "https://lh3.googleusercontent.com/d/1jjP6Rg_2esUcQUIAOMacbwiycWfvOMej", descripcion: SURTIDO_X6 },
            { label: "Surtido x10", foto: "https://lh3.googleusercontent.com/d/1KT-vTva2I7WYZKmEQBG-SllWx8MsibQS", descripcion: SURTIDO_X10 },
            { label: "Mini Surtido x12", foto: "https://lh3.googleusercontent.com/d/1XsJf_dOe6IAmnrN2pSXwqEium0SBBS9C", descripcion: MINI_SURTIDO_X12 },
        ],
    },
    {
        categoria: "Alfajores", nombre: "Pistacchio",
        descripcion: "Alfajor relleno de dulce de leche con corazón de Avella Pistacchio y cobertura de chocolate belga sabor pistacchio. Vida útil: 60 días.",
        presentaciones: [
            { label: "Unidad", foto: "assets/img/chocolateria/alfajor_pistacchio.png" },
            { label: "x6", foto: "https://lh3.googleusercontent.com/d/103WlW5KBY_mfkZkbE3B4-qNAJ0Y0Miyc", descripcion: "Caja x6 del mismo sabor (6 Pistacchio)." },
            { label: "x10", foto: "https://lh3.googleusercontent.com/d/1YVW_L2opye7NY8u2GD4BdyzADNSnYpeQ", descripcion: "Caja x10 del mismo sabor (10 Pistacchio)." },
            { label: "Lata x5", foto: "https://lh3.googleusercontent.com/d/1U3rC2TbUcxDnYZGW4x36wz09YDf66l67", descripcion: "Lata x5 del mismo sabor (5 Pistacchio)." },
            { label: "Mini x12", foto: "https://lh3.googleusercontent.com/d/11P6NPMjvet4DUsxE5LHo0Q2RhH_ABnqH", descripcion: "12 mini alfajores Pistacchio de 40g c/u, rellenos de dulce de leche con corazón de Avella Pistacchio, cobertura de chocolate belga sabor pistacchio y trocitos de pistacchio caramelizado." },
        ],
    },
    {
        categoria: "Alfajores", nombre: "Frutos Rojos",
        descripcion: "Alfajor de 80g relleno de dulce de leche, con cobertura sabor frutos rojos. Vida útil: 60 días.",
        presentaciones: [
            { label: "Unidad", foto: "assets/img/chocolateria/alfajor_frutos_rojos.png" },
            { label: "x6", foto: "https://lh3.googleusercontent.com/d/1AnbqGbUhNv6Y04ClJeYYuSsAWdT60gBy", descripcion: "Caja x6 del mismo sabor (6 Frutos Rojos)." },
            { label: "x10", foto: "https://lh3.googleusercontent.com/d/1fk3k6RQQdtOZh3whdl3i5_DK261QNe-J", descripcion: "Caja x10 del mismo sabor (10 Frutos Rojos)." },
            { label: "Lata x5", foto: "https://lh3.googleusercontent.com/d/1Tf94s5RbehLc7wUy0ZSNtU7sBD-0vkNK", descripcion: "Lata x5 del mismo sabor (5 Frutos Rojos)." },
            { label: "Lata Surtida x5", foto: "https://lh3.googleusercontent.com/d/1zfjLRdvNGdJSuU2wnaDw2yepz95Om2R_", descripcion: LATA_SURTIDA_X5 },
        ],
    },

    // Conitos
    { categoria: "Conitos", nombre: "Semiamargo", foto: "https://lh3.googleusercontent.com/d/1yBNZV8aq7JT1XXV0f4jbaUOFBRiUp1oT", descripcion: "Conito relleno de dulce de leche, cubierto con chocolate semiamargo. Vida útil: 60 días." },
    { categoria: "Conitos", nombre: "Blanco", foto: "https://lh3.googleusercontent.com/d/14mguQoJPX9GUeLTBpjkxW6CP7J6TQCWl", descripcion: "Conito relleno de dulce de leche, cubierto con chocolate blanco. Vida útil: 60 días." },
    { categoria: "Conitos", nombre: "Pistacchio", foto: "https://lh3.googleusercontent.com/d/12zI5brn8k7XBmTNms7KTTocaIUlzwig4", descripcion: "Conito relleno de dulce de leche con corazón de Avella Pistacchio, recubierto con chocolate belga sabor pistacchio. Vida útil: 45 días." },
    { categoria: "Conitos", nombre: "Frutos Rojos", foto: "https://lh3.googleusercontent.com/d/1s34Bib2zj0lCA1QmVNJ5_Bdzf_VgwrVW", descripcion: "Conito relleno de dulce de leche con corazón de frutos rojos, cubierto con chocolate blanco belga sabor frutos rojos. Vida útil: 45 días." },

    // Viennesi
    { categoria: "Viennesi", nombre: "Fondente", foto: "https://lh3.googleusercontent.com/d/1PVFBnOX_Fl7zStyMr-7K17htjtBLECTj", descripcion: "Obleas italianas rellenas con crema de chocolate, bañadas en chocolate dark. Se vende individual, en caja x4 de un mismo sabor o en caja surtida x9 (3 de cada variedad)." },
    { categoria: "Viennesi", nombre: "Clásico", foto: "https://lh3.googleusercontent.com/d/1MOALGmSc-zoUm5f0_wHoptK8TqUDq2YT", descripcion: "Obleas italianas rellenas con crema de vainilla, recubiertas con chocolate con leche. Se vende individual, en caja x4 de un mismo sabor o en caja surtida x9 (3 de cada variedad)." },
    { categoria: "Viennesi", nombre: "Pistacchio", foto: "https://lh3.googleusercontent.com/d/1AHpUDEZElDIF7a6qS3Y_rnzzYZ59cCcc", descripcion: "Obleas italianas rellenas con crema de pistacchio, cubiertas con chocolate blanco. Se vende individual, en caja x4 de un mismo sabor o en caja surtida x9 (3 de cada variedad)." },

    // Avella
    { categoria: "Avella", nombre: "Gianduia", foto: "https://lh3.googleusercontent.com/d/18VIr03IyBNJHHC76TCNvR1_fUGmhaNXu", descripcion: "La combinación perfecta de avellanas y cacao. Frasco de 200g, libre de gluten.", kosher: "dairy" },
    { categoria: "Avella", nombre: "Pistacchio", foto: "https://lh3.googleusercontent.com/d/17TbbRk7CoaLap5aWc5_PtHd8WfOd1Q08", descripcion: "La esencia pura del pistacchio que caracteriza a Lucciano's. Frasco de 200g, libre de gluten.", kosher: "dairy" },
    { categoria: "Avella", nombre: "Pistacchio Crock", foto: "https://lh3.googleusercontent.com/d/1bRsxEcm3NYhxk6UpsucEZ9RDby3RP_BA", descripcion: "La variante más crujiente, con trocitos crocantes de pistacchio. Frasco de 200g, libre de gluten.", kosher: "dairy" },
    { categoria: "Avella", nombre: "Dubai", foto: "https://lh3.googleusercontent.com/d/1YcGEwUjR8IoDoPx8nkCn25-IwvoFeaX6", descripcion: "La clásica crema de pistacchio combinada con un crocante que emula el kadayif — es el relleno de las Tabletas Dubai. Frasco de 200g, libre de gluten." },
    { categoria: "Avella", nombre: "Gianduia Crock", foto: "https://lh3.googleusercontent.com/d/1ufXo8HMB19X1Qqj83Eu5rcWB2tH3zKnm", descripcion: "Avellanas y cacao con crocante. Frasco de 200g, libre de gluten." },
    { categoria: "Avella", nombre: "Coco Rock", foto: "https://lh3.googleusercontent.com/d/1eebOKlz7Gi5VgUpRBGCNugbiq-Inqnvk", descripcion: "Chocolate blanco y coco, con coco rallado. Frasco de 200g, libre de gluten." },
    { categoria: "Avella", nombre: "Collection Clásico (x3)", foto: "https://lh3.googleusercontent.com/d/1fj3tpRjv0HoR3wG9eIgzbhh9d_q3RJyO", descripcion: "Pack x3 en packaging premium para regalo: 1 Avella Pistacchio, 1 Avella Pistacchio Crock y 1 Avella Gianduia." },
    { categoria: "Avella", nombre: "Collection Pistacchio (x3)", foto: "https://lh3.googleusercontent.com/d/167736_QN3gURUkzBI96F0SnpyBClY2ze", descripcion: "Pack x3 en packaging premium para regalo: 1 Avella Pistacchio, 1 Avella Pistacchio Crock y 1 Avella Dubai." },
    { categoria: "Avella", nombre: "Collection Dubai (x3)", foto: "https://lh3.googleusercontent.com/d/1CgjqpIZj4aVYSREFg2MB7sJibTS0xjEj", descripcion: "Pack x3 en packaging premium para regalo: 3 Avella Dubai." },

    // Tabletas de Chocolate
    { categoria: "Tabletas", nombre: "Chocolate con Leche", foto: "https://lh3.googleusercontent.com/d/1-GeN5XUGmZ1CWrtjd2ThCV6PtV3Mhc5E", kosher: "dairy" },
    { categoria: "Tabletas", nombre: "Chocolate Blanco", foto: "https://lh3.googleusercontent.com/d/1T4uuhWJBqnilSdga7wp7TstXL980mOEb", descripcion: "Tableta de chocolate blanco de origen belga.", kosher: "dairy" },
    { categoria: "Tabletas", nombre: "Chocolate Dark 70%", foto: "https://lh3.googleusercontent.com/d/19Wn7jblQWttRLlgr9ln00IjWah9c3sGv", descripcion: "Tableta de chocolate de origen belga al 70%.", kosher: "dairy" },
    { categoria: "Tabletas", nombre: "Chocolate Frutos del Bosque", foto: "https://lh3.googleusercontent.com/d/14qOHNNRD7x6f04wBwY-_2SzKN71teHJx", descripcion: "Tableta de chocolate blanco de origen belga, saborizado con frutos del bosque liofilizados.", kosher: "dairy" },
    { categoria: "Tabletas", nombre: "Chocolate Pistacchio Caramelizado", foto: "https://lh3.googleusercontent.com/d/1FlLX5Fz7ewGoeaCKRR0j3GTrbKHA1_w8", descripcion: "Tableta de chocolate blanco belga saborizada con pasta de pistacchio pura, tostada y refinada.", kosher: "dairy" },
    { categoria: "Tabletas", nombre: "Chocolate 54% con Avellanas", foto: "https://lh3.googleusercontent.com/d/1p3PhtxlvXeYhd5IuizUMJ6F7iF6x_bIg", kosher: "dairy" },
    { categoria: "Tabletas", nombre: "Chocolate Blanco sin Azúcar Agregada", foto: "https://lh3.googleusercontent.com/d/1qAxi-R_eG4pyom4IaC8-4G_4wV5bgYme", kosher: "dairy" },
    { categoria: "Tabletas", nombre: "Chocolate con Leche sin Azúcar Agregada", foto: "https://lh3.googleusercontent.com/d/1T6CtIrqKvOo4tmeopSA1jR6g1Ol_z0Ri", descripcion: "Tableta de chocolate con leche de origen belga, sin azúcar agregada.", kosher: "dairy" },
    { categoria: "Tabletas", nombre: "Chocolate con Leche con Almendras", foto: "https://lh3.googleusercontent.com/d/1goXxK3XRNpRLnjGN7IbJgn8hSCUheCct", descripcion: "Tableta de chocolate con leche de origen belga, con almendras enteras tostadas.", kosher: "dairy" },
    { categoria: "Tabletas", nombre: "Chocolate con Leche con Avellanas", foto: "https://lh3.googleusercontent.com/d/1ffH67obJ4AOoVoy96fX6mGWSgCei7JBW", descripcion: "Tableta de chocolate con leche de origen belga, con avellanas enteras tostadas.", kosher: "dairy" },
    { categoria: "Tabletas", nombre: "Chocolate con Leche con Dulce de Leche", foto: "https://lh3.googleusercontent.com/d/1UZynMgq0lWM_RofpPQ1hAKFkAMctnwJs", kosher: "dairy" },
    { categoria: "Tabletas", nombre: "Chocolate Blanco con Caramelo y Avellanas", foto: "https://lh3.googleusercontent.com/d/13OK6V5Q3QN50ag6IgtFj76SuOI_v6BNu", descripcion: "Tableta de chocolate blanco de origen belga, con cristales de caramelo y avellanas partidas.", kosher: "dairy" },
    { categoria: "Tabletas", nombre: "Chocolate Blanco con Avella Latte Crock", foto: "https://lh3.googleusercontent.com/d/1v0K_Uuo56yqOYzrNGdNQxcYTTlkLWtVd", descripcion: "Tableta de chocolate blanco belga, rellena con Avella Latte, crema de chocolate con leche y crocante." },
    { categoria: "Tabletas", nombre: "Chocolate Pistacchio con Avella Pistacchio", foto: "https://lh3.googleusercontent.com/d/1rgtfkbhBfRrXR4mO1iXRU2BsXAD7AgXa", descripcion: "Tableta de chocolate belga saborizada con pasta pura de pistacchio, rellena con Avella Pistacchio.", kosher: "dairy" },
    { categoria: "Tabletas", nombre: "Tableta Dubai Semiamargo", foto: "https://lh3.googleusercontent.com/d/1uvLKuYpGhiVLsKKvSb9CLf6wGVGHJGg0", descripcion: "Chocolate belga semiamargo 54% relleno con Avella Pistacchio y un sutil crocante inspirado en el kadayif." },
    { categoria: "Tabletas", nombre: "Tableta Dubai con Leche", foto: "https://lh3.googleusercontent.com/d/18kIbviBPiaPvsJ1scaFrG1b1xwVZNqBb", descripcion: "Chocolate con leche belga relleno con Avella Pistacchio y un delicado crocante inspirado en el kadayif." },
    { categoria: "Tabletas", nombre: "Tableta Dubai Pistacchio", foto: "assets/img/chocolateria/tableta_dubai_pistacchio.jpg", descripcion: "Chocolate pistacchio relleno con Avella Dubai, con pistacchios garrapiñados y granella de pistacchio en la base. Lanzamiento 16/07 — código 1676, SKU 922." },
    { categoria: "Tabletas", nombre: "Pack x6 Negro", foto: "assets/img/chocolateria/pack_x6_negro.png", descripcion: "Contiene: Chocolate con Leche con Dulce de Leche, Chocolate con Leche, Chocolate Frutos del Bosque, Chocolate Pistacchio con Avella Pistacchio, Chocolate Pistacchio y Chocolate Dark. Precio fijo con código propio." },
    { categoria: "Tabletas", nombre: "Pack x6 Blanco", foto: "assets/img/chocolateria/pack_x6_blanco.png", descripcion: "Contiene: Chocolate con Leche con Dulce de Leche, Chocolate Blanco, Chocolate Pistacchio, Chocolate Pistacchio con Avella Pistacchio, Chocolate Blanco con Caramelo y Avellanas y Chocolate Blanco con Avella Latte Crock. Precio fijo con código propio." },
    { categoria: "Tabletas", nombre: "Pack x2 Tabletas Dubai", foto: "https://lh3.googleusercontent.com/d/1H8M0WNx1EXw0yMH8HHmQLtOZv-rCqJCX", descripcion: "Contiene las 2 Tabletas Dubai: Semiamargo y con Leche." },

    // Latas y presentaciones especiales
    { categoria: "Latas", nombre: "Lata Carrusel Verde (Pistacho)", foto: "https://lh3.googleusercontent.com/d/1jmrCfdoGLhNHt7gDpsDLhTdmb12t-8_y", descripcion: "Contiene: 6 Mini Alfajores Pistacchio, 3 Conitos Pistacchio, 2 Squares Avella Pistacchio y 2 Squares Granella Pistacchio." },
    { categoria: "Latas", nombre: "Lata Carrusel Bordó (Clásica)", foto: "https://lh3.googleusercontent.com/d/1NTy2yWicWl_GB4zS2eoRzZ5HUCWQyYlH", descripcion: "Contiene: 2 Mini Alfajores Semiamargo, 2 Mini Alfajores Blanco, 2 Mini Alfajores Nuez, 2 Conitos Blanco, 1 Conito Semiamargo, 2 Squares Choco Leche y 2 Squares Choco Blanco." },
    { categoria: "Latas", nombre: "Lata Carrusel Negra (Dark)", foto: "https://lh3.googleusercontent.com/d/1M3ZgGTTMDSfWBEIo7frJZn9MAa1CDKLQ", descripcion: "Contiene: 4 Mini Alfajores Dark, 2 Mini Alfajores Semiamargo, 3 Conitos Semiamargo y 4 Squares (2 con leche y avellanas + 2 semiamargo)." },
    { categoria: "Latas", nombre: "Lata Corazón", foto: "https://lh3.googleusercontent.com/d/1_KT-89hb1sW1FcZavhBmF-LhTmE5PgBv", descripcion: "Contiene 12 bombones de chocolate con leche rellenos de dulce de leche.", kosher: "dairy" },

    // Squares
    { categoria: "Squares", nombre: "Square Surtidos x18", foto: "https://lh3.googleusercontent.com/d/1mg-vovqJSJli-k8sr8kzhjTNERlISBnv", descripcion: "18 unidades — 3 de cada variedad: Chocolate Blanco, Pistacchio con granella, Caramel Gold, Chocolate con Leche, Con Leche y granella de avellana, y Semiamargo.", kosher: "dairy" },
    { categoria: "Squares", nombre: "Square Surtidos x32", foto: "https://lh3.googleusercontent.com/d/1icDCf1KVkpSDyoFP2xYHifL6TTGYXTPZ", descripcion: "32 unidades — 4 de cada variedad: Chocolate Blanco, Pistacchio con granella, Caramel Gold, Chocolate con Leche, Con Leche y granella de avellana, Semiamargo, Pistacchio relleno con Avella Pistacchio y Con Leche relleno con Avella Gianduia.", kosher: "dairy" },
];

export const CATEGORIAS_CHOCOLATERIA = ["Alfajores", "Conitos", "Viennesi", "Avella", "Tabletas", "Latas", "Squares"];
