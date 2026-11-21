import React, { useState, useEffect, useRef } from 'react';
import { Play } from 'lucide-react';
import { Product } from '../types/catalog';

interface GarmentVisualProps {
  product: Product;
  angleIndex?: number;
  forceImage?: boolean;
  showVideoControls?: boolean;
  className?: string;
}

export const GarmentVisual: React.FC<GarmentVisualProps> = ({
  product,
  angleIndex = 0,
  forceImage = false,
  showVideoControls = false,
  className = '',
}) => {
  const src =
    angleIndex === 0 && product.cover
      ? product.cover
      : product.images[angleIndex] || product.cover || product.images[0] || '';

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  useEffect(() => {
    setVideoFailed(false);
    setIsPlaying(false);
  }, [product.videoUrl, product.coverType]);

  const trimmedVideoUrl = product.videoUrl?.trim() || '';
  const shouldRenderVideoCover =
    !forceImage &&
    angleIndex === 0 &&
    product.coverType === 'video' &&
    Boolean(trimmedVideoUrl) &&
    !videoFailed;

  useEffect(() => {
    if (!shouldRenderVideoCover) return;
    const el = videoRef.current;
    if (!el) return;

    el.defaultMuted = true;
    el.muted = true;
    el.playsInline = true;
    el.setAttribute('muted', '');
    el.setAttribute('playsinline', '');
    el.setAttribute('webkit-playsinline', '');

    const attemptPlay = () => {
      if (!el.paused) {
        setIsPlaying(true);
        return;
      }
      el.muted = true;
      const promise = el.play();
      if (promise && typeof promise.catch === 'function') {
        promise.catch(() => {
          // Browser policy / low-power mode prevented immediate autoplay
        });
      }
    };

    attemptPlay();
    const timer = window.setTimeout(attemptPlay, 200);

    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            attemptPlay();
          }
        },
        { threshold: 0.15 }
      );
      observer.observe(el);
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        attemptPlay();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearTimeout(timer);
      observer?.disconnect();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [shouldRenderVideoCover, trimmedVideoUrl]);

  if (shouldRenderVideoCover && trimmedVideoUrl) {
    const tryManualPlay = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const el = videoRef.current;
      if (!el) return;
      el.muted = true;
      void el.play().catch(() => {});
    };

    return (
      <div className="relative w-full h-full bg-[#0E2636]">
        <video
          ref={videoRef}
          key={trimmedVideoUrl}
          src={trimmedVideoUrl}
          poster={src || undefined}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          controls={showVideoControls}
          aria-label={product.name}
          onLoadedMetadata={() => {
            const el = videoRef.current;
            if (el) {
              el.muted = true;
              void el.play().catch(() => {});
            }
          }}
          onCanPlay={() => {
            const el = videoRef.current;
            if (el && el.paused) {
              el.muted = true;
              void el.play().catch(() => {});
            }
          }}
          onPlaying={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onError={() => setVideoFailed(true)}
          className={`w-full h-full object-cover ${className}`}
        />
        {!showVideoControls && !isPlaying && (
          <span
            role="button"
            tabIndex={0}
            onClick={tryManualPlay}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                const el = videoRef.current;
                if (el) {
                  el.muted = true;
                  void el.play().catch(() => {});
                }
              }
            }}
            aria-label={`Reproduzir vídeo de ${product.name}`}
            className="absolute bottom-2.5 right-2.5 w-8 h-8 bg-[#152F40]/85 text-white grid place-items-center border border-white/30 hover:bg-[#152F40] transition-colors cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
          </span>
        )}
      </div>
    );
  }

  const isEditorialPhoto = Boolean(product.blackFriday || src.includes('/black-friday/'));
  const isCustomOrUploaded = src.startsWith('https://') || src.startsWith('/uploads/');

  if (!failed && src) {
    return (
      <img
        src={src}
        alt={product.name}
        width={480}
        height={600}
        loading={angleIndex === 0 ? 'lazy' : undefined}
        onError={() => setFailed(true)}
        className={`w-full h-full object-cover ${
          isEditorialPhoto || isCustomOrUploaded ? 'object-[center_18%]' : 'object-center'
        } ${className}`}
      />
    );
  }

  return (
    <div
      className={`w-full h-full flex flex-col items-center justify-center p-4 text-center bg-[#F5F6F5] text-[#566773] ${className}`}
      role="img"
      aria-label={product.name}
    >
      <span className="text-[11px] uppercase tracking-wider">{product.brand || 'Artchê'}</span>
      <span className="text-xs text-[#152F40] mt-1 font-medium">{product.name}</span>
    </div>
  );
};
