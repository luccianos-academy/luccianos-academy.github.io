/* ============================
   Lucciano's Academy
   pages/configuracion.js — Configuración (Admin)

   Hub de accesos secundarios: Integraciones, Nuestra Historia,
   Evaluaciones, Reportes y Alertas dejaron de tener entrada propia en
   el sidebar (quedaba con 15 ítems sueltos, "un lío" según feedback
   real) — siguen siendo las mismas rutas de siempre (mismo
   PERMISOS_PAGINA, sin cambios ahí), solo que ahora se llega a ellas
   desde acá en vez de un link directo en el menú.
=============================*/

import { Header } from "../components/header.js";
import { QuickAction } from "../components/quickAction.js";
import { MultiSelectUsuarios, bindMultiSelectUsuarios } from "../components/multiSelectUsuarios.js";
import { cargarRevisoresIngles, guardarRevisoresIngles } from "../data/idiomaRevisores.js";
import { INGLES_SOLO_REVISORES } from "../config.js";

const ACCESOS = [
    { titulo: "Integraciones", icono: "integraciones", href: "#/integraciones" },
    { titulo: "Nuestra Historia", icono: "historia", href: "#/historia" },
    { titulo: "Evaluaciones", icono: "evaluaciones", href: "#/evaluaciones" },
    { titulo: "Reportes", icono: "reportes", href: "#/reportes" },
    { titulo: "Alertas", icono: "alertas", href: "#/alertas" },
];

/** Quién puede ver la app en inglés mientras es vista previa. */
async function bloqueInglesPrevia() {
    const abierto = !INGLES_SOLO_REVISORES;
    const habilitados = abierto ? [] : await cargarRevisoresIngles(true).catch(() => []);
    return `
        <div class="card" style="max-width:520px;margin-top:20px">
            <h3 style="margin-top:0">Inglés — vista previa</h3>
            ${abierto
                ? `<p class="text-xs text-muted" style="margin-top:4px">El inglés está abierto: cualquier persona puede elegirlo en Mi perfil → Idioma.</p>`
                : `<p class="text-xs text-muted" style="margin-top:4px;margin-bottom:14px">
                    Por ahora el inglés lo ven solo vos y las personas que elijas acá (lo eligen en Mi perfil → Idioma).
                    Para el resto la app sigue igual, en español.
                </p>
                ${MultiSelectUsuarios("ingles-revisores", habilitados)}
                <button type="button" class="btn btn-primary" id="btn-guardar-ingles-revisores" style="margin-top:12px">Guardar</button>`}
        </div>
    `;
}

export async function Configuracion() {
    return `
        ${Header("Configuración", "Accesos e integraciones de la plataforma")}
        <div class="quick-actions">
            ${ACCESOS.map((a) => QuickAction(a)).join("")}
        </div>
        ${await bloqueInglesPrevia()}
    `;
}

export function bindConfiguracion() {
    if (!document.getElementById("ingles-revisores")) return;
    bindMultiSelectUsuarios("ingles-revisores");
    document.getElementById("btn-guardar-ingles-revisores")?.addEventListener("click", async (e) => {
        const btn = e.currentTarget;
        const ids = (document.getElementById("ingles-revisores").value || "").split(",").map((x) => x.trim()).filter(Boolean);
        btn.disabled = true;
        const original = btn.textContent;
        btn.textContent = "Guardando...";
        try {
            const r = await guardarRevisoresIngles(ids);
            alert(r?.ok ? "Listo. Esas personas ya pueden elegir inglés en Mi perfil (si tenían la app abierta, que la recarguen)." : (r?.error || "No se pudo guardar — probá de nuevo."));
        } catch (err) {
            alert(err?.message || "No se pudo guardar — probá de nuevo.");
        } finally {
            btn.disabled = false;
            btn.textContent = original;
        }
    });
}
