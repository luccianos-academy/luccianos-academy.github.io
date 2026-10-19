/* ============================
   Lucciano's Academy (app Firebase)
   services/almacenListas.js — Copia de las listas grandes en el dispositivo (IndexedDB)

   Para Admin y Supervisor: usuarios, asignaciones y resultados son miles de documentos. En vez de bajarlos
   enteros cada vez que se abre la app, se guardan acá y firestoreSource.js pide solo lo que cambió desde la última
   lectura (ver "lecturas incrementales" ahí). Si IndexedDB no está disponible (modo privado, pruebas en Node)
   devuelve null y todo sigue funcionando como siempre, leyendo completo.
=============================*/

export function crearAlmacenIDB(nombre = "faro-listas") {
    if (typeof indexedDB === "undefined") return null;
    let abierta = null;
    const abrir = () => abierta || (abierta = new Promise((resolver, rechazar) => {
        const pedido = indexedDB.open(nombre, 1);
        pedido.onupgradeneeded = () => pedido.result.createObjectStore("listas");
        pedido.onsuccess = () => resolver(pedido.result);
        pedido.onerror = () => rechazar(pedido.error);
    }));
    const operar = async (modo, fn) => {
        const db = await abrir();
        return new Promise((resolver, rechazar) => {
            const t = db.transaction("listas", modo);
            const pedido = fn(t.objectStore("listas"));
            t.oncomplete = () => resolver(pedido ? pedido.result : undefined);
            t.onerror = () => rechazar(t.error);
            t.onabort = () => rechazar(t.error);
        });
    };
    // Cualquier falla se traga a propósito: sin copia local se lee completo, que es lo correcto.
    return {
        leer: (clave) => operar("readonly", (s) => s.get(clave)).catch(() => null),
        guardar: (clave, valor) => operar("readwrite", (s) => s.put(valor, clave)).catch(() => {}),
        borrar: (clave) => operar("readwrite", (s) => s.delete(clave)).catch(() => {}),
    };
}
