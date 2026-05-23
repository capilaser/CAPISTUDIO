/**
 * dxf-test-files.test.ts — Gera 3 DXFs de validação manual no RDWorks.
 *
 * NÃO É UM TESTE DE REGRESSÃO. É um script throwaway disfarçado de teste para
 * aproveitar o runner Vitest (alias @/, jsdom, resolução de fabric, etc).
 *
 * Saída em `docs/DOCS/REFERENCE/DXF/test-output/`:
 *   - TESTE_CORTE_BROCHE_60x25.dxf     — broche arredondado, corte (cor 31)
 *   - TESTE_GRAVACAO_TEXTO.dxf         — "TESTE" vetorizado, gravacao (cor 250)
 *   - TESTE_MARCACAO_AZUL.dxf          — cruz simples + 2 linhas, marcacao (cor 5)
 *
 * Como rodar:
 *   npx vitest run scripts/dxf-test-files.test.ts
 *
 * Como validar:
 *   1. Abrir cada DXF no RDWorks/LaserCAD.
 *   2. Verificar: abre sem erro, cor correta detectada, escala 60×25 em mm,
 *      curvas suaves (sem facetamento de POLYLINE), nada de TEXT/MTEXT.
 *
 * Critério de sucesso: 3 arquivos abrem corretamente → seguimos para DXF-3.
 * Critério de falha: 1+ não abrem ou aparecem errados → corrigir fundação.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { normalizeForDxf } from '@/core/export/dxf-coordinate-normalize';
import { buildDxfDocument, type DxfBounds } from '@/core/export/dxf-document';
import { svgPathToSplines } from '@/core/export/dxf-path-to-splines';
import { encodeSpline, type SplineInput } from '@/core/export/dxf-spline-encoder';

const OUTPUT_DIR = resolve(process.cwd(), 'docs', 'DOCS', 'REFERENCE', 'DXF', 'test-output');

function writeDxf(filename: string, bounds: DxfBounds, splines: SplineInput[]): string {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  // Pipeline correto: flip Y do sistema SVG (Y para baixo) para o sistema
  // DXF (Y para cima, convenção CAD). Sem isso, RDWorks abre tudo espelhado
  // verticalmente — texto de cabeça pra baixo, layout invertido.
  const flipped = normalizeForDxf(splines, bounds);
  const splineLines = flipped.map((s) => encodeSpline(s));
  const dxf = buildDxfDocument({ bounds, splineEntities: splineLines });
  const fullPath = resolve(OUTPUT_DIR, filename);
  writeFileSync(fullPath, dxf, { encoding: 'ascii' });
  return fullPath;
}

describe('DXF test files for manual RDWorks validation', () => {
  // ── 1. BROCHE 60×25 ARREDONDADO (corte) ────────────────────────────────────
  it('gera TESTE_CORTE_BROCHE_60x25.dxf', () => {
    // Broche 60×25 com cantos arredondados r=3.
    // Path SVG: começa em (3, 0), vai pela borda no sentido horário,
    // 4 cantos em arc com sweep=1, fecha com Z.
    //
    // Ordem dos cantos:
    //   - top-left: arc de (0, 3) → (3, 0)         start no canto
    //   - top-right: arc de (57, 0) → (60, 3)
    //   - bottom-right: arc de (60, 22) → (57, 25)
    //   - bottom-left: arc de (3, 25) → (0, 22)
    const d =
      'M 3 0 ' + // start: top edge, after top-left corner
      'L 57 0 ' + // top edge
      'A 3 3 0 0 1 60 3 ' + // top-right corner
      'L 60 22 ' + // right edge
      'A 3 3 0 0 1 57 25 ' + // bottom-right corner
      'L 3 25 ' + // bottom edge
      'A 3 3 0 0 1 0 22 ' + // bottom-left corner
      'L 0 3 ' + // left edge
      'A 3 3 0 0 1 3 0 ' + // top-left corner (closes geometrically)
      'Z';

    const splines = svgPathToSplines(d, { process: 'corte' });
    expect(splines.length).toBeGreaterThan(0);
    // Sanidade: todas têm cor de corte e estão no formato esperado.
    for (const s of splines) {
      expect(s.process).toBe('corte');
      expect(s.controlPoints.length % 3).toBe(1); // 3N+1 para N segmentos
    }
    // A última SPLINE do subpath fechado tem closed=true.
    expect(splines[splines.length - 1]!.closed).toBe(true);

    const path = writeDxf(
      'TESTE_CORTE_BROCHE_60x25.dxf',
      { minX: 0, minY: 0, maxX: 60, maxY: 25 },
      splines
    );
    console.log(`[gerado] ${path}  (${splines.length} SPLINEs, cor 31)`);
  });

  // ── 2. TEXTO "TESTE" VETORIZADO (gravação) ─────────────────────────────────
  it('gera TESTE_GRAVACAO_TEXTO.dxf', () => {
    // 5 letras desenhadas como geometria. Cada letra cabe num retângulo
    // de 8×12mm. Espaçamento de 2mm entre letras. Origem do texto: (5, 6).
    //
    // Total: 5×8 + 4×2 = 48mm de largura, altura 12mm.
    // Bbox final: (5, 6) → (53, 18). Cabe num broche 60×25mm.
    //
    // Letras "TESTE":
    //   T: barra horizontal superior + traço vertical central
    //   E: barra vertical esquerda + 3 horizontais
    //   S: 2 curvas em S (Q quadráticas)
    //   T: igual ao 1º
    //   E: igual ao 1º

    const letterWidth = 8;
    const letterHeight = 12;
    const letterGap = 2;
    const startX = 5;
    const startY = 6;
    const splines: SplineInput[] = [];

    function letterT(originX: number, originY: number): SplineInput[] {
      // Barra horizontal superior + traço vertical central.
      const d =
        `M ${originX} ${originY} L ${originX + letterWidth} ${originY} ` + // topo
        `M ${originX + letterWidth / 2} ${originY} L ${originX + letterWidth / 2} ${originY + letterHeight}`; // vertical
      return svgPathToSplines(d, { process: 'gravacao' });
    }

    function letterE(originX: number, originY: number): SplineInput[] {
      const d =
        `M ${originX} ${originY} L ${originX} ${originY + letterHeight} ` + // vertical esquerda
        `M ${originX} ${originY} L ${originX + letterWidth} ${originY} ` + // topo
        `M ${originX} ${originY + letterHeight / 2} L ${originX + letterWidth * 0.75} ${originY + letterHeight / 2} ` + // meio (menor)
        `M ${originX} ${originY + letterHeight} L ${originX + letterWidth} ${originY + letterHeight}`; // base
      return svgPathToSplines(d, { process: 'gravacao' });
    }

    function letterS(originX: number, originY: number): SplineInput[] {
      // "S" usando 2 curvas quadráticas em sequência — testa caminho Q→C.
      const w = letterWidth;
      const h = letterHeight;
      const d =
        `M ${originX + w} ${originY} ` + // canto superior direito
        `Q ${originX} ${originY} ${originX} ${originY + h * 0.3} ` + // curva superior
        `Q ${originX} ${originY + h / 2} ${originX + w / 2} ${originY + h / 2} ` + // meio direita
        `Q ${originX + w} ${originY + h / 2} ${originX + w} ${originY + h * 0.7} ` + // direita inferior
        `Q ${originX + w} ${originY + h} ${originX} ${originY + h}`; // base
      return svgPathToSplines(d, { process: 'gravacao' });
    }

    const letters = ['T', 'E', 'S', 'T', 'E'];
    for (let i = 0; i < letters.length; i++) {
      const x = startX + i * (letterWidth + letterGap);
      const letterSplines =
        letters[i] === 'T'
          ? letterT(x, startY)
          : letters[i] === 'E'
            ? letterE(x, startY)
            : letterS(x, startY);
      splines.push(...letterSplines);
    }

    expect(splines.length).toBeGreaterThan(0);
    for (const s of splines) {
      expect(s.process).toBe('gravacao');
      expect(s.controlPoints.length % 3).toBe(1); // 3N+1 para N segmentos
    }

    // Bbox real: 5..53 x 6..18. Documento usa o broche inteiro 60×25.
    const path = writeDxf(
      'TESTE_GRAVACAO_TEXTO.dxf',
      { minX: 0, minY: 0, maxX: 60, maxY: 25 },
      splines
    );
    console.log(`[gerado] ${path}  (${splines.length} SPLINEs, cor 250)`);
  });

  // ── 3. MARCAÇÃO (cor 5 — TBD validação de máquina) ─────────────────────────
  it('gera TESTE_MARCACAO_AZUL.dxf', () => {
    // Geometria de marcação: cruz no centro + 2 linhas guia + 1 círculo pequeno.
    // Testa especificamente:
    //   - múltiplos subpaths
    //   - linhas puras (L)
    //   - círculo via arcos (testa o arc→cubic com sweep 360°)
    //
    // Bbox: cruz em (28..32) × (10..14), círculo em (40..50) × (10..15),
    // tudo dentro do broche 60×25.

    const d =
      // Cruz no centro (4×4)
      'M 28 12 L 32 12 ' + // horizontal
      'M 30 10 L 30 14 ' + // vertical
      // 2 linhas guia retas separadas
      'M 5 5 L 15 5 ' + // linha guia superior
      'M 5 20 L 15 20 ' + // linha guia inferior
      // Círculo r=2.5 centrado em (45, 12.5) — split em 2 arcos (semi-círculos)
      // porque SVG arc não suporta 360° em um único A.
      'M 45 10 ' +
      'A 2.5 2.5 0 0 1 45 15 ' + // direita: 45,10 → 45,15
      'A 2.5 2.5 0 0 1 45 10 '; // esquerda: 45,15 → 45,10 (volta)

    const splines = svgPathToSplines(d, { process: 'marcacao' });
    expect(splines.length).toBeGreaterThan(0);
    for (const s of splines) {
      expect(s.process).toBe('marcacao');
      expect(s.controlPoints.length % 3).toBe(1); // 3N+1 para N segmentos
    }

    const path = writeDxf(
      'TESTE_MARCACAO_AZUL.dxf',
      { minX: 0, minY: 0, maxX: 60, maxY: 25 },
      splines
    );
    console.log(`[gerado] ${path}  (${splines.length} SPLINEs, cor 5 — TBD máquina)`);
  });

  // ── Sanidade pós-geração: arquivos contêm SPLINE e NÃO contêm proibidos ───
  it('os 3 DXFs gerados não contêm POLYLINE / TEXT / MTEXT / LINE', async () => {
    const { readFileSync } = await import('node:fs');
    const files = [
      'TESTE_CORTE_BROCHE_60x25.dxf',
      'TESTE_GRAVACAO_TEXTO.dxf',
      'TESTE_MARCACAO_AZUL.dxf',
    ];
    for (const f of files) {
      const content = readFileSync(resolve(OUTPUT_DIR, f), 'ascii');
      // Anti-regressão ADR 020.
      expect(content).not.toContain('\nPOLYLINE\r\n');
      expect(content).not.toContain('\nLWPOLYLINE\r\n');
      expect(content).not.toContain('\nTEXT\r\n');
      expect(content).not.toContain('\nMTEXT\r\n');
      expect(content).not.toContain('\nLINE\r\n');
      expect(content).not.toContain('\nARC\r\n');
      expect(content).not.toContain('\nCIRCLE\r\n');
      // Tem SPLINE e versão correta.
      expect(content).toContain('SPLINE');
      expect(content).toContain('AC1032');
      // Layer correta.
      expect(content).toContain('Camada 1');
    }
  });
});
