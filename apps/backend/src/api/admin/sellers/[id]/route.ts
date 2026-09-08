import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"

import { updateSellerWorkflow } from "../../../../workflows/marketplace/update-seller"
import { UpdateSellerSchema } from "../validators"

/**
 * GET /admin/sellers/:id — retrieve one seller with its members and payouts.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data } = await query.graph({
    entity: "seller",
    filters: { id },
    fields: [
      "id",
      "name",
      "handle",
      "email",
      "phone",
      "description",
      "status",
      "commission_rate",
      "created_at",
      "members.*",
      "payouts.*",
    ],
  })

  if (!data.length) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Seller not found")
  }

  res.json({ seller: data[0] })
}

/**
 * POST /admin/sellers/:id — approve/suspend/reject and/or set commission.
 */
export async function POST(
  req: MedusaRequest<UpdateSellerSchema>,
  res: MedusaResponse
) {
  const { id } = req.params

  const { result } = await updateSellerWorkflow(req.scope).run({
    input: { id, ...req.validatedBody },
  })

  res.json({ seller: result })
}
