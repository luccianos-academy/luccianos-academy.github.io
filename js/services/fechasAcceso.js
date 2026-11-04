/* ============================
   Lucciano's Academy
   services/fechasAcceso.js — Días de acceso de un colaborador nuevo y fechas "YYYY-MM-DD"

   Fechas como texto "YYYY-MM-DD" en vez de Date: evita el desfasaje de un día que da new Date("YYYY-MM-DD") al leerla en hora local
   (Argentina, UTC-3). Las usan "Registrar colaborador" y la aprobación de altas pedidas (pages/pedidos.js).
=============================*/

export const DIAS_ACCESO_INICIAL = 30;

export function fechaHoyISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function sumarDias(fechaISO, dias) {
    const [y, m, d] = fechaISO.split("-").map(Number);
    const fecha = new Date(y, m - 1, d);
    fecha.setDate(fecha.getDate() + dias);
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
}
