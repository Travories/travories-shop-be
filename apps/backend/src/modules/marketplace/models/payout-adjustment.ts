import { model } from "@medusajs/framework/utils"

import { Payout } from "./payout"

/**
 * Immutable audit row for money removed from a seller payout after an order
 * cancellation or refund.
 */
export const PayoutAdjustment = model.define("payout_adjustment", {
  id: model.id().primaryKey(),
  amount: model.bigNumber(),
  type: model.enum(["cancellation", "refund"]),
  source_id: model.text(),
  payout: model.belongsTo(() => Payout, {
    mappedBy: "adjustments",
  }),
}).indexes([
  {
    on: ["payout_id", "type", "source_id"],
    unique: true,
  },
])

export default PayoutAdjustment
