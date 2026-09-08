import { z } from "@medusajs/framework/zod"

export const UpdatePayoutSchema = z
  .object({
    status: z.enum(["pending", "paid"]).optional(),
    // The eSewa/bank transfer reference recorded when settling.
    reference: z.string().nullable().optional(),
  })
  .refine((d) => d.status !== undefined || d.reference !== undefined, {
    message: "Provide status and/or reference",
  })

export type UpdatePayoutSchema = z.infer<typeof UpdatePayoutSchema>
