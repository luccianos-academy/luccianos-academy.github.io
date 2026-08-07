/* ============================
   Lucciano's Academy
   data/mock/recursos.mock.js — Seed de "Recursos" para modo demo

   Un solo acceso ("Enlaces operaciones") que apunta al Google Sites
   completo que arma el compañero de Operaciones — así los cambios
   ahí (agregar/sacar una sección) no dependen de replicarlos acá.
   Si ese Site algún día deja de existir (o hace falta separar un
   acceso puntual), el mecanismo de abajo (data/recursos.js,
   "Gestionar recursos") ya soporta cualquier cantidad de filas
   individuales sin cambio de código — ver la lista completa de URLs
   guardada aparte para ese caso.

   URL de ejemplo a propósito ("#") — la real apunta a un Google
   Sites interno del negocio, no debe quedar hardcodeada en el bundle
   público de GitHub Pages. En producción, Admin/Supervisor la carga
   desde "Gestionar recursos" (queda en la Sheet real, no acá).
=============================*/

export const recursosMock = [
    { id: 1, nombre: "Enlaces operaciones", url: "#", icono: "integraciones", visiblePara: "supervisor", creadoPor: "Gabriel Busquets" },
];
