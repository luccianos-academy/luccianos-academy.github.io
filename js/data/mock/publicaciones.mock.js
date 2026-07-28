/* ============================
   FARO v4
   data/mock/publicaciones.mock.js — Tabla "Publicaciones" (Comunicaciones)
=============================*/

export const publicacionesMock = [
    {
        id: 1, canal: 1, autorId: 1, autorNombre: "Gabriel Busquets", autorRol: "admin",
        titulo: "Cambio de uniforme", mensaje: "Desde el lunes 29/07 cambia el uniforme en todas las sucursales. Adjunto el nuevo manual con los detalles.",
        adjuntoUrl: "", adjuntoLabel: "Manual de Uniforme",
        destacado: "SI", requiereConfirmacion: "SI", fecha: "2026-07-25T10:00:00", likesDe: "4,6,7",
    },
    {
        id: 2, canal: 2, autorId: 4, autorNombre: "Tomás Ojeda", autorRol: "supervisor",
        titulo: "Nuevo procedimiento de apertura", mensaje: "Les comparto el nuevo paso a paso para la apertura del local. Importante: leer antes del lunes.",
        adjuntoUrl: "", adjuntoLabel: "Procedimiento Apertura",
        destacado: "SI", requiereConfirmacion: "SI", fecha: "2026-07-24T09:15:00", likesDe: "1,6,7,9",
    },
    {
        id: 3, canal: 2, autorId: 5, autorNombre: "Ever Rodríguez", autorRol: "supervisor",
        titulo: "Ajuste en procedimiento de pedidos", mensaje: "Chicos, a partir de hoy vamos a utilizar el nuevo formato de pedido a proveedores. Adjunto el instructivo actualizado.",
        adjuntoUrl: "", adjuntoLabel: "Instructivo Pedidos",
        destacado: "NO", requiereConfirmacion: "SI", fecha: "2026-07-25T10:32:00", likesDe: "1,4,6,7,8,9,2",
    },
    {
        id: 4, canal: 4, autorId: 6, autorNombre: "Lourdes Garcia", autorRol: "supervisor",
        titulo: "Propuesta: cartel de temperatura en vitrina", mensaje: "¿Qué les parece si sumamos un cartelito con la temperatura ideal de cada sabor? Lo vi en otra heladería y ayuda mucho a mantener el estándar.",
        adjuntoUrl: "", adjuntoLabel: "", destacado: "NO", requiereConfirmacion: "NO", fecha: "2026-07-22T16:40:00", likesDe: "4,7",
    },
];
