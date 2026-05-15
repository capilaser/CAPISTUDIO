/**
 * NovoPedidoPage — editor de pedido (Onda 12 F5).
 *
 * Orquestra:
 *  - label do pedido (topbar, auto-incrementado)
 *  - selection de produto (Estado A/B da sidebar)
 *  - lista de textos adicionados (campos inline na sidebar)
 *  - BancoDrawer (painel grande sobre canvas com 4 abas)
 *  - Upar SVG (input file oculto)
 */
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { parseCorelSvg } from '@/core/canvas/corel-svg-parser';
import { humanizeError } from '@/core/canvas/corel-svg-errors';
import type { CanvasEngine } from '@/core/canvas/canvas-engine';
import { countAll } from '@/data/repositories/orderRepository';
import AppLayout from '@/ui/layout/AppLayout';

import { NovoPedidoCanvasArea } from './novo-pedido/NovoPedidoCanvasArea';
import { NovoPedidoLayerSidebar } from './novo-pedido/NovoPedidoLayerSidebar';
import { NovoPedidoSidebar, type ProductSelection } from './novo-pedido/NovoPedidoSidebar';
import { NovoPedidoTopbar } from './novo-pedido/NovoPedidoTopbar';
import { BancoDrawer } from './novo-pedido/BancoDrawer';
import type { TextoItemData } from './novo-pedido/TextoItem';

export default function NovoPedidoPage() {
  const [pedidoLabel, setPedidoLabel] = useState('');
  const [selection, setSelection] = useState<ProductSelection | null>(null);
  const [textos, setTextos] = useState<TextoItemData[]>([]);
  const [bancoOpen, setBancoOpen] = useState(false);
  const engineRef = useRef<CanvasEngine | null>(null);
  const svgInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const n = await countAll();
        if (cancelled) return;
        const next = n + 1;
        const padded = next < 100 ? String(next).padStart(2, '0') : String(next);
        setPedidoLabel(`Novo Pedido ${padded}`);
      } catch {
        // Banco fora — mantém vazio, usuário digita.
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleConfirmProduct(data: ProductSelection) {
    setSelection(data);
    setTextos([]);
    setBancoOpen(false);
  }

  function handleEditProduct() {
    setSelection(null);
    setTextos([]);
    setBancoOpen(false);
  }

  function handleAddItem(type: 'svg' | 'texto' | 'banco') {
    if (type === 'texto') {
      const count = textos.length + 1;
      const label = count === 1 ? 'Texto' : `Texto ${count}`;
      const newItem: TextoItemData = {
        id: crypto.randomUUID(),
        slotId: crypto.randomUUID(),
        label,
      };
      // Cria slot no canvas
      engineRef.current?.createSlot('nome');
      setTextos((prev) => [...prev, newItem]);
      return;
    }
    if (type === 'banco') {
      setBancoOpen(true);
      return;
    }
    if (type === 'svg') {
      svgInputRef.current?.click();
      return;
    }
  }

  function handleRemoveTexto(id: string) {
    setTextos((prev) => prev.filter((t) => t.id !== id));
  }

  async function handleSvgFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.svg')) {
      toast.error('Apenas arquivos SVG são aceitos.');
      e.target.value = '';
      return;
    }
    try {
      const text = await file.text();
      const meta = parseCorelSvg(text);
      await engineRef.current?.addAppliqueSvg(
        meta,
        file.name.replace('.svg', ''),
        crypto.randomUUID()
      );
      toast.success(`${file.name} adicionado`);
    } catch (err) {
      toast.error(humanizeError(err));
    } finally {
      e.target.value = '';
    }
  }

  return (
    <AppLayout breadcrumb={[{ label: 'Arte', href: '/arte' }, { label: 'Novo Pedido' }]}>
      <div className="flex h-full flex-col">
        <NovoPedidoTopbar pedidoLabel={pedidoLabel} onLabelChange={setPedidoLabel} />
        <div className="relative flex flex-1 overflow-hidden">
          <NovoPedidoSidebar
            selection={selection}
            onConfirmProduct={handleConfirmProduct}
            onAddItem={handleAddItem}
            onEditProduct={handleEditProduct}
            textos={textos}
            engineRef={engineRef}
            onRemoveTexto={handleRemoveTexto}
          />
          <NovoPedidoCanvasArea selection={selection} engineRef={engineRef} />
          <NovoPedidoLayerSidebar />

          {bancoOpen && <BancoDrawer engineRef={engineRef} onClose={() => setBancoOpen(false)} />}
        </div>
      </div>

      {/* Input oculto para upar SVG */}
      <input
        ref={svgInputRef}
        type="file"
        accept=".svg"
        className="hidden"
        onChange={handleSvgFile}
      />
    </AppLayout>
  );
}
