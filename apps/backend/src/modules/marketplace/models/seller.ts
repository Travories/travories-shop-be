import { model } from "@medusajs/framework/utils"
import { Member } from "./member"
import { Payout } from "./payout"

/**
 * A seller account on the marketplace. This is the ownership/identity layer that
 * sits above Artisan (linked via src/links/artisan-seller.ts): an Artisan is the
 * catalog-facing maker, a Seller is who logs in, owns products, and gets paid.
 */
export const Seller = model.define("seller", {
  id: model.id().primaryKey(),
  name: model.text(),
  handle: model.text().unique(),
  description: model.text().nullable(),
  photo: model.text().nullable(),
  status: model
    .enum(["pending", "active", "suspended", "rejected"])
    .default("pending"),
  // Percentage the platform keeps, e.g. 12.5. Null falls back to the platform default.
  commission_rate: model.float().nullable(),
  email: model.text(),
  phone: model.text().nullable(),
  // Out-of-band settlement details: eSewa has no split-payment rail, so payouts
  // are reconciled and transferred manually (see the Payout ledger).
  payout_bank_name: model.text().nullable(),
  payout_account_name: model.text().nullable(),
  payout_account_number: model.text().nullable(),
  members: model.hasMany(() => Member, {
    mappedBy: "seller",
  }),
  payouts: model.hasMany(() => Payout, {
    mappedBy: "seller",
  }),
})

export default Seller
