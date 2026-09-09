import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"

import { MARKETPLACE_MODULE } from "../../../modules/marketplace"
import MarketplaceModuleService from "../../../modules/marketplace/service"

export type UpdatePayoutStepInput = {
  id: string
  status?: "pending" | "paid"
  reference?: string | null
}

/**
 * Super-admin settlement update: marks a payout paid and records the transfer
 * reference. Restores the prior values on rollback.
 */
export const updatePayoutStep = createStep(
  "update-payout",
  async (input: UpdatePayoutStepInput, { container }) => {
    const service =
      container.resolve<MarketplaceModuleService>(MARKETPLACE_MODULE)

    const previous = await service.retrievePayout(input.id, {
      select: ["id", "status", "reference", "reversed_amount"],
    })

    if (input.status && Number(previous.reversed_amount) > 0) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "A reversed payout cannot be marked pending or paid"
      )
    }

    const payout = await service.updatePayouts(input)

    return new StepResponse(payout, {
      id: previous.id,
      status: previous.status,
      reference: previous.reference,
    })
  },
  async (prev, { container }) => {
    if (!prev) {
      return
    }
    const service =
      container.resolve<MarketplaceModuleService>(MARKETPLACE_MODULE)
    await service.updatePayouts({
      id: prev.id,
      status: prev.status,
      reference: prev.reference,
    })
  }
)
