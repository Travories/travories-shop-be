import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { setAuthAppMetadataStep } from "@medusajs/medusa/core-flows"

import { createSellerStep } from "./steps/create-seller-step"

export type CreateSellerWorkflowInput = {
  // The auth identity created by /auth/seller/emailpass/register, not yet
  // bound to any actor.
  auth_identity_id: string
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
 * Onboards a vendor: creates the Seller + first Member, then binds the auth
 * identity to that Member as a "seller" actor so future logins resolve to it.
 */
export const createSellerWorkflow = createWorkflow(
  "create-seller",
  function (input: CreateSellerWorkflowInput) {
    const { seller, member } = createSellerStep(input)

    setAuthAppMetadataStep({
      authIdentityId: input.auth_identity_id,
      actorType: "seller",
      value: member.id,
    })

    return new WorkflowResponse({ seller, member })
  }
)
