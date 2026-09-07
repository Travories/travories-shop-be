import { MedusaService } from "@medusajs/framework/utils"
import { Seller } from "./models/seller"
import { Member } from "./models/member"
import { Payout } from "./models/payout"

class MarketplaceModuleService extends MedusaService({
  Seller,
  Member,
  Payout,
}) {}

export default MarketplaceModuleService
