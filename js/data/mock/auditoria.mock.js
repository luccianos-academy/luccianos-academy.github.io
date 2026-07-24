/* ============================
   FARO v4 — datos de muestra
   Tabla "Auditoria" (fecha, usuarioId, accion, detalle)

   A propósito, ningún evento tiene usuarioId 9, 20 o 21 (Barbara
   Riccitelli y su equipo en Lucciano's Shopping Abasto CABA) — así
   "Locales sin actividad" (Centro de Alertas) tiene al menos un
   caso real entre los locales que sí tienen supervisor asignado.
=============================*/

export const auditoriaMock = [
    { id: 1,  fecha: "2026-06-30T10:15:00", usuarioId: 1,  accion: "login",                 detalle: "Ingreso de Gabriel Busquets" },
    { id: 2,  fecha: "2026-06-30T09:00:00", usuarioId: 4,  accion: "registrar_colaborador",  detalle: "Alta de Máximo Díaz" },
    { id: 3,  fecha: "2026-06-29T18:30:00", usuarioId: 5,  accion: "login",                 detalle: "Ingreso de Ever Rodríguez" },
    { id: 4,  fecha: "2026-06-28T14:20:00", usuarioId: 4,  accion: "renovar_acceso",         detalle: "Acceso renovado (usuario 11)" },
    { id: 5,  fecha: "2026-06-27T11:05:00", usuarioId: 6,  accion: "login",                 detalle: "Ingreso de Lourdes Garcia" },
    { id: 6,  fecha: "2026-06-26T16:40:00", usuarioId: 7,  accion: "registrar_colaborador",  detalle: "Alta de Agustina Rey" },
    { id: 7,  fecha: "2026-06-25T08:50:00", usuarioId: 5,  accion: "deshabilitar_acceso",    detalle: "Acceso deshabilitado (usuario 14)" },
    { id: 8,  fecha: "2026-06-24T13:10:00", usuarioId: 2,  accion: "crear_curso",            detalle: "Curso creado: Encargados y Responsables" },
    { id: 9,  fecha: "2026-06-23T09:30:00", usuarioId: 1,  accion: "crear_pregunta",         detalle: "Pregunta agregada al curso 1" },
    { id: 10, fecha: "2026-06-20T17:00:00", usuarioId: 10, accion: "login",                 detalle: "Ingreso de Julieta Fernández" },
    { id: 11, fecha: "2026-06-18T10:00:00", usuarioId: 17, accion: "login",                 detalle: "Ingreso de Agustina Rey" },
    { id: 12, fecha: "2026-06-15T15:45:00", usuarioId: 4,  accion: "login",                 detalle: "Ingreso de Tomás Ojeda" },
    { id: 13, fecha: "2026-06-12T12:00:00", usuarioId: 13, accion: "login",                 detalle: "Ingreso de Camila Sosa" },
    { id: 14, fecha: "2026-06-10T09:15:00", usuarioId: 8,  accion: "registrar_colaborador",  detalle: "Alta de Lucía Acosta" },
];
