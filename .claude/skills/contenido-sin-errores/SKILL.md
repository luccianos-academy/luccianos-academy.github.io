---
name: contenido-sin-errores
description: Regla de diseño para cualquier formulario de carga de contenido de Lucciano's Academy (preguntas de evaluación, opciones, pasos, listas de cualquier tipo). Usar SIEMPRE que se construya o modifique una pantalla donde el Admin carga datos estructurados a mano. Objetivo del usuario, textual — "minimizar el error a cero en lo posible y agilizarlo al 100%".
---

# Contenido sin errores

Ver también [[calidad-visual-premium]] — misma exigencia de "cero
errores, cien por ciento prolijo", aplicada a cómo se VE la pantalla
en vez de a cómo se carga el contenido.

## Origen

2026-08-22, evaluaciones.js tenía "Opciones (separadas por coma)" +
"Índice de la opción correcta (0, 1, 2...)" como dos campos de texto
sueltos. El usuario lo rechazó de plano:

> "no me gusta, tiene que haber tres líneas A B C no separado por
> comas puedo cometer un error [...] así debe estar simple y fácil"

Y pidió que esto quede como regla permanente, no una corrección
puntual: **"siempre que vamos a hacer este tipo de contenido se tiene
que minimizar el error a cero en lo posible y agilizarlo al 100%"**.

## La regla

Cuando una pantalla de Admin carga una LISTA de cosas relacionadas
(opciones de una pregunta, pasos de un procedimiento, sub-puntos,
cualquier colección con estructura):

1. **Una fila real por ítem, nunca texto delimitado por comas/pipes/
   saltos manuales.** Un campo de texto libre donde el admin tiene que
   escribir el separador a mano es un lugar donde se le va a escapar
   una coma, un espacio de más, o un ítem pegado al anterior. Cada
   ítem lleva su propio `<input>`/`<textarea>`, con "+ Agregar" para
   sumar filas y "×" para sacarlas (nunca menos del mínimo real, ej. 2
   opciones) — mismo patrón ya usado en `js/pages/evaluaciones.js`
   (opciones) y `js/pages/academia.js` (pasos del procedimiento,
   sub-puntos).

2. **Marcar/elegir un ítem de la lista es un click sobre ESE ítem, no
   un índice numérico aparte.** "Poné el número de la opción correcta"
   obliga a contar filas y confiar en no haberse equivocado por uno.
   Un radio/checkbox al lado de cada fila hace que marcar la correcta
   sea literalmente imposible de errar — no hay traducción mental de
   "fila 3" a "índice 2".

3. **Etiquetas legibles, no posiciones.** "A", "B", "C" (o el
   equivalente natural del contenido: "Paso 1", "Local X") en vez de
   "opción[0]", "ítem 2". El admin lee lo que ve, no lo que el código
   indexa internamente.

4. **Validar y decir exactamente qué falta, sin guardar a medias.** Si
   falta marcar la correcta, o hay menos del mínimo de ítems, el
   guardado se frena ANTES de tocar el backend, con un mensaje que
   dice qué hacer (no un `alert("Error")` genérico, no un guardado
   silencioso con un valor por default que nadie pidió — ver el bug
   real que esto evitó: antes, sin marcar ninguna correcta, el código
   viejo hubiera guardado la opción 0 como correcta sin avisar).

5. **Arrancar con el mínimo útil ya dibujado.** Una pregunta nueva
   arranca con 2-3 filas vacías ya puestas (no con la lista en blanco
   y un botón "+ Agregar" como único punto de partida) — menos clics
   para el caso normal.

## Cuadros que crecen solos (2026-08-22)

Ampliación del mismo pedido, ya con el editor de listas en uso: "que
cuando escribo me permita expandir y contraer a necesidad... me
limita a ver solo lo que está en pantalla", y después, explícito:
**"eso tiene que estar en todo lo que se pueda escribir, así ya no me
vuelve a pasar"**.

Dos reglas, ya implementadas en `js/services/autoExpandirTextareas.js`
(se registra una sola vez en `app.js`, cubre toda la app incluido lo
que se inserta después por innerHTML — no hace falta tocarlo de nuevo
por cada formulario nuevo):

1. **Todo `<textarea>` de la app auto-crece con lo que se escribe**
   (hasta un tope, después scroll interno) — no hace falta ningún
   cambio extra al crear un formulario nuevo, esto ya corre solo.

2. **Un campo que puede contener una oración real (una pregunta, un
   objetivo, un paso, un sub-punto, cualquier texto donde el usuario
   pueda escribir más de ~40-50 caracteres con sentido) va como
   `<textarea rows="1">`, nunca `<input type="text">`.** Un input de
   una sola línea esconde el resto del texto sin avisar (así se
   detectó: las opciones de Evaluaciones cortaban invisible el texto
   más largo). Reservar `<input type="text">` para lo que es
   genuinamente corto por naturaleza — título, nombre, categoría,
   texto de un botón, URL — donde forzar un textarea sería
   sobre-ingeniería.

Antes de agregar un campo de texto nuevo en cualquier formulario:
¿esto puede llegar a tener una oración? → `<textarea rows="1">`.
¿Es un identificador corto? → `<input type="text">`. En caso de duda,
textarea — el costo de equivocarse para el otro lado (contenido
cortado sin aviso) es mayor.

## Cuándo aplica

Cualquier formulario nuevo o tocado en Academia (lecciones, preguntas,
pasos), Locales, Manuales, Recursos, o cualquier pantalla de Admin que
hoy o en el futuro pida cargar una lista de cosas relacionadas a mano.
Si al diseñar un campo la respuesta a "¿cómo separo un ítem del
siguiente?" es "con una coma" o "el admin escribe el número", parar y
rediseñar con este patrón antes de escribir el resto de la pantalla.

## Ejemplo de referencia

`js/pages/evaluaciones.js` — `opcionHtml()`, `camposPreguntaHtml()`,
`bindCamposPregunta()`, `leerCamposPregunta()`: filas A/B/C con radio
"Correcta" por fila, "+ Agregar opción", validación explícita. Copiar
esta forma (no el código literal, la estructura) para cualquier lista
nueva.
