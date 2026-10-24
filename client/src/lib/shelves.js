/** The three ranked shelves. The slug is both the URL path and the API name. */
export const SHELVES = [
  { slug: 'trending', title: 'Trending now', short: 'Trending' },
  { slug: 'best-sellers', title: 'Best sellers', short: 'Best sellers' },
  { slug: 'new-releases', title: 'New releases', short: 'New releases' },
];
export const shelfBySlug = (slug) => SHELVES.find((s) => s.slug === slug) ?? null;

/**
 * The three photos in the home page banner. They are still real best sellers, but chosen from categories whose product
 * photos look good at a glance (colourful, clear subject), one per category, instead of whatever happens to rank first
 * (bedding, gift cards and cleaning products). Falls back to the plain ranking if those categories are missing.
 */
const PHOTOGENIC = ['Beauty & Personal Care', 'Toys & Games', 'Electronics', 'Clothing, Shoes & Jewelry', 'Pet Supplies', 'Home & Kitchen'];
export function pickFeatured(items, count = 3) {
  const picked = [];
  for (const label of PHOTOGENIC) {
    const hit = items.find((p) => p.category?.label === label && p.images?.length);
    if (hit) picked.push(hit);
    if (picked.length === count) return picked;
  }
  for (const p of items) if (!picked.includes(p)) { picked.push(p); if (picked.length === count) break; }
  return picked;
}
