# OjaDeck

OjaDeck is a WhatsApp commerce control deck for Nigerian small businesses. It lets merchants connect a WhatsApp number, manage a product catalogue, use AI to answer customer DMs, collect orders, and track payment status from one dashboard.

This is a provider-neutral scaffold prepared for the Nomba Forward Hackathon 2026. The Nomba-specific payment integration should be implemented during the official build sprint.

## Current Features

- Merchant registration and JWT login
- Product catalogue CRUD
- WhatsApp QR linking and session status
- AI-assisted customer message handling
- Order creation and dashboard stats
- Generic payment-provider client placeholder
- Generic payment webhook endpoint at `POST /api/webhooks/payments`

## Run Locally

```bash
bun install
cd dashboard && bun install && cd ..
cp .env.example .env
bun run dev
```

For the dashboard dev server:

```bash
cd dashboard
bun run dev
```

## Build

```bash
./node_modules/.bin/tsc --noEmit
cd dashboard
./node_modules/.bin/vite build
```

## Hackathon Build-Sprint Work

- Add Nomba checkout client
- Add webhook signature verification
- Re-verify transactions before marking orders paid
- Validate paid amount and currency against stored orders
- Validate AI-generated order items against the catalogue
- Add architecture and security notes for submission
