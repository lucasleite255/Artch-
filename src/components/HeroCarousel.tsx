import React, { useState, useEffect, useCallback } from 'react';
import { ArrowUpRight, ArrowLeft, ArrowRight } from 'lucide-react';
import { useCatalog } from '../context/CatalogContext';
import { HeroSlideMedia } from './CampaignVisual';

interface HeroCarouselProps {
  onNavigate: (path: string) => void;
}

export const HeroCarousel: React.FC<HeroCarouselProps> = ({ onNavigate }) => {
  const { activeHeroSlides } = useCatalog();
  const slides = activeHeroSlides;
  const [current, setCurrent] = useState(0);
  const [prefersReducedMotion] = useState(() =>
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  const [hovered, setHovered] = useState(false);

  const safeIndex = slides.length > 0 ? Math.min(current, slides.length - 1) : 0;

  useEffect(() => {
    if (current >= slides.length && slides.length > 0) {
      setCurrent(0);
    }
  }, [current, slides.length]);

  const goTo = useCallback(
    (index: number) => {
      if (slides.length === 0) return;
      setCurrent((index + slides.length) % slides.length);
    },
    [slides.length]
  );

  useEffect(() => {
    if (prefersReducedMotion || hovered || slides.length <= 1) return;
    const timer = window.setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [prefersReducedMotion, hovered, slides.length, safeIndex]);

  if (slides.length === 0) {
    return null;
  }

  return (
    <section
      className="relative isolate bg-[#152F40] overflow-hidden md:h-[520px]"
      aria-label="Coleções Artchê"
      aria-roledescription="carrossel"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="grid md:block md:h-full">
        {slides.map((slide, index) => {
          const isActive = index === safeIndex;
          const isExternal = /^https?:\/\//i.test(slide.ctaPath);
          return (
            <div
              key={slide.id}
              id={slide.id}
              role="group"
              aria-label={`${index + 1} de ${slides.length}`}
              aria-hidden={!isActive}
              className={`col-start-1 row-start-1 flex flex-col md:block md:absolute md:inset-0 transition-opacity duration-500 ease-out ${
                isActive
                  ? 'opacity-100 visible pointer-events-auto z-10'
                  : 'opacity-0 invisible pointer-events-none z-0'
              }`}
            >
              {/* Mobile top image/video block / Desktop full-bleed backdrop */}
              <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] overflow-hidden bg-[#152F40] shrink-0 md:absolute md:inset-0 md:w-auto md:aspect-auto md:h-full">
                <HeroSlideMedia slide={slide} isActive={isActive} />
              </div>

              {/* Desktop contrast scrim ensuring >= 4.5:1 legibility */}
              <div
                className="hidden md:block absolute inset-0 pointer-events-none"
                style={{
                  background:
                    'linear-gradient(90deg, rgba(10, 28, 39, 0.85) 0%, rgba(10, 28, 39, 0.45) 52%, rgba(10, 28, 39, 0.1) 100%)',
                }}
                aria-hidden="true"
              />

              {/* Mobile solid #152F40 content block / Desktop overlay content */}
              <div className="relative flex-1 bg-[#152F40] px-5 pt-6 pb-20 md:bg-transparent md:max-w-[1320px] md:mx-auto md:px-10 md:py-0 md:h-full md:flex md:items-center">
                <div className="text-white max-w-[560px] md:pb-10">
                  <h1 className="font-serif-display text-[40px] sm:text-[50px] md:text-[66px] font-medium leading-[1.06] text-white">
                    {slide.title}
                  </h1>

                  {slide.description && (
                    <p className="mt-4 mb-6 text-[14px] md:text-[15px] leading-relaxed text-[#E6EFF4] max-w-[390px]">
                      {slide.description}
                    </p>
                  )}

                  {isExternal ? (
                    <a
                      href={slide.ctaPath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex items-center justify-between gap-6 px-6 py-3.5 min-h-[48px] bg-white text-[#152F40] hover:bg-[#D0E5F2] text-xs font-medium transition-colors whitespace-nowrap ${
                        slide.description ? '' : 'mt-6'
                      }`}
                    >
                      <span>{slide.ctaLabel}</span>
                      <ArrowUpRight className="w-4 h-4 shrink-0" strokeWidth={1.6} />
                    </a>
                  ) : (
                    <a
                      href={slide.ctaPath}
                      onClick={(e) => {
                        e.preventDefault();
                        onNavigate(slide.ctaPath);
                      }}
                      className={`inline-flex items-center justify-between gap-6 px-6 py-3.5 min-h-[48px] bg-white text-[#152F40] hover:bg-[#D0E5F2] text-xs font-medium transition-colors whitespace-nowrap ${
                        slide.description ? '' : 'mt-6'
                      }`}
                    >
                      <span>{slide.ctaLabel}</span>
                      <ArrowUpRight className="w-4 h-4 shrink-0" strokeWidth={1.6} />
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Carousel Controls */}
      {slides.length > 1 && (
        <div className="absolute bottom-5 left-0 right-0 z-20 max-w-[1320px] mx-auto px-5 md:px-10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 md:gap-2 md:bg-[#152F40]/75 md:px-3 md:py-1.5">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Mostrar banner ${i + 1}`}
                aria-pressed={i === safeIndex}
                className="py-2 w-4 sm:w-5 md:w-6 group cursor-pointer"
              >
                <span
                  className={`block h-[2px] w-full transition-colors ${
                    i === safeIndex ? 'bg-white' : 'bg-white/35 group-hover:bg-white/75'
                  }`}
                />
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 md:bg-[#152F40]/85 md:px-2.5 md:py-1.5 text-white shrink-0">
            <span className="text-[11px] tracking-[0.14em] tabular-nums mr-1.5 md:mr-2 whitespace-nowrap">
              {String(safeIndex + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
            </span>
            <button
              type="button"
              onClick={() => goTo(safeIndex - 1)}
              aria-label="Banner anterior"
              className="border border-white/45 w-9 h-9 md:w-8 md:h-8 grid place-items-center hover:bg-white hover:text-[#152F40] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => goTo(safeIndex + 1)}
              aria-label="Próximo banner"
              className="border border-white/45 w-9 h-9 md:w-8 md:h-8 grid place-items-center hover:bg-white hover:text-[#152F40] transition-colors"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
