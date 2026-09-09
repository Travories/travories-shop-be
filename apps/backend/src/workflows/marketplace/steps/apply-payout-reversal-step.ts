import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { MARKETPLACE_MODULE } from "../../../modules/marketplace"
import MarketplaceModuleService from "../../../modules/marketplace/service"

export type ApplyPayoutReversalStepInput = {
  order_id: string
  source_id: string
  type: "cancellation" | "refund"
  amount?: number
}

const toNumber = (value: unknown) => {
  if (value && typeof value === "object" && "numeric" in value) {
    return Number((value as { numeric: unknown }).numeric)
  }
  return Number(value ?? 0)
}

type PayoutSnapshot = {
  id: string
  status: "pending" | "paid" | "partially_reversed" | "reversed"
  reversed_amount: number
}

export const calculatePayoutReversalAmount = ({
  original,
  reversed,
  type,
  refundAmount = 0,
  orderTotal,
}: {
  original: number
  reversed: number
  type: "cancellation" | "refund"
  refundAmount?: number
  orderTotal: number
}) => {
  const remaining = Math.max(0, original - reversed)

  if (!remaining || (type === "refund" && orderTotal <= 0)) {
    return 0
  }

  const ratio = type === "cancellation"
    ? 1
    : Math.min(1, Math.max(0, refundAmount / orderTotal))

  return Math.min(
    remaining,
    Math.round(original * ratio * 100) / 100
  )
}

export const applyPayoutReversalStep = createStep(
  "apply-payout-reversal",
  async (input: ApplyPayoutReversalStepInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const service =
      container.resolve<MarketplaceModuleService>(MARKETPLACE_MODULE)
    const payouts = await service.listPayouts({ order_id: input.order_id })

    if (!payouts.length) {
      return new StepResponse([], { adjustments: [], snapshots: [] })
    }

    const existing = await service.listPayoutAdjustments({
      source_id: input.source_id,
      type: input.type,
    })
    const processedPayoutIds = new Set(existing.map((row) => row.payout_id))
    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "total"],
      filters: { id: input.order_id },
    })
    const orderTotal = toNumber((orders[0] as { total?: unknown } | undefined)?.total)
    const adjustments: { payout_id: string; amount: number }[] = []
    const snapshots: PayoutSnapshot[] = []

    for (const payout of payouts) {
      if (processedPayoutIds.has(payout.id)) {
        continue
      }

      const original = toNumber(payout.amount)
      const reversed = toNumber(payout.reversed_amount)
      const adjustmentAmount = calculatePayoutReversalAmount({
        original,
        reversed,
        type: input.type,
        refundAmount: input.amount,
        orderTotal,
      })

      if (!adjustmentAmount) {
        continue
      }

      snapshots.push({
        id: payout.id,
        status: payout.status,
        reversed_amount: reversed,
      })
      adjustments.push({ payout_id: payout.id, amount: adjustmentAmount })
    }

    const created = adjustments.length
      ? await service.createPayoutAdjustments(adjustments.map((adjustment) => ({
        ...adjustment,
        source_id: input.source_id,
        type: input.type,
      })))
      : []

    if (adjustments.length) {
      await service.updatePayouts(adjustments.map((adjustment) => {
        const payout = payouts.find((candidate) => candidate.id === adjustment.payout_id)!
        const nextReversed =
          toNumber(payout.reversed_amount) + adjustment.amount
        return {
          id: payout.id,
          reversed_amount: nextReversed,
          status: nextReversed >= toNumber(payout.amount)
            ? "reversed" as const
            : "partially_reversed" as const,
        }
      }))
    }

    return new StepResponse(created, {
      adjustments: created.map((row) => row.id),
      snapshots,
    })
  },
  async (state, { container }) => {
    if (!state) {
      return
    }
    const service =
      container.resolve<MarketplaceModuleService>(MARKETPLACE_MODULE)

    if (state.adjustments.length) {
      await service.deletePayoutAdjustments(state.adjustments)
    }
    if (state.snapshots.length) {
      await service.updatePayouts(state.snapshots)
    }
  }
)
