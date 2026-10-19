/* ============================
   Lucciano's Academy (app Firebase)
   services/chequeoAcceso.js — Revisa y renueva el acceso al ABRIR la app con la sesión ya iniciada

   La app nueva mantiene la sesión abierta (Firebase Auth), así que la gente ya no vuelve a "ingresar" casi nunca. Pero el ingreso
   es lo que hacía tres cosas que no pueden depender de volver a tocar el botón de Google:
   1) dejar el aviso "Ingreso de X" en los Movimientos y actualizar "Último ingreso" (para saber quién usa la app),
   2) renovar el acceso por uso de los colaboradores (vence a los 30 días: sin esto, quien usa la app todos los días quedaría afuera),
   3) enterarse de que a alguien lo desactivaron o se le venció el acceso.
   Se repite como mucho una vez cada 6 horas por dispositivo y no bloquea nada: sin señal, simplemente se saltea.
=============================*/

export const INTERVALO_CHEQUEO_MS = 6 * 60 * 60 * 1000;
const CLAVE = "faro_ultimo_chequeo_acceso";

/** @returns {Promise<{omitido?:true, motivo?:string, ok?:boolean, usuario?:object, error?:string}>} */
export async function chequearAccesoAlAbrir({ sesion, usuario, registrarEvento, ahora = Date.now, almacen = typeof localStorage !== "undefined" ? localStorage : null }) {
    if (!sesion || !usuario || !usuario.email) return { omitido: true, motivo: "sin-sesion" };
    const clave = `${CLAVE}|${String(usuario.email).toLowerCase()}`;
    let ultimo = 0;
    try { ultimo = Number(almacen && almacen.getItem(clave)) || 0; } catch (err) { /* sin almacenamiento */ }
    if (ahora() - ultimo < INTERVALO_CHEQUEO_MS && ahora() >= ultimo) return { omitido: true, motivo: "reciente" };

    let r;
    try { r = await sesion.cargarSesion(usuario.email); }
    catch (err) { return { omitido: true, motivo: "sin-red" }; }       // sin señal o base caída: se reintenta en la próxima apertura

    if (!r.ok) return { ok: false, error: r.error };                  // respuesta firme de la base: sin acceso (desactivada, vencida, sin registro)
    try { almacen && almacen.setItem(clave, String(ahora())); } catch (err) { /* sin almacenamiento */ }
    try { if (registrarEvento) await registrarEvento(r.usuario.id, "login", `Ingreso de ${r.usuario.nombre}`); } catch (err) { /* el aviso no es condición */ }
    return { ok: true, usuario: r.usuario };
}
