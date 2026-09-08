import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * GET /admin/payouts — super-admin view of every seller payout.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: payouts, metadata } = await query.graph({
    entity: "payout",
    ...req.queryConfig,
  })

  res.json({
    payouts,
    count: metadata?.count ?? payouts.length,
    offset: metadata?.skip ?? 0,
    limit: metadata?.take ?? payouts.length,
  })
}
