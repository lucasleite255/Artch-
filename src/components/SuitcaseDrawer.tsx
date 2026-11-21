import React, { useState } from 'react';
import { X, Trash2, ArrowUpRight, Briefcase } from 'lucide-react';
import { BagItem } from '../types/catalog';
import { buildWhatsAppUrl, isProductOnSale, toAbsoluteSiteUrl } from '../data/catalog';
import { useCatalog } from '../context/CatalogContext';
import { GarmentVisual } from './GarmentVisual';

interface SuitcaseDrawerProps {
  open: boolean;
  items: BagItem[];
  onClose: () => void;
  onRemoveItem: (productId: string) => void;
  onClearBag: () => void;
  onSelectProduct: (productId: string) => void;
}

export const SuitcaseDrawer: React.FC<SuitcaseDrawerProps> = ({
  open,
  items,
  onClose,
  onRemoveItem,
  onClearBag,
  onSelectProduct,
}) => {
  const { categories } = useCatalog();
  const [destination, setDestination] = useState('');
  const [days, setDays] = useState('');

  if (!open) return null;

  const buildSuitcaseMessage = () => {
    const header =
      'Olá, Artchê! Montei uma seleção na Minha Mala pelo catálogo e gostaria de consultar valores, tamanhos, cores e disponibilidade:';
    const tripDetails =
      destination.trim() || days.trim()
        ? `\n\nDestino: ${destination.trim() || 'A definir'}${days.trim() ? ` · Duração: ${days.trim()} dias` : ''}`
        : '';
    const lines = items.map((item, idx) => {
      const productUrl = toAbsoluteSiteUrl(`/produto/${item.product.id}/`);
      const photoSrc = item.product.cover || item.product.images[0] || '';
      const photoUrl = photoSrc ? toAbsoluteSiteUrl(photoSrc) : '';
      const onSale = isProductOnSale(item.product, categories);
      return [
        `${idx + 1}. ${item.product.name}${onSale ? ' [SALE]' : ''} (ref. ${item.product.id})${
          item.variant ? ` — ${item.variant}` : ''
        }`,
        productUrl ? `   Link: ${productUrl}` : '',
        photoUrl ? `   Imagem: ${photoUrl}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    });
    return `${header}${tripDetails}\n\n${lines.join('\n\n')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Minha mala de inverno">
      <div
        className="fixed inset-0 bg-[#152F40]/50 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className="relative w-full max-w-[440px] bg-white h-full flex flex-col border-l border-[#DCE2E5] shadow-2xl">
        <div className="px-6 py-5 border-b border-[#DCE2E5] flex items-center justify-between">
          <div>
            <h2 className="font-serif-display text-[28px] text-[#152F40] leading-none">
              Minha mala
            </h2>
            <p className="text-xs text-[#566773] mt-1 tabular-nums">
              {items.length} {items.length === 1 ? 'peça selecionada' : 'peças selecionadas'} para consulta
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar Minha mala"
            className="w-10 h-10 grid place-items-center border border-[#DCE2E5] text-[#152F40] hover:bg-[#F5F6F5] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {items.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-14 h-14 mx-auto border border-[#DCE2E5] bg-[#F5F6F5] grid place-items-center text-[#152F40] mb-4">
                <Briefcase className="w-6 h-6" strokeWidth={1.5} />
              </div>
              <h3 className="font-serif-display text-[24px] text-[#152F40]">
                Sua mala ainda está vazia
              </h3>
              <p className="text-[13px] text-[#566773] mt-2 max-w-[280px] mx-auto">
                Adicione casacos, malhas térmicas e acessórios enquanto navega para consultar tudo de uma só vez pelo WhatsApp.
              </p>
            </div>
          ) : (
            <>
              <div className="bg-[#F5F6F5] p-4 border border-[#DCE2E5] space-y-3">
                <p className="text-xs font-medium text-[#152F40]">
                  Informe seu destino (opcional)
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="Ex.: Bariloche, Europa…"
                    aria-label="Destino da viagem"
                    className="col-span-2 bg-white border border-[#DCE2E5] px-3 py-2.5 text-xs text-[#152F40] placeholder:text-[#566773] focus:outline-none focus:border-[#152F40]"
                  />
                  <input
                    type="text"
                    value={days}
                    onChange={(e) => setDays(e.target.value)}
                    placeholder="Dias (ex.: 7)"
                    aria-label="Quantidade de dias"
                    className="bg-white border border-[#DCE2E5] px-3 py-2.5 text-xs text-[#152F40] placeholder:text-[#566773] tabular-nums focus:outline-none focus:border-[#152F40]"
                  />
                </div>
              </div>

              <ul className="divide-y divide-[#DCE2E5]">
                {items.map((item) => (
                  <li key={item.product.id} className="py-4 flex gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onSelectProduct(item.product.id);
                      }}
                      className="w-20 aspect-[4/5] shrink-0 bg-[#F5F6F5] border border-[#DCE2E5] overflow-hidden"
                      aria-label={`Ver ${item.product.name}`}
                    >
                      <GarmentVisual product={item.product} />
                    </button>
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#566773]">
                          {isProductOnSale(item.product, categories) && (
                            <span className="inline-block bg-[#8B2635] text-white px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.14em] uppercase leading-none">
                              SALE
                            </span>
                          )}
                          <span>
                            {item.product.brand || 'Seleção Artchê'} · ref. {item.product.id}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onSelectProduct(item.product.id);
                          }}
                          className="text-left text-[14px] font-medium text-[#152F40] hover:text-[#476E84] leading-snug mt-0.5"
                        >
                          {item.product.name}
                        </button>
                        {item.variant && (
                          <div className="text-[11px] text-[#566773] mt-1">{item.variant}</div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemoveItem(item.product.id)}
                        className="self-start inline-flex items-center gap-1 text-[11px] text-[#566773] hover:text-[#152F40] mt-2"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remover</span>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="p-6 border-t border-[#DCE2E5] bg-[#F5F6F5] space-y-3">
          {items.length > 0 ? (
            <>
              <a
                href={buildWhatsAppUrl(buildSuitcaseMessage())}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full min-h-[48px] px-5 py-3.5 bg-[#152F40] text-white hover:bg-[#2E5267] text-xs font-medium flex items-center justify-between transition-colors"
              >
                <span>Enviar minha mala no WhatsApp</span>
                <ArrowUpRight className="w-4 h-4" />
              </a>
              <button
                type="button"
                onClick={onClearBag}
                className="w-full py-2 text-[11px] text-[#566773] hover:text-[#152F40] underline underline-offset-4"
              >
                Limpar seleção
              </button>
            </>
          ) : (
            <a
              href={buildWhatsAppUrl(
                'Olá, Artchê! Quero ajuda de um consultor para montar minha mala de inverno.'
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full min-h-[48px] px-5 py-3.5 bg-[#152F40] text-white hover:bg-[#2E5267] text-xs font-medium flex items-center justify-between transition-colors"
            >
              <span>Falar direto com um consultor</span>
              <ArrowUpRight className="w-4 h-4" />
            </a>
          )}
          <p className="text-[10px] text-[#566773] leading-relaxed">
            Cores, tamanhos, valores e disponibilidade são confirmados pela equipe Artchê no atendimento.
          </p>
        </div>
      </aside>
    </div>
  );
};
