/* ============================
   FARO v4 — datos reales
   Tabla "Usuarios" (id, nombre, email, rol, encargado, sucursal, activo)

   Los primeros 9 usuarios (ids 1-9) son personas reales del equipo
   de Lucciano's, extraídas del sistema SisCap en producción — sin
   contraseñas (login es 100% por Google, cada quien entra con su
   propia cuenta). Los emails reales conocidos se mantienen; el
   resto son direcciones @luccianos.com.ar plausibles a confirmar.

   Los colaboradores (ids 10+) son de muestra ilustrativa — el
   sistema real no expone nombres de colaboradores de piso en los
   mockups que se migraron, así que no se inventan personas reales,
   solo se completa el equipo de cada local supervisado para poder
   probar los roles de Colaborador/Encargado.
=============================*/

export const usuariosMock = [
    // Reales — corporativo
    { id: 1, nombre: "Gabriel Busquets", email: "gabrielbusquets86@gmail.com",               rol: "admin", encargado: "NO", sucursal: "", activo: "SI" },
    { id: 2, nombre: "Carlos Torres",    email: "operaciones.franquicias@luccianos.com.ar", rol: "admin", encargado: "NO", sucursal: "", activo: "SI" },
    { id: 3, nombre: "Fabricio",         email: "fabricio@luccianos.com.ar",                 rol: "admin", encargado: "NO", sucursal: "", activo: "SI" },

    // Reales — supervisores
    { id: 4, nombre: "Tomás Ojeda",         email: "tomas.ojeda@luccianos.com.ar",         rol: "supervisor", encargado: "NO", sucursal: "Lucciano's Martinez GBA",          activo: "SI" },
    { id: 5, nombre: "Ever Rodríguez",      email: "ever.rodriguez@luccianos.com.ar",      rol: "supervisor", encargado: "NO", sucursal: "Lucciano's Recoleta CABA",          activo: "SI" },
    { id: 6, nombre: "Lourdes Garcia",      email: "lourdes.garcia@luccianos.com.ar",      rol: "supervisor", encargado: "NO", sucursal: "Lucciano's Devoto CABA",            activo: "SI" },
    { id: 7, nombre: "Nicolas Lopez",       email: "nicolas.lopez@luccianos.com.ar",       rol: "supervisor", encargado: "NO", sucursal: "Lucciano's Central Mar del Plata",  activo: "SI", capacitador: "SI" },
    { id: 8, nombre: "Ivan Herrera",        email: "ivan.herrera@luccianos.com.ar",        rol: "supervisor", encargado: "NO", sucursal: "Lucciano's Nuevocentro Córdoba",    activo: "SI" },
    { id: 9, nombre: "Barbara Riccitelli",  email: "barbara.riccitelli@luccianos.com.ar",  rol: "supervisor", encargado: "NO", sucursal: "Lucciano's Shopping Abasto CABA",   activo: "SI" },

    // De muestra — colaboradores por local (completan los equipos de los locales supervisados arriba)
    { id: 10, nombre: "Julieta Fernández", email: "julieta.fernandez@luccianos.com.ar", rol: "colaborador", encargado: "SI", sucursal: "Lucciano's Martinez GBA",         activo: "SI" },
    { id: 11, nombre: "Máximo Díaz",       email: "maximo.diaz@luccianos.com.ar",       rol: "colaborador", encargado: "NO", sucursal: "Lucciano's Martinez GBA",         activo: "SI" },
    { id: 12, nombre: "Agustín Romero",    email: "agustin.romero@luccianos.com.ar",    rol: "colaborador", encargado: "NO", sucursal: "Lucciano's Olivos GBA",           activo: "SI" },
    { id: 13, nombre: "Camila Sosa",       email: "camila.sosa@luccianos.com.ar",       rol: "colaborador", encargado: "SI", sucursal: "Lucciano's Recoleta CABA",        activo: "SI" },
    { id: 14, nombre: "Franco Medina",     email: "franco.medina@luccianos.com.ar",     rol: "colaborador", encargado: "NO", sucursal: "Lucciano's Recoleta CABA",        activo: "NO" },
    { id: 15, nombre: "Valentina Ruiz",    email: "valentina.ruiz@luccianos.com.ar",    rol: "colaborador", encargado: "SI", sucursal: "Lucciano's Devoto CABA",          activo: "SI" },
    { id: 16, nombre: "Nicolás Torres",    email: "nicolas.torres@luccianos.com.ar",    rol: "colaborador", encargado: "NO", sucursal: "Lucciano's Villa Urquiza CABA",   activo: "SI" },
    { id: 17, nombre: "Agustina Rey",      email: "agustina.rey@luccianos.com.ar",      rol: "colaborador", encargado: "SI", sucursal: "Lucciano's Central Mar del Plata", activo: "SI" },
    { id: 18, nombre: "Tomás Ibáñez",      email: "tomas.ibanez@luccianos.com.ar",      rol: "colaborador", encargado: "NO", sucursal: "Lucciano's Central Mar del Plata", activo: "NO" },
    { id: 19, nombre: "Lucía Acosta",      email: "lucia.acosta@luccianos.com.ar",      rol: "colaborador", encargado: "SI", sucursal: "Lucciano's Nuevocentro Córdoba",  activo: "SI" },
    { id: 20, nombre: "Bruno Molina",      email: "bruno.molina@luccianos.com.ar",      rol: "colaborador", encargado: "SI", sucursal: "Lucciano's Shopping Abasto CABA", activo: "SI" },
    { id: 21, nombre: "Martina Vega",      email: "martina.vega@luccianos.com.ar",      rol: "colaborador", encargado: "NO", sucursal: "Lucciano's Shopping Abasto CABA", activo: "SI" },
];
