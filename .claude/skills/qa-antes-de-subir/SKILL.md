---
name: qa-antes-de-subir
description: Checklist de verificación real (navegador, modo mock) antes de pushear un cambio grande a REPO — no alcanza con que el código "se vea bien". Usar cuando se termina una tanda de fixes/features en Gestión de tareas, News o Academia, o cuando el usuario pide "probar todo"/"hacer QA" antes de subir.
---

# QA antes de subir

## Origen

2026-09-02. El usuario compartió un documento genérico de "Sistema de
QA automático" (Codex + Playwright MCP + 5 skills — qa-audit,
qa-exploration, qa-visual, qa-regression, qa-report — con 14 fases y
formato de bug tracker) y pidió feedback antes de armar algo así.

El feedback fue: la idea del loop (probar → detectar → corregir →
volver a probar) es correcta, pero el documento tenía 3 problemas
puntuales para ESTE proyecto:

1. Asume Codex — el trabajo real es con Claude Code, que ya cubre lo
   necesario (Browser pane: navegar, clickear, leer consola/red,
   redimensionar, screenshot) sin sumar Playwright MCP aparte.
2. "QA destructivo" (requests fallidos, conexión lenta, sesión
   expirada) corriendo contra Apps Script REAL gasta cuota de Google y
   puede escribir basura de prueba en la Sheet real — tiene que ser
   siempre en modo mock (`USE_MOCK_DATA`).
3. 5 skills + bug tracker formal + matriz de 4 roles × 10 pantallas es
   proceso de equipo con QA dedicado — en un proyecto de una persona +
   IA sin CI, gran parte de eso se vuelve papelería que nadie corre
   (mismo patrón que el syncManager que "nunca funcionó", ver
   [[project_faro_indexeddb_sync_complete]]).

El punto más importante: los bugs más difíciles de la sesión del
2026-09-02 (el "Mensual" que no se guardaba en Gestión de tareas, el
bug de scope que rompió el lightbox de fotos en Academia) NO los
agarra un bot que clickea todo y mira la consola — necesitaban
esperar el ciclo de refresco de 5s y comparar el estado ANTES y
DESPUÉS de ese refresco. Eso es lo que este checklist puntualiza y
que un QA genérico no menciona.

## La regla

Antes de pushear a REPO una tanda de cambios en Gestión de tareas,
News o Academia (los tres módulos con refresco en segundo plano y
guardado optimista), correr en modo mock los flujos de la lista de
abajo — en el navegador real, no leyendo el código — y en cada uno
verificar DOS momentos, no uno solo:

1. **El instante después de la acción** (¿se ve el cambio al toque?).
2. **Después de esperar un ciclo completo del refresco de fondo**
   (5s en Gestión/News/Academia) — este es el momento que se saltea
   si solo se mira la pantalla una vez y se da por bueno. Los dos
   bugs reales de guardado silencioso de esta sesión (frecuencia
   "Mensual" sin persistir, y antes, `limpiarMarcasFuturasGestion`
   con ciclo vacío) solo se notaban en este segundo momento.

Si algo pasa la verificación en el instante 1 pero falla en el
instante 2: es un bug de persistencia, no de UI — buscar en la capa
de datos (`js/data/*.js`, `apps-script/Code.gs`), no en el render.

## Los flujos que importan (no los 14 genéricos)

Estos son los que rompieron de verdad en producción/staging esta
sesión — no hace falta más que esto para la mayoría de las tandas:

- **Gestión de tareas → Asignar tareas**: crear o editar una tarea,
  cambiar Semanal↔Mensual, marcar/desmarcar días. Verificar que el
  badge "En uso"/"Sin usar" y el resumen de días cambian AL TOQUE
  (sin parpadeo de la tarjeta entera) y que siguen igual después de
  esperar 5s+.
- **Gestión de tareas → Tareas asignadas**: marcar un check/sub-ítem,
  "Guardar", esperar el refresco y confirmar que no se revirtió.
  Probar también el candado de borrar (Admin) y que la tarjeta queda
  editable de nuevo, no trabada.
- **News**: marcar como leída por swipe Y por el modal de detalle —
  confirmar que sale de "No leídas", el contador del tab baja, y que
  NO se dispara una recarga completa de la lista (mirar Network: no
  debería haber un pedido nuevo a Apps Script justo después).
- **Academia**: marcar una lección "vista" — la siguiente se
  desbloquea, el % avanza, y el botón de la lección nueva responde al
  toque (no solo el de la primera). Abrir el carrusel/lightbox de
  fotos de una lección con imágenes y confirmar que ABRE — este es
  justo el tipo de bug (ReferenceError silencioso por alcance de
  variables) que pasa con cualquier refactor de estas páginas.
- **Login por rol**: Admin no puede marcar días/tildar checks
  (solo lectura); Responsable de local (colaborador con
  `encargado:true`, ver mock de Usuarios) sí puede.

## Qué NO hacer

- No correr nada "destructivo" (timeouts, sesión vencida, requests
  fallidos) contra el Apps Script real de STAGING — armar el
  escenario en modo mock (inyectar en el array mock vía
  `dynamic import()`, como se hizo esta sesión para probar el
  candado y el refresco de catálogo) o no probarlo.
- No crear un sistema de 5 skills ni un formato de bug tracker
  aparte — un párrafo de "encontré esto, esperable esto, pasó esto"
  en el chat alcanza; si el bug es real se arregla ahí mismo.
- No declarar algo "probado" solo porque el código se lee bien o
  porque un único click funcionó — ver [[feedback_no_declarar_exito_prematuro]]
  y [[feedback_testear_a_fondo_antes_reportar]], ya vigentes para
  este proyecto.

## Cuándo aplica

Al terminar una tanda de cambios en Gestión de tareas, News o
Academia antes de pushear a REPO, o cuando el usuario pide
explícitamente probar/hacer QA. No hace falta para cambios chicos y
aislados (un texto, un color) sin lógica de guardado/refresco de por
medio.
