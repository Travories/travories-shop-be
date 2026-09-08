import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"

import {
  updateSellerStep,
  UpdateSellerStepInput,
} from "./steps/update-seller-step"

/**
 * Super-admin update of a seller (approval status and/or commission rate).
 */
export const updateSellerWorkflow = createWorkflow(
  "update-seller",
  function (input: UpdateSellerStepInput) {
    const seller = updateSellerStep(input)

    return new WorkflowResponse(seller)
  }
)
