require('dotenv').config();
const path = require('path');
const { app, BrowserWindow, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

// ─── Configuración del logger ─────────────────────────────────────
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
log.info('Aplicación iniciada.');

// ─── Creación de ventana ──────────────────────────────────────────
function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        autoHideMenuBar: true,
        show: false,
        icon: path.join(__dirname, 'ico.ico')
    });

    const urlToLoad = process.env.PAGINA_ABRIR || 'https://plataformadigital.guanajuato.gob.mx/';
    win.loadURL(urlToLoad);

    win.once('ready-to-show', () => {
        win.show();
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