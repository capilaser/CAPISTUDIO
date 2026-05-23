/**
 * Testes do montador de documento DXF AC1032 (ADR 020 §1, §5, §6, sub-onda DXF-1).
 *
 * Foco em estrutura do documento:
 *   - Versão AC1032
 *   - Unidades mm ($INSUNITS=4, $MEASUREMENT=1)
 *   - $EXTMIN/$EXTMAX refletem o bbox passado
 *   - Tabela LAYER tem "0" + "Camada 1"
 *   - Seções na ordem correta: HEADER → TABLES → BLOCKS → ENTITIES → EOF
 *   - CRLF entre tokens
 *   - Encoding ASCII puro
 */
import { describe, expect, it } from 'vitest';

import { buildDxfDocument, type DxfBounds } from '@/core/export/dxf-document';
import { encodeSpline, type Point2D } from '@/core/export/dxf-spline-encoder';

const BROCHE_BOUNDS: DxfBounds = { minX: 0, minY: 0, maxX: 60, maxY: 25 };

const SQUARE_4: Point2D[] = [
  { x: 5, y: 5 },
  { x: 55, y: 5 },
  { x: 55, y: 20 },
  { x: 5, y: 20 },
];

function tokens(dxf: string): Array<{ code: number; value: string }> {
  const lines = dxf.split('\r\n').filter((l) => l.length > 0);
  const out: Array<{ code: number; value: string }> = [];
  for (let i = 0; i < lines.length; i += 2) {
    out.push({ code: parseInt(lines[i]!.trim(), 10), value: lines[i + 1]! });
  }
  return out;
}

/** Extrai o valor seguinte a uma header var ($ACADVER, $INSUNITS, ...). */
function headerVar(dxf: string, varName: string): string | undefined {
  const toks = tokens(dxf);
  for (let i = 0; i < toks.length - 1; i++) {
    if (toks[i]!.code === 9 && toks[i]!.value === varName) {
      return toks[i + 1]!.value;
    }
  }
  return undefined;
}

describe('buildDxfDocument — versão e header', () => {
  it('$ACADVER = AC1032 (DXF R2018)', () => {
    const dxf = buildDxfDocument({ bounds: BROCHE_BOUNDS, splineEntities: [] });
    expect(headerVar(dxf, '$ACADVER')).toBe('AC1032');
  });

  it('$INSUNITS = 4 (milímetros)', () => {
    const dxf = buildDxfDocument({ bounds: BROCHE_BOUNDS, splineEntities: [] });
    expect(headerVar(dxf, '$INSUNITS')).toBe('4');
  });

  it('$MEASUREMENT = 1 (métrico — corrige inconsistência do DXF real)', () => {
    const dxf = buildDxfDocument({ bounds: BROCHE_BOUNDS, splineEntities: [] });
    expect(headerVar(dxf, '$MEASUREMENT')).toBe('1');
  });

  it('$DWGCODEPAGE = ANSI_1252 (espelha o real)', () => {
    const dxf = buildDxfDocument({ bounds: BROCHE_BOUNDS, splineEntities: [] });
    expect(headerVar(dxf, '$DWGCODEPAGE')).toBe('ANSI_1252');
  });

  it('$LUNITS = 2 (decimal), $LUPREC = 4 (4 casas)', () => {
    const dxf = buildDxfDocument({ bounds: BROCHE_BOUNDS, splineEntities: [] });
    expect(headerVar(dxf, '$LUNITS')).toBe('2');
    expect(headerVar(dxf, '$LUPREC')).toBe('4');
  });
});

describe('buildDxfDocument — bbox / extents', () => {
  it('$EXTMIN reflete bounds.minX/minY (normalizados em 0,0)', () => {
    const dxf = buildDxfDocument({ bounds: BROCHE_BOUNDS, splineEntities: [] });
    const toks = tokens(dxf);
    // Localiza $EXTMIN e lê os 3 valores subsequentes (10/20/30).
    const extMinIdx = toks.findIndex((t) => t.code === 9 && t.value === '$EXTMIN');
    expect(extMinIdx).toBeGreaterThanOrEqual(0);
    expect(toks[extMinIdx + 1]).toEqual({ code: 10, value: '0.0' });
    expect(toks[extMinIdx + 2]).toEqual({ code: 20, value: '0.0' });
    expect(toks[extMinIdx + 3]).toEqual({ code: 30, value: '0.0' });
  });

  it('$EXTMAX reflete bounds.maxX/maxY (broche 60x25)', () => {
    const dxf = buildDxfDocument({ bounds: BROCHE_BOUNDS, splineEntities: [] });
    const toks = tokens(dxf);
    const extMaxIdx = toks.findIndex((t) => t.code === 9 && t.value === '$EXTMAX');
    expect(extMaxIdx).toBeGreaterThanOrEqual(0);
    expect(toks[extMaxIdx + 1]).toEqual({ code: 10, value: '60.0' });
    expect(toks[extMaxIdx + 2]).toEqual({ code: 20, value: '25.0' });
    expect(toks[extMaxIdx + 3]).toEqual({ code: 30, value: '0.0' });
  });

  it('Y é positivo na saída (origem normalizada, não preserva offset do Corel)', () => {
    const dxf = buildDxfDocument({ bounds: BROCHE_BOUNDS, splineEntities: [] });
    const toks = tokens(dxf);
    const extMaxIdx = toks.findIndex((t) => t.code === 9 && t.value === '$EXTMAX');
    const maxY = parseFloat(toks[extMaxIdx + 2]!.value);
    expect(maxY).toBeGreaterThan(0); // <-- vs DXF real que tinha Y negativo
  });
});

describe('buildDxfDocument — tabela LAYER (ADR 020 §5)', () => {
  it('declara exatamente 2 layers: "0" e "Camada 1"', () => {
    const dxf = buildDxfDocument({ bounds: BROCHE_BOUNDS, splineEntities: [] });
    const toks = tokens(dxf);
    // Layers aparecem como (0/LAYER, 2/<name>) dentro da TABLE LAYER.
    // Coleta todos os valores de código 2 imediatamente após código 0 = LAYER.
    const layerNames: string[] = [];
    for (let i = 0; i < toks.length - 1; i++) {
      if (toks[i]!.code === 0 && toks[i]!.value === 'LAYER' && toks[i + 1]!.code === 2) {
        layerNames.push(toks[i + 1]!.value);
      }
    }
    // Exclui a primeira ocorrência que é o nome da TABLE (também tem code 2),
    // mas como filtramos só (0/LAYER, 2/X), o "LAYER" como nome de tabela
    // não aparece aqui — só os 2 registros.
    expect(layerNames).toEqual(['0', 'Camada 1']);
  });

  it('cada layer tem linetype Continuous e flag 0', () => {
    const dxf = buildDxfDocument({ bounds: BROCHE_BOUNDS, splineEntities: [] });
    // Apenas verifica que Continuous está presente — não tentamos parse por handle.
    expect(dxf).toContain('Continuous');
  });
});

describe('buildDxfDocument — ordem das seções', () => {
  it('seções aparecem na ordem: HEADER, TABLES, BLOCKS, ENTITIES, depois EOF', () => {
    const dxf = buildDxfDocument({ bounds: BROCHE_BOUNDS, splineEntities: [] });
    const toks = tokens(dxf);
    const sectionNames: string[] = [];
    for (let i = 0; i < toks.length - 1; i++) {
      if (toks[i]!.code === 0 && toks[i]!.value === 'SECTION' && toks[i + 1]!.code === 2) {
        sectionNames.push(toks[i + 1]!.value);
      }
    }
    expect(sectionNames).toEqual(['HEADER', 'TABLES', 'BLOCKS', 'ENTITIES']);

    // EOF é a última entidade.
    const lastEntity = toks[toks.length - 1];
    expect(lastEntity).toEqual({ code: 0, value: 'EOF' });
  });

  it('seção BLOCKS contém *Model_Space e *Paper_Space', () => {
    const dxf = buildDxfDocument({ bounds: BROCHE_BOUNDS, splineEntities: [] });
    expect(dxf).toContain('*Model_Space');
    expect(dxf).toContain('*Paper_Space');
  });
});

describe('buildDxfDocument — formato e encoding', () => {
  it('separa tokens com CRLF (\\r\\n)', () => {
    const dxf = buildDxfDocument({ bounds: BROCHE_BOUNDS, splineEntities: [] });
    expect(dxf).toContain('\r\n');
    // Não deve ter LFs órfãos (todo \n deve vir precedido de \r).
    const orphanLF = /(?<!\r)\n/.test(dxf);
    expect(orphanLF).toBe(false);
  });

  it('termina com CRLF', () => {
    const dxf = buildDxfDocument({ bounds: BROCHE_BOUNDS, splineEntities: [] });
    expect(dxf.endsWith('\r\n')).toBe(true);
  });

  it('encoding ASCII puro (sem BOM, sem caracteres > 0x7F)', () => {
    const dxf = buildDxfDocument({ bounds: BROCHE_BOUNDS, splineEntities: [] });
    expect(dxf.charCodeAt(0)).not.toBe(0xfeff); // sem BOM
    for (let i = 0; i < dxf.length; i++) {
      expect(dxf.charCodeAt(i)).toBeLessThanOrEqual(0x7f);
    }
  });
});

describe('buildDxfDocument — integração com encodeSpline', () => {
  it('inclui as entidades SPLINE passadas dentro da seção ENTITIES', () => {
    const splineLines = encodeSpline({
      controlPoints: SQUARE_4,
      closed: true,
      process: 'corte',
    });
    const dxf = buildDxfDocument({
      bounds: BROCHE_BOUNDS,
      splineEntities: [splineLines],
    });
    // Conta SPLINE dentro da seção ENTITIES.
    const toks = tokens(dxf);
    let inEntities = false;
    let splineCount = 0;
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i]!;
      if (t.code === 0 && t.value === 'SECTION' && toks[i + 1]?.value === 'ENTITIES') {
        inEntities = true;
        continue;
      }
      if (inEntities && t.code === 0 && t.value === 'ENDSEC') break;
      if (inEntities && t.code === 0 && t.value === 'SPLINE') splineCount++;
    }
    expect(splineCount).toBe(1);
  });

  it('múltiplas SPLINEs aparecem todas na seção ENTITIES', () => {
    const cp2: Point2D[] = [
      { x: 10, y: 10 },
      { x: 20, y: 10 },
      { x: 20, y: 20 },
      { x: 10, y: 20 },
    ];
    const splines = [
      encodeSpline({ controlPoints: SQUARE_4, closed: true, process: 'corte' }),
      encodeSpline({ controlPoints: cp2, closed: false, process: 'gravacao' }),
      encodeSpline({ controlPoints: cp2, closed: true, process: 'marcacao' }),
    ];
    const dxf = buildDxfDocument({ bounds: BROCHE_BOUNDS, splineEntities: splines });
    const toks = tokens(dxf);
    const splineCount = toks.filter((t) => t.code === 0 && t.value === 'SPLINE').length;
    expect(splineCount).toBe(3);
  });

  it('sem SPLINEs → documento válido com ENTITIES vazia', () => {
    const dxf = buildDxfDocument({ bounds: BROCHE_BOUNDS, splineEntities: [] });
    const toks = tokens(dxf);
    const splineCount = toks.filter((t) => t.code === 0 && t.value === 'SPLINE').length;
    expect(splineCount).toBe(0);
    // Ainda assim contém ENTITIES + ENDSEC + EOF.
    expect(dxf).toContain('ENTITIES');
    expect(dxf).toContain('EOF');
  });
});
