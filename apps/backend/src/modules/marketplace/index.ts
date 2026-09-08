import { Module } from "@medusajs/framework/utils"
import MarketplaceModuleService from "./service"

// Module names must be camelCase - dashes break container resolution.
export const MARKETPLACE_MODULE = "marketplace"

// Commission the platform keeps when a seller has no explicit rate. Percentage,
// e.g. 10 = 10%. Overridable per environment.
export const DEFAULT_COMMISSION_RATE = Number(
  process.env.MARKETPLACE_DEFAULT_COMMISSION_RATE ?? 10
)

export default Module(MARKETPLACE_MODULE, {
  service: MarketplaceModuleService,
})
