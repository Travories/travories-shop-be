import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { reviewVendorProductWorkflow } from "../../../../workflows/marketplace/review-vendor-product"
import { ReviewVendorProductSchema } from "../validators"

/**
 * POST /admin/vendor-products/:id — approve (publish) or reject a proposed
 * vendor product.
 */
export async function POST(
  req: MedusaRequest<ReviewVendorProductSchema>,
  res: MedusaResponse
) {
  const { result } = await reviewVendorProductWorkflow(req.scope).run({
    input: {
      product_id: req.params.id,
      action: req.validatedBody.action,
    },
  })

  res.json({ product: result[0] })
}
