/* ============================
   FARO v4 — datos reales
   Tabla "Cursos" — los 8 módulos reales de capacitación de
   Lucciano's (extraídos del sistema SisCap en producción).
=============================*/

// Atención al Cliente va primera (orden 1) — es cultura y valores, lo
// que se espera de cada colaborador antes de entrar al conocimiento
// de producto de cada módulo.
export const cursosMock = [
    { id: 7, nombre: "Atención al Cliente",             categoria: "Servicio",     obligatorio: "SI", orden: 1 },
    { id: 1, nombre: "Cafetería",                     categoria: "Producto",     obligatorio: "SI", orden: 2 },
    { id: 2, nombre: "Heladería",                      categoria: "Producto",     obligatorio: "SI", orden: 3 },
    { id: 3, nombre: "Icepops",                         categoria: "Producto",     obligatorio: "SI", orden: 4 },
    { id: 4, nombre: "Pastelería",                      categoria: "Producto",     obligatorio: "SI", orden: 5 },
    { id: 5, nombre: "Chocolatería",                    categoria: "Producto",     obligatorio: "SI", orden: 6 },
    { id: 6, nombre: "Sistema y Caja",                  categoria: "Operaciones",  obligatorio: "SI", orden: 7 },
    { id: 8, nombre: "Encargados y Responsables",       categoria: "Gestión",      obligatorio: "NO", orden: 8 },
];
