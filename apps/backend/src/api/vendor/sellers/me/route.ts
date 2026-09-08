import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"

/**
 * GET /vendor/sellers/me
 *
 * Returns the authenticated vendor. The "seller" actor's actor_id is a Member
 * id (bound at onboarding), which resolves to its Seller.
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const memberId = req.auth_context.actor_id
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data } = await query.graph({
    entity: "member",
    fields: ["id", "name", "email", "role", "seller.*"],
    filters: { id: memberId },
  })

  const member = data[0]
  if (!member?.seller) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "No seller is associated with this account"
    )
  }

  res.json({ member, seller: member.seller })
}
