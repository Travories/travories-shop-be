import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

import { MARKETPLACE_MODULE } from "../../../modules/marketplace"
import MarketplaceModuleService from "../../../modules/marketplace/service"

export type CreateSellerStepInput = {
  seller: {
    name: string
    handle: string
    email: string
    phone?: string
    description?: string
  }
  member: {
    name?: string | null
    email: string
  }
}

/**
 * Creates the Seller and its first Member in one step. The Member is the login;
 * the workflow then binds it to the auth identity. Rolls back both on failure.
 */
export const createSellerStep = createStep(
  "create-seller",
  async (input: CreateSellerStepInput, { container }) => {
    const service =
      container.resolve<MarketplaceModuleService>(MARKETPLACE_MODULE)

    const seller = await service.createSellers(input.seller)
    const member = await service.createMembers({
      ...input.member,
      seller_id: seller.id,
    })

    return new StepResponse(
      { seller, member },
      { sellerId: seller.id, memberId: member.id }
    )
  },
  async (ids, { container }) => {
    if (!ids) {
      return
    }
    const service =
      container.resolve<MarketplaceModuleService>(MARKETPLACE_MODULE)
    await service.deleteMembers(ids.memberId)
    await service.deleteSellers(ids.sellerId)
  }
)
