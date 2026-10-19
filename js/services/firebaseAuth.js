/* ============================
   Lucciano's Academy (app Firebase)
   services/firebaseAuth.js — inicio de sesión con Firebase Authentication (Google)

   Reemplaza a verificarLogin + el token firmado propio de Apps Script. Firebase se
   encarga de verificar a la persona con Google; acá se aplican las mismas reglas de
   acceso que hoy aplica el backend (Code.gs, _usuarioDeSesion):

     - un email que no tiene documento en usuarios/ no entra;
     - una cuenta desactivada no entra;
     - un colaborador con el acceso vencido no entra;
     - cada ingreso renueva el acceso "por uso": un colaborador queda con +30 días.

   Las reglas de Firestore repiten las mismas condiciones (defensa en dos capas: esto
   le da un mensaje claro a la persona; las reglas son las que realmente protegen).

   Fábrica con el SDK por parámetro, igual que firestoreSource.js, para probarla contra
   el emulador (tests/firebaseAuth.test.mjs). El ingreso con ventana de Google solo se
   puede probar en un navegador real.
=============================*/

import { finDeDiaEnMs, timestampAFecha } from "./firestoreSource.js";

const DIA_MS = 24 * 3600 * 1000;
const DIAS_DE_ACCESO = 30;
const UTC_MENOS_3_MS = 3 * 3600 * 1000;

export const MENSAJES = {
    sinRegistro: "Tu cuenta todavía no está registrada en Lucciano's Academy. Solicitá acceso a tu supervisor o administrador.",
    desactivada: "Tu cuenta está desactivada. Consultá con tu supervisor.",
    vencida: "Tu acceso venció. Pedile a tu supervisor que lo renueve.",
    cancelado: "Cancelaste el ingreso con Google.",
    sinVerificar: "Google no verificó tu email. Probá con otra cuenta.",
};

/**
 * El usuario con el MISMO formato que guarda hoy la sesión (Code.gs, _usuarioDeSesion): las tres
 * banderas son verdadero/falso de verdad (no "SI"/"NO": un "NO" cuenta como verdadero en JS y
 * mostraría "Mi local" a todo el mundo), y `activo` sigue siendo "SI"/"NO".
 */
export function usuarioDeSesion(d) {
    return {
        id: d.id,
        nombre: String(d.nombre || "").trim(),
        email: String(d.email || "").trim().toLowerCase(),
        rol: String(d.rol || "").trim().toLowerCase(),
        encargado: d.encargado === true,
        responsableTurno: d.responsableTurno === true,
        capacitador: d.capacitador === true,
        tienePush: d.tienePush === true,
        sucursal: String(d.sucursal || "").trim(),
        foto: String(d.foto || d.fotoMini || "").trim(),
        activo: d.activo === true ? "SI" : "NO",
        fechaVencimientoAcceso: timestampAFecha(d.fechaVencimientoAcceso),
        fechaAlta: String(d.fechaAlta || "").trim().slice(0, 10),
    };
}

export function crearSesionFirebase({ auth, db, sdkAuth, sdkFs, ahora = () => Date.now() }) {
    const { doc, getDoc, updateDoc, Timestamp } = sdkFs;

    // La fecha de hoy + 30 días, vista desde Argentina ("2026-11-16").
    const fechaDeAcceso = () =>
        new Date(ahora() + DIAS_DE_ACCESO * DIA_MS - UTC_MENOS_3_MS).toISOString().slice(0, 10);

    /** Con el email ya verificado por Firebase: ¿puede entrar? Devuelve { ok, usuario } o { ok:false, error }. */
    async function cargarSesion(emailVerificado) {
        const email = String(emailVerificado || "").trim().toLowerCase();
        if (!email) return { ok: false, error: MENSAJES.sinVerificar };

        const ref = doc(db, "usuarios", email);
        const snap = await getDoc(ref);
        // "correo" va aparte para que la pantalla de login muestre EXACTAMENTE qué dirección se buscó (la que devuelve Google): así un
        // error de tipeo, un punto de más o un alta hecha en otro entorno se ven al instante.
        if (!snap.exists()) return { ok: false, error: MENSAJES.sinRegistro, correo: email };

        let datos = snap.data();
        if (datos.activo !== true) return { ok: false, error: MENSAJES.desactivada };

        const esColaborador = datos.rol === "colaborador";
        const vence = datos.fechaVencimientoAcceso;
        if (esColaborador && vence && vence.toMillis() < ahora()) {
            return { ok: false, error: MENSAJES.vencida };
        }

        // Renovación por uso (solo colaboradores tienen vencimiento) + último ingreso.
        const cambios = { ultimoIngreso: new Date(ahora()).toISOString(), modificadoEn: ahora() };
        if (esColaborador) cambios.fechaVencimientoAcceso = Timestamp.fromMillis(finDeDiaEnMs(fechaDeAcceso()));
        try {
            await updateDoc(ref, cambios);
            datos = { ...datos, ...cambios };
        } catch (err) {
            // Renovar no es condición para entrar: si falla, se entra igual con lo que había.
            console.warn("[firebaseAuth] No se pudo renovar el acceso:", err);
        }

        return { ok: true, usuario: usuarioDeSesion(datos) };
    }

    /** Abre la ventana de Google y, si la persona puede entrar, devuelve { ok, usuario }. */
    async function iniciarConGoogle() {
        const { GoogleAuthProvider, signInWithPopup, signInWithRedirect } = sdkAuth;
        const proveedor = new GoogleAuthProvider();
        proveedor.setCustomParameters({ prompt: "select_account" });
        let resultado;
        try {
            resultado = await signInWithPopup(auth, proveedor);
        } catch (err) {
            if (err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request") {
                return { ok: false, error: MENSAJES.cancelado };
            }
            // Celulares y apps instaladas (PWA) a veces bloquean la ventana: se pasa a redirección completa.
            if (err.code === "auth/popup-blocked" || err.code === "auth/operation-not-supported-in-this-environment") {
                await signInWithRedirect(auth, proveedor);
                return { ok: false, pendiente: true };
            }
            throw err;
        }
        return aceptarOCerrar(resultado.user);
    }

    /** Al volver de una redirección de Google (ver arriba), completa el ingreso. Sin redirección → null. */
    async function completarRedireccion() {
        const resultado = await sdkAuth.getRedirectResult(auth);
        return resultado && resultado.user ? aceptarOCerrar(resultado.user) : null;
    }

    async function aceptarOCerrar(usuarioFirebase) {
        if (!usuarioFirebase.emailVerified) {
            await cerrar();
            return { ok: false, error: MENSAJES.sinVerificar };
        }
        const r = await cargarSesion(usuarioFirebase.email);
        if (!r.ok) await cerrar();   // no queda abierta una sesión de Firebase de alguien sin acceso
        return r;
    }

    function cerrar() { return sdkAuth.signOut(auth); }
    function haySesionFirebase() { return !!auth.currentUser; }
    const esperarEstadoInicial = () => auth.authStateReady();

    return { cargarSesion, iniciarConGoogle, completarRedireccion, cerrar, haySesionFirebase, esperarEstadoInicial };
}

// Para quien necesite mostrar la fecha de acceso (Mi perfil) sin importar firestoreSource.
export { timestampAFecha };
