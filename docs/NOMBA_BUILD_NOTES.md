# Nomba Build Notes

These notes summarize hackathon-specific operational details learned during onboarding and Slack discussions. Do not commit account credentials, private keys, or webhook signing secrets.

## Stable Webhook URL

Nomba requires one clean HTTPS webhook URL. For OjaDeck, use:

```text
https://ojadeck.drimes.dev/api/webhooks/payments
```

Submit that URL with the assigned Nomba sub-account ID in the webhook form. The latest form submission wins, and updates may take roughly 2 hours to apply.

Webhook delivery is real time. If the endpoint is down or unreachable when the event fires, the app may miss that event. For judging, use a stable hosted URL, not a temporary tunnel.

## Webhook Verification

Nomba sends signature headers named:

```text
nomba-signature
nomba-timestamp
```

Verify incoming payloads with HMAC-SHA256 using the configured webhook secret. Store the secret in an environment variable such as:

```env
NOMBA_WEBHOOK_SECRET=
```

Do not hardcode the shared hackathon signing key in source code.

## Account Scoping

Hackathon credentials include a parent account ID and a sub-account ID.

- Authenticate with the parent account ID in the `accountId` header.
- Scope payment actions to the sub-account where required by the endpoint or request body.
- Webhooks must be registered against the correct sub-account ID.

## Sandbox and Production Gotchas

Reported by participants and organizers:

- Sandbox virtual account limits were initially low and later lifted for testing.
- Some sandbox flows appear incomplete or unreliable, including card tokenization and direct debit.
- Production credentials may be enabled for hackathon testing, but production can involve real money. Be deliberate before using live payment rails.
- Sandbox checkout can generate links while card completion/webhook behavior may differ from production.
- Verify-transaction and webhook behavior may depend on whether requests are linked to the correct sub-account.

## Current OjaDeck Priorities

1. Host OjaDeck at `ojadeck.drimes.dev` and confirm `/api/health` is reachable over HTTPS.
2. Submit `https://ojadeck.drimes.dev/api/webhooks/payments` to the Nomba webhook form.
3. Add Nomba auth/token issuance to the backend.
4. Replace the generic payment provider with Nomba checkout order creation.
5. Add webhook signature verification.
6. Re-verify transactions before marking orders paid.
7. Validate paid amount, currency, and order reference against stored orders.
8. Add an architecture/security note for the progress and final submissions.
