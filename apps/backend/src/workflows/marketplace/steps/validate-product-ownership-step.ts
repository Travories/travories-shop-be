import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"

export type ValidateProductOwnershipStepInput = {
  seller_id: string
  product_id: string
}

/**
 * Guards a vendor mutation: the product must belong to the acting seller.
 * Read-only, so no compensation.
 */
export const validateProductOwnershipStep = createStep(
  "validate-product-ownership",
  async (input: ValidateProductOwnershipStepInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)

    const { data } = await query.graph({
      entity: "product",
      fields: ["id", "seller.id"],
      filters: { id: input.product_id },
    })

    const owningSellerId = (
      data[0] as { seller?: { id?: string } } | undefined
    )?.seller?.id

    if (!owningSellerId || owningSellerId !== input.seller_id) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "This product does not belong to your store"
      )
    }

    return new StepResponse(true)
  }
)
