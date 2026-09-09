import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"

import { listVendorOrdersStep } from "./steps/list-vendor-orders-step"

export type ListVendorOrdersWorkflowInput = {
  seller_id: string
}

export const listVendorOrdersWorkflow = createWorkflow(
  "list-vendor-orders",
  function (input: ListVendorOrdersWorkflowInput) {
    return new WorkflowResponse(listVendorOrdersStep(input))
  }
)
