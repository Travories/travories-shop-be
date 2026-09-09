import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import { createVendorFulfillmentWorkflow } from "../../../../../workflows/marketplace/create-vendor-fulfillment"
import { getSellerIdForMember } from "../../../helpers"
import { CreateVendorFulfillmentSchema } from "../../validators"

export async function POST(
  req: AuthenticatedMedusaRequest<CreateVendorFulfillmentSchema>,
  res: MedusaResponse
) {
  const sellerId = await getSellerIdForMember(
    req.scope,
    req.auth_context.actor_id
  )
  const { result: fulfillment } = await createVendorFulfillmentWorkflow(
    req.scope
  ).run({
    input: {
      seller_id: sellerId,
      order_id: req.params.id,
      ...req.validatedBody,
    },
  })

  res.status(201).json({ fulfillment })
}
