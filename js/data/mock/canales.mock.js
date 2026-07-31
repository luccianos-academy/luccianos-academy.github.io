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
    { id: 1, nombre: "Anuncios", icono: "noticias", creadoPor: "Gabriel Busquets", restringidoA: "" },
    { id: 2, nombre: "Supervisión", icono: "configuracion", creadoPor: "Gabriel Busquets", restringidoA: "supervisor" },
    { id: 3, nombre: "Incidencias", icono: "warning", creadoPor: "Gabriel Busquets", restringidoA: "" },
    { id: 4, nombre: "Ideas", icono: "idea", creadoPor: "Gabriel Busquets", restringidoA: "" },
    { id: 5, nombre: "Capacitación", icono: "academia", creadoPor: "Gabriel Busquets", restringidoA: "capacitador" },
];
