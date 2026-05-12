require('dotenv').config();
const path = require('path');
const { app, BrowserWindow, dialog, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

// ─── Configuración del logger ─────────────────────────────────────
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
log.info('Aplicación iniciada.');

// ─── URL permitida (lista blanca) ────────────────────────────────
const ALLOWED_ORIGIN = new URL(
    process.env.PAGINA_ABRIR || 'https://plataformadigital.guanajuato.gob.mx/'
).origin;

// ─── Creación de ventana ──────────────────────────────────────────
function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        autoHideMenuBar: true,
        show: false,
        icon: path.join(__dirname, 'ico.ico'),
        webPreferences: {
            // SEGURIDAD: Desactiva Node.js en el proceso de renderizado
            nodeIntegration: false,
            // SEGURIDAD: Aisla el contexto del renderizador del contexto principal
            contextIsolation: true,
            // SEGURIDAD: Evita que se ejecuten scripts en línea no autorizados
            sandbox: true,
            // SEGURIDAD: Bloquea la navegación a recursos del sistema de archivos
            allowRunningInsecureContent: false,
            // SEGURIDAD: Desactiva las DevTools en producción
            devTools: !app.isPackaged,
        }
    });

    const urlToLoad = process.env.PAGINA_ABRIR || 'https://plataformadigital.guanajuato.gob.mx/';
    win.loadURL(urlToLoad);

    win.once('ready-to-show', () => {
        win.show();
    });

    // SEGURIDAD: Intercepta cualquier intento de navegar a otra URL
    win.webContents.on('will-navigate', (event, url) => {
        const targetOrigin = new URL(url).origin;
        if (targetOrigin !== ALLOWED_ORIGIN) {
            event.preventDefault();
            log.warn(`Navegación bloqueada: ${url}`);
        }
    });

    // SEGURIDAD: Intercepta pop-ups y los abre en el navegador del sistema,
    // nunca dentro de la aplicación Electron
    win.webContents.setWindowOpenHandler(({ url }) => {
        const targetOrigin = new URL(url).origin;
        if (targetOrigin === ALLOWED_ORIGIN) {
            // Mismo dominio: permitir dentro de la app
            return { action: 'allow' };
        }
        // Dominio externo: abrir en el navegador predeterminado del sistema
        shell.openExternal(url);
        return { action: 'deny' };
    });
}

// ─── Inicio de la app ─────────────────────────────────────────────
app.whenReady().then(() => {
    createWindow();

    // Verificar actualizaciones al iniciar (solo en producción)
    if (app.isPackaged) {
        autoUpdater.checkForUpdates();
    }
});

// SEGURIDAD: Cierra la app cuando todas las ventanas se cierran
app.on('window-all-closed', () => {
    app.quit();
});

// SEGURIDAD: Bloquea la creación de ventanas adicionales desde fuera del flujo controlado
app.on('web-contents-created', (_event, contents) => {
    // Bloquea cualquier navegación a URLs fuera del dominio permitido
    contents.on('will-navigate', (event, url) => {
        try {
            const targetOrigin = new URL(url).origin;
            if (targetOrigin !== ALLOWED_ORIGIN) {
                event.preventDefault();
                log.warn(`[web-contents-created] Navegación bloqueada: ${url}`);
            }
        } catch {
            event.preventDefault();
        }
    });
});

// ─── Eventos del actualizador ─────────────────────────────────────
autoUpdater.on('checking-for-update', () => {
    log.info('Verificando actualizaciones...');
});

autoUpdater.on('update-available', (info) => {
    log.info(`Actualización disponible: v${info.version}. Descargando...`);
});

autoUpdater.on('update-not-available', () => {
    log.info('La aplicación está actualizada.');
});

autoUpdater.on('download-progress', (progress) => {
    log.info(`Descargando: ${Math.round(progress.percent)}%`);
});

autoUpdater.on('update-downloaded', (info) => {
    log.info(`Actualización v${info.version} descargada. Lista para instalar.`);

    dialog.showMessageBox({
        type: 'info',
        title: 'Actualización lista',
        message: `La versión ${info.version} ha sido descargada.`,
        detail: 'Reinicia la aplicación para aplicar la actualización.',
        buttons: ['Reiniciar ahora', 'Más tarde'],
        defaultId: 0,
        cancelId: 1
    }).then(({ response }) => {
        if (response === 0) {
            autoUpdater.quitAndInstall();
        }
    });
});

autoUpdater.on('error', (err) => {
    log.error(`Error en el actualizador: ${err.message}`);
});