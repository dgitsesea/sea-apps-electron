const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    navigate: (url) => ipcRenderer.send('navigate', url),
    reload: () => ipcRenderer.send('reload'),
    setNavbarHeight: (height) => ipcRenderer.send('set-navbar-height', height),
    getLastUrl: () => ipcRenderer.invoke('get-last-url'),
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    openTiSupport: () => ipcRenderer.send('open-ti-support'),
    closeSupport: () => ipcRenderer.send('close-support'),
    openExternal: (url) => ipcRenderer.send('open-external', url),
    onUpdateStatus: (callback) => {
        ipcRenderer.on('update-status', (_event, status) => {
            callback(status);
        });
    },
    onNavbarThemeColor: (callback) => {
        ipcRenderer.on('navbar-theme-color', (_event, color) => {
            callback(color);
        });
    }
});
