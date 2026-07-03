# Agent Handoff - OjaDeck

## Product

OjaDeck is a WhatsApp commerce control deck for Nigerian small businesses. Merchants can register, connect a business WhatsApp number, publish a catalogue, let an AI assistant answer customer DMs, collect orders, generate payment links, track paid orders, and withdraw merchant balances from a dashboard.

This repository is now the OjaDeck base for the Nomba Forward Hackathon 2026. Nomba Checkout order creation, webhook signature verification, and server-side transaction verification are wired in the backend.

Latest local work, not pushed/deployed yet: merchant wallet ledger, Nomba bank lookup, live payout confirmation flow, architecture note, and payment receipt copy/logging.

## Demo Flow

1. Seller registers on the dashboard and adds products.
2. Seller scans a QR code to connect a WhatsApp number.
3. Customer DMs the seller's WhatsApp number.
4. AI responds with catalogue details and helps confirm an order.
5. If the customer asks about a specific product with an uploaded image, the bot sends the product image with the reply.
6. Confirmed orders are validated against the seller catalogue before checkout creation.
7. Payment provider generates a checkout link.
8. Payment webhook confirms payment, credits the seller wallet, sends customer receipt, and notifies the seller.
9. Seller withdraws available wallet balance to a verified bank account through Nomba Transfers.

## Tech Stack

| Layer | Tech | Notes |
| --- | --- | --- |
| Runtime | Bun | Backend runtime and SQLite driver |
| Backend | Hono | API routes on `Bun.serve` |
| Database | SQLite + Drizzle ORM | Local `data/app.db` with startup migrations |
| WhatsApp | `whatsapp-web.js` | Multi-session QR linking with `LocalAuth` |
| AI | Google Gemini | Per-seller catalogue prompt and conversation history |
| AI fallback | OpenRouter | Free-model fallback chain for Gemini failures |
| Payments | Nomba Checkout + Transfers | Hosted checkout, webhook verification, internal ledger, merchant payouts |
| Dashboard | React + Vite | Served by backend in production |
| Auth | JWT | Custom Bun HMAC utility |
| Uploads | Local disk | Product images stored under `uploads/products/...` and served from `/uploads/...` |

## Project Structure

```text
ojadeck/
├── src/
│   ├── index.ts
│   ├── db/
│   │   ├── schema.ts
│   │   ├── index.ts
│   │   └── migrate.ts
│   ├── routes/
│   │   ├── products.ts
│   │   ├── orders.ts
│   │   ├── wallet.ts
│   │   ├── webhooks.ts
│   │   └── whatsapp.ts
│   ├── services/
│   │   ├── ai-engine.ts
│   │   ├── message-handler.ts
│   │   ├── payment-provider.ts
│   │   ├── wallet.ts
│   │   └── session-manager.ts
│   └── utils/
├── dashboard/
│   └── src/
├── data/
├── uploads/
├── ARCHITECTURE.md
├── drizzle.config.ts
├── .env.example
└── package.json
```

## Current Status

- Backend typecheck passes.
- Dashboard production build passes.
- Seller registration/login works.
- Product CRUD works.
- Orders list and stats endpoints work.
- WhatsApp QR/session management is implemented.
- Gemini message handling is implemented.
- Payment provider client is wired to Nomba Checkout.
- Payment webhook route verifies Nomba signatures at `POST /api/webhooks/payments`.
- AI responses use Gemini first and can fall back to OpenRouter models.
- Seller profile supports lightweight AI training fields: tone, business context, and rules/preferences.
- Product catalogue supports local image uploads and dashboard thumbnails.
- WhatsApp replies can send product images when a specific in-stock product is matched.
- Checkout creation validates AI-confirmed items against in-stock catalogue products and recomputes totals from DB prices.
- Pending payment links can be resent; starting a new order cancels older pending links in that conversation.
- Escalation notifications include a clickable `https://wa.me/...` customer profile link when the customer phone is known.
- Architecture and security note is available at `ARCHITECTURE.md`.
- Merchant wallet tracks paid-order credits through immutable ledger entries.
- Wallet dashboard supports verified payout accounts, withdrawal review, live Nomba transfer confirmation, payout history, and ledger activity.

## Key Routes

Public:

```text
POST /api/auth/register
POST /api/auth/login
POST /api/webhooks/payments
GET  /api/health
```

Protected:

```text
GET/PUT /api/sellers/me
GET/POST /api/products
PUT/DELETE /api/products/:id
POST /api/products/:id/image
GET /api/orders
GET /api/orders/stats
GET /api/wallet/summary
GET /api/wallet/ledger
GET /api/wallet/payouts
GET /api/wallet/banks
POST /api/wallet/payout-account/lookup
POST /api/wallet/payout-account
POST /api/wallet/payouts
POST /api/wallet/payouts/:id/confirm
POST /api/whatsapp/connect
POST /api/whatsapp/disconnect
GET  /api/whatsapp/status
POST /api/whatsapp/pause
POST /api/whatsapp/resume
```

## Environment

```env
NOMBA_MODE=test
NOMBA_TEST_BASE_URL=https://sandbox.nomba.com
NOMBA_TEST_CLIENT_ID=
NOMBA_TEST_PRIVATE_KEY=
NOMBA_TEST_PARENT_ACCOUNT_ID=
NOMBA_TEST_SUB_ACCOUNT_ID=
NOMBA_LIVE_BASE_URL=https://api.nomba.com
NOMBA_LIVE_CLIENT_ID=
NOMBA_LIVE_PRIVATE_KEY=
NOMBA_LIVE_PARENT_ACCOUNT_ID=
NOMBA_LIVE_SUB_ACCOUNT_ID=
NOMBA_WEBHOOK_SECRET=
NOMBA_AMOUNT_UNIT=naira
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
AI_REQUEST_TIMEOUT_MS=12000
OPENROUTER_API_KEY=
OPENROUTER_FALLBACK_MODELS=nvidia/nemotron-3-nano-30b-a3b:free,google/gemma-4-31b-it:free,nvidia/nemotron-3-super-120b-a12b:free
OPENROUTER_SITE_URL=https://ojadeck.drimes.dev
OPENROUTER_APP_NAME=OjaDeck
JWT_SECRET=
PORT=3000
APP_URL=http://localhost:3000
DB_PATH=./data/app.db
```

`NOMBA_MODE=test` uses only the `NOMBA_TEST_*` values. `NOMBA_MODE=live` uses only the `NOMBA_LIVE_*` values. Restart the app after changing mode.

Runtime storage:

```text
data/      SQLite database and runtime data, ignored by git
uploads/   Product image uploads, ignored by git
```

## Run

```bash
# Backend
bun run dev

# Dashboard
cd dashboard
bun run dev

# Production-style local run
cd dashboard
bun run build
cd ..
bun run start
```

## Build-Sprint Work

Do during the official hackathon build period:

1. Test checkout creation end-to-end with the assigned Nomba credentials.
2. Confirm webhook delivery after Nomba's form update window.
3. Smoke-test product image upload and WhatsApp image sending on the VPS after deployment.
4. Smoke-test catalogue validation by asking for an unavailable product and confirming no checkout link is created.
5. Add demo seed data and hosted MVP instructions.
6. Prepare final demo script and video outline.
