/* ============================
   Lucciano's Academy
   mascotaCarga.js — Loader animado entre pantallas

   Reusa los videos "Meet Our Friends" de Icepops (Tonio/Enzo/Minion,
   ya usados como foto animada de esos productos en la galería) como
   mascota de marca en las transiciones de carga — mismo criterio que
   el búho de Duolingo: un personaje reconocible en vez de un spinner
   genérico. Se elige uno al azar en cada carga (no siempre el mismo)
   para que no se sienta repetitivo en una app que se abre muchas
   veces por turno.
=============================*/

const MASCOTAS = [
    { nombre: "Tonio", video: "assets/video/producto-tonio.mp4" },
    { nombre: "Enzo", video: "assets/video/producto-enzo.mp4" },
    { nombre: "Minion", video: "assets/video/producto-minion.mp4" },
];

export function MascotaCarga(mensaje = "Cargando...") {
    const elegido = MASCOTAS[Math.floor(Math.random() * MASCOTAS.length)];
    return `
        <div class="mascota-carga">
            <video src="${elegido.video}" autoplay muted loop playsinline></video>
            <p>${mensaje}</p>
        </div>
    `;
}
