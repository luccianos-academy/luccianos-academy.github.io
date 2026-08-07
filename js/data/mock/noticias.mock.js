/* ============================
   Lucciano's Academy
   data/mock/noticias.mock.js — Tabla "Noticias"

   Desde que el admin puede cargar novedades sin depender de un
   deploy (ver pages/noticias.js), "Noticias" pasó a ser una hoja
   real más — mismo criterio que cualquier otra tabla (fetchSheet/
   writeSheet vía data/noticias.js). Este mock es el fallback en modo
   demo y la semilla inicial (ver apps-script/Seed.gs).
=============================*/

export const noticiasMock = [
    { id: 6, titulo: "Certificado Kosher renovado", fecha: "2026-03-01", resumen: "Ajdut Israel Kosher renovó el certificado de Heladerías Lucciano's (Sello AK 16469/70), vigente hasta el 28 de febrero de 2027. El catálogo ya está actualizado con las etiquetas Parve y Dairy correspondientes.", detalle: "El certificado distingue dos categorías: Parve (sin lácteos, apto para acompañar cualquier comida) y Dairy/Jalav Stam (contiene lácteos). Aplica a helados, palitos, tabletas, potes sin gluten y Geladot's de Heladería, además de las líneas equivalentes de Icepops y Chocolatería. Revisá el badge Parve/Dairy en la ficha de cada producto del catálogo.", enlace: "2", adjuntoUrl: "assets/docs/certificado-kosher.pdf", adjuntoLabel: "Ver certificado" },
    { id: 5, titulo: "Lanzamiento: Tableta Dubai Pistacchio", fecha: "2026-07-16", resumen: "Se suma a la colección de Tabletas Dubai — date una vuelta por Chocolatería para conocer el producto, el código y las reglas de exhibición.", detalle: "", enlace: "5" },
    { id: 1, titulo: "Nuevas Squares en Chocolatería", fecha: "2026-06-25", resumen: "Ya están disponibles las presentaciones x18 y x32 — revisá el módulo de Chocolatería para conocer los surtidos.", detalle: "", enlace: "5" },
    { id: 2, titulo: "Recordatorio: Atención al Cliente", fecha: "2026-06-18", resumen: "Repasá el protocolo de manejo de quejas — es uno de los módulos con más peso en tu evaluación.", detalle: "", enlace: "" },
    { id: 3, titulo: "Lucciano's llega a Chile", fecha: "2026-06-05", resumen: "Sumamos un nuevo país a la red internacional — repasá la línea de tiempo completa en Nuestra Historia.", detalle: "", enlace: "" },
    { id: 4, titulo: "Actualizamos el módulo de Heladería", fecha: "2026-05-28", resumen: "Sumamos la referencia completa de temperaturas y el procedimiento de pase de helado.", detalle: "", enlace: "2" },
];
