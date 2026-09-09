import {
  CreateVendorProductSchema,
  UpdateVendorProductSchema,
} from "../validators"

describe("CreateVendorProductSchema", () => {
  it("accepts a full near-parity product payload", () => {
    const result = CreateVendorProductSchema.safeParse({
      title: "Handwoven Pashmina",
      subtitle: "From the Kathmandu valley",
      description: "Soft, warm, handmade.",
      status: "proposed",
      images: [{ url: "https://cdn.example/pashmina.jpg" }],
      material: "Wool",
      weight: 250,
      tags: ["handmade", "wool"],
      category_ids: ["pcat_1"],
      collection_id: "pcol_1",
      destination_id: "dest_1",
      artisan_id: "art_1",
      metadata: { origin: "Nepal" },
      options: [{ title: "Size", values: ["S", "M", "L"] }],
      variants: [
        {
          title: "Medium",
          sku: "PASH-M",
          prices: [{ amount: 4500, currency_code: "npr" }],
          options: { Size: "M" },
          manage_inventory: true,
          inventory_quantity: 10,
        },
      ],
    })
    expect(result.success).toBe(true)
  })

  it("rejects a vendor attempt to self-publish", () => {
    const result = CreateVendorProductSchema.safeParse({
      title: "Sneaky product",
      status: "published",
    })
    expect(result.success).toBe(false)
  })

  it("rejects non-positive prices", () => {
    const result = CreateVendorProductSchema.safeParse({
      title: "Bad price",
      variants: [
        { title: "Default", prices: [{ amount: 0, currency_code: "npr" }] },
      ],
    })
    expect(result.success).toBe(false)
  })

  it("requires a title of at least two characters", () => {
    expect(CreateVendorProductSchema.safeParse({ title: "x" }).success).toBe(
      false
    )
  })
})

describe("UpdateVendorProductSchema", () => {
  it("accepts a partial update", () => {
    expect(
      UpdateVendorProductSchema.safeParse({ description: "Updated copy" })
        .success
    ).toBe(true)
  })

  it("rejects an empty update", () => {
    expect(UpdateVendorProductSchema.safeParse({}).success).toBe(false)
  })

  it("rejects setting status to published on update", () => {
    expect(
      UpdateVendorProductSchema.safeParse({ status: "published" }).success
    ).toBe(false)
  })
})
