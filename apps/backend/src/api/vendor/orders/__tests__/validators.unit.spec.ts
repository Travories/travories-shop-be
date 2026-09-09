import { CreateVendorFulfillmentSchema } from "../validators"

describe("CreateVendorFulfillmentSchema", () => {
  it("accepts seller shipment details", () => {
    expect(CreateVendorFulfillmentSchema.safeParse({
      items: [{ id: "item_1", quantity: 2 }],
      labels: [{
        tracking_number: "TRACK-123",
        tracking_url: "https://carrier.example/track/TRACK-123",
        label_url: "https://carrier.example/labels/TRACK-123.pdf",
      }],
    }).success).toBe(true)
  })

  it("rejects duplicate order items in one fulfillment", () => {
    expect(CreateVendorFulfillmentSchema.safeParse({
      items: [
        { id: "item_1", quantity: 1 },
        { id: "item_1", quantity: 1 },
      ],
    }).success).toBe(false)
  })

  it("rejects non-positive fulfillment quantities", () => {
    expect(CreateVendorFulfillmentSchema.safeParse({
      items: [{ id: "item_1", quantity: 0 }],
    }).success).toBe(false)
  })
})
