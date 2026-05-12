require('dotenv').config();
const path = require('path');
const { app, BrowserWindow, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');

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

app.whenReady().then(() => {
    createWindow();

    // Verificar si hay actualizaciones disponibles
    autoUpdater.checkForUpdatesAndNotify();
});

// Eventos de actualización
autoUpdater.on('update-available', () => {
    console.log('Actualización disponible. Descargando...');
});

autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox({
        type: 'info',
        title: 'Actualización Disponible',
        message: 'Una nueva versión se ha descargado. Se reiniciará la aplicación para instalarla.',
        buttons: ['Reiniciar y Actualizar']
    }).then(() => {
        autoUpdater.quitAndInstall();
    });
});