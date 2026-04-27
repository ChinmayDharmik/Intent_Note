const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronBridge', {
  getInitialSettings:        () => ipcRenderer.invoke('get-settings'),
  onSettingsFromExtension:   (cb) => ipcRenderer.on('settings-from-extension', (_, data) => cb(data)),
  openExtensionFolder:       () => ipcRenderer.invoke('open-extension-folder'),
  getCaptures:               () => ipcRenderer.invoke('get-captures'),
  patchCapture:              (id, data) => ipcRenderer.invoke('patch-capture', id, data),
  deleteCapture:             (id) => ipcRenderer.invoke('delete-capture', id),
  onCapturesUpdated:         (cb) => ipcRenderer.on('captures-updated', () => cb()),
})
