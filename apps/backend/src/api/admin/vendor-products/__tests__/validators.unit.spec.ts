import { ReviewVendorProductSchema } from "../validators"

describe("ReviewVendorProductSchema", () => {
  it("accepts approve and reject actions", () => {
    expect(ReviewVendorProductSchema.safeParse({ action: "approve" }).success).toBe(
      true
    )
    expect(ReviewVendorProductSchema.safeParse({ action: "reject" }).success).toBe(
      true
    )
  })

  it("rejects unknown actions", () => {
    expect(
      ReviewVendorProductSchema.safeParse({ action: "publish" }).success
    ).toBe(false)
  })
})
