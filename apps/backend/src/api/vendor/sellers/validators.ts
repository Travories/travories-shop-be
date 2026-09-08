import { z } from "@medusajs/framework/zod"

export const CreateSellerSchema = z.object({
  name: z.string().min(2),
  handle: z.string().min(2),
  email: z.email(),
  phone: z.string().optional(),
  description: z.string().optional(),
  // Optional display name for the first member; defaults to the seller name.
  member_name: z.string().optional(),
})

export type CreateSellerSchema = z.infer<typeof CreateSellerSchema>
