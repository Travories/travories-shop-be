import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"

export type ValidateVendorFulfillmentStepInput = {
  seller_id: string
  order_id: string
  items: { id: string; quantity: number }[]
}

const toNumber = (value: unknown) => {
  if (value && typeof value === "object" && "numeric" in value) {
    return Number((value as { numeric: unknown }).numeric)
  }
  return Number(value ?? 0)
}

/**
 * Ensures a seller can fulfill only its own remaining order quantities.
 */
export const validateVendorFulfillmentStep = createStep(
  "validate-vendor-fulfillment",
  async (input: ValidateVendorFulfillmentStepInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const [{ data: sellers }, { data: orders }] = await Promise.all([
      query.graph({
        entity: "seller",
        fields: ["products.id"],
        filters: { id: input.seller_id },
      }),
      query.graph({
        entity: "order",
        fields: [
          "id",
          "status",
          "total",
          "item_subtotal",
          "items.id",
          "items.product_id",
          "items.quantity",
          "items.unit_price",
          "items.subtotal",
          "items.total",
          "items.detail.fulfilled_quantity",
        ],
        filters: { id: input.order_id },
      }),
    ])
    const productIds = new Set(
      ((sellers[0] as { products?: { id: string }[] } | undefined)?.products ?? [])
        .map((product) => product.id)
    )
    const order = orders[0] as {
      status?: string
      items?: {
        id: string
        product_id?: string | null
        quantity?: unknown
        detail?: { fulfilled_quantity?: unknown } | null
      }[]
    } | undefined

    if (!order || order.status === "canceled") {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Order not found")
    }

    const itemById = new Map((order.items ?? []).map((item) => [item.id, item]))
    for (const requested of input.items) {
      const item = itemById.get(requested.id)
      const remaining = item
        ? toNumber(item.quantity) - toNumber(item.detail?.fulfilled_quantity)
        : 0

      if (
        !item?.product_id ||
        !productIds.has(item.product_id) ||
        requested.quantity <= 0 ||
        requested.quantity > remaining
      ) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          "You can only fulfill remaining quantities for your own products"
        )
      }
    }

    return new StepResponse(true)
  }
)
