import { useEffect, useState } from 'react';

function hash(text) {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

/** Generated artwork shown when a product has no photo or its photo fails to load. */
export function Artwork({ product, className = '' }) {
  const seed = hash(product.category?.slug ?? product.id);
  const hue = seed % 360;
  const letter = (product.brand || product.title || '?').trim().charAt(0).toUpperCase();
  return (
    <div
      role="img"
      aria-label={`${product.title} (no photo available)`}
      className={`grid place-items-center ${className}`}
      style={{ background: `linear-gradient(135deg, hsl(${hue} 45% 78%), hsl(${(hue + 40) % 360} 45% 62%))` }}
    >
      <span className="font-display text-5xl font-extrabold text-white/90" aria-hidden="true" style={{ textShadow: '0 2px 8px rgb(0 0 0 / 0.25)' }}>
        {letter}
      </span>
    </div>
  );
}

/**
 * Product photo. Amazon-hosted URLs can fail or be blocked, so any load error switches to artwork.
 * `index` picks which photo from the product to show; `size` picks the thumbnail or the large file.
 */
export default function ProductImage({ product, index = 0, size = 'large', className = '', alt, eager = false }) {
  const image = product.images?.[index];
  const src = image ? (size === 'thumb' ? image.thumb || image.large : image.large) : null;
  const [failedSrc, setFailedSrc] = useState(null);
  useEffect(() => setFailedSrc(null), [src]);

  if (!src || failedSrc === src) return <Artwork product={product} className={className} />;
  return (
    <img
      src={src}
      alt={alt ?? product.title}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailedSrc(src)}
      className={`bg-white object-contain ${className}`}
    />
  );
}
