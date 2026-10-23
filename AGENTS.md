# AGENTS.md

Instructions for any AI coding agent working in this repository. `CLAUDE.md` has the full detail. This file is the short version.

## What this is

Cartora, a MERN e-commerce marketplace. Plan: `ROADMAP.md`. Overview: `README.md`.

## Structure

- `client/` React frontend (Vite, Tailwind, Framer Motion)
- `server/` Express API, seed script and tests
- `server/data/data.json` raw product data, read-only

## Must follow

1. Never request, read, print or commit secrets. Use only the key names in the `.env.example` files.
2. Validate on the server and recompute prices and permissions there. Money is integer cents.
3. Shipping: free at $50.00 or more, otherwise $5.99.
4. Orders become paid only through the verified Stripe webhook.
5. Write tests for new behavior, run them, and report real results.
6. Keep `ROADMAP.md` and `README.md` truthful: tick a box only when the feature works.
7. Do not edit anything in `.agent-logs/`, and keep it out of `.gitignore`. Commit it with the code.

## Testing

`cd server && npm test`. Tests that need Gmail or Stripe use mocks.
