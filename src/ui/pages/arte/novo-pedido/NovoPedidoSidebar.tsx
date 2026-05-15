/**
 * NovoPedidoSidebar — sidebar esquerda do editor (Onda 12 F4.3).
 *
 * 2 estados:
 *  - Estado A (produto não confirmado): cascata Categoria → Variação → Cor +
 *    botão "Adicionar Produto"
 *  - Estado B (produto confirmado): resumo + botão "+ Adicionar" com dropdown
 *
 * Nome do pedido NÃO vive aqui — vive na topbar (input editável inline).
 *
 * Cascata de produto (Opção A — sem mexer em banco):
 *   Nível 1: Categoria = products.type único (broche, placa)
 *   Nível 2: Variação = material_families compatíveis com produto da categoria
 *   Nível 3: Cor = materials da família escolhida, mostrada como bolinhas
 */
import { useEffect, useState } from 'react';
import { Plus, FileUp, Type, Database, ChevronRight } from 'lucide-react';

import { getAllProducts, type Product } from '@/data/repositories/productRepository';
import { getAllMaterials, type Material } from '@/data/repositories/materialRepository';
import { listFamilies, type MaterialFamily } from '@/data/repositories/materialFamilyRepository';
import { Button } from '@/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui/components/dropdown-menu';
import { cn } from '@/lib/cn';

export interface ProductSelection {
  productId: string;
  familyId: string;
  materialId: string;
}

interface Props {
  /** Se null, sidebar está em Estado A (escolher produto). Se definido, Estado B. */
  selection: ProductSelection | null;
  /** Chamado em Estado A quando usuário confirma "Adicionar Produto". */
  onConfirmProduct: (data: ProductSelection) => void;
  /** Chamado em Estado B no menu "+ Adicionar". Fase 5+ implementa cada tipo. */
  onAddItem?: (type: 'svg' | 'texto' | 'banco') => void;
  /** Chamado pra reabrir Estado A (camadas preservadas). */
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

// ── Estado A — cascata Categoria → Variação → Cor ──────────────────────────

interface CategoryNode {
  type: string;
  label: string;
  products: Product[];
}

function EstadoA({ onConfirm }: { onConfirm: (data: ProductSelection) => void }) {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [families, setFamilies] = useState<MaterialFamily[] | null>(null);
  const [materials, setMaterials] = useState<Material[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Estado da cascata
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

  // Nível 1 — Categorias únicas a partir de products.type
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

  // Nível 2 — Famílias compatíveis com o produto da categoria selecionada.
  // Cada categoria pode ter N produtos (broche-60x25, broche-pin, etc), mas
  // pra Opção A assumo 1 produto por categoria. Se houver mais de 1, pego o
  // primeiro (limitação documentada).
  const selectedCategory = categories.find((c) => c.type === categoryType);
  const categoryProduct = selectedCategory?.products[0] ?? null;
  const compatibleFamilyIds = categoryProduct?.config?.compatibleMaterials ?? [];

  // Cruza: famílias presentes em compatibleMaterials (que listam material IDs,
  // não family IDs — mas o material conhece sua família via Material.familyId).
  const familiesForCategory: MaterialFamily[] = (() => {
    if (!categoryProduct || !materials || !families) return [];
    if (compatibleFamilyIds.length === 0) return families; // sem restrição
    // Pega familyIds únicos dos materials que estão em compatibleMaterials.
    const matIds = new Set(compatibleFamilyIds);
    const famIds = new Set<string>();
    for (const m of materials) {
      if (matIds.has(m.id)) famIds.add(m.familyId);
    }
    return families.filter((f) => famIds.has(f.id));
  })();

  // Nível 3 — Cores da família escolhida, compatíveis com o produto.
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
    // Reseta níveis 2 e 3
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
        <p className="font-mono text-xs text-destructive">Erro: {error}</p>
      </div>
    );
  }

  if (products === null || families === null || materials === null) {
    return (
      <div className="p-4">
        <p className="font-mono text-xs text-muted-foreground">Carregando…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-4">
      {/* Nível 1 — Categoria */}
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Escolher produto
        </span>
        <div className="flex flex-col gap-1">
          {categories.map((cat) => (
            <CascadeRow
              key={cat.type}
              label={cat.label}
              selected={categoryType === cat.type}
              onClick={() => handleCategoryClick(cat.type)}
            />
          ))}
        </div>
      </div>

      {/* Nível 2 — Variação (família) */}
      {categoryType !== '' && (
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Variação
          </span>
          {familiesForCategory.length === 0 ? (
            <p className="font-mono text-[11px] text-muted-foreground">
              Sem variações cadastradas pra esse produto.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {familiesForCategory.map((f) => (
                <CascadeRow
                  key={f.id}
                  label={f.label}
                  selected={familyId === f.id}
                  onClick={() => handleFamilyClick(f.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Nível 3 — Cor (bolinhas) */}
      {familyId !== '' && (
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Cor
          </span>
          {colorsForFamily.length === 0 ? (
            <p className="font-mono text-[11px] text-muted-foreground">Sem cores nessa variação.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {colorsForFamily.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMaterialId(m.id)}
                  title={m.label}
                  className={cn(
                    'h-7 w-7 rounded-full border-2 transition-all',
                    materialId === m.id
                      ? 'scale-110 border-primary shadow-md'
                      : 'border-border hover:scale-105 hover:border-primary/50'
                  )}
                  style={{ backgroundColor: m.swatch }}
                />
              ))}
            </div>
          )}
          {materialId !== '' && (
            <span className="font-mono text-[10px] text-muted-foreground">
              {colorsForFamily.find((m) => m.id === materialId)?.label}
            </span>
          )}
        </div>
      )}

      <Button onClick={handleAdd} disabled={!isValid} className="mt-2 w-full" variant="default">
        Adicionar Produto
      </Button>
    </div>
  );
}

// ── Row da cascata (categoria/família) com chevron à direita ───────────────

interface CascadeRowProps {
  label: string;
  selected: boolean;
  onClick: () => void;
}

function CascadeRow({ label, selected, onClick }: CascadeRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center justify-between rounded-md border px-3 py-2 text-xs transition-colors',
        selected
          ? 'border-primary bg-primary/10 text-foreground'
          : 'border-border bg-background/40 text-muted-foreground hover:border-primary/40 hover:text-foreground'
      )}
    >
      <span className="line-clamp-1">{label}</span>
      <ChevronRight
        className={cn(
          'h-3 w-3 shrink-0 transition-colors',
          selected ? 'text-primary' : 'text-muted-foreground/50'
        )}
      />
    </button>
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
      <div className="flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Produto
        </span>
        <span className="font-mono text-xs text-foreground">{selection.productId}</span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {selection.familyId} · {selection.materialId}
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
