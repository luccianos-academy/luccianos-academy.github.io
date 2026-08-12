/* ============================
   Lucciano's Academy — datos reales
   Tabla "Sucursales" — los locales reales de Lucciano's
   (Argentina, Uruguay, Paraguay, Chile, EEUU, España, Italia)

   esPropio: "SI" = locales propios (operados directamente por Lucciano's)
   esPropio: "" o vacío = franquicias
=============================*/

export const sucursalesMock = [
    // CABA - PROPIOS
    { id: 1, nombre: "Lucciano's Martinez GBA", supervisor: "Tomás Ojeda", estado: "Activa", esPropio: "SI" },
    { id: 2, nombre: "Lucciano's Olivos GBA", supervisor: "Tomás Ojeda", estado: "Activa", esPropio: "SI" },
    { id: 7, nombre: "Lucciano's San Miguel GBA", supervisor: "", estado: "Activa", esPropio: "SI" },
    { id: 12, nombre: "Lucciano's Shopping Abasto CABA", supervisor: "Barbara Riccitelli", estado: "Activa", esPropio: "SI" },
    // Segundo punto de venta dentro del mismo shopping. Comparte la
    // nómina con el de arriba, así que va a quedar sin colaboradores
    // asignados — es lo esperado. Existe para que la cantidad de locales
    // coincida con el listado de la empresa.
    { id: 121, nombre: "Lucciano's Shopping Abasto 2 CABA", supervisor: "Barbara Riccitelli", estado: "Activa", esPropio: "SI" },
    { id: 13, nombre: "Lucciano's La Imprenta Gran Hotel CABA", supervisor: "", estado: "Activa", esPropio: "SI" },
    { id: 14, nombre: "Lucciano's Distrito Arcos CABA", supervisor: "", estado: "Activa", esPropio: "SI" },
    { id: 20, nombre: "Lucciano's Recoleta CABA", supervisor: "Ever Rodríguez", estado: "Activa", esPropio: "SI" },
    { id: 21, nombre: "Lucciano's Dot CABA", supervisor: "", estado: "Activa", esPropio: "SI" },
    { id: 33, nombre: "Lucciano's Agüero CABA", supervisor: "", estado: "Activa", esPropio: "SI" },
    { id: 37, nombre: "Lucciano's Galerias Pacifico CABA", supervisor: "", estado: "Activa", esPropio: "SI" },
    { id: 42, nombre: "Lucciano's Patio Bullrich CABA", supervisor: "", estado: "Activa", esPropio: "SI" },
    { id: 43, nombre: "Lucciano's Obelisco CABA", supervisor: "", estado: "Activa", esPropio: "SI" },
    { id: 45, nombre: "Lucciano's Calle Corrientes CABA", supervisor: "", estado: "Activa", esPropio: "SI" },
    { id: 46, nombre: "Lucciano's Santa Fe y Parana CABA", supervisor: "", estado: "Activa", esPropio: "SI" },

    // BUENOS AIRES - PROPIOS
    { id: 47, nombre: "Lucciano's Nordelta Buenos Aires", supervisor: "", estado: "Activa", esPropio: "SI" },

    // INTERIOR - PROPIOS (Córdoba)
    { id: 63, nombre: "Lucciano's Cerro De Las Rosas Córdoba", supervisor: "", estado: "Activa", esPropio: "SI" },
    { id: 64, nombre: "Lucciano's Nuevocentro Córdoba", supervisor: "Ivan Herrera", estado: "Activa", esPropio: "SI" },

    // INTERIOR - PROPIOS (Santa Fe)
    { id: 66, nombre: "Lucciano's Alto Rosario Santa Fe", supervisor: "", estado: "Activa", esPropio: "SI" },

    // INTERIOR - PROPIOS (Salta)
    { id: 79, nombre: "Lucciano's Galerias Salta", supervisor: "", estado: "Activa", esPropio: "SI" },
    { id: 80, nombre: "Lucciano's Alto NOA Salta", supervisor: "", estado: "Activa", esPropio: "SI" },

    // INTERIOR - PROPIOS (Misiones)
    { id: 81, nombre: "Lucciano's Posadas Misiones", supervisor: "", estado: "Activa", esPropio: "SI" },

    // MAR DEL PLATA - PROPIOS
    { id: 90, nombre: "Lucciano's Alem Mar del Plata", supervisor: "", estado: "Activa", esPropio: "SI" },
    { id: 91, nombre: "Lucciano's Aldrey Mar del Plata", supervisor: "", estado: "Activa", esPropio: "SI" },
    { id: 92, nombre: "Lucciano's Central Mar del Plata", supervisor: "Nicolas Lopez", estado: "Activa", esPropio: "SI" },
    { id: 93, nombre: "Lucciano's Constitucion Mar del Plata", supervisor: "", estado: "Activa", esPropio: "SI" },
    { id: 94, nombre: "Lucciano's Gallegos Mar del Plata", supervisor: "", estado: "Activa", esPropio: "SI" },
    { id: 95, nombre: "Lucciano's Guemes Mar del Plata", supervisor: "", estado: "Activa", esPropio: "SI" },
    { id: 96, nombre: "Lucciano's Paso Mar del Plata", supervisor: "", estado: "Activa", esPropio: "SI" },
    { id: 97, nombre: "Lucciano's Peatonal Mar del Plata", supervisor: "", estado: "Activa", esPropio: "SI" },
    { id: 98, nombre: "Lucciano's Torreon Mar del Plata", supervisor: "", estado: "Activa", esPropio: "SI" },
    { id: 99, nombre: "Lucciano's Varese Mar del Plata", supervisor: "", estado: "Activa", esPropio: "SI" },

    // ================== FRANQUICIAS ==================

    // GBA - FRANQUICIAS
    { id: 3, nombre: "Lucciano's Parque Avellaneda Shopping GBA", supervisor: "", estado: "Activa" },
    { id: 4, nombre: "Lucciano's Ituzaingo GBA", supervisor: "", estado: "Activa" },
    { id: 5, nombre: "Lucciano's Distrito T GBA", supervisor: "", estado: "Activa" },
    { id: 6, nombre: "Lucciano's Adrogué GBA", supervisor: "", estado: "Activa" },
    { id: 8, nombre: "Lucciano's Parque Leloir GBA", supervisor: "", estado: "Activa" },
    { id: 9, nombre: "Lucciano's Quilmes GBA", supervisor: "", estado: "Activa" },
    { id: 10, nombre: "Lucciano's Caseros GBA", supervisor: "", estado: "Activa" },
    { id: 11, nombre: "Lucciano's Ramos Mejia GBA", supervisor: "", estado: "Activa" },

    // CABA - FRANQUICIAS
    { id: 15, nombre: "Lucciano's Arcos del Rosedal CABA", supervisor: "", estado: "Activa" },
    { id: 16, nombre: "Lucciano's Villa del Parque CABA", supervisor: "", estado: "Activa" },
    { id: 17, nombre: "Lucciano's Honduras CABA", supervisor: "", estado: "Activa" },
    { id: 18, nombre: "Lucciano's Cid Campeador CABA", supervisor: "", estado: "Activa" },
    { id: 19, nombre: "Lucciano's Devoto CABA", supervisor: "Lourdes Garcia", estado: "Activa" },
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
    { id: 34, nombre: "Lucciano's Nuñez CABA", supervisor: "", estado: "Activa" },
    { id: 35, nombre: "Lucciano's Belgrano C CABA", supervisor: "", estado: "Activa" },
    { id: 36, nombre: "Lucciano's Bajo Belgrano CABA", supervisor: "", estado: "Activa" },
    { id: 38, nombre: "Lucciano's San Telmo CABA", supervisor: "", estado: "Activa" },
    { id: 39, nombre: "Lucciano's Paseo del Angel CABA", supervisor: "", estado: "Activa" },
    { id: 40, nombre: "Lucciano's Plaza Houssay CABA", supervisor: "", estado: "Activa" },
    { id: 41, nombre: "Lucciano's Palermo Chico CABA", supervisor: "", estado: "Activa" },
    { id: 44, nombre: "Lucciano's Almagro CABA", supervisor: "", estado: "Activa" },

    // BUENOS AIRES - FRANQUICIAS
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

    // INTERIOR - FRANQUICIAS
    { id: 65, nombre: "Lucciano's Ribera Shopping Santa Fe", supervisor: "", estado: "Activa" },
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
    { id: 82, nombre: "Lucciano's Madryn Chubut", supervisor: "", estado: "Activa" },
    { id: 83, nombre: "Lucciano's Ushuaia Tierra del Fuego", supervisor: "", estado: "Inactiva" },
    { id: 84, nombre: "Lucciano's Capital Corrientes", supervisor: "", estado: "Activa" },

    // NUEVOS FRANQUICIAS - ARGENTINA (faltaban)
    { id: 100, nombre: "Lucciano's Cabildo y Juramento CABA", supervisor: "", estado: "Activa" },
    { id: 101, nombre: "Lucciano's Castelar Buenos Aires", supervisor: "", estado: "Activa" },
    { id: 102, nombre: "Lucciano's Palermo Buenos Aires", supervisor: "", estado: "Activa" },
    { id: 103, nombre: "Lucciano's Mar de las Pampas Buenos Aires", supervisor: "", estado: "Activa" },
    { id: 104, nombre: "Lucciano's General Pico Buenos Aires", supervisor: "", estado: "Activa" },
    { id: 105, nombre: "Lucciano's Vista Pueblo Buenos Aires", supervisor: "", estado: "Activa" },
    { id: 106, nombre: "Lucciano's Santa Fe Santa Fe", supervisor: "", estado: "Activa" },

    // EXTERIOR - URUGUAY
    { id: 85, nombre: "Lucciano's Pocitos Uruguay", supervisor: "", estado: "Activa" },
    { id: 86, nombre: "Lucciano's Punta Carretas Uruguay", supervisor: "", estado: "Activa" },
    { id: 87, nombre: "Lucciano's Punta del Este Uruguay", supervisor: "", estado: "Activa" },
    { id: 88, nombre: "Lucciano's Carrasco Uruguay", supervisor: "", estado: "Activa" },

    // EXTERIOR - PARAGUAY
    // Abre próximamente. Queda "Inactiva" a propósito: así no aparece en
    // el autocompletado al dar de alta gente (autocompleteSucursal.js y
    // multiSelectSucursales.js filtran por estado "Activa"), que es
    // justo lo que corresponde hasta que abra. Pasarla a "Activa" el día
    // de la apertura es todo lo que hay que hacer.
    { id: 89, nombre: "Lucciano's Asuncion Paraguay", supervisor: "", estado: "Inactiva" },

    // EXTERIOR - CHILE
    { id: 91, nombre: "Lucciano's Parque Arauco Chile", supervisor: "", estado: "Activa" },

    // EXTERIOR - ESPAÑA
    { id: 107, nombre: "Lucciano's Barcelona The Moon España", supervisor: "", estado: "Activa" },
    { id: 108, nombre: "Lucciano's Barcelona España", supervisor: "", estado: "Activa" },
    { id: 109, nombre: "Lucciano's Madrid España", supervisor: "", estado: "Activa" },
    { id: 110, nombre: "Lucciano's Granada España", supervisor: "", estado: "Activa" },
    { id: 111, nombre: "Lucciano's Valencia España", supervisor: "", estado: "Activa" },
    { id: 112, nombre: "Lucciano's Málaga Uncibay III España", supervisor: "", estado: "Activa" },
    { id: 113, nombre: "Lucciano's Alicante España", supervisor: "", estado: "Activa" },
    { id: 114, nombre: "Lucciano's Málaga I España", supervisor: "", estado: "Activa" },

    // EXTERIOR - USA
    { id: 115, nombre: "Lucciano's Weston USA", supervisor: "", estado: "Activa" },
    { id: 116, nombre: "Lucciano's American Dream USA", supervisor: "", estado: "Activa" },
    { id: 117, nombre: "Lucciano's Adventure USA", supervisor: "", estado: "Activa" },
    { id: 118, nombre: "Lucciano's Sawgrass USA", supervisor: "", estado: "Activa" },
    { id: 119, nombre: "Lucciano's The Florida Mall USA", supervisor: "", estado: "Activa" },

    // EXTERIOR - ITALIA
    // Único local propio fuera de Argentina; el resto del exterior es franquicia.
    { id: 120, nombre: "Lucciano's Roma Italia", supervisor: "", estado: "Activa", esPropio: "SI" },
];
