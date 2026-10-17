/* ============================
   Lucciano's Academy (app Firebase)
   services/sesionFirebase.js — registro de la sesión de Firebase Auth

   Sin imports a propósito: lo usan auth.js (cerrar sesión) y login.js, y así no se
   forma un ciclo de módulos. app.js lo completa al arrancar si USAR_FIRESTORE está activo.
=============================*/

let sesion = null;

export function registrarSesionFirebase(s) { sesion = s; }
export function getSesionFirebase() { return sesion; }

// Las "acciones" que antes resolvía Apps Script (gasRequest): con Firestore las resuelve firestoreSource.ejecutarAccion.
let ejecutorAcciones = null;
export function registrarEjecutorAcciones(fn) { ejecutorAcciones = fn; }
export function getEjecutorAcciones() { return ejecutorAcciones; }
