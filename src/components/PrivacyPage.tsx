import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { WHATSAPP_DISPLAY, buildWhatsAppUrl } from '../data/catalog';

export const PrivacyPage: React.FC = () => {
  return (
    <article className="max-w-[780px] mx-auto px-5 md:px-10 py-12 md:py-16">
      <h1 className="font-serif-display text-[38px] md:text-[46px] text-[#152F40]">
        Privacidade
      </h1>
      <p className="text-[14px] text-[#566773] mt-4 leading-relaxed">
        Este site apresenta um catálogo de roupas e acessórios e permite iniciar atendimento com a
        Artchê.
      </p>

      <h2 className="font-serif-display text-[28px] text-[#152F40] mt-8 mb-3">
        Seus dados
      </h2>
      <p className="text-[14px] text-[#566773] leading-relaxed">
        O site não solicita cadastro e não possui formulário de pagamento. Buscas e filtros fazem
        parte do endereço da página. As peças adicionadas em “Minha mala” ficam salvas apenas no
        navegador do seu dispositivo para facilitar sua consulta. Não instalamos ferramentas de
        publicidade ou análise neste catálogo.
      </p>

      <h2 className="font-serif-display text-[28px] text-[#152F40] mt-8 mb-3">
        Atendimento pelo WhatsApp
      </h2>
      <p className="text-[14px] text-[#566773] leading-relaxed">
        Ao tocar em um botão de consulta, você será direcionado ao WhatsApp. A mensagem sugerida
        inclui apenas a peça e a opção escolhida. Você revisa a mensagem antes de enviar. O
        tratamento de dados no WhatsApp segue as políticas do serviço.
      </p>

      <h2 className="font-serif-display text-[28px] text-[#152F40] mt-8 mb-3">
        Serviços externos
      </h2>
      <p className="text-[14px] text-[#566773] leading-relaxed">
        Links de mapas e Instagram abrem serviços externos. A hospedagem pode registrar dados
        técnicos de acesso para manter o funcionamento do site.
      </p>

      <h2 className="font-serif-display text-[28px] text-[#152F40] mt-8 mb-3">
        Fale com a Artchê
      </h2>
      <p className="text-[14px] text-[#566773] mb-6 leading-relaxed">
        Para dúvidas ou solicitações relacionadas ao atendimento, entre em contato pelo WhatsApp{' '}
        {WHATSAPP_DISPLAY}.
      </p>

      <a
        href={buildWhatsAppUrl('Olá, Artchê! Gostaria de informações sobre privacidade e meus dados.')}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-3 px-6 py-3.5 min-h-[48px] bg-[#152F40] text-white hover:bg-[#2E5267] text-xs font-medium transition-colors"
      >
        <span>Falar com a Artchê</span>
        <ArrowUpRight className="w-4 h-4" />
      </a>
    </article>
  );
};
