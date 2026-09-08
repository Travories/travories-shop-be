import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import { createOrderPayoutsWorkflow } from "../workflows/marketplace/create-order-payouts"

const VENDOR_PRODUCT_ID = "prod_01M1ZPYAV61A3Z2NWZBG3M891J"

export default async function testPayouts({ container }: { container: any }) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id", "currency_code"],
  })
  const region =
    regions.find((r: any) => r.currency_code === "npr") ?? regions[0]

  const { data: channels } = await query.graph({
    entity: "sales_channel",
    fields: ["id", "name"],
  })

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "title", "variants.id", "variants.title", "seller.id"],
    filters: { id: VENDOR_PRODUCT_ID },
  })
  const product = products[0]
  const variant = product?.variants?.[0]

  console.log("region:", region?.id, region?.currency_code)
  console.log("sales_channel:", channels[0]?.id)
  console.log("product:", product?.id, "seller:", product?.seller?.id)
  console.log("variant:", variant?.id)

  // Create the order directly via the Order module (bypasses inventory
  // reservation, which the not-yet-sale-ready vendor variant lacks).
  const orderService: any = container.resolve(Modules.ORDER)
  const order = await orderService.createOrders({
    region_id: region.id,
    currency_code: "npr",
    email: "buyer@test.com",
    sales_channel_id: channels[0]?.id,
    items: [
      {
        title: variant?.title ?? "One Size",
        quantity: 2,
        unit_price: 1500,
        product_id: VENDOR_PRODUCT_ID,
        variant_id: variant?.id,
      },
    ],
  })

  console.log("order created:", order.id)

  const { data: check } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "currency_code",
      "total",
      "item_subtotal",
      "items.unit_price",
      "items.quantity",
      "items.subtotal",
      "items.total",
      "items.product_id",
    ],
    filters: { id: order.id },
  })
  console.log("ORDER CHECK:", JSON.stringify(check[0], null, 2))

  // Replicate exactly what the payout step queries.
  const { data: stepOrders } = await query.graph({
    entity: "order",
    fields: ["id", "currency_code", "items.subtotal", "items.product_id"],
    filters: { id: order.id },
  })
  const stepItem = (stepOrders[0] as any)?.items?.[0]
  console.log("STEP item.subtotal typeof:", typeof stepItem?.subtotal)
  console.log("STEP item.subtotal value:", stepItem?.subtotal)
  console.log(
    "STEP item.subtotal keys:",
    stepItem?.subtotal && typeof stepItem.subtotal === "object"
      ? Object.keys(stepItem.subtotal)
      : "n/a"
  )
  console.log("STEP Number(subtotal):", Number(stepItem?.subtotal))
  console.log("STEP subtotal.numeric:", stepItem?.subtotal?.numeric)

  const { result: payouts } = await createOrderPayoutsWorkflow(container).run({
    input: { order_id: order.id },
  })
  console.log("PAYOUTS (first run):", JSON.stringify(payouts, null, 2))

  const { result: again } = await createOrderPayoutsWorkflow(container).run({
    input: { order_id: order.id },
  })
  console.log("PAYOUTS (second run, expect empty - idempotent):", again.length)
}
