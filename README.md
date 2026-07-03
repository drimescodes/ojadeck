# OjaDeck

OjaDeck is a WhatsApp commerce control deck for Nigerian small businesses. It lets merchants connect a WhatsApp number, manage a product catalogue, train an AI assistant, collect orders with Nomba Checkout, track wallet balance, and request payouts from one dashboard.

This is the OjaDeck base for the Nomba Forward Hackathon 2026. The backend can create Nomba Checkout links, verify Nomba webhook signatures, and re-check transactions before marking orders paid.

## Current Features

- Merchant registration and JWT login
- Product catalogue CRUD with product image uploads
- WhatsApp QR linking and session status
- AI-assisted customer message handling with seller training fields
- Server-side catalogue validation before payment links are created
- Order creation, payment tracking, and dashboard stats
- Nomba Checkout payment links
- Nomba payment webhook endpoint at `POST /api/webhooks/payments`
- Signed webhook verification with amount/reference/currency checks
- Wallet ledger credits for paid orders
- Bank lookup, payout requests, and live Nomba Transfers
- WhatsApp customer payment confirmations with receipt image fallback

## Run Locally

```bash
bun install
cd dashboard && bun install && cd ..
cp .env.example .env
bun run dev
```

Set `NOMBA_MODE=test` for sandbox credentials or `NOMBA_MODE=live` for production credentials. Restart the backend after changing the mode.

Gemini is the primary AI provider. Set `OPENROUTER_API_KEY` to enable free-model fallback when Gemini is unavailable.

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

- Continue production-mode payment and payout smoke tests with low-value transactions
- Polish wallet/dashboard refresh behaviour and receipt presentation
- Expand seller AI training controls
- Prepare demo script, short video, and final submission materials
