/* ============================
   Lucciano's Academy
   services/storage.js

   Wrapper sobre localStorage para la sesión y preferencias
   livianas de usuario (no datos sensibles).
=============================*/

const PREFIX = "faro_";

export function existe(clave) {
    return localStorage.getItem(PREFIX + clave) !== null;
}

export function setItem(clave, valor) {
    localStorage.setItem(PREFIX + clave, JSON.stringify(valor));
}

export function getItem(clave, porDefecto = null) {
    const raw = localStorage.getItem(PREFIX + clave);
    if (raw === null) return porDefecto;
    try {
        return JSON.parse(raw);
    } catch {
        return porDefecto;
    }
}

export function removeItem(clave) {
    localStorage.removeItem(PREFIX + clave);
}
