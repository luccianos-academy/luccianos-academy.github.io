/* ============================
   FARO v4
   pages/supervisores.js — Vista de Supervisores (Admin)

   Para cada supervisor: sus locales asignados (getMisLocales, mismo
   criterio con fallback que usa Mi equipo / home del Supervisor),
   tamaño de equipo y promedio de avance del equipo — la misma cuenta
   que usa el ranking de Dashboard Ejecutivo (helper duplicado a
   propósito, ver notas del plan: evita crear un módulo util
   compartido fuera de la lista de archivos aprobada).
=============================*/

import { Header } from "../components/header.js";
import { Table } from "../components/table.js";
import { RankingCard } from "../components/rankingCard.js";
import { getUsuarios } from "../data/usuarios.js";
import { getSucursales, getMisLocales } from "../data/sucursales.js";
import { getAsignaciones } from "../data/asignaciones.js";
import { getCursos } from "../data/cursos.js";

/** % real del camino completo de UNA persona — sobre el total de
 *  cursos que le corresponden (mismo filtro de "Gestión" que usa
 *  cursos.js), no solo los que ya arrancó. Una asignación recién se
 *  crea cuando la persona ve su primera lección de ese curso — pro-
 *  mediar solo esas filas infla el número (1 curso terminado de 8
 *  daba "100%" en vez de ~13%). Mismo criterio que pages/colaboradores.js. */
function progresoPersona(persona, asignaciones, cursos) {
    const cursosAplicables = cursos.filter((cur) => cur.categoria !== "Gestión" || persona.encargado);
    if (!cursosAplicables.length) return null;
    const propias = asignaciones.filter((a) => String(a.colaboradorId) === String(persona.id));
    const suma = cursosAplicables.reduce((s, cur) => {
        const a = propias.find((x) => String(x.cursoId) === String(cur.id));
        return s + (a ? a.progreso : 0);
    }, 0);
    return Math.round(suma / cursosAplicables.length);
}

export async function Supervisores() {

    const [usuarios, sucursales, asignaciones, cursos] = await Promise.all([
        getUsuarios(), getSucursales(), getAsignaciones(), getCursos(),
    ]);

    const supervisores = usuarios.filter((u) => u.rol === "supervisor");

    const filas = await Promise.all(supervisores.map(async (sup) => {
        const locales = await getMisLocales(sup, sucursales);
        const equipo = usuarios.filter((u) => u.rol === "colaborador" && locales.includes(u.sucursal));
        const valores = equipo.map((p) => progresoPersona(p, asignaciones, cursos)).filter((v) => v !== null);
        const promedio = valores.length ? Math.round(valores.reduce((s, v) => s + v, 0) / valores.length) : 0;
        return { sup, locales, equipo, promedio };
    }));

    const columnas = [
        { key: "nombre", label: "Supervisor" },
        { key: "localesLabel", label: "Locales asignados" },
        { key: "equipoLabel", label: "Tamaño de equipo" },
        { key: "promedioLabel", label: "Avance promedio" },
    ];

    // Con un supervisor de zona (8-15 locales) un join plano de todos
    // los nombres vuelve esa fila una pared de texto y descuadra toda
    // la tabla — mostramos los primeros 2 + "+N más", con la lista
    // completa disponible al pasar el mouse (title nativo, sin
    // componente nuevo).
    // "Operaciones" es el valor fijo que crearUsuario le pone a todo
    // supervisor nuevo (ver abrirModalUsuarioGenerico en colaboradores.js)
    // — no es un local real. getMisLocales cae ahí solo cuando nadie
    // cargó todavía una fila en Sucursales con supervisor=<su nombre>.
    // Mostrarlo tal cual confunde (parece un local real cuando en
    // realidad es un hueco de datos) — mejor ser honestos acá.
    const localesLabel = (locales) => {
        if (!locales.length || (locales.length === 1 && locales[0] === "Operaciones")) {
            return `<span class="text-muted">Sin local asignado</span>`;
        }
        const nombres = locales.map((n) => n.replace("Lucciano's ", ""));
        if (nombres.length <= 2) return nombres.join(", ");
        const resto = nombres.length - 2;
        return `<span title="${nombres.join(", ")}">${nombres.slice(0, 2).join(", ")} <span class="text-muted">+${resto} más</span></span>`;
    };

    const tablaFilas = filas.map(({ sup, locales, equipo, promedio }) => ({
        nombre: sup.nombre,
        localesLabel: localesLabel(locales),
        equipoLabel: equipo.length,
        promedioLabel: `${promedio}%`,
    }));

    const ranking = filas
        .slice()
        .sort((a, b) => b.promedio - a.promedio)
        .map((f, i) => ({ posicion: i + 1, nombre: f.sup.nombre, valor: `${f.promedio}%` }));

    return `
        ${Header("Supervisores", "Equipo y desempeño por supervisor")}

        <div class="grid-2-1">
            <div>${Table(columnas, tablaFilas)}</div>
            <div>${RankingCard({ titulo: "Ranking de supervisores", items: ranking })}</div>
        </div>
    `;
}
