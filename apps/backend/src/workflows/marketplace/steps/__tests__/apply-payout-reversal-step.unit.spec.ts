import { calculatePayoutReversalAmount } from "../apply-payout-reversal-step"

describe("calculatePayoutReversalAmount", () => {
  it("reverses the proportional seller payout for a partial refund", () => {
    expect(calculatePayoutReversalAmount({
      original: 2625,
      reversed: 0,
      type: "refund",
      refundAmount: 750,
      orderTotal: 3000,
    })).toBe(656.25)
  })

  it("caps repeated reversals at the remaining payout", () => {
    expect(calculatePayoutReversalAmount({
      original: 2625,
      reversed: 2500,
      type: "refund",
      refundAmount: 3000,
      orderTotal: 3000,
    })).toBe(125)
  })

  it("fully reverses the remaining payout on cancellation", () => {
    expect(calculatePayoutReversalAmount({
      original: 2625,
      reversed: 656.25,
      type: "cancellation",
      orderTotal: 3000,
    })).toBe(1968.75)
  })

  it("does not reverse a refund without a valid order total", () => {
    expect(calculatePayoutReversalAmount({
      original: 2625,
      reversed: 0,
      type: "refund",
      refundAmount: 100,
      orderTotal: 0,
    })).toBe(0)
  })

  it("does not create a negative reversal", () => {
    expect(calculatePayoutReversalAmount({
      original: 2625,
      reversed: 2625,
      type: "cancellation",
      orderTotal: 3000,
    })).toBe(0)
  })
})
