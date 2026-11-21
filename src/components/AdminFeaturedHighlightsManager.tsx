import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  GripVertical,
  Pencil,
  Plus,
  Search,
  Star,
  X,
} from 'lucide-react';
import { Product } from '../types/catalog';
import { HOME_FEATURED_LIMIT, formatProductCategoryLabel } from '../data/catalog';
import { useCatalog } from '../context/CatalogContext';
import { GarmentVisual } from './GarmentVisual';

interface AdminFeaturedHighlightsManagerProps {
  onFeedback: (msg: { type: 'success' | 'error'; text: string } | null) => void;
  onEditProduct: (product: Product) => void;
  onNavigate: (path: string) => void;
}

export const AdminFeaturedHighlightsManager: React.FC<
  AdminFeaturedHighlightsManagerProps
> = ({ onFeedback, onEditProduct, onNavigate }) => {
  const {
    products,
    categories,
    homeFeaturedProducts,
    homeFeaturedIds,
    isAdmin,
    toggleFeaturedOnHome,
    reorderHomeFeaturedProducts,
  } = useCatalog();

  const [orderedItems, setOrderedItems] = useState<Product[]>(homeFeaturedProducts);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [busyProductId, setBusyProductId] = useState<string | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');

  useEffect(() => {
    if (!draggingId && !savingOrder) {
      setOrderedItems(homeFeaturedProducts);
    }
  }, [homeFeaturedProducts, draggingId, savingOrder]);

  const explicitStarredCount = useMemo(
    () => products.filter((p) => p.featuredOnHome === true).length,
    [products]
  );

  const availableToAdd = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    return products
      .filter((p) => !homeFeaturedIds.has(p.id))
      .filter((p) => {
        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q)
        );
      })
      .slice(0, 24);
  }, [products, homeFeaturedIds, pickerQuery]);

  const commitOrder = async (nextItems: Product[], successText: string) => {
    const previous = orderedItems;
    setOrderedItems(nextItems);
    setSavingOrder(true);
    onFeedback(null);
    try {
      await reorderHomeFeaturedProducts(nextItems);
      onFeedback({
        type: 'success',
        text: successText,
      });
    } catch (err) {
      setOrderedItems(previous);
      onFeedback({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Não foi possível salvar a nova ordem dos destaques.',
      });
    } finally {
      setSavingOrder(false);
    }
  };

  const handleDropOnCard = async (targetId: string) => {
    if (!isAdmin || savingOrder || !draggingId || draggingId === targetId) {
      setDraggingId(null);
      setDragOverId(null);
      return;
    }

    const fromIndex = orderedItems.findIndex((p) => p.id === draggingId);
    const toIndex = orderedItems.findIndex((p) => p.id === targetId);
    setDraggingId(null);
    setDragOverId(null);

    if (fromIndex < 0 || toIndex < 0) return;

    const next = [...orderedItems];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);

    await commitOrder(
      next,
      `Posição de “${moved.name}” atualizada para #${toIndex + 1} nos destaques da Home.`
    );
  };

  const handleMoveStep = async (index: number, delta: -1 | 1) => {
    if (!isAdmin || savingOrder) return;
    const targetIndex = index + delta;
    if (targetIndex < 0 || targetIndex >= orderedItems.length) return;

    const next = [...orderedItems];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);

    await commitOrder(
      next,
      `“${moved.name}” movida para a posição #${targetIndex + 1} nos destaques.`
    );
  };

  const handleRemoveFromFeatured = async (product: Product) => {
    if (!isAdmin || savingOrder) return;
    setBusyProductId(product.id);
    onFeedback(null);
    try {
      await toggleFeaturedOnHome(product, false);
      onFeedback({
        type: 'success',
        text: `“${product.name}” removida dos destaques da Home.`,
      });
    } catch (err) {
      onFeedback({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Não foi possível remover a peça dos destaques.',
      });
    } finally {
      setBusyProductId(null);
    }
  };

  const handleAddFeaturedProduct = async (product: Product) => {
    if (!isAdmin || savingOrder) return;
    setBusyProductId(product.id);
    onFeedback(null);
    try {
      await toggleFeaturedOnHome(product, true);
      onFeedback({
        type: 'success',
        text: `“${product.name}” adicionada aos destaques da Home. Arraste para ajustar a posição.`,
      });
    } catch (err) {
      onFeedback({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Não foi possível destacar a peça na Home.',
      });
    } finally {
      setBusyProductId(null);
    }
  };

  return (
    <section
      aria-label="Organizar destaques da Home"
      className="border border-[#DCE2E5] bg-white p-5 md:p-7 space-y-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#DCE2E5] pb-5">
        <div>
          <h2 className="font-serif-display text-[28px] text-[#152F40] leading-tight">
            Organizar “Nossos destaques”
          </h2>
          <p className="text-xs text-[#566773] mt-1 max-w-[680px]">
            Arraste os cards para definir a ordem em que as peças aparecem na página inicial (da esquerda para a direita, de #1 a #{HOME_FEATURED_LIMIT}). No celular, use as setas em cada card.
          </p>
          <p className="text-[11px] text-[#152F40] mt-1.5 tabular-nums">
            {orderedItems.length}/{HOME_FEATURED_LIMIT} posições exibidas na Home
            {savingOrder ? ' · Salvando nova ordem…' : ''}
            {explicitStarredCount > HOME_FEATURED_LIMIT
              ? ` · ${explicitStarredCount} marcadas como destaque (apenas as ${HOME_FEATURED_LIMIT} primeiras aparecem na Home)`
              : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {isAdmin && (
            <button
              type="button"
              onClick={() => setPickerOpen((v) => !v)}
              className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[42px] bg-[#152F40] text-white text-xs font-medium hover:bg-[#2E5267] transition-colors"
            >
              {pickerOpen ? (
                <>
                  <X className="w-4 h-4" />
                  <span>Fechar lista</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Incluir peça nos destaques</span>
                </>
              )}
            </button>
          )}
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/');
            }}
            className="inline-flex items-center px-4 py-2.5 min-h-[42px] border border-[#DCE2E5] text-xs text-[#152F40] hover:border-[#152F40] transition-colors"
          >
            Ver na Home ↗
          </a>
        </div>
      </div>

      {/* Quick Picker to Add a Product into Home Highlights */}
      {isAdmin && pickerOpen && (
        <div className="border border-[#152F40] bg-[#F5F6F5] p-4 md:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-medium text-[#152F40]">
                Escolha uma peça do catálogo para entrar nos destaques
              </h3>
              <p className="text-[11px] text-[#566773] mt-0.5">
                A peça selecionada entra no topo dos destaques e pode ser arrastada para qualquer posição.
              </p>
            </div>
            <div className="relative flex items-center bg-white border border-[#DCE2E5] focus-within:border-[#152F40] w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-[#566773] ml-3 shrink-0" />
              <input
                type="search"
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
                placeholder="Buscar peça por nome ou código…"
                className="w-full px-2.5 py-2 text-xs text-[#152F40] bg-transparent focus:outline-none"
              />
            </div>
          </div>

          {availableToAdd.length === 0 ? (
            <p className="text-xs text-[#566773]">
              Nenhuma outra peça encontrada para este filtro.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 max-h-[320px] overflow-y-auto pr-1">
              {availableToAdd.map((item) => {
                const busy = busyProductId === item.id;
                return (
                  <div
                    key={item.id}
                    className="border border-[#DCE2E5] bg-white p-2 flex flex-col gap-2"
                  >
                    <div className="w-full aspect-[4/5] bg-[#F5F6F5] overflow-hidden">
                      <GarmentVisual product={item} />
                    </div>
                    <p className="text-[11px] font-medium text-[#152F40] line-clamp-2 min-h-[30px]">
                      {item.name}
                    </p>
                    <button
                      type="button"
                      disabled={busy || savingOrder}
                      onClick={() => void handleAddFeaturedProduct(item)}
                      className="mt-auto w-full py-1.5 px-2 bg-[#152F40] text-white text-[11px] font-medium hover:bg-[#2E5267] disabled:opacity-50 transition-colors"
                    >
                      {busy ? 'Adicionando…' : 'Destacar na Home'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Drag & Drop 4-column grid matching Home */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        {orderedItems.map((product, index) => {
          const isDragging = draggingId === product.id;
          const isDropTarget = dragOverId === product.id && draggingId !== product.id;
          const isBusy = busyProductId === product.id;

          return (
            <article
              key={product.id}
              draggable={isAdmin && !savingOrder}
              onDragStart={(e) => {
                if (!isAdmin || savingOrder) return;
                setDraggingId(product.id);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', product.id);
              }}
              onDragOver={(e) => {
                if (!isAdmin || savingOrder || !draggingId) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dragOverId !== product.id) {
                  setDragOverId(product.id);
                }
              }}
              onDragLeave={() => {
                if (dragOverId === product.id) {
                  setDragOverId(null);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                void handleDropOnCard(product.id);
              }}
              onDragEnd={() => {
                setDraggingId(null);
                setDragOverId(null);
              }}
              className={`border bg-white p-3 flex flex-col gap-2.5 transition-all select-none ${
                isAdmin ? 'cursor-grab active:cursor-grabbing' : ''
              } ${
                isDragging
                  ? 'opacity-45 border-[#152F40]'
                  : isDropTarget
                    ? 'border-2 border-[#152F40] bg-[#D0E5F2]/25'
                    : 'border-[#DCE2E5] hover:border-[#152F40]'
              }`}
            >
              {/* Top position & drag indicator */}
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[#152F40] tabular-nums">
                  <GripVertical className="w-4 h-4 text-[#566773]" aria-hidden="true" />
                  <span>#{index + 1}</span>
                </div>

                {isAdmin && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={savingOrder || index === 0}
                      onClick={() => void handleMoveStep(index, -1)}
                      aria-label={`Mover ${product.name} para posição ${index}`}
                      title="Mover para antes"
                      className="p-1 border border-[#DCE2E5] text-[#152F40] disabled:opacity-35 hover:border-[#152F40]"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={savingOrder || index === orderedItems.length - 1}
                      onClick={() => void handleMoveStep(index, 1)}
                      aria-label={`Mover ${product.name} para posição ${index + 2}`}
                      title="Mover para depois"
                      className="p-1 border border-[#DCE2E5] text-[#152F40] disabled:opacity-35 hover:border-[#152F40]"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* 4:5 Cover */}
              <div className="relative w-full aspect-[4/5] bg-[#F5F6F5] border border-[#DCE2E5]/70 overflow-hidden">
                <GarmentVisual product={product} />
              </div>

              {/* Metadata */}
              <div className="min-w-0">
                <p className="text-[10px] text-[#566773] truncate">
                  {product.brand || 'Seleção Artchê'} · {formatProductCategoryLabel(product, categories)}
                </p>
                <h3 className="text-xs font-medium text-[#152F40] line-clamp-2 min-h-[34px] mt-0.5">
                  {product.name}
                </h3>
              </div>

              {/* Actions */}
              {isAdmin && (
                <div className="mt-auto pt-1 flex items-center justify-between gap-1.5">
                  <button
                    type="button"
                    disabled={savingOrder}
                    onClick={() => onEditProduct(product)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-[#152F40] text-[11px] font-medium text-[#152F40] hover:bg-[#152F40] hover:text-white transition-colors"
                  >
                    <Pencil className="w-3 h-3" />
                    <span>Editar</span>
                  </button>

                  <button
                    type="button"
                    disabled={savingOrder || isBusy}
                    onClick={() => void handleRemoveFromFeatured(product)}
                    title="Remover dos destaques da Home"
                    aria-label={`Remover ${product.name} dos destaques`}
                    className="inline-flex items-center gap-1 px-2 py-1.5 border border-[#DCE2E5] text-[11px] text-[#566773] hover:text-[#152F40] hover:border-[#152F40] transition-colors"
                  >
                    <Star className="w-3 h-3 fill-[#152F40] text-[#152F40]" />
                    <span>{isBusy ? 'Removendo…' : 'Remover'}</span>
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
};
