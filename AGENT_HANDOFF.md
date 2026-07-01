# Agent Handoff - OjaDeck

## Product

OjaDeck is a WhatsApp commerce control deck for Nigerian small businesses. Merchants can register, connect a business WhatsApp number, publish a catalogue, let an AI assistant answer customer DMs, collect orders, generate payment links, and track paid orders from a dashboard.

This repository is now a provider-neutral scaffold for the Nomba Forward Hackathon 2026. The Nomba-specific payment client, webhook verification, and transaction verification should be added during the official build sprint.

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
| Payments | Provider-neutral scaffold | Nomba client to be implemented during build sprint |
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
- Payment provider client is intentionally generic and not yet wired to Nomba.
- Payment webhook route is generic at `POST /api/webhooks/payments`.

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
PAYMENT_PROVIDER_SECRET_KEY=
PAYMENT_PROVIDER_BASE_URL=
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
JWT_SECRET=
PORT=3000
APP_URL=http://localhost:3000
DB_PATH=./data/app.db
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

1. Implement the Nomba checkout client in `src/services/payment-provider.ts` or replace it with `src/services/payments/nomba.ts`.
2. Add Nomba webhook signature verification.
3. Re-verify transactions server-side before marking orders as paid.
4. Compare paid amount and currency against the stored order.
5. Validate AI-generated order items against the seller catalogue before payment creation.
6. Add `ARCHITECTURE.md` with auth, webhook, data handling, and reliability notes.
7. Add demo seed data and hosted MVP instructions.
