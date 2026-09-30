# Razorpay payments and recovery

## Required deployment configuration

Deploy the Convex schema/functions and the frontend together. The updated checkout
uses a private status token; old checkout tabs should be reopened with the updated
site. No new server or queue service is required.

1. In the production Convex environment, configure `RAZORPAY_KEY_ID` and
   `RAZORPAY_SECRET` from the same Razorpay merchant account and mode. The frontend
   `VITE_RAZORPAY_KEY_ID` must match that account and mode.
2. Generate a strong, separate webhook secret. Store it in Convex as
   `RAZORPAY_WEBHOOK_SECRET`. Never expose it through a `VITE_` variable.
3. In Razorpay, add this webhook URL using the deployment's **HTTP Actions URL**:
   `https://<deployment>.convex.site/razorpay/webhook`.
   Do not use the `.convex.cloud` client API URL.
4. Subscribe to `payment.authorized`, `payment.captured`, `payment.failed`,
   `refund.created`, `refund.processed`, and `refund.failed`. `order.paid` is also
   supported and safe to enable. Configure Razorpay's delivery alert email.
5. Set Payment Capture to **Manual Capture** with the appropriate timeout. The
   backend calls the Capture API automatically when a valid seat hold is available.
   Razorpay's minimum capture timeout is 12 minutes; the application's default
   seat hold is 10 minutes. These are separate clocks. The backend enforces the
   seat deadline independently of the gateway timeout.
6. Direct Settlement accounts and bank-transfer payments may auto-capture despite
   this setting. Captured payments without an eligible booking are refunded by the
   same processor. If automatic capture is kept for other methods, this fallback
   also applies.

Configure test and live webhooks separately. Code changes do not configure the
Razorpay dashboard or deploy the application.

For secret rotation, temporarily retain the previous secret in
`RAZORPAY_WEBHOOK_PREVIOUS_SECRET` while Razorpay retries older deliveries. Remove
it after the old delivery/replay window has been accounted for.

## Booking rules

- A successful Checkout signature authenticates the browser response. A ticket is
  issued only after a server request verifies the captured payment, order, amount,
  and INR currency.
- The capture decision and exclusive seat ownership are recorded in one Convex
  mutation. `capturing` holds survive the ordinary seat expiry timer.
- A capture request timeout is uncertain. Recovery fetches the provider's current
  state before deciding whether another capture is appropriate.
- A hold that expires before capture starts cannot be revived by a late payment.
  Authorized funds are left uncaptured for Razorpay to reverse under the merchant
  timeout. Captured funds are refunded. Do not promise an immediate bank credit.
- The original seat selection is retained in `checkoutItems` after live locks are
  removed. Booking, reservation, restoration, and finalisation share seat checks.
- Cancelling an online booking queues a **full refund**, including the amount
  charged as the payment fee. Such a cancelled booking cannot be restored; create
  a new booking. Manual bookings have no Razorpay refund.
- Shows with checkout history cannot be deleted. Disable them to retain the
  records needed for reconciliation. Disabling a show prevents new fulfilment;
  cancelling previously confirmed tickets remains an explicit admin action.
- Check-in uses the server's Asia/Kolkata date. Show start-time/late-entry policy
  is unchanged by this payment work.

## Recovery and customer experience

The browser callback, signed webhooks, and scheduled recovery all use the same
processor. A per-checkout lease avoids competing workers; database decisions are
idempotent by checkout and payment ID. Events can arrive twice or out of order.
Webhook payloads trigger a fresh provider lookup rather than overwriting state
from an old event snapshot.

The webhook acknowledges only after the event is stored and processing scheduled.
The minute cron retries due checkouts in bounded batches, including unresolved
captures and refunds. Unresolved financial operations continue to be checked;
ordinary expired/finished sessions are periodically reconciled for four days.
Later signed webhooks or explicit refreshes can trigger reconciliation again.

Refund requests use a stable `X-Refund-Idempotency` key and identical request body
on retries. The refund ID/status is stored. A failed provider refund is flagged
for an administrator; recovery never creates a different refund request merely
because a previous response was lost.

Checkout displays a private status link with a bearer token in the URL fragment.
It can be reopened after leaving the site, even without the original tab's
session storage. Keep that link private. Ticket confirmation is driven by live
backend state. After payment, the same secret opens the private ticket link at
`/confirmation/BOOKING_CODE#token=SECRET`. Only SHA-256 hashes of access secrets
are stored in checkout sessions and bookings. Booking code alone cannot retrieve
the ticket, QR, PDF or JPG. Customers can copy the private link and download their
ticket; the confirmation page still attempts automatic downloads.

Guest booking does not collect or store name, email or phone, and does not prefill
those details into Razorpay. Razorpay may collect information in its own payment
interface. Admin authentication email addresses remain necessary for staff access.
If the ticket and private link are both lost, staff must review payment evidence;
show and seat selection alone is not proof of ownership.

## Administration and existing data

Super Admins see payment errors and unmatched webhook orders in the Bookings
screen under **Payments needing attention**, with a **Recheck payment** action.
Review failed refunds in Razorpay before manually issuing another refund.

New schema fields are optional for existing checkout records. Recovery adopts
recent unfinished legacy sessions in batches and preserves any surviving seat
holds. Previously deleted selections cannot be reconstructed reliably; a captured
payment without sufficient booking data is refunded. Historical paid/cancelled
records are not automatically queued by the adoption pass. Audit historical
unresolved payments separately using Razorpay references.

When an old confirmed ticket is encountered with only an authorized payment, it
is flagged for review and check-in is blocked until capture is confirmed. Missing
legacy payment IDs also require an operator to match the payment before any
automatic refund or cancellation. Failed or fully refunded primary payments
invalidate the associated ticket.

No tests, build, deployment, dashboard configuration, or live financial operations
were run as part of this implementation.

## References

- [Standard Checkout](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/)
- [Capture settings](https://razorpay.com/docs/payments/payments/capture-settings/)
- [Webhook validation](https://razorpay.com/docs/webhooks/validate-test/)
- [Webhook delivery and retries](https://razorpay.com/docs/webhooks/best-practices/)
- [Idempotent refunds](https://razorpay.com/docs/api/refunds/normal-refunds-idempotent)
