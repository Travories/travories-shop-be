import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { getSellerIdForMember } from "../helpers"

/**
 * GET /vendor/payouts — the acting seller's settlement ledger.
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

  const { data, metadata } = await query.graph({
    entity: "payout",
    fields: [
      "id",
      "amount",
      "currency_code",
      "status",
      "order_id",
      "reference",
      "created_at",
    ],
    filters: { seller_id: sellerId },
    pagination: { order: { created_at: "DESC" } },
  })

  res.json({
    payouts: data,
    count: metadata?.count ?? data.length,
  })
}
