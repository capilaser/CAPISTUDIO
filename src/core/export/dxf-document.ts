/**
 * dxf-document.ts — Montador do documento DXF AC1032 completo.
 *
 * Sub-onda DXF-1. Recebe lista de SPLINEs já encoded + bbox normalizado
 * → emite string DXF AC1032 completa, pronta para gravar em disco e abrir
 * no RDWorks/LaserCAD.
 *
 * Estrutura emitida (mínima viável AC1032 segundo ADR 020):
 *   - SECTION HEADER  → $ACADVER=AC1032, $INSUNITS=4, $MEASUREMENT=1,
 *                       $EXTMIN/$EXTMAX, $LIMMIN/$LIMMAX
 *   - SECTION TABLES  → tabela LTYPE (Continuous) + tabela LAYER (0, Camada 1)
 *   - SECTION BLOCKS  → vazia (*Model_Space e *Paper_Space)
 *   - SECTION ENTITIES → as SPLINEs
 *   - EOF
 *
 * Diferenças deliberadas vs DXF de referência:
 *   - $MEASUREMENT=1 (corrigido — referência tinha 0, inconsistente com mm)
 *   - Coordenadas normalizadas: bbox arte em (0,0)..(W,H), Y positivo p/ baixo
 *   - Sem seção CLASSES (não necessária para RDWorks ler SPLINEs simples)
 *   - Sem seção OBJECTS (idem)
 *   - Sem handles arbitrárias 5F/46/etc (handles são opcionais em AC1032
 *     quando $HANDLING não está setado; emitimos handles sequenciais simples)
 *
 * CRLF entre tokens (\r\n). Encoding ASCII, sem BOM, codepage ANSI_1252.
 */

import { SINGLE_LAYER_NAME } from './dxf-spline-encoder';

export interface DxfBounds {
  /** mm. Esperado: 0 em produção normalizada. */
  minX: number;
  /** mm. Esperado: 0 em produção normalizada. */
  minY: number;
  /** mm. Largura do produto. */
  maxX: number;
  /** mm. Altura do produto. */
  maxY: number;
}

export interface DxfDocumentInput {
  /** Bbox da arte em mm (já normalizado para origem 0,0). */
  bounds: DxfBounds;
  /**
   * Linhas DXF de cada SPLINE (output do `encodeSpline`). Lista plana — o
   * caller já fez o split por máquina antes de chamar este montador.
   */
  splineEntities: string[][];
}

/**
 * Monta o documento DXF AC1032 completo como string.
 */
export function buildDxfDocument(input: DxfDocumentInput): string {
  const { bounds, splineEntities } = input;

  const lines: string[] = [];

  emitHeader(lines, bounds);
  emitTables(lines);
  emitBlocks(lines);
  emitEntities(lines, splineEntities);
  emitEof(lines);

  return lines.join('\r\n') + '\r\n';
}

// ── HEADER ───────────────────────────────────────────────────────────────────

function emitHeader(lines: string[], bounds: DxfBounds): void {
  push(lines, 0, 'SECTION');
  push(lines, 2, 'HEADER');

  // Versão DXF — AC1032 = AutoCAD 2018, suporta SPLINE estável.
  pushVar(lines, '$ACADVER', 1, 'AC1032');

  // Code page declarada (réplica do real). Ruida ignora, mas é convenção.
  pushVar(lines, '$DWGCODEPAGE', 3, 'ANSI_1252');

  // Insertion base point.
  pushVar3D(lines, '$INSBASE', 0, 0, 0);

  // Extents da geometria — atualizados pelo bbox real da arte.
  pushVar3D(lines, '$EXTMIN', bounds.minX, bounds.minY, 0);
  pushVar3D(lines, '$EXTMAX', bounds.maxX, bounds.maxY, 0);

  // Drawing limits (igual ao extent neste fluxo).
  pushVar2D(lines, '$LIMMIN', bounds.minX, bounds.minY);
  pushVar2D(lines, '$LIMMAX', bounds.maxX, bounds.maxY);

  // Unidades = milímetros.
  pushVar(lines, '$INSUNITS', 70, '4');
  // Measurement system = metric (corrige inconsistência do DXF real).
  pushVar(lines, '$MEASUREMENT', 70, '1');
  // Linear units format = decimal, 4 casas.
  pushVar(lines, '$LUNITS', 70, '2');
  pushVar(lines, '$LUPREC', 70, '4');

  push(lines, 0, 'ENDSEC');
}

// ── TABLES ───────────────────────────────────────────────────────────────────

function emitTables(lines: string[]): void {
  push(lines, 0, 'SECTION');
  push(lines, 2, 'TABLES');

  // LTYPE table: 1 entrada "Continuous" (referenciada pelas layers).
  push(lines, 0, 'TABLE');
  push(lines, 2, 'LTYPE');
  push(lines, 70, '1');

  push(lines, 0, 'LTYPE');
  push(lines, 2, 'Continuous');
  push(lines, 70, '0');
  push(lines, 3, 'Solid line');
  push(lines, 72, '65');
  push(lines, 73, '0');
  push(lines, 40, '0.0');

  push(lines, 0, 'ENDTAB');

  // LAYER table: layer "0" (default obrigatória) + "Camada 1" (a usada).
  push(lines, 0, 'TABLE');
  push(lines, 2, 'LAYER');
  push(lines, 70, '2');

  emitLayer(lines, '0');
  emitLayer(lines, SINGLE_LAYER_NAME);

  push(lines, 0, 'ENDTAB');

  push(lines, 0, 'ENDSEC');
}

function emitLayer(lines: string[], name: string): void {
  push(lines, 0, 'LAYER');
  push(lines, 2, name);
  push(lines, 70, '0'); // flags: standard
  push(lines, 62, '7'); // cor da layer (ignorada — cor é por entidade)
  push(lines, 6, 'Continuous');
}

// ── BLOCKS ───────────────────────────────────────────────────────────────────

function emitBlocks(lines: string[]): void {
  push(lines, 0, 'SECTION');
  push(lines, 2, 'BLOCKS');

  // *Model_Space (obrigatório).
  push(lines, 0, 'BLOCK');
  push(lines, 8, '0');
  push(lines, 2, '*Model_Space');
  push(lines, 70, '0');
  push(lines, 10, '0.0');
  push(lines, 20, '0.0');
  push(lines, 30, '0.0');
  push(lines, 3, '*Model_Space');
  push(lines, 1, '');
  push(lines, 0, 'ENDBLK');
  push(lines, 8, '0');

  // *Paper_Space (obrigatório por convenção).
  push(lines, 0, 'BLOCK');
  push(lines, 8, '0');
  push(lines, 2, '*Paper_Space');
  push(lines, 70, '0');
  push(lines, 10, '0.0');
  push(lines, 20, '0.0');
  push(lines, 30, '0.0');
  push(lines, 3, '*Paper_Space');
  push(lines, 1, '');
  push(lines, 0, 'ENDBLK');
  push(lines, 8, '0');

  push(lines, 0, 'ENDSEC');
}

// ── ENTITIES ─────────────────────────────────────────────────────────────────

function emitEntities(lines: string[], splineEntities: string[][]): void {
  push(lines, 0, 'SECTION');
  push(lines, 2, 'ENTITIES');

  for (const spline of splineEntities) {
    // Cada entrada é um array de linhas (já formatadas pelo encodeSpline).
    for (const line of spline) {
      lines.push(line);
    }
  }

  push(lines, 0, 'ENDSEC');
}

// ── EOF ──────────────────────────────────────────────────────────────────────

function emitEof(lines: string[]): void {
  push(lines, 0, 'EOF');
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function push(lines: string[], code: number, value: string): void {
  lines.push(formatCode(code));
  lines.push(value);
}

/** Variável de header: código 9 + nome, depois (code, value). */
function pushVar(lines: string[], name: string, code: number, value: string): void {
  push(lines, 9, name);
  push(lines, code, value);
}

function pushVar2D(lines: string[], name: string, x: number, y: number): void {
  push(lines, 9, name);
  push(lines, 10, num(x));
  push(lines, 20, num(y));
}

function pushVar3D(lines: string[], name: string, x: number, y: number, z: number): void {
  push(lines, 9, name);
  push(lines, 10, num(x));
  push(lines, 20, num(y));
  push(lines, 30, num(z));
}

/**
 * Códigos DXF são canonicamente right-aligned em 3 chars com leading spaces
 * (estilo AutoCAD). Parsers ignoram whitespace de leading, mas seguimos a
 * convenção para diff visual mais limpo contra o arquivo de referência.
 */
function formatCode(code: number): string {
  return String(code).padStart(3, ' ');
}

function num(n: number): string {
  // Inteiros vão como "0" / "1". Decimais usam toString() (locale-independent).
  if (Number.isInteger(n)) return `${n}.0`;
  return n.toString();
}
