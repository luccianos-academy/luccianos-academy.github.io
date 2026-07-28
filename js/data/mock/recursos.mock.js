/* ============================
   FARO v4
   data/mock/recursos.mock.js — Seed de "Recursos" para modo demo

   URLs de ejemplo a propósito ("#") — los recursos reales apuntan a
   Sheets internas del negocio (Auditorías, Claims, etc.), y esas URLs
   no deben quedar hardcodeadas en el bundle público de GitHub Pages.
   En producción, Admin carga las URLs reales desde "Gestionar
   recursos" (quedan en la Sheet real, no en este archivo).
=============================*/

export const recursosMock = [
    { id: 1, nombre: "Auditorías", url: "#", icono: "evaluaciones", visiblePara: "supervisor", creadoPor: "Gabriel Busquets" },
    { id: 2, nombre: "Claims Pedidos Ya", url: "#", icono: "alertas", visiblePara: "supervisor", creadoPor: "Gabriel Busquets" },
    { id: 3, nombre: "Ponderados de Google", url: "#", icono: "dashboard", visiblePara: "supervisor", creadoPor: "Gabriel Busquets" },
    { id: 4, nombre: "Relevamientos", url: "#", icono: "reportes", visiblePara: "supervisor", creadoPor: "Gabriel Busquets" },
    { id: 5, nombre: "Herramientas mkt", url: "#", icono: "integraciones", visiblePara: "supervisor", creadoPor: "Gabriel Busquets" },
    { id: 6, nombre: "Modular", url: "#", icono: "configuracion", visiblePara: "supervisor", creadoPor: "Gabriel Busquets" },
];
