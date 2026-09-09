import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * GET /vendor/artisans — active artisans a vendor can attribute a product to.
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data } = await query.graph({
    entity: "artisan",
    fields: ["id", "name", "slug", "craft"],
    filters: { is_active: true },
  })

  res.json({ artisans: data, count: data.length })
}
