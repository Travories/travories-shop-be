import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"
import {
  createProductsWorkflow,
  createRemoteLinkStep,
} from "@medusajs/medusa/core-flows"
import { CreateProductWorkflowInputDTO } from "@medusajs/framework/types"

import { MARKETPLACE_MODULE } from "../../modules/marketplace"

export type CreateVendorProductWorkflowInput = {
  seller_id: string
  product: CreateProductWorkflowInputDTO
}

/**
 * Creates a product through the core workflow, then links it to the owning
 * seller so the marketplace can scope it. Link order (product first, seller
 * second) matches src/links/seller-product.ts.
 */
export const createVendorProductWorkflow = createWorkflow(
  "create-vendor-product",
  function (input: CreateVendorProductWorkflowInput) {
    const created = createProductsWorkflow.runAsStep({
      input: { products: [input.product] },
    })

    const linkData = transform({ created, input }, ({ created, input }) => [
      {
        [Modules.PRODUCT]: { product_id: created[0].id },
        [MARKETPLACE_MODULE]: { seller_id: input.seller_id },
      },
    ])

    createRemoteLinkStep(linkData)

    return new WorkflowResponse(created)
  }
)
