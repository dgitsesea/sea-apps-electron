const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    navigate: (url) => ipcRenderer.send('navigate', url),
    reload: () => ipcRenderer.send('reload'),
    openAppMenu: (groupId, point) => ipcRenderer.send('open-app-menu', groupId, point),
    getLastUrl: () => ipcRenderer.invoke('get-last-url'),
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    restartAndUpdate: () => ipcRenderer.invoke('restart-and-update'),
    openTiSupport: () => ipcRenderer.send('open-ti-support'),
    closeSupport: () => ipcRenderer.send('close-support'),
    openExternal: (url) => ipcRenderer.send('open-external', url),
    onUpdateStatus: (callback) => {
        ipcRenderer.on('update-status', (_event, status) => {
            callback(status);
        });
    },
    onNavigationState: (callback) => {
        ipcRenderer.on('navigation-state', (_event, state) => {
            callback(state);
        });
    },
    onNavbarThemeColor: (callback) => {
        ipcRenderer.on('navbar-theme-color', (_event, color) => {
            callback(color);
        });
    }
});
