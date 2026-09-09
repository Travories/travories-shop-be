import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * GET /vendor/destinations — active souvenir destinations a vendor can tag a
 * product with.
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data } = await query.graph({
    entity: "destination",
    fields: ["id", "name", "slug", "region"],
    filters: { is_active: true },
  })

  res.json({ destinations: data, count: data.length })
}
