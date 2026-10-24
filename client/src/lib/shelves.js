/** The three ranked shelves. The slug is both the URL path and the API name. */
export const SHELVES = [
  { slug: 'trending', title: 'Trending now', short: 'Trending' },
  { slug: 'best-sellers', title: 'Best sellers', short: 'Best sellers' },
  { slug: 'new-releases', title: 'New releases', short: 'New releases' },
];
export const shelfBySlug = (slug) => SHELVES.find((s) => s.slug === slug) ?? null;
