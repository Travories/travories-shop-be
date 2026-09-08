import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"

import { createOrderPayoutsWorkflow } from "../workflows/marketplace/create-order-payouts"

/**
 * When an order is placed, write the per-seller payout ledger. The workflow is
 * idempotent, so a re-emitted event will not double-pay.
 */
export default async function orderPlacedPayoutsHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  await createOrderPayoutsWorkflow(container).run({
    input: { order_id: event.data.id },
  })
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
