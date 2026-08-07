/* ============================
   Lucciano's Academy — Seed.gs

   Función de una sola vez para poblar las 8 hojas con los datos
   reales que ya usa el cliente (mismos que js/data/mock/*.mock.js
   en el proyecto). Correr poblarDatosIniciales() UNA VEZ desde el
   editor de Apps Script (Ejecutar → poblarDatosIniciales), después
   de crear las 8 hojas con sus encabezados (ver README.md).

   Es seguro volver a correrla: borra las filas de datos existentes
   de cada hoja (conserva el encabezado) antes de reescribir, así
   no duplica si se corre más de una vez por error.
=============================*/

/* ============================
   Lucciano's Academy — datos reales
   Tabla "Sucursales" — los 99 locales reales de Lucciano's
   (Argentina, Uruguay, Paraguay, Chile, EEUU), extraídos del
   sistema SisCap ya en producción.

   El campo "supervisor" solo está asignado en los locales donde
   tenemos un supervisor real conocido (ver usuarios.mock.js) — el
   resto queda sin asignar, igual que en el sistema real (los
   accesos se cargan por local desde el backend, no están todos
   hardcodeados acá).
=============================*/

const sucursalesMock = [
    { id: 1, nombre: "Lucciano's Martinez GBA", supervisor: "Tomás Ojeda", estado: "Activa" },
    { id: 2, nombre: "Lucciano's Olivos GBA", supervisor: "Tomás Ojeda", estado: "Activa" },
    { id: 3, nombre: "Lucciano's Parque Avellaneda Shopping GBA", supervisor: "", estado: "Activa" },
    { id: 4, nombre: "Lucciano's Ituzaingo GBA", supervisor: "", estado: "Activa" },
    { id: 5, nombre: "Lucciano's Distrito T GBA", supervisor: "", estado: "Activa" },
    { id: 6, nombre: "Lucciano's Adrogué GBA", supervisor: "", estado: "Activa" },
    { id: 7, nombre: "Lucciano's San Miguel GBA", supervisor: "", estado: "Activa" },
    { id: 8, nombre: "Lucciano's Parque Leloir GBA", supervisor: "", estado: "Activa" },
    { id: 9, nombre: "Lucciano's Quilmes GBA", supervisor: "", estado: "Activa" },
    { id: 10, nombre: "Lucciano's Caseros GBA", supervisor: "", estado: "Activa" },
    { id: 11, nombre: "Lucciano's Ramos Mejia GBA", supervisor: "", estado: "Activa" },
    { id: 12, nombre: "Lucciano's Shopping Abasto CABA", supervisor: "Barbara Riccitelli", estado: "Activa" },
    { id: 13, nombre: "Lucciano's La Imprenta Gran Hotel CABA", supervisor: "", estado: "Activa" },
    { id: 14, nombre: "Lucciano's Distrito Arcos CABA", supervisor: "", estado: "Activa" },
    { id: 15, nombre: "Lucciano's Arcos del Rosedal CABA", supervisor: "", estado: "Activa" },
    { id: 16, nombre: "Lucciano's Villa del Parque CABA", supervisor: "", estado: "Activa" },
    { id: 17, nombre: "Lucciano's Honduras CABA", supervisor: "", estado: "Activa" },
    { id: 18, nombre: "Lucciano's Cid Campeador CABA", supervisor: "", estado: "Activa" },
    { id: 19, nombre: "Lucciano's Devoto CABA", supervisor: "Lourdes Garcia", estado: "Activa" },
    { id: 20, nombre: "Lucciano's Recoleta CABA", supervisor: "Ever Rodríguez", estado: "Activa" },
    { id: 21, nombre: "Lucciano's Dot CABA", supervisor: "", estado: "Activa" },
    { id: 22, nombre: "Lucciano's Puerto Madero Dique CABA", supervisor: "", estado: "Activa" },
    { id: 23, nombre: "Lucciano's Puerto Madero CABA", supervisor: "", estado: "Activa" },
    { id: 24, nombre: "Lucciano's Caballito CABA", supervisor: "", estado: "Activa" },
    { id: 25, nombre: "Lucciano's Parque Rivadavia CABA", supervisor: "", estado: "Activa" },
    { id: 26, nombre: "Lucciano's Libertador CABA", supervisor: "", estado: "Activa" },
    { id: 27, nombre: "Lucciano's Villa Urquiza CABA", supervisor: "Lourdes Garcia", estado: "Activa" },
    { id: 28, nombre: "Lucciano's Villa Urquiza II CABA", supervisor: "", estado: "Activa" },
    { id: 29, nombre: "Lucciano's Villa Luro CABA", supervisor: "", estado: "Activa" },
    { id: 30, nombre: "Lucciano's Coghlan CABA", supervisor: "", estado: "Activa" },
    { id: 31, nombre: "Lucciano's Las Cañitas CABA", supervisor: "", estado: "Activa" },
    { id: 32, nombre: "Lucciano's Colegiales CABA", supervisor: "", estado: "Activa" },
    { id: 33, nombre: "Lucciano's Agüero CABA", supervisor: "", estado: "Activa" },
    { id: 34, nombre: "Lucciano's Nuñez CABA", supervisor: "", estado: "Activa" },
    { id: 35, nombre: "Lucciano's Belgrano C CABA", supervisor: "", estado: "Activa" },
    { id: 36, nombre: "Lucciano's Bajo Belgrano CABA", supervisor: "", estado: "Activa" },
    { id: 37, nombre: "Lucciano's Galerias Pacifico CABA", supervisor: "", estado: "Activa" },
    { id: 38, nombre: "Lucciano's San Telmo CABA", supervisor: "", estado: "Activa" },
    { id: 39, nombre: "Lucciano's Paseo del Angel CABA", supervisor: "", estado: "Activa" },
    { id: 40, nombre: "Lucciano's Plaza Houssay CABA", supervisor: "", estado: "Activa" },
    { id: 41, nombre: "Lucciano's Palermo Chico CABA", supervisor: "", estado: "Activa" },
    { id: 42, nombre: "Lucciano's Patio Bullrich CABA", supervisor: "", estado: "Activa" },
    { id: 43, nombre: "Lucciano's Obelisco CABA", supervisor: "", estado: "Activa" },
    { id: 44, nombre: "Lucciano's Almagro CABA", supervisor: "", estado: "Activa" },
    { id: 45, nombre: "Lucciano's Calle Corrientes CABA", supervisor: "", estado: "Activa" },
    { id: 46, nombre: "Lucciano's Santa Fe y Parana CABA", supervisor: "", estado: "Activa" },
    { id: 47, nombre: "Lucciano's Nordelta Buenos Aires", supervisor: "", estado: "Activa" },
    { id: 48, nombre: "Lucciano's Baxar Mercado Buenos Aires", supervisor: "", estado: "Activa" },
    { id: 49, nombre: "Lucciano's La Plata Buenos Aires", supervisor: "", estado: "Activa" },
    { id: 50, nombre: "Lucciano's Pilar Buenos Aires", supervisor: "", estado: "Activa" },
    { id: 51, nombre: "Lucciano's Pilar II Buenos Aires", supervisor: "", estado: "Activa" },
    { id: 52, nombre: "Lucciano's City Bell Buenos Aires", supervisor: "", estado: "Activa" },
    { id: 53, nombre: "Lucciano's Las Lomitas Buenos Aires", supervisor: "", estado: "Activa" },
    { id: 54, nombre: "Lucciano's Lanus Buenos Aires", supervisor: "", estado: "Activa" },
    { id: 55, nombre: "Lucciano's San Fernando Buenos Aires", supervisor: "", estado: "Activa" },
    { id: 56, nombre: "Lucciano's Campana Buenos Aires", supervisor: "", estado: "Activa" },
    { id: 57, nombre: "Lucciano's San Nicolas Buenos Aires", supervisor: "", estado: "Activa" },
    { id: 58, nombre: "Lucciano's Tandil Buenos Aires", supervisor: "", estado: "Activa" },
    { id: 59, nombre: "Lucciano's Carilo Buenos Aires", supervisor: "", estado: "Activa" },
    { id: 60, nombre: "Lucciano's Pinamar Buenos Aires", supervisor: "", estado: "Inactiva" },
    { id: 61, nombre: "Lucciano's Bahia Blanca Buenos Aires", supervisor: "", estado: "Activa" },
    { id: 62, nombre: "Lucciano's Bahia Blanca Villa Mitre Buenos Aires", supervisor: "", estado: "Activa" },
    { id: 63, nombre: "Lucciano's Cerro De Las Rosas Córdoba", supervisor: "", estado: "Activa" },
    { id: 64, nombre: "Lucciano's Nuevocentro Córdoba", supervisor: "Ivan Herrera", estado: "Activa" },
    { id: 65, nombre: "Lucciano's Ribera Shopping Santa Fe", supervisor: "", estado: "Activa" },
    { id: 66, nombre: "Lucciano's Alto Rosario Santa Fe", supervisor: "", estado: "Activa" },
    { id: 67, nombre: "Lucciano's Peatonal Sarmiento Mendoza", supervisor: "", estado: "Activa" },
    { id: 68, nombre: "Lucciano's Palmares Mendoza", supervisor: "", estado: "Activa" },
    { id: 69, nombre: "Lucciano's Chacras de Coria Mendoza", supervisor: "", estado: "Activa" },
    { id: 70, nombre: "Lucciano's Shopping Mendoza", supervisor: "", estado: "Activa" },
    { id: 71, nombre: "Lucciano's Resistencia Chaco", supervisor: "", estado: "Activa" },
    { id: 72, nombre: "Lucciano's Av Argentina Neuquén", supervisor: "", estado: "Activa" },
    { id: 73, nombre: "Lucciano's Paseo de la Costa Neuquén", supervisor: "", estado: "Activa" },
    { id: 74, nombre: "Lucciano's Cipolletti Rio Negro", supervisor: "", estado: "Activa" },
    { id: 75, nombre: "Lucciano's Gral Roca Rio Negro", supervisor: "", estado: "Activa" },
    { id: 76, nombre: "Lucciano's Barrio Norte Tucuman", supervisor: "", estado: "Activa" },
    { id: 77, nombre: "Lucciano's Yerba Buena Tucuman", supervisor: "", estado: "Activa" },
    { id: 78, nombre: "Lucciano's Catamarca Catamarca", supervisor: "", estado: "Activa" },
    { id: 79, nombre: "Lucciano's Galerias Salta", supervisor: "", estado: "Activa" },
    { id: 80, nombre: "Lucciano's Alto NOA Salta", supervisor: "", estado: "Activa" },
    { id: 81, nombre: "Lucciano's Posadas Misiones", supervisor: "", estado: "Activa" },
    { id: 82, nombre: "Lucciano's Madryn Chubut", supervisor: "", estado: "Activa" },
    { id: 83, nombre: "Lucciano's Ushuaia Tierra del Fuego", supervisor: "", estado: "Inactiva" },
    { id: 84, nombre: "Lucciano's Capital Corrientes", supervisor: "", estado: "Activa" },
    { id: 85, nombre: "Lucciano's Pocitos Uruguay", supervisor: "", estado: "Activa" },
    { id: 86, nombre: "Lucciano's Punta Carretas Uruguay", supervisor: "", estado: "Activa" },
    { id: 87, nombre: "Lucciano's Punta Carrasco Uruguay", supervisor: "", estado: "Activa" },
    { id: 88, nombre: "Lucciano's Asuncion Paraguay", supervisor: "", estado: "Activa" },
    { id: 89, nombre: "Lucciano's Parque Arauco Chile", supervisor: "", estado: "Activa" },
    { id: 90, nombre: "Lucciano's Alem Mar del Plata", supervisor: "", estado: "Activa" },
    { id: 91, nombre: "Lucciano's Aldrey Mar del Plata", supervisor: "", estado: "Activa" },
    { id: 92, nombre: "Lucciano's Central Mar del Plata", supervisor: "Nicolas Lopez", estado: "Activa" },
    { id: 93, nombre: "Lucciano's Constitucion Mar del Plata", supervisor: "", estado: "Activa" },
    { id: 94, nombre: "Lucciano's Gallegos Mar del Plata", supervisor: "", estado: "Activa" },
    { id: 95, nombre: "Lucciano's Guemes Mar del Plata", supervisor: "", estado: "Activa" },
    { id: 96, nombre: "Lucciano's Paso Mar del Plata", supervisor: "", estado: "Activa" },
    { id: 97, nombre: "Lucciano's Peatonal Mar del Plata", supervisor: "", estado: "Activa" },
    { id: 98, nombre: "Lucciano's Torreon Mar del Plata", supervisor: "", estado: "Activa" },
    { id: 99, nombre: "Lucciano's Varese Mar del Plata", supervisor: "", estado: "Activa" },
];

/* ============================
   Lucciano's Academy — datos reales
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

const usuariosMock = [
    // Reales — corporativo
    { id: 1, nombre: "Gabriel Busquets", email: "gabrielbusquets86@gmail.com",               rol: "admin", encargado: "NO", sucursal: "", activo: "SI" },
    { id: 2, nombre: "Carlos Torres",    email: "operaciones.franquicias@luccianos.com.ar", rol: "admin", encargado: "NO", sucursal: "", activo: "SI" },
    { id: 3, nombre: "Fabricio",         email: "fabricio@luccianos.com.ar",                 rol: "admin", encargado: "NO", sucursal: "", activo: "SI" },

    // Reales — supervisores
    { id: 4, nombre: "Tomás Ojeda",         email: "tomas.ojeda@luccianos.com.ar",         rol: "supervisor", encargado: "NO", sucursal: "Lucciano's Martinez GBA",          activo: "SI" },
    { id: 5, nombre: "Ever Rodríguez",      email: "ever.rodriguez@luccianos.com.ar",      rol: "supervisor", encargado: "NO", sucursal: "Lucciano's Recoleta CABA",          activo: "SI" },
    { id: 6, nombre: "Lourdes Garcia",      email: "lourdes.garcia@luccianos.com.ar",      rol: "supervisor", encargado: "NO", sucursal: "Lucciano's Devoto CABA",            activo: "SI" },
    { id: 7, nombre: "Nicolas Lopez",       email: "nicolas.lopez@luccianos.com.ar",       rol: "supervisor", encargado: "NO", sucursal: "Lucciano's Central Mar del Plata",  activo: "SI" },
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

/* ============================
   Lucciano's Academy — datos reales
   Tabla "Cursos" — los 8 módulos reales de capacitación de
   Lucciano's (extraídos del sistema SisCap en producción).
=============================*/

const cursosMock = [
    { id: 7, nombre: "Atención al Cliente",             categoria: "Servicio",     obligatorio: "SI", orden: 1 },
    { id: 1, nombre: "Cafetería",                     categoria: "Producto",     obligatorio: "SI", orden: 2 },
    { id: 2, nombre: "Heladería",                      categoria: "Producto",     obligatorio: "SI", orden: 3 },
    { id: 3, nombre: "Icepops",                         categoria: "Producto",     obligatorio: "SI", orden: 4 },
    { id: 4, nombre: "Pastelería",                      categoria: "Producto",     obligatorio: "SI", orden: 5 },
    { id: 5, nombre: "Chocolatería",                    categoria: "Producto",     obligatorio: "SI", orden: 6 },
    { id: 6, nombre: "Sistema y Caja",                  categoria: "Operaciones",  obligatorio: "SI", orden: 7 },
    { id: 8, nombre: "Encargados y Responsables",       categoria: "Gestión",      obligatorio: "NO", orden: 8 },
];

/* ============================
   Lucciano's Academy — datos reales
   Tabla "Lecciones" — Cafetería (curso 1) tiene las 26 lecciones
   reales completas con el esquema ampliado (procedimiento, errores
   frecuentes, buenas prácticas y consejo en columnas separadas). El
   resto de los cursos sigue con su contenido condensado existente
   (migrado al nuevo esquema de columnas, mismo texto que antes)
   hasta que se cargue con ese mismo nivel de detalle. El módulo 8
   (Encargados y Responsables) sigue marcado "Próximamente" — no se
   inventa contenido que todavía no existe.
=============================*/

const leccionesMock = [
    // Curso 1 — Cafetería (26 lecciones reales)
    { id: 33, cursoId: 1, orden: 3, titulo: "Vajilla", objetivo: "Reconocer visualmente cada vajilla.", duracionMinutos: 1, video: "", manual: "", imagen: "https://lh3.googleusercontent.com/d/1nWTqp2ULIMYW3bAC317IbPmkOJ6rlv7Z", procedimiento: "", errores: "", buenasPracticas: "", consejo: "", resumen: "", estado: "Activo" },
    { id: 34, cursoId: 1, orden: 4, titulo: "Cápsulas", objetivo: "", duracionMinutos: 1, video: "", manual: "", imagen: "https://lh3.googleusercontent.com/d/1SH-7bt-8-V0FgpCTu4BrsdwU4SByCk8X", procedimiento: "Finezzo Suave: perfil delicado y equilibrado. Forte: intensa, carácter fuerte y pronunciado. Ristretto: para cantidades cortas de agua, concentrado e intenso. Caramelo: saborizada, notas dulces de caramelo. Vainilla: saborizada, notas suaves de vainilla. Decaffeinato: sin cafeína.", errores: "", buenasPracticas: "", consejo: "Siempre consultar al cliente si quiere un cafe suave o cargado eso determina el uso de la capsula.", resumen: "", estado: "Activo" },
    { id: 35, cursoId: 1, orden: 5, titulo: "Espresso", objetivo: "", duracionMinutos: 1, video: "", manual: "", imagen: "https://lh3.googleusercontent.com/d/19FVK6eijSXticzSYLw91032j31y54QuH", procedimiento: "", errores: "", buenasPracticas: "Siempre preguntar primero el tamaño y luego como lo quiere.", consejo: "Esta medida se llama Espresso. sin embargo algunos clientes se refieren a la medida como pocillo.", resumen: "", estado: "Activo" },
    { id: 36, cursoId: 1, orden: 6, titulo: "Lungo", objetivo: "", duracionMinutos: 1, video: "", manual: "", imagen: "https://lh3.googleusercontent.com/d/1pC95UpBmGDOfieUQhJ4_1G4EokNEuaiG", procedimiento: "", errores: "Confundir el Americano con el Lungo — el Americano lleva agua caliente añadida, el Lungo es 100% café extraído largo.", buenasPracticas: "", consejo: "A la medida espresso lungo algunos clientes lo llaman Jarrito o algunos casos americano (refiriéndose al tamaño). es por ello que hay que conocer bien las recetas.", resumen: "La buena comunicación es la clave para evitar malos entendidos.", estado: "Activo" },
    { id: 37, cursoId: 1, orden: 7, titulo: "Cafe Latte", objetivo: "", duracionMinutos: 1, video: "", manual: "", imagen: "https://lh3.googleusercontent.com/d/19QSxoGeuEV9ttxwbo-opFRCnrfKKW9S3", procedimiento: "", errores: "Confundir \"Café con leche\" (50/50) con \"Latte\" (70% leche/30% café) — son proporciones distintas aunque ambos llevan leche.", buenasPracticas: "Usar siempre la taza grande", consejo: "", resumen: "", estado: "Activo" },
    { id: 39, cursoId: 1, orden: 9, titulo: "Mocca Latte", objetivo: "", duracionMinutos: 1, video: "", manual: "", imagen: "https://lh3.googleusercontent.com/d/1v1NoWgyNG5ADSMFLHH3CJRunT-P6mcEZ", procedimiento: "De abajo hacia arriba: salsa de chocolate (Dos push), 60% leche, 30% café, espuma arriba.", errores: "Invertir el orden de armado — la salsa va primero, abajo, no arriba.", buenasPracticas: "", consejo: "En temporada de verano los cafes especiales puedes salir fríos.\nSalsa -> Hielo -> Leche -> Cafe -> Espuma", resumen: "", estado: "Activo" },
    { id: 40, cursoId: 1, orden: 10, titulo: "Vainilla Macchiato", objetivo: "", duracionMinutos: 1, video: "", manual: "", imagen: "https://lh3.googleusercontent.com/d/1Z1Xu6jOHOWLnaXscoPBr8W3BlwDfxkDy", procedimiento: "De abajo hacia arriba: syrup de vainilla (Dos push), 60% leche, 30% café, espuma arriba.", errores: "", buenasPracticas: "", consejo: "En temporada de verano los cafes especiales puedes salir fríos.\nSalsa -> Hielo -> Leche -> Cafe -> Espuma", resumen: "", estado: "Activo" },
    { id: 41, cursoId: 1, orden: 11, titulo: "Temptation", objetivo: "", duracionMinutos: 3, video: "", manual: "", imagen: "https://lh3.googleusercontent.com/d/1luvmfoTqHJ62y-j_HioG1TNiUOqLCGBC", procedimiento: "De abajo hacia arriba: salsa de chocolate, salsa dulce de leche, 60% leche, 30% café, espuma arriba.", errores: "Omitir una de las dos salsas — el Temptation combina dulce de leche Y chocolate, no uno solo.", buenasPracticas: "", consejo: "En temporada de verano los cafes especiales puedes salir fríos.\nSalsa -> Hielo -> Leche -> Cafe -> Espuma", resumen: "", estado: "Activo" },
    { id: 42, cursoId: 1, orden: 12, titulo: "Caramel & Choco Style", objetivo: "", duracionMinutos: 1, video: "", manual: "", imagen: "https://lh3.googleusercontent.com/d/1a3AoUZ1a6WpLfMATL7XenMvTN0ZeR8ZT", procedimiento: "De abajo hacia arriba: salsa de chocolate, syrup de caramelo, 60% leche, 30% café, espuma arriba.", errores: "Confundir con el Temptation (ese es dulce de leche + chocolate, este es caramelo + chocolate).", buenasPracticas: "", consejo: "En temporada de verano los cafes especiales puedes salir fríos.\nSalsa -> Hielo -> Leche -> Cafe -> Espuma", resumen: "", estado: "Activo" },
    { id: 43, cursoId: 1, orden: 13, titulo: "Espresso Pistacho", objetivo: "", duracionMinutos: 1, video: "", manual: "", imagen: "https://lh3.googleusercontent.com/d/1r-aLaeBG0P8JOAf3X40zADkOP_nXQhda", procedimiento: "De abajo hacia arriba: avella pistacho, ristretto, crema con hilos de avella arriba. Se sirve en taza chica.", errores: "Usar espresso en vez de ristretto. Servir en taza grande en vez de chica.", buenasPracticas: "", consejo: "", resumen: "", estado: "Activo" },
    { id: 44, cursoId: 1, orden: 14, titulo: "Espresso Gianduia", objetivo: "", duracionMinutos: 1, video: "", manual: "", imagen: "https://lh3.googleusercontent.com/d/1txF6RNoY1qzdpPQP8M_u0lzBCybpVEvr", procedimiento: "De abajo hacia arriba: avella gianduia, ristretto, crema con hilos de avella arriba. Se sirve en taza chica.", errores: "Confundir con el Pistacho — la base es gianduia, no pistacho.", buenasPracticas: "", consejo: "", resumen: "", estado: "Activo" },
    { id: 45, cursoId: 1, orden: 15, titulo: "Iced Cappuccino", objetivo: "", duracionMinutos: 1, video: "", manual: "", imagen: "https://lh3.googleusercontent.com/d/1uCQkha166a9KNM4ZWUgU-Y8usPuvU0z2", procedimiento: "De abajo hacia arriba: hielo, 60% leche fría, 30% café, crema + cacao arriba. Usar siempre leche fría, nunca caliente.", errores: "Usar leche caliente — para cafetería fría siempre leche fría y hielo (regla general de todos los especiales fríos).", buenasPracticas: "", consejo: "", resumen: "", estado: "Activo" },
    { id: 46, cursoId: 1, orden: 16, titulo: "Affogato", objetivo: "", duracionMinutos: 2, video: "", manual: "", imagen: "https://lh3.googleusercontent.com/d/14Rqqa8kvuKBS7CYRBCIHEsJgMarVHGap", procedimiento: "Colocar la bocha de helado a elección del cliente en la taza, volcar 1 espresso caliente directo encima al momento de servir.", errores: "Preparar el espresso mucho antes de servir — el Affogato se arma al momento, el helado no debe derretirse antes de la mesa.", buenasPracticas: "", consejo: "", resumen: "", estado: "Activo" },
    { id: 47, cursoId: 1, orden: 17, titulo: "Presentación", objetivo: "Entender que no alcanza con la receta correcta — la excelencia está en la limpieza, la taza, la temperatura, la decoración y la entrega.", duracionMinutos: 4, video: "", manual: "", imagen: "", procedimiento: "", errores: "Servir una bebida correcta pero con la taza sucia o a temperatura incorrecta — el cliente lo percibe igual que un error de receta.", buenasPracticas: "El cliente no distingue entre \"receta perfecta mal presentada\" y \"receta mal hecha\" — para él, ambas son una mala experiencia.", consejo: "El cliente compra una experiencia, no solamente una bebida.", resumen: "", estado: "Activo" },
    { id: 48, cursoId: 1, orden: 18, titulo: "Limpieza y mantenimiento", objetivo: "Conocer las tareas de limpieza antes, durante y después del turno.", duracionMinutos: 0, video: "", manual: "", imagen: "", procedimiento: "", errores: "", buenasPracticas: "", consejo: "", resumen: "", estado: "Activo" },
    // Videos reales de uso/limpieza de máquina (Momento, Steamer, Aguila,
    // Zenius) — objetivo genérico a propósito, el contenido principal
    // lo da el video (ver apps-script/Seed.gs: agregarLeccionesMaquinasCafeteria).
    { id: 52, cursoId: 1, orden: 19, titulo: "Máquina Momento — Uso (Parte 1)", objetivo: "Aprender a usar correctamente la máquina Momento, siguiendo el procedimiento del video.", duracionMinutos: 0, video: "https://drive.google.com/file/d/1Bl49mf37Ygpkh771R20iVjmPnhaWaeO-/view", manual: "", imagen: "", procedimiento: "", errores: "", buenasPracticas: "", consejo: "", resumen: "", estado: "Activo" },
    { id: 53, cursoId: 1, orden: 20, titulo: "Máquina Momento — Uso (Parte 2)", objetivo: "Continuar con el procedimiento de uso de la máquina Momento.", duracionMinutos: 0, video: "https://drive.google.com/file/d/1aYkH2oKrzCShpWHUM2YhYBYyPLiy4m4l/view", manual: "", imagen: "", procedimiento: "", errores: "", buenasPracticas: "", consejo: "", resumen: "", estado: "Activo" },
    { id: 54, cursoId: 1, orden: 21, titulo: "Máquina Momento — Limpieza", objetivo: "Aprender el procedimiento correcto de limpieza de la máquina Momento.", duracionMinutos: 0, video: "https://drive.google.com/file/d/1B9y0evsD19bS24LInaKc7qXQZXai4Dck/view", manual: "", imagen: "", procedimiento: "", errores: "", buenasPracticas: "", consejo: "", resumen: "", estado: "Activo" },
    { id: 55, cursoId: 1, orden: 22, titulo: "Máquina Steamer — Uso (Parte 1)", objetivo: "Aprender a usar correctamente el Steamer, siguiendo el procedimiento del video.", duracionMinutos: 0, video: "https://drive.google.com/file/d/1cL10-IOF4NGsZZrwn7oH3S9hxOs3_dhT/view", manual: "", imagen: "", procedimiento: "", errores: "", buenasPracticas: "", consejo: "", resumen: "", estado: "Activo" },
    { id: 56, cursoId: 1, orden: 23, titulo: "Máquina Steamer — Uso (Parte 2)", objetivo: "Continuar con el procedimiento de uso del Steamer.", duracionMinutos: 0, video: "https://drive.google.com/file/d/1lnAU_rqLFfAdAwYnO3ei7ntO9e5omR3a/view", manual: "", imagen: "", procedimiento: "", errores: "", buenasPracticas: "", consejo: "", resumen: "", estado: "Activo" },
    { id: 57, cursoId: 1, orden: 24, titulo: "Máquina Aguila — Uso (Parte 1)", objetivo: "Aprender a usar correctamente la máquina Aguila, siguiendo el procedimiento del video.", duracionMinutos: 0, video: "https://drive.google.com/file/d/14fAnAbP0vLh0aoNcjGn8y_kViWRbPJDf/view", manual: "", imagen: "", procedimiento: "", errores: "", buenasPracticas: "", consejo: "", resumen: "", estado: "Activo" },
    { id: 58, cursoId: 1, orden: 25, titulo: "Máquina Aguila — Uso (Parte 2)", objetivo: "Continuar con el procedimiento de uso de la máquina Aguila.", duracionMinutos: 0, video: "https://drive.google.com/file/d/1wMDPTA0IrXhMBqbmJ3ABUxw_mXIcPYBQ/view", manual: "", imagen: "", procedimiento: "", errores: "", buenasPracticas: "", consejo: "", resumen: "", estado: "Activo" },
    { id: 59, cursoId: 1, orden: 26, titulo: "Máquina Aguila — Limpieza", objetivo: "Aprender el procedimiento correcto de limpieza de la máquina Aguila.", duracionMinutos: 0, video: "https://drive.google.com/file/d/1eJrGauaYdJsFuOQr8T7Rxwv-lWGO2Nq-/view", manual: "", imagen: "", procedimiento: "", errores: "", buenasPracticas: "", consejo: "", resumen: "", estado: "Activo" },
    { id: 60, cursoId: 1, orden: 27, titulo: "Máquina Zenius — Uso y Limpieza", objetivo: "Aprender el procedimiento de uso y limpieza de la máquina Zenius.", duracionMinutos: 0, video: "https://drive.google.com/file/d/1RC_h8sCRaMbjdwhhFIfBSRbKd7KSlduX/view", manual: "", imagen: "", procedimiento: "", errores: "", buenasPracticas: "", consejo: "", resumen: "", estado: "Activo" },

    { id: 49, cursoId: 1, orden: 28, titulo: "Errores Frecuentes", objetivo: "Reconocer los errores más comunes para prevenirlos desde el inicio: cápsula equivocada, taza incorrecta, receta incorrecta, decoración faltante, presentación deficiente.", duracionMinutos: 5, video: "", manual: "", imagen: "", procedimiento: "", errores: "❌ Cápsula equivocada (ej: Caramelo en vez de Forte). ❌ Taza incorrecta (ej: chica para Lungo en vez de mediana). ❌ Proporción incorrecta (confundir Cortado 70/30 con Mitad y Mitad 50/50). ❌ Decoración faltante (Capuccino sin crema y cacao). ❌ Leche caliente en bebida fría.", buenasPracticas: "Revisar vajilla + cápsula + proporción + decoración antes de entregar, no después de que el cliente se queja.", consejo: "", resumen: "", estado: "Activo" },
    { id: 51, cursoId: 1, orden: 30, titulo: "Próximo paso", objetivo: "", duracionMinutos: 0, video: "", manual: "", imagen: "", procedimiento: "Completaste el Curso de Cafetería.", errores: "", buenasPracticas: "", consejo: "", resumen: "", estado: "Activo" },

    // Curso 2 — Heladería (6 lecciones de proceso — los sabores se aprenden del catálogo de productos, no de texto)
    { id: 78, cursoId: 2, orden: 1, titulo: "Menú Kosher", objetivo: "Conocer el menú Kosher y distinguir Parve de Dairy — certificado por rabino.", duracionMinutos: 0, video: "", manual: "", imagen: "", procedimiento: "1) Parve: vegano, sin lácteos. 2) Dairy: con lácteos.", errores: "", buenasPracticas: "", consejo: "", resumen: "", estado: "Activo" },
    { id: 5, cursoId: 2, orden: 2, titulo: "Gramajes y presentaciones", objetivo: "Conocer el peso correcto de cada tamaño de helado y las presentaciones de pote Take Away.", duracionMinutos: 0, video: "", manual: "", imagen: "assets/img/cursos/heladeria-gramajes.png", procedimiento: "", errores: "", buenasPracticas: "Take Away: armar con folex de contacto + cinta cierra pote y bolsa, verificando que el pote esté perfectamente limpio.", consejo: "", resumen: "", estado: "Activo" },
    { id: 6, cursoId: 2, orden: 3, titulo: "Cucuruchos gourmet", objetivo: "Preparar correctamente los cucuruchos gourmet.", duracionMinutos: 0, video: "", manual: "", imagen: "assets/img/cursos/heladeria-cucurucho-avella.jpg", procedimiento: "Los cucuruchos gourmet (Avellana y Pistacho) llevan 2 pushes de Avella y su cialdino (oblea) exclusivo.", errores: "", buenasPracticas: "", consejo: "", resumen: "", estado: "Activo" },
    { id: 7, cursoId: 2, orden: 4, titulo: "Pase de Helado y Reposición", objetivo: "Aplicar correctamente el traspaso de helado entre vaquetas (pase de helado) y la reposición y rearmado de vasquetas al 50% en vitrina.", duracionMinutos: 0, video: "", manual: "", imagen: "", procedimiento: "1) Cuando se hace el traspaso del helado de una vaqueta a otra se llama PASE DE HELADO — se completan ambas mitades entre vitrina y armario para mantener la presentación acorde a la exhibición, identificando los helados como COMPLETOS e INCOMPLETOS. 2) Retirar de la vitrina la vasqueta de helado que esté al 50%. 3) Colocar en la vitrina una vasqueta nueva del armario, con cuchara fría, en la parte inferior del lado derecho. 4) Guardar la vasqueta que se retiró al 50%, colocándole su tapa o bolsa y guardarla en el armario. 5) Presentar las dos mitades de helado sobre la mesa de trabajo y elegir la que tenga mejor apariencia. 6) Completar esa vasqueta y dejar la superficie final plana. 7) Colocar los picos sobre la superficie plana y limpiar todos los bordes con papel descartable. 8) Colocarlo en el abatidor de 3 a 4 minutos. 9) Sanitizar y secar la estaca. 10) Presentar el helado correctamente. 11) Exhibir el helado en el lugar correspondiente.", errores: "", buenasPracticas: "Tipos de vaqueta: ACRÍLICO (plástico duro) y PLÁSTICO (va dentro de la de acrílico como contenedor interior). En caso de vaqueta rota de plástico: cortar ambos extremos y pasar a una de acrílico. Previo a la manipulación de los helados, lavarse las manos correctamente y colocarse guantes de látex.", consejo: "Repetir este procedimiento cada vez que haya que reponer una vasqueta al 50%. Al rearmar, unificar el contenido de ambas vasquetas conservando los picos de la presentación.", resumen: "", estado: "Activo" },
    { id: 97, cursoId: 2, orden: 5, titulo: "Peinado Frutales", objetivo: "Aplicar correctamente la técnica de peinado (picos) sobre los sabores frutales, con su decoración final.", duracionMinutos: 0, video: "", manual: "", imagen: "", procedimiento: "", errores: "", buenasPracticas: "", consejo: "", resumen: "", estado: "Activo" },
    { id: 8, cursoId: 2, orden: 6, titulo: "Apertura de vitrinas y control de temperatura", objetivo: "Ejecutar correctamente la apertura de vitrinas y vasquetas, y mantener la temperatura correcta.", duracionMinutos: 0, video: "", manual: "", imagen: "", procedimiento: "1) Encender las vitrinas y aguardar a que alcancen la temperatura correcta para exhibir. 2) Presentar en vitrina los helados que quedaron en el armario de completos, también los icepops. 3) Armado y decoración de vasquetas: colocar estacas o cartel de sabor y los variegatos correspondientes. 4) Controlar la temperatura del helado y de la heladera.", errores: "", buenasPracticas: "Temperatura de la heladera: -13° a -16°C en verano, -12° a -14°C en invierno.", consejo: "", resumen: "", estado: "Activo" },
    { id: 9, cursoId: 2, orden: 7, titulo: "Baño de Chocolate", objetivo: "Preparar correctamente el baño de chocolate para los helados.", duracionMinutos: 0, video: "", manual: "", imagen: "", procedimiento: "Marca: Mapricoa. Temperatura ideal: 30–40°C.", errores: "", buenasPracticas: "", consejo: "Si no se adhiere, posiblemente hay que cambiar el chocolate.", resumen: "", estado: "Activo" },
    { id: 80, cursoId: 2, orden: 8, titulo: "Batidos", objetivo: "Preparar correctamente los 5 batidos del menú: Smoothie, Milk Shake y las 3 variedades de Gelato Shake.", duracionMinutos: 0, video: "", manual: "", imagen: "", procedimiento: "Smoothie: batido con 2 bochas frutales a elección + 200ml de soda fría — 2 bochas de helados frutales a elección del cliente (160g), agregar 200ml de soda fría, licuar hasta lograr un Smoothie suave, servir con tapa y sorbete. Milk Shake: 2 bochas a elección + leche + salsa + crema — 2 bochas de helado a elección (160g), agregar 200ml de leche fría, decorar el interior del vaso con salsa antes de servir, licuar y volcar suavemente en el vaso, terminar con círculos de crema, cacao en polvo o salsa, colocar tapa y sorbete. Gelato Shake (Cookies & Cream, Dulce de Leche, Tiramisú): batido con helado, leche, café y crema — 2 bochas del sabor elegido (160g), agregar 100ml de leche fría, colocar un café espresso con cápsula Ristretto, licuar y servir en vaso de Nespresso con collarín, agregar crema y decoración según el sabor (cookies, salsa DDL o cacao en polvo), entregar con sorbete.", errores: "", buenasPracticas: "", consejo: "Usar siempre leche bien fría y cápsula de café Ristretto para los Gelato Shake.", resumen: "", estado: "Activo" },
    { id: 77, cursoId: 2, orden: 9, titulo: "Variegatos y Decoraciones", objetivo: "Aplicar correctamente cada variegato y decoración según el sabor.", duracionMinutos: 0, video: "", manual: "", imagen: "", procedimiento: "Stracciatella (se calienta en jarrita al microondas 15-20 segundos, se arroja en forma de hilos sobre Dulce de Leche Granizado, Banana Split, Menta Granizada y Peanut Caramel). Dulce de Leche Repostero (se coloca en manga, se conserva en heladera, se aplica en forma de gota grande sobre los picos, va en Dulce de Leche, Peanut Caramel, Tramontana y Banana Split). Mascarpone c/ Frutos del Bosque (variegato de frutos rojos). Mousse de Maracuyá (variegato de maracuyá con semillas). Tramontana (salsa de caramelo + microgalletitas por encima). Cheesecake al Pistacchio (200g de crumble de pistacho en toda la superficie). Tiramisú (cacao en polvo por encima). Tiramisú al Pistacchio (cacao solo en los laterales, granella en el centro, 2 vainillas adelante).", errores: "", buenasPracticas: "Los sabores frutales llevan fruta cortada del mismo sabor como decoración.", consejo: "", resumen: "", estado: "Activo" },
    { id: 81, cursoId: 2, orden: 10, titulo: "Armado de cucurucho", objetivo: "Armar correctamente un cucurucho.", duracionMinutos: 0, video: "", manual: "", imagen: "", procedimiento: "", errores: "", buenasPracticas: "", consejo: "", resumen: "", estado: "Activo" },
    { id: 82, cursoId: 2, orden: 11, titulo: "Armado de vaso", objetivo: "Armar correctamente un vaso de helado.", duracionMinutos: 0, video: "", manual: "", imagen: "", procedimiento: "", errores: "", buenasPracticas: "", consejo: "", resumen: "", estado: "Activo" },

    // Curso 3 — Icepops (10 lecciones: intro + 8 categorías de sabor + rotación de stock)
    { id: 10, cursoId: 3, orden: 1, titulo: "Cómo describir un Icepop", objetivo: "Describir correctamente un icepop de adentro hacia afuera", duracionMinutos: 0, video: "", manual: "", imagen: "", procedimiento: "Se describe primero el relleno y luego el baño. Solo existen 3 tipos de baño: chocolate blanco, con leche y negro — cualquier color es siempre chocolate blanco teñido.", errores: "", buenasPracticas: "", consejo: "", resumen: "", estado: "Activo" },
    { id: 69, cursoId: 3, orden: 2, titulo: "Sabores: Fruta", objetivo: "Conocer las 4 variedades de la categoría Fruta (todas Parve).", duracionMinutos: 0, video: "", manual: "", imagen: "", procedimiento: "Multifruta (jugo de limones naturales, decorado con mandarina, frutilla y kiwi). Frutilla. Mandarina. Limón (jugo de limones naturales exprimidos en el momento).", errores: "", buenasPracticas: "", consejo: "", resumen: "", estado: "Activo" },
    { id: 70, cursoId: 3, orden: 3, titulo: "Sabores: Crema", objetivo: "Conocer las 4 variedades de la categoría Crema (todas Dairy).", duracionMinutos: 0, video: "", manual: "", imagen: "", procedimiento: "Mascarpone (veteado de frutos del bosque de la Patagonia). Menta con Chocolate (menta italiana, veteado con stracciatella). Chocolate Lucciano's con Bombón de Avellanas (crema de chocolate, avellanas crujientes y obleas). Frutilla con Chantilly.", errores: "", buenasPracticas: "", consejo: "", resumen: "", estado: "Activo" },
    { id: 71, cursoId: 3, orden: 4, titulo: "Sabores: Bañados", objetivo: "Conocer las 15 variedades de la categoría Bañados, la más amplia de la carta.", duracionMinutos: 0, video: "", manual: "", imagen: "", procedimiento: "King Bianco (avellanas, veteado de avellanas y chocolate blanco). Crema Chantilly (baño semiamargo, maní caramelizado). Dulce de Leche & Crocante (baño blanco, maní caramelizado). Chocolate & Crocante (baño semiamargo, maní caramelizado). Sorbete Patagonia (frutos rojos, baño blanco). Chocolate Lucciano's con Dulce de Leche (baño semiamargo). Peanut Caramel (crema de maní, stracciatella, DDL y maní salado). Dulce de Leche & Cookies (baño con leche, galletitas). Cookies & Cream (chantilly, avella black, baño blanco, galletitas). Oli Chocolate Platino (baño con leche, huellas con maní caramelizado). Oli Dolca (bananita dolca, baño semiamargo, huellas blancas). Oli King (avellana, baño blanco, huellas con stracciatella). Vito Crema del Cielo (baño blanco, granas multicolores). Fiore Frutilla a la Crema (baño blanco, granas multicolores). Chocolate Blanco & Pistacchio Crock — NUEVO (veteado de Avella Pistacchio, crocante de pistacchio).", errores: "", buenasPracticas: "", consejo: "", resumen: "", estado: "Activo" },
    { id: 72, cursoId: 3, orden: 5, titulo: "Sabores: Luxury", objetivo: "Conocer las 12 variedades de la línea Luxury.", duracionMinutos: 0, video: "", manual: "", imagen: "", procedimiento: "0% Azúcar Agregada Chocolate con Leche. Jameson Icepop (ganache de chocolate blanco sabor whisky Jameson, baño belga 72%). Double Chocolate & King (chocolate blanco veteado con chocolate con leche y avellanas, doble baño). Double Chocolate & Chocolate (doble baño blanco y semiamargo). Vegan 72% (sorbete de chocolate, Parve). Pistacchio (baño blanco sabor pistacchio). Cheesecake de Maracuyá (crema de yogurt y mascarpone, baño blanco). Enzo Dulce de Leche con Gianduia (relleno DDL con corazón gianduia, contiene avellanas). Tonio — Cookies & Cream (veteado de cookies y avellanas, decoración artesanal). Minion (sabor king con avellana, baño blanco decorado azul y amarillo). Icepop Chocotorta (DDL, queso crema, galletita entera, baño blanco). Icepop Flan con DDL & Caramelo (corazón de caramelo, baño blanco).", errores: "", buenasPracticas: "", consejo: "", resumen: "", estado: "Activo" },
    { id: 73, cursoId: 3, orden: 6, titulo: "Dubai — presentación especial", objetivo: "Conocer el Icepop Dubai y su presentación diferencial.", duracionMinutos: 0, video: "", manual: "", imagen: "", procedimiento: "Icepop Dubai: chocolate belga relleno de Avella Dubai, con crocante que emula el Kadayif, bañado en chocolate semiamargo. Única variedad de la categoría — se vende en presentación Icepop + lata, distinta al resto de la carta.", errores: "", buenasPracticas: "", consejo: "", resumen: "", estado: "Activo" },
    { id: 74, cursoId: 3, orden: 7, titulo: "Cannoli", objetivo: "Conocer las 6 variedades de Cannoli (obleas rellenas de helado, bañadas en chocolate).", duracionMinutos: 0, video: "", manual: "", imagen: "", procedimiento: "Pistacchio (baño blanco sabor pistacchio, trozos de pistacchio). Dulce de Leche (baño con leche, trozos de maní). Dulce de Leche Repostero (baño blanco con coco). Gianduia (avella gianduia, baño semiamargo, trozos de avellana). Alfajor (baño semiamargo). Yogurt de Frutilla (baño con leche).", errores: "", buenasPracticas: "", consejo: "", resumen: "", estado: "Activo" },
    { id: 75, cursoId: 3, orden: 8, titulo: "Geladot", objetivo: "Conocer las 8 variedades de Geladot y sus presentaciones Medium x18 y Large x32.", duracionMinutos: 0, video: "", manual: "", imagen: "", procedimiento: "Frutilla (baño con leche). King Bianco (baño blanco). Frambuesa (baño con leche). Chocolate Dark 72% (baño dark). Pistacchio (baño blanco sabor pistacchio). Sambayón (baño semiamargo). Dulce de Leche (baño con leche). Gianduia (baño semiamargo).", errores: "", buenasPracticas: "Presentaciones: Medium x18 y Large x32, además de la venta por unidad. El cliente puede combinar sabores dentro de una misma presentación.", consejo: "", resumen: "", estado: "Activo" },
    { id: 12, cursoId: 3, orden: 9, titulo: "Mini Icepops", objetivo: "Conocer las 7 variedades de Mini Icepops, caja x4.", duracionMinutos: 0, video: "", manual: "", imagen: "", procedimiento: "Mini Avellanas & Chocolate (cubiertos con chocolate con leche y crocante de avellanas). Mini Chocolate (bañados en chocolate semiamargo y crocante de maní). Mini Dulce de Leche (cubiertos con chocolate blanco y crocante de maní). Mini Dulce de Leche & Cookies (bañados con chocolate con leche y galletitas de chocolate). Mini Cookies & Cream (bañados en chocolate blanco y galletitas de chocolate). Mini Pistacchio (bañados en chocolate blanco sabor pistacchio y crocante de pistacchio). Mini Chocolate Blanco & Pistacchio Crock — NUEVO (veteado de Avella Pistacchio, cubierto con chocolate blanco y crocante de pistacchio).", errores: "", buenasPracticas: "Se venden en caja x4 unidades.", consejo: "", resumen: "", estado: "Activo" },
    { id: 13, cursoId: 3, orden: 10, titulo: "Rotación de stock y opciones especiales", objetivo: "Aplicar el criterio de rotación y reconocer productos sin gluten/sin azúcar", duracionMinutos: 0, video: "", manual: "", imagen: "", procedimiento: "Al reponer la vitrina siempre se ubican los productos nuevos atrás y los más viejos adelante (primero en entrar, primero en salir). Hay 8 variedades sin gluten en potes individuales de 190g, incluyendo 2 sorbetes veganos.", errores: "", buenasPracticas: "", consejo: "", resumen: "", estado: "Activo" },
    { id: 76, cursoId: 3, orden: 11, titulo: "Presentación y Take Away", objetivo: "Aplicar correctamente el armado de Icepop Take Away y la entrega para consumo inmediato.", duracionMinutos: 0, video: "", manual: "", imagen: "", procedimiento: "Icepop Take Away (bolsa térmica + cinta de cierre; verificar que la bolsa esté perfectamente limpia). Consumo Ahora Icepop (se entrega en mano, con servilleta).", errores: "", buenasPracticas: "", consejo: "", resumen: "", estado: "Activo" },

    // Curso 4 — Pastelería
    { id: 14, cursoId: 4, orden: 1, titulo: "Tortas", objetivo: "Conocer las 12 variedades de mini tortas y su vencimiento.", duracionMinutos: 0, video: "", manual: "", imagen: "", procedimiento: "Red Velvet (cheese frosting, migas rojas). Carrot Cake (cheese frosting, nuez crocante). Mousse de Chocolate (base húmeda, ganache brillante). Brownie con Dulce de Leche (merengue italiano flambeado). Rogel (capas crocantes, DDL, merengue). Crumble de Manzana (sablée, manzanas con canela, crumble). Chocotorta (galletitas embebidas en almíbar de café). Oreo Cake (galletitas, DDL, queso crema, ganache blanca). Lemon Pie (crema de limón, merengue flambeado, menta). Tiramisú (biscuit con café, crema queso, cacao amargo). Cheesecake con Salsa de Frutos Rojos (menta fresca). Torta de Coco (DDL, crumble de coco, coco rallado).", errores: "", buenasPracticas: "Vida útil: 4 días.", consejo: "", resumen: "", estado: "Activo" },
    { id: 15, cursoId: 4, orden: 2, titulo: "Pastelería fresca", objetivo: "Conocer los 4 productos de pastelería fresca del día.", duracionMinutos: 0, video: "", manual: "", imagen: "", procedimiento: "Budín de Limón (semillas de amapola, glaseado de jugo de limón). Budín Marmolado (vainilla y chocolate, glaseado de chocolate). Brownie Húmedo con Nuez. Tostadas de Pan Casero (dip de queso crema, mermelada o dulce de leche, 3 unidades).", errores: "", buenasPracticas: "", consejo: "", resumen: "", estado: "Activo" },
    { id: 16, cursoId: 4, orden: 3, titulo: "Vencimientos", objetivo: "Aplicar correctamente los tiempos de vencimiento de cada producto", duracionMinutos: 0, video: "", manual: "", imagen: "", procedimiento: "Medialunas y croissants vencen a diario, rolls y pain cada 2 días, y las tortas cada 4 días.", errores: "", buenasPracticas: "", consejo: "", resumen: "", estado: "Activo" },
    { id: 17, cursoId: 4, orden: 4, titulo: "Cocción", objetivo: "Conocer los 6 productos de cocción y aplicar el procedimiento correcto de horneado.", duracionMinutos: 0, video: "", manual: "", imagen: "", procedimiento: "Productos: Croissant, Medialunas (x2), Roll de Frambuesa, Roll de Canela, Pain de Manzana, Pain de Chocolate. Cocción: se descongelan en heladera 8-10hs o a temperatura ambiente 1 hora, se pincelan con huevo, y se cocinan a 200°C bajando a 175°C: 15 minutos, se rota la bandeja, y 10-15 minutos más hasta dorar. Los productos dulces se pincelan con almíbar al salir calientes.", errores: "", buenasPracticas: "", consejo: "", resumen: "", estado: "Activo" },

    // Curso 5 — Chocolatería (7 lecciones reales, con fotos de producto)
    { id: 18, cursoId: 5, orden: 1, titulo: "Alfajores", objetivo: "Conocer las 6 variedades de alfajores clásicos y las presentaciones en Mini Alfajores.", duracionMinutos: 0, video: "", manual: "", imagen: "", procedimiento: "6 variedades (Semiamargo, Blanco, Dark, Blanco & Nuez, Pistacchio, Frutos Rojos) de 80g, todos rellenos de dulce de leche. Presentaciones: Unidad, Caja x6, Caja x10, Lata x5, Mini x12. Composición de cajas: Caja x6 (2 Semiamargo, 2 Blanco, 1 Dark, 1 Nuez), Caja x10 (3 Semiamargo, 3 Blanco, 2 Dark, 2 Nuez), Lata x5 (1 Semiamargo, 1 Blanco, 1 Dark, 1 Nuez, 1 Pink). Mini Alfajores: Surtidos x12 (3 Semiamargo, 3 Blanco, 3 Dark y 3 Blanco & Nuez, 40g c/u) y Pistacchio x12 (40g c/u, con corazón de Avella Pistacchio).", errores: "", buenasPracticas: "Vida útil: 70 días los clásicos, 60 días Pistacho y Frutos Rojos.", consejo: "", resumen: "", estado: "Activo" },
    { id: 19, cursoId: 5, orden: 2, titulo: "Conitos", objetivo: "Conocer las 4 variedades de conitos rellenos de dulce de leche.", duracionMinutos: 0, video: "", manual: "", imagen: "https://lh3.googleusercontent.com/d/12zI5brn8k7XBmTNms7KTTocaIUlzwig4", procedimiento: "4 sabores: Chocolate Semiamargo, Chocolate Blanco, Pistacchio (con corazón de Avella Pistacchio, recubierto con chocolate belga sabor pistacchio) y Frutos Rojos (con corazón de frutos rojos, cubierto con chocolate blanco belga sabor frutos rojos). Presentaciones: Unidad y Caja x6.", errores: "", buenasPracticas: "Vida útil: 60 días los clásicos, 45 días Pistacho y Frutos Rojos.", consejo: "", resumen: "", estado: "Activo" },
    { id: 61, cursoId: 5, orden: 3, titulo: "Viennesi", objetivo: "Conocer las 3 variedades de Viennesi y sus formas de venta.", duracionMinutos: 0, video: "", manual: "", imagen: "https://lh3.googleusercontent.com/d/1MOALGmSc-zoUm5f0_wHoptK8TqUDq2YT", procedimiento: "Obleas de origen italiano en 3 variedades: Fondente (crema de chocolate, bañadas en chocolate dark), Clásico (crema de vainilla, recubiertas con chocolate con leche) y Pistacchio (crema de pistacchio, cubiertas con chocolate blanco). Se venden de forma individual, en caja x4 unidades de un mismo sabor, o en caja surtida x9 unidades (3 de cada variedad).", errores: "", buenasPracticas: "", consejo: "Cómo ofrecerlo al cliente: \"Obleas rellenas de crema, cubiertas en chocolate.\"", resumen: "", estado: "Activo" },
    { id: 62, cursoId: 5, orden: 4, titulo: "Avella", objetivo: "Conocer los 6 sabores de Avella en frasco y los packs Avella Collection.", duracionMinutos: 0, video: "", manual: "", imagen: "https://lh3.googleusercontent.com/d/17TbbRk7CoaLap5aWc5_PtHd8WfOd1Q08", procedimiento: "6 sabores en frasco de 200g, libre de gluten: Gianduia (avellanas y cacao), Pistacchio, Pistacchio Crock (más crujiente), Dubai (crema de pistacchio con crocante estilo kadayif — es el relleno de las Tabletas Dubai), Gianduia Crock y Coco Rock (chocolate blanco y coco con coco rallado). Avella Collection Pack x3: Clásico (Pistacchio + Pistacchio Crock + Gianduia), Pistacchio (Pistacchio + Pistacchio Crock + Dubai) y Dubai (3 Avella Dubai) — packaging premium pensado para regalo.", errores: "", buenasPracticas: "", consejo: "", resumen: "", estado: "Activo" },
    { id: 20, cursoId: 5, orden: 5, titulo: "Tabletas de Chocolate", objetivo: "Conocer las 16 variedades de tabletas de chocolate belga y los packs x6.", duracionMinutos: 0, video: "", manual: "", imagen: "https://lh3.googleusercontent.com/d/1-GeN5XUGmZ1CWrtjd2ThCV6PtV3Mhc5E", procedimiento: "Con Leche: Chocolate con Leche, con Dulce de Leche, con Almendras, con Avellanas, sin Azúcar, Dubai con Leche. Chocolate Negro: Dark 70%, 54% con Avellanas, Dubai Semiamargo. Blanco: Chocolate Blanco, sin Azúcar, con Caramelo y Avellanas, con Avella Latte Crock, Frutos del Bosque. Pistacho: con granella, con Avella Pistacho. Pack Negro x6: Chocolate con Leche con DDL, Chocolate con Leche, Pistacho con granella, Pistacho con Avella Pistacho, Chocolate Dark, Chocolate Frutos del Bosque. Pack Blanco x6: Chocolate con Leche con DDL, Chocolate Blanco, Pistacho con granella, Pistacho con Avella Pistacho, Chocolate Blanco con Caramelo y Avellanas, Chocolate Blanco con Avella Latte Crock.", errores: "", buenasPracticas: "Conservar en lugar fresco y seco. Temperatura ambiente máxima 18°C. No exponer a luz directa. No armar más de 6 cajas en exhibición. No guardar en heladera con temperatura menor a 6°C. No congelar.", consejo: "Cuando el cliente muestra interés: ofrecer Pack Negro o Pack Blanco (precio fijo), o armar 6 tabletas a elección — la caja es de cortesía (cobrar por SKU individual).", resumen: "", estado: "Activo" },
    { id: 21, cursoId: 5, orden: 6, titulo: "Latas y presentaciones especiales", objetivo: "Armar correctamente las latas carrusel y la lata corazón", duracionMinutos: 0, video: "", manual: "", imagen: "https://lh3.googleusercontent.com/d/1_KT-89hb1sW1FcZavhBmF-LhTmE5PgBv", procedimiento: "Lata Verde (Pistacho): 4 Mini Alfajores Pistacho, 3 Conitos Pistacho, 3 Viennesi Pistacho, 2 Squares Choco Pistacho, 2 Squares Choco Pistacho con Avella Pistacho. Lata Bordó (Clásica): 2 Mini Alfajores Semiamargo, 2 Mini Alfajores Blanco, 2 Mini Alfajores Nuez, 2 Conitos Blanco, 1 Conito Semiamargo, 2 Squares Choco Leche, 2 Squares Choco Blanco. Lata Negra (Dark): 4 Mini Alfajores Dark, 2 Mini Alfajores Semiamargo, 3 Conitos Semiamargo, 4 Squares (2 leche y avellanas + 2 semiamargo). Lata Corazón: 12 bombones de chocolate con leche rellenos de DDL.", errores: "La unidad exhibida no debe venderse — al momento de la venta, entregar una unidad del stock disponible o armarla en el momento. Aplica para todo el sector de merchandising.", buenasPracticas: "", consejo: "", resumen: "", estado: "Activo" },
    { id: 63, cursoId: 5, orden: 7, titulo: "Squares", objetivo: "Conocer Squares, el lanzamiento nuevo de Lucciano's (desde el 25/06), y cómo exhibirlo y conservarlo correctamente.", duracionMinutos: 0, video: "", manual: "", imagen: "https://lh3.googleusercontent.com/d/1icDCf1KVkpSDyoFP2xYHifL6TTGYXTPZ", procedimiento: "Selección de chocolates en formato cuadrado, en cajas surtidas — 2 presentaciones, ambas con 12 cajas por caja máster. Square Surtidos x18 (Cód. caja máster 1661, SKU 916): 6 variedades, 3 unidades de cada una — Chocolate Blanco, Pistacchio con granella, Caramel Gold, Chocolate con Leche, Con Leche y granella de avellana, Semiamargo. Square Surtidos x32 (Cód. caja máster 1662, SKU 917): 32 unidades surtidas — 4u de cada: Chocolate Blanco, Pistacchio con granella, Caramel Gold, Chocolate con Leche, Con Leche y granella de avellana, Semiamargo, Pistacchio relleno con Avella Pistacchio, Con Leche relleno con Avella Gianduia.", errores: "", buenasPracticas: "Exhibición permitida únicamente en exhibidoras de chocolates con temperatura controlada, muebles del sector de cajas, o estanterías previamente aprobadas — no se puede exhibir sobre mostradores ni mesadas de atención en caja. Si el local no tiene exhibidor habilitado, el producto se mantiene en stock/depósito y se ofrece igual ante la consulta del cliente. Conservación: lugar fresco y seco, máximo 18°C ambiente, no exponer al sol, no refrigerar por debajo de 6°C, no congelar. Manipular con cuidado para evitar roturas en el packaging.", consejo: "Cómo ofrecerlo al cliente: \"Una selección de chocolates en formato cuadrado, presentados en cajas surtidas — ideal para regalar, compartir y disfrutar en distintas ocasiones.\"", resumen: "", estado: "Activo" },
    { id: 96, cursoId: 5, orden: 8, titulo: "Tableta Dubai Pistacchio", objetivo: "Conocer la Tableta Dubai Pistacchio, el lanzamiento nuevo de Lucciano's (desde el 16/07), y cómo exhibirla y conservarla correctamente.", duracionMinutos: 0, video: "", manual: "", imagen: "assets/img/cursos/chocolateria-dubai-pistacchio.jpg", procedimiento: "Tableta de chocolate pistacchio, rellena con Avella Dubai, pistacchios garrapiñados y granella de pistacchio en la base. Presentación: caja máster con 12 tabletas individuales (código de producto 1676, SKU 922). Precio de venta: $27.000.", errores: "", buenasPracticas: "Exhibición permitida únicamente en exhibidoras de chocolates con temperatura controlada, muebles del sector de cajas, o estanterías previamente aprobadas — no se puede exhibir sobre mostradores ni mesadas de atención en caja. Si el local no tiene exhibidor habilitado, el producto se mantiene en stock/depósito y se ofrece igual ante la consulta del cliente, para no perder la venta. Conservación: lugar fresco y seco, máximo 18°C ambiente, no exponer al sol, no refrigerar por debajo de 6°C, no congelar — es un producto sensible al calor. Manipular con cuidado para evitar roturas en el packaging.", consejo: "Cómo ofrecerlo al cliente: \"Chocolate pistacchio relleno con nuestra Avella Dubai, con pistacchios garrapiñados y granella de pistacchio — la versión más crocante de la línea Dubai.\"", resumen: "", estado: "Activo" },

    // Curso 6 — Sistema y Caja
    { id: 22, cursoId: 6, orden: 1, titulo: "Apertura del local", objetivo: "Ejecutar correctamente la secuencia de apertura", duracionMinutos: 0, video: "", manual: "", imagen: "", procedimiento: "Llegada 1 hora antes, desactivación de alarma (ventana de 30 segundos), encendido de PC, conciliación del cierre del día anterior, carga de caja inicial, prueba de posnet y verificación de sanitizantes antes de abrir las puertas.", errores: "", buenasPracticas: "", consejo: "", resumen: "", estado: "Activo" },
    { id: 23, cursoId: 6, orden: 2, titulo: "Ingreso de personal e inicio de caja", objetivo: "Realizar correctamente el fichaje y la apertura de caja", duracionMinutos: 0, video: "", manual: "", imagen: "", procedimiento: "", errores: "", buenasPracticas: "", consejo: "", resumen: "", estado: "Activo" },
    { id: 24, cursoId: 6, orden: 3, titulo: "Facturación en efectivo y con tarjeta", objetivo: "Facturar correctamente ventas en efectivo y con tarjeta", duracionMinutos: 0, video: "", manual: "", imagen: "", procedimiento: "", errores: "", buenasPracticas: "", consejo: "", resumen: "", estado: "Activo" },
    { id: 25, cursoId: 6, orden: 4, titulo: "Mercado Pago y contingencias", objetivo: "Facturar con Mercado Pago y resolver cortes de sistema", duracionMinutos: 0, video: "", manual: "", imagen: "", procedimiento: "", errores: "", buenasPracticas: "", consejo: "", resumen: "", estado: "Activo" },
    { id: 83, cursoId: 6, orden: 5, titulo: "Cierre y arqueo de caja", objetivo: "Arquear y cerrar correctamente la caja diaria", duracionMinutos: 0, video: "", manual: "", imagen: "", procedimiento: "", errores: "", buenasPracticas: "", consejo: "", resumen: "", estado: "Activo" },
    { id: 84, cursoId: 6, orden: 6, titulo: "Tipos de factura", objetivo: "Emitir correctamente Factura A, ventas sin cargo y descuentos de empleado", duracionMinutos: 0, video: "", manual: "", imagen: "", procedimiento: "", errores: "", buenasPracticas: "", consejo: "", resumen: "", estado: "Activo" },
    { id: 85, cursoId: 6, orden: 7, titulo: "Caja fuerte y depósitos", objetivo: "Operar correctamente la caja fuerte y el retiro para depósito bancario", duracionMinutos: 0, video: "", manual: "", imagen: "", procedimiento: "", errores: "", buenasPracticas: "", consejo: "", resumen: "", estado: "Activo" },
    { id: 86, cursoId: 6, orden: 8, titulo: "Ingresos y egresos de caja diaria", objetivo: "Registrar correctamente movimientos de dinero que no son ventas", duracionMinutos: 0, video: "", manual: "", imagen: "", procedimiento: "", errores: "", buenasPracticas: "Elegir siempre el concepto correcto de la lista — no dejarlo en \"No especificado\", porque después no se puede reconstruir en qué se fue la plata del día.", consejo: "", resumen: "", estado: "Activo" },
    { id: 87, cursoId: 6, orden: 9, titulo: "Gift Cards", objetivo: "Canjear correctamente una Gift Card y consultar su historial de uso", duracionMinutos: 0, video: "", manual: "", imagen: "", procedimiento: "", errores: "", buenasPracticas: "", consejo: "", resumen: "", estado: "Activo" },
    { id: 88, cursoId: 6, orden: 10, titulo: "Pedidos Ya y delivery", objetivo: "Gestionar correctamente pedidos de delivery telefónico y de Pedidos Ya", duracionMinutos: 0, video: "", manual: "", imagen: "", procedimiento: "", errores: "", buenasPracticas: "Si el pedido es efectivo, esperar a que llegue el cadete para que lo abone y así evitar errores en la caja diaria.", consejo: "", resumen: "", estado: "Activo" },
    { id: 89, cursoId: 6, orden: 11, titulo: "Posnet y lotes de tarjeta", objetivo: "Operar correctamente el posnet y controlar los lotes de tarjeta", duracionMinutos: 0, video: "", manual: "", imagen: "", procedimiento: "", errores: "", buenasPracticas: "Arquear el posnet contra el sistema todos los días para confirmar que no haya diferencias.", consejo: "", resumen: "", estado: "Activo" },
    { id: 90, cursoId: 6, orden: 12, titulo: "Pedidos a fábrica, mercadería y stock", objetivo: "Realizar correctamente pedidos a fábrica y controlar el ingreso de mercadería y el stock", duracionMinutos: 0, video: "", manual: "", imagen: "", procedimiento: "", errores: "", buenasPracticas: "", consejo: "", resumen: "", estado: "Activo" },
    { id: 91, cursoId: 6, orden: 13, titulo: "Reportes de Utilidades", objetivo: "Usar correctamente los reportes de ventas sin cargo, ventas por producto, fichadas, devoluciones y vasquetas", duracionMinutos: 0, video: "", manual: "", imagen: "", procedimiento: "", errores: "", buenasPracticas: "", consejo: "", resumen: "", estado: "Activo" },

    // Curso 7 — Atención al Cliente
    { id: 26, cursoId: 7, orden: 1, titulo: "Nuestra Filosofía de Servicio", objetivo: "Comprender los Principios de Tonio y la cultura de hospitalidad de Lucciano's", duracionMinutos: 0, video: "", manual: "", imagen: "", procedimiento: "Seguridad: cuidar cada detalle para el bienestar de clientes y equipo — conocer los productos, dominar los procesos y mantener la higiene. Cortesía: la sonrisa es nuestra materia prima — usar frases amables y anticiparse a las necesidades del cliente, tratándolo como un invitado. Inclusión: en Lucciano's todos somos parte — un ambiente donde cada persona se sienta bienvenida y valorada. Actitud: cuidar la imagen, la presencia y la energía que transforman lo cotidiano en especial. Eficiencia: que todo funcione fluido, optimizando tiempos y recursos sin perder la calidez.", errores: "", buenasPracticas: "Nuestro propósito es crear sonrisas a través de la excelencia — ser parte de los momentos felices que enriquecen la vida de las personas.", consejo: "", resumen: "", estado: "Activo" },
    { id: 92, cursoId: 7, orden: 2, titulo: "Recibir y Conectar con el Cliente", objetivo: "Recibir al cliente generando una conexión genuina, no solo cumpliendo el protocolo", duracionMinutos: 0, video: "", manual: "", imagen: "", procedimiento: "Bienvenida: el primer contacto en caja debe ser con un \"Bienvenido a Lucciano's\", tratando siempre al cliente de \"usted\". Contacto visual: evitar en la medida de lo posible darle la espalda al cliente. Rapidez y atención: tomar el pedido de forma expeditiva pero dando el tiempo suficiente para comprender lo que el cliente desea. Escucha activa: interpretar lo que el cliente necesita más allá de lo que pide, acompañándolo con preguntas cortas. Cliente indeciso: contarle sobre la variedad de sabores e ingredientes sin prejuzgar — prestar atención a sus gestos, miradas y comentarios. Imagen personal: uniforme limpio y prolijo, perfume y maquillaje sutiles, barba prolija y pelo recogido.", errores: "", buenasPracticas: "", consejo: "Lo que se evalúa no es solo si cumplís el protocolo, sino si el cliente se siente genuinamente visto.", resumen: "", estado: "Activo" },
    { id: 93, cursoId: 7, orden: 3, titulo: "Venta Sugestiva y Conocimiento de Producto", objetivo: "Ofrecer una venta sugestiva genuina, apoyada en el conocimiento real del producto", duracionMinutos: 0, video: "", manual: "", imagen: "", procedimiento: "Conocer el producto: saber todo lo que Lucciano's ofrece en la sucursal para comunicar novedades y sugerir en función de lo que pide cada cliente. Comunicar promociones: informar las promociones vigentes y los medios de pago disponibles. Nunca decir \"no\": si falta un sabor, en vez de \"no tenemos\" avisar que se está reponiendo y ofrecer una alternativa o invitar a degustar algo nuevo. Ventas según el momento del día: por la mañana, café y pastelería; después del almuerzo, heladería; en la merienda, heladería, cafetería, pastelería y bebidas; en el pico de la tarde (el momento de mayor venta) ser ágil y sugerir en todos los productos — icepops, cannolis, conos gourmet y baños de chocolate.", errores: "", buenasPracticas: "", consejo: "La sugerencia tiene que sentirse natural y genuina, no mecánica.", resumen: "", estado: "Activo" },
    { id: 94, cursoId: 7, orden: 4, titulo: "Cierre de Venta y Despedida", objetivo: "Cerrar la venta y despedir al cliente invitándolo a volver", duracionMinutos: 0, video: "", manual: "", imagen: "", procedimiento: "Armado del producto: si no está bien presentado, no se debe entregar al cliente. Entrega: usar frases como \"Muchas gracias, que lo disfrute\" o \"Aquí está su pedido\", con voz clara y amable. Cobro en efectivo: comprobar la legitimidad de los billetes a la vista del cliente y tomar el cambio de la caja antes de entregar el vuelto. Cobro con tarjeta: solicitar documento de identidad y verificar que coincida con los datos de la tarjeta. Reseña: solicitar al cliente que deje su reseña en Google por la experiencia recibida. Despedida: cerrar con frases que inviten a volver, como \"Hasta luego, nos vemos pronto\".", errores: "", buenasPracticas: "", consejo: "¿El cierre invita al cliente a volver, o hay un momento de calidez genuino antes de despedirse?", resumen: "", estado: "Activo" },
    { id: 27, cursoId: 7, orden: 5, titulo: "Manejo de Quejas y Situaciones Difíciles", objetivo: "Resolver una queja siguiendo el protocolo de Lucciano's, sin perder la calma", duracionMinutos: 0, video: "", manual: "", imagen: "", procedimiento: "Escucha activa: oír con atención sin interrumpir, dejando que el cliente relate su problema completo. No defenderse de antemano ni culpar a terceros. No discutir: aunque el cliente no tenga razón, argumentar que hubo un problema de comunicación, un malentendido o una disfunción del servicio. Diagnosticar: resumir todo en una frase o pregunta corta para confirmar que se comprendió el reclamo. Indicar la acción a tomar y asegurarse de que se cumpla. Usar frases positivas y minimizar las negativas. Si la situación desborda, recurrir al encargado del local o responsable de turno.", errores: "", buenasPracticas: "", consejo: "¿El cliente se va con una solución, o con una disculpa vacía?", resumen: "", estado: "Activo" },
    { id: 95, cursoId: 7, orden: 6, titulo: "Orden y Limpieza en la Atención", objetivo: "Mantener el orden y la limpieza del espacio como parte del respeto al cliente", duracionMinutos: 0, video: "", manual: "", imagen: "", procedimiento: "Control de limpieza, orden de vitrinas y productos exhibidos durante toda la atención. Insumos completos para el despacho, sin faltantes a la vista del cliente. Uniforme siempre limpio, planchado y prolijo. El orden y la limpieza comunican respeto al cliente — el espacio tiene que reflejar los valores de la marca en todo momento, no solo antes de abrir.", errores: "", buenasPracticas: "", consejo: "", resumen: "", estado: "Activo" },
    { id: 28, cursoId: 7, orden: 7, titulo: "Higiene e inocuidad alimentaria", objetivo: "Aplicar las normas de inocuidad e higiene", duracionMinutos: 0, video: "", manual: "", imagen: "", procedimiento: "Contaminación física: presencia de elementos extraños como uñas, vidrio o plástico. Contaminación química: sustancias tóxicas o nocivas, como productos de limpieza. Contaminación biológica: bacterias o toxinas que contaminan el alimento. POES: procedimientos operativos estandarizados de saneamiento — definen los estándares de limpieza y desinfección. BPM: buenas prácticas de manufactura — las reglas de manipulación, preparación y almacenamiento.", errores: "", buenasPracticas: "", consejo: "", resumen: "", estado: "Activo" },
    { id: 29, cursoId: 7, orden: 8, titulo: "Lavado de manos", objetivo: "Aplicar el procedimiento de lavado de manos en 7 pasos", duracionMinutos: 0, video: "", manual: "", imagen: "", procedimiento: "Mojar, enjabonar, friccionar 10 segundos, limpiar uñas y entre dedos, enjuagar, secar con paño limpio y cerrar la canilla con el mismo paño. Obligatorio antes de trabajar, después del baño, de estornudar, de tocarse la cara y al cambiar de sector.", errores: "", buenasPracticas: "", consejo: "", resumen: "", estado: "Activo" },

    // Curso 8 — Encargados y Responsables (marcado "Próximamente" en el sistema real)
    { id: 30, cursoId: 8, orden: 1, titulo: "Próximamente", objetivo: "", duracionMinutos: 0, video: "", manual: "", imagen: "", procedimiento: "Este módulo está reservado para encargados y responsables de local (apertura/cierre de caja, supervisión de equipo, reportes). Todavía no está disponible en el sistema real — se muestra acá como reservado, sin contenido inventado.", errores: "", buenasPracticas: "", consejo: "", resumen: "", estado: "Activo" },
];

/* ============================
   Lucciano's Academy — datos reales
   Tabla "Evaluaciones" — 210 preguntas reales extraídas del banco
   de mini-evaluaciones de SisCap en producción (7 módulos x 30
   preguntas). El módulo 8 (Encargados) no tiene preguntas todavía
   — su contenido real está marcado como "Próximamente".

   Esquema plano (opcion1/opcion2/opcion3 + correcta 1-3) en vez de
   un array serializado — así se puede editar directo en Sheets.
=============================*/

const evaluacionesMock = [
    // Curso 1 — Cafetería
    { id: 1, cursoId: 1, pregunta: "¿Qué push lleva el Caramel Choco Style?", opcion1: "1 salsa choco + 1 syrup caramelo", opcion2: "2 push de vainilla", opcion3: "Solo salsa DDL", correcta: 1, puntaje: 10 },
    { id: 2, cursoId: 1, pregunta: "¿Qué cápsula usa el Temptation?", opcion1: "Vainilla/Finezzo", opcion2: "Ristretto/Forte", opcion3: "Caramelo/Finezzo", correcta: 2, puntaje: 10 },
    { id: 3, cursoId: 1, pregunta: "¿Cuántos push de syrup vainilla lleva el Vainilla Macchiato?", opcion1: "1", opcion2: "2", opcion3: "3", correcta: 2, puntaje: 10 },
    { id: 4, cursoId: 1, pregunta: "El Mocca Latte lleva:", opcion1: "2 push salsa chocolate", opcion2: "1 push caramelo", opcion3: "2 push DDL", correcta: 1, puntaje: 10 },
    { id: 5, cursoId: 1, pregunta: "En el Iced Cappuccino, ¿qué NO se debe usar?", opcion1: "Hielo", opcion2: "Leche fría", opcion3: "Leche caliente", correcta: 3, puntaje: 10 },
    { id: 6, cursoId: 1, pregunta: "¿Con qué se decora el Iced Cappuccino?", opcion1: "Cacao en polvo", opcion2: "Canela", opcion3: "Coco", correcta: 1, puntaje: 10 },
    { id: 7, cursoId: 1, pregunta: "El Affogato se prepara con:", opcion1: "1 bocha de helado + espresso encima", opcion2: "2 bochas + leche", opcion3: "Solo espresso", correcta: 1, puntaje: 10 },
    { id: 8, cursoId: 1, pregunta: "El Espresso Pistacho lleva cuántos gramos de Avella:", opcion1: "8g", opcion2: "10g", opcion3: "12g", correcta: 2, puntaje: 10 },
    { id: 9, cursoId: 1, pregunta: "¿En qué taza se sirve el Espresso Gianduia?", opcion1: "Taza grande", opcion2: "Taza espresso chica", opcion3: "Vaso de Nespresso", correcta: 2, puntaje: 10 },
    { id: 10, cursoId: 1, pregunta: "La promo cód. 612 es:", opcion1: "Lungo + Alfajor Semiamargo", opcion2: "Espresso + Conito", opcion3: "Latte + medialunas", correcta: 1, puntaje: 10 },
    { id: 11, cursoId: 1, pregunta: "La promo cód. 614 incluye:", opcion1: "Alfajor Nuez", opcion2: "Alfajor Dark", opcion3: "Alfajor Blanco", correcta: 1, puntaje: 10 },
    { id: 12, cursoId: 1, pregunta: "La promo cód. 161 trae:", opcion1: "2 medialunas + jugo", opcion2: "Tostadas + jugo", opcion3: "Croissant solo", correcta: 1, puntaje: 10 },
    { id: 13, cursoId: 1, pregunta: "La promo cód. 440 es:", opcion1: "Cappuccino + croissant", opcion2: "Latte + tostadas", opcion3: "Espresso + conito", correcta: 1, puntaje: 10 },
    { id: 14, cursoId: 1, pregunta: "La promo cód. 650 es:", opcion1: "Espresso + Conito Blanco", opcion2: "Espresso + Conito Semiamargo", opcion3: "Lungo + Conito", correcta: 1, puntaje: 10 },
    { id: 15, cursoId: 1, pregunta: "La promo cód. 626 incluye:", opcion1: "Mini Alfajor a elección", opcion2: "Alfajor grande", opcion3: "2 conitos", correcta: 1, puntaje: 10 },
    { id: 16, cursoId: 1, pregunta: "¿Cuántos limones lleva la Limonada?", opcion1: "2", opcion2: "3", opcion3: "4", correcta: 2, puntaje: 10 },
    { id: 17, cursoId: 1, pregunta: "¿Cuántos gramos de azúcar lleva la Limonada con Menta?", opcion1: "110g", opcion2: "120g", opcion3: "130g", correcta: 2, puntaje: 10 },
    { id: 18, cursoId: 1, pregunta: "¿Cuántas hojas de menta lleva la Limonada con Menta?", opcion1: "4", opcion2: "6", opcion3: "8", correcta: 2, puntaje: 10 },
    { id: 19, cursoId: 1, pregunta: "El Exprimido de Naranja se hace con:", opcion1: "Naranjas frescas exprimidas al momento", opcion2: "Jugo concentrado", opcion3: "Naranjas + agua", correcta: 1, puntaje: 10 },
    { id: 20, cursoId: 1, pregunta: "¿Qué código tiene el Espresso?", opcion1: "75", opcion2: "76", opcion3: "79", correcta: 1, puntaje: 10 },
    { id: 21, cursoId: 1, pregunta: "¿Qué código tiene el Lungo?", opcion1: "75", opcion2: "76", opcion3: "79", correcta: 2, puntaje: 10 },
    { id: 22, cursoId: 1, pregunta: "¿Qué código tiene el Café Latte?", opcion1: "75", opcion2: "76", opcion3: "79", correcta: 3, puntaje: 10 },
    { id: 23, cursoId: 1, pregunta: "¿Qué código tiene el Cappuccino?", opcion1: "36", opcion2: "76", opcion3: "79", correcta: 1, puntaje: 10 },
    { id: 24, cursoId: 1, pregunta: "En los cafés especiales, si piden FRÍO se debe usar:", opcion1: "Leche tibia", opcion2: "Leche fría y hielo", opcion3: "Solo hielo", correcta: 2, puntaje: 10 },
    { id: 25, cursoId: 1, pregunta: "El Temptation usa qué salsas:", opcion1: "Chocolate y DDL", opcion2: "Caramelo y vainilla", opcion3: "Solo chocolate", correcta: 1, puntaje: 10 },
    { id: 26, cursoId: 1, pregunta: "El Vainilla Macchiato, ¿qué porcentaje de café lleva aproximadamente?", opcion1: "30%", opcion2: "60%", opcion3: "90%", correcta: 1, puntaje: 10 },
    { id: 27, cursoId: 1, pregunta: "¿En qué tamaño se sirve el Caramel Choco Style?", opcion1: "Chico", opcion2: "Mediano", opcion3: "Grande", correcta: 3, puntaje: 10 },
    { id: 28, cursoId: 1, pregunta: "El Affogato se sirve en tamaño:", opcion1: "Chico", opcion2: "Mediano", opcion3: "Grande", correcta: 2, puntaje: 10 },
    { id: 29, cursoId: 1, pregunta: "¿Qué decoración lleva el Espresso Gianduia?", opcion1: "Crema + hilos de Avella", opcion2: "Cacao en polvo", opcion3: "Canela", correcta: 1, puntaje: 10 },
    { id: 30, cursoId: 1, pregunta: "La promo cód. 613 corresponde a:", opcion1: "Alfajor Dark", opcion2: "Alfajor Nuez", opcion3: "Alfajor Blanco", correcta: 1, puntaje: 10 },
    { id: 332, cursoId: 1, pregunta: "El Capuccino (Cód. 36) se prepara con 50% café tipo Lungo + 50% leche, más:", opcion1: "Espuma, crema y cacao por encima", opcion2: "Solo espuma", opcion3: "Syrup de vainilla", correcta: 1, puntaje: 10 },
    { id: 333, cursoId: 1, pregunta: "La cápsula Finezzo tiene un perfil:", opcion1: "Delicado y equilibrado", opcion2: "Intenso y concentrado", opcion3: "Saborizado dulce", correcta: 1, puntaje: 10 },
    { id: 334, cursoId: 1, pregunta: "La cápsula Ristretto se usa para:", opcion1: "Cantidades cortas de agua, concentrado", opcion2: "Cantidades largas, suave", opcion3: "Solo bebidas frías", correcta: 1, puntaje: 10 },
    { id: 335, cursoId: 1, pregunta: "¿Cuántas cápsulas Nespresso distintas se usan en Cafetería?", opcion1: "5", opcion2: "6", opcion3: "7", correcta: 2, puntaje: 10 },
    { id: 336, cursoId: 1, pregunta: "Dentro de la familia Espresso (Cód. 75), el Cortado lleva:", opcion1: "70% café + 30% leche", opcion2: "50% café + 50% leche", opcion3: "95% leche + 5% café", correcta: 1, puntaje: 10 },
    { id: 337, cursoId: 1, pregunta: "Dentro de la familia Espresso, la Mitad y Mitad lleva:", opcion1: "50% café + 50% leche", opcion2: "70% café + 30% leche", opcion3: "95% leche + 5% café", correcta: 1, puntaje: 10 },
    { id: 338, cursoId: 1, pregunta: "Dentro de la familia Espresso, la Lágrima lleva:", opcion1: "95% leche + 5% café", opcion2: "70% café + 30% leche", opcion3: "50% café + 50% leche", correcta: 1, puntaje: 10 },
    { id: 339, cursoId: 1, pregunta: "El Ristretto (familia Espresso) es:", opcion1: "1 shot de café", opcion2: "Café con leche 50/50", opcion3: "100% leche", correcta: 1, puntaje: 10 },
    { id: 340, cursoId: 1, pregunta: "Dentro de la familia Lungo (Cód. 76), el Macchiato lleva:", opcion1: "90% café + 10% espuma", opcion2: "70% café + 30% leche", opcion3: "50% café + 50% leche", correcta: 1, puntaje: 10 },
    { id: 341, cursoId: 1, pregunta: "Dentro de la familia Lungo, el Americano lleva:", opcion1: "40% café + 60% agua caliente", opcion2: "100% café", opcion3: "50% café + 50% leche", correcta: 1, puntaje: 10 },
    { id: 342, cursoId: 1, pregunta: "Dentro de la familia Lungo, el Cortado lleva:", opcion1: "70% café + 30% leche", opcion2: "90% café + 10% espuma", opcion3: "40% café + 60% agua", correcta: 1, puntaje: 10 },
    { id: 343, cursoId: 1, pregunta: "Dentro de la familia Lungo, la Mitad y Mitad lleva:", opcion1: "50% café + 50% leche", opcion2: "70% café + 30% leche", opcion3: "90% café + 10% espuma", correcta: 1, puntaje: 10 },
    { id: 344, cursoId: 1, pregunta: "Dentro de la familia Café Latte (Cód. 79), el Café con Leche lleva:", opcion1: "50% café + 50% leche", opcion2: "70% leche + 30% café", opcion3: "95% leche + 5% café", correcta: 1, puntaje: 10 },
    { id: 345, cursoId: 1, pregunta: "Dentro de la familia Café Latte, el Latte lleva:", opcion1: "70% leche + 30% café", opcion2: "50% café + 50% leche", opcion3: "95% leche + 5% café", correcta: 1, puntaje: 10 },
    { id: 346, cursoId: 1, pregunta: "Dentro de la familia Café Latte, el Doble es:", opcion1: "100% café", opcion2: "50% café + 50% leche", opcion3: "70% leche + 30% café", correcta: 1, puntaje: 10 },
    { id: 347, cursoId: 1, pregunta: "¿Qué diferencia al \"Café con leche\" (familia Latte) del \"Latte\"?", opcion1: "El Café con leche es 50/50 y el Latte es 70% leche/30% café", opcion2: "Son la misma proporción", opcion3: "El Latte no lleva café", correcta: 1, puntaje: 10 },
    { id: 348, cursoId: 1, pregunta: "El Mocca Latte se arma de abajo hacia arriba con salsa de chocolate doble, 60% leche, 30% café y:", opcion1: "Espuma arriba", opcion2: "Cacao en polvo", opcion3: "Crema chantilly", correcta: 1, puntaje: 10 },
    { id: 349, cursoId: 1, pregunta: "El Temptation combina, de abajo hacia arriba, salsa de chocolate, salsa dulce de leche, y luego:", opcion1: "60% leche + 30% café + espuma", opcion2: "Solo espuma", opcion3: "70% café + 30% leche", correcta: 1, puntaje: 10 },
    { id: 350, cursoId: 1, pregunta: "El Caramel Choco Style se diferencia del Temptation en que usa:", opcion1: "Syrup de caramelo en vez de salsa DDL", opcion2: "El doble de café", opcion3: "Leche fría en vez de caliente", correcta: 1, puntaje: 10 },
    { id: 351, cursoId: 1, pregunta: "El Espresso Pistacho se arma de abajo hacia arriba con avella pistacho, ristretto y:", opcion1: "Crema con hilos de avella arriba", opcion2: "Espuma de leche", opcion3: "Cacao en polvo", correcta: 1, puntaje: 10 },
    { id: 352, cursoId: 1, pregunta: "El Affogato se arma con una bocha de helado y:", opcion1: "1 espresso volcado encima al momento de servir", opcion2: "1 espresso preparado con anticipación", opcion3: "2 espressos fríos", correcta: 1, puntaje: 10 },
    { id: 353, cursoId: 1, pregunta: "Las bebidas frías de Cafetería se sirven en:", opcion1: "Vaso 330", opcion2: "Taza chica", opcion3: "Taza mediana", correcta: 1, puntaje: 10 },
    { id: 354, cursoId: 1, pregunta: "¿En qué taza se sirve la familia Café Latte/Cappuccino?", opcion1: "Taza grande", opcion2: "Taza mediana", opcion3: "Taza chica", correcta: 1, puntaje: 10 },
    // Curso 2 — Heladería
    { id: 31, cursoId: 2, pregunta: "Gramaje del helado chico:", opcion1: "100-110g", opcion2: "120-130g", opcion3: "140-150g", correcta: 2, puntaje: 10 },
    { id: 32, cursoId: 2, pregunta: "Gramaje del helado mediano:", opcion1: "120-130g", opcion2: "140-150g", opcion3: "170-180g", correcta: 2, puntaje: 10 },
    { id: 33, cursoId: 2, pregunta: "Gramaje del helado grande:", opcion1: "140-150g", opcion2: "170-180g", opcion3: "190-200g", correcta: 2, puntaje: 10 },
    { id: 34, cursoId: 2, pregunta: "Gramaje del cucurucho:", opcion1: "170-180g", opcion2: "190-200g", opcion3: "210-220g", correcta: 2, puntaje: 10 },
    { id: 35, cursoId: 2, pregunta: "Capacidad del pote chico:", opcion1: "250", opcion2: "500", opcion3: "1000", correcta: 1, puntaje: 10 },
    { id: 36, cursoId: 2, pregunta: "Capacidad del pote mediano:", opcion1: "250", opcion2: "500", opcion3: "1000", correcta: 2, puntaje: 10 },
    { id: 37, cursoId: 2, pregunta: "Los cucuruchos gourmet llevan cuántos push:", opcion1: "1", opcion2: "2", opcion3: "3", correcta: 2, puntaje: 10 },
    { id: 38, cursoId: 2, pregunta: "Las obleas (cialdinos) se usan:", opcion1: "Para cualquier presentación", opcion2: "Solo para cucuruchos", opcion3: "Para potes", correcta: 2, puntaje: 10 },
    { id: 39, cursoId: 2, pregunta: "¿Qué significa Parve en el menú Kosher?", opcion1: "Con lácteos", opcion2: "Vegano sin lácteos", opcion3: "Con gluten", correcta: 2, puntaje: 10 },
    { id: 40, cursoId: 2, pregunta: "¿Cómo se llama el traspaso entre vitrina y armarios?", opcion1: "Pase de helado", opcion2: "Cambio de turno", opcion3: "Rotación", correcta: 1, puntaje: 10 },
    { id: 41, cursoId: 2, pregunta: "En el armario, los helados se identifican como:", opcion1: "Fríos y calientes", opcion2: "Completos e incompletos", opcion3: "Nuevos y viejos", correcta: 2, puntaje: 10 },
    { id: 42, cursoId: 2, pregunta: "Tipos de vasqueta:", opcion1: "Acrílico y plástico", opcion2: "Vidrio y metal", opcion3: "Solo plástico", correcta: 1, puntaje: 10 },
    { id: 43, cursoId: 2, pregunta: "Temperatura de vitrina en verano:", opcion1: "-13 a -16°C", opcion2: "-8 a -10°C", opcion3: "-20°C", correcta: 1, puntaje: 10 },
    { id: 44, cursoId: 2, pregunta: "Temperatura de vitrina en invierno:", opcion1: "-10 a -12°C", opcion2: "-12 a -14°C", opcion3: "-16 a -18°C", correcta: 2, puntaje: 10 },
    { id: 45, cursoId: 2, pregunta: "Antes de manipular helado hay que:", opcion1: "Lavarse las manos y usar guantes", opcion2: "Solo usar guantes", opcion3: "Nada en particular", correcta: 1, puntaje: 10 },
    { id: 46, cursoId: 2, pregunta: "Cuando una vasqueta está al 50% hay que:", opcion1: "Dejarla", opcion2: "Retirarla y reponer nueva", opcion3: "Tirarla", correcta: 2, puntaje: 10 },
    { id: 47, cursoId: 2, pregunta: "Al rearmar una vasqueta, ¿cuánto tiempo va al abatidor?", opcion1: "1-2 min", opcion2: "3-4 min", opcion3: "10 min", correcta: 2, puntaje: 10 },
    { id: 48, cursoId: 2, pregunta: "Marca del baño de chocolate:", opcion1: "Maprico", opcion2: "Mapricoa", opcion3: "Nestlé", correcta: 2, puntaje: 10 },
    { id: 49, cursoId: 2, pregunta: "Temperatura ideal del baño de chocolate:", opcion1: "20-30°C", opcion2: "30-40°C", opcion3: "50-60°C", correcta: 2, puntaje: 10 },
    { id: 50, cursoId: 2, pregunta: "El Smoothie se prepara con:", opcion1: "2 bochas + 200ml soda", opcion2: "2 bochas + leche", opcion3: "1 bocha + soda", correcta: 1, puntaje: 10 },
    { id: 51, cursoId: 2, pregunta: "El Milk Shake usa qué cantidad de leche:", opcion1: "200ml", opcion2: "220ml", opcion3: "250ml", correcta: 1, puntaje: 10 },
    { id: 52, cursoId: 2, pregunta: "El Gelato Shake usa qué cápsula de café:", opcion1: "Forte", opcion2: "Ristretto", opcion3: "Finezzo", correcta: 2, puntaje: 10 },
    { id: 53, cursoId: 2, pregunta: "Sabores del Gelato Shake:", opcion1: "Cookies & Cream, DDL, Tiramisú", opcion2: "Solo vainilla", opcion3: "Frutilla y banana", correcta: 1, puntaje: 10 },
    { id: 54, cursoId: 2, pregunta: "El Stracciatella se calienta cuánto tiempo en microondas:", opcion1: "5-10 seg", opcion2: "15-20 seg", opcion3: "30-40 seg", correcta: 2, puntaje: 10 },
    { id: 55, cursoId: 2, pregunta: "El Dulce de Leche Repostero se aplica:", opcion1: "En forma de gota grande sobre los picos", opcion2: "Mezclado en el helado", opcion3: "Solo en el borde", correcta: 1, puntaje: 10 },
    { id: 56, cursoId: 2, pregunta: "El variegato de Mascarpone es de:", opcion1: "Frutos rojos", opcion2: "Maracuyá", opcion3: "Caramelo", correcta: 1, puntaje: 10 },
    { id: 57, cursoId: 2, pregunta: "El Cheesecake al Pistacchio lleva cuántos gramos de crumble:", opcion1: "170g", opcion2: "185g", opcion3: "200g", correcta: 3, puntaje: 10 },
    { id: 58, cursoId: 2, pregunta: "El Tiramisú al Pistacho se decora con:", opcion1: "Solo cacao", opcion2: "Cacao en laterales + granella + vainillas", opcion3: "Solo granella", correcta: 2, puntaje: 10 },
    { id: 59, cursoId: 2, pregunta: "Los sabores frutales llevan de decoración:", opcion1: "Fruta cortada del mismo sabor", opcion2: "Cacao en polvo", opcion3: "Crema chantilly", correcta: 1, puntaje: 10 },
    { id: 60, cursoId: 2, pregunta: "¿Qué hay que controlar antes de exhibir helado?", opcion1: "Solo el sabor", opcion2: "Temperatura del helado y heladera", opcion3: "El color", correcta: 2, puntaje: 10 },
    { id: 211, cursoId: 2, pregunta: "¿Cuántos sabores tiene la familia Dulce de Leche?", opcion1: "6", opcion2: "7", opcion3: "8", correcta: 2, puntaje: 10 },
    { id: 212, cursoId: 2, pregunta: "¿Qué helado de la familia Chocolates tiene un variegato inspirado en el Chocolate Dubai?", opcion1: "Chocolate Platino", opcion2: "Chocolate Dubai", opcion3: "Chocolate Lucciano's", correcta: 2, puntaje: 10 },
    { id: 213, cursoId: 2, pregunta: "¿Cuántos sabores frutales y veganos hay (todos Parve)?", opcion1: "8", opcion2: "9", opcion3: "10", correcta: 3, puntaje: 10 },
    { id: 214, cursoId: 2, pregunta: "¿Qué sabor de Cremas lleva garapiñada de pistacchios caramelizados?", opcion1: "Cheesecake al Pistacchio", opcion2: "Chocolate Blanco & Pistacchio Crock", opcion3: "Alfajor Pistacchio", correcta: 2, puntaje: 10 },
    { id: 215, cursoId: 2, pregunta: "El Pretzel helado combina una base cremosa con:", opcion1: "Trozos crocantes de pretzel y un toque de sal", opcion2: "Solo caramelo", opcion3: "Solo chocolate", correcta: 1, puntaje: 10 },
    { id: 216, cursoId: 2, pregunta: "¿Qué sabor integra tanto la familia Chocolates como la de Frutales/Vegan?", opcion1: "Sorbete Dark 72%", opcion2: "Pistacchio", opcion3: "Chantilly", correcta: 1, puntaje: 10 },
    { id: 217, cursoId: 2, pregunta: "El Cheesecake al Pistacchio lleva veteado de:", opcion1: "Avella Pistacchio y crumble de pistacchio", opcion2: "Dulce de leche", opcion3: "Chocolate blanco", correcta: 1, puntaje: 10 },
    { id: 218, cursoId: 2, pregunta: "¿Qué sabor de Cremas está inspirado en la mousse francesa con maracuyá amazónica?", opcion1: "Mousse de Maracuyá", opcion2: "Lemon Pie", opcion3: "Tiramisú", correcta: 1, puntaje: 10 },
    { id: 219, cursoId: 2, pregunta: "El Coco Rock lleva coco de qué origen:", opcion1: "Malasia", opcion2: "Brasil", opcion3: "Filipinas", correcta: 1, puntaje: 10 },
    { id: 220, cursoId: 2, pregunta: "¿Cuántos sabores tiene la familia Cremas, la más amplia de la carta?", opcion1: "20", opcion2: "23", opcion3: "26", correcta: 2, puntaje: 10 },
    { id: 221, cursoId: 2, pregunta: "El Tiramisú al Pistacchio lleva vainillas embebidas en almíbar de:", opcion1: "Café", opcion2: "Naranja", opcion3: "Caramelo", correcta: 1, puntaje: 10 },
    { id: 222, cursoId: 2, pregunta: "La Menta Granizada lleva trozos de:", opcion1: "Chocolate semiamargo", opcion2: "Chocolate blanco", opcion3: "Avellanas", correcta: 1, puntaje: 10 },
    { id: 223, cursoId: 2, pregunta: "Antes de licuar el Milk Shake, hay que:", opcion1: "Decorar el interior del vaso con salsa", opcion2: "Decorar la superficie con fruta", opcion3: "No hace falta decorar nada", correcta: 1, puntaje: 10 },
    { id: 224, cursoId: 2, pregunta: "¿Cuántos sabores hay en la familia Chocolates?", opcion1: "3", opcion2: "4", opcion3: "5", correcta: 2, puntaje: 10 },
    { id: 225, cursoId: 2, pregunta: "La Chocotorta helada lleva galletas bañadas en:", opcion1: "Chocolate semiamargo", opcion2: "Chocolate blanco", opcion3: "Caramelo", correcta: 1, puntaje: 10 },
    { id: 250, cursoId: 2, pregunta: "El Chocolate Lucciano's es chocolate amargo de origen belga a qué porcentaje:", opcion1: "60%", opcion2: "72%", opcion3: "85%", correcta: 2, puntaje: 10 },
    { id: 251, cursoId: 2, pregunta: "El Chocolate Platino combina chocolate con leche 39% y semiamargo 56%, con:", opcion1: "Mousse de chocolate", opcion2: "Dulce de leche", opcion3: "Avellanas enteras", correcta: 1, puntaje: 10 },
    { id: 252, cursoId: 2, pregunta: "El Chocolate Lucciano's c/ Bombón de Avellanas fue desarrollado exclusivamente en:", opcion1: "Italia", opcion2: "Bélgica", opcion3: "Argentina", correcta: 1, puntaje: 10 },
    { id: 253, cursoId: 2, pregunta: "El Alfajor Lucciano's (helado) está cubierto con:", opcion1: "Chocolate semiamargo belga", opcion2: "Chocolate blanco", opcion3: "Sin cobertura", correcta: 1, puntaje: 10 },
    { id: 254, cursoId: 2, pregunta: "El Alfajor Blanco & Nuez está granizado con:", opcion1: "Chocolate blanco belga", opcion2: "Chocolate semiamargo", opcion3: "Caramelo", correcta: 1, puntaje: 10 },
    { id: 255, cursoId: 2, pregunta: "El Dulce de Leche c/ Bombón de Avellanas tiene veteado de:", opcion1: "Chocolate y avellanas", opcion2: "Solo chocolate", opcion3: "Frutos rojos", correcta: 1, puntaje: 10 },
    { id: 256, cursoId: 2, pregunta: "El Dulce de Leche c/ Brownie está veteado con:", opcion1: "Trozos de brownie exclusivo de Lucciano's", opcion2: "Galletas", opcion3: "Merengue", correcta: 1, puntaje: 10 },
    { id: 257, cursoId: 2, pregunta: "El Dulce de Leche Granizado está granizado con:", opcion1: "Stracciatella italiana semiamarga", opcion2: "Chocolate blanco", opcion3: "Coco rallado", correcta: 1, puntaje: 10 },
    { id: 258, cursoId: 2, pregunta: "El Mango Alphonso es conocido como:", opcion1: "La joya de los mangos", opcion2: "El rey de los mangos", opcion3: "El mango dulce", correcta: 1, puntaje: 10 },
    { id: 259, cursoId: 2, pregunta: "El sorbete Patagonia (Heladería) es un mix de:", opcion1: "Frutillas, arándanos, frambuesas y moras", opcion2: "Solo frutillas", opcion3: "Cítricos de la Patagonia", correcta: 1, puntaje: 10 },
    { id: 260, cursoId: 2, pregunta: "El Vasubeda combina helado de limón natural con albahaca fresca y:", opcion1: "Jugo de naranjas naturales", opcion2: "Menta", opcion3: "Jengibre", correcta: 1, puntaje: 10 },
    { id: 261, cursoId: 2, pregunta: "El Pistacchio Vegan es:", opcion1: "Un sorbete", opcion2: "Un helado con leche", opcion3: "Una mousse", correcta: 1, puntaje: 10 },
    { id: 262, cursoId: 2, pregunta: "El King Bianco (Heladería) lleva veteado de avellanas y:", opcion1: "Chocolate con leche", opcion2: "Chocolate semiamargo", opcion3: "Caramelo", correcta: 1, puntaje: 10 },
    { id: 263, cursoId: 2, pregunta: "El King Nero lleva veteado de avellanas y:", opcion1: "Chocolate semiamargo", opcion2: "Chocolate con leche", opcion3: "Chocolate blanco", correcta: 1, puntaje: 10 },
    { id: 264, cursoId: 2, pregunta: "El Peanut & Caramel lleva veteado de chocolate stracciatella, dulce de leche y:", opcion1: "Trozos de maní salado", opcion2: "Solo caramelo", opcion3: "Nueces", correcta: 1, puntaje: 10 },
    { id: 265, cursoId: 2, pregunta: "El Super Sambayón está elaborado con yema de huevo, azúcar y:", opcion1: "Vino", opcion2: "Café", opcion3: "Licor de caramelo", correcta: 1, puntaje: 10 },
    { id: 266, cursoId: 2, pregunta: "El Banana Split (helado) está veteado con chocolate italiano y:", opcion1: "Dulce de leche", opcion2: "Crema", opcion3: "Caramelo", correcta: 1, puntaje: 10 },
    { id: 267, cursoId: 2, pregunta: "La Tramontana tiene base Chantilly con dulce de leche, caramelo y:", opcion1: "Microgalletitas bañadas en chocolate", opcion2: "Solo caramelo", opcion3: "Merengue", correcta: 1, puntaje: 10 },
    { id: 268, cursoId: 2, pregunta: "El Súper Gianduiotto está inspirado en la clásica gianduia de qué región italiana:", opcion1: "Piamonte", opcion2: "Toscana", opcion3: "Sicilia", correcta: 1, puntaje: 10 },
    { id: 269, cursoId: 2, pregunta: "El Pistacchio (Cremas) es reconocido como:", opcion1: "El best-seller de la carta", opcion2: "Un sabor de temporada", opcion3: "Una novedad", correcta: 1, puntaje: 10 },
    { id: 270, cursoId: 2, pregunta: "El Alfajor Pistacchio (helado) lleva veteado de DDL, Avella Pistacchio y trozos de:", opcion1: "Alfajor exclusivo de pistacchio", opcion2: "Chocolate blanco", opcion3: "Maní", correcta: 1, puntaje: 10 },
    { id: 271, cursoId: 2, pregunta: "El veteado de Cookies & Cream fue desarrollado en:", opcion1: "Italia por Lucciano's", opcion2: "Argentina", opcion3: "Bélgica", correcta: 1, puntaje: 10 },
    { id: 272, cursoId: 2, pregunta: "La Frutilla a la Crema se elabora con frutillas frescas de:", opcion1: "La región", opcion2: "Frutillas importadas", opcion3: "Frutillas congeladas", correcta: 1, puntaje: 10 },
    { id: 273, cursoId: 2, pregunta: "El Chocolate Blanco + Avella Latte lleva veteado de:", opcion1: "Avella Latte", opcion2: "Avella Pistacchio", opcion3: "Avella Dubai", correcta: 1, puntaje: 10 },
    { id: 274, cursoId: 2, pregunta: "¿Cuántas variedades de helado libre de gluten ofrece Heladería?", opcion1: "6", opcion2: "8", opcion3: "10", correcta: 2, puntaje: 10 },
    // Curso 3 — Icepops
    { id: 61, cursoId: 3, pregunta: "¿Cómo se describe un icepop?", opcion1: "De afuera hacia adentro", opcion2: "De adentro hacia afuera", opcion3: "Solo por el nombre", correcta: 2, puntaje: 10 },
    { id: 62, cursoId: 3, pregunta: "Las cubiertas de icepops son siempre:", opcion1: "Blanco, con leche o negro", opcion2: "Solo blanco", opcion3: "Cualquier color", correcta: 1, puntaje: 10 },
    { id: 63, cursoId: 3, pregunta: "¿Cuándo se considera \"blanco\" la cubierta?", opcion1: "Solo sin tinte", opcion2: "Todo lo que tiene tinte de color", opcion3: "Nunca", correcta: 2, puntaje: 10 },
    { id: 64, cursoId: 3, pregunta: "El King Bianco es de sabor:", opcion1: "Avellanas", opcion2: "Pistacho", opcion3: "Dulce de leche", correcta: 1, puntaje: 10 },
    { id: 65, cursoId: 3, pregunta: "El Peanut Caramel lleva:", opcion1: "Crema de maní + stracciatella + DDL + maní salado", opcion2: "Solo maní", opcion3: "Chocolate blanco", correcta: 1, puntaje: 10 },
    { id: 66, cursoId: 3, pregunta: "El Sorbete Patagonia es un mix de:", opcion1: "Frutos rojos", opcion2: "Cítricos", opcion3: "Chocolate", correcta: 1, puntaje: 10 },
    { id: 67, cursoId: 3, pregunta: "El Vito Crema del Cielo, además del baño blanco, se decora con:", opcion1: "Granas multicolores y ojos de chocolate blanco", opcion2: "Solo granella de pistacho", opcion3: "Sin decoración adicional", correcta: 1, puntaje: 10 },
    { id: 68, cursoId: 3, pregunta: "El Oli Platino es de:", opcion1: "Chocolate semiamargo con leche", opcion2: "Chocolate blanco", opcion3: "Pistacho", correcta: 1, puntaje: 10 },
    { id: 69, cursoId: 3, pregunta: "¿Qué comparten Doble Chocolate King, Oli King y Minion?", opcion1: "El mismo relleno", opcion2: "Distinto relleno", opcion3: "Nada", correcta: 1, puntaje: 10 },
    { id: 70, cursoId: 3, pregunta: "El Jameson Icepop está bañado en chocolate al:", opcion1: "54%", opcion2: "72%", opcion3: "90%", correcta: 2, puntaje: 10 },
    { id: 71, cursoId: 3, pregunta: "¿Cuántas unidades trae una caja de Mini Icepops?", opcion1: "4", opcion2: "6", opcion3: "8", correcta: 1, puntaje: 10 },
    { id: 72, cursoId: 3, pregunta: "¿Cuántas variedades de Mini Icepops hay?", opcion1: "6", opcion2: "7", opcion3: "8", correcta: 2, puntaje: 10 },
    { id: 73, cursoId: 3, pregunta: "¿Qué son los Geladots?", opcion1: "Obleas con helado", opcion2: "Bombones rellenos de helado bañados en chocolate", opcion3: "Icepops sin baño", correcta: 2, puntaje: 10 },
    { id: 74, cursoId: 3, pregunta: "Presentación grande de Geladots:", opcion1: "18 unidades", opcion2: "24 unidades", opcion3: "32 unidades", correcta: 3, puntaje: 10 },
    { id: 75, cursoId: 3, pregunta: "Presentación mediana de Geladots:", opcion1: "12 unidades", opcion2: "18 unidades", opcion3: "24 unidades", correcta: 2, puntaje: 10 },
    { id: 76, cursoId: 3, pregunta: "¿Qué son los Cannolis?", opcion1: "Bombones de chocolate", opcion2: "Obleas rellenas de helado bañadas en chocolate", opcion3: "Icepops grandes", correcta: 2, puntaje: 10 },
    { id: 77, cursoId: 3, pregunta: "¿Cuántas variedades de helado libre de gluten hay?", opcion1: "4", opcion2: "6", opcion3: "8", correcta: 3, puntaje: 10 },
    { id: 78, cursoId: 3, pregunta: "¿Cuántos sabores veganos hay en la línea libre de gluten?", opcion1: "1", opcion2: "2", opcion3: "3", correcta: 2, puntaje: 10 },
    { id: 79, cursoId: 3, pregunta: "¿Qué sabor sin azúcar añadida se ofrece como icepop?", opcion1: "Chocolate blanco", opcion2: "Chocolate con leche", opcion3: "Pistacho", correcta: 2, puntaje: 10 },
    { id: 80, cursoId: 3, pregunta: "¿Cuántas tabletas sin azúcar añadida existen?", opcion1: "1", opcion2: "2", opcion3: "3", correcta: 2, puntaje: 10 },
    { id: 81, cursoId: 3, pregunta: "La cobertura del Jameson es de tipo:", opcion1: "Belga", opcion2: "Suiza", opcion3: "Italiana", correcta: 1, puntaje: 10 },
    { id: 82, cursoId: 3, pregunta: "El relleno del Jameson Icepop tiene sabor a:", opcion1: "Ron", opcion2: "Whisky", opcion3: "Vodka", correcta: 2, puntaje: 10 },
    { id: 83, cursoId: 3, pregunta: "Geladot sabor Sambayón:", opcion1: "Existe", opcion2: "No existe", opcion3: "Es vegano", correcta: 1, puntaje: 10 },
    { id: 84, cursoId: 3, pregunta: "¿Cuántas variedades de Geladots hay?", opcion1: "6", opcion2: "8", opcion3: "10", correcta: 2, puntaje: 10 },
    { id: 85, cursoId: 3, pregunta: "¿Cuántas variedades de Cannolis hay?", opcion1: "4", opcion2: "6", opcion3: "8", correcta: 2, puntaje: 10 },
    { id: 86, cursoId: 3, pregunta: "El cliente en Geladots puede:", opcion1: "Combinar sabores", opcion2: "Elegir solo 1 sabor", opcion3: "No elegir", correcta: 1, puntaje: 10 },
    { id: 87, cursoId: 3, pregunta: "El Sorbete Patagonia está bañado en:", opcion1: "Chocolate negro", opcion2: "Chocolate blanco", opcion3: "Sin baño", correcta: 2, puntaje: 10 },
    { id: 88, cursoId: 3, pregunta: "El nombre \"King\" en los icepops hace referencia a:", opcion1: "Chocolate blanco y Avella Latte", opcion2: "Solo chocolate negro", opcion3: "El tamaño", correcta: 1, puntaje: 10 },
    { id: 89, cursoId: 3, pregunta: "Mini Icepop sabor DDL & Cookies:", opcion1: "Existe", opcion2: "No existe", opcion3: "Es libre de gluten solamente", correcta: 1, puntaje: 10 },
    { id: 90, cursoId: 3, pregunta: "¿Qué se responde si preguntan por algo sin azúcar?", opcion1: "Que no hay nada", opcion2: "Icepop sin azúcar añadida + 2 tabletas", opcion3: "Que pidan en otro local", correcta: 2, puntaje: 10 },
    { id: 226, cursoId: 3, pregunta: "¿Cuántas variedades tiene la categoría Bañados, la más amplia de la carta?", opcion1: "13", opcion2: "15", opcion3: "17", correcta: 2, puntaje: 10 },
    { id: 227, cursoId: 3, pregunta: "¿Cuántas variedades tiene la línea Luxury?", opcion1: "10", opcion2: "12", opcion3: "14", correcta: 2, puntaje: 10 },
    { id: 228, cursoId: 3, pregunta: "El Jameson Icepop está relleno de ganache con sabor a:", opcion1: "Chocolate blanco con whisky", opcion2: "Dulce de leche", opcion3: "Avellanas", correcta: 1, puntaje: 10 },
    { id: 229, cursoId: 3, pregunta: "El Vegan 72% es:", opcion1: "Sorbete de chocolate, Parve", opcion2: "Helado con leche", opcion3: "Relleno de maní", correcta: 1, puntaje: 10 },
    { id: 230, cursoId: 3, pregunta: "La decoración del Tonio (Cookies & Cream) se hace:", opcion1: "A mano, de forma artesanal", opcion2: "De fábrica, automatizada", opcion3: "No lleva decoración", correcta: 1, puntaje: 10 },
    { id: 231, cursoId: 3, pregunta: "El Minion Icepop tiene su baño blanco decorado en qué colores:", opcion1: "Azul y amarillo", opcion2: "Rojo y verde", opcion3: "Rosa y celeste", correcta: 1, puntaje: 10 },
    { id: 232, cursoId: 3, pregunta: "¿Cuántas variedades tiene la categoría Fruta?", opcion1: "3", opcion2: "4", opcion3: "5", correcta: 2, puntaje: 10 },
    { id: 233, cursoId: 3, pregunta: "¿Cuántas variedades tiene la categoría Crema?", opcion1: "3", opcion2: "4", opcion3: "5", correcta: 2, puntaje: 10 },
    { id: 234, cursoId: 3, pregunta: "El Cannoli Dulce de Leche Repostero está bañado en:", opcion1: "Chocolate blanco con coco", opcion2: "Chocolate con leche", opcion3: "Chocolate semiamargo", correcta: 1, puntaje: 10 },
    { id: 235, cursoId: 3, pregunta: "El Geladot Chocolate Dark 72% está bañado en:", opcion1: "Chocolate dark", opcion2: "Chocolate blanco", opcion3: "Chocolate con leche", correcta: 1, puntaje: 10 },
    { id: 236, cursoId: 3, pregunta: "¿Cuántas variedades tiene la categoría Dubai?", opcion1: "1", opcion2: "2", opcion3: "3", correcta: 1, puntaje: 10 },
    { id: 237, cursoId: 3, pregunta: "El Icepop Flan con DDL & Caramelo tiene:", opcion1: "Corazón de caramelo", opcion2: "Corazón de chocolate", opcion3: "Sin relleno", correcta: 1, puntaje: 10 },
    { id: 238, cursoId: 3, pregunta: "El Oli Dolca es sabor:", opcion1: "Bananita dolca", opcion2: "Pistacho", opcion3: "Frutilla", correcta: 1, puntaje: 10 },
    { id: 239, cursoId: 3, pregunta: "El Fiore Frutilla a la Crema se decora con:", opcion1: "Granas multicolores y ojos de chocolate blanco", opcion2: "Solo granas", opcion3: "Sin decoración", correcta: 1, puntaje: 10 },
    { id: 240, cursoId: 3, pregunta: "El Enzo Dulce de Leche con Gianduia contiene:", opcion1: "Avellanas", opcion2: "Maní", opcion3: "Nueces", correcta: 1, puntaje: 10 },
    { id: 275, cursoId: 3, pregunta: "El Multifruta se decora con mandarina, frutilla y:", opcion1: "Kiwi", opcion2: "Frambuesa", opcion3: "Uva", correcta: 1, puntaje: 10 },
    { id: 276, cursoId: 3, pregunta: "El Icepop Frutilla se elabora con frutillas frescas de:", opcion1: "Nuestra región", opcion2: "Importación", opcion3: "Producción congelada", correcta: 1, puntaje: 10 },
    { id: 277, cursoId: 3, pregunta: "El Icepop Mandarina se elabora con mandarinas:", opcion1: "Naturales exprimidas", opcion2: "En almíbar", opcion3: "Deshidratadas", correcta: 1, puntaje: 10 },
    { id: 278, cursoId: 3, pregunta: "El Icepop Limón se elabora con jugo de limones exprimidos:", opcion1: "En el momento de la elaboración", opcion2: "El día anterior", opcion3: "Congelado", correcta: 1, puntaje: 10 },
    { id: 279, cursoId: 3, pregunta: "El Double Chocolate & King lleva chocolate blanco veteado con chocolate con leche y:", opcion1: "Avellanas", opcion2: "Maní", opcion3: "Pistacchio", correcta: 1, puntaje: 10 },
    { id: 280, cursoId: 3, pregunta: "El Double Chocolate & Chocolate lleva doble baño de:", opcion1: "Chocolate blanco y semiamargo", opcion2: "Chocolate con leche y blanco", opcion3: "Solo semiamargo", correcta: 1, puntaje: 10 },
    { id: 281, cursoId: 3, pregunta: "El Pistacchio Luxury está bañado en:", opcion1: "Chocolate blanco sabor pistacchio", opcion2: "Chocolate semiamargo", opcion3: "Chocolate con leche", correcta: 1, puntaje: 10 },
    { id: 282, cursoId: 3, pregunta: "El Cheesecake de Maracuyá es un helado de crema de yogurt y:", opcion1: "Mascarpone con maracuyá", opcion2: "Dulce de leche", opcion3: "Queso crema solo", correcta: 1, puntaje: 10 },
    { id: 283, cursoId: 3, pregunta: "El Icepop Chocotorta lleva vetas de DDL premium, queso crema y:", opcion1: "Una galletita entera", opcion2: "Solo cacao", opcion3: "Merengue", correcta: 1, puntaje: 10 },
    { id: 284, cursoId: 3, pregunta: "El Cannoli Pistacchio va bañado en chocolate blanco sabor pistacchio y trozos de:", opcion1: "Pistacchio", opcion2: "Maní", opcion3: "Avellana", correcta: 1, puntaje: 10 },
    { id: 285, cursoId: 3, pregunta: "El Cannoli Dulce de Leche va bañado en chocolate con leche y trozos de:", opcion1: "Maní", opcion2: "Pistacchio", opcion3: "Coco", correcta: 1, puntaje: 10 },
    { id: 286, cursoId: 3, pregunta: "El Cannoli Gianduia va relleno de avella gianduia, bañado en chocolate semiamargo y trozos de:", opcion1: "Avellana", opcion2: "Maní", opcion3: "Pistacchio", correcta: 1, puntaje: 10 },
    { id: 287, cursoId: 3, pregunta: "El Cannoli Alfajor va relleno de helado de alfajor, bañado en:", opcion1: "Chocolate semiamargo", opcion2: "Chocolate blanco", opcion3: "Chocolate con leche", correcta: 1, puntaje: 10 },
    { id: 288, cursoId: 3, pregunta: "El Cannoli Yogurt de Frutilla va bañado en:", opcion1: "Chocolate con leche", opcion2: "Chocolate blanco", opcion3: "Chocolate semiamargo", correcta: 1, puntaje: 10 },
    { id: 289, cursoId: 3, pregunta: "El Icepop Dubai tiene un crocante delicado que emula el:", opcion1: "Kadayif", opcion2: "Crumble", opcion3: "Merengue", correcta: 1, puntaje: 10 },
    { id: 290, cursoId: 3, pregunta: "El Crema Mascarpone (Icepop) está veteado con frutos del bosque de:", opcion1: "La Patagonia Argentina", opcion2: "Cuyo", opcion3: "Importados de Europa", correcta: 1, puntaje: 10 },
    { id: 291, cursoId: 3, pregunta: "El Menta con Chocolate (Icepop) está veteado con:", opcion1: "Stracciatella", opcion2: "Chips de menta", opcion3: "Granella", correcta: 1, puntaje: 10 },
    { id: 292, cursoId: 3, pregunta: "El Chocolate Lucciano's con Bombón de Avellanas (Icepop) es de chocolate belga:", opcion1: "Extra amargo", opcion2: "Con leche", opcion3: "Blanco", correcta: 1, puntaje: 10 },
    { id: 293, cursoId: 3, pregunta: "El Crema Chantilly (Bañados) está bañado en chocolate semiamargo con trozos de:", opcion1: "Maní caramelizado", opcion2: "Avellana", opcion3: "Coco", correcta: 1, puntaje: 10 },
    { id: 294, cursoId: 3, pregunta: "El Dulce de Leche & Crocante está bañado con chocolate blanco y trozos de:", opcion1: "Maní caramelizado", opcion2: "Pistacchio", opcion3: "Avellana", correcta: 1, puntaje: 10 },
    { id: 295, cursoId: 3, pregunta: "El Chocolate & Crocante está bañado en chocolate semiamargo con trozos de:", opcion1: "Maní caramelizado", opcion2: "Avellana", opcion3: "Pistacchio", correcta: 1, puntaje: 10 },
    { id: 296, cursoId: 3, pregunta: "El Dulce de Leche & Cookies está bañado en chocolate con leche y:", opcion1: "Galletitas de chocolate", opcion2: "Crocante de maní", opcion3: "Coco rallado", correcta: 1, puntaje: 10 },
    { id: 297, cursoId: 3, pregunta: "El Cookies & Cream (Bañados) está veteado con avella black y bañado en:", opcion1: "Chocolate blanco", opcion2: "Chocolate semiamargo", opcion3: "Chocolate con leche", correcta: 1, puntaje: 10 },
    { id: 298, cursoId: 3, pregunta: "El Oli King tiene sus huellas bañadas con:", opcion1: "Stracciatella", opcion2: "Maní caramelizado", opcion3: "Granas multicolores", correcta: 1, puntaje: 10 },
    { id: 299, cursoId: 3, pregunta: "El Chocolate Blanco & Pistacchio Crock (Icepop) es un lanzamiento:", opcion1: "Nuevo", opcion2: "Descontinuado", opcion3: "De temporada pasada", correcta: 1, puntaje: 10 },
    { id: 300, cursoId: 3, pregunta: "El Geladot Frutilla está bañado en:", opcion1: "Chocolate con leche", opcion2: "Chocolate blanco", opcion3: "Chocolate dark", correcta: 1, puntaje: 10 },
    { id: 301, cursoId: 3, pregunta: "El Geladot King Bianco está bañado en:", opcion1: "Chocolate blanco", opcion2: "Chocolate con leche", opcion3: "Chocolate semiamargo", correcta: 1, puntaje: 10 },
    { id: 302, cursoId: 3, pregunta: "El Geladot Frambuesa está bañado en:", opcion1: "Chocolate con leche", opcion2: "Chocolate blanco", opcion3: "Chocolate dark", correcta: 1, puntaje: 10 },
    { id: 303, cursoId: 3, pregunta: "El Geladot Pistacchio está bañado en:", opcion1: "Chocolate blanco sabor pistacchio", opcion2: "Chocolate con leche", opcion3: "Chocolate dark", correcta: 1, puntaje: 10 },
    { id: 304, cursoId: 3, pregunta: "El Geladot Dulce de Leche está bañado en:", opcion1: "Chocolate con leche", opcion2: "Chocolate blanco", opcion3: "Chocolate semiamargo", correcta: 1, puntaje: 10 },
    { id: 305, cursoId: 3, pregunta: "El Geladot Gianduia está bañado en:", opcion1: "Chocolate semiamargo", opcion2: "Chocolate con leche", opcion3: "Chocolate blanco", correcta: 1, puntaje: 10 },
    { id: 306, cursoId: 3, pregunta: "El Mini Avellanas & Chocolate está cubierto con chocolate con leche y crocante de:", opcion1: "Avellanas", opcion2: "Maní", opcion3: "Pistacchio", correcta: 1, puntaje: 10 },
    { id: 307, cursoId: 3, pregunta: "El Mini Chocolate está bañado en chocolate semiamargo y crocante de:", opcion1: "Maní", opcion2: "Avellana", opcion3: "Pistacchio", correcta: 1, puntaje: 10 },
    { id: 308, cursoId: 3, pregunta: "El Mini Dulce de Leche está cubierto con chocolate blanco y crocante de:", opcion1: "Maní", opcion2: "Avellana", opcion3: "Coco", correcta: 1, puntaje: 10 },
    { id: 309, cursoId: 3, pregunta: "El Mini Cookies & Cream está veteado con avella black y bañado en:", opcion1: "Chocolate blanco", opcion2: "Chocolate con leche", opcion3: "Chocolate semiamargo", correcta: 1, puntaje: 10 },
    { id: 310, cursoId: 3, pregunta: "El Mini Pistacchio está bañado en chocolate blanco sabor pistacchio y crocante de:", opcion1: "Pistacchio", opcion2: "Maní", opcion3: "Avellana", correcta: 1, puntaje: 10 },
    { id: 311, cursoId: 3, pregunta: "El Mini Chocolate Blanco & Pistacchio Crock es un sabor:", opcion1: "Nuevo", opcion2: "Descontinuado", opcion3: "Estacional", correcta: 1, puntaje: 10 },
    // Curso 4 — Pastelería
    { id: 91, cursoId: 4, pregunta: "Vencimiento de las tortas:", opcion1: "3 días", opcion2: "4 días", opcion3: "5 días", correcta: 2, puntaje: 10 },
    { id: 92, cursoId: 4, pregunta: "El Lemon Pie se decora con:", opcion1: "Coco rallado", opcion2: "Hojas de menta", opcion3: "Granella", correcta: 2, puntaje: 10 },
    { id: 93, cursoId: 4, pregunta: "El Cheesecake se decora con:", opcion1: "Hojas de menta", opcion2: "Crumble", opcion3: "Cacao", correcta: 1, puntaje: 10 },
    { id: 94, cursoId: 4, pregunta: "La Torta de Coco se decora con:", opcion1: "Coco rallado por encima", opcion2: "Menta", opcion3: "Crumble de manzana", correcta: 1, puntaje: 10 },
    { id: 95, cursoId: 4, pregunta: "El Brownie con DDL lleva:", opcion1: "Merengue italiano flambeado", opcion2: "Solo crema", opcion3: "Frutas", correcta: 1, puntaje: 10 },
    { id: 96, cursoId: 4, pregunta: "La Chocotorta lleva galletitas con:", opcion1: "Almíbar de café", opcion2: "Leche", opcion3: "Agua", correcta: 1, puntaje: 10 },
    { id: 97, cursoId: 4, pregunta: "El Budín de Limón lleva:", opcion1: "Semillas de amapola + glaseado de limón", opcion2: "Coco", opcion3: "Chocolate", correcta: 1, puntaje: 10 },
    { id: 98, cursoId: 4, pregunta: "El Budín Marmolado combina:", opcion1: "Vainilla y chocolate", opcion2: "Limón y naranja", opcion3: "Café y canela", correcta: 1, puntaje: 10 },
    { id: 99, cursoId: 4, pregunta: "Vencimiento de medialunas y croissants:", opcion1: "Diario", opcion2: "2 días", opcion3: "4 días", correcta: 1, puntaje: 10 },
    { id: 100, cursoId: 4, pregunta: "Vencimiento de rolls y pains:", opcion1: "Diario", opcion2: "2 días", opcion3: "4 días", correcta: 2, puntaje: 10 },
    { id: 101, cursoId: 4, pregunta: "Temperatura de descongelado en heladera:", opcion1: "4-6°C por 8-10hs", opcion2: "10°C por 2hs", opcion3: "0°C por 24hs", correcta: 1, puntaje: 10 },
    { id: 102, cursoId: 4, pregunta: "Temperatura de descongelado a temperatura ambiente:", opcion1: "18-22°C por 1 hora", opcion2: "25°C por 3 horas", opcion3: "10°C por 30 min", correcta: 1, puntaje: 10 },
    { id: 103, cursoId: 4, pregunta: "Temperatura de precalentado del horno:", opcion1: "190°C", opcion2: "200°C", opcion3: "210°C", correcta: 2, puntaje: 10 },
    { id: 104, cursoId: 4, pregunta: "Temperatura de horneado tras bajar:", opcion1: "165°C", opcion2: "175°C", opcion3: "185°C", correcta: 2, puntaje: 10 },
    { id: 105, cursoId: 4, pregunta: "Las piezas dulces se pincelan con:", opcion1: "Aceite", opcion2: "Huevo batido + leche", opcion3: "Solo agua", correcta: 2, puntaje: 10 },
    { id: 106, cursoId: 4, pregunta: "Las piezas dulces reciben al salir del horno:", opcion1: "Glaseado", opcion2: "Pinceladas de almíbar", opcion3: "Crema", correcta: 2, puntaje: 10 },
    { id: 107, cursoId: 4, pregunta: "¿Qué NO se debe usar para descongelar?", opcion1: "Heladera", opcion2: "Temperatura ambiente", opcion3: "Calor directo", correcta: 3, puntaje: 10 },
    { id: 108, cursoId: 4, pregunta: "Las Tostadas de Pan Casero vienen con:", opcion1: "Dip de queso, mermelada o DDL", opcion2: "Solo manteca", opcion3: "Solo mermelada", correcta: 1, puntaje: 10 },
    { id: 109, cursoId: 4, pregunta: "El Tostado de Jamón y Queso viene en:", opcion1: "2 unidades", opcion2: "4 unidades", opcion3: "6 unidades", correcta: 2, puntaje: 10 },
    { id: 110, cursoId: 4, pregunta: "Si la masa se decide guardar sin hornear, se conserva a:", opcion1: "Temperatura ambiente", opcion2: "4°C", opcion3: "Congelada", correcta: 2, puntaje: 10 },
    { id: 111, cursoId: 4, pregunta: "La Carrot Cake lleva:", opcion1: "Cheese frosting y nuez crocante", opcion2: "Chocolate y menta", opcion3: "Solo crema", correcta: 1, puntaje: 10 },
    { id: 112, cursoId: 4, pregunta: "La Red Velvet tiene:", opcion1: "Cheese frosting y migas rojas", opcion2: "Merengue", opcion3: "Crumble", correcta: 1, puntaje: 10 },
    { id: 113, cursoId: 4, pregunta: "El Rogel lleva:", opcion1: "Capas crocantes, DDL y merengue", opcion2: "Frutas", opcion3: "Chocolate", correcta: 1, puntaje: 10 },
    { id: 114, cursoId: 4, pregunta: "El Crumble de Manzana lleva:", opcion1: "Sablée, manzanas con canela y crumble", opcion2: "Solo manzanas", opcion3: "Merengue", correcta: 1, puntaje: 10 },
    { id: 115, cursoId: 4, pregunta: "La Oreo Cake lleva:", opcion1: "Galletitas, DDL, queso crema y ganache blanca", opcion2: "Solo galletitas", opcion3: "Frutos rojos", correcta: 1, puntaje: 10 },
    { id: 116, cursoId: 4, pregunta: "La Mousse de Chocolate tiene:", opcion1: "Base húmeda y ganache brillante", opcion2: "Merengue flambeado", opcion3: "Crumble", correcta: 1, puntaje: 10 },
    { id: 117, cursoId: 4, pregunta: "¿En qué etapa se debe hornear si se decide hornear directamente?", opcion1: "Continuar el proceso", opcion2: "Esperar 24 hs", opcion3: "Congelar primero", correcta: 1, puntaje: 10 },
    { id: 118, cursoId: 4, pregunta: "¿Cuánto tiempo se hornea antes de girar la placa?", opcion1: "10 min", opcion2: "15 min", opcion3: "20 min", correcta: 2, puntaje: 10 },
    { id: 119, cursoId: 4, pregunta: "Después de girar, ¿cuánto más se hornea hasta dorar?", opcion1: "5-10 min", opcion2: "10-15 min", opcion3: "20-25 min", correcta: 2, puntaje: 10 },
    { id: 120, cursoId: 4, pregunta: "Las piezas saladas, después de hornear:", opcion1: "Se enfrían sin adiciones", opcion2: "Se pincelan con almíbar", opcion3: "Se glasean", correcta: 1, puntaje: 10 },
    { id: 241, cursoId: 4, pregunta: "¿Cuántas variedades de mini tortas hay?", opcion1: "10", opcion2: "12", opcion3: "14", correcta: 2, puntaje: 10 },
    { id: 242, cursoId: 4, pregunta: "La Torta de Coco lleva de relleno:", opcion1: "Dulce de leche", opcion2: "Crema pastelera", opcion3: "Mermelada", correcta: 1, puntaje: 10 },
    { id: 243, cursoId: 4, pregunta: "El Crumble de Manzana lleva masa:", opcion1: "Sablée", opcion2: "Hojaldre", opcion3: "Bizcochuelo", correcta: 1, puntaje: 10 },
    { id: 244, cursoId: 4, pregunta: "La Cheesecake con Salsa de Frutos Rojos se decora con:", opcion1: "Hojas de menta", opcion2: "Coco rallado", opcion3: "Crumble", correcta: 1, puntaje: 10 },
    { id: 245, cursoId: 4, pregunta: "¿Cuántos productos de Pastelería Fresca hay?", opcion1: "3", opcion2: "4", opcion3: "5", correcta: 2, puntaje: 10 },
    { id: 246, cursoId: 4, pregunta: "¿En cuántas unidades vienen las Tostadas de Pan Casero?", opcion1: "3", opcion2: "4", opcion3: "6", correcta: 1, puntaje: 10 },
    { id: 247, cursoId: 4, pregunta: "¿Cuántos productos de Cocción hay?", opcion1: "4", opcion2: "6", opcion3: "8", correcta: 2, puntaje: 10 },
    { id: 248, cursoId: 4, pregunta: "El Roll de Frambuesa lleva azúcar, frambuesa y:", opcion1: "Mantequilla", opcion2: "Crema", opcion3: "Miel", correcta: 1, puntaje: 10 },
    { id: 249, cursoId: 4, pregunta: "El Pain de Chocolate usa una masa de:", opcion1: "Croissant dulce, rellena de chocolate en barra", opcion2: "Bizcochuelo", opcion3: "Hojaldre salado", correcta: 1, puntaje: 10 },
    // Curso 5 — Chocolatería
    { id: 121, cursoId: 5, pregunta: "¿Cuántas variedades de alfajor hay?", opcion1: "4", opcion2: "6", opcion3: "8", correcta: 2, puntaje: 10 },
    { id: 122, cursoId: 5, pregunta: "Gramaje del alfajor:", opcion1: "75g", opcion2: "80g", opcion3: "90g", correcta: 2, puntaje: 10 },
    { id: 123, cursoId: 5, pregunta: "La Lata x5 incluye además de los 4 clásicos:", opcion1: "Pistacho", opcion2: "Pink", opcion3: "Frutos Rojos", correcta: 2, puntaje: 10 },
    { id: 124, cursoId: 5, pregunta: "Días de vencimiento de los alfajores clásicos:", opcion1: "60", opcion2: "70", opcion3: "80", correcta: 2, puntaje: 10 },
    { id: 125, cursoId: 5, pregunta: "Días de vencimiento de Pistacho/Frutos Rojos:", opcion1: "45", opcion2: "60", opcion3: "70", correcta: 2, puntaje: 10 },
    { id: 126, cursoId: 5, pregunta: "¿Cuántas variedades de conitos hay?", opcion1: "4", opcion2: "6", opcion3: "8", correcta: 1, puntaje: 10 },
    { id: 127, cursoId: 5, pregunta: "Vencimiento de conitos clásicos:", opcion1: "50 días", opcion2: "60 días", opcion3: "70 días", correcta: 2, puntaje: 10 },
    { id: 128, cursoId: 5, pregunta: "Vencimiento de conitos Pistacho/Frutos Rojos:", opcion1: "30 días", opcion2: "45 días", opcion3: "60 días", correcta: 2, puntaje: 10 },
    { id: 129, cursoId: 5, pregunta: "La Viennesi Clásica es sabor:", opcion1: "Vainilla", opcion2: "Chocolate", opcion3: "Pistacho", correcta: 1, puntaje: 10 },
    { id: 130, cursoId: 5, pregunta: "¿Cuántas variedades de Viennesi hay?", opcion1: "2", opcion2: "3", opcion3: "4", correcta: 2, puntaje: 10 },
    { id: 131, cursoId: 5, pregunta: "¿Cuántas variedades de tabletas hay?", opcion1: "12", opcion2: "16", opcion3: "20", correcta: 2, puntaje: 10 },
    { id: 132, cursoId: 5, pregunta: "El Pack Negro trae cuántas tabletas:", opcion1: "4", opcion2: "6", opcion3: "8", correcta: 2, puntaje: 10 },
    { id: 133, cursoId: 5, pregunta: "El Pack Blanco trae cuántas tabletas:", opcion1: "4", opcion2: "6", opcion3: "8", correcta: 2, puntaje: 10 },
    { id: 134, cursoId: 5, pregunta: "¿Cuántas variedades de Avella hay?", opcion1: "4", opcion2: "6", opcion3: "8", correcta: 2, puntaje: 10 },
    { id: 135, cursoId: 5, pregunta: "Capacidad del frasco de Avella:", opcion1: "350g", opcion2: "450g", opcion3: "500g", correcta: 2, puntaje: 10 },
    { id: 136, cursoId: 5, pregunta: "La Avella Collection Dubai trae:", opcion1: "3 Avella Dubai", opcion2: "Mix de sabores", opcion3: "Solo Pistacho", correcta: 1, puntaje: 10 },
    { id: 137, cursoId: 5, pregunta: "La Lata Verde (Pistacho) incluye, además de los Mini Alfajores y Conitos Pistacho:", opcion1: "3 Viennesi Pistacho y Squares Choco Pistacho", opcion2: "Solo bombones de DDL", opcion3: "Tabletas Dubai", correcta: 1, puntaje: 10 },
    { id: 138, cursoId: 5, pregunta: "¿Qué incluye la Lata Bordó?", opcion1: "Mix clásico de alfajores, conitos y squares", opcion2: "Solo pistacho", opcion3: "Solo dark", correcta: 1, puntaje: 10 },
    { id: 139, cursoId: 5, pregunta: "¿Qué incluye la Lata Negra?", opcion1: "Mini alfajores Dark/Semiamargo + conitos + squares", opcion2: "Solo conitos", opcion3: "Solo squares", correcta: 1, puntaje: 10 },
    { id: 140, cursoId: 5, pregunta: "Regla de la unidad exhibida en merchandising:", opcion1: "Se puede vender", opcion2: "No debe venderse", opcion3: "Solo si lo pide el cliente", correcta: 2, puntaje: 10 },
    { id: 141, cursoId: 5, pregunta: "La Lata Corazón trae:", opcion1: "12 bombones rellenos de DDL", opcion2: "Alfajores", opcion3: "Conitos", correcta: 1, puntaje: 10 },
    { id: 143, cursoId: 5, pregunta: "Square Surtidos x18, ¿cuántas variedades?", opcion1: "4", opcion2: "6", opcion3: "8", correcta: 2, puntaje: 10 },
    { id: 144, cursoId: 5, pregunta: "Square Surtidos x32, ¿cuántas variedades en total?", opcion1: "6", opcion2: "8", opcion3: "10", correcta: 2, puntaje: 10 },
    { id: 145, cursoId: 5, pregunta: "¿Dónde se puede exhibir Squares?", opcion1: "En cualquier mesada", opcion2: "Solo en exhibidoras con temperatura controlada o muebles aprobados", opcion3: "En la vidriera", correcta: 2, puntaje: 10 },
    { id: 146, cursoId: 5, pregunta: "Temperatura máxima ambiente de conservación de Squares:", opcion1: "16°C", opcion2: "18°C", opcion3: "20°C", correcta: 2, puntaje: 10 },
    { id: 147, cursoId: 5, pregunta: "¿Se puede congelar el chocolate Squares?", opcion1: "Sí", opcion2: "No", opcion3: "Solo en verano", correcta: 2, puntaje: 10 },
    { id: 148, cursoId: 5, pregunta: "¿Qué chocolate se usa en el Jameson Icepop?", opcion1: "Belga 72%", opcion2: "Argentino 50%", opcion3: "Suizo 60%", correcta: 1, puntaje: 10 },
    { id: 149, cursoId: 5, pregunta: "El Square relleno con Avella Pistacchio está en presentación:", opcion1: "x18", opcion2: "x32", opcion3: "Ambas", correcta: 2, puntaje: 10 },
    { id: 150, cursoId: 5, pregunta: "Si el cliente muestra interés en Squares se le ofrece:", opcion1: "Solo Pack Negro", opcion2: "Pack Negro, Pack Blanco o armar 6 a elección", opcion3: "Nada, no se vende suelto", correcta: 2, puntaje: 10 },
    { id: 312, cursoId: 5, pregunta: "La Caja x6 de alfajores incluye 2 Semiamargo, 2 Blanco, 1 Dark y:", opcion1: "1 Nuez", opcion2: "1 Pistacchio", opcion3: "1 Frutos Rojos", correcta: 1, puntaje: 10 },
    { id: 313, cursoId: 5, pregunta: "La Caja x10 de alfajores incluye 3 Semiamargo, 3 Blanco, 2 Dark y:", opcion1: "2 Nuez", opcion2: "2 Pistacchio", opcion3: "2 Frutos Rojos", correcta: 1, puntaje: 10 },
    { id: 314, cursoId: 5, pregunta: "Los Mini Alfajores Surtidos x12 combinan Semiamargo, Blanco, Dark y:", opcion1: "Blanco & Nuez", opcion2: "Pistacchio", opcion3: "Frutos Rojos", correcta: 1, puntaje: 10 },
    { id: 315, cursoId: 5, pregunta: "Los Mini Alfajores Pistacchio x12 llevan corazón de:", opcion1: "Avella Pistacchio", opcion2: "Dulce de leche extra", opcion3: "Chocolate blanco", correcta: 1, puntaje: 10 },
    { id: 316, cursoId: 5, pregunta: "El Conito Pistacchio está recubierto con chocolate belga sabor pistacchio y tiene corazón de:", opcion1: "Avella Pistacchio", opcion2: "Dulce de leche", opcion3: "Chocolate blanco", correcta: 1, puntaje: 10 },
    { id: 317, cursoId: 5, pregunta: "El Conito Frutos Rojos está cubierto con chocolate blanco belga sabor frutos rojos y corazón de:", opcion1: "Frutos rojos", opcion2: "Dulce de leche", opcion3: "Pistacchio", correcta: 1, puntaje: 10 },
    { id: 318, cursoId: 5, pregunta: "La Viennesi Fondente lleva crema de chocolate bañada en:", opcion1: "Chocolate dark", opcion2: "Chocolate con leche", opcion3: "Chocolate blanco", correcta: 1, puntaje: 10 },
    { id: 319, cursoId: 5, pregunta: "La Viennesi Pistacchio lleva crema de pistacchio cubierta con:", opcion1: "Chocolate blanco", opcion2: "Chocolate dark", opcion3: "Chocolate con leche", correcta: 1, puntaje: 10 },
    { id: 320, cursoId: 5, pregunta: "La caja surtida de Viennesi trae 9 unidades:", opcion1: "3 de cada variedad", opcion2: "5 de una y 2 de cada otra", opcion3: "Solo Clásica y Pistacchio", correcta: 1, puntaje: 10 },
    { id: 321, cursoId: 5, pregunta: "La Avella Dubai lleva crema de pistacchio con crocante estilo:", opcion1: "Kadayif", opcion2: "Crumble", opcion3: "Merengue", correcta: 1, puntaje: 10 },
    { id: 322, cursoId: 5, pregunta: "La Avella Coco Rock combina chocolate blanco y coco con:", opcion1: "Coco rallado", opcion2: "Almendras", opcion3: "Avellanas enteras", correcta: 1, puntaje: 10 },
    { id: 323, cursoId: 5, pregunta: "El Avella Collection Pack Clásico combina Pistacchio, Pistacchio Crock y:", opcion1: "Gianduia", opcion2: "Dubai", opcion3: "Coco Rock", correcta: 1, puntaje: 10 },
    { id: 324, cursoId: 5, pregunta: "El Avella Collection Pack Pistacchio combina Pistacchio, Pistacchio Crock y:", opcion1: "Dubai", opcion2: "Gianduia", opcion3: "Coco Rock", correcta: 1, puntaje: 10 },
    { id: 325, cursoId: 5, pregunta: "Dentro de la familia Con Leche de tabletas, ¿cuál NO lleva azúcar?", opcion1: "Chocolate con Leche sin Azúcar", opcion2: "Chocolate con Leche con DDL", opcion3: "Chocolate con Leche con Almendras", correcta: 1, puntaje: 10 },
    { id: 326, cursoId: 5, pregunta: "Dentro de las tabletas de Chocolate Negro, el Dark clásico es al:", opcion1: "70%", opcion2: "54%", opcion3: "90%", correcta: 1, puntaje: 10 },
    { id: 327, cursoId: 5, pregunta: "La tableta Blanca con Avella Latte Crock, ¿a qué otra tableta blanca acompaña en variedad crocante?", opcion1: "Con Caramelo y Avellanas", opcion2: "Sin Azúcar", opcion3: "Frutos del Bosque", correcta: 1, puntaje: 10 },
    { id: 328, cursoId: 5, pregunta: "El Pack Negro x6 incluye Chocolate Dark, Chocolate Frutos del Bosque y:", opcion1: "Pistacho con granella y con Avella Pistacho", opcion2: "Solo tabletas con leche", opcion3: "Solo tabletas blancas", correcta: 1, puntaje: 10 },
    { id: 329, cursoId: 5, pregunta: "El Pack Blanco x6 incluye Chocolate Blanco con Caramelo y Avellanas, y:", opcion1: "Chocolate Blanco con Avella Latte Crock", opcion2: "Chocolate Dark 70%", opcion3: "Chocolate Negro con Avellanas", correcta: 1, puntaje: 10 },
    { id: 330, cursoId: 5, pregunta: "El Square Pistacchio relleno con Avella Pistacchio está disponible en la presentación:", opcion1: "x32", opcion2: "x18", opcion3: "Ambas", correcta: 1, puntaje: 10 },
    { id: 331, cursoId: 5, pregunta: "El Square Surtidos x32 incluye, además de los 6 de x18, Pistacchio con Avella Pistacchio y:", opcion1: "Con Leche relleno con Avella Gianduia", opcion2: "Caramel Gold doble", opcion3: "Semiamargo doble", correcta: 1, puntaje: 10 },
    // Curso 6 — Sistema y Caja
    { id: 151, cursoId: 6, pregunta: "¿Cuánto antes de abrir debe ingresar el personal?", opcion1: "30 min", opcion2: "1 hora", opcion3: "2 horas", correcta: 2, puntaje: 10 },
    { id: 152, cursoId: 6, pregunta: "¿Cuánto tiempo hay para desactivar la alarma al ingresar?", opcion1: "15 seg", opcion2: "30 seg", opcion3: "1 min", correcta: 2, puntaje: 10 },
    { id: 153, cursoId: 6, pregunta: "Al fichar entrada, ¿qué se debe ingresar?", opcion1: "DNI", opcion2: "Código de empleado", opcion3: "Nombre completo", correcta: 2, puntaje: 10 },
    { id: 154, cursoId: 6, pregunta: "Al iniciar caja diaria, primero se ingresa:", opcion1: "El monto de ventas", opcion2: "Código de empleado y clave", opcion3: "El nombre del cliente", correcta: 2, puntaje: 10 },
    { id: 155, cursoId: 6, pregunta: "Al facturar en efectivo, ¿qué calcula el sistema?", opcion1: "El IVA", opcion2: "El vuelto exacto", opcion3: "Nada", correcta: 2, puntaje: 10 },
    { id: 156, cursoId: 6, pregunta: "Al cerrar caja, ¿qué reporte se saca primero?", opcion1: "Z", opcion2: "X", opcion3: "Y", correcta: 2, puntaje: 10 },
    { id: 157, cursoId: 6, pregunta: "¿Quién autoriza adelantos de sueldo?", opcion1: "Cualquier cajero", opcion2: "El Responsable de Local", opcion3: "El cliente", correcta: 2, puntaje: 10 },
    { id: 158, cursoId: 6, pregunta: "Si pasada la medianoche el sistema pide cerrar caja durante un pago con Mercado Pago, ¿qué se hace?", opcion1: "Cancelar la venta", opcion2: "Cerrar caja, repetir la venta e ingresar manual el N° de transacción", opcion3: "Esperar al día siguiente", correcta: 2, puntaje: 10 },
    { id: 159, cursoId: 6, pregunta: "Para \"Venta sin cargo\" se debe completar:", opcion1: "Retira y Autoriza", opcion2: "Solo el nombre del cliente", opcion3: "Nada", correcta: 1, puntaje: 10 },
    { id: 160, cursoId: 6, pregunta: "El descuento de empleado se aplica con:", opcion1: "Código de empleado completo", opcion2: "Últimos 8 dígitos de la tarjeta", opcion3: "DNI", correcta: 2, puntaje: 10 },
    { id: 161, cursoId: 6, pregunta: "La Factura A requiere:", opcion1: "Registrar al cliente con (+)", opcion2: "Nada especial", opcion3: "Solo el ticket", correcta: 1, puntaje: 10 },
    { id: 162, cursoId: 6, pregunta: "Al finalizar cualquier compra el sistema pregunta por:", opcion1: "Bolsas usadas", opcion2: "El clima", opcion3: "El horario", correcta: 1, puntaje: 10 },
    { id: 163, cursoId: 6, pregunta: "¿Qué se debe arquear además de la caja?", opcion1: "El posnet", opcion2: "El freezer", opcion3: "La heladera", correcta: 1, puntaje: 10 },
    { id: 164, cursoId: 6, pregunta: "El Egreso de Caja por \"Adelanto\" requiere además:", opcion1: "Firma del cliente", opcion2: "Código de Empleado", opcion3: "Nada extra", correcta: 2, puntaje: 10 },
    { id: 165, cursoId: 6, pregunta: "¿Qué se hace primero al recibir mercadería?", opcion1: "Firmar el remito", opcion2: "Controlar temperatura del camión", opcion3: "Ingresar al sistema", correcta: 2, puntaje: 10 },
    { id: 166, cursoId: 6, pregunta: "¿Qué documento se firma al recibir mercadería?", opcion1: "Solo el original", opcion2: "Remito original y duplicado", opcion3: "Ninguno", correcta: 2, puntaje: 10 },
    { id: 167, cursoId: 6, pregunta: "¿Cuándo se ingresa la merma del mes?", opcion1: "Todos los días", opcion2: "Inicio y mitad de mes", opcion3: "Solo fin de mes", correcta: 2, puntaje: 10 },
    { id: 168, cursoId: 6, pregunta: "¿Qué muestra el Informe de Stock?", opcion1: "Solo ventas", opcion2: "Todos los productos presentes en el local", opcion3: "Solo faltantes", correcta: 2, puntaje: 10 },
    { id: 169, cursoId: 6, pregunta: "Para enviar vasquetas entre sucursales hay que indicar:", opcion1: "Solo la cantidad", opcion2: "Código de empleado, cantidad, empresa de flete y chofer", opcion3: "Solo el destino", correcta: 2, puntaje: 10 },
    { id: 170, cursoId: 6, pregunta: "¿Quién debe revisar los Lotes de Tarjeta?", opcion1: "Cualquier cajero", opcion2: "El responsable de local", opcion3: "El cliente", correcta: 2, puntaje: 10 },
    { id: 171, cursoId: 6, pregunta: "Al cambiar de turno, ¿quién hace el arqueo?", opcion1: "Solo el entrante", opcion2: "El saliente con el entrante presente", opcion3: "Nadie", correcta: 2, puntaje: 10 },
    { id: 172, cursoId: 6, pregunta: "Para pagos con tarjeta se debe solicitar siempre:", opcion1: "Nada", opcion2: "Documento de identidad", opcion3: "Solo la tarjeta", correcta: 2, puntaje: 10 },
    { id: 173, cursoId: 6, pregunta: "Si hay inconvenientes con la factura electrónica:", opcion1: "No se factura", opcion2: "Se emite manual con talonario", opcion3: "Se cancela la venta", correcta: 2, puntaje: 10 },
    { id: 174, cursoId: 6, pregunta: "Al cerrar el local, ¿qué dispositivo NO se apaga?", opcion1: "La PC", opcion2: "El posnet", opcion3: "El equipo de sonido", correcta: 2, puntaje: 10 },
    { id: 175, cursoId: 6, pregunta: "Al cerrar el local, antes de salir hay que:", opcion1: "Activar la alarma y salir durante el período de activado", opcion2: "Salir primero y activar después", opcion3: "Apagar todo y listo", correcta: 1, puntaje: 10 },
    { id: 176, cursoId: 6, pregunta: "La Caja Fuerte se abre con:", opcion1: "Llave física", opcion2: "Clave desde pantalla principal", opcion3: "Huella digital", correcta: 2, puntaje: 10 },
    { id: 177, cursoId: 6, pregunta: "¿Qué se revisa en los movimientos de Caja Fuerte?", opcion1: "Solo el total", opcion2: "Movimientos filtrables por fecha, exportables a Excel", opcion3: "Nada, es automático", correcta: 2, puntaje: 10 },
    { id: 178, cursoId: 6, pregunta: "Antes de cargar el saldo inicial del día hay que:", opcion1: "Verificar el cierre de caja del día anterior", opcion2: "Abrir el local", opcion3: "Llamar al proveedor", correcta: 1, puntaje: 10 },
    { id: 179, cursoId: 6, pregunta: "Pedidos a Fábrica se hacen:", opcion1: "Por teléfono", opcion2: "Seleccionando el producto desde el sistema", opcion3: "Por mail", correcta: 2, puntaje: 10 },
    { id: 180, cursoId: 6, pregunta: "Para facturar con tarjeta dividida en efectivo y tarjeta hay que:", opcion1: "Sumar todo en una sola forma de pago", opcion2: "Cargar cada monto por separado y verificar que coincidan", opcion3: "No se puede dividir", correcta: 2, puntaje: 10 },
    // Curso 7 — Atención al Cliente
    { id: 181, cursoId: 7, pregunta: "Entra un cliente al local. ¿Cómo lo recibís?", opcion1: "Le hacés una seña y esperás a que se acerque a pedir", opcion2: "\"Bienvenido a Lucciano's\", tratándolo de usted y con contacto visual", opcion3: "Seguís con lo que estabas haciendo hasta que llega al mostrador", correcta: 2, puntaje: 10 },
    { id: 182, cursoId: 7, pregunta: "Un cliente pide un sabor que no tenés disponible en ese momento. ¿Qué hacés?", opcion1: "Le decís \"no tenemos\" y esperás a que pida otra cosa", opcion2: "Le avisás que se está reponiendo y le ofrecés una alternativa o algo nuevo para degustar", opcion3: "No decís nada y esperás a que se dé cuenta solo", correcta: 2, puntaje: 10 },
    { id: 183, cursoId: 7, pregunta: "Los 3 tipos de contaminación son:", opcion1: "Física, química y biológica", opcion2: "Física, mecánica y térmica", opcion3: "Visual, sonora y química", correcta: 1, puntaje: 10 },
    { id: 184, cursoId: 7, pregunta: "¿Qué es la inocuidad?", opcion1: "Que el alimento no cause daño", opcion2: "Que sea sabroso", opcion3: "Que sea barato", correcta: 1, puntaje: 10 },
    { id: 185, cursoId: 7, pregunta: "¿Qué garantiza la calidad?", opcion1: "Que no haga daño", opcion2: "Las demandas cualitativas que espera el comprador", opcion3: "El precio", correcta: 2, puntaje: 10 },
    { id: 186, cursoId: 7, pregunta: "POES significa:", opcion1: "Procedimientos Operativos Estandarizados de Saneamiento", opcion2: "Plan de Operaciones Estándar", opcion3: "Proceso de Evaluación y Servicio", correcta: 1, puntaje: 10 },
    { id: 187, cursoId: 7, pregunta: "BPM significa:", opcion1: "Buenas Prácticas de Manufactura", opcion2: "Base de Productos del Mes", opcion3: "Bienestar del Personal y Materiales", correcta: 1, puntaje: 10 },
    { id: 188, cursoId: 7, pregunta: "La desinfección se realiza:", opcion1: "Antes de la limpieza", opcion2: "Después de la limpieza", opcion3: "Junto con la limpieza, indistinto", correcta: 2, puntaje: 10 },
    { id: 189, cursoId: 7, pregunta: "¿Cuántos pasos tiene el lavado de manos correcto?", opcion1: "5", opcion2: "7", opcion3: "9", correcta: 2, puntaje: 10 },
    { id: 190, cursoId: 7, pregunta: "Un cliente pide \"un vaso chico\". ¿Qué hacés además de cobrarlo?", opcion1: "Solo lo cobrás tal cual lo pidió", opcion2: "Le mostrás los tamaños con la mano y le contás que por un poco más puede llevar un mediano", opcion3: "Le decís que el chico no alcanza y ya está", correcta: 2, puntaje: 10 },
    { id: 191, cursoId: 7, pregunta: "Un cliente duda entre varios sabores y no se decide. ¿Cómo lo ayudás?", opcion1: "Le decís que se apure porque hay cola", opcion2: "Le contás sobre la variedad e ingredientes sin prejuzgar, prestando atención a lo que le gusta", opcion3: "Le elegís vos el sabor para agilizar", correcta: 2, puntaje: 10 },
    { id: 192, cursoId: 7, pregunta: "Vas a entregar un pedido, pero quedó mal presentado. ¿Qué hacés?", opcion1: "Lo entregás igual, ya está cobrado", opcion2: "No lo entregás así — lo rehacés antes de dárselo al cliente", opcion3: "Le avisás que así vino y listo", correcta: 2, puntaje: 10 },
    { id: 193, cursoId: 7, pregunta: "Le entregás el pedido a un cliente. ¿Qué le decís?", opcion1: "Nada, se lo alcanzás en silencio", opcion2: "\"Muchas gracias, que lo disfrute\", con voz clara y amable", opcion3: "Solo el total a pagar", correcta: 2, puntaje: 10 },
    { id: 194, cursoId: 7, pregunta: "El cliente ya pagó y se está por ir. ¿Cómo cerrás la atención?", opcion1: "No decís nada, la venta ya terminó", opcion2: "Le agradecés, lo invitás a volver y le pedís que deje una reseña en Google", opcion3: "Le decís que se apure porque hay cola", correcta: 2, puntaje: 10 },
    { id: 195, cursoId: 7, pregunta: "Un cliente se acerca enojado porque su pedido llegó mal. ¿Qué hacés primero?", opcion1: "Te defendés explicando que vos no fuiste", opcion2: "Lo escuchás con atención, sin interrumpir, hasta que termine de contarte todo", opcion3: "Lo mandás a hablar con otro compañero", correcta: 2, puntaje: 10 },
    { id: 196, cursoId: 7, pregunta: "El cliente insiste en un reclamo que no tiene razón de ser. ¿Discutís con él?", opcion1: "Sí, le explicás por qué está equivocado", opcion2: "No — argumentás que hubo un malentendido o una disfunción del servicio, sin pelear", opcion3: "Lo ignorás hasta que se canse", correcta: 2, puntaje: 10 },
    { id: 197, cursoId: 7, pregunta: "La situación con un cliente te desborda y no sabés cómo resolverla. ¿Qué hacés?", opcion1: "Discutís más fuerte para cerrar el tema", opcion2: "Recurrís al encargado del local o responsable de turno", opcion3: "Le decís que vuelva otro día", correcta: 2, puntaje: 10 },
    { id: 198, cursoId: 7, pregunta: "Son las 9 de la mañana y entra un cliente. ¿Qué le sugerís?", opcion1: "Un icepop", opcion2: "Café, medialunas o croissants — es el momento del desayuno", opcion3: "Nada, esperás a que pida", correcta: 2, puntaje: 10 },
    { id: 199, cursoId: 7, pregunta: "Es la hora pico de la tarde-noche, el momento de mayor venta del día. ¿Cómo actuás?", opcion1: "Con calma, sin apurarte", opcion2: "Rápido y expeditivo, sugiriendo en todos los productos: icepops, conos gourmet, baños de chocolate", opcion3: "Solo despachás lo que piden, sin sugerir nada", correcta: 2, puntaje: 10 },
    { id: 200, cursoId: 7, pregunta: "El uniforme debe estar:", opcion1: "Como sea", opcion2: "Limpio, planchado y sano", opcion3: "Solo limpio", correcta: 2, puntaje: 10 },
    { id: 201, cursoId: 7, pregunta: "¿Está permitido el esmalte en uñas?", opcion1: "Sí", opcion2: "No", opcion3: "Solo transparente", correcta: 2, puntaje: 10 },
    { id: 202, cursoId: 7, pregunta: "¿Está permitido usar alhajas en producción?", opcion1: "Sí", opcion2: "No", opcion3: "Solo aros pequeños", correcta: 2, puntaje: 10 },
    { id: 203, cursoId: 7, pregunta: "¿Qué se debe hacer si hay una herida?", opcion1: "Ignorarla", opcion2: "Reportarla", opcion3: "Seguir trabajando igual", correcta: 2, puntaje: 10 },
    { id: 204, cursoId: 7, pregunta: "¿Cuándo se debe lavar las manos?", opcion1: "Solo al llegar", opcion2: "Antes de trabajar, después del baño, al cambiar de área, etc.", opcion3: "Una vez al día", correcta: 2, puntaje: 10 },
    { id: 205, cursoId: 7, pregunta: "Contaminación física se refiere a:", opcion1: "Bacterias", opcion2: "Elementos extraños como vidrio o clavos", opcion3: "Productos de limpieza", correcta: 2, puntaje: 10 },
    { id: 206, cursoId: 7, pregunta: "Contaminación química se refiere a:", opcion1: "Bacterias", opcion2: "Sustancias tóxicas como productos de limpieza", opcion3: "Elementos extraños", correcta: 2, puntaje: 10 },
    { id: 207, cursoId: 7, pregunta: "Contaminación biológica se refiere a:", opcion1: "Bacterias o toxinas", opcion2: "Vidrios", opcion3: "Detergentes", correcta: 1, puntaje: 10 },
    { id: 208, cursoId: 7, pregunta: "¿Cuál de los Principios de Tonio habla de la sonrisa como materia prima?", opcion1: "Seguridad", opcion2: "Cortesía", opcion3: "Eficiencia", correcta: 2, puntaje: 10 },
    { id: 209, cursoId: 7, pregunta: "¿Qué principio de Tonio habla de imagen y energía?", opcion1: "Inclusión", opcion2: "Actitud", opcion3: "Eficiencia", correcta: 2, puntaje: 10 },
    { id: 210, cursoId: 7, pregunta: "¿Cuál es nuestro propósito principal?", opcion1: "Vender más", opcion2: "Crear sonrisas a través de la excelencia", opcion3: "Abrir más locales", correcta: 2, puntaje: 10 },
];

/* ============================
   Lucciano's Academy — datos de muestra
   Tabla "Asignaciones" (colaboradorId, cursoId, fechaAlta, fechaVencimiento, estado, progreso)

   Repartidas entre enero y julio 2026, con estados mixtos, para que
   el Dashboard Ejecutivo (evolución mensual, rankings) y el Centro
   de Alertas (cursos vencidos) tengan señal real. colaboradorId 12,
   14 y 19 quedan con una asignación vencida a propósito.
=============================*/

const asignacionesMock = [
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

/* ============================
   Lucciano's Academy — datos de muestra
   Tabla "Resultados" (colaboradorId, cursoId, nota, aprobado, fechaFinalizacion)

   Un resultado por cada asignación "completado" en asignaciones.mock.js,
   repartidos entre enero y julio 2026 para que la evolución mensual
   y el promedio general del Dashboard Ejecutivo tengan variación real.
=============================*/

const resultadosMock = [
    { id: 1,  colaboradorId: 10, cursoId: 1, nota: 9,   aprobado: "SI", fechaFinalizacion: "2026-02-28" },
    { id: 2,  colaboradorId: 10, cursoId: 7, nota: 8,   aprobado: "SI", fechaFinalizacion: "2026-07-01" },
    { id: 3,  colaboradorId: 11, cursoId: 1, nota: 8,   aprobado: "SI", fechaFinalizacion: "2026-02-14" },
    { id: 4,  colaboradorId: 11, cursoId: 2, nota: 9.5, aprobado: "SI", fechaFinalizacion: "2026-05-30" },
    { id: 5,  colaboradorId: 13, cursoId: 1, nota: 7,   aprobado: "SI", fechaFinalizacion: "2026-03-09" },
    { id: 6,  colaboradorId: 14, cursoId: 1, nota: 5,   aprobado: "NO", fechaFinalizacion: "2026-04-30" },
    { id: 7,  colaboradorId: 15, cursoId: 1, nota: 8.5, aprobado: "SI", fechaFinalizacion: "2026-04-14" },
    { id: 8,  colaboradorId: 15, cursoId: 4, nota: 9,   aprobado: "SI", fechaFinalizacion: "2026-06-19" },
    { id: 9,  colaboradorId: 16, cursoId: 1, nota: 6,   aprobado: "SI", fechaFinalizacion: "2026-03-19" },
    { id: 10, colaboradorId: 17, cursoId: 1, nota: 7.5, aprobado: "SI", fechaFinalizacion: "2026-04-04" },
    { id: 11, colaboradorId: 18, cursoId: 1, nota: 9,   aprobado: "SI", fechaFinalizacion: "2026-02-19" },
    { id: 12, colaboradorId: 18, cursoId: 2, nota: 5.5, aprobado: "NO", fechaFinalizacion: "2026-06-14" },
    { id: 13, colaboradorId: 20, cursoId: 1, nota: 8,   aprobado: "SI", fechaFinalizacion: "2026-04-24" },
    { id: 14, colaboradorId: 21, cursoId: 1, nota: 9,   aprobado: "SI", fechaFinalizacion: "2026-03-04" },
    { id: 15, colaboradorId: 21, cursoId: 4, nota: 7,   aprobado: "SI", fechaFinalizacion: "2026-06-24" },
];

/* ============================
   Lucciano's Academy — datos de muestra
   Tabla "Auditoria" (fecha, usuarioId, accion, detalle)

   A propósito, ningún evento tiene usuarioId 9, 20 o 21 (Barbara
   Riccitelli y su equipo en Lucciano's Shopping Abasto CABA) — así
   "Locales sin actividad" (Centro de Alertas) tiene al menos un
   caso real entre los locales que sí tienen supervisor asignado.
=============================*/

const auditoriaMock = [
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

const noticiasMock = [
    { id: 6, titulo: "Certificado Kosher renovado", fecha: "2026-03-01", resumen: "Ajdut Israel Kosher renovó el certificado de Heladerías Lucciano's (Sello AK 16469/70), vigente hasta el 28 de febrero de 2027. El catálogo ya está actualizado con las etiquetas Parve y Dairy correspondientes.", detalle: "El certificado distingue dos categorías: Parve (sin lácteos, apto para acompañar cualquier comida) y Dairy/Jalav Stam (contiene lácteos). Aplica a helados, palitos, tabletas, potes sin gluten y Geladot's de Heladería, además de las líneas equivalentes de Icepops y Chocolatería. Revisá el badge Parve/Dairy en la ficha de cada producto del catálogo.", enlace: "2", adjuntoUrl: "assets/docs/certificado-kosher.pdf", adjuntoLabel: "Ver certificado" },
    { id: 5, titulo: "Lanzamiento: Tableta Dubai Pistacchio", fecha: "2026-07-16", resumen: "Se suma a la colección de Tabletas Dubai — date una vuelta por Chocolatería para conocer el producto, el código y las reglas de exhibición.", detalle: "", enlace: "5" },
    { id: 1, titulo: "Nuevas Squares en Chocolatería", fecha: "2026-06-25", resumen: "Ya están disponibles las presentaciones x18 y x32 — revisá el módulo de Chocolatería para conocer los surtidos.", detalle: "", enlace: "5" },
    { id: 2, titulo: "Recordatorio: Atención al Cliente", fecha: "2026-06-18", resumen: "Repasá el protocolo de manejo de quejas — es uno de los módulos con más peso en tu evaluación.", detalle: "", enlace: "" },
    { id: 3, titulo: "Lucciano's llega a Chile", fecha: "2026-06-05", resumen: "Sumamos un nuevo país a la red internacional — repasá la línea de tiempo completa en Nuestra Historia.", detalle: "", enlace: "" },
    { id: 4, titulo: "Actualizamos el módulo de Heladería", fecha: "2026-05-28", resumen: "Sumamos la referencia completa de temperaturas y el procedimiento de pase de helado.", detalle: "", enlace: "2" },
];


// Vacío a propósito — todavía no hay links reales cargados (ver
// pages/manuales.js, el admin los carga con "+ Nuevo manual"). Igual
// que noticiasMock, es el fallback en modo demo y la semilla inicial.
const manualesMock = [];

function poblarDatosIniciales() {
    _poblarHoja("Sucursales", sucursalesMock);
    _poblarHoja("Usuarios", usuariosMock);
    _poblarHoja("Cursos", cursosMock);
    _poblarHoja("Lecciones", leccionesMock);
    _poblarHoja("Evaluaciones", evaluacionesMock);
    _poblarHoja("Asignaciones", asignacionesMock);
    _poblarHoja("Resultados", resultadosMock);
    _poblarHoja("Auditoria", auditoriaMock);
    _poblarHoja("Noticias", noticiasMock);
    _poblarHoja("Manuales", manualesMock);
    Logger.log("Listo — 10 hojas pobladas con los datos reales.");
}

/**
 * Repuebla SOLO la hoja "Noticias" (mismo criterio que
 * poblarPreguntasReales()/poblarLeccionesReales(): no toca ninguna
 * otra hoja). Requiere que "Noticias" ya exista con el encabezado
 * id | titulo | fecha | resumen | detalle | enlace | adjuntoUrl |
 * adjuntoLabel — creala a mano antes de correr esto si todavía no
 * existe. Las últimas 4 son opcionales por fila (texto largo a
 * desplegar / id de un Curso para el botón "Ir al curso" / ruta o
 * link de un archivo para el botón "Ver adjunto" y su texto — ver
 * pages/noticias.js), pero las columnas tienen que existir igual
 * aunque queden vacías.
 */
function poblarNoticiasReales() {
    _poblarHoja("Noticias", noticiasMock);
    Logger.log("Listo — Noticias poblada con " + noticiasMock.length + " noticia(s) (no se tocó ninguna otra hoja).");
}

/**
 * Repuebla SOLO la hoja "Manuales" (mismo criterio que
 * poblarNoticiasReales(): no toca ninguna otra hoja). Requiere que
 * "Manuales" ya exista con el encabezado
 * id | titulo | categoria | url | visiblePara | sucursal
 * — creala a mano antes de correr esto si todavía no existe.
 * "categoria" es opcional por fila (ver pages/manuales.js), pero la
 * columna tiene que existir igual aunque quede vacía. "url" es el
 * link real del manual (Drive u otro) — no se sube ningún archivo.
 * "visiblePara" es una lista separada por comas de roles que pueden
 * VER el manual (colaborador,supervisor,admin) — vacío = visible para
 * todos. "sucursal" acota el manual a un local puntual (ej. "Lucciano's
 * La Imprenta Gran Hotel CABA") — vacío = aplica a todos los locales;
 * solo filtra a un Colaborador raso, Supervisor/Admin siempre lo ven.
 * Editar siempre queda reservado a Admin, sin importar ninguno de los
 * dos campos (ver pages/manuales.js).
 */
function poblarManualesReales() {
    _poblarHoja("Manuales", manualesMock);
    Logger.log("Listo — Manuales poblada con " + manualesMock.length + " manual(es) (no se tocó ninguna otra hoja).");
}

/**
 * Repuebla SOLO la hoja "Evaluaciones" con las 210 preguntas reales
 * (evaluacionesMock de más arriba en este archivo). A diferencia de
 * poblarDatosIniciales(), no toca ninguna otra hoja — seguro de
 * correr aunque Usuarios/Sucursales ya tengan datos reales cargados
 * a mano. Requiere que el encabezado de "Evaluaciones" ya sea
 * id | cursoId | pregunta | opcion1 | opcion2 | opcion3 | correcta | puntaje
 * (ver README.md para la migración del encabezado viejo).
 */
function poblarPreguntasReales() {
    _poblarHoja("Evaluaciones", evaluacionesMock);
    Logger.log("Listo — Evaluaciones poblada con " + evaluacionesMock.length + " preguntas reales (no se tocó ninguna otra hoja).");
}

/**
 * Repuebla SOLO la hoja "Lecciones" (mismo criterio que
 * poblarPreguntasReales(): no toca ninguna otra hoja). Requiere que
 * el encabezado de "Lecciones" ya sea
 * id | cursoId | orden | titulo | objetivo | duracionMinutos | video | manual | imagen | procedimiento | errores | buenasPracticas | consejo | resumen | estado
 * (ver README.md para la migración del encabezado viejo).
 */
function poblarLeccionesReales() {
    _poblarHoja("Lecciones", leccionesMock);
    Logger.log("Listo — Lecciones poblada con " + leccionesMock.length + " lecciones (no se tocó ninguna otra hoja).");
}

/**
 * Repuebla SOLO la hoja "Cursos" (mismo criterio que las anteriores:
 * no toca ninguna otra hoja). Útil para aplicar cambios de orden
 * (ej. "Atención al Cliente" pasó a orden:1) sin re-cargar Usuarios,
 * Lecciones ni Evaluaciones.
 */
function poblarCursosReales() {
    _poblarHoja("Cursos", cursosMock);
    Logger.log("Listo — Cursos poblada con " + cursosMock.length + " cursos (no se tocó ninguna otra hoja).");
}

function _poblarHoja(nombreHoja, filas) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nombreHoja);
    if (!sheet) {
        Logger.log('No existe la hoja "' + nombreHoja + '" — creala con sus encabezados antes de correr esto (ver README.md).');
        return;
    }

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const filasExistentes = sheet.getLastRow() - 1;
    if (filasExistentes > 0) {
        sheet.deleteRows(2, filasExistentes);
    }

    const valores = filas.map((fila) => headers.map((h) => (fila[h] !== undefined ? fila[h] : "")));
    if (valores.length) {
        sheet.getRange(2, 1, valores.length, headers.length).setValues(valores);
    }
}

/**
 * Utilidad de una sola vez — NO es parte del modelo de datos ni se
 * llama desde la app. Lista todos los archivos de una carpeta de
 * Drive, fuerza que cada uno quede compartido "Cualquiera con el
 * enlace / Lector" (así no hace falta ir uno por uno a mano) y
 * loguea nombre + link listo para usar en la columna "imagen".
 *
 * Cómo usarla: pegá esta función en el editor de Apps Script, elegí
 * "listarImagenesCarpeta" en el desplegable de funciones y tocá
 * Ejecutar. Después Ver → Registros de ejecución y pegame ese
 * resultado tal cual.
 */
function listarImagenesCarpeta() {
    const folderId = "16IWPIT6oDpp9bLvwIOb_VnPDtQDEoCBs";
    const carpeta = DriveApp.getFolderById(folderId);
    const archivos = carpeta.getFiles();

    while (archivos.hasNext()) {
        const archivo = archivos.next();
        archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        const link = "https://lh3.googleusercontent.com/d/" + archivo.getId();
        Logger.log(archivo.getName() + " | " + link);
    }
}

/**
 * Igual que listarImagenesCarpeta, pero para una carpeta que tiene
 * subcarpetas adentro (una por categoría de producto, ej. Chocolatería:
 * avellas/conitos/Latas/tabletas/Viennesis) en vez de fotos sueltas.
 * Lista los archivos de cada subcarpeta con el nombre de la subcarpeta
 * como prefijo, para saber de qué categoría es cada foto. También
 * fuerza "Cualquiera con el enlace / Lector" en cada una.
 *
 * Cómo usarla: pegá esta función en el editor de Apps Script, elegí
 * "listarImagenesCarpetaRecursiva" en el desplegable de funciones y
 * tocá Ejecutar. Después Ver → Registros de ejecución y pegame ese
 * resultado tal cual.
 */
function listarImagenesCarpetaRecursiva() {
    const folderId = "1nmJMFU3ibqnNBaV3CM3v0ksLHRH8NES2"; // carpeta "alfajores"
    const carpetaRaiz = DriveApp.getFolderById(folderId);

    const listarArchivosDe = (carpeta, prefijo) => {
        const archivos = carpeta.getFiles();
        while (archivos.hasNext()) {
            const archivo = archivos.next();
            archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            const link = "https://lh3.googleusercontent.com/d/" + archivo.getId();
            Logger.log(prefijo + archivo.getName() + " | " + link);
        }
    };

    listarArchivosDe(carpetaRaiz, "");

    const subcarpetas = carpetaRaiz.getFolders();
    while (subcarpetas.hasNext()) {
        const subcarpeta = subcarpetas.next();
        listarArchivosDe(subcarpeta, subcarpeta.getName() + "/");
    }
}

/**
 * Igual que listarImagenesCarpeta, pero para videos (u otro archivo
 * que no sea imagen): el formato lh3.googleusercontent.com es solo
 * para imágenes, para el resto se usa el link normal "/view" — que es
 * justo el formato que ya espera la columna "video" de Lecciones (se
 * muestra como link "Ver video" que abre en pestaña nueva, no
 * embebido — ver pages/cursos.js). Fuerza que cada archivo quede
 * compartido "Cualquiera con el enlace / Lector".
 *
 * Cómo usarla: pegá esta función en el editor de Apps Script, elegí
 * "listarArchivosCarpeta" en el desplegable de funciones y tocá
 * Ejecutar. Después Ver → Registros de ejecución y pegame ese
 * resultado tal cual.
 */
function listarArchivosCarpeta() {
    const folderId = "1DuQRFql3HseNKij28Gz8I_75opWDo6zq";
    const carpeta = DriveApp.getFolderById(folderId);
    const archivos = carpeta.getFiles();

    while (archivos.hasNext()) {
        const archivo = archivos.next();
        archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        const link = "https://drive.google.com/file/d/" + archivo.getId() + "/view";
        Logger.log(archivo.getName() + " | " + link);
    }
}

/**
 * Utilidad de una sola vez — NO es parte del modelo de datos ni se
 * llama desde la app. Agrega una columna "modulo" al final de cada
 * hoja que tenga "cursoId", con una fórmula VLOOKUP que resuelve el
 * nombre real del curso (Cursos!A:B) — así en el Sheet ya no hace
 * falta recordar que "1" es Cafetería, "2" es Heladería, etc. Si
 * cambiás el nombre de un curso en "Cursos", se actualiza solo acá
 * también, porque es una fórmula viva, no un valor fijo.
 *
 * Es seguro correrla más de una vez: si la hoja ya tiene una columna
 * "modulo", la saltea en vez de duplicarla.
 *
 * Cómo usarla: pegá esta función en el editor de Apps Script, elegí
 * "agregarColumnaModulo" en el desplegable de funciones y tocá
 * Ejecutar.
 */
function agregarColumnaModulo() {
    // La columna "modulo" se inserta al lado de esta columna en cada
    // hoja (no al final) — así queda visible junto a lo que se está
    // editando, sin tener que scrollear hasta el final.
    const anclaPorHoja = {
        Lecciones: "titulo",
        Evaluaciones: "pregunta",
        Asignaciones: "cursoId",
        Resultados: "cursoId",
    };
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    const cursos = _filasComoObjetos(ss.getSheetByName("Cursos"));
    const nombrePorCursoId = {};
    cursos.forEach((c) => { nombrePorCursoId[String(c.id)] = c.nombre; });

    Object.keys(anclaPorHoja).forEach((nombreHoja) => {
        const sheet = ss.getSheetByName(nombreHoja);
        if (!sheet) {
            Logger.log('No existe la hoja "' + nombreHoja + '" — salteada.');
            return;
        }

        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const colCursoId = headers.indexOf("cursoId");
        if (colCursoId === -1) {
            Logger.log('"' + nombreHoja + '" no tiene columna "cursoId" — salteada.');
            return;
        }
        if (headers.indexOf("modulo") !== -1) {
            Logger.log('"' + nombreHoja + '" ya tiene columna "modulo" — salteada (no se duplica).');
            return;
        }

        const nombreAncla = anclaPorHoja[nombreHoja];
        const colAncla = headers.indexOf(nombreAncla);
        if (colAncla === -1) {
            Logger.log('"' + nombreHoja + '" no tiene columna "' + nombreAncla + '" — salteada.');
            return;
        }

        // colAncla siempre está en la misma columna que "cursoId" o
        // después — insertar acá nunca corre "cursoId" de lugar.
        sheet.insertColumnAfter(colAncla + 1);
        const nuevaCol = colAncla + 2;
        sheet.getRange(1, nuevaCol).setValue("modulo");

        const filas = sheet.getLastRow() - 1;
        if (filas > 0) {
            // Valor ya resuelto (no fórmula) — evita cualquier problema
            // de sintaxis por configuración regional (coma vs. ";").
            // Si renombrás un curso más adelante, volvé a correr esta
            // función para que la columna se actualice.
            const datosCursoId = sheet.getRange(2, colCursoId + 1, filas, 1).getValues();
            const valores = datosCursoId.map((fila) => [nombrePorCursoId[String(fila[0])] || ""]);
            sheet.getRange(2, nuevaCol, filas, 1).setValues(valores);
        }

        Logger.log('"' + nombreHoja + '": columna "modulo" agregada al lado de "' + nombreAncla + '" (columna ' + _columnaALetra(nuevaCol) + ').');
    });
}

/**
 * Agrega la columna "fechaAlta" a "Usuarios" (al lado de "activo") —
 * necesaria para que la fecha de alta que se muestra en el home del
 * Colaborador sea la real (cuándo se creó su usuario) en vez de un
 * proxy (fecha de su primera asignación), que se puede desalinear si
 * se reusa un id viejo. A partir de esta columna, crearUsuario() la
 * completa sola con la fecha de hoy — los usuarios ya existentes
 * quedan con la celda vacía hasta que se cargue a mano si hace falta.
 * Segura para correr más de una vez: si la columna ya existe, no hace nada.
 */
function agregarColumnaFechaAlta() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Usuarios");
    if (!sheet) throw new Error('No existe la hoja "Usuarios"');

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (headers.indexOf("fechaAlta") !== -1) {
        Logger.log('"Usuarios" ya tiene columna "fechaAlta" — no se duplica.');
        return;
    }

    const colActivo = headers.indexOf("activo");
    const nuevaCol = colActivo !== -1 ? colActivo + 2 : headers.length + 1;
    if (colActivo !== -1) sheet.insertColumnAfter(colActivo + 1);
    sheet.getRange(1, nuevaCol).setValue("fechaAlta");

    Logger.log('"Usuarios": columna "fechaAlta" agregada (columna ' + _columnaALetra(nuevaCol) + '). Los usuarios nuevos que se den de alta desde la app la van a completar solos — los que ya existen quedan vacíos.');
}

function _columnaALetra(columna) {
    let letra = "";
    while (columna > 0) {
        const resto = (columna - 1) % 26;
        letra = String.fromCharCode(65 + resto) + letra;
        columna = Math.floor((columna - 1) / 26);
    }
    return letra;
}

/**
 * Agrega validación de datos (dropdowns) en Cursos y Lecciones, para
 * que cargar/editar filas a mano en Sheets sea más difícil de romper:
 *
 *   Cursos.categoria    -> lista sugerida (Producto/Operaciones/Servicio/
 *                          Gestión), con ADVERTENCIA si escribís algo
 *                          distinto (no bloquea — puede aparecer una
 *                          categoría nueva legítima).
 *   Cursos.obligatorio  -> lista SI/NO, bloquea cualquier otro valor.
 *   Lecciones.cursoId   -> dropdown con los ids reales de Cursos (se
 *                          arma solo desde la columna "id" de Cursos,
 *                          así siempre queda al día); bloquea un id
 *                          que no exista, porque eso sí rompe el
 *                          link lección → curso. Se complementa con
 *                          la columna "modulo" (ver agregarColumnaModulo)
 *                          que muestra el nombre al lado para más
 *                          claridad todavía.
 *   Lecciones.estado    -> lista Activo/Inactivo, bloquea otro valor.
 *
 * No toca ninguna fila existente, solo agrega la regla de validación
 * (se puede volver a correr sin problema si agregás cursos nuevos).
 */
/**
 * Utilidad de una sola vez — agrega 9 lecciones nuevas al curso
 * Cafetería (cursoId 1), una por cada video de uso/limpieza de
 * máquina (Momento, Steamer, Aguila, Zenius) que me pasaste. Solo
 * ESCRIBE filas nuevas en Lecciones (vía appendRow, así respeta
 * cualquier fila que ya hayas cargado/editado a mano) y corrige el
 * "orden" de las 3 lecciones de cierre existentes (Errores Frecuentes,
 * Evaluación, Próximo paso — ids 49/50/51) para que sigan quedando al
 * final, después de estas 9 nuevas. No borra ni pisa ninguna otra fila.
 *
 * El objetivo de cada lección quedó genérico a propósito — no tengo
 * forma de ver el contenido real de los videos desde acá. Se puede
 * sumar procedimiento/errores/buenas prácticas más adelante editando
 * la fila directo en Sheets (ya tiene dropdown de "estado", ver
 * agregarValidacionesCursosYLecciones).
 */
function agregarLeccionesMaquinasCafeteria() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Lecciones");
    if (!sheet) throw new Error('No existe la hoja "Lecciones"');

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const colId = headers.indexOf("id");
    const colOrden = headers.indexOf("orden");
    if (colId === -1 || colOrden === -1) throw new Error('Lecciones necesita las columnas "id" y "orden"');

    const datos = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();

    // Corrige el orden de las 3 lecciones de cierre para que sigan al
    // final (28/29/30), después de las 9 máquinas nuevas (19-27).
    const ordenFinalPorId = { 49: 28, 50: 29, 51: 30 };
    datos.forEach((fila, i) => {
        const id = fila[colId];
        if (ordenFinalPorId[id] !== undefined) {
            sheet.getRange(i + 2, colOrden + 1).setValue(ordenFinalPorId[id]);
        }
    });

    let proximoId = Math.max.apply(null, datos.map((fila) => Number(fila[colId]) || 0)) + 1;

    const leccionesNuevas = [
        { orden: 19, titulo: "Máquina Momento — Uso (Parte 1)", objetivo: "Aprender a usar correctamente la máquina Momento, siguiendo el procedimiento del video.", video: "https://drive.google.com/file/d/1Bl49mf37Ygpkh771R20iVjmPnhaWaeO-/view" },
        { orden: 20, titulo: "Máquina Momento — Uso (Parte 2)", objetivo: "Continuar con el procedimiento de uso de la máquina Momento.", video: "https://drive.google.com/file/d/1aYkH2oKrzCShpWHUM2YhYBYyPLiy4m4l/view" },
        { orden: 21, titulo: "Máquina Momento — Limpieza", objetivo: "Aprender el procedimiento correcto de limpieza de la máquina Momento.", video: "https://drive.google.com/file/d/1B9y0evsD19bS24LInaKc7qXQZXai4Dck/view" },
        { orden: 22, titulo: "Máquina Steamer — Uso (Parte 1)", objetivo: "Aprender a usar correctamente el Steamer, siguiendo el procedimiento del video.", video: "https://drive.google.com/file/d/1cL10-IOF4NGsZZrwn7oH3S9hxOs3_dhT/view" },
        { orden: 23, titulo: "Máquina Steamer — Uso (Parte 2)", objetivo: "Continuar con el procedimiento de uso del Steamer.", video: "https://drive.google.com/file/d/1lnAU_rqLFfAdAwYnO3ei7ntO9e5omR3a/view" },
        { orden: 24, titulo: "Máquina Aguila — Uso (Parte 1)", objetivo: "Aprender a usar correctamente la máquina Aguila, siguiendo el procedimiento del video.", video: "https://drive.google.com/file/d/14fAnAbP0vLh0aoNcjGn8y_kViWRbPJDf/view" },
        { orden: 25, titulo: "Máquina Aguila — Uso (Parte 2)", objetivo: "Continuar con el procedimiento de uso de la máquina Aguila.", video: "https://drive.google.com/file/d/1wMDPTA0IrXhMBqbmJ3ABUxw_mXIcPYBQ/view" },
        { orden: 26, titulo: "Máquina Aguila — Limpieza", objetivo: "Aprender el procedimiento correcto de limpieza de la máquina Aguila.", video: "https://drive.google.com/file/d/1eJrGauaYdJsFuOQr8T7Rxwv-lWGO2Nq-/view" },
        { orden: 27, titulo: "Máquina Zenius — Uso y Limpieza", objetivo: "Aprender el procedimiento de uso y limpieza de la máquina Zenius.", video: "https://drive.google.com/file/d/1RC_h8sCRaMbjdwhhFIfBSRbKd7KSlduX/view" },
    ];

    leccionesNuevas.forEach((l) => {
        const fila = {
            id: proximoId++, cursoId: 1, orden: l.orden, titulo: l.titulo, objetivo: l.objetivo,
            duracionMinutos: 0, video: l.video, manual: "", imagen: "", procedimiento: "",
            errores: "", buenasPracticas: "", consejo: "", resumen: "", estado: "Activo",
        };
        const valores = headers.map((h) => (fila[h] !== undefined ? fila[h] : ""));
        sheet.appendRow(valores);
    });

    Logger.log("Listo — " + leccionesNuevas.length + " lecciones de máquinas agregadas a Cafetería (no se tocó ninguna otra fila, solo se corrigió el orden de las 3 lecciones de cierre).");
}

/**
 * Utilidad de una sola vez — reordena y enriquece Chocolatería (curso
 * 5) con contenido real (manual + guía SisCap del usuario) y fotos de
 * producto reales: separa "Conitos y Viennesi" en dos lecciones y
 * "Tabletas y Avellas" en dos lecciones, y agrega Squares (producto
 * nuevo). Actualiza las 4 filas existentes por id
 * (Alfajores/Conitos/Tabletas/Latas) y agrega 3 filas nuevas
 * (Viennesi/Avella/Squares) — no borra ni pisa ninguna otra fila de
 * Lecciones. Es seguro volver a correrla: si Viennesi/Avella/Squares
 * ya existen (por título) para el curso 5, no los duplica.
 */
function actualizarLeccionesChocolateria() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Lecciones");
    if (!sheet) throw new Error('No existe la hoja "Lecciones"');

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const colId = headers.indexOf("id");
    const colCursoId = headers.indexOf("cursoId");
    const colTitulo = headers.indexOf("titulo");
    if (colId === -1 || colCursoId === -1 || colTitulo === -1) throw new Error('Lecciones necesita las columnas "id", "cursoId" y "titulo"');

    const datos = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();

    const cambiosPorId = {
        18: { orden: 1, titulo: "Alfajores", objetivo: "Conocer las 6 variedades de alfajores clásicos y las presentaciones en Mini Alfajores.", procedimiento: "6 variedades (Semiamargo, Blanco, Dark, Blanco & Nuez, Pistacchio, Frutos Rojos) de 80g, todos rellenos de dulce de leche. Presentaciones: Unidad, Caja x6, Caja x10, Lata x5, Mini x12. Composición de cajas: Caja x6 (2 Semiamargo, 2 Blanco, 1 Dark, 1 Nuez), Caja x10 (3 Semiamargo, 3 Blanco, 2 Dark, 2 Nuez), Lata x5 (1 Semiamargo, 1 Blanco, 1 Dark, 1 Nuez, 1 Pink). Mini Alfajores: Surtidos x12 (3 Semiamargo, 3 Blanco, 3 Dark y 3 Blanco & Nuez, 40g c/u) y Pistacchio x12 (40g c/u, con corazón de Avella Pistacchio).", buenasPracticas: "Vida útil: 70 días los clásicos, 60 días Pistacho y Frutos Rojos." },
        19: { orden: 2, titulo: "Conitos", objetivo: "Conocer las 4 variedades de conitos rellenos de dulce de leche.", imagen: "https://lh3.googleusercontent.com/d/12zI5brn8k7XBmTNms7KTTocaIUlzwig4", procedimiento: "4 sabores: Chocolate Semiamargo, Chocolate Blanco, Pistacchio (con corazón de Avella Pistacchio, recubierto con chocolate belga sabor pistacchio) y Frutos Rojos (con corazón de frutos rojos, cubierto con chocolate blanco belga sabor frutos rojos). Presentaciones: Unidad y Caja x6.", buenasPracticas: "Vida útil: 60 días los clásicos, 45 días Pistacho y Frutos Rojos." },
        20: { orden: 5, titulo: "Tabletas de Chocolate", objetivo: "Conocer las 17 variedades de tabletas de chocolate belga y los packs x6.", imagen: "https://lh3.googleusercontent.com/d/1-GeN5XUGmZ1CWrtjd2ThCV6PtV3Mhc5E", procedimiento: "Con Leche: Chocolate con Leche, con Dulce de Leche, con Almendras, con Avellanas, sin Azúcar, Dubai con Leche. Chocolate Negro: Dark 70%, 54% con Avellanas, Dubai Semiamargo. Blanco: Chocolate Blanco, sin Azúcar, con Caramelo y Avellanas, con Avella Latte Crock, Frutos del Bosque. Pistacho: con granella, con Avella Pistacho, Dubai Pistacchio (relleno con Avella Dubai, pistacchios garrapiñados y granella de pistacchio — lanzamiento 16/07, código 1676, SKU 922). Pack Negro x6: Chocolate con Leche con DDL, Chocolate con Leche, Pistacho con granella, Pistacho con Avella Pistacho, Chocolate Dark, Chocolate Frutos del Bosque. Pack Blanco x6: Chocolate con Leche con DDL, Chocolate Blanco, Pistacho con granella, Pistacho con Avella Pistacho, Chocolate Blanco con Caramelo y Avellanas, Chocolate Blanco con Avella Latte Crock.", buenasPracticas: "Conservar en lugar fresco y seco. Temperatura ambiente máxima 18°C. No exponer a luz directa. No armar más de 6 cajas en exhibición. No guardar en heladera con temperatura menor a 6°C. No congelar.", consejo: "Cuando el cliente muestra interés: ofrecer Pack Negro o Pack Blanco (precio fijo), o armar 6 tabletas a elección — la caja es de cortesía (cobrar por SKU individual)." },
        21: { orden: 6, imagen: "https://lh3.googleusercontent.com/d/1_KT-89hb1sW1FcZavhBmF-LhTmE5PgBv", procedimiento: "Lata Verde (Pistacho): 4 Mini Alfajores Pistacho, 3 Conitos Pistacho, 3 Viennesi Pistacho, 2 Squares Choco Pistacho, 2 Squares Choco Pistacho con Avella Pistacho. Lata Bordó (Clásica): 2 Mini Alfajores Semiamargo, 2 Mini Alfajores Blanco, 2 Mini Alfajores Nuez, 2 Conitos Blanco, 1 Conito Semiamargo, 2 Squares Choco Leche, 2 Squares Choco Blanco. Lata Negra (Dark): 4 Mini Alfajores Dark, 2 Mini Alfajores Semiamargo, 3 Conitos Semiamargo, 4 Squares (2 leche y avellanas + 2 semiamargo). Lata Corazón: 12 bombones de chocolate con leche rellenos de DDL.", errores: "La unidad exhibida no debe venderse — al momento de la venta, entregar una unidad del stock disponible o armarla en el momento. Aplica para todo el sector de merchandising." },
    };

    datos.forEach((fila, i) => {
        const cambios = cambiosPorId[fila[colId]];
        if (!cambios) return;
        Object.keys(cambios).forEach((campo) => {
            const col = headers.indexOf(campo);
            if (col !== -1) sheet.getRange(i + 2, col + 1).setValue(cambios[campo]);
        });
    });

    let proximoId = Math.max.apply(null, datos.map((fila) => Number(fila[colId]) || 0)) + 1;
    const titulosExistentesCurso5 = datos.filter((fila) => String(fila[colCursoId]) === "5").map((fila) => fila[colTitulo]);

    const leccionesNuevas = [
        { titulo: "Viennesi", orden: 3, objetivo: "Conocer las 3 variedades de Viennesi y sus formas de venta.", imagen: "https://lh3.googleusercontent.com/d/1MOALGmSc-zoUm5f0_wHoptK8TqUDq2YT", procedimiento: "Obleas de origen italiano en 3 variedades: Fondente (crema de chocolate, bañadas en chocolate dark), Clásico (crema de vainilla, recubiertas con chocolate con leche) y Pistacchio (crema de pistacchio, cubiertas con chocolate blanco). Se venden de forma individual, en caja x4 unidades de un mismo sabor, o en caja surtida x9 unidades (3 de cada variedad).", consejo: "Cómo ofrecerlo al cliente: \"Obleas rellenas de crema, cubiertas en chocolate.\"" },
        { titulo: "Avella", orden: 4, objetivo: "Conocer los 6 sabores de Avella en frasco y los packs Avella Collection.", imagen: "https://lh3.googleusercontent.com/d/17TbbRk7CoaLap5aWc5_PtHd8WfOd1Q08", procedimiento: "6 sabores en frasco de 200g, libre de gluten: Gianduia (avellanas y cacao), Pistacchio, Pistacchio Crock (más crujiente), Dubai (crema de pistacchio con crocante estilo kadayif — es el relleno de las Tabletas Dubai), Gianduia Crock y Coco Rock (chocolate blanco y coco con coco rallado). Avella Collection Pack x3: Clásico (Pistacchio + Pistacchio Crock + Gianduia), Pistacchio (Pistacchio + Pistacchio Crock + Dubai) y Dubai (3 Avella Dubai) — packaging premium pensado para regalo." },
        { titulo: "Squares", orden: 7, objetivo: "Conocer Squares, el lanzamiento nuevo de Lucciano's (desde el 25/06), y cómo exhibirlo y conservarlo correctamente.", imagen: "https://lh3.googleusercontent.com/d/1icDCf1KVkpSDyoFP2xYHifL6TTGYXTPZ", procedimiento: "Selección de chocolates en formato cuadrado, en cajas surtidas — 2 presentaciones, ambas con 12 cajas por caja máster. Square Surtidos x18 (Cód. caja máster 1661, SKU 916): 6 variedades, 3 unidades de cada una — Chocolate Blanco, Pistacchio con granella, Caramel Gold, Chocolate con Leche, Con Leche y granella de avellana, Semiamargo. Square Surtidos x32 (Cód. caja máster 1662, SKU 917): 32 unidades surtidas — 4u de cada: Chocolate Blanco, Pistacchio con granella, Caramel Gold, Chocolate con Leche, Con Leche y granella de avellana, Semiamargo, Pistacchio relleno con Avella Pistacchio, Con Leche relleno con Avella Gianduia.", buenasPracticas: "Exhibición permitida únicamente en exhibidoras de chocolates con temperatura controlada, muebles del sector de cajas, o estanterías previamente aprobadas — no se puede exhibir sobre mostradores ni mesadas de atención en caja. Si el local no tiene exhibidor habilitado, el producto se mantiene en stock/depósito y se ofrece igual ante la consulta del cliente. Conservación: lugar fresco y seco, máximo 18°C ambiente, no exponer al sol, no refrigerar por debajo de 6°C, no congelar. Manipular con cuidado para evitar roturas en el packaging.", consejo: "Cómo ofrecerlo al cliente: \"Una selección de chocolates en formato cuadrado, presentados en cajas surtidas — ideal para regalar, compartir y disfrutar en distintas ocasiones.\"" },
    ];

    let agregadas = 0;
    leccionesNuevas.forEach((l) => {
        if (titulosExistentesCurso5.indexOf(l.titulo) !== -1) return;
        const fila = {
            id: proximoId++, cursoId: 5, orden: l.orden, titulo: l.titulo, objetivo: l.objetivo,
            duracionMinutos: 0, video: "", manual: "", imagen: l.imagen || "", procedimiento: l.procedimiento || "",
            errores: l.errores || "", buenasPracticas: l.buenasPracticas || "", consejo: l.consejo || "", resumen: "", estado: "Activo",
        };
        const valores = headers.map((h) => (fila[h] !== undefined ? fila[h] : ""));
        sheet.appendRow(valores);
        agregadas++;
    });

    Logger.log("Listo — Chocolatería actualizada: 4 lecciones existentes enriquecidas con fotos y contenido real, " + agregadas + " lección(es) nueva(s) agregada(s) (de Viennesi/Avella/Squares — las que ya existieran se saltearon).");
}

function agregarValidacionesCursosYLecciones() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const FILAS_RESERVADAS = 200; // deja la validación lista para filas que todavía no existen

    const hojaCursos = ss.getSheetByName("Cursos");
    if (!hojaCursos) throw new Error('No existe la hoja "Cursos"');
    const headersCursos = hojaCursos.getRange(1, 1, 1, hojaCursos.getLastColumn()).getValues()[0];
    const colCategoria = headersCursos.indexOf("categoria") + 1;
    const colObligatorio = headersCursos.indexOf("obligatorio") + 1;
    const filasCursos = Math.max(hojaCursos.getLastRow(), FILAS_RESERVADAS) - 1;

    if (colCategoria > 0) {
        const reglaCategoria = SpreadsheetApp.newDataValidation()
            .requireValueInList(["Producto", "Operaciones", "Servicio", "Gestión"], true)
            .setAllowInvalid(true)
            .build();
        hojaCursos.getRange(2, colCategoria, filasCursos, 1).setDataValidation(reglaCategoria);
    } else {
        Logger.log('Cursos no tiene columna "categoria" — salteada.');
    }

    if (colObligatorio > 0) {
        const reglaObligatorio = SpreadsheetApp.newDataValidation()
            .requireValueInList(["SI", "NO"], true)
            .setAllowInvalid(false)
            .build();
        hojaCursos.getRange(2, colObligatorio, filasCursos, 1).setDataValidation(reglaObligatorio);
    } else {
        Logger.log('Cursos no tiene columna "obligatorio" — salteada.');
    }

    const hojaLecciones = ss.getSheetByName("Lecciones");
    if (!hojaLecciones) throw new Error('No existe la hoja "Lecciones"');
    const headersLecciones = hojaLecciones.getRange(1, 1, 1, hojaLecciones.getLastColumn()).getValues()[0];
    const colCursoId = headersLecciones.indexOf("cursoId") + 1;
    const colEstado = headersLecciones.indexOf("estado") + 1;
    const filasLecciones = Math.max(hojaLecciones.getLastRow(), FILAS_RESERVADAS) - 1;

    if (colCursoId > 0) {
        const filasIdsCursos = hojaCursos.getLastRow() - 1;
        if (filasIdsCursos > 0) {
            const rangoIdsCursos = hojaCursos.getRange(2, 1, filasIdsCursos, 1);
            const reglaCursoId = SpreadsheetApp.newDataValidation()
                .requireValueInRange(rangoIdsCursos, true)
                .setAllowInvalid(false)
                .build();
            hojaLecciones.getRange(2, colCursoId, filasLecciones, 1).setDataValidation(reglaCursoId);
        }
    } else {
        Logger.log('Lecciones no tiene columna "cursoId" — salteada.');
    }

    if (colEstado > 0) {
        const reglaEstado = SpreadsheetApp.newDataValidation()
            .requireValueInList(["Activo", "Inactivo"], true)
            .setAllowInvalid(false)
            .build();
        hojaLecciones.getRange(2, colEstado, filasLecciones, 1).setDataValidation(reglaEstado);
    } else {
        Logger.log('Lecciones no tiene columna "estado" — salteada.');
    }

    Logger.log("Listo — validaciones agregadas en Cursos (categoría, obligatorio) y Lecciones (cursoId, estado). No se tocó ningún dato existente.");
}

/**
 * Limpieza de la hoja Usuarios antes de salir a producción — deja
 * solo los nombres de NOMBRES_A_CONSERVAR y borra el resto de filas.
 * Es una acción irreversible sobre la planilla, así que se hace en
 * DOS PASOS:
 *
 *   1. Corré primero "previsualizarLimpiezaUsuarios" — NO borra nada,
 *      solo loguea quién se conservaría y quién se borraría. Revisá
 *      la lista con cuidado.
 *   2. Si la lista de "SE VAN A BORRAR" es la que esperás, recién ahí
 *      corré "limpiarUsuarios" (borra de verdad, sin vuelta atrás).
 *
 * Si necesitás ajustar a quién conservar, editá el array
 * NOMBRES_A_CONSERVAR de abajo antes de correr cualquiera de las dos.
 *
 * Conserva: los 3 admin (Gabriel, Carlos Torres, Fabricio Mirabelli).
 * Todo lo demás en la planilla real (cuentas de prueba, etc.) se
 * borra — pero revisá el log de previsualizarLimpiezaUsuarios antes
 * de correr limpiarUsuarios, por si aparece algún colaborador real
 * (con progreso real cargado) que no debería borrarse.
 */
const NOMBRES_A_CONSERVAR = ["Gabriel Busquets", "Carlos Torres", "Fabricio Mirabelli"];

// Compara sin importar mayúsculas/acentos (Tomás vs Tomas, García vs
// Garcia) para que una tilde distinta entre el código y la planilla
// no borre por error a alguien que sí debía conservarse.
function _normalizarNombreParaLimpieza(n) {
    return String(n || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function previsualizarLimpiezaUsuarios() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Usuarios");
    if (!sheet) throw new Error('No existe la hoja "Usuarios"');

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const colNombre = headers.indexOf("nombre");
    const colEmail = headers.indexOf("email");
    if (colNombre === -1) throw new Error('Usuarios necesita la columna "nombre"');

    const conservar = new Set(NOMBRES_A_CONSERVAR.map(_normalizarNombreParaLimpieza));
    const datos = sheet.getDataRange().getValues();

    const seConservan = [];
    const seBorran = [];
    for (let i = 1; i < datos.length; i++) {
        const nombre = String(datos[i][colNombre] || "").trim();
        if (!nombre) continue; // fila vacía
        const etiqueta = nombre + (colEmail !== -1 ? " (" + datos[i][colEmail] + ")" : "");
        if (conservar.has(_normalizarNombreParaLimpieza(nombre))) {
            seConservan.push(etiqueta);
        } else {
            seBorran.push(etiqueta);
        }
    }

    Logger.log("=== SE VAN A CONSERVAR (" + seConservan.length + ") ===");
    seConservan.forEach((s) => Logger.log("  ✓ " + s));
    Logger.log("=== SE VAN A BORRAR (" + seBorran.length + ") ===");
    seBorran.forEach((s) => Logger.log("  ✗ " + s));
    Logger.log("Si esta lista es correcta, corré limpiarUsuarios() para borrar de verdad. Si falta o sobra alguien en 'conservar', editá NOMBRES_A_CONSERVAR primero.");
}

function limpiarUsuarios() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Usuarios");
    if (!sheet) throw new Error('No existe la hoja "Usuarios"');

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const colNombre = headers.indexOf("nombre");
    if (colNombre === -1) throw new Error('Usuarios necesita la columna "nombre"');

    const conservar = new Set(NOMBRES_A_CONSERVAR.map(_normalizarNombreParaLimpieza));
    const datos = sheet.getDataRange().getValues();

    let borradas = 0;
    // De abajo hacia arriba: al borrar una fila, las de más abajo ya
    // procesadas no cambian de índice, pero las de arriba sí — yendo
    // al revés evita saltearse una fila por el corrimiento.
    for (let i = datos.length - 1; i >= 1; i--) {
        const nombre = String(datos[i][colNombre] || "").trim();
        if (!nombre) continue;
        if (!conservar.has(_normalizarNombreParaLimpieza(nombre))) {
            sheet.deleteRow(i + 1);
            borradas++;
        }
    }

    Logger.log("Listo — " + borradas + " usuario(s) borrado(s). Se conservaron: " + NOMBRES_A_CONSERVAR.join(", ") + ".");
}

/**
 * Detecta y borra lecciones duplicadas por curso+orden+título (ej.
 * "Máquina Momento — Limpieza" cargada dos veces con distinto id).
 * No exige que TODA la fila sea idéntica — un video re-subido con
 * otro link, por ejemplo, igual cuenta como la misma lección
 * repetida, porque orden+título ya identifican el lugar en el curso.
 *
 * Mismo patrón de seguridad que la limpieza de Usuarios:
 *   1. previsualizarDuplicadosLecciones() — no borra nada, solo lista
 *      los grupos duplicados y qué campos difieren entre ellos.
 *   2. Si la lista es correcta, eliminarDuplicadosLecciones() borra
 *      de verdad, conservando la primera aparición de cada grupo.
 */
function _claveLeccion(fila, colCursoId, colOrden, colTitulo) {
    return fila[colCursoId] + "||" + fila[colOrden] + "||" + String(fila[colTitulo]).trim().toLowerCase();
}

function previsualizarDuplicadosLecciones() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Lecciones");
    if (!sheet) throw new Error('No existe la hoja "Lecciones"');

    const datos = sheet.getDataRange().getValues();
    const headers = datos[0];
    const colId = headers.indexOf("id");
    const colCursoId = headers.indexOf("cursoId");
    const colOrden = headers.indexOf("orden");
    const colTitulo = headers.indexOf("titulo");
    const colVideo = headers.indexOf("video");
    if (colId === -1 || colCursoId === -1 || colOrden === -1 || colTitulo === -1) {
        throw new Error('Lecciones necesita las columnas "id", "cursoId", "orden" y "titulo"');
    }

    const grupos = new Map();
    for (let i = 1; i < datos.length; i++) {
        const fila = datos[i];
        if (fila.every((c) => c === "")) continue; // fila vacía
        const clave = _claveLeccion(fila, colCursoId, colOrden, colTitulo);
        if (!grupos.has(clave)) grupos.set(clave, []);
        grupos.get(clave).push({ fila: i + 1, id: fila[colId], titulo: fila[colTitulo], video: colVideo !== -1 ? fila[colVideo] : "" });
    }

    let totalABorrar = 0;
    Logger.log("=== GRUPOS DUPLICADOS ===");
    grupos.forEach((ocurrencias) => {
        if (ocurrencias.length > 1) {
            totalABorrar += ocurrencias.length - 1;
            Logger.log("  \"" + ocurrencias[0].titulo + "\" aparece " + ocurrencias.length + " veces:");
            ocurrencias.forEach((o, idx) => {
                Logger.log("    " + (idx === 0 ? "[SE CONSERVA] " : "[SE BORRA]    ") + "fila " + o.fila + " (id " + o.id + ") — video: " + (o.video || "(vacío)"));
            });
        }
    });
    Logger.log("Total de filas que se borrarían: " + totalABorrar);
    Logger.log("Revisá que el video de la fila que se conserva sea el correcto (por si el duplicado tiene un link distinto/más nuevo) antes de correr eliminarDuplicadosLecciones().");
}

function eliminarDuplicadosLecciones() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Lecciones");
    if (!sheet) throw new Error('No existe la hoja "Lecciones"');

    const datos = sheet.getDataRange().getValues();
    const headers = datos[0];
    const colId = headers.indexOf("id");
    const colCursoId = headers.indexOf("cursoId");
    const colOrden = headers.indexOf("orden");
    const colTitulo = headers.indexOf("titulo");
    if (colId === -1 || colCursoId === -1 || colOrden === -1 || colTitulo === -1) {
        throw new Error('Lecciones necesita las columnas "id", "cursoId", "orden" y "titulo"');
    }

    const vistos = new Set();
    const filasABorrar = [];
    for (let i = 1; i < datos.length; i++) {
        const fila = datos[i];
        if (fila.every((c) => c === "")) continue;
        const clave = _claveLeccion(fila, colCursoId, colOrden, colTitulo);
        if (vistos.has(clave)) {
            filasABorrar.push(i + 1);
        } else {
            vistos.add(clave);
        }
    }

    // De abajo hacia arriba para no correr los índices al borrar.
    filasABorrar.sort((a, b) => b - a).forEach((fila) => sheet.deleteRow(fila));

    Logger.log("Listo — " + filasABorrar.length + " lección(es) duplicada(s) borrada(s).");
}

/**
 * Enriquece el curso de Heladería (cursoId 2) con el contenido real
 * del manual institucional 2026 + la guía de servicio (mismo criterio
 * que actualizarLeccionesChocolateria): las 5 lecciones originales se
 * actualizan EN EL LUGAR buscándolas por título actual (no por id
 * fijo, por si ya cambiaron en la planilla real), y se agregan las
 * lecciones nuevas que faltan (idempotente — no duplica si se corre
 * más de una vez).
 */
function actualizarLeccionesHeladeria() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Lecciones");
    if (!sheet) throw new Error('No existe la hoja "Lecciones"');

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const colId = headers.indexOf("id");
    const colCursoId = headers.indexOf("cursoId");
    const colTitulo = headers.indexOf("titulo");
    if (colId === -1 || colCursoId === -1 || colTitulo === -1) throw new Error('Lecciones necesita las columnas "id", "cursoId" y "titulo"');

    const datos = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();

    // Se busca por el título ORIGINAL (como está hoy en la planilla)
    // para saber en qué fila aplicar los cambios de contenido.
    const cambiosPorTituloActual = {
        "Gramajes y presentaciones": { orden: 2, titulo: "Gramajes y Presentaciones", objetivo: "Conocer el peso correcto de cada tamaño de helado y de los potes para llevar.", procedimiento: "Bochas: Chico 120-130g, Mediano 140-150g, Grande 170-180g, Cucurucho 190-200g. Potes para llevar: 250g (chico), 500g (mediano) y 1kg.", errores: "", buenasPracticas: "", consejo: "" },
        "Cucuruchos gourmet y menú Kosher": { orden: 3, titulo: "Conos y Cucuruchos Gourmet", objetivo: "Preparar correctamente los cucuruchos gourmet de Pistacho y Avellana.", procedimiento: "2 variedades, ambas con un peso máximo de 190g: Pistacho y Avellana. Llevan 2 PUSH de su Avella correspondiente incluida (Avella Gianduia: pasta de avellanas y cacao / Avella Pistacchio: pasta de pistacho) — si el cliente prefiere cambiarla por otra, puede hacerlo.", errores: "", buenasPracticas: "Los CIALDINOS (las obleas) son de uso exclusivo para los cucuruchos gourmet — no se usan para otra presentación.", consejo: "" },
        "Pase de helado": { orden: 6, objetivo: "Aplicar correctamente el procedimiento de traspaso de helado entre vaquetas.", procedimiento: "El pase de helado es el traspaso de helado entre vitrina y armario. En el armario los helados se identifican como COMPLETOS e INCOMPLETOS. Al pasar el helado de una vaqueta a otra se unen los picos de la presentación para mantenerla acorde a la exhibición.", errores: "", buenasPracticas: "Tipos de vaqueta: ACRÍLICO (plástico duro, contenedor exterior) y PLÁSTICO (va dentro de la de acrílico, como contenedor interior). Si se rompe la de plástico: cortar ambos extremos y pasar el contenido a una de acrílico.", consejo: "" },
        "Apertura de vitrinas y control de temperatura": { orden: 7, titulo: "Apertura de Vitrinas y Vasquetas", objetivo: "Ejecutar correctamente la apertura de vitrinas y el armado de vasquetas.", procedimiento: "1) Encender las vitrinas y aguardar a que alcancen la temperatura correcta para exhibir. 2) Presentar en vitrina los helados que quedaron en el armario de completos, y también los icepops. 3) Armado y decoración de vasquetas: colocar la estaca/cartel de sabor y los variegatos correspondientes. 4) Controlar la temperatura del helado y de la heladera.", errores: "", buenasPracticas: "Temperatura de la heladera: -13° a -16°C en verano, -12° a -14°C en invierno.", consejo: "" },
        "Baño de chocolate y batidos": {
            orden: 9, titulo: "Batidos y Baño de Chocolate",
            objetivo: "Preparar correctamente el Smoothie, el Milk Shake y el Gelato Shake, y conocer el baño de chocolate.",
            procedimiento: "BAÑO DE CHOCOLATE — marca Mapricoa, temperatura ideal 30-40°C (si no se adhiere bien, probablemente hay que cambiar el chocolate). SMOOTHIE — 2 bochas de helados frutales a elección del cliente (160g) + 200ml de soda fría, licuar hasta lograr un smoothie suave, servir con tapa y sorbete. MILK SHAKE — 2 bochas a elección (160g) + 200ml de leche fría, decorar el interior del vaso con salsa antes de servir, licuar y volcar suavemente, terminar con círculos de crema/cacao en polvo/salsa, tapa y sorbete. GELATO SHAKE (Cookies & Cream / Dulce de Leche / Tiramisú, misma preparación para los 3) — 2 bochas del sabor elegido (160g) + 100ml de leche fría + 1 espresso con cápsula Ristretto, licuar y servir en vaso de Nespresso con collarín, agregar crema y decoración según el sabor, entregar con sorbete.",
            errores: "",
            buenasPracticas: "Para el Gelato Shake: usar siempre leche bien fría y cápsula de café Ristretto.",
            consejo: "",
        },
    };

    datos.forEach((fila, i) => {
        const cambios = cambiosPorTituloActual[fila[colTitulo]];
        if (!cambios) return;
        Object.keys(cambios).forEach((campo) => {
            const col = headers.indexOf(campo);
            if (col !== -1) sheet.getRange(i + 2, col + 1).setValue(cambios[campo]);
        });
    });

    let proximoId = Math.max.apply(null, datos.map((fila) => Number(fila[colId]) || 0)) + 1;
    const titulosExistentesCurso2 = datos.filter((fila) => String(fila[colCursoId]) === "2").map((fila) => fila[colTitulo]);

    const leccionesNuevas = [
        { titulo: "Sabores y Gluten Free", orden: 1, objetivo: "Conocer la variedad de sabores de helado y la línea apta para celíacos.", procedimiento: "Contamos con 44 sabores de helado (ver galería de este curso), incluyendo variantes veganas (Sorbete Dark 72%, Pistacchio Vegan, Patagonia). 8 sabores tienen además una presentación individual apta para celíacos en pote de 190g: Chocolate Lucciano's, Cookies & Cream, Dulce de Leche c/ Dulce de Leche, Chocolate Blanco + Avella Latte, Mascarpone c/ Frutos del Bosque, Sorbete Frutos Rojos (Patagonia), Sorbete Dark 72% y Pistacchio.", consejo: "Tocá cualquier sabor de la galería para ver su presentación en pote Gluten Free, si la tiene." },
        { titulo: "Menú Kosher", orden: 4, objetivo: "Conocer las categorías del menú Kosher — certificado por rabino.", procedimiento: "1) Parve: vegano, sin lácteos. 2) Dairy: con lácteos.", consejo: "" },
        { titulo: "Reposición y Cierre del Helado", orden: 8, objetivo: "Aplicar correctamente el procedimiento de reposición y rearmado de vasquetas.", procedimiento: "Antes de manipular los helados: lavarse las manos correctamente y colocarse guantes de látex. REPOSICIÓN: 1) Retirar de la vitrina la vasqueta que esté al 50%. 2) Colocar en la vitrina una vasqueta nueva del armario, con cuchara fría, en la parte inferior del lado derecho. 3) Guardar la vasqueta retirada: colocarle su tapa o bolsa y guardar en el armario. 4) Repetir el procedimiento la próxima vez que haya que reponer. REARMADO: 1) Presentar las dos mitades sobre la mesa de trabajo y elegir la de mejor apariencia. 2) Completar esa vasqueta dejando la superficie final plana. 3) Colocar los picos sobre la superficie plana y limpiar los bordes con papel descartable. 4) Colocar en el abatidor de 3 a 4 minutos. 5) Sanitizar y secar la estaca. 6) Presentar el helado correctamente. 7) Exhibir en el lugar correspondiente.", buenasPracticas: "Ver el procedimiento de lavado de manos en el módulo de Atención al Cliente." },
        { titulo: "Variegatos y Decoraciones", orden: 10, objetivo: "Aplicar correctamente el variegato o decoración de cada sabor de helado.", procedimiento: "STRACCIATELLA — se calienta en jarrita al microondas 15-20 segundos y se arroja en hilos sobre: Dulce de Leche Granizado, Banana Split, Menta Granizada y Peanut Caramel. DULCE DE LECHE REPOSTERO — se coloca en manga y se conserva en heladera, se aplica en gota grande sobre los picos, en: Dulce de Leche, Peanut Caramel, Tramontana y Banana Split. MASCARPONE — variegato de frutos rojos. MARACUYÁ — variegato de maracuyá con semillas. TRAMONTANA — salsa de caramelo + microgalletitas por encima. CHEESECAKE AL PISTACCHIO — 200g de crumble de pistacho en toda la superficie. TIRAMISÚ — cacao en polvo por encima. TIRAMISÚ AL PISTACHO — cacao solo en los laterales, granella en el centro, 2 vainillas adelante. SABORES FRUTALES — llevan fruta cortada del mismo sabor como decoración.", errores: "" },
    ];

    let agregadas = 0;
    leccionesNuevas.forEach((l) => {
        if (titulosExistentesCurso2.indexOf(l.titulo) !== -1) return;
        const fila = {
            id: proximoId++, cursoId: 2, orden: l.orden, titulo: l.titulo, objetivo: l.objetivo,
            duracionMinutos: 0, video: "", manual: "", imagen: l.imagen || "", procedimiento: l.procedimiento || "",
            errores: l.errores || "", buenasPracticas: l.buenasPracticas || "", consejo: l.consejo || "", resumen: "", estado: "Activo",
        };
        const valores = headers.map((h) => (fila[h] !== undefined ? fila[h] : ""));
        sheet.appendRow(valores);
        agregadas++;
    });

    Logger.log("Listo — Heladería actualizada: lecciones existentes enriquecidas con contenido real, " + agregadas + " lección(es) nueva(s) agregada(s) (las que ya existieran se saltearon).");
}

/**
 * Enriquece el curso de Pastelería (cursoId 4) con el contenido real
 * de "Productos de Pastelería 2.6.26.pdf" (tortas y pastelería fresca
 * vigentes). Mismo patrón que las demás actualizarLecciones*: busca
 * las lecciones existentes por su título actual y actualiza su
 * contenido en el lugar (no agrega lecciones nuevas — el curso ya
 * tiene las 4 que necesita: Tortas, Pastelería fresca, Vencimientos,
 * Cocción).
 */
function actualizarLeccionesPasteleria() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Lecciones");
    if (!sheet) throw new Error('No existe la hoja "Lecciones"');

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const colTitulo = headers.indexOf("titulo");
    if (colTitulo === -1) throw new Error('Lecciones necesita la columna "titulo"');

    const datos = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();

    const cambiosPorTituloActual = {
        "Tortas": {
            objetivo: "Conocer las 12 variedades de mini tortas vigentes y su composición real.",
            procedimiento: "Red Velvet: mini torta en capas, suave y húmeda, rellena con cheese frosting, decorada con copos cremosos y migas rojas. Carrot Cake: mini torta de zanahoria en capas, rellena con cheese frosting, coronada con nuez crocante. Mousse de Chocolate: mini torta aireada con base húmeda y cobertura de ganache brillante. Brownie con Dulce de Leche: decorado con merengue italiano flambeado. Rogel: capas de masa crocante intercaladas con dulce de leche, decorado con merengue. Crumble de Manzana: masa sablée con manzanas y canela, cubierta de crumble crocante de manteca y azúcar. Chocotorta: crema de dulce de leche y queso crema, con galletitas embebidas en almíbar de café. Oreo Cake: base de galletitas molidas con manteca, dulce de leche y queso crema, decorada con ganache blanca y galletitas partidas. Lemon Pie: masa sablée con crema de limón, merengue italiano flambeado, decorar con 3 hojas de menta fresca. Tiramisú: biscuit con almíbar de café, crema queso y cacao amargo, decorar con vainilla. Cheesecake con Salsa de Frutos Rojos: base sablée, crema de queso y salsa de frutos rojos, decorar con 2-3 hojas de menta fresca. Torta de Coco: masa sablée con dulce de leche, cubierta de crumble de coco crocante, decorar con coco rallado por encima.",
            buenasPracticas: "Vida útil: 4 días. Respetar la decoración exacta de cada torta (la menta fresca, el coco rallado, etc. son parte del producto, no opcionales).",
        },
        "Pastelería fresca": {
            titulo: "Pastelería Fresca",
            objetivo: "Conocer los 4 productos de pastelería fresca vigentes.",
            procedimiento: "Budín de Limón: con semillas de amapola, decorado con glaseado de jugo de limón. Budín Marmolado: de vainilla y chocolate, decorado con glaseado de chocolate. Brownie Húmedo con Nuez. Tostadas de Pan Casero: con dip de queso crema, mermelada o dulce de leche — 3 unidades (2 con promo).",
            errores: "",
            buenasPracticas: "",
        },
        "Cocción": {
            objetivo: "Conocer los 6 productos de cocción vigentes y aplicar el procedimiento correcto de horneado.",
            procedimiento: "Productos: Croissant, Medialunas, Roll de Frambuesa (masa rellena de azúcar, frambuesa y mantequilla), Roll de Canela (masa rellena de azúcar, canela y mantequilla), Pain de Manzana (masa de croissant dulce con relleno de mermelada de manzana), Pain de Chocolate (masa de croissant dulce rellena de chocolate en barra). Cocción: los productos se descongelan en heladera 8-10hs o a temperatura ambiente 1 hora, se pincelan con huevo, y se cocinan a 200°C bajando a 175°C: 15 minutos, se rota la bandeja, y 10-15 minutos más hasta dorar. Los productos dulces se pincelan con almíbar al salir calientes.",
            buenasPracticas: "Debemos tener una presentación de productos tentadora en vitrina, respetando la vida útil de cada producto según el procedimiento.",
        },
    };

    datos.forEach((fila, i) => {
        const cambios = cambiosPorTituloActual[fila[colTitulo]];
        if (!cambios) return;
        Object.keys(cambios).forEach((campo) => {
            const col = headers.indexOf(campo);
            if (col !== -1) sheet.getRange(i + 2, col + 1).setValue(cambios[campo]);
        });
    });

    Logger.log("Listo — Pastelería actualizada: lecciones existentes enriquecidas con el contenido vigente de tortas, pastelería fresca y cocción.");
}

/**
 * Actualiza SOLO la columna "imagen" de la lección "Cappuccino" —
 * no toca ningún otro campo (por si hay correcciones a mano hechas
 * directo en Sheets en el resto de la fila o de otras lecciones de
 * Cafetería). El "?v=2" al final fuerza a los navegadores a bajar la
 * imagen de nuevo en vez de servir una versión vieja en caché.
 */
function actualizarImagenCapuccino() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Lecciones");
    if (!sheet) throw new Error('No existe la hoja "Lecciones"');
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const colTitulo = headers.indexOf("titulo");
    const colImagen = headers.indexOf("imagen");
    if (colTitulo === -1 || colImagen === -1) throw new Error('Lecciones necesita las columnas "titulo" e "imagen"');

    // Acepta "Cappuccino" (como está en el dato original) o "Capuccino"
    // (como se escribe en el resto del contenido en español) — por si
    // el título se corrigió a mano en la planilla.
    const datos = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
    let actualizado = false;
    datos.forEach((fila, i) => {
        const titulo = String(fila[colTitulo] || "").trim().toLowerCase();
        if (titulo === "cappuccino" || titulo === "capuccino") {
            sheet.getRange(i + 2, colImagen + 1).setValue("assets/img/recetas/cappuccino_diagrama.png");
            actualizado = true;
            Logger.log('Actualizada la fila ' + (i + 2) + ' (título real en la planilla: "' + fila[colTitulo] + '")');
        }
    });

    Logger.log(actualizado ? "Listo — imagen del Cappuccino actualizada." : 'No se encontró ninguna lección con título "Cappuccino" ni "Capuccino" en la hoja.');
}
