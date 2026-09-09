import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"

import {
  applyPayoutReversalStep,
  ApplyPayoutReversalStepInput,
} from "./steps/apply-payout-reversal-step"

export const applyPayoutReversalWorkflow = createWorkflow(
  "apply-payout-reversal",
  function (input: ApplyPayoutReversalStepInput) {
    return new WorkflowResponse(applyPayoutReversalStep(input))
  }
)
