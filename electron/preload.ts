import { contextBridge, ipcRenderer } from 'electron'

export type SaveDialogOptions = Electron.SaveDialogOptions
export type OpenDialogOptions = Electron.OpenDialogOptions

const api = {
  // File dialogs
  saveFile: (options: SaveDialogOptions) =>
    ipcRenderer.invoke('dialog:saveFile', options),
  openFile: (options: OpenDialogOptions) =>
    ipcRenderer.invoke('dialog:openFile', options),

  // App info
  getVersion: (): Promise<string> =>
    ipcRenderer.invoke('app:getVersion'),

  // Platform
  platform: process.platform as NodeJS.Platform,

  // File system
  writeFile: (filePath: string, content: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('fs:writeFile', filePath, content),
  readFile: (filePath: string): Promise<string> =>
    ipcRenderer.invoke('fs:readFile', filePath),
  readdir: (dirPath: string): Promise<string[]> =>
    ipcRenderer.invoke('fs:readdir', dirPath),
  exists: (filePath: string): Promise<boolean> =>
    ipcRenderer.invoke('fs:exists', filePath),
  getDocumentsPath: (): Promise<string> =>
    ipcRenderer.invoke('app:getDocumentsPath'),
}

contextBridge.exposeInMainWorld('electronAPI', api)

// Type augmentation for renderer
declare global {
  interface Window {
    electronAPI: typeof api
  }
}
