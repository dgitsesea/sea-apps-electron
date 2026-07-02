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

- Windows usa el instalador NSIS (`.exe`) y el archivo `latest.yml`.
- macOS requiere publicar el `.dmg` para instalación manual y el `.zip` para actualización automática.
- En macOS también debe publicarse `latest-mac.yml`; electron-builder lo genera cuando existe el target `zip`.
- No eliminar de GitHub Releases los archivos `.zip`, `.blockmap`, `latest.yml` o `latest-mac.yml`, porque el updater los usa.

## Enlaces de descarga

Para actualizar los enlaces de descarga de WordPress, usar los archivos generados en GitHub Releases.

