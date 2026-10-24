# Cartora

A MERN marketplace built to fix what makes big marketplaces tiring: cluttered results, fake-looking deals, and separate buyer and seller logins. **One account, two modes: Buying and Selling.**

| | URL |
|---|---|
| **Website (frontend)** | https://shop-at-cartora.vercel.app |
| **API (backend)** | https://cartora-deib.onrender.com (health check: `/api/health`) |

The API runs on a free plan and sleeps when idle, so the first request after a pause can take about a minute. Payments are in **demo mode** (no real money) unless Stripe is switched on. [ROADMAP.md](ROADMAP.md) tracks what is finished.

## Cartora vs Amazon

This compares design choices, not scale. Amazon is a mature global platform; Cartora is a small, honest build.

| Feature | Amazon | Cartora |
|---|---|---|
| Buyer and seller | Seller Central is a separate registration | One account, Buying / Selling switch in the header |
| Browsing without an account | Yes | Yes: browse, search and fill a cart as a guest; sign in to check out (the cart is kept and merged) |
| Sign-in | Password-based | Password, emailed one-time code, or Google |
| Sponsored results | Search includes sponsored listings | None |
| Deals and discounts | Shown | None shown: the dataset has no real sale prices, so none are invented |
| Trending, best sellers, new releases | Own sales data | Ranked from real review dates and counts; each shelf states its rule |
| Search | Full-site | Instant suggestions; filters live in the URL so links can be shared |
| Orders | Tracking and notifications | Order list, shipping progress, in-app bell, best-effort confirmation email |
| Themes | One | Ivory and Night |
| Catalog | Hundreds of millions of items | 12,000 real products plus whatever sellers add |
| Logistics, returns, Prime | Yes | Out of scope |

## Features

| Buying | Selling |
|---|---|
| Trending, Best sellers, New releases | Dashboard (products, orders to ship, sales) |
| Search, category filters, product pages with real reviews | Add and edit products, set price and stock |
| Cart (guest or account), wishlist | Orders containing your items, mark shipped |
| Saved addresses, checkout, order list and details | Bell notification for each new order |
| Customer service form | Sees only your items and the ship-to address, never the buyer's email |
| Notification bell, light and dark themes | Seller listings appear in search and on product pages |

## How we use data

| Topic | Detail |
|---|---|
| Source | `server/data/catalogue.json.gz`: 12,000 products in 24 categories (500 each) from Amazon Reviews 2023 (McAuley Lab). Loaded into memory when the API starts. |
| Shown as real | Titles, photos (Amazon-hosted, about 5.6 per product), prices, ratings, specifications, 36,267 reviews. About 11% of products have no reviews; reviewer names are not in the data, so reviews show "Customer". |
| Never shown | `stock`, `isBestSeller`, `importedRank` and `listPriceCents` look generated, so Cartora does not use or display them. |
| Shelves | Trending = most reviews in the latest 12 months of the review data. Best sellers = most-rated with average 4 or above. New releases = seller listing date first, then earliest review date. |
| Photos | Loaded from Amazon's servers; if one fails, Cartora draws generated artwork. |
| Seller products | Stored in MongoDB and added to the in-memory catalogue at start-up. |
| User data | MongoDB Atlas: accounts, carts, wishlists, addresses, orders, checkout sessions, notifications, support tickets. |
| Money | Integer cents. Shipping is free from $50.00, otherwise $5.99. No tax. The server always recomputes prices; the browser's numbers are never trusted. |
| Licence | The dataset page we checked states no licence. Check its terms before using it beyond this project. |

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS 4, Framer Motion (Vercel) |
| Backend | Node.js, Express 5, Mongoose (Render) |
| Database | MongoDB Atlas |
| Auth | JWT in an `httpOnly` cookie; Google sign-in via `google-auth-library` |
| Email | Gmail API (OAuth refresh token) |
| Payments | Demo provider by default; Stripe Checkout available |
| Tests | Vitest, Supertest, React Testing Library; GitHub Actions on every pull request |

## Payments

| Mode | How to turn on | What happens |
|---|---|---|
| **Demo** (default) | leave `PAYMENT_PROVIDER` empty or set `demo` | Checkout is labelled "Demo Mode — No Real Money Charged" with Simulate Successful / Failed Payment buttons. No card details exist. |
| **Stripe (test)** | `PAYMENT_PROVIDER=stripe` plus `STRIPE_SECRET_KEY` (`sk_test_...`) and `STRIPE_WEBHOOK_SECRET` | Stripe's hosted page. An order is marked paid only by the signature-verified webhook `POST /api/webhooks/stripe`, after the amount is checked against the server's price. Repeated events make one order. If an item sells out before payment completes, no order is made and Stripe refunds. |

Webhook events to select in Stripe: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`. Test card: `4242 4242 4242 4242`. Stripe mode is tested with a faked Stripe network; **a real Stripe test payment has not been run**.

## Security

| Area | Rule |
|---|---|
| Session | JWT in an `httpOnly`, `SameSite=Lax` cookie (`Secure` in production), 7 days |
| Passwords | scrypt with a random salt; 8 to 128 characters |
| One-time codes | 6 digits, 10 minutes, single use, 5 attempts, stored only as an HMAC keyed from `JWT_SECRET` |
| Rate limits | Per IP on `/api`, sign-in, checkout and seller activation |
| Authority | The server validates all input and rechecks prices, stock and roles. Seller routes check the role in the database. |
| Secrets | Never committed. Only key names live in `server/.env.example` and `client/.env.example`. |

## API overview

All routes are under `/api`. Detailed behaviour is in the tests.

| Area | Routes |
|---|---|
| Health | `GET /health`, `GET /health/ready` |
| Auth | `POST /auth/register`, `/verify-email`, `/resend-verification`, `/login`, `/login-code/request`, `/login-code/verify`, `/google`, `/forgot`, `/reset`, `/logout`; `GET /auth/me` |
| Catalog | `GET /products` (q, category, brand, price, rating, sort, page), `/products/:id`, `/products/:id/reviews`, `/products/:id/related`, `/categories`, `/search/suggestions`, `/discover/:kind` |
| Cart | `POST /cart/quote`; `GET`, `DELETE /cart`; `PUT`, `DELETE /cart/items/:productId`; `POST /cart/merge` |
| Wishlist | `GET /wishlist`; `PUT`, `DELETE /wishlist/items/:productId` |
| Addresses | `GET`, `POST /addresses`; `PUT`, `DELETE /addresses/:id`; `POST /addresses/:id/default` |
| Checkout and orders | `GET /checkout/config`, `POST /checkout/sessions`, `GET /checkout/sessions/:id`, `POST /checkout/sessions/:id/simulate` (demo only), `POST /webhooks/stripe` (Stripe only), `GET /orders`, `GET /orders/:id` |
| Support and alerts | `POST`, `GET /support/tickets`; `GET /notifications`, `POST /notifications/read` |
| Seller | `POST /seller/activate`; `GET /seller/me`, `/summary`, `/products`, `/orders`; `POST /seller/products`; `PUT /seller/products/:id`; `POST /seller/orders/:id/ship` |

## Run it locally

```bash
# Server (needs a MongoDB URL)
cd server && cp .env.example .env     # fill in values, never commit .env
npm install && npm run dev

# Client
cd client && cp .env.example .env
npm install && npm run dev
```

## Environment variables

Values go in Render (server) and Vercel (client). Never commit them.

| Key | Purpose |
|---|---|
| `MONGO_URL` | MongoDB Atlas connection string, ending in `/cartora` |
| `JWT_SECRET` | Signs login tokens; also derives the one-time-code hashing key |
| `FRONTEND_URL` | The website URL (CORS, emails and Stripe return links). Here: `https://shop-at-cartora.vercel.app` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in and Gmail API |
| `GOOGLE_REFRESH_TOKEN`, `EMAIL_USER` | Sending email as this Gmail address |
| `PAYMENT_PROVIDER`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | See Payments |
| `NODE_OPTIONS` | On Render: `--max-old-space-size=300` (the catalogue needs about 200 MB; the free plan has 512 MB) |
| `PORT`, `NODE_ENV` | Set by the platform |
| `VITE_GOOGLE_CLIENT_ID` | Public client setting (Vercel). Leave `VITE_API_BASE_URL` unset: `client/vercel.json` rewrites `/api/*` to Render so cookies stay same-origin. |

Publish the Google OAuth consent screen to production before creating the refresh token; in Testing status, Gmail tokens expire after 7 days. Add the website URL under *Authorized JavaScript origins*.

## Testing

```bash
cd server && npm test        # API, services, catalog, Stripe webhook, every-route smoke test
cd client && npx vitest run  # pages and components
cd client && npm run build
```

Current local result: server 304 passed (2 skipped), client 137 passed. MongoDB store tests run only in GitHub Actions. Gmail, Google sign-in and Stripe are tested with fakes; check them by hand.

## Deployment

| Part | Platform | Notes |
|---|---|---|
| Database | MongoDB Atlas | Free tier. Network access `0.0.0.0/0` (Render's free tier has no fixed IP). |
| API | Render Web Service | `render.yaml` lists keys only. **Deploys from `main`; confirm in Render Events that the latest commit is live.** |
| Website | Vercel | Root directory `client`. `client/vercel.json` proxies `/api/*` to the Render URL. |

**Troubleshooting:** a 502 means Vercel reached Render but got no valid reply. Check Render Logs for `Catalogue loaded` and `Cartora API listening`, Render Events for a deploy in progress, and `GET /api/health`. An error mentioning an old message (such as "not implemented") means Render is still running an old build: use Manual Deploy, then Deploy latest commit.

## Known limitations

| Limitation | Detail |
|---|---|
| Stock | Pending checkouts do not reserve stock; a buyer can lose the last unit at payment time (they are not charged). |
| Orders | No cancellation, returns or tracking numbers. |
| Wishlist | Needs an account. |
| Reviews | Dataset reviews only; writing reviews on Cartora is not built. |
| Unverified live | Gmail delivery, Google sign-in on the live site, and a real Stripe test payment. |

## Repository layout

| Path | Purpose |
|---|---|
| `client/` | React frontend |
| `server/src/` | Express API (config, models, routes, services, middleware) |
| `server/tests/` | Unit and integration tests |
| `server/scripts/` | Catalogue build script and seed |
| `server/data/` | `catalogue.json.gz` (main catalogue), `data.json` (fallback only) |
| `ROADMAP.md` | Plan and honest progress |
| `.agent-logs/` | Build prompts and responses, recorded by a hook (see [CAPTURE-TEST.md](CAPTURE-TEST.md)) |
| `CLAUDE.md`, `AGENTS.md` | Rules for AI coding agents |
