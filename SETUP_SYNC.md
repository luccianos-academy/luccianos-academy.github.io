# Setup: IndexedDB + Sync (Guía de Configuración)

## Resumen
Se implementó arquitectura offline-first con IndexedDB local + sincronización inteligente a Apps Script.

---

## Paso 1: Ejecutar Setup en Apps Script

1. **Abre el Sheet** → Extensiones → Apps Script
2. **Abre `Setup.gs`**
3. **Selector de funciones: selecciona `setupSyncColumns`**
4. **Haz clic en ▶️ (Run)**

Esto agrega automáticamente la columna `fechaModificacion` a todas las hojas.

---

## Paso 2: Verificar en Google Sheets

- Abre cada pestaña
- Verifica que aparezca `fechaModificacion` al final
- Debe tener timestamps como `2026-08-03 15:23:45`

---

## Paso 3: Testing en Branch Deploy

🔗 **Preview**: https://feature-indexeddb-sync--luccianos-academy.netlify.app

**Verificar:**
- [ ] Primera carga: IndexedDB se inicializa
- [ ] Segunda carga: abre al instante
- [ ] Offline: crea datos locales
- [ ] Reconectar: sincroniza automáticamente

**Debug en consola:**
```js
window.lucciano.debug.getSyncStatus()  // status actual
window.lucciano.debug.forceSyncNow()   // sync manual
```

---

## Paso 4: Merge a Producción

```bash
git checkout main
git merge feature/indexeddb-sync
git push origin main
```

---

## Arquitectura

```
User crea noticia
    ↓
Guardada en IndexedDB (instant)
    ↓
Background: syncManager sube a Sheet
    ↓
Otros dispositivos: next sync trae cambios
```

Archivos modificados: `js/services/indexeddb.js`, `syncManager.js`, `dataSource.js`, `app.js`, `Code.gs`, `Setup.gs`
