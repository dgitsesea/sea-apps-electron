const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    navigate: (url) => ipcRenderer.send('navigate', url),
    reload: () => ipcRenderer.send('reload'),
    getLastUrl: () => ipcRenderer.invoke('get-last-url')
});
