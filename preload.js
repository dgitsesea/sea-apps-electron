const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    navigate: (url) => ipcRenderer.send('navigate', url),
    reload: () => ipcRenderer.send('reload'),
    getLastUrl: () => ipcRenderer.invoke('get-last-url'),
    openTiSupport: () => ipcRenderer.send('open-ti-support'),
    closeSupport: () => ipcRenderer.send('close-support'),
    openExternal: (url) => ipcRenderer.send('open-external', url)
});
