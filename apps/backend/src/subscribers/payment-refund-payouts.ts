import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { applyPayoutReversalWorkflow } from "../workflows/marketplace/apply-payout-reversal"

const toNumber = (value: unknown) => {
  if (value && typeof value === "object" && "numeric" in value) {
    return Number((value as { numeric: unknown }).numeric)
  }
  return Number(value ?? 0)
}

export default async function paymentRefundPayoutsHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: refunds } = await query.graph({
    entity: "refund",
    fields: ["id", "amount", "payment.payment_collection_id"],
    filters: { id: event.data.id },
  })
  const refund = refunds[0] as {
    id: string
    amount: unknown
    payment?: { payment_collection_id?: string | null } | null
  } | undefined

  if (!refund?.payment?.payment_collection_id) {
    return
  }

  const { data: links } = await query.graph({
    entity: "order_payment_collection",
    fields: ["order.id"],
    filters: { payment_collection_id: refund.payment.payment_collection_id },
  })
  const orderId = (links[0] as { order?: { id?: string } } | undefined)?.order?.id

  if (orderId) {
    await applyPayoutReversalWorkflow(container).run({
      input: {
        order_id: orderId,
        source_id: refund.id,
        type: "refund",
        amount: toNumber(refund.amount),
      },
    })
  }
}

export const config: SubscriberConfig = {
  event: "payment.refund.created",
}
