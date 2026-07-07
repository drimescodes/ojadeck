# OjaDeck

OjaDeck is a WhatsApp commerce desk for Nigerian merchants. It lets a business connect its WhatsApp number, publish a product catalogue, train an AI sales assistant, collect payments with Nomba Checkout, track paid orders, and withdraw from a merchant wallet.

Built for the DevCareer x Nomba Forward Hackathon 2026.

Live app:

```text
https://ojadeck.drimes.dev
```

Demo video:

```text
https://ojadeck.drimes.dev/demo
```

Backup video link:

```text
https://drive.google.com/file/d/1d8cX9fqLBdrSZGKZM3HEVS2coZnNRMTm/view?usp=drivesdk
```

Judge test access:

```text
Merchant: Bimpe
Email: drimesbot@gmail.com
Password: 12345678
Test WhatsApp business number: +2348077826945
```

## What It Does

- Merchant registration and login with HttpOnly cookie sessions.
- Dashboard for profile, catalogue, WhatsApp connection, orders, wallet, and payout setup.
- Product catalogue CRUD with image uploads.
- Seller AI training fields for tone, business context, and response rules.
- WhatsApp QR connection using `whatsapp-web.js`.
- AI-assisted customer replies using the seller catalogue and training fields.
- Server-side order validation before payment links are created.
- Nomba Checkout payment-link creation.
- Signed Nomba webhook handling for payment confirmation.
- Order timeline, payment status, and wallet ledger tracking.
- Customer WhatsApp confirmation after payment.
- Bank lookup, payout account saving, payout confirmation, and Nomba transfer submission.
- Public landing page for explaining the product and onboarding merchants.
- Public demo page with the project video hosted on the OjaDeck domain.

## Demo Flow

1. Register or log in to the dashboard.
2. Add at least one in-stock product with a price and image.
3. Connect WhatsApp by scanning the QR code.
4. Add seller training instructions from the Settings page.
5. Message the connected WhatsApp number as a customer and ask for a product.
6. Let the assistant confirm the order and send a Nomba Checkout link.
7. Complete payment.
8. Confirm the order moves to paid, the wallet is credited, and the customer receives a WhatsApp confirmation.
9. Save a payout account and test withdrawal from the Wallet page.

## Nomba Integration

OjaDeck supports both sandbox and production credentials through one mode variable:

```env
NOMBA_MODE=test
```

Use `NOMBA_MODE=live` only when you intentionally want to hit production rails. Live transfers can move real money.

Nomba is used for:

- Checkout order creation.
- Hosted payment links.
- Payment webhook delivery.
- Webhook signature verification.
- Transaction verification when configured.
- Bank account lookup.
- Bank transfer payout submission.

Payment webhook endpoint:

```text
POST /api/webhooks/payments
```

Webhook handling checks the signature, timestamp, order reference, amount, and currency before an order is marked paid. Duplicate paid webhooks do not duplicate wallet credits.

## Tech Stack

- Backend: Bun, Hono, TypeScript
- Dashboard: React, Vite, TanStack Query, Tailwind CSS
- Database: SQLite with Drizzle schema
- WhatsApp: `whatsapp-web.js`
- AI: Gemini primary model with OpenRouter fallback
- Payments: Nomba Checkout, webhooks, bank lookup, and transfers
- Deployment: DigitalOcean VPS, Caddy, GitHub Actions

## Local Setup

Install dependencies:

```bash
bun install
cd dashboard
bun install
cd ..
```

Create the environment file:

```bash
cp .env.example .env
```

Fill the required values in `.env`, especially:

```env
JWT_SECRET=
GEMINI_API_KEY=
NOMBA_MODE=
NOMBA_WEBHOOK_SECRET=
NOMBA_TEST_CLIENT_ID=
NOMBA_TEST_PRIVATE_KEY=
NOMBA_TEST_PARENT_ACCOUNT_ID=
NOMBA_TEST_SUB_ACCOUNT_ID=
NOMBA_LIVE_CLIENT_ID=
NOMBA_LIVE_PRIVATE_KEY=
NOMBA_LIVE_PARENT_ACCOUNT_ID=
NOMBA_LIVE_SUB_ACCOUNT_ID=
```

Generate a JWT secret with:

```bash
openssl rand -hex 32
```

Run the backend:

```bash
bun run dev
```

Run the dashboard dev server:

```bash
cd dashboard
bun run dev
```

The backend serves the built dashboard in production. During local frontend development, Vite proxies API requests to the backend.

## Build Checks

Backend typecheck:

```bash
./node_modules/.bin/tsc --noEmit
```

Dashboard production build:

```bash
cd dashboard
bun run build
```

## Environment Notes

Important variables:

- `APP_URL`: public app URL used for payment callbacks.
- `DB_PATH`: SQLite database path.
- `JWT_SECRET`: required random signing secret for dashboard sessions.
- `SESSION_COOKIE_SECURE`: optional override; cookies are secure by default outside localhost.
- `NOMBA_MODE`: `test` or `live`.
- `NOMBA_AMOUNT_UNIT`: defaults to `naira` for the current Nomba Checkout flow.
- `NOMBA_REQUIRE_TRANSACTION_VERIFICATION`: when `true`, wallet credit requires successful transaction verification.
- `NOMBA_TRANSFER_FEE_NAIRA`: estimated fee reserved before payout confirmation.
- `PUPPETEER_EXECUTABLE_PATH`: Chrome path for WhatsApp runtime when needed.
- `GEMINI_API_KEY`: primary AI provider key.
- `OPENROUTER_API_KEY`: optional fallback provider key.

Runtime folders are not committed:

```text
data/
uploads/
.wwebjs_auth/
.wwebjs_cache/
```

## Security Notes

- Dashboard sessions are stored in an HttpOnly cookie.
- Mutating protected routes require a CSRF token tied to the signed session.
- Seller data is scoped by the authenticated seller ID.
- Product image uploads are seller-scoped and checked by file magic bytes.
- Customer-supplied payment details are not trusted; order totals are recomputed from catalogue prices.
- Webhooks must pass Nomba signature verification before payment processing.
- Payout confirmation checks available balance plus the estimated transfer fee.
- Bank lookup is rate-limited per seller.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full architecture and security note.

## Current Scope

This is a hackathon MVP running on a single VPS. SQLite and local image storage are enough for the current deployment. A production version would move the database and uploads to managed services and replace the WhatsApp Web automation with an approved messaging integration where required.
