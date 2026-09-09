import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { Modules, ProductStatus } from "@medusajs/framework/utils"
import {
  createInventoryLevelsWorkflow,
  createProductsWorkflow,
  createRemoteLinkStep,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"

import { MARKETPLACE_MODULE } from "../../modules/marketplace"
import { SOUVENIR_MODULE } from "../../modules/souvenir"
import { getVendorProductDefaultsStep } from "./steps/get-vendor-product-defaults-step"
import { validateSellerActiveStep } from "./steps/validate-seller-active-step"

type VendorVariantInput = {
  title: string
  sku?: string
  prices?: { amount: number; currency_code: string }[]
  options?: Record<string, string>
  manage_inventory?: boolean
  inventory_quantity?: number
}

export type CreateVendorProductInput = {
  title: string
  subtitle?: string
  description?: string
  handle?: string
  thumbnail?: string
  images?: { url: string }[]
  material?: string
  weight?: number
  tags?: string[]
  category_ids?: string[]
  collection_id?: string
  metadata?: Record<string, unknown>
  destination_id?: string
  artisan_id?: string
  options?: { title: string; values: string[] }[]
  variants?: VendorVariantInput[]
}

export type CreateVendorProductWorkflowInput = {
  seller_id: string
  product: CreateVendorProductInput
}

/**
 * Creates a product owned by a seller. New vendor products always start as
 * PROPOSED (awaiting admin approval) — vendors can never self-publish. After
 * creation the product is linked to its seller and to the optional souvenir
 * taxonomy (destination/artisan), and managed variants get initial stock at
 * the default location. Link order (product first) matches the link files.
 */
export const createVendorProductWorkflow = createWorkflow(
  "create-vendor-product",
  function (input: CreateVendorProductWorkflowInput) {
    validateSellerActiveStep({ seller_id: input.seller_id })
    const defaults = getVendorProductDefaultsStep()

    const product = transform(
      { input, defaults },
      ({ input, defaults }) => {
        const p = input.product
        return {
          title: p.title,
          subtitle: p.subtitle,
          description: p.description,
          handle: p.handle,
          thumbnail: p.thumbnail,
          images: p.images,
          material: p.material,
          weight: p.weight,
          metadata: p.metadata,
          collection_id: p.collection_id,
          tags: p.tags?.map((value) => ({ value })),
          categories: p.category_ids?.map((id) => ({ id })),
          status: ProductStatus.PROPOSED,
          shipping_profile_id: defaults.shipping_profile_id,
          sales_channels: [{ id: defaults.sales_channel_id }],
          options: p.options,
          variants: p.variants?.map((variant) => ({
            title: variant.title,
            sku: variant.sku,
            prices: variant.prices,
            options: variant.options,
            manage_inventory: variant.manage_inventory ?? false,
          })),
        }
      }
    )

    const created = createProductsWorkflow.runAsStep({
      input: { products: [product] },
    })

    const linkData = transform({ created, input }, ({ created, input }) => {
      const productId = created[0].id
      const links: Record<string, Record<string, string>>[] = [
        {
          [Modules.PRODUCT]: { product_id: productId },
          [MARKETPLACE_MODULE]: { seller_id: input.seller_id },
        },
      ]

      if (input.product.destination_id) {
        links.push({
          [Modules.PRODUCT]: { product_id: productId },
          [SOUVENIR_MODULE]: { destination_id: input.product.destination_id },
        })
      }

      if (input.product.artisan_id) {
        links.push({
          [Modules.PRODUCT]: { product_id: productId },
          [SOUVENIR_MODULE]: { artisan_id: input.product.artisan_id },
        })
      }

      return links
    })

    createRemoteLinkStep(linkData)

    // Seed stock for managed variants. Query the created variants for their
    // inventory item ids, then match back to the requested quantities by SKU
    // (falling back to title).
    const { data: createdProducts } = useQueryGraphStep({
      entity: "product",
      fields: [
        "id",
        "variants.id",
        "variants.sku",
        "variants.title",
        "variants.inventory_items.inventory_item_id",
      ],
      filters: transform({ created }, ({ created }) => ({
        id: created[0].id,
      })),
    }).config({ name: "query-created-variants" })

    const inventoryLevels = transform(
      { createdProducts, input, defaults },
      ({ createdProducts, input, defaults }) => {
        const requested = input.product.variants ?? []
        const variants =
          (
            createdProducts[0] as
              | {
                  variants?: {
                    sku?: string | null
                    title?: string | null
                    inventory_items?: { inventory_item_id: string }[]
                  }[]
                }
              | undefined
          )?.variants ?? []

        const levels: {
          location_id: string
          stocked_quantity: number
          inventory_item_id: string
        }[] = []

        for (const variant of variants) {
          const match = requested.find((r) =>
            variant.sku ? r.sku === variant.sku : r.title === variant.title
          )
          const inventoryItemId =
            variant.inventory_items?.[0]?.inventory_item_id

          if (
            match?.manage_inventory &&
            typeof match.inventory_quantity === "number" &&
            inventoryItemId
          ) {
            levels.push({
              location_id: defaults.stock_location_id,
              stocked_quantity: match.inventory_quantity,
              inventory_item_id: inventoryItemId,
            })
          }
        }

        return levels
      }
    )

    when({ inventoryLevels }, ({ inventoryLevels }) => inventoryLevels.length > 0)
      .then(() => {
        createInventoryLevelsWorkflow.runAsStep({
          input: { inventory_levels: inventoryLevels },
        })
      })

    return new WorkflowResponse(created)
  }
)
