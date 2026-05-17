/**
 * MaterialChanger — Onda 14
 *
 * Sub-componente da sidebar do broche ativo. Mostra material atual e abre
 * dropdown pra trocar.
 *
 * Fluxo:
 *  - Linha clicável "abs-escovado · prata" mostra família e cor.
 *  - Click abre dropdown:
 *    - Coluna 1: lista de famílias compatíveis com o produto
 *    - Coluna 2: bolinhas de cor da família selecionada
 *  - Click numa cor: chama onChange(familyId, materialId), fecha dropdown.
 *
 * Compatibilidade filtra pelo product.config.compatibleMaterials (mesma
 * lógica do ProductCascadeForm).
 */
import { useEffect, useState } from 'react';
import { ChevronDown, Pencil } from 'lucide-react';

import {
  getAllMaterials,
  getById as getMaterialById,
  type Material,
} from '@/data/repositories/materialRepository';
import { listFamilies, type MaterialFamily } from '@/data/repositories/materialFamilyRepository';
import { getProductById, type Product } from '@/data/repositories/productRepository';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/ui/components/dropdown-menu';
import { cn } from '@/lib/cn';

interface Props {
  productId: string;
  familyId: string;
  materialId: string;
  onChange: (familyId: string, materialId: string) => void;
}

export function MaterialChanger({ productId, familyId, materialId, onChange }: Props) {
  const [product, setProduct] = useState<Product | null>(null);
  const [families, setFamilies] = useState<MaterialFamily[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [currentMaterial, setCurrentMaterial] = useState<Material | null>(null);
  const [selectedFamilyId, setSelectedFamilyId] = useState(familyId);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [p, fams, mats, cur] = await Promise.all([
          getProductById(productId),
          listFamilies(),
          getAllMaterials(),
          materialId ? getMaterialById(materialId) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setProduct(p);
        setFamilies(fams);
        setMaterials(mats);
        setCurrentMaterial(cur);
      } catch (e) {
        console.warn('[MaterialChanger] failed to load:', e);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [productId, materialId]);

  // Mantém selectedFamilyId em sync com prop quando dropdown abre.
  // Microtask pra evitar warning react-hooks/set-state-in-effect.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) setSelectedFamilyId(familyId);
    });
    return () => {
      cancelled = true;
    };
  }, [open, familyId]);

  const familyLabel = families.find((f) => f.id === familyId)?.label ?? familyId;
  const colorLabel = currentMaterial?.label ?? materialId;
  const currentSwatch = currentMaterial?.swatch ?? 'transparent';

  // Famílias compatíveis (mesma lógica do ProductCascadeForm).
  const compatibleFamilyIds = product?.config?.compatibleMaterials ?? [];
  const compatibleFamilies: MaterialFamily[] = (() => {
    if (compatibleFamilyIds.length === 0) return families;
    const matIds = new Set(compatibleFamilyIds);
    const famIds = new Set<string>();
    for (const m of materials) {
      if (matIds.has(m.id)) famIds.add(m.familyId);
    }
    return families.filter((f) => famIds.has(f.id));
  })();

  // Cores da família selecionada no dropdown.
  const colorsForFamily: Material[] = (() => {
    if (!selectedFamilyId) return [];
    const inFamily = materials.filter((m) => m.familyId === selectedFamilyId);
    if (compatibleFamilyIds.length === 0) return inFamily;
    const allowed = new Set(compatibleFamilyIds);
    return inFamily.filter((m) => allowed.has(m.id));
  })();

  function handlePickColor(matId: string) {
    onChange(selectedFamilyId, matId);
    setOpen(false);
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="group flex items-center gap-2 rounded-md border border-transparent px-1.5 py-1 text-left transition-colors hover:border-border hover:bg-background/60"
          title="Trocar material"
        >
          <span
            className="h-3 w-3 shrink-0 rounded-full border border-border/60"
            style={{ backgroundColor: currentSwatch }}
          />
          <span className="text-[10px] text-muted-foreground">
            {familyLabel} · {colorLabel}
          </span>
          <ChevronDown className="h-3 w-3 text-muted-foreground/50 group-hover:text-muted-foreground" />
          <Pencil className="ml-auto h-2.5 w-2.5 text-muted-foreground/50 group-hover:text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="bottom" className="w-[280px] p-3">
        <div className="flex flex-col gap-3">
          {/* Famílias */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
              Variação
            </span>
            {compatibleFamilies.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">Sem variações cadastradas.</p>
            ) : (
              <div className="flex flex-col gap-0.5">
                {compatibleFamilies.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSelectedFamilyId(f.id)}
                    className={cn(
                      'rounded px-2 py-1 text-left text-[11px] transition-colors',
                      selectedFamilyId === f.id
                        ? 'bg-primary/15 text-foreground'
                        : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Cores */}
          {selectedFamilyId && (
            <div className="flex flex-col gap-1.5 border-t border-border pt-2">
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Cor</span>
              {colorsForFamily.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">Sem cores nessa variação.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {colorsForFamily.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handlePickColor(m.id)}
                      title={m.label}
                      className={cn(
                        'h-6 w-6 rounded-full border-2 transition-all',
                        m.id === materialId
                          ? 'scale-110 border-primary shadow-sm'
                          : 'border-border hover:scale-105 hover:border-primary/50'
                      )}
                      style={{ backgroundColor: m.swatch }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
