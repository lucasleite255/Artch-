import React, { useEffect, useRef, useState } from 'react';
import { HeroSlide } from '../types/catalog';

export type CampaignSlideVariant = 'black-friday' | 'casal' | 'moda' | 'mala' | 'loja';

const SLIDE_ASSETS: Record<
  CampaignSlideVariant,
  { src: string; alt: string; isStore?: boolean; positionClass?: string }
> = {
  'black-friday': {
    src: '/assets/black-friday/banner-black-friday.png',
    alt: 'Arte da campanha Black Friday Artchê, inspirada nas peças enviadas',
    positionClass: 'object-cover object-center',
  },
  casal: {
    src: '/assets/campaign/inverno-casal.png',
    alt: 'Campanha ilustrativa: casal com casaco de lã, jaqueta e botas em um destino de inverno',
    positionClass: 'object-cover object-[76%_22%] md:object-center',
  },
  moda: {
    src: '/assets/campaign/moda-inverno.png',
    alt: 'Campanha ilustrativa: look com casaco claro, cachecol e mala para viagem de inverno',
    positionClass: 'object-cover object-[82%_18%] md:object-[center_30%]',
  },
  mala: {
    src: '/assets/campaign/mala-inverno.png',
    alt: 'Campanha ilustrativa: mala com peças térmicas, tricô, jaqueta, luvas e botas de inverno',
    positionClass: 'object-cover object-[74%_40%] md:object-[center_32%]',
  },
  loja: {
    src: '/assets/campaign/loja-restaurada.png',
    alt: 'Fachada da loja Artchê na Asa Sul — fotografia restaurada',
    isStore: true,
  },
};

const ASSET_BY_URL = new Map(Object.values(SLIDE_ASSETS).map((item) => [item.src, item]));

export const CampaignHeroBackdrop: React.FC<{ variant: CampaignSlideVariant }> = ({ variant }) => {
  const asset = SLIDE_ASSETS[variant];
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <div className="absolute inset-0 bg-[#152F40]" aria-hidden="true" />;
  }

  if (asset.isStore) {
    return (
      <div className="absolute inset-0 bg-[#152F40] overflow-hidden" aria-hidden="true">
        <img
          src={asset.src}
          alt={asset.alt}
          width={939}
          height={1675}
          onError={() => setFailed(true)}
          className="absolute inset-0 md:inset-auto md:right-[max(40px,calc((100vw-1240px)/2))] md:top-6 w-full md:w-[40%] h-full md:h-[calc(100%-48px)] object-cover md:object-contain object-[center_40%]"
        />
      </div>
    );
  }

  return (
    <img
      src={asset.src}
      alt={asset.alt}
      width={2172}
      height={724}
      onError={() => setFailed(true)}
      className={`absolute inset-0 w-full h-full ${asset.positionClass || 'object-cover'}`}
    />
  );
};

export const HeroSlideMedia: React.FC<{
  slide: Pick<HeroSlide, 'title' | 'mediaType' | 'imageUrl' | 'videoUrl'>;
  isActive?: boolean;
}> = ({ slide, isActive = true }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failedImage, setFailedImage] = useState(false);
  const [failedVideo, setFailedVideo] = useState(false);

  useEffect(() => {
    setFailedImage(false);
  }, [slide.imageUrl]);

  useEffect(() => {
    setFailedVideo(false);
  }, [slide.videoUrl]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || slide.mediaType !== 'video' || !slide.videoUrl) return;
    el.defaultMuted = true;
    el.muted = true;
    el.playsInline = true;
    if (isActive) {
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, [isActive, slide.mediaType, slide.videoUrl]);

  if (slide.mediaType === 'video' && slide.videoUrl && !failedVideo) {
    return (
      <video
        ref={videoRef}
        src={slide.videoUrl}
        poster={slide.imageUrl || undefined}
        muted
        loop
        playsInline
        autoPlay
        preload="auto"
        onCanPlay={() => {
          if (isActive) {
            videoRef.current?.play().catch(() => {});
          }
        }}
        onError={() => setFailedVideo(true)}
        className="absolute inset-0 w-full h-full object-cover object-center"
      />
    );
  }

  if (failedImage || !slide.imageUrl) {
    return <div className="absolute inset-0 bg-[#152F40]" aria-hidden="true" />;
  }

  const preset = ASSET_BY_URL.get(slide.imageUrl);
  if (preset?.isStore) {
    return (
      <div className="absolute inset-0 bg-[#152F40] overflow-hidden" aria-hidden="true">
        <img
          src={slide.imageUrl}
          alt={slide.title || preset.alt}
          width={939}
          height={1675}
          onError={() => setFailedImage(true)}
          className="absolute inset-0 md:inset-auto md:right-[max(40px,calc((100vw-1240px)/2))] md:top-6 w-full md:w-[40%] h-full md:h-[calc(100%-48px)] object-cover md:object-contain object-[center_40%]"
        />
      </div>
    );
  }

  return (
    <img
      src={slide.imageUrl}
      alt={slide.title || preset?.alt || 'Banner Artchê'}
      width={2172}
      height={724}
      onError={() => setFailedImage(true)}
      className={`absolute inset-0 w-full h-full ${preset?.positionClass || 'object-cover object-center'}`}
    />
  );
};

export const StorefrontGraphic: React.FC<{ className?: string }> = ({ className = '' }) => (
  <img
    src="/assets/campaign/loja-restaurada.png"
    alt="Fachada da loja Artchê, na Asa Sul em Brasília — fotografia restaurada"
    width={480}
    height={600}
    loading="lazy"
    className={`w-full aspect-[4/5] object-cover object-[center_35%] block ${className}`}
  />
);

export const EditorialLayersGraphic: React.FC<{ className?: string }> = ({ className = '' }) => (
  <img
    src="/assets/campaign/mala-inverno.png"
    alt="Mala de inverno com roupas e acessórios — imagem ilustrativa"
    width={900}
    height={800}
    loading="lazy"
    className={`w-full h-full max-h-[440px] object-cover object-right ${className}`}
  />
);

const COLLECTION_IMAGES: Record<'feminino' | 'masculino' | 'infantil', { src: string; alt: string; w: number; h: number }> = {
  feminino: {
    src: '/assets/categories/feminino-artche.png',
    alt: 'Look feminino com casaco xadrez na loja Artchê',
    w: 400,
    h: 500,
  },
  masculino: {
    src: '/assets/categories/masculino-artche.png',
    alt: 'Look masculino com sobretudo marrom na loja Artchê',
    w: 400,
    h: 500,
  },
  infantil: {
    src: '/assets/categories/infantil-artche.png',
    alt: 'Look infantil com jaqueta Columbia rosa',
    w: 480,
    h: 600,
  },
};

export const CollectionCardBackdrop: React.FC<{
  slug: 'feminino' | 'masculino' | 'infantil';
}> = ({ slug }) => {
  const item = COLLECTION_IMAGES[slug];
  return (
    <img
      src={item.src}
      alt={item.alt}
      width={item.w}
      height={item.h}
      loading="lazy"
      className="w-full h-full object-cover object-top transition-transform duration-500 ease-out group-hover:scale-[1.035]"
    />
  );
};
