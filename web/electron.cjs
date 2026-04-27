const { app, BrowserWindow, ipcMain, shell } = require('electron')
const { DatabaseSync } = require('node:sqlite')
const path = require('path')
const http = require('http')
const fs = require('fs')

const SETTINGS_PORT = 47832

// ─── Settings file ────────────────────────────────────────────────────────────

function settingsFile() {
  return path.join(app.getPath('userData'), 'intent-settings.json')
}
function loadSettingsFromFile() {
  try { return JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) } catch { return null }
}
function saveSettingsToFile(data) {
  try { fs.writeFileSync(settingsFile(), JSON.stringify(data)) } catch {}
}

// ─── SQLite ───────────────────────────────────────────────────────────────────

let db

function initDb() {
  db = new DatabaseSync(path.join(app.getPath('userData'), 'captures.db'))
  db.exec(`
    CREATE TABLE IF NOT EXISTS captures (
      id         TEXT PRIMARY KEY,
      intent     TEXT,
      title      TEXT,
      reason     TEXT,
      extract    TEXT,
      tags       TEXT,
      raw_text   TEXT,
      url        TEXT,
      page_title TEXT,
      saved_at   TEXT,
      deleted_at TEXT,
      distillation TEXT
    )
  `)
}

function rowToCapture(row) {
  return {
    ...row,
    tags:        row.tags        ? JSON.parse(row.tags)        : [],
    distillation: row.distillation ? JSON.parse(row.distillation) : null,
  }
}

function upsertCapture(capture) {
  const row = {
    id:          capture.id,
    intent:      capture.intent      ?? null,
    title:       capture.title       ?? null,
    reason:      capture.reason      ?? null,
    extract:     capture.extract     ?? null,
    tags:        JSON.stringify(capture.tags || []),
    raw_text:    capture.raw_text    ?? null,
    url:         capture.url         ?? null,
    page_title:  capture.page_title  ?? null,
    saved_at:    capture.saved_at    ?? null,
    deleted_at:  capture.deleted_at  ?? null,
    distillation: capture.distillation ? JSON.stringify(capture.distillation) : null,
  }
  db.prepare(`
    INSERT OR REPLACE INTO captures
      (id, intent, title, reason, extract, tags, raw_text, url, page_title, saved_at, deleted_at, distillation)
    VALUES
      (:id, :intent, :title, :reason, :extract, :tags, :raw_text, :url, :page_title, :saved_at, :deleted_at, :distillation)
  `).run(row)
}

// ─── IPC ──────────────────────────────────────────────────────────────────────

ipcMain.handle('get-settings', () => loadSettingsFromFile())

ipcMain.handle('open-extension-folder', () => {
  const extensionPath = app.isPackaged
    ? path.join(process.resourcesPath, 'extension')
    : path.join(app.getAppPath(), '..')
  return shell.openPath(extensionPath)
})

ipcMain.handle('get-captures', () => {
  return db.prepare(
    'SELECT * FROM captures WHERE deleted_at IS NULL ORDER BY saved_at DESC'
  ).all().map(rowToCapture)
})

ipcMain.handle('patch-capture', (_, id, data) => {
  const fields = { ...data }
  if (Array.isArray(fields.tags))         fields.tags         = JSON.stringify(fields.tags)
  if (Array.isArray(fields.distillation)) fields.distillation = JSON.stringify(fields.distillation)
  const keys = Object.keys(fields)
  const setClause = keys.map(k => `${k} = :${k}`).join(', ')
  db.prepare(`UPDATE captures SET ${setClause} WHERE id = :id`).run({ ...fields, id })
})

// ─── Local HTTP server ────────────────────────────────────────────────────────

function startServer(getWindow) {
  const server = http.createServer((req, res) => {
    const addr = req.socket.remoteAddress
    if (addr !== '127.0.0.1' && addr !== '::1' && addr !== '::ffff:127.0.0.1') {
      res.writeHead(403); res.end(); return
    }
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, PATCH, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      try {
        const data = JSON.parse(body)

        if (req.method === 'POST' && req.url === '/settings') {
          saveSettingsToFile(data)
          const win = getWindow()
          if (win) win.webContents.send('settings-from-extension', data)
          res.writeHead(200); res.end('{"ok":true}'); return
        }

        if (req.method === 'POST' && req.url === '/captures') {
          upsertCapture(data)
          res.writeHead(200); res.end('{"ok":true}'); return
        }

        if (req.method === 'PATCH' && req.url.startsWith('/captures/')) {
          const id = decodeURIComponent(req.url.slice('/captures/'.length))
          const keys = Object.keys(data)
          const setClause = keys.map(k => `${k} = :${k}`).join(', ')
          db.prepare(`UPDATE captures SET ${setClause} WHERE id = :id`).run({ ...data, id })
          res.writeHead(200); res.end('{"ok":true}'); return
        }

        res.writeHead(404); res.end()
      } catch { res.writeHead(400); res.end() }
    })
  })
  server.listen(SETTINGS_PORT, '127.0.0.1')
}

// ─── Window ───────────────────────────────────────────────────────────────────

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
  initDb()
  startServer(() => mainWindow)
  createWindow()
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
