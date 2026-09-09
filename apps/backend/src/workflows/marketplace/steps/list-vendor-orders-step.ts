import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import type { ListVendorOrdersWorkflowInput } from "../list-vendor-orders"

type OrderItem = {
  id: string
  title: string
  product_id?: string | null
  quantity?: unknown
  unit_price?: unknown
  subtotal?: unknown
  detail?: { fulfilled_quantity?: unknown } | null
}

const toNumber = (value: unknown) => {
  if (value && typeof value === "object" && "numeric" in value) {
    return Number((value as { numeric: unknown }).numeric)
  }
  return Number(value ?? 0)
}

/**
 * Lists orders containing a seller's products. Mixed-marketplace orders are
 * reduced to this seller's line items so other sellers' catalog and revenue do
 * not leak through the vendor API.
 */
export const listVendorOrdersStep = createStep(
  "list-vendor-orders",
  async (input: ListVendorOrdersWorkflowInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: sellers } = await query.graph({
      entity: "seller",
      fields: ["products.id"],
      filters: { id: input.seller_id },
    })
    const productIds = new Set(
      ((sellers[0] as { products?: { id: string }[] } | undefined)?.products ?? [])
        .map((product) => product.id)
    )

    if (!productIds.size) {
      return new StepResponse([])
    }

    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "status",
        "currency_code",
        "created_at",
        "total",
        "item_subtotal",
        "items.id",
        "items.title",
        "items.product_id",
        "items.quantity",
        "items.unit_price",
        "items.subtotal",
        "items.total",
        "items.detail.fulfilled_quantity",
        "fulfillments.id",
        "fulfillments.shipped_at",
        "fulfillments.delivered_at",
        "fulfillments.metadata",
        "fulfillments.labels.id",
        "fulfillments.labels.tracking_number",
        "fulfillments.labels.tracking_url",
      ],
      pagination: { order: { created_at: "DESC" } },
    })

    const scopedOrders = (orders as unknown as {
      id: string
      display_id: number
      status: string
      currency_code: string
      created_at: string
      items?: OrderItem[]
      fulfillments?: {
        id: string
        shipped_at?: string | null
        delivered_at?: string | null
        metadata?: Record<string, unknown> | null
        labels?: {
          id: string
          tracking_number: string
          tracking_url: string
        }[]
      }[]
    }[]).flatMap((order) => {
      const items = (order.items ?? []).filter(
        (item) => item.product_id && productIds.has(item.product_id)
      )

      if (!items.length) {
        return []
      }

      const sellerFulfillment = order.fulfillments?.find(
        (fulfillment) => fulfillment.metadata?.seller_id === input.seller_id
      )
      const fulfillmentStatus = sellerFulfillment?.delivered_at
        ? "delivered"
        : sellerFulfillment?.shipped_at
          ? "shipped"
          : sellerFulfillment
            ? "fulfilled"
            : "not_fulfilled"

      return [{
        ...order,
        items: items.map((item) => ({
          ...item,
          quantity: toNumber(item.quantity),
          fulfilled_quantity: toNumber(item.detail?.fulfilled_quantity),
        })),
        seller_fulfillment: sellerFulfillment ?? null,
        seller_fulfillment_status: fulfillmentStatus,
        seller_subtotal: items.reduce((sum, item) => {
          const subtotal = toNumber(item.subtotal)
          return sum + (
            subtotal || toNumber(item.unit_price) * toNumber(item.quantity)
          )
        }, 0),
      }]
    })

    return new StepResponse(scopedOrders)
  }
)
