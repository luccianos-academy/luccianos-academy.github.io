/* ============================
   Lucciano's Academy
   services/mail.js — Envío de mail desde la app

   Sin costura de mock data a propósito (a diferencia de dataSource.js):
   mandar un mail "de mentira" en modo demo no tiene sentido, así que
   directamente avisa que no está disponible en vez de simular un envío.
=============================*/

import { USE_MOCK_DATA } from "../config.js";
import { enviarMailReal } from "./google.js";

export async function enviarMail(destinatarios, asunto, cuerpo) {
    if (USE_MOCK_DATA) {
        return { ok: false, error: "El envío de mail no está disponible en modo demo (todavía no hay backend real conectado)." };
    }
    return enviarMailReal(destinatarios, asunto, cuerpo);
}
