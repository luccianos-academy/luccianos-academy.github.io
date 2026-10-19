/* ============================
   Lucciano's Academy (app Firebase)
   services/medidorLecturas.js — Cuenta las lecturas de Firestore, pantalla por pantalla

   Solo de diagnóstico. Se enciende abriendo la app con `?medir=1` al final de la dirección (o con
   localStorage.faro_medir = "1") y muestra un cuadrito abajo a la izquierda: total de lecturas de la sesión y
   cuánto gastó cada pantalla (#/gestion, #/inicio, ...). Sirve para saber qué pantalla es cara con números reales
   y no a ojo. Cuenta documentos que llegan DEL SERVIDOR (lo que viene de la caché del equipo no gasta cupo).
   Es un piso: Firestore suma además ~1 lectura por consulta por las reglas de seguridad, que acá no se ven.
=============================*/

export function medicionActiva() {
    try {
        return /[?&]medir=1(&|$)/.test(location.search) || localStorage.getItem("faro_medir") === "1";
    } catch (err) { return false; }
}

export function medirLecturas(sdk) {
    const total = { n: 0 };
    const porRuta = {};
    let caja = null;

    function pintar() {
        if (typeof document === "undefined" || !document.body) return;
        if (!caja) {
            caja = document.createElement("div");
            caja.id = "medidor-lecturas";
            caja.style.cssText = "position:fixed;left:8px;bottom:8px;z-index:2147483647;max-width:300px;padding:8px 10px;border-radius:10px;" +
                "background:rgba(0,0,0,.88);color:#fff;font:12px/1.35 ui-monospace,Menlo,monospace;pointer-events:none;white-space:pre";
            document.body.appendChild(caja);
        }
        const filas = Object.entries(porRuta).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([r, n]) => `${String(n).padStart(6)}  ${r || "#/"}`);
        caja.textContent = `LECTURAS DE ESTA SESIÓN: ${total.n}\n${filas.join("\n")}`;
    }
    function sumar(n) {
        if (!n) return;
        const ruta = (location.hash || "#/").split("?")[0];
        total.n += n;
        porRuta[ruta] = (porRuta[ruta] || 0) + n;
        console.info(`[lecturas] +${n} en ${ruta} (total ${total.n})`);
        pintar();
    }

    return {
        ...sdk,
        getDocs: async (...a) => { const r = await sdk.getDocs(...a); if (!r.metadata.fromCache) sumar(Math.max(1, r.size)); return r; },
        getDoc: async (...a) => { const r = await sdk.getDoc(...a); if (!r.metadata.fromCache) sumar(1); return r; },
        onSnapshot: (q, ok, err) => sdk.onSnapshot(q, (snap) => { if (!snap.metadata.fromCache) sumar(snap.docChanges().length); ok(snap); }, err),
    };
}
