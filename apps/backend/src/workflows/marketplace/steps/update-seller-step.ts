import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

import { MARKETPLACE_MODULE } from "../../../modules/marketplace"
import MarketplaceModuleService from "../../../modules/marketplace/service"

export type UpdateSellerStepInput = {
  id: string
  status?: "pending" | "active" | "suspended" | "rejected"
  commission_rate?: number | null
}

/**
 * Super-admin edits to a seller (approval status, commission). Captures the
 * previous values so a failed workflow restores them.
 */
export const updateSellerStep = createStep(
  "update-seller",
  async (input: UpdateSellerStepInput, { container }) => {
    const service =
      container.resolve<MarketplaceModuleService>(MARKETPLACE_MODULE)

    const previous = await service.retrieveSeller(input.id, {
      select: ["id", "status", "commission_rate"],
    })

    const seller = await service.updateSellers(input)

    return new StepResponse(seller, {
      id: previous.id,
      status: previous.status,
      commission_rate: previous.commission_rate,
    })
  },
  async (prev, { container }) => {
    if (!prev) {
      return
    }
    const service =
      container.resolve<MarketplaceModuleService>(MARKETPLACE_MODULE)
    await service.updateSellers({
      id: prev.id,
      status: prev.status,
      commission_rate: prev.commission_rate,
    })
  }
)
