import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LayerService, makeBaseLayer } from '@/core/canvas/layers/layer-service';

describe('LayerService', () => {
  let svc: LayerService;

  beforeEach(() => {
    svc = new LayerService();
  });

  it('comeca vazio', () => {
    expect(svc.list()).toEqual([]);
  });

  it('cria camada nova com zIndex sequencial', () => {
    const a = svc.create('A');
    const b = svc.create('B');
    const list = svc.list();
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe(a);
    expect(list[1].id).toBe(b);
    expect(list[0].zIndex).toBe(0);
    expect(list[1].zIndex).toBe(1);
  });

  it('aplica defaults seguros para producao laser', () => {
    svc.create('X');
    const layer = svc.list()[0];
    expect(layer.visible).toBe(true);
    expect(layer.locked).toBe(false);
    expect(layer.operation).toBeNull();
    expect(layer.machines).toEqual([]);
    expect(layer.exportTo).toEqual({ png: true, svg: false, dxf: false });
    expect(layer.colorLabel).toBe('none');
  });

  it('camada Base default vem classificada e travada', () => {
    const base = makeBaseLayer();
    expect(base.name).toBe('Base');
    expect(base.locked).toBe(true);
    expect(base.operation).toBe('corte');
    expect(base.machines).toEqual(['M3']);
    expect(base.exportTo).toEqual({ png: true, svg: true, dxf: true });
  });

  it('rename rejeita string vazia ou so espacos', () => {
    const id = svc.create('Original');
    svc.rename(id, '   ');
    expect(svc.get(id)?.name).toBe('Original');
    svc.rename(id, 'Nova');
    expect(svc.get(id)?.name).toBe('Nova');
  });

  it('setMachines dedupa e limita a 3', () => {
    const id = svc.create('m');
    svc.setMachines(id, ['M1', 'M1', 'M2', 'M3', 'M2']);
    expect(svc.get(id)?.machines).toEqual(['M1', 'M2', 'M3']);
  });

  it('setExportTo faz merge parcial', () => {
    const id = svc.create('x');
    svc.setExportTo(id, { svg: true });
    expect(svc.get(id)?.exportTo).toEqual({ png: true, svg: true, dxf: false });
  });

  it('moveTo reordena e renumera zIndex', () => {
    const a = svc.create('A');
    const b = svc.create('B');
    const c = svc.create('C');
    svc.moveTo(c, 0);
    const list = svc.list();
    expect(list.map((l) => l.id)).toEqual([c, a, b]);
    expect(list.map((l) => l.zIndex)).toEqual([0, 1, 2]);
  });

  it('remove tira a camada', () => {
    const id = svc.create('A');
    svc.create('B');
    svc.remove(id);
    expect(svc.list()).toHaveLength(1);
    expect(svc.get(id)).toBeNull();
  });

  it('topVisibleEditable ignora locked e invisible', () => {
    const a = svc.create('A');
    const b = svc.create('B');
    const c = svc.create('C');
    svc.setLocked(c, true);
    svc.setVisibility(b, false);
    expect(svc.topVisibleEditable()?.id).toBe(a);
  });

  it('subscribe emite snapshot imediato e em cada mudanca', () => {
    const spy = vi.fn();
    const unsub = svc.subscribe(spy);
    expect(spy).toHaveBeenCalledTimes(1);
    svc.create('A');
    expect(spy).toHaveBeenCalledTimes(2);
    svc.create('B');
    expect(spy).toHaveBeenCalledTimes(3);
    unsub();
    svc.create('C');
    expect(spy).toHaveBeenCalledTimes(3);
  });
});
