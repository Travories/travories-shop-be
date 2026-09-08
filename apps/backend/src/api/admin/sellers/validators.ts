import { z } from "@medusajs/framework/zod"

export const UpdateSellerSchema = z
  .object({
    status: z.enum(["pending", "active", "suspended", "rejected"]).optional(),
    // null clears the seller override so the platform default commission applies.
    commission_rate: z.number().min(0).max(100).nullable().optional(),
  })
  .refine((d) => d.status !== undefined || d.commission_rate !== undefined, {
    message: "Provide status and/or commission_rate",
  })

export type UpdateSellerSchema = z.infer<typeof UpdateSellerSchema>
