import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import { UpdateProductWorkflowInputDTO } from "@medusajs/framework/types"

import { validateProductOwnershipStep } from "./steps/validate-product-ownership-step"
import { validateSellerActiveStep } from "./steps/validate-seller-active-step"

export type UpdateVendorProductWorkflowInput = {
  seller_id: string
  product_id: string
  update: UpdateProductWorkflowInputDTO
}

/**
 * Updates a product only after confirming it belongs to the acting seller.
 */
export const updateVendorProductWorkflow = createWorkflow(
  "update-vendor-product",
  function (input: UpdateVendorProductWorkflowInput) {
    validateSellerActiveStep({ seller_id: input.seller_id })
    validateProductOwnershipStep({
      seller_id: input.seller_id,
      product_id: input.product_id,
    })

    const updated = updateProductsWorkflow.runAsStep({
      input: {
        selector: { id: input.product_id },
        update: input.update,
      },
    })

    return new WorkflowResponse(updated)
  }
)
