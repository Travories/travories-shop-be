import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { ProductStatus } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"

export type ReviewVendorProductWorkflowInput = {
  product_id: string
  action: "approve" | "reject"
}

/**
 * Admin approval gate for vendor products: approve publishes the product,
 * reject marks it rejected so it stays off the storefront.
 */
export const reviewVendorProductWorkflow = createWorkflow(
  "review-vendor-product",
  function (input: ReviewVendorProductWorkflowInput) {
    const update = transform({ input }, ({ input }) => ({
      status:
        input.action === "approve"
          ? ProductStatus.PUBLISHED
          : ProductStatus.REJECTED,
    }))

    const updated = updateProductsWorkflow.runAsStep({
      input: {
        selector: { id: input.product_id },
        update,
      },
    })

    return new WorkflowResponse(updated)
  }
)
