import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"

import { MARKETPLACE_MODULE } from "../../../modules/marketplace"
import MarketplaceModuleService from "../../../modules/marketplace/service"

export type ValidateSellerActiveStepInput = {
  seller_id: string
}

/**
 * Only approved sellers may publish products. Read-only, so no compensation.
 */
export const validateSellerActiveStep = createStep(
  "validate-seller-active",
  async (input: ValidateSellerActiveStepInput, { container }) => {
    const service =
      container.resolve<MarketplaceModuleService>(MARKETPLACE_MODULE)
    const seller = await service.retrieveSeller(input.seller_id)

    if (seller.status !== "active") {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Your seller account must be active before you can create products"
      )
    }

    return new StepResponse(true)
  }
)
