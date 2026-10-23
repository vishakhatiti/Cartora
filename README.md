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

## Environment variables

Real values are never committed. Copy the example files and fill them in.

| File | Where values go in production |
|---|---|
| `server/.env.example` | Render, under Environment |
| `client/.env.example` | Vercel, under Settings, Environment Variables |

| Key | Purpose |
|---|---|
| `MONGODB_USER`, `MONGODB_PASSWORD`, `MONGODB_HOST`, `MONGODB_DB_NAME` | MongoDB Atlas connection parts |
| `JWT_SECRET`, `OTP_PEPPER` | Token signing and OTP hashing secrets |
| `GOOGLE_SIGNIN_CLIENT_ID` | Verifies Google sign-in tokens |
| `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_SENDER_ADDRESS` | Sending email through the Gmail API |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe test mode |
| `CLIENT_URL`, `PORT`, `NODE_ENV` | App settings |
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

| Part | Platform | Notes |
|---|---|---|
| Database | MongoDB Atlas | Allow `0.0.0.0/0` in Network Access, because Render's free tier has no fixed IP |
| Server | Render (Web Service) | Root directory `server`, add every key from `server/.env.example` |
| Client | Vercel | Root directory `client`, a rewrite sends `/api/*` to the Render URL so cookies stay same-origin |
| Stripe | Dashboard | Add a webhook for `checkout.session.completed` pointing at `<render-url>/api/webhooks/stripe` |

## Build record

Prompts and responses from the build are recorded automatically in [`.agent-logs/`](.agent-logs) by a hook (see [CAPTURE-TEST.md](CAPTURE-TEST.md)).
