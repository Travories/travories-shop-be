import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  createOrderFulfillmentWorkflow,
  createOrderShipmentWorkflow,
} from "@medusajs/medusa/core-flows"

import { validateVendorFulfillmentStep } from "./steps/validate-vendor-fulfillment-step"

export type CreateVendorFulfillmentWorkflowInput = {
  seller_id: string
  order_id: string
  items: { id: string; quantity: number }[]
  labels?: {
    tracking_number: string
    tracking_url: string
    label_url: string
  }[]
  no_notification?: boolean
}

export const createVendorFulfillmentWorkflow = createWorkflow(
  "create-vendor-fulfillment",
  function (input: CreateVendorFulfillmentWorkflowInput) {
    validateVendorFulfillmentStep(input)

    const fulfillmentInput = transform({ input }, ({ input }) => ({
      order_id: input.order_id,
      items: input.items,
      no_notification: input.no_notification,
      labels: input.labels,
      metadata: { seller_id: input.seller_id },
    }))
    const fulfillment = createOrderFulfillmentWorkflow.runAsStep({
      input: fulfillmentInput,
    })
    const shipmentInput = transform(
      { input, fulfillment },
      ({ input, fulfillment }) => ({
        order_id: input.order_id,
        fulfillment_id: fulfillment.id,
        items: input.items,
        no_notification: input.no_notification,
      })
    )

    createOrderShipmentWorkflow.runAsStep({ input: shipmentInput })

    return new WorkflowResponse(fulfillment)
  }
)
