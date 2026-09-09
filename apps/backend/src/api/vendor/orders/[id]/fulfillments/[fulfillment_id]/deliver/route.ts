import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import { markVendorFulfillmentDeliveredWorkflow } from "../../../../../../../workflows/marketplace/mark-vendor-fulfillment-delivered"
import { getSellerIdForMember } from "../../../../../helpers"

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const sellerId = await getSellerIdForMember(
    req.scope,
    req.auth_context.actor_id
  )

  await markVendorFulfillmentDeliveredWorkflow(req.scope).run({
    input: {
      seller_id: sellerId,
      order_id: req.params.id,
      fulfillment_id: req.params.fulfillment_id,
    },
  })

  res.json({ id: req.params.fulfillment_id, delivered: true })
}
