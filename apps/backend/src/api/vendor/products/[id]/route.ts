import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"
import {
  updateVendorProductWorkflow,
  UpdateVendorProductInput,
} from "../../../../workflows/marketplace/update-vendor-product"
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
      "material",
      "weight",
      "metadata",
      "seller.id",
      "collection.id",
      "categories.id",
      "categories.name",
      "tags.value",
      "images.url",
      "variants.*",
      "variants.prices.*",
      "variants.inventory_items.inventory.location_levels.stocked_quantity",
      "options.*",
      "destination.id",
      "destination.name",
      "artisan.id",
      "artisan.name",
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
      update: req.validatedBody as unknown as UpdateVendorProductInput,
    },
  })

  res.json({ product: result[0] })
}
