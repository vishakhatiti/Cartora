# Cartora Roadmap (6-hour build)

Goal: a working, deployed e-commerce marketplace (MERN) that improves on the Amazon experience in clarity, speed and fairness. Backend on Render, frontend on Vercel, data in MongoDB Atlas.

Status legend: `[ ]` not started, `[x]` done. Update this file as work lands. Do not tick a box until it is tested.

## Scope and cut line

| Priority | Meaning | Items |
|---|---|---|
| **P0** | Must ship | Auth (register, OTP, login, forgot, Google, guest), product browse/search/detail, cart, Stripe checkout, orders, order email, seller mode (add product), reviews, deploy |
| **P1** | Ship if on time | Wishlist, notification bell, three themes, search suggestions, order timeline |
| **P2** | Only if hours remain | Product compare, seller analytics, real product photos via an image API |

If a phase runs over by 30 minutes, drop the lowest-priority item in that phase and move on.

## Branching workflow

The base setup (docs, folder structure, env examples) lives on `main`. From here, **every feature gets its own branch**.

1. Start from an up-to-date `main`: `git checkout main && git pull && git checkout -b feature/<name>`.
2. Commit small, with tests. Push the branch regularly.
3. Open a pull request into `main` when the feature works and its tests pass.
4. Merge, delete the branch, then start the next feature from `main`.

| Branch | Feature | Phase |
|---|---|---|
| `feature/amazon-data-pipeline` | `build_catalog.py` samples downloaded Amazon Reviews 2023 files into `catalogue.json.gz`; the server loads it when present. **Done: the committed `catalogue.json.gz` (12,000 products, real photos) is loaded by the server.** | 0 |
| `feature/server-foundation` | Express app, Mongo connection, env validation, health check, models | 0 |
| `feature/catalog-service` | Read-only catalog API served from `server/data/data.json` in memory: search, filters, sort, pagination, suggestions, product detail, reviews, related. **Built, tests passing; awaiting merge.** | 2 |
| `feature/pexels-images` | `fetch_pexels_images.py` and a manual workflow fetch category stock photos; the catalog serves them as `imageKind: stock`. **Code built and tested; photos not fetched until the key is added.** | 2 |
| `feature/seed-database` | `npm run seed` for the generated data file | 0 |
| `feature/auth-email-otp` | Register, email OTP, password login, login by code, forgot password. **Built; tested with an in-memory store and, in CI, real MongoDB. Real Gmail delivery not yet tried.** | 1 |
| `feature/auth-google-guest` | Google sign-in endpoint (built, tested with fakes). Guest mode is browser-only, no server session. | 1 |
| `feature/storefront-ui` | Home, search with suggestions, filters, sort, pagination (URL state), product page with gallery, specs, rating breakdown, reviews and related products. **Built; tested with a fake API and checked in a browser against the real catalogue locally; not yet checked on the live site.** | 2 |
| `feature/reviews` | Review list and add review, rating updates | 2 |
| `feature/seller-mode` | Buyer/Seller switch, seller activation, seller-only API and dashboard shell, reference-inspired restyle. **Built; server 208 and client 78 tests pass; switch and activation checked in a browser locally. Adding products, stock and seller orders are not built yet.** | 2 |
| `feature/cart-wishlist` | Wishlist (signed-in only, built in `feature/buyer-experience`). Guest merge not built. | 3 |
| `feature/demo-payments` | Cart, checkout with a labelled demo payment provider (simulate success or failure), orders created only after success, confirmation page. **Built; server 243 and client 102 tests pass; full flow checked in a browser locally; not yet checked on the live site. No order emails, order list page or saved addresses yet. Wishlist is not part of this branch.** | 3 |
| `feature/stripe-checkout` | Stripe Checkout and verified, idempotent webhook with amount check and refund on sold out; demo provider stays the default. **Built; tested with a fake Stripe network and real signature checks. Not yet tried with real Stripe test keys.** | 3 |
| `feature/orders-notifications` | Orders list and tracking, notification bell, best-effort order email. **Built in `feature/buyer-experience`; Gmail delivery not tried live.** | 3 |
| `feature/client-shell-themes` | React app shell, routing, three themes, toasts, sign-in/register/forgot pages. **Built; tested with a fake API, not yet against the live API.** | 0-4 |
| `feature/design-system` | Forest-green tokens, DM Serif Display and Inter, two-row header with category search, slide-out menu, footer, dialogs. **Built; 68 client tests pass; checked in a browser locally; not yet checked on the live site.** | 1 |
| `feature/buyer-experience` | Shelves (trending, best sellers, new releases), wishlist, orders, addresses, customer service, seller dashboard, products, stock and orders, notifications. **Server 289 and client 128 tests pass; both modes checked in a browser locally; not checked on the live site.** | 2-3 |
| `feature/hardening` | Atomic all-or-nothing stock take at payment (no overselling). Still to do: browser end-to-end test, accessibility pass, order cancellation. **Stock part: server 289 tests pass; Mongo contract test runs in CI.** | 4 |
| `feature/ui-polish` | Animations, toasts, modals, skeletons, responsive pass | 4 |
| `feature/deployment` | Render and Vercel configuration, smoke test | 5 |

## Product data goals

| Goal | Detail |
|---|---|
| Source | Amazon Reviews 2023 (McAuley Lab), streamed and sampled by a GitHub Actions workflow |
| Size | About 13,000 products across 24 categories (about 550 each) |
| Images | Amazon-hosted image URLs, with generated artwork when a link fails to load |
| Reviews | Real reviews where the sample contains them: reviewer id, rating, title, comment, date, verified purchase, helpful votes |
| Extra fields | Description, brand/store, specifications, and a demo stock count generated by the seed |
| Fallback | `server/data/data.json` (synthetic, one placeholder image) stays until the real file is merged |

## Timeline

| Hour | Phase | Deliverables | Done when |
|---|---|---|---|
| 0:00-1:00 | Foundation | Express app, Mongo connection, env validation, models, `npm run seed` for `server/data/data.json`, Vite + Tailwind app shell, theme tokens | Server starts, `/api/health` is OK, seed loads 12,500 products |
| 1:00-2:00 | Auth | Register + email OTP, password login, login by emailed code, forgot password, Google sign-in, guest session, auth middleware | All auth flows work against Atlas and send real Gmail API emails |
| 2:00-3:00 | Catalog | Product list with filters/sort/pagination, search, product page, reviews (add, list), buyer/seller switch, seller add-product | A new product and review appear in MongoDB and in the UI |
| 3:00-4:00 | Commerce | Cart (guest + user, merged on login), wishlist, Stripe Checkout session, webhook, orders, order email, in-app notification | A Stripe test payment creates a paid order and sends an email |
| 4:00-5:00 | Polish + tests | Animations, hover effects, toasts, modals, skeletons, themes, responsive pass, unit + integration tests | `npm test` passes in `server/`, UI works at 360px, 768px, 1280px |
| 5:00-6:00 | Deploy + verify | Render + Vercel deploy, Stripe webhook registered, Atlas network access, smoke test of every P0 flow, README final | Live URLs work end to end |

## Data model (MongoDB)

| Collection | Key fields | Notes |
|---|---|---|
| `users` | email (unique), passwordHash, name, googleId, isSeller, storeName, emailVerified | One account; seller mode is a flag plus store name |
| `products` | asin (unique), title, brand, category, priceCents, deal{percent,salePriceCents}, ratingAvg, ratingCount, features[], images[], sellerId | Seeded products have `sellerId = null` (Cartora Marketplace) |
| `reviews` | productId, userId or legacyUserId, rating, title, text, verifiedPurchase | Unique (productId, userId) for real users |
| `carts` | userId, items[{productId, qty}] | Guests keep their cart in the browser |
| `wishlists` | userId, productIds[] | Same merge rule as the cart |
| `orders` | userId or guestEmail, orderNumber, items[], totals, status, payment{provider, demo, sessionId (unique)}, timeline[] | Order creation is idempotent on `payment.sessionId` |
| `checkoutsessions` | userId, provider, status (pending/succeeded/failed), item snapshot, totals, address, orderId, expiresAt (TTL) | One per payment attempt; failed sessions are final |
| `otps` | email, purpose, codeHash, expiresAt (TTL), attempts | HMAC-hashed with a key derived from `JWT_SECRET`; max 5 attempts |
| `notifications` | userId, type, message, readAt | Created when an order is paid |

Prices are stored as integer cents. The server recomputes all totals from the database; it never trusts client prices.

## API outline

| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/register`, `/verify-email`, `/login`, `/login-code/request`, `/login-code/verify`, `/forgot`, `/reset`, `/google`, `/guest`, `/logout`; `GET /api/auth/me` |
| Products | `GET /api/products` (q, category, minPrice, maxPrice, rating, deals, sort, page), `GET /api/products/:id`, `GET /api/products/suggest`, `POST /api/products` (seller) |
| Reviews | `GET /api/products/:id/reviews`, `POST /api/products/:id/reviews` |
| Cart | `POST /api/cart/quote` (public), `GET /api/cart`, `PUT/DELETE /api/cart/items/:productId`, `POST /api/cart/merge`, `DELETE /api/cart` |
| Wishlist | `GET /api/wishlist`, `PUT/DELETE /api/wishlist/items/:productId` |
| Checkout | `GET /api/checkout/config`, `POST /api/checkout/sessions`, `GET /api/checkout/sessions/:id`, `POST /api/checkout/sessions/:id/simulate` (demo provider only). `POST /api/webhooks/stripe` is not built |
| Orders | `GET /api/orders`, `GET /api/orders/:id` |
| Account | `POST /api/account/become-seller`, `GET /api/notifications`, `POST /api/notifications/read` |

## Business rules

- Shipping: free when the item subtotal is $50.00 or more, otherwise a flat $5.99.
- Deals: when `deal.has_deal` is true, the sale price is charged.
- Only users who bought a product get the "verified purchase" badge.
- A rating update uses `newAvg = (avg * n + r) / (n + 1)`.
- OTP codes: 6 digits, expire in 10 minutes, single use.

## Testing plan

| Level | Tool | Covers |
|---|---|---|
| Unit | Vitest | Pricing and shipping, OTP hashing, rating math, seed transform |
| Integration | Vitest + Supertest + in-memory MongoDB | Auth flows, product queries, review rules, order creation, webhook idempotency |
| Manual smoke | Checklist in README | Stripe test card, email delivery, responsive layouts |

Tests that need the network (Gmail, Stripe) use mocks. Real services are covered only by the manual smoke test.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| All seeded product images are one placeholder URL | Generated artwork per category; sellers add real image URLs |
| Gmail refresh token expires after 7 days while the consent screen is in Testing | Publish the consent screen to production before generating the token |
| Cross-site cookies between Vercel and Render | Vercel rewrites `/api/*` to Render so the cookie stays same-origin |
| Render free tier sleeps and is slow on first request | Show a friendly loading state; mention the cold start in the README |
| Atlas blocks Render's IP | Allow `0.0.0.0/0` in Atlas Network Access |
| 12,500 products slow queries | Server-side pagination and indexes on category, price, text search |
| Review text in the data contradicts the star rating | Imported unchanged; documented as a data limitation |

## Definition of done

- Every P0 flow works on the deployed URLs.
- `npm test` passes in `server/`, and the client builds with no errors.
- No secrets in the repo; `.env.example` files list every key.
- README, ROADMAP and CLAUDE.md match what is actually built.
- `.agent-logs/` is committed alongside the code it produced.
