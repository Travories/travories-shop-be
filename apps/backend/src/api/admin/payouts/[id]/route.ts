import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { updatePayoutWorkflow } from "../../../../workflows/marketplace/update-payout"
import { UpdatePayoutSchema } from "../validators"

/**
 * POST /admin/payouts/:id — mark a payout paid and record its reference.
 */
export async function POST(
  req: MedusaRequest<UpdatePayoutSchema>,
  res: MedusaResponse
) {
  const { id } = req.params

  const { result } = await updatePayoutWorkflow(req.scope).run({
    input: { id, ...req.validatedBody },
  })

  res.json({ payout: result })
}
