/* ============================
   Lucciano's Academy
   pages/perfil.js — Mi perfil (solo lectura por ahora)

   Sprint 9 le suma edición de datos y foto; acá alcanza con
   probar que la ruta y la entrada de menú ya existen para
   los 3 roles.
=============================*/

import { Header } from "../components/header.js";
import { Avatar } from "../components/avatar.js";
import { Icon } from "../components/icons.js";
import { getUsuarioActual, verComo } from "../services/auth.js";
import { soportaPush, estadoPermisoPush, activarPush } from "../services/push.js";
import { esIOS, yaInstalada } from "../services/installPrompt.js";
import { getTokensDeUsuario } from "../data/tokens.js";
import { actualizarUsuario, getUsuarios, ETIQUETA_RESPONSABLE_LOCAL, ETIQUETA_RESPONSABLE_TURNO } from "../data/usuarios.js";
import { registrarEvento } from "../data/auditoria.js";
import { navigate } from "../router.js";
import { gasRequest } from "../services/google.js";
import { setItem } from "../services/storage.js";
import { VERSION, ES_STAGING } from "../config.js";

const ROL_LEGIBLE = { admin: "Administrador", supervisor: "Supervisor", colaborador: "Colaborador" };

/** Acceso rápido a "Ver como" por TIPO de rol (no por persona puntual)
 *  — pedido explícito: buscar uno por uno en Colaboradores era
 *  incómodo, esto elige directo un usuario real representativo de
 *  cada tipo. Reusa toda la infba ya probada de verComo() (banner +
 *  "Volver a mi cuenta"), solo cambia de dónde se dispara. */
const ROLES_VISTA_RAPIDA = [
    { id: "colaborador", label: "Colaborador", match: (u) => u.rol === "colaborador" && !u.encargado },
    { id: "encargado", label: ETIQUETA_RESPONSABLE_LOCAL, match: (u) => u.rol === "colaborador" && u.encargado },
    { id: "supervisor", label: "Supervisor", match: (u) => u.rol === "supervisor" && !u.capacitador },
    { id: "capacitador", label: "Capacitador", match: (u) => u.rol === "supervisor" && u.capacitador },
];

/** Estado del permiso → qué mostrar. "granted"/"denied" son
 *  decisiones del navegador que un botón nuestro no puede revertir
 *  (por diseño, así evitan que un sitio insista) — para "denied" solo
 *  se explica cómo re-habilitarlo a mano en la config del navegador.
 *
 *  IMPORTANTE: "granted" (permiso del navegador) NO es lo mismo que
 *  "hay un token real guardado" — un rechazo del backend, un error de
 *  red, o un service worker con caché vieja pueden dejar el permiso
 *  otorgado sin que el registro haya funcionado de verdad. Por eso
 *  esto chequea la hoja "Tokens" real, no solo el permiso — mostrar
 *  "Activadas ✓" sin haberlo verificado fue justamente el bug que hizo
 *  perder tiempo buscando el problema en el lugar equivocado. */
/** Cuando soportaPush() da false no había NADA acá antes — ni botón
 *  ni explicación, la sección entera desaparecía en silencio. Eso es
 *  justo lo que reportaron algunas personas ("no me sale para poder
 *  activarlas"): la causa real casi siempre es específica de iPhone
 *  (la API de notificaciones ni existe en Safari normal, solo dentro
 *  de la app YA instalada en la pantalla de inicio, y recién desde
 *  iOS 16.4), no un problema del dispositivo en sí — por eso antes se
 *  veía "normal" para unos y "sin opción" para otros sin explicación. */
function motivoSinPush() {
    if (!esIOS()) {
        return "Este navegador no soporta notificaciones push. Si estás abriendo el link desde adentro de otra app (Instagram, WhatsApp, etc.), abrilo en Safari o Chrome directamente.";
    }
    if (!yaInstalada()) {
        return "En iPhone, las notificaciones solo funcionan dentro de la app YA instalada en la pantalla de inicio (no en Safari normal). Instalala primero: menú Compartir → Agregar a inicio, y abrila desde ese ícono.";
    }
    return "Tu iPhone necesita iOS 16.4 o más nuevo para recibir notificaciones push. Revisá si tenés una actualización pendiente en Ajustes → General → Actualización de Software.";
}

async function bloquePush(usuario) {
    if (!soportaPush()) {
        return `
            <div class="card" style="max-width:420px;margin-top:16px">
                <div class="item"><span>Notificaciones push</span><strong class="text-sm text-muted">No disponibles</strong></div>
                <p class="text-xs text-muted" style="margin-top:8px">${motivoSinPush()}</p>
            </div>
        `;
    }

    const estado = estadoPermisoPush();
    if (estado === "denied") {
        return `
            <div class="card" style="max-width:420px;margin-top:16px">
                <div class="item"><span>Notificaciones push</span><strong class="text-sm text-muted">Bloqueadas</strong></div>
                <p class="text-xs text-muted" style="margin-top:8px">Las bloqueaste antes desde el navegador. Para recibirlas, habilitalas a mano en la configuración del sitio (ícono de candado en la barra de direcciones).</p>
            </div>
        `;
    }
    if (estado === "granted") {
        const tokens = await getTokensDeUsuario(usuario.id);
        if (tokens.length) {
            return `
                <div class="card" style="max-width:420px;margin-top:16px">
                    <div class="item"><span>Notificaciones push</span><strong class="text-sm" style="color:var(--success)">Activadas ✓</strong></div>
                    ${usuario.rol === "admin" ? `<button type="button" id="btn-probar-push" class="btn btn-secondary" style="width:auto;margin-top:8px">Enviar prueba</button>` : ""}
                </div>
            `;
        }
        // El navegador dio el permiso, pero no hay ningún token
        // guardado para este usuario — el registro falló en algún
        // punto (backend, red, service worker). Reintentar no vuelve a
        // pedir el permiso nativo (ya está concedido), solo repite el
        // registro del token.
        return `
            <div class="card" style="max-width:420px;margin-top:16px">
                <div class="item"><span>Notificaciones push</span><button class="btn btn-secondary" id="btn-activar-push" style="width:auto">Reintentar</button></div>
                <p class="text-xs text-muted" style="margin-top:8px">Diste el permiso, pero el dispositivo no quedó registrado. Puede ser algo puntual — tocá "Reintentar".</p>
            </div>
        `;
    }
    return `
        <div class="card" style="max-width:420px;margin-top:16px">
            <div class="item"><span>Notificaciones push</span><button class="btn btn-secondary" id="btn-activar-push" style="width:auto">Activar</button></div>
            <p class="text-xs text-muted" style="margin-top:8px">Recibí avisos en el celular cuando haya algo nuevo en Comunicaciones o News, aunque no tengas la app abierta.</p>
        </div>
    `;
}

/** Redimensiona y comprime la imagen en el navegador antes de
 *  subirla — una foto de celular sin tocar puede pesar varios MB; acá
 *  no hace falta más que ~400px de lado para un avatar circular.
 *  Devuelve un data URL JPEG, listo para mandar a subirFotoPerfil. */
function comprimirImagenPerfil(file, ladoMax = 640, calidad = 0.85) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            const escala = Math.min(1, ladoMax / Math.max(img.width, img.height));
            const w = Math.round(img.width * escala) || 1;
            const h = Math.round(img.height * escala) || 1;
            const canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            canvas.getContext("2d").drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL("image/jpeg", calidad));
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("No se pudo leer la imagen.")); };
        img.src = url;
    });
}

function bloqueVistaRapida(candidatos) {
    const botonesHtml = ROLES_VISTA_RAPIDA.map((r) => {
        const objetivo = candidatos.find(r.match);
        return `<button type="button" class="btn btn-secondary" data-ver-como-rol="${r.id}" data-ver-como-usuario-id="${objetivo?.id || ""}" ${objetivo ? "" : "disabled"}>${r.label}</button>`;
    }).join("");

    return `
        <div class="card" style="max-width:420px;margin-top:20px">
            <h3 style="margin-top:0">Ver como</h3>
            <p class="text-xs text-muted" style="margin-top:4px;margin-bottom:14px">
                Previsualizá la app como cada tipo de rol, sin tener que buscar una persona puntual.
            </p>
            <div style="display:flex;gap:8px;flex-wrap:wrap">${botonesHtml}</div>
        </div>
    `;
}

export async function Perfil() {

    const usuario = getUsuarioActual();
    const esAdmin = usuario.rol === "admin";
    const candidatos = esAdmin ? (await getUsuarios()).filter((u) => u.activo === "SI") : [];

    return `
        ${Header("Mi perfil")}

        <div class="card" style="max-width:420px">
            <div style="display:flex;flex-direction:column;align-items:center;gap:12px;margin-bottom:20px">
                <div class="avatar-perfil-wrap">
                    ${Avatar({ nombre: usuario.nombre, foto: usuario.foto, size: "lg" })}
                    <input type="file" id="input-archivo-foto" accept="image/*" style="display:none">
                    <button type="button" class="avatar-perfil-camara" id="btn-subir-foto" title="Subir foto" aria-label="Subir foto">${Icon("camara", { size: 16 })}</button>
                </div>
                <div style="text-align:center">
                    <p class="text-xs text-muted">Foto de perfil
                        <span class="mod-tooltip kpi-ayuda" data-tooltip-texto="Subí una foto cuadrada (1:1) — se ajusta y comprime sola antes de subirla.">ⓘ</span>
                    </p>
                </div>
            </div>

            <div class="list">
                <div class="item"><span>Nombre</span><strong>${usuario.nombre}</strong></div>
                <div class="item"><span>Email</span><strong style="word-break:break-word;text-align:right">${usuario.email}</strong></div>
                <div class="item"><span>Rol</span><strong>${ROL_LEGIBLE[usuario.rol] || usuario.rol}${usuario.encargado ? ` (${ETIQUETA_RESPONSABLE_LOCAL})` : usuario.responsableTurno ? ` (${ETIQUETA_RESPONSABLE_TURNO})` : ""}${usuario.capacitador ? " (Capacitador)" : ""}</strong></div>
                ${usuario.sucursal ? `<div class="item"><span>Sucursal</span><strong>${usuario.sucursal}</strong></div>` : ""}
            </div>
        </div>

        ${await bloquePush(usuario)}

        ${esAdmin ? bloqueVistaRapida(candidatos) : ""}

        <p class="text-xs text-muted" style="text-align:center;margin-top:20px">
            Versión ${VERSION}${ES_STAGING ? ` · <strong style="color:var(--danger)">PRUEBA</strong>` : ""}
        </p>
    `;
}

export function bindPerfil() {
    const btnSubirFoto = document.getElementById("btn-subir-foto");
    const inputArchivoFoto = document.getElementById("input-archivo-foto");

    btnSubirFoto?.addEventListener("click", () => inputArchivoFoto?.click());

    document.querySelectorAll("[data-ver-como-rol]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const id = btn.dataset.verComoUsuarioId;
            if (!id) return;
            const admin = getUsuarioActual();
            const usuarios = await getUsuarios();
            const objetivo = usuarios.find((u) => String(u.id) === String(id));
            if (!objetivo) return;
            registrarEvento(admin.id, "ver_como", `${admin.nombre} activó la vista como ${objetivo.nombre} (acceso rápido por rol: ${btn.dataset.verComoRol})`);
            verComo(objetivo);
            navigate("inicio", { replace: true });
        });
    });

    inputArchivoFoto?.addEventListener("change", async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            alert("Elegí un archivo de imagen.");
            inputArchivoFoto.value = "";
            return;
        }

        const textoOriginal = btnSubirFoto.textContent;
        btnSubirFoto.disabled = true;
        btnSubirFoto.textContent = "Subiendo...";

        try {
            const base64 = await comprimirImagenPerfil(file);
            const resultado = await gasRequest("subirFotoPerfil", { extension: "jpg", archivoBase64: base64 });

            if (!resultado || !resultado.ok) {
                throw new Error(resultado?.error || "No se pudo subir la foto.");
            }

            const usuario = getUsuarioActual();
            // No alcanza con esperar la promesa — si el backend rechaza el
            // guardado (fila no encontrada, permiso, etc.) devuelve
            // {ok:false} sin tirar excepción, y seguir de largo acá daba
            // sensación de éxito (sesión local actualizada, navega a
            // perfil) aunque el Sheet real nunca se tocara. Reportado en
            // vivo: la foto subió bien a Drive pero nunca llegó al Sheet,
            // sin ningún aviso.
            const resultadoGuardado = await actualizarUsuario(usuario.id, { foto: resultado.url });
            if (!resultadoGuardado || resultadoGuardado.ok === false) {
                throw new Error(resultadoGuardado?.error || "La foto se subió pero no se pudo guardar en tu perfil. Probá de nuevo.");
            }
            usuario.foto = resultado.url;
            setItem("sesion", usuario);
            navigate("perfil");
        } catch (err) {
            alert(err.message || "No se pudo subir la foto.");
            btnSubirFoto.disabled = false;
            btnSubirFoto.textContent = textoOriginal;
        } finally {
            inputArchivoFoto.value = "";
        }
    });

    document.getElementById("btn-activar-push")?.addEventListener("click", async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        btn.textContent = "Activando...";
        const usuario = getUsuarioActual();
        const resultado = await activarPush(usuario);
        if (resultado.ok) {
            navigate("perfil");
            return;
        }
        btn.disabled = false;
        btn.textContent = "Activar";
        if (resultado.motivo === "denegado") alert("No diste el permiso de notificaciones — podés activarlo más tarde desde la configuración del navegador.");
        else alert("No se pudo activar. Probá de nuevo en un momento." + (resultado.detalle ? `\n\nDetalle: ${resultado.detalle}` : ""));
    });

    document.getElementById("btn-probar-push")?.addEventListener("click", async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        const textoOriginal = btn.textContent;
        btn.textContent = "Enviando...";

        try {
            const resultado = await gasRequest("enviarPushPrueba", {});
            if (resultado.ok) {
                btn.textContent = "¡Enviado!";
                setTimeout(() => {
                    btn.disabled = false;
                    btn.textContent = textoOriginal;
                }, 2000);
            } else {
                alert("No se pudo enviar: " + (resultado.error || "Error desconocido"));
                btn.disabled = false;
                btn.textContent = textoOriginal;
            }
        } catch (err) {
            alert("Error: " + err.message);
            btn.disabled = false;
            btn.textContent = textoOriginal;
        }
    });
}
