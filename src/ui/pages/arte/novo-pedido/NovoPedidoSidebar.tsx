/**
 * NovoPedidoSidebar — sidebar esquerda do editor (Onda 13 C1).
 *
 * Onda 13: editor é multi-broche. A sidebar agora tem 3 áreas:
 *
 *   1. Lista de broches (ItemsList) — uma linha por item da prancha. Click
 *      troca o ativo. Sempre visível quando há ≥1 broche. Em prancha vazia,
 *      essa área some.
 *   2. Cascata de produto (ProductCascadeForm) — mostrada quando o usuário
 *      está adicionando broche. Aparece ao entrar (prancha vazia) ou ao
 *      clicar "+ Adicionar broche".
 *   3. Estado B do broche ativo (ItemDetailsPanel) — resumo + botão "+ Adicionar
 *      texto / SVG / banco". Só aparece quando há broche ativo.
 *
 * O componente pai (NovoPedidoPage) controla o store (boardItems + selectedOrderItemIndex).
 * Esta sidebar só lê do store e dispara handlers de UI.
 */
import { useEffect, useState, type RefObject } from 'react';
import { Plus, FileUp, Type, Database, Trash2, Copy, Layers } from 'lucide-react';

import type { CanvasEngine } from '@/core/canvas/canvas-engine';
import { getAllProducts, type Product } from '@/data/repositories/productRepository';
import { getAllMaterials, type Material } from '@/data/repositories/materialRepository';
import { listFamilies, type MaterialFamily } from '@/data/repositories/materialFamilyRepository';
import { Button } from '@/ui/components/button';
import { Skeleton } from '@/ui/components/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui/components/dropdown-menu';
import { Input } from '@/ui/components/input';
import { Label } from '@/ui/components/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/select';
import { cn } from '@/lib/cn';
import type { BoardItemDraft } from '@/stores/canvas-store';

import { LogoSlotItem } from './LogoSlotItem';
import { MaterialChanger } from './MaterialChanger';
import { TextoItem, type TextoItemData } from './TextoItem';

/**
 * Resultado do cascade form. Mantém o mesmo shape de ProductSelection da Onda 12
 * pra reaproveitar handlers que ainda existem na página.
 */
export interface ProductSelection {
  productId: string;
  familyId: string;
  materialId: string;
}

interface Props {
  /** Lista de broches da prancha. Vem do store. */
  boardItems: BoardItemDraft[];
  /** Índice do broche ativo. -1 = nenhum. */
  selectedIndex: number;
  /** Confirma cascata: adiciona novo item à prancha. */
  onAddBoardItem: (data: ProductSelection) => void;
  /** Troca o item ativo. */
  onSelectIndex: (index: number) => void;
  /** Remove o item da prancha. */
  onRemoveBoardItem: (index: number) => void;
  /** Onda 16 — duplica o broche do índice. */
  onDuplicateBoardItem: (index: number) => void;
  /** Onda 16 — adiciona N broches iguais ao do índice ativo. */
  onBulkFromActive?: (count: number) => void;
  /** Botão "+ Adicionar texto/svg/banco" do item ativo. */
  onAddItem?: (type: 'svg' | 'texto' | 'banco') => void;
  /** Lista de textos do broche ativo. */
  textos?: TextoItemData[];
  /** Ref do engine pra TextoItem editar conteúdo do slot. */
  engineRef?: RefObject<CanvasEngine | null>;
  /** Remove um texto pelo id. */
  onRemoveTexto?: (id: string) => void;
  /**
   * Onda 14 — incrementa quando um padrão é aplicado no broche ativo.
   * Repassado pros TextoItems pra eles re-preencherem os slots novos.
   */
  slotVersion?: number;
  /**
   * Onda 14b — troca material do broche ativo. Recebe (familyId, materialId).
   * Pai (NovoPedidoPage) aplica via engine + updateBoardItem.
   */
  onChangeMaterial?: (familyId: string, materialId: string) => void;
}

export function NovoPedidoSidebar({
  boardItems,
  selectedIndex,
  onAddBoardItem,
  onSelectIndex,
  onRemoveBoardItem,
  onDuplicateBoardItem,
  onBulkFromActive,
  onAddItem,
  textos = [],
  engineRef,
  onRemoveTexto,
  slotVersion = 0,
  onChangeMaterial,
}: Props) {
  // Onda 16 — lookup materialId → swatch pra renderizar cor na lista de broches.
  // Carrega uma vez. Materials são poucos (~30). Re-fetch só se algum item
  // novo referenciar materialId desconhecido (raro — operador escolhe de lista).
  const [materialsById, setMaterialsById] = useState<Record<string, Material>>({});
  useEffect(() => {
    let cancelled = false;
    void getAllMaterials()
      .then((mats) => {
        if (cancelled) return;
        const map: Record<string, Material> = {};
        for (const m of mats) map[m.id] = m;
        setMaterialsById(map);
      })
      .catch(() => {
        /* sem swatch — operador vê só label */
      });
    return () => {
      cancelled = true;
    };
  }, []);
  // `addingByUser` = usuário clicou em "+ Adicionar broche". A cascata também
  // aparece automaticamente quando a prancha está vazia (estado inicial).
  // Derivação pura: nada de useEffect+setState pra sincronizar.
  const [addingByUser, setAddingByUser] = useState(false);
  const adding = boardItems.length === 0 || addingByUser;

  const activeItem = selectedIndex >= 0 ? boardItems[selectedIndex] : null;

  function handleConfirm(data: ProductSelection) {
    onAddBoardItem(data);
    setAddingByUser(false);
  }

  return (
    <aside className="flex w-[260px] shrink-0 flex-col overflow-y-auto border-r border-border bg-card">
      {boardItems.length > 0 && (
        <ItemsList
          items={boardItems}
          selectedIndex={selectedIndex}
          materialsById={materialsById}
          onSelect={onSelectIndex}
          onRemove={onRemoveBoardItem}
          onDuplicate={onDuplicateBoardItem}
          onBulkFromActive={onBulkFromActive}
          onAddClick={() => setAddingByUser(true)}
        />
      )}

      {adding ? (
        <ProductCascadeForm
          onConfirm={handleConfirm}
          canCancel={boardItems.length > 0}
          onCancel={() => setAddingByUser(false)}
        />
      ) : activeItem ? (
        <ItemDetailsPanel
          item={activeItem}
          onAddItem={onAddItem}
          textos={textos}
          engineRef={engineRef}
          onRemoveTexto={onRemoveTexto}
          slotVersion={slotVersion}
          onChangeMaterial={onChangeMaterial}
        />
      ) : null}
    </aside>
  );
}

// ── Lista de broches da prancha ──────────────────────────────────────────────

function ItemsList({
  items,
  selectedIndex,
  materialsById,
  onSelect,
  onRemove,
  onDuplicate,
  onBulkFromActive,
  onAddClick,
}: {
  items: BoardItemDraft[];
  selectedIndex: number;
  materialsById: Record<string, Material>;
  onSelect: (index: number) => void;
  onRemove: (index: number) => void;
  onDuplicate: (index: number) => void;
  onBulkFromActive?: (count: number) => void;
  onAddClick: () => void;
}) {
  const [bulkOpen, setBulkOpen] = useState(false);

  return (
    <div className="flex flex-col gap-2 border-b border-border p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Broches na prancha
        </span>
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground/60">
          {items.length}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {items.map((item, i) => (
          <BoardItemRow
            key={item.id}
            index={i}
            item={item}
            material={item.materialId ? materialsById[item.materialId] : undefined}
            selected={i === selectedIndex}
            onClick={() => onSelect(i)}
            onRemove={() => onRemove(i)}
            onDuplicate={() => onDuplicate(i)}
          />
        ))}
      </div>
      <div className="mt-1 flex gap-2">
        <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={onAddClick}>
          <Plus className="h-3.5 w-3.5" />
          Adicionar broche
        </Button>
        {selectedIndex >= 0 && onBulkFromActive && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={() => setBulkOpen(true)}
            title="Adicionar vários iguais ao broche ativo (lote)"
          >
            <Layers className="h-3.5 w-3.5" />
            Lote
          </Button>
        )}
      </div>

      {onBulkFromActive && (
        <BulkAddDialog
          open={bulkOpen}
          onClose={() => setBulkOpen(false)}
          onConfirm={(count) => {
            onBulkFromActive(count);
            setBulkOpen(false);
          }}
        />
      )}
    </div>
  );
}

function BoardItemRow({
  index,
  item,
  material,
  selected,
  onClick,
  onRemove,
  onDuplicate,
}: {
  index: number;
  item: BoardItemDraft;
  material?: Material;
  selected: boolean;
  onClick: () => void;
  onRemove: () => void;
  onDuplicate: () => void;
}) {
  const num = String(index + 1).padStart(2, '0');
  const materialLabel = material?.label ?? '—';
  const patternBadge = item.patternId ? '●' : null;
  return (
    <div
      className={cn(
        'group flex items-center gap-2 rounded-md border px-2 py-1.5 transition-colors',
        selected
          ? 'border-primary bg-primary/10'
          : 'border-border bg-background/40 hover:border-primary/40'
      )}
    >
      <button type="button" onClick={onClick} className="flex flex-1 items-center gap-2 text-left">
        {/* Número */}
        <span
          className={cn(
            'font-mono text-[10px] tabular-nums tracking-wider',
            selected ? 'text-primary' : 'text-muted-foreground/60'
          )}
        >
          {num}
        </span>
        {/* Swatch do material */}
        <span
          className="h-3 w-3 shrink-0 rounded-sm border border-border/40"
          style={{ backgroundColor: material?.swatch ?? '#3a3a3f' }}
          title={materialLabel}
        />
        {/* Nome do broche + chip de pattern */}
        <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
          <span
            className={cn(
              'truncate text-xs',
              selected ? 'text-foreground' : 'text-muted-foreground'
            )}
          >
            Broche {index + 1}
          </span>
          {patternBadge && (
            <span
              className={cn(
                'shrink-0 text-[9px]',
                selected ? 'text-primary' : 'text-muted-foreground/40'
              )}
              title="Padrão aplicado"
            >
              {patternBadge}
            </span>
          )}
        </span>
      </button>
      {/* Ações: duplicar + remover */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDuplicate();
        }}
        className="rounded p-1 text-muted-foreground/50 opacity-0 transition-opacity hover:bg-primary/10 hover:text-primary group-hover:opacity-100"
        title="Duplicar broche"
      >
        <Copy className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="rounded p-1 text-muted-foreground/50 opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
        title="Remover broche"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

// ── Dialog de adicionar lote ────────────────────────────────────────────────

function BulkAddDialog({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (count: number) => void;
}) {
  const [count, setCount] = useState(5);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar lote</DialogTitle>
          <DialogDescription>
            Cria N broches idênticos ao ativo (mesmo produto, material e padrão). Você edita os
            textos de cada um depois.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-3 py-2">
          <Label htmlFor="bulk-count" className="text-xs">
            Quantidade
          </Label>
          <Input
            id="bulk-count"
            type="number"
            min={1}
            max={100}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
            className="h-8 w-24 font-mono text-xs tabular-nums"
          />
          <span className="text-[10px] text-muted-foreground">
            {count === 1 ? 'broche' : 'broches'}
          </span>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="default" size="sm" onClick={() => onConfirm(count)}>
            Adicionar {count}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Cascata Categoria → Variação → Cor (reutilizado da Onda 12 F4.3) ────────

interface CategoryNode {
  type: string;
  label: string;
  products: Product[];
}

function ProductCascadeForm({
  onConfirm,
  canCancel,
  onCancel,
}: {
  onConfirm: (data: ProductSelection) => void;
  canCancel: boolean;
  onCancel: () => void;
}) {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [families, setFamilies] = useState<MaterialFamily[] | null>(null);
  const [materials, setMaterials] = useState<Material[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [categoryType, setCategoryType] = useState('');
  const [productId, setProductId] = useState('');
  const [familyId, setFamilyId] = useState('');
  const [materialId, setMaterialId] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [prodList, famList, matList] = await Promise.all([
          getAllProducts(),
          listFamilies(),
          getAllMaterials(),
        ]);
        if (cancelled) return;
        setProducts(prodList);
        setFamilies(famList);
        setMaterials(matList);
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const categories: CategoryNode[] = (() => {
    if (!products) return [];
    const byType = new Map<string, Product[]>();
    for (const p of products) {
      const arr = byType.get(p.type) ?? [];
      arr.push(p);
      byType.set(p.type, arr);
    }
    return Array.from(byType.entries()).map(([type, prods]) => ({
      type,
      label: type.charAt(0).toUpperCase() + type.slice(1),
      products: prods,
    }));
  })();

  const selectedCategory = categories.find((c) => c.type === categoryType);
  const categoryProduct = selectedCategory?.products[0] ?? null;
  const compatibleFamilyIds = categoryProduct?.config?.compatibleMaterials ?? [];

  const familiesForCategory: MaterialFamily[] = (() => {
    if (!categoryProduct || !materials || !families) return [];
    if (compatibleFamilyIds.length === 0) return families;
    const matIds = new Set(compatibleFamilyIds);
    const famIds = new Set<string>();
    for (const m of materials) {
      if (matIds.has(m.id)) famIds.add(m.familyId);
    }
    return families.filter((f) => famIds.has(f.id));
  })();

  const colorsForFamily: Material[] = (() => {
    if (!familyId || !materials || !categoryProduct) return [];
    const inFamily = materials.filter((m) => m.familyId === familyId);
    if (compatibleFamilyIds.length === 0) return inFamily;
    const allowed = new Set(compatibleFamilyIds);
    return inFamily.filter((m) => allowed.has(m.id));
  })();

  function handleCategoryClick(type: string) {
    const cat = categories.find((c) => c.type === type);
    if (!cat) return;
    setCategoryType(type);
    setProductId(cat.products[0]?.id ?? '');
    setFamilyId('');
    setMaterialId('');
  }

  function handleFamilyClick(fid: string) {
    setFamilyId(fid);
    setMaterialId('');
  }

  const isValid = productId !== '' && familyId !== '' && materialId !== '';

  function handleAdd() {
    if (!isValid) return;
    onConfirm({ productId, familyId, materialId });
  }

  if (error) {
    return (
      <div className="p-4">
        <p className="text-xs text-destructive">Erro: {error}</p>
      </div>
    );
  }

  if (products === null || families === null || materials === null) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-4/5" />
      </div>
    );
  }

  const step1Done = categoryType !== '';
  const step2Done = familyId !== '';
  const step3Done = materialId !== '';

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-1.5">
        <Label className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
          <StepBadge n={1} active={!step1Done} done={step1Done} />
          Produto
        </Label>
        <Select value={categoryType} onValueChange={handleCategoryClick}>
          <SelectTrigger className="h-9 text-xs">
            <SelectValue placeholder="Escolha o produto" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat.type} value={cat.type} className="text-xs">
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
          <StepBadge n={2} active={step1Done && !step2Done} done={step2Done} />
          Variação
        </Label>
        <Select
          value={familyId}
          onValueChange={handleFamilyClick}
          disabled={categoryType === '' || familiesForCategory.length === 0}
        >
          <SelectTrigger className="h-9 text-xs">
            <SelectValue
              placeholder={
                categoryType === ''
                  ? 'Selecione o produto primeiro'
                  : familiesForCategory.length === 0
                    ? 'Sem variações cadastradas'
                    : 'Escolha a variação'
              }
            />
          </SelectTrigger>
          <SelectContent>
            {familiesForCategory.map((f) => (
              <SelectItem key={f.id} value={f.id} className="text-xs">
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
          <StepBadge n={3} active={step2Done && !step3Done} done={step3Done} />
          Cor
        </Label>
        <Select
          value={materialId}
          onValueChange={setMaterialId}
          disabled={familyId === '' || colorsForFamily.length === 0}
        >
          <SelectTrigger className="h-9 text-xs">
            <SelectValue
              placeholder={
                familyId === ''
                  ? 'Selecione a variação primeiro'
                  : colorsForFamily.length === 0
                    ? 'Sem cores nessa variação'
                    : 'Escolha a cor'
              }
            >
              {materialId !== '' &&
                (() => {
                  const m = colorsForFamily.find((mat) => mat.id === materialId);
                  if (!m) return null;
                  return (
                    <span className="flex items-center gap-2">
                      <span
                        className="h-3.5 w-3.5 shrink-0 rounded-full border border-border"
                        style={{ backgroundColor: m.swatch }}
                      />
                      <span>{m.label}</span>
                    </span>
                  );
                })()}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {colorsForFamily.map((m) => (
              <SelectItem key={m.id} value={m.id} className="text-xs">
                <span className="flex items-center gap-2">
                  <span
                    className="h-3.5 w-3.5 shrink-0 rounded-full border border-border"
                    style={{ backgroundColor: m.swatch }}
                  />
                  <span>{m.label}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2 pt-1">
        <Button onClick={handleAdd} disabled={!isValid} className="w-full" variant="default">
          Adicionar
        </Button>
        {canCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="self-center text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground hover:underline"
          >
            cancelar
          </button>
        )}
      </div>
    </div>
  );
}

function StepBadge({ n, active, done }: { n: number; active: boolean; done: boolean }) {
  return (
    <span
      className={cn(
        'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[8px] font-medium tabular-nums',
        done
          ? 'bg-primary text-primary-foreground'
          : active
            ? 'bg-primary/20 text-primary ring-1 ring-primary/40'
            : 'bg-muted text-muted-foreground/60'
      )}
      aria-hidden
    >
      {n}
    </span>
  );
}

// ── Detalhe do broche ativo: resumo + textos + dropdown Adicionar ──────────

function ItemDetailsPanel({
  item,
  onAddItem,
  textos = [],
  engineRef,
  onRemoveTexto,
  slotVersion,
  onChangeMaterial,
}: {
  item: BoardItemDraft;
  onAddItem?: (type: 'svg' | 'texto' | 'banco') => void;
  textos?: TextoItemData[];
  engineRef?: RefObject<CanvasEngine | null>;
  onRemoveTexto?: (id: string) => void;
  slotVersion: number;
  onChangeMaterial?: (familyId: string, materialId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Broche {item.position + 1}
        </span>
        <span className="font-mono text-xs text-foreground">{item.productId}</span>
        {onChangeMaterial ? (
          <MaterialChanger
            productId={item.productId}
            familyId={item.familyId}
            materialId={item.materialId}
            onChange={onChangeMaterial}
          />
        ) : (
          <span className="font-mono text-[10px] text-muted-foreground">
            {item.familyId} · {item.materialId}
          </span>
        )}
      </div>

      {textos.length > 0 && engineRef && (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          {textos.map((t, i) => {
            if (t.slotType === 'logo') {
              return (
                <LogoSlotItem
                  key={t.id}
                  itemId={t.id}
                  label={t.label}
                  engineRef={engineRef}
                  onRemove={onRemoveTexto ?? (() => {})}
                  slotVersion={slotVersion}
                />
              );
            }
            return (
              <TextoItem
                key={t.id}
                item={t}
                engineRef={engineRef}
                onRemove={onRemoveTexto ?? (() => {})}
                slotVersion={slotVersion}
                autoFocus={i === 0}
              />
            );
          })}
        </div>
      )}

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
