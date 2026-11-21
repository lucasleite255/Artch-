import React, { useRef } from 'react';
import {
  MessageSquare,
  Package,
  MapPin,
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { Product } from '../types/catalog';
import {
  HOME_FEATURED_LIMIT,
  buildWhatsAppUrl,
  getHomeFeaturedProducts,
  INSTAGRAM_URL,
  MAPS_URL,
  STORE_ADDRESS,
  STORE_CITY,
  matchesCategory,
  resolveCategoryCoverImage,
} from '../data/catalog';
import { useCatalog } from '../context/CatalogContext';
import { HeroCarousel } from './HeroCarousel';
import { ProductCard } from './ProductCard';
import { BrandLogo } from './BrandLogo';
import {
  EditorialLayersGraphic,
  StorefrontGraphic,
} from './CampaignVisual';

interface HomePageProps {
  products: Product[];
  bagIds: Set<string>;
  onNavigate: (path: string) => void;
  onSelectProduct: (id: string) => void;
  onToggleBag: (product: Product) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  products,
  bagIds,
  onNavigate,
  onSelectProduct,
  onToggleBag,
}) => {
  const { categories, homeCategories } = useCatalog();
  const categoryTrackRef = useRef<HTMLDivElement>(null);
  const brandTrackRef = useRef<HTMLDivElement>(null);

  const featured = getHomeFeaturedProducts(products, HOME_FEATURED_LIMIT);
  const displayedCategories =
    homeCategories.length > 0 ? homeCategories : categories.slice(0, 5);

  const scrollCategories = (direction: 1 | -1) => {
    const track = categoryTrackRef.current;
    if (!track) return;
    const item = track.querySelector<HTMLElement>('[data-category-item]');
    const step = item ? item.getBoundingClientRect().width + 16 : 260;
    const max = track.scrollWidth - track.clientWidth;
    let target = track.scrollLeft + direction * step;
    if (direction > 0 && track.scrollLeft >= max - 2) target = 0;
    if (direction < 0 && track.scrollLeft <= 2) target = max;
    track.scrollTo({ left: target, behavior: 'smooth' });
  };

  const scrollBrands = (direction: 1 | -1) => {
    const track = brandTrackRef.current;
    if (!track) return;
    const item = track.querySelector<HTMLElement>('[data-brand-item]');
    const step = item ? item.getBoundingClientRect().width : 260;
    const max = track.scrollWidth - track.clientWidth;
    let target = track.scrollLeft + direction * step;
    if (direction > 0 && track.scrollLeft >= max - 2) target = 0;
    if (direction < 0 && track.scrollLeft <= 2) target = max;
    track.scrollTo({ left: target, behavior: 'smooth' });
  };

  return (
    <div>
      {/* 1. Hero Carousel */}
      <HeroCarousel onNavigate={onNavigate} />

      {/* 2. Benefits Strip */}
      <div className="border-b border-[#DCE2E5]">
        <div className="max-w-[1320px] mx-auto px-0 md:px-10 py-0 md:py-6 grid grid-cols-1 md:grid-cols-3 gap-0">
          <div className="w-full flex items-center md:justify-center gap-4 px-5 py-3.5 md:px-4 md:py-0">
            <MessageSquare className="w-6 h-6 text-[#152F40] shrink-0" strokeWidth={1.3} />
            <div className="min-w-0 flex-1 md:flex-initial">
              <strong className="block text-xs font-medium text-[#152F40]">
                Atendimento de verdade
              </strong>
              <span className="block text-[11px] text-[#566773]">
                Escolha com ajuda pelo WhatsApp
              </span>
            </div>
          </div>
          <div className="w-full flex items-center md:justify-center gap-4 px-5 py-3.5 md:px-4 md:py-0 md:border-l md:border-[#DCE2E5]">
            <Package className="w-6 h-6 text-[#152F40] shrink-0" strokeWidth={1.3} />
            <div className="min-w-0 flex-1 md:flex-initial">
              <strong className="block text-xs font-medium text-[#152F40]">
                Uma mala bem pensada
              </strong>
              <span className="block text-[11px] text-[#566773]">Orientação para o seu destino</span>
            </div>
          </div>
          <div className="w-full flex items-center md:justify-center gap-4 px-5 py-3.5 md:px-4 md:py-0 md:border-l md:border-[#DCE2E5]">
            <MapPin className="w-6 h-6 text-[#152F40] shrink-0" strokeWidth={1.3} />
            <div className="min-w-0 flex-1 md:flex-initial">
              <strong className="block text-xs font-medium text-[#152F40]">
                Encontre a Artchê em Brasília
              </strong>
              <span className="block text-[11px] text-[#566773]">Esperamos você na Asa Sul</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Style Collections Carousel */}
      <section className="max-w-[1320px] mx-auto px-5 md:px-10 py-12 md:py-16">
        <div className="mb-7">
          <h2 className="font-serif-display text-[34px] md:text-[44px] text-[#152F40]">
            O inverno tem o seu estilo.
          </h2>
          <p className="text-[13px] text-[#566773] mt-2">
            Encontre o que combina com você e com a sua viagem.
          </p>
        </div>

        <div
          ref={categoryTrackRef}
          tabIndex={0}
          aria-label="Categorias: deslize para o lado para ver mais"
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') {
              e.preventDefault();
              scrollCategories(1);
            } else if (e.key === 'ArrowLeft') {
              e.preventDefault();
              scrollCategories(-1);
            }
          }}
          className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar gap-3 md:gap-4"
        >
          {displayedCategories.map((cat) => {
            const coverUrl = resolveCategoryCoverImage(cat, products, categories);
            const fallbackCover = resolveCategoryCoverImage(
              { ...cat, coverImage: '' },
              products,
              categories
            );
            return (
              <a
                key={cat.slug}
                data-category-item
                href={`/categoria/${cat.slug}/`}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate(`/categoria/${cat.slug}/`);
                }}
                className="group relative flex-none w-[64%] sm:w-[40%] md:w-[30%] lg:w-[calc((100%-64px)/5)] aspect-[4/5] snap-start overflow-hidden bg-[#F5F6F5] border border-[#DCE2E5]/80"
              >
                <img
                  src={coverUrl}
                  alt={cat.name}
                  width={480}
                  height={600}
                  loading="lazy"
                  onError={(e) => {
                    const img = e.currentTarget;
                    const step = img.dataset.fallbackStep || '0';
                    if (step === '0' && fallbackCover && !img.src.endsWith(fallbackCover)) {
                      img.dataset.fallbackStep = '1';
                      img.src = fallbackCover;
                      return;
                    }
                    if (step !== '2') {
                      img.dataset.fallbackStep = '2';
                      img.src = '/assets/categories/feminino-artche.png';
                    }
                  }}
                  className="w-full h-full object-cover object-[center_20%] transition-transform duration-500 ease-out group-hover:scale-[1.035]"
                />
                <div
                  className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#0E2636]/80 to-transparent"
                  aria-hidden="true"
                />
                <div className="absolute bottom-5 inset-x-5 z-10 text-white flex items-center justify-between gap-2 font-serif-display text-[24px] md:text-[27px] leading-tight">
                  <span className="truncate">{cat.name}</span>
                  <ArrowUpRight className="w-5 h-5 shrink-0" strokeWidth={1.6} />
                </div>
              </a>
            );
          })}
        </div>

        <div className="mt-5 flex items-center justify-between gap-4">
          <a
            href="/catalogo/"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/catalogo/');
            }}
            className="text-xs border-b border-[#152F40] pb-1 whitespace-nowrap hover:text-[#476E84] transition-colors"
          >
            Todas as peças ↗
          </a>

          <div
            className={`items-center gap-2 shrink-0 ${
              displayedCategories.length > 5 ? 'flex' : 'flex lg:hidden'
            }`}
          >
            <button
              type="button"
              onClick={() => scrollCategories(-1)}
              aria-label="Categorias anteriores"
              className="w-10 h-10 border border-[#DCE2E5] grid place-items-center text-[#152F40] hover:bg-[#152F40] hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollCategories(1)}
              aria-label="Próximas categorias"
              className="w-10 h-10 border border-[#DCE2E5] grid place-items-center text-[#152F40] hover:bg-[#152F40] hover:text-white transition-colors"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* 4. Featured Highlights */}
      <section className="max-w-[1320px] mx-auto px-5 md:px-10 pt-4 pb-12 md:pb-16">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-7">
          <div>
            <h2 className="font-serif-display text-[34px] md:text-[44px] text-[#152F40]">
              Nossos destaques
            </h2>
            <p className="text-[13px] text-[#566773] mt-2">
              Explore as peças, veja os detalhes do produto ou adicione na sua mala.
            </p>
          </div>
          <a
            href="/catalogo/"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/catalogo/');
            }}
            className="text-xs border-b border-[#152F40] pb-1 whitespace-nowrap hover:text-[#476E84] transition-colors"
          >
            Ver catálogo ↗
          </a>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-7 md:gap-x-6 md:gap-y-8">
          {featured.map((product) => (
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

        <div className="mt-9 flex flex-col items-center gap-4">
          <p role="status" className="text-[11px] text-[#566773] tabular-nums">
            {featured.length} destaques selecionados
          </p>
          <a
            href="/catalogo/"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/catalogo/');
            }}
            className="inline-flex items-center gap-3 px-6 py-3 min-h-[46px] border border-[#152F40] text-xs font-medium text-[#152F40] hover:bg-[#152F40] hover:text-white transition-colors"
          >
            Explorar catálogo completo ↗
          </a>
        </div>
      </section>

      {/* 6. Brands Rail */}
      <section className="pb-12 md:pb-16" aria-label="Marcas que trabalhamos">
        <div className="max-w-[1320px] mx-auto px-5 md:px-10">
          <div className="flex items-end justify-between gap-4 mb-3">
            <div>
              <h2 className="font-serif-display text-[32px] md:text-[42px] text-[#152F40]">
                Marcas que acompanham você.
              </h2>
              <p className="text-[13px] text-[#566773] mt-1.5">
                Conheça as marcas que fazem parte da Artchê.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => scrollBrands(-1)}
                aria-label="Marcas anteriores"
                className="w-10 h-10 border border-[#DCE2E5] grid place-items-center text-[#152F40] hover:bg-[#152F40] hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollBrands(1)}
                aria-label="Próximas marcas"
                className="w-10 h-10 border border-[#DCE2E5] grid place-items-center text-[#152F40] hover:bg-[#152F40] hover:text-white transition-colors"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div
            ref={brandTrackRef}
            tabIndex={0}
            aria-label="Marcas: deslize para navegar"
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') {
                e.preventDefault();
                scrollBrands(1);
              } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                scrollBrands(-1);
              }
            }}
            className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar border-b border-[#DCE2E5]"
          >
            {(['columbia', 'solo', 'thenorthface', 'ambicione'] as const).map(
              (brand) => (
                <div
                  key={brand}
                  data-brand-item
                  className="flex-none w-1/2 md:w-1/4 h-[130px] flex items-center justify-center snap-start bg-white px-4"
                >
                  <BrandLogo brand={brand} />
                </div>
              )
            )}
          </div>
        </div>
      </section>

      {/* 7. Editorial Split */}
      <section className="grid grid-cols-1 md:grid-cols-2 bg-[#D0E5F2] items-stretch">
        <div className="min-h-[280px] md:min-h-[420px] w-full overflow-hidden">
          <EditorialLayersGraphic className="w-full h-full object-cover" />
        </div>
        <div className="flex flex-col justify-center items-start px-6 py-10 md:px-16 md:py-14">
          <h2 className="font-serif-display text-[36px] md:text-[48px] text-[#152F40] max-w-[380px]">
            A viagem é sua.
            <br />A gente cuida das camadas.
          </h2>
          <p className="text-[13px] text-[#152F40]/90 my-5 max-w-[380px] leading-relaxed">
            Primeira vez na neve ou mais um destino na sua lista? Conte para onde você vai.
            Nossa equipe ajuda a escolher as peças e a montar combinações para o frio.
          </p>
          <a
            href={buildWhatsAppUrl(
              'Olá, Artchê! Vou viajar para o frio e gostaria de ajuda para montar minha mala.'
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-4 px-6 py-3.5 min-h-[48px] bg-[#152F40] text-white hover:bg-[#2E5267] text-xs font-medium transition-colors"
          >
            <span>Montar minha mala com a Artchê</span>
            <ArrowUpRight className="w-4 h-4" />
          </a>
        </div>
      </section>

      {/* 8. Physical Store Brasília */}
      <section id="loja" className="max-w-[1320px] mx-auto px-5 md:px-10 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center">
          <div>
            <h2 className="font-serif-display text-[36px] md:text-[44px] text-[#152F40]">
              Seu destino começa
              <br />
              na nossa loja.
            </h2>
            <p className="text-[13px] text-[#566773] mt-5 max-w-[440px] leading-relaxed">
              Experimente, conheça os detalhes e escolha com orientação. A Artchê reúne roupas e
              acessórios para inverno rigoroso, frio intenso e neve.
            </p>
            <address className="not-italic text-[13px] text-[#152F40] my-6 leading-relaxed">
              {STORE_ADDRESS}
              <br />
              {STORE_CITY}
            </address>
            <div className="flex flex-wrap items-center gap-5">
              <a
                href={MAPS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 px-6 py-3 min-h-[46px] border border-[#152F40] text-xs font-medium text-[#152F40] hover:bg-[#152F40] hover:text-white transition-colors"
              >
                <span>Como chegar</span>
                <ArrowUpRight className="w-4 h-4" />
              </a>
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs border-b border-[#152F40] pb-1 hover:text-[#476E84] transition-colors"
              >
                @artcheloja ↗
              </a>
            </div>
          </div>

          <div className="w-full max-w-[440px] md:ml-auto overflow-hidden border border-[#DCE2E5]">
            <StorefrontGraphic />
          </div>
        </div>
      </section>

      {/* 9. Bottom Consultation Ribbon */}
      <section className="bg-[#F5F6F5] border-t border-[#DCE2E5] py-9">
        <div className="max-w-[1320px] mx-auto px-5 md:px-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <h2 className="font-serif-display text-[30px] md:text-[34px] text-[#152F40]">
              De malas prontas com a Artchê.
            </h2>
            <p className="text-[13px] text-[#566773] mt-1.5">
              Seu próximo destino começa com as escolhas certas para o frio.
            </p>
          </div>
          <a
            href={buildWhatsAppUrl(
              'Olá, Artchê! Quero falar com um consultor para montar minha mala de inverno.'
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-4 px-6 py-3.5 min-h-[48px] bg-[#152F40] text-white hover:bg-[#2E5267] text-xs font-medium transition-colors whitespace-nowrap shrink-0"
          >
            <span>Fale com um consultor</span>
            <ArrowUpRight className="w-4 h-4" />
          </a>
        </div>
      </section>
    </div>
  );
};
