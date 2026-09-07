import { model } from "@medusajs/framework/utils"
import { Seller } from "./seller"

/**
 * Per-seller settlement ledger. Built in Phase 1, populated in Phase 5: the
 * platform collects the full order amount via eSewa, then records what each
 * seller is owed (items total minus commission) for out-of-band settlement.
 */
export const Payout = model.define("payout", {
  id: model.id().primaryKey(),
  amount: model.bigNumber(),
  currency_code: model.text().default("npr"),
  status: model.enum(["pending", "paid"]).default("pending"),
  order_id: model.text(),
  // eSewa/bank transaction reference, filled in when settled.
  reference: model.text().nullable(),
  seller: model.belongsTo(() => Seller, {
    mappedBy: "payouts",
  }),
})

export default Payout
