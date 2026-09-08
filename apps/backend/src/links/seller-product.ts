import { defineLink } from "@medusajs/framework/utils"
import ProductModule from "@medusajs/medusa/product"

import MarketplaceModule from "../modules/marketplace"

// A seller owns many products. Product is the "many" side, so it carries the
// list flag. Order here (product first) is the canonical link direction and
// must be matched when creating/dismissing the link.
export default defineLink(
  {
    linkable: ProductModule.linkable.product,
    isList: true,
  },
  MarketplaceModule.linkable.seller
)
