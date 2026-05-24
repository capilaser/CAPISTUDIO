import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
import path from 'path'

const isDev = process.env.NODE_ENV !== 'production'

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#1a1a1a',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: process.platform !== 'darwin',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  // Load renderer
  if (isDev) {
    win.loadURL('http://localhost:5174')
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // Show when ready to avoid blank flash
  win.once('ready-to-show', () => {
    win.show()
  })

  return win
}

function buildMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Capi Studio',
      submenu: [
        { label: 'Sobre Capi Studio', role: 'about' },
        { type: 'separator' },
        { label: 'Configurações', accelerator: 'CmdOrCtrl+,', click: () => {} },
        { type: 'separator' },
        { label: 'Sair', role: 'quit' },
      ],
    },
    {
      label: 'Arquivo',
      submenu: [
        { label: 'Novo Projeto', accelerator: 'CmdOrCtrl+N', click: () => {} },
        { label: 'Abrir...', accelerator: 'CmdOrCtrl+O', click: () => {} },
        { type: 'separator' },
        { label: 'Salvar', accelerator: 'CmdOrCtrl+S', click: () => {} },
        { label: 'Salvar Como...', accelerator: 'CmdOrCtrl+Shift+S', click: () => {} },
        { type: 'separator' },
        { label: 'Exportar...', accelerator: 'CmdOrCtrl+E', click: () => {} },
      ],
    },
    {
      label: 'Editar',
      submenu: [
        { label: 'Desfazer', role: 'undo' },
        { label: 'Refazer', role: 'redo' },
        { type: 'separator' },
        { label: 'Recortar', role: 'cut' },
        { label: 'Copiar', role: 'copy' },
        { label: 'Colar', role: 'paste' },
        { label: 'Selecionar Tudo', role: 'selectAll' },
      ],
    },
    {
      label: 'Visualizar',
      submenu: [
        { label: 'Recarregar', role: 'reload' },
        { label: 'DevTools', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: 'Zoom 100%', accelerator: 'CmdOrCtrl+0', click: () => {} },
        { label: 'Aumentar Zoom', accelerator: 'CmdOrCtrl+Plus', click: () => {} },
        { label: 'Diminuir Zoom', accelerator: 'CmdOrCtrl+-', click: () => {} },
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

app.whenReady().then(() => {
  buildMenu()
  const win = createWindow()

  // IPC handlers
  ipcMain.handle('dialog:saveFile', async (_, options) => {
    return dialog.showSaveDialog(win, options)
  })

  ipcMain.handle('dialog:openFile', async (_, options) => {
    return dialog.showOpenDialog(win, options)
  })

  ipcMain.handle('app:getVersion', () => app.getVersion())

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
