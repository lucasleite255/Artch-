import React from 'react';
import { ArrowUpRight, Briefcase, Check, Pencil } from 'lucide-react';
import { Product } from '../types/catalog';
import { formatProductCategoryLabel, isProductOnSale } from '../data/catalog';
import { useCatalog } from '../context/CatalogContext';
import { GarmentVisual } from './GarmentVisual';

interface ProductCardProps {
  product: Product;
  inBag: boolean;
  onSelectProduct: (id: string) => void;
  onToggleBag: (product: Product) => void;
  onEditProduct?: (id: string) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  inBag,
  onSelectProduct,
  onToggleBag,
  onEditProduct,
}) => {
  const { isAdmin, categories } = useCatalog();

  const brandDisplay = product.brand || 'Seleção de inverno';
  const categoryDisplay = formatProductCategoryLabel(product, categories);
  const onSale = isProductOnSale(product, categories);

  return (
    <article className="group flex flex-col min-w-0 h-full">
      <div className="relative aspect-[4/5] bg-[#F5F6F5] overflow-hidden border border-[#DCE2E5]/70">
        <a
          href={`/produto/${product.id}/`}
          onClick={(e) => {
            e.preventDefault();
            onSelectProduct(product.id);
          }}
          aria-label={`Ver ${product.name}`}
          className="block w-full h-full"
        >
          <GarmentVisual
            product={product}
            className="transition-transform duration-500 ease-out group-hover:scale-[1.03]"
          />
        </a>

        {onSale && (
          <span className="absolute top-2.5 right-2.5 z-10 bg-[#8B2635] text-white px-2.5 py-1.5 text-[10px] font-semibold tracking-[0.16em] uppercase leading-none pointer-events-none">
            SALE
          </span>
        )}

        {isAdmin && (
          <a
            href={`/admin/?editar=${encodeURIComponent(product.id)}`}
            onClick={(e) => {
              e.preventDefault();
              if (onEditProduct) {
                onEditProduct(product.id);
              } else {
                window.history.pushState({}, '', `/admin/?editar=${encodeURIComponent(product.id)}`);
                window.dispatchEvent(new PopStateEvent('popstate'));
              }
            }}
            aria-label={`Editar ${product.name}`}
            className="absolute top-2.5 left-2.5 h-9 px-2.5 flex items-center gap-1.5 text-[11px] font-medium bg-white/95 text-[#152F40] border border-[#152F40] hover:bg-[#152F40] hover:text-white transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>Editar</span>
          </a>
        )}
      </div>

      {/* Unboxed metadata with typographic separator */}
      <div className="mt-3 text-[11px] text-[#566773] truncate">
        <span>{brandDisplay}</span>
        <span aria-hidden="true" className="mx-1.5">
          ·
        </span>
        <span>{categoryDisplay}</span>
      </div>

      <h3 className="mt-1 text-[15px] font-medium leading-[1.4] text-[#152F40] min-h-[42px]">
        <a
          href={`/produto/${product.id}/`}
          onClick={(e) => {
            e.preventDefault();
            onSelectProduct(product.id);
          }}
          className="hover:text-[#476E84] transition-colors"
        >
          {product.name}
        </a>
      </h3>

      <div className="mt-auto pt-2.5 flex flex-col gap-2">
        <a
          href={`/produto/${product.id}/`}
          onClick={(e) => {
            e.preventDefault();
            onSelectProduct(product.id);
          }}
          className="w-full min-h-[44px] px-3.5 py-2.5 bg-[#152F40] text-white hover:bg-[#2E5267] text-[13px] font-medium flex items-center justify-between gap-2 transition-colors whitespace-nowrap"
        >
          <span className="truncate">Ver produto</span>
          <ArrowUpRight className="w-4 h-4 shrink-0" strokeWidth={1.7} />
        </a>

        <button
          type="button"
          onClick={() => onToggleBag(product)}
          aria-label={inBag ? `Remover ${product.name} da mala` : `Adicionar ${product.name} na mala`}
          className={`w-full min-h-[42px] px-3.5 py-2 border text-[12px] font-medium flex items-center justify-between gap-2 transition-colors whitespace-nowrap ${
            inBag
              ? 'bg-[#F5F6F5] text-[#152F40] border-[#152F40]'
              : 'bg-white text-[#152F40] border-[#DCE2E5] hover:border-[#152F40] hover:bg-[#F5F6F5]'
          }`}
        >
          <span className="truncate">{inBag ? 'Na mala' : 'Adicionar na mala'}</span>
          {inBag ? (
            <Check className="w-3.5 h-3.5 shrink-0" strokeWidth={1.8} />
          ) : (
            <Briefcase className="w-3.5 h-3.5 shrink-0" strokeWidth={1.7} />
          )}
        </button>
      </div>
    </article>
  );
};
