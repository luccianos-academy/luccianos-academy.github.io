/* ============================
   FARO v4
   icons.js — Set de íconos SVG propios (sin librería externa)

   Un solo dispatcher Icon(nombre) en vez de una función por ícono:
   MODULOS[i].icono ya es un string clave (antes un emoji, ahora un
   nombre de ícono) — así el cambio en Sidebar() es mecánico
   (${m.icono} → ${Icon(m.icono)}) sin mantener una lista de imports
   por cada ícono nuevo que se agregue.

   Estilo: trazo 1.75px, esquinas redondeadas, sin relleno (stroke
   con currentColor) — estética tipo Linear/Notion, 24x24.
=============================*/

const PATHS = {
    inicio: `<path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9a1 1 0 0 0 1 1h4v-6h2v6h4a1 1 0 0 0 1-1v-9"/>`,

    dashboard: `<rect x="4" y="13" width="4" height="7" rx="1"/><rect x="10" y="8" width="4" height="12" rx="1"/><rect x="16" y="4" width="4" height="16" rx="1"/>`,

    usuarios: `<circle cx="9" cy="8" r="3"/><path d="M3.5 20c.5-3.5 3-5.5 5.5-5.5s5 2 5.5 5.5"/><circle cx="17" cy="9" r="2.4"/><path d="M15.8 14.7c2-.3 4 1.3 4.7 4.3"/>`,

    supervisores: `<circle cx="12" cy="8.5" r="3.2"/><path d="M5.5 20c.6-4 3-6.2 6.5-6.2s5.9 2.2 6.5 6.2"/><path d="m9.5 8.6 1.6 1.6L14.8 6.8"/>`,

    locales: `<path d="M4 9.5 5 4h14l1 5.5"/><path d="M4 9.5a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0"/><path d="M5.5 11v9h13v-9"/><rect x="10" y="14" width="4" height="6"/>`,

    academia: `<path d="M2.5 8 12 4l9.5 4-9.5 4-9.5-4Z"/><path d="M6 10.3v4.4c0 1.4 2.7 2.8 6 2.8s6-1.4 6-2.8v-4.4"/><path d="M21 9v6"/>`,

    evaluaciones: `<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3.5h6a1 1 0 0 1 1 1V6H8V4.5a1 1 0 0 1 1-1Z"/><path d="m8.5 12.5 2 2 4-4.2"/><path d="M8.5 17h7"/>`,

    reportes: `<path d="M7 3.5h7l4 4V19a1.3 1.3 0 0 1-1.3 1.3H7A1.3 1.3 0 0 1 5.7 19V4.8A1.3 1.3 0 0 1 7 3.5Z"/><path d="M14 3.5V8h4.2"/><path d="M8.5 12.5h7M8.5 15.5h7M8.5 18h4"/>`,

    alertas: `<path d="M12 4a5.5 5.5 0 0 0-5.5 5.5c0 4.2-1.3 6-2.2 6.9h15.4c-.9-.9-2.2-2.7-2.2-6.9A5.5 5.5 0 0 0 12 4Z"/><path d="M9.7 19.5a2.4 2.4 0 0 0 4.6 0"/>`,

    noticias: `<path d="M3 9.5v5a1 1 0 0 0 1 1h1.8l3 5h2l-1.3-5H10l9-3.5v-8L10 7h-1.5l-3 2.5H4a1 1 0 0 0-1 1Z"/><path d="M16.5 9a3 3 0 0 1 0 5.5"/>`,

    // Campana de notificaciones (barra superior). Trazo, coherente con el resto.
    campana: `<path d="M12 3.5a5.2 5.2 0 0 0-5.2 5.2c0 4.3-1.3 6-2.3 7h15a10.8 10.8 0 0 1-2.3-7A5.2 5.2 0 0 0 12 3.5Z"/><path d="M9.6 18.7a2.5 2.5 0 0 0 4.8 0"/>`,

    configuracion: `<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.3M12 18.2v2.3M20.5 12h-2.3M5.8 12H3.5M17.8 6.2l-1.6 1.6M7.8 16.2l-1.6 1.6M17.8 17.8l-1.6-1.6M7.8 7.8 6.2 6.2"/>`,

    integraciones: `<path d="M9 15 15 9"/><path d="M10.5 6.5 12 5a3 3 0 0 1 4.2 4.2l-1.5 1.5"/><path d="M13.5 17.5 12 19a3 3 0 0 1-4.2-4.2l1.5-1.5"/>`,

    perfil: `<circle cx="12" cy="8.5" r="3.5"/><path d="M4.8 20c.8-4.2 3.5-6.5 7.2-6.5s6.4 2.3 7.2 6.5"/>`,

    historia: `<path d="M6 21V4"/><path d="M6 4.5h11l-3 3.75 3 3.75H6"/>`,

    logout: `<path d="M9 4H6a1.5 1.5 0 0 0-1.5 1.5v13A1.5 1.5 0 0 0 6 20h3"/><path d="M14 8.5 18 12l-4 3.5"/><path d="M17.5 12H10"/>`,

    trendUp: `<path d="m4 16 5.5-6 4 3.5L20 6"/><path d="M14.5 6H20v5.5"/>`,

    trendDown: `<path d="m4 8 5.5 6 4-3.5L20 18"/><path d="M14.5 18H20v-5.5"/>`,

    check: `<path d="m5 12.5 4.5 4.5L19 7"/>`,

    warning: `<path d="M12 4 21 19.5H3Z"/><path d="M12 10v4"/><path d="M12 16.7v.1"/>`,

    // Íconos por categoría de curso (home del Colaborador — Academia)
    cafe: `<path d="M6 10h11v7a4 4 0 0 1-4 4h-3a4 4 0 0 1-4-4v-7Z"/><path d="M17 12h1.5a2 2 0 0 1 0 4H17"/><path d="M9 4.3c0 1-1 1-1 2s1 1 1 2M13 4.3c0 1-1 1-1 2s1 1 1 2"/>`,

    helado: `<path d="M8.5 11 12 21l3.5-10"/><path d="M8 11a4 4 0 0 1 8 0c0 1.5-1.5 2.5-4 2.5S8 12.5 8 11Z"/>`,

    icepop: `<path d="M8 3.5h8v9a4 4 0 0 1-8 0v-9Z"/><path d="M12 16.5V21"/>`,

    pastel: `<path d="M6.5 12h11l-1.3 7.2a1 1 0 0 1-1 .8H8.8a1 1 0 0 1-1-.8L6.5 12Z"/><path d="M7 12c-1-2 .5-4 2-3.5-.5-2 2-3.5 3-1.5 1.5-2 3.5-.5 3 1.5 1.5-.5 3 1.5 2 3.5"/>`,

    chocolate: `<rect x="4.5" y="7" width="15" height="11" rx="1.5"/><path d="M9.5 7v11M14.5 7v11M4.5 12.5h15"/>`,

    caja: `<path d="M5 10.5 6.5 4h11L19 10.5"/><rect x="4" y="10.5" width="16" height="9" rx="1.5"/><path d="M9 15h6"/>`,

    // Comunicaciones (canales, comentarios, publicaciones)
    idea: `<path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.4.9 1 .9 1.6v.5h5.2v-.5c0-.6.3-1.2.9-1.6A6 6 0 0 0 12 3Z"/>`,

    comentario: `<path d="M4 5.5h16v10.5H9.5L5 20v-4H4Z"/>`,

    corazon: `<path d="M12 20s-7-4.4-9.3-8.8C1.2 8 3 5 6.2 5c2 0 3.4 1.2 5.8 3.8C14.4 6.2 15.8 5 17.8 5 21 5 22.8 8 21.3 11.2 19 15.6 12 20 12 20Z"/>`,

    candado: `<rect x="6" y="11" width="12" height="9" rx="1.5"/><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3"/>`,

    trofeo: `<path d="M8 4.5h8v5a4 4 0 0 1-8 0v-5Z"/><path d="M8 6H5.5a1 1 0 0 0-1 1.3l.6 1.7A3 3 0 0 0 8 11"/><path d="M16 6h2.5a1 1 0 0 1 1 1.3l-.6 1.7A3 3 0 0 1 16 11"/><path d="M12 13.5V17M9 20.5h6M10 20.5v-2h4v2"/>`,

    menu: `<path d="M4 6.5h16"/><path d="M4 12h16"/><path d="M4 17.5h16"/>`,

    cerrar: `<path d="M6 6l12 12"/><path d="M18 6 6 18"/>`,

    sonido: `<path d="M4 9.5v5h4l5 4V5.5l-5 4H4Z"/><path d="M16.5 9a4.2 4.2 0 0 1 0 6"/><path d="M19 6.5a8 8 0 0 1 0 11"/>`,

    "sonido-off": `<path d="M4 9.5v5h4l5 4V5.5l-5 4H4Z"/><path d="m16 9.5 5 5"/><path d="m21 9.5-5 5"/>`,

    play: `<path d="M8 5.5v13l11-6.5-11-6.5Z" fill="currentColor" stroke="none"/>`,

    "flecha-izq": `<path d="M15 5 8 12l7 7"/>`,

    "flecha-der": `<path d="M9 5l7 7-7 7"/>`,

    expandir: `<path d="M9 4H4v5"/><path d="M15 20h5v-5"/><path d="M4 4l6 6"/><path d="M20 20l-6-6"/>`,

    // Banner "instalar app" (ver components/installBanner.js)
    descargar: `<path d="M12 3.5v11.5"/><path d="m7.5 10.5 4.5 4.5 4.5-4.5"/><path d="M5 17.5v1.8a1.7 1.7 0 0 0 1.7 1.7h10.6a1.7 1.7 0 0 0 1.7-1.7v-1.8"/>`,

    compartir: `<path d="M12 15V4"/><path d="m8.5 7.5 3.5-3.5 3.5 3.5"/><path d="M6 10h-.3A1.7 1.7 0 0 0 4 11.7v7.6A1.7 1.7 0 0 0 5.7 21h12.6a1.7 1.7 0 0 0 1.7-1.7v-7.6A1.7 1.7 0 0 0 18.3 10H18"/>`,

    // Tarjeta de adjunto y selector de "Adjuntar" (Coordinación Operativa)
    documento: `<path d="M7 3.5h7l4 4V19a1.3 1.3 0 0 1-1.3 1.3H7A1.3 1.3 0 0 1 5.7 19V4.8A1.3 1.3 0 0 1 7 3.5Z"/><path d="M14 3.5V8h4.2"/><path d="M8.5 12.5h7M8.5 15.5h7M8.5 18h4"/>`,
    enlace: `<path d="M9.5 14.5 14.5 9.5"/><path d="M11 7.5 12.7 5.8a3 3 0 0 1 4.2 4.2L15.2 11.7"/><path d="M13 16.5 11.3 18.2a3 3 0 0 1-4.2-4.2L8.8 12.3"/>`,
};

export function Icon(name, { size = 20 } = {}) {
    const inner = PATHS[name] || PATHS.alertas;
    return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}
