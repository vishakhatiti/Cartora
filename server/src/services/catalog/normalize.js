import { dollarsToCents, effectivePriceCents } from '../../utils/money.js';

const PLACEHOLDER_HOST = 'placeholder.com';

/** "Arts_Crafts_and_Sewing" -> { slug: "arts-crafts-and-sewing", label: "Arts Crafts & Sewing" } */
export function toCategory(raw) {
  const name = String(raw ?? 'Other').trim() || 'Other';
  return {
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    label: name.replace(/_/g, ' ').replace(/\s+and\s+/gi, ' & '),
  };
}

/** True when an image URL is the shared dataset placeholder rather than a real picture. */
export function isPlaceholderImage(url) {
  if (typeof url !== 'string' || !url.trim()) return true;
  try {
    return new URL(url).hostname.endsWith(PLACEHOLDER_HOST);
  } catch {
    return true;
  }
}

function toSafePrice(value) {
  try {
    return dollarsToCents(value);
  } catch {
    return null;
  }
}

/** Reviewer names are derived from the user id so the raw id is not shown. */
export function reviewerName(userId) {
  const digits = String(userId ?? '').replace(/\D/g, '');
  return digits.length >= 4 ? `Customer ${digits.slice(-4)}` : 'Customer';
}

function normalizeReview(raw, index) {
  const rating = Math.round(Number(raw?.rating));
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) return null;
  const seconds = Number(raw.timestamp);
  return {
    id: index,
    reviewer: reviewerName(raw.user_id),
    rating,
    title: String(raw.title ?? '').trim(),
    text: String(raw.text ?? '').trim(),
    createdAt: Number.isFinite(seconds) ? new Date(seconds * 1000).toISOString() : null,
  };
}

/**
 * Turn one raw dataset record into the shape the API uses.
 * Returns null for records that cannot be sold (no id, title, or valid price).
 */
export function normalizeProduct(raw) {
  const id = String(raw?.parent_asin ?? '').trim();
  const title = String(raw?.title ?? '').trim();
  const priceCents = toSafePrice(raw?.price);
  if (!id || !title || priceCents === null || priceCents === 0) return null;

  const category = toCategory(raw.main_category);

  let deal = null;
  if (raw.deal?.has_deal) {
    const salePriceCents = toSafePrice(raw.deal.sale_price);
    const percent = Number(raw.deal.discount_percentage);
    if (salePriceCents !== null && Number.isFinite(percent)) {
      deal = { percent, salePriceCents };
    }
  }
  const finalPriceCents = effectivePriceCents({ priceCents, deal });
  // A deal that is not actually cheaper is not a deal.
  const activeDeal = deal && finalPriceCents < priceCents ? deal : null;

  const images = (Array.isArray(raw.images) ? raw.images : [])
    .filter((img) => !isPlaceholderImage(img?.large))
    .map((img) => ({ thumb: img.thumb || img.large, large: img.large }));

  const reviews = (Array.isArray(raw.reviews) ? raw.reviews : []).map(normalizeReview).filter(Boolean);

  return {
    id,
    title,
    brand: String(raw.brand ?? '').trim(),
    category,
    priceCents,
    deal: activeDeal,
    finalPriceCents,
    ratingAvg: Number.isFinite(Number(raw.average_rating)) ? Number(raw.average_rating) : 0,
    ratingCount: Number.isFinite(Number(raw.rating_number)) ? Number(raw.rating_number) : 0,
    features: (Array.isArray(raw.features) ? raw.features : []).map(String),
    images,
    // When true the UI draws generated artwork instead of a photo.
    hasRealImage: images.length > 0,
    reviews,
  };
}

/** Listing shape: no embedded reviews, features, or internal search-index fields. */
export function toSummary(product) {
  // eslint-disable-next-line no-unused-vars
  const { reviews, features, titleLower, titleWords, haystack, ...summary } = product;
  return { ...summary, reviewCount: reviews.length };
}
