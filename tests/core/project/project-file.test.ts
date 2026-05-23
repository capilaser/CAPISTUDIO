import { describe, expect, it } from 'vitest';

import {
  CPS_FILE_NAME,
  CPS_SCHEMA_VERSION,
  OPERATION_DXF_ACI,
  OPERATION_SVG_COLOR,
  newProjectFile,
} from '@/core/project/project-file';

describe('project-file', () => {
  it('exporta constantes do nome de arquivo e versao', () => {
    expect(CPS_FILE_NAME).toBe('projeto.cps.json');
    expect(CPS_SCHEMA_VERSION).toBe(1);
  });

  it('mapeia cores SVG por operacao', () => {
    expect(OPERATION_SVG_COLOR.corte).toBe('#000000');
    expect(OPERATION_SVG_COLOR.gravacao).toBe('#FF0000');
    expect(OPERATION_SVG_COLOR.marcacao).toBe('#0000FF');
  });

  it('mapeia ACI DXF por operacao', () => {
    expect(OPERATION_DXF_ACI.corte).toBe(31);
    expect(OPERATION_DXF_ACI.gravacao).toBe(250);
    expect(OPERATION_DXF_ACI.marcacao).toBe(5);
  });

  it('cria projeto vazio com timestamps iguais e listas vazias', () => {
    const p = newProjectFile({
      name: 'teste-broche',
      productId: 'broche-60x25',
      widthMm: 60,
      heightMm: 25,
      viewBox: '0 0 60 25',
    });
    expect(p.schemaVersion).toBe(1);
    expect(p.meta.name).toBe('teste-broche');
    expect(p.meta.productId).toBe('broche-60x25');
    expect(p.meta.createdAt).toBe(p.meta.updatedAt);
    expect(p.viewport.widthMm).toBe(60);
    expect(p.viewport.heightMm).toBe(25);
    expect(p.viewport.viewBox).toBe('0 0 60 25');
    expect(p.layers).toEqual([]);
    expect(p.objects).toEqual([]);
  });

  it('mantem ISO timestamp valido em createdAt', () => {
    const p = newProjectFile({
      name: 'x',
      productId: 'broche-60x25',
      widthMm: 60,
      heightMm: 25,
      viewBox: '0 0 60 25',
    });
    expect(() => new Date(p.meta.createdAt).toISOString()).not.toThrow();
  });
});
