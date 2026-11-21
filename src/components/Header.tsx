import React, { useState, useEffect, useMemo } from 'react';
import { Search, Menu, X, Briefcase, ArrowUpRight } from 'lucide-react';
import { ArtcheLogo } from './ArtcheLogo';
import { buildWhatsAppUrl } from '../data/catalog';
import { useCatalog } from '../context/CatalogContext';

interface HeaderProps {
  currentPath: string;
  searchQuery: string;
  bagCount: number;
  onNavigate: (path: string) => void;
  onSearchSubmit: (query: string) => void;
  onOpenBag: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentPath,
  searchQuery,
  bagCount,
  onNavigate,
  onSearchSubmit,
  onOpenBag,
}) => {
  const { categories } = useCatalog();
  const [inputValue, setInputValue] = useState(searchQuery);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = useMemo<Array<{ label: string; path: string; isHighlight?: boolean }>>(() => {
    const categoryItems = categories.map((c) => ({
      label: c.name,
      path: `/categoria/${c.slug}/`,
      isHighlight: c.slug === 'sale',
    }));
    return [
      { label: 'Todo o catálogo', path: '/catalogo/' },
      ...categoryItems,
      { label: 'Nossa loja', path: '/#loja' },
    ];
  }, [categories]);

  useEffect(() => {
    setInputValue(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    onSearchSubmit(inputValue.trim());
  };

  const handleLinkClick = (e: React.MouseEvent, path: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    onNavigate(path);
  };

  return (
    <>
      <a
        href="#main"
        className="fixed -top-24 focus:top-0 left-4 z-50 bg-[#152F40] text-white px-4 py-3 text-xs font-medium transition-all"
      >
        Pular para o conteúdo
      </a>

      {/* Slim top bar (<= 36px) */}
      <div className="bg-[#152F40] text-white text-center px-4 py-2 text-[11px] tracking-[0.055em]">
        <span>Seu destino é o frio. O cuidado com a sua mala é nosso.</span>
        <a
          href={buildWhatsAppUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:inline-block ml-5 underline underline-offset-4 hover:text-[#9CC1D9] transition-colors"
        >
          Fale com a Artchê
        </a>
      </div>

      <header className="bg-white border-b border-[#DCE2E5]">
        {/* Main Header Row */}
        <div className="max-w-[1320px] mx-auto px-5 md:px-10 py-4 md:py-0 md:h-[104px] flex flex-wrap md:flex-nowrap items-center justify-between gap-4 lg:gap-10">
          {/* Zone 1: Brand Wordmark */}
          <a
            href="/"
            onClick={(e) => handleLinkClick(e, '/')}
            aria-label="Artchê — início"
            className="shrink-0 focus-visible:outline-2 focus-visible:outline-[#437393] focus-visible:outline-offset-4"
          >
            <ArtcheLogo variant="dark" />
          </a>

          {/* Mobile Action Cluster */}
          <div className="flex md:hidden items-center gap-2">
            <button
              type="button"
              onClick={onOpenBag}
              className="relative flex items-center gap-1.5 px-3 min-h-[44px] border border-[#DCE2E5] text-xs font-medium text-[#152F40] whitespace-nowrap shrink-0"
              aria-label={`Abrir Minha Mala (${bagCount} peças)`}
            >
              <Briefcase className="w-4 h-4" strokeWidth={1.6} />
              <span>Mala</span>
              {bagCount > 0 && <span className="tabular-nums font-semibold">({bagCount})</span>}
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-expanded={mobileMenuOpen}
              aria-controls="main-nav"
              className="flex items-center gap-2 px-3 min-h-[44px] text-xs font-medium text-[#152F40] whitespace-nowrap shrink-0"
            >
              <span>Menu</span>
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          {/* Search Form */}
          <form
            onSubmit={handleSubmit}
            className="w-full md:flex-1 md:max-w-[520px] flex items-center bg-[#F5F6F5] border-b border-[#BECBD2] focus-within:border-[#152F40] transition-colors"
            role="search"
          >
            <label htmlFor="header-search" className="sr-only">
              Buscar no catálogo
            </label>
            <input
              id="header-search"
              type="search"
              autoComplete="off"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="O que vai na sua mala? Busque uma peça…"
              className="w-full min-w-0 bg-transparent px-4 py-3 md:py-3.5 text-[13px] text-[#152F40] placeholder:text-[#566773] focus:outline-none"
            />
            <button
              type="submit"
              aria-label="Buscar produtos"
              className="h-11 w-12 shrink-0 grid place-items-center text-[#152F40] hover:text-[#476E84] transition-colors"
            >
              <Search className="w-[19px] h-[19px]" strokeWidth={1.6} />
            </button>
          </form>

          {/* Zone 3: Desktop Actions */}
          <div className="hidden md:flex items-center gap-5 shrink-0">
            <button
              type="button"
              onClick={onOpenBag}
              className="flex items-center gap-2.5 px-4 min-h-[44px] border border-[#DCE2E5] hover:border-[#152F40] text-xs font-medium text-[#152F40] transition-colors whitespace-nowrap shrink-0"
              aria-label={`Abrir Minha Mala (${bagCount} peças)`}
            >
              <Briefcase className="w-4 h-4" strokeWidth={1.6} />
              <span>Minha mala</span>
              <span className="tabular-nums text-[#566773]">({bagCount})</span>
            </button>

            <a
              href={buildWhatsAppUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden lg:flex items-center gap-3 text-[11px] text-[#152F40] hover:text-[#476E84] transition-colors whitespace-nowrap shrink-0"
            >
              <span
                className="w-9 h-9 border border-[#BCC9D0] grid place-items-center shrink-0"
                aria-hidden="true"
              >
                <ArrowUpRight className="w-4 h-4" strokeWidth={1.5} />
              </span>
              <span className="leading-tight">
                Atendimento personalizado
                <strong className="block font-medium text-[13px]">Vamos conversar?</strong>
              </span>
            </a>
          </div>
        </div>

        {/* Navigation Row */}
        <nav
          id="main-nav"
          aria-label="Navegação principal"
          className={`${mobileMenuOpen ? 'block' : 'hidden'} md:block border-t border-[#DCE2E5]`}
        >
          <div className="max-w-[1320px] mx-auto px-5 md:px-10 py-3 md:py-0 grid grid-cols-2 md:flex md:items-center md:justify-between gap-x-4 gap-y-1 overflow-x-auto no-scrollbar">
            {navItems.map((item) => {
              const isActive =
                !item.path.includes('#') &&
                (currentPath === item.path ||
                  (item.path !== '/' && currentPath.startsWith(item.path)));
              return (
                <a
                  key={item.path}
                  href={item.path}
                  onClick={(e) => handleLinkClick(e, item.path)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative py-2.5 md:py-3.5 text-[12px] whitespace-nowrap shrink-0 transition-colors ${
                    item.isHighlight
                      ? 'font-semibold text-[#8B2635] hover:text-[#152F40]'
                      : isActive
                        ? 'font-normal text-[#595334]'
                        : 'font-normal text-[#152F40] hover:text-[#595334]'
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <span
                      className="hidden md:block absolute bottom-0 left-0 right-0 h-[2px] bg-[#152F40]"
                      aria-hidden="true"
                    />
                  )}
                </a>
              );
            })}
          </div>
        </nav>
      </header>
    </>
  );
};
