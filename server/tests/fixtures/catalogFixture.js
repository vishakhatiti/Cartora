const review = (user, rating, ts, title = 't', text = 'x') => ({ user_id: user, rating, title, text, timestamp: ts });
const PLACEHOLDER = { thumb: 'https://placeholder.com', large: 'https://placeholder.com' };

/** Small hand-made catalog. Prices are chosen to sit on both sides of the $50 shipping line. */
export const rawFixture = [
  { parent_asin: 'A1', title: 'Compact Steel Water Bottle', main_category: 'Home_and_Kitchen', brand: 'Acme',
    price: '49.99', deal: { has_deal: false }, average_rating: 4.5, rating_number: 100, features: ['f1'],
    images: [PLACEHOLDER], reviews: [review('U10001', 5, 1700000300), review('U10002', 1, 1700000100), review('U10003', 5, 1700000200)] },
  { parent_asin: 'A2', title: 'Steel Chef Knife', main_category: 'Home_and_Kitchen', brand: 'Sharp Co',
    price: '80.00', deal: { has_deal: true, discount_percentage: 25, sale_price: '60.00' }, average_rating: 3.9, rating_number: 40,
    features: [], images: [{ thumb: 'https://m.media-amazon.com/t.jpg', large: 'https://m.media-amazon.com/l.jpg' }], reviews: [] },
  { parent_asin: 'A3', title: 'Wireless Headphones', main_category: 'Electronics', brand: 'Acme',
    price: '120.50', deal: { has_deal: true, discount_percentage: 10, sale_price: '130.00' }, average_rating: 4.8, rating_number: 900,
    features: [], images: [PLACEHOLDER], reviews: [review('U10004', 4, 1700000000)] },
  { parent_asin: 'A4', title: 'Kids Building Blocks', main_category: 'Toys_and_Games', brand: 'Blocko',
    price: '19.99', deal: { has_deal: false }, average_rating: 4.1, rating_number: 10, features: [], images: [PLACEHOLDER], reviews: [] },
  // Records that must be skipped:
  { parent_asin: 'BAD1', title: 'No price', main_category: 'Toys_and_Games', brand: 'X', price: 'None', images: [] },
  { parent_asin: 'A4', title: 'Duplicate id', main_category: 'Toys_and_Games', brand: 'X', price: '5.00', images: [] },
  { parent_asin: '', title: 'No id', main_category: 'Toys_and_Games', brand: 'X', price: '5.00', images: [] },
];
