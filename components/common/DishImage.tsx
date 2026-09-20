'use client';

import React, { useState, useEffect } from 'react';
import { UtensilsCrossed } from 'lucide-react';
import { resolveDishImageUrl } from '@/utils/imageUrl';

interface DishImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  isVeg?: boolean;
  showDietBadge?: boolean;
  fallbackIconSize?: number;
}

export function DishImage({
  src,
  alt,
  className = 'w-full h-full',
  isVeg,
  showDietBadge = false,
  fallbackIconSize = 20,
}: DishImageProps) {
  const [hasError, setHasError] = useState(false);
  const resolvedUrl = resolveDishImageUrl(src);

  // Reset error state if the src prop changes
  useEffect(() => {
    setHasError(false);
  }, [src]);

  return (
    <div className={`relative overflow-hidden flex items-center justify-center ${className}`}>
      {resolvedUrl && !hasError ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolvedUrl}
          alt={alt}
          loading="lazy"
          crossOrigin="anonymous"
          onError={() => setHasError(true)}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-amber-500/10 dark:bg-amber-500/5 text-[#DE8626] select-none p-2">
          <UtensilsCrossed size={fallbackIconSize} className="opacity-80" />
        </div>
      )}

      {showDietBadge && isVeg !== undefined && (
        <div
          className={`absolute top-1.5 left-1.5 flex h-4 w-4 items-center justify-center rounded-md border bg-white/95 dark:bg-[#1B2127]/95 shadow-sm backdrop-blur-xs ${
            isVeg ? 'border-emerald-600' : 'border-red-600'
          }`}
          title={isVeg ? 'Vegetarian' : 'Non-Vegetarian'}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              isVeg ? 'bg-emerald-600' : 'bg-red-600'
            }`}
          />
        </div>
      )}
    </div>
  );
}