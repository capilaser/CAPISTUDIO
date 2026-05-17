/**
 * Testes do dxf-writer (Onda 18, Fase A).
 *
 * Cobre o formato AC1009 (R12):
 *   - Estrutura: HEADER/TABLES/ENTITIES/EOF presentes
 *   - LINE / POLYLINE+VERTEX+SEQEND / CIRCLE
 *   - Layers com colorIndex correto (corte=7, gravacao=1, marcacao=5)
 *   - Y-flip helper (canvas → DXF cartesiano)
 *   - Coordenadas com 6 casas decimais, ponto como separador
 *   - CRLF entre tokens
 */
import { describe, expect, it } from 'vitest';

import { DXF_COLOR_INDEX, DxfBuilder, flipY } from '@/core/export/dxf-writer';

/** Parser ingênuo: divide por CRLF e remove padding dos codes. */
function tokens(dxf: string): Array<{ code: number; value: string }> {
  const lines = dxf.split('\r\n').filter((l) => l.length > 0);
  const out: Array<{ code: number; value: string }> = [];
  for (let i = 0; i < lines.length; i += 2) {
    out.push({ code: parseInt(lines[i]!.trim(), 10), value: lines[i + 1]! });
  }
  return out;
}

/** Conta quantas entidades de cada tipo aparecem na seção ENTITIES. */
function countEntities(dxf: string): Record<string, number> {
  const toks = tokens(dxf);
  const counts: Record<string, number> = {};
  let inEntities = false;
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i]!;
    if (t.code === 0 && t.value === 'SECTION' && toks[i + 1]?.value === 'ENTITIES') {
      inEntities = true;
      continue;
    }
    if (inEntities && t.code === 0 && t.value === 'ENDSEC') break;
    if (inEntities && t.code === 0) {
      counts[t.value] = (counts[t.value] ?? 0) + 1;
    }
  }
  return counts;
}

describe('dxf-writer (Onda 18 Fase A)', () => {
  describe('estrutura mínima', () => {
    it('build vazio produz DXF válido com 4 sections + EOF', () => {
      const dxf = new DxfBuilder().build();
      expect(dxf).toContain('SECTION\r\n  2\r\nHEADER');
      expect(dxf).toContain('SECTION\r\n  2\r\nTABLES');
      expect(dxf).toContain('SECTION\r\n  2\r\nENTITIES');
      expect(dxf.trimEnd().endsWith('EOF')).toBe(true);
    });

    it('HEADER declara $ACADVER=AC1009 (R12) e $INSUNITS=4 (mm)', () => {
      const dxf = new DxfBuilder().build();
      expect(dxf).toMatch(/\$ACADVER\r\n\s*1\r\nAC1009/);
      expect(dxf).toMatch(/\$INSUNITS\r\n\s*70\r\n4/);
    });

    it('usa CRLF entre tokens (não LF puro)', () => {
      const dxf = new DxfBuilder().useLayer('corte').line(0, 0, 1, 1).build();
      // Linhas com só LF (\n) seriam problema. Conta CRLFs vs LFs isolados.
      const crlfCount = (dxf.match(/\r\n/g) ?? []).length;
      const standaloneLF = (dxf.match(/(?<!\r)\n/g) ?? []).length;
      expect(crlfCount).toBeGreaterThan(0);
      expect(standaloneLF).toBe(0);
    });
  });

  describe('LINE', () => {
    it('emite LINE com layer e coordenadas corretas', () => {
      const dxf = new DxfBuilder().useLayer('corte').line(10, 20, 30, 40).build();
      expect(countEntities(dxf).LINE).toBe(1);
      // Coords com 6 casas decimais
      expect(dxf).toMatch(/10\.000000/);
      expect(dxf).toMatch(/20\.000000/);
      expect(dxf).toMatch(/30\.000000/);
      expect(dxf).toMatch(/40\.000000/);
    });

    it('múltiplas LINEs em layers diferentes mantêm associação', () => {
      const dxf = new DxfBuilder()
        .useLayer('corte')
        .line(0, 0, 10, 0)
        .useLayer('gravacao')
        .line(0, 0, 0, 10)
        .build();
      const counts = countEntities(dxf);
      expect(counts.LINE).toBe(2);
      // Ambas layers declaradas em TABLES
      expect(dxf).toMatch(/LAYER\r\n\s*2\r\ncorte/);
      expect(dxf).toMatch(/LAYER\r\n\s*2\r\ngravacao/);
    });
  });

  describe('POLYLINE', () => {
    it('emite POLYLINE + N VERTEX + SEQEND (formato R12)', () => {
      const pts = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ];
      const dxf = new DxfBuilder().useLayer('corte').polyline(pts, false).build();
      const counts = countEntities(dxf);
      expect(counts.POLYLINE).toBe(1);
      expect(counts.VERTEX).toBe(3);
      expect(counts.SEQEND).toBe(1);
    });

    it('closed=true marca flag 70=1 no POLYLINE', () => {
      const pts = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ];
      const dxf = new DxfBuilder().useLayer('corte').polyline(pts, true).build();
      // Tokens depois do "POLYLINE" devem ter group(70, '1')
      const idx = dxf.indexOf('POLYLINE');
      const after = dxf.slice(idx, idx + 200);
      expect(after).toMatch(/70\r\n1/);
    });

    it('polyline com < 2 pontos é ignorada silenciosamente', () => {
      const dxf = new DxfBuilder()
        .useLayer('corte')
        .polyline([{ x: 0, y: 0 }], false)
        .build();
      expect(countEntities(dxf).POLYLINE).toBeUndefined();
      expect(countEntities(dxf).VERTEX).toBeUndefined();
    });
  });

  describe('CIRCLE', () => {
    it('emite CIRCLE com centro e raio', () => {
      const dxf = new DxfBuilder().useLayer('marcacao').circle(50, 25, 5).build();
      expect(countEntities(dxf).CIRCLE).toBe(1);
      expect(dxf).toMatch(/50\.000000/);
      expect(dxf).toMatch(/25\.000000/);
      expect(dxf).toMatch(/5\.000000/);
    });
  });

  describe('TABLES — layers e colorIndex', () => {
    it('declara só layers que foram usadas', () => {
      const dxf = new DxfBuilder().useLayer('corte').line(0, 0, 1, 1).build();
      expect(dxf).toMatch(/LAYER\r\n\s*2\r\ncorte/);
      expect(dxf).not.toMatch(/LAYER\r\n\s*2\r\ngravacao/);
      expect(dxf).not.toMatch(/LAYER\r\n\s*2\r\nmarcacao/);
    });

    it('colorIndex correto: corte=7, gravacao=1, marcacao=5', () => {
      const dxf = new DxfBuilder()
        .useLayer('corte')
        .line(0, 0, 1, 1)
        .useLayer('gravacao')
        .line(0, 0, 1, 1)
        .useLayer('marcacao')
        .line(0, 0, 1, 1)
        .build();
      // Cada layer aparece com seu colorIndex no group 62
      expect(dxf).toMatch(/\ncorte\r\n\s*70\r\n0\r\n\s*62\r\n7/);
      expect(dxf).toMatch(/\ngravacao\r\n\s*70\r\n0\r\n\s*62\r\n1/);
      expect(dxf).toMatch(/\nmarcacao\r\n\s*70\r\n0\r\n\s*62\r\n5/);
    });

    it('DXF_COLOR_INDEX exporta a palette esperada', () => {
      expect(DXF_COLOR_INDEX.corte).toBe(7);
      expect(DXF_COLOR_INDEX.gravacao).toBe(1);
      expect(DXF_COLOR_INDEX.marcacao).toBe(5);
    });
  });

  describe('flipY helper', () => {
    it('inverte Y de canvas (Y+ baixo) pra DXF (Y+ cima)', () => {
      // Canvas Y=0 (topo) com height=25 → DXF Y=25 (topo cartesiano)
      expect(flipY(0, 25)).toBe(25);
      // Canvas Y=25 (base) → DXF Y=0 (base cartesiana)
      expect(flipY(25, 25)).toBe(0);
      // Canvas Y=10 (meio) com height=25 → DXF Y=15
      expect(flipY(10, 25)).toBe(15);
    });
  });

  describe('cenário integrado: broche realista', () => {
    it('broche 60x25 com borda + furo + texto vetorizado gera DXF parseável', () => {
      const dxf = new DxfBuilder()
        // Borda do broche (retângulo) em corte
        .useLayer('corte')
        .polyline(
          [
            { x: 0, y: 0 },
            { x: 60, y: 0 },
            { x: 60, y: 25 },
            { x: 0, y: 25 },
          ],
          true
        )
        // Furo circular em corte
        .circle(5, 12.5, 1.5)
        // "Texto" vetorizado em gravacao (4 segmentos de uma letra L)
        .useLayer('gravacao')
        .polyline(
          [
            { x: 20, y: 5 },
            { x: 20, y: 20 },
            { x: 30, y: 20 },
          ],
          false
        )
        .build();

      const counts = countEntities(dxf);
      expect(counts.POLYLINE).toBe(2);
      expect(counts.VERTEX).toBe(7); // 4 da borda + 3 do texto
      expect(counts.CIRCLE).toBe(1);
      expect(counts.SEQEND).toBe(2);

      // Ambas layers declaradas em TABLES
      expect(dxf).toMatch(/LAYER\r\n\s*2\r\ncorte/);
      expect(dxf).toMatch(/LAYER\r\n\s*2\r\ngravacao/);

      // EOF final
      expect(dxf.trimEnd().endsWith('EOF')).toBe(true);
    });
  });
});
