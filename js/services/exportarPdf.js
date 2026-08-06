/* ============================
   FARO v4
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
    /* Fondo BLANCO explícito — sin esto, la pestaña hereda el modo
       oscuro del sistema/navegador (color-scheme del meta tag de
       abajo ayuda, pero un fondo explícito no depende de que ningún
       navegador lo respete) y el texto oscuro queda invisible sobre
       fondo oscuro. Bug real encontrado por el usuario probando. */
    html { background: #fff; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111; background: #fff; padding: 28px; margin: 0; }

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

    .cards { display: flex; flex-wrap: wrap; gap: 12px; margin: 14px 0; }
    .card, .kpi-card { background: #fff; border: 1px solid #ccc; border-radius: 8px; padding: 12px 16px; flex: 1 1 150px; page-break-inside: avoid; }
    .kpi-card h3 { font-size: 11px; text-transform: uppercase; color: #666; margin: 0 0 6px; letter-spacing: .5px; }
    .kpi-card span { font-size: 22px; font-weight: 700; }
    .kpi-icon { display: none; }

    .table-wrapper { overflow: visible; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0 20px; font-size: 11px; page-break-inside: auto; background: #fff; }
    tr { page-break-inside: avoid; }
    th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; vertical-align: top; background: #fff; }
    th { background: #f2f2f2; text-transform: uppercase; font-size: 9px; color: #333; letter-spacing: .3px; }

    .celda-curso { display: flex; flex-direction: column; gap: 3px; }

    /* Esta ventana no carga css/components.css — sin esto, la foto de
       perfil (que en la app toma su tamaño de .publicacion-avatar) no
       tiene NINGÚN límite acá y se ve a tamaño natural completo (bug
       real encontrado por el usuario exportando el Semáforo). */
    .fila-avatar-nombre { display: flex; align-items: center; gap: 8px; }
    .publicacion-avatar { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }

    .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 700; border: 1px solid currentColor; background: #fff; white-space: nowrap; }
    .badge-success { color: #1a7a3c; }
    .badge-warning { color: #a06a00; }
    .badge-danger { color: #b02a2a; }
    .badge-muted { color: #666; }

    button, .fila-acciones, input[type="checkbox"], .mod-tooltip,
    .table-toolbar, .galeria-pills, .barra-enviar-mail { display: none !important; }

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
 *  de la app. */
export function exportarAPdf(elementId, titulo) {
    const origen = document.getElementById(elementId);
    if (!origen) return;

    const ventana = window.open("", "_blank");
    if (!ventana) {
        alert("El navegador bloqueó la ventana de impresión — permití pop-ups para este sitio e intentá de nuevo.");
        return;
    }

    ventana.document.write(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="color-scheme" content="light">
            <title>${titulo}</title>
            <style>${ESTILOS_IMPRESION}</style>
        </head>
        <body>
            <div id="barra-acciones-popup">
                <button id="btn-imprimir-popup">🖨 Convertir a PDF / Imprimir</button>
                <button id="btn-descargar-popup" disabled>⬇ Cargando descarga...</button>
            </div>
            <div id="contenido-pdf">${origen.innerHTML}</div>
            <script src="${HTML2PDF_CDN}"><\/script>
        </body>
        </html>
    `);
    ventana.document.close();

    // A propósito NO se llama a print() solo — el usuario pidió ver
    // la vista previa primero ("para ver que todo está correcto") y
    // recién ahí decidir imprimir, en vez de saltar directo al
    // diálogo del navegador.
    ventana.focus();
    ventana.document.getElementById("btn-imprimir-popup")?.addEventListener("click", () => ventana.print());

    const btnDescargar = ventana.document.getElementById("btn-descargar-popup");
    const habilitarDescarga = () => {
        btnDescargar.disabled = false;
        btnDescargar.textContent = "⬇ Descargar PDF";
    };
    // El script puede tardar en cargar (CDN externo) — si ya estaba en
    // cache del navegador puede haber "cargado" antes de que este
    // listener se registre, por eso el chequeo directo de respaldo.
    if (ventana.html2pdf) {
        habilitarDescarga();
    } else {
        ventana.document.querySelector(`script[src="${HTML2PDF_CDN}"]`).addEventListener("load", habilitarDescarga);
    }

    btnDescargar.addEventListener("click", () => {
        btnDescargar.disabled = true;
        btnDescargar.textContent = "⬇ Generando...";
        const nombreArchivo = titulo.replace(/[^\w\sáéíóúñÁÉÍÓÚÑ-]/g, "").trim() + ".pdf";
        ventana.html2pdf()
            .from(ventana.document.getElementById("contenido-pdf"))
            .set({
                margin: 10,
                filename: nombreArchivo,
                image: { type: "jpeg", quality: 0.95 },
                html2canvas: { scale: 2, backgroundColor: "#ffffff" },
                jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
            })
            .save()
            .then(habilitarDescarga)
            .catch((err) => {
                console.warn("No se pudo generar la descarga directa:", err.message);
                alert("No se pudo generar la descarga directa — probá con \"Convertir a PDF / Imprimir\" y elegí \"Guardar como PDF\".");
                habilitarDescarga();
            });
    });
}
