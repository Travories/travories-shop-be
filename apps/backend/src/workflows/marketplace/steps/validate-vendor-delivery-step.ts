import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"

export type ValidateVendorDeliveryStepInput = {
  seller_id: string
  order_id: string
  fulfillment_id: string
}

export const validateVendorDeliveryStep = createStep(
  "validate-vendor-delivery",
  async (input: ValidateVendorDeliveryStepInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "fulfillments.id", "fulfillments.metadata"],
      filters: { id: input.order_id },
    })
    const order = orders[0] as {
      fulfillments?: {
        id: string
        metadata?: Record<string, unknown> | null
      }[]
    } | undefined
    const fulfillment = order?.fulfillments?.find(
      (candidate) => candidate.id === input.fulfillment_id
    )

    if (fulfillment?.metadata?.seller_id !== input.seller_id) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "This fulfillment does not belong to your store"
      )
    }

    return new StepResponse(true)
  }
)
