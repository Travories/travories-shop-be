import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"

/**
 * Resolves the core-commerce defaults a vendor product needs to be buyable.
 */
export const getVendorProductDefaultsStep = createStep(
  "get-vendor-product-defaults",
  async (_, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)

    const [{ data: stores }, { data: channels }, { data: profiles }] =
      await Promise.all([
        query.graph({
          entity: "store",
          fields: ["default_sales_channel_id"],
        }),
        query.graph({
          entity: "sales_channel",
          fields: ["id"],
          pagination: { take: 1 },
        }),
        query.graph({
          entity: "shipping_profile",
          fields: ["id", "type"],
        }),
      ])

    const defaultSalesChannelId = (
      stores[0] as { default_sales_channel_id?: string | null } | undefined
    )?.default_sales_channel_id
    const fallbackChannelId = (channels[0] as { id?: string } | undefined)?.id
    const salesChannelId = defaultSalesChannelId ?? fallbackChannelId
    const typedProfiles = profiles as { id: string; type?: string | null }[]
    const shippingProfile =
      typedProfiles.find((profile) => profile.type === "default") ??
      typedProfiles[0]

    if (!salesChannelId) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "No sales channel is configured for vendor products"
      )
    }

    if (!shippingProfile?.id) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "No shipping profile is configured for vendor products"
      )
    }

    return new StepResponse({
      sales_channel_id: salesChannelId,
      shipping_profile_id: shippingProfile.id,
    })
  }
)
