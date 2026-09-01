/* ============================
   Lucciano's Academy
   data/mock/gestionChecks.mock.js

   Check "hecho" persistido de Gestión semanal (2026-08-25) — por
   sucursal y por día. Solo para ES_LOCAL_DEV (modo demo sin backend).

   ciclo / cerrada / subitemsFirmas (2026-08-31) — reset de ciclo,
   candado y firma por sub-ítem (ver Code.gs, actualizarCheckGestion).
   Los ciclos de acá se calculan relativos a HOY (no un string fijo)
   para que la demo siempre tenga algo "de esta semana/mes" y algo
   "archivado" sin importar cuándo se corra — mismo corte a las 04:00
   que el resto de la app (services/gestionCiclo.js), simplificado acá
   porque para datos de prueba alcanza con la fecha, sin la hora exacta
   del cambio de ciclo.
=============================*/

function lunesDeSemana(offsetSemanas) {
    const hoy = new Date();
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7) + offsetSemanas * 7);
    return `${lunes.getFullYear()}-${String(lunes.getMonth() + 1).padStart(2, "0")}-${String(lunes.getDate()).padStart(2, "0")}`;
}

function mesRelativo(offsetMeses) {
    const hoy = new Date();
    const d = new Date(hoy.getFullYear(), hoy.getMonth() + offsetMeses, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export const gestionChecksMock = [
    // Esta semana — "Limpieza del equipamiento" a MITAD de camino (2 de
    // 3), firmada por dos personas distintas (turno mañana/tarde) —
    // demuestra la firma por ítem sin estar todavía cerrada.
    {
        id: 1, tareaId: "diaria-limpieza", sucursal: "Lucciano's Martinez GBA", dia: "Lunes",
        hecho: "NO", marcadoPor: "Damián Gordillo", hora: "14:20", ciclo: lunesDeSemana(0),
        subitemsMarcados: "0,1", subitemsFirmas: "0:Belén Ibáñez:0910,1:Damián Gordillo:1420",
    },
    // Esta semana — "Pedido a proveedores" COMPLETA y CERRADA — demuestra
    // el candado + banner "Cerrada por..." + Reabrir (Admin).
    {
        id: 2, tareaId: "proveedores", sucursal: "Lucciano's Martinez GBA", dia: "Jueves",
        hecho: "SI", marcadoPor: "Belén Ibáñez", hora: "09:45", ciclo: lunesDeSemana(0),
        subitemsMarcados: "0,1,2,3,4,5,6,7",
        subitemsFirmas: "0:Belén Ibáñez:0945,1:Belén Ibáñez:0945,2:Belén Ibáñez:0945,3:Belén Ibáñez:0945,4:Belén Ibáñez:0945,5:Belén Ibáñez:0945,6:Belén Ibáñez:0945,7:Belén Ibáñez:0945",
        cerrada: "SI", cerradaPor: "Belén Ibáñez", cerradaHora: "09:45",
    },
    // Ciclo pasado (3 semanas atrás) — para poblar "Histórico".
    {
        id: 3, tareaId: "diaria-limpieza", sucursal: "Lucciano's Martinez GBA", dia: "Lunes",
        hecho: "SI", marcadoPor: "Agustín Petronio", hora: "08:52", ciclo: lunesDeSemana(-3),
        subitemsMarcados: "0,1,2", subitemsFirmas: "0:Agustín Petronio:0852,1:Agustín Petronio:0852,2:Agustín Petronio:0852",
        cerrada: "SI", cerradaPor: "Agustín Petronio", cerradaHora: "08:52",
    },
    // Ciclo mensual pasado — "Reportes fiscales" (tarea simple, sin
    // sub-ítems), para probar Histórico con una tarjeta mensual.
    {
        id: 4, tareaId: "reportes", sucursal: "Lucciano's Martinez GBA", dia: "5",
        hecho: "SI", marcadoPor: "Belén Ibáñez", hora: "11:00", ciclo: mesRelativo(-1),
        cerrada: "SI", cerradaPor: "Belén Ibáñez", cerradaHora: "11:00",
    },
];
