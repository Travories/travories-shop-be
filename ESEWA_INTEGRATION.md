# eSewa Integration Notes

## What changed

This repo now has a first-pass eSewa `ePay v2` web checkout integration for the Medusa storefront and backend.

It does **not** hardcode your credentials in source. Instead, it expects them in `apps/backend/.env`.

The current integration covers:

- showing eSewa as a checkout payment option
- creating a Medusa payment session for eSewa
- generating the signed eSewa form payload on the backend
- redirecting the customer from the storefront to eSewa
- returning from eSewa to the storefront
- verifying the transaction with eSewa's status-check API during Medusa payment authorization

It does **not** yet cover:

- native eSewa mobile SDK flows
- intent-based payment flow
- refund automation inside Medusa admin
- official logo asset bundling

## Where to look

### Backend

- [apps/backend/medusa-config.ts](/Users/madhukunwar/Desktop/medusashop/apps/backend/medusa-config.ts)
  Registers the custom eSewa payment provider when the required env vars exist.

- [apps/backend/src/modules/payment-nepal/providers/esewa.ts](/Users/madhukunwar/Desktop/medusashop/apps/backend/src/modules/payment-nepal/providers/esewa.ts)
  Main custom Medusa payment provider.

- [apps/backend/src/modules/payment-nepal/lib/amount.ts](/Users/madhukunwar/Desktop/medusashop/apps/backend/src/modules/payment-nepal/lib/amount.ts)
  NPR amount helpers already present in the repo and reused by the provider.

- [.env.example](./.env.example) — the single root env file (backend + storefront)
  New env vars for eSewa web checkout and placeholders for future SDK/intent work.

- [apps/backend/src/migration-scripts/initial-data-seed.ts](/Users/madhukunwar/Desktop/medusashop/apps/backend/src/migration-scripts/initial-data-seed.ts)
  Adds `pp_esewa_esewa` to the Nepal region during seed if eSewa is configured.

### Storefront

- [apps/storefront/src/lib/constants.tsx](/Users/madhukunwar/Desktop/medusashop/apps/storefront/src/lib/constants.tsx)
  Adds the `pp_esewa_esewa` label and `isEsewa` helper.

- [apps/storefront/src/modules/checkout/components/payment/index.tsx](/Users/madhukunwar/Desktop/medusashop/apps/storefront/src/modules/checkout/components/payment/index.tsx)
  Initializes an eSewa payment session when the user selects it.

- [apps/storefront/src/modules/checkout/components/payment-button/index.tsx](/Users/madhukunwar/Desktop/medusashop/apps/storefront/src/modules/checkout/components/payment-button/index.tsx)
  Posts the signed hidden form to eSewa when the user clicks the review-step button.

- [apps/storefront/src/app/api/payment-return/esewa/route.ts](/Users/madhukunwar/Desktop/medusashop/apps/storefront/src/app/api/payment-return/esewa/route.ts)
  Handles the customer returning from eSewa and calls cart completion.

- [apps/storefront/src/lib/data/cart.ts](/Users/madhukunwar/Desktop/medusashop/apps/storefront/src/lib/data/cart.ts)
  Now fetches `payment_collection.payment_sessions` so checkout can access the generated eSewa payload.

- [apps/storefront/src/modules/order/components/payment-details/index.tsx](/Users/madhukunwar/Desktop/medusashop/apps/storefront/src/modules/order/components/payment-details/index.tsx)
  Made slightly safer so new providers do not crash order details.

## How it works

1. Customer reaches checkout and chooses `eSewa`.
2. Storefront calls Medusa `initiatePaymentSession`.
3. The custom backend provider generates:
   - `transaction_uuid`
   - signed `signature`
   - `success_url`
   - `failure_url`
   - eSewa form fields
4. Those safe, non-secret form fields are stored in Medusa payment-session `data`.
5. On the review step, the storefront submits a hidden HTML form to eSewa's hosted payment page.
6. eSewa redirects the customer back to `/api/payment-return/esewa`.
7. The storefront route calls `placeOrder(cartId)`.
8. During Medusa authorization, the backend provider calls eSewa's official status-check API.
9. If eSewa reports `COMPLETE` and the amount/transaction match, the payment is treated as captured.

## Setup

Create or update `apps/backend/.env` with the eSewa values you shared in chat.

Minimum required variables:

```env
ESEWA_PRODUCT_CODE=EPAYTEST
ESEWA_SECRET_KEY=...
ESEWA_STOREFRONT_BASE_URL=http://localhost:8000
ESEWA_FORM_URL=https://rc-epay.esewa.com.np/api/epay/main/v2/form
ESEWA_STATUS_URL=https://rc.esewa.com.np/api/epay/transaction/status/
ESEWA_SUCCESS_PATH=/api/payment-return/esewa
ESEWA_FAILURE_PATH=/api/payment-return/esewa
ESEWA_TAX_AMOUNT=0
ESEWA_PRODUCT_SERVICE_CHARGE=0
ESEWA_PRODUCT_DELIVERY_CHARGE=0
```

Optional placeholders are also in the template for:

- `ESEWA_CLIENT_ID`
- `ESEWA_CLIENT_SECRET`
- `ESEWA_INTENT_PRODUCT_CODE`
- `ESEWA_INTENT_CLIENT_SECRET`

## How to test

1. Start backend and storefront.
2. Make sure the Nepal region exposes `pp_esewa_esewa`.
3. Add a product to cart in the NPR region.
4. Go through checkout and select `eSewa`.
5. On review, click `Pay with eSewa`.
6. Log into the eSewa UAT page with the test account you provided.
7. Use the UAT token flow from eSewa.
8. After return, verify the order is created and payment appears as completed/captured.

## Verification status

What I verified locally:

- backend lint passes for the new provider code

What is still blocked locally:

- storefront lint already fails on pre-existing unrelated files
- I did not run a live end-to-end payment because that depends on your local env values and running backend/storefront services

## Official references used

- eSewa ePay v2 doc:
  https://developer.esewa.com.np/pages/Epay-V2

- eSewa ePay doc:
  https://developer.esewa.com.np/pages/Epay

These were checked on September 1, 2026 while wiring the current field names, UAT form URL, Base64 success payload behavior, and status-check endpoint.
