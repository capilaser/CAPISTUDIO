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
}

contextBridge.exposeInMainWorld('electronAPI', api)

// Type augmentation for renderer
declare global {
  interface Window {
    electronAPI: typeof api
  }
}
