# Recursos Digitales SEA

## Generar nueva versión

1. Subir la versión en `package.json` y `package-lock.json`.
   - Recomendado: `npm version patch --no-git-tag-version`
2. Si se agregan nuevos sitios, actualizar `ALLOWED_ORIGINS` en `main.js`.
3. Hacer commit con una descripción clara en español.
4. Generar instaladores:
   - Windows: `npm run build:win`
   - macOS: `npm run build:mac`
   - Linux: `npm run build:linux`
   - Todos: `npm run build:all`
5. Publicar release:
   - Todos: `npm run release`
   - Por plataforma: `npm run release:win`, `npm run release:mac` o `npm run release:linux`

## Actualizaciones automáticas

- La app revisa actualizaciones al iniciar y después cada 30 minutos por defecto.
- Para cambiar el intervalo, definir `UPDATE_CHECK_INTERVAL_MINUTES` con el número de minutos deseado.
- Cuando encuentra una actualización, la app muestra una notificación nativa del sistema y la descarga en segundo plano.
- Cuando la actualización termina de descargarse, muestra otra notificación nativa y deja disponible el botón `Reiniciar y actualizar`.
- Las notificaciones solo aparecen en la app instalada y cuando GitHub Releases tiene una versión mayor a la instalada.
- Windows usa el instalador NSIS (`.exe`) y el archivo `latest.yml`.
- macOS requiere publicar el `.dmg` para instalación manual y el `.zip` para actualización automática.
- En macOS también debe publicarse `latest-mac.yml`; electron-builder lo genera cuando existe el target `zip`.
- No eliminar de GitHub Releases los archivos `.zip`, `.blockmap`, `latest.yml` o `latest-mac.yml`, porque el updater los usa.

## Instalación en Windows

- El instalador de Windows se fuerza al usuario actual y no debe mostrar la opción de instalar para todos los usuarios.
- La ruta esperada es `%LocalAppData%\Programs\Recursos Digitales SEA`, salvo que el usuario elija otra carpeta en el asistente.

## Enlaces de descarga

Para actualizar los enlaces de descarga de WordPress, usar los archivos generados en GitHub Releases.
