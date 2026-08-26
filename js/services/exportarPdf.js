/* ============================
   Lucciano's Academy
   services/exportarPdf.js — Exportar un bloque de la pantalla a PDF

   Pedido explícito del usuario, y el fix de un bug real que encontró
   probando el primer intento: el truco CSS clásico de "esconder todo
   menos .imprimible" (visibility:hidden + position:absolute) peleaba
   con el layout propio de la app (sidebar fijo, tema oscuro, banners)
   y los márgenes salían mal — el sidebar oculto seguía ocupando
   espacio (visibility:hidden no colapsa el layout), y position:absolute
   se posicionaba relativo al ancestro que tocara, no siempre la
   página entera.

   Solución más robusta: abrir una pestaña NUEVA, en blanco, con SOLO
   el contenido a exportar + una hoja de estilos propia y liviana (no
   hereda nada del tema oscuro de la app) — así el diálogo de
   impresión del navegador aplica sus márgenes de página por defecto
   sobre un documento limpio, sin nada más con lo que pelear. Reemplaza
   las clases oscuras del tema (badges, tarjetas, tabla) por su
   equivalente en blanco y negro, apto para papel/compartir.
=============================*/

const ESTILOS_IMPRESION = `
    * { box-sizing: border-box; }
    /* Esta ventana no carga css/variables.css — sin estas, cualquier
       componente que dependa de var(--success)/var(--danger)/etc.
       (el anillo de % del Semáforo, kpiPersona) cae al comportamiento
       por defecto del navegador: un <circle> SVG sin "fill" declarado
       se pinta NEGRO SÓLIDO (no transparente), y un stroke con var()
       inválida también. El semáforo de colores se veía como una fila
       de círculos negros idénticos — bug real encontrado por el
       usuario exportando. Mismos valores que variables.css, legibles
       igual sobre fondo blanco. */
    :root {
        --success: #3fae5e; --warning: #e0b23d; --danger: #e5675c;
        --gold: #c2a065; --line: #ccc; --muted: #666; --text: #111;
        --black: #1a1712;
    }
    /* Fondo explícito — sin esto, la pestaña hereda el modo oscuro del
       sistema/navegador (color-scheme del meta tag de abajo ayuda,
       pero un fondo explícito no depende de que ningún navegador lo
       respete) y el texto oscuro queda invisible sobre fondo oscuro.
       Bug real encontrado por el usuario probando.
       Blanco puro (#fff) se sentía "invasivo" — pedido explícito del
       usuario: un crema tenue, no un blanco chocante, más acorde a la
       marca (mismo espíritu cálido que --card/--gold-soft del tema
       oscuro, ver variables.css). Las tarjetas quedan en un blanco
       casi puro PERO no #fff plano, para que se noten un escalón por
       encima del fondo — la clave del look "papel premium" es que
       ninguno de los dos sea el blanco de pantalla default. */
    html { background: #f6f1e7; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111; background: #f6f1e7; padding: 28px; margin: 0; }

    /* Membrete — identidad de marca + de qué es este reporte y de
       cuándo, pedido explícito del usuario ("no tiene identidad, no
       dice Lucciano's y no hay argumento"). */
    .membrete-impresion { margin: 0 0 24px; padding-bottom: 14px; border-bottom: 2px solid #c2a065; }
    .membrete-marca { font-size: 22px; font-weight: 700; color: #c2a065; letter-spacing: .5px; }
    .membrete-titulo { font-size: 15px; font-weight: 700; color: #111; margin-top: 4px; }
    .membrete-meta { font-size: 12px; color: #666; margin-top: 2px; }

    h2, h3, h4 { color: #111; margin: 22px 0 10px; }
    h3:first-child, h4:first-child { margin-top: 0; }
    p { margin: 4px 0; }
    .text-xs { font-size: 11px; }
    .text-sm { font-size: 13px; }
    .text-muted { color: #666; }

    /* Grid, NO flex — pedido explícito del usuario: "unas más grandes
       que otras, no se ve simétrico". Con flex (1 1 150px), una
       tarjeta con más texto (ej. el nombre de una persona) empuja su
       propio ancho por encima del resto; con grid, las 5 columnas
       miden EXACTAMENTE lo mismo pase lo que pase adentro, y
       align-items:stretch (default de grid) las empareja también en
       alto — el contenido se acomoda al tamaño de la celda, nunca al
       revés. */
    .cards { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin: 14px 0; }
    /* "page-break-inside: avoid" SOLO en .kpi-card (las tarjetas
       chicas — partir un número a la mitad se ve mal), NO en ".card"
       a secas: acá esa clase también envuelve la tabla entera del
       Semáforo (vistaSemaforo, reportes.js), y prohibirle partirse
       era justo lo que causaba la "hoja de tapa": el membrete + las 5
       tarjetas ocupaban la página 1 con un hueco enorme abajo (todo
       lo que sobraba de espacio), porque el navegador no podía meter
       la tabla completa ahí y la mandaba entera a la página 2 en vez
       de continuarla donde había lugar. Bug real reportado por el
       usuario probando la impresión. */
    .card { background: #fffdf8; border: 1px solid #e2d9c5; border-radius: 8px; padding: 12px 16px; }
    .kpi-card { page-break-inside: avoid; }
    .kpi-card h3 { font-size: 11px; text-transform: uppercase; color: #666; margin: 0 0 6px; letter-spacing: .5px; }
    .kpi-card span { font-size: 22px; font-weight: 700; }
    .kpi-icon { display: none; }
    /* Vuelve a wrappear con menos de 5 columnas de ancho disponible
       (ej. una hoja vertical en vez de landscape) — evita el mismo
       problema de asimetría si algún día se exporta así. */
    @media (max-width: 720px) { .cards { grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); } }
    .kpi-persona-nombre { font-size: 14px; font-weight: 700; color: #111; margin: 4px 0 2px; }
    .tono-success { color: var(--success); }
    .tono-warning { color: var(--warning); }
    .tono-danger { color: var(--danger); }

    /* Anillo de % (reportes.js: anilloPct, "Vista por sucursal") —
       mismas reglas que css/components.css, con el track (círculo de
       fondo) pasado a un gris cálido en vez de gris frío, para no
       desentonar con el crema de acá arriba. El número queda
       CONTENIDO adentro, sin tocar el trazo — pedido explícito del
       usuario: "que el círculo esté rodeando la información, no que
       el porcentaje esté sobre el círculo" (un primer intento con
       fuente más grande se corrigió por esto). Sin el "fill: none"
       acá, un <circle> SVG sin fill declarado se pinta negro sólido
       por defecto del navegador — la fila de círculos negros que
       encontró el usuario exportando el Semáforo.
       "display:block; width:fit-content; margin:0 auto" en vez de
       "inline-block" — pedido explícito: "los círculos todos a la
       izquierda, queda todo asimétrico". Un inline-block dentro de un
       <td> se pega al borde izquierdo (el text-align por defecto de
       la celda), dejando todo el resto del ancho vacío a la derecha;
       con margin:auto y un ancho propio (fit-content, no el 100% que
       tomaría un block común) el anillo queda centrado en su celda
       sin importar cuánto más ancha sea que el círculo. */
    .anillo { position: relative; flex-shrink: 0; display: block; width: fit-content; margin: 0 auto; }
    .anillo svg { transform: rotate(-90deg); }
    .anillo circle { fill: none; stroke-width: 4; }
    .anillo-track { stroke: #e6ddc9; }
    .anillo-valor { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; }

    .table-wrapper { overflow: visible; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0 20px; font-size: 11px; page-break-inside: auto; background: #fffdf8; }
    tr { page-break-inside: avoid; }
    th, td { border: 1px solid #e2d9c5; padding: 6px 8px; text-align: left; vertical-align: top; background: #fffdf8; }
    th { background: #efe6d4; text-transform: uppercase; font-size: 9px; color: #333; letter-spacing: .3px; }

    /* Las columnas de módulo (badge/anillo + "No aplica" cuando no
       corresponde) y Nivel — centradas. Los badges y anillos ya se
       centran solos (min-width/margin:auto), pero "No aplica" es un
       <span> de texto plano sin nada de eso: quedaba pegado al borde
       izquierdo de la celda mientras todo el resto de la columna
       estaba centrado — pedido explícito del usuario: "el No aplica
       quedó desalineado, tendría que quedar centrado". data-col (ver
       components/table.js) identifica la columna sin importar el
       orden real de las <td>. */
    td[data-col^="curso_"], td[data-col="nivel"] { text-align: center; }

    /* min-height fija + el texto de abajo sin poder pasar a una
       segunda línea — pedido explícito del usuario: "los pills están
       todos desfasados, uno chico, otros más grandes". La celda tiene
       un badge de % arriba y un renglón de evaluación abajo ("✓ 8" /
       "Sin rendir"), y "Sin rendir" es bastante más largo que "✓ 8" —
       en una columna angosta eso lo hacía pasar a dos líneas, y esa
       fila quedaba más alta que las de al lado. Con nowrap la columna
       se ensancha lo que haga falta en vez de partir el texto, así
       todas las celdas de la misma fila miden lo mismo. */
    .celda-curso { display: flex; flex-direction: column; align-items: center; gap: 3px; min-height: 34px; justify-content: center; }
    .celda-curso .text-xs { white-space: nowrap; }

    .fila-avatar-nombre { display: flex; align-items: center; gap: 8px; }
    /* El avatar (foto o iniciales) es de la PANTALLA — pedido
       explícito del usuario: "eso solamente es para la plataforma,
       para la impresión da horrible". Sin fotos reales, cada fila
       mostraba un círculo con dos iniciales que no aportaba nada al
       papel; se saca del PDF, la app en vivo no se toca. */
    .publicacion-avatar { display: none; }

    /* Ancho fijo (no solo padding) — pedido explícito: los badges de
       % se veían de tamaños distintos porque "0%" y "100%" tienen
       distinto largo de texto. Con min-width todos miden lo mismo,
       centrados, sea cual sea la cantidad de dígitos. */
    .badge { display: inline-block; min-width: 40px; text-align: center; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 700; border: 1px solid currentColor; background: #fff; white-space: nowrap; }
    .badge-success { color: #1a7a3c; }
    .badge-warning { color: #a06a00; }
    .badge-danger { color: #b02a2a; }
    .badge-muted { color: #666; }

    /* Acotado a "#contenido-pdf button" y no a "button" a secas — ESTE
       era el bug real detrás de "no aparecen los botones de Convertir
       a PDF ni Descargar": un <button> a secas con !important también
       apagaba los DOS botones propios de este popup (viven afuera de
       #contenido-pdf, son hermanos — ver más abajo), y !important gana
       sin importar que #barra-acciones-popup button tenga más
       especificidad. No hacía falta ninguna extensión de por medio. */
    #contenido-pdf button, .fila-acciones, input[type="checkbox"], .mod-tooltip,
    .table-toolbar, .galeria-pills, .barra-enviar-mail { display: none !important; }

    /* Gestión semanal (pages/gestion.js) — bug real reportado en vivo:
       el PDF exportado salía como una sola pared de texto sin
       estructura, sin sucursal, sin decir si cada tarea estaba
       completa o no. Causa real: .tarea-gestion-header es un <button>
       (para que el título abra/cierre el desplegable en pantalla) —
       la regla de arriba, pensada para los botones de ACCIÓN de otras
       pantallas (Editar/Eliminar/Enviar mail), sin querer también
       apagaba el título entero de cada tarea acá. Esta selección es
       MÁS específica (id + clase vs. id + elemento) así que gana por
       sobre la de arriba sin tocarla. */
    #contenido-pdf .tarea-gestion-header { display: flex !important; }

    .tarea-gestion { border: 1px solid #e2d9c5; border-radius: 8px; padding: 10px 14px; margin-bottom: 8px; background: #fffdf8; page-break-inside: avoid; }
    .tarea-gestion-header { align-items: center; gap: 10px; width: 100%; background: none; border: none; padding: 0; text-align: left; font-family: inherit; }
    .tarea-gestion-ico, .tarea-gestion-chevron { display: none; }
    .tarea-gestion-txt { flex: 1; display: flex; flex-direction: column; }
    .tarea-gestion-txt strong { font-size: 13px; color: #111; }
    .tarea-gestion-txt span { font-size: 11px; color: #666; }
    .tarea-gestion-progreso, .badge-en-uso { display: none; }

    /* Estado — pedido explícito: "que diga tarea completa o no,
       quién y a qué hora". El span ya trae el texto real ("Hecho
       HH:MM · Nombre") cuando está completa — para "pendiente" no
       hay texto propio (en pantalla, el checkbox destildado ya lo
       dice solo), así que acá se agrega con ::before, sin tocar el
       texto que también usa la pantalla en vivo. */
    .tarea-gestion-hora { flex-shrink: 0; font-size: 11px; font-weight: 700; }
    .tarea-gestion.hecha .tarea-gestion-hora { color: #1a7a3c; }
    .tarea-gestion:not(.hecha) .tarea-gestion-hora::before { content: "Pendiente"; color: #b02a2a; }

    /* Sub-ítems: siempre expandidos en el PDF (en pantalla arrancan
       colapsados, .desplegada recién los muestra) — sin esto, un
       PDF armado sin haber abierto cada tarjeta a mano salía sin
       ninguno de los detalles. */
    .tarea-gestion-subitems { display: flex !important; flex-direction: column; margin-top: 8px; padding-top: 8px; border-top: 1px solid #e2d9c5; }
    .subitem-gestion { font-size: 11px; color: #333; padding: 3px 0; }
    .subitem-gestion:has(input:checked)::before { content: "✓ "; color: #1a7a3c; font-weight: 700; }
    .subitem-gestion:not(:has(input:checked))::before { content: "— "; color: #999; }

    .tarea-gestion-push, .tarea-gestion-acciones, .aviso-tareas-aplicables, .campo-selector-local, .aviso-solo-lectura,
    .acciones-gestion-semanal, .tabs-gestion { display: none !important; }
    .aviso-dia-vacio { font-size: 12px; color: #666; }

    /* Botones reales para pasar a PDF — pedido explícito del usuario:
       "quiero que se muestre para ver que todo está correcto y luego
       me dé opción de convertir a PDF", no que salte derecho al
       diálogo de impresión del navegador. Viven en la pestaña de
       vista previa, nunca en el PDF/papel final (ocultos acá mismo, no
       hace falta @media print aparte porque ya es una regla propia
       de este documento) — #barra-acciones-popup es hermano de
       #contenido-pdf (no ancestro), así que descargarAPdf() nunca lo
       captura sin necesidad de excluirlo a mano. */
    #barra-acciones-popup {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-bottom: 20px;
    }
    #barra-acciones-popup button {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border: none;
        border-radius: 8px;
        padding: 10px 18px;
        font-size: 14px;
        font-weight: 700;
        font-family: inherit;
        cursor: pointer;
    }
    #btn-imprimir-popup { background: #c2a065; color: #1a1712; }
    #btn-imprimir-popup:hover { background: #d9b876; }
    #btn-descargar-popup { background: #fff; color: #1a1712; border: 1px solid #c2a065 !important; }
    #btn-descargar-popup:hover { background: #f7f0e2; }
    #btn-descargar-popup:disabled { opacity: .5; cursor: wait; }

    @media print {
        #barra-acciones-popup { display: none !important; }
    }

    /* Horizontal por defecto — las tablas tienen 9+ columnas
       (Semáforo por módulo, Áreas a reforzar), en vertical quedaban
       muy apretadas/cortadas. */
    @page { margin: 1.2cm; size: landscape; }
`;

/** Membrete de marca — mismo bloque en cualquier PDF que se exporte
 *  de la app: quién es (Lucciano's Academy), qué reporte es, de
 *  cuándo, y opcionalmente el alcance activo (ej. una sucursal
 *  filtrada) — pedido explícito del usuario ("no tiene identidad, no
 *  dice Lucciano's y no hay argumento"). Se re-genera cada vez que el
 *  contenido se vuelve a armar (ver reportes.js actualizarSemaforo),
 *  no solo en el primer render, para no perderlo al cambiar un filtro. */
export function membreteHtml(titulo, alcance) {
    const fecha = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });
    return `
        <div class="membrete-impresion">
            <div class="membrete-marca">Lucciano's Academy</div>
            <div class="membrete-titulo">${titulo}</div>
            <div class="membrete-meta">${alcance ? `${alcance} · ` : ""}${fecha}</div>
        </div>
    `;
}

// CDN de html2pdf.js (html2canvas + jsPDF empaquetados) — mismo
// dominio ya permitido para Firebase, cero dependencias nuevas que
// instalar (el proyecto no usa bundler/npm). Se carga DENTRO de la
// pestaña de vista previa (no en index.html) para no sumarle este
// peso a los usuarios que nunca exportan un PDF.
const HTML2PDF_CDN = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";

/** Abre una pestaña nueva con el contenido de "elementId", lista para
 *  imprimir/guardar como PDF — sin arrastrar el sidebar/tema oscuro
 *  de la app.
 *
 *  Antes armaba la pestaña con window.open("", "_blank") +
 *  document.write() desde ACÁ, y recién después le enganchaba los
 *  botones metiéndose en su document. Bug real reportado: en el
 *  navegador del usuario la pestaña abría con el contenido bien, pero
 *  sin los dos botones (Convertir a PDF / Descargar) — document.write
 *  inyectando HTML en un about:blank es exactamente el patrón que
 *  varios bloqueadores de contenido/extensiones de seguridad tratan
 *  con desconfianza (es el mismo mecanismo que usan popups de ads), y
 *  puede terminar con partes del DOM recién escrito removidas.
 *
 *  Ahora la pestaña es un documento HTML real y AUTOSUFICIENTE: se arma
 *  como Blob, se le da una URL propia (URL.createObjectURL) y la
 *  pestaña navega ahí de verdad — no queda nada que el navegador de
 *  origen tenga que "inyectar" después. Los botones se enganchan con
 *  un <script> DENTRO del propio HTML, que corre solo cuando esa
 *  página carga, sin depender de que este script vuelva a tocar su
 *  document más tarde. */
// A partir de cuántas filas "Descargar PDF" deja de ofrecerse — pedido
// explícito del usuario: eligió TODOS los locales, tocó Descargar, y la
// pestaña se quedó pensando sin terminar nunca. html2canvas (lo que usa
// html2pdf por dentro) redibuja cada fila pixel por pixel a un único
// canvas gigante — con cientos de filas (todos los locales de la red,
// cada uno con su equipo) eso no es "lento", es prácticamente inviable:
// el navegador puede tardar minutos o directamente colgarse, y Chrome
// tiene además un límite de alto de canvas (~16000px) que un reporte
// así de largo puede pasar de largo sin avisar. "Convertir a PDF /
// Imprimir" no tiene ese problema — es el motor de impresión nativo del
// navegador, pagina solo y no arma ninguna imagen gigante — así que para
// contenido grande es la única opción ofrecida, con el motivo explicado.
const LIMITE_FILAS_DESCARGA = 120;

/**
 * "soloDescarga": pedido explícito del usuario — en pantallas donde el
 * reporte NUNCA puede ser grande (Gestión semanal: un local, una
 * semana, nunca se acerca a LIMITE_FILAS_DESCARGA) el botón "Convertir
 * a PDF / Imprimir" es ruido puro al lado de "Descargar PDF" (que ya
 * guarda con el nombre correcto). Con esto en true se oculta ese
 * botón — salvo que el contenido resulte igual demasiado grande, caso
 * en el que hace falta igual como único camino posible. Reportes/Mi
 * equipo (donde sí puede haber cientos de filas) no lo pasan, así que
 * siguen mostrando los dos como siempre. */
export function exportarAPdf(elementId, titulo, { soloDescarga = false } = {}) {
    const origen = document.getElementById(elementId);
    if (!origen) return;

    const nombreArchivo = titulo.replace(/[^\w\sáéíóúñÁÉÍÓÚÑ-]/g, "").trim() + ".pdf";
    const filas = origen.querySelectorAll("tbody tr").length;
    const demasiadoGrande = filas > LIMITE_FILAS_DESCARGA;
    const ocultarImprimir = soloDescarga && !demasiadoGrande;

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="color-scheme" content="light">
<title>${titulo}</title>
<style>${ESTILOS_IMPRESION}</style>
</head>
<body>
<div id="barra-acciones-popup">
    ${ocultarImprimir ? "" : `<button id="btn-imprimir-popup">🖨 Convertir a PDF / Imprimir</button>`}
    ${demasiadoGrande
        ? `<button id="btn-descargar-popup" disabled title="Este reporte tiene ${filas} filas — muy grande para armar de una sola vez. Usá &quot;Convertir a PDF / Imprimir&quot; y elegí &quot;Guardar como PDF&quot;, soporta cualquier tamaño.">⬇ Descargar PDF (reporte muy grande — usá Imprimir)</button>`
        : `<button id="btn-descargar-popup" disabled>⬇ Cargando descarga...</button>`}
</div>
<div id="contenido-pdf">${origen.innerHTML}</div>
${demasiadoGrande ? "" : `<script src="${HTML2PDF_CDN}"><\/script>`}
<script>
document.getElementById("btn-imprimir-popup")?.addEventListener("click", () => window.print());

const btnDescargar = document.getElementById("btn-descargar-popup");
${demasiadoGrande ? "" : `
function habilitarDescarga() {
    btnDescargar.disabled = false;
    btnDescargar.textContent = "⬇ Descargar PDF";
}
if (window.html2pdf) {
    habilitarDescarga();
} else {
    document.querySelector('script[src="${HTML2PDF_CDN}"]').addEventListener("load", habilitarDescarga);
}

btnDescargar.addEventListener("click", () => {
    btnDescargar.disabled = true;
    btnDescargar.textContent = "⬇ Generando...";
    // Reportado en vivo: "Generando..." se queda pegado para siempre
    // con contenido chico, no solo con reportes enormes — la causa más
    // probable es una foto de perfil externa (Drive/Google) que
    // html2canvas intenta cargar y nunca termina de resolver (ni
    // success ni error), así que ni .then() ni .catch() llegan a
    // correr nunca. useCORS ayuda con eso, pero la garantía real es
    // el timeout de acá abajo: pase lo que pase adentro, a los 25s se
    // desbloquea el botón y avisa, en vez de quedar pegado para
    // siempre sin ninguna explicación.
    const conTimeout = Promise.race([
        window.html2pdf()
            .from(document.getElementById("contenido-pdf"))
            .set({
                margin: 10,
                filename: ${JSON.stringify(nombreArchivo)},
                image: { type: "jpeg", quality: 0.95 },
                html2canvas: { scale: 2, backgroundColor: "#ffffff", useCORS: true },
                jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
            })
            .save(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 25000)),
    ]);
    conTimeout
        .then(() => {
            habilitarDescarga();
            // Pedido explícito del usuario: descargó y no tenía forma de
            // saber si había funcionado ni dónde había ido a parar — el
            // navegador no siempre muestra su propio aviso de descarga
            // de forma visible. Uno propio, con el nombre exacto del
            // archivo, así sabe qué buscar en su carpeta de Descargas.
            alert('Se descargó como "' + ${JSON.stringify(nombreArchivo)} + '" en la carpeta de Descargas de tu navegador.');
        })
        .catch((err) => {
            console.warn("No se pudo generar la descarga directa:", err.message);
            alert('No se pudo generar la descarga directa — probá con "Convertir a PDF / Imprimir" y elegí "Guardar como PDF".');
            habilitarDescarga();
        });
});
`}
<\/script>
</body>
</html>`;

    const blobUrl = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    const ventana = window.open(blobUrl, "_blank");
    if (!ventana) {
        URL.revokeObjectURL(blobUrl);
        alert("El navegador bloqueó la ventana de impresión — permití pop-ups para este sitio e intentá de nuevo.");
        return;
    }
    // La URL del Blob solo hace falta mientras esa pestaña carga el
    // documento — una vez cargado, el contenido ya vive en su memoria.
    // Liberarla antes rompería una recarga manual de esa pestaña, así
    // que se espera a que termine de cargar.
    ventana.addEventListener("load", () => URL.revokeObjectURL(blobUrl), { once: true });
}
