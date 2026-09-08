import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"

import {
  updatePayoutStep,
  UpdatePayoutStepInput,
} from "./steps/update-payout-step"

/**
 * Super-admin update of a payout (mark paid, record settlement reference).
 */
export const updatePayoutWorkflow = createWorkflow(
  "update-payout",
  function (input: UpdatePayoutStepInput) {
    const payout = updatePayoutStep(input)

    return new WorkflowResponse(payout)
  }
)
