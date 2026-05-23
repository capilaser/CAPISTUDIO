import { useEffect, useState } from 'react';

import type { CanvasEngine } from '@/core/canvas/canvas-engine';
import { pxToMm } from '@/core/canvas/units';

interface PropertiesPanelProps {
  engine: CanvasEngine | null;
  selectedId: string | null;
}

interface SelectionInfo {
  type: string;
  capiId: string;
  layerId: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  rotation: number;
}

export function PropertiesPanel({ engine, selectedId }: PropertiesPanelProps) {
  const [info, setInfo] = useState<SelectionInfo | null>(null);

  useEffect(() => {
    if (!engine || !selectedId) {
      // Limpa estado quando a seleção some — sincronização legítima entre
      // input externo (selectedId) e nosso state local.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInfo(null);
      return;
    }
    function refresh() {
      if (!engine || !selectedId) return;
      const obj = engine.fabric.getObjects().find((o) => o.capiId === selectedId);
      if (!obj) {
        setInfo(null);
        return;
      }
      obj.setCoords();
      const bounds = obj.getBoundingRect();
      setInfo({
        type: obj.type,
        capiId: obj.capiId ?? '',
        layerId: obj.layerId ?? '',
        xMm: pxToMm(bounds.left),
        yMm: pxToMm(bounds.top),
        widthMm: pxToMm(bounds.width),
        heightMm: pxToMm(bounds.height),
        rotation: obj.angle ?? 0,
      });
    }
    refresh();
    const handler = () => refresh();
    engine.fabric.on('object:modified', handler);
    engine.fabric.on('object:moving', handler);
    engine.fabric.on('object:scaling', handler);
    engine.fabric.on('object:rotating', handler);
    return () => {
      engine.fabric.off('object:modified', handler);
      engine.fabric.off('object:moving', handler);
      engine.fabric.off('object:scaling', handler);
      engine.fabric.off('object:rotating', handler);
    };
  }, [engine, selectedId]);

  return (
    <div className="flex flex-col gap-2 px-3 py-3">
      <h2 className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
        Propriedades
      </h2>
      {info ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 font-mono text-[11px] text-ink-300">
          <Row label="Tipo" value={info.type} />
          <Row label="ID" value={info.capiId.replace('obj-', '')} />
          <Row label="X" value={`${info.xMm.toFixed(2)} mm`} />
          <Row label="Y" value={`${info.yMm.toFixed(2)} mm`} />
          <Row label="W" value={`${info.widthMm.toFixed(2)} mm`} />
          <Row label="H" value={`${info.heightMm.toFixed(2)} mm`} />
          <Row label="Rotação" value={`${info.rotation.toFixed(1)}°`} />
        </div>
      ) : (
        <p className="text-xs text-ink-500">Selecione um objeto para ver propriedades.</p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="text-ink-500">{label}</span>
      <span className="text-ink-200 tabular-nums">{value}</span>
    </>
  );
}
