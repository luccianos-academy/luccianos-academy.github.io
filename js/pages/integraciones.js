/* ============================
   Lucciano's Academy
   pages/integraciones.js — Integraciones (Admin)

   Pantalla de solo lectura: muestra el estado real de la conexión
   con Google (Sign-In + Apps Script/Sheets), leyendo config.js —
   no agrega lógica de integración nueva, solo la hace visible.
=============================*/

import { Header } from "../components/header.js";
import { GAS_URL, GOOGLE_CLIENT_ID, USE_MOCK_DATA } from "../config.js";

function badgeEstado(conectado) {
    return conectado
        ? `<span class="badge badge-success">Conectado</span>`
        : `<span class="badge badge-warning">Modo demo</span>`;
}

export async function Integraciones() {
    return `
        ${Header("Integraciones", "Estado de las conexiones con Google")}

        <div class="cards">
            <div class="card">
                <h3>Google Sheets / Apps Script</h3>
                <div style="margin-top:14px">${badgeEstado(!USE_MOCK_DATA)}</div>
                <p class="text-sm text-muted" style="margin-top:10px">
                    ${USE_MOCK_DATA
                        ? "Lucciano's Academy está corriendo con datos de muestra en memoria. Para conectar la base real, pegá la URL del Web App de Apps Script en js/config.js (GAS_URL)."
                        : "Lucciano's Academy está leyendo y escribiendo directamente en la planilla de Google Sheets configurada."}
                </p>
            </div>

            <div class="card">
                <h3>Google Sign-In</h3>
                <div style="margin-top:14px">${badgeEstado(Boolean(GOOGLE_CLIENT_ID))}</div>
                <p class="text-sm text-muted" style="margin-top:10px">
                    ${GOOGLE_CLIENT_ID
                        ? "El botón real de Google Sign-In está activo en la pantalla de login."
                        : "Todavía no hay Client ID configurado — el login usa el selector de roles de muestra."}
                </p>
            </div>
        </div>
    `;
}
