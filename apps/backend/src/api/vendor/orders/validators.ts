import { z } from "@medusajs/framework/zod"

export const CreateVendorFulfillmentSchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    quantity: z.number().positive(),
  })).min(1).superRefine((items, context) => {
    const seen = new Set<string>()

    items.forEach((item, index) => {
      if (seen.has(item.id)) {
        context.addIssue({
          code: "custom",
          message: "Each order item can only be fulfilled once per request",
          path: [index, "id"],
        })
      }
      seen.add(item.id)
    })
  }),
  labels: z.array(z.object({
    tracking_number: z.string(),
    tracking_url: z.string(),
    label_url: z.string(),
  })).optional(),
  no_notification: z.boolean().optional(),
})

export type CreateVendorFulfillmentSchema = z.infer<
  typeof CreateVendorFulfillmentSchema
>
