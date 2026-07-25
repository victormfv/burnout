# Encuesta de Burnout — UMF 19 Plus (autoalojada)

Sistema autónomo (sin depender de Claude) para aplicar el consentimiento
informado, el MBI-HSS y la hoja sociodemográfica desde un solo enlace / QR,
guardando cada respuesta de forma independiente en tu propio servidor.

## Requisitos
- Node.js 16 o superior instalado en tu servidor.

## Instalación
```bash
cd burnout-app
npm install
```

## Configurar la clave de administrador (obligatorio antes de usarlo real)
El panel del investigador (exportar CSV, ver totales) está protegido con una
clave. Por default es `cambia-esta-clave` — **cámbiala**:

```bash
export ADMIN_KEY="elige-una-clave-larga-y-unica"
export PORT=3000        # opcional, 3000 por default
npm start
```

En Windows (PowerShell):
```powershell
$env:ADMIN_KEY="elige-una-clave-larga-y-unica"
npm start
```

## Uso
1. Abre `http://tu-dominio-o-ip:3000` en el navegador — ahí está el
   cuestionario para los participantes.
2. Entra a **"Panel del investigador →"** (enlace al final de la página de
   inicio), pega tu `ADMIN_KEY` en el campo de clave y guárdala.
3. Genera el código QR (ya usa automáticamente la URL donde está corriendo).
4. Comparte el QR o el enlace con el personal.
5. Descarga el CSV cuando quieras desde el mismo panel.

## Dónde quedan los datos
Cada respuesta se guarda como un registro independiente en:
```
burnout-app/data/responses.json
```
Haz respaldo de este archivo periódicamente (cópialo a otro lugar). Si
prefieres una base de datos real (SQLite/Postgres) en vez de un archivo
JSON, dile a Claude que lo adapte — la lógica de puntuación ya está aislada
en `server.js` y es fácil de mover.

## Ponerlo en línea con tu hosting propio
- **Con un VPS (Ubuntu, etc.):** instala Node, copia esta carpeta, corre
  `npm install && npm start` (idealmente con `pm2` o un servicio `systemd`
  para que se reinicie solo), y pon un proxy inverso con Nginx o Caddy para
  servirlo con HTTPS en tu dominio.
- **Con hosting compartido tradicional (solo PHP/Apache, sin Node):** ese
  tipo de hosting no puede correr este servidor tal cual; necesitas un VPS,
  Railway, Render, Fly.io o similar que sí ejecute Node.js.
- **HTTPS:** recomendado siempre, y necesario si vas a acceder al panel de
  administrador desde redes no confiables (la clave viaja en un encabezado
  HTTP, no en la URL, pero igual conviene cifrar el tráfico).

## Notas metodológicas importantes
- El criterio de puntuación de Despersonalización tiene una discrepancia en
  el protocolo original (Anexo 1 usa "alto ≥12"; el apartado 7.8 usa
  "alto ≥10"). El servidor usa por default el criterio del Anexo 1. Está
  aislado en `CONFIG.DP_MEDIO_MAX` dentro de `server.js` — cámbialo ahí si
  su asesora confirma el otro criterio.
- Confirmen con su Comité de Ética si el consentimiento electrónico es
  aceptable o si además se requiere la versión firmada con testigos.
- Verifiquen que cuentan con autorización para aplicar el MBI-HSS en este
  formato.

## Solución de problemas
- **"No se pudo contactar al servidor" en el diagnóstico:** el proceso
  `node server.js` no está corriendo, o estás abriendo el archivo con
  `file://` en vez de `http://` — este proyecto necesita correr con Node,
  no puede abrirse como HTML suelto.
- **401 al exportar o ver el total:** la clave que pusiste en el panel no
  coincide con `ADMIN_KEY`. Vuelve a guardarla.
- **El QR no lleva a ningún lado:** revisa que el campo "Enlace a
  codificar" tenga la URL pública real (con tu dominio), no `localhost`.
