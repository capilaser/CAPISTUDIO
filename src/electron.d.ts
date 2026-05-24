// Type declarations for window.electronAPI exposed by electron/preload.ts

export {}

declare global {
  interface Window {
    electronAPI: {
      // File dialogs
      saveFile: (options: {
        title?: string
        defaultPath?: string
        filters?: { name: string; extensions: string[] }[]
      }) => Promise<{ canceled: boolean; filePath?: string }>

      openFile: (options: {
        title?: string
        defaultPath?: string
        filters?: { name: string; extensions: string[] }[]
        properties?: string[]
      }) => Promise<{ canceled: boolean; filePaths: string[] }>

      // App info
      getVersion: () => Promise<string>

      // Platform
      platform: NodeJS.Platform

      // File system
      writeFile: (filePath: string, content: string) => Promise<{ ok: boolean }>
      readFile: (filePath: string) => Promise<string>
      readdir: (dirPath: string) => Promise<string[]>
      exists: (filePath: string) => Promise<boolean>
      getDocumentsPath: () => Promise<string>
    }
  }
}
