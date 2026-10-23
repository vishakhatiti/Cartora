# CLAUDE.md

Instructions for Claude Code working in this repository.

## Project

Cartora is a MERN e-commerce marketplace. Read `ROADMAP.md` for scope, phases and the data model, and `README.md` for the feature list and environment keys. Keep both files accurate as work lands.

## Layout

| Path | Purpose |
|---|---|
| `client/` | React + Vite + Tailwind + Framer Motion |
| `server/src/` | Express API (config, models, routes, controllers, services, middleware, utils) |
| `server/tests/` | Vitest unit and integration tests |
| `server/scripts/` | One-off scripts such as the seed |
| `server/data/data.json` | Raw product data. Do not edit it. |

## Rules

1. **Secrets.** Never ask for, read, print or commit real secret values. Use only the key names in `server/.env.example` and `client/.env.example`. Add any new key to the matching example file with an empty value. If a secret is ever exposed, tell the user to rotate it.
2. **Server is the authority.** Validate all input on the server. Recompute prices, shipping and permissions from the database. Never trust client-sent prices or roles.
3. **Money** is integer cents. Shipping is free at a $50.00 subtotal or more, otherwise $5.99.
4. **Stripe.** Mark orders paid only from the verified webhook, and make it idempotent on the Checkout session id.
5. **Auth.** JWT in an httpOnly cookie. OTP codes are HMAC-hashed with a key derived from `JWT_SECRET` (no separate pepper key), expire in 10 minutes and allow 5 attempts.
6. **Seeded data.** The 12,500 products share one placeholder image URL, so the UI draws generated artwork for them. Do not claim real photos exist.
7. **Honesty.** Do not say tests pass unless you ran them and read the output. Do not claim a feature is done in `ROADMAP.md` or `README.md` until it works.
8. **Small steps.** Work in small, testable increments and commit often.
9. **One branch per feature.** After the base setup, never build a feature directly on `main`. Branch from an up-to-date `main` as `feature/<name>` (names are listed in `ROADMAP.md`), open a pull request when tests pass, then start the next feature from `main`.
10. **Product data.** The target dataset is Amazon Reviews 2023, sampled to about 13,000 products in 24 categories by the data pipeline. Image links point to Amazon-hosted URLs, so always render generated artwork when an image fails to load.

## Commands (once scaffolded)

| Task | Command |
|---|---|
| Server dev | `cd server && npm run dev` |
| Seed database | `cd server && npm run seed` |
| Server tests | `cd server && npm test` |
| Client dev | `cd client && npm run dev` |
| Client build | `cd client && npm run build` |

## Build record (important)

This repo records prompts and final responses automatically through a hook (`.claude/settings.json` runs `.claude/hooks/capture.py`).

- Do not edit, tidy, summarize or delete anything in `.agent-logs/`, and never add it to `.gitignore`.
- Commit the logs together with the code they produced, and push regularly.
- Run the build from a session started in this repository so the hook fires.
- Do not change the hook command without testing it in the desktop app first. The current command is the one proven to work.
