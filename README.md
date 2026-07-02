# OjaDeck

OjaDeck is a WhatsApp commerce control deck for Nigerian small businesses. It lets merchants connect a WhatsApp number, manage a product catalogue, use AI to answer customer DMs, collect orders, and track payment status from one dashboard.

This is the OjaDeck base for the Nomba Forward Hackathon 2026. The backend can create Nomba Checkout links, verify Nomba webhook signatures, and re-check transactions before marking orders paid.

## Current Features

- Merchant registration and JWT login
- Product catalogue CRUD
- WhatsApp QR linking and session status
- AI-assisted customer message handling
- Order creation and dashboard stats
- Nomba Checkout payment links
- Nomba payment webhook endpoint at `POST /api/webhooks/payments`

## Run Locally

```bash
bun install
cd dashboard && bun install && cd ..
cp .env.example .env
bun run dev
```

Set `NOMBA_MODE=test` for sandbox credentials or `NOMBA_MODE=live` for production credentials. Restart the backend after changing the mode.

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

- Test checkout creation with real hackathon credentials
- Confirm webhook delivery after Nomba's update window
- Validate AI-generated order items against the catalogue
- Add architecture and security notes for submission
