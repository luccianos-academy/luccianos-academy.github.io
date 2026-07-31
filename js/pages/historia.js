/* ============================
   FARO v4
   pages/historia.js — Historia de Lucciano's

   Contenido real extraído del "Manual de Experiencia" oficial de
   Lucciano's (fundación, línea de tiempo, misión, propósito, valores
   y Principios de Tonio) — reemplaza la versión anterior basada en
   SisCap, que tenía datos parcialmente desactualizados (ej. la
   misión/visión no coincidía con el manual real). Abierta a los 3
   roles — conocer la historia de la marca no es una función de
   gestión, así que no tiene entrada en PERMISOS_PAGINA (queda
   abierta a cualquier usuario autenticado, igual que Inicio/Perfil).
=============================*/

import { Header } from "../components/header.js";
import { Icon } from "../components/icons.js";
import { getUsuarioActual } from "../services/auth.js";
import { marcarHistoriaVista } from "../data/usuarios.js";

const PROPOSITO = [
    { titulo: "Magia en la atención al cliente", texto: "Trato personalizado, empatía y cercanía en cada interacción." },
    { titulo: "Ventas inspiradas", texto: "Proactividad, conocimiento del producto y una comunicación que entusiasma." },
    { titulo: "Equipo humano", texto: "Respeto, unidad y apoyo mutuo como base de nuestro crecimiento." },
    { titulo: "Pasión por lo que hacemos", texto: "Energía, dedicación y orgullo en cada detalle." },
    { titulo: "Innovación que sorprende", texto: "Iniciativa, adaptabilidad y una visión de futuro constante." },
];

const VALORES = [
    "Sonrisas", "Trabajo en equipo", "Dedicación", "Profesionalismo", "Trato cordial",
    "Honestidad", "Búsqueda de la excelencia", "Proactividad", "Compromiso y responsabilidad",
    "Creatividad", "Respeto", "Alegría", "Cercanía", "Entusiasmo",
];

const PRINCIPIOS_TONIO = [
    { titulo: "Seguridad", texto: "Cuidamos cada detalle para asegurar el bienestar de nuestros clientes y equipos. Conocer los productos, dominar los procesos y mantener la limpieza e higiene son la base de toda gran experiencia." },
    { titulo: "Cortesía", texto: "La sonrisa es nuestra materia prima. Usar frases amables y conectar con las personas implica anticiparnos a sus necesidades y expectativas." },
    { titulo: "Inclusión", texto: "En Lucciano's todos somos parte. Promovemos un ambiente donde cada persona se sienta bienvenida, respetada y valorada." },
    { titulo: "Actitud", texto: "Cuidamos la imagen, nuestra presencia, energía y compromiso que transforman lo cotidiano en especial." },
    { titulo: "Eficiencia", texto: "Buscamos la excelencia haciendo que todo funcione de manera fluida. Optimizar tiempos, cuidar los recursos y respetar los procesos nos permite brindar un servicio ágil, sin perder la calidez." },
];

export async function Historia() {

    // Gate de "antes de empezar" (ver router.js): con que un
    // Colaborador/Encargado ABRA esta página una vez ya alcanza —
    // no bloqueante para el resto de los roles, que no rinden
    // formación. Sin "await" a propósito: no tiene sentido demorar
    // el render de la página por esto, y si falla (red lenta, etc.)
    // el gate simplemente se vuelve a activar la próxima vez.
    const usuario = getUsuarioActual();
    // Guardado ANTES de marcarHistoriaVista (que es async y no
    // bloquea el render) — así el aviso de abajo refleja si el gate
    // seguía activo cuando la persona llegó acá, no si ya se marcó
    // en el ratito que tardó el fetch.
    const gateEstabaActivo = usuario && usuario.rol === "colaborador" && !usuario.historiaVista;
    if (gateEstabaActivo) {
        marcarHistoriaVista(usuario.id).catch(() => {});
    }

    const propositoHtml = PROPOSITO.map((p) => `
        <div class="card">
            <h3>${p.titulo}</h3>
            <p class="text-sm" style="margin-top:8px;color:var(--text)">${p.texto}</p>
        </div>
    `).join("");

    const valoresHtml = VALORES.map((v) => `<span class="badge badge-muted" style="margin:4px 6px 4px 0">${v}</span>`).join("");

    const principiosHtml = PRINCIPIOS_TONIO.map((p) => `
        <div class="card">
            <h3>${p.titulo}</h3>
            <p class="text-sm" style="margin-top:8px;color:var(--text)">${p.texto}</p>
        </div>
    `).join("");

    return `
        ${Header("Nuestra Historia", "Lucciano's es una empresa familiar que nace a partir del deseo de atender al segmento de consumidores más exigentes de helado artesanal de Argentina.")}

        ${gateEstabaActivo ? `
            <div class="aviso-historia">
                ${Icon("idea", { size: 20 })}
                <div>
                    <strong>Tu formación comienza con nuestra historia</strong>
                    <p>Antes de acceder a los cursos, dedicá unos minutos a conocer el origen, la evolución y los valores que hacen único a Lucciano's.</p>
                </div>
            </div>
        ` : ""}

        <div class="section">
            <div class="grid-2-1">
                <img src="assets/img/historia/fundadores.jpg" alt="Fundadores de Lucciano's: Franco, Daniel y Christian Otero" style="width:100%;border-radius:var(--radius);box-shadow:var(--shadow)">
                <div>
                    <h2>Quiénes somos</h2>
                    <p class="text-sm" style="margin-top:10px;color:var(--text)">Sus fundadores, padre e hijo, <b>Christian y Daniel Otero</b>, viajaron a Italia con el objetivo de traer la última tecnología para fabricar helado y a los mejores maestros heladeros.</p>
                    <p class="text-sm" style="margin-top:10px;color:var(--text)">Combinaron las mejores materias primas nacionales e italianas junto a chocolates belgas para desarrollar un producto único, inigualable y transformarse en el sinónimo del mejor helado artesanal Premium del mercado.</p>
                    <p class="text-sm" style="margin-top:10px;color:var(--text)">Logran brindar una experiencia superadora a los clientes a través del producto ofrecido y sus diferentes locales, con diseño de vanguardia.</p>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>Conocé más sobre Lucciano's</h2>
            <video controls preload="metadata" style="width:100%;border-radius:var(--radius);box-shadow:var(--shadow);background:#000">
                <source src="assets/video/lucciano-institucional.mp4" type="video/mp4">
            </video>
        </div>

        <div class="section">
            <h2>Lucciano's en números</h2>
            <div class="stats">
                <div class="stat"><b>+100</b><span>Locales en Argentina</span></div>
                <div class="stat"><b>+20</b><span>Locales en el exterior</span></div>
                <div class="stat"><b>+1500</b><span>Puntos de venta Retail</span></div>
            </div>
        </div>

        <div class="section">
            <h2>Línea de tiempo</h2>
            <img src="assets/img/historia/linea_de_tiempo.jpg" alt="Línea de tiempo Lucciano's 2011-2026" style="width:100%;border-radius:var(--radius);box-shadow:var(--shadow)">
        </div>

        <div class="section">
            <h2>Nuestra misión</h2>
            <div class="card">
                <p class="text-sm" style="color:var(--text)">Crear sonrisas a través de la excelencia. Queremos ser parte de los momentos felices que enriquecen la vida de las personas.</p>
                <p class="text-sm" style="margin-top:10px;color:var(--text)">Nos posicionamos como referentes en calidad y calidez, generando conexiones genuinas con quienes nos eligen. Nuestra misión refleja la pasión y el deseo de ser mucho más que una heladería: una experiencia que deja huella.</p>
            </div>
        </div>

        <div class="section">
            <h2>Nuestro propósito</h2>
            <div class="cards">${propositoHtml}</div>
        </div>

        <div class="section">
            <h2>Nuestros valores</h2>
            <div class="card">${valoresHtml}</div>
        </div>

        <div class="section">
            <h2>Los Principios de Tonio</h2>
            <p class="text-sm text-muted" style="margin-bottom:14px">La base para que cada colaborador pueda ofrecer la mejor experiencia posible.</p>
            <div class="cards">${principiosHtml}</div>
        </div>
    `;
}
