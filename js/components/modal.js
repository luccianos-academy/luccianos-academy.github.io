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

    if (onConfirm) {
        overlay.querySelector(`[data-confirm="${id}"]`).addEventListener("click", onConfirm);
    }
}

export function cerrarModal(id) {
    const overlay = document.getElementById(id);
    if (overlay) overlay.remove();
}
