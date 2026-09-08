import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import { createSellerWorkflow } from "../../../workflows/marketplace/create-seller"
import { CreateSellerSchema } from "./validators"

/**
 * POST /vendor/sellers
 *
 * Onboards a vendor. Reached with a registered-but-unbound auth identity
 * (see the `allowUnregistered` seller authenticate in api/middlewares.ts).
 */
export async function POST(
  req: AuthenticatedMedusaRequest<CreateSellerSchema>,
  res: MedusaResponse
) {
  const { name, handle, email, phone, description, member_name } =
    req.validatedBody

  const { result } = await createSellerWorkflow(req.scope).run({
    input: {
      auth_identity_id: req.auth_context.auth_identity_id,
      seller: { name, handle, email, phone, description },
      member: { name: member_name ?? name, email },
    },
  })

  res.status(201).json({ seller: result.seller })
}
