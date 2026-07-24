/* ============================
   FARO v4 — datos de muestra
   Tabla "Asignaciones" (colaboradorId, cursoId, fechaAlta, fechaVencimiento, estado, progreso)

   Repartidas entre enero y julio 2026, con estados mixtos, para que
   el Dashboard Ejecutivo (evolución mensual, rankings) y el Centro
   de Alertas (cursos vencidos) tengan señal real. colaboradorId 12,
   14 y 19 quedan con una asignación vencida a propósito.
=============================*/

export const asignacionesMock = [
    { id: 1,  colaboradorId: 10, cursoId: 1, fechaAlta: "2026-02-01", fechaVencimiento: "2026-03-01", estado: "completado",  progreso: 100 },
    { id: 2,  colaboradorId: 10, cursoId: 7, fechaAlta: "2026-06-01", fechaVencimiento: "2026-07-15", estado: "completado",  progreso: 100 },

    { id: 3,  colaboradorId: 11, cursoId: 1, fechaAlta: "2026-01-15", fechaVencimiento: "2026-02-15", estado: "completado",  progreso: 100 },
    { id: 4,  colaboradorId: 11, cursoId: 2, fechaAlta: "2026-05-01", fechaVencimiento: "2026-06-01", estado: "completado",  progreso: 100 },
    { id: 5,  colaboradorId: 11, cursoId: 6, fechaAlta: "2026-06-20", fechaVencimiento: "2026-07-20", estado: "en_progreso", progreso: 40 },

    { id: 6,  colaboradorId: 12, cursoId: 1, fechaAlta: "2026-03-01", fechaVencimiento: "2026-04-01", estado: "en_progreso", progreso: 20 },

    { id: 7,  colaboradorId: 13, cursoId: 1, fechaAlta: "2026-02-10", fechaVencimiento: "2026-03-10", estado: "completado",  progreso: 100 },
    { id: 8,  colaboradorId: 13, cursoId: 3, fechaAlta: "2026-06-10", fechaVencimiento: "2026-07-10", estado: "en_progreso", progreso: 70 },

    { id: 9,  colaboradorId: 14, cursoId: 1, fechaAlta: "2026-04-01", fechaVencimiento: "2026-05-01", estado: "completado",  progreso: 90 },
    { id: 10, colaboradorId: 14, cursoId: 2, fechaAlta: "2026-06-05", fechaVencimiento: "2026-06-25", estado: "en_progreso", progreso: 50 },

    { id: 11, colaboradorId: 15, cursoId: 1, fechaAlta: "2026-03-15", fechaVencimiento: "2026-04-15", estado: "completado",  progreso: 100 },
    { id: 12, colaboradorId: 15, cursoId: 4, fechaAlta: "2026-05-20", fechaVencimiento: "2026-06-20", estado: "completado",  progreso: 95 },

    { id: 13, colaboradorId: 16, cursoId: 1, fechaAlta: "2026-02-20", fechaVencimiento: "2026-03-20", estado: "completado",  progreso: 100 },
    { id: 14, colaboradorId: 16, cursoId: 5, fechaAlta: "2026-06-15", fechaVencimiento: "2026-07-15", estado: "en_progreso", progreso: 30 },

    { id: 15, colaboradorId: 17, cursoId: 1, fechaAlta: "2026-03-05", fechaVencimiento: "2026-04-05", estado: "completado",  progreso: 100 },
    { id: 16, colaboradorId: 17, cursoId: 7, fechaAlta: "2026-06-01", fechaVencimiento: "2026-07-05", estado: "en_progreso", progreso: 55 },

    { id: 17, colaboradorId: 18, cursoId: 1, fechaAlta: "2026-01-20", fechaVencimiento: "2026-02-20", estado: "completado",  progreso: 100 },
    { id: 18, colaboradorId: 18, cursoId: 2, fechaAlta: "2026-05-15", fechaVencimiento: "2026-06-15", estado: "completado",  progreso: 88 },
    { id: 19, colaboradorId: 18, cursoId: 3, fechaAlta: "2026-06-25", fechaVencimiento: "2026-07-25", estado: "en_progreso", progreso: 20 },

    { id: 20, colaboradorId: 19, cursoId: 1, fechaAlta: "2026-04-10", fechaVencimiento: "2026-05-10", estado: "en_progreso", progreso: 10 },

    { id: 21, colaboradorId: 20, cursoId: 1, fechaAlta: "2026-03-25", fechaVencimiento: "2026-04-25", estado: "completado",  progreso: 100 },
    { id: 22, colaboradorId: 20, cursoId: 6, fechaAlta: "2026-06-10", fechaVencimiento: "2026-07-10", estado: "en_progreso", progreso: 45 },

    { id: 23, colaboradorId: 21, cursoId: 1, fechaAlta: "2026-02-05", fechaVencimiento: "2026-03-05", estado: "completado",  progreso: 100 },
    { id: 24, colaboradorId: 21, cursoId: 4, fechaAlta: "2026-05-25", fechaVencimiento: "2026-06-25", estado: "completado",  progreso: 80 },
];
