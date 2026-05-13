require('dotenv').config();

const path = require('path');

const {
    app,
    BrowserWindow,
    dialog,
    shell
} = require('electron');

const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

// ─────────────────────────────────────────────────────────────
// Logger
// ─────────────────────────────────────────────────────────────

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

log.info('Aplicación iniciada.');

// ─────────────────────────────────────────────────────────────
// Configuración Auto Updater
// ─────────────────────────────────────────────────────────────

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

// ─────────────────────────────────────────────────────────────
// URL Permitida
// ─────────────────────────────────────────────────────────────

const ALLOWED_ORIGIN = new URL(
    process.env.PAGINA_ABRIR ||
    'https://plataformadigital.guanajuato.gob.mx/'
).origin;

// ─────────────────────────────────────────────────────────────
// Variables globales
// ─────────────────────────────────────────────────────────────

let mainWindow;

// ─────────────────────────────────────────────────────────────
// Crear ventana principal
// ─────────────────────────────────────────────────────────────

function createWindow() {

    mainWindow = new BrowserWindow({

        width: 1200,
        height: 800,

        autoHideMenuBar: true,
        show: false,

        icon: path.join(__dirname, 'ico.ico'),

        webPreferences: {

            // SEGURIDAD
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            allowRunningInsecureContent: false,

            // DevTools solo en desarrollo
            devTools: !app.isPackaged
        }

    });

    const urlToLoad =
        process.env.PAGINA_ABRIR ||
        'https://plataformadigital.guanajuato.gob.mx/';

    mainWindow.loadURL(urlToLoad);

    // Mostrar ventana cuando cargue
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // ─────────────────────────────────────────────────────────
    // Badge de versión flotante
    // ─────────────────────────────────────────────────────────

    mainWindow.webContents.on('did-finish-load', () => {

        const version = app.getVersion();

        mainWindow.webContents.executeJavaScript(`
            (function () {
                const existing = document.getElementById('__app-version-badge__');
                if (existing) existing.remove();

                const badge = document.createElement('div');
                badge.id = '__app-version-badge__';
                badge.innerText = 'v${version}';
                badge.style.cssText = [
                    'position: fixed',
                    'bottom: 10px',
                    'right: 14px',
                    'z-index: 2147483647',
                    'background: rgba(0, 0, 0, 0.55)',
                    'color: #fff',
                    'font-size: 11px',
                    'font-family: monospace',
                    'padding: 3px 8px',
                    'border-radius: 20px',
                    'pointer-events: none',
                    'user-select: none',
                    'backdrop-filter: blur(4px)',
                    '-webkit-backdrop-filter: blur(4px)',
                    'letter-spacing: 0.5px',
                    'opacity: 0.75'
                ].join(';');
                document.body.appendChild(badge);
            })();
        `).catch(() => {});

    });

    // ─────────────────────────────────────────────────────────
    // Bloquear navegación externa
    // ─────────────────────────────────────────────────────────

    mainWindow.webContents.on('will-navigate', (event, url) => {

        try {

            const targetOrigin = new URL(url).origin;

            if (targetOrigin !== ALLOWED_ORIGIN) {

                event.preventDefault();

                log.warn(`Navegación bloqueada: ${url}`);

            }

        } catch {

            event.preventDefault();

        }

    });

    // ─────────────────────────────────────────────────────────
    // Control de popups y nuevas ventanas
    // ─────────────────────────────────────────────────────────

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {

        try {

            const targetOrigin = new URL(url).origin;

            // Permitir solo mismo dominio
            if (targetOrigin === ALLOWED_ORIGIN) {

                return { action: 'allow' };

            }

            // Abrir externos en navegador
            shell.openExternal(url);

            return { action: 'deny' };

        } catch {

            return { action: 'deny' };

        }

    });

}

// ─────────────────────────────────────────────────────────────
// Inicio de aplicación
// ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {

    createWindow();

    // Solo verificar updates en producción
    if (app.isPackaged) {

        log.info('Aplicación empaquetada. Verificando updates...');

        // Buscar actualizaciones
        autoUpdater.checkForUpdatesAndNotify();

        // Revisar cada 30 minutos
        setInterval(() => {

            log.info('Verificación automática de updates...');

            autoUpdater.checkForUpdatesAndNotify();

        }, 1000 * 60 * 30);

    } else {

        log.info('Modo desarrollo. AutoUpdater desactivado.');

    }

});

// ─────────────────────────────────────────────────────────────
// Cerrar app
// ─────────────────────────────────────────────────────────────

app.on('window-all-closed', () => {

    app.quit();

});

// ─────────────────────────────────────────────────────────────
// Seguridad adicional
// ─────────────────────────────────────────────────────────────

app.on('web-contents-created', (_event, contents) => {

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

// ─────────────────────────────────────────────────────────────
// Eventos AutoUpdater
// ─────────────────────────────────────────────────────────────

autoUpdater.on('checking-for-update', () => {

    log.info('Verificando actualizaciones...');

});

autoUpdater.on('update-available', (info) => {

    log.info(`Actualización disponible: v${info.version}`);

    dialog.showMessageBox({

        type: 'info',
        title: 'Actualización disponible',
        message: `Nueva versión disponible: v${info.version}`,
        detail: 'La actualización se descargará automáticamente.'

    });

});

autoUpdater.on('update-not-available', () => {

    log.info('La aplicación está actualizada.');

});

autoUpdater.on('download-progress', (progress) => {

    const percent = Math.round(progress.percent);

    log.info(`Descargando actualización: ${percent}%`);

    // Barra de progreso en taskbar/dock
    if (mainWindow) {

        mainWindow.setProgressBar(progress.percent / 100);

    }

});

autoUpdater.on('update-downloaded', (info) => {

    log.info(`Actualización descargada: v${info.version}`);

    // Quitar barra progreso
    if (mainWindow) {

        mainWindow.setProgressBar(-1);

    }

    dialog.showMessageBox({

        type: 'info',

        title: 'Actualización lista',

        message: `La versión ${info.version} fue descargada correctamente.`,

        detail: 'La aplicación se reiniciará para instalar la actualización.',

        buttons: ['Reiniciar ahora', 'Más tarde'],

        defaultId: 0,
        cancelId: 1

    }).then(({ response }) => {

        if (response === 0) {

            log.info('Instalando actualización...');

            autoUpdater.quitAndInstall();

        }

    });

});

autoUpdater.on('error', (err) => {

    log.error(`Error en AutoUpdater: ${err == null ? "unknown" : err.message}`);

});