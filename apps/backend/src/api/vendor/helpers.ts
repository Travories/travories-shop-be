import { MedusaContainer } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"

/**
 * Resolves the seller that owns the authenticated member. The "seller" actor's
 * actor_id is a Member id; every vendor route scopes to the member's seller.
 */
export async function getSellerIdForMember(
  scope: MedusaContainer,
  memberId: string
): Promise<string> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data } = await query.graph({
    entity: "member",
    fields: ["id", "seller_id"],
    filters: { id: memberId },
  })

  const sellerId = (data[0] as { seller_id?: string } | undefined)?.seller_id
  if (!sellerId) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "No seller is associated with this account"
    )
  }

  return sellerId
}
