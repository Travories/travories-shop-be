import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"
import {
  batchInventoryItemLevelsWorkflow,
  createRemoteLinkStep,
  dismissRemoteLinkStep,
  updateProductsWorkflow,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { UpdateProductWorkflowInputDTO } from "@medusajs/framework/types"

import { SOUVENIR_MODULE } from "../../modules/souvenir"
import { validateProductOwnershipStep } from "./steps/validate-product-ownership-step"
import { validateSellerActiveStep } from "./steps/validate-seller-active-step"

export type UpdateVendorProductInput = {
  title?: string
  subtitle?: string
  description?: string
  handle?: string
  status?: "draft" | "proposed"
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
  variants?: {
    id?: string
    title?: string
    sku?: string
    prices?: { amount: number; currency_code: string }[]
    options?: Record<string, string>
    manage_inventory?: boolean
    inventory_quantity?: number
  }[]
}

export type UpdateVendorProductWorkflowInput = {
  seller_id: string
  product_id: string
  update: UpdateVendorProductInput
}

/**
 * Updates a seller-owned product. Ownership is enforced first. A published
 * product stays published (edits go live instantly) — a vendor-supplied
 * draft/proposed status is ignored while published. Destination/artisan links
 * are replaced when those ids are provided.
 */
export const updateVendorProductWorkflow = createWorkflow(
  "update-vendor-product",
  function (input: UpdateVendorProductWorkflowInput) {
    validateSellerActiveStep({ seller_id: input.seller_id })
    validateProductOwnershipStep({
      seller_id: input.seller_id,
      product_id: input.product_id,
    })

    const { data: current } = useQueryGraphStep({
      entity: "product",
      fields: ["id", "status", "destination.id", "artisan.id"],
      filters: transform({ input }, ({ input }) => ({ id: input.product_id })),
    })

    const update = transform({ input, current }, ({ input, current }) => {
      const u = input.update
      const currentStatus = (current[0] as { status?: string } | undefined)
        ?.status
      const product: Record<string, unknown> = {
        title: u.title,
        subtitle: u.subtitle,
        description: u.description,
        handle: u.handle,
        thumbnail: u.thumbnail,
        images: u.images,
        material: u.material,
        weight: u.weight,
        metadata: u.metadata,
        collection_id: u.collection_id,
        tags: u.tags?.map((value) => ({ value })),
        categories: u.category_ids?.map((id) => ({ id })),
        // inventory_quantity is tracked per stock location, not on the product
        // variant, so strip it before handing off to the product update.
        variants: u.variants?.map((variant) => ({
          id: variant.id,
          title: variant.title,
          sku: variant.sku,
          prices: variant.prices,
          options: variant.options,
          manage_inventory: variant.manage_inventory,
        })),
      }

      // Never downgrade a live product: only apply a vendor status change when
      // the product is not already published.
      if (u.status && currentStatus !== "published") {
        product.status = u.status
      }

      // Drop undefined keys so we don't clobber existing values.
      for (const key of Object.keys(product)) {
        if (product[key] === undefined) {
          delete product[key]
        }
      }

      return product as unknown as UpdateProductWorkflowInputDTO
    })

    const updated = updateProductsWorkflow.runAsStep({
      input: {
        selector: { id: input.product_id },
        update,
      },
    })

    // Sync stock for managed variants whose quantity was supplied. Depend on
    // `updated` so the query runs after variants (new or changed) are persisted.
    const { data: stockLocations } = useQueryGraphStep({
      entity: "stock_location",
      fields: ["id"],
      pagination: { take: 1 },
    }).config({ name: "query-update-stock-location" })

    const { data: inventoryVariants } = useQueryGraphStep({
      entity: "product",
      fields: [
        "id",
        "variants.id",
        "variants.sku",
        "variants.title",
        "variants.inventory_items.inventory_item_id",
        "variants.inventory_items.inventory.location_levels.id",
        "variants.inventory_items.inventory.location_levels.location_id",
      ],
      filters: transform({ input, updated }, ({ input }) => ({
        id: input.product_id,
      })),
    }).config({ name: "query-update-inventory" })

    const inventoryBatch = transform(
      { inventoryVariants, stockLocations, input },
      ({ inventoryVariants, stockLocations, input }) => {
        const locationId = (stockLocations[0] as { id?: string } | undefined)
          ?.id
        const requested = input.update.variants ?? []
        const variants =
          (
            inventoryVariants[0] as
              | {
                  variants?: {
                    id?: string
                    sku?: string | null
                    title?: string | null
                    inventory_items?: {
                      inventory_item_id: string
                      inventory?: {
                        location_levels?: {
                          id: string
                          location_id: string
                        }[]
                      }
                    }[]
                  }[]
                }
              | undefined
          )?.variants ?? []

        const create: {
          inventory_item_id: string
          location_id: string
          stocked_quantity: number
        }[] = []
        const updateLevels: {
          id: string
          inventory_item_id: string
          location_id: string
          stocked_quantity: number
        }[] = []

        if (!locationId) {
          return { create, update: updateLevels }
        }

        for (const variant of variants) {
          const match = requested.find((r) =>
            r.id
              ? r.id === variant.id
              : variant.sku
                ? r.sku === variant.sku
                : r.title === variant.title
          )

          if (
            !match?.manage_inventory ||
            typeof match.inventory_quantity !== "number"
          ) {
            continue
          }

          const item = variant.inventory_items?.[0]
          const inventoryItemId = item?.inventory_item_id
          if (!inventoryItemId) {
            continue
          }

          const existing = item?.inventory?.location_levels?.find(
            (level) => level.location_id === locationId
          )

          if (existing) {
            updateLevels.push({
              id: existing.id,
              inventory_item_id: inventoryItemId,
              location_id: locationId,
              stocked_quantity: match.inventory_quantity,
            })
          } else {
            create.push({
              inventory_item_id: inventoryItemId,
              location_id: locationId,
              stocked_quantity: match.inventory_quantity,
            })
          }
        }

        return { create, update: updateLevels }
      }
    )

    when(
      { inventoryBatch },
      ({ inventoryBatch }) =>
        inventoryBatch.create.length + inventoryBatch.update.length > 0
    ).then(() => {
      batchInventoryItemLevelsWorkflow.runAsStep({
        input: {
          create: inventoryBatch.create,
          update: inventoryBatch.update,
        },
      })
    })

    // Replace the destination link when a new destination is provided.
    const destinationLinks = transform(
      { input, current },
      ({ input, current }) => {
        const oldId = (current[0] as { destination?: { id?: string } })
          ?.destination?.id
        const newId = input.update.destination_id
        return {
          dismiss:
            oldId && oldId !== newId
              ? [
                  {
                    [Modules.PRODUCT]: { product_id: input.product_id },
                    [SOUVENIR_MODULE]: { destination_id: oldId },
                  },
                ]
              : [],
          create:
            newId && newId !== oldId
              ? [
                  {
                    [Modules.PRODUCT]: { product_id: input.product_id },
                    [SOUVENIR_MODULE]: { destination_id: newId },
                  },
                ]
              : [],
        }
      }
    )

    when({ destinationLinks }, ({ destinationLinks }) =>
      destinationLinks.dismiss.length > 0
    ).then(() => {
      dismissRemoteLinkStep(destinationLinks.dismiss).config({
        name: "dismiss-destination-link",
      })
    })

    when({ destinationLinks }, ({ destinationLinks }) =>
      destinationLinks.create.length > 0
    ).then(() => {
      createRemoteLinkStep(destinationLinks.create).config({
        name: "create-destination-link",
      })
    })

    // Replace the artisan link when a new artisan is provided.
    const artisanLinks = transform({ input, current }, ({ input, current }) => {
      const oldId = (current[0] as { artisan?: { id?: string } })?.artisan?.id
      const newId = input.update.artisan_id
      return {
        dismiss:
          oldId && oldId !== newId
            ? [
                {
                  [Modules.PRODUCT]: { product_id: input.product_id },
                  [SOUVENIR_MODULE]: { artisan_id: oldId },
                },
              ]
            : [],
        create:
          newId && newId !== oldId
            ? [
                {
                  [Modules.PRODUCT]: { product_id: input.product_id },
                  [SOUVENIR_MODULE]: { artisan_id: newId },
                },
              ]
            : [],
      }
    })

    when({ artisanLinks }, ({ artisanLinks }) => artisanLinks.dismiss.length > 0)
      .then(() => {
        dismissRemoteLinkStep(artisanLinks.dismiss).config({
          name: "dismiss-artisan-link",
        })
      })

    when({ artisanLinks }, ({ artisanLinks }) => artisanLinks.create.length > 0)
      .then(() => {
        createRemoteLinkStep(artisanLinks.create).config({
          name: "create-artisan-link",
        })
      })

    return new WorkflowResponse(updated)
  }
)
