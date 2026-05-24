// Project save/load utilities for Capi Studio
// Saves to Documents/CapiStudio/pedidos/NOME_DATA_NNN/

export interface SavedProject {
  version: '1'
  savedAt: string
  brocheName: string
  state: {
    type: string
    color: string
    logoHref: string
    hasLogo: boolean
    logoSource: string
    activePatternId: string | null
    activeFilter: string
    elements: object
    nameText: string
    nameFont: string
    professionText: string
    professionFont: string
  }
}

function sanitizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .toUpperCase()
    .slice(0, 30) || 'CLIENTE'
}

function formatDateCompact(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

async function findNextIndex(pedidosPath: string, prefix: string): Promise<string> {
  const api = window.electronAPI
  const entries: string[] = await api.readdir(pedidosPath)
  const existing = entries.filter(e => e.startsWith(prefix))
  const indices = existing.map(e => {
    const match = e.match(/_(\d{3})$/)
    return match ? parseInt(match[1], 10) : 0
  })
  const next = indices.length ? Math.max(...indices) + 1 : 1
  return String(next).padStart(3, '0')
}

export async function saveProject(state: SavedProject['state'], docsPath: string): Promise<string | null> {
  try {
    const api = window.electronAPI
    const pedidosPath = `${docsPath}/CapiStudio/pedidos`
    const brocheName = state.nameText || 'CLIENTE'
    const sanitized = sanitizeName(brocheName)
    const dateStr = formatDateCompact(new Date())
    const prefix = `${sanitized}_${dateStr}`

    const idx = await findNextIndex(pedidosPath, prefix)
    const folderName = `${prefix}_${idx}`
    const folderPath = `${pedidosPath}/${folderName}`

    const project: SavedProject = {
      version: '1',
      savedAt: new Date().toISOString(),
      brocheName,
      state,
    }

    await api.writeFile(`${folderPath}/projeto.json`, JSON.stringify(project, null, 2))

    // Save logo separately if base64 present
    if (state.hasLogo && state.logoHref) {
      const href = state.logoHref
      if (href.startsWith('data:image/svg')) {
        await api.writeFile(`${folderPath}/logo_original.svg`, atob(href.split(',')[1]))
      } else if (href.startsWith('data:image/png')) {
        // Store as data URL reference — raw binary write not available via IPC text API
        await api.writeFile(`${folderPath}/logo_original.png.dataurl`, href)
      } else if (href.startsWith('data:image/jpeg') || href.startsWith('data:image/jpg')) {
        await api.writeFile(`${folderPath}/logo_original.jpg.dataurl`, href)
      }
    }

    return folderPath
  } catch (err) {
    console.error('saveProject error:', err)
    return null
  }
}

export async function loadProject(projectPath: string): Promise<SavedProject | null> {
  try {
    const api = window.electronAPI
    const content = await api.readFile(`${projectPath}/projeto.json`)
    return JSON.parse(content) as SavedProject
  } catch (err) {
    console.error('loadProject error:', err)
    return null
  }
}

export async function listRecentProjects(docsPath: string): Promise<{ name: string; path: string; savedAt: string }[]> {
  try {
    const api = window.electronAPI
    const pedidosPath = `${docsPath}/CapiStudio/pedidos`
    const entries: string[] = await api.readdir(pedidosPath)

    const results: { name: string; path: string; savedAt: string }[] = []

    for (const entry of entries) {
      const folderPath = `${pedidosPath}/${entry}`
      const jsonPath = `${folderPath}/projeto.json`
      const exists = await api.exists(jsonPath)
      if (!exists) continue
      try {
        const content = await api.readFile(jsonPath)
        const proj = JSON.parse(content) as SavedProject
        results.push({
          name: proj.brocheName || entry,
          path: folderPath,
          savedAt: proj.savedAt,
        })
      } catch {
        // skip corrupted entries
      }
    }

    // Sort newest first
    results.sort((a, b) => b.savedAt.localeCompare(a.savedAt))
    return results
  } catch (err) {
    console.error('listRecentProjects error:', err)
    return []
  }
}
