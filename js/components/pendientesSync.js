/* ============================
   Lucciano's Academy (app Firebase)
   components/pendientesSync.js — aviso "Pendiente de sincronizar"

   Una etiqueta chica abajo a la izquierda que aparece solo cuando hay algo escrito en el teléfono que todavía no llegó a la base
   (se hizo sin señal) y desaparece sola cuando se confirma. No es un botón: no hay nada que tocar, se envía solo al volver la señal.
=============================*/

export function iniciarPendientesSync(fuente) {
    if (!fuente || typeof fuente.alCambiarPendientes !== "function" || document.getElementById("pendiente-sync")) return;
    const aviso = document.createElement("div");
    aviso.id = "pendiente-sync";
    aviso.className = "pendiente-sync";
    aviso.setAttribute("role", "status");
    aviso.hidden = true;
    aviso.textContent = "Pendiente de sincronizar";
    aviso.title = "Hiciste cambios sin señal. Se envían solos cuando vuelva la conexión.";
    document.body.appendChild(aviso);
    const pintar = (hay) => { aviso.hidden = !hay; };
    fuente.alCambiarPendientes(pintar);
    pintar(fuente.pendientes());
}
