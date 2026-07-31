/* ============================
   FARO v4
   data/mock/canales.mock.js — Tabla "Canales" (Comunicaciones)

   5 canales núcleo para arrancar (el resto queda a criterio de
   Admin/Supervisor, creables desde "Gestionar canales" cuando
   surja una necesidad real — no hace falta precargar categorías
   que todavía no tienen uso). ids 1/2/4 se mantienen estables porque
   publicaciones.mock.js ya tiene contenido de muestra apuntando ahí.
=============================*/

export const canalesMock = [
    { id: 1, nombre: "Anuncios", icono: "noticias", creadoPor: "Gabriel Busquets", restringidoA: "", sucursal: "" },
    { id: 2, nombre: "Supervisión", icono: "configuracion", creadoPor: "Gabriel Busquets", restringidoA: "supervisor", sucursal: "" },
    { id: 3, nombre: "Incidencias", icono: "warning", creadoPor: "Gabriel Busquets", restringidoA: "", sucursal: "" },
    { id: 4, nombre: "Ideas", icono: "idea", creadoPor: "Gabriel Busquets", restringidoA: "", sucursal: "" },
    { id: 5, nombre: "Capacitación", icono: "academia", creadoPor: "Gabriel Busquets", restringidoA: "capacitador", sucursal: "" },
    // Ejemplo del modo "lista fija de sucursales" (Encargados) —
    // Julieta Fernández (Martinez GBA) y Camila Sosa (Recoleta CABA)
    // son encargadas en el mock, así que este canal ya es probable de
    // ver end-to-end. Pensado para un grupo puntual de locales (no
    // necesariamente ligado a propio/franquicia) — ver los dos de
    // abajo para ESE caso.
    { id: 6, nombre: "Zona Norte GBA", icono: "usuarios", creadoPor: "Gabriel Busquets", restringidoA: "", sucursal: "Lucciano's Martinez GBA,Lucciano's Recoleta CABA" },
    // Ejemplo del modo "categoría dinámica" (Encargados — propio vs
    // franquicia, ver Sucursales.esPropio en data/sucursales.js) —
    // pedido explícito del usuario: por descarte, todo lo que no esté
    // marcado como propio cae acá, sin tener que tocar el canal.
    { id: 7, nombre: "Nuestros locales", icono: "usuarios", creadoPor: "Gabriel Busquets", restringidoA: "encargados-propios", sucursal: "" },
    { id: 8, nombre: "Franquicias", icono: "usuarios", creadoPor: "Gabriel Busquets", restringidoA: "encargados-franquicias", sucursal: "" },
];
