# Agent Handoff - OjaDeck

## Product

OjaDeck is a WhatsApp commerce control deck for Nigerian small businesses. Merchants can register, connect a business WhatsApp number, publish a catalogue, let an AI assistant answer customer DMs, collect orders, generate payment links, and track paid orders from a dashboard.

This repository is now the OjaDeck base for the Nomba Forward Hackathon 2026. Nomba Checkout order creation, webhook signature verification, and server-side transaction verification are wired in the backend.

## Demo Flow

1. Seller registers on the dashboard and adds products.
2. Seller scans a QR code to connect a WhatsApp number.
3. Customer DMs the seller's WhatsApp number.
4. AI responds with catalogue details and helps confirm an order.
5. Payment provider generates a checkout link.
6. Payment webhook confirms payment, sends customer receipt, and notifies the seller.

## Tech Stack

| Layer | Tech | Notes |
| --- | --- | --- |
| Runtime | Bun | Backend runtime and SQLite driver |
| Backend | Hono | API routes on `Bun.serve` |
| Database | SQLite + Drizzle ORM | Local `data/app.db` with startup migrations |
| WhatsApp | `whatsapp-web.js` | Multi-session QR linking with `LocalAuth` |
| AI | Google Gemini | Per-seller catalogue prompt and conversation history |
| Payments | Nomba Checkout | Auth token issuance, hosted checkout links, webhook verification |
| Dashboard | React + Vite | Served by backend in production |
| Auth | JWT | Custom Bun HMAC utility |

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
│   │   ├── webhooks.ts
│   │   └── whatsapp.ts
│   ├── services/
│   │   ├── ai-engine.ts
│   │   ├── message-handler.ts
│   │   ├── payment-provider.ts
│   │   └── session-manager.ts
│   └── utils/
├── dashboard/
│   └── src/
├── data/
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
GET /api/orders
GET /api/orders/stats
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
OPENROUTER_FALLBACK_MODELS=google/gemma-4-31b-it:free,nvidia/nemotron-3-super-120b-a12b:free,nvidia/nemotron-3-nano-30b-a3b:free
OPENROUTER_SITE_URL=https://ojadeck.drimes.dev
OPENROUTER_APP_NAME=OjaDeck
JWT_SECRET=
PORT=3000
APP_URL=http://localhost:3000
DB_PATH=./data/app.db
```

`NOMBA_MODE=test` uses only the `NOMBA_TEST_*` values. `NOMBA_MODE=live` uses only the `NOMBA_LIVE_*` values. Restart the app after changing mode.

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
3. Validate AI-generated order items against the seller catalogue before payment creation.
4. Add `ARCHITECTURE.md` with auth, webhook, data handling, and reliability notes.
5. Add demo seed data and hosted MVP instructions.
