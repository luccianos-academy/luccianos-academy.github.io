/* ============================
   Lucciano's Academy
   services/preferenciasAccesos.js — Accesos rápidos elegidos (bottom nav)

   Mismo criterio que preferenciasLocales.js: preferencia personal,
   liviana y solo del dispositivo (localStorage) — no es un permiso,
   solo qué 4 secciones quiere ver abajo de la pantalla en el celular
   para no abrir el menú lateral cada vez. Nace pedido explícito del
   Admin (2026-08-19): "dame la posibilidad de crear acceso directo
   del botón que yo utilice más". Vacío = sin preferencia guardada
   todavía → usa el default fijo de TABS_POR_ROL (components/bottomNav.js).
=============================*/

import { getItem, setItem } from "./storage.js";

function clave(usuario) {
    return `accesos_rapidos_${usuario.id}`;
}

export function getAccesosRapidos(usuario) {
    return getItem(clave(usuario), []);
}

export function setAccesosRapidos(usuario, ids) {
    setItem(clave(usuario), ids);
}
