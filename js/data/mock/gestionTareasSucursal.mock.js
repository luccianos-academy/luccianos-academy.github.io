/* ============================
   Lucciano's Academy
   data/mock/gestionTareasSucursal.mock.js

   Fase 2 de Gestión semanal (2026-08-25) — días por tarea, por
   sucursal. Solo para ES_LOCAL_DEV (modo demo sin backend). tareaId
   acá abajo son los ids REALES del catálogo (gestionTareas.mock.js) —
   antes tenían "1"/"2" de ejemplo, que no matcheaban ninguna tarea del
   catálogo y quedaban invisibles en "Tareas asignadas".
=============================*/
export const gestionTareasSucursalMock = [
    { id: 1, tareaId: "diaria-limpieza", sucursal: "Lucciano's Martinez GBA", dias: "Lunes,Martes,Miércoles,Jueves,Viernes,Sábado,Domingo", frecuencia: "semanal" },
    { id: 2, tareaId: "proveedores", sucursal: "Lucciano's Martinez GBA", dias: "Lunes,Jueves", frecuencia: "semanal" },
    { id: 3, tareaId: "reportes", sucursal: "Lucciano's Martinez GBA", dias: "5", frecuencia: "mensual" },
];
