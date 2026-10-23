import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import { User, Product, Review, Cart, Order, Otp, Notification } from '../../src/models/index.js';

const oid = () => new mongoose.Types.ObjectId();

// validate() runs schema rules and pre-validate hooks without needing a database.
async function errorsOf(doc) {
  try {
    await doc.validate();
    return {};
  } catch (err) {
    return err.errors ?? { _: err };
  }
}

const validProduct = () => ({
  asin: 'B000TEST01',
  title: 'Test Product',
  category: 'Electronics',
  priceCents: 2599,
  images: [{ large: 'https://example.com/a.jpg' }],
});

describe('User', () => {
  it('accepts a valid user and lowercases the email', async () => {
    const user = new User({ email: 'Buyer@Example.COM', name: 'Buyer' });
    expect(await errorsOf(user)).toEqual({});
    expect(user.email).toBe('buyer@example.com');
  });

  it('requires email and name', async () => {
    const errors = await errorsOf(new User({}));
    expect(errors.email).toBeDefined();
    expect(errors.name).toBeDefined();
  });

  it('requires a store name once the user is a seller', async () => {
    const errors = await errorsOf(new User({ email: 'a@b.co', name: 'A', isSeller: true }));
    expect(errors.storeName).toBeDefined();
    expect(await errorsOf(new User({ email: 'a@b.co', name: 'A', isSeller: true, storeName: 'My Shop' }))).toEqual({});
  });

  it('does not select the password hash by default', () => {
    expect(User.schema.path('passwordHash').options.select).toBe(false);
  });
});

describe('Product', () => {
  it('accepts a valid product', async () => {
    expect(await errorsOf(new Product(validProduct()))).toEqual({});
  });

  it('requires integer, non-negative cents', async () => {
    expect((await errorsOf(new Product({ ...validProduct(), priceCents: 10.5 }))).priceCents).toBeDefined();
    expect((await errorsOf(new Product({ ...validProduct(), priceCents: -1 }))).priceCents).toBeDefined();
  });

  it('requires asin, title and category', async () => {
    const errors = await errorsOf(new Product({ priceCents: 100 }));
    expect(errors.asin).toBeDefined();
    expect(errors.title).toBeDefined();
    expect(errors.category).toBeDefined();
  });

  it('rejects a rating outside 0-5', async () => {
    expect((await errorsOf(new Product({ ...validProduct(), ratingAvg: 5.5 }))).ratingAvg).toBeDefined();
  });

  it('reports the sale price as the effective price when a deal applies', () => {
    const product = new Product({ ...validProduct(), priceCents: 10000, deal: { percent: 20, salePriceCents: 8000 } });
    expect(product.effectivePriceCents).toBe(8000);
    expect(new Product(validProduct()).effectivePriceCents).toBe(2599);
  });

  it('defaults to the Cartora Marketplace seller', () => {
    const product = new Product(validProduct());
    expect(product.sellerId).toBeNull();
    expect(product.storeName).toBe('Cartora Marketplace');
    expect(product.isActive).toBe(true);
  });
});

describe('Review', () => {
  const base = () => ({ productId: oid(), rating: 4, text: 'Works well.' });

  it('accepts a review from a real user', async () => {
    expect(await errorsOf(new Review({ ...base(), userId: oid() }))).toEqual({});
  });

  it('accepts a legacy review that has no account', async () => {
    expect(await errorsOf(new Review({ ...base(), legacyReviewerId: 'AGKASBHYZPQJ' }))).toEqual({});
  });

  it('rejects a review with no reviewer identity', async () => {
    expect((await errorsOf(new Review(base()))).userId).toBeDefined();
  });

  it('requires a whole-number rating from 1 to 5', async () => {
    const who = { userId: oid() };
    expect((await errorsOf(new Review({ ...base(), ...who, rating: 0 }))).rating).toBeDefined();
    expect((await errorsOf(new Review({ ...base(), ...who, rating: 6 }))).rating).toBeDefined();
    expect((await errorsOf(new Review({ ...base(), ...who, rating: 4.5 }))).rating).toBeDefined();
  });

  it('requires review text', async () => {
    expect((await errorsOf(new Review({ productId: oid(), rating: 3, userId: oid() }))).text).toBeDefined();
  });
});

describe('Cart', () => {
  it('limits quantity per item to 1-99', async () => {
    const make = (qty) => new Cart({ userId: oid(), items: [{ productId: oid(), qty }] });
    expect(await errorsOf(make(2))).toEqual({});
    expect(Object.keys(await errorsOf(make(0))).length).toBeGreaterThan(0);
    expect(Object.keys(await errorsOf(make(100))).length).toBeGreaterThan(0);
  });
});

describe('Order', () => {
  const item = () => ({ productId: oid(), title: 'Thing', unitPriceCents: 1000, qty: 1 });
  const totals = { subtotalCents: 1000, shippingCents: 599, totalCents: 1599 };

  it('accepts a guest order with an email', async () => {
    expect(await errorsOf(new Order({ guestEmail: 'Guest@Example.com', items: [item()], ...totals }))).toEqual({});
  });

  it('requires either a user or a guest email', async () => {
    expect((await errorsOf(new Order({ items: [item()], ...totals }))).userId).toBeDefined();
  });

  it('requires at least one item', async () => {
    const errors = await errorsOf(new Order({ userId: oid(), items: [], ...totals }));
    expect(errors.items).toBeDefined();
  });

  it('rejects an unknown status', async () => {
    const errors = await errorsOf(new Order({ userId: oid(), items: [item()], ...totals, status: 'teleported' }));
    expect(errors.status).toBeDefined();
  });

  it('starts as pending', () => {
    expect(new Order({ userId: oid(), items: [item()], ...totals }).status).toBe('pending');
  });
});

describe('Otp', () => {
  it('stores only a hash and expires about 10 minutes from now', () => {
    const otp = new Otp({ email: 'A@B.co', purpose: 'login', codeHash: 'abc' });
    const minutes = (otp.expiresAt.getTime() - Date.now()) / 60000;
    expect(minutes).toBeGreaterThan(9.5);
    expect(minutes).toBeLessThanOrEqual(10);
    expect(otp.email).toBe('a@b.co');
    expect(otp.attempts).toBe(0);
  });

  it('rejects an unknown purpose', async () => {
    expect((await errorsOf(new Otp({ email: 'a@b.co', purpose: 'hack', codeHash: 'x' }))).purpose).toBeDefined();
  });
});

describe('Notification', () => {
  it('requires user, type, title and message', async () => {
    const errors = await errorsOf(new Notification({}));
    expect(errors.userId).toBeDefined();
    expect(errors.type).toBeDefined();
    expect(errors.title).toBeDefined();
    expect(errors.message).toBeDefined();
  });
});
