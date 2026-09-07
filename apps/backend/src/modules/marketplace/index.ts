import { Module } from "@medusajs/framework/utils"
import MarketplaceModuleService from "./service"

// Module names must be camelCase - dashes break container resolution.
export const MARKETPLACE_MODULE = "marketplace"

export default Module(MARKETPLACE_MODULE, {
  service: MarketplaceModuleService,
})
