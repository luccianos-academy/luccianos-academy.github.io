/* ============================
   Lucciano's Academy
   data/disponibilidad.js — Tabla "Disponibilidad"

   Dónde se vende cada producto del catálogo. Un producto que no
   aparece en esta hoja está disponible en TODA la red: solo se guardan
   las EXCEPCIONES.

   Es a propósito y no una optimización. Si la hoja tuviera una fila por
   producto habría ~100 filas que hay que mantener sincronizadas con el
   catálogo, que vive en el código (data/productos*.js): al agregar un
   sabor nuevo habría que acordarse de sumarlo también acá, y si alguien
   no lo hace el producto queda sin fila y no se sabe si es que aplica a
   todos o que falta cargarlo. Guardando solo excepciones no hay nada que
   sincronizar y la ausencia de fila significa siempre lo mismo.

   La clave es curso + nombre del producto, igual que el resto de la app
   enlaza por nombre (Usuarios.sucursal, Manuales.sucursal). Si se
   renombra un producto en el código, su excepción deja de aplicar y el
   producto vuelve a verse en todos lados — falla hacia MOSTRAR de más,
   que para un catálogo es lo correcto: es material de consulta, no un
   permiso.
=============================*/

import { fetchSheet, writeSheet, updateSheet } from "../services/dataSource.js";
import { HOJAS } from "../config.js";

const disponibilidadMock = [];

function normalizar(f) {
    return {
        id: f.id,
        curso: String(f.curso || "").trim(),
        producto: String(f.producto || "").trim(),
        // aplicaA existe por compatibilidad y para el caso raro ("esto
        // se vende SOLO acá"), pero la pantalla escribe noAplicaA: se
        // opera parándose en un país y destildando lo que no vende, que
        // es como se piensa y como funciona Módulos. Declararlo al revés
        // obligaba a enumerar los 6 países donde sí se vende para sacar
        // uno.
        aplicaA: String(f.aplicaA || "").trim(),
        noAplicaA: String(f.noAplicaA || "").trim(),
    };
}

export async function getDisponibilidad() {
    try {
        const filas = await fetchSheet(HOJAS.DISPONIBILIDAD, disponibilidadMock);
        return filas.map(normalizar).filter((f) => f.curso && f.producto);
    } catch (err) {
        // Si la hoja todavía no existe, el catálogo se muestra completo
        // en vez de romper la pantalla del curso.
        console.warn(`No se pudo leer '${HOJAS.DISPONIBILIDAD}':`, err.message);
        return [];
    }
}

/** producto → { aplicaA, noAplicaA }, para un curso. Devuelve un Map
 *  para no recorrer la lista entera por cada producto al renderizar. */
export function mapaDisponibilidad(filas, nombreCurso) {
    const mapa = new Map();
    (filas || [])
        .filter((f) => f.curso === nombreCurso)
        .forEach((f) => mapa.set(f.producto, { aplicaA: f.aplicaA, noAplicaA: f.noAplicaA }));
    return mapa;
}

/** Excluye o devuelve un producto para un país/local puntual, sin tocar
 *  el resto de su alcance. Es la operación que hace la pantalla:
 *  destildar en Chile no debería alterar lo que pasa en Uruguay. */
export function conAlcanceCambiado(actual, ambito, loTiene) {
    const lista = String(actual || "").split(",").map((s) => s.trim()).filter(Boolean);
    const sinEste = lista.filter((s) => s.toLowerCase() !== ambito.toLowerCase());
    return (loTiene ? sinEste : [...sinEste, ambito]).join(", ");
}

/**
 * Guarda el alcance de un producto.
 *
 * Con aplicaA vacío se escribe "" en vez de borrar la fila. Borrarla
 * sería más prolijo, pero deja la hoja sin rastro de que alguien tocó
 * ese producto y volvió atrás — y el costo es una fila.
 */
export async function guardarDisponibilidad(curso, producto, cambios, existentes) {
    const yaEsta = (existentes || []).find((f) => f.curso === curso && f.producto === producto);
    if (yaEsta) {
        return updateSheet(HOJAS.DISPONIBILIDAD, yaEsta.id, cambios, disponibilidadMock);
    }
    return writeSheet(HOJAS.DISPONIBILIDAD, { curso, producto, ...cambios }, disponibilidadMock);
}
