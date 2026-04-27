const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')
const http = require('http')
const fs = require('fs')

const SETTINGS_PORT = 47832

function settingsFile() {
  return path.join(app.getPath('userData'), 'intent-settings.json')
}

function loadSettingsFromFile() {
  try { return JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) } catch { return null }
}

function saveSettingsToFile(data) {
  try { fs.writeFileSync(settingsFile(), JSON.stringify(data)) } catch {}
}

function startSettingsServer(getWindow) {
  const server = http.createServer((req, res) => {
    const addr = req.socket.remoteAddress
    if (addr !== '127.0.0.1' && addr !== '::1' && addr !== '::ffff:127.0.0.1') {
      res.writeHead(403); res.end(); return
    }
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }
    if (req.method === 'POST' && req.url === '/settings') {
      let body = ''
      req.on('data', chunk => { body += chunk })
      req.on('end', () => {
        try {
          const data = JSON.parse(body)
          saveSettingsToFile(data)
          const win = getWindow()
          if (win) win.webContents.send('settings-from-extension', data)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end('{"ok":true}')
        } catch { res.writeHead(400); res.end() }
      })
      return
    }
    res.writeHead(404); res.end()
  })
  server.listen(SETTINGS_PORT, '127.0.0.1')
}

ipcMain.handle('get-settings', () => loadSettingsFromFile())

ipcMain.handle('open-extension-folder', () => {
  const extensionPath = app.isPackaged
    ? path.join(process.resourcesPath, 'extension')
    : path.join(app.getAppPath(), '..')
  return shell.openPath(extensionPath)
})

let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  })
  mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'))
}

app.whenReady().then(() => {
  startSettingsServer(() => mainWindow)
  createWindow()
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
