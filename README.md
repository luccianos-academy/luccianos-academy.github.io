# Lucciano's Academy

Plataforma de formación de Lucciano's. Sprint 1 "Infraestructura" +
shells de Administrador/Supervisor/Colaborador.

## Cómo correrla

No hay build step: es HTML/CSS/JS plano con módulos ES. Alcanza con
servirla como archivos estáticos, por ejemplo:

```
python3 -m http.server 8000
```

y abrir `http://localhost:8000`.

## Datos de muestra vs. Google Sheets real

Mientras `GAS_URL` esté vacío en `js/config.js`, la app corre contra
datos de muestra en memoria (`js/data/mock/*.mock.js`) — no hace
falta ningún backend para probarla. El login muestra un picker de
roles de muestra (Administrador / Supervisor / Colaborador) en vez
del botón de Google.

Cuando exista un Google Apps Script real desplegado:

1. Pegar `GAS_URL` (y `GOOGLE_CLIENT_ID`) en `js/config.js`.
2. Nada más cambia: `USE_MOCK_DATA` se apaga solo y toda la app pasa
   a leer/escribir en Sheets vía `js/services/google.js`.
