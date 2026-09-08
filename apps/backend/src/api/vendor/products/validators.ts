import { z } from "@medusajs/framework/zod"

const PriceSchema = z.object({
  amount: z.number(),
  currency_code: z.string(),
})

const VariantSchema = z.object({
  title: z.string(),
  sku: z.string().optional(),
  prices: z.array(PriceSchema).optional(),
  options: z.record(z.string(), z.string()).optional(),
})

const OptionSchema = z.object({
  title: z.string(),
  values: z.array(z.string()),
})

export const CreateVendorProductSchema = z.object({
  title: z.string().min(2),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  handle: z.string().optional(),
  status: z.enum(["draft", "proposed", "published"]).optional(),
  thumbnail: z.string().optional(),
  options: z.array(OptionSchema).optional(),
  variants: z.array(VariantSchema).optional(),
})

export type CreateVendorProductSchema = z.infer<typeof CreateVendorProductSchema>

export const UpdateVendorProductSchema = z
  .object({
    title: z.string().optional(),
    subtitle: z.string().optional(),
    description: z.string().optional(),
    status: z.enum(["draft", "proposed", "published"]).optional(),
    thumbnail: z.string().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "Provide at least one field to update",
  })

export type UpdateVendorProductSchema = z.infer<typeof UpdateVendorProductSchema>
