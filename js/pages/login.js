/* ============================
   FARO v4
   login.js — Pantalla de Login

   Portada a pantalla completa con una secuencia de revelación
   institucional (no un simple corte de escena):
   1) el video del Torreón (Mar del Plata) se reproduce una sola vez
      — "entrando al castillo" — hasta el acceso (frame 335, 13.4s).
   2) el video se congela ahí solo (es el último frame, no hace falta
      forzarlo) y, tras 0,8s de quietud, se revela en capas sobre esa
      misma toma: se oscurece un poco, un pulso de brillo, una línea
      dorada que crece al centro, el wordmark "Lucciano's Academy" y
      por último el botón "Ingresar" — todo sobre el MISMO edificio,
      sin saltar a otra escena/local. Sin bajada/tagline a propósito:
      todavía no hay una frase definitiva de marketing, así que se deja
      afuera en vez de poner un placeholder que después haya que sacar.
   3) si nadie toca "Ingresar" en 10 segundos (contados desde que
      termina de aparecer el botón), se reinicia todo el ciclo desde
      el video del Torreón — al tocarlo, se cancela ese reinicio y se
      abre el modal de acceso real (mismo patrón que apps de comida
      tipo McDonald's/KFC: portada + botón que abre el modal de
      login).

   Mientras no hay un Client ID de Google configurado (config.js), el
   modal muestra un picker de roles de muestra en vez del botón real
   de Google — así el resto de la app (roles, sesión, router) se
   puede probar de punta a punta sin depender de un backend real. El
   botón de Google Sign-In queda armado y a la espera: alcanza con
   pegar GOOGLE_CLIENT_ID para que tome su lugar.
=============================*/

import { renderFullScreen } from "../ui.js";
import { abrirModal, cerrarModal } from "../components/modal.js";
import { login, ROLES } from "../services/auth.js";
import { verificarLoginGoogle } from "../services/google.js";
import { getUsuarios } from "../data/usuarios.js";
import { registrarEvento } from "../data/auditoria.js";
import { GOOGLE_CLIENT_ID } from "../config.js";
import { navigate } from "../router.js";
import { Icon } from "../components/icons.js";
import { existe as vistoAntes, setItem } from "../services/storage.js";

const CLAVE_BIENVENIDA_VISTA = "vio_bienvenida_personajes";

/**
 * Paso extra tras un login exitoso, una sola vez por dispositivo (no
 * en cada login — el video dura ~1min, sería un impuesto diario
 * injusto). Si ya se vio, navega directo a "inicio" como antes.
 */
function mostrarBienvenidaPersonajes() {
    if (vistoAntes(CLAVE_BIENVENIDA_VISTA)) {
        navigate("inicio", { replace: true });
        return;
    }

    setItem(CLAVE_BIENVENIDA_VISTA, true);

    const continuar = () => {
        overlay.remove();
        navigate("inicio", { replace: true });
    };

    document.body.insertAdjacentHTML("beforeend", `
        <div class="bienvenida-overlay" id="bienvenida-personajes-overlay">
            <div class="bienvenida-video-wrap">
                <video class="bienvenida-video" id="bienvenida-personajes-video"
                       src="assets/video/bienvenida-personajes.mp4" autoplay playsinline></video>
                <div class="bienvenida-texto" id="bienvenida-personajes-texto">
                    <p class="bienvenida-texto-burbuja">¡Bienvenido! Soy el Maestro y voy a acompañarte en este recorrido.</p>
                </div>
            </div>
            <button class="bienvenida-sonido" id="bienvenida-personajes-sonido" aria-label="Silenciar">
                ${Icon("sonido", { size: 18 })}
            </button>
            <button class="bienvenida-saltar" id="bienvenida-personajes-saltar">Saltar</button>
        </div>
    `);

    const overlay = document.getElementById("bienvenida-personajes-overlay");
    const video = document.getElementById("bienvenida-personajes-video");
    const textoMaestro = document.getElementById("bienvenida-personajes-texto");
    const btnSonido = document.getElementById("bienvenida-personajes-sonido");
    const btnSaltar = document.getElementById("bienvenida-personajes-saltar");

    // La burbuja de texto del Maestro reemplaza al diálogo que antes
    // venía incrustado en el video (recortado — ver bienvenida-personajes-
    // original.mp4): aparece una vez que el personaje termina de
    // revelarse solo en pantalla y se mantiene hasta el final del clip
    // (el último frame queda congelado unos segundos para dar tiempo
    // a leerla — ver el filtro tpad usado al recortar el video).
    video.addEventListener("timeupdate", () => {
        textoMaestro.classList.toggle("visible", video.currentTime >= 6.5);
    });

    const actualizarIconoSonido = () => {
        btnSonido.innerHTML = Icon(video.muted ? "sonido-off" : "sonido", { size: 18 });
        btnSonido.setAttribute("aria-label", video.muted ? "Activar sonido" : "Silenciar");
    };

    // Arranca con sonido (pidieron que el primer video suene solo).
    // Si el navegador bloquea el autoplay con audio — pasa si el login
    // vino de un callback async de Google, no de un clic directo —
    // reintenta muteado en vez de dejar el video sin arrancar.
    video.play().catch(() => {
        video.muted = true;
        actualizarIconoSonido();
        video.play();
    });

    video.addEventListener("ended", continuar);
    btnSaltar.addEventListener("click", continuar);
    btnSonido.addEventListener("click", () => {
        video.muted = !video.muted;
        actualizarIconoSonido();
    });
}

const MODAL_ID = "modal-login";

// Cuánto tarda en terminar de aparecer todo (línea dorada + wordmark +
// bajada + botón) desde que arranca la revelación — tiene que calzar
// con las animation-delay/duration de .login-reveal-* en layout.css.
// El timer de reinicio por inactividad recién arranca a partir de acá.
const PAUSA_ANTES_DE_REVELAR_MS = 800;
const DURACION_REVELACION_MS = 3000; // línea (1.3s) + wordmark (2.2s) + botón (3.0s)
const ESPERA_SIN_INTERACCION_MS = 10000;

// Timer del reinicio automático — se guarda acá para poder cancelarlo
// apenas el colaborador toca "Ingresar", así el video no vuelve a
// arrancar debajo del modal mientras está completando el login.
let timeoutReinicioPortada = null;

/**
 * Portada "Bienvenido/a" — sin esto, el video+audio del Torreón
 * arrancaban solos al cargar la página, y como en una visita fría
 * todavía no hubo NINGÚN gesto del usuario en el sitio, el navegador
 * bloquea el autoplay con sonido por política (no es algo que se
 * pueda forzar por código) y la toma arrancaba muda — la mayoría no
 * llegaba a notar el botón de sonido a tiempo y se perdía la
 * experiencia completa. El primer toque acá mismo YA es el gesto que
 * el navegador exige, así que la toma real arranca directo con
 * sonido, sin depender de que alguien encuentre el botón después.
 * Usa el primer frame del video del Torreón como fondo (misma toma,
 * sin saltar a otra escena) con un scrim oscuro encima — a propósito
 * SIN el wordmark "Lucciano's Academy" acá (antes lo tenía): esa
 * revelación es la sorpresa que arma toda la secuencia de abajo, y
 * mostrarla ya en este primer toque le sacaba la magia.
 */
export async function Login() {

    const content = renderFullScreen();

    content.innerHTML = `
        <div class="login-gate" id="login-gate">
            <button class="btn btn-primary login-gate-btn" id="btn-login-gate" type="button">Bienvenido/a</button>
        </div>
    `;

    document.getElementById("btn-login-gate").addEventListener("click", () => {
        document.getElementById("login-gate")?.remove();
        renderPortada(content);
    }, { once: true });

    // Esta página maneja su propio DOM (sin sidebar) mediante renderFullScreen().
    return "";
}

function renderPortada(content) {

    content.insertAdjacentHTML("beforeend", `
        <div class="login-portada">
            <video class="login-portada-video" id="login-video-torreon" src="assets/video/login-torreon.mp4" autoplay muted playsinline></video>
            <audio id="login-audio-torreon" src="assets/audio/login-torreon-audio.m4a" autoplay></audio>
            <audio id="login-audio-mar" src="assets/audio/mar-ambiente.m4a" loop></audio>
            <button class="login-btn-sonido" id="btn-sonido" type="button" aria-label="Silenciar">${Icon("sonido", { size: 18 })}</button>
            <div class="login-reveal" id="login-reveal">
                <div class="login-reveal-scrim"></div>
                <div class="login-reveal-contenido">
                    <div class="login-reveal-linea"></div>
                    <div class="login-reveal-marca">
                        <span class="login-reveal-script">Lucciano's</span>
                        <span class="login-reveal-academy">Academy</span>
                    </div>
                    <button class="btn btn-primary login-btn-ingresar" id="btn-abrir-login">Ingresar</button>
                </div>
            </div>
        </div>
    `);

    document.getElementById("btn-abrir-login").addEventListener("click", () => {
        // El audio sigue su curso (la canción termina de apagarse y
        // quedan las olas) aunque ya se haya abierto el login — cortarlo
        // en seco acá se sentía igual de vacío que no tener nada. Sólo
        // se cancela el reinicio del video, para que no salte de vuelta
        // al Torreón mientras el modal está abierto.
        detenerReinicioPortada();
        abrirModalLogin();
    });

    document.getElementById("btn-sonido").addEventListener("click", alternarSonido);

    // El video queda muteado siempre (su pista de audio no se usa —
    // el audio real es login-audio-torreon, mezclado/loopeado aparte
    // con mejor control). El toque en el gate (login-gate, más arriba)
    // ya es el gesto que el navegador exige para permitir sonido acá —
    // el catch queda solo como red de seguridad, no como el camino
    // esperado.
    const audioTorreon = document.getElementById("login-audio-torreon");
    audioTorreon.play().catch(() => {
        audioTorreon.muted = true;
        actualizarIconoSonidoLogin();
        audioTorreon.play();
    });

    iniciarSecuenciaPortada();
}

function actualizarIconoSonidoLogin() {
    const audioTorreon = document.getElementById("login-audio-torreon");
    const btn = document.getElementById("btn-sonido");
    if (!audioTorreon || !btn) return;
    btn.innerHTML = Icon(audioTorreon.muted ? "sonido-off" : "sonido", { size: 18 });
    btn.setAttribute("aria-label", audioTorreon.muted ? "Activar sonido original" : "Silenciar");
    // Pulso solo mientras está mudo — para que se note que hay un
    // botón para activar el audio, no algo permanente ni ya con
    // sonido (ahí molestaría en vez de ayudar).
    btn.classList.toggle("necesita-atencion", audioTorreon.muted);
}

/** audioTorreon y audioMar comparten el mismo mute — el sonido queda
 *  prendido o apagado de punta a punta, nunca a medias.
 *
 *  Al ACTIVAR sonido (no al apagarlo) se reinicia todo desde el
 *  principio — video y los dos audios — en vez de solo destildar el
 *  mute donde haya quedado. La toma dura apenas ~20s; si alguien la
 *  activa a mitad de camino (lo más común: el autoplay mudo por
 *  política del navegador hace que recién noten el botón unos
 *  segundos después), solo llegaban a escuchar la cola del audio, que
 *  ya viene bajando en fade-out — se perdía la experiencia completa.
 *  Reiniciar garantiza que quien active el sonido, en el momento que
 *  sea, escuche la toma entera de punta a punta. */
function alternarSonido() {
    const video = document.getElementById("login-video-torreon");
    const audioTorreon = document.getElementById("login-audio-torreon");
    const audioMar = document.getElementById("login-audio-mar");
    const activando = audioTorreon.muted;

    audioTorreon.muted = !audioTorreon.muted;
    audioMar.muted = audioTorreon.muted;
    actualizarIconoSonidoLogin();

    if (!activando) return;

    detenerReinicioPortada();
    document.getElementById("login-reveal")?.classList.remove("visible");
    document.getElementById("btn-sonido")?.classList.remove("oculto-transicion");
    video?.classList.remove("pulso");
    audioMar.pause();

    audioTorreon.currentTime = 0;
    audioTorreon.play();
    if (video) {
        video.currentTime = 0;
        video.play();
    }
}

/** Video del Torreón (una sola pasada, sin loop) → queda congelado en
 *  su último frame solo (el navegador no lo vacía al terminar). Tras
 *  una pausa breve, se revela la marca en capas sobre esa misma toma.
 *  Si no tocan "Ingresar", reinicia el ciclo entero desde el video.
 *
 *  login-audio-torreon arranca junto con el video (autoplay) y es UNA
 *  sola toma continua de 20,4s sacada de un único tramo del audio
 *  original (sin empalmar dos clips separados) — cubre tanto los
 *  13,4s del video como varios segundos de la revelación, así no hay
 *  ningún corte/costura en el medio: se apaga sola (fade-out ya
 *  incluido en el archivo) recién unos segundos entrada la revelación,
 *  momento en el que el ambiente de mar ya viene subiendo en paralelo. */
function iniciarSecuenciaPortada() {
    const video = document.getElementById("login-video-torreon");
    const audioMar = document.getElementById("login-audio-mar");
    const audioTorreon = document.getElementById("login-audio-torreon");
    const reveal = document.getElementById("login-reveal");
    const btnSonido = document.getElementById("btn-sonido");
    if (!video) return;

    video.addEventListener("ended", () => {
        // El video llegó a su último frame, pero login-audio-torreon
        // sigue sonando solo (arrancó junto al video y todavía le
        // quedan varios segundos) — el botón de sonido deja de tener
        // sentido durante la revelación porque ya no hay nada más para
        // activar/desactivar en este punto del ciclo.
        btnSonido.classList.add("oculto-transicion");
        setTimeout(() => {
            video.classList.add("pulso");
            reveal.classList.add("visible");
            // El ambiente de mar arranca ahora, mientras login-audio-torreon
            // todavía viene sonando — para cuando éste se apague solo
            // (fade-out incluido en el archivo), las olas ya están arriba.
            // Hereda el mute de audioTorreon (ver Login()) — si el
            // autoplay con sonido ya se resolvió mudo ahí, el mar
            // arranca mudo también, nunca a medias.
            audioMar.muted = audioTorreon.muted;
            audioMar.currentTime = 0;
            audioMar.play();
            timeoutReinicioPortada = setTimeout(() => {
                video.classList.remove("pulso");
                reveal.classList.remove("visible");
                btnSonido.classList.remove("oculto-transicion");
                audioMar.pause();
                audioTorreon.currentTime = 0;
                audioTorreon.play();
                video.currentTime = 0;
                video.play();
            }, DURACION_REVELACION_MS + ESPERA_SIN_INTERACCION_MS);
        }, PAUSA_ANTES_DE_REVELAR_MS);
    });
}

function detenerReinicioPortada() {
    if (!timeoutReinicioPortada) return;
    clearTimeout(timeoutReinicioPortada);
    timeoutReinicioPortada = null;
}

async function abrirModalLogin() {

    const clientIdConfigurado = Boolean(GOOGLE_CLIENT_ID);

    const html = `
        <div class="modal-overlay login-overlay" id="${MODAL_ID}">
            <div class="modal login-modal">
                <button class="modal-close" data-close="${MODAL_ID}">✕</button>

                <h2 class="login-modal-titulo">Ingresá a tu cuenta</h2>

                <div id="login-error-slot"></div>

                ${clientIdConfigurado
                    ? `<div class="login-google-pill">
                        <div id="google-btn-slot" class="login-google-slot"></div>
                        <span class="login-google-texto">Ingresar</span>
                       </div>`
                    : `
                        <div class="login-subtitulo">Todavía no hay backend conectado — entrá como un usuario de muestra:</div>
                        <div class="role-picker" id="role-picker"></div>
                        <div class="role-picker-nota">Cuando exista un Google Client ID (js/config.js), este picker se reemplaza solo por el botón real de Google Sign-In.</div>
                    `
                }
            </div>
        </div>
    `;

    abrirModal(html, MODAL_ID);

    if (clientIdConfigurado) {
        inicializarGoogleSignIn();
    } else {
        await renderRolePicker();
    }
}

async function renderRolePicker() {
    const usuarios = await getUsuarios();
    const picker = document.getElementById("role-picker");
    if (!picker) return;

    picker.innerHTML = ROLES.map((r) => {
        const disponible = usuarios.some((u) => u.rol === r.id);
        return `<button class="btn btn-secondary" data-rol="${r.id}" ${disponible ? "" : "disabled"}>${r.nombre} — <span style="font-weight:400">${r.descripcion}</span></button>`;
    }).join("")
        // "Capacitador" no es un rol real (es un Supervisor con
        // capacitador:true — ver data/usuarios.js), así que no sale de
        // ROLES: se suma acá como accesorio, mismo criterio de picker.
        + `<button class="btn btn-secondary" data-rol="capacitador" ${usuarios.some((u) => u.rol === "supervisor" && u.capacitador) ? "" : "disabled"}>Capacitador — <span style="font-weight:400">Solo lectura de toda la red</span></button>`;

    picker.querySelectorAll("[data-rol]").forEach((btn) => {
        btn.addEventListener("click", () => entrarComo(btn.dataset.rol, usuarios));
    });
}

async function entrarComo(rol, usuarios) {
    const usuario = rol === "capacitador"
        ? usuarios.find((u) => u.rol === "supervisor" && u.capacitador)
        : usuarios.find((u) => u.rol === rol);
    if (!usuario) return;

    login(usuario);
    registrarEvento(usuario.id, "login", `Ingreso de ${usuario.nombre}`);
    mostrarBienvenidaPersonajes();
}

function inicializarGoogleSignIn() {

    if (!document.getElementById("google-btn-slot")) return; // el modal se cerró antes de que cargue

    if (!window.google) {
        setTimeout(inicializarGoogleSignIn, 300);
        return;
    }

    window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: onGoogleCredential,
    });

    // Botón sólo-ícono (sin el rótulo en inglés de Google) — el texto
    // "Ingresar" de al lado es propio, así queda un botón más chico y
    // sutil en vez de la píldora blanca ancha por defecto.
    window.google.accounts.id.renderButton(
        document.getElementById("google-btn-slot"),
        { type: "icon", theme: "outline", size: "large", shape: "circle" }
    );
}

async function onGoogleCredential(response) {

    const slot = document.getElementById("login-error-slot");
    slot.innerHTML = `<div class="login-error" style="background:#fdf8ea;color:var(--warning)">Verificando...</div>`;

    try {
        // Se manda el ID token CRUDO al backend, que verifica su firma
        // contra Google y saca el email verificado (antes se decodificaba
        // el JWT acá y se mandaba el email en texto plano — eso permitía
        // suplantar a cualquiera). El rol/acceso los resuelve el backend.
        const resultado = await verificarLoginGoogle(response.credential);

        if (!resultado || !resultado.ok) {
            slot.innerHTML = `<div class="login-error">${(resultado && resultado.error) || "Tu cuenta todavía no está registrada en Lucciano's Academy. Solicitá acceso a tu supervisor o administrador."}</div>`;
            return;
        }

        login(resultado.usuario, resultado.sessionToken);
        registrarEvento(resultado.usuario.id, "login", `Ingreso de ${resultado.usuario.nombre}`);
        cerrarModal(MODAL_ID);
        mostrarBienvenidaPersonajes();

    } catch (err) {
        slot.innerHTML = `<div class="login-error">No se pudo verificar el login (${err.message}). Probá de nuevo.</div>`;
    }
}
