import React from 'react';
import { Briefcase } from 'lucide-react';
import { ArtcheLogo } from './ArtcheLogo';
import { WhatsAppIcon } from './WhatsAppIcon';
import {
  CNPJ,
  INSTAGRAM_URL,
  MAPS_URL,
  WHATSAPP_DISPLAY,
  buildWhatsAppUrl,
} from '../data/catalog';

interface FooterProps {
  bagCount: number;
  onNavigate: (path: string) => void;
  onOpenBag: () => void;
}

export const Footer: React.FC<FooterProps> = ({ bagCount, onNavigate, onOpenBag }) => {
  const year = new Date().getFullYear();

  const handleLink = (e: React.MouseEvent, path: string) => {
    e.preventDefault();
    onNavigate(path);
  };

  return (
    <>
      <footer className="bg-[#152F40] text-white pt-14 pb-6">
        <div className="max-w-[1320px] mx-auto px-5 md:px-10 grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-11">
          <div>
            <a
              href="/"
              onClick={(e) => handleLink(e, '/')}
              aria-label="Artchê — início"
              className="inline-block"
            >
              <ArtcheLogo variant="light" />
            </a>
            <p className="text-xs text-[#CAD6DD] mt-4 mb-4 leading-relaxed">
              O cuidado de quem entende de frio.
              <br />
              O estilo de quem ama viajar.
            </p>
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-white hover:text-[#9CC1D9] transition-colors"
            >
              Instagram ↗
            </a>
          </div>

          <div>
            <h2 className="font-sans-body text-xs font-medium text-white mb-5">
              Explore as coleções
            </h2>
            <ul className="space-y-2.5 text-xs text-[#DCE8EF]">
              <li>
                <a
                  href="/catalogo/"
                  onClick={(e) => handleLink(e, '/catalogo/')}
                  className="hover:text-[#9CC1D9] transition-colors"
                >
                  Todo o catálogo
                </a>
              </li>
              <li>
                <a
                  href="/categoria/feminino/"
                  onClick={(e) => handleLink(e, '/categoria/feminino/')}
                  className="hover:text-[#9CC1D9] transition-colors"
                >
                  Feminino
                </a>
              </li>
              <li>
                <a
                  href="/categoria/masculino/"
                  onClick={(e) => handleLink(e, '/categoria/masculino/')}
                  className="hover:text-[#9CC1D9] transition-colors"
                >
                  Masculino
                </a>
              </li>
              <li>
                <a
                  href="/categoria/infantil/"
                  onClick={(e) => handleLink(e, '/categoria/infantil/')}
                  className="hover:text-[#9CC1D9] transition-colors"
                >
                  Infantil
                </a>
              </li>
              <li>
                <a
                  href="/categoria/termicos/"
                  onClick={(e) => handleLink(e, '/categoria/termicos/')}
                  className="hover:text-[#9CC1D9] transition-colors"
                >
                  Roupas térmicas
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="font-sans-body text-xs font-medium text-white mb-5">
              Estamos por perto
            </h2>
            <a
              href={buildWhatsAppUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-xs text-white hover:text-[#9CC1D9] transition-colors"
            >
              WhatsApp: {WHATSAPP_DISPLAY}
            </a>
            <p className="text-xs text-[#CAD6DD] my-4 leading-relaxed">
              CLS 209, Bloco A, loja 27
              <br />
              Asa Sul · Brasília, DF
            </p>
            <a
              href={MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-white hover:text-[#9CC1D9] transition-colors"
            >
              Como chegar ↗
            </a>
          </div>

          <div>
            <h2 className="font-sans-body text-xs font-medium text-white mb-5">
              Conte com a Artchê
            </h2>
            <p className="text-xs text-[#CAD6DD] mb-4 leading-relaxed">
              Precisa de ajuda para escolher?
              <br />
              Conte seu destino para nossa equipe.
            </p>
            <a
              href={buildWhatsAppUrl(
                'Olá, Artchê! Gostaria de ajuda para planejar minha mala de inverno.'
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-xs text-white border-b border-[#8BA6B7] pb-1 hover:text-[#9CC1D9] transition-colors"
            >
              Planejar minha mala ↗
            </a>
            <p className="text-[10px] text-[#CAD6DD]/90 mt-4 leading-relaxed max-w-[230px]">
              Cores, tamanhos, valores e disponibilidade são confirmados no atendimento.
            </p>
          </div>
        </div>

        <div className="max-w-[1320px] mx-auto px-5 md:px-10 border-t border-white/15 pt-5 mt-9 pb-14 md:pb-0 flex flex-wrap items-center justify-between gap-4 text-[11px] text-[#BDCDD7]">
          <span>© {year} Artchê. Todos os direitos reservados.</span>
          <span className="tabular-nums text-[#DCE8EF]">CNPJ: {CNPJ}</span>
          <div className="flex items-center gap-5">
            <a
              href="/privacidade/"
              onClick={(e) => handleLink(e, '/privacidade/')}
              className="hover:text-[#9CC1D9] transition-colors"
            >
              Privacidade
            </a>
          </div>
        </div>
      </footer>

      {/* Floating WhatsApp / Minha Mala Action */}
      {bagCount > 0 ? (
        <button
          type="button"
          onClick={onOpenBag}
          aria-label={`Abrir Minha Mala (${bagCount} peças)`}
          className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-30 bg-[#152F40] text-white border border-white/30 px-4 py-3 flex items-center gap-2.5 text-xs font-medium shadow-lg hover:bg-[#2E5267] transition-colors"
        >
          <Briefcase className="w-4 h-4" strokeWidth={1.6} />
          <span>
            Minha mala (<span className="tabular-nums">{bagCount}</span>)
          </span>
        </button>
      ) : (
        <a
          href={buildWhatsAppUrl()}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Monte a sua mala pelo WhatsApp"
          className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-30 bg-[#152F40] text-white border border-white/30 px-4 py-3 flex items-center gap-2.5 text-xs font-medium shadow-lg hover:bg-[#2E5267] transition-colors"
        >
          <WhatsAppIcon className="w-[18px] h-[18px] shrink-0" />
          <span>Monte a sua mala</span>
        </a>
      )}
    </>
  );
};
