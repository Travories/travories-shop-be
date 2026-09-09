import { MedusaService } from "@medusajs/framework/utils"
import { Seller } from "./models/seller"
import { Member } from "./models/member"
import { Payout } from "./models/payout"
import { PayoutAdjustment } from "./models/payout-adjustment"

class MarketplaceModuleService extends MedusaService({
  Seller,
  Member,
  Payout,
  PayoutAdjustment,
}) {}

export default MarketplaceModuleService
