import { model } from "@medusajs/framework/utils"
import { Seller } from "./seller"

/**
 * A person who logs into a Seller. The auth identity's app_metadata stores the
 * Member id as the "seller" actor value, so req.auth_context.actor_id resolves
 * to a Member, which resolves to its Seller.
 */
export const Member = model.define("member", {
  id: model.id().primaryKey(),
  name: model.text().nullable(),
  email: model.text(),
  role: model.enum(["owner", "staff"]).default("owner"),
  seller: model.belongsTo(() => Seller, {
    mappedBy: "members",
  }),
})

export default Member
