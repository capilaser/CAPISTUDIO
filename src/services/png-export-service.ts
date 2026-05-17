/**
 * png-export-service.ts — Orquestra export PNG (Onda 9.F).
 *
 * Junta:
 *   - core/export/png-exporter (Fase 9E) pra gerar bytes
 *   - Tauri fs (escrever arquivo)
 *   - Tauri shell (abrir Explorer)
 *   - settingsRepository (persistir última pasta usada)
 *
 * Por que existe (não está no dialog direto):
 *   - Testável isoladamente sem renderizar React
 *   - Tauri APIs ficam contidas — fácil mockar em teste
 *   - Reuso futuro: Onda 11 (export em lote pra pedido aprovado),
 *     export programático sem UI
 *
 * Tudo que toca Tauri é injetado via `TauriIO` — em runtime UI usa
 * implementação real; em testes passa mocks (vi.fn).
 */
import { getSetting, setSetting } from '@/data/repositories/settingsRepository';
import { normalizeAssetName } from '@/lib/normalize-asset-name';

/** Key do settings onde persistimos a última pasta de export usada. */
export const EXPORT_LAST_FOLDER_KEY = 'export.lastFolder';

/**
 * Adapter pras 3 chamadas Tauri que o service faz. Injetado pra testes
 * mockarem sem precisar de runtime Tauri.
 *
 * Em runtime, criamos via `makeTauriIO()` que compõe os 3 plugins reais.
 */
export interface TauriIO {
  /** Grava bytes binários no path absoluto. */
  writeFile(path: string, bytes: Uint8Array): Promise<void>;
  /** Abre Explorer/Finder no path da pasta. */
  openFolder(path: string): Promise<void>;
  /** Resolve o "Documents" folder do usuário (default quando settings vazio). */
  documentDir(): Promise<string>;
  /** Junta segmentos de caminho com o separador da plataforma. */
  joinPath(...segments: string[]): Promise<string>;
}

export interface BuildFilenameOptions {
  cliente: string;
  profissao: string;
  /**
   * Onda 17 — data carimbada no nome. Default `new Date()` (now).
   * Injetável pra testes determinísticos.
   */
  date?: Date;
  /**
   * Onda 17 — quantidade de broches na prancha. Quando > 1, o nome ganha
   * prefixo `lote_Nx_`. Default 1 (single broche, sem prefixo).
   */
  boardItemCount?: number;
}

/**
 * Onda 17 — Formata data como `YYYY-MM-DD` em horário LOCAL.
 *
 * Por que local e não UTC: operador no Brasil exportando às 22h–23h não
 * quer arquivo carimbado com data de amanhã. O locale `sv-SE` produz o
 * formato ISO sem precisar montar string manualmente.
 *
 * Exportado pra teste unitário.
 */
export function isoDate(d: Date): string {
  return d.toLocaleDateString('sv-SE');
}

/**
 * Gera o nome do arquivo `.png` a partir de cliente + profissão + data.
 *
 * Regras (briefing Onda 17):
 *   - Single "João Silva" + "Advogado" + 2026-05-17
 *       → "joao-silva-advogado_2026-05-17.png"
 *   - Cliente vazio (qualquer profissão) → "mockup_2026-05-17.png"
 *   - Cliente preenchido + profissão vazia → "joao-silva_2026-05-17.png"
 *   - Multi-broche (boardItemCount > 1)
 *       → "lote_5x_joao-silva-advogado_2026-05-17.png"
 *   - Multi + cliente vazio
 *       → "lote_5x_mockup_2026-05-17.png"
 *
 * Exportado pra teste unitário + uso direto pelo dialog (preview em tempo real).
 */
export function buildPngFilename(opts: BuildFilenameOptions): string {
  const cliente = opts.cliente.trim();
  const profissao = opts.profissao.trim();
  const date = opts.date ?? new Date();
  const count = opts.boardItemCount ?? 1;

  const dateStr = isoDate(date);

  let stem: string;
  if (cliente.length === 0) {
    stem = 'mockup';
  } else {
    const normCliente = normalizeAssetName(cliente);
    const normProf = profissao.length > 0 ? normalizeAssetName(profissao) : '';
    stem = normProf.length > 0 ? `${normCliente}-${normProf}` : normCliente;
  }

  const prefix = count > 1 ? `lote_${count}x_` : '';
  return `${prefix}${stem}_${dateStr}.png`;
}

/**
 * Retorna a pasta default pra exportação:
 *   1. settings `export.lastFolder` se existir
 *   2. caso contrário, `documentDir()` do Tauri (Documents do usuário)
 */
export async function getDefaultExportFolder(io: TauriIO): Promise<string> {
  const fromSettings = await getSetting(EXPORT_LAST_FOLDER_KEY);
  if (fromSettings && fromSettings.length > 0) return fromSettings;
  return io.documentDir();
}

export interface SavePngOptions {
  /** Bytes do PNG (vem de png-exporter.exportPngMockup). */
  bytes: Uint8Array;
  /** Pasta de destino (absoluto). */
  folder: string;
  /** Nome do arquivo (gerado por buildPngFilename). */
  filename: string;
  /** Se true, abre Explorer/Finder na pasta após salvar. Default true. */
  openFolderAfter?: boolean;
  /** Se true, persiste `folder` em settings.export.lastFolder. Default true. */
  rememberFolder?: boolean;
}

export interface SavePngResult {
  /** Path absoluto do arquivo salvo. */
  path: string;
}

/**
 * Salva os bytes do PNG no path escolhido, persiste a pasta nos settings,
 * e (opcional) abre Explorer/Finder na pasta. Erros de IO são propagados —
 * o caller (dialog) mostra toast.
 */
export async function savePng(io: TauriIO, opts: SavePngOptions): Promise<SavePngResult> {
  const { bytes, folder, filename, openFolderAfter = true, rememberFolder = true } = opts;

  const path = await io.joinPath(folder, filename);
  await io.writeFile(path, bytes);

  if (rememberFolder) {
    await setSetting(EXPORT_LAST_FOLDER_KEY, folder);
  }
  if (openFolderAfter) {
    // Não bloqueante. Falhar ao abrir Explorer não é fatal (arquivo já foi
    // salvo); silencioso aqui pra não dar toast errado de sucesso+erro.
    try {
      await io.openFolder(folder);
    } catch (err) {
      console.warn(`[png-export-service] openFolder falhou (não-fatal): ${String(err)}`);
    }
  }

  return { path };
}
