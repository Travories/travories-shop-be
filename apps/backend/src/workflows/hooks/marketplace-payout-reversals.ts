import { cancelOrderWorkflow } from "@medusajs/medusa/core-flows"

import { applyPayoutReversalWorkflow } from "../marketplace/apply-payout-reversal"

cancelOrderWorkflow.hooks.orderCanceled(async ({ order }, { container }) => {
  await applyPayoutReversalWorkflow(container).run({
    input: {
      order_id: order.id,
      source_id: order.id,
      type: "cancellation",
    },
  })
})
