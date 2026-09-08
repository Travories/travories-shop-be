import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * GET /admin/sellers
 *
 * Super-admin list of every seller. Fields/pagination come from the query
 * config middleware.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: sellers, metadata } = await query.graph({
    entity: "seller",
    ...req.queryConfig,
  })

  res.json({
    sellers,
    count: metadata?.count ?? sellers.length,
    offset: metadata?.skip ?? 0,
    limit: metadata?.take ?? sellers.length,
  })
}
