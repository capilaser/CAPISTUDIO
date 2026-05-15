/**
 * NovoPedidoSidebar — sidebar esquerda do editor (Onda 12 F4.2).
 *
 * 2 estados:
 *  - Estado A (produto não confirmado): formulário com Nome (auto-preenchido) +
 *    radio de Produto + bolinhas de Cor + botão "Adicionar Produto"
 *  - Estado B (produto confirmado): resumo Nome + Produto + botão "+ Adicionar"
 *    com dropdown de 3 opções (Upar SVG / Texto / Banco)
 *
 * F4.2: estados visuais funcionam, callbacks chamam a page orquestradora.
 * F4.3: produto confirmado dispara load do canvas com base SVG + material.
 * Fase 5+: opções do menu "+ Adicionar" abrem fluxos específicos.
 */
import { useEffect, useState } from 'react';
import { Plus, FileUp, Type, Database } from 'lucide-react';

import { countAll } from '@/data/repositories/orderRepository';
import { getAllProducts, type Product } from '@/data/repositories/productRepository';
import { getAllMaterials, type Material } from '@/data/repositories/materialRepository';
import { Button } from '@/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui/components/dropdown-menu';
import { Input } from '@/ui/components/input';
import { Label } from '@/ui/components/label';
import { cn } from '@/lib/cn';

export interface ProductSelection {
  label: string;
  productId: string;
  materialId: string;
}

interface Props {
  /** Se null, sidebar está em Estado A (escolher produto). Se definido, Estado B. */
  selection: ProductSelection | null;
  /** Chamado em Estado A quando usuário confirma "Adicionar Produto". */
  onConfirmProduct: (data: ProductSelection) => void;
  /** Chamado em Estado B no menu "+ Adicionar". Fase 5+ implementa cada tipo. */
  onAddItem?: (type: 'svg' | 'texto' | 'banco') => void;
  /** Chamado pra reabrir Estado A pra trocar produto (camadas preservadas). */
  onEditProduct?: () => void;
}

export function NovoPedidoSidebar({
  selection,
  onConfirmProduct,
  onAddItem,
  onEditProduct,
}: Props) {
  return (
    <aside className="flex w-[260px] shrink-0 flex-col overflow-y-auto border-r border-border bg-card">
      {selection === null ? (
        <EstadoA onConfirm={onConfirmProduct} />
      ) : (
        <EstadoB selection={selection} onAddItem={onAddItem} onEditProduct={onEditProduct} />
      )}
    </aside>
  );
}

// ── Estado A — escolher produto ────────────────────────────────────────────

function EstadoA({ onConfirm }: { onConfirm: (data: ProductSelection) => void }) {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [materials, setMaterials] = useState<Material[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [label, setLabel] = useState('');
  const [productId, setProductId] = useState('');
  const [materialId, setMaterialId] = useState('');

  // Boot: carrega listas + gera nome auto-incrementado.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [prodList, matList, n] = await Promise.all([
          getAllProducts(),
          getAllMaterials(),
          countAll(),
        ]);
        if (cancelled) return;
        setProducts(prodList);
        setMaterials(matList);
        // Padding: "Novo Pedido 01", "Novo Pedido 02", ... "Novo Pedido 99", "Novo Pedido 100"
        const next = n + 1;
        const padded = next < 100 ? String(next).padStart(2, '0') : String(next);
        setLabel(`Novo Pedido ${padded}`);
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Materiais compatíveis com produto escolhido (config.compatibleMaterials).
  // Se produto não restringe, mostra todos.
  const selectedProduct = products?.find((p) => p.id === productId) ?? null;
  const compatible = selectedProduct?.config?.compatibleMaterials;
  const filteredMaterials =
    compatible && compatible.length > 0
      ? (materials?.filter((m) => compatible.includes(m.id)) ?? [])
      : (materials ?? []);

  function handleProductChange(nextProductId: string) {
    setProductId(nextProductId);
    // Reseta material se incompatível.
    const nextProduct = products?.find((p) => p.id === nextProductId) ?? null;
    const nextCompatible = nextProduct?.config?.compatibleMaterials;
    if (
      materialId &&
      nextCompatible &&
      nextCompatible.length > 0 &&
      !nextCompatible.includes(materialId)
    ) {
      setMaterialId('');
    }
  }

  const isValid = label.trim().length >= 2 && productId !== '' && materialId !== '';

  function handleAdd() {
    if (!isValid) return;
    onConfirm({ label: label.trim(), productId, materialId });
  }

  if (error) {
    return (
      <div className="p-4">
        <p className="font-mono text-xs text-destructive">Erro: {error}</p>
      </div>
    );
  }

  if (products === null || materials === null) {
    return (
      <div className="p-4">
        <p className="font-mono text-xs text-muted-foreground">Carregando…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-4">
      {/* Nome do pedido */}
      <div className="flex flex-col gap-1.5">
        <Label
          htmlFor="pedido-nome"
          className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
        >
          Nome do pedido
        </Label>
        <Input
          id="pedido-nome"
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="h-8 text-xs"
        />
      </div>

      {/* Escolher Produto — radio (só 1) */}
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Escolher produto
        </span>
        <div className="flex flex-col gap-1">
          {products.map((p) => (
            <label
              key={p.id}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs transition-colors',
                productId === p.id
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border bg-background/40 text-muted-foreground hover:border-primary/40 hover:text-foreground'
              )}
            >
              <input
                type="radio"
                name="produto"
                value={p.id}
                checked={productId === p.id}
                onChange={() => handleProductChange(p.id)}
                className="sr-only"
              />
              <span
                className={cn(
                  'h-3 w-3 shrink-0 rounded-full border',
                  productId === p.id ? 'border-primary bg-primary' : 'border-muted-foreground/50'
                )}
              />
              <span className="line-clamp-1">{p.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Cor / Material — bolinhas redondas, só 1 selecionada */}
      {productId !== '' && (
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Cor
          </span>
          {filteredMaterials.length === 0 ? (
            <p className="font-mono text-[11px] text-muted-foreground">
              Sem cores cadastradas pra esse produto.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {filteredMaterials.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMaterialId(m.id)}
                  title={m.label}
                  className={cn(
                    'h-7 w-7 rounded-full border-2 transition-all',
                    materialId === m.id
                      ? 'border-primary scale-110 shadow-md'
                      : 'border-border hover:scale-105 hover:border-primary/50'
                  )}
                  style={{ backgroundColor: m.swatch }}
                />
              ))}
            </div>
          )}
          {materialId !== '' && (
            <span className="font-mono text-[10px] text-muted-foreground">
              {filteredMaterials.find((m) => m.id === materialId)?.label}
            </span>
          )}
        </div>
      )}

      {/* Botão Adicionar Produto */}
      <Button onClick={handleAdd} disabled={!isValid} className="mt-2 w-full" variant="default">
        Adicionar Produto
      </Button>
    </div>
  );
}

// ── Estado B — produto confirmado, menu de adicionar ───────────────────────

function EstadoB({
  selection,
  onAddItem,
  onEditProduct,
}: {
  selection: ProductSelection;
  onAddItem?: (type: 'svg' | 'texto' | 'banco') => void;
  onEditProduct?: () => void;
}) {
  return (
    <div className="flex flex-col gap-5 p-4">
      {/* Resumo do pedido */}
      <div className="flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Nome do pedido
        </span>
        <span className="font-mono text-sm text-foreground">{selection.label}</span>
      </div>

      {/* Resumo do produto */}
      <div className="flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Produto
        </span>
        <span className="font-mono text-xs text-foreground">{selection.productId}</span>
        <span className="font-mono text-[10px] text-muted-foreground">
          Cor: {selection.materialId}
        </span>
        {onEditProduct && (
          <button
            type="button"
            onClick={onEditProduct}
            className="mt-1 self-start font-mono text-[10px] uppercase tracking-wider text-primary hover:underline"
          >
            editar
          </button>
        )}
      </div>

      <div className="my-2 border-t border-border" />

      {/* Menu Adicionar */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="default" className="w-full gap-2">
            <Plus className="h-4 w-4" />
            Adicionar
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="right" className="w-56">
          <DropdownMenuItem onClick={() => onAddItem?.('svg')} className="gap-2">
            <FileUp className="h-4 w-4" />
            Upar SVG
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAddItem?.('texto')} className="gap-2">
            <Type className="h-4 w-4" />
            Colocar texto
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAddItem?.('banco')} className="gap-2">
            <Database className="h-4 w-4" />
            Usar banco de dados
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
