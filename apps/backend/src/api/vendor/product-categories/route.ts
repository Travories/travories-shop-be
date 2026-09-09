import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * GET /vendor/product-categories — active categories a vendor can assign to
 * their products.
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data } = await query.graph({
    entity: "product_category",
    fields: ["id", "name", "handle"],
    filters: { is_active: true, is_internal: false },
  })

  res.json({ product_categories: data, count: data.length })
}
