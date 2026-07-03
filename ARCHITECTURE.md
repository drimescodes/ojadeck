# OjaDeck Architecture and Security Note

## Overview

OjaDeck is a WhatsApp commerce assistant for small businesses. A merchant connects a WhatsApp session, publishes a product catalogue, trains the assistant with business-specific instructions, and receives orders through chat. Confirmed orders are validated against the catalogue before OjaDeck creates a Nomba Checkout payment link. Paid orders credit an internal merchant wallet, and merchants can withdraw to verified bank accounts through Nomba Transfers.

Production URL:

```text
https://ojadeck.drimes.dev
```

Nomba webhook URL:

```text
https://ojadeck.drimes.dev/api/webhooks/payments
```

## System Components

- Dashboard: React/Vite app served by the Bun backend.
- API server: Hono on Bun, deployed behind Caddy and HTTPS.
- Database: SQLite with startup migrations and Drizzle schema.
- WhatsApp integration: `whatsapp-web.js` with per-seller sessions.
- AI engine: Gemini primary model with OpenRouter fallback.
- Payments: Nomba Checkout order creation, webhook signature verification, transaction verification fallback, internal seller ledger, and Nomba Transfers for payouts.
- Uploads: local product images stored under `uploads/products/...` and served from `/uploads/...`.

## Data Flow

1. Merchant registers, logs in, adds catalogue items, uploads product images, and optionally configures AI training instructions.
2. Merchant connects WhatsApp by scanning a QR code.
3. Customer sends a WhatsApp message to the merchant's connected number.
4. OjaDeck loads seller profile, catalogue, AI training fields, and recent conversation history.
5. AI replies to product questions and emits a structured order tag only after customer confirmation.
6. Backend validates AI-confirmed items against in-stock catalogue products and recomputes totals from database prices.
7. Backend creates a pending order and requests a Nomba Checkout link.
8. Customer pays through Nomba.
9. Nomba sends a signed `payment_success` webhook to OjaDeck.
10. OjaDeck validates signature, reference, amount, and currency, attempts transaction verification, marks the order paid, credits the seller ledger, sends a WhatsApp payment confirmation to the customer, and notifies the merchant.
11. Merchant saves a verified payout account and confirms a withdrawal from the Wallet dashboard.
12. OjaDeck reserves the payout amount in the ledger and submits a live Nomba bank transfer from the hackathon sub-account.

## Authentication and Access Control

- Dashboard authentication uses JWTs signed by the backend.
- Protected API routes require `Authorization: Bearer <token>`.
- Seller-scoped routes read `sellerId` from the verified JWT.
- Product, order, WhatsApp, and seller profile operations are scoped to the authenticated seller.
- Payment webhooks are public by URL but protected by Nomba HMAC signature verification.
- The customer payment return page at `/payment/complete` is public and does not mutate payment state.

## Nomba Integration

OjaDeck supports `NOMBA_MODE=test` and `NOMBA_MODE=live`.

- Auth requests use the parent account ID in the `accountId` header.
- Checkout orders are created with the parent account ID header and the target sub-account ID in the order body.
- Checkout amount is sent in naira by default through `NOMBA_AMOUNT_UNIT=naira`.
- Browser callback URL points to `/payment/complete`.
- Server webhook URL is `/api/webhooks/payments`.
- Bank transfers use `POST /v2/transfers/bank/{subAccountId}` after a merchant confirms withdrawal.

Webhook handling:

- Requires `nomba-signature` and `nomba-timestamp` headers.
- Reconstructs the Nomba signing payload and verifies HMAC-SHA256 using `NOMBA_WEBHOOK_SECRET`.
- Processes only signed payment events.
- Requires a known order reference and exact amount match before marking an order paid.
- Attempts Nomba transaction lookup by order reference and then transaction ID.
- If lookup is temporarily unavailable but the signed webhook has valid reference, amount, and currency, OjaDeck accepts the signed webhook confirmation and marks the order paid.
- After marking an order paid, OjaDeck sends the customer a WhatsApp confirmation receipt, attempts to attach a generated receipt image, and sends the merchant a paid-order notification.

Wallet and payout handling:

- Paid orders create one `order_paid` ledger credit for the seller.
- Duplicate webhooks do not duplicate credits because ledger references are unique per order.
- Payout requests are created as `pending_confirmation` before money moves.
- Confirmed payouts create negative ledger entries for both the requested payout amount and the estimated Nomba transfer fee before calling Nomba Transfers.
- Successful or processing transfer responses keep funds reserved.
- Failed transfer calls create positive reversal entries and mark the payout failed.
- `payout_success` webhooks mark processing payouts successful and adjust the fee ledger if Nomba reports a different charged amount.
- The dashboard shows both available balance and max withdrawal amount so merchants account for transfer fees before submitting a payout.
- Merchants can verify bank details through Nomba bank lookup before saving a payout account.

## AI Safety and Catalogue Guardrails

The AI is never trusted as the payment source of truth.

- The model receives only in-stock catalogue items and merchant training fields.
- The prompt instructs the model not to invent products or payment links.
- Payment links are always generated server-side after validation.
- AI order tags are parsed server-side and cleaned from customer-visible replies.
- Product names are normalized and matched against the seller catalogue.
- Prices and totals are recomputed from database product prices.
- Explicit customer quantities in the latest message override model quantity mistakes.
- Unknown or out-of-stock items do not produce checkout links.
- Old payment links are stripped from conversation history before being sent back to AI models.
- OpenRouter fallback replies are sanitized to remove heavy Markdown, leaked reasoning, stale payment links, and internal tags.

## WhatsApp Session Handling

- WhatsApp sessions are isolated per seller.
- Sessions are restored on server restart when the seller is still marked as connected.
- Group messages, status broadcasts, and old replayed messages are ignored.
- Customer contact data is derived from `msg.getContact().number` when available, with a fallback to the WhatsApp message ID.
- Escalations notify the merchant's configured personal WhatsApp number.
- Escalation notifications include a customer contact card when WhatsApp exposes it.

## Upload Handling

- Product image uploads are authenticated and seller-scoped.
- Uploads are accepted only for products owned by the authenticated seller.
- Allowed image types: JPG, PNG, WEBP.
- Maximum image size: 3 MB.
- Image URLs are stored on product records.
- Uploaded files are runtime state under `uploads/` and are not committed to git.

## Reliability and Failure Handling

- Startup migrations add missing columns without manual database migration commands.
- Checkout link generation failures mark the local order as `failed`.
- Starting a fresh order while a payment is pending cancels older pending orders in the same conversation.
- Duplicate paid webhooks are ignored.
- Amount or currency mismatches leave orders pending and log a warning.
- Duplicate ledger credits are prevented by unique references.
- Failed payout transfers, including reserved transfer fees, are reversed back into available balance.
- If product image sending fails, the text response still sends.
- If generated receipt image sending fails, the text receipt still sends.
- If seller notification fails, the payment/order state remains correct and the failure is logged.

## Sensitive Data

The repository must not contain real credentials.

Secrets are expected in server environment variables:

```text
JWT_SECRET
GEMINI_API_KEY
OPENROUTER_API_KEY
NOMBA_*_CLIENT_ID
NOMBA_*_PRIVATE_KEY
NOMBA_*_PARENT_ACCOUNT_ID
NOMBA_*_SUB_ACCOUNT_ID
NOMBA_WEBHOOK_SECRET
NOMBA_TRANSFER_FEE_NAIRA
```

Runtime state is ignored by git:

```text
data/
uploads/
.wwebjs_auth/
.wwebjs_cache/
```

## Current Known Tradeoffs

- SQLite is sufficient for the hackathon MVP and single-server deployment; production scale would move to a managed database.
- Product images are local to the VPS; production scale would move uploads to object storage.
- WhatsApp automation depends on `whatsapp-web.js`; production usage should review WhatsApp platform policy and operational limits.
- Signed Nomba webhook confirmation is accepted when transaction lookup fails after amount/reference/currency validation, because webhook delivery is the authoritative real-time payment signal in the current hackathon environment.
