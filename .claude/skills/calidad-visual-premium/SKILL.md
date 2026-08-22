---
name: calidad-visual-premium
description: Barra de calidad visual de Lucciano's Academy — todo lo que se entrega tiene que verse alineado, prolijo y premium. Usar SIEMPRE antes de dar por terminado cualquier cambio visual (pantallas nuevas, listas, tablas, tarjetas, formularios) y no entregarlo si no cumple. Complementa contenido-sin-errores (esa es sobre CÓMO SE CARGA el contenido; esta es sobre CÓMO SE VE).
---

# Calidad visual premium

## Origen

2026-08-22. El usuario mandó dos capturas reales de la app —la lista
de "Preguntas del curso" en Evaluaciones y la tabla de Locales— y las
marcó como desprolijas:

> "puedes hacer que esto esté alineado y profesional como venimos
> haciendo con todo, me encuentro mucho con esto [...] dentro de la
> skill arma también esto, siempre respetar el apartado visual que sea
> premium, prolijo y alineado, no entregar si no está perfecto como
> acordamos antes."

"Me encuentro mucho con esto" — no es la primera vez, es un patrón. La
causa real encontrada esa vez: `.list .item` centraba verticalmente
(`align-items:center`) una fila con texto de varias líneas contra un
grupo de botones — prolijo por casualidad cuando el texto entraba en
una línea, "flotando" en el medio apenas pasaba a 2-3 líneas. Ver el
fix en `css/components.css` (`.list.item{ align-items:flex-start }`)
como caso de referencia.

## La regla

Antes de dar algo por terminado, mirar la pantalla real (screenshot o
navegador, no solo el código) y revisar específicamente:

1. **Alineación vertical entre filas de distinta altura.** Cualquier
   fila/tarjeta donde el contenido principal puede ocupar 1 línea A
   VECES y 2-3 líneas OTRAS VECES (una pregunta, un título con aviso
   debajo, una descripción) — si al lado hay botones/acciones,
   revisar que no quedan centrados contra toda la altura de la fila
   más alta. `align-items:flex-start` casi siempre es lo correcto ahí;
   `center` es para pares corto-corto (label + valor de una sola
   línea, ver Mi Perfil).

2. **Vertical-align explícito en tablas.** Un checkbox, un badge o un
   ícono dentro de una celda de `<table>` necesita
   `vertical-align:middle` puesto a mano — el default del navegador no
   siempre da el resultado prolijo contra texto al lado.

3. **Especificidad del fix, no el parche global.** Cuando el problema
   aparece en un lugar puntual (ej. las filas de Evaluaciones/Academia
   con botones), NO tocar la regla CSS compartida a lo bruto — eso
   rompe lugares que ya se veían bien (Mi Perfil, en este caso). Sumar
   una regla más específica (dos clases en el mismo elemento, o una
   clase modificadora) que gane por especificidad o por orden en el
   archivo, y dejar documentado en un comentario CSS por qué existe y
   qué NO debe tocar.

4. **Antes de entregar, comparar visualmente, no solo leer el código.**
   Si el cambio es visual, la verificación tiene que incluir mirar la
   pantalla real (screenshot del navegador) — leer el CSS y asumir que
   "debería verse bien" no alcanza, así se coló este mismo bug la
   primera vez.

5. **Consistencia de nombres entre roles/pantallas.** Un mismo
   concepto (ej. "Academia") no puede llamarse distinto en dos lugares
   de la app (bottom nav de colaborador decía "Aprender" mientras
   sidebar/admin decían "Academia" — mismo bug de fondo que
   contenido-sin-errores pero para nomenclatura, no datos). Al tocar
   una pantalla, revisar que el nombre visible de cada módulo coincide
   con como se lo llama en el resto de la app.

## No entregar si...

- Un elemento visual se ve distinto de fila a fila sin una razón de
  contenido real que lo justifique (alturas que "saltan", botones que
  a veces están arriba y a veces centrados).
- Hay que forzar un fix con `!important` para ganarle a una regla
  compartida — es señal de que el selector no es lo bastante
  específico o el fix está en el lugar equivocado.
- No se miró la pantalla real después del cambio (solo se leyó el
  código y se asumió).

Ver también [[contenido-sin-errores]] — la misma exigencia de "cero
errores, cien por ciento prolijo" aplicada al contenido en vez de al
layout.
