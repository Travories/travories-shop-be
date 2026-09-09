import { z } from "@medusajs/framework/zod"

const PriceSchema = z.object({
  amount: z.number().positive(),
  currency_code: z.string(),
})

const VariantSchema = z.object({
  title: z.string().min(1),
  sku: z.string().optional(),
  prices: z.array(PriceSchema).optional(),
  options: z.record(z.string(), z.string()).optional(),
  // Inventory: when managed, stock is tracked at the default location and
  // seeded with inventory_quantity. When false, the variant is always in stock.
  manage_inventory: z.boolean().optional(),
  inventory_quantity: z.number().int().min(0).optional(),
})

// On update a variant may already exist (carries an id) and any field can be
// partial, so title is optional here.
const UpdateVariantSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1).optional(),
  sku: z.string().optional(),
  prices: z.array(PriceSchema).optional(),
  options: z.record(z.string(), z.string()).optional(),
  manage_inventory: z.boolean().optional(),
  inventory_quantity: z.number().int().min(0).optional(),
})

const OptionSchema = z.object({
  title: z.string(),
  values: z.array(z.string()),
})

const ImageSchema = z.object({
  url: z.string(),
})

// Fields shared by create and update. Vendors can never set a product to
// "published"/"rejected" — only the admin approval flow does that — so the
// vendor-settable status is limited to draft|proposed ("submit for review").
const VendorProductFields = {
  title: z.string().min(2),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  handle: z.string().optional(),
  status: z.enum(["draft", "proposed"]).optional(),
  thumbnail: z.string().optional(),
  images: z.array(ImageSchema).optional(),
  material: z.string().optional(),
  weight: z.number().positive().optional(),
  tags: z.array(z.string()).optional(),
  category_ids: z.array(z.string()).optional(),
  collection_id: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  // Custom souvenir taxonomy (linked, not core product fields).
  destination_id: z.string().optional(),
  artisan_id: z.string().optional(),
  options: z.array(OptionSchema).optional(),
  variants: z.array(VariantSchema).optional(),
}

export const CreateVendorProductSchema = z.object(VendorProductFields)

export type CreateVendorProductSchema = z.infer<typeof CreateVendorProductSchema>

export const UpdateVendorProductSchema = z
  .object({
    ...VendorProductFields,
    title: z.string().min(2).optional(),
    variants: z.array(UpdateVariantSchema).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "Provide at least one field to update",
  })

export type UpdateVendorProductSchema = z.infer<typeof UpdateVendorProductSchema>
