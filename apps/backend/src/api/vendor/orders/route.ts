import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import { listVendorOrdersWorkflow } from "../../../workflows/marketplace/list-vendor-orders"
import { getSellerIdForMember } from "../helpers"

/**
 * GET /vendor/orders — orders containing the acting seller's products.
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const sellerId = await getSellerIdForMember(
    req.scope,
    req.auth_context.actor_id
  )
  const { result: orders } = await listVendorOrdersWorkflow(req.scope).run({
    input: { seller_id: sellerId },
  })

  res.json({ orders, count: orders.length })
}
