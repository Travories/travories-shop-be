import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"
import { UpdateProductWorkflowInputDTO } from "@medusajs/framework/types"

import { updateVendorProductWorkflow } from "../../../../workflows/marketplace/update-vendor-product"
import { getSellerIdForMember } from "../../helpers"
import { UpdateVendorProductSchema } from "../validators"

/**
 * GET /vendor/products/:id — retrieve one of the acting seller's products.
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const sellerId = await getSellerIdForMember(
    req.scope,
    req.auth_context.actor_id
  )
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "title",
      "subtitle",
      "handle",
      "status",
      "description",
      "thumbnail",
      "seller.id",
      "variants.*",
      "options.*",
    ],
    filters: { id: req.params.id },
  })

  const product = data[0] as
    | { seller?: { id?: string } }
    | undefined

  if (!product || product.seller?.id !== sellerId) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "Product not found in your store"
    )
  }

  res.json({ product })
}

/**
 * POST /vendor/products/:id — update one of the acting seller's products.
 * Ownership is enforced inside the workflow.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<UpdateVendorProductSchema>,
  res: MedusaResponse
) {
  const sellerId = await getSellerIdForMember(
    req.scope,
    req.auth_context.actor_id
  )

  const { result } = await updateVendorProductWorkflow(req.scope).run({
    input: {
      seller_id: sellerId,
      product_id: req.params.id,
      update: req.validatedBody as unknown as UpdateProductWorkflowInputDTO,
    },
  })

  res.json({ product: result[0] })
}
