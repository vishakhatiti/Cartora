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
| Themes | One theme | Light, Dark and Sunset themes |
| Product catalog | Hundreds of millions of items | 12,500 seeded products plus anything sellers add |
| Logistics, returns, Prime | Yes | Out of scope |

## Features

- Guest mode, register with email verification, password login, emailed login codes, forgot-password codes, Google sign-in
- Product browsing with search, category and price filters, deals, sorting and pagination
- Product pages with reviews; signed-in users can add reviews
- Buyer / Seller switch: sellers add products from a dashboard
- Cart, wishlist, Stripe Checkout payments, order history
- Emails through the Gmail API (OTP codes, login alerts, order confirmations)
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

`server/scripts/build_catalog.py` turns downloaded Amazon Reviews 2023 files into `server/data/catalogue.json.gz`: about 13,000 products across up to 24 categories, each with a real Amazon-hosted image, price, rating, features and up to 5 reviews. The server uses that file when it exists and otherwise falls back to `data.json`. Nothing here has been run on the real Amazon files yet; it is tested on small generated samples only.

| Step | What to do |
|---|---|
| 1 | Get the files from the [dataset page](https://amazon-reviews-2023.github.io/) or the Hugging Face repo `McAuley-Lab/Amazon-Reviews-2023` (paths `raw/meta_categories/<Category>.jsonl` and `raw/review_categories/<Category>.jsonl`). Put them in one folder. |
| 2 | Name them `meta_<Category>.jsonl` (or `.jsonl.gz`) and `<Category>.jsonl`. The folders `meta_categories/` and `review_categories/` also work. |
| 3 | Run `python server/scripts/build_catalog.py --input-dir <folder> --target 13000` (Python 3.9+, no packages needed). |
| 4 | Commit `server/data/catalogue.json.gz` on a feature branch and open a pull request. |

Some category files are very large. A cut-off download still works: the script stops cleanly at the end of what it can read, and `--max-meta-lines` and `--max-review-lines` limit how much it reads. The sample then comes from the start of each file, not the whole file. Products need a price, an Amazon image, at least 5 ratings and at least 2 collected reviews. The dataset has no deal or stock data, so Cartora does not show any for these products.

Tests: `cd server/scripts && python3 -m unittest discover -s tests`.

**Licence:** the dataset page we checked states no licence. Check the terms on the project site before publishing the derived file in a public repository.

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
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe test mode |
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
