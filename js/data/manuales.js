/* ============================
   Lucciano's Academy
   data/manuales.js — Tabla "Manuales"

   Links a manuales/PDFs reales (Drive u otro), no archivos subidos al
   proyecto — así no pesan en el repo y el admin los reemplaza sin
   deploy cuando cambia una versión. Mismo criterio que data/noticias.js.
=============================*/

import { fetchSheet, writeSheet, updateSheet, deleteSheet } from "../services/dataSource.js";
import { manualesMock } from "./mock/manuales.mock.js";
import { HOJAS } from "../config.js";

// "visiblePara" es una lista separada por comas de roles que pueden
// VER el manual (no editarlo, eso siempre es solo Admin — ver
// pages/manuales.js). Puede incluir "capacitador" como valor especial
// (no es un rol real, ver puedeVerManual). Vacío = manual inactivo,
// no lo ve nadie salvo Admin (que administra) — a menos que tenga
// sucursal asignada, ver más abajo.
//
// "sucursal" es una lista separada por comas de locales a los que
// acota el manual (ej. "Cocina Imprenta" solo aplica a Lucciano's La
// Imprenta Gran Hotel CABA — cada local puede tener su propio manual/
// menú, y un mismo manual puede compartirse entre varios locales sin
// aplicar a los ~95 restantes). Vacío = aplica a todos los locales.
// Solo se chequea contra un Colaborador raso (su único
// usuario.sucursal); Supervisor/Admin/Encargado ven el manual sin
// filtrar por sucursal, ya que gestionan o revisan contenido más
// allá de un solo local.
function normalizarManual(f) {
    return {
        id: f.id,
        titulo: String(f.titulo || "").trim(),
        categoria: String(f.categoria || "").trim(),
        url: String(f.url || "").trim(),
        visiblePara: String(f.visiblePara || "").trim(),
        sucursal: String(f.sucursal || "").trim(),
    };
}

export function puedeVerManual(manual, usuario) {
    const visiblePara = String(manual.visiblePara || "").trim();
    const sucursalManual = String(manual.sucursal || "").trim();

    // Dirigido a locales puntuales.
    if (sucursalManual) {
        const locales = sucursalManual.split(",").map((s) => s.trim()).filter(Boolean);
        // Admin y Supervisor lo ven igual, aunque no sean de ese local —
        // gestionan el contenido y tienen que poder revisarlo.
        if (usuario.rol === "admin" || usuario.rol === "supervisor") return true;
        if (usuario.rol !== "colaborador") return false;
        if (!locales.includes(usuario.sucursal)) return false;

        // Si NO hay roles cargados, ser del local alcanza — igual que
        // siempre, así ningún manual que hoy se ve deja de verse.
        if (!visiblePara) return true;

        // Si SÍ hay roles, tienen que cumplirse los dos. Antes, con la
        // sucursal cargada, los roles se ignoraban por completo: un
        // manual dirigido a Supervisores del local X lo terminaba viendo
        // cualquier colaborador de X. Contradecía el cambio de julio que
        // exige marcar al menos un rol para poder guardar un manual — se
        // exigía el rol y después no se respetaba. Cae al chequeo de
        // roles de abajo.
    }

    if (visiblePara) {
        const roles = visiblePara.split(",").map((r) => r.trim()).filter(Boolean);
        // "capacitador" no es un rol real (es un Supervisor con
        // usuario.capacitador:true — ver data/usuarios.js), así que no
        // aparece nunca en usuario.rol: se chequea aparte para poder
        // dirigir un manual solo a capacitadores sin que lo vea
        // cualquier Supervisor.
        const paraCapacitador = roles.includes("capacitador") && usuario.rol === "supervisor" && usuario.capacitador;
        if (!roles.includes(usuario.rol) && !paraCapacitador) return false;
    } else {
        // Sin sucursal Y sin rol asignado = manual no está activo, nadie
        // lo ve (el Admin igual lo alcanza por el "esAdmin ||" de
        // Manuales(), para poder arreglarlo).
        //
        // Ojo: acá vacío significa "no lo ve NADIE", al revés que
        // Cursos.aplicaA. No es una inconsistencia a emparejar: esto es
        // un permiso y falla cerrado, aquello es contenido y por defecto
        // le llega a todos.
        return false;
    }

    return true;
}

export async function getManuales() {
    try {
        const filas = await fetchSheet(HOJAS.MANUALES, manualesMock);
        return filas.map(normalizarManual).sort((a, b) => a.titulo.localeCompare(b.titulo));
    } catch (err) {
        console.warn(`No se pudo leer '${HOJAS.MANUALES}':`, err.message);
        return [];
    }
}

export async function crearManual({ titulo, categoria, url, visiblePara, sucursal }) {
    return writeSheet(HOJAS.MANUALES, { titulo, categoria: categoria || "", url, visiblePara: visiblePara || "", sucursal: sucursal || "" }, manualesMock);
}

export async function actualizarManual(id, cambios) {
    return updateSheet(HOJAS.MANUALES, id, cambios, manualesMock);
}

export async function eliminarManual(id) {
    return deleteSheet(HOJAS.MANUALES, id, manualesMock);
}
