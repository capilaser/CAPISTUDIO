/**
 * projectFsRepository — wrapper TypeScript dos comandos Tauri de projeto
 * (filesystem-first). Toda interação com pastas de projeto passa por aqui.
 *
 * Os comandos Rust correspondentes estão em `src-tauri/src/projects.rs`.
 * Hardening (path traversal, tamanho de arquivo, nome de pasta) é feito no
 * Rust — este repository só valida formato antes de invocar.
 */

import { invoke } from '@tauri-apps/api/core';

import { CPS_SCHEMA_VERSION, type ProjectFile, newProjectFile } from '@/core/project/project-file';

/** Resumo de um projeto na pasta raiz (usado na tela inicial). */
export interface ProjectSummary {
  folderName: string;
  folderPath: string;
  name: string | null;
  productId: string | null;
  updatedAt: string | null;
  thumbnailPath: string | null;
  fileSize: number | null;
}

interface RawProjectSummary {
  folder_name: string;
  folder_path: string;
  name: string | null;
  product_id: string | null;
  updated_at: string | null;
  thumbnail_path: string | null;
  file_size: number | null;
}

function fromRaw(r: RawProjectSummary): ProjectSummary {
  return {
    folderName: r.folder_name,
    folderPath: r.folder_path,
    name: r.name,
    productId: r.product_id,
    updatedAt: r.updated_at,
    thumbnailPath: r.thumbnail_path,
    fileSize: r.file_size,
  };
}

/** Lê a raiz configurada dos projetos (cria se não existe). */
export async function getProjectsRoot(): Promise<string> {
  return invoke<string>('get_projects_root');
}

/** Define a raiz dos projetos. Retorna o caminho canônico salvo. */
export async function setProjectsRoot(absolutePath: string): Promise<string> {
  return invoke<string>('set_projects_root', { path: absolutePath });
}

/** Lista todos os projetos da raiz, ordenados por `updatedAt` desc. */
export async function listProjects(): Promise<ProjectSummary[]> {
  const raw = await invoke<RawProjectSummary[]>('list_projects');
  return raw.map(fromRaw);
}

/** Cria um projeto novo a partir de um `ProjectFile`. Retorna o `folderPath` criado. */
export async function createProject(args: {
  name: string;
  productId: string;
  widthMm: number;
  heightMm: number;
  viewBox: string;
}): Promise<{ folderPath: string; project: ProjectFile }> {
  const project = newProjectFile(args);
  const cpsJson = JSON.stringify(project, null, 2);
  const folderPath = await invoke<string>('create_project', {
    name: args.name,
    cpsJson,
  });
  return { folderPath, project };
}

/** Lê o `projeto.cps.json` de uma pasta de projeto. Lança se inválido. */
export async function readProject(folderPath: string): Promise<ProjectFile> {
  const raw = await invoke<string>('read_project', { folderPath });
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`projeto.cps.json inválido: ${(e as Error).message}`);
  }
  if (!isProjectFile(parsed)) {
    throw new Error('projeto.cps.json não tem o formato esperado.');
  }
  if (parsed.schemaVersion > CPS_SCHEMA_VERSION) {
    throw new Error(
      `projeto.cps.json foi gravado por uma versão futura do Capi Studio (v${parsed.schemaVersion}).`
    );
  }
  return parsed;
}

/**
 * Grava o projeto na pasta. Escrita atômica (temp + rename) no Rust.
 * Atualiza `meta.updatedAt` antes de gravar — caller não precisa.
 *
 * `thumbnailPngBase64` opcional: se passar, grava também `thumbnail.png`.
 * O base64 não deve incluir o prefixo `data:image/png;base64,`.
 */
export async function writeProject(
  folderPath: string,
  project: ProjectFile,
  thumbnailPngBase64?: string
): Promise<void> {
  const updated: ProjectFile = {
    ...project,
    meta: { ...project.meta, updatedAt: new Date().toISOString() },
  };
  const cpsJson = JSON.stringify(updated, null, 2);
  await invoke('write_project', {
    folderPath,
    cpsJson,
    thumbnailPngBase64: thumbnailPngBase64 ?? null,
  });
}

/**
 * Move o projeto para `_trash` dentro da raiz (não apaga de vez).
 * Operação reversível manualmente até limpar a lixeira.
 */
export async function deleteProject(folderPath: string): Promise<void> {
  await invoke('delete_project', { folderPath });
}

/** Abre a pasta do projeto no Explorer / Finder. */
export async function openProjectFolder(folderPath: string): Promise<void> {
  await invoke('open_project_folder', { folderPath });
}

/** Lê o SVG embarcado da base de um produto (hoje só `broche-60x25`). */
export async function getProductBaseSvg(productId: string): Promise<string> {
  return invoke<string>('get_product_base_svg', { productId });
}

// ─────────────────────────────────────────────────────────────────────────────
// Type guard mínimo para sanidade ao ler arquivo
// ─────────────────────────────────────────────────────────────────────────────

function isProjectFile(x: unknown): x is ProjectFile {
  if (!x || typeof x !== 'object') return false;
  const obj = x as Record<string, unknown>;
  if (typeof obj.schemaVersion !== 'number') return false;
  if (!obj.meta || typeof obj.meta !== 'object') return false;
  if (!obj.viewport || typeof obj.viewport !== 'object') return false;
  if (!Array.isArray(obj.layers)) return false;
  if (!Array.isArray(obj.objects)) return false;
  return true;
}
