import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import { Product } from '../types/catalog';
import {
  matchesCategory,
  normalizeText,
} from '../data/catalog';
import { useCatalog } from '../context/CatalogContext';
import { ProductCard } from './ProductCard';

interface CatalogPageProps {
  products: Product[];
  categorySlug?: string;
  search: string;
  brand: string;
  perfil: string;
  sort: string;
  page: number;
  bagIds: Set<string>;
  onNavigate: (path: string) => void;
  onUpdateParams: (updates: Record<string, string | null>) => void;
  onSelectProduct: (id: string) => void;
  onToggleBag: (product: Product) => void;
}

const ITEMS_PER_BATCH = 24;

export const CatalogPage: React.FC<CatalogPageProps> = ({
  products,
  categorySlug,
  search,
  brand,
  perfil,
  sort,
  page,
  bagIds,
  onNavigate,
  onUpdateParams,
  onSelectProduct,
  onToggleBag,
}) => {
  const { categories, isAdmin } = useCatalog();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const activeCategory = categories.find((c) => c.slug === categorySlug);
  const pageTitle = search
    ? `Busca por “${search}”`
    : activeCategory?.name || 'Todo o catálogo';
  const pageDescription =
    activeCategory?.description ||
    'Escolha suas peças para o frio e consulte nossa equipe para saber mais.';

  const baseList = useMemo(() => {
    const qNorm = normalizeText(search);
    return products.filter(
      (p) =>
        (!categorySlug || matchesCategory(p, categorySlug, categories)) &&
        (!qNorm || normalizeText(`${p.name} ${p.brand}`).includes(qNorm))
    );
  }, [products, categorySlug, search, categories]);

  const availableBrands = useMemo(() => {
    return Array.from(new Set(baseList.map((p) => p.brand).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, 'pt-BR')
    );
  }, [baseList]);

  const filteredList = useMemo(() => {
    const list = baseList.filter(
      (p) => (!brand || p.brand === brand) && (!perfil || matchesCategory(p, perfil, categories))
    );
    if (sort === 'az') {
      return [...list].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    }
    if (sort === 'za') {
      return [...list].sort((a, b) => b.name.localeCompare(a.name, 'pt-BR'));
    }
    return list;
  }, [baseList, brand, perfil, sort, categories]);

  const [visibleCount, setVisibleCount] = useState(
    () => Math.max(1, page) * ITEMS_PER_BATCH
  );
  const filterKey = `${categorySlug || ''}|${search}|${brand}|${perfil}|${sort}`;
  const prevFilterKeyRef = useRef(filterKey);

  useEffect(() => {
    if (prevFilterKeyRef.current !== filterKey) {
      prevFilterKeyRef.current = filterKey;
      setVisibleCount(ITEMS_PER_BATCH);
    }
  }, [filterKey]);

  const displayedCount = Math.min(visibleCount, filteredList.length);
  const visibleItems = filteredList.slice(0, displayedCount);
  const remainingCount = Math.max(0, filteredList.length - displayedCount);
  const nextBatchCount = Math.min(ITEMS_PER_BATCH, remainingCount);

  const isBlackFriday = categorySlug === 'black-friday';
  const isSaleCategory = categorySlug === 'sale';

  return (
    <div>
      {/* Breadcrumb */}
      <div className="max-w-[1320px] mx-auto px-5 md:px-10 py-6 flex flex-wrap items-center justify-between gap-3 text-[11px] text-[#566773]">
        <div>
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/');
            }}
            className="underline underline-offset-4 hover:text-[#152F40]"
          >
            Início
          </a>
          <span aria-hidden="true"> / </span>
          <span>{pageTitle}</span>
        </div>

        {isAdmin && (
          <a
            href="/admin/"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/admin/');
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-[#152F40] bg-white text-[#152F40] text-xs font-medium hover:bg-[#152F40] hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar para o painel</span>
          </a>
        )}
      </div>

      {/* Category / Search Page Header */}
      <section
        className={
          isBlackFriday
            ? 'relative overflow-hidden bg-[#152F40] text-white py-9 md:py-11'
            : isSaleCategory
              ? 'bg-[#8B2635] text-white py-8 md:py-10'
              : 'bg-[#F5F6F5] text-[#152F40] py-8 md:py-9'
        }
      >
        {isBlackFriday && (
          <div
            className="absolute inset-0 bg-right bg-cover bg-no-repeat"
            style={{
              backgroundImage:
                "linear-gradient(90deg, #152F40 35%, rgba(21,47,64,0.7)), url('/assets/black-friday/banner-black-friday.png')",
            }}
            aria-hidden="true"
          />
        )}
        <div className="relative max-w-[1320px] mx-auto px-5 md:px-10">
          {isSaleCategory && (
            <span className="inline-block mb-2 text-[11px] font-semibold tracking-[0.16em] uppercase text-white/85">
              Promoções Artchê
            </span>
          )}
          <h1 className="font-serif-display text-[38px] md:text-[50px] leading-[1.06]">
            {pageTitle}
          </h1>
          <p
            className={`mt-3 max-w-[600px] text-[13px] ${
              isBlackFriday
                ? 'text-[#D0E5F2]'
                : isSaleCategory
                  ? 'text-white/90'
                  : 'text-[#566773]'
            }`}
          >
            {pageDescription}
          </p>
          {isBlackFriday && (
            <div className="mt-5 text-[20px] md:text-[25px] text-[#D0E5F2]">
              Até <strong className="font-semibold text-[1.35em] tabular-nums">70%</strong> de desconto
            </div>
          )}
        </div>
      </section>

      {/* Catalog Layout */}
      <div className="max-w-[1320px] mx-auto px-5 md:px-10 py-8 md:py-12 grid grid-cols-1 md:grid-cols-[215px_1fr] gap-7 md:gap-10">
        {/* Sidebar Filters */}
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => setMobileFiltersOpen((v) => !v)}
            aria-expanded={mobileFiltersOpen}
            className="md:hidden w-full flex items-center justify-between py-3 border-b border-[#DCE2E5] text-xs font-medium text-[#152F40]"
          >
            <span>Filtrar e navegar por categorias</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform ${mobileFiltersOpen ? 'rotate-180' : ''}`}
            />
          </button>

          <aside
            aria-label="Filtrar catálogo"
            className={`${mobileFiltersOpen ? 'block pt-4 pb-6 border-b border-[#DCE2E5]' : 'hidden'} md:block`}
          >
            <h2 className="font-sans-body text-[13px] font-medium text-[#152F40] mb-3.5">
              Explore por categoria
            </h2>
            <div className="flex flex-wrap md:flex-col gap-x-4 gap-y-1">
              <a
                href="/catalogo/"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate('/catalogo/');
                }}
                aria-current={!categorySlug && !search ? 'page' : undefined}
                className={`py-1.5 text-xs transition-colors ${
                  !categorySlug && !search
                    ? 'font-semibold underline underline-offset-4 text-[#152F40]'
                    : 'text-[#152F40] hover:text-[#476E84]'
                }`}
              >
                Todo o catálogo
              </a>
              {categories.map((c) => {
                const active = categorySlug === c.slug;
                return (
                  <a
                    key={c.slug}
                    href={`/categoria/${c.slug}/`}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate(`/categoria/${c.slug}/`);
                    }}
                    aria-current={active ? 'page' : undefined}
                    className={`py-1.5 text-xs transition-colors ${
                      active
                        ? 'font-semibold underline underline-offset-4 text-[#152F40]'
                        : 'text-[#152F40] hover:text-[#476E84]'
                    }`}
                  >
                    {c.name}
                  </a>
                );
              })}
            </div>

            <div className="border-t border-[#DCE2E5] mt-6 pt-5">
              <h2 className="font-sans-body text-[13px] font-medium text-[#152F40] mb-3">
                Perfil
              </h2>
              <div className="flex flex-wrap md:flex-col gap-x-4 gap-y-2">
                {(['feminino', 'masculino', 'infantil', ''] as const).map((val) => (
                  <label
                    key={val || 'all'}
                    className="inline-flex items-center gap-2 text-xs text-[#152F40] cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="perfil"
                      value={val}
                      checked={perfil === val}
                      onChange={() => onUpdateParams({ perfil: val || null })}
                      className="accent-[#152F40]"
                    />
                    <span>
                      {val ? val.charAt(0).toUpperCase() + val.slice(1) : 'Todos'}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="border-t border-[#DCE2E5] mt-6 pt-5">
              <label
                htmlFor="brand-filter"
                className="block text-[13px] font-medium text-[#152F40] mb-2.5"
              >
                Marca
              </label>
              <select
                id="brand-filter"
                value={brand}
                onChange={(e) => onUpdateParams({ marca: e.target.value || null })}
                className="w-full border border-[#DCE2E5] bg-white px-3 py-2.5 text-xs text-[#152F40] focus:outline-none focus:border-[#152F40]"
              >
                <option value="">Todas as marcas</option>
                {availableBrands.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          </aside>
        </div>

        {/* Main Grid Column */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5 text-[11px] text-[#566773]">
            <span role="status" className="tabular-nums">
              {filteredList.length.toLocaleString('pt-BR')} peças para explorar
            </span>
            <label className="inline-flex items-center gap-2">
              <span>Ordenar</span>
              <select
                value={sort}
                onChange={(e) => onUpdateParams({ ordem: e.target.value || null })}
                className="border border-[#DCE2E5] bg-white px-3 py-2 text-xs text-[#152F40] focus:outline-none focus:border-[#152F40]"
              >
                <option value="">Seleção do catálogo</option>
                <option value="az">Nome: A a Z</option>
                <option value="za">Nome: Z a A</option>
              </select>
            </label>
          </div>

          <p className="text-[11px] text-[#566773] bg-[#F5F6F5] px-4 py-3 mb-6">
            Gostou de uma peça? Clique em “Ver produto” para consultar tamanhos, cores e disponibilidade na Artchê pelo WhatsApp, ou adicione diretamente na sua mala.
          </p>

          {visibleItems.length > 0 ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-7 md:gap-x-5 md:gap-y-8">
              {visibleItems.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  inBag={bagIds.has(product.id)}
                  onSelectProduct={onSelectProduct}
                  onToggleBag={onToggleBag}
                  onEditProduct={(id) => onNavigate(`/admin/?editar=${encodeURIComponent(id)}`)}
                />
              ))}
            </div>
          ) : (
            <div className="bg-[#F5F6F5] py-14 px-6 text-center border border-[#DCE2E5]">
              <h2 className="font-serif-display text-[30px] text-[#152F40]">
                Nenhuma peça encontrada.
              </h2>
              <p className="text-[13px] text-[#566773] mt-2 mb-6">
                Tente outro termo ou explore o catálogo completo.
              </p>
              <a
                href="/catalogo/"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate('/catalogo/');
                }}
                className="inline-flex items-center justify-center px-6 py-3 min-h-[46px] bg-[#152F40] text-white text-xs font-medium hover:bg-[#2E5267] transition-colors"
              >
                Limpar busca e filtros
              </a>
            </div>
          )}

          {/* Progressive Load More */}
          {filteredList.length > ITEMS_PER_BATCH && (
            <div className="mt-12 pt-8 border-t border-[#DCE2E5] flex flex-col items-center gap-4 text-center">
              <p className="text-[11px] text-[#566773] tabular-nums">
                Mostrando {displayedCount.toLocaleString('pt-BR')} de{' '}
                {filteredList.length.toLocaleString('pt-BR')} peças
              </p>

              {remainingCount > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setVisibleCount((prev) =>
                      Math.min(filteredList.length, prev + ITEMS_PER_BATCH)
                    )
                  }
                  className="inline-flex items-center justify-center px-8 py-3.5 min-h-[48px] border border-[#152F40] bg-white text-[#152F40] text-xs font-medium hover:bg-[#152F40] hover:text-white transition-colors whitespace-nowrap"
                >
                  Carregar mais {nextBatchCount}{' '}
                  {nextBatchCount === 1 ? 'peça' : 'peças'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
