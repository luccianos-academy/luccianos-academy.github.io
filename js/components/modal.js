/* ============================
   FARO v4
   modal.js — Componente Modal

   Genera el HTML de un modal; no se auto-inserta. La página que lo
   usa decide cuándo montarlo (abrirModal) y limpia con cerrarModal.
=============================*/

export function Modal({ id, titulo, contenidoHtml, textoConfirmar = "Guardar" }) {
    return `
        <div class="modal-overlay" id="${id}">
            <div class="modal">

                <div class="modal-header">
                    <h2>${titulo}</h2>
                    <button class="modal-close" data-close="${id}">✕</button>
                </div>

                <div class="modal-body">
                    ${contenidoHtml}
                </div>

                <div class="modal-footer">
                    <button class="btn btn-secondary" data-close="${id}">Cancelar</button>
                    <button class="btn btn-primary" data-confirm="${id}">${textoConfirmar}</button>
                </div>

            </div>
        </div>
    `;
}

/** Inserta el modal en el body y conecta los listeners de cierre. */
export function abrirModal(modalHtml, id, onConfirm) {

    document.body.insertAdjacentHTML("beforeend", modalHtml);

    const overlay = document.getElementById(id);

    overlay.querySelectorAll(`[data-close="${id}"]`).forEach((el) => {
        el.addEventListener("click", () => cerrarModal(id));
    });

    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) cerrarModal(id);
    });

    // Sin esto, un guardado que tarda unos segundos (red real contra
    // Apps Script) parece "no hacer nada" — la persona vuelve a
    // tocar "Guardar"/"Enviar" y el onConfirm corre DE NUEVO antes de
    // que termine el primero, duplicando lo que sea que haga (crear
    // la misma noticia/publicación/curso dos veces, mandar el push
    // dos veces, etc.). El botón se deshabilita apenas se toca y
    // muestra "Guardando..." hasta que el onConfirm termina. Si el
    // propio onConfirm hace un "return" temprano por validación (sin
    // cerrar el modal, ver ej. news.js) el botón se reactiva solo,
    // así la persona puede corregir y reintentar.
    if (onConfirm) {
        const btnConfirmar = overlay.querySelector(`[data-confirm="${id}"]`);
        const textoOriginal = btnConfirmar.textContent;
        btnConfirmar.addEventListener("click", async () => {
            if (btnConfirmar.disabled) return;
            btnConfirmar.disabled = true;
            btnConfirmar.textContent = "Guardando...";
            try {
                await onConfirm();
            } finally {
                // Si onConfirm cerró el modal (caso normal), el botón ya no
                // está en el DOM — esto es un no-op inofensivo.
                if (document.body.contains(btnConfirmar)) {
                    btnConfirmar.disabled = false;
                    btnConfirmar.textContent = textoOriginal;
                }
            }
        });
    }
}

export function cerrarModal(id) {
    const overlay = document.getElementById(id);
    if (overlay) overlay.remove();
}
