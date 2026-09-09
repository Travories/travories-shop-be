import { z } from "@medusajs/framework/zod"

export const ReviewVendorProductSchema = z.object({
  action: z.enum(["approve", "reject"]),
})

export type ReviewVendorProductSchema = z.infer<
  typeof ReviewVendorProductSchema
>
