/* ============================
   Lucciano's Academy
   data/mock/gestionTareas.mock.js — Catálogo de "Gestión semanal"

   Datos de muestra para ES_LOCAL_DEV (sin backend). En REPO/producción
   (GAS_URL seteado) esto no se usa — se lee de la hoja "GestionTareas"
   real. dias/subitems van como STRING separado por coma acá también,
   igual que en la Sheet — normalizarTarea (gestionTareas.js) los
   parsea a array, mismo criterio que aplicaA/noAplicaA de Cursos.
=============================*/

export const gestionTareasMock = [
    { id: "diaria-control", icono: "camara", titulo: "Control de pedidos y reclamos", detalle: "Con foto — gestionado acá mismo, sin depender de WhatsApp suelto.", dias: "", subitems: "" },
    {
        id: "diaria-limpieza", icono: "tacho", titulo: "Limpieza del equipamiento",
        detalle: "Tocá para desplegar y marcar cada equipo a medida que lo limpiás.", dias: "",
        subitems: "Abatidor,Armario,Vitrina",
    },
    { id: "horarios", icono: "calendario", titulo: "Armar los horarios del equipo", detalle: "Para la semana que arranca, según cómo vino la venta.", dias: "", subitems: "" },
    {
        id: "proveedores", icono: "caja", titulo: "Pedido a proveedores",
        detalle: "Tocá para desplegar y marcar cada uno a medida que hacés el pedido.", dias: "",
        subitems: "Leche,Crema,Dore,Barcena,Limpieza,Pastelería,Rollos fiscales,Posnet",
    },
    { id: "fabrica", icono: "caja", titulo: "Pedido a fábrica", detalle: "Después de hacer el inventario. Revisar el sistema de venta saliente para no pasarse del pedido.", dias: "", subitems: "" },
    { id: "reportes", icono: "documento", titulo: "Reportes fiscales", detalle: "Según lo solicite Administración.", dias: "", subitems: "" },
];
