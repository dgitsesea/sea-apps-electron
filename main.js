require('dotenv').config();

const path = require('path');
const fs = require('fs');

const {
    app,
    BrowserWindow,
    dialog,
    shell,
    Menu,
    WebContentsView,
    ipcMain
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

const ALLOWED_ORIGINS = [
    'https://sistemaestatalanticorrupcion.guanajuato.gob.mx',
    'https://seseaguanajuato.org',
    'https://publico.seseaguanajuato.org',
    'https://plataformadigital.guanajuato.gob.mx',
    'https://intranet.seseaguanajuato.org'
];

// ─────────────────────────────────────────────────────────────
// Variables globales
// ─────────────────────────────────────────────────────────────

let mainWindow;
let mainView;

// ─────────────────────────────────────────────────────────────
// Crear ventana principal
// ─────────────────────────────────────────────────────────────

function createWindow() {

    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        autoHideMenuBar: true, // Ocultamos la barra de menús
        show: false,
        icon: path.join(__dirname, 'ico.ico'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    Menu.setApplicationMenu(null); // Desactivar el menú nativo

    // Cargar la barra de navegación web
    mainWindow.loadFile('navbar.html');

    // Crear la vista para las páginas web
    mainView = new WebContentsView({
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            allowRunningInsecureContent: false,
            devTools: !app.isPackaged
        }
    });

    mainWindow.contentView.addChildView(mainView);

    // Ajustar el tamaño de la vista cuando la ventana cambie de tamaño
    const resizeView = () => {
        const bounds = mainWindow.getContentBounds();
        mainView.setBounds({ x: 0, y: 50, width: bounds.width, height: bounds.height - 50 });
    };

    mainWindow.on('resize', resizeView);

    // Mostrar ventana cuando cargue
    mainWindow.once('ready-to-show', () => {
        resizeView();
        mainWindow.show();
    });

    // Cargar URL inicial
    let urlToLoad = process.env.PAGINA_ABRIR || 'https://plataformadigital.guanajuato.gob.mx/';
    const configPath = path.join(app.getPath('userData'), 'last-url.json');
    try {
        if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            if (config.lastUrl) urlToLoad = config.lastUrl;
        }
    } catch (err) {
        log.error('Error leyendo config', err);
    }

    mainView.webContents.loadURL(urlToLoad);

    // Guardar URL actual
    const saveUrl = (url) => {
        try {
            fs.writeFileSync(configPath, JSON.stringify({ lastUrl: url }));
        } catch (err) {
            log.error('Error guardando config', err);
        }
    };
    mainView.webContents.on('did-navigate', (event, url) => saveUrl(url));
    mainView.webContents.on('did-navigate-in-page', (event, url) => saveUrl(url));

    // ─────────────────────────────────────────────────────────
    // Badge de versión flotante
    // ─────────────────────────────────────────────────────────

    mainView.webContents.on('did-finish-load', () => {

        const version = app.getVersion();

        mainView.webContents.executeJavaScript(`
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

    mainView.webContents.on('will-navigate', (event, url) => {
        try {
            const targetOrigin = new URL(url).origin;
            if (!ALLOWED_ORIGINS.includes(targetOrigin)) {
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

    mainView.webContents.setWindowOpenHandler(({ url }) => {
        try {
            const targetOrigin = new URL(url).origin;
            if (ALLOWED_ORIGINS.includes(targetOrigin)) {
                return { action: 'allow' };
            }
            shell.openExternal(url);
            return { action: 'deny' };
        } catch {
            return { action: 'deny' };
        }
    });

    // ─────────────────────────────────────────────────────────
    // IPC para recibir acciones de la barra de navegación
    // ─────────────────────────────────────────────────────────
    ipcMain.removeAllListeners('navigate');
    ipcMain.on('navigate', (event, url) => {
        mainView.webContents.loadURL(url);
    });

    ipcMain.removeAllListeners('reload');
    ipcMain.on('reload', () => {
        mainView.webContents.reload();
    });

    ipcMain.removeHandler('get-last-url');
    ipcMain.handle('get-last-url', () => {
        try {
            const configPath = path.join(app.getPath('userData'), 'last-url.json');
            if (fs.existsSync(configPath)) {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                if (config.lastUrl) return config.lastUrl;
            }
        } catch (err) {
            // Ignorar
        }
        return process.env.PAGINA_ABRIR || 'https://plataformadigital.guanajuato.gob.mx/';
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
            if (!ALLOWED_ORIGINS.includes(targetOrigin)) {
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
    if (mainWindow) {
        mainWindow.setProgressBar(progress.percent / 100);
    }
});

autoUpdater.on('update-downloaded', (info) => {
    log.info(`Actualización descargada: v${info.version}`);
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