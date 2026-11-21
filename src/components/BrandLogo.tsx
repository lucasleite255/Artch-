import React, { useState } from 'react';

interface BrandLogoProps {
  brand: 'columbia' | 'solo' | 'thenorthface' | 'ambicione';
}

const BRAND_CONFIG: Record<
  BrandLogoProps['brand'],
  { src: string; alt: string; width: number; height: number; className: string }
> = {
  columbia: {
    src: '/assets/brands/marca-1.png',
    alt: 'Columbia',
    width: 1138,
    height: 224,
    className: 'w-[180px] h-[78px] max-w-[78%] object-contain',
  },
  solo: {
    src: '/assets/brands/solo.png',
    alt: 'Solo',
    width: 156,
    height: 64,
    className: 'w-[180px] h-[78px] max-w-[78%] object-contain',
  },
  thenorthface: {
    src: '/assets/brands/the-north-face.png',
    alt: 'The North Face',
    width: 820,
    height: 357,
    className: 'w-[180px] h-[78px] max-w-[78%] object-contain',
  },
  ambicione: {
    src: '/assets/brands/ambicione.png',
    alt: 'Ambicione',
    width: 298,
    height: 166,
    className: 'w-[205px] h-[114px] max-w-[82%] object-contain',
  },
};

export const BrandLogo: React.FC<BrandLogoProps> = ({ brand }) => {
  const [failed, setFailed] = useState(false);
  const cfg = BRAND_CONFIG[brand];

  if (!failed) {
    return (
      <img
        src={cfg.src}
        alt={cfg.alt}
        width={cfg.width}
        height={cfg.height}
        loading="lazy"
        onError={() => setFailed(true)}
        className={cfg.className}
      />
    );
  }

  return (
    <span className="font-sans-body text-sm font-medium tracking-[0.14em] uppercase text-[#152F40]">
      {cfg.alt}
    </span>
  );
};
