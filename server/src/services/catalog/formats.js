/**
 * Converts the committed catalogue.json.gz layout into the record shape normalizeProduct() reads.
 *
 * Layout: { source, categories: [{slug, name}], products: [...], reviews: [{asin, ...}] }
 *
 * The file also carries `stock`, `isBestSeller`, `importedRank` and `listPriceCents`. They are
 * deliberately NOT carried over: stock is spread evenly from 3 to 60, exactly 20 products per category
 * are "best sellers", and every list price is 1-29% above the price. That pattern means they were
 * generated when the file was built, so showing them would present invented facts as real.
 */
export function isCatalogueV2(parsed) {
  return parsed && !Array.isArray(parsed) && Array.isArray(parsed.products);
}

/**
 * Yields one record at a time. With `release: true` each source product is dropped from `parsed` as soon as
 * it has been yielded, so the raw file contents and the normalised catalogue are never both fully in memory.
 * That matters on a 512 MB host: the production loader uses it, tests that reuse `parsed` do not.
 */
export function* iterateCatalogueV2(parsed, { release = false } = {}) {
  const categoryBySlug = new Map((parsed.categories ?? []).map((c) => [c.slug, { slug: c.slug, label: c.name }]));

  const reviewsByAsin = new Map();
  const reviews = parsed.reviews ?? [];
  for (let i = 0; i < reviews.length; i += 1) {
    const review = reviews[i];
    if (!reviewsByAsin.has(review.asin)) reviewsByAsin.set(review.asin, []);
    reviewsByAsin.get(review.asin).push({
      // The file has no reviewer identity, so reviews show as "Customer".
      rating: review.rating,
      title: review.title,
      text: review.body,
      timestamp: review.createdAt ? Math.floor(Date.parse(review.createdAt) / 1000) : null,
      verified_purchase: Boolean(review.verified),
      helpful_vote: Number.isInteger(review.helpfulCount) ? review.helpfulCount : 0,
    });
    if (release) reviews[i] = null;
  }

  const products = parsed.products;
  for (let i = 0; i < products.length; i += 1) {
    const p = products[i];
    const asin = p.asin;
    const record = {
      parent_asin: asin,
      title: p.title,
      category: categoryBySlug.get(p.categorySlug) ?? null,
      main_category: p.categorySlug,
      brand: p.brand,
      price_cents: p.priceCents,
      average_rating: p.averageRating,
      rating_number: p.ratingCount,
      features: p.features,
      description: p.description,
      details: p.details,
      category_path: p.categoryPath,
      images: (p.images ?? []).map((img) => ({ thumb: img.thumb, large: img.hiRes || img.large })),
      reviews: reviewsByAsin.get(asin) ?? [],
    };
    if (release) { products[i] = null; reviewsByAsin.delete(asin); }
    yield record;
  }
}

export function adaptCatalogueV2(parsed) {
  return [...iterateCatalogueV2(parsed)];
}
