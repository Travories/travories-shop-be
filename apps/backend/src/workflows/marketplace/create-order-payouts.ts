import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"

import {
  createOrderPayoutsStep,
  CreateOrderPayoutsStepInput,
} from "./steps/create-order-payouts-step"

/**
 * Creates the per-seller payout ledger for a placed order. Triggered by the
 * order.placed subscriber.
 */
export const createOrderPayoutsWorkflow = createWorkflow(
  "create-order-payouts",
  function (input: CreateOrderPayoutsStepInput) {
    const payouts = createOrderPayoutsStep(input)

    return new WorkflowResponse(payouts)
  }
)
