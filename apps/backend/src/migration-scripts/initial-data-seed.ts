import { MedusaContainer } from "@medusajs/framework"
import type { AuthenticationInput } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  ModuleRegistrationName,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  createApiKeysWorkflow,
  createCollectionsWorkflow,
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductTagsWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createStoresWorkflow,
  updateStoresWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updatePricePreferencesWorkflow,
  updateRegionsWorkflow,
} from "@medusajs/medusa/core-flows"

const SEED_VERSION = "travories-v1"

async function ensureAdmin(
  container: MedusaContainer,
  logger: { info: (message: string) => void }
) {
  const email = process.env.SEED_ADMIN_EMAIL?.trim()
  const password = process.env.SEED_ADMIN_PASSWORD

  if (!email || !password) {
    logger.info(
      "Skipping seed admin: set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to enable it."
    )
    return
  }

  const userModule = container.resolve(Modules.USER)
  const authModule = container.resolve(Modules.AUTH)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: existingUsers } = await query.graph({
    entity: "user",
    fields: ["id", "email"],
    filters: { email },
  })

  const user = existingUsers[0] ?? (await userModule.createUsers({ email }))
  const authInput: AuthenticationInput = { body: { email, password } }
  let authIdentity = (await authModule.register("emailpass", authInput))
    .authIdentity

  if (!authIdentity) {
    const updated = await authModule.updateProvider("emailpass", {
      email,
      password,
      entity_id: email,
    })
    authIdentity = updated.authIdentity
  }

  if (!authIdentity) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Unable to create or update admin auth identity for ${email}`
    )
  }

  await authModule.updateAuthIdentities({
    id: authIdentity.id,
    app_metadata: {
      ...(authIdentity.app_metadata ?? {}),
      user_id: user.id,
    },
  })

  logger.info(`Seed admin is ready: ${email}`)
}

// Prices are decimal units, not cents. 4500 npr means NPR 4,500.00
// Every variant carries both npr and usd so a future international region
// can be added without re-pricing the catalogue.
const price = (npr: number, usd: number) => [
  { currency_code: "npr", amount: npr },
  { currency_code: "usd", amount: usd },
]

export default async function initial_data_seed({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModuleService = container.resolve(
    ModuleRegistrationName.FULFILLMENT
  )

  const countries = ["np"]

  const createLinkIfMissing = async (
    definition: Parameters<typeof link.create>[0]
  ) => {
    try {
      await link.create(definition)
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !error.message.includes("Cannot create multiple links")
      ) {
        throw error
      }
    }
  }

  await ensureAdmin(container, logger)

  const { data: existingStores } = await query.graph({
    entity: "store",
    fields: ["id", "name", "metadata"],
  })
  const existingSeedStore = existingStores[0]

  const { data: existingSeedProducts } = await query.graph({
    entity: "product",
    fields: ["id", "handle"],
    filters: { handle: "pashmina-shawl" },
  })

  if (
    existingSeedStore?.metadata?.seed_version === SEED_VERSION ||
    existingSeedProducts.length > 0
  ) {
    if (existingSeedStore?.metadata?.seed_version !== SEED_VERSION) {
      await updateStoresWorkflow(container).run({
        input: {
          selector: { id: existingSeedStore.id },
          update: {
            metadata: {
              ...(existingSeedStore.metadata ?? {}),
              seed_version: SEED_VERSION,
            },
          },
        },
      })
    }
    logger.info("Seed is already complete; nothing to do.")
    return
  }

  logger.info("Seeding store data...")
  const { data: existingSalesChannels } = await query.graph({
    entity: "sales_channel",
    fields: ["id", "name"],
    filters: { name: "Default Sales Channel" },
  })
  const defaultSalesChannel =
    existingSalesChannels[0] ??
    (
      await createSalesChannelsWorkflow(container).run({
        input: {
          salesChannelsData: [
            {
              name: "Default Sales Channel",
              description: "Primary storefront channel",
            },
          ],
        },
      })
    ).result[0]

  const { data: existingApiKeys } = await query.graph({
    entity: "api_key",
    fields: ["id", "title", "type"],
    filters: { title: "Default Publishable API Key", type: "publishable" },
  })
  const publishableApiKey =
    existingApiKeys[0] ??
    (
      await createApiKeysWorkflow(container).run({
        input: {
          api_keys: [
            {
              title: "Default Publishable API Key",
              type: "publishable",
              created_by: "",
            },
          ],
        },
      })
    ).result[0]

  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: {
      id: publishableApiKey.id,
      add: [defaultSalesChannel.id],
    },
  })

  const store =
    existingSeedStore ??
    (
      await createStoresWorkflow(container).run({
        input: {
          stores: [
            {
              name: "Nepal Souvenirs and Gifts",
              supported_currencies: [
                {
                  currency_code: "npr",
                  is_default: true,
                },
                {
                  currency_code: "usd",
                  is_default: false,
                },
              ],
              default_sales_channel_id: defaultSalesChannel.id,
            },
          ],
        },
      })
    ).result[0]

  logger.info("Seeding region data...")
  const paymentProviders = ["pp_system_default"]

  if (process.env.ESEWA_PRODUCT_CODE && process.env.ESEWA_SECRET_KEY) {
    paymentProviders.push("pp_esewa_esewa")
  }

  // createRegionsWorkflow only applies `payment_providers` when the region is
  // created, so a database seeded before eSewa existed would keep the old
  // provider set forever and never offer eSewa at checkout. Update in place
  // when the region is already there.
  const { data: existingRegions } = await query.graph({
    entity: "region",
    fields: ["id", "name"],
  })
  const existingRegion = existingRegions.find((r) => r.name === "Nepal")

  let region: { id: string }

  if (existingRegion) {
    const { result: updated } = await updateRegionsWorkflow(container).run({
      input: {
        selector: { id: existingRegion.id },
        update: { payment_providers: paymentProviders },
      },
    })
    region = updated[0]
  } else {
    const { result: created } = await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: "Nepal",
            currency_code: "npr",
            countries,
            payment_providers: paymentProviders,
          },
        ],
      },
    })
    region = created[0]
  }

  logger.info(
    `Finished seeding regions (payment providers: ${paymentProviders.join(", ")}).`
  )

  logger.info("Seeding tax regions...")
  const { data: existingTaxRegions } = await query.graph({
    entity: "tax_region",
    fields: ["id", "country_code"],
    filters: { country_code: countries },
  })
  const missingTaxCountries = countries.filter(
    (countryCode) =>
      !existingTaxRegions.some(
        (taxRegion) => taxRegion.country_code === countryCode
      )
  )

  if (missingTaxCountries.length) {
    await createTaxRegionsWorkflow(container).run({
      input: missingTaxCountries.map((country_code) => ({
        country_code,
        provider_id: "tp_system",
        default_tax_rate: {
          name: "Nepal VAT",
          code: "NP-VAT",
          rate: 13,
        },
      })),
    })
  }
  logger.info("Finished seeding tax regions.")

  // Nepali retail prices are quoted with VAT already included, so a listed
  // NPR 1,500 is what the customer actually pays. Medusa creates these
  // preferences tax-exclusive by default, so flip them. They are created as a
  // side effect of the store and region workflows above, hence the query.
  const { data: pricePreferences } = await query.graph({
    entity: "price_preference",
    fields: ["id"],
  })
  await updatePricePreferencesWorkflow(container).run({
    input: {
      selector: { id: pricePreferences.map((pref) => pref.id) },
      update: { is_tax_inclusive: true },
    },
  })
  logger.info("Set prices to tax-inclusive.")

  logger.info("Seeding stock location data...")
  const { result: stockLocationResult } = await createStockLocationsWorkflow(
    container
  ).run({
    input: {
      locations: [
        {
          name: "Kathmandu Warehouse",
          address: {
            city: "Kathmandu",
            country_code: "NP",
            address_1: "",
          },
        },
      ],
    },
  })
  const stockLocation = stockLocationResult[0]

  const providerLink = {
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_provider_id: "manual_manual",
    },
  }
  await createLinkIfMissing(providerLink)

  logger.info("Seeding fulfillment data...")
  // The default shipping profile is created by a migration script in core.
  const { data: shippingProfileResult } = await query.graph({
    entity: "shipping_profile",
    fields: ["id", "name", "type"],
  })
  const standardProfile = shippingProfileResult[0]

  // Ceramics, glass and framed art need protective packaging and their own
  // shipping rate, so they live on a separate profile from everything else.
  const fragileProfile =
    shippingProfileResult.find((profile) => profile.name === "Fragile") ??
    (
      await createShippingProfilesWorkflow(container).run({
        input: {
          data: [
            {
              name: "Fragile",
              type: "fragile",
            },
          ],
        },
      })
    ).result[0]

  const existingFulfillmentSets =
    await fulfillmentModuleService.listFulfillmentSets(
      { name: "Kathmandu Warehouse delivery" },
      { relations: ["service_zones", "service_zones.geo_zones"] }
    )
  const fulfillmentSet =
    existingFulfillmentSets[0] ??
    (await fulfillmentModuleService.createFulfillmentSets({
      name: "Kathmandu Warehouse delivery",
      type: "shipping",
      service_zones: [
        {
          name: "Nepal",
          geo_zones: [
            {
              country_code: "np",
              type: "country",
            },
          ],
        },
      ],
    }))

  const fulfillmentSetLink = {
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_set_id: fulfillmentSet.id,
    },
  }
  await createLinkIfMissing(fulfillmentSetLink)

  const serviceZoneId = fulfillmentSet.service_zones[0].id
  // `as const` keeps operator narrowed to the literal "eq". Without it the
  // extracted array widens to string and no longer satisfies RuleOperatorType.
  const shippingRules = [
    {
      attribute: "enabled_in_store",
      value: "true",
      operator: "eq" as const,
    },
    {
      attribute: "is_return",
      value: "false",
      operator: "eq" as const,
    },
  ]

  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: "Standard Delivery",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: serviceZoneId,
        shipping_profile_id: standardProfile.id,
        type: {
          label: "Standard",
          description: "Delivered in 3-5 working days.",
          code: "standard",
        },
        prices: [...price(150, 5), { region_id: region.id, amount: 150 }],
        rules: shippingRules,
      },
      {
        name: "Express Delivery",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: serviceZoneId,
        shipping_profile_id: standardProfile.id,
        type: {
          label: "Express",
          description: "Delivered within 24 hours inside Kathmandu Valley.",
          code: "express",
        },
        prices: [...price(400, 12), { region_id: region.id, amount: 400 }],
        rules: shippingRules,
      },
      {
        name: "Fragile Handling",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: serviceZoneId,
        shipping_profile_id: fragileProfile.id,
        type: {
          label: "Fragile",
          description: "Crated and cushioned for ceramics, glass and framed art.",
          code: "fragile",
        },
        prices: [...price(350, 10), { region_id: region.id, amount: 350 }],
        rules: shippingRules,
      },
    ],
  })
  logger.info("Finished seeding fulfillment data.")

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: {
      id: stockLocation.id,
      add: [defaultSalesChannel.id],
    },
  })
  logger.info("Finished seeding stock location data.")

  logger.info("Seeding category data...")

  // Three pillars. Souvenirs are browsed by where they came from, gifts by who
  // they are for and why, and gear by trail use. A product commonly sits in
  // more than one tree at once.
  const { result: pillars } = await createProductCategoriesWorkflow(
    container
  ).run({
    input: {
      product_categories: [
        {
          name: "Souvenirs",
          is_active: true,
          metadata: {
            pillar_order: 0,
            pillar_eyebrow: "For travellers",
            pillar_motif: "peaks",
            pillar_blurb: "Browse every destination",
            pillar_blurb_href: "/destinations",
          },
        },
        {
          name: "Gifts",
          is_active: true,
          metadata: {
            pillar_order: 1,
            pillar_eyebrow: "For gift shoppers",
            pillar_motif: "mandala",
            pillar_blurb: "See all gifts",
          },
        },
        {
          name: "Gear",
          is_active: true,
          metadata: {
            pillar_order: 2,
            pillar_eyebrow: "For the trail",
            pillar_motif: "peaks",
            pillar_blurb: "See all gear",
          },
        },
      ],
    },
  })
  const souvenirsPillar = pillars.find((c) => c.name === "Souvenirs")!
  const giftsPillar = pillars.find((c) => c.name === "Gifts")!
  const gearPillar = pillars.find((c) => c.name === "Gear")!

  const destinationNames = [
    "Kathmandu Valley",
    "Pokhara",
    "Everest Region",
    "Chitwan",
    "Lumbini",
    "Ilam",
  ]
  const { result: destinationCategories } =
    await createProductCategoriesWorkflow(container).run({
      input: {
        product_categories: destinationNames.map((name) => ({
          name,
          is_active: true,
          parent_category_id: souvenirsPillar.id,
        })),
      },
    })

  const { result: giftGroups } = await createProductCategoriesWorkflow(
    container
  ).run({
    input: {
      product_categories: [
        {
          name: "By Occasion",
          is_active: true,
          parent_category_id: giftsPillar.id,
        },
        {
          name: "By Recipient",
          is_active: true,
          parent_category_id: giftsPillar.id,
        },
      ],
    },
  })
  const occasionGroup = giftGroups.find((c) => c.name === "By Occasion")!
  const recipientGroup = giftGroups.find((c) => c.name === "By Recipient")!

  const { result: gearGroups } = await createProductCategoriesWorkflow(
    container
  ).run({
    input: {
      product_categories: [
        {
          name: "Trekking",
          is_active: true,
          parent_category_id: gearPillar.id,
        },
        {
          name: "Mountaineering",
          is_active: true,
          parent_category_id: gearPillar.id,
        },
      ],
    },
  })
  const trekkingGroup = gearGroups.find((c) => c.name === "Trekking")!
  const mountaineeringGroup = gearGroups.find(
    (c) => c.name === "Mountaineering"
  )!

  const { result: giftLeaves } = await createProductCategoriesWorkflow(
    container
  ).run({
    input: {
      product_categories: [
        ...["Birthday", "Wedding", "Housewarming", "Dashain and Tihar"].map(
          (name) => ({
            name,
            is_active: true,
            parent_category_id: occasionGroup.id,
          })
        ),
        ...["For Him", "For Her", "For Parents", "For Kids"].map((name) => ({
          name,
          is_active: true,
          parent_category_id: recipientGroup.id,
        })),
      ],
    },
  })

  const { result: gearLeaves } = await createProductCategoriesWorkflow(
    container
  ).run({
    input: {
      product_categories: [
        ...["Daypacks", "Trekking Poles", "Sleeping Bags"].map((name) => ({
          name,
          is_active: true,
          parent_category_id: trekkingGroup.id,
        })),
        ...["Ice Axes", "Crampons", "Climbing Harnesses"].map((name) => ({
          name,
          is_active: true,
          parent_category_id: mountaineeringGroup.id,
        })),
      ],
    },
  })

  const dest = (name: string) =>
    destinationCategories.find((c) => c.name === name)!.id
  const gift = (name: string) => giftLeaves.find((c) => c.name === name)!.id
  const gear = (name: string) => gearLeaves.find((c) => c.name === name)!.id
  logger.info("Finished seeding category data.")

  logger.info("Seeding tags and collections...")

  // Cross-cutting traits that apply across both pillars.
  const tagValues = [
    "handmade",
    "eco-friendly",
    "lightweight",
    "fragile",
    "fair-trade",
  ]
  const { result: tagResult } = await createProductTagsWorkflow(container).run({
    input: {
      product_tags: tagValues.map((value) => ({ value })),
    },
  })
  const tag = (value: string) => tagResult.find((t) => t.value === value)!.id

  const { result: collectionResult } = await createCollectionsWorkflow(
    container
  ).run({
    input: {
      collections: [
        { title: "Handmade in Nepal", handle: "handmade-in-nepal" },
        { title: "Festival Picks", handle: "festival-picks" },
        { title: "Trail Essentials", handle: "trail-essentials" },
      ],
    },
  })
  const handmadeCollection = collectionResult.find(
    (c) => c.title === "Handmade in Nepal"
  )!
  const festivalCollection = collectionResult.find(
    (c) => c.title === "Festival Picks"
  )!
  const trailCollection = collectionResult.find(
    (c) => c.title === "Trail Essentials"
  )!
  logger.info("Finished seeding tags and collections.")

  logger.info("Seeding product data...")

  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Pashmina Shawl",
          handle: "pashmina-shawl",
          description:
            "Hand-loomed cashmere and silk shawl from the Kathmandu Valley, light enough to fold into a palm yet warm enough for a Himalayan evening.",
          status: ProductStatus.PUBLISHED,
          weight: 250,
          origin_country: "np",
          material: "Cashmere and silk",
          shipping_profile_id: standardProfile.id,
          collection_id: handmadeCollection.id,
          category_ids: [dest("Kathmandu Valley"), gift("For Her")],
          tag_ids: [tag("handmade"), tag("lightweight"), tag("fair-trade")],
          options: [
            { title: "Colour", values: ["Natural", "Charcoal", "Crimson"] },
          ],
          variants: [
            {
              title: "Natural",
              sku: "PASH-NAT",
              options: { Colour: "Natural" },
              prices: price(4500, 34),
            },
            {
              title: "Charcoal",
              sku: "PASH-CHR",
              options: { Colour: "Charcoal" },
              prices: price(4500, 34),
            },
            {
              title: "Crimson",
              sku: "PASH-CRI",
              options: { Colour: "Crimson" },
              prices: price(4800, 36),
            },
          ],
          sales_channels: [{ id: defaultSalesChannel.id }],
        },
        {
          title: "Tibetan Singing Bowl",
          handle: "tibetan-singing-bowl",
          // Takes an engraving; validated in workflows/hooks/add-to-cart.ts
          metadata: { engravable: true },
          description:
            "Hand-hammered seven-metal bowl with a striker and cushion. Each bowl is tuned by ear, so no two ring quite alike.",
          status: ProductStatus.PUBLISHED,
          weight: 900,
          origin_country: "np",
          material: "Seven-metal alloy",
          shipping_profile_id: fragileProfile.id,
          collection_id: handmadeCollection.id,
          category_ids: [dest("Kathmandu Valley"), gift("Housewarming")],
          tag_ids: [tag("handmade"), tag("fragile")],
          options: [
            { title: "Size", values: ["Small 4in", "Medium 6in", "Large 8in"] },
          ],
          variants: [
            {
              title: "Small 4in",
              sku: "BOWL-S",
              options: { Size: "Small 4in" },
              prices: price(3500, 26),
            },
            {
              title: "Medium 6in",
              sku: "BOWL-M",
              options: { Size: "Medium 6in" },
              prices: price(6500, 49),
            },
            {
              title: "Large 8in",
              sku: "BOWL-L",
              options: { Size: "Large 8in" },
              prices: price(11000, 83),
            },
          ],
          sales_channels: [{ id: defaultSalesChannel.id }],
        },
        {
          title: "Thangka Painting",
          handle: "thangka-painting",
          description:
            "Mineral pigment on cotton canvas, painted by Newari artists over several weeks and finished with a brocade border.",
          status: ProductStatus.PUBLISHED,
          weight: 600,
          origin_country: "np",
          material: "Cotton canvas and mineral pigment",
          shipping_profile_id: fragileProfile.id,
          collection_id: handmadeCollection.id,
          category_ids: [dest("Kathmandu Valley"), gift("Wedding")],
          tag_ids: [tag("handmade"), tag("fragile")],
          options: [{ title: "Size", values: ["A4", "A3"] }],
          variants: [
            {
              title: "A4",
              sku: "THNK-A4",
              options: { Size: "A4" },
              prices: price(8000, 60),
            },
            {
              title: "A3",
              sku: "THNK-A3",
              options: { Size: "A3" },
              prices: price(15000, 113),
            },
          ],
          sales_channels: [{ id: defaultSalesChannel.id }],
        },
        {
          title: "Khukuri Knife",
          handle: "khukuri-knife",
          // Takes an engraving; validated in workflows/hooks/add-to-cart.ts
          metadata: { engravable: true },
          description:
            "Forged from recycled spring steel with a rosewood handle and a hand-stitched leather sheath. The working blade of the Nepali hills.",
          status: ProductStatus.PUBLISHED,
          weight: 700,
          origin_country: "np",
          material: "Spring steel and rosewood",
          shipping_profile_id: standardProfile.id,
          collection_id: handmadeCollection.id,
          category_ids: [dest("Everest Region"), gift("For Him")],
          tag_ids: [tag("handmade")],
          options: [{ title: "Blade Length", values: ["10in", "12in"] }],
          variants: [
            {
              title: "10in",
              sku: "KHUK-10",
              options: { "Blade Length": "10in" },
              prices: price(5500, 41),
            },
            {
              title: "12in",
              sku: "KHUK-12",
              options: { "Blade Length": "12in" },
              prices: price(7500, 56),
            },
          ],
          sales_channels: [{ id: defaultSalesChannel.id }],
        },
        {
          title: "Lokta Paper Journal",
          handle: "lokta-paper-journal",
          // Takes an engraving; validated in workflows/hooks/add-to-cart.ts
          metadata: { engravable: true },
          description:
            "Bound by hand in bark paper from the Daphne shrub, harvested sustainably at altitude and naturally resistant to insects.",
          status: ProductStatus.PUBLISHED,
          weight: 300,
          origin_country: "np",
          material: "Lokta bark paper",
          shipping_profile_id: standardProfile.id,
          collection_id: handmadeCollection.id,
          category_ids: [dest("Kathmandu Valley"), gift("Birthday")],
          tag_ids: [
            tag("handmade"),
            tag("eco-friendly"),
            tag("lightweight"),
          ],
          options: [{ title: "Size", values: ["Pocket", "A5"] }],
          variants: [
            {
              title: "Pocket",
              sku: "LOKT-PKT",
              options: { Size: "Pocket" },
              prices: price(800, 6),
            },
            {
              title: "A5",
              sku: "LOKT-A5",
              options: { Size: "A5" },
              prices: price(1400, 11),
            },
          ],
          sales_channels: [{ id: defaultSalesChannel.id }],
        },
        {
          title: "Himalayan Prayer Flags",
          handle: "himalayan-prayer-flags",
          description:
            "Cotton flags block-printed with the windhorse and traditional mantras, strung in the fixed order of the five elements.",
          status: ProductStatus.PUBLISHED,
          weight: 200,
          origin_country: "np",
          material: "Cotton",
          shipping_profile_id: standardProfile.id,
          category_ids: [dest("Everest Region"), gift("Housewarming")],
          tag_ids: [tag("handmade"), tag("lightweight")],
          options: [{ title: "Length", values: ["5m", "10m"] }],
          variants: [
            {
              title: "5m",
              sku: "FLAG-5M",
              options: { Length: "5m" },
              prices: price(600, 5),
            },
            {
              title: "10m",
              sku: "FLAG-10M",
              options: { Length: "10m" },
              prices: price(1000, 8),
            },
          ],
          sales_channels: [{ id: defaultSalesChannel.id }],
        },
        {
          title: "Ilam Tea Sampler",
          handle: "ilam-tea-sampler",
          description:
            "First and second flush orthodox black tea from the Ilam hills, packed in a reusable tin with brewing notes.",
          status: ProductStatus.PUBLISHED,
          weight: 400,
          origin_country: "np",
          material: "Whole leaf black tea",
          shipping_profile_id: standardProfile.id,
          collection_id: festivalCollection.id,
          category_ids: [dest("Ilam"), gift("Dashain and Tihar")],
          tag_ids: [tag("eco-friendly"), tag("fair-trade")],
          options: [{ title: "Weight", values: ["100g", "250g"] }],
          variants: [
            {
              title: "100g",
              sku: "TEA-100",
              options: { Weight: "100g" },
              prices: price(900, 7),
            },
            {
              title: "250g",
              sku: "TEA-250",
              options: { Weight: "250g" },
              prices: price(2000, 15),
            },
          ],
          sales_channels: [{ id: defaultSalesChannel.id }],
        },
        {
          title: "Bhaktapur Window Carving",
          handle: "bhaktapur-window-carving",
          // Takes an engraving; validated in workflows/hooks/add-to-cart.ts
          metadata: { engravable: true },
          description:
            "A miniature of the lattice windows of Bhaktapur Durbar Square, carved in seasoned sal wood by Newari woodworkers.",
          status: ProductStatus.PUBLISHED,
          weight: 1500,
          origin_country: "np",
          material: "Sal wood",
          shipping_profile_id: fragileProfile.id,
          collection_id: handmadeCollection.id,
          category_ids: [dest("Kathmandu Valley"), gift("Housewarming")],
          tag_ids: [tag("handmade"), tag("fragile")],
          options: [{ title: "Size", values: ["Small", "Medium"] }],
          variants: [
            {
              title: "Small",
              sku: "CARV-S",
              options: { Size: "Small" },
              prices: price(4500, 34),
            },
            {
              title: "Medium",
              sku: "CARV-M",
              options: { Size: "Medium" },
              prices: price(9000, 68),
            },
          ],
          sales_channels: [{ id: defaultSalesChannel.id }],
        },
        {
          title: "Felted Wool Slippers",
          handle: "felted-wool-slippers",
          description:
            "Wet-felted from Himalayan sheep wool by a women's cooperative near Pokhara, with a suede sole added for indoor wear.",
          status: ProductStatus.PUBLISHED,
          weight: 350,
          origin_country: "np",
          material: "Felted wool and suede",
          shipping_profile_id: standardProfile.id,
          collection_id: handmadeCollection.id,
          category_ids: [dest("Pokhara"), gift("For Parents")],
          tag_ids: [
            tag("handmade"),
            tag("eco-friendly"),
            tag("lightweight"),
            tag("fair-trade"),
          ],
          options: [{ title: "Size", values: ["S", "M", "L"] }],
          variants: [
            {
              title: "S",
              sku: "SLIP-S",
              options: { Size: "S" },
              prices: price(1800, 14),
            },
            {
              title: "M",
              sku: "SLIP-M",
              options: { Size: "M" },
              prices: price(1800, 14),
            },
            {
              title: "L",
              sku: "SLIP-L",
              options: { Size: "L" },
              prices: price(1800, 14),
            },
          ],
          sales_channels: [{ id: defaultSalesChannel.id }],
        },
        {
          title: "Rudraksha Mala",
          handle: "rudraksha-mala",
          description:
            "Prayer beads strung by hand from five-faced rudraksha seeds, finished with a cotton tassel.",
          status: ProductStatus.PUBLISHED,
          weight: 150,
          origin_country: "np",
          material: "Rudraksha seed and cotton",
          shipping_profile_id: standardProfile.id,
          category_ids: [dest("Lumbini"), gift("For Parents")],
          tag_ids: [tag("handmade"), tag("lightweight")],
          options: [{ title: "Bead Count", values: ["54", "108"] }],
          variants: [
            {
              title: "54 beads",
              sku: "MALA-54",
              options: { "Bead Count": "54" },
              prices: price(2500, 19),
            },
            {
              title: "108 beads",
              sku: "MALA-108",
              options: { "Bead Count": "108" },
              prices: price(4200, 32),
            },
          ],
          sales_channels: [{ id: defaultSalesChannel.id }],
        },
        {
          title: "Dhaka Topi",
          handle: "dhaka-topi",
          description:
            "The traditional Nepali cap, cut from handwoven dhaka cloth. No two weaves repeat the same geometric pattern.",
          status: ProductStatus.PUBLISHED,
          weight: 120,
          origin_country: "np",
          material: "Handwoven dhaka cotton",
          shipping_profile_id: standardProfile.id,
          collection_id: festivalCollection.id,
          category_ids: [
            dest("Kathmandu Valley"),
            gift("For Him"),
            gift("Dashain and Tihar"),
          ],
          tag_ids: [tag("handmade"), tag("lightweight")],
          options: [{ title: "Size", values: ["M", "L"] }],
          variants: [
            {
              title: "M",
              sku: "TOPI-M",
              options: { Size: "M" },
              prices: price(1500, 11),
            },
            {
              title: "L",
              sku: "TOPI-L",
              options: { Size: "L" },
              prices: price(1500, 11),
            },
          ],
          sales_channels: [{ id: defaultSalesChannel.id }],
        },
        {
          title: "Carved Elephant Figurine",
          handle: "carved-elephant-figurine",
          // Takes an engraving; validated in workflows/hooks/add-to-cart.ts
          metadata: { engravable: true },
          description:
            "A one-horned rhino and elephant pair carved in the villages bordering Chitwan National Park, from sustainably felled wood.",
          status: ProductStatus.PUBLISHED,
          weight: 500,
          origin_country: "np",
          material: "Sheesham wood",
          shipping_profile_id: standardProfile.id,
          category_ids: [dest("Chitwan"), gift("For Kids")],
          tag_ids: [tag("handmade"), tag("eco-friendly")],
          options: [{ title: "Size", values: ["Small", "Large"] }],
          variants: [
            {
              title: "Small",
              sku: "ELEF-S",
              options: { Size: "Small" },
              prices: price(1200, 9),
            },
            {
              title: "Large",
              sku: "ELEF-L",
              options: { Size: "Large" },
              prices: price(2800, 21),
            },
          ],
          sales_channels: [{ id: defaultSalesChannel.id }],
        },
        {
          title: "Annapurna Daypack",
          handle: "annapurna-daypack",
          description:
            "A 28-litre trekking daypack with a ventilated back panel, rain cover and enough volume for a full day on the trail.",
          status: ProductStatus.PUBLISHED,
          weight: 980,
          origin_country: "np",
          material: "Ripstop nylon and aluminium stay",
          shipping_profile_id: standardProfile.id,
          collection_id: trailCollection.id,
          category_ids: [gear("Daypacks")],
          tag_ids: [tag("lightweight")],
          options: [{ title: "Colour", values: ["Slate", "Ochre"] }],
          variants: [
            {
              title: "Slate",
              sku: "DAYP-SLT",
              options: { Colour: "Slate" },
              prices: price(6200, 47),
            },
            {
              title: "Ochre",
              sku: "DAYP-OCH",
              options: { Colour: "Ochre" },
              prices: price(6200, 47),
            },
          ],
          sales_channels: [{ id: defaultSalesChannel.id }],
        },
        {
          title: "Langtang Down Sleeping Bag",
          handle: "langtang-down-sleeping-bag",
          description:
            "A cold-weather sleeping bag rated for high camps, filled with responsibly sourced down and cut to pack small.",
          status: ProductStatus.PUBLISHED,
          weight: 1450,
          origin_country: "np",
          material: "Recycled nylon shell and down fill",
          shipping_profile_id: standardProfile.id,
          collection_id: trailCollection.id,
          category_ids: [gear("Sleeping Bags")],
          tag_ids: [tag("lightweight")],
          options: [{ title: "Size", values: ["Regular", "Long"] }],
          variants: [
            {
              title: "Regular",
              sku: "BAG-REG",
              options: { Size: "Regular" },
              prices: price(12500, 94),
            },
            {
              title: "Long",
              sku: "BAG-LNG",
              options: { Size: "Long" },
              prices: price(13200, 100),
            },
          ],
          sales_channels: [{ id: defaultSalesChannel.id }],
        },
        {
          title: "Summit Ice Axe",
          handle: "summit-ice-axe",
          description:
            "A classic straight-shaft axe for glacier travel and steep snow, with a steel pick and adze forged for daily use.",
          status: ProductStatus.PUBLISHED,
          weight: 560,
          origin_country: "np",
          material: "Aluminium shaft and chromoly steel head",
          shipping_profile_id: standardProfile.id,
          collection_id: trailCollection.id,
          category_ids: [gear("Ice Axes")],
          tag_ids: [tag("lightweight")],
          options: [{ title: "Length", values: ["60cm", "70cm"] }],
          variants: [
            {
              title: "60cm",
              sku: "AXE-60",
              options: { Length: "60cm" },
              prices: price(9800, 74),
            },
            {
              title: "70cm",
              sku: "AXE-70",
              options: { Length: "70cm" },
              prices: price(10200, 77),
            },
          ],
          sales_channels: [{ id: defaultSalesChannel.id }],
        },
        {
          title: "Alpine Crampons",
          handle: "alpine-crampons",
          description:
            "Twelve-point steel crampons with anti-balling plates, built for mixed approaches where rock, neve and ice all turn up in one day.",
          status: ProductStatus.PUBLISHED,
          weight: 1040,
          origin_country: "np",
          material: "Heat-treated steel and polymer bindings",
          shipping_profile_id: standardProfile.id,
          collection_id: trailCollection.id,
          category_ids: [gear("Crampons")],
          tag_ids: [],
          options: [{ title: "Binding", values: ["Hybrid", "Step-In"] }],
          variants: [
            {
              title: "Hybrid",
              sku: "CRAM-HYB",
              options: { Binding: "Hybrid" },
              prices: price(11800, 89),
            },
            {
              title: "Step-In",
              sku: "CRAM-STP",
              options: { Binding: "Step-In" },
              prices: price(12600, 95),
            },
          ],
          sales_channels: [{ id: defaultSalesChannel.id }],
        },
      ],
    },
  })
  logger.info("Finished seeding product data.")

  logger.info("Seeding inventory levels...")

  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id"],
  })

  await createInventoryLevelsWorkflow(container).run({
    input: {
      inventory_levels: inventoryItems.map((item) => ({
        location_id: stockLocation.id,
        stocked_quantity: 100,
        inventory_item_id: item.id,
      })),
    },
  })

  logger.info("Finished seeding inventory levels data.")

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        metadata: {
          ...(store.metadata ?? {}),
          seed_version: SEED_VERSION,
        },
      },
    },
  })

  logger.info(`Finished Travories seed ${SEED_VERSION}.`)
}
