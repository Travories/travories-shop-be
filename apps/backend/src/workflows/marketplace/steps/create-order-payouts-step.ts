import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import {
  DEFAULT_COMMISSION_RATE,
  MARKETPLACE_MODULE,
} from "../../../modules/marketplace"
import MarketplaceModuleService from "../../../modules/marketplace/service"

export type CreateOrderPayoutsStepInput = {
  order_id: string
}

type OrderItem = {
  subtotal?: unknown
  unit_price?: unknown
  quantity?: unknown
  product_id?: string | null
}

// Money fields come back from query.graph as Medusa BigNumber instances, whose
// `numeric` getter holds the JS number. Number(bigNumber) alone yields NaN.
const toNumber = (value: unknown): number => {
  if (value == null) {
    return 0
  }
  if (typeof value === "number") {
    return value
  }
  if (typeof value === "object" && "numeric" in value) {
    const n = Number((value as { numeric: unknown }).numeric)
    return Number.isFinite(n) ? n : 0
  }
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

type ProductSeller = {
  id: string
  seller?: { id?: string; commission_rate?: number | null } | null
}

/**
 * Builds the per-seller settlement ledger for an order: groups line items by
 * the seller that owns each product, applies the seller's commission (or the
 * platform default), and writes one pending Payout per seller. Idempotent -
 * sellers that already have a payout for this order are skipped.
 */
export const createOrderPayoutsStep = createStep(
  "create-order-payouts",
  async (input: CreateOrderPayoutsStepInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const service =
      container.resolve<MarketplaceModuleService>(MARKETPLACE_MODULE)

    // Order item totals (subtotal) and even `quantity` are only populated when
    // the order's totals context is selected too - hence the order-level total
    // fields below. Without them, query.graph returns those item fields as
    // undefined.
    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "currency_code",
        "total",
        "item_subtotal",
        "items.subtotal",
        "items.total",
        "items.unit_price",
        "items.quantity",
        "items.product_id",
      ],
      filters: { id: input.order_id },
    })

    const order = orders[0] as
      | { currency_code?: string; items?: OrderItem[] }
      | undefined

    const items = order?.items ?? []
    const productIds = [
      ...new Set(
        items.map((i) => i.product_id).filter((id): id is string => !!id)
      ),
    ]

    if (!productIds.length) {
      return new StepResponse([], [])
    }

    const { data: products } = await query.graph({
      entity: "product",
      fields: ["id", "seller.id", "seller.commission_rate"],
      filters: { id: productIds },
    })

    const sellerByProduct = new Map<
      string,
      { id: string; commission_rate?: number | null }
    >()
    for (const p of products as ProductSeller[]) {
      if (p.seller?.id) {
        sellerByProduct.set(p.id, {
          id: p.seller.id,
          commission_rate: p.seller.commission_rate,
        })
      }
    }

    // Sum each seller's merchandise subtotal.
    const totals = new Map<
      string,
      { subtotal: number; commission_rate?: number | null }
    >()
    for (const item of items) {
      if (!item.product_id) {
        continue
      }
      const seller = sellerByProduct.get(item.product_id)
      if (!seller) {
        continue
      }
      const current = totals.get(seller.id) ?? {
        subtotal: 0,
        commission_rate: seller.commission_rate,
      }
      // Prefer the computed line subtotal (accounts for line adjustments);
      // fall back to unit_price * quantity if it is unavailable.
      const lineSubtotal =
        toNumber(item.subtotal) ||
        toNumber(item.unit_price) * toNumber(item.quantity)
      current.subtotal += lineSubtotal
      totals.set(seller.id, current)
    }

    if (!totals.size) {
      return new StepResponse([], [])
    }

    // Skip sellers that already have a payout for this order (idempotency).
    const existing = await service.listPayouts({ order_id: input.order_id })
    const alreadyPaid = new Set(existing.map((p) => p.seller_id))

    const toCreate = [...totals.entries()]
      .filter(([sellerId]) => !alreadyPaid.has(sellerId))
      .map(([sellerId, { subtotal, commission_rate }]) => {
        const commission = commission_rate ?? DEFAULT_COMMISSION_RATE
        const amount =
          Math.round(subtotal * (100 - commission)) / 100
        return {
          order_id: input.order_id,
          seller_id: sellerId,
          amount,
          currency_code: order?.currency_code ?? "npr",
          status: "pending" as const,
        }
      })

    if (!toCreate.length) {
      return new StepResponse([], [])
    }

    const created = await service.createPayouts(toCreate)

    return new StepResponse(
      created,
      created.map((p) => p.id)
    )
  },
  async (ids, { container }) => {
    if (!ids?.length) {
      return
    }
    const service =
      container.resolve<MarketplaceModuleService>(MARKETPLACE_MODULE)
    await service.deletePayouts(ids)
  }
)
