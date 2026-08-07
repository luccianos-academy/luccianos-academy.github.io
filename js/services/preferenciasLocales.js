/* ============================
   Lucciano's Academy
   services/preferenciasLocales.js — Locales elegidos por un Capacitador

   Un Capacitador VE toda la red (data/sucursales.js: getLocalesVisibles)
   — esto no cambia ese acceso. Lo que guarda acá es una preferencia
   personal, liviana y solo del dispositivo (localStorage, mismo
   criterio que el banner de beta en ui.js): qué locales eligió mirar
   por default, para no tener que scrollear/filtrar toda la red cada
   vez que entra. Vacío = sin preferencia guardada todavía → ve todo,
   como hasta ahora.
=============================*/

import { getItem, setItem } from "./storage.js";

function clave(usuario) {
    return `locales_elegidos_${usuario.id}`;
}

export function getLocalesElegidos(usuario) {
    return getItem(clave(usuario), []);
}

export function setLocalesElegidos(usuario, locales) {
    setItem(clave(usuario), locales);
}
