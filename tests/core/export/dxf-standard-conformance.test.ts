/**
 * Testes de conformidade com CAPISTUDIO_DXF_STANDARD (ADR 020, sub-onda DXF-1).
 *
 * Este é o GATE DE FORMATO — para o documento DXF gerado pelo Capi Studio ser
 * aceito como "padrão produção", todos os asserts aqui devem passar.
 *
 * Regras testadas (ADR 020):
 *   §1: AC1032
 *   §2: SPLINE é a ÚNICA entidade geométrica permitida — sem POLYLINE,
 *       LWPOLYLINE, LINE, ARC, CIRCLE, ELLIPSE, INSERT, HATCH, POINT
 *   §3: Zero TEXT/MTEXT (texto é vetorizado como SPLINE)
 *   §4: Cor por entidade (31/250/5), não por layer
 *   §5: Layer única "Camada 1" + layer obrigatória "0"
 *   §6: Y positivo, origem em (0,0), unidades mm
 *
 * NOTA: este teste roda no nível do DOCUMENTO. Quando DXF-2 adicionar
 * conversão SVG→SPLINE, novos testes lá garantirão que paths SVG nunca
 * viram POLYLINE/LINE — só SPLINE.
 */
import { describe, expect, it } from 'vitest';

import { buildDxfDocument, type DxfBounds } from '@/core/export/dxf-document';
import { encodeSpline, type Point2D } from '@/core/export/dxf-spline-encoder';

const BOUNDS_60x25: DxfBounds = { minX: 0, minY: 0, maxX: 60, maxY: 25 };

const SQUARE_4: Point2D[] = [
  { x: 0, y: 0 },
  { x: 60, y: 0 },
  { x: 60, y: 25 },
  { x: 0, y: 25 },
];

/** Documento de teste com 3 SPLINEs cobrindo os 3 processos. */
function sampleDocument(): string {
  const splines = [
    encodeSpline({ controlPoints: SQUARE_4, closed: true, process: 'corte' }),
    encodeSpline({ controlPoints: SQUARE_4, closed: false, process: 'gravacao' }),
    encodeSpline({ controlPoints: SQUARE_4, closed: true, process: 'marcacao' }),
  ];
  return buildDxfDocument({ bounds: BOUNDS_60x25, splineEntities: splines });
}

function tokens(dxf: string): Array<{ code: number; value: string }> {
  const lines = dxf.split('\r\n').filter((l) => l.length > 0);
  const out: Array<{ code: number; value: string }> = [];
  for (let i = 0; i < lines.length; i += 2) {
    out.push({ code: parseInt(lines[i]!.trim(), 10), value: lines[i + 1]! });
  }
  return out;
}

/** Tipos de entidade encontrados na seção ENTITIES. */
function entityTypes(dxf: string): Set<string> {
  const toks = tokens(dxf);
  const types = new Set<string>();
  let inEntities = false;
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i]!;
    if (t.code === 0 && t.value === 'SECTION' && toks[i + 1]?.value === 'ENTITIES') {
      inEntities = true;
      continue;
    }
    if (inEntities && t.code === 0 && t.value === 'ENDSEC') break;
    if (inEntities && t.code === 0) types.add(t.value);
  }
  return types;
}

describe('conformance §1 — versão AC1032', () => {
  it('header declara $ACADVER = AC1032', () => {
    const dxf = sampleDocument();
    expect(dxf).toMatch(/\$ACADVER\r\n\s*1\r\nAC1032/);
  });

  it('NÃO declara AC1009 (R12 — versão antiga do exporter legado)', () => {
    const dxf = sampleDocument();
    expect(dxf).not.toContain('AC1009');
  });
});

describe('conformance §2 — SPLINE é a única entidade geométrica', () => {
  it('seção ENTITIES contém ao menos uma SPLINE', () => {
    const dxf = sampleDocument();
    expect(entityTypes(dxf).has('SPLINE')).toBe(true);
  });

  const banned = [
    'LINE',
    'LWPOLYLINE',
    'POLYLINE',
    'VERTEX',
    'SEQEND',
    'CIRCLE',
    'ARC',
    'ELLIPSE',
    'INSERT',
    'HATCH',
    'POINT',
    'SOLID',
    'TRACE',
  ];

  for (const entityType of banned) {
    it(`seção ENTITIES NÃO contém ${entityType}`, () => {
      const dxf = sampleDocument();
      expect(entityTypes(dxf).has(entityType)).toBe(false);
    });
  }
});

describe('conformance §3 — zero TEXT/MTEXT (texto vetorizado)', () => {
  it('documento inteiro não contém entidade TEXT', () => {
    const dxf = sampleDocument();
    // Procura "0\r\nTEXT" (entity discriminator), não substring "TEXT" no meio.
    expect(/^\s*0\r\nTEXT\r\n/m.test(dxf)).toBe(false);
  });

  it('documento inteiro não contém entidade MTEXT', () => {
    const dxf = sampleDocument();
    expect(/^\s*0\r\nMTEXT\r\n/m.test(dxf)).toBe(false);
  });
});

describe('conformance §4 — cor por entidade (não por layer)', () => {
  it('SPLINE de corte declara cor 31 dentro do bloco', () => {
    const splines = [encodeSpline({ controlPoints: SQUARE_4, closed: true, process: 'corte' })];
    const dxf = buildDxfDocument({ bounds: BOUNDS_60x25, splineEntities: splines });
    // Procura padrão (62, 31) DENTRO da seção ENTITIES, depois do 0/SPLINE.
    expect(dxf).toMatch(/SPLINE[\s\S]*?\n\s*8\r\nCamada 1\r\n\s*62\r\n31\r\n/);
  });

  it('SPLINE de gravacao declara cor 250 dentro do bloco', () => {
    const splines = [encodeSpline({ controlPoints: SQUARE_4, closed: false, process: 'gravacao' })];
    const dxf = buildDxfDocument({ bounds: BOUNDS_60x25, splineEntities: splines });
    expect(dxf).toMatch(/SPLINE[\s\S]*?\n\s*62\r\n250\r\n/);
  });

  it('SPLINE de marcacao declara cor 5 dentro do bloco', () => {
    const splines = [encodeSpline({ controlPoints: SQUARE_4, closed: true, process: 'marcacao' })];
    const dxf = buildDxfDocument({ bounds: BOUNDS_60x25, splineEntities: splines });
    expect(dxf).toMatch(/SPLINE[\s\S]*?\n\s*62\r\n5\r\n/);
  });
});

describe('conformance §5 — layer única "Camada 1"', () => {
  it('tabela LAYER declara exatamente "0" e "Camada 1"', () => {
    const dxf = sampleDocument();
    const toks = tokens(dxf);
    const layerNames: string[] = [];
    for (let i = 0; i < toks.length - 1; i++) {
      if (toks[i]!.code === 0 && toks[i]!.value === 'LAYER' && toks[i + 1]!.code === 2) {
        layerNames.push(toks[i + 1]!.value);
      }
    }
    expect(layerNames).toEqual(['0', 'Camada 1']);
  });

  it('toda SPLINE referencia layer "Camada 1" (código 8)', () => {
    const dxf = sampleDocument();
    // Em cada bloco SPLINE, o primeiro código 8 deve valer "Camada 1".
    const splineBlocks = dxf.split(/\r\n\s*0\r\nSPLINE\r\n/).slice(1);
    expect(splineBlocks.length).toBe(3);
    for (const block of splineBlocks) {
      // Pega o primeiro "8\r\n<value>" após o início.
      const m = block.match(/^\s*8\r\n([^\r]+)\r\n/);
      expect(m?.[1]).toBe('Camada 1');
    }
  });

  it('NÃO existem layers de processo (CORTE/GRAVACAO/MARCACAO) — só "Camada 1"', () => {
    const dxf = sampleDocument();
    // ADR 020 §5: decidimos NÃO usar layers por processo. Garantia anti-regressão.
    expect(dxf).not.toContain('\nCORTE\r\n');
    expect(dxf).not.toContain('\nGRAVACAO\r\n');
    expect(dxf).not.toContain('\nMARCACAO\r\n');
  });
});

describe('conformance §6 — coordenadas normalizadas, Y positivo para cima (CAD), mm', () => {
  it('$EXTMIN é (0, 0, 0) — origem normalizada', () => {
    const dxf = buildDxfDocument({ bounds: BOUNDS_60x25, splineEntities: [] });
    expect(dxf).toMatch(/\$EXTMIN\r\n\s*10\r\n0\.0\r\n\s*20\r\n0\.0/);
  });

  it('$EXTMAX para broche 60×25 é (60, 25, 0)', () => {
    const dxf = buildDxfDocument({ bounds: BOUNDS_60x25, splineEntities: [] });
    expect(dxf).toMatch(/\$EXTMAX\r\n\s*10\r\n60\.0\r\n\s*20\r\n25\.0/);
  });

  it('$INSUNITS = 4 (mm)', () => {
    const dxf = buildDxfDocument({ bounds: BOUNDS_60x25, splineEntities: [] });
    expect(dxf).toMatch(/\$INSUNITS\r\n\s*70\r\n4\r\n/);
  });

  it('todos os Y de control points são >= 0 (origem normalizada, sem offset do Corel)', () => {
    // SPLINE com bbox (0,0)..(60,25): bbox normalizado → nenhum Y negativo.
    // (Direção do Y: positivo para CIMA, convenção CAD/DXF. Caller é
    //  responsável por aplicar flip via normalizeForDxf antes deste ponto.)
    const splines = [encodeSpline({ controlPoints: SQUARE_4, closed: true, process: 'corte' })];
    const dxf = buildDxfDocument({ bounds: BOUNDS_60x25, splineEntities: splines });
    const toks = tokens(dxf);
    // Code 20 dentro de entidades = Y de control point.
    let inEntities = false;
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i]!;
      if (t.code === 0 && t.value === 'SECTION' && toks[i + 1]?.value === 'ENTITIES') {
        inEntities = true;
        continue;
      }
      if (inEntities && t.code === 0 && t.value === 'ENDSEC') break;
      if (inEntities && t.code === 20) {
        expect(parseFloat(t.value)).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('conformance — sanidade geral', () => {
  it('documento começa com 0/SECTION', () => {
    const dxf = sampleDocument();
    expect(dxf.startsWith('  0\r\nSECTION\r\n')).toBe(true);
  });

  it('documento termina com 0/EOF + CRLF', () => {
    const dxf = sampleDocument();
    expect(dxf.endsWith('  0\r\nEOF\r\n')).toBe(true);
  });

  it('quantidade de SPLINEs emitidas == quantidade de inputs', () => {
    const splines = [
      encodeSpline({ controlPoints: SQUARE_4, closed: true, process: 'corte' }),
      encodeSpline({ controlPoints: SQUARE_4, closed: false, process: 'gravacao' }),
    ];
    const dxf = buildDxfDocument({ bounds: BOUNDS_60x25, splineEntities: splines });
    const matches = dxf.match(/\r\n\s*0\r\nSPLINE\r\n/g);
    expect(matches?.length).toBe(2);
  });
});
