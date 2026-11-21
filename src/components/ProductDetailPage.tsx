import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  Briefcase,
  Check,
  Copy,
  Pencil,
  Play,
  Star,
} from 'lucide-react';
import { Product } from '../types/catalog';
import {
  STORE_ADDRESS,
  STORE_CITY,
  buildWhatsAppUrl,
  formatProductCategoryLabel,
  isProductOnSale,
  toAbsoluteSiteUrl,
} from '../data/catalog';
import { useCatalog } from '../context/CatalogContext';
import { GarmentVisual } from './GarmentVisual';
import { ProductCard } from './ProductCard';

interface ProductDetailPageProps {
  products: Product[];
  productId: string;
  bagIds: Set<string>;
  onNavigate: (path: string) => void;
  onSelectProduct: (id: string) => void;
  onToggleBag: (product: Product, variant?: string) => void;
}

type MediaSlide = { type: 'video' | 'image'; url: string; imageIndex?: number };

export const ProductDetailPage: React.FC<ProductDetailPageProps> = ({
  products,
  productId,
  bagIds,
  onNavigate,
  onSelectProduct,
  onToggleBag,
}) => {
  const { isAdmin, categories, homeFeaturedIds, toggleFeaturedOnHome } = useCatalog();
  const product = products.find((p) => p.id === productId);
  const [selectedSlide, setSelectedSlide] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState('');
  const [togglingFeatured, setTogglingFeatured] = useState(false);
  const [adminNotice, setAdminNotice] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  useEffect(() => {
    setSelectedSlide(0);
    setSelectedVariant('');
    setAdminNotice(null);
    setCopyStatus(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [productId]);

  const mediaSlides = useMemo<MediaSlide[]>(() => {
    if (!product) return [];
    const imageList =
      product.images.length > 0
        ? product.images
        : product.cover
          ? [product.cover]
          : [];
    const imageSlides: MediaSlide[] = imageList.map((url, idx) => ({
      type: 'image',
      url,
      imageIndex: idx,
    }));

    if (product.videoUrl) {
      const videoSlide: MediaSlide = { type: 'video', url: product.videoUrl };
      if (product.coverType === 'video') {
        return [videoSlide, ...imageSlides];
      }
      return [...imageSlides, videoSlide];
    }

    return imageSlides;
  }, [product]);

  if (!product) {
    return (
      <div>
        <div className="max-w-[1320px] mx-auto px-5 md:px-10 py-6 text-[11px] text-[#566773]">
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
          <span>Peça não encontrada</span>
        </div>
        <div className="max-w-[1320px] mx-auto px-5 md:px-10 py-14">
          <h1 className="font-serif-display text-[38px] text-[#152F40]">
            Peça não encontrada
          </h1>
          <p className="text-[13px] text-[#566773] mt-3 mb-6">
            Explore outras opções no catálogo.
          </p>
          <a
            href="/catalogo/"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/catalogo/');
            }}
            className="inline-flex items-center px-6 py-3 min-h-[46px] bg-[#152F40] text-white text-xs font-medium hover:bg-[#2E5267] transition-colors"
          >
            Ver catálogo
          </a>
        </div>
      </div>
    );
  }

  const related = products
    .filter(
      (x) =>
        x.id !== product.id &&
        x.categories.some((c) => product.categories.includes(c) && !c.includes('/Marcas/'))
    )
    .slice(0, 4);

  const inBag = bagIds.has(product.id);
  const onSale = isProductOnSale(product, categories);
  const activeSlide = mediaSlides[selectedSlide] || mediaSlides[0];
  const fallbackPoster = product.cover || product.images[0] || undefined;
  const activePhotoPath =
    activeSlide?.type === 'image' ? activeSlide.url : fallbackPoster || '';
  const productPageUrl = toAbsoluteSiteUrl(`/produto/${product.id}/`);
  const productPhotoUrl = activePhotoPath ? toAbsoluteSiteUrl(activePhotoPath) : '';

  const waMessage = [
    'Olá, Artchê! Gostaria de consultar o valor, cores, tamanhos e disponibilidade desta peça:',
    '',
    `${product.name}${onSale ? ' — SALE' : ''}${product.blackFriday ? ' — Black Friday' : ''} (ref. ${product.id})${
      selectedVariant ? `\nOpção: ${selectedVariant}` : ''
    }`,
    '',
    productPageUrl ? `Link da peça: ${productPageUrl}` : '',
    productPhotoUrl ? `Imagem da peça: ${productPhotoUrl}` : '',
  ]
    .filter((line, idx, arr) => line !== '' || (idx > 0 && arr[idx - 1] !== ''))
    .join('\n');

  const waUrl = buildWhatsAppUrl(waMessage);

  const handleCopyPhotoForWhatsApp = async () => {
    if (!productPhotoUrl) return;
    setCopyStatus(null);
    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        const pngBlob = await new Promise<Blob>((resolve, reject) => {
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = img.naturalWidth || 800;
              canvas.height = img.naturalHeight || 1000;
              const ctx = canvas.getContext('2d');
              if (!ctx) {
                reject(new Error('Canvas indisponível'));
                return;
              }
              ctx.drawImage(img, 0, 0);
              canvas.toBlob(
                (blob) => (blob ? resolve(blob) : reject(new Error('Falha ao gerar PNG'))),
                'image/png'
              );
            } catch (e) {
              reject(e);
            }
          };
          img.onerror = () => reject(new Error('Falha ao carregar foto'));
          img.src = productPhotoUrl;
        });

        await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
        setCopyStatus('Imagem copiada! Agora você pode colar direto no WhatsApp (Ctrl+V).');
        return;
      }
    } catch {
      // Fall back to copying the direct photo link
    }

    try {
      await navigator.clipboard?.writeText(productPhotoUrl);
      setCopyStatus('Link da imagem copiado para enviar no WhatsApp.');
    } catch {
      setCopyStatus('O link da imagem já está incluído automaticamente na mensagem do WhatsApp.');
    }
  };

  return (
    <div>
      {/* Breadcrumb */}
      <div className="max-w-[1320px] mx-auto px-5 md:px-10 py-6 text-[11px] text-[#566773]">
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
        <a
          href="/catalogo/"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('/catalogo/');
          }}
          className="underline underline-offset-4 hover:text-[#152F40]"
        >
          Catálogo
        </a>
        <span aria-hidden="true"> / </span>
        <span>{product.name}</span>
      </div>

      {/* Product Detail Module */}
      <section className="max-w-[1320px] mx-auto px-5 md:px-10 pb-14 grid grid-cols-1 md:grid-cols-[1.08fr_1fr] gap-8 lg:gap-16 items-start">
        {/* Left: Gallery */}
        <div className="min-w-0">
          <div className="relative w-full max-w-[560px] aspect-[4/5] bg-[#F5F6F5] border border-[#DCE2E5] overflow-hidden">
            {onSale && (
              <span className="absolute top-3 right-3 z-10 bg-[#8B2635] text-white px-3 py-1.5 text-[11px] font-semibold tracking-[0.16em] uppercase leading-none pointer-events-none">
                SALE
              </span>
            )}
            {activeSlide?.type === 'video' ? (
              <video
                src={activeSlide.url}
                poster={fallbackPoster}
                controls
                autoPlay
                muted
                loop
                playsInline
                aria-label={`Vídeo de ${product.name}`}
                className="w-full h-full object-cover bg-[#0E2636]"
              />
            ) : (
              <GarmentVisual
                product={product}
                forceImage
                angleIndex={activeSlide?.imageIndex ?? 0}
              />
            )}
          </div>

          {mediaSlides.length > 1 && (
            <div
              className="flex gap-2.5 mt-3.5 overflow-x-auto pb-1"
              aria-label="Mídias do produto"
            >
              {mediaSlides.map((slide, i) => (
                <button
                  key={`${slide.type}-${slide.url}-${i}`}
                  type="button"
                  onClick={() => setSelectedSlide(i)}
                  aria-label={
                    slide.type === 'video' ? 'Ver vídeo do produto' : `Ver foto ${i + 1}`
                  }
                  aria-pressed={selectedSlide === i}
                  className={`relative w-[72px] aspect-[4/5] shrink-0 bg-[#F5F6F5] overflow-hidden transition-colors ${
                    selectedSlide === i
                      ? 'border-2 border-[#152F40]'
                      : 'border border-[#DCE2E5] hover:border-[#566773]'
                  }`}
                >
                  {slide.type === 'video' ? (
                    <div className="w-full h-full relative bg-[#152F40]">
                      <video
                        src={slide.url}
                        muted
                        preload="metadata"
                        className="w-full h-full object-cover opacity-80"
                      />
                      <span
                        className="absolute inset-0 grid place-items-center text-white"
                        aria-hidden="true"
                      >
                        <Play className="w-5 h-5 fill-white" />
                      </span>
                    </div>
                  ) : (
                    <GarmentVisual
                      product={product}
                      forceImage
                      angleIndex={slide.imageIndex ?? 0}
                    />
                  )}
                </button>
              ))}
            </div>
          )}

          {product.modelReplacement && (
            <p className="text-[11px] text-[#566773] mt-3">
              Imagem ilustrativa com modelo virtual.
            </p>
          )}
        </div>

        {/* Right: Contiguous Consultation Module */}
        <div className="min-w-0 md:sticky md:top-6">
          {isAdmin && (
            <div className="mb-5 border border-[#152F40] bg-[#F5F6F5] p-3.5 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] uppercase tracking-[0.08em] text-[#566773]">
                  Modo administrador
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={togglingFeatured}
                    onClick={async () => {
                      const nextFeatured = !homeFeaturedIds.has(product.id);
                      setTogglingFeatured(true);
                      setAdminNotice(null);
                      try {
                        await toggleFeaturedOnHome(product, nextFeatured);
                        setAdminNotice(
                          nextFeatured
                            ? 'Peça adicionada aos destaques da Home.'
                            : 'Peça removida dos destaques da Home.'
                        );
                      } catch (err) {
                        setAdminNotice(
                          err instanceof Error ? err.message : 'Erro ao atualizar destaque.'
                        );
                      } finally {
                        setTogglingFeatured(false);
                      }
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 border text-xs font-medium transition-colors ${
                      homeFeaturedIds.has(product.id)
                        ? 'bg-[#152F40] text-white border-[#152F40]'
                        : 'bg-white text-[#152F40] border-[#DCE2E5] hover:border-[#152F40]'
                    }`}
                  >
                    <Star
                      className={`w-3.5 h-3.5 ${
                        homeFeaturedIds.has(product.id) ? 'fill-white' : ''
                      }`}
                    />
                    <span>
                      {homeFeaturedIds.has(product.id)
                        ? 'Nos destaques da Home'
                        : 'Destacar na Home'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onNavigate(`/admin/?editar=${encodeURIComponent(product.id)}`)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#152F40] text-white text-xs font-medium hover:bg-[#2E5267] transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Editar produto</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onNavigate('/admin/')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#152F40] bg-white text-[#152F40] text-xs font-medium hover:bg-[#152F40] hover:text-white transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Voltar para o painel</span>
                  </button>
                </div>
              </div>
              {adminNotice && <p className="text-[11px] text-[#152F40]">{adminNotice}</p>}
            </div>
          )}

          {onSale && (
            <div className="bg-[#8B2635] text-white px-4 py-3 text-xs mb-5 tracking-[0.04em] flex items-center justify-between gap-2">
              <span className="font-semibold tracking-[0.14em] uppercase">SALE</span>
              <span>Peça em promoção · consulte condição especial no atendimento</span>
            </div>
          )}

          {product.blackFriday && (
            <div className="bg-[#152F40] text-white px-4 py-3 text-xs mb-5">
              Black Friday · Peças selecionadas com até 70% de desconto
            </div>
          )}

          <div className="text-[11px] text-[#566773] tracking-[0.08em] uppercase">
            <span>{product.brand || 'Seleção Artchê'}</span>
            <span aria-hidden="true" className="mx-2">
              ·
            </span>
            <span>{formatProductCategoryLabel(product, categories)}</span>
          </div>

          <h1 className="font-serif-display text-[36px] md:text-[44px] text-[#152F40] mt-3 mb-5 leading-[1.08]">
            {product.name}
          </h1>

          <p className="text-[13px] text-[#566773] mb-6 leading-relaxed">
            {product.blackFriday
              ? 'Esta peça faz parte da Black Friday Artchê. A campanha tem descontos de até 70% em peças selecionadas. Consulte a condição desta peça, tamanhos e disponibilidade com um consultor.'
              : 'Uma opção para compor sua mala de inverno. Converse com a Artchê para confirmar a disponibilidade e encontrar a combinação certa para você.'}
          </p>

          <label
            htmlFor="variant-select"
            className="block text-xs font-medium text-[#152F40] mb-2"
          >
            Qual opção você quer consultar?
          </label>
          <select
            id="variant-select"
            value={selectedVariant}
            onChange={(e) => setSelectedVariant(e.target.value)}
            className="w-full border border-[#DCE2E5] bg-white px-3.5 py-3 text-[13px] text-[#152F40] mb-5 focus:outline-none focus:border-[#152F40]"
          >
            <option value="">Quero orientação da equipe</option>
            {product.variants.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>

          <div className="space-y-3">
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full min-h-[48px] px-5 py-3.5 bg-[#152F40] text-white hover:bg-[#2E5267] text-xs font-medium flex items-center justify-center gap-3 transition-colors"
            >
              <span>Consultar no WhatsApp</span>
              <ArrowUpRight className="w-4 h-4" />
            </a>

            <button
              type="button"
              onClick={() => onToggleBag(product, selectedVariant)}
              className={`w-full min-h-[46px] px-5 py-3 border text-xs font-medium flex items-center justify-center gap-2.5 transition-colors ${
                inBag
                  ? 'border-[#152F40] bg-[#F5F6F5] text-[#152F40]'
                  : 'border-[#DCE2E5] bg-white text-[#152F40] hover:border-[#152F40]'
              }`}
            >
              {inBag ? <Check className="w-4 h-4" /> : <Briefcase className="w-4 h-4" />}
              <span>{inBag ? 'Adicionada à Minha Mala' : 'Adicionar à Minha Mala'}</span>
            </button>

            {productPhotoUrl && (
              <button
                type="button"
                onClick={() => void handleCopyPhotoForWhatsApp()}
                className="w-full py-2 text-[11px] text-[#566773] hover:text-[#152F40] inline-flex items-center justify-center gap-1.5 underline underline-offset-4 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar imagem da peça para colar no WhatsApp</span>
              </button>
            )}

            {copyStatus && (
              <p
                role="status"
                className="text-[11px] text-[#152F40] bg-[#D0E5F2]/40 border border-[#9CC1D9] px-3 py-2 text-center"
              >
                {copyStatus}
              </p>
            )}
          </div>

          <p className="text-[11px] text-[#566773] my-5 leading-relaxed">
            {product.blackFriday
              ? 'O desconto pode variar por peça. Confirme a oferta, os tamanhos e a disponibilidade no atendimento.'
              : 'As opções são referências do catálogo. Estoque, cores e tamanhos na Artchê devem ser confirmados no atendimento.'}
          </p>

          <div className="divide-y divide-[#DCE2E5] border-t border-b border-[#DCE2E5]">
            <details open className="py-4">
              <summary className="cursor-pointer text-[13px] font-medium text-[#152F40]">
                Como consultar esta peça
              </summary>
              <p className="mt-2.5 text-xs text-[#566773] leading-relaxed">
                Escolha uma opção, se desejar, e toque em “Consultar no WhatsApp”. A mensagem já
                vai com o nome, a referência, o link e a imagem da peça para agilizar seu atendimento.
              </p>
            </details>
            <details className="py-4">
              <summary className="cursor-pointer text-[13px] font-medium text-[#152F40]">
                Ajuda para escolher
              </summary>
              <p className="mt-2.5 text-xs text-[#566773] leading-relaxed">
                Conte para onde você vai viajar e como pretende usar a peça. Nossa equipe orienta
                a escolha de camadas e acessórios.
              </p>
            </details>
            <details className="py-4">
              <summary className="cursor-pointer text-[13px] font-medium text-[#152F40]">
                Visite a Artchê
              </summary>
              <p className="mt-2.5 text-xs text-[#566773] leading-relaxed">
                {STORE_ADDRESS} · {STORE_CITY}. Consulte nossa equipe pelo WhatsApp antes da
                visita para confirmar o horário de atendimento.
              </p>
            </details>
          </div>

          <p className="text-[11px] text-[#566773] mt-4 tabular-nums">
            Referência do catálogo: {product.id}
          </p>
        </div>
      </section>

      {/* Related Products */}
      {related.length > 0 && (
        <section className="max-w-[1320px] mx-auto px-5 md:px-10 pb-16">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-7">
            <h2 className="font-serif-display text-[32px] md:text-[40px] text-[#152F40]">
              Continue preparando a mala.
            </h2>
            <a
              href="/catalogo/"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('/catalogo/');
              }}
              className="text-xs border-b border-[#152F40] pb-1 whitespace-nowrap hover:text-[#476E84] transition-colors"
            >
              Ver todas ↗
            </a>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-7 md:gap-x-6">
            {related.map((item) => (
              <ProductCard
                key={item.id}
                product={item}
                inBag={bagIds.has(item.id)}
                onSelectProduct={onSelectProduct}
                onToggleBag={onToggleBag}
                onEditProduct={(id) => onNavigate(`/admin/?editar=${encodeURIComponent(id)}`)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
