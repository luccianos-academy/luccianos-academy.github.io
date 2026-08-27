/* ============================
   Lucciano's Academy
   services/subitems.js — Tipos de sub-ítem de una tarea de Gestión de
   tareas (#/gestion): checklist simple, 3 estados, numérico

   Pedido explícito, con maqueta confirmada: un checklist binario
   (hecho/no hecho) no alcanza para tareas como un arqueo de caja,
   donde un ítem puede estar "hecho pero con un problema" — sin que
   nadie tenga que escribir una descripción. Tres tipos de sub-ítem:

   - "checkbox" (default, el de siempre): tildado o no.
   - "estado3": tres estados posibles — ok (verde) / incidencia
     (amarillo) / grave (rojo) — con un motivo elegido de una lista
     de chips (sin escribir), no texto libre.
   - "numerico": un monto ($) — arranca en 0 por DEFAULT (pedido
     explícito: "los valores que están en cero deben quedar así por
     default si está bien, si tiene incidencia cargarla") — nadie
     tiene que confirmar "está todo bien" a propósito, el 0 YA ES la
     respuesta; cualquier otro valor es la incidencia en sí misma, no
     hace falta explicarla aparte (ej. "Saldo/diferencia" de una
     caja).

   DOS encodings distintos acá, no confundirlos:
   1) Definición del catálogo (GestionTareas.subitems, un ítem por
      entrada, separadas por COMA en la Sheet — ver data/gestionTareas.js):
      "Efectivo::estado3::Faltante;Sobrante;Billete falso"
      Sin "::" = checkbox simple (compatibilidad total con las tareas
      ya cargadas, que son solo texto plano).
   2) Marca de UNA ejecución puntual (GestionChecks.subitemsMarcados,
      una entrada por sub-ítem tildado/marcado, separadas por COMA —
      ver data/gestionChecks.js): "1:inc:Faltante", "5:n:-320", o
      simplemente "3" (checkbox, igual que antes de este cambio).

   "::" y ":" no colisionan con la coma de más arriba (separador entre
   sub-ítems/entradas) ni aparecen nunca en un título o motivo real.
=============================*/

export const TIPOS_SUBITEM = {
    CHECKBOX: "checkbox",
    ESTADO3: "estado3",
    NUMERICO: "numerico",
};

const SEP_DEF = "::";
const SEP_MOTIVOS = ";";

/** "Efectivo::estado3::Faltante;Sobrante;Billete falso" →
 *  {titulo, tipo, motivos}. Sin "::" (el caso de siempre) cae en
 *  checkbox simple, sin motivos — así CUALQUIER tarea vieja (puro
 *  texto plano) se sigue leyendo exactamente igual que antes. */
export function parsearSubitem(raw) {
    const texto = String(raw || "");
    if (!texto.includes(SEP_DEF)) return { titulo: texto.trim(), tipo: TIPOS_SUBITEM.CHECKBOX, motivos: [] };
    const [titulo, tipo, motivosRaw] = texto.split(SEP_DEF);
    return {
        titulo: (titulo || "").trim(),
        tipo: tipo?.trim() || TIPOS_SUBITEM.CHECKBOX,
        motivos: motivosRaw ? motivosRaw.split(SEP_MOTIVOS).map((m) => m.trim()).filter(Boolean) : [],
    };
}

/** Inverso de parsearSubitem — arma el string que se guarda en la
 *  Sheet (un elemento del array `subitems`). checkbox simple queda
 *  IDÉNTICO al texto plano de siempre (sin "::"), a propósito: una
 *  tarea que nunca usó tipos nuevos no cambia ni un carácter de cómo
 *  se guarda. */
export function serializarSubitem({ titulo, tipo, motivos }) {
    if (!tipo || tipo === TIPOS_SUBITEM.CHECKBOX) return titulo;
    const base = `${titulo}${SEP_DEF}${tipo}`;
    return motivos?.length ? `${base}${SEP_DEF}${motivos.join(SEP_MOTIVOS)}` : base;
}

/** "1:inc:Faltante" → {indice, tipo, estado, motivo} (estado3).
 *  "5:n:-320" → {indice, tipo, valor} (numerico).
 *  "3" (sin ":", el formato de siempre) → {indice, tipo:"checkbox"}.
 *  Nunca tira: cualquier entrada rota cae a checkbox por defecto. */
export function parsearMarcaSubitem(raw) {
    const texto = String(raw || "");
    const partes = texto.split(":");
    const [indice, codigo, resto] = partes;
    if (codigo === "n") return { indice, tipo: TIPOS_SUBITEM.NUMERICO, valor: Number(resto) };
    if (codigo === "ok" || codigo === "inc" || codigo === "grave") {
        return { indice, tipo: TIPOS_SUBITEM.ESTADO3, estado: codigo, motivo: resto || "" };
    }
    return { indice: texto, tipo: TIPOS_SUBITEM.CHECKBOX };
}

/** Inverso de parsearMarcaSubitem — arma UNA entrada de
 *  subitemsMarcados (todavía falta el .join(",") con las demás, eso
 *  lo hace quien llama). */
export function serializarMarcaSubitem(indice, marca) {
    if (marca.tipo === TIPOS_SUBITEM.NUMERICO) return `${indice}:n:${marca.valor}`;
    if (marca.tipo === TIPOS_SUBITEM.ESTADO3) return marca.motivo ? `${indice}:${marca.estado}:${marca.motivo}` : `${indice}:${marca.estado}`;
    return String(indice);
}

/** true si esta marca representa un sub-ítem YA RESPONDIDO — para
 *  checkbox/estado3 alcanza con que exista la marca; para numérico
 *  hace falta distinguir "todavía no lo tocó nadie" (sin marca) de
 *  "confirmó que da 0" (marca con valor 0) — ambos casos EXISTEN acá
 *  como marca real una vez que se guardó, así que esta función asume
 *  que ya está en el mapa (ver tieneMarca en gestion.js). */
export function esIncidencia(marca) {
    if (!marca) return false;
    if (marca.tipo === TIPOS_SUBITEM.NUMERICO) return marca.valor !== 0;
    if (marca.tipo === TIPOS_SUBITEM.ESTADO3) return marca.estado !== "ok";
    return false;
}

export function esIncidenciaGrave(marca) {
    return marca?.tipo === TIPOS_SUBITEM.ESTADO3 && marca.estado === "grave";
}

/** Sufijo compartido "Caja N" / "Posnet N" en el título de un
 *  sub-ítem — mismo criterio que usa gestion.js para precargar el
 *  Falta/Sobra del numérico al marcar el estado3 emparejado. Se
 *  reutiliza acá para AGRUPAR, no solo precargar. */
const RE_SUFIJO_GRUPO = /\b(caja|posnet)\s*\d+/i;

/** Agrupa sub-ítems que describen el MISMO conteo de caja/posnet —
 *  ej. "Efectivo — Caja 1" (estado3) y "Saldo Caja 1" (numérico)
 *  comparten el sufijo "caja 1", van al mismo grupo. Sin sufijo en
 *  el título, cada sub-ítem queda solo en su propio grupo (mismo
 *  comportamiento de siempre para tareas sin esta convención).
 *  items: [{titulo, marca}] → array de grupos (arrays de items). */
export function agruparPorCaja(items) {
    const porSufijo = new Map();
    const sueltos = [];
    items.forEach((item) => {
        const sufijo = String(item.titulo || "").toLowerCase().match(RE_SUFIJO_GRUPO)?.[0];
        if (!sufijo) { sueltos.push([item]); return; }
        if (!porSufijo.has(sufijo)) porSufijo.set(sufijo, []);
        porSufijo.get(sufijo).push(item);
    });
    return [...porSufijo.values(), ...sueltos];
}

/** Cuenta incidencias/graves a nivel de GRUPO (ver agruparPorCaja),
 *  no de sub-ítem suelto — así "Efectivo Caja 1" con incidencia +
 *  "Saldo Caja 1" con el monto real cuentan como UNA sola incidencia,
 *  no dos. Bug real reportado en vivo con el PDF exportado: "dice
 *  hay 4 insidencias en realidad son 2 (lo que pasa es que lo lee
 *  como 4 ítems distintos)". items: [{titulo, marca}]. */
export function contarIncidenciasAgrupadas(items) {
    const grupos = agruparPorCaja(items);
    let incidencias = 0;
    let graves = 0;
    grupos.forEach((grupo) => {
        if (grupo.some((it) => esIncidenciaGrave(it.marca))) graves++;
        if (grupo.some((it) => esIncidencia(it.marca))) incidencias++;
    });
    return { incidencias, graves };
}
