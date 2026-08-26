# Conectar Lucciano's Academy a un Google Sheet real

Esta carpeta no es parte de la app cliente (esa sigue siendo todo lo que
está en `js/`, `css/`, etc.) — son los dos archivos que hay
que copiar a un proyecto de **Google Apps Script**, más los pasos para
dejarlo anduviendo. Nada de esto se puede hacer desde acá (Claude Code no
tiene acceso a tu cuenta de Google) — son pasos manuales en
`sheets.google.com` y `script.google.com`.

## 1. Crear la planilla y las 9 hojas

1. Andá a [sheets.google.com](https://sheets.google.com) y creá una planilla nueva. Nombrala como quieras (ej. "Lucciano's Academy — Base de datos").
2. Creá 9 hojas (pestañas) con **estos nombres exactos** (mayúsculas incluidas) y, en la fila 1 de cada una, estos encabezados exactos, en este orden:

| Hoja | Encabezados (fila 1) |
|---|---|
| `Usuarios` | `id`, `nombre`, `email`, `rol`, `encargado`, `sucursal`, `activo`, `fechaVencimientoAcceso`, `fechaAlta`, `capacitador` |
| `Sucursales` | `id`, `nombre`, `supervisor`, `estado` |
| `Cursos` | `id`, `nombre`, `categoria`, `obligatorio`, `orden` |
| `Lecciones` | `id`, `cursoId`, `orden`, `titulo`, `objetivo`, `duracionMinutos`, `video`, `manual`, `imagen`, `procedimiento`, `errores`, `buenasPracticas`, `consejo`, `resumen`, `estado` |
| `Evaluaciones` | `id`, `cursoId`, `pregunta`, `opcion1`, `opcion2`, `opcion3`, `correcta`, `puntaje` |
| `Asignaciones` | `id`, `colaboradorId`, `cursoId`, `fechaAlta`, `fechaVencimiento`, `estado`, `progreso` |
| `Resultados` | `id`, `colaboradorId`, `cursoId`, `nota`, `aprobado`, `fechaFinalizacion` |
| `Auditoria` | `id`, `fecha`, `usuarioId`, `accion`, `detalle` |
| `Noticias` | `id`, `titulo`, `fecha`, `resumen` |

`correcta` en `Evaluaciones` es un número **1, 2 o 3** — indica cuál de las tres columnas de opción es la respuesta correcta (no un índice desde 0). Este esquema plano existe justamente para poder cargar/editar preguntas directo en la planilla, sin tocar JSON a mano.

`fechaVencimientoAcceso` en `Usuarios` es una fecha `YYYY-MM-DD` o **vacío**. Vacío significa acceso permanente (sin vencimiento) — así quedan todos los usuarios existentes al agregar esta columna. Cuando un Supervisor registra un colaborador nuevo desde "Colaboradores", la app carga automáticamente hoy + 30 días acá. Si tu planilla ya está en uso y no tenía esta columna, agregala igual que las demás (nombre exacto, sin datos en las filas existentes).

`fechaAlta` en `Usuarios` (no confundir con la homónima de `Asignaciones`) es la fecha real de alta del usuario — se completa sola cuando se crea desde la app (`+ Nuevo usuario` o `+ Registrar colaborador`). Si tu planilla ya está en uso, corré `agregarColumnaFechaAlta()` desde el editor de Apps Script una sola vez para agregarla sin tocar las filas existentes (quedan con la celda vacía — la app cae a un estimado honesto solo para esos usuarios viejos).

`Noticias` es lo que ve el Colaborador en el sidebar (con destello "NEW" si hay alguna con `fecha` dentro de los últimos/próximos 14 días) y en `#/noticias` — el Admin puede crear/editar/eliminar noticias directo desde esa misma pantalla, sin tocar la planilla a mano.

`capacitador` en `Usuarios` es `SI` o **vacío/NO** — solo tiene efecto si `rol` es `supervisor`. Es igual que `encargado` pero para un Supervisor: mismo rol, mismos permisos exactos, es solo una etiqueta ("Supervisor (Capacitador)") para diferenciar en la interfaz a alguien que capacita en varios locales de "el" supervisor de un local puntual, sin crear un rol nuevo. Se carga desde **Usuarios → + Nuevo usuario** (Administrador), tildando "Es capacitador".

No hace falta cargar filas de datos a mano — el paso 3 las completa solo.

### ⚠️ La tabla de arriba es el esquema ORIGINAL, no el actual

El modelo creció (`foto`, `historiaVista`, `fijadoPor`, `fechaModificacion`,
y las hojas `Manuales`, `Canales`, `Publicaciones`, `Comentarios`,
`Recursos`, `Tokens`). Mantener esa tabla sincronizada a mano nunca
funcionó, así que **no la trates como fuente de verdad** — la fuente real
es lo que el código pide.

#### `GestionTareas` (Fase 1 de "Responsables de Local y Turno", #/gestion)

Hoja nueva, no está en la tabla original. Encabezados exactos, en este orden:

| `id` | `icono` | `titulo` | `detalle` | `dias` | `subitems` | `aplicaA` | `noAplicaA` | `fechaModificacion` |
|---|---|---|---|---|---|---|---|---|

`dias` y `subitems` van separados por coma en una sola celda (ej. `Lunes,Viernes` o `Abatidor,Armario,Vitrina`) — mismo criterio ya usado en `aplicaA`/`noAplicaA` de `Cursos`, no un esquema nuevo. `subitems` puede quedar vacío (no todas las tareas tienen sub-ítems). `fechaModificacion` es obligatoria como en cualquier hoja que se escribe desde la app (ver más abajo) — sin ella, `_actualizarCrudo` rechaza la escritura.

`aplicaA`/`noAplicaA` (agregadas 2026-08-26): país/propio-franquicia/local puntual a quien le corresponde la tarea — MISMO campo y semántica que `Cursos`/`Lecciones` (vacío = aplica a TODOS, la exclusión gana), ver `services/alcance.js` → `aplicaASucursal`. Suman dos tokens que Cursos/Lecciones no usan: `Propios`/`Franquicias`, contra `Sucursales.esPropio`. **Sin estas 2 columnas en la Sheet, `_actualizarCrudo` devuelve `{ok:false, error:'Faltan columnas...'}` al editar CUALQUIER tarea** (el cliente siempre manda los dos campos, aunque no se toquen) — agregarlas es paso obligatorio antes de probar este cambio, no opcional.

Esto importa por cómo escribe el backend: `_actualizarCrudo` busca cada
campo por **nombre exacto de encabezado**. Si la columna no existe, la
escritura de ESE campo no tiene dónde ir. Antes se salteaba en silencio
—la app decía "guardado" y la planilla no cambiaba— y ese único detalle
explicó cuatro bugs distintos ("no renueva", "no deshabilita", "la foto
no aparece", "el fijado no queda"). Hoy `_actualizarCrudo` devuelve
`{ok:false, error:'Faltan columnas en "X": ...'}` y la app lo muestra:
**si ves ese mensaje, agregá esa columna y listo**, no busques el bug en
el código.

#### `GestionTareasSucursal` (Fase 2 de "Responsables de Local y Turno", #/gestion)

Hoja nueva, no está en la tabla original. Encabezados exactos, en este orden:

| `id` | `tareaId` | `sucursal` | `dias` | `fechaModificacion` |
|---|---|---|---|---|

Separa el catálogo de tareas (`GestionTareas` — QUÉ tareas existen, solo lo edita Admin) de en qué días le aplica cada una a CADA local — antes ese `dias` vivía en la propia fila de `GestionTareas`, compartido por toda la red (bug real de diseño: el Responsable de un local cambiaba el esquema de TODOS los locales sin darse cuenta). Una fila acá = una combinación tarea+sucursal con al menos un día elegido; si un local nunca tocó una tarea, no hay fila (no hace falta poblar todo el catálogo × todos los locales de antemano). `sucursal` tiene que matchear EXACTO el nombre real de la sucursal (mismo criterio que el resto de la app — ver la trampa del apóstrofo tipográfico en la memoria del proyecto). Escrita solo por `actualizarDiasGestionSucursal` (Code.gs) — nunca por `actualizar` genérico — que fuerza `sucursal` desde `usuarioActual.sucursal` en el servidor, ignorando cualquier valor que mande el cliente.

#### `GestionChecks` (check "hecho" persistido, #/gestion)

Hoja nueva, no está en la tabla original. Encabezados exactos, en este orden:

| `id` | `tareaId` | `sucursal` | `dia` | `hecho` | `marcadoPor` | `hora` | `fechaModificacion` |
|---|---|---|---|---|---|---|---|

Antes el tilde de "hecho" era puramente visual — vivía en el navegador de quien lo tocaba, se perdía al recargar, y dos personas viendo el mismo local en dispositivos distintos no se veían entre sí (bug real reportado en vivo: "quien dio el marcado no le aparece al otro"). Una fila acá = una tarea marcada como hecha en un día puntual, para una sucursal puntual; desmarcar BORRA la fila (sin fila = no hecho), mismo criterio que `GestionTareasSucursal`. Guarda el estado GLOBAL de la tarea, no el detalle de cada sub-ítem — una tarea con sub-ítems se persiste completa/incompleta en conjunto, no ítem por ítem. Escrita solo por `actualizarCheckGestion` (Code.gs), mismo criterio de seguridad que `actualizarDiasGestionSucursal` (la sucursal la decide el servidor).

#### `fechaModificacion` — obligatoria en las 8 hojas sincronizadas

`Usuarios`, `Cursos`, `Lecciones`, `Noticias`, `Comunicaciones`,
`Asignaciones`, `Resultados`, `Manuales`.

Toda escritura la incluye (la agrega `updateSheet` en
`js/services/dataSource.js`), así que una hoja sin esa columna rechaza
**todas** sus actualizaciones, no solo las de sync.

Para agregarla en las 8 de una: pegá `Setup.gs` en el proyecto de Apps
Script y ejecutá `setupSyncColumns()` una vez. Saltea las hojas que ya
la tienen y rellena las filas existentes. Solo toca la planilla — no
hace falta redesplegar. Si preferís a mano, alcanza con escribir el
encabezado exacto en la primera columna libre; las filas viejas pueden
quedar vacías.

## 2. Crear el proyecto de Apps Script

1. En la misma planilla: menú **Extensiones → Apps Script**. Esto abre un proyecto de Apps Script ya "atado" (bound) a tu planilla — así `SpreadsheetApp.getActiveSpreadsheet()` en el código encuentra la planilla sola, sin necesitar un ID.
2. Borrá el contenido de `Code.gs` que trae por defecto y pegá el contenido de **`apps-script/Code.gs`** de este proyecto.
3. Creá un archivo nuevo (ícono `+` al lado de "Archivos" → Script) llamado `Seed` y pegá ahí el contenido de **`apps-script/Seed.gs`**.
4. Guardá (Ctrl/Cmd+S).

## 3. Poblar los datos reales (una sola vez)

1. En el editor de Apps Script, arriba, elegí la función `poblarDatosIniciales` en el desplegable de funciones y tocá **Ejecutar**.
2. La primera vez va a pedir autorización (es tu propio script accediendo a tu propia planilla) — aceptá los permisos.
3. Revisá **Ver → Registros de ejecución**: debería decir "Listo — 8 hojas pobladas con los datos reales." Si dice que falta alguna hoja, volvé al paso 1 y confirmá el nombre exacto.
4. Volvé a la planilla y confirmá que las 8 hojas ahora tienen filas (99 en Sucursales, 21 en Usuarios, 8 en Cursos, etc.).

## 4. Desplegar como Web App

1. En el editor de Apps Script: **Implementar → Nueva implementación**.
2. Tipo: **Aplicación web**.
3. "Ejecutar como": tu cuenta. "Quién tiene acceso": **Cualquier usuario** (así el cliente puede hacer `fetch` sin pedir login de Google en cada request — el control de acceso real ya lo hace `verificarLogin` adentro del script).
4. Tocá **Implementar** y copiá la URL que termina en https://script.google.com/macros/s/AKfycbwnod6RG4knjPpZRJn2Zl4M_AWpLKspKdX68emaE-2M0vwxAvuX1nISPW3WUVH0V1c7CA/exec `/exec`.

## 5. Conectar Lucciano's Academy

Abrí `js/config.js` y pegá esa URL en `GAS_URL`:

```js
export const GAS_URL = "https://script.google.com/macros/s/AKfycb.../exec";
```

Con eso alcanza: `USE_MOCK_DATA` se calcula solo (`!GAS_URL`) y pasa a `false` — toda la app (incluidos los datos ya cargados en `js/data/*.js`) empieza a leer y escribir en tu Sheet real, sin ningún otro cambio de código.

Si además querés que el login sea con Google Sign-In real (en vez del selector de roles de muestra), pegá también `GOOGLE_CLIENT_ID` en el mismo archivo — necesitás crear un OAuth Client ID en [Google Cloud Console](https://console.cloud.google.com/apis/credentials) (tipo "Web application", con tu dominio/localhost en los orígenes autorizados). Mientras `GOOGLE_CLIENT_ID` esté vacío, el login sigue mostrando el picker de roles de muestra, aunque `GAS_URL` ya esté conectado — son dos interruptores independientes.

## Cómo probar que quedó bien conectado

1. Abrí la URL del deploy (`.../exec`) directo en el navegador — debería devolver `{"ok":true,"mensaje":"Lucciano's Academy backend activo"}`.
2. Con `GAS_URL` pegado en `config.js`, abrí la app, entrá como Administrador y andá a **Integraciones** (`#/integraciones`) — la tarjeta "Google Sheets / Apps Script" debería decir **Conectado**, no "Modo demo".
3. Probá crear un colaborador nuevo desde **Usuarios** o **Colaboradores** y confirmá que aparece la fila nueva en la hoja `Usuarios` de tu planilla.

## Cargar las 210 preguntas reales en "Evaluaciones" (o migrar el esquema viejo)

Si tu planilla ya está conectada y en uso (Usuarios/Sucursales con datos reales cargados a mano), **no vuelvas a correr `poblarDatosIniciales`** — reescribe esas hojas desde cero. Para cargar las 210 preguntas reales sin tocar nada más:

1. En la hoja `Evaluaciones`, reemplazá la fila 1 (encabezados) por: `id`, `cursoId`, `pregunta`, `opcion1`, `opcion2`, `opcion3`, `correcta`, `puntaje`. Si tenías el esquema viejo (`opciones`, `respuestaCorrecta`), borrá esas dos columnas y agregá las nuevas cuatro en su lugar — el orden de columnas no importa, solo que los nombres coincidan exactamente.
2. Borrá las filas de datos viejas de `Evaluaciones` (fila 2 en adelante) — van a quedar reemplazadas por las 210 reales.
3. En el editor de Apps Script, actualizá el archivo `Seed` pegando el contenido más reciente de **`apps-script/Seed.gs`** (ahora trae las 210 preguntas reales, 30 por cada uno de los 7 módulos con contenido).
4. Actualizá también `Code.gs` con la versión más reciente de **`apps-script/Code.gs`** (ya no hace falta el manejo especial de JSON para `opciones`, así que se simplificó).
5. Elegí la función `poblarPreguntasReales` en el desplegable de funciones (no `poblarDatosIniciales`) y tocá **Ejecutar**. Este función solo escribe en `Evaluaciones` — Usuarios, Sucursales y el resto quedan intactos.
6. Revisá **Ver → Registros de ejecución**: debería decir "Listo — Evaluaciones poblada con 210 preguntas reales (no se tocó ninguna otra hoja)."
7. Volvé a la planilla y confirmá que `Evaluaciones` tiene 210 filas, con las columnas `opcion1/opcion2/opcion3/correcta` completas.

## Cargar las lecciones reales de Cafetería en "Lecciones" (o migrar el esquema viejo)

Igual que con Evaluaciones: si tu planilla ya tiene datos reales cargados a mano, **no vuelvas a correr `poblarDatosIniciales`**. Para actualizar solo `Lecciones`:

1. En la hoja `Lecciones`, reemplazá la fila 1 (encabezados) por: `id`, `cursoId`, `orden`, `titulo`, `objetivo`, `duracionMinutos`, `video`, `manual`, `imagen`, `procedimiento`, `errores`, `buenasPracticas`, `consejo`, `resumen`, `estado`. Si tenías el esquema viejo (`contenido`, `manualDriveId`), borralas y agregá las columnas nuevas — el orden no importa, solo que los nombres coincidan.
2. Borrá las filas de datos viejas de `Lecciones` (fila 2 en adelante).
3. En el editor de Apps Script, actualizá el archivo `Seed` pegando el contenido más reciente de **`apps-script/Seed.gs`** (Cafetería ahora trae las 21 lecciones reales completas, con procedimiento/errores/buenas prácticas/consejo en columnas separadas; el resto de los cursos sigue con su contenido condensado, migrado al nuevo esquema).
4. Elegí la función `poblarLeccionesReales` en el desplegable (no `poblarDatosIniciales`) y tocá **Ejecutar**. Solo escribe en `Lecciones`.
5. Revisá **Ver → Registros de ejecución**: debería decir "Listo — Lecciones poblada con 47 lecciones (no se tocó ninguna otra hoja)."
6. Volvé a la planilla y confirmá que `Lecciones` tiene 47 filas.

Algunas lecciones de Cafetería tienen una URL real de Google Drive en `imagen` (ej. la lección "Vajilla") — esas se muestran en la app. Otras todavía referencian rutas locales (`assets/img/recetas/...`) que no existen en el proyecto todavía — la app las deja vacías en vez de mostrar un ícono roto, hasta que subas esas imágenes reales.

**Formato correcto para links de imágenes de Drive**: el formato clásico `https://drive.google.com/uc?export=view&id=...` lo bloquea Chrome (ORB) y la imagen no carga. Usá este formato en su lugar:
```
https://lh3.googleusercontent.com/d/EL_ID_DEL_ARCHIVO
```
El "ID del archivo" es la parte larga del link que te da Drive al compartir (`.../file/d/`**`EL_ID`**`/view?usp=sharing`). El archivo tiene que estar compartido como "Cualquier usuario con el enlace" para que cargue.

## Agregar validaciones (dropdowns) en Cursos y Lecciones

Para que cargar/editar cursos y lecciones a mano en Sheets sea más difícil de romper, hay una función que agrega **listas desplegables** en las columnas que más se prestan a error de tipeo:

- `Cursos.categoria` → sugiere Producto / Operaciones / Servicio / Gestión, pero **no bloquea** si escribís otra (por si necesitás una categoría nueva) — solo marca la celda con una advertencia (triangulito).
- `Cursos.obligatorio` → dropdown **SI / NO**, este si bloquea cualquier otro valor.
- `Lecciones.cursoId` → dropdown armado automáticamente con los ids reales que hay en `Cursos` (columna `id`) — no te deja elegir un curso que no existe. Se complementa con la columna `modulo` (ver sección de arriba) que muestra el nombre del curso al lado, para saber qué estás eligiendo sin tener que ir a mirar la hoja `Cursos`.
- `Lecciones.estado` → dropdown **Activo / Inactivo**.

Pasos:

1. Actualizá el archivo `Seed` en el editor de Apps Script con la versión más reciente de **`apps-script/Seed.gs`**.
2. Elegí la función `agregarValidacionesCursosYLecciones` en el desplegable y tocá **Ejecutar**.
3. Revisá **Ver → Registros de ejecución**: debería decir "Listo — validaciones agregadas...". No se modifica ningún dato existente, solo se agrega la regla — se puede volver a correr sin problema cada vez que agregues cursos nuevos (para que el dropdown de `cursoId` los incluya).
4. Volvé a la planilla: al hacer clic en una celda de esas columnas ahora aparece una flechita para elegir de una lista, en vez de tener que tipear a mano.

## Si algo no cierra

- **"No existe la hoja 'X'"** en los registros de ejecución → revisá que el nombre de la pestaña sea exactamente ese (sin tildes ni mayúsculas distintas).
- **La app sigue en "Modo demo" después de pegar GAS_URL** → revisá que no quedó ningún espacio o comilla de más en `config.js`, y que hiciste un F5 duro en el navegador (los módulos JS quedan cacheados).
- **Error de CORS / fetch falla** → confirmá que el deploy tiene acceso "Cualquier usuario" (no "Solo yo" ni "Cualquiera con cuenta de Google en tu organización").
