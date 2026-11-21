import React, { useState } from 'react';

interface ArtcheLogoProps {
  variant?: 'dark' | 'light';
  className?: string;
}

export const ArtcheLogo: React.FC<ArtcheLogoProps> = ({ variant = 'dark', className = '' }) => {
  const [imgError, setImgError] = useState(false);

  if (!imgError) {
    return (
      <img
        src="/assets/artche-logo.png"
        alt="Artchê"
        width={300}
        height={276}
        onError={() => setImgError(true)}
        className={`block object-contain shrink-0 select-none ${
          variant === 'light'
            ? 'w-[115px] h-[105px] brightness-0 invert'
            : 'w-[86px] h-[76px] md:w-[108px] md:h-[96px]'
        } ${className}`}
      />
    );
  }

  const color = variant === 'light' ? '#FFFFFF' : '#152F40';
  return (
    <span
      className={`font-serif-display tracking-[0.22em] text-[24px] font-medium uppercase whitespace-nowrap shrink-0 ${className}`}
      style={{ color }}
    >
      ARTCHÊ
    </span>
  );
};
