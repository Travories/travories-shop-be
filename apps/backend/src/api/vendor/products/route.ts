import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import {
  createVendorProductWorkflow,
  CreateVendorProductInput,
} from "../../../workflows/marketplace/create-vendor-product"
import { getSellerIdForMember } from "../helpers"
import { CreateVendorProductSchema } from "./validators"

/**
 * POST /vendor/products — create a product owned by the acting seller.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<CreateVendorProductSchema>,
  res: MedusaResponse
) {
  const sellerId = await getSellerIdForMember(
    req.scope,
    req.auth_context.actor_id
  )

  const { result } = await createVendorProductWorkflow(req.scope).run({
    input: {
      seller_id: sellerId,
      product: req.validatedBody as unknown as CreateVendorProductInput,
    },
  })

  res.status(201).json({ product: result[0] })
}

/**
 * GET /vendor/products — list only the acting seller's products.
 * Scoped from the seller side, since query.graph cannot filter by linked fields.
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
    entity: "seller",
    fields: [
      "products.id",
      "products.title",
      "products.handle",
      "products.status",
      "products.thumbnail",
      "products.created_at",
      "products.variants.id",
      "products.variants.title",
    ],
    filters: { id: sellerId },
  })

  const products =
    (data[0] as { products?: unknown[] } | undefined)?.products ?? []

  res.json({ products, count: products.length })
}
