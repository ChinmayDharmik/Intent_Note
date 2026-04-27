const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronBridge', {
  getInitialSettings: () => ipcRenderer.invoke('get-settings'),
  onSettingsFromExtension: (cb) => ipcRenderer.on('settings-from-extension', (_, data) => cb(data)),
  openExtensionFolder: () => ipcRenderer.invoke('open-extension-folder'),
})
