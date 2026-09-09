import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { markOrderFulfillmentAsDeliveredWorkflow } from "@medusajs/medusa/core-flows"

import {
  validateVendorDeliveryStep,
  ValidateVendorDeliveryStepInput,
} from "./steps/validate-vendor-delivery-step"

export const markVendorFulfillmentDeliveredWorkflow = createWorkflow(
  "mark-vendor-fulfillment-delivered",
  function (input: ValidateVendorDeliveryStepInput) {
    validateVendorDeliveryStep(input)
    const coreInput = transform({ input }, ({ input }) => ({
      orderId: input.order_id,
      fulfillmentId: input.fulfillment_id,
    }))

    markOrderFulfillmentAsDeliveredWorkflow.runAsStep({ input: coreInput })

    return new WorkflowResponse({ id: input.fulfillment_id })
  }
)
