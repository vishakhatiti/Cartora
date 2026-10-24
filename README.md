# Cartora

An e-commerce marketplace built with the MERN stack, designed to fix the things that make big marketplaces tiring to use: forced accounts, cluttered results, and separate buyer and seller logins.

> **Status: in development.** The tables below describe what Cartora is being built to do. [ROADMAP.md](ROADMAP.md) tracks what is actually finished.

## Cartora vs Amazon

Amazon is a mature, global platform. This comparison is about design choices, not scale. Cartora is a six-hour build with 12,500 seeded products.

| Feature | Amazon | Cartora (target) |
|---|---|---|
| Buying without an account | Account required to check out | Guest checkout with just an email |
| Buyer and seller | Seller Central is a separate registration | One account, Buyer / Seller switch in the header |
| Sign-in | Password-based, with extra verification in some flows | Password, emailed one-time code, or Google sign-in |
| Sponsored results | Search results include sponsored listings | No sponsored listings |
| Review trust | Verified Purchase label | Verified-purchase badge plus rating breakdown and helpful votes |
| Search | Full-site search | Instant suggestions, filters saved in the URL so links can be shared |
| Order updates | Order tracking and notifications | Order timeline, email confirmation and in-app notification bell |
| Cart and wishlist | Cart and lists | Cart and wishlist kept in the browser for guests, saved to your account and merged at login |
| Themes | One theme | Ivory and Night themes |
| Product catalog | Hundreds of millions of items | 12,500 seeded products plus anything sellers add |
| Logistics, returns, Prime | Yes | Out of scope |

## Features

- Guest mode, register with email verification, password login, emailed login codes, forgot-password codes, Google sign-in
- Product browsing with search, category and price filters, deals, sorting and pagination
- Product pages with reviews; signed-in users can add reviews
- One account, two modes: a Buying / Selling switch in the header
- Buying: Trending, Best sellers and New releases shelves (ranked from real review dates and counts, each with a "basis" line), cart, wishlist, saved addresses, order list and tracking, customer service form, notification bell
- Selling: dashboard, product list, add and edit product, stock, orders to ship (sellers see only their own items and the ship-to address, never the buyer's email)
- Demo checkout (labelled "Demo Mode — No Real Money Charged"); Stripe Checkout once test keys exist
- Emails through the Gmail API (OTP codes, login alerts, order confirmations; order emails are best effort)
- Responsive layout with animations, hover effects, toast messages and skeleton loaders

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React (Vite), Tailwind CSS, Framer Motion |
| Backend | Node.js, Express, Mongoose |
| Database | MongoDB Atlas |
| Auth | JWT in an httpOnly cookie, `google-auth-library` for Google sign-in |
| Email | Gmail API via `googleapis` (OAuth 2.0 refresh token) |
| Payments | Stripe Checkout and webhooks (test mode) |
| Tests | Vitest, Supertest, in-memory MongoDB |
| Hosting | Vercel (client), Render (server) |

## Repository layout

| Path | Purpose |
|---|---|
| `client/` | React frontend |
| `server/` | Express API, seed script and tests |
| `server/data/data.json` | Raw product data (12,500 products) |
| `server/tests/` | Unit and integration tests |
| `.agent-logs/` | Recorded prompts and responses from the build |
| `ROADMAP.md` | Plan and progress |
| `CLAUDE.md`, `AGENTS.md` | Instructions for AI coding agents |

## Data notes

| Fact | Detail |
|---|---|
| Products | 12,500 across 25 categories, 500 each |
| Prices | US dollars, from $10.01 to $149.96, stored as integer cents |
| Deals | 3,073 products carry a discount |
| Images | Every product in the file points to the same placeholder URL, so Cartora draws generated artwork for seeded products. Sellers can supply real image URLs. |
| Reviews | 37,552 embedded reviews, moved into their own collection. Some review titles and text contradict the star rating; they are imported unchanged. |

## Real product data (Amazon Reviews 2023)

The catalog is `server/data/catalogue.json.gz`: 12,000 products in 24 categories (500 each), every product with 1 or more Amazon-hosted photos (about 5.6 on average), a price, a rating, features, specifications and 36,267 reviews in total. The server loads it when it exists and otherwise falls back to `data.json`. The source is stated in the file as "McAuley-Lab Reviews 2023"; we have not compared it against the original dataset.

| Field | What the file really contains | How Cartora treats it |
|---|---|---|
| Photos, titles, prices, ratings, specifications, reviews | Real dataset values | Shown |
| Reviewer names | Not in the file | Reviews show as "Customer" |
| `stock`, `isBestSeller`, `importedRank` | Generated when the file was built (stock is spread evenly from 3 to 60, exactly 20 best sellers per category) | Not used or shown |
| `listPriceCents` | Every list price is 1-29% above the price, which looks generated | Not shown, so no discount is claimed |

About 11% of products have no reviews. Photos are loaded from Amazon's servers, so a photo can disappear later; the website draws generated artwork when an image fails to load.

`server/scripts/build_catalog.py` can rebuild a catalogue from downloaded Amazon Reviews 2023 files, but it writes the older array layout and is not needed to use the committed file. Tests: `cd server/scripts && python3 -m unittest discover -s tests`.

**Licence:** the dataset page we checked states no licence. Check the project's terms before relying on it for anything beyond this project.

## Sign-in (feature/auth-email-otp)

| Route | What it does |
|---|---|
| `POST /api/auth/register` | Creates an unverified account and emails a 6-digit code. Always answers 202, so it does not reveal which emails exist. |
| `POST /api/auth/verify-email` | Checks the code, verifies the email and signs in. |
| `POST /api/auth/resend-verification` | Sends a new verification code. |
| `POST /api/auth/login` | Email and password. Unverified accounts get 403 `EMAIL_NOT_VERIFIED`. |
| `POST /api/auth/login-code/request` and `/verify` | Sign in with an emailed code instead of a password. |
| `POST /api/auth/google` | Sign in with a Google ID token (`credential`). Verified against `GOOGLE_CLIENT_ID`. Creates a verified account, or links the existing one with the same email. |
| `POST /api/auth/forgot` and `/reset` | Emails a reset code, then sets a new password and signs out every older session. |
| `POST /api/auth/logout`, `GET /api/auth/me` | Clears the cookie; returns the signed-in user. |

| Rule | Value |
|---|---|
| Session | JWT in an `httpOnly`, `SameSite=Lax` cookie (`Secure` in production), valid 7 days |
| Passwords | scrypt (N=32768, r=8, p=3) with a random salt; 8 to 128 characters |
| One-time codes | 6 digits, valid 10 minutes, single use, 5 attempts, one new code per 60 seconds. Stored as an HMAC keyed from `JWT_SECRET`, never in plain text. |
| Limits per IP | 20 credential attempts and 10 code requests per 15 minutes on `/api/auth` |
| Email | Gmail API with an OAuth2 refresh token. In development without Google keys, codes are printed in the server console. In production without them, the API refuses to send. |

**Guest mode** needs no server state: guests browse and keep a cart in the browser, and the cart is merged on sign-in (cart feature). **Not tried against real services:** Gmail delivery and Google sign-in are covered by automated tests with fakes only; the sign-in page is part of the client work, so there is no button yet.

**Google sign-in setup:** on the same OAuth client, add `https://shop-at-cartora.vercel.app` under *Authorized JavaScript origins*. The Vercel variable `VITE_GOOGLE_CLIENT_ID` (same client ID) is used by the sign-in button later. If an account was registered with a password but never verified, linking Google removes that password, so nobody can take over an email address they do not own.

## MongoDB Atlas free tier (512 MB)

| Choice | Why it matters |
|---|---|
| The 12,000-product catalogue stays in a file, not in MongoDB | Keeps the database for user data only |
| One-time codes are deleted automatically 10 minutes after they expire (TTL index), and only one code exists per email and purpose | They cannot pile up |
| Unverified sign-ups delete themselves after 3 days (TTL index on `purgeAt`) | Abandoned registrations cannot fill the database |
| Carts and wishlists will store product ids and quantities only, never copies of product data | Keeps documents small |
| Rate limits on sign-up and code requests | Stops bulk account creation |

Check usage in Atlas under Database > Metrics. If it nears the limit, the first things to prune are old notifications and old orders.

**Tests:** `npm test` runs the auth tests against an in-memory store. In CI the same contract tests also run against a real MongoDB (set `MONGO_TEST_URL` to run them yourself).

## Demo payments

Stripe test access is not available yet, so checkout runs on a clearly labelled **demo provider**. Every checkout screen and every demo order says *Demo Mode — No Real Money Charged*. No card details are asked for, stored or sent anywhere, and no order says "Stripe".

| Step | What happens |
|---|---|
| Cart | Guests keep ids and quantities in the browser (`cartora-cart`); signed-in users keep the cart on the server. Prices always come from the server (`POST /api/cart/quote`). On sign-in the browser cart is merged and cleared only after the server confirms. |
| Checkout | Sign-in required. Delivery address is validated on the server. `POST /api/checkout/sessions` re-prices the account cart from the catalogue (browser totals are never read), stores a pending session and returns where to go next. |
| Payment | `/checkout/pay/:id` shows the server's total and two buttons: **Simulate Successful Payment** and **Simulate Failed Payment**. |
| Success | One server step marks the session succeeded, creates the order exactly once (unique on the session id), removes the purchased quantities from the cart and opens the confirmation page. Repeating the request cannot create a second order. |
| Failure | The session is closed as failed. No order is created and the cart is untouched. The page shows the reason, "Try again" and "Back to cart". A failed or paid session cannot be changed afterwards (409). |

**Replacing it with Stripe Checkout later:** add a provider in `server/src/services/payments/` with the same shape as `demoProvider.js` (`name`, `isDemo: false`, `startCheckout(session)` returning `{ redirect: { type: 'external', url } }`), select it in `createPaymentProvider`, and add a webhook route that verifies Stripe's signature and calls `checkout.completeSession(sessionId, { outcome })`. The order logic, cart clearing and idempotency are already behind that one function. The simulate route is only mounted while the provider is the demo one, and the client follows whichever redirect the server returns.

**Verified:** server tests (pricing, store contract, routes including access control, idempotency and failure paths), client tests with a fake API, and the whole flow in a browser on a local server with in-memory storage and the real catalogue (guest cart, merge, failed payment, retry, successful payment, order page, mobile width). **Not verified:** the live site, the new Mongo collections against Atlas (the Mongo contract tests run in CI only), order emails (not built), an order list page and saved addresses (not built).

## Website (feature/client-shell-themes)

Built so far: the page shell, three themes, toast messages, the sign-in, register and forgot-password pages, and the storefront (home, search, product pages). The cart, demo checkout and order confirmation are built (see *Demo payments*). Listings and wishlist are not built yet.

| Part | Detail |
|---|---|
| Themes | Ivory (default: warm ivory, forest green, soft gold) and Night (dark green), chosen with the two swatches in the header and remembered in the browser. The palette follows the build specification. All colours are tokens in `client/src/styles/index.css`; `node client/scripts/check-contrast.mjs` checks every text and background pair against WCAG AA. The lighter secondary grey `#858980` from the palette is not used for text because it fails AA on ivory; `#666B64` is used instead. |
| Type | DM Serif Display for headings and Inter for text, both bundled with the app (no request to Google Fonts). |
| Shell | Two-row header (menu, logo, category search, theme, account; then real category shortcuts), a slide-out menu with focus trap, Escape and backdrop close, a dark pine footer, and shared dialog and confirm components. Cart, wishlist and orders links are added when those pages exist. |
| Sign-in page | Password or emailed code, Google button, links to create an account, reset a password, or continue as guest. |
| Guest | "Continue as guest" goes to the store. Nothing needs an account yet, and there is no server session for guests. |
| Google button | Shown only when `VITE_GOOGLE_CLIENT_ID` is set on Vercel, so there is never a dead button. |
| Home | Hero, 24 category tiles and the most-rated products, all from the catalog API. |
| Search | Header search box with suggestions (keyboard operable). `/products` has category, brand, price and rating filters, sort and pagination; all of them live in the URL, so a result page can be shared. Deals are not offered because the dataset has none. |
| Product page | Photo gallery, price tag, features, description, specifications, rating breakdown, reviews (from the dataset sample) and related products. Text is rendered as plain text, never as HTML. It has quantity and **Add to cart**; the toast appears only after the cart really changed. |
| Photos | Amazon-hosted photos load lazily. If a product has none, or a photo fails to load, generated artwork is drawn instead. |
| Look | Dark green header and page bands, peach product tiles with a white photo tile, orange for active pills, pagination and key buttons, serif headings. Inspired by a reference mockup the project owner supplied; the name, imagery and layout are not copied. |
| Buying / Selling | A two-way switch in the header (and the menu). The mode comes from the address (`/sell...`), so it survives a refresh. Guests who pick Selling go to sign-in; signed-in customers go to `/sell/start`, where one form (store name) turns the same account into a seller account. The server records it (`POST /api/seller/activate`) and the page changes only after the server confirms. `GET /api/seller/me` is seller-only (401 for guests, 403 for customers). |
| Seller dashboard | Shows the store name from the server and an honest empty state. Creating listings, stock, seller orders and payouts are not built yet, and no numbers are shown because there are no records. |
| Accessibility | Skip link, labelled fields with inline errors, keyboard-operable menus and tabs, visible focus, reduced-motion respected. |

Not checked yet: the pages against the live API, and real Google or Gmail delivery. The automated tests use a fake API.

## Buyer and seller API (feature/buyer-experience)

| Route | Access | Purpose |
|---|---|---|
| `GET /api/discover/:kind` | Public | `trending`, `best-sellers`, `new-releases`. Returns `basis`, the plain-language ranking rule. |
| `GET/PUT/DELETE /api/wishlist...` | Signed in | List, add (`PUT /items/:productId`), remove. No guest wishlist. |
| `/api/addresses` | Signed in | List, create, update, set default, delete saved addresses. |
| `POST /api/support/tickets`, `GET /api/support/tickets` | Create: anyone (rate limited). List: signed in | Customer service requests. |
| `GET /api/notifications`, `POST /api/notifications/read` | Signed in | Notification bell. |
| `GET /api/seller/summary`, `GET/POST /api/seller/products`, `PUT /api/seller/products/:id` | Sellers only | Dashboard figures, own listings, create, edit, stock. |
| `GET /api/seller/orders`, `POST /api/seller/orders/:id/ship` | Sellers only | Own order items; mark shipped. The order is "shipped" once every item is shipped. |

**Behaviour:** seller listings are stored in MongoDB and loaded into the in-memory catalogue at start-up. Stock is checked when the cart changes and when checkout starts. When a payment succeeds, stock is taken in one all-or-nothing step: if another buyer took the last unit first, the session fails with "sold out" and no order is created (the demo provider moves no money; a real provider would need a refund here). Product detail responses use `must-revalidate` so price and stock are not stale.

**Known limitations:** pending checkouts do not reserve stock, so a buyer can lose the last unit at payment time; no order cancellation, returns or tracking numbers; wishlist needs an account; the Mongo store contract tests run in CI only; order email delivery through Gmail has not been tried live; the live site has not been re-checked since this feature.

## Environment variables

Real values are never committed. Copy the example files and fill them in.

| File | Where values go in production |
|---|---|
| `server/.env.example` | Render, under Environment |
| `client/.env.example` | Vercel, under Settings, Environment Variables |

| Key | Purpose |
|---|---|
| `MONGO_URL` | MongoDB Atlas connection string, ending in `/cartora` |
| `JWT_SECRET` | Signs login tokens. Also used to derive the key that hashes one-time codes |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth client, used for Google sign-in and the Gmail API |
| `GOOGLE_REFRESH_TOKEN`, `EMAIL_USER` | Sending email through the Gmail API as this Gmail address |
| `PAYMENT_PROVIDER` | `demo` (default when empty) simulates payments. `stripe` is reserved: the server refuses to start with it until a Stripe provider is written |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe test mode. Not used yet |
| `NODE_OPTIONS` | On Render set `--max-old-space-size=300` (already in `render.yaml`). The catalogue needs about 200 MB of heap to load; peak process memory measured locally was 327 MB with this cap and 386 MB without. The free plan has 512 MB. |
| `FRONTEND_URL`, `PORT`, `NODE_ENV` | App settings. On Render, `PORT` is set by the platform |
| `VITE_API_BASE_URL`, `VITE_GOOGLE_CLIENT_ID` | Public client settings |

**Gmail note:** publish the Google OAuth consent screen to production before creating the refresh token. In Testing status, tokens that use Gmail scopes expire after 7 days.

## Getting started

These commands apply once the code is added (see the roadmap).

```bash
# Server
cd server
cp .env.example .env      # fill in values
npm install
npm run seed              # loads server/data/data.json into MongoDB
npm run dev

# Client
cd client
cp .env.example .env      # fill in values
npm install
npm run dev
```

## Testing

```bash
cd server
npm test
```

Tests that depend on Gmail or Stripe use mocks. Check real email delivery and a Stripe test payment by hand (Stripe test card `4242 4242 4242 4242`).

## Deployment

Order matters: database first, then the API, then the website, then one setting back on the API. Render deploys from the `main` branch, so merge the pull requests first.

| Step | Where | What to do |
|---|---|---|
| 1 | MongoDB Atlas | Create a free cluster. Add a database user (username and password). Under Network Access allow `0.0.0.0/0`, because Render's free tier has no fixed IP. From Connect > Drivers copy the connection string and put `/cartora` before the `?`. URL-encode special characters in the password. |
| 2 | Render | New > Blueprint, pick this repo. Render reads `render.yaml` and asks for `FRONTEND_URL` (use `https://example.com` for now) and `MONGO_URL`. `JWT_SECRET` is generated for you. |
| 3 | Check the API | Open `https://<your-service>.onrender.com/api/health/ready`. It should show `{"status":"ok","database":"connected"}`. The first request after a sleep can take about a minute. |
| 4 | Vercel | Add New > Project, pick this repo, set **Root Directory** to `client`, and deploy. If your Render URL is not `https://cartora-api.onrender.com`, edit `client/vercel.json` first so the `/api` rewrite points at your URL. |
| 5 | Render | Set `FRONTEND_URL` to your Vercel URL. Render redeploys. |
| 6 | Verify | Open the Vercel URL. The System status card should say **API online - Database connected**. |

| Part | Platform | Notes |
|---|---|---|
| Database | MongoDB Atlas | Free tier is enough |
| Server | Render Web Service | Configured by `render.yaml` (keys only, no values) |
| Client | Vercel | `client/vercel.json` rewrites `/api/*` to Render so cookies stay same-origin |
| Stripe | Dashboard | Added later in the checkout feature: webhook for `checkout.session.completed` at `<render-url>/api/webhooks/stripe` |

## Build record

Prompts and responses from the build are recorded automatically in [`.agent-logs/`](.agent-logs) by a hook (see [CAPTURE-TEST.md](CAPTURE-TEST.md)).

## Catalog API (feature/catalog-service)

The JSON catalog is read-only and held in memory; MongoDB stores user data. All routes are public GET requests. Prices in the query string are dollars; responses use integer cents.

| Route | Purpose |
|---|---|
| `/api/products` | Search with `q`, `category`, `brand`, `minPrice`, `maxPrice`, `minRating`, `deals`, `sort` (`relevance`, `price_asc`, `price_desc`, `rating`, `discount`), `page`, `pageSize` (max 48). Returns items without reviews, plus facet counts. |
| `/api/products/:id` | Product detail with rating breakdown |
| `/api/products/:id/reviews` | Paged reviews (`sort`: `recent`, `highest`, `lowest`) |
| `/api/products/:id/related` | Same-category products at a similar price |
| `/api/categories` | Categories with product counts |
| `/api/search/suggestions?q=` | Autocomplete for products and categories |

## Troubleshooting: 502 from `/api/*`

A 502 on the website means Vercel reached Render but got no valid reply. Check in this order:

| Check | What to look for |
|---|---|
| Render > Logs | `Catalogue loaded: 12000 products ...` and `Cartora API listening ...` after the latest deploy. The server loads the catalogue before it accepts requests, so a memory or file problem is logged there. |
| Render > Events | A deploy still running, or the service waking from sleep (free plan, up to about a minute). |
| `GET https://<render-url>/api/health` | `{"status":"ok"}` means the process is up. |

## Seller API (feature/seller-mode)

| Route | Access | Purpose |
|---|---|---|
| `POST /api/seller/activate` | Signed in, verified email | Body `{ storeName }` (2 to 60 characters; letters, numbers, spaces and `. , & ' -`). Makes the account a seller. Repeating it changes nothing and never renames an existing store. Limited to 10 attempts per 15 minutes per IP. |
| `GET /api/seller/me` | Sellers only | The seller's store summary. The role is read from the database record, never from the browser. |
